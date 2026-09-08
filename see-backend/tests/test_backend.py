from __future__ import annotations

import asyncio
import hashlib
import hmac
from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import UUID

import jwt
from fastapi import HTTPException

from fastapi.security import HTTPAuthorizationCredentials

from app.api.v1.endpoints import events, jobs, notes, reminders, webhooks
from app.core.auth import get_current_user_id
from app.core.config import settings
from app.models.event import ScrapedEvent
from app.models.job import JobApplication, JobStatus
from app.models.reminder import Reminder, ReminderPriority
from app.schemas.event import EventRead
from app.schemas.job import JobApplicationCreate, JobApplicationUpdate, JobChecklistCreate, JobChecklistUpdate
from app.schemas.note import NoteCreate, NoteUpdate
from app.schemas.reminder import ReminderCreate, ReminderPriority as ReminderPrioritySchema, ReminderUpdate
from app.workers import ingest as worker_ingest
from app.workers import email as worker_email
from app.workers import tasks as worker_tasks


USER_ID = UUID("11111111-1111-1111-1111-111111111111")


def run(coro):
    return asyncio.run(coro)


def mailgun_signature(secret: str, timestamp: str, token: str) -> str:
    return hmac.new(secret.encode("utf-8"), f"{timestamp}{token}".encode("utf-8"), hashlib.sha256).hexdigest()


class FakeRequest:
    def __init__(self, payload: dict[str, object]):
        self._payload = payload
        self.headers = {"content-type": "application/json"}

    async def body(self) -> bytes:
        import json

        return json.dumps(self._payload).encode("utf-8")


def test_auth_me_returns_user_id(monkeypatch):
    monkeypatch.setattr("app.core.auth.jwt.decode", lambda token, secret, algorithms, **kwargs: {"sub": str(USER_ID)})

    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="test-token")
    assert get_current_user_id(credentials) == USER_ID


def test_auth_me_rejects_invalid_token(monkeypatch):
    monkeypatch.setattr(
        "app.core.auth.jwt.decode",
        lambda token, secret, algorithms, **kwargs: (_ for _ in ()).throw(jwt.PyJWTError("bad token")),
    )

    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="bad-token")
    try:
        get_current_user_id(credentials)
        raise AssertionError("expected authentication failure")
    except HTTPException as exc:
        assert getattr(exc, "status_code", None) == 401


def test_webhook_verification_rejects_missing_secret():
    assert not webhooks._verify_signature("1757200000", "abc", "def")


def test_webhook_verifies_and_queues_email(monkeypatch, fake_db):
    secret = "supersecret"
    timestamp = str(int(datetime.now(timezone.utc).timestamp()))
    token = "abc123"
    signature = mailgun_signature(secret, timestamp, token)

    monkeypatch.setattr(settings, "MAILGUN_SIGNING_KEY", secret)
    monkeypatch.setattr(settings, "EMAIL_WEBHOOK_SECRET", "")
    monkeypatch.setattr(
        webhooks,
        "build_email_extraction_payload",
        lambda payload: {
            "sender": payload.get("sender"),
            "recipient": payload.get("recipient"),
            "subject": payload.get("subject"),
            "body_plain": payload.get("body_plain"),
            "stripped_text": payload.get("stripped_text"),
            "raw_email": "<raw_email>hello</raw_email>",
            "raw_email_hash": hashlib.sha256(b"hello").hexdigest(),
        },
    )

    queued: list[dict[str, object]] = []
    monkeypatch.setattr(worker_tasks.extract_email, "delay", lambda payload: queued.append(payload))

    request = FakeRequest(
        {
            "sender": "alice@example.com",
            "recipient": "see@example.com",
            "subject": "Interview",
            "stripped_text": "hello",
            "timestamp": timestamp,
            "token": token,
            "signature": signature,
        }
    )

    response = run(
        webhooks.ingest_email(
            request,
            x_timestamp=timestamp,
            x_token=token,
            x_signature=signature,
        )
    )

    assert response.accepted is True
    assert response.queued is True
    assert queued and queued[0]["sender"] == "alice@example.com"


def test_extract_email_persists_ingestion_record(fake_db, monkeypatch):
    monkeypatch.setattr(settings, "DEFAULT_USER_ID", "")

    class FakeAsyncSessionFactory:
        def __init__(self, session):
            self.session = session

        async def __aenter__(self):
            return self.session

        async def __aexit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr(worker_email, "AsyncSessionLocal", lambda: FakeAsyncSessionFactory(fake_db))

    result = worker_tasks.extract_email(
        {
            "sender": "Acme Recruiting <jobs@acme.example>",
            "recipient": "see@example.com",
            "subject": "Interview for Backend Engineer",
            "body_plain": "We would like to schedule an interview for 2026-09-10T12:00:00Z.",
            "stripped_text": "We would like to schedule an interview for 2026-09-10T12:00:00Z.",
            "raw_email_hash": "",
        }
    )

    assert result["duplicate"] is False
    assert result["message_type"] == "interview"
    assert fake_db.store


def test_gemini_extractor_uses_structured_output(monkeypatch):
    monkeypatch.setattr(settings, "GEMINI_API_KEY", "test-key")

    class FakeResponse:
        text = (
            '{"message_type":"interview","summary":"Interview scheduled","confidence":0.91,'
            '"entities":{"company":"Acme","role":"Backend Engineer","sender":"hr@acme.example",'
            '"recipient":"see@example.com","location":null,"deadline":"2026-09-10T12:00:00+00:00",'
            '"event_title":null,"event_url":null},'
            '"recommended_actions":[{"action":"create_job","confidence":0.92,"payload":{"company":"Acme","role":"Backend Engineer","status":"interviewing"}}],'
            '"tags":["gmail","interview"],"raw_email_hash":"ignored"}'
        )

    class FakeModels:
        def generate_content(self, **kwargs):
            return FakeResponse()

    class FakeClient:
        models = FakeModels()

    monkeypatch.setattr(worker_email, "_gemini_client", lambda: FakeClient())

    normalized = worker_email.NormalizedEmailIngestPayload(
        sender="Acme HR <hr@acme.example>",
        recipient="see@example.com",
        subject="Interview scheduled",
        body_plain="Interview scheduled for 2026-09-10T12:00:00Z",
        stripped_text="Interview scheduled for 2026-09-10T12:00:00Z",
        raw_email="<raw_email>Interview scheduled for 2026-09-10T12:00:00Z</raw_email>",
        raw_email_hash="abc123",
    )

    extraction = worker_email._generate_email_extraction_with_gemini(normalized)

    assert extraction is not None
    assert extraction.message_type.value == "interview"
    assert extraction.entities.company == "Acme"
    assert extraction.raw_email_hash == "abc123"


def test_luma_page_scraper_discovers_event_pages(monkeypatch):
    page_url = "https://luma.com/ai"
    event_url = "https://luma.com/re0oh7md"
    category_html = """
    <html>
      <head><title>AI · Luma</title></head>
      <body>
        <h1>AI</h1>
        <section>
          <a href="/re0oh7md">
            <h3>Claude Code + Firecrawl: Web Scraping Without the Headaches</h3>
          </a>
        </section>
      </body>
    </html>
    """
    event_html = """
    <html>
      <head>
        <title>Claude Code + Firecrawl · Luma</title>
        <meta property="og:title" content="Claude Code + Firecrawl: Web Scraping Without the Headaches">
        <meta property="og:description" content="A workshop on scraping">
        <meta property="og:url" content="https://luma.com/re0oh7md">
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Event",
          "name": "Claude Code + Firecrawl: Web Scraping Without the Headaches",
          "description": "A workshop on scraping",
          "url": "https://luma.com/re0oh7md",
          "startDate": "2026-09-10T12:00:00Z",
          "endDate": "2026-09-10T14:00:00Z",
          "location": {
            "@type": "VirtualLocation",
            "name": "Zoom"
          }
        }
        </script>
      </head>
      <body>
        <h1>Claude Code + Firecrawl: Web Scraping Without the Headaches</h1>
      </body>
    </html>
    """

    monkeypatch.setattr(settings, "LUMA_PAGE_URLS", page_url)

    def fake_fetch(url: str):
        if url == page_url:
            return "text/html", category_html
        if url == event_url:
            return "text/html", event_html
        raise AssertionError(f"unexpected url: {url}")

    captured: list[dict[str, object]] = []

    async def fake_upsert(records):
        captured.extend(records)
        return len(records)

    monkeypatch.setattr(worker_ingest, "_fetch_url", fake_fetch)
    monkeypatch.setattr(worker_ingest, "_upsert_events", fake_upsert)

    result = run(worker_ingest.scrape_luma_events())

    assert result == 1
    assert captured
    assert captured[0]["title"] == "Claude Code + Firecrawl: Web Scraping Without the Headaches"
    assert captured[0]["url"] == event_url
    assert captured[0]["source_url"] == event_url


def test_job_crud_and_checklists(fake_db):
    job = run(
        jobs.create_job(
            JobApplicationCreate(
                company="Moniepoint",
                role="Backend Engineer",
                location="Lagos",
                salary_range="NGN 15M - 20M",
                job_url="https://example.com/jobs/1",
                status="applied",
                deadline=datetime(2026, 9, 10, 12, 0, tzinfo=timezone.utc),
            ),
            user_id=USER_ID,
            db=fake_db,
        )
    )

    assert job.company == "Moniepoint"

    listed = run(jobs.list_jobs(status_filter=None, page=1, page_size=20, user_id=USER_ID, db=fake_db))
    assert len(listed) == 1

    fetched = run(jobs.get_job(job.id, user_id=USER_ID, db=fake_db))
    assert fetched.id == job.id

    updated = run(
        jobs.update_job(
            job.id,
            JobApplicationUpdate(status="interviewing", interview_notes="Screening call booked"),
            user_id=USER_ID,
            db=fake_db,
        )
    )
    assert updated.status.value == "interviewing"

    first_checklist = run(
        jobs.add_checklist(
            job.id,
            JobChecklistCreate(title="Prep system design", is_completed=False),
            user_id=USER_ID,
            db=fake_db,
        )
    )
    second_checklist = run(
        jobs.add_checklist(
            job.id,
            JobChecklistCreate(title="Draft follow-up", is_completed=False),
            user_id=USER_ID,
            db=fake_db,
        )
    )

    checklists = run(jobs.list_checklists(job.id, user_id=USER_ID, db=fake_db))
    assert len(checklists) == 2

    checklist = run(jobs.get_checklist(job.id, first_checklist.id, user_id=USER_ID, db=fake_db))
    assert checklist.title == "Prep system design"

    checklist = run(
        jobs.update_checklist(
            job.id,
            first_checklist.id,
            JobChecklistUpdate(is_completed=True),
            user_id=USER_ID,
            db=fake_db,
        )
    )
    assert checklist.is_completed is True

    run(jobs.delete_checklist(job.id, second_checklist.id, user_id=USER_ID, db=fake_db))
    remaining = run(jobs.list_checklists(job.id, user_id=USER_ID, db=fake_db))
    assert len(remaining) == 1

    run(jobs.delete_job(job.id, user_id=USER_ID, db=fake_db))
    assert run(jobs.list_jobs(status_filter=None, page=1, page_size=20, user_id=USER_ID, db=fake_db)) == []


def test_notes_crud_and_pagination(fake_db):
    first = run(
        notes.create_note(
            NoteCreate(title="API notes", content="Remember the schema", tags="fastapi,postgres"),
            user_id=USER_ID,
            db=fake_db,
        )
    )
    second = run(
        notes.create_note(
            NoteCreate(title="Search notes", content="Pagination matters", tags="query"),
            user_id=USER_ID,
            db=fake_db,
        )
    )

    page_one = run(notes.list_notes(q=None, tags=None, page=1, page_size=1, user_id=USER_ID, db=fake_db))
    page_two = run(notes.list_notes(q=None, tags=None, page=2, page_size=1, user_id=USER_ID, db=fake_db))
    assert len(page_one) == 1
    assert len(page_two) == 1
    assert {page_one[0].id, page_two[0].id} == {first.id, second.id}

    fetched = run(notes.get_note(first.id, user_id=USER_ID, db=fake_db))
    assert fetched.title == "API notes"

    updated = run(notes.update_note(first.id, NoteUpdate(content="Remember the schema and tests"), user_id=USER_ID, db=fake_db))
    assert updated.content == "Remember the schema and tests"

    run(notes.delete_note(second.id, user_id=USER_ID, db=fake_db))
    remaining = run(notes.list_notes(q=None, tags=None, page=1, page_size=20, user_id=USER_ID, db=fake_db))
    assert len(remaining) == 1


def test_reminders_crud_and_pagination(fake_db):
    first = run(
        reminders.create_reminder(
            ReminderCreate(title="Follow up", due_date=datetime(2026, 9, 8, 10, 0, tzinfo=timezone.utc), priority=ReminderPrioritySchema.HIGH),
            user_id=USER_ID,
            db=fake_db,
        )
    )
    second = run(
        reminders.create_reminder(
            ReminderCreate(title="Second", due_date=datetime(2026, 9, 9, 10, 0, tzinfo=timezone.utc), priority=ReminderPrioritySchema.MEDIUM),
            user_id=USER_ID,
            db=fake_db,
        )
    )

    page_one = run(reminders.list_reminders(page=1, page_size=1, user_id=USER_ID, db=fake_db))
    page_two = run(reminders.list_reminders(page=2, page_size=1, user_id=USER_ID, db=fake_db))
    assert len(page_one) == 1
    assert len(page_two) == 1
    assert {page_one[0].id, page_two[0].id} == {first.id, second.id}

    fetched = run(reminders.get_reminder(first.id, user_id=USER_ID, db=fake_db))
    assert fetched.title == "Follow up"

    updated = run(reminders.update_reminder(first.id, ReminderUpdate(is_completed=True), user_id=USER_ID, db=fake_db))
    assert updated.is_completed is True

    run(reminders.delete_reminder(second.id, user_id=USER_ID, db=fake_db))
    remaining = run(reminders.list_reminders(page=1, page_size=20, user_id=USER_ID, db=fake_db))
    assert len(remaining) == 1


def test_dashboard_today_returns_items_and_headers(client, fake_db):
    reminder = Reminder(
        user_id=USER_ID,
        title="Follow up on interview",
        due_date=datetime(2026, 9, 8, 9, 0, tzinfo=timezone.utc),
        priority=ReminderPriority.HIGH,
        is_completed=False,
    )
    job = JobApplication(
        user_id=USER_ID,
        company="Moniepoint",
        role="Backend Engineer",
        location="Lagos",
        salary_range=None,
        job_url="https://example.com/jobs/1",
        status=JobStatus.INTERVIEWING,
        interview_notes=None,
        deadline=datetime(2026, 9, 7, 18, 0, tzinfo=timezone.utc),
    )
    fake_db.add(reminder)
    fake_db.add(job)

    response = client.get("/api/v1/dashboard/today")

    assert response.status_code == 200
    assert response.headers["x-api-version"] == "1.0.0"
    assert response.headers["x-frame-options"] == "DENY"
    assert response.headers["strict-transport-security"] == "max-age=31536000; includeSubDomains"

    payload = response.json()
    assert payload["reminder_count"] == 1
    assert payload["job_count"] == 1
    assert [item["kind"] for item in payload["items"]] == ["job", "reminder"]
    assert payload["items"][0]["title"] == "Moniepoint • Backend Engineer"
    assert payload["items"][1]["title"] == "Follow up on interview"


def test_events_endpoint_returns_cached_shape_and_headers(client, fake_db):
    event = ScrapedEvent(
        source="luma",
        external_id="re0oh7md",
        title="Claude Code + Firecrawl",
        description="A workshop on scraping",
        url="https://luma.com/re0oh7md",
        source_url="https://luma.com/ai",
        location="Zoom",
        is_virtual=True,
        categories=["ai", "scraping"],
        prize_pool=None,
        start_date=datetime(2026, 9, 10, 12, 0, tzinfo=timezone.utc),
        end_date=datetime(2026, 9, 10, 14, 0, tzinfo=timezone.utc),
        last_seen_at=datetime(2026, 9, 7, 12, 0, tzinfo=timezone.utc),
        raw_source_ref=None,
        scraped_at=datetime(2026, 9, 7, 12, 0, tzinfo=timezone.utc),
    )
    fake_db.add(event)

    response = client.get("/api/v1/events")

    assert response.status_code == 200
    assert response.headers["x-request-id"]
    assert response.headers["x-api-version"] == "1.0.0"
    payload = response.json()
    assert payload["page"] == 1
    assert payload["page_size"] == 20
    assert len(payload["items"]) == 1
    assert payload["items"][0]["title"] == "Claude Code + Firecrawl"


def test_event_read_normalizes_null_categories():
    payload = SimpleNamespace(
        id=UUID("22222222-2222-2222-2222-222222222222"),
        source="luma",
        external_id="re0oh7md",
        title="Claude Code + Firecrawl",
        description="A workshop on scraping",
        url="https://luma.com/re0oh7md",
        source_url="https://luma.com/ai",
        location="Zoom",
        is_virtual=True,
        categories=None,
        prize_pool=None,
        start_date=datetime(2026, 9, 10, 12, 0, tzinfo=timezone.utc),
        end_date=datetime(2026, 9, 10, 14, 0, tzinfo=timezone.utc),
        last_seen_at=datetime(2026, 9, 7, 12, 0, tzinfo=timezone.utc),
        raw_source_ref=None,
        scraped_at=datetime(2026, 9, 7, 12, 0, tzinfo=timezone.utc),
    )

    event = EventRead.model_validate(payload)
    assert event.categories == []


def test_events_crud_and_pagination(fake_db):
    first = ScrapedEvent(
        source="luma",
        external_id="first",
        title="First Event",
        description=None,
        url="https://luma.com/first",
        source_url="https://luma.com/first",
        location="Zoom",
        is_virtual=True,
        categories=["ai", "scraping"],
        prize_pool=None,
        start_date=datetime(2026, 9, 10, 12, 0, tzinfo=timezone.utc),
        end_date=datetime(2026, 9, 10, 13, 0, tzinfo=timezone.utc),
        last_seen_at=datetime(2026, 9, 7, 12, 0, tzinfo=timezone.utc),
        raw_source_ref="first",
        scraped_at=datetime(2026, 9, 7, 12, 0, tzinfo=timezone.utc),
    )
    second = ScrapedEvent(
        source="devpost",
        external_id="second",
        title="Second Event",
        description=None,
        url="https://devpost.com/second",
        source_url="https://devpost.com/second",
        location=None,
        is_virtual=False,
        categories=["hackathon"],
        prize_pool=None,
        start_date=datetime(2026, 9, 11, 12, 0, tzinfo=timezone.utc),
        end_date=None,
        last_seen_at=datetime(2026, 9, 7, 12, 0, tzinfo=timezone.utc),
        raw_source_ref="second",
        scraped_at=datetime(2026, 9, 7, 12, 0, tzinfo=timezone.utc),
    )
    fake_db.add(first)
    fake_db.add(second)

    page_one = run(events.list_events(page=1, page_size=1, is_virtual=None, user_id=USER_ID, db=fake_db))
    page_two = run(events.list_events(page=2, page_size=1, is_virtual=None, user_id=USER_ID, db=fake_db))

    assert page_one["page"] == 1
    assert page_one["page_size"] == 1
    assert len(page_one["items"]) == 1
    assert len(page_two["items"]) == 1
    assert {page_one["items"][0].id, page_two["items"][0].id} == {first.id, second.id}

    first_payload = EventRead.model_validate(page_one["items"][0])
    assert first_payload.categories == ["ai", "scraping"]


def test_cors_preflight_allows_configured_origin(client):
    response = client.request(
        "OPTIONS",
        "/api/v1/events",
        headers={
            "Origin": "http://localhost:8081",
            "Access-Control-Request-Method": "GET",
        },
    )

    assert response.status_code in {200, 204}
    assert response.headers["access-control-allow-origin"] == "http://localhost:8081"
