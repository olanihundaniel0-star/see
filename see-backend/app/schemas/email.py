from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, field_validator


class EmailMessageType(str, Enum):
    JOB_APPLICATION = "job_application"
    INTERVIEW = "interview"
    OFFER = "offer"
    REMINDER = "reminder"
    NOTE = "note"
    EVENT = "event"
    UNKNOWN = "unknown"


class EmailActionType(str, Enum):
    CREATE_JOB = "create_job"
    UPDATE_JOB = "update_job"
    CREATE_REMINDER = "create_reminder"
    CREATE_NOTE = "create_note"
    IGNORE = "ignore"


class EmailEntities(BaseModel):
    company: str | None = None
    role: str | None = None
    sender: str | None = None
    recipient: str | None = None
    location: str | None = None
    deadline: str | None = None
    event_title: str | None = None
    event_url: str | None = None

    @field_validator("deadline", mode="before")
    @classmethod
    def _normalize_deadline(cls, value: object) -> str | None:
        if value is None:
            return None
        text = str(value).strip()
        if not text:
            return None
        candidate = text.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(candidate)
        except ValueError:
            # LLM output is free-form; a non-ISO deadline is not actionable.
            return None
        if parsed.tzinfo is None:
            parsed = parsed.replace(tzinfo=timezone.utc)
        return parsed.isoformat()


class EmailActionRecommendation(BaseModel):
    action: EmailActionType
    confidence: float = Field(ge=0.0, le=1.0)
    payload: dict[str, Any] = Field(default_factory=dict)


class EmailExtractionResult(BaseModel):
    message_type: EmailMessageType
    summary: str
    confidence: float = Field(ge=0.0, le=1.0)
    entities: EmailEntities = Field(default_factory=EmailEntities)
    recommended_actions: list[EmailActionRecommendation] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)
    raw_email_hash: str


class NormalizedEmailIngestPayload(BaseModel):
    sender: str | None = None
    recipient: str | None = None
    subject: str | None = None
    body_plain: str | None = None
    stripped_text: str
    raw_email: str
    raw_email_hash: str


class EmailIngestionRead(BaseModel):
    id: str
    raw_email_hash: str
    source: str
    sender: str | None
    recipient: str | None
    subject: str | None
    message_type: EmailMessageType
    summary: str
    confidence: float
    tags: list[str]
    extraction_result: dict[str, Any]
    linked_job_id: str | None = None
    linked_reminder_id: str | None = None
    linked_note_id: str | None = None
    created_at: str
