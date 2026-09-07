# backend/routes/stats.py
# GET /api/stats — Analytics dashboard data
# Spec: TRD Section 5, PRD FR-034 to FR-036

import logging
from datetime import datetime, timezone, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func

from db.database import get_db
from db.models   import Screening

logger = logging.getLogger(__name__)
router = APIRouter()

GRADE_LABELS = {
    0: "No DR", 1: "Mild NPDR", 2: "Moderate NPDR",
    3: "Severe NPDR", 4: "Proliferative DR"
}


@router.get("/stats", summary="Dashboard analytics statistics")
def get_stats(
    from_date: str     = Query(None, description="From date YYYY-MM-DD"),
    to_date:   str     = Query(None, description="To date YYYY-MM-DD"),
    phc_id:    str     = Query(None, description="Filter by PHC ID"),
    db:        Session = Depends(get_db),
):
    # ── Date range ───────────────────────────────────────────
    q = db.query(Screening)

    if from_date:
        try:
            q = q.filter(Screening.created_at >= datetime.fromisoformat(from_date))
        except ValueError:
            pass

    if to_date:
        try:
            dt = datetime.fromisoformat(to_date).replace(
                hour=23, minute=59, second=59)
            q = q.filter(Screening.created_at <= dt)
        except ValueError:
            pass

    if phc_id:
        q = q.filter(Screening.phc_id == phc_id)

    screenings = q.all()
    total      = len(screenings)

    if total == 0:
        return _empty_response(from_date, to_date)

    # ── Aggregate ────────────────────────────────────────────
    referral_needed = sum(1 for s in screenings if s.grade >= 2)
    validated       = sum(1 for s in screenings if s.validated)
    avg_confidence  = round(
        sum(s.confidence for s in screenings) / total, 1
    )
    avg_processing  = round(
        sum((s.processing_ms or 0) for s in screenings) / total
    )

    by_grade = {
        GRADE_LABELS[g]: sum(1 for s in screenings if s.grade == g)
        for g in range(5)
    }

    # Grade trend (last 7 days)
    seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent = [s for s in screenings
              if s.created_at and s.created_at.replace(tzinfo=timezone.utc) >= seven_days_ago]
    avg_grade_recent = (
        round(sum(s.grade for s in recent) / len(recent), 2)
        if recent else 0
    )

    return {
        "period": {
            "from": from_date or "all-time",
            "to":   to_date   or "now",
        },
        "total_screened":       total,
        "referral_needed":      referral_needed,
        "referral_rate_pct":    round(referral_needed / total * 100, 1),
        "validated":            validated,
        "validation_rate_pct":  round(validated / total * 100, 1),
        "avg_confidence":       avg_confidence,
        "avg_processing_ms":    avg_processing,
        "by_grade":             by_grade,
        "avg_grade_last_7d":    avg_grade_recent,
    }


def _empty_response(from_date, to_date):
    return {
        "period":              {"from": from_date or "all-time", "to": to_date or "now"},
        "total_screened":      0,
        "referral_needed":     0,
        "referral_rate_pct":   0.0,
        "validated":           0,
        "validation_rate_pct": 0.0,
        "avg_confidence":      0.0,
        "avg_processing_ms":   0,
        "by_grade":            {v: 0 for v in GRADE_LABELS.values()},
        "avg_grade_last_7d":   0,
    }
