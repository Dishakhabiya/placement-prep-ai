import pytest
from module1.jd.jd_parser import parse_job_description, extract_skills_from_text


def test_parse_job_description_standard():
    jd_text = """
    Job Title: Senior Backend Engineer

    About the Role:
    We are looking for a Senior Backend Engineer to build resilient cloud microservices.

    Responsibilities:
    - Develop scalable REST APIs and backend services using FastAPI
    - Maintain PostgreSQL databases and write optimized SQL queries
    - Deploy containerized applications with Docker on AWS

    Requirements:
    - Must have hands-on experience in Python and FastAPI
    - Strong proficiency in SQL and PostgreSQL
    - Good understanding of Data Structures and Algorithms (DSA)

    Preferred Qualifications:
    - Experience with Docker and Kubernetes is a plus
    - Familiarity with Redis caching is preferred
    """

    parsed = parse_job_description(jd_text)

    assert "Senior Backend Engineer" in parsed["title"]
    assert "Python" in parsed["required_skills"]
    assert "FastAPI" in parsed["required_skills"]
    assert "PostgreSQL" in parsed["required_skills"] or "SQL" in parsed["required_skills"]
    assert "Docker" in parsed["preferred_skills"] or "Kubernetes" in parsed["preferred_skills"]
    assert len(parsed["responsibilities"]) >= 2
    assert any("REST APIs" in r for r in parsed["responsibilities"])


def test_extract_skills_from_text():
    text = "Proficient in JS, React Native, Git, and Machine Learning with PyTorch."
    skills = extract_skills_from_text(text)
    assert "JavaScript" in skills
    assert "React Native" in skills
    assert "Git" in skills
    assert "Machine Learning" in skills
    assert "PyTorch" in skills
