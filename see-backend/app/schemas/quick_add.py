from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, field_validator

from app.core.security import sanitize_input
from app.schemas.job import JobApplicationCreate
from app.schemas.note import NoteCreate
from app.schemas.reminder import ReminderCreate


class QuickAddPayload(BaseModel):
    type: Literal["job", "note", "reminder"]
    title: str | None = Field(default=None, max_length=500)
    data: dict = Field(default_factory=dict)

    @field_validator("data")
    @classmethod
    def _limit_data(cls, value: dict) -> dict:
        if len(value) > 50:
            raise ValueError("data must have at most 50 keys")
        truncated: dict = {}
        for key, item in value.items():
            if isinstance(item, str) and len(item) > 5000:
                # Truncate oversized free-form values instead of rejecting.
                truncated[key] = sanitize_input(item, max_length=5000)
            else:
                truncated[key] = item
        return truncated


class QuickAddJobPayload(BaseModel):
    type: Literal["job"]
    data: JobApplicationCreate


class QuickAddNotePayload(BaseModel):
    type: Literal["note"]
    data: NoteCreate


class QuickAddReminderPayload(BaseModel):
    type: Literal["reminder"]
    data: ReminderCreate
