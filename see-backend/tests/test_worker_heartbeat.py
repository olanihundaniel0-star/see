from __future__ import annotations

import pytest

from app.workers import celery_app as worker_module


def test_heartbeat_writes_readiness_key_with_production_ttl(monkeypatch):
    calls = []

    class Client:
        def set(self, key, value, ex):
            calls.append((key, value, ex))

        def close(self):
            calls.append("closed")

    monkeypatch.setattr(worker_module.redis.Redis, "from_url", lambda *args, **kwargs: Client())
    worker_module._write_worker_heartbeat()

    assert calls == [
        ("see:worker:alive", "1", 90),
        "closed",
    ]
    assert worker_module.WORKER_HEARTBEAT_KEY == "see:worker:alive"
    assert worker_module.WORKER_HEARTBEAT_TTL_SECONDS == 90


def test_transient_redis_failures_at_boot_are_retried_then_succeed(monkeypatch):
    attempts = []

    class FlakyClient:
        def set(self, key, value, ex):
            attempts.append(key)
            if len(attempts) < 3:
                raise ConnectionError("redis briefly unreachable")

        def close(self):
            pass

    sleeps = []
    monkeypatch.setattr(worker_module.redis.Redis, "from_url", lambda *args, **kwargs: FlakyClient())
    monkeypatch.setattr(worker_module.time, "sleep", lambda delay: sleeps.append(delay))
    worker_module._write_worker_heartbeat()

    assert len(attempts) == 3
    assert sleeps == [worker_module._HEARTBEAT_RETRY_DELAY_SECONDS, worker_module._HEARTBEAT_RETRY_DELAY_SECONDS]


def test_persistent_redis_failure_raises_after_final_attempt(monkeypatch):
    attempts = []

    class DeadClient:
        def set(self, key, value, ex):
            attempts.append(key)
            raise ConnectionError("redis down")

        def close(self):
            pass

    monkeypatch.setattr(worker_module.redis.Redis, "from_url", lambda *args, **kwargs: DeadClient())
    monkeypatch.setattr(worker_module.time, "sleep", lambda delay: None)

    with pytest.raises(ConnectionError):
        worker_module._write_worker_heartbeat()

    assert len(attempts) == 3


def test_heartbeat_signal_handler_swallows_monitoring_errors(monkeypatch):
    def fail():
        raise ConnectionError("redis down")

    monkeypatch.setattr(worker_module, "_write_worker_heartbeat", fail)
    worker_module.worker_heartbeat()
