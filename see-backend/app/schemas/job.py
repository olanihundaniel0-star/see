from __future__ import annotations

from datetime import datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.core.security import validate_url


class JobStatus(str, Enum):
    BOOKMARKED = "bookmarked"
    APPLIED = "applied"
    ASSESSMENT = "assessment"
    INTERVIEWING = "interviewing"
    OFFER = "offer"
    REJECTED = "rejected"
    ARCHIVED = "archived"


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
    job_url: str | None = Field(default=None, max_length=2048)
    status: JobStatus = JobStatus.APPLIED
    interview_notes: str | None = Field(default=None, max_length=20000)
    deadline: datetime | None = None

    @field_validator("job_url")
    @classmethod
    def _validate_job_url(cls, value: str | None) -> str | None:
        if value is not None and value != "" and not validate_url(value):
            raise ValueError("Invalid job_url")
        return value


class JobApplicationCreate(JobApplicationBase):
    pass


class JobApplicationUpdate(BaseModel):
    company: str | None = Field(default=None, max_length=150)
    role: str | None = Field(default=None, max_length=150)
    location: str | None = Field(default=None, max_length=150)
    salary_range: str | None = Field(default=None, max_length=100)
    job_url: str | None = Field(default=None, max_length=2048)
    status: JobStatus | None = None
    interview_notes: str | None = Field(default=None, max_length=20000)
    deadline: datetime | None = None
    checklists: list[JobChecklistCreate] | None = None

    @field_validator("job_url")
    @classmethod
    def _validate_job_url(cls, value: str | None) -> str | None:
        if value is not None and value != "" and not validate_url(value):
            raise ValueError("Invalid job_url")
        return value


class JobApplicationRead(JobApplicationBase):
    id: UUID
    user_id: UUID
    applied_at: datetime
    updated_at: datetime
    checklists: list[JobChecklistRead] = Field(default_factory=list)

    model_config = {"from_attributes": True}
