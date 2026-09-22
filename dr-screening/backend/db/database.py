# backend/db/database.py
# SQLAlchemy session + engine setup
# Dev: SQLite | Prod: PostgreSQL (set DATABASE_URL in .env)

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

# Compatibility fix: Render & Heroku provide postgres:// but SQLAlchemy requires postgresql://
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Use SQLite if no DATABASE_URL provided (dev / offline mode)
if not DATABASE_URL:
    DATABASE_URL = "sqlite:///./retinai.db"
    connect_args = {"check_same_thread": False}
else:
    connect_args = {}

engine = create_engine(
    DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True,      # detect stale connections
    echo=os.getenv("DEBUG", "false").lower() == "true",
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def _migrate_columns():
    """
    Safely add new columns to existing SQLite tables.
    SQLite does not support ALTER TABLE ADD COLUMN IF NOT EXISTS,
    so we catch the OperationalError when the column already exists.
    """
    migrations = [
        # (table, column, definition)
        ("users",     "username",              "TEXT UNIQUE"),
        ("users",     "is_active",             "INTEGER DEFAULT 1"),
        ("screenings","report_status",         "TEXT DEFAULT 'draft'"),
        ("screenings","shared_to_doctor_id",   "TEXT"),
        ("screenings","asha_notes",            "TEXT"),
    ]
    with engine.connect() as conn:
        for table, column, definition in migrations:
            try:
                conn.execute(
                    __import__("sqlalchemy").text(
                        f"ALTER TABLE {table} ADD COLUMN {column} {definition}"
                    )
                )
                conn.commit()
            except Exception:
                # Column already exists — skip
                pass


def get_db():
    """FastAPI dependency — yields DB session, closes on exit."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables on startup (if not exist) and add missing columns."""
    from db.models import Patient, Screening, Validation, User, PHC, District, FollowUp, AuditLog, DoctorReview  # noqa
    Base.metadata.create_all(bind=engine)

    # ── SQLite column migrations (safe: ADD COLUMN IF NOT EXISTS) ──
    # Needed when new columns are added to existing tables
    _migrate_columns()
