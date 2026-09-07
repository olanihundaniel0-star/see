from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.schemas.job import JobApplicationCreate
from app.schemas.note import NoteCreate
from app.schemas.reminder import ReminderCreate


class QuickAddPayload(BaseModel):
    type: Literal["job", "note", "reminder"]
    title: str | None = None
    data: dict = Field(default_factory=dict)


class QuickAddJobPayload(BaseModel):
    type: Literal["job"]
    data: JobApplicationCreate


class QuickAddNotePayload(BaseModel):
    type: Literal["note"]
    data: NoteCreate


class QuickAddReminderPayload(BaseModel):
    type: Literal["reminder"]
    data: ReminderCreate
