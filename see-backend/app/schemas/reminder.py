from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class ReminderPriority(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class ReminderCreate(BaseModel):
    title: str = Field(max_length=255)
    due_date: datetime
    priority: ReminderPriority = ReminderPriority.MEDIUM


class ReminderRead(ReminderCreate):
    id: UUID
    user_id: UUID
    is_completed: bool
    created_at: datetime

    model_config = {"from_attributes": True}
