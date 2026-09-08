import asyncio

from app.workers import email as worker_email
from app.workers import gmail_ingestion
from app.workers.celery_app import celery_app


@celery_app.task(name="app.workers.tasks.extract_email")
def extract_email(payload: dict) -> dict:
    normalized = worker_email.normalize_mailgun_webhook_payload(payload)
    return asyncio.run(worker_email.persist_email_extraction(normalized))


@celery_app.task(name="app.workers.tasks.poll_gmail_inbox")
def poll_gmail_inbox() -> dict[str, int]:
    messages = gmail_ingestion.fetch_unread_job_emails()
    queued = 0
    for message in messages:
        extract_email.delay(message)
        queued += 1
    return {"found": len(messages), "queued": queued}
