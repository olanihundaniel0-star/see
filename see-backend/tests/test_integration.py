from __future__ import annotations

import hashlib
import hmac
import time
from uuid import UUID

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings


def _mailgun_signature(secret: str, timestamp: str, token: str) -> str:
    return hmac.new(secret.encode("utf-8"), f"{timestamp}{token}".encode("utf-8"), hashlib.sha256).hexdigest()


@pytest.fixture
def client():
    # Deterministic settings regardless of local .env / CI environment.
    settings.APP_ENV = "development"
    settings.INTERNAL_API_TOKEN = None
    settings.SUPABASE_URL = ""
    settings.SUPABASE_JWKS_URL = ""
    # A non-default secret forces the HS256 decode path so an invalid token
    # deterministically maps to 401 (rather than "secret not configured").
    settings.SUPABASE_JWT_SECRET = "test-secret"
    settings.CORS_ORIGINS = "http://localhost:8081,http://localhost:19006,http://127.0.0.1:8081,http://127.0.0.1:19006"
    with TestClient(app) as test_client:
        yield test_client


def test_health_is_liveness_and_sets_security_headers(client):
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json()["status"] == "ok"

    # Security headers from app.core.security.SecurityHeadersMiddleware
    assert response.headers.get("x-content-type-options") == "nosniff"
    assert response.headers.get("x-frame-options") == "DENY"
    assert response.headers.get("x-xss-protection") == "1; mode=block"
    assert response.headers.get("referrer-policy") == "strict-origin-when-cross-origin"
    assert "default-src 'self'" in response.headers.get("content-security-policy", "")


def test_health_ready_reflects_dependencies(client):
    response = client.get("/health/ready")

    payload = response.json()
    assert {"status", "database", "redis"} <= payload.keys()
    assert payload["status"] in {"ok", "degraded"}
    # Degraded (no DB/Redis in CI) must surface as 503 so probes can react.
    assert response.status_code == (200 if payload["status"] == "ok" else 503)


def test_protected_endpoint_rejects_missing_token(client):
    response = client.get("/api/v1/jobs")
    assert response.status_code == 401


def test_protected_endpoint_rejects_invalid_token(client):
    response = client.get("/api/v1/jobs", headers={"Authorization": "Bearer not-a-real-jwt"})
    assert response.status_code == 401


def test_cors_preflight_allows_configured_origin(client):
    response = client.options(
        "/api/v1/events",
        headers={
            "Origin": "http://localhost:8081",
            "Access-Control-Request-Method": "GET",
        },
    )
    assert response.status_code == 200
    assert response.headers.get("access-control-allow-origin") == "http://localhost:8081"


def test_cors_preflight_rejects_disallowed_origin(client):
    response = client.options(
        "/api/v1/events",
        headers={
            "Origin": "https://evil.example.com",
            "Access-Control-Request-Method": "GET",
        },
    )
    # Starlette rejects preflight with 400 and never echoes the disallowed origin.
    assert response.status_code == 400
    assert response.headers.get("access-control-allow-origin") is None


def test_webhook_ingest_rejects_bad_signature(client):
    response = client.post(
        "/api/v1/webhooks/email",
        json={"sender": "boss@example.com", "stripped_text": "hello"},
        headers={"X-Timestamp": "1757200000", "X-Token": "abc", "X-Signature": "deadbeef"},
    )
    assert response.status_code == 401


def test_webhook_ingest_rejects_stale_timestamp(client, monkeypatch):
    secret = "integration-secret"
    stale_timestamp = str(int(time.time()) - settings.EMAIL_WEBHOOK_TOLERANCE_SECONDS - 60)
    token = "abc123"
    signature = _mailgun_signature(secret, stale_timestamp, token)

    monkeypatch.setattr(settings, "MAILGUN_SIGNING_KEY", secret)
    monkeypatch.setattr(settings, "EMAIL_WEBHOOK_SECRET", "")

    response = client.post(
        "/api/v1/webhooks/email",
        json={"sender": "boss@example.com", "stripped_text": "hello"},
        headers={"X-Timestamp": stale_timestamp, "X-Token": token, "X-Signature": signature},
    )
    assert response.status_code == 401


def test_webhook_ingest_verifies_and_queues(client, monkeypatch):
    secret = "integration-secret"
    timestamp = str(int(time.time()))
    token = "abc123"
    signature = _mailgun_signature(secret, timestamp, token)

    monkeypatch.setattr(settings, "MAILGUN_SIGNING_KEY", secret)
    monkeypatch.setattr(settings, "EMAIL_WEBHOOK_SECRET", "")

    queued: list[dict[str, object]] = []

    class FakeCeleryTask:
        @staticmethod
        def delay(payload: dict[str, object]) -> None:
            queued.append(payload)

    from app.api.v1.endpoints import webhooks

    monkeypatch.setattr(webhooks, "extract_email", FakeCeleryTask)

    response = client.post(
        "/api/v1/webhooks/email",
        json={"sender": "alice@example.com", "recipient": "see@example.com", "subject": "Interview", "stripped_text": "hello"},
        headers={"X-Timestamp": timestamp, "X-Token": token, "X-Signature": signature},
    )

    assert response.status_code == 202
    assert response.json() == {"accepted": True, "queued": True}
    assert queued and queued[0]["sender"] == "alice@example.com"


def test_internal_gmail_poll_rejects_bad_token(client, monkeypatch):
    monkeypatch.setattr(settings, "INTERNAL_API_TOKEN", None)
    response = client.post("/internal/poll-gmail", headers={"X-Internal-Token": "wrong"})
    assert response.status_code == 401


def test_internal_gmail_poll_runs_with_valid_token(client, monkeypatch):
    from pydantic import SecretStr

    monkeypatch.setattr(settings, "INTERNAL_API_TOKEN", SecretStr("scheduler-secret"))

    from app.api import internal

    async def fake_poll():
        return {"found": 2, "processed": 1, "duplicates": 1, "failed": 0}

    monkeypatch.setattr(internal, "poll_gmail_inbox_impl", fake_poll)

    response = client.post("/internal/poll-gmail", headers={"X-Internal-Token": "scheduler-secret"})

    assert response.status_code == 200
    payload = response.json()
    assert payload["status"] == "ok"
    assert payload["result"] == {"found": 2, "processed": 1, "duplicates": 1, "failed": 0}


def test_quick_add_invalid_data_returns_422_not_500(client):
    from app.core.auth import get_current_user_id
    from app.core.database import get_db

    async def _user():
        return UUID("11111111-1111-1111-1111-111111111111")

    async def _db():
        yield None

    app.dependency_overrides[get_current_user_id] = _user
    app.dependency_overrides[get_db] = _db
    try:
        response = client.post("/api/v1/quick-add", json={"type": "job", "data": {}})
    finally:
        app.dependency_overrides.pop(get_current_user_id, None)
        app.dependency_overrides.pop(get_db, None)

    assert response.status_code == 422