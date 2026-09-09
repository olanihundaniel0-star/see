import asyncio
import logging
from typing import Any

from sqlalchemy.exc import IntegrityError

from app.workers import email as worker_email
from app.workers import gmail_ingestion
from app.workers.celery_app import celery_app

logger = logging.getLogger(__name__)


@celery_app.task(name="app.workers.tasks.extract_email")
def extract_email(payload: dict) -> dict:
    normalized = worker_email.normalize_mailgun_webhook_payload(payload)
    return asyncio.run(worker_email.persist_email_extraction(normalized))


@celery_app.task(name="app.workers.tasks.poll_gmail_inbox")
def poll_gmail_inbox() -> dict[str, int]:
    return asyncio.run(poll_gmail_inbox_impl())


async def poll_gmail_inbox_impl() -> dict[str, int]:
    """Fetch and persist Gmail messages without requiring Celery or Redis."""
    messages = await asyncio.to_thread(gmail_ingestion.fetch_unread_job_emails)
    processed = 0
    duplicates = 0
    failed = 0
    seen_hashes: set[str] = set()

    for message in messages:
        normalized = worker_email.normalize_mailgun_webhook_payload(message)
        if normalized.raw_email_hash in seen_hashes:
            duplicates += 1
            continue
        seen_hashes.add(normalized.raw_email_hash)

        try:
            result: dict[str, Any] = await worker_email.persist_email_extraction(normalized)
        except IntegrityError:
            # The unique raw_email_hash index makes overlapping triggers safe.
            duplicates += 1
            logger.info("Gmail message was inserted concurrently; treating it as a duplicate")
        except Exception:
            failed += 1
            logger.exception("Failed to persist a Gmail message during polling")
            continue

        if result.get("duplicate"):
            duplicates += 1
        else:
            processed += 1

    return {
        "found": len(messages),
        "processed": processed,
        "duplicates": duplicates,
        "failed": failed,
    }
