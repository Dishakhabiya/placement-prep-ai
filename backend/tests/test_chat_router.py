import json
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from main import app
from db import Base, get_db, ProfileRecord, ChatSession, ChatMessage
from schemas import ProfileResponse, CandidateProfile, JobProfile, MatchResult, InterviewTopic

# In-memory test database fixture
TEST_DATABASE_URL = "sqlite:///:memory:"
test_engine = create_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)


@pytest.fixture(scope="function", autouse=True)
def setup_test_db():
    Base.metadata.create_all(bind=test_engine)
    app.dependency_overrides[get_db] = override_get_db
    yield
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=test_engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


client = TestClient(app)


def _create_sample_profile(profile_id: str = "test-profile-1") -> str:
    db = TestingSessionLocal()
    profile_data = ProfileResponse(
        profile_id=profile_id,
        mode="mixed",
        candidate=CandidateProfile(
            skills=["Python", "FastAPI", "React Native"],
            projects=[],
            experience=["Software Engineer Intern"],
            education=["B.S. Computer Science"],
            certifications=[]
        ),
        job=JobProfile(
            title="Backend Engineer",
            required_skills=["Python", "FastAPI", "Docker", "SQL"],
            preferred_skills=["AWS"],
            responsibilities=["Build backend APIs"]
        ),
        match=MatchResult(
            matched=["Python", "FastAPI"],
            missing=["Docker", "SQL"],
            extra=["React Native"],
            score=60.0
        ),
        interview_topics=[
            InterviewTopic(topic="Python Concurrency", priority="high", reason="Core requirement"),
            InterviewTopic(topic="SQL Optimization", priority="high", reason="Missing skill gap")
        ]
    )

    record = ProfileRecord(
        profile_id=profile_id,
        mode="mixed",
        jd_text="Backend Engineer JD",
        resume_filename="resume.pdf",
        resume_path="/path/resume.pdf",
        profile_json=json.dumps(profile_data.model_dump())
    )
    db.add(record)
    db.commit()
    db.close()
    return profile_id


def test_post_message_profile_not_found():
    response = client.post("/api/chat/message", json={
        "profile_id": "nonexistent-profile",
        "user_message": "Hello!"
    })
    assert response.status_code == 404
    assert "not found" in response.json()["detail"].lower()


def test_post_message_empty_body_validation():
    response = client.post("/api/chat/message", json={
        "profile_id": "profile-1",
        "user_message": ""
    })
    assert response.status_code == 422


def test_post_message_creates_new_session():
    p_id = _create_sample_profile()
    response = client.post("/api/chat/message", json={
        "profile_id": p_id,
        "user_message": "What skills am I missing for this job?"
    })
    assert response.status_code == 200
    data = response.json()
    assert "session_id" in data
    assert data["session_id"] is not None
    assert data["intent"] == "skill_gap"
    assert "reply" in data and len(data["reply"]) > 0
    assert len(data["suggested_actions"]) >= 1

    # Verify session & messages persisted in db
    db = TestingSessionLocal()
    session = db.query(ChatSession).filter(ChatSession.session_id == data["session_id"]).first()
    assert session is not None
    assert session.profile_id == p_id
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == data["session_id"]).all()
    assert len(messages) == 2  # 1 user + 1 assistant
    assert messages[0].sender == "user"
    assert messages[1].sender == "assistant"
    db.close()


def test_post_message_with_existing_session():
    p_id = _create_sample_profile()
    res1 = client.post("/api/chat/message", json={
        "profile_id": p_id,
        "user_message": "Hi, tell me about my resume."
    })
    assert res1.status_code == 200
    session_id = res1.json()["session_id"]

    res2 = client.post("/api/chat/message", json={
        "profile_id": p_id,
        "session_id": session_id,
        "user_message": "What interview questions should I expect?"
    })
    assert res2.status_code == 200
    assert res2.json()["session_id"] == session_id
    assert res2.json()["intent"] == "interview_prep"

    # DB now has 4 messages
    db = TestingSessionLocal()
    messages = db.query(ChatMessage).filter(ChatMessage.session_id == session_id).all()
    assert len(messages) == 4
    db.close()


def test_post_message_session_mismatched_profile():
    p1 = _create_sample_profile("profile-1")
    p2 = _create_sample_profile("profile-2")

    res = client.post("/api/chat/message", json={
        "profile_id": p1,
        "user_message": "Hello from p1"
    })
    session_id = res.json()["session_id"]

    # Now attempt to send with p2
    mismatch_res = client.post("/api/chat/message", json={
        "profile_id": p2,
        "session_id": session_id,
        "user_message": "Hello from p2"
    })
    assert mismatch_res.status_code == 400
    assert "does not belong" in mismatch_res.json()["detail"].lower()


def test_post_message_invalid_session_id():
    p_id = _create_sample_profile()
    res = client.post("/api/chat/message", json={
        "profile_id": p_id,
        "session_id": "nonexistent-session",
        "user_message": "Hello"
    })
    assert res.status_code == 404
    assert "not found" in res.json()["detail"].lower()


def test_get_chat_session_success():
    p_id = _create_sample_profile()
    post_res = client.post("/api/chat/message", json={
        "profile_id": p_id,
        "user_message": "Hello there"
    })
    session_id = post_res.json()["session_id"]

    get_res = client.get(f"/api/chat/{session_id}")
    assert get_res.status_code == 200
    data = get_res.json()
    assert data["session_id"] == session_id
    assert data["profile_id"] == p_id
    assert len(data["messages"]) == 2
    assert data["messages"][0]["sender"] == "user"
    assert data["messages"][1]["sender"] == "assistant"


def test_get_chat_session_not_found():
    res = client.get("/api/chat/nonexistent-session")
    assert res.status_code == 404


def test_delete_chat_session_success():
    p_id = _create_sample_profile()
    post_res = client.post("/api/chat/message", json={
        "profile_id": p_id,
        "user_message": "Save this message"
    })
    session_id = post_res.json()["session_id"]

    del_res = client.delete(f"/api/chat/{session_id}")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "deleted"

    # Confirm session and messages removed
    db = TestingSessionLocal()
    assert db.query(ChatSession).filter(ChatSession.session_id == session_id).first() is None
    assert db.query(ChatMessage).filter(ChatMessage.session_id == session_id).count() == 0
    db.close()


def test_delete_chat_session_not_found():
    res = client.delete("/api/chat/nonexistent-session")
    assert res.status_code == 404


def test_message_history_limit_20():
    p_id = _create_sample_profile()
    db = TestingSessionLocal()
    session = ChatSession(session_id="long-session", profile_id=p_id, is_deleted=False)
    db.add(session)
    db.commit()

    # Pre-populate 25 messages
    for i in range(25):
        msg = ChatMessage(
            session_id="long-session",
            sender="user" if i % 2 == 0 else "assistant",
            content=f"Message {i}"
        )
        db.add(msg)
    db.commit()
    db.close()

    # Post message #26
    res = client.post("/api/chat/message", json={
        "profile_id": p_id,
        "session_id": "long-session",
        "user_message": "Tell me about my skills"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["session_id"] == "long-session"


def test_new_session_is_deleted_false():
    """Regression: every new chat session must have is_deleted=False."""
    p_id = _create_sample_profile("profile-is-deleted")
    response = client.post("/api/chat/message", json={
        "profile_id": p_id,
        "user_message": "Hello, is this session clean?"
    })
    assert response.status_code == 200
    session_id = response.json()["session_id"]

    db = TestingSessionLocal()
    session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    assert session is not None, "Session was not persisted"
    assert session.is_deleted is False, f"Expected is_deleted=False, got {session.is_deleted!r}"
    db.close()
