# backend/auth/jwt.py
# JWT Authentication — issue tokens, verify, protect routes
# Spec: TRD Section 6, PRD FR-038 to FR-042
#
# Flow:
#   POST /auth/login  → returns access_token (JWT)
#   Protected routes  → pass token in Authorization: Bearer <token>
#   FastAPI Depends   → get_current_user() validates token

import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from passlib.context import CryptContext
from jose import JWTError, jwt

logger = logging.getLogger(__name__)

# ── Config ────────────────────────────────────────────────────
_DEFAULT_SECRET = "retinai-dev-secret-change-in-prod-sih26038"
SECRET_KEY = os.getenv("JWT_SECRET_KEY", _DEFAULT_SECRET)
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
if ENVIRONMENT == "production" and SECRET_KEY == _DEFAULT_SECRET:
    raise RuntimeError(
        "FATAL: JWT_SECRET_KEY must be set in production. "
        "Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\""
    )
if SECRET_KEY == _DEFAULT_SECRET:
    logger.warning("Using default JWT secret — set JWT_SECRET_KEY for production")

ALGORITHM       = "HS256"
ACCESS_EXPIRE   = int(os.getenv("JWT_EXPIRE_MINUTES", "480"))   # 8 hours (field shift)

# ── Password hashing ──────────────────────────────────────────
pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(plain: str) -> str:
    return pwd_ctx.hash(plain)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_ctx.verify(plain, hashed)

# ── JWT token ─────────────────────────────────────────────────
class TokenData(BaseModel):
    user_id:  str
    role:     str           # "asha" | "doctor" | "admin"
    phc_id:   Optional[str] = None

def create_access_token(data: TokenData) -> str:
    payload = {
        "sub":    data.user_id,
        "role":   data.role,
        "phc_id": data.phc_id,
        "exp":    datetime.now(timezone.utc) + timedelta(minutes=ACCESS_EXPIRE),
        "iat":    datetime.now(timezone.utc),
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)

def decode_token(token: str) -> TokenData:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return TokenData(
            user_id = payload["sub"],
            role    = payload.get("role", "asha"),
            phc_id  = payload.get("phc_id"),
        )
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "INVALID_TOKEN", "message": str(e)},
            headers={"WWW-Authenticate": "Bearer"},
        )

# ── FastAPI security scheme ────────────────────────────────────
bearer_scheme = HTTPBearer(auto_error=False)

def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> TokenData:
    """Dependency — inject into any route to require authentication."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "MISSING_TOKEN", "message": "Authorization header required"},
            headers={"WWW-Authenticate": "Bearer"},
        )
    return decode_token(credentials.credentials)

def require_role(*roles: str):
    """Role-based access — usage: Depends(require_role('doctor','admin'))"""
    def _check(user: TokenData = Depends(get_current_user)) -> TokenData:
        if user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={
                    "error":   "FORBIDDEN",
                    "message": f"Role '{user.role}' cannot access this resource. Required: {list(roles)}"
                }
            )
        return user
    return _check

# ── Optional auth (returns None if no token) ──────────────────
def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme)
) -> Optional[TokenData]:
    """Dependency — returns user if token present, None otherwise (public routes)."""
    if credentials is None:
        return None
    try:
        return decode_token(credentials.credentials)
    except HTTPException:
        return None
