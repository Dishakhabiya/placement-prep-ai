import pytest
from fastapi.testclient import TestClient
from main import app
from schemas import (
    ProfileResponse,
    CandidateProfile,
    JobProfile,
    MatchResult,
    InterviewTopic,
    ProjectItem,
    FollowupRequest,
)
from module2.question_generator import generate_interview_questions
from module2.adaptive_followup import generate_adaptive_followup

client = TestClient(app)

@pytest.fixture
def mock_profile_response():
    return ProfileResponse(
        profile_id="prof_test123",
        mode="mixed",
        candidate=CandidateProfile(
            skills=["Python", "FastAPI", "React", "PostgreSQL"],
            projects=[
                ProjectItem(
                    title="Placement Prep AI",
                    description="Built automated NLP intelligence engine",
                    tech=["FastAPI", "Python", "SQLite"]
                )
            ]
        ),
        job=JobProfile(
            title="Backend Engineer",
            required_skills=["Python", "FastAPI", "Docker", "DSA"],
            preferred_skills=["Kubernetes"],
            responsibilities=["Develop microservices and REST APIs"]
        ),
        match=MatchResult(
            matched=["Python", "FastAPI"],
            missing=["Docker", "DSA", "Kubernetes"],
            extra=["React", "PostgreSQL"],
            score=50.0
        ),
        interview_topics=[
            InterviewTopic(
                topic="Docker Competency & Learning Curve",
                priority="high",
                reason="Candidate resume does not list Docker"
            )
        ]
    )


def test_question_generator_unit(mock_profile_response):
    q_set = generate_interview_questions(mock_profile_response, num_questions=5)
    assert q_set.profile_id == "prof_test123"
    assert len(q_set.questions) == 5
    
    # Verify categories present
    categories = [q.category for q in q_set.questions]
    assert "jd-based" in categories or "technical" in categories
    
    # Check question schema fields
    q1 = q_set.questions[0]
    assert q1.question_id.startswith("q_")
    assert q1.question_text
    assert isinstance(q1.expected_key_concepts, list)


def test_adaptive_followup_unit():
    req = FollowupRequest(
        question_id="q_1",
        original_question="How does Python handle memory management?",
        target_topic="Python Memory Management",
        candidate_answer="Python handles memory automatically using reference counting.",
        missing_concepts=["garbage collection", "generational GC", "GIL"]
    )
    res = generate_adaptive_followup(req)
    assert res.parent_question_id == "q_1"
    assert "garbage collection" in res.followup_question or "generational GC" in res.followup_question
    assert "garbage collection" in res.expected_key_concepts


def test_api_questions_generate(mock_profile_response):
    payload = {
        "profile_data": mock_profile_response.model_dump(),
        "num_questions": 6,
        "mode": "mixed"
    }
    response = client.post("/api/questions/generate", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["profile_id"] == "prof_test123"
    assert len(data["questions"]) == 6


def test_api_questions_followup():
    payload = {
        "question_id": "q_2",
        "original_question": "Explain React Virtual DOM.",
        "target_topic": "React Virtual DOM",
        "candidate_answer": "It is a light copy of DOM.",
        "missing_concepts": ["reconciliation algorithm", "diffing process"]
    }
    response = client.post("/api/questions/followup", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["parent_question_id"] == "q_2"
    assert "reconciliation algorithm" in data["followup_question"]
