"""
Security middleware and utilities for See backend.

Implements:
- Security headers (HSTS, X-Frame-Options, CSP, etc.)
- Rate limiting
- Request validation
- CORS hardening
"""

import time
from typing import Dict
from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Add security headers to all responses."""

    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Prevent XSS attacks
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # HSTS: Force HTTPS (only in production)
        if settings.APP_ENV == "production":
            response.headers["Strict-Transport-Security"] = (
                "max-age=31536000; includeSubDomains; preload"
            )

        # Content Security Policy (strict). connect-src must include the
        # configured Supabase project so the app can reach auth/storage.
        supabase_origin = settings.SUPABASE_URL.rstrip("/")
        connect_src = "'self'" + (f" {supabase_origin}" if supabase_origin else "")
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            f"connect-src {connect_src}"
        )

        # Referrer policy
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Permissions policy
        response.headers["Permissions-Policy"] = (
            "geolocation=(), "
            "microphone=(), "
            "camera=(), "
            "payment=()"
        )

        return response


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiting (use Redis for multi-instance production)."""

    def __init__(self, app: FastAPI):
        super().__init__(app)
        self.requests: Dict[str, list[float]] = {}
        self.limit_per_minute = 300  # Production default
        self.max_tracked_clients = 10_000

    @staticmethod
    def _client_key(request: Request) -> str:
        # Behind Render's proxy the socket peer is the proxy itself, so prefer
        # the forwarded client address; otherwise every user shares one bucket.
        forwarded = request.headers.get("x-forwarded-for", "")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.client.host if request.client else "unknown"

    def _evict_stale(self, now: float) -> None:
        for key in [key for key, times in self.requests.items() if not times or now - times[-1] >= 60]:
            self.requests.pop(key, None)

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path in {"/health", "/health/live", "/health/ready"}:
            return await call_next(request)

        # Rate limiting disabled in development
        if settings.APP_ENV not in ["staging", "production"]:
            return await call_next(request)

        now = time.time()
        client_key = self._client_key(request)

        # Bound memory: drop idle buckets, then evict least-recently-seen clients.
        if len(self.requests) >= self.max_tracked_clients:
            self._evict_stale(now)
            while len(self.requests) >= self.max_tracked_clients and self.requests:
                oldest = min(self.requests, key=lambda key: self.requests[key][-1])
                self.requests.pop(oldest, None)

        bucket = [req_time for req_time in self.requests.get(client_key, []) if now - req_time < 60]

        if len(bucket) >= self.limit_per_minute:
            self.requests[client_key] = bucket
            logger.warning("Rate limit exceeded for client: %s", client_key)
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Too many requests. Please try again later."},
            )

        bucket.append(now)
        self.requests[client_key] = bucket

        response = await call_next(request)

        remaining = max(self.limit_per_minute - len(bucket), 0)
        response.headers["X-RateLimit-Limit"] = str(self.limit_per_minute)
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(now + 60))

        return response


class HTTPSEnforceMiddleware(BaseHTTPMiddleware):
    """Enforce HTTPS in production."""

    async def dispatch(self, request: Request, call_next):
        if settings.APP_ENV == "production":
            # Check if connection is secure
            if not request.url.scheme == "https":
                # If running behind proxy, check X-Forwarded-Proto
                if request.headers.get("X-Forwarded-Proto") != "https":
                    return JSONResponse(
                        status_code=status.HTTP_403_FORBIDDEN,
                        content={"detail": "HTTPS required"},
                    )

        return await call_next(request)


def setup_security_middleware(app: FastAPI) -> None:
    """Configure all security middleware."""

    # Order matters: add in reverse order of execution
    app.add_middleware(HTTPSEnforceMiddleware)
    app.add_middleware(RateLimitMiddleware)
    app.add_middleware(SecurityHeadersMiddleware)

    logger.info("✅ Security middleware configured")


def validate_cors_origin(origin: str) -> bool:
    """Validate CORS origin against whitelist."""
    allowed_origins = settings.cors_origins

    # Exact match
    if origin in allowed_origins:
        return True

    # Wildcard support (careful with this!)
    for allowed in allowed_origins:
        if allowed == "*":
            return True

    return False


def sanitize_input(value: str, max_length: int = 1000) -> str:
    """Sanitize user input."""
    if not isinstance(value, str):
        return str(value)

    # Trim
    value = value.strip()

    # Max length
    if len(value) > max_length:
        value = value[:max_length]

    # Remove null bytes
    value = value.replace("\x00", "")

    # Normalize whitespace
    value = " ".join(value.split())

    return value


def validate_email(email: str) -> bool:
    """Basic email validation."""
    import re

    pattern = r"^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$"
    return re.match(pattern, email) is not None


def validate_url(url: str) -> bool:
    """Basic URL validation."""
    import re

    pattern = r"^https?://[a-zA-Z0-9.-]+(:[0-9]+)?(/[a-zA-Z0-9._~:/?#@!$&'()*+,;=-]*)?$"
    return re.match(pattern, url) is not None
