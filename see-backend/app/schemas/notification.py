from datetime import datetime
from uuid import UUID
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
from pydantic import BaseModel, Field, field_validator, model_validator

class Preferences(BaseModel):
    enabled: bool = True
    timezone: str = 'UTC'
    advance_minutes: int = Field(default=30, ge=0, le=10080)
    overdue_minutes: int = Field(default=1440, ge=0, le=10080)
    quiet_start: int | None = Field(default=None, ge=0, le=23)
    quiet_end: int | None = Field(default=None, ge=0, le=23)
    reminders: bool = True
    jobs: bool = True
    events: bool = True
    daily: bool = False
    weekly: bool = False
    agenda_hour: int = Field(default=8, ge=0, le=23)
    model_config = {'from_attributes': True}
    @field_validator('timezone')
    @classmethod
    def zone(cls,value):
        try: ZoneInfo(value)
        except (ZoneInfoNotFoundError,ValueError): raise ValueError('Unknown IANA timezone')
        return value
    @model_validator(mode='after')
    def quiet(self):
        if (self.quiet_start is None) != (self.quiet_end is None): raise ValueError('Set both quiet-hour boundaries')
        return self

class DeviceRegistration(BaseModel):
    token: str = Field(pattern=r'^(ExponentPushToken|ExpoPushToken)\[[A-Za-z0-9_-]+\]$', max_length=255)
    timezone: str = Field(default='UTC', max_length=100)

    @field_validator('timezone')
    @classmethod
    def zone(cls,value):
        try: ZoneInfo(value)
        except (ZoneInfoNotFoundError,ValueError): raise ValueError('Unknown IANA timezone')
        return value

class SaveEvent(BaseModel):
    registration_deadline: datetime | None = None

class LocalClaim(BaseModel):
    device_id: UUID

class Snooze(BaseModel):
    minutes: int = Field(default=15, ge=5, le=1440)
