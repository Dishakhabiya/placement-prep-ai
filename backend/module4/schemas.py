from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field


class SpeakingDeliveryMetrics(BaseModel):
    words_per_minute: float = Field(..., description="Estimated speaking pace in words per minute")
    pace_rating: str = Field(..., description="Pace classification: Slow, Optimal, or Fast")
    total_filler_words: int = Field(default=0, description="Total count of filler words detected in speech")
    filler_word_breakdown: Dict[str, int] = Field(default_factory=dict, description="Counts of individual filler words detected")
    filler_percentage: float = Field(default=0.0, description="Percentage of total words that are fillers")
    extended_pause_count: int = Field(default=0, description="Count of silent pauses exceeding 1.5 seconds")
    total_pause_duration_seconds: float = Field(default=0.0, description="Total seconds spent in pauses between speech segments")
    speaking_duration_seconds: float = Field(default=0.0, description="Total duration of audio recording in seconds")
    speaking_coaching_tip: str = Field(default="", description="Constructive, objective speaking pacing and filler advice")


class VisualAnalysisMetrics(BaseModel):
    video_track_detected: bool = Field(default=False, description="Whether a valid video stream was present in the upload")
    total_frames_sampled: int = Field(default=0, description="Total count of video frames evaluated (sampled at 1 fps)")
    face_detected_frames: int = Field(default=0, description="Count of evaluated frames where a human face was identified")
    face_presence_ratio: float = Field(default=0.0, ge=0.0, le=100.0, description="Percentage of sampled frames where candidate face was visible (0-100%)")
    face_centered_frames: int = Field(default=0, description="Count of evaluated frames where the face was centered in frame")
    face_centering_ratio: float = Field(default=0.0, ge=0.0, le=100.0, description="Percentage of sampled frames where face was centered (0-100%)")
    head_movement_stability: str = Field(default="Unknown", description="Head movement stability: Steady, Moderate Movement, High Movement, or Unknown")
    upper_body_posture_stability: str = Field(default="Unknown", description="Upper-body posture positioning: Centered / Upright, Slouching / Drift, or Unknown")
    detector_model: str = Field(default="OpenCV-HaarCascade-FrontalFace", description="Computer vision detector model used")
    visual_coaching_tip: str = Field(default="", description="Objective visual framing and alignment coaching guidance")
    methodology_limitations: str = Field(default="", description="Transparent documentation of model bounds (does not measure eye gaze, confidence, or emotions)")


class QuestionReportItem(BaseModel):
    question_id: str = Field(..., description="Unique question ID")
    question_text: str = Field(..., description="Question prompt")
    target_topic: Optional[str] = Field(default=None, description="Topic or concept area of question")
    category: Optional[str] = Field(default=None, description="Question category e.g. technical, behavioral")
    difficulty: Optional[str] = Field(default=None, description="Question difficulty")
    status: str = Field(default="answered", description="Status: answered or unanswered")
    transcript: Optional[str] = Field(default=None, description="Candidate transcript text")
    relevance_score: Optional[float] = Field(default=None, description="Relevance score (0-100)")
    coverage_score: Optional[float] = Field(default=None, description="Concept coverage score (0-100)")
    semantic_coverage_score: Optional[float] = Field(default=None, description="SBERT semantic coverage score (0-100)")
    semantic_similarity: Optional[float] = Field(default=None, description="SBERT average cosine similarity")
    covered_concepts: List[str] = Field(default_factory=list, description="Concepts matched")
    missing_concepts: List[str] = Field(default_factory=list, description="Concepts missed")
    semantically_covered: List[str] = Field(default_factory=list, description="Concepts matched via SBERT embeddings")
    words_per_minute: Optional[float] = Field(default=None, description="Speaking pace in WPM")
    filler_word_count: Optional[int] = Field(default=None, description="Filler words in answer")
    extended_pause_count: Optional[int] = Field(default=None, description="Extended pauses in answer")
    face_presence_ratio: Optional[float] = Field(default=None, description="Face presence % in video")
    face_centering_ratio: Optional[float] = Field(default=None, description="Centering % in video")
    followup_question: Optional[str] = Field(default=None, description="Adaptive follow-up question if generated")
    followup_focus: Optional[str] = Field(default=None, description="Focus area of follow-up")


class SessionReportResponse(BaseModel):
    session_id: Optional[str] = Field(default=None, description="Interview session ID")
    profile_id: Optional[str] = Field(default=None, description="Candidate profile ID")
    candidate_name: Optional[str] = Field(default="Candidate", description="Name of the candidate")
    target_role: Optional[str] = Field(default="Software Engineer", description="Target job title or role")
    total_questions: int = Field(default=0, description="Total questions assigned in session")
    answered_questions: int = Field(default=0, description="Number of questions answered")
    completion_rate: float = Field(default=0.0, description="Percentage of questions answered (0-100%)")
    
    # Overall Performance Score (composite metric 0-100)
    overall_readiness_score: float = Field(default=0.0, description="Overall weighted readiness score (0-100%)")
    readiness_level: str = Field(default="Needs Practice", description="Interview readiness tier: Placement Ready, Strong Potential, Needs Practice")
    
    # Core Aggregated Metrics
    average_relevance_score: float = Field(default=0.0, description="Mean answer relevance score (0-100%)")
    average_concept_coverage: float = Field(default=0.0, description="Mean expected concept coverage (0-100%)")
    average_semantic_coverage: Optional[float] = Field(default=None, description="Mean SBERT semantic coverage score (0-100%)")
    average_semantic_similarity: Optional[float] = Field(default=None, description="Mean SBERT cosine similarity across concept pairs")
    sbert_model_used: Optional[str] = Field(default=None, description="SBERT model identifier used for evaluation")
    total_concepts_covered: int = Field(default=0, description="Total expected concepts satisfied across answers")
    total_concepts_missing: int = Field(default=0, description="Total expected concepts missed across answers")
    
    # Delivery Aggregates
    average_words_per_minute: float = Field(default=0.0, description="Mean speaking rate across answers")
    overall_pace_rating: str = Field(default="Optimal", description="Overall pace classification")
    total_filler_words: int = Field(default=0, description="Cumulative filler word count across session")
    overall_filler_percentage: float = Field(default=0.0, description="Percentage of spoken words that were fillers")
    top_filler_words: Dict[str, int] = Field(default_factory=dict, description="Most frequent filler words across session")
    total_extended_pauses: int = Field(default=0, description="Total extended pauses (>1.5s) across session")
    total_speaking_duration_seconds: float = Field(default=0.0, description="Cumulative speaking duration in seconds")
    
    # Visual Framing Aggregates
    video_sessions_count: int = Field(default=0, description="Number of answers that included video analysis")
    average_face_presence_ratio: Optional[float] = Field(default=None, description="Mean face presence ratio across video answers")
    average_face_centering_ratio: Optional[float] = Field(default=None, description="Mean face centering ratio across video answers")
    visual_stability_summary: str = Field(default="No Video Captured", description="Overall visual framing summary")
    
    # Actionable Insights & Coaching
    key_strengths: List[str] = Field(default_factory=list, description="Top positive performance highlights")
    areas_for_improvement: List[str] = Field(default_factory=list, description="Targeted weakness areas")
    actionable_recommendations: List[str] = Field(default_factory=list, description="Personalized next-step coaching recommendations")
    
    # Per-Question Breakdown
    questions_breakdown: List[QuestionReportItem] = Field(default_factory=list, description="Granular question-by-question metrics")
    generated_at: str = Field(..., description="Timestamp of report generation")


class SessionReportRequest(BaseModel):
    session_id: Optional[str] = None
    profile_id: Optional[str] = None
    candidate_name: Optional[str] = None
    target_role: Optional[str] = None
    total_questions: Optional[int] = None
    questions: Optional[List[Dict[str, Any]]] = None
    evaluations: List[Dict[str, Any]] = Field(default_factory=list, description="List of AnswerEvaluationResponse dicts or answers")
    visual_issues: Optional[List[Dict[str, Any]]] = Field(
        default=None,
        description="Real-time AI visual monitoring alerts captured during recording (posture, attire, eye contact, background)"
    )

