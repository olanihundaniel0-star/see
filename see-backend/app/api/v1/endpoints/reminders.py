from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.reminder import Reminder
from app.schemas.reminder import ReminderCreate, ReminderRead


router = APIRouter()


@router.get("")
async def list_reminders(
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[ReminderRead]:
    result = await db.execute(select(Reminder).where(Reminder.user_id == user_id).order_by(Reminder.due_date.asc()))
    return list(result.scalars().all())


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_reminder(
    payload: ReminderCreate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> ReminderRead:
    reminder = Reminder(user_id=user_id, **payload.model_dump())
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return reminder
