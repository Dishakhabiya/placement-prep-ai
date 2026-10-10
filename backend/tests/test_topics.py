import pytest
from module1.context.topic_builder import build_ranked_interview_topics


def test_build_ranked_interview_topics_mixed():
    topics = build_ranked_interview_topics(
        mode="mixed",
        candidate_skills=["Python", "FastAPI", "Docker"],
        projects=[{
            "title": "Placement Prep AI",
            "description": "Built automated question generator with FastAPI",
            "tech": ["FastAPI", "Python"]
        }],
        job_title="Backend Engineer",
        required_skills=["Python", "FastAPI", "PostgreSQL"],
        preferred_skills=["Kubernetes"],
        responsibilities=["Develop and maintain scalable microservices."],
        match_dict={
            "matched": ["Python", "FastAPI"],
            "missing": ["PostgreSQL", "Kubernetes"],
            "extra": ["Docker"]
        }
    )

    assert 8 <= len(topics) <= 12
    for t in topics:
        assert "topic" in t and len(t["topic"]) > 0
        assert t["priority"] in ["high", "medium", "low"]
        assert "reason" in t and len(t["reason"]) > 0

    # Ensure missing skill is prioritized
    topic_names = [t["topic"] for t in topics]
    assert any("PostgreSQL" in name for name in topic_names)
    assert any("Placement Prep AI" in name for name in topic_names)


def test_build_ranked_interview_topics_hr_mode():
    topics = build_ranked_interview_topics(
        mode="hr",
        candidate_skills=["Python", "Java"],
        projects=[],
        job_title="Software Developer",
        required_skills=["Python"],
        preferred_skills=[],
        responsibilities=["Collaborate across cross-functional teams"],
        match_dict={"matched": ["Python"], "missing": [], "extra": ["Java"]}
    )

    assert 8 <= len(topics) <= 12
    # Ensure HR / Behavioral themes are present
    reasons = " ".join([t["reason"] for t in topics])
    assert "Career" in reasons or "teamwork" in reasons.lower() or "communication" in reasons.lower()
