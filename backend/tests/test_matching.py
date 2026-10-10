import pytest
from module1.matching.normalize import normalize_skill, normalize_skill_list
from module1.matching.gap import compute_skill_gap_and_score
from module1.matching.project_links import link_projects_to_responsibilities


def test_skill_normalization_and_aliases():
    assert normalize_skill("js") == "JavaScript"
    assert normalize_skill("postgres") == "PostgreSQL"
    assert normalize_skill("sklearn") == "scikit-learn"
    assert normalize_skill("tf") == "TensorFlow"
    assert normalize_skill("k8s") == "Kubernetes"
    assert normalize_skill("React Native") == "React Native"

    raw_list = ["js", "JavaScript", "postgres", "PostgreSQL", "PYTHON", "py"]
    normalized = normalize_skill_list(raw_list)
    assert normalized == ["JavaScript", "PostgreSQL", "Python"]


def test_skill_gap_and_score_full_match():
    candidate_skills = ["Python", "SQL", "FastAPI", "Docker", "Git"]
    required_skills = ["Python", "SQL", "FastAPI"]
    preferred_skills = ["Docker"]

    match_dict, score = compute_skill_gap_and_score(
        candidate_skills, required_skills, preferred_skills
    )

    assert set(match_dict["matched"]) == {"Python", "SQL", "FastAPI", "Docker"}
    assert match_dict["missing"] == []
    assert match_dict["extra"] == ["Git"]
    assert score == 100.0


def test_skill_gap_partial_match():
    candidate_skills = ["Python", "Flask", "MongoDB"]
    required_skills = ["Python", "FastAPI", "PostgreSQL"]  # 1 of 3 = 33.33% * 0.8 = 26.67%
    preferred_skills = ["MongoDB"]                         # 1 of 1 = 100% * 0.2 = 20%
    # Expected: 26.67 + 20 = 46.7%

    match_dict, score = compute_skill_gap_and_score(
        candidate_skills, required_skills, preferred_skills
    )

    assert "Python" in match_dict["matched"]
    assert "MongoDB" in match_dict["matched"]
    assert "FastAPI" in match_dict["missing"]
    assert "PostgreSQL" in match_dict["missing"]
    assert "Flask" in match_dict["extra"]
    assert score == 46.7


def test_skill_gap_empty_cases():
    # Both empty
    match_dict, score = compute_skill_gap_and_score(["Python"], [], [])
    assert score == 0.0
    assert match_dict["extra"] == ["Python"]

    # Candidate empty
    match_dict, score = compute_skill_gap_and_score([], ["Python", "SQL"], ["Docker"])
    assert score == 0.0
    assert set(match_dict["missing"]) == {"Python", "SQL", "Docker"}


def test_project_to_responsibility_links():
    projects = [
        {
            "title": "Placement Prep Portal",
            "description": "Engineered automated microservices with FastAPI and PostgreSQL. Implemented REST APIs.",
            "tech": ["FastAPI", "PostgreSQL", "Python", "REST APIs"]
        },
        {
            "title": "Computer Vision Classifier",
            "description": "Trained ResNet models in PyTorch for image segmentation.",
            "tech": ["PyTorch", "Computer Vision"]
        }
    ]

    responsibilities = [
        "Design and scale backend REST APIs with FastAPI and databases.",
        "Collaborate on deep learning model deployment and computer vision pipelines."
    ]

    links = link_projects_to_responsibilities(projects, responsibilities)
    assert len(links) >= 2
    assert all(0.0 <= link["similarity"] <= 1.0 for link in links)
    assert links[0]["project"] in ["Placement Prep Portal", "Computer Vision Classifier"]
