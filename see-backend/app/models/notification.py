from datetime import datetime
from uuid import UUID, uuid4
from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from app.core.database import Base


class NotificationPreference(Base):
    __tablename__ = 'notification_preferences'
    user_id: Mapped[UUID] = mapped_column(primary_key=True)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    timezone: Mapped[str] = mapped_column(String(100), default='UTC', nullable=False)
    advance_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    overdue_minutes: Mapped[int] = mapped_column(Integer, default=1440, nullable=False)
    quiet_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    quiet_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reminders: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    jobs: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    events: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    daily: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    weekly: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    agenda_hour: Mapped[int] = mapped_column(Integer, default=8, nullable=False)


class PushDevice(Base):
    __tablename__ = 'push_devices'
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(index=True, nullable=False)
    token: Mapped[str] = mapped_column(Text, unique=True, nullable=False)
    active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)


class SavedEvent(Base):
    __tablename__ = 'saved_events'
    __table_args__ = (UniqueConstraint('user_id', 'event_id'),)
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(index=True, nullable=False)
    event_id: Mapped[UUID] = mapped_column(ForeignKey('scraped_events.id', ondelete='CASCADE'), nullable=False)
    registration_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Notification(Base):
    __tablename__ = 'notifications'
    __table_args__ = (Index('ix_notifications_due', 'status', 'send_at'),)
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    user_id: Mapped[UUID] = mapped_column(index=True, nullable=False)
    dedupe_key: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    source: Mapped[str] = mapped_column(String(40), nullable=False)
    source_id: Mapped[UUID | None] = mapped_column(nullable=True)
    send_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default='pending', nullable=False)
    route: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str] = mapped_column(String(255), nullable=False)


class NotificationDelivery(Base):
    __tablename__ = 'notification_deliveries'
    __table_args__ = (UniqueConstraint('notification_id', 'device_id'),)
    id: Mapped[UUID] = mapped_column(primary_key=True, default=uuid4)
    notification_id: Mapped[UUID] = mapped_column(ForeignKey('notifications.id', ondelete='CASCADE'), nullable=False)
    device_id: Mapped[UUID] = mapped_column(ForeignKey('push_devices.id', ondelete='CASCADE'), nullable=False)
    status: Mapped[str] = mapped_column(String(20), default='pending', nullable=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    receipt_id: Mapped[str | None] = mapped_column(Text, nullable=True)
    next_attempt_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    error: Mapped[str | None] = mapped_column(String(100), nullable=True)
