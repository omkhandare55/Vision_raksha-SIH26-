# backend/routes/demo.py
# POST /api/live-demo — Public demo endpoint (no auth required)
# Runs the AI pipeline on an uploaded fundus image for live demonstrations.
# Spec: PRD FR-045 (Public demo mode for SIH judges / field showcases)

import logging
from fastapi import APIRouter, File, Form, HTTPException, UploadFile

from ai.pipeline import get_pipeline

logger = logging.getLogger(__name__)
router = APIRouter()

MAX_FILE_SIZE  = 10 * 1024 * 1024   # 10 MB
ALLOWED_TYPES  = {"image/jpeg", "image/png", "image/webp"}


@router.post("/live-demo", summary="Public live demo — no auth required")
async def live_demo(
    file:       UploadFile = File(..., description="Fundus image (JPEG/PNG/WEBP, max 10MB)"),
    case_index: int        = Form(0,   description="Demo case index (ignored — reserved for future preset cases)"),
):
    """
    Stateless, unauthenticated DR screening for live demonstrations.
    - Accepts a fundus image upload
    - Runs the full AI pipeline (quality check → grading → Grad-CAM → risk)
    - Returns the same response shape as POST /api/analyse
    - Does NOT persist any database record
    """
    # ── Validate file ──────────────────────────────────────────
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail={"error": "INVALID_FILE_TYPE", "message": f"Allowed: {ALLOWED_TYPES}"},
        )

    raw = await file.read()
    if len(raw) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=400,
            detail={"error": "FILE_TOO_LARGE", "message": "Max file size is 10 MB"},
        )
    if len(raw) == 0:
        raise HTTPException(
            status_code=400,
            detail={"error": "EMPTY_FILE", "message": "Uploaded file is empty"},
        )

    # ── Run AI pipeline ───────────────────────────────────────
    try:
        pipeline = get_pipeline()
        result   = pipeline.analyse(raw)
    except ValueError as e:
        # Quality rejection from the pipeline
        raise HTTPException(
            status_code=400,
            detail={"error": "QUALITY_REJECTED", "message": str(e)},
        )
    except Exception as e:
        logger.error(f"live-demo pipeline error: {e}")
        raise HTTPException(
            status_code=500,
            detail={"error": "PIPELINE_ERROR", "message": "AI analysis failed"},
        )

    # ── Return result (no DB persistence) ────────────────────
    return {
        "demo":          True,
        "grade":         result.grade,
        "grade_label":   result.grade_label,
        "confidence":    round(result.confidence, 2),
        "probabilities": result.probabilities,
        "findings":      result.findings,
        "action":        result.action,
        "urgency":       result.urgency,
        "heatmap_b64":   result.heatmap_b64,
        "dme_risk":      getattr(result, "dme_risk",         "none"),
        "dme_notes":     getattr(result, "dme_notes",        ""),
        "progression_risk": getattr(result, "progression_risk", None),
        "processing_ms": getattr(result, "processing_ms",    None),
        "model_version": getattr(result, "model_version",    "demo"),
    }
