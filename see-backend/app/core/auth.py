from uuid import UUID

import time

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient

from app.core.config import settings


bearer_scheme = HTTPBearer(auto_error=True)

_JWKS_TTL_SECONDS = 3600
# url -> (client, fetched_at)
_JWKS_CACHE: dict[str, tuple[PyJWKClient, float]] = {}


def _jwks_client(url: str, force_refresh: bool = False) -> PyJWKClient:
    now = time.time()
    cached = _JWKS_CACHE.get(url)
    if cached is not None and not force_refresh:
        client, fetched_at = cached
        if now - fetched_at < _JWKS_TTL_SECONDS:
            return client
    client = PyJWKClient(url)
    _JWKS_CACHE[url] = (client, now)
    return client


def _decode_supabase_jwt(token: str) -> dict[str, object]:
    issuer = settings.supabase_issuer or None
    audience = settings.SUPABASE_AUDIENCE or None
    if settings.APP_ENV.lower() == "production" and (not issuer or not audience):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_ISSUER/SUPABASE_AUDIENCE must be configured in production",
        )
    if settings.supabase_jwks_url:
        algorithm = str(jwt.get_unverified_header(token).get("alg") or "").upper()
        if algorithm not in {"RS256", "ES256"}:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unsupported authentication token algorithm",
            )
        try:
            jwk_client = _jwks_client(settings.supabase_jwks_url)
            signing_key = jwk_client.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=[algorithm],
                audience=audience,
                issuer=issuer,
            )
        except jwt.PyJWTError as exc:
            message = str(exc).lower()
            if "kid" not in message and "key" not in message:
                raise
            jwk_client = _jwks_client(settings.supabase_jwks_url, force_refresh=True)
            signing_key = jwk_client.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=[algorithm],
                audience=audience,
                issuer=issuer,
            )

    if settings.SUPABASE_JWT_SECRET in {"", "replace-me"}:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="SUPABASE_JWT_SECRET or SUPABASE_JWKS_URL must be configured",
        )

    return jwt.decode(
        token,
        settings.SUPABASE_JWT_SECRET,
        algorithms=["HS256"],
        audience=audience,
        issuer=issuer,
    )


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> UUID:
    token = credentials.credentials
    try:
        payload = _decode_supabase_jwt(token)
        return UUID(str(payload["sub"]))
    except (jwt.PyJWTError, KeyError, ValueError, TypeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
        ) from exc
