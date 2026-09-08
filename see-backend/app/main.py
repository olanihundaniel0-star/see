from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
import redis.asyncio as redis_async

from app.api.v1.router import api_router
from app.core.database import AsyncSessionLocal
from app.core.config import settings


app = FastAPI(title=settings.PROJECT_NAME, version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.get("/health")
async def health() -> dict[str, str]:
    database_status = "ok"
    redis_status = "ok"

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception:
        database_status = "unavailable"

    try:
        redis_client = redis_async.from_url(settings.REDIS_URL, decode_responses=True)
        await redis_client.ping()
        await redis_client.aclose()
    except Exception:
        redis_status = "unavailable"

    overall_status = "ok" if database_status == "ok" and redis_status == "ok" else "degraded"
    return {"status": overall_status, "database": database_status, "redis": redis_status}
