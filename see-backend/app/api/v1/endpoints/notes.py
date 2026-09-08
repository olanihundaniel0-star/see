from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.note import Note
from app.schemas.note import NoteCreate, NoteRead, NoteUpdate


router = APIRouter()


async def _get_note_or_404(note_id: UUID, user_id: UUID, db: AsyncSession) -> Note:
    result = await db.execute(select(Note).where(Note.id == note_id, Note.user_id == user_id))
    note = result.scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    return note


@router.get("")
async def list_notes(
    q: str | None = Query(default=None),
    tags: str | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
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
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    return list(result.scalars().all())


@router.get("/{note_id}")
async def get_note(
    note_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> NoteRead:
    return await _get_note_or_404(note_id, user_id, db)


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


@router.patch("/{note_id}")
async def update_note(
    note_id: UUID,
    payload: NoteUpdate,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> NoteRead:
    note = await _get_note_or_404(note_id, user_id, db)
    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(note, key, value)
    await db.commit()
    await db.refresh(note)
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: UUID,
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> None:
    note = await _get_note_or_404(note_id, user_id, db)
    await db.delete(note)
    await db.commit()
