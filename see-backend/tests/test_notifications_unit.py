from __future__ import annotations

import asyncio
from datetime import datetime, timezone
from uuid import UUID

import pytest
from pydantic import ValidationError
from sqlalchemy.dialects import postgresql

from app.api.v1.endpoints import webhooks
from app.core.config import settings
from app.schemas.notification import DeviceRegistration, Preferences
from app.services.notifications import put_notification, quiet_time


class RecordingSession:
    def __init__(self) -> None:
        self.statement = None

    async def execute(self, statement, params=None):
        self.statement = statement
        return None


def test_quiet_time_moves_alert_to_local_wake_hour():
    prefs = Preferences(timezone="Africa/Lagos", quiet_start=22, quiet_end=7)
    # 23:30 UTC is 00:30 in Lagos (UTC+1), inside quiet hours.
    at = datetime(2026, 10, 21, 23, 30, tzinfo=timezone.utc)
    shifted = quiet_time(at, prefs)
    assert shifted == datetime(2026, 10, 22, 6, 0, tzinfo=timezone.utc)


def test_quiet_time_leaves_daytime_alerts_untouched():
    prefs = Preferences(timezone="Africa/Lagos", quiet_start=22, quiet_end=7)
    at = datetime(2026, 10, 21, 12, 0, tzinfo=timezone.utc)
    assert quiet_time(at, prefs) == at


def test_preferences_reject_unknown_timezone():
    with pytest.raises(ValidationError):
        Preferences(timezone="Not/AZone")


def test_device_registration_requires_expo_token_and_valid_zone():
    assert DeviceRegistration(token="ExponentPushToken[abc_123]", timezone="Africa/Lagos").timezone == "Africa/Lagos"
    with pytest.raises(ValidationError):
        DeviceRegistration(token="not-a-token")
    with pytest.raises(ValidationError):
        DeviceRegistration(token="ExponentPushToken[abc_123]", timezone="Mars/Olympus")


def test_cancelled_schedule_is_reactivated_without_resending_sent_alerts():
    db = RecordingSession()
    asyncio.run(put_notification(
        db,
        UUID("11111111-1111-1111-1111-111111111111"),
        "reminder",
        None,
        datetime(2026, 10, 21, 12, 0, tzinfo=timezone.utc),
        "/reminders/11111111-1111-1111-1111-111111111111",
        "Review reminder",
        "reminder:1:2026-10-21T12:00:00+00:00",
    ))
    sql = str(db.statement.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
    assert "ON CONFLICT (dedupe_key) DO UPDATE" in sql
    assert "WHERE notifications.status = 'cancelled'" in sql


def test_worker_gate_is_bypassed_in_development(monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "development")
    assert asyncio.run(webhooks._worker_available()) is True


def test_worker_gate_rejects_missing_heartbeat_in_production(monkeypatch):
    monkeypatch.setattr(settings, "APP_ENV", "production")

    class Client:
        async def get(self, key):
            return None

        async def aclose(self):
            return None

    monkeypatch.setattr(webhooks.redis_async, "from_url", lambda *args, **kwargs: Client())
    assert asyncio.run(webhooks._worker_available()) is False
