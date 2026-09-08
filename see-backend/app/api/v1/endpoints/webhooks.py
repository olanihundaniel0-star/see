from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass
from urllib.parse import parse_qsl

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.core.config import settings
from app.workers.email import build_email_extraction_payload
from app.workers.tasks import extract_email


router = APIRouter()


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
    digest = hmac.new(secret.encode("utf-8"), f"{timestamp}{token}".encode("utf-8"), hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


async def _parse_payload(request: Request) -> dict[str, object]:
    raw_body = await request.body()
    content_type = (request.headers.get("content-type") or "").lower()

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
    x_timestamp: str | None = Header(default=None, alias="X-Timestamp"),
    x_token: str | None = Header(default=None, alias="X-Token"),
    x_signature: str | None = Header(default=None, alias="X-Signature"),
) -> WebhookIngestResponse:
    if not _verify_signature(x_timestamp, x_token, x_signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

    payload = await _parse_payload(request)

    try:
        extract_email.delay(build_email_extraction_payload(payload))
    except Exception:
        return WebhookIngestResponse(accepted=True, queued=False)
    return WebhookIngestResponse(accepted=True, queued=True)
