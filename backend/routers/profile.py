import json
import os
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.orm import Session

from db import get_db, ProfileRecord
from schemas import (
    ProfileResponse,
    ProfileUpdate,
    ProfileSummaryItem,
    InterviewTopic,
    HealthResponse,
)
from module1.pipeline import process_resume_and_jd, recalculate_profile

from module1.parsing.extract_text import extract_text

router = APIRouter(prefix="/api", tags=["Profile & Intelligence"])

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx"}
ALLOWED_MODES = {"hr", "technical", "resume-based", "jd-based", "mixed"}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


@router.get("/health", response_model=HealthResponse)
def health_check():
    """Returns service health status for frontend connectivity checks."""
    return HealthResponse(
        status="healthy",
        version="1.0.0",
        service="Module 1: Resume & JD Intelligence API"
    )


@router.post("/profile", response_model=ProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_profile(
    resume: UploadFile = File(..., description="Resume in PDF or DOCX format"),
    jd_text: Optional[str] = Form(None, description="Target Job Description text"),
    jd_file: Optional[UploadFile] = File(None, description="Target Job Description file in PDF or DOCX format"),
    mode: str = Form("mixed", description="Interview mode: hr, technical, resume-based, jd-based, or mixed"),
    db: Session = Depends(get_db)
):
    """
    Accepts multipart form-data:
    - resume: PDF or DOCX file
    - jd_text: Optional Job description text (if pasted)
    - jd_file: Optional Job description file (PDF or DOCX)
    - mode: Interview mode

    Processes resume and JD through the NLP pipeline, stores profile in SQLite,
    and returns complete Profile JSON.
    """
    # 1. Resolve and Validate JD Content
    extracted_jd_text = (jd_text or "").strip()
    if jd_file and jd_file.filename:
        jd_filename = jd_file.filename
        jd_ext = os.path.splitext(jd_filename)[1].lower()
        if jd_ext not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
                detail=f"Unsupported JD file type '{jd_ext}'. Please upload a PDF (.pdf) or Word (.docx) file."
            )
        jd_file_bytes = await jd_file.read()
        if len(jd_file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail="JD file size exceeds the 10 MB limit."
            )
        if len(jd_file_bytes) > 0:
            try:
                extracted_jd_file_text = extract_text(jd_file_bytes, filename=jd_filename)
                if extracted_jd_file_text.strip():
                    extracted_jd_text = extracted_jd_file_text.strip()
            except Exception as e:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Error reading JD document: {str(e)}"
                )

    if not extracted_jd_text:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Job Description cannot be empty. Please paste text or upload a JD document (PDF/DOCX)."
        )

    # 2. Validate Interview Mode
    clean_mode = mode.lower().strip()
    if clean_mode not in ALLOWED_MODES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Invalid interview mode '{mode}'. Allowed modes: {', '.join(ALLOWED_MODES)}"
        )

    # 3. Validate File Extension
    filename = resume.filename or "resume.pdf"
    ext = os.path.splitext(filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{ext}'. Please upload a PDF (.pdf) or Word (.docx) file."
        )

    # 4. Read File Bytes with size limit check
    file_bytes = await resume.read()
    if len(file_bytes) == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded resume file is empty."
        )
    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds the 10 MB limit."
        )

    # 5. Save safe copy of file on disk
    profile_id = f"prof_{uuid.uuid4().hex[:10]}"
    safe_filename = f"{profile_id}_{uuid.uuid4().hex[:6]}{ext}"
    saved_file_path = os.path.join(UPLOAD_DIR, safe_filename)

    with open(saved_file_path, "wb") as f:
        f.write(file_bytes)

    # 6. Run NLP Processing Pipeline
    try:
        profile_dict = process_resume_and_jd(
            resume_source=file_bytes,
            jd_text=extracted_jd_text,
            mode=clean_mode,
            filename=filename,
            profile_id=profile_id
        )
    except Exception as e:
        # Clean up stored file if pipeline fails
        if os.path.exists(saved_file_path):
            os.remove(saved_file_path)
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Error parsing resume or JD: {str(e)}"
        )

    # 7. Persist to SQLite Database
    profile_record = ProfileRecord(
        profile_id=profile_id,
        mode=clean_mode,
        jd_text=extracted_jd_text,
        resume_filename=filename,
        resume_path=saved_file_path,
        profile_json=json.dumps(profile_dict),
        corrections_json=None
    )
    db.add(profile_record)
    db.commit()
    db.refresh(profile_record)

    return ProfileResponse(**profile_dict)


@router.get("/profile/{profile_id}", response_model=ProfileResponse)
def get_profile(profile_id: str, db: Session = Depends(get_db)):
    """Retrieves a previously saved profile by profile_id."""
    record = db.query(ProfileRecord).filter(ProfileRecord.profile_id == profile_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile with ID '{profile_id}' not found."
        )
    return ProfileResponse(**record.to_profile_dict())


@router.put("/profile/{profile_id}", response_model=ProfileResponse)
def update_profile(
    profile_id: str,
    update_data: ProfileUpdate,
    db: Session = Depends(get_db)
):
    """
    Saves user corrections to candidate skills, projects, experience, education,
    certifications, or job requirements. Automatically recalculates match scores,
    project links, and interview topics.
    """
    record = db.query(ProfileRecord).filter(ProfileRecord.profile_id == profile_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile with ID '{profile_id}' not found."
        )

    profile_dict = record.to_profile_dict()

    # Apply updates
    if update_data.mode is not None:
        clean_mode = update_data.mode.lower().strip()
        if clean_mode in ALLOWED_MODES:
            profile_dict["mode"] = clean_mode
            record.mode = clean_mode

    if update_data.candidate is not None:
        profile_dict["candidate"] = update_data.candidate.model_dump()

    if update_data.job is not None:
        profile_dict["job"] = update_data.job.model_dump()

    # Recalculate match and topics after user corrections
    updated_profile_dict = recalculate_profile(profile_dict)

    # Save to SQLite
    record.profile_json = json.dumps(updated_profile_dict)
    record.corrections_json = json.dumps({
        "last_updated_mode": update_data.mode,
        "candidate_updated": update_data.candidate is not None,
        "job_updated": update_data.job is not None
    })
    db.commit()
    db.refresh(record)

    return ProfileResponse(**updated_profile_dict)


@router.get("/profile/{profile_id}/topics", response_model=List[InterviewTopic])
def get_profile_topics(profile_id: str, db: Session = Depends(get_db)):
    """Returns ranked interview topics for Person 2's question generation module."""
    record = db.query(ProfileRecord).filter(ProfileRecord.profile_id == profile_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile with ID '{profile_id}' not found."
        )
    profile_dict = record.to_profile_dict()
    topics = profile_dict.get("interview_topics", [])
    return [InterviewTopic(**t) for t in topics]


@router.get("/profiles", response_model=List[ProfileSummaryItem])
def list_profiles(db: Session = Depends(get_db)):
    """Returns summary listing of all saved profiles (without exposing full resume text)."""
    records = db.query(ProfileRecord).order_by(ProfileRecord.created_at.desc()).all()
    summaries = []
    for r in records:
        data = r.to_profile_dict()
        summaries.append(ProfileSummaryItem(
            profile_id=r.profile_id,
            created_at=r.created_at.isoformat(),
            updated_at=r.updated_at.isoformat(),
            mode=r.mode,
            job_title=data.get("job", {}).get("title", "Unknown Role"),
            match_score=data.get("match", {}).get("score", 0.0),
            candidate_skills_count=len(data.get("candidate", {}).get("skills", []))
        ))
    return summaries


@router.delete("/profile/{profile_id}")
def delete_profile(profile_id: str, db: Session = Depends(get_db)):
    """
    Deletes the profile record from database and cleans up any stored resume file on disk.
    """
    record = db.query(ProfileRecord).filter(ProfileRecord.profile_id == profile_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Profile with ID '{profile_id}' not found."
        )

    # Clean up associated file if it exists
    if record.resume_path and os.path.exists(record.resume_path):
        try:
            os.remove(record.resume_path)
        except OSError:
            pass

    db.delete(record)
    db.commit()

    return {"status": "success", "message": f"Profile '{profile_id}' and associated files successfully deleted."}
