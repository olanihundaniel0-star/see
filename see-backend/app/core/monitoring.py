"""
Error tracking and monitoring setup for See backend.

Integrates Sentry for:
- Exception tracking
- Performance monitoring (transactions)
- Release tracking
- Source maps
"""

import logging
import sentry_sdk
from typing import Optional
from fastapi import FastAPI, Request
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.celery import CeleryIntegration
from sentry_sdk.integrations.redis import RedisIntegration

from app.core.config import settings


logger = logging.getLogger(__name__)


def init_sentry(app: FastAPI) -> None:
    """Initialize Sentry for error tracking and monitoring."""

    if not settings.SENTRY_DSN or settings.SENTRY_DSN == "":
        logger.info("Sentry disabled (SENTRY_DSN not configured)")
        return

    logger.info(f"Initializing Sentry for environment: {settings.APP_ENV}")

    # Determine sample rates based on environment
    if settings.APP_ENV == "production":
        traces_sample_rate = 0.05  # 5% of transactions
        profiles_sample_rate = 0.01  # 1% of sessions
    elif settings.APP_ENV == "staging":
        traces_sample_rate = 0.1  # 10% of transactions
        profiles_sample_rate = 0.05  # 5% of sessions
    else:
        traces_sample_rate = 0.0  # No sampling in development
        profiles_sample_rate = 0.0

    sentry_sdk.init(
        dsn=settings.SENTRY_DSN,
        integrations=[
            FastApiIntegration(),
            CeleryIntegration(),
            RedisIntegration(),
        ],
        traces_sample_rate=traces_sample_rate,
        profiles_sample_rate=profiles_sample_rate,
        environment=settings.APP_ENV,
        release=settings.get("VERSION", "unknown"),
        # Only capture errors in production/staging (not dev)
        debug=settings.APP_ENV == "development",
        # Attach stack traces to all messages
        attach_stacktrace=True,
        # Include local variables in stack traces (security: disable in prod if needed)
        include_local_variables=settings.APP_ENV != "production",
        # Custom before_send to filter sensitive data
        before_send=before_send_sentry,
    )

    logger.info("✅ Sentry initialized successfully")


def before_send_sentry(event: dict, hint: dict) -> Optional[dict]:
    """
    Filter and sanitize data before sending to Sentry.

    Remove sensitive information:
    - Database passwords
    - API keys
    - User credentials
    """

    # List of keys to redact
    sensitive_keys = {
        "password",
        "secret",
        "token",
        "api_key",
        "authorization",
        "auth",
        "access_token",
        "refresh_token",
    }

    def redact_dict(data: dict) -> dict:
        """Recursively redact sensitive keys in dictionary."""
        if not isinstance(data, dict):
            return data

        redacted = {}
        for key, value in data.items():
            if key.lower() in sensitive_keys:
                redacted[key] = "[REDACTED]"
            elif isinstance(value, dict):
                redacted[key] = redact_dict(value)
            elif isinstance(value, list):
                redacted[key] = [
                    redact_dict(item) if isinstance(item, dict) else item
                    for item in value
                ]
            else:
                redacted[key] = value
        return redacted

    # Redact request data
    if "request" in event:
        if "headers" in event["request"]:
            event["request"]["headers"] = redact_dict(event["request"]["headers"])
        if "cookies" in event["request"]:
            event["request"]["cookies"] = redact_dict(event["request"]["cookies"])
        if "data" in event["request"]:
            event["request"]["data"] = redact_dict(event["request"]["data"])

    # Redact environment variables
    if "contexts" in event and "env" in event["contexts"]:
        event["contexts"]["env"] = redact_dict(event["contexts"]["env"])

    # Redact exception data
    if "exception" in event:
        for exception in event["exception"]["values"]:
            if "stacktrace" in exception:
                for frame in exception["stacktrace"]["frames"]:
                    if "vars" in frame:
                        frame["vars"] = redact_dict(frame["vars"])

    return event


def setup_logging() -> None:
    """Set up structured logging for production."""

    logging.basicConfig(
        level=logging.INFO if settings.APP_ENV != "development" else logging.DEBUG,
        format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    )

    # Set log levels for specific modules
    logging.getLogger("sqlalchemy").setLevel(logging.WARNING)
    logging.getLogger("alembic").setLevel(logging.INFO)
    logging.getLogger("urllib3").setLevel(logging.WARNING)

    if settings.APP_ENV == "production":
        logging.getLogger().setLevel(logging.WARNING)


class SentryContextMiddleware:
    """Middleware to add contextual information to Sentry events."""

    def __init__(self, app: FastAPI):
        self.app = app

    async def __call__(self, request: Request, call_next):
        # Add request ID to Sentry context
        request_id = request.headers.get("X-Request-ID", "unknown")
        sentry_sdk.set_tag("request_id", request_id)

        # Add environment
        sentry_sdk.set_tag("environment", settings.APP_ENV)

        # Add API version
        sentry_sdk.set_tag("api_version", settings.API_V1_STR)

        response = await call_next(request)
        return response


def capture_exception(exception: Exception, message: str = None) -> None:
    """Manually capture an exception to Sentry."""
    if message:
        sentry_sdk.capture_message(message, level="error")
    sentry_sdk.capture_exception(exception)


def capture_message(message: str, level: str = "info") -> None:
    """Manually capture a message to Sentry."""
    sentry_sdk.capture_message(message, level=level)


def set_user_context(user_id: str, email: str = None, username: str = None) -> None:
    """Set user context for Sentry events."""
    sentry_sdk.set_user(
        {
            "id": user_id,
            "email": email,
            "username": username,
        }
    )


def clear_user_context() -> None:
    """Clear user context."""
    sentry_sdk.set_user(None)
