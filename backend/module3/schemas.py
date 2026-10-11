from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


class ConceptStatus(str, Enum):
    COVERED = "covered"
    PARTIALLY_COVERED = "partially_covered"
    MISSING = "missing"


class ConceptCoverageItem(BaseModel):
    concept: str = Field(..., description="Expected key concept name")
    status: ConceptStatus = Field(..., description="Coverage status: covered, partially_covered, or missing")
    matched_phrase: Optional[str] = Field(default=None, description="Phrase or token identified in the transcript")
    score: float = Field(..., ge=0.0, le=1.0, description="Normalized score contribution (1.0 for covered, 0.5 for partial, 0.0 for missing)")
    explanation: str = Field(default="", description="Human-readable justification for concept coverage assignment")


class ConceptCoverageSummary(BaseModel):
    total_expected: int = Field(default=0, description="Total number of expected concepts evaluated")
    covered_count: int = Field(default=0, description="Number of fully covered concepts")
    partially_covered_count: int = Field(default=0, description="Number of partially covered concepts")
    missing_count: int = Field(default=0, description="Number of missing concepts")
    coverage_score: float = Field(default=0.0, ge=0.0, le=100.0, description="Overall transparent coverage score (0.0 to 100.0)")
    covered_concepts: List[str] = Field(default_factory=list, description="List of fully covered concept strings")
    partially_covered_concepts: List[str] = Field(default_factory=list, description="List of partially covered concept strings")
    missing_concepts: List[str] = Field(default_factory=list, description="List of missing concepts (compatible with Module 2 FollowupRequest)")
    details: List[ConceptCoverageItem] = Field(default_factory=list, description="Per-concept breakdown")
    scoring_notes: str = Field(default="", description="Scoring methodology notes and known limitations")


class AnswerRelevanceResult(BaseModel):
    relevance_score: float = Field(default=0.0, ge=0.0, le=100.0, description="Estimated relevance score (0.0 to 100.0)")
    method: str = Field(default="tfidf_cosine_with_keyword_alignment", description="NLP method used to estimate relevance")
    interpretation: str = Field(default="Moderate Relevance", description="Category: High Relevance, Moderate Relevance, or Low/Off-Topic")
    key_matching_terms: List[str] = Field(default_factory=list, description="Key shared tokens between question context and answer")
    notes: str = Field(default="", description="Explanation of metric computation and bounds")


class TranscriptMetadata(BaseModel):
    transcript: str = Field(..., description="Transcribed or submitted answer text")
    word_count: int = Field(default=0, description="Number of words in the transcript")
    char_count: int = Field(default=0, description="Number of characters in the transcript")
    detected_language: Optional[str] = Field(default=None, description="Detected audio language code, e.g., 'en'")
    language_probability: Optional[float] = Field(default=None, description="Confidence probability of detected language")
    duration_seconds: Optional[float] = Field(default=None, description="Audio duration in seconds if extractable")
    model_used: Optional[str] = Field(default=None, description="Whisper model identifier used for transcription")
    processing_time_seconds: Optional[float] = Field(default=None, description="Total audio processing time in seconds")
    status: str = Field(default="success", description="Transcription status: 'success', 'silent_or_empty', or 'text_input'")


class AnswerEvaluationResponse(BaseModel):
    evaluation_id: str = Field(..., description="Unique evaluation identifier (e.g., eval_12345)")
    profile_id: Optional[str] = Field(default=None, description="Associated candidate profile ID")
    session_id: Optional[str] = Field(default=None, description="Associated mock interview session ID")
    question_id: str = Field(..., description="Identifier of the evaluated question")
    question_text: str = Field(..., description="Original question text evaluated against")
    transcript_metadata: TranscriptMetadata = Field(..., description="Transcript text and audio processing metadata")
    relevance: AnswerRelevanceResult = Field(..., description="Relevance analysis of transcript to question")
    concept_coverage: ConceptCoverageSummary = Field(..., description="Expected-concept coverage breakdown")
    evaluated_at: str = Field(..., description="ISO 8601 UTC timestamp of evaluation")


class TextAnswerEvaluationRequest(BaseModel):
    profile_id: Optional[str] = Field(default=None, description="Optional associated profile ID")
    session_id: Optional[str] = Field(default=None, description="Optional associated session ID")
    question_id: str = Field(..., description="Unique question identifier")
    question_text: str = Field(..., description="Original interview question text")
    expected_key_concepts: List[str] = Field(default_factory=list, description="Expected concepts for question")
    answer_text: str = Field(..., description="Candidate answer text to analyze")
