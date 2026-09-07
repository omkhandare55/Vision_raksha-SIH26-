# backend/db/models.py
# SQLAlchemy ORM models — maps exactly to TRD DB schema

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column, String, Integer, SmallInteger, Boolean,
    Float, Text, DateTime, ForeignKey, JSON, CheckConstraint
)
from sqlalchemy.orm import relationship
from db.database import Base


def _now():
    return datetime.now(timezone.utc)


def _gen_id(prefix: str) -> str:
    return f"{prefix}_{uuid.uuid4().hex[:12]}"


# ── District ────────────────────────────────────────────────
class District(Base):
    __tablename__ = "districts"

    id    = Column(String(20), primary_key=True, default=lambda: _gen_id("dist"))
    name  = Column(String(100), nullable=False)
    state = Column(String(100), nullable=False)

    phcs  = relationship("PHC", back_populates="district")


# ── PHC (Primary Health Centre) ─────────────────────────────
class PHC(Base):
    __tablename__ = "phcs"

    id          = Column(String(20), primary_key=True, default=lambda: _gen_id("phc"))
    name        = Column(String(100), nullable=False)
    district_id = Column(String(20), ForeignKey("districts.id"), nullable=True)
    village     = Column(String(100))
    latitude    = Column(Float)
    longitude   = Column(Float)
    created_at  = Column(DateTime(timezone=True), default=_now)

    district    = relationship("District", back_populates="phcs")
    patients    = relationship("Patient", back_populates="phc")
    screenings  = relationship("Screening", back_populates="phc")
    users       = relationship("User", back_populates="phc")


# ── User ────────────────────────────────────────────────────
class User(Base):
    __tablename__ = "users"

    id            = Column(String(20), primary_key=True, default=lambda: _gen_id("usr"))
    name          = Column(String(100), nullable=False)
    email         = Column(String(100), unique=True, nullable=False)
    password_hash = Column(Text, nullable=False)
    role          = Column(
        String(20),
        CheckConstraint("role IN ('field_worker','doctor','officer','admin')"),
        nullable=False,
        default="field_worker"
    )
    phc_id        = Column(String(20), ForeignKey("phcs.id"), nullable=True)
    created_at    = Column(DateTime(timezone=True), default=_now)

    phc           = relationship("PHC", back_populates="users")
    validations   = relationship("Validation", back_populates="doctor")


# ── Patient ─────────────────────────────────────────────────
class Patient(Base):
    __tablename__ = "patients"

    id             = Column(String(20), primary_key=True, default=lambda: _gen_id("pat"))
    name           = Column(String(100), nullable=False)
    age            = Column(Integer, CheckConstraint("age > 0 AND age < 120"), nullable=False)
    gender         = Column(String(1), CheckConstraint("gender IN ('M','F','O')"))
    abha_id        = Column(String(20), unique=True, nullable=True)
    phone          = Column(String(15))
    village        = Column(String(100))
    phc_id         = Column(String(20), ForeignKey("phcs.id"), nullable=True)
    diabetic_since = Column(Integer)          # year, e.g. 2018
    created_at     = Column(DateTime(timezone=True), default=_now)
    updated_at     = Column(DateTime(timezone=True), default=_now, onupdate=_now)

    phc            = relationship("PHC", back_populates="patients")
    screenings     = relationship("Screening", back_populates="patient",
                                  order_by="Screening.created_at.desc()")


# ── Screening ───────────────────────────────────────────────
class Screening(Base):
    __tablename__ = "screenings"

    id            = Column(String(30), primary_key=True, default=lambda: _gen_id("scr"))
    patient_id    = Column(String(20), ForeignKey("patients.id"), nullable=True)
    phc_id        = Column(String(20), ForeignKey("phcs.id"), nullable=True)

    # AI Results
    grade         = Column(SmallInteger,
                           CheckConstraint("grade BETWEEN 0 AND 4"), nullable=False)
    grade_label   = Column(String(30), nullable=False)
    confidence    = Column(Float, nullable=False)
    probabilities = Column(JSON, nullable=False)   # {label: prob}
    findings      = Column(JSON, nullable=False)   # [str, ...]
    action        = Column(String(60))

    # Images (URLs or base64 for offline)
    image_url     = Column(Text)
    heatmap_url   = Column(Text)

    # Quality
    quality_score = Column(Float)
    quality_enhanced = Column(Boolean, default=False)

    # Performance
    processing_ms = Column(Integer)

    # Clinical inputs (multi-modal)
    patient_age       = Column(Integer, nullable=True)
    patient_hba1c     = Column(Float, nullable=True)
    diabetes_years    = Column(Integer, nullable=True)
    systolic_bp       = Column(Integer, nullable=True)
    dme_risk          = Column(String(30), nullable=True)
    dme_notes         = Column(Text, nullable=True)
    progression_risk  = Column(Float, nullable=True)
    doctor_summary    = Column(Text, nullable=True)
    model_version     = Column(String(50), nullable=True, default="efficientnet_b5_v1")
    screened_by       = Column(String(20), nullable=True)  # user_id from JWT

    # Status
    validated     = Column(Boolean, default=False)
    created_at    = Column(DateTime(timezone=True), default=_now)

    patient       = relationship("Patient", back_populates="screenings")
    phc           = relationship("PHC", back_populates="screenings")
    validation    = relationship("Validation", back_populates="screening",
                                 uselist=False)


# ── Validation (Doctor Review) ──────────────────────────────
class Validation(Base):
    __tablename__ = "validations"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    screening_id    = Column(String(30), ForeignKey("screenings.id"), unique=True)
    doctor_id       = Column(String(20), ForeignKey("users.id"), nullable=True)
    action          = Column(
        String(20),
        CheckConstraint("action IN ('confirmed','overridden')")
    )
    doctor_grade      = Column(SmallInteger, nullable=True)    # doctor's own grade 0–4
    disagreement_level = Column(String(10), nullable=True)     # none / minor / major
    override_reason = Column(Text)
    note            = Column(Text)
    validated_at    = Column(DateTime(timezone=True), default=_now)

    screening       = relationship("Screening", back_populates="validation")
    doctor          = relationship("User", back_populates="validations")


# ── FollowUp (Automated Reminder Scheduling) ────────────────
class FollowUp(Base):
    __tablename__ = "followups"

    id              = Column(Integer, primary_key=True, autoincrement=True)
    screening_id    = Column(String(30), ForeignKey("screenings.id"), nullable=False)
    patient_id      = Column(String(20), ForeignKey("patients.id"), nullable=True)
    follow_up_date  = Column(DateTime(timezone=True), nullable=False)
    urgency         = Column(String(20), nullable=False, default="routine")
    status          = Column(
        String(20),
        CheckConstraint("status IN ('pending','completed','overdue')"),
        nullable=False,
        default="pending"
    )
    reminder_sent    = Column(Boolean, default=False)
    reminder_sent_at = Column(DateTime(timezone=True), nullable=True)
    created_at       = Column(DateTime(timezone=True), default=_now)

    screening        = relationship("Screening")
    patient          = relationship("Patient")


# ── AuditLog (PHI Access Tracking) ──────────────────────────
class AuditLog(Base):
    __tablename__ = "audit_logs"

    id          = Column(Integer, primary_key=True, autoincrement=True)
    user_id     = Column(String(20), nullable=True)
    action      = Column(String(50), nullable=False)  # e.g. 'view_patient', 'download_report', 'run_screening'
    resource_type = Column(String(30), nullable=True)  # e.g. 'patient', 'screening', 'report'
    resource_id = Column(String(30), nullable=True)
    ip_address  = Column(String(45), nullable=True)
    details     = Column(JSON, nullable=True)
    created_at  = Column(DateTime(timezone=True), default=_now)
