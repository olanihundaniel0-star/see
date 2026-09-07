from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.job import JobApplication, JobStatus
from app.models.reminder import Reminder


router = APIRouter()


class DashboardItem(BaseModel):
    kind: Literal["reminder", "job"]
    id: UUID
    title: str
    due_at: datetime
    subtitle: str | None = None
    status: str | None = None
    action: str | None = None
    priority: str | None = None

    model_config = {"from_attributes": True}


class DashboardTodayResponse(BaseModel):
    generated_at: datetime
    window_hours: int = 48
    reminder_count: int
    job_count: int
    items: list[DashboardItem] = Field(default_factory=list)


@router.get("/today", response_model=DashboardTodayResponse)
async def today_dashboard(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> DashboardTodayResponse:
    now = datetime.now(timezone.utc)
    horizon = now + timedelta(hours=48)

    reminders_stmt = (
        select(Reminder)
        .where(
            Reminder.user_id == user_id,
            Reminder.is_completed.is_(False),
            Reminder.due_date >= now,
            Reminder.due_date <= horizon,
        )
        .order_by(Reminder.due_date.asc())
    )
    jobs_stmt = (
        select(JobApplication)
        .where(
            JobApplication.user_id == user_id,
            JobApplication.status != JobStatus.REJECTED,
            JobApplication.deadline.is_not(None),
            JobApplication.deadline >= now,
            JobApplication.deadline <= horizon,
        )
        .order_by(JobApplication.deadline.asc())
    )

    reminders = (await db.execute(reminders_stmt)).scalars().all()
    jobs = (await db.execute(jobs_stmt)).scalars().all()

    items: list[DashboardItem] = [
        DashboardItem(
            kind="reminder",
            id=reminder.id,
            title=reminder.title,
            due_at=reminder.due_date,
            subtitle=f"PRIORITY: {reminder.priority.value.upper()}",
            priority=reminder.priority.value,
            action="[OPEN REMINDER]",
        )
        for reminder in reminders
    ]

    items.extend(
        DashboardItem(
            kind="job",
            id=job.id,
            title=f"{job.company} • {job.role}",
            due_at=job.deadline or job.applied_at,
            subtitle=f"STATUS: {job.status.value.upper()}",
            status=job.status.value,
            action="[OPEN DOSSIER]",
        )
        for job in jobs
    )

    items.sort(key=lambda item: item.due_at)

    return DashboardTodayResponse(
        generated_at=now,
        reminder_count=len(reminders),
        job_count=len(jobs),
        items=items,
    )
