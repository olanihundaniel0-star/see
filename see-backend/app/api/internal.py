import logging
import secrets
import time

from fastapi import APIRouter, Header, HTTPException, status

from app.core.config import settings
from app.workers.tasks import poll_gmail_inbox_impl


logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/internal/poll-gmail")
async def trigger_gmail_poll(
    x_internal_token: str | None = Header(default=None, alias="X-Internal-Token"),
) -> dict[str, object]:
    """Run one bounded inbox poll for an external scheduler such as GitHub Actions."""
    expected_token = settings.INTERNAL_API_TOKEN.get_secret_value() if settings.INTERNAL_API_TOKEN else ""
    if not expected_token or not x_internal_token or not secrets.compare_digest(x_internal_token, expected_token):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid internal scheduler token")

    started_at = time.monotonic()
    result = await poll_gmail_inbox_impl()
    elapsed_ms = round((time.monotonic() - started_at) * 1000)
    logger.info("Gmail poll completed in %sms: %s", elapsed_ms, result)
    return {"status": "ok", "elapsed_ms": elapsed_ms, "result": result}
