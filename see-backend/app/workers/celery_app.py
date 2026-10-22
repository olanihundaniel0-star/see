import logging
from celery.schedules import schedule
from celery import Celery
from celery.signals import heartbeat_sent, worker_ready
from datetime import timedelta
import redis

from app.core.config import settings


logger = logging.getLogger(__name__)
WORKER_HEARTBEAT_KEY = "see:worker:alive"
WORKER_HEARTBEAT_TTL_SECONDS = 90


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
    task_soft_time_limit=240,
    task_time_limit=300,
    worker_prefetch_multiplier=1,
    broker_heartbeat=30,
    broker_transport_options={"visibility_timeout": 600},
    beat_schedule={
        "dispatch-notifications": {"task": "app.workers.tasks.dispatch_notifications", "schedule": 60.0},
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


def _write_worker_heartbeat() -> None:
    """Publish worker liveness without allowing monitoring failures to stop work."""
    client = redis.Redis.from_url(
        settings.REDIS_URL,
        socket_timeout=2,
        socket_connect_timeout=2,
    )
    try:
        client.set(WORKER_HEARTBEAT_KEY, "1", ex=WORKER_HEARTBEAT_TTL_SECONDS)
    finally:
        client.close()


@heartbeat_sent.connect
@worker_ready.connect
def worker_heartbeat(**kwargs: object) -> None:
    """Set liveness immediately at startup, then refresh it on each Celery heartbeat."""
    try:
        _write_worker_heartbeat()
    except Exception:
        logger.exception("Worker heartbeat could not reach Redis")
