import io
import os
import pytest
from fastapi.testclient import TestClient

from main import app
from module3.schemas import ConceptStatus
from module3.evaluator import (
    normalize_text,
    evaluate_concept_coverage,
    estimate_answer_relevance,
    extract_transcript_metadata,
    evaluate_answer,
)
from module3.transcription import (
    validate_audio_file,
    temporary_audio_file,
    get_transcription_service,
    _ensure_pyav_compatibility,
    AudioValidationError,
    ModelLoadError,
    TranscriptionInferenceError,
)

client = TestClient(app)


# ============================================================================
# 1. Text Normalization & Metadata Tests
# ============================================================================

def test_text_normalization():
    raw = "  Hello, WORLD!! How's Python's Multi-Threading & Async/Await? \u00a0 "
    normalized = normalize_text(raw)
    assert "world" in normalized
    assert "multi-threading" in normalized
    assert "async/await" in normalized or "async" in normalized
    assert normalize_text("") == ""
    assert normalize_text(None) == ""


def test_transcript_metadata_word_and_char_counts():
    transcript = "Python uses reference counting and a generational garbage collector to manage memory."
    meta = extract_transcript_metadata(transcript, duration_seconds=4.5)
    assert meta.word_count == 12
    assert meta.char_count == len(transcript)
    assert meta.duration_seconds == 4.5
    assert meta.status == "success"

    empty_meta = extract_transcript_metadata("   ")
    assert empty_meta.word_count == 0
    assert empty_meta.status == "silent_or_empty"


# ============================================================================
# 2. Expected-Concept Coverage Tests
# ============================================================================

def test_concept_coverage_full_coverage():
    expected = ["immutability", "garbage collection", "GIL"]
    answer = (
        "Tuples are preferred when you need immutability. Python cleans up objects using "
        "garbage collection and handles concurrency through the GIL."
    )
    result = evaluate_concept_coverage(expected, answer)

    assert result.total_expected == 3
    assert result.covered_count == 3
    assert result.missing_count == 0
    assert result.coverage_score == 100.0
    assert "immutability" in result.covered_concepts
    assert "garbage collection" in result.covered_concepts
    assert "GIL" in result.covered_concepts


def test_concept_coverage_partial_and_missing():
    expected = [
        "reference counting",
        "generational garbage collection",
        "distributed lock management",
        "memory leaks"
    ]
    # Answer mentions 'reference counting', only mentions 'garbage collection' (part of generational GC),
    # and mentions nothing about distributed locks or memory leaks.
    answer = "Python tracks references using reference counting and runs garbage collection."
    result = evaluate_concept_coverage(expected, answer)

    assert result.total_expected == 4
    assert result.covered_count >= 1
    assert "reference counting" in result.covered_concepts
    assert "generational garbage collection" in result.partially_covered_concepts
    assert "distributed lock management" in result.missing_concepts
    assert "memory leaks" in result.missing_concepts
    assert 0.0 < result.coverage_score < 100.0


def test_concept_coverage_synonym_resolution():
    expected = ["garbage collection", "async/await"]
    # Candidate uses 'gc' and 'asynchronous coroutine'
    answer = "In Python, memory is recycled by the gc, and async functions run on an event loop."
    result = evaluate_concept_coverage(expected, answer)

    assert "garbage collection" in result.covered_concepts
    assert "async/await" in result.covered_concepts
    assert result.coverage_score == 100.0


def test_concept_coverage_empty_concepts_and_transcript():
    # Empty expected concepts
    res_empty_expected = evaluate_concept_coverage([], "Some candidate answer.")
    assert res_empty_expected.total_expected == 0
    assert res_empty_expected.coverage_score == 100.0

    # Empty candidate transcript
    res_empty_transcript = evaluate_concept_coverage(["Python", "SQL"], "")
    assert res_empty_transcript.total_expected == 2
    assert res_empty_transcript.covered_count == 0
    assert res_empty_transcript.missing_count == 2
    assert res_empty_transcript.coverage_score == 0.0


# ============================================================================
# 3. Answer Relevance Behavior Tests
# ============================================================================

def test_answer_relevance_high_vs_off_topic():
    question = "Explain how Python handles memory management, garbage collection, and reference counting."
    expected = ["reference counting", "garbage collection", "GIL"]

    # Highly relevant answer
    on_topic_answer = (
        "Python primarily handles memory management via reference counting, where each object tracks "
        "how many references point to it. When the count drops to zero, the memory is deallocated. "
        "To handle circular references, Python includes a cyclic garbage collection mechanism."
    )
    rel_high = estimate_answer_relevance(question, on_topic_answer, expected)
    assert rel_high.relevance_score >= 50.0
    assert rel_high.interpretation in ["High Relevance", "Moderate Relevance"]
    assert "reference" in rel_high.key_matching_terms or "memory" in rel_high.key_matching_terms

    # Completely off-topic answer
    off_topic_answer = "To bake a chocolate cake, preheat your oven to 350 degrees and whisk flour, sugar, and cocoa."
    rel_low = estimate_answer_relevance(question, off_topic_answer, expected)
    assert rel_low.relevance_score < 30.0
    assert rel_low.interpretation == "Low Relevance / Off-Topic"

    # Empty answer
    rel_empty = estimate_answer_relevance(question, "", expected)
    assert rel_empty.relevance_score == 0.0
    assert rel_empty.interpretation == "Low Relevance / Off-Topic"


# ============================================================================
# 4. Audio Upload Validation & Temp File Tests
# ============================================================================

def test_validate_audio_file_supported_formats():
    # Valid WAV dummy bytes
    dummy_wav = b"RIFF" + b"\x00" * 200
    validate_audio_file("response.wav", dummy_wav)
    validate_audio_file("recording.mp3", dummy_wav)
    validate_audio_file("audio.m4a", dummy_wav)
    validate_audio_file("sample.webm", dummy_wav)


def test_validate_audio_file_unsupported_format():
    dummy_bytes = b"header" + b"\x00" * 200
    with pytest.raises(AudioValidationError) as exc:
        validate_audio_file("doc.txt", dummy_bytes)
    assert exc.value.status_code == 415

    with pytest.raises(AudioValidationError) as exc:
        validate_audio_file("virus.exe", dummy_bytes)
    assert exc.value.status_code == 415


def test_validate_audio_file_empty_and_corrupt():
    with pytest.raises(AudioValidationError) as exc:
        validate_audio_file("empty.wav", b"")
    assert exc.value.status_code == 400
    assert "empty" in exc.value.message.lower()

    with pytest.raises(AudioValidationError) as exc:
        validate_audio_file("corrupt.wav", b"too small")
    assert exc.value.status_code == 400
    assert "corrupt" in exc.value.message.lower() or "too small" in exc.value.message.lower()


def test_validate_audio_file_oversized():
    # Exceeds 25 MB
    large_bytes = b"\x00" * (26 * 1024 * 1024)
    with pytest.raises(AudioValidationError) as exc:
        validate_audio_file("huge.wav", large_bytes)
    assert exc.value.status_code == 413


def test_temporary_audio_file_lifecycle():
    dummy_content = b"RIFF" + b"\x00" * 200
    created_path = None
    with temporary_audio_file(dummy_content, "test.wav") as temp_path:
        created_path = temp_path
        assert os.path.exists(temp_path)
        with open(temp_path, "rb") as f:
            assert f.read() == dummy_content

    # Verify reliable cleanup after context exit
    assert not os.path.exists(created_path)


# ============================================================================
# 5. Transcription Service Mock & Failure Behavior
# ============================================================================

def test_transcription_service_mock_injection():
    service = get_transcription_service()
    
    # Mock handler that does not call heavy models or network
    def mock_handler(path: str):
        return {
            "transcript": "FastAPI provides asynchronous request routing and automatic OpenAPI generation.",
            "detected_language": "en",
            "language_probability": 0.98,
            "duration_seconds": 3.8,
            "model_used": "mock-whisper-test",
            "status": "success"
        }

    service.set_mock_handler(mock_handler)
    res = service.transcribe("dummy_path.wav")
    assert res["transcript"].startswith("FastAPI provides")
    assert res["model_used"] == "mock-whisper-test"
    assert "processing_time_seconds" in res


def test_transcription_service_inference_failure():
    service = get_transcription_service()

    def failing_handler(path: str):
        raise TranscriptionInferenceError("Decryption or codec error during audio processing")

    service.set_mock_handler(failing_handler)
    with pytest.raises(TranscriptionInferenceError):
        service.transcribe("bad.wav")

    # Reset mock handler
    service.set_mock_handler(None)



# ============================================================================
# 6. API Endpoint Tests (POST /api/answers/analyze)
# ============================================================================

def test_api_analyze_text_success():
    payload = {
        "question_id": "q_1",
        "question_text": "What is the difference between state and props in React components?",
        "expected_key_concepts": ["component props", "state management", "re-rendering", "immutability"],
        "answer_text": "Props are passed from parent components and are immutable, whereas state is managed internally and triggers re-rendering."
    }
    response = client.post("/api/answers/analyze", json=payload)
    assert response.status_code == 200
    data = response.json()

    assert data["question_id"] == "q_1"
    assert data["evaluation_id"].startswith("eval_")
    assert data["transcript_metadata"]["word_count"] > 10
    assert data["concept_coverage"]["covered_count"] >= 2
    assert "component props" in data["concept_coverage"]["covered_concepts"] or "re-rendering" in data["concept_coverage"]["covered_concepts"]
    assert data["relevance"]["relevance_score"] >= 40.0


def test_api_analyze_text_validation_errors():
    # Missing question_id
    response = client.post("/api/answers/analyze", json={
        "question_id": "",
        "question_text": "Some question?",
        "answer_text": "Some answer."
    })
    assert response.status_code in [400, 422]

    # Non-existent profile_id
    response = client.post("/api/answers/analyze", json={
        "question_id": "q_1",
        "question_text": "Some question?",
        "answer_text": "Some answer.",
        "profile_id": "prof_nonexistent_999"
    })
    assert response.status_code == 404


# ============================================================================
# 7. API Endpoint Tests (POST /api/answers/transcribe)
# ============================================================================

def test_api_transcribe_audio_success_with_mock():
    service = get_transcription_service()
    service.set_mock_handler(lambda path: {
        "transcript": "Docker containers isolate application processes using Linux namespaces and cgroups.",
        "detected_language": "en",
        "language_probability": 0.99,
        "duration_seconds": 4.2,
        "model_used": "whisper-mock-unit",
        "status": "success"
    })

    dummy_audio = b"RIFF" + b"\x00" * 300
    files = {
        "audio": ("answer.wav", io.BytesIO(dummy_audio), "audio/wav")
    }
    data = {
        "question_id": "q_docker_1",
        "question_text": "Explain how Docker containerization differs from standard virtual machines.",
        "expected_key_concepts": "[\"containerization\", \"Dockerfile\", \"process isolation\"]",
        "session_id": "sess_unit_test"
    }

    response = client.post("/api/answers/transcribe", files=files, data=data)
    assert response.status_code == 200
    res_json = response.json()

    assert res_json["question_id"] == "q_docker_1"
    assert res_json["session_id"] == "sess_unit_test"
    assert "Docker containers isolate" in res_json["transcript_metadata"]["transcript"]
    assert res_json["transcript_metadata"]["duration_seconds"] == 4.2
    assert res_json["concept_coverage"]["total_expected"] == 3
    assert "containerization" in res_json["concept_coverage"]["covered_concepts"]
    assert res_json["relevance"]["relevance_score"] >= 35.0

    service.set_mock_handler(None)


def test_api_transcribe_browser_webm_blob_upload():
    service = get_transcription_service()
    service.set_mock_handler(lambda path: {
        "transcript": "In Python, memory is managed automatically using reference counting.",
        "detected_language": "en",
        "language_probability": 0.98,
        "duration_seconds": 3.5,
        "model_used": "whisper-mock-unit",
        "status": "success"
    })

    # Simulates browser MediaRecorder Blob upload where filename might be 'blob' or 'recording.webm'
    dummy_webm = b"\x1a\x45\xdf\xa3" + b"\x00" * 300
    files = {
        "audio": ("blob", io.BytesIO(dummy_webm), "audio/webm;codecs=opus")
    }
    data = {
        "question_id": "q_browser_1",
        "question_text": "Explain memory management in Python.",
        "expected_key_concepts": "[\"reference counting\", \"garbage collection\"]",
    }

    response = client.post("/api/answers/transcribe", files=files, data=data)
    assert response.status_code == 200
    res_json = response.json()
    assert res_json["question_id"] == "q_browser_1"
    assert "reference counting" in res_json["transcript_metadata"]["transcript"]
    assert "reference counting" in res_json["concept_coverage"]["covered_concepts"]

    service.set_mock_handler(None)



def test_api_transcribe_audio_empty_file():
    files = {
        "audio": ("empty.wav", io.BytesIO(b""), "audio/wav")
    }
    data = {
        "question_id": "q_1",
        "question_text": "Valid question text"
    }
    response = client.post("/api/answers/transcribe", files=files, data=data)
    assert response.status_code == 400
    assert "empty" in response.json()["detail"].lower()


def test_api_transcribe_audio_unsupported_type():
    dummy_bytes = b"some plain text" * 20
    files = {
        "audio": ("notes.txt", io.BytesIO(dummy_bytes), "text/plain")
    }
    data = {
        "question_id": "q_1",
        "question_text": "Valid question text"
    }
    response = client.post("/api/answers/transcribe", files=files, data=data)
    assert response.status_code == 415


def test_api_transcribe_audio_oversized():
    huge_bytes = b"\x00" * (26 * 1024 * 1024)
    files = {
        "audio": ("large.wav", io.BytesIO(huge_bytes), "audio/wav")
    }
    data = {
        "question_id": "q_1",
        "question_text": "Valid question text"
    }
    response = client.post("/api/answers/transcribe", files=files, data=data)
    assert response.status_code == 413


def test_api_transcribe_service_failure_returns_error():
    service = get_transcription_service()
    service.set_mock_handler(lambda path: (_ for _ in ()).throw(TranscriptionInferenceError("Audio decode corruption")))

    dummy_audio = b"RIFF" + b"\x00" * 300
    files = {
        "audio": ("answer.wav", io.BytesIO(dummy_audio), "audio/wav")
    }
    data = {
        "question_id": "q_err",
        "question_text": "What is memory management?"
    }
    response = client.post("/api/answers/transcribe", files=files, data=data)
    assert response.status_code == 422
    assert "audio decode corruption" in response.json()["detail"].lower()

    service.set_mock_handler(None)


# ============================================================================
# 8. Router Registration & Cross-Module Compatibility
# ============================================================================

def test_routes_registered_and_existing_modules_intact():
    route_paths = set(app.openapi().get("paths", {}).keys())
    
    # Verify Member 3 routes
    assert "/api/answers/transcribe" in route_paths
    assert "/api/answers/analyze" in route_paths

    # Verify Member 1 routes intact
    assert "/api/health" in route_paths
    assert "/api/profile" in route_paths
    assert "/api/profiles" in route_paths

    # Verify Member 2 routes intact
    assert "/api/questions/generate" in route_paths
    assert "/api/questions/followup" in route_paths

    # Verify health check succeeds
    health_res = client.get("/api/health")
    assert health_res.status_code == 200
    assert health_res.json()["status"] == "healthy"


# ============================================================================
# 9. PyAV / faster-whisper Compatibility Regression Test
# ============================================================================

def test_pyav_metadata_errors_compatibility():
    """
    Regression test for: 'open() got an unexpected keyword argument metadata_errors'.
    PyAV >= 19.0.0 removed the 'metadata_errors' parameter from av.open().
    faster-whisper <= 1.2.1 calls av.open(..., metadata_errors='ignore') in decode_audio().
    _ensure_pyav_compatibility() ensures that calls do not fail with TypeError.
    """
    _ensure_pyav_compatibility()

    try:
        import av
        # Verify av.open can be called with metadata_errors='ignore' without raising TypeError
        dummy_wav = b"RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00\x80>\x00\x00\x00}\x00\x00\x02\x00\x10\x00data\x00\x00\x00\x00"
        with av.open(io.BytesIO(dummy_wav), mode="r", metadata_errors="ignore") as container:
            assert container is not None

        # Verify faster_whisper.audio.decode_audio runs without TypeError
        import faster_whisper.audio as fwa
        audio = fwa.decode_audio(io.BytesIO(dummy_wav))
        assert audio is not None
    except ImportError:
        pytest.skip("faster-whisper or av is not installed in the environment.")



