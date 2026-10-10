import pytest
from module1.eval.metrics import compute_entity_metrics, evaluate_dataset


def test_compute_entity_metrics():
    gt = ["Python", "SQL", "FastAPI", "Docker"]
    pred = ["Python", "SQL", "FastAPI", "Kubernetes"]

    metrics = compute_entity_metrics(gt, pred)
    # TP = 3 (Python, SQL, FastAPI)
    # FP = 1 (Kubernetes)
    # FN = 1 (Docker)
    # Precision = 3/4 = 0.75
    # Recall = 3/4 = 0.75
    # F1 = 0.75
    assert metrics["tp"] == 3
    assert metrics["fp"] == 1
    assert metrics["fn"] == 1
    assert metrics["precision"] == 0.75
    assert metrics["recall"] == 0.75
    assert metrics["f1"] == 0.75


def test_evaluate_dataset_harness():
    annotated_dataset = [
        {
            "id": "sample_1",
            "text": "Experience in Python and PostgreSQL database systems.",
            "ground_truth_skills": ["Python", "PostgreSQL"]
        },
        {
            "id": "sample_2",
            "text": "Frontend expertise with React and TypeScript.",
            "ground_truth_skills": ["React", "TypeScript"]
        }
    ]

    def dummy_extractor(text: str):
        skills = []
        if "python" in text.lower():
            skills.append("Python")
        if "postgresql" in text.lower():
            skills.append("PostgreSQL")
        if "react" in text.lower():
            skills.append("React")
        return skills

    res = evaluate_dataset(annotated_dataset, dummy_extractor)
    assert res["overall"]["total_samples"] == 2
    assert res["overall"]["f1"] > 0.5
