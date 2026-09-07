# backend/auth/router.py
# POST /auth/login   — issue JWT
# POST /auth/refresh — extend session
# GET  /auth/me      — current user info

import os
import logging
from datetime import datetime, timezone

ENVIRONMENT = os.getenv('ENVIRONMENT', 'development')

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db.database import get_db
from db.models   import User
from auth.jwt    import (
    verify_password, create_access_token,
    get_current_user, TokenData
)

logger = logging.getLogger(__name__)
router = APIRouter()

# ── Demo users (seeded if no DB user found) ───────────────────
# In prod: users created via admin panel / seeded from .env
DEMO_USERS = {
    "asha_demo":   {"password": "asha123",   "role": "asha",   "phc_id": "phc_001", "name": "Priya (ASHA)"},
    "doctor_demo": {"password": "doctor123", "role": "doctor", "phc_id": "phc_001", "name": "Dr. Sharma"},
    "admin":       {"password": "admin123",  "role": "admin",  "phc_id": None,       "name": "Admin"},
}


# ── Schemas ───────────────────────────────────────────────────
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type:   str = "bearer"
    expires_in:   int = 480 * 60   # seconds
    user_id:      str
    role:         str
    name:         str
    phc_id:       str | None = None


# ── POST /auth/login ──────────────────────────────────────────
@router.post("/login", response_model=LoginResponse, summary="Login and get JWT")
def login(body: LoginRequest, db: Session = Depends(get_db)):

    user_data = None
    db_user   = None

    # 1. Try database first (username treated as email)
    db_user = db.query(User).filter(User.email == body.username).first()
    if db_user:
        if not verify_password(body.password, db_user.password_hash):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error": "INVALID_CREDENTIALS", "message": "Incorrect password"}
            )
        user_data = {
            "user_id": db_user.id,
            "role":    db_user.role,
            "phc_id":  db_user.phc_id,
            "name":    db_user.name,
        }

    # 2. Fall back to demo credentials (for SIH demo + dev)
    elif ENVIRONMENT != 'production' and body.username in DEMO_USERS:
        demo = DEMO_USERS[body.username]
        if body.password != demo["password"]:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error": "INVALID_CREDENTIALS", "message": "Incorrect password"}
            )
        user_data = {
            "user_id": f"demo_{body.username}",
            "role":    demo["role"],
            "phc_id":  demo["phc_id"],
            "name":    demo["name"],
        }

    else:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail={"error": "USER_NOT_FOUND", "message": f"User '{body.username}' not found"}
        )

    token = create_access_token(TokenData(
        user_id = user_data["user_id"],
        role    = user_data["role"],
        phc_id  = user_data["phc_id"],
    ))

    logger.info(f"Login: {body.username} | role={user_data['role']}")

    return LoginResponse(
        access_token = token,
        user_id      = user_data["user_id"],
        role         = user_data["role"],
        name         = user_data["name"],
        phc_id       = user_data["phc_id"],
    )


# ── GET /auth/me ──────────────────────────────────────────────
@router.get("/me", summary="Get current user info")
def me(user: TokenData = Depends(get_current_user)):
    return {
        "user_id":  user.user_id,
        "role":     user.role,
        "phc_id":   user.phc_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── POST /auth/refresh ────────────────────────────────────────
@router.post("/refresh", summary="Refresh JWT token")
def refresh(user: TokenData = Depends(get_current_user)):
    new_token = create_access_token(user)
    return {
        "access_token": new_token,
        "token_type":   "bearer",
        "expires_in":   480 * 60,
    }
