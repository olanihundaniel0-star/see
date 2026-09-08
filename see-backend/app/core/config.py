from functools import lru_cache

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


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
    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_FALLBACK_MODEL: str = "gemini-2.5-flash-lite"
    DEFAULT_USER_ID: str = ""
    DEVPOST_HACKATHON_URL: str = ""
    LUMA_PAGE_URLS: str = ""
    LUMA_ICS_FEEDS: str = ""
    GMAIL_USER: str = ""
    GMAIL_APP_PASSWORD: SecretStr | None = None
    GMAIL_POLL_INTERVAL_MINUTES: int = 15
    CORS_ORIGINS: str = "http://localhost:8081,http://localhost:19006,http://127.0.0.1:8081,http://127.0.0.1:19006"
    REDIS_URL: str = "redis://localhost:6379/0"

    @model_validator(mode="after")
    def _validate_production_settings(self) -> "Settings":
        if self.APP_ENV.lower() == "production":
            if not self.supabase_issuer:
                raise ValueError("SUPABASE_URL or SUPABASE_ISSUER must be configured in production")
            if not self.supabase_jwks_url and self.SUPABASE_JWT_SECRET in {"", "replace-me"}:
                raise ValueError("SUPABASE_JWT_SECRET or SUPABASE_JWKS_URL must be configured in production")
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
