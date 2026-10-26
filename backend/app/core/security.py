from fastapi import HTTPException, Security, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError
from app.core.config import settings
import logging
import time
import requests

logger = logging.getLogger(__name__)

# Define the security scheme (Bearer Token)
security = HTTPBearer()

# Supabase projects using JWT signing keys issue ES256/RS256 tokens, verified with the
# public keys from the project's JWKS endpoint. Legacy HS256 tokens use SUPABASE_JWT_SECRET.
JWKS_URL = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json"
JWKS_TTL_SECONDS = 600
JWKS_MIN_REFRESH_SECONDS = 30  # Limits refetches triggered by unknown key ids
_jwks_cache = {"keys": [], "fetched_at": 0.0}


def _get_jwks(force: bool = False) -> list:
    age = time.time() - _jwks_cache["fetched_at"]
    if age > JWKS_TTL_SECONDS or (force and age > JWKS_MIN_REFRESH_SECONDS):
        resp = requests.get(JWKS_URL, timeout=5)
        resp.raise_for_status()
        _jwks_cache["keys"] = resp.json().get("keys", [])
        _jwks_cache["fetched_at"] = time.time()
    return _jwks_cache["keys"]


def _decode_token(token: str) -> dict:
    header = jwt.get_unverified_header(token)
    alg = header.get("alg")

    if alg == "HS256":
        return jwt.decode(token, settings.SUPABASE_JWT_SECRET, algorithms=["HS256"], audience="authenticated")

    if alg in ("ES256", "RS256"):
        kid = header.get("kid")
        key = next((k for k in _get_jwks() if k.get("kid") == kid), None)
        if key is None:
            # Key may have been rotated since the last fetch
            key = next((k for k in _get_jwks(force=True) if k.get("kid") == kid), None)
        if key is None:
            raise JWTError("Unknown signing key")
        return jwt.decode(token, key, algorithms=[alg], audience="authenticated")

    raise JWTError(f"Unsupported token algorithm: {alg}")


def verify_token(credentials: HTTPAuthorizationCredentials = Security(security)) -> dict:
    """
    1. Grabs the token from the request header.
    2. Verifies it (legacy HS256 secret, or the project JWKS for ES256/RS256).
    3. If valid, returns the user data.
    4. If fake or expired, throws an error.
    """
    token = credentials.credentials

    try:
        payload = _decode_token(token)
        
        # Only log user ID in debug mode (never the token!)
        if settings.DEBUG:
            logger.debug(f"Token validated for user: {payload.get('sub')}")
        
        return payload

    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except Exception as e:
        # Log error details only in debug mode
        if settings.DEBUG:
            logger.error(f"Auth Error: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication failed",
        )
