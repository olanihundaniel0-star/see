from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.note import Note
from app.schemas.note import NoteCreate, NoteRead


router = APIRouter()


@router.get("")
async def list_notes(
    q: str | None = Query(default=None),
    tags: str | None = Query(default=None),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> list[NoteRead]:
    stmt = select(Note).where(Note.user_id == user_id)
    if q:
        stmt = stmt.where(Note.search_vector.match(q, postgresql_regconfig="english"))
    if tags:
        tag_filters = [tag.strip() for tag in tags.split(",") if tag.strip()]
        for tag in tag_filters:
            stmt = stmt.where(Note.tags.ilike(f"%{tag}%"))
    if q:
        stmt = stmt.order_by(func.ts_rank(Note.search_vector, func.websearch_to_tsquery("english", q)).desc())
    else:
        stmt = stmt.order_by(Note.updated_at.desc())
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_note(
    payload: NoteCreate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> NoteRead:
    note = Note(user_id=user_id, **payload.model_dump())
    db.add(note)
    await db.commit()
    await db.refresh(note)
    return note
