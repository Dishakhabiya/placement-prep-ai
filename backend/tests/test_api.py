import io
import fitz
import pytest
from fastapi.testclient import TestClient

from main import app
from db import init_db

init_db()
client = TestClient(app)


def _generate_test_pdf_bytes():
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((50, 72), """
    Jane Candidate
    Full Stack Developer

    TECHNICAL SKILLS
    Python, FastAPI, React, JavaScript, PostgreSQL, Git

    PROJECTS
    Placement Prep AI
    Built automated interview intelligence system using FastAPI and React Native.

    EDUCATION
    B.Tech in Computer Science, 2024
    """)
    bytes_data = doc.tobytes()
    doc.close()
    return bytes_data


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "Module 1" in data["service"]


def test_create_and_lifecycle_profile():
    pdf_bytes = _generate_test_pdf_bytes()
    jd_text = """
    Job Title: Full Stack Engineer
    Requirements:
    - Must have hands-on experience in Python and FastAPI
    - Strong knowledge of PostgreSQL
    - Good to have Docker experience
    Responsibilities:
    - Build scalable REST APIs and modern web interfaces.
    """

    # 1. Create Profile
    files = {
        "resume": ("jane_resume.pdf", pdf_bytes, "application/pdf")
    }
    data = {
        "jd_text": jd_text,
        "mode": "technical"
    }

    res_post = client.post("/api/profile", files=files, data=data)
    assert res_post.status_code == 201, res_post.text
    profile = res_post.json()

    assert "profile_id" in profile
    pid = profile["profile_id"]
    assert profile["mode"] == "technical"
    assert "Python" in profile["candidate"]["skills"]
    assert profile["job"]["title"] == "Full Stack Engineer"
    assert "Python" in profile["job"]["required_skills"]
    assert "Python" in profile["match"]["matched"]
    assert 8 <= len(profile["interview_topics"]) <= 12

    # 2. Get Profile by ID
    res_get = client.get(f"/api/profile/{pid}")
    assert res_get.status_code == 200
    assert res_get.json()["profile_id"] == pid

    # 3. Get Profile Topics
    res_topics = client.get(f"/api/profile/{pid}/topics")
    assert res_topics.status_code == 200
    topics = res_topics.json()
    assert isinstance(topics, list)
    assert len(topics) >= 8

    # 4. List Profiles
    res_list = client.get("/api/profiles")
    assert res_list.status_code == 200
    profiles = res_list.json()
    assert any(p["profile_id"] == pid for p in profiles)

    # 5. Update Profile (User Corrections)
    update_payload = {
        "candidate": {
            "skills": profile["candidate"]["skills"] + ["Docker"],
            "projects": profile["candidate"]["projects"],
            "experience": profile["candidate"]["experience"],
            "education": profile["candidate"]["education"],
            "certifications": profile["candidate"]["certifications"]
        }
    }
    res_put = client.put(f"/api/profile/{pid}", json=update_payload)
    assert res_put.status_code == 200
    updated = res_put.json()
    assert "Docker" in updated["candidate"]["skills"]
    assert "Docker" in updated["match"]["matched"]

    # 6. Delete Profile
    res_del = client.delete(f"/api/profile/{pid}")
    assert res_del.status_code == 200

    # Confirm deletion
    res_get_deleted = client.get(f"/api/profile/{pid}")
    assert res_get_deleted.status_code == 404


def test_api_validation_errors():
    pdf_bytes = _generate_test_pdf_bytes()

    # Empty JD
    res1 = client.post(
        "/api/profile",
        files={"resume": ("resume.pdf", pdf_bytes, "application/pdf")},
        data={"jd_text": "   ", "mode": "mixed"}
    )
    assert res1.status_code == 422

    # Invalid Mode
    res2 = client.post(
        "/api/profile",
        files={"resume": ("resume.pdf", pdf_bytes, "application/pdf")},
        data={"jd_text": "We need Python developer", "mode": "super-fast"}
    )
    assert res2.status_code == 422

    # Unsupported file type
    res3 = client.post(
        "/api/profile",
        files={"resume": ("resume.txt", b"plain text", "text/plain")},
        data={"jd_text": "We need Python developer", "mode": "mixed"}
    )
    assert res3.status_code == 415
