from __future__ import annotations

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class EventRead(BaseModel):
    id: UUID
    source: str
    external_id: str
    title: str
    description: str | None
    url: str
    source_url: str | None
    location: str | None
    is_virtual: bool
    categories: list[str] | None = Field(default_factory=list)
    prize_pool: str | None
    start_date: datetime
    end_date: datetime | None
    last_seen_at: datetime
    raw_source_ref: str | None
    scraped_at: datetime

    model_config = {"from_attributes": True}


class EventPageResponse(BaseModel):
    page: int
    page_size: int
    items: list[EventRead] = Field(default_factory=list)
