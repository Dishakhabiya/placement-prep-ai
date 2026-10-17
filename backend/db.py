import json
import os
from datetime import datetime
from typing import Generator
from sqlalchemy import Column, String, Text, DateTime, Integer, Boolean, ForeignKey, create_engine, event, Engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session, relationship

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./placement_prep.db")

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    cursor = dbapi_connection.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


class ProfileRecord(Base):
    __tablename__ = "profiles"

    profile_id = Column(String(64), primary_key=True, index=True)
    mode = Column(String(32), default="mixed", nullable=False)
    jd_text = Column(Text, default="", nullable=False)
    resume_filename = Column(String(255), nullable=True)
    resume_path = Column(String(512), nullable=True)
    profile_json = Column(Text, nullable=False)  # Serialized ProfileResponse
    corrections_json = Column(Text, nullable=True)  # History of user corrections
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    chat_sessions = relationship("ChatSession", back_populates="profile", cascade="all, delete-orphan")

    def to_profile_dict(self) -> dict:
        return json.loads(self.profile_json)


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    session_id = Column(String(64), primary_key=True, index=True)
    profile_id = Column(String(64), ForeignKey("profiles.profile_id", ondelete="CASCADE"), nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    is_deleted = Column(Boolean, default=False, server_default="0", nullable=False)

    profile = relationship("ProfileRecord", back_populates="chat_sessions")
    messages = relationship("ChatMessage", back_populates="session", cascade="all, delete-orphan", order_by="ChatMessage.message_id")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    message_id = Column(Integer, primary_key=True, autoincrement=True, index=True)
    session_id = Column(String(64), ForeignKey("chat_sessions.session_id", ondelete="CASCADE"), nullable=False, index=True)
    sender = Column(String(16), nullable=False)  # "user" or "assistant"
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    session = relationship("ChatSession", back_populates="messages")


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
