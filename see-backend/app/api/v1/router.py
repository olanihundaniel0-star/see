from fastapi import APIRouter

from app.api.v1.endpoints.dashboard import router as dashboard_router
from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.events import router as events_router
from app.api.v1.endpoints.jobs import router as jobs_router
from app.api.v1.endpoints.notes import router as notes_router
from app.api.v1.endpoints.quick_add import router as quick_add_router
from app.api.v1.endpoints.reminders import router as reminders_router
from app.api.v1.endpoints.webhooks import router as webhooks_router


api_router = APIRouter()
api_router.include_router(dashboard_router, prefix="/dashboard", tags=["dashboard"])
api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(jobs_router, prefix="/jobs", tags=["jobs"])
api_router.include_router(notes_router, prefix="/notes", tags=["notes"])
api_router.include_router(reminders_router, prefix="/reminders", tags=["reminders"])
api_router.include_router(events_router, prefix="/events", tags=["events"])
api_router.include_router(quick_add_router, prefix="/quick-add", tags=["quick-add"])
api_router.include_router(webhooks_router, prefix="/webhooks", tags=["webhooks"])
