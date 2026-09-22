# backend/auth/router.py
# POST /auth/login    — issue JWT (supports username OR email)
# POST /auth/register — admin-only: create new user
# POST /auth/refresh  — extend session
# GET  /auth/me       — current user info

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
    verify_password, hash_password, create_access_token,
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

class RegisterRequest(BaseModel):
    name:     str
    username: str
    password: str
    role:     str          # "asha" | "doctor" | "admin"
    phc_id:   str | None = None
    email:    str | None = None  # optional, auto-generated if missing


# ── POST /auth/login ──────────────────────────────────────────
@router.post("/login", response_model=LoginResponse, summary="Login and get JWT")
def login(body: LoginRequest, db: Session = Depends(get_db)):

    user_data = None
    db_user   = None

    # 1. Try DB — match by username OR email
    db_user = (
        db.query(User).filter(User.username == body.username).first()
        or db.query(User).filter(User.email == body.username).first()
    )
    if db_user:
        if not db_user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail={"error": "ACCOUNT_DISABLED", "message": "Your account has been disabled. Contact your administrator."}
            )
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
    elif ENVIRONMENT != 'production':
        user_key = body.username.lower().strip()
        demo_map = {
            "admin": DEMO_USERS["admin"],
            "administrator": DEMO_USERS["admin"],
            "admin_demo": DEMO_USERS["admin"],
            "doctor": DEMO_USERS["doctor_demo"],
            "doctor_demo": DEMO_USERS["doctor_demo"],
            "dr": DEMO_USERS["doctor_demo"],
            "asha": DEMO_USERS["asha_demo"],
            "asha_demo": DEMO_USERS["asha_demo"],
        }

        demo = demo_map.get(user_key) or DEMO_USERS.get(user_key)

        if demo:
            valid_passwords = {demo["password"], "admin", "admin123", "password", "doctor123", "asha123", "123456"}
            if body.password not in valid_passwords:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail={"error": "INVALID_CREDENTIALS", "message": "Incorrect password"}
                )
            user_data = {
                "user_id": f"demo_{user_key}",
                "role":    demo["role"],
                "phc_id":  demo["phc_id"],
                "name":    demo["name"],
            }
        else:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail={"error": "USER_NOT_FOUND", "message": f"User '{body.username}' not found"}
            )

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


# ── POST /auth/register  (admin-only) ─────────────────────────
@router.post("/register", summary="Admin creates a new user account", status_code=201)
def register(
    body:    RegisterRequest,
    caller:  TokenData = Depends(get_current_user),
    db:      Session   = Depends(get_db),
):
    if caller.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={"error": "FORBIDDEN", "message": "Only admins can create user accounts"}
        )

    allowed_roles = {"asha", "doctor", "admin", "field_worker", "officer"}
    if body.role not in allowed_roles:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"error": "INVALID_ROLE", "message": f"Role must be one of: {allowed_roles}"}
        )

    # Check username uniqueness
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "USERNAME_TAKEN", "message": f"Username '{body.username}' is already in use"}
        )

    # Auto-generate email if not provided
    email = body.email or f"{body.username}@visionraksha.local"

    if db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"error": "EMAIL_TAKEN", "message": f"Email '{email}' is already registered"}
        )

    new_user = User(
        name          = body.name,
        username      = body.username,
        email         = email,
        password_hash = hash_password(body.password),
        role          = body.role,
        phc_id        = body.phc_id,
        is_active     = True,
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    logger.info(f"Admin {caller.user_id} created user: {new_user.username} | role={new_user.role}")

    return {
        "user_id":  new_user.id,
        "username": new_user.username,
        "name":     new_user.name,
        "role":     new_user.role,
        "phc_id":   new_user.phc_id,
        "email":    new_user.email,
    }


# ── GET /auth/me ──────────────────────────────────────────────
@router.get("/me", summary="Get current user info")
def me(user: TokenData = Depends(get_current_user)):
    return {
        "user_id":  user.user_id,
        "role":     user.role,
        "phc_id":   user.phc_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


# ── POST /auth/refresh ─────────────────────────────────────────
@router.post("/refresh", response_model=LoginResponse, summary="Extend session / refresh token")
def refresh(user: TokenData = Depends(get_current_user)):
    token = create_access_token(TokenData(
        user_id = user.user_id,
        role    = user.role,
        phc_id  = user.phc_id,
    ))
    return LoginResponse(
        access_token = token,
        user_id      = user.user_id,
        role         = user.role,
        name         = user.user_id,
        phc_id       = user.phc_id,
    )


# ── POST /auth/register-admin  (public — admin self sign-up) ──
# Only creates accounts with role="admin"
# ASHA & Doctor accounts must be created by an existing admin via /api/admin/users
class AdminRegisterRequest(BaseModel):
    name:     str
    username: str
    password: str

@router.post("/register-admin", summary="Public admin self-registration", status_code=201)
def register_admin(body: AdminRegisterRequest, db: Session = Depends(get_db)):
    if len(body.password) < 6:
        raise HTTPException(
            status_code=422,
            detail={"error": "WEAK_PASSWORD", "message": "Password must be at least 6 characters"}
        )

    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(
            status_code=409,
            detail={"error": "USERNAME_TAKEN", "message": f"Username '{body.username}' is already taken"}
        )

    email = f"{body.username}@visionraksha.local"
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(
            status_code=409,
            detail={"error": "EMAIL_TAKEN", "message": "This username is already registered"}
        )

    new_admin = User(
        name          = body.name,
        username      = body.username,
        email         = email,
        password_hash = hash_password(body.password),
        role          = "admin",   # always admin — hardcoded
        is_active     = True,
    )
    db.add(new_admin)
    db.commit()
    db.refresh(new_admin)

    logger.info(f"New admin registered: {new_admin.username}")

    # Auto-login: issue token immediately after registration
    token = create_access_token(TokenData(
        user_id = new_admin.id,
        role    = "admin",
        phc_id  = None,
    ))

    return LoginResponse(
        access_token = token,
        user_id      = new_admin.id,
        role         = "admin",
        name         = new_admin.name,
        phc_id       = None,
    )

