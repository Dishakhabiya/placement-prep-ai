import pytest
from unittest.mock import patch

from schemas import (
    ProfileResponse,
    CandidateProfile,
    JobProfile,
    MatchResult,
    InterviewTopic,
    ProjectItem,
)
from module2.chat_engine import (
    detect_intent,
    _get_match_skills,
    _generate_suggested_actions,
    _build_candidate_system_prompt,
    _deterministic_nlp_fallback,
    _quota_exhausted_response,
    generate_chat_response,
)
from module2.llm_client import LLMClient, LLM_MODEL_NAME, QUOTA_EXCEEDED_SENTINEL


@pytest.fixture
def sample_profile():
    return ProfileResponse(
        profile_id="prof-chat-1",
        mode="mixed",
        candidate=CandidateProfile(
            skills=["Python", "FastAPI", "Docker", "SQL"],
            projects=[
                ProjectItem(title="E-Commerce API", description="Built async REST API with FastAPI and PostgreSQL", tech=["Python", "FastAPI"])
            ],
            experience=["Backend Engineer Intern at Tech Corp"],
            education=["B.Tech Computer Science"],
            certifications=["AWS Certified Cloud Practitioner"]
        ),
        job=JobProfile(
            title="Senior Backend Engineer",
            required_skills=["Python", "FastAPI", "Kubernetes", "Redis"],
            preferred_skills=["AWS", "GraphQL"],
            responsibilities=["Design distributed microservices", "Optimize database queries"]
        ),
        match=MatchResult(
            matched=["Python", "FastAPI"],
            missing=["Kubernetes", "Redis"],
            extra=["SQL", "Docker"],
            score=50.0
        ),
        interview_topics=[
            InterviewTopic(topic="Distributed Caching with Redis", priority="high", reason="Missing skill for caching"),
            InterviewTopic(topic="Kubernetes Deployment", priority="medium", reason="Missing skill for container orchestration")
        ]
    )


# ---------------------------------------------------------------------------
# Intent detection
# ---------------------------------------------------------------------------

def test_detect_intent_skill_gap():
    assert detect_intent("What are my missing skills?") == "skill_gap"
    assert detect_intent("Where are my skill gaps?") == "skill_gap"
    assert detect_intent("What should I improve before the interview?") == "skill_gap"


def test_detect_intent_interview_prep():
    assert detect_intent("Can you ask me an interview question on FastAPI?") == "interview_prep"
    assert detect_intent("Give me a mock interview technical question") == "interview_prep"
    assert detect_intent("How should I prepare for the behavioral interview?") == "interview_prep"


def test_detect_intent_profile_inquiry():
    assert detect_intent("Tell me about my resume and match score") == "profile_inquiry"
    assert detect_intent("What projects did you extract from my resume?") == "profile_inquiry"
    assert detect_intent("How does my background align with the JD?") == "profile_inquiry"


def test_detect_intent_general_qa():
    assert detect_intent("Hello, who are you?") == "general_qa"
    assert detect_intent("What can you do?") == "general_qa"


# ---------------------------------------------------------------------------
# Profile helpers
# ---------------------------------------------------------------------------

def test_get_match_skills_compatibility(sample_profile):
    data = _get_match_skills(sample_profile)
    assert data["matched"] == ["Python", "FastAPI"]
    assert data["missing"] == ["Kubernetes", "Redis"]
    assert data["score"] == 50.0


def test_generate_suggested_actions(sample_profile):
    for intent in ["skill_gap", "interview_prep", "profile_inquiry", "general_qa"]:
        actions = _generate_suggested_actions(intent, sample_profile)
        assert isinstance(actions, list)
        assert 0 <= len(actions) <= 2
        for action in actions:
            assert "title" in action
            assert "action_type" in action
            assert "payload" in action


def test_build_candidate_system_prompt_includes_context_and_guardrails(sample_profile):
    prompt = _build_candidate_system_prompt(sample_profile)
    assert "Senior Backend Engineer" in prompt
    assert "Kubernetes" in prompt
    assert "E-Commerce API" in prompt
    assert "Guardrails" in prompt
    assert "PlacementPrep AI" in prompt


# ---------------------------------------------------------------------------
# NLP fallback — context-aware, distinct per question
# ---------------------------------------------------------------------------

def test_deterministic_nlp_fallback_all_intents(sample_profile):
    for intent in ["skill_gap", "interview_prep", "profile_inquiry", "general_qa"]:
        reply = _deterministic_nlp_fallback("test message", intent, sample_profile)
        assert isinstance(reply, str)
        assert len(reply) > 20
        assert "Senior Backend Engineer" in reply or "PlacementPrep" in reply or "Kubernetes" in reply


def test_nlp_fallback_skill_gap_mentions_specific_missing_skills(sample_profile):
    reply = _deterministic_nlp_fallback("What skills am I missing?", "skill_gap", sample_profile)
    # Must mention actual missing skills from the profile, not generic text
    assert "Kubernetes" in reply or "Redis" in reply
    assert "Senior Backend Engineer" in reply


def test_nlp_fallback_skill_gap_focuses_on_mentioned_skill(sample_profile):
    """When user mentions a specific missing skill, the fallback should focus on it."""
    reply = _deterministic_nlp_fallback("How do I learn Redis?", "skill_gap", sample_profile)
    assert "Redis" in reply


def test_nlp_fallback_interview_prep_mentions_top_topic(sample_profile):
    reply = _deterministic_nlp_fallback("What interview questions should I prepare?", "interview_prep", sample_profile)
    # Must mention an actual interview topic, not just a generic STAR answer
    assert "Redis" in reply or "Kubernetes" in reply or "Distributed Caching" in reply


def test_nlp_fallback_profile_inquiry_resume_variant(sample_profile):
    reply = _deterministic_nlp_fallback("Tell me about my resume and projects", "profile_inquiry", sample_profile)
    assert "E-Commerce API" in reply or "50" in reply or "Senior Backend Engineer" in reply


def test_nlp_fallback_profile_inquiry_score_variant(sample_profile):
    reply = _deterministic_nlp_fallback("What is my match score?", "profile_inquiry", sample_profile)
    assert "50" in reply  # match score


def test_different_intents_produce_distinct_fallback_replies(sample_profile):
    """Regression: different questions must produce distinct fallback replies."""
    with patch.object(LLMClient, "generate_with_history", return_value=None):
        result_skill = generate_chat_response(
            sample_profile, [], "What are my missing skills?"
        )
        result_prep = generate_chat_response(
            sample_profile, [], "Can you ask me an interview question?"
        )
        result_profile = generate_chat_response(
            sample_profile, [], "Tell me about my resume and match score"
        )
        replies = {result_skill["reply"], result_prep["reply"], result_profile["reply"]}
        assert len(replies) == 3, "Each intent must produce a unique fallback reply"
        assert result_skill["intent"] == "skill_gap"
        assert result_prep["intent"] == "interview_prep"
        assert result_profile["intent"] == "profile_inquiry"


# ---------------------------------------------------------------------------
# Quota exhausted response
# ---------------------------------------------------------------------------

def test_quota_exhausted_response_contains_friendly_message(sample_profile):
    reply = _quota_exhausted_response(sample_profile)
    assert "quota" in reply.lower() or "limit" in reply.lower() or "⚡" in reply
    assert "Kubernetes" in reply or "Redis" in reply or "Distributed Caching" in reply
    assert len(reply) > 50


def test_quota_exhausted_response_contains_profile_tip(sample_profile):
    """The quota message must use actual profile data, not just generic text."""
    reply = _quota_exhausted_response(sample_profile)
    # Should mention the top missing skill or top interview topic
    assert "Kubernetes" in reply or "Redis" in reply or "Distributed Caching" in reply


# ---------------------------------------------------------------------------
# generate_chat_response — full path tests
# ---------------------------------------------------------------------------

def test_generate_chat_response_with_mocked_ollama_success(sample_profile):
    with patch.object(LLMClient, "generate_with_history", return_value="Here is advice on Kubernetes for your interview."):
        result = generate_chat_response(sample_profile, [], "What skills are needed for Kubernetes?")
        assert result["reply"] == "Here is advice on Kubernetes for your interview."
        assert result["intent"] == "skill_gap"
        assert result["model"] == LLM_MODEL_NAME
        assert len(result["suggested_actions"]) <= 2


def test_generate_chat_response_ollama_nlp_fallback(sample_profile):
    """None (network failure) → nlp_fallback model, context-aware reply."""
    with patch.object(LLMClient, "generate_with_history", return_value=None):
        result = generate_chat_response(sample_profile, [], "What are my missing skills?")
        assert result["model"] == "nlp_fallback"
        assert result["intent"] == "skill_gap"
        assert "Kubernetes" in result["reply"] or "Redis" in result["reply"]
        assert len(result["suggested_actions"]) >= 1


def test_generate_chat_response_http_429_quota_exceeded(sample_profile):
    """Regression: HTTP 429 must set model='quota_exceeded', show friendly quota message."""
    with patch.object(LLMClient, "generate_with_history", return_value=QUOTA_EXCEEDED_SENTINEL):
        result = generate_chat_response(sample_profile, [], "What interview questions should I prepare?")
        assert result["model"] == "quota_exceeded"
        assert result["intent"] == "interview_prep"
        assert isinstance(result["reply"], str) and len(result["reply"]) > 20
        # Must NOT claim it is an LLM response
        assert result["model"] != LLM_MODEL_NAME
        # Must contain a user-facing quota explanation
        assert "quota" in result["reply"].lower() or "limit" in result["reply"].lower() or "⚡" in result["reply"]
        assert "suggested_actions" in result


def test_generate_chat_response_quota_vs_fallback_are_distinct(sample_profile):
    """quota_exceeded and nlp_fallback must produce different model labels and replies."""
    with patch.object(LLMClient, "generate_with_history", return_value=QUOTA_EXCEEDED_SENTINEL):
        quota_result = generate_chat_response(sample_profile, [], "What are my skill gaps?")

    with patch.object(LLMClient, "generate_with_history", return_value=None):
        fallback_result = generate_chat_response(sample_profile, [], "What are my skill gaps?")

    assert quota_result["model"] == "quota_exceeded"
    assert fallback_result["model"] == "nlp_fallback"
    assert quota_result["reply"] != fallback_result["reply"]


def test_generate_chat_response_empty_llm_content_triggers_nlp_fallback(sample_profile):
    """Ollama returning empty string must use nlp_fallback, not return a blank reply."""
    with patch.object(LLMClient, "generate_with_history", return_value=""):
        result = generate_chat_response(sample_profile, [], "Tell me about my resume")
        assert result["model"] == "nlp_fallback"
        assert len(result["reply"]) > 20


def test_generate_chat_response_history_is_passed_to_llm(sample_profile):
    """Conversation history must be forwarded to the LLM call."""
    history = [
        {"role": "user", "content": "Hello"},
        {"role": "assistant", "content": "Hi there!"},
    ]
    captured = {}

    def mock_generate(system_prompt, history_arg):
        captured["history"] = history_arg
        return "Great question about Kubernetes."

    with patch.object(LLMClient, "generate_with_history", side_effect=mock_generate):
        result = generate_chat_response(sample_profile, history, "Tell me more about Kubernetes")
        assert result["model"] == LLM_MODEL_NAME
        # The history passed must include the prior turns + current message
        assert any(m["content"] == "Hello" for m in captured["history"])
        assert any(m["content"] == "Tell me more about Kubernetes" for m in captured["history"])
