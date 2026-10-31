import uuid
import logging
from datetime import datetime
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db import get_db, ProfileRecord, ChatSession, ChatMessage
from schemas import (
    ChatMessageRequest,
    ChatMessageResponse,
    ChatSessionResponse,
    ChatMessageItem,
    SuggestedAction,
    ProfileResponse,
)
from module2.chat_engine import generate_chat_response

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/chat", tags=["Chatbot"])


@router.post("/message", response_model=ChatMessageResponse)
def post_chat_message(
    request: ChatMessageRequest,
    db: Session = Depends(get_db)
):
    """
    Receives user message, ensures session exists and is associated with profile,
    fetches recent history, calls chat engine, persists messages, and returns assistant reply.
    """
    # 1. Validate profile exists
    profile_record = db.query(ProfileRecord).filter(ProfileRecord.profile_id == request.profile_id).first()
    if not profile_record:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Candidate profile '{request.profile_id}' not found."
        )

    # 2. Validate or create session
    session_id = request.session_id
    if session_id:
        chat_session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
        if not chat_session:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Chat session '{session_id}' not found."
            )
        if chat_session.profile_id != request.profile_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Chat session '{session_id}' does not belong to profile '{request.profile_id}'."
            )
    else:
        session_id = str(uuid.uuid4())
        chat_session = ChatSession(
            session_id=session_id,
            profile_id=request.profile_id,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        db.add(chat_session)
        db.commit()
        db.refresh(chat_session)

    # 3. Retrieve recent history (most recent 20 messages reversed to chronological order)
    recent_db_messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.message_id.desc())
        .limit(20)
        .all()
    )
    chronological_history = list(reversed(recent_db_messages))
    history_dicts = [
        {"role": "user" if m.sender == "user" else "assistant", "content": m.content}
        for m in chronological_history
    ]

    # 4. Save user message to database
    user_msg_record = ChatMessage(
        session_id=session_id,
        sender="user",
        content=request.user_message,
        created_at=datetime.utcnow()
    )
    db.add(user_msg_record)
    db.commit()

    # 5. Generate assistant response
    try:
        profile_dict = profile_record.to_profile_dict()
        profile_obj = ProfileResponse(**profile_dict)
    except Exception as e:
        logger.error(f"Failed to parse profile JSON: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error parsing profile data for chat context."
        )

    engine_response = generate_chat_response(
        profile=profile_obj,
        history=history_dicts,
        user_message=request.user_message,
        current_screen=getattr(request, "current_screen", None),
    )

    # 6. Save assistant message to database
    assistant_msg_record = ChatMessage(
        session_id=session_id,
        sender="assistant",
        content=engine_response["reply"],
        created_at=datetime.utcnow()
    )
    db.add(assistant_msg_record)
    chat_session.updated_at = datetime.utcnow()
    db.commit()

    # 7. Convert suggested actions to Pydantic models
    suggested_action_models = [
        SuggestedAction(**act) for act in engine_response.get("suggested_actions", [])
    ]

    return ChatMessageResponse(
        session_id=session_id,
        reply=engine_response["reply"],
        intent=engine_response["intent"],
        model=engine_response["model"],
        suggested_actions=suggested_action_models,
        created_at=assistant_msg_record.created_at
    )


@router.get("/{session_id}", response_model=ChatSessionResponse)
def get_chat_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """Fetches full chat session metadata and message history."""
    chat_session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    if not chat_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat session '{session_id}' not found."
        )

    messages = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.message_id.asc())
        .all()
    )

    message_items = [
        ChatMessageItem(
            message_id=m.message_id,
            sender=m.sender,
            content=m.content,
            created_at=m.created_at
        )
        for m in messages
    ]

    return ChatSessionResponse(
        session_id=chat_session.session_id,
        profile_id=chat_session.profile_id,
        created_at=chat_session.created_at,
        updated_at=chat_session.updated_at,
        messages=message_items
    )


@router.delete("/{session_id}")
def delete_chat_session(
    session_id: str,
    db: Session = Depends(get_db)
):
    """Deletes chat session and cascades deletion to all session messages."""
    chat_session = db.query(ChatSession).filter(ChatSession.session_id == session_id).first()
    if not chat_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Chat session '{session_id}' not found."
        )

    db.delete(chat_session)
    db.commit()

    return {"status": "deleted", "session_id": session_id}
