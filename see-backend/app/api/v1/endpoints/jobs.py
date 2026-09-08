from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.job import JobApplication, JobChecklist, JobStatus
from app.schemas.job import (
    JobApplicationCreate,
    JobApplicationRead,
    JobApplicationUpdate,
    JobChecklistCreate,
    JobChecklistRead,
    JobChecklistUpdate,
)


router = APIRouter()


async def _get_job_or_404(job_id: UUID, user_id: UUID, db: AsyncSession) -> JobApplication:
    result = await db.execute(
        select(JobApplication)
        .options(selectinload(JobApplication.checklists))
        .where(JobApplication.id == job_id, JobApplication.user_id == user_id)
    )
    job = result.scalar_one_or_none()
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job application not found")
    return job


async def _get_checklist_or_404(
    job_id: UUID,
    checklist_id: UUID,
    user_id: UUID,
    db: AsyncSession,
) -> JobChecklist:
    await _get_job_or_404(job_id, user_id, db)
    result = await db.execute(
        select(JobChecklist).where(JobChecklist.id == checklist_id, JobChecklist.job_id == job_id)
    )
    checklist = result.scalar_one_or_none()
    if checklist is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Checklist not found")
    return checklist


@router.get("")
async def list_jobs(
    status_filter: JobStatus | None = Query(default=None, alias="status"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[JobApplicationRead]:
    stmt = select(JobApplication).options(selectinload(JobApplication.checklists)).where(JobApplication.user_id == user_id)
    if status_filter is not None:
        stmt = stmt.where(JobApplication.status == status_filter)
    stmt = stmt.order_by(JobApplication.updated_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    return list(result.scalars().unique().all())


@router.get("/{job_id}")
async def get_job(
    job_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> JobApplicationRead:
    return await _get_job_or_404(job_id, user_id, db)


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_job(
    payload: JobApplicationCreate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> JobApplicationRead:
    job = JobApplication(user_id=user_id, **payload.model_dump())
    db.add(job)
    await db.commit()
    return await _get_job_or_404(job.id, user_id, db)


@router.patch("/{job_id}")
async def update_job(
    job_id: UUID,
    payload: JobApplicationUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> JobApplicationRead:
    job = await _get_job_or_404(job_id, user_id, db)
    updates = payload.model_dump(exclude_unset=True, exclude={"checklists"})
    for key, value in updates.items():
        setattr(job, key, value)
    if payload.checklists is not None:
        job.checklists = [JobChecklist(title=item.title, is_completed=item.is_completed) for item in payload.checklists]
    await db.commit()
    return await _get_job_or_404(job.id, user_id, db)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    job = await _get_job_or_404(job_id, user_id, db)
    await db.delete(job)
    await db.commit()


@router.get("/{job_id}/checklists")
async def list_checklists(
    job_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[JobChecklistRead]:
    await _get_job_or_404(job_id, user_id, db)
    result = await db.execute(select(JobChecklist).where(JobChecklist.job_id == job_id).order_by(JobChecklist.id.asc()))
    return list(result.scalars().all())


@router.get("/{job_id}/checklists/{checklist_id}")
async def get_checklist(
    job_id: UUID,
    checklist_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> JobChecklistRead:
    return await _get_checklist_or_404(job_id, checklist_id, user_id, db)


@router.patch("/{job_id}/checklists/{checklist_id}")
async def update_checklist(
    job_id: UUID,
    checklist_id: UUID,
    payload: JobChecklistUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> JobChecklistRead:
    checklist = await _get_checklist_or_404(job_id, checklist_id, user_id, db)
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(checklist, key, value)
    await db.commit()
    await db.refresh(checklist)
    return checklist


@router.delete("/{job_id}/checklists/{checklist_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_checklist(
    job_id: UUID,
    checklist_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    checklist = await _get_checklist_or_404(job_id, checklist_id, user_id, db)
    await db.delete(checklist)
    await db.commit()


@router.post("/{job_id}/checklists", status_code=status.HTTP_201_CREATED)
async def add_checklist(
    job_id: UUID,
    payload: JobChecklistCreate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> JobChecklistRead:
    await _get_job_or_404(job_id, user_id, db)
    checklist = JobChecklist(job_id=job_id, title=payload.title, is_completed=payload.is_completed)
    db.add(checklist)
    await db.commit()
    await db.refresh(checklist)
    return checklist
