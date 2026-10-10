from typing import List, Optional
from pydantic import BaseModel, Field


class ProjectItem(BaseModel):
    title: str = Field(default="", description="Project title")
    description: str = Field(default="", description="Summary or bullet points of the project")
    tech: List[str] = Field(default_factory=list, description="Technologies and skills used in project")


class CandidateProfile(BaseModel):
    skills: List[str] = Field(default_factory=list, description="Extracted candidate skills")
    projects: List[ProjectItem] = Field(default_factory=list, description="Extracted candidate projects")
    experience: List[str] = Field(default_factory=list, description="Work experience and internship points")
    education: List[str] = Field(default_factory=list, description="Education details")
    certifications: List[str] = Field(default_factory=list, description="Certifications and courses")


class JobProfile(BaseModel):
    title: str = Field(default="", description="Target job title")
    required_skills: List[str] = Field(default_factory=list, description="Mandatory skills from JD")
    preferred_skills: List[str] = Field(default_factory=list, description="Preferred/optional skills from JD")
    responsibilities: List[str] = Field(default_factory=list, description="Core responsibilities extracted from JD")


class MatchResult(BaseModel):
    matched: List[str] = Field(default_factory=list, description="Skills present in resume and required/preferred in JD")
    missing: List[str] = Field(default_factory=list, description="Skills required/preferred in JD not found in resume")
    extra: List[str] = Field(default_factory=list, description="Skills on resume not explicitly asked by JD")
    score: float = Field(default=0.0, description="Match score from 0 to 100")


class ProjectJobLink(BaseModel):
    project: str = Field(default="", description="Candidate project title or summary")
    responsibility: str = Field(default="", description="Job responsibility")
    similarity: float = Field(default=0.0, description="Semantic or lexical similarity score (0.0 - 1.0)")


class InterviewTopic(BaseModel):
    topic: str = Field(default="", description="Topic name")
    priority: str = Field(default="high", description="Priority level: high, medium, or low")
    reason: str = Field(default="", description="Justification for why this topic is relevant")


class ProfileResponse(BaseModel):
    profile_id: str
    mode: str = Field(default="mixed", description="HR, Technical, Resume-Based, JD-Based, or Mixed")
    candidate: CandidateProfile
    job: JobProfile
    match: MatchResult
    project_job_links: List[ProjectJobLink] = Field(default_factory=list)
    interview_topics: List[InterviewTopic] = Field(default_factory=list)


class ProfileUpdate(BaseModel):
    mode: Optional[str] = None
    candidate: Optional[CandidateProfile] = None
    job: Optional[JobProfile] = None


class ProfileSummaryItem(BaseModel):
    profile_id: str
    created_at: str
    updated_at: str
    mode: str
    job_title: str
    match_score: float
    candidate_skills_count: int


class HealthResponse(BaseModel):
    status: str
    version: str
    service: str
