# backend/routes/patients.py
# POST /api/patients        — Register patient
# GET  /api/patients        — List / search patients
# GET  /api/patients/{id}   — Patient detail + history
# Spec: TRD Section 5, PRD FR-028 to FR-030

import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
from typing import Optional

from db.database import get_db
from db.models   import Patient, Screening
from auth.jwt    import get_current_user, get_optional_user, TokenData

logger = logging.getLogger(__name__)
router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────

class PatientCreate(BaseModel):
    name:           str            = Field(..., min_length=1, max_length=100)
    age:            int            = Field(..., gt=0, lt=120)
    gender:         Optional[str]  = Field(None, pattern="^[MFO]$")
    abha_id:        Optional[str]  = Field(None, max_length=20)
    phone:          Optional[str]  = Field(None, max_length=15)
    village:        Optional[str]  = Field(None, max_length=100)
    phc_id:         Optional[str]  = None
    diabetic_since: Optional[int]  = Field(None, gt=1900, lt=2100)


# ── POST /api/patients ───────────────────────────────────────

@router.post("/patients", status_code=201, summary="Register new patient")
def create_patient(
    body: PatientCreate, 
    db: Session = Depends(get_db),
    user: Optional[TokenData] = Depends(get_optional_user),
):

    # Check ABHA ID uniqueness
    if body.abha_id:
        existing = db.query(Patient).filter(Patient.abha_id == body.abha_id).first()
        if existing:
            raise HTTPException(status_code=409, detail={
                "error":   "ABHA_ID_EXISTS",
                "message": f"Patient with ABHA ID {body.abha_id} already registered"
            })

    patient = Patient(**body.model_dump(exclude_none=True))
    db.add(patient)
    db.commit()
    db.refresh(patient)

    logger.info(f"Patient registered: {patient.id} | {patient.name}")

    return {
        "patient_id": patient.id,
        "name":       patient.name,
        "created_at": patient.created_at.isoformat(),
    }


# ── GET /api/patients ─────────────────────────────────────────

@router.get("/patients", summary="Search / list patients")
def list_patients(
    search: Optional[str] = Query(None, description="Search by name, phone, or ABHA ID"),
    phc_id: Optional[str] = Query(None),
    limit:  int           = Query(50, le=200),
    offset: int           = Query(0),
    db:     Session       = Depends(get_db),
    user:   Optional[TokenData] = Depends(get_optional_user),
):
    q = db.query(Patient)

    if search:
        like = f"%{search}%"
        q = q.filter(
            Patient.name.ilike(like)    |
            Patient.phone.ilike(like)   |
            Patient.abha_id.ilike(like)
        )

    if phc_id:
        q = q.filter(Patient.phc_id == phc_id)

    total    = q.count()
    patients = q.order_by(Patient.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "total":    total,
        "offset":   offset,
        "limit":    limit,
        "patients": [
            {
                "patient_id":      p.id,
                "name":            p.name,
                "age":             p.age,
                "gender":          p.gender,
                "village":         p.village,
                "abha_id":         p.abha_id,
                "screening_count": len(p.screenings),
                "last_grade":      p.screenings[0].grade if p.screenings else None,
            }
            for p in patients
        ],
    }


# ── GET /api/patients/{id} ────────────────────────────────────

@router.get("/patients/{patient_id}", summary="Patient detail + screening history")
def get_patient(
    patient_id: str, 
    db: Session = Depends(get_db),
    user: Optional[TokenData] = Depends(get_optional_user),
):

    patient = db.query(Patient).filter(Patient.id == patient_id).first()
    if not patient:
        raise HTTPException(status_code=404, detail={
            "error":   "PATIENT_NOT_FOUND",
            "message": f"Patient {patient_id} not found"
        })

    screenings = [
        {
            "screening_id": s.id,
            "date":         s.created_at.strftime("%Y-%m-%d"),
            "grade":        s.grade,
            "grade_label":  s.grade_label,
            "confidence":   s.confidence,
            "validated":    s.validated,
            "action":       s.action,
        }
        for s in patient.screenings
    ]

    # Grade trend list (chronological)
    grade_trend = [s["grade"] for s in reversed(screenings)]

    return {
        "patient_id":     patient.id,
        "name":           patient.name,
        "age":            patient.age,
        "gender":         patient.gender,
        "abha_id":        patient.abha_id,
        "phone":          patient.phone,
        "village":        patient.village,
        "diabetic_since": patient.diabetic_since,
        "created_at":     patient.created_at.isoformat(),
        "screenings":     screenings,
        "grade_trend":    grade_trend,
    }
