"""
Module 3: Speech Transcription & NLP Answer Analysis Engine
Responsible for Whisper audio-to-text processing, NLP transcript normalization,
answer relevance scoring, and expected-concept coverage tracking.
"""

from module3.schemas import (
    ConceptStatus,
    ConceptCoverageItem,
    ConceptCoverageSummary,
    AnswerRelevanceResult,
    TranscriptMetadata,
    AnswerEvaluationResponse,
    TextAnswerEvaluationRequest,
)
from module3.evaluator import evaluate_answer, normalize_text
from module3.transcription import WhisperTranscriptionService, get_transcription_service

__all__ = [
    "ConceptStatus",
    "ConceptCoverageItem",
    "ConceptCoverageSummary",
    "AnswerRelevanceResult",
    "TranscriptMetadata",
    "AnswerEvaluationResponse",
    "TextAnswerEvaluationRequest",
    "evaluate_answer",
    "normalize_text",
    "WhisperTranscriptionService",
    "get_transcription_service",
]
