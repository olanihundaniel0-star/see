"""
Security middleware and utilities for See backend.

Implements:
- Security headers (HSTS, X-Frame-Options, CSP, etc.)
- Rate limiting
- Request validation
- CORS hardening
"""

import time
from typing import Dict, Optional
from fastapi import FastAPI, Request, HTTPException, status
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

        # Content Security Policy (strict)
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self'; "
            "connect-src 'self' https://nvdhvesydakhkjamfkfs.supabase.co"
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
    """Simple in-memory rate limiting (use Redis for production)."""

    def __init__(self, app: FastAPI):
        super().__init__(app)
        self.requests: Dict[str, list] = {}
        self.limit_per_minute = 300  # Production default

    async def dispatch(self, request: Request, call_next):
        # Skip rate limiting for health checks
        if request.url.path == "/health":
            return await call_next(request)

        # Rate limiting disabled in development
        if not settings.APP_ENV in ["staging", "production"]:
            return await call_next(request)

        # Get client IP
        client_ip = request.client.host if request.client else "unknown"

        # Initialize tracking for this IP
        if client_ip not in self.requests:
            self.requests[client_ip] = []

        # Current time in seconds
        now = time.time()

        # Remove requests older than 1 minute
        self.requests[client_ip] = [
            req_time for req_time in self.requests[client_ip]
            if now - req_time < 60
        ]

        # Check if limit exceeded
        if len(self.requests[client_ip]) >= self.limit_per_minute:
            logger.warning(f"Rate limit exceeded for IP: {client_ip}")
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={"detail": "Too many requests. Please try again later."},
            )

        # Add current request
        self.requests[client_ip].append(now)

        # Proceed
        response = await call_next(request)

        # Add rate limit headers
        remaining = self.limit_per_minute - len(self.requests[client_ip])
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


class RequestValidationMiddleware(BaseHTTPMiddleware):
    """Validate incoming requests."""

    async def dispatch(self, request: Request, call_next):
        # Check for suspicious patterns in query parameters
        for key, value in request.query_params.items():
            if self._is_suspicious(key) or self._is_suspicious(value):
                logger.warning(
                    f"Suspicious query parameter detected: {key}={value}"
                )
                return JSONResponse(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    content={"detail": "Invalid request"},
                )

        return await call_next(request)

    @staticmethod
    def _is_suspicious(value: str) -> bool:
        """Check for common injection patterns."""
        suspicious_patterns = [
            "script>",
            "javascript:",
            "onerror=",
            "onload=",
            "eval(",
            "<iframe",
            "onclick=",
            "onmouseover=",
            "--",  # SQL comment
            "union select",  # SQL injection
            "or 1=1",  # SQL injection
        ]

        value_lower = value.lower()
        return any(pattern in value_lower for pattern in suspicious_patterns)


def setup_security_middleware(app: FastAPI) -> None:
    """Configure all security middleware."""

    # Order matters: add in reverse order of execution
    app.add_middleware(RequestValidationMiddleware)
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
