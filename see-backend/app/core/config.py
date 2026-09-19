import logging
from functools import lru_cache
from uuid import UUID

from pydantic import SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


def normalize_database_url(url: str) -> str:
    """Ensure PostgreSQL URLs select the asyncpg SQLAlchemy driver."""
    for scheme in ("postgresql://", "postgres://"):
        if url.startswith(scheme):
            return f"postgresql+asyncpg://{url[len(scheme):]}"
    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    PROJECT_NAME: str = "See"
    API_V1_STR: str = "/api/v1"
    APP_ENV: str = "development"
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/see"
    SUPABASE_JWT_SECRET: str = "replace-me"
    SUPABASE_URL: str = ""
    SUPABASE_ISSUER: str = ""
    SUPABASE_AUDIENCE: str = "authenticated"
    SUPABASE_JWKS_URL: str = ""
    EMAIL_WEBHOOK_SECRET: str = "replace-me"
    MAILGUN_SIGNING_KEY: str = ""
    EMAIL_WEBHOOK_TOLERANCE_SECONDS: int = 900
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_FALLBACK_MODEL: str = "gemini-2.5-flash-lite"
    DEFAULT_USER_ID: str = ""
    DEVPOST_HACKATHON_URL: str = ""
    LUMA_PAGE_URLS: str = ""
    LUMA_ICS_FEEDS: str = ""
    LUMA_SITEMAP_LIMIT: int = 30
    GMAIL_USER: str = ""
    GMAIL_APP_PASSWORD: SecretStr | None = None
    GMAIL_POLL_INTERVAL_MINUTES: int = 15
    GMAIL_IMAP_TIMEOUT_SECONDS: int = 20
    GMAIL_MAX_MESSAGES_PER_POLL: int = 5
    EVENT_SCRAPE_INTERVAL_MINUTES: int = 360
    LOG_LEVEL: str = "INFO"
    INTERNAL_API_TOKEN: SecretStr | None = None
    CORS_ORIGINS: str = "http://localhost:8081,http://localhost:19006,http://127.0.0.1:8081,http://127.0.0.1:19006"
    REDIS_URL: str = "redis://localhost:6379/0"
    SENTRY_DSN: str = ""
    VERSION: str = "1.0.0"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def _normalize_database_url(cls, value: str) -> str:
        return normalize_database_url(value)

    @field_validator("DEFAULT_USER_ID", mode="after")
    @classmethod
    def _validate_default_user_id(cls, value: str) -> str:
        value = value.strip()
        if value:
            try:
                UUID(value)
            except ValueError as exc:
                raise ValueError(f"DEFAULT_USER_ID must be a valid UUID when set, got {value!r}") from exc
        return value

    @model_validator(mode="after")
    def _validate_production_settings(self) -> "Settings":
        if self.APP_ENV.lower() == "production":
            if not self.supabase_issuer:
                raise ValueError("SUPABASE_URL or SUPABASE_ISSUER must be configured in production")
            if not self.supabase_jwks_url and self.SUPABASE_JWT_SECRET in {"", "replace-me"}:
                raise ValueError("SUPABASE_JWT_SECRET or SUPABASE_JWKS_URL must be configured in production")
            if not self.DEFAULT_USER_ID:
                # Gmail-created jobs/notes/reminders are attributed to this single
                # user. It is an optional integration, so warn loudly instead of
                # failing startup (which would also block Alembic migrations).
                logger.warning(
                    "DEFAULT_USER_ID is not set: Gmail-created records will be ingested "
                    "without being attached to any user"
                )
        return self

    @property
    def supabase_issuer(self) -> str:
        if self.SUPABASE_ISSUER:
            return self.SUPABASE_ISSUER.rstrip("/")
        if self.SUPABASE_URL:
            return f"{self.SUPABASE_URL.rstrip('/')}/auth/v1"
        return ""

    @property
    def supabase_jwks_url(self) -> str:
        if self.SUPABASE_JWKS_URL:
            return self.SUPABASE_JWKS_URL
        if self.SUPABASE_URL:
            return f"{self.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
        return ""

    @property
    def cors_origins(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
