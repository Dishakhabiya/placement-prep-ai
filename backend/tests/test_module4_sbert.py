import pytest
from module4.sbert_analyzer import (
    score_answer_semantics,
    score_session_answers,
    get_sbert_status,
    is_sbert_available,
    _tfidf_fallback,
    ConceptSemanticScore,
    SemanticQualityResult,
)
from module4.schemas import SessionReportRequest
from module4.reporting import aggregate_session_report
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_sbert_status():
    status = get_sbert_status()
    assert "sbert_available" in status
    assert status["sbert_available"] is True
    assert status["model_name"] == "all-MiniLM-L6-v2"


def test_sbert_semantic_scoring_paraphrase():
    """
    Test that SBERT detects semantic equivalence even when exact keywords are not used.
    'automatic memory deallocation and heap cleanup' should match 'garbage collection'.
    """
    answer_text = (
        "In Python, automatic memory deallocation and heap cleanup handles object lifecycle "
        "by tracking reference counts and identifying circular references."
    )
    expected_concepts = ["garbage collection", "memory management", "pointer arithmetic"]
    
    result: SemanticQualityResult = score_answer_semantics(
        answer_text=answer_text,
        expected_concepts=expected_concepts,
        threshold=0.35,
    )
    
    assert result.semantic_coverage_score > 50.0
    assert "garbage collection" in result.semantically_covered
    assert "memory management" in result.semantically_covered
    assert "pointer arithmetic" in result.semantically_missing
    assert len(result.concept_scores) == 3
    assert result.model_used == "all-MiniLM-L6-v2"
    assert result.fallback_used is False


def test_sbert_scoring_empty_answer():
    result = score_answer_semantics(
        answer_text="",
        expected_concepts=["recursion", "base case"],
    )
    assert result.semantic_coverage_score == 0.0
    assert result.quality_label == "No Answer"


def test_sbert_scoring_empty_concepts():
    result = score_answer_semantics(
        answer_text="A process is an instance of a computer program being executed.",
        expected_concepts=[],
    )
    assert result.semantic_coverage_score == 100.0


def test_tfidf_fallback_direct():
    """Directly test the TF-IDF fallback pathway."""
    answer_text = "Docker uses containers to isolate microservices."
    concepts = ["containers", "virtualization", "kubernetes"]
    scores, fallback = _tfidf_fallback(answer_text, concepts, threshold=0.2)
    assert fallback is True
    assert len(scores) == 3
    # 'containers' appears in answer, so TF-IDF sim > 0
    containers_score = next(s for s in scores if s.concept == "containers")
    assert containers_score.similarity_score > 0.0


def test_batch_scoring_session_answers():
    answers = [
        {
            "question_id": "q1",
            "transcript": "PostgreSQL is a relational database management system using SQL.",
            "expected_concepts": ["relational database", "SQL"],
        },
        {
            "question_id": "q2",
            "transcript": "I like sports and music.",
            "expected_concepts": ["REST API", "HTTP methods"],
        },
    ]
    batch_res = score_session_answers(answers, threshold=0.35)
    assert len(batch_res) == 2
    assert "semantic_quality" in batch_res[0]
    assert batch_res[0]["semantic_quality"]["semantic_coverage_score"] == 100.0
    assert batch_res[1]["semantic_quality"]["semantic_coverage_score"] < 50.0


def test_aggregate_session_report_with_sbert_metrics():
    """Test that aggregate_session_report processes SBERT semantic metrics."""
    evaluations = [
        {
            "question_id": "q_1",
            "question_text": "What is Python GIL?",
            "transcript_metadata": {
                "transcript": "The Global Interpreter Lock ensures only one thread executes Python bytecode.",
                "word_count": 12,
                "duration_seconds": 6.0,
            },
            "relevance": {"relevance_score": 90.0},
            "concept_coverage": {
                "coverage_score": 100.0,
                "covered_concepts": ["thread execution", "GIL"],
                "missing_concepts": [],
            },
            "delivery_metrics": {"words_per_minute": 120.0, "total_filler_words": 0},
            "semantic_quality": {
                "model_used": "all-MiniLM-L6-v2",
                "semantic_coverage_score": 100.0,
                "avg_similarity": 0.72,
                "semantically_covered": ["thread execution", "GIL"],
                "semantically_missing": [],
            },
        }
    ]

    report = aggregate_session_report(
        evaluations=evaluations,
        total_questions=1,
    )

    assert report.average_semantic_coverage == 100.0
    assert report.average_semantic_similarity == 0.72
    assert report.sbert_model_used == "all-MiniLM-L6-v2"
    assert len(report.questions_breakdown) == 1
    assert report.questions_breakdown[0].semantic_coverage_score == 100.0
    assert report.questions_breakdown[0].semantic_similarity == 0.72
    assert report.questions_breakdown[0].semantically_covered == ["thread execution", "GIL"]


def test_api_analyze_text_includes_sbert():
    """Test the /api/answers/analyze endpoint returns SBERT semantic_quality."""
    payload = {
        "question_id": "q_test",
        "question_text": "Explain binary search.",
        "expected_key_concepts": ["divide and conquer", "logarithmic time", "sorted array"],
        "answer_text": "Binary search divides the search space in half repeatedly on an ordered list, achieving log n complexity.",
    }
    response = client.post("/api/answers/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "semantic_quality" in data
    assert data["semantic_quality"] is not None
    sq = data["semantic_quality"]
    assert sq["model_used"] == "all-MiniLM-L6-v2"
    assert sq["semantic_coverage_score"] > 0
    assert len(sq["concept_scores"]) == 3
