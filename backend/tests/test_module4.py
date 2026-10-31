import io
import os
import tempfile
import pytest
import numpy as np

from module4.delivery import (
    calculate_words_per_minute,
    rate_speaking_pace,
    extract_filler_words,
    compute_extended_pauses,
    analyze_speaking_delivery,
)
from module4.visual import (
    get_face_cascade,
    analyze_video_frames,
    extract_sampled_frames_from_video,
)
from module4.schemas import SpeakingDeliveryMetrics, VisualAnalysisMetrics


# ============================================================================
# 1. Speaking Delivery Metrics Tests
# ============================================================================

def test_calculate_words_per_minute():
    # 60 words in 30 seconds -> 120 WPM
    wpm = calculate_words_per_minute(60, 30.0)
    assert wpm == 120.0

    # 150 words in 60 seconds -> 150 WPM
    assert calculate_words_per_minute(150, 60.0) == 150.0

    # Edge cases
    assert calculate_words_per_minute(0, 30.0) == 0.0
    assert calculate_words_per_minute(50, 0.0) == 0.0
    assert calculate_words_per_minute(50, -5.0) == 0.0


def test_rate_speaking_pace():
    assert rate_speaking_pace(95.0) == "Slow"
    assert rate_speaking_pace(135.0) == "Optimal"
    assert rate_speaking_pace(165.0) == "Optimal"
    assert rate_speaking_pace(180.0) == "Fast"
    assert rate_speaking_pace(0.0) == "Not Applicable"


def test_extract_filler_words():
    sample_text = (
        "Well, um, basically I used React and, you know, Python. "
        "Like, actually, we had to handle, uh, distributed transactions."
    )
    fillers = extract_filler_words(sample_text)
    assert fillers.get("um") == 1
    assert fillers.get("uh") == 1
    assert fillers.get("basically") == 1
    assert fillers.get("like") == 1
    assert fillers.get("you know") == 1
    assert fillers.get("actually") == 1
    assert sum(fillers.values()) == 6

    # Empty text
    assert extract_filler_words("") == {}
    assert extract_filler_words("Clean technical response without hesitation.") == {}


def test_compute_extended_pauses():
    # Segments with gaps: 0-3s, 5-8s (gap = 2s >= 1.5s), 9-10s (gap = 1s < 1.5s)
    segments = [
        {"start": 0.0, "end": 3.0, "text": "First point"},
        {"start": 5.0, "end": 8.0, "text": "Second point"},
        {"start": 9.0, "end": 10.0, "text": "Third point"},
    ]
    res = compute_extended_pauses(segments, 10.0)
    assert res["extended_pause_count"] == 1
    assert res["total_pause_duration_seconds"] == 2.0


def test_analyze_speaking_delivery_full():
    transcript = "Um, I basically designed the database schema, like, using PostgreSQL and FastAPI."
    segments = [
        {"start": 0.0, "end": 2.5, "text": "Um, I basically designed"},
        {"start": 4.5, "end": 7.0, "text": "the database schema, like, using PostgreSQL and FastAPI."},
    ]
    metrics = analyze_speaking_delivery(transcript, duration_seconds=7.0, segments=segments)

    assert isinstance(metrics, SpeakingDeliveryMetrics)
    assert metrics.total_filler_words >= 2
    assert "um" in metrics.filler_word_breakdown
    assert "basically" in metrics.filler_word_breakdown
    assert metrics.extended_pause_count == 1
    assert metrics.words_per_minute > 0
    assert len(metrics.speaking_coaching_tip) > 10


# ============================================================================
# 2. Visual Analysis & OpenCV Model Tests
# ============================================================================

def test_face_cascade_initialization():
    cascade = get_face_cascade()
    assert cascade is not None
    assert not cascade.empty()


def test_analyze_video_frames_missing_video_track(tmp_path):
    # Dummy audio-only file or non-video container
    dummy_audio_file = tmp_path / "audio_only.wav"
    dummy_audio_file.write_bytes(b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00")

    result = analyze_video_frames(str(dummy_audio_file))
    assert isinstance(result, VisualAnalysisMetrics)
    assert result.video_track_detected is False
    assert result.total_frames_sampled == 0
    assert result.face_presence_ratio == 0.0
    assert "Audio-only" in result.visual_coaching_tip


def test_analyze_video_frames_synthetic_webm(tmp_path):
    import av
    # Synthesize a minimal WebM video file with 2 synthetic frames
    video_file = tmp_path / "test_synth.webm"
    with av.open(str(video_file), mode="w", format="webm") as container:
        stream = container.add_stream("vp8", rate=1)
        stream.width = 320
        stream.height = 240
        stream.pix_fmt = "yuv420p"

        # Frame 1: Blank frame
        frame1 = av.VideoFrame.from_ndarray(np.zeros((240, 320, 3), dtype=np.uint8), format="rgb24")
        for packet in stream.encode(frame1):
            container.mux(packet)

        # Flush stream
        for packet in stream.encode(None):
            container.mux(packet)

    assert os.path.exists(str(video_file))
    result = analyze_video_frames(str(video_file))
    assert isinstance(result, VisualAnalysisMetrics)
    assert result.video_track_detected is True
    assert result.total_frames_sampled >= 1
    assert result.detector_model == "OpenCV-HaarCascade-FrontalFace"
    assert "OpenCV Haar Cascade" in result.methodology_limitations


def test_analyze_video_frames_corrupted_file(tmp_path):
    corrupt_file = tmp_path / "corrupt.webm"
    corrupt_file.write_bytes(b"Corrupted binary header data")

    result = analyze_video_frames(str(corrupt_file))
    assert isinstance(result, VisualAnalysisMetrics)
    assert result.video_track_detected is False


# ============================================================================
# 3. API Integration & Backward Compatibility Tests
# ============================================================================

def test_api_transcribe_includes_module4_delivery_and_visual():
    from fastapi.testclient import TestClient
    from main import app
    from module3.transcription import get_transcription_service

    client = TestClient(app)
    service = get_transcription_service()
    service.set_mock_handler(lambda path: {
        "transcript": "Well, um, basically I used PostgreSQL and, like, FastAPI for the backend architecture.",
        "detected_language": "en",
        "language_probability": 0.99,
        "duration_seconds": 6.5,
        "model_used": "whisper-mock-unit",
        "segments": [
            {"start": 0.0, "end": 2.5, "text": "Well, um, basically I used"},
            {"start": 4.5, "end": 6.5, "text": "PostgreSQL and, like, FastAPI for the backend architecture."},
        ],
        "status": "success"
    })

    dummy_audio = b"RIFF" + b"\x00" * 300
    files = {
        "audio": ("recording.webm", io.BytesIO(dummy_audio), "audio/webm")
    }
    data = {
        "question_id": "q_m4_test",
        "question_text": "Explain your backend system design.",
        "expected_key_concepts": "[\"FastAPI\", \"PostgreSQL\"]",
    }

    response = client.post("/api/answers/transcribe", files=files, data=data)
    assert response.status_code == 200
    res_json = response.json()

    # Verify Member 3 fields remain intact
    assert res_json["question_id"] == "q_m4_test"
    assert "PostgreSQL" in res_json["transcript_metadata"]["transcript"]
    assert res_json["relevance"]["relevance_score"] >= 0

    # Verify Module 4 delivery metrics
    assert "delivery_metrics" in res_json
    deliv = res_json["delivery_metrics"]
    assert deliv is not None
    assert deliv["words_per_minute"] > 0
    assert deliv["total_filler_words"] >= 3  # um, basically, like
    assert deliv["extended_pause_count"] == 1  # 2.5s to 4.5s is 2.0s pause

    # Verify Module 4 visual metrics field exists
    assert "visual_metrics" in res_json

    service.set_mock_handler(None)


# ============================================================================
# 4. Session Reporting & Aggregation Tests
# ============================================================================

from module4.reporting import aggregate_session_report
from module4.schemas import SessionReportResponse


def test_aggregate_session_report_multi_answers():
    evaluations = [
        {
            "question_id": "q_1",
            "question_text": "Explain indexing in PostgreSQL.",
            "target_topic": "Databases",
            "transcript_metadata": {
                "transcript": "PostgreSQL indexing uses B-Tree data structures to accelerate lookups.",
                "word_count": 10,
                "duration_seconds": 5.0,
            },
            "relevance": {"relevance_score": 85.0},
            "concept_coverage": {
                "coverage_score": 80.0,
                "covered_concepts": ["B-Tree", "PostgreSQL"],
                "missing_concepts": [],
            },
            "delivery_metrics": {
                "words_per_minute": 120.0,
                "pace_rating": "Optimal",
                "total_filler_words": 0,
                "filler_word_breakdown": {},
                "extended_pause_count": 0,
            },
            "visual_metrics": {
                "video_track_detected": True,
                "face_presence_ratio": 95.0,
                "face_centering_ratio": 90.0,
            },
        },
        {
            "question_id": "q_2",
            "question_text": "How do you handle microservices distributed transactions?",
            "target_topic": "System Design",
            "transcript_metadata": {
                "transcript": "Um, basically we use the Saga pattern, you know, with compensating events.",
                "word_count": 12,
                "duration_seconds": 6.0,
            },
            "relevance": {"relevance_score": 75.0},
            "concept_coverage": {
                "coverage_score": 60.0,
                "covered_concepts": ["Saga pattern"],
                "missing_concepts": ["Two-phase commit"],
            },
            "delivery_metrics": {
                "words_per_minute": 120.0,
                "pace_rating": "Optimal",
                "total_filler_words": 3,
                "filler_word_breakdown": {"um": 1, "basically": 1, "you know": 1},
                "extended_pause_count": 1,
            },
            "visual_metrics": {
                "video_track_detected": True,
                "face_presence_ratio": 85.0,
                "face_centering_ratio": 80.0,
            },
        },
    ]

    report = aggregate_session_report(
        evaluations=evaluations,
        total_questions=2,
        session_id="sess_test_123",
        candidate_name="Alex Rivera",
        target_role="Full Stack Engineer",
    )

    assert isinstance(report, SessionReportResponse)
    assert report.total_questions == 2
    assert report.answered_questions == 2
    assert report.completion_rate == 100.0
    assert report.average_relevance_score == 80.0
    assert report.average_concept_coverage == 70.0
    assert report.total_concepts_covered == 3
    assert report.total_concepts_missing == 1
    assert report.total_filler_words == 3
    assert report.total_extended_pauses == 1
    assert report.average_face_presence_ratio == 90.0
    assert report.average_face_centering_ratio == 85.0
    assert report.overall_readiness_score > 60.0
    assert len(report.key_strengths) >= 1
    assert len(report.actionable_recommendations) >= 1
    assert len(report.questions_breakdown) == 2


def test_aggregate_session_report_empty_evaluations():
    report = aggregate_session_report(
        evaluations=[],
        total_questions=5,
        session_id="sess_empty",
    )
    assert report.answered_questions == 0
    assert report.total_questions == 5
    assert report.completion_rate == 0.0
    assert report.overall_readiness_score == 0.0
    assert report.readiness_level == "Needs Practice"
    assert report.total_filler_words == 0
    assert report.average_face_presence_ratio is None


def test_aggregate_session_report_unanswered_questions_preserved():
    questions = [
        {"question_id": "q_1", "question_text": "Q1 text", "category": "tech"},
        {"question_id": "q_2", "question_text": "Q2 text", "category": "tech"},
        {"question_id": "q_3", "question_text": "Q3 text", "category": "tech"},
    ]
    evaluations = [
        {
            "question_id": "q_1",
            "question_text": "Q1 text",
            "relevance": {"relevance_score": 90.0},
            "concept_coverage": {"coverage_score": 100.0, "covered_concepts": ["conceptA"], "missing_concepts": []},
            "transcript_metadata": {"transcript": "Answer 1", "word_count": 5, "duration_seconds": 3.0},
        }
    ]
    report = aggregate_session_report(
        evaluations=evaluations,
        questions=questions,
        total_questions=3,
    )
    assert report.answered_questions == 1
    assert report.total_questions == 3
    assert report.completion_rate == 33.3
    assert len(report.questions_breakdown) == 3
    assert report.questions_breakdown[0].status == "answered"
    assert report.questions_breakdown[0].relevance_score == 90.0
    assert report.questions_breakdown[1].status == "unanswered"
    assert report.questions_breakdown[1].relevance_score is None
    assert report.questions_breakdown[2].status == "unanswered"


def test_api_session_report_endpoint():
    from main import app
    from fastapi.testclient import TestClient
    client = TestClient(app)

    payload = {
        "session_id": "sess_api_test",
        "total_questions": 2,
        "evaluations": [
            {
                "question_id": "q_api_1",
                "question_text": "Tell me about your Python experience.",
                "transcript_metadata": {
                    "transcript": "I have built high throughput microservices with FastAPI.",
                    "word_count": 8,
                    "duration_seconds": 4.0,
                },
                "relevance": {"relevance_score": 92.0},
                "concept_coverage": {"coverage_score": 85.0, "covered_concepts": ["FastAPI"], "missing_concepts": []},
                "delivery_metrics": {
                    "words_per_minute": 120.0,
                    "pace_rating": "Optimal",
                    "total_filler_words": 0,
                    "extended_pause_count": 0,
                },
                "visual_metrics": {
                    "video_track_detected": True,
                    "face_presence_ratio": 95.0,
                    "face_centering_ratio": 90.0,
                },
            }
        ]
    }

    res = client.post("/api/answers/session-report", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["session_id"] == "sess_api_test"
    assert data["answered_questions"] == 1
    assert data["total_questions"] == 2
    assert data["average_relevance_score"] == 92.0
    assert data["average_concept_coverage"] == 85.0
    assert data["overall_readiness_score"] > 70.0
    assert len(data["questions_breakdown"]) == 1


