import re
import os
import json
import logging

from typing import List, Optional
from fastapi.responses import Response
from pydantic import BaseModel
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from db import get_db, ProfileRecord
from module3.schemas import (
    AnswerEvaluationResponse,
    TextAnswerEvaluationRequest,
    TranscriptMetadata,
)
from module3.evaluator import evaluate_answer, extract_transcript_metadata
from module3.transcription import (
    get_transcription_service,
    validate_audio_file,
    temporary_audio_file,
    AudioValidationError,
    ModelLoadError,
    TranscriptionInferenceError,
)

from module4 import (
    analyze_speaking_delivery,
    analyze_video_frames,
    aggregate_session_report,
    SessionReportRequest,
    SessionReportResponse,
)

router = APIRouter(prefix="/api/answers", tags=["Module 3: Speech & Answer Evaluation"])


def _parse_expected_concepts(raw_concepts: Optional[str]) -> List[str]:
    """Parses JSON-encoded array or comma-separated concept list."""
    if not raw_concepts or not raw_concepts.strip():
        return []
    
    trimmed = raw_concepts.strip()
    if trimmed.startswith("[") and trimmed.endswith("]"):
        try:
            parsed = json.loads(trimmed)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except json.JSONDecodeError:
            pass
            
    # Comma-separated fallback
    return [c.strip() for c in trimmed.split(",") if c.strip()]


@router.post(
    "/transcribe",
    response_model=AnswerEvaluationResponse,
    status_code=status.HTTP_200_OK,
    summary="Transcribe audio answer and evaluate relevance & concept coverage"
)
async def transcribe_and_evaluate_answer(
    audio: Optional[UploadFile] = File(None, description="Audio recording file (WAV, MP3, M4A, WebM, OGG, etc.)"),
    audio_file: Optional[UploadFile] = File(None, description="Alternative field name for audio file"),
    question_id: str = Form(..., description="Unique question ID (e.g. q_1)"),
    question_text: str = Form(..., description="Full text of the interview question"),
    expected_key_concepts: Optional[str] = Form("[]", description="JSON array or comma-separated list of expected concepts"),
    profile_id: Optional[str] = Form(None, description="Candidate profile ID if known"),
    session_id: Optional[str] = Form(None, description="Mock interview session ID if known"),
    db: Session = Depends(get_db)
):
    """
    Accepts candidate audio recording via multipart form data:
    1. Validates audio format and size constraints.
    2. Transcribes audio locally using Whisper.
    3. Normalizes text and evaluates expected key concepts coverage.
    4. Computes answer relevance against the original question.
    5. Returns structured evaluation linked to profile, session, and question IDs.
    """
    actual_audio = audio or audio_file
    if actual_audio is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Audio recording file is required (field 'audio' or 'audio_file')."
        )

    # 1. Validate Question Inputs
    if not question_id or not question_id.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="question_id cannot be empty."
        )

    if not question_text or not question_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="question_text cannot be empty."
        )

    # 2. Validate Profile Existence if profile_id is provided
    if profile_id:
        clean_profile_id = profile_id.strip()
        record = db.query(ProfileRecord).filter(ProfileRecord.profile_id == clean_profile_id).first()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Profile record '{clean_profile_id}' not found."
            )

    # 3. Parse Expected Concepts
    concept_list = _parse_expected_concepts(expected_key_concepts)

    # 4. Read Audio File Bytes
    try:
        audio_bytes = await actual_audio.read()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to read audio file upload: {str(e)}"
        )

    # 5. Validate Audio Metadata & Size
    filename = actual_audio.filename or "recording.webm"
    if filename == "blob" or not os.path.splitext(filename)[1]:
        if actual_audio.content_type and "mp4" in actual_audio.content_type.lower():
            filename = "recording.mp4"
        elif actual_audio.content_type and "ogg" in actual_audio.content_type.lower():
            filename = "recording.ogg"
        elif actual_audio.content_type and "wav" in actual_audio.content_type.lower():
            filename = "recording.wav"
        else:
            filename = "recording.webm"

    try:
        validate_audio_file(
            filename=filename,
            file_bytes=audio_bytes,
            content_type=actual_audio.content_type
        )
    except AudioValidationError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)

    # 6. Execute Whisper Transcription and Module 4 Video/Audio Analysis with safe temp file cleanup
    transcription_service = get_transcription_service()
    visual_analysis_result = None
    try:
        with temporary_audio_file(audio_bytes, filename=filename) as temp_media_path:
            transcription_result = transcription_service.transcribe(temp_media_path)
            try:
                visual_analysis_result = analyze_video_frames(temp_media_path)
            except Exception as ve:
                logger.warning(f"Module 4 visual analysis skipped due to error: {ve}")
                visual_analysis_result = None
    except ModelLoadError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except TranscriptionInferenceError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message)
    except Exception as e:
        logger.error(f"Unexpected error during transcription: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal error during transcription processing: {str(e)}"
        )

    # 7. Build Transcript Metadata
    transcript_text = transcription_result.get("transcript", "")
    metadata = extract_transcript_metadata(
        transcript=transcript_text,
        duration_seconds=transcription_result.get("duration_seconds"),
        detected_language=transcription_result.get("detected_language"),
        language_probability=transcription_result.get("language_probability"),
        model_used=transcription_result.get("model_used"),
        processing_time_seconds=transcription_result.get("processing_time_seconds"),
        status=transcription_result.get("status", "success")
    )

    # 8. Evaluate Concept Coverage and Relevance
    evaluation = evaluate_answer(
        question_id=question_id.strip(),
        question_text=question_text.strip(),
        expected_concepts=concept_list,
        transcript=transcript_text,
        profile_id=profile_id.strip() if profile_id else None,
        session_id=session_id.strip() if session_id else None,
        metadata=metadata
    )

    # 9. Compute Module 4 Speaking Delivery Metrics
    try:
        delivery_res = analyze_speaking_delivery(
            transcript=transcript_text,
            duration_seconds=transcription_result.get("duration_seconds"),
            segments=transcription_result.get("segments"),
        )
        evaluation.delivery_metrics = delivery_res
    except Exception as de:
        logger.warning(f"Module 4 speaking delivery calculation skipped: {de}")
        evaluation.delivery_metrics = None

    # Attach Visual Metrics
    evaluation.visual_metrics = visual_analysis_result

    return evaluation


@router.post(
    "/analyze",
    response_model=AnswerEvaluationResponse,
    status_code=status.HTTP_200_OK,
    summary="Evaluate candidate answer text without audio upload"
)
def analyze_text_answer(
    req: TextAnswerEvaluationRequest,
    db: Session = Depends(get_db)
):
    """
    Evaluates candidate typed or pre-transcribed answer text:
    Analyzes relevance against question text and coverage of expected key concepts.
    """
    if not req.question_id or not req.question_id.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="question_id cannot be empty."
        )

    if not req.question_text or not req.question_text.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="question_text cannot be empty."
        )

    if req.profile_id:
        record = db.query(ProfileRecord).filter(ProfileRecord.profile_id == req.profile_id).first()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Profile record '{req.profile_id}' not found."
            )

    metadata = extract_transcript_metadata(
        transcript=req.answer_text,
        status="text_input"
    )

    evaluation = evaluate_answer(
        question_id=req.question_id,
        question_text=req.question_text,
        expected_concepts=req.expected_key_concepts or [],
        transcript=req.answer_text,
        profile_id=req.profile_id,
        session_id=req.session_id,
        metadata=metadata
    )

    # Compute text-based filler word statistics
    try:
        words = req.answer_text.strip().split() if req.answer_text else []
        estimated_dur = len(words) / 2.2 if words else 0.0  # Approx 130 WPM speech assumption
        evaluation.delivery_metrics = analyze_speaking_delivery(
            transcript=req.answer_text,
            duration_seconds=estimated_dur,
        )
    except Exception:
        evaluation.delivery_metrics = None

    return evaluation


@router.post(
    "/session-report",
    response_model=SessionReportResponse,
    status_code=status.HTTP_200_OK,
    summary="Generate aggregated performance report for complete mock interview session"
)
def generate_session_report_endpoint(
    req: SessionReportRequest,
    db: Session = Depends(get_db)
):
    """
    Aggregates answer relevance, concept coverage, speaking pacing, filler words,
    pauses, and visual framing alignment across all answered questions in a session.
    """
    candidate_name = req.candidate_name
    target_role = req.target_role

    if req.profile_id and (not candidate_name or not target_role):
        record = db.query(ProfileRecord).filter(ProfileRecord.profile_id == req.profile_id).first()
        if record:
            data = record.data or {}
            cand = data.get("candidate", {})
            job = data.get("job", {})
            if not candidate_name:
                candidate_name = cand.get("name") or "Candidate"
            if not target_role:
                target_role = job.get("title") or "Software Engineer"

    report = aggregate_session_report(
        evaluations=req.evaluations,
        total_questions=req.total_questions,
        questions=req.questions,
        profile_id=req.profile_id,
        session_id=req.session_id,
        candidate_name=candidate_name or "Candidate",
        target_role=target_role or "Software Engineer",
    )
    return report


class TtsRequest(BaseModel):
    text: str
    voice: Optional[str] = "en-US-JennyNeural"
    rate: Optional[str] = "-3%"
    pitch: Optional[str] = "+0Hz"


@router.post(
    "/tts",
    summary="Generate crystal-clear natural neural TTS audio stream",
    response_class=Response,
    status_code=status.HTTP_200_OK,
)
async def generate_neural_tts(req: TtsRequest):
    """
    Synthesizes text into high-fidelity neural speech (MP3) using natural voices
    (e.g. en-US-JennyNeural, en-IN-NeerjaNeural, en-US-AriaNeural, en-GB-SoniaNeural).
    """
    if not req.text or not req.text.strip():
        raise HTTPException(status_code=400, detail="Text cannot be empty.")

    # Clean text to remove markdown asterisks, hash headers, brackets, and code delimiters for crystal-clear pronunciation
    clean_text = re.sub(r'[*_#`~]', '', req.text)
    clean_text = re.sub(r'\[.*?\]', '', clean_text)
    clean_text = re.sub(r'\s+', ' ', clean_text).strip()
    if not clean_text:
        clean_text = req.text.strip()

    voice = req.voice or "en-US-JennyNeural"
    rate = req.rate or "-3%"
    pitch = req.pitch or "+0Hz"

    try:
        import edge_tts
        communicate = edge_tts.Communicate(clean_text, voice, rate=rate, pitch=pitch)
        audio_bytes = b""
        async for chunk in communicate.stream():
            if chunk["type"] == "audio":
                audio_bytes += chunk["data"]
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Length": str(len(audio_bytes)),
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=86400",
            },
        )
    except Exception as e:
        logging.error(f"Neural TTS failed: {e}")
        raise HTTPException(status_code=500, detail=f"TTS generation error: {str(e)}")
