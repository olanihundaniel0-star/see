from __future__ import annotations

from datetime import datetime
from uuid import UUID, uuid4

from sqlalchemy import DateTime, Float, Index, JSON, String, Text, func
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class EmailIngestion(Base):
    __tablename__ = "email_ingestions"
    __table_args__ = (Index("uq_email_ingestions_raw_email_hash", "raw_email_hash", unique=True),)

    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    raw_email_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    source: Mapped[str] = mapped_column(String(50), nullable=False, default="gmail")
    sender: Mapped[str | None] = mapped_column(Text, nullable=True)
    recipient: Mapped[str | None] = mapped_column(Text, nullable=True)
    subject: Mapped[str | None] = mapped_column(Text, nullable=True)
    message_type: Mapped[str] = mapped_column(String(50), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    tags: Mapped[list[str]] = mapped_column(JSON, default=list, nullable=False)
    extraction_result: Mapped[dict] = mapped_column(JSON, nullable=False)
    linked_job_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    linked_reminder_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    linked_note_id: Mapped[UUID | None] = mapped_column(PGUUID(as_uuid=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
