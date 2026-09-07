# backend/routes/followups.py
# Follow-Up Reminder CRUD — Spec: 18-Step Workflow, Step 18
# GET /api/followups       — list pending/overdue follow-ups
# GET /api/followups/overdue — list only overdue
# POST /api/followups/{id}/complete — mark as completed

import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from sqlalchemy.orm import Session, joinedload

from db.database import get_db
from db.models   import FollowUp, Patient
from auth.jwt    import get_current_user, TokenData

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/followups", summary="List pending follow-ups")
def list_followups(
    status: str     = Query("pending", pattern="^(pending|completed|overdue|all)$"),
    limit:  int     = Query(50, ge=1, le=200),
    db:     Session = Depends(get_db),
    user:   TokenData = Depends(get_current_user),
):
    """List follow-ups filtered by status. Use status=all to see everything."""
    q = db.query(FollowUp).options(joinedload(FollowUp.patient))

    if status != "all":
        q = q.filter(FollowUp.status == status)

    followups = q.order_by(FollowUp.follow_up_date.asc()).limit(limit).all()

    return {
        "count": len(followups),
        "followups": [
            {
                "id":              f.id,
                "screening_id":    f.screening_id,
                "patient_id":      f.patient_id,
                "patient_name":    f.patient.name if f.patient else None,
                "follow_up_date":  f.follow_up_date.isoformat() if f.follow_up_date else None,
                "urgency":         f.urgency,
                "status":          f.status,
                "reminder_sent":   f.reminder_sent,
                "created_at":      f.created_at.isoformat() if f.created_at else None,
            }
            for f in followups
        ],
    }


@router.get("/followups/overdue", summary="List overdue follow-ups")
def list_overdue(
    limit: int     = Query(50, ge=1, le=200),
    db:    Session = Depends(get_db),
    user:  TokenData = Depends(get_current_user),
):
    """
    Returns follow-ups whose follow_up_date has passed and status is still pending.
    Also auto-marks them as 'overdue'.
    """
    now = datetime.now(timezone.utc)

    # Find pending follow-ups that have passed their due date
    overdue = (
        db.query(FollowUp)
        .options(joinedload(FollowUp.patient))
        .filter(
            FollowUp.status == "pending",
            FollowUp.follow_up_date <= now,
        )
        .order_by(FollowUp.follow_up_date.asc())
        .limit(limit)
        .all()
    )

    # Auto-mark as overdue
    for f in overdue:
        f.status = "overdue"
    if overdue:
        db.commit()

    return {
        "count": len(overdue),
        "followups": [
            {
                "id":              f.id,
                "screening_id":    f.screening_id,
                "patient_id":      f.patient_id,
                "patient_name":    f.patient.name if f.patient else None,
                "follow_up_date":  f.follow_up_date.isoformat() if f.follow_up_date else None,
                "urgency":         f.urgency,
                "status":          f.status,
                "days_overdue":    (now - (f.follow_up_date if f.follow_up_date.tzinfo else f.follow_up_date.replace(tzinfo=timezone.utc))).days if f.follow_up_date else 0,
            }
            for f in overdue
        ],
    }


@router.post("/followups/{followup_id}/complete", summary="Mark follow-up as completed")
def complete_followup(
    followup_id: int     = Path(...),
    db:          Session = Depends(get_db),
    user:        TokenData = Depends(get_current_user),
):
    """Mark a follow-up as completed (patient returned for rescreen)."""
    followup = db.query(FollowUp).filter(FollowUp.id == followup_id).first()
    if not followup:
        raise HTTPException(status_code=404, detail={
            "error": "FOLLOWUP_NOT_FOUND",
            "message": f"Follow-up #{followup_id} not found"
        })

    if followup.status == "completed":
        raise HTTPException(status_code=409, detail={
            "error": "ALREADY_COMPLETED",
            "message": "This follow-up has already been completed"
        })

    followup.status = "completed"
    db.commit()

    logger.info(f"FollowUp #{followup_id} marked completed for patient {followup.patient_id}")

    return {
        "id":     followup.id,
        "status": "completed",
        "message": "Follow-up marked as completed",
    }
