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

from celery.signals import heartbeat_sent
import logging
import redis

@heartbeat_sent.connect
def worker_heartbeat(**kwargs):
    try:
        client = redis.Redis.from_url(settings.REDIS_URL, socket_timeout=2, socket_connect_timeout=2)
        try: client.set("see:worker:alive", "1", ex=90)
        finally: client.close()
    except redis.RedisError:
        logging.getLogger(__name__).warning("Worker heartbeat could not reach Redis")
