from __future__ import annotations

import hashlib
import hmac
import json

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.core.config import settings
from app.workers.tasks import extract_email


router = APIRouter()


def _verify_signature(raw_body: bytes, signature: str | None) -> bool:
    if not settings.EMAIL_WEBHOOK_SECRET:
        return True
    if signature is None:
        return False
    digest = hmac.new(settings.EMAIL_WEBHOOK_SECRET.encode("utf-8"), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, signature)


@router.post("/email", status_code=status.HTTP_202_ACCEPTED)
async def ingest_email(
    request: Request,
    x_signature: str | None = Header(default=None, alias="X-Signature"),
) -> dict[str, object]:
    raw_body = await request.body()
    if not _verify_signature(raw_body, x_signature):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid webhook signature")

    payload: dict[str, object]
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except json.JSONDecodeError:
        payload = {"raw": raw_body.decode("utf-8", errors="ignore")}

    try:
        extract_email.delay(payload)
    except Exception:
        return {"accepted": True, "queued": False}
    return {"accepted": True, "queued": True}
