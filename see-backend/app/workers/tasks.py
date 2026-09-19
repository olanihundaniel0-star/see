import asyncio
import logging
from typing import Any

from sqlalchemy.exc import IntegrityError

from app.core.config import settings
from app.workers import email as worker_email
from app.workers import gmail_ingestion
from app.workers import ingest as worker_ingest
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.tasks.extract_email")
def extract_email(payload: dict) -> dict:
    normalized = worker_email.normalize_mailgun_webhook_payload(payload)
    return asyncio.run(worker_email.persist_email_extraction(normalized))


@celery_app.task(name="app.workers.tasks.poll_gmail_inbox")
def poll_gmail_inbox() -> dict[str, int]:
    return asyncio.run(poll_gmail_inbox_impl())


@celery_app.task(name="app.workers.tasks.scrape_events")
def scrape_events() -> dict[str, int]:
    return asyncio.run(scrape_events_impl())


async def scrape_events_impl() -> dict[str, int]:
    """Scrape configured Devpost/Luma sources and upsert events."""
    scraped = {"devpost": 0, "luma": 0}

    if settings.DEVPOST_HACKATHON_URL:
        try:
            scraped["devpost"] = await worker_ingest.scrape_devpost_events()
        except Exception:
            logger.exception("Devpost event scrape failed")

    try:
        scraped["luma"] = await worker_ingest.scrape_luma_events()
    except Exception:
        logger.exception("Luma event scrape failed")

    return scraped


async def poll_gmail_inbox_impl() -> dict[str, int]:
    """Fetch and persist Gmail messages without requiring Celery or Redis."""
    try:
        messages = await asyncio.to_thread(gmail_ingestion.fetch_unread_job_emails)
    except Exception:
        logger.exception("Unable to fetch unread Gmail messages")
        return {"found": 0, "processed": 0, "duplicates": 0, "failed": 1}
    processed = 0
    duplicates = 0
    failed = 0
    seen_hashes: set[str] = set()
    persisted_uids: list[str] = []

    for message in messages:
        normalized = worker_email.normalize_mailgun_webhook_payload(message)
        if normalized.raw_email_hash in seen_hashes:
            duplicates += 1
            persisted_uids.append(message.get("uid") or "")
            continue
        seen_hashes.add(normalized.raw_email_hash)

        try:
            result: dict[str, Any] = await worker_email.persist_email_extraction(normalized)
        except IntegrityError:
            # The unique raw_email_hash index makes overlapping triggers safe.
            duplicates += 1
            logger.info("Gmail message was inserted concurrently; treating it as a duplicate")
            persisted_uids.append(message.get("uid") or "")
            continue
        except Exception:
            failed += 1
            logger.exception("Failed to persist a Gmail message during polling")
            continue

        persisted_uids.append(message.get("uid") or "")
        if result.get("duplicate"):
            duplicates += 1
        else:
            processed += 1

    # Only mark messages as read once their content is safely persisted.
    # Unread messages that failed to persist stay flagged and are retried on the next poll.
    successful_uids = [uid for uid in persisted_uids if uid]
    if successful_uids:
        await asyncio.to_thread(gmail_ingestion.mark_seen_by_uids, successful_uids)

    return {
        "found": len(messages),
        "processed": processed,
        "duplicates": duplicates,
        "failed": failed,
    }
