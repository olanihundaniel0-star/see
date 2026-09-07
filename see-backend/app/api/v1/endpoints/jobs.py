from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.job import JobApplication, JobChecklist, JobStatus
from app.schemas.job import JobApplicationCreate, JobApplicationRead, JobApplicationUpdate


router = APIRouter()


@router.get("")
async def list_jobs(
    status_filter: JobStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=100),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[JobApplicationRead]:
    stmt = select(JobApplication).where(JobApplication.user_id == user_id)
    if status_filter is not None:
        stmt = stmt.where(JobApplication.status == status_filter)
    stmt = stmt.order_by(JobApplication.updated_at.desc()).limit(limit)
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: JobApplicationCreate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> JobApplicationRead:
    job = JobApplication(user_id=user_id, **payload.model_dump())
    db.add(job)
    await db.commit()
    await db.refresh(job)
    return job


@router.patch("/{job_id}")
async def update_job(
    job_id: UUID,
    payload: JobApplicationUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> JobApplicationRead:
    result = await db.execute(
        select(JobApplication).where(JobApplication.id == job_id, JobApplication.user_id == user_id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job application not found")
    updates = payload.model_dump(exclude_unset=True, exclude={"checklists"})
    for key, value in updates.items():
        setattr(job, key, value)
    if payload.checklists is not None:
        job.checklists = [JobChecklist(title=item.title, is_completed=item.is_completed) for item in payload.checklists]
    await db.commit()
    await db.refresh(job)
    return job


@router.post("/{job_id}/checklists", status_code=status.HTTP_201_CREATED)
async def add_checklist(
    job_id: UUID,
    title: str,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    result = await db.execute(
        select(JobApplication).where(JobApplication.id == job_id, JobApplication.user_id == user_id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job application not found")
    checklist = JobChecklist(job_id=job_id, title=title)
    db.add(checklist)
    await db.commit()
    await db.refresh(checklist)
    return {"id": str(checklist.id), "title": checklist.title}
