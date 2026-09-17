from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.job import JobApplication
from app.models.note import Note
from app.models.reminder import Reminder
from app.schemas.job import JobApplicationCreate
from app.schemas.note import NoteCreate
from app.schemas.quick_add import QuickAddPayload
from app.schemas.reminder import ReminderCreate


router = APIRouter()


def _validated_data(model: type[BaseModel], data: dict) -> dict:
    """Validate the free-form payload, surfacing failures as a 422 not a 500."""
    try:
        return model.model_validate(data).model_dump()
    except ValidationError as exc:
        raise RequestValidationError(exc.errors()) from exc


@router.post("")
async def quick_add(
    payload: QuickAddPayload,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, str]:
    if payload.type == "job":
        data = payload.data.copy()
        if payload.title and "company" not in data:
            data["company"] = payload.title
        obj = JobApplication(user_id=user_id, **_validated_data(JobApplicationCreate, data))
    elif payload.type == "note":
        data = payload.data.copy()
        if payload.title and "title" not in data:
            data["title"] = payload.title
        obj = Note(user_id=user_id, **_validated_data(NoteCreate, data))
    elif payload.type == "reminder":
        data = payload.data.copy()
        if payload.title and "title" not in data:
            data["title"] = payload.title
        obj = Reminder(user_id=user_id, **_validated_data(ReminderCreate, data))
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported quick-add type")

    db.add(obj)
    await db.commit()
    await db.refresh(obj)
    return {"id": str(obj.id), "type": payload.type}
