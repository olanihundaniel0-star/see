from collections.abc import AsyncGenerator

from sqlalchemy import MetaData
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings


convention = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}

metadata = MetaData(naming_convention=convention)


class Base(DeclarativeBase):
    metadata = metadata


# Connection pool configuration
# Development: smaller pool (local testing)
# Production: larger pool (handle more concurrent requests)
if settings.APP_ENV == "production":
    pool_size = 20
    max_overflow = 40
    pool_recycle = 3600  # Recycle connections after 1 hour
else:
    pool_size = 10
    max_overflow = 20
    pool_recycle = 3600

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    pool_size=pool_size,
    max_overflow=max_overflow,
    pool_pre_ping=True,
    pool_recycle=pool_recycle,
)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
