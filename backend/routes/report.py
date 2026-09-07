# backend/routes/report.py
# GET /api/report/{screening_id} — Generate PDF referral letter
# Spec: TRD Section 5 + 4.5, PRD FR-024 to FR-027

import io
import base64
import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from db.database import get_db
from db.models   import Screening, Validation, Patient
from auth.jwt    import get_current_user, TokenData

logger = logging.getLogger(__name__)
router = APIRouter()


@router.get("/report/{screening_id}", summary="Generate PDF referral report")
def generate_report(
    screening_id: str, 
    db: Session = Depends(get_db),
    user: TokenData = Depends(get_current_user),
):

    # ── Fetch data ───────────────────────────────────────────
    screening = db.query(Screening).filter(Screening.id == screening_id).first()
    if not screening:
        raise HTTPException(status_code=404, detail={
            "error": "SCREENING_NOT_FOUND", "message": f"{screening_id} not found"
        })

    patient    = db.query(Patient).filter(Patient.id == screening.patient_id).first() \
                 if screening.patient_id else None
    validation = screening.validation

    # ── Build PDF ────────────────────────────────────────────
    pdf_bytes = _build_pdf(screening, patient, validation)

    # Return as streaming PDF download
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="RetinAI_Report_{screening_id}.pdf"',
            "Content-Length":      str(len(pdf_bytes)),
        }
    )


@router.get("/report/{screening_id}/fhir", summary="Export HL7 FHIR DiagnosticReport (ABHA / ABDM)")
def export_fhir(
    screening_id: str, 
    db: Session = Depends(get_db),
    user: TokenData = Depends(get_current_user),
):
    """
    Returns HL7 FHIR R4 DiagnosticReport resource for Ayushman Bharat (ABDM) integration.
    """
    screening = db.query(Screening).filter(Screening.id == screening_id).first()
    if not screening:
        raise HTTPException(status_code=404, detail={"error": "SCREENING_NOT_FOUND", "message": f"{screening_id} not found"})

    patient = db.query(Patient).filter(Patient.id == screening.patient_id).first() if screening.patient_id else None

    fhir_doc = {
        "resourceType": "DiagnosticReport",
        "id": screening.id,
        "status": "final" if screening.validated else "preliminary",
        "category": [
            {
                "coding": [
                    {
                        "system": "http://terminology.hl7.org/CodeSystem/v2-0074",
                        "code": "RAD",
                        "display": "Radiology / Ophthalmic Imaging"
                    }
                ]
            }
        ],
        "code": {
            "coding": [
                {
                    "system": "http://loinc.org",
                    "code": "890-4",
                    "display": "Diabetic Retinopathy Screening Evaluation"
                }
            ],
            "text": "Diabetic Retinopathy & Macular Edema Screening"
        },
        "subject": {
            "reference": f"Patient/{patient.id if patient else 'anonymous'}",
            "display": patient.name if patient else "Anonymous Patient",
            "identifier": {
                "system": "https://healthid.ndhm.gov.in",
                "value": patient.abha_id if (patient and patient.abha_id) else None
            }
        },
        "effectiveDateTime": screening.created_at.isoformat() if screening.created_at else datetime.now(timezone.utc).isoformat(),
        "issued": datetime.now(timezone.utc).isoformat(),
        "conclusion": f"ICDRS Grade {screening.grade} ({screening.grade_label}). {screening.action}",
        "conclusionCode": [
            {
                "coding": [
                    {
                        "system": "http://snomed.info/sct",
                        "code": str(4855003 + screening.grade),
                        "display": f"Diabetic Retinopathy Grade {screening.grade}"
                    }
                ]
            }
        ],
        "result": [
            {
                "display": "AI Diagnostic Confidence",
                "valueQuantity": {
                    "value": float(round(screening.confidence, 1)),
                    "unit": "%",
                    "system": "http://unitsofmeasure.org",
                    "code": "%"
                }
            }
        ],
        "presentedForm": [
            {
                "contentType": "application/pdf",
                "url": f"/api/report/{screening.id}"
            }
        ]
    }
    return fhir_doc


# ── PDF Builder (ReportLab) ──────────────────────────────────

def _build_pdf(screening, patient, validation) -> bytes:
    try:
        from reportlab.lib.pagesizes  import A4
        from reportlab.lib.styles     import getSampleStyleSheet, ParagraphStyle
        from reportlab.lib.units      import mm
        from reportlab.lib            import colors
        from reportlab.platypus       import (
            SimpleDocTemplate, Paragraph, Spacer,
            Table, TableStyle, HRFlowable
        )

        buf    = io.BytesIO()
        doc    = SimpleDocTemplate(buf, pagesize=A4,
                                   topMargin=20*mm, bottomMargin=20*mm,
                                   leftMargin=20*mm, rightMargin=20*mm)
        styles = getSampleStyleSheet()
        story  = []

        # ── Header ───────────────────────────────────────────
        title_style = ParagraphStyle("title", fontSize=16, fontName="Helvetica-Bold",
                                     textColor=colors.HexColor("#1d4ed8"), spaceAfter=4)
        story.append(Paragraph("RetinAI — Diabetic Retinopathy Screening Report", title_style))
        story.append(Paragraph(f"Report ID: {screening.id}", styles["Normal"]))
        story.append(Paragraph(
            f"Generated: {datetime.now(timezone.utc).strftime('%d %B %Y, %H:%M UTC')}",
            styles["Normal"]
        ))
        story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#1d4ed8")))
        story.append(Spacer(1, 6*mm))

        # ── Patient Info ─────────────────────────────────────
        story.append(Paragraph("Patient Information", styles["Heading2"]))
        pat_data = [
            ["Name",        patient.name    if patient else "—"],
            ["Age",         str(patient.age) if patient else "—"],
            ["Gender",      patient.gender  if patient else "—"],
            ["ABHA ID",     patient.abha_id or "Not provided" if patient else "—"],
            ["Village/PHC", patient.village or "—" if patient else "—"],
        ]
        story.append(_make_table(pat_data))
        story.append(Spacer(1, 6*mm))

        # ── AI Result ────────────────────────────────────────
        grade_color = {
            0: "#16a34a", 1: "#ca8a04",
            2: "#ea580c", 3: "#dc2626", 4: "#7f1d1d"
        }.get(screening.grade, "#374151")

        story.append(Paragraph("AI Screening Result", styles["Heading2"]))
        result_data = [
            ["Screening Date", screening.created_at.strftime("%d %B %Y") if screening.created_at else "—"],
            ["DR Grade",       f"{screening.grade} — {screening.grade_label}"],
            ["Confidence",     f"{screening.confidence:.1f}%"],
            ["Recommended Action", screening.action or "—"],
            ["Referral Required",  "YES" if screening.grade >= 2 else "NO"],
        ]
        story.append(_make_table(result_data))
        story.append(Spacer(1, 4*mm))

        # ── Clinical Findings ─────────────────────────────────
        story.append(Paragraph("Clinical Findings (AI Detected)", styles["Heading2"]))
        findings = screening.findings or []
        for i, f in enumerate(findings, 1):
            story.append(Paragraph(f"  {i}. {f}", styles["Normal"]))
        story.append(Spacer(1, 6*mm))

        # ── Doctor Validation ─────────────────────────────────
        story.append(Paragraph("Doctor Validation", styles["Heading2"]))
        if validation:
            val_data = [
                ["Status",        validation.action.capitalize()],
                ["Doctor ID",     validation.doctor_id or "—"],
                ["Validated At",  validation.validated_at.strftime("%d %B %Y, %H:%M") if validation.validated_at else "—"],
                ["Clinical Note", validation.note or "No additional notes"],
            ]
            if validation.override_reason:
                val_data.append(["Override Reason", validation.override_reason])
        else:
            val_data = [["Status", "Pending doctor validation"]]
        story.append(_make_table(val_data))
        story.append(Spacer(1, 6*mm))

        # ── Risk Stratification & DME ─────────────────────────
        story.append(Paragraph("Risk Stratification & Macular Status", styles["Heading2"]))
        dme_risk   = getattr(screening, "dme_risk", None) or "—"
        dme_notes  = getattr(screening, "dme_notes", None) or "—"
        prog_risk  = getattr(screening, "progression_risk_5yr", None)
        sys_risk   = getattr(screening, "systemic_risk", None) or "—"
        timeline   = getattr(screening, "recommended_action_timeline", None) or screening.action or "—"
        doc_summ   = getattr(screening, "doctor_summary", None)

        risk_data = [
            ["DME / Macular Status",  dme_risk.replace("_", " ").title()],
            ["Macular Notes",          dme_notes],
            ["5-Year Progression Risk", f"{prog_risk}%" if prog_risk is not None else "—"],
            ["Systemic Risk Level",   sys_risk.upper()],
            ["Recommended Timeline",  timeline],
        ]
        story.append(_make_table(risk_data))
        story.append(Spacer(1, 4*mm))

        if doc_summ:
            story.append(Paragraph("Doctor Referral Summary", styles["Heading2"]))
            summ_style = ParagraphStyle("summ", fontSize=9, leading=14, textColor=colors.HexColor("#374151"))
            story.append(Paragraph(doc_summ, summ_style))
            story.append(Spacer(1, 6*mm))

        # ── Signature ─────────────────────────────────────────
        story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
        story.append(Spacer(1, 4*mm))
        story.append(Paragraph("Doctor Signature: _______________________    Date: ___________", styles["Normal"]))
        story.append(Spacer(1, 6*mm))

        # ── Disclaimer ────────────────────────────────────────
        disc_style = ParagraphStyle("disc", fontSize=7, textColor=colors.grey)
        story.append(Paragraph(
            "DISCLAIMER: This report is generated by RetinAI, an AI-assisted screening tool. "
            "It is intended to support, not replace, clinical judgment. "
            "All referral decisions must be validated by a qualified medical professional. "
            "RetinAI | SIH26038 | MathWorks | SIH 2026",
            disc_style
        ))

        doc.build(story)
        return buf.getvalue()

    except ImportError:
        logger.error("ReportLab not installed")
        raise HTTPException(status_code=500, detail={
            "error": "PDF_UNAVAILABLE",
            "message": "PDF generation library not available. Install reportlab."
        })


def _make_table(data: list) -> "Table":
    from reportlab.platypus import Table, TableStyle
    from reportlab.lib      import colors
    from reportlab.lib.units import mm

    tbl = Table(data, colWidths=[55*mm, 115*mm])
    tbl.setStyle(TableStyle([
        ("BACKGROUND",  (0, 0), (0, -1), colors.HexColor("#eff6ff")),
        ("FONTNAME",    (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE",    (0, 0), (-1, -1), 9),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f8fafc")]),
        ("GRID",        (0, 0), (-1, -1), 0.5, colors.HexColor("#e2e8f0")),
        ("VALIGN",      (0, 0), (-1, -1), "TOP"),
        ("PADDING",     (0, 0), (-1, -1), 4),
    ]))
    return tbl
