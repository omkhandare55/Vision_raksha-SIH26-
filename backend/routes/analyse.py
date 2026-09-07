# backend/routes/analyse.py
# POST /api/analyse — Core screening endpoint
# Spec: TRD Section 5, PRD FR-007 to FR-012

import os
import uuid
import base64
import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, File, UploadFile, Form, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from auth.jwt import get_current_user, TokenData
from db.database import get_db
from db.models   import Screening, Patient, FollowUp
from ai.pipeline import get_pipeline, PipelineResult

logger = logging.getLogger(__name__)
router = APIRouter()

MEDIA_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "media", "screenings")
os.makedirs(MEDIA_DIR, exist_ok=True)

def _save_image(screening_id: str, b64_data: str, suffix: str) -> str:
    """Save base64 image to disk, return relative path."""
    try:
        img_bytes = base64.b64decode(b64_data)
        filename = f"{screening_id}_{suffix}.jpg"
        filepath = os.path.join(MEDIA_DIR, filename)
        with open(filepath, "wb") as f:
            f.write(img_bytes)
        return f"/media/screenings/{filename}"
    except Exception as e:
        logger.warning(f"Failed to save {suffix} for {screening_id}: {e}")
        return ""

MAX_FILE_SIZE = 10 * 1024 * 1024   # 10 MB (PRD FR-002)
ALLOWED_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("/analyse", summary="Analyse retinal image for DR")
async def analyse(
    request:        Request,
    file:           UploadFile = File(..., description="Fundus image (JPEG/PNG/WEBP, max 10MB)"),
    patient_id:     str        = Form(None, description="Optional existing patient ID"),
    age:            int        = Form(None, description="Patient Age in years"),
    hba1c:          float      = Form(None, description="Patient HbA1c level %"),
    diabetes_years: int        = Form(None, description="Duration of diabetes in years"),
    sys_bp:         int        = Form(None, description="Systolic Blood Pressure (mmHg)"),
    db:             Session    = Depends(get_db),
    user:           TokenData  = Depends(get_current_user),
):
    """
    Full Multi-Modal DR screening pipeline:
    1. Quality assessment & fundus validation
    2. EfficientNet-B5 grading (Grade 0–4)
    3. Grad-CAM heatmap generation
    4. Multi-modal risk calculation (Age, HbA1c, Diabetes Duration, BP)
    5. Clinical findings list & Doctor referral letter
    """

    # ── Validate file type ───────────────────────────────────
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "INVALID_FILE_TYPE",
                "message": f"Unsupported type '{file.content_type}'. Use JPEG, PNG, or WEBP."
            }
        )

    # ── Pre-check Content-Length to prevent RAM exhaustion ──
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail={
                "error": "FILE_TOO_LARGE",
                "message": f"Content-Length {int(content_length)//1024}KB exceeds 10MB limit."
            }
        )

    # ── Read & size-check ────────────────────────────────────
    image_bytes = await file.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail={
                "error": "FILE_TOO_LARGE",
                "message": f"File size {len(image_bytes)//1024}KB exceeds 10MB limit."
            }
        )

    # ── Run AI pipeline ──────────────────────────────────────
    pipeline = get_pipeline()

    try:
        result: PipelineResult = pipeline.analyse(
            image_bytes    = image_bytes,
            age            = age,
            hba1c          = hba1c,
            diabetes_years = diabetes_years,
            sys_bp         = sys_bp,
        )
    except ValueError as e:
        # Quality rejection — return structured 400
        parts = str(e).split(":", 1)
        code  = parts[0].strip()
        msg   = parts[1].strip() if len(parts) > 1 else str(e)
        qc    = pipeline.quality_checker
        raise HTTPException(
            status_code=400,
            detail={
                "error":        code,
                "message":      msg,
                "quality_score": 0.0,
                "suggestions":  ["Ensure proper lighting", "Hold camera steady",
                                 "Ensure full retina is visible"]
            }
        )
    except (OSError, IOError) as e:
        # Corrupted / unreadable image (PIL.UnidentifiedImageError is subclass of OSError)
        raise HTTPException(
            status_code=400,
            detail={
                "error":   "CORRUPTED_IMAGE",
                "message": "The uploaded image is corrupted or unreadable. Please upload a valid JPEG, PNG, or WEBP image.",
            }
        )
    except RuntimeError as e:
        # PyTorch / CUDA errors (e.g. OOM)
        logger.error(f"Model inference error: {e}", exc_info=True)
        raise HTTPException(
            status_code=503,
            detail={
                "error":   "MODEL_ERROR",
                "message": "AI model encountered an error during inference. Please try again.",
            }
        )

    # ── Persist screening record ─────────────────────────────
    screening_id = f"scr_{uuid.uuid4().hex[:16]}"

    screening = Screening(
        id             = screening_id,
        patient_id     = patient_id,
        grade          = result.grade,
        grade_label    = result.grade_label,
        confidence     = result.confidence,
        probabilities  = result.probabilities,
        findings       = result.findings,
        action         = result.action,
        image_url      = _save_image(screening_id, result.original_b64, "fundus"),
        heatmap_url    = _save_image(screening_id, result.heatmap_b64, "heatmap"),
        quality_score  = result.quality_score,
        quality_enhanced = result.quality_enhanced,
        processing_ms  = result.processing_ms,
        patient_age    = age,
        patient_hba1c  = hba1c,
        diabetes_years = diabetes_years,
        systolic_bp    = sys_bp,
        dme_risk       = result.dme_risk,
        dme_notes      = result.dme_notes,
        progression_risk = result.progression_risk_5yr,
        doctor_summary = result.doctor_summary,
        validated      = False,
    )
    db.add(screening)
    db.commit()
    db.refresh(screening)

    logger.info(
        f"Screening {screening_id} | grade={result.grade} "
        f"confidence={result.confidence}% | {result.processing_ms}ms"
    )

    # ── Progression Comparison (longitudinal) ─────────────────
    progression = None
    if patient_id:
        prev = (
            db.query(Screening)
            .filter(Screening.patient_id == patient_id, Screening.id != screening_id)
            .order_by(Screening.created_at.desc())
            .first()
        )
        if prev:
            grade_delta = result.grade - prev.grade
            prev_dt = prev.created_at
            if prev_dt and prev_dt.tzinfo is None:
                prev_dt = prev_dt.replace(tzinfo=timezone.utc)
            days_since  = (datetime.now(timezone.utc) - prev_dt).days if prev_dt else None
            if grade_delta > 0:
                trend = "worsening"
            elif grade_delta < 0:
                trend = "improving"
            else:
                trend = "stable"
            progression = {
                "previous_grade":              prev.grade,
                "previous_grade_label":         prev.grade_label,
                "current_grade":               result.grade,
                "grade_delta":                 grade_delta,
                "trend":                       trend,
                "days_since_last_screening":   days_since,
                "previous_screening_id":       prev.id,
            }

    # ── Auto-create FollowUp Reminder ─────────────────────────
    FOLLOWUP_DAYS = {0: 365, 1: 180, 2: 28, 3: 14, 4: 2}
    FOLLOWUP_URGENCY = {0: "routine", 1: "routine", 2: "routine", 3: "urgent", 4: "emergency"}
    try:
        followup = FollowUp(
            screening_id   = screening_id,
            patient_id     = patient_id,
            follow_up_date = datetime.now(timezone.utc) + timedelta(days=FOLLOWUP_DAYS.get(result.grade, 365)),
            urgency        = FOLLOWUP_URGENCY.get(result.grade, "routine"),
            status         = "pending",
        )
        db.add(followup)
        db.commit()
    except Exception as e:
        logger.warning(f"Follow-up creation failed for screening {screening_id}: {e}")

    # ── Build response (TRD Section 5) ───────────────────────
    return {
        "screening_id":   screening_id,
        "patient_id":     patient_id,
        "demo_mode":      result.demo_mode,

        "quality": {
            "score":    result.quality_score,
            "action":   result.quality_action,
            "enhanced": result.quality_enhanced,
        },

        "grade":       result.grade,
        "grade_label": result.grade_label,
        "confidence":  result.confidence,
        "action":      result.action,
        "color":       result.color,

        "probabilities": result.probabilities,
        "findings":      result.findings,
        "icdrs_notes":   result.icdrs_notes,
        "referral":      result.urgency,
        "urgency":       result.urgency,

        "dme_risk":                    result.dme_risk,
        "dme_notes":                   result.dme_notes,
        "recommended_action_timeline": result.recommended_action_timeline,
        "systemic_risk":               result.systemic_risk,
        "progression_risk_5yr":        result.progression_risk_5yr,
        "doctor_summary":              result.doctor_summary,
        "evidence_chain":              result.evidence_chain,

        "progression": progression,

        "original_image": result.original_b64,
        "heatmap_image":  result.heatmap_b64,

        "processing_time_ms": result.processing_ms,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
