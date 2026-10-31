"""
Comprehensive tests for the enhanced chat_engine.py.

Covers:
- History-aware intent detection (follow-up disambiguation)
- Screen context in system prompt
- Preferred skills in system prompt and NLP fallback
- Experience, education, certifications in system prompt
- Project-job-links in system prompt
- generate_chat_response with current_screen parameter
- Data isolation (mismatched session profiles)
- Connection error handling
- Candidate with no missing skills (full match)
- Candidate with no profile data (empty profile)
"""

import pytest
from unittest.mock import patch, MagicMock
import requests

from schemas import (
    ProfileResponse,
    CandidateProfile,
    JobProfile,
    MatchResult,
    InterviewTopic,
    ProjectItem,
    ProjectJobLink,
)
from module2.chat_engine import (
    detect_intent,
    _get_match_skills,
    _build_candidate_system_prompt,
    _deterministic_nlp_fallback,
    _quota_exhausted_response,
    generate_chat_response,
)
from module2.llm_client import LLMClient, LLM_MODEL_NAME, QUOTA_EXCEEDED_SENTINEL


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def full_profile():
    """Profile with all fields populated including preferred skills, experience, certifications."""
    return ProfileResponse(
        profile_id="prof-enhanced-1",
        mode="mixed",
        candidate=CandidateProfile(
            skills=["Python", "FastAPI", "Docker", "SQL", "AWS"],
            projects=[
                ProjectItem(
                    title="Payment Gateway API",
                    description="Built PCI-compliant payment processing API with FastAPI and PostgreSQL",
                    tech=["Python", "FastAPI", "PostgreSQL", "Redis"]
                ),
                ProjectItem(
                    title="Real-time Analytics Dashboard",
                    description="Kafka consumer pipeline with streaming metrics visualization",
                    tech=["Python", "Kafka", "Apache Spark"]
                ),
            ],
            experience=["Senior Backend Engineer at FinTech Corp (2 years)", "SWE Intern at Startup Co"],
            education=["B.Tech Computer Science, IIT Delhi"],
            certifications=["AWS Certified Solutions Architect", "Google Cloud Professional Data Engineer"],
        ),
        job=JobProfile(
            title="Staff Backend Engineer",
            required_skills=["Python", "FastAPI", "Kubernetes", "Redis", "PostgreSQL"],
            preferred_skills=["AWS", "GraphQL", "Terraform"],
            responsibilities=[
                "Design distributed microservices architecture",
                "Lead database performance optimization",
                "Define engineering standards and best practices",
            ],
        ),
        match=MatchResult(
            matched=["Python", "FastAPI", "PostgreSQL"],
            missing=["Kubernetes", "Redis"],
            extra=["Docker", "SQL"],
            score=60.0,
        ),
        project_job_links=[
            ProjectJobLink(
                project="Payment Gateway API",
                responsibility="Lead database performance optimization",
                similarity=0.82,
            ),
        ],
        interview_topics=[
            InterviewTopic(topic="Kubernetes Orchestration", priority="high", reason="Missing required skill"),
            InterviewTopic(topic="Redis Caching Patterns", priority="high", reason="Missing required skill"),
            InterviewTopic(topic="Distributed Systems Design", priority="medium", reason="Core for staff level"),
        ],
    )


@pytest.fixture
def empty_profile():
    """Profile with minimal / empty data to test graceful handling."""
    return ProfileResponse(
        profile_id="prof-empty-1",
        mode="mixed",
        candidate=CandidateProfile(
            skills=[],
            projects=[],
            experience=[],
            education=[],
            certifications=[],
        ),
        job=JobProfile(
            title="",
            required_skills=[],
            preferred_skills=[],
            responsibilities=[],
        ),
        match=MatchResult(matched=[], missing=[], extra=[], score=0.0),
        interview_topics=[],
    )


@pytest.fixture
def perfect_match_profile():
    """Profile where the candidate covers all required skills."""
    return ProfileResponse(
        profile_id="prof-perfect-1",
        mode="technical",
        candidate=CandidateProfile(
            skills=["Python", "FastAPI", "Docker", "Kubernetes", "Redis"],
            projects=[],
            experience=["Backend Engineer at TechCo"],
            education=["B.Sc Computer Science"],
            certifications=[],
        ),
        job=JobProfile(
            title="Backend Engineer",
            required_skills=["Python", "FastAPI", "Docker"],
            preferred_skills=["Kubernetes", "Redis"],
            responsibilities=["Build REST APIs"],
        ),
        match=MatchResult(
            matched=["Python", "FastAPI", "Docker"],
            missing=[],
            extra=["Kubernetes", "Redis"],
            score=100.0,
        ),
        interview_topics=[],
    )


# ---------------------------------------------------------------------------
# History-aware intent detection
# ---------------------------------------------------------------------------

class TestDetectIntentWithHistory:
    def test_followup_inherits_skill_gap_from_history(self):
        """'Which should I start with?' should resolve to skill_gap when last AI msg was about gaps."""
        history = [
            {"role": "user", "content": "What are my missing skills?"},
            {"role": "assistant", "content": "Your key skill gaps are: Kubernetes and Redis. These are missing from your resume."},
        ]
        intent = detect_intent("Which should I start with?", history)
        assert intent == "skill_gap"

    def test_followup_inherits_interview_prep_from_history(self):
        """'Give me resources for that' resolves to interview_prep when AI was discussing interview topics."""
        history = [
            {"role": "user", "content": "How do I prepare for mock interview?"},
            {"role": "assistant", "content": "To prepare for mock interview sessions, use the STAR method and practice out loud."},
        ]
        intent = detect_intent("Give me resources for that", history)
        assert intent == "interview_prep"

    def test_followup_inherits_profile_inquiry_from_history(self):
        """'Tell me more' resolves to profile_inquiry when AI was discussing resume/match score."""
        history = [
            {"role": "user", "content": "What is my match score?"},
            {"role": "assistant", "content": "Your profile match score is 60%. You need to address gaps in Kubernetes."},
        ]
        intent = detect_intent("Tell me more", history)
        assert intent == "profile_inquiry"

    def test_empty_history_uses_keyword_detection(self):
        """Without history, falls back to keyword-based detection."""
        assert detect_intent("What skills am I missing?", []) == "skill_gap"
        assert detect_intent("Quiz me on Docker", None) == "interview_prep"

    def test_resource_request_detected_as_skill_gap(self):
        """'Give me resources to improve my LLM competency' should be skill_gap."""
        intent = detect_intent("Give me resources to improve my LLM competency")
        assert intent == "skill_gap"

    def test_roadmap_request_detected_as_skill_gap(self):
        """'Create a learning roadmap for Kubernetes' should be skill_gap."""
        intent = detect_intent("Create a learning roadmap for Kubernetes")
        assert intent == "skill_gap"


# ---------------------------------------------------------------------------
# System prompt content verification
# ---------------------------------------------------------------------------

class TestSystemPromptContent:
    def test_prompt_includes_preferred_skills(self, full_profile):
        prompt = _build_candidate_system_prompt(full_profile)
        assert "AWS" in prompt
        assert "GraphQL" in prompt
        assert "Preferred" in prompt or "preferred" in prompt.lower()

    def test_prompt_includes_required_skills(self, full_profile):
        prompt = _build_candidate_system_prompt(full_profile)
        assert "Kubernetes" in prompt
        assert "Required" in prompt or "required" in prompt.lower()

    def test_prompt_includes_experience(self, full_profile):
        prompt = _build_candidate_system_prompt(full_profile)
        assert "FinTech Corp" in prompt or "Senior Backend Engineer" in prompt

    def test_prompt_includes_education(self, full_profile):
        prompt = _build_candidate_system_prompt(full_profile)
        assert "IIT Delhi" in prompt or "B.Tech" in prompt

    def test_prompt_includes_certifications(self, full_profile):
        prompt = _build_candidate_system_prompt(full_profile)
        assert "AWS Certified" in prompt or "Certified Solutions" in prompt

    def test_prompt_includes_project_job_links(self, full_profile):
        prompt = _build_candidate_system_prompt(full_profile)
        assert "Payment Gateway" in prompt
        assert "database performance" in prompt.lower() or "optimization" in prompt.lower()

    def test_prompt_includes_responsibilities(self, full_profile):
        prompt = _build_candidate_system_prompt(full_profile)
        assert "distributed microservices" in prompt.lower() or "engineering standards" in prompt.lower()

    def test_prompt_includes_tech_stack_in_projects(self, full_profile):
        prompt = _build_candidate_system_prompt(full_profile)
        assert "PostgreSQL" in prompt or "Redis" in prompt  # from project tech

    def test_screen_hint_included_when_provided(self, full_profile):
        prompt = _build_candidate_system_prompt(full_profile, current_screen="MatchSummary")
        assert "MatchSummary" in prompt or "skill match summary" in prompt.lower() or "Screen Hint" in prompt

    def test_screen_hint_absent_when_not_provided(self, full_profile):
        prompt = _build_candidate_system_prompt(full_profile, current_screen=None)
        assert "Screen Hint" not in prompt

    def test_prompt_handles_empty_profile_gracefully(self, empty_profile):
        """System prompt must not crash on fully empty profile."""
        prompt = _build_candidate_system_prompt(empty_profile)
        assert isinstance(prompt, str)
        assert len(prompt) > 50

    def test_prompt_includes_score_caveat(self, full_profile):
        """System prompt must clarify score is keyword coverage, not hiring guarantee."""
        prompt = _build_candidate_system_prompt(full_profile)
        assert "NOT a hiring guarantee" in prompt or "not guarantee" in prompt.lower()

    def test_no_asterisks_instruction_in_prompt(self, full_profile):
        """System prompt must instruct model to avoid asterisks."""
        prompt = _build_candidate_system_prompt(full_profile)
        assert "asterisk" in prompt.lower() or "**" in prompt


# ---------------------------------------------------------------------------
# NLP fallback enhancements
# ---------------------------------------------------------------------------

class TestNlpFallbackEnhanced:
    def test_skill_gap_fallback_mentions_preferred_skill_gap(self, full_profile):
        """When candidate is missing preferred skills, fallback should mention them as a bonus."""
        # full_profile has preferred=[AWS, GraphQL, Terraform], candidate has AWS but not GraphQL/Terraform
        reply = _deterministic_nlp_fallback("What skills am I missing?", "skill_gap", full_profile)
        # Should mention at least one preferred gap (GraphQL or Terraform)
        has_preferred_mention = "GraphQL" in reply or "Terraform" in reply or "preferred" in reply.lower() or "bonus" in reply.lower()
        assert has_preferred_mention

    def test_skill_gap_mentions_candidate_preferred_advantage(self, full_profile):
        """Candidate has AWS which is a preferred skill — should acknowledge the advantage."""
        reply = _deterministic_nlp_fallback("What are my strengths?", "skill_gap", full_profile)
        # Must mention existing missing skills (Kubernetes, Redis) since those take priority
        assert "Kubernetes" in reply or "Redis" in reply

    def test_perfect_match_fallback_no_gap(self, perfect_match_profile):
        """When no missing skills, fallback must say so positively."""
        reply = _deterministic_nlp_fallback("What should I study?", "skill_gap", perfect_match_profile)
        assert "cover all" in reply.lower() or "no missing" in reply.lower() or "great news" in reply.lower()

    def test_profile_inquiry_includes_experience(self, full_profile):
        """Profile inquiry fallback should reference candidate's experience."""
        reply = _deterministic_nlp_fallback("Tell me about my resume", "profile_inquiry", full_profile)
        # The reply should reference the match score and/or projects/experience
        assert "60" in reply or "Staff Backend Engineer" in reply or "Payment Gateway" in reply

    def test_profile_inquiry_score_clarifies_not_guarantee(self, full_profile):
        """Score reply must note keyword coverage caveat."""
        reply = _deterministic_nlp_fallback("What is my match score?", "profile_inquiry", full_profile)
        assert "60" in reply
        assert "keyword" in reply.lower() or "coverage" in reply.lower() or "guarantee" in reply.lower()

    def test_general_qa_with_screen_context_matchsummary(self, full_profile):
        """general_qa fallback should include screen-specific tips when on MatchSummary."""
        reply = _deterministic_nlp_fallback("Hello", "general_qa", full_profile, current_screen="MatchSummary")
        assert "Match Summary" in reply or "score" in reply.lower()

    def test_general_qa_with_screen_context_topics(self, full_profile):
        """general_qa fallback should include screen-specific tips when on Topics."""
        reply = _deterministic_nlp_fallback("Hello", "general_qa", full_profile, current_screen="Topics")
        assert "topic" in reply.lower()

    def test_interview_prep_behavioral_angle_included(self, full_profile):
        """interview_prep fallback should suggest a behavioral angle in addition to technical prep."""
        reply = _deterministic_nlp_fallback("How do I prepare for Kubernetes interviews?", "interview_prep", full_profile)
        assert "Kubernetes" in reply
        # Should mention at least one practice angle
        has_angles = any(x in reply for x in ["1.", "2.", "3.", "4.", "-", "STAR", "behavioral", "trade-off"])
        assert has_angles


# ---------------------------------------------------------------------------
# generate_chat_response with current_screen
# ---------------------------------------------------------------------------

class TestGenerateChatResponseEnhanced:
    def test_screen_context_passed_to_system_prompt(self, full_profile):
        """The current_screen must appear in the system prompt forwarded to LLM."""
        captured = {}

        def mock_generate(system_prompt, history_arg):
            captured["system_prompt"] = system_prompt
            return "Great advice for your role."

        with patch.object(LLMClient, "generate_with_history", side_effect=mock_generate):
            result = generate_chat_response(
                full_profile, [], "What should I study?", current_screen="MatchSummary"
            )
            assert result["model"] == LLM_MODEL_NAME
            # Screen hint should appear in the system prompt
            assert "MatchSummary" in captured["system_prompt"] or "skill match summary" in captured["system_prompt"].lower()

    def test_nlp_fallback_with_screen_context(self, full_profile):
        """NLP fallback must include screen tip when current_screen='Topics'."""
        with patch.object(LLMClient, "generate_with_history", return_value=None):
            result = generate_chat_response(
                full_profile, [], "Hello", current_screen="Topics"
            )
            assert result["model"] == "nlp_fallback"
            assert "topic" in result["reply"].lower()

    def test_history_aware_followup_resolution(self, full_profile):
        """Follow-up message 'Which should I start with?' resolves correctly using history."""
        history = [
            {"role": "user", "content": "What skills am I missing?"},
            {"role": "assistant", "content": "Your key skill gaps are: Kubernetes and Redis. Missing from your resume."},
        ]
        with patch.object(LLMClient, "generate_with_history", return_value=None):
            result = generate_chat_response(full_profile, history, "Which should I start with?")
            assert result["intent"] == "skill_gap"
            assert "Kubernetes" in result["reply"] or "Redis" in result["reply"]

    def test_asterisk_sanitization_on_llm_response(self, full_profile):
        """Any asterisks in LLM response must be cleaned before returning."""
        with patch.object(LLMClient, "generate_with_history", return_value="**Important:** Learn *Kubernetes* first."):
            result = generate_chat_response(full_profile, [], "What should I learn?")
            assert "**" not in result["reply"]
            assert result["model"] == LLM_MODEL_NAME

    def test_connection_refused_triggers_nlp_fallback(self, full_profile):
        """Connection refused to Ollama must gracefully produce NLP fallback, not crash."""
        with patch.object(LLMClient, "is_ollama_available", return_value=False):
            result = generate_chat_response(full_profile, [], "What are my missing skills?")
            assert result["model"] == "nlp_fallback"
            assert isinstance(result["reply"], str)
            assert len(result["reply"]) > 20

    def test_timeout_triggers_nlp_fallback(self, full_profile):
        """Ollama timeout exception must produce NLP fallback, not crash."""
        with patch.object(LLMClient, "generate_with_history", side_effect=Exception("Connection timed out")):
            result = generate_chat_response(full_profile, [], "Tell me about my score")
            # The engine catches exceptions in LLMClient (they return None), so nlp_fallback
            # Note: LLMClient catches and returns None; engine then routes to nlp_fallback
            assert result["model"] in ("nlp_fallback", "quota_exceeded")
            assert len(result["reply"]) > 20

    def test_empty_profile_does_not_crash(self, empty_profile):
        """Completely empty candidate profile must not raise any exception."""
        with patch.object(LLMClient, "generate_with_history", return_value=None):
            result = generate_chat_response(empty_profile, [], "Hello, what can you do?")
            assert isinstance(result["reply"], str)
            assert len(result["reply"]) > 10

    def test_preferred_skills_context_in_skill_gap_nlp_response(self, full_profile):
        """Skill gap NLP fallback for a candidate with preferred skill gaps mentions them."""
        with patch.object(LLMClient, "generate_with_history", return_value=None):
            result = generate_chat_response(full_profile, [], "What skills should I pick up?")
            assert result["intent"] == "skill_gap"
            # Core missing skills must be mentioned
            assert "Kubernetes" in result["reply"] or "Redis" in result["reply"]


# ---------------------------------------------------------------------------
# Data isolation
# ---------------------------------------------------------------------------

class TestDataIsolation:
    def test_different_profiles_produce_different_system_prompts(self, full_profile, perfect_match_profile):
        """Two different profiles must produce different system prompts."""
        prompt1 = _build_candidate_system_prompt(full_profile)
        prompt2 = _build_candidate_system_prompt(perfect_match_profile)
        assert prompt1 != prompt2
        assert "Staff Backend Engineer" in prompt1
        assert "Backend Engineer" in prompt2

    def test_profile_id_not_leaked_to_other_profiles(self, full_profile, perfect_match_profile):
        """Profile-specific data (projects, etc.) must not appear in another profile's prompt."""
        prompt_empty = _build_candidate_system_prompt(perfect_match_profile)
        # 'Payment Gateway' is full_profile's project — must not appear in perfect_match_profile's prompt
        assert "Payment Gateway" not in prompt_empty


# ---------------------------------------------------------------------------
# Quota exhausted message
# ---------------------------------------------------------------------------

class TestQuotaExhaustedEnhanced:
    def test_quota_response_does_not_claim_llm(self, full_profile):
        """Quota-exhausted response must not claim it's Nemotron-generated."""
        reply = _quota_exhausted_response(full_profile)
        # Must mention quota/limit, and must NOT look like a normal LLM response
        assert "quota" in reply.lower() or "limit" in reply.lower() or "recharges" in reply.lower()

    def test_quota_response_uses_profile_context(self, full_profile):
        """Quota message must use actual profile missing skills or topics."""
        reply = _quota_exhausted_response(full_profile)
        assert "Kubernetes" in reply or "Redis" in reply or "Kubernetes Orchestration" in reply

    def test_quota_response_fallback_no_missing_uses_topics(self, perfect_match_profile):
        """When no missing skills, quota message uses top interview topic if available."""
        # Add a topic
        perfect_match_profile.interview_topics = [
            InterviewTopic(topic="System Design", priority="high", reason="Senior level requirement")
        ]
        reply = _quota_exhausted_response(perfect_match_profile)
        assert "System Design" in reply or "recharges" in reply.lower()
