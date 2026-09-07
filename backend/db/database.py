# backend/db/database.py
# SQLAlchemy session + engine setup
# Dev: SQLite | Prod: PostgreSQL (set DATABASE_URL in .env)

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

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


def get_db():
    """FastAPI dependency — yields DB session, closes on exit."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables on startup (if not exist)."""
    from db.models import Patient, Screening, Validation, User, PHC, District, FollowUp, AuditLog  # noqa
    Base.metadata.create_all(bind=engine)
