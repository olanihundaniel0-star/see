from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    BOOKMARKED = "bookmarked"
    APPLIED = "applied"
    INTERVIEWING = "interviewing"
    OFFER = "offer"
    REJECTED = "rejected"


class JobChecklistRead(BaseModel):
    id: UUID
    title: str
    is_completed: bool

    model_config = {"from_attributes": True}


class JobChecklistCreate(BaseModel):
    title: str = Field(max_length=255)
    is_completed: bool = False


class JobChecklistUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    is_completed: bool | None = None


class JobApplicationBase(BaseModel):
    company: str = Field(max_length=150)
    role: str = Field(max_length=150)
    location: str | None = Field(default=None, max_length=150)
    salary_range: str | None = Field(default=None, max_length=100)
    job_url: str | None = None
    status: JobStatus = JobStatus.APPLIED
    interview_notes: str | None = None
    deadline: datetime | None = None


class JobApplicationCreate(JobApplicationBase):
    pass


class JobApplicationUpdate(BaseModel):
    company: str | None = Field(default=None, max_length=150)
    role: str | None = Field(default=None, max_length=150)
    location: str | None = Field(default=None, max_length=150)
    salary_range: str | None = Field(default=None, max_length=100)
    job_url: str | None = None
    status: JobStatus | None = None
    interview_notes: str | None = None
    deadline: datetime | None = None
    checklists: list[JobChecklistCreate] | None = None


class JobApplicationRead(JobApplicationBase):
    id: UUID
    user_id: UUID
    applied_at: datetime
    updated_at: datetime
    checklists: list[JobChecklistRead] = Field(default_factory=list)

    model_config = {"from_attributes": True}
