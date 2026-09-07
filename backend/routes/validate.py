# backend/routes/validate.py
# POST /api/validate/{screening_id} — Doctor validation
# Spec: TRD Section 5, PRD FR-018 to FR-022

import logging
from typing import Optional
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from db.database import get_db
from db.models   import Screening, Validation
from auth.jwt    import require_role, TokenData

logger = logging.getLogger(__name__)
router = APIRouter()


class ValidateRequest(BaseModel):
    action:          str            = Field(..., pattern="^(confirmed|overridden)$")
    doctor_id:       str            = Field(None)
    doctor_grade:    Optional[int]  = Field(None, ge=0, le=4, description="Doctor's own DR grade 0–4")
    note:            str            = Field(None, max_length=1000)
    override_reason: str            = Field(None, max_length=500)


def _compute_disagreement(ai_grade: int, doctor_grade: Optional[int], action: str) -> str:
    """
    Compare AI grade vs doctor grade and classify disagreement level.
    Returns: 'none' | 'minor' (±1 grade) | 'major' (±2+ grades)
    """
    if action == "confirmed" or doctor_grade is None:
        return "none"
    delta = abs(ai_grade - doctor_grade)
    if delta == 0:
        return "none"
    elif delta == 1:
        return "minor"
    else:
        return "major"


@router.post("/validate/{screening_id}", summary="Doctor validates AI result")
def validate_screening(
    screening_id: str            = Path(...),
    body:         ValidateRequest = ...,
    db:           Session        = Depends(get_db),
    user:         TokenData      = Depends(require_role('doctor', 'admin')),
):
    # Fetch screening
    screening = db.query(Screening).filter(Screening.id == screening_id).first()
    if not screening:
        raise HTTPException(status_code=404, detail={
            "error": "SCREENING_NOT_FOUND",
            "message": f"Screening {screening_id} not found"
        })

    if screening.validated:
        raise HTTPException(status_code=409, detail={
            "error": "ALREADY_VALIDATED",
            "message": "This screening has already been validated"
        })

    # Require override_reason when overriding
    if body.action == "overridden" and not body.override_reason:
        raise HTTPException(status_code=400, detail={
            "error": "OVERRIDE_REASON_REQUIRED",
            "message": "Please provide a reason when overriding the AI recommendation"
        })

    # ── Disagreement Check (AI Grade vs Doctor Grade) ─────────
    disagreement = _compute_disagreement(screening.grade, body.doctor_grade, body.action)

    # Save validation record with disagreement metadata
    validation = Validation(
        screening_id       = screening_id,
        doctor_id          = user.user_id,
        action             = body.action,
        doctor_grade       = body.doctor_grade,
        disagreement_level = disagreement,
        override_reason    = body.override_reason,
        note               = body.note,
        validated_at       = datetime.now(timezone.utc),
    )
    db.add(validation)

    # Mark screening as validated
    screening.validated = True
    db.commit()

    logger.info(
        f"Screening {screening_id} validated | action={body.action} | "
        f"doctor={user.user_id} | doctor_grade={body.doctor_grade} | "
        f"ai_grade={screening.grade} | disagreement={disagreement}"
    )

    return {
        "screening_id":      screening_id,
        "validation_status": body.action,
        "validated_by":      user.user_id,
        "validated_at":      datetime.now(timezone.utc).isoformat(),
        "report_available":  screening.grade >= 2,
        "ai_grade":          screening.grade,
        "doctor_grade":      body.doctor_grade,
        "disagreement_level": disagreement,
    }

