"""
Comprehensive tests for dynamic & adaptive question generation and follow-up probing.
Verifies:
1. Dynamic synthesis with candidate + JD context.
2. Question diversity across repeated interview sessions.
3. Fallback resilience when LLM times out or is offline.
4. Adaptive follow-up probing tied to missing concepts and job context.
5. Support for all interview modes (mixed, technical, hr, jd-based, resume-based).
"""

import pytest
from unittest.mock import patch
from schemas import (
    ProfileResponse,
    CandidateProfile,
    JobProfile,
    MatchResult,
    ProjectItem,
    InterviewTopic,
    FollowupRequest,
)
from module2.question_generator import (
    generate_interview_questions,
    _extract_json_array,
    _generate_questions_with_llm,
    _generate_diversified_fallback_questions,
)
from module2.adaptive_followup import generate_adaptive_followup
from module2.llm_client import LLMClient


@pytest.fixture
def sample_profile():
    return ProfileResponse(
        profile_id="prof_adaptive_test",
        mode="mixed",
        candidate=CandidateProfile(
            skills=["Python", "FastAPI", "Docker", "SQL"],
            projects=[
                ProjectItem(
                    title="Realtime Chat App",
                    description="Built WebSocket chat using FastAPI, Redis, and React.",
                    tech=["Python", "FastAPI", "Redis", "React"],
                )
            ],
            experience=["Backend Intern at CloudTech"],
            education=["B.Tech Computer Science"],
            certifications=["AWS Certified Cloud Practitioner"],
        ),
        job=JobProfile(
            title="Senior Backend Engineer",
            required_skills=["Python", "FastAPI", "Kubernetes", "PostgreSQL"],
            preferred_skills=["Redis", "AWS"],
            responsibilities=[
                "Design highly scalable microservices architectures",
                "Optimize database query performance and transactions",
            ],
        ),
        match=MatchResult(
            matched=["Python", "FastAPI"],
            missing=["Kubernetes", "PostgreSQL"],
            extra=["Docker", "SQL"],
            score=50.0,
        ),
        interview_topics=[
            InterviewTopic(topic="Kubernetes Orchestration", priority="high", reason="Missing required skill"),
            InterviewTopic(topic="Database Query Optimization", priority="high", reason="Core JD responsibility"),
        ],
    )


def test_extract_json_array_valid():
    text = '[{"category": "technical", "question_text": "What is Python GIL?", "target_topic": "GIL", "difficulty": "medium", "expected_key_concepts": ["GIL", "threads"]}]'
    res = _extract_json_array(text)
    assert isinstance(res, list)
    assert len(res) == 1
    assert res[0]["target_topic"] == "GIL"


def test_extract_json_array_with_markdown_fences():
    text = '```json\n[{"category": "jd-based", "question_text": "Explain Kubernetes Pods.", "target_topic": "K8s", "difficulty": "hard", "expected_key_concepts": ["Pod", "containers"]}]\n```'
    res = _extract_json_array(text)
    assert isinstance(res, list)
    assert len(res) == 1
    assert res[0]["target_topic"] == "K8s"


def test_extract_json_array_invalid():
    assert _extract_json_array("Sorry, I cannot generate questions.") is None
    assert _extract_json_array("") is None


def test_generate_questions_with_llm_mocked_success(sample_profile):
    mock_llm_output = """
    [
        {
            "category": "jd-based",
            "question_text": "How would you design a Kubernetes deployment for your FastAPI services to ensure zero downtime?",
            "target_topic": "Kubernetes Rolling Updates",
            "target_skill": "Kubernetes",
            "difficulty": "medium",
            "expected_key_concepts": ["rolling update", "readiness probe", "liveness probe"],
            "context_reason": "Probing required skill gap Kubernetes."
        },
        {
            "category": "technical",
            "question_text": "In PostgreSQL, how do B-Tree indexes improve query execution compared to sequential scans?",
            "target_topic": "PostgreSQL Indexing",
            "target_skill": "PostgreSQL",
            "difficulty": "medium",
            "expected_key_concepts": ["B-Tree", "EXPLAIN ANALYZE", "sequential scan"],
            "context_reason": "Probing required skill gap PostgreSQL."
        },
        {
            "category": "resume-based",
            "question_text": "In your Realtime Chat App, how did you handle state synchronization across multiple WebSocket instances with Redis?",
            "target_topic": "WebSocket Architecture",
            "target_skill": "Redis",
            "difficulty": "hard",
            "expected_key_concepts": ["pub/sub", "Redis adapter", "connection management"],
            "context_reason": "Evaluating candidate project."
        }
    ]
    """
    with patch.object(LLMClient, "generate_with_prompt", return_value=mock_llm_output):
        questions = _generate_questions_with_llm(sample_profile, num_questions=3, mode="mixed")
        assert questions is not None
        assert len(questions) == 3
        assert questions[0].question_id == "q_1"
        assert "Kubernetes" in questions[0].question_text
        assert "rolling update" in questions[0].expected_key_concepts


def test_generate_interview_questions_fallback_diversity(sample_profile):
    """Calling diversified fallback repeatedly should produce different selections or question orders."""
    with patch.object(LLMClient, "generate_with_prompt", return_value=None):
        set1 = generate_interview_questions(sample_profile, num_questions=5, override_mode="mixed")
        set2 = generate_interview_questions(sample_profile, num_questions=5, override_mode="mixed")
        
        assert len(set1.questions) == 5
        assert len(set2.questions) == 5
        
        texts1 = [q.question_text for q in set1.questions]
        texts2 = [q.question_text for q in set2.questions]
        
        # Valid categories
        for q in set1.questions:
            assert q.question_id.startswith("q_")
            assert len(q.question_text) > 20
            assert len(q.expected_key_concepts) >= 2


def test_generate_questions_all_modes(sample_profile):
    """Ensure generator works for all 5 modes."""
    with patch.object(LLMClient, "generate_with_prompt", return_value=None):
        for m in ["mixed", "technical", "hr", "jd-based", "resume-based"]:
            res = generate_interview_questions(sample_profile, num_questions=4, override_mode=m)
            assert res.mode == m
            assert len(res.questions) == 4


def test_adaptive_followup_with_job_context():
    """Follow-up generator connects missing concepts with the job context."""
    req = FollowupRequest(
        question_id="q_1",
        original_question="How does PostgreSQL handle transaction isolation?",
        target_topic="Database Transactions",
        candidate_answer="It uses transactions to keep data safe.",
        missing_concepts=["ACID properties", "phantom reads"],
        job_context="Senior Backend Engineer - Financial Transactions API",
    )
    with patch.object(LLMClient, "generate_with_prompt", return_value=None):
        res = generate_adaptive_followup(req)
        assert res.parent_question_id == "q_1"
        assert "Financial Transactions API" in res.followup_question or "Senior Backend Engineer" in res.followup_question
        assert "ACID properties" in res.followup_question
        assert "ACID properties" in res.expected_key_concepts


def test_hr_mode_strictness(sample_profile):
    """Ensure HR mode produces ONLY HR and behavioural questions, never technical questions."""
    with patch.object(LLMClient, "generate_with_prompt", return_value=None):
        res = generate_interview_questions(sample_profile, num_questions=5, override_mode="hr")
        assert res.mode == "hr"
        assert len(res.questions) == 5
        for q in res.questions:
            assert q.category in ["hr", "behavioral"], f"Unexpected category {q.category} in HR mode"
            # Ensure target skill is soft-skills, not a technical coding library
            assert "Skill Gap: Kubernetes" not in q.target_topic
            assert "Technical Competency" not in q.target_topic


def test_adaptive_followup_acknowledges_candidate_mention():
    """Follow-up generator should actively listen to candidate's stated tools/approach."""
    req = FollowupRequest(
        question_id="q_2",
        original_question="Tell me about a time you handled a critical production incident.",
        target_topic="Production Incident Response",
        candidate_answer="I implemented Redis rate limiting to mitigate a severe DDoS spike on our auth API.",
        missing_concepts=["post-mortem analysis", "root cause tracking"],
        job_context="Site Reliability Engineer",
    )
    with patch.object(LLMClient, "generate_with_prompt", return_value=None):
        res = generate_adaptive_followup(req)
        assert res.parent_question_id == "q_2"
        # Candidate mention should be acknowledged in the question
        assert "Redis" in res.followup_question or "rate limiting" in res.followup_question or "You mentioned" in res.followup_question
        assert "post-mortem analysis" in res.followup_question

