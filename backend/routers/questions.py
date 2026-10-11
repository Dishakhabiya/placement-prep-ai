from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from db import get_db, ProfileRecord
from schemas import (
    ProfileResponse,
    QuestionSetRequest,
    QuestionSetResponse,
    FollowupRequest,
    FollowupResponse,
)
from module2.question_generator import generate_interview_questions
from module2.adaptive_followup import generate_adaptive_followup

router = APIRouter(prefix="/api/questions", tags=["Module 2: Question Generation Engine"])


@router.post("/generate", response_model=QuestionSetResponse, status_code=status.HTTP_200_OK)
def generate_questions(req: QuestionSetRequest, db: Session = Depends(get_db)):
    """
    Generates personalized interview questions based on candidate resume,
    target job description, match score, and interview mode.
    """
    profile_data: ProfileResponse = None

    if req.profile_id:
        record = db.query(ProfileRecord).filter(ProfileRecord.profile_id == req.profile_id).first()
        if not record:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Profile record '{req.profile_id}' not found."
            )
        profile_data = ProfileResponse(**record.to_profile_dict())
    elif req.profile_data:
        profile_data = req.profile_data
    else:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either profile_id or profile_data must be provided."
        )

    num_q = req.num_questions or 5
    response = generate_interview_questions(
        profile_data=profile_data,
        num_questions=num_q,
        override_mode=req.mode
    )
    return response


@router.post("/followup", response_model=FollowupResponse, status_code=status.HTTP_200_OK)
def generate_followup(req: FollowupRequest):
    """
    Generates an adaptive follow-up question probing missing key concepts or partial candidate answers.
    """
    if not req.candidate_answer or not req.candidate_answer.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Candidate answer cannot be empty for generating follow-up."
        )

    return generate_adaptive_followup(req)


@router.get("/profile/{profile_id}", response_model=QuestionSetResponse)
def get_questions_by_profile_id(profile_id: str, db: Session = Depends(get_db)):
    """
    Convenience endpoint: Fetch profile by ID and generate default 5-question interview set.
    """
    record = db.query(ProfileRecord).filter(ProfileRecord.profile_id == profile_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile record '{profile_id}' not found."
        )
    profile_data = ProfileResponse(**record.to_profile_dict())
    return generate_interview_questions(profile_data=profile_data, num_questions=5)
