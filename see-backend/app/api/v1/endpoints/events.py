from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import get_current_user_id
from app.core.database import get_db
from app.models.event import ScrapedEvent


router = APIRouter()


@router.get("")
async def list_events(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    is_virtual: bool | None = Query(default=None),
    user_id: UUID = Depends(get_current_user_id),
    db: AsyncSession = Depends(get_db),
) -> dict[str, object]:
    del user_id
    offset = (page - 1) * page_size
    stmt = select(ScrapedEvent)
    if is_virtual is not None:
        stmt = stmt.where(ScrapedEvent.is_virtual.is_(is_virtual))
    stmt = stmt.order_by(ScrapedEvent.start_date.asc()).offset(offset).limit(page_size)
    result = await db.execute(stmt)
    items = result.scalars().all()
    return {"page": page, "page_size": page_size, "items": items}
