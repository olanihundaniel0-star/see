from uuid import UUID

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWKClient
from functools import lru_cache

from app.core.config import settings


bearer_scheme = HTTPBearer(auto_error=True)


@lru_cache(maxsize=4)
def _jwks_client(url: str) -> PyJWKClient:
    return PyJWKClient(url)


def _decode_supabase_jwt(token: str) -> dict[str, object]:
    issuer = settings.supabase_issuer or None
    audience = settings.SUPABASE_AUDIENCE or None
    if settings.supabase_jwks_url:
        algorithm = str(jwt.get_unverified_header(token).get("alg") or "").upper()
        if algorithm in {"RS256", "ES256"}:
            jwk_client = _jwks_client(settings.supabase_jwks_url)
            signing_key = jwk_client.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=[algorithm],
                audience=audience,
                issuer=issuer,
            )
        if algorithm not in {"HS256", "RS256", "ES256"}:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Unsupported authentication token algorithm",
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
