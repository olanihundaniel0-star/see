import logging

from fastapi import APIRouter

from app.workers.tasks import poll_gmail_inbox_impl


logger = logging.getLogger(__name__)
router = APIRouter()


@router.post("/internal/poll-gmail")
async def trigger_gmail_poll() -> dict[str, object]:
    # This endpoint is intentionally unauthenticated for the personal-use deployment.
    logger.warning("Unauthenticated Gmail polling endpoint invoked; personal-use only")
    result = await poll_gmail_inbox_impl()
    return {"status": "ok", "result": result}
