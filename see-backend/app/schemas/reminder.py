from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from app.schemas.patch import RequiredPatch

from pydantic import BaseModel, Field


class ReminderPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ReminderCreate(BaseModel):
    title: str = Field(max_length=255)
    due_date: datetime
    priority: ReminderPriority = ReminderPriority.MEDIUM


class ReminderUpdate(RequiredPatch):
    required_fields = set('title due_date priority is_completed'.split())
    title: str | None = Field(default=None, max_length=255)
    due_date: datetime | None = None
    priority: ReminderPriority | None = None
    is_completed: bool | None = None


class ReminderRead(ReminderCreate):
    id: UUID
    user_id: UUID
    is_completed: bool
    created_at: datetime

    model_config = {"from_attributes": True}
