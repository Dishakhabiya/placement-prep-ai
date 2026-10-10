import json
import os
from datetime import datetime
from typing import Generator
from sqlalchemy import Column, String, Text, DateTime, create_engine
from sqlalchemy.orm import declarative_base, sessionmaker, Session

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./placement_prep.db")

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

    def to_profile_dict(self) -> dict:
        return json.loads(self.profile_json)


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
