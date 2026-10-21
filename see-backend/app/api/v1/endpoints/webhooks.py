from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
import time
from dataclasses import dataclass
from urllib.parse import parse_qsl

from fastapi import APIRouter, Header, HTTPException, Request, Response, status

import redis.asyncio as redis_async

from app.core.config import settings
from app.workers.email import build_email_extraction_payload
from app.workers.tasks import extract_email
import logging


router = APIRouter()

logger = logging.getLogger(__name__)


@dataclass(slots=True)
class WebhookIngestResponse:
    accepted: bool
    queued: bool


def _webhook_secret() -> str:
    for candidate in (settings.MAILGUN_SIGNING_KEY, settings.EMAIL_WEBHOOK_SECRET):
        if candidate and candidate != "replace-me":
            return candidate
    return ""


def _verify_signature(timestamp: str | None, token: str | None, signature: str | None) -> bool:
    secret = _webhook_secret()
    if not secret or not timestamp or not token or not signature:
        return False

    # Reject replayed requests: Mailgun signs only "{timestamp}{token}", so a
    # captured payload would otherwise be valid forever.
    try:
        age = abs(time.time() - int(timestamp))
    except ValueError:
        return False
    if age > settings.EMAIL_WEBHOOK_TOLERANCE_SECONDS:
        return False

    digest = hmac.new(secret.encode("utf-8"), f"{timestamp}{token}".encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


async def _worker_available() -> bool:
    """Reject webhook work that would sit in Redis without a consumer."""
    if settings.APP_ENV.lower() not in {"production", "staging"}:
        return True
    client = redis_async.from_url(
        settings.REDIS_URL,
        decode_responses=True,
        socket_timeout=1.5,
        socket_connect_timeout=1.5,
    )
    try:
        return bool(await client.get("see:worker:alive"))
    except Exception:
        logger.warning("Unable to verify the email worker heartbeat")
        return False
    finally:
        await client.aclose()


async def _parse_payload(request: Request) -> dict[str, object]:
    raw_body = await request.body()
    if len(raw_body) > 2_000_000:
        raise HTTPException(status_code=413, detail="Email payload too large")
    content_type = (request.headers.get("content-type") or "").lower()

    if "multipart/form-data" in content_type:
        from email.parser import BytesParser
        from email.policy import default
        message = BytesParser(policy=default).parsebytes(b"Content-Type: " + request.headers["content-type"].encode() + b"\r\n\r\n" + raw_body)
        return {part.get_param("name", header="content-disposition"): part.get_payload(decode=True).decode("utf-8", errors="replace")
                for part in message.iter_parts() if part.get_content_disposition() == "form-data" and not part.get_filename()}
    if "application/x-www-form-urlencoded" in content_type:
        return {key: value for key, value in parse_qsl(raw_body.decode("utf-8"), keep_blank_values=True)}

    try:
        parsed = json.loads(raw_body.decode("utf-8"))
        if isinstance(parsed, dict):
            return parsed
    except (UnicodeDecodeError, json.JSONDecodeError):
        pass

    return {"raw": raw_body.decode("utf-8", errors="ignore")}


@router.post("/email", status_code=status.HTTP_202_ACCEPTED)
async def ingest_email(
    request: Request,
    response: Response = None,  # type: ignore[assignment]  # FastAPI injects; None when unit-called directly
    x_timestamp: str | None = Header(default=None, alias="X-Timestamp"),
    x_token: str | None = Header(default=None, alias="X-Token"),
    x_signature: str | None = Header(default=None, alias="X-Signature"),
) -> WebhookIngestResponse:
    payload = await _parse_payload(request)
    if not _verify_signature(x_timestamp or payload.get("timestamp"), x_token or payload.get("token"), x_signature or payload.get("signature")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

    if not settings.DEFAULT_USER_ID:
        raise HTTPException(status_code=503, detail="Email ingestion owner is not configured")
    if not await _worker_available():
        raise HTTPException(status_code=503, detail="Email worker is not running")
    # A signed webhook authenticates transport, not an arbitrary sender-verified flag.
    payload["sender_verified"] = False

    try:
        await asyncio.to_thread(extract_email.delay, build_email_extraction_payload(payload))
    except Exception:
        logger.exception("Failed to queue email extraction task")
        if response is not None:
            response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return WebhookIngestResponse(accepted=False, queued=False)
    return WebhookIngestResponse(accepted=True, queued=True)
