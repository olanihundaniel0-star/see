from celery import Celery
from celery.schedules import schedule
from datetime import timedelta

from app.core.config import settings


celery_app = Celery(
    "see",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    beat_schedule={
        "poll-gmail-inbox": {
            "task": "app.workers.tasks.poll_gmail_inbox",
            "schedule": schedule(timedelta(minutes=max(settings.GMAIL_POLL_INTERVAL_MINUTES, 1))),
        },
        "scrape-events": {
            "task": "app.workers.tasks.scrape_events",
            "schedule": schedule(timedelta(minutes=max(settings.EVENT_SCRAPE_INTERVAL_MINUTES, 5))),
        },
    },
)
