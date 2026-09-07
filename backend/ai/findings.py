# backend/ai/findings.py
# Module — Clinical Findings Generator
# Spec: TRD Section 4.5 / PRD FR-016
# Maps DR grade → human-readable clinical findings list

from dataclasses import dataclass
from typing import Optional
import numpy as np


@dataclass
class FindingsResult:
    findings:                    list[str]   # clinical findings list (shown in UI + PDF)
    referral:                    bool        # True if Grade >= 2 or DME present
    urgency:                     str         # "none" | "routine" | "urgent" | "emergency"
    icdrs_notes:                 str         # ICDRS scale explanation for PDF report
    systemic_risk:               str = "low" # "low" | "moderate" | "high" | "critical"
    progression_risk_5yr:        float = 5.0 # estimated 5-year progression risk %
    doctor_summary:              str = ""    # referral summary letter text
    dme_risk:                    str = "none" # "none" | "suspected" | "high_risk"
    dme_notes:                   str = ""    # clinical notes regarding macular edema
    recommended_action_timeline: str = ""    # explicit clinical follow-up timeframe
    evidence_chain:              list = None # structured lesion-to-ICDRS evidence mapping


# ── Findings map per grade (TRD 4.5) ────────────────────────

_FINDINGS_MAP: dict[int, list[str]] = {
    0: [
        "No lesions detected",
        "Normal retinal vasculature",
        "No microaneurysms identified",
        "No haemorrhages detected",
        "Optic disc and fovea appear normal",
    ],
    1: [
        "Microaneurysms detected (early-stage indicator)",
        "Minimal vascular changes noted",
        "No haemorrhages or exudates identified",
        "Fovea appears uninvolved",
    ],
    2: [
        "Multiple microaneurysms detected",
        "Hard exudate patches present",
        "Mild haemorrhages noted",
        "Vascular wall changes observed",
        "Fovea not yet involved",
    ],
    3: [
        "Extensive haemorrhages in retinal quadrants",
        "Cotton wool spots (nerve fibre layer infarcts) present",
        "Venous beading observed",
        "Intraretinal microvascular abnormalities (IRMA) detected",
        "Moderate-to-severe vascular compromise",
    ],
    4: [
        "Neovascularisation detected (new abnormal vessel growth)",
        "Fibrous proliferative tissue present",
        "High risk of vitreous haemorrhage",
        "Risk of tractional retinal detachment",
        "Immediate ophthalmology intervention required",
    ],
}

_ICDRS_NOTES: dict[int, str] = {
    0: "Grade 0 — No Diabetic Retinopathy: No abnormalities present per ICDRS scale.",
    1: "Grade 1 — Mild NPDR: Microaneurysms only. Annual follow-up recommended.",
    2: "Grade 2 — Moderate NPDR: More than microaneurysms but less than severe NPDR. Referral indicated.",
    3: "Grade 3 — Severe NPDR: Any of: 20+ intraretinal haemorrhages in all 4 quadrants, venous beading in 2+ quadrants, or IRMA. Urgent referral.",
    4: "Grade 4 — Proliferative DR: Neovascularisation and/or vitreous / pre-retinal haemorrhage. Emergency intervention.",
}

_URGENCY: dict[int, str] = {
    0: "none",
    1: "none",
    2: "routine",
    3: "urgent",
    4: "emergency",
}


class FindingsGenerator:
    """
    Multi-Modal Clinical Findings Generator:
      - DR grade & Grad-CAM heatmap intensity
      - CV feature counts (supplementary — does NOT affect grade)
      - Patient Vitals (HbA1c, BP, Diabetes Duration)
      - Computes 5-Year Progression Risk & Clinical Discharge Notes
    """

    def generate(
        self,
        grade:          int,
        cam_array:      Optional[np.ndarray] = None,
        confidence:     float = 100.0,
        cv_features:    object = None,
        age:            Optional[int]   = None,
        hba1c:          Optional[float] = None,
        diabetes_years: Optional[int]   = None,
        sys_bp:         Optional[int]   = None,
    ) -> FindingsResult:
        """
        Multi-modal clinical generation combining AI vision + patient vitals (Age, HbA1c, Duration, BP).
        cv_features: optional AnalysisFeatures from image_analyzer (supplementary only).
        """
        if grade not in _FINDINGS_MAP:
            grade = 0

        findings = list(_FINDINGS_MAP[grade])

        # Add CAM intensity details if present
        if cam_array is not None:
            high_attention_ratio = float((cam_array > 0.6).mean())
            if high_attention_ratio > 0.15:
                findings.append(
                    f"High-intensity lesion concentration ({high_attention_ratio:.1%} of image area)"
                )
            elif high_attention_ratio > 0.05:
                findings.append("Localized focal lesion clusters identified")

        # Add CV feature counts as supplementary clinical text
        if cv_features is not None:
            try:
                ma = getattr(cv_features, "microaneurysm_count", 0)
                ex = getattr(cv_features, "exudate_count", 0)
                if ma > 0:
                    findings.append(f"Approximately {ma} microaneurysm-like features detected via image analysis")
                if ex > 0:
                    findings.append(f"Approximately {ex} exudate-like bright patches detected via image analysis")
            except Exception:
                pass

        # Low confidence caveat
        if confidence < 60.0:
            findings.append(
                f"Note: Model confidence is {confidence:.1f}% — repeat scan recommended if clinical suspicion is high."
            )

        # ── Multi-Modal Vitals Risk Computation ─────────────
        systemic_risk = "low"
        base_5yr_risk = [3.0, 15.0, 45.0, 75.0, 95.0][grade]

        vitals_notes = []
        multiplier = 1.0

        # Patient Age impact (WESDR / UKPDS epidemiological guidelines)
        if age is not None:
            if age >= 65:
                multiplier *= 1.3
                vitals_notes.append(f"Advanced Patient Age ({age} yrs) increases microvascular vulnerability")
            elif age >= 50:
                multiplier *= 1.15
                vitals_notes.append(f"Patient Age ({age} yrs) indicates elevated risk of DR progression")

        if hba1c is not None:
            if hba1c >= 9.0:
                multiplier *= 1.8
                vitals_notes.append(f"Uncontrolled Glycemia (HbA1c {hba1c}%) increases vision loss risk")
            elif hba1c >= 7.5:
                multiplier *= 1.3
                vitals_notes.append(f"Elevated HbA1c ({hba1c}%) accelerates microvascular damage")

        if diabetes_years is not None and diabetes_years >= 10:
            multiplier *= 1.4
            vitals_notes.append(f"Longstanding Diabetes ({diabetes_years} yrs) increases proliferative risk")

        if sys_bp is not None and sys_bp >= 140:
            multiplier *= 1.3
            vitals_notes.append(f"Systolic Hypertension ({sys_bp} mmHg) aggravates retinal edema")

        progression_5yr = min(99.0, round(base_5yr_risk * multiplier, 1))

        if progression_5yr >= 70.0 or grade >= 3:
            systemic_risk = "critical"
        elif progression_5yr >= 40.0 or grade == 2:
            systemic_risk = "high"
        elif progression_5yr >= 20.0 or grade == 1:
            systemic_risk = "moderate"

        findings.extend(vitals_notes)

        # ── DME / Macular Edema Evaluation ──────────────────
        dme_risk = "none"
        dme_notes = "No macular edema identified."
        macular_ex = getattr(cv_features, "macular_exudate_count", 0) if cv_features else 0
        dme_flag = getattr(cv_features, "dme_detected", False) if cv_features else False

        if dme_flag or macular_ex >= 1:
            if macular_ex >= 3 or grade >= 2:
                dme_risk = "high_risk"
                dme_notes = "Clinically Significant Macular Edema (CSME) suspected: clustered hard exudates within 1 disc diameter of fovea."
                findings.append("Diabetic Macular Edema (CSME): Perifoveal exudates detected")
            else:
                dme_risk = "suspected"
                dme_notes = "Early macular edema suspected: isolated hard exudates near central retina."
                findings.append("Perifoveal lipid exudation observed (early DME marker)")

        # ── Cross-Validation & Anomaly Notice ───────────────
        if grade == 0 and cv_features is not None:
            ma_cnt = getattr(cv_features, "microaneurysm_count", 0)
            hem_cov = getattr(cv_features, "hemorrhage_area", 0.0)
            if ma_cnt >= 3 or hem_cov >= 0.005:
                findings.append(
                    "Cross-Validation Notice: Subtle micro-vascular lesions flagged by morphological scanner — physician review advised."
                )

        # ── Clinical Action Timeline (ICDRS Guidelines) ─────
        if grade == 0 and dme_risk == "none":
            action_timeline = "Routine annual rescreening in 12 months"
        elif grade == 1 and dme_risk == "none":
            action_timeline = "Follow-up rescreening in 6–12 months"
        elif dme_risk != "none" and grade < 2:
            action_timeline = "Ophthalmology consult within 4 weeks (macular involvement)"
        elif grade == 2:
            action_timeline = "Ophthalmology referral within 2–4 weeks"
        elif grade == 3:
            action_timeline = "Urgent Ophthalmology referral within 1–2 weeks"
        else: # grade 4
            action_timeline = "Emergency Vitreo-Retinal intervention within 24–48 hours"

        # Determine final referral and urgency
        requires_referral = (grade >= 2) or (dme_risk != "none")
        urgency_level = _URGENCY[grade]
        if dme_risk == "high_risk" and urgency_level in ["none", "routine"]:
            urgency_level = "urgent"
        elif dme_risk == "suspected" and urgency_level == "none":
            urgency_level = "routine"

        # ── Doctor Referral Summary Text ─────────────────────
        doctor_summary = (
            f"Patient evaluated for Diabetic Retinopathy. AI Screening classified image as "
            f"{_ICDRS_NOTES[grade]} DME Risk: {dme_risk.upper()}. 5-Year Estimated Vision Loss Risk: {progression_5yr}%. "
            f"Recommended Action: {action_timeline} (Urgency: {urgency_level.upper()})."
        )

        # ── Lesion-to-ICDRS Evidence Chain ────────────────────
        evidence_chain = self._build_evidence_chain(grade, cv_features)

        return FindingsResult(
            findings                     = findings,
            referral                     = requires_referral,
            urgency                      = urgency_level,
            icdrs_notes                  = _ICDRS_NOTES[grade],
            systemic_risk                = systemic_risk,
            progression_risk_5yr         = progression_5yr,
            doctor_summary               = doctor_summary,
            dme_risk                     = dme_risk,
            dme_notes                    = dme_notes,
            recommended_action_timeline  = action_timeline,
            evidence_chain               = evidence_chain,
        )

    def _build_evidence_chain(self, grade: int, cv_features: object = None) -> list:
        """
        Build structured lesion-to-ICDRS evidence mapping.
        Each item is a dict with: feature_type, count_or_area, icdrs_criterion,
        clinical_significance, supports_grade.

        This is the key explainability feature mapping detected pathology
        to the specific ICDRS criteria that justify the assigned grade.
        """
        evidence = []

        ma_count = getattr(cv_features, "microaneurysm_count", 0) if cv_features else 0
        ex_count = getattr(cv_features, "exudate_count", 0) if cv_features else 0
        hem_area = getattr(cv_features, "hemorrhage_area", 0.0) if cv_features else 0.0
        dot_hem = getattr(cv_features, "dot_hemorrhage_count", 0) if cv_features else 0
        blot_hem = getattr(cv_features, "blot_hemorrhage_count", 0) if cv_features else 0
        flame_hem = getattr(cv_features, "flame_hemorrhage_count", 0) if cv_features else 0
        hem_quads = getattr(cv_features, "hemorrhage_quadrant_count", 0) if cv_features else 0
        nv_detected = getattr(cv_features, "neovascularization_detected", False) if cv_features else False
        nv_conf = getattr(cv_features, "neovascularization_confidence", 0.0) if cv_features else 0.0
        od_center = getattr(cv_features, "optic_disc_center", None) if cv_features else None
        vessel_density = getattr(cv_features, "vessel_density", 0.0) if cv_features else 0.0
        tortuosity = getattr(cv_features, "tortuosity_index", 0.0) if cv_features else 0.0
        dme_flag = getattr(cv_features, "dme_detected", False) if cv_features else False

        # --- Microaneurysms ---
        if ma_count > 0:
            if ma_count <= 5:
                criterion = "Mild NPDR: microaneurysms only"
                supports = 1
            else:
                criterion = "Moderate NPDR: more than just microaneurysms"
                supports = 2
            evidence.append({
                "feature_type": "Microaneurysms",
                "count_or_area": f"{ma_count} detected",
                "icdrs_criterion": criterion,
                "clinical_significance": "Earliest sign of DR — capillary wall weakening",
                "supports_grade": supports,
            })

        # --- Hard Exudates ---
        if ex_count > 0:
            evidence.append({
                "feature_type": "Hard Exudates",
                "count_or_area": f"{ex_count} lesions",
                "icdrs_criterion": "Moderate NPDR: lipid deposits from leaking vasculature",
                "clinical_significance": "Indicates blood-retinal barrier breakdown",
                "supports_grade": 2,
            })

        # --- Hemorrhages (with sub-classification) ---
        total_hem = dot_hem + blot_hem + flame_hem
        if total_hem > 0 or hem_area > 0.001:
            sub_detail = f"Dot:{dot_hem} Blot:{blot_hem} Flame:{flame_hem}"
            if hem_quads >= 4 and total_hem >= 20:
                criterion = "Severe NPDR (4-2-1 rule): ≥20 hemorrhages in all 4 quadrants"
                supports = 3
            elif hem_quads >= 2:
                criterion = "Moderate-to-Severe NPDR: hemorrhages in multiple quadrants"
                supports = 2
            else:
                criterion = "Moderate NPDR: intraretinal hemorrhages present"
                supports = 2
            evidence.append({
                "feature_type": "Hemorrhages",
                "count_or_area": f"{sub_detail} | Area: {hem_area:.4f} | Quadrants: {hem_quads}/4",
                "icdrs_criterion": criterion,
                "clinical_significance": "Ruptured retinal capillaries — severity correlates with quadrant spread",
                "supports_grade": supports,
            })

        # --- Neovascularization ---
        if nv_detected:
            evidence.append({
                "feature_type": "Neovascularization (NVD/NVE)",
                "count_or_area": f"Detected (confidence: {nv_conf:.0%})",
                "icdrs_criterion": "Proliferative DR: new abnormal vessel growth",
                "clinical_significance": "Immediate risk of vitreous hemorrhage and retinal detachment",
                "supports_grade": 4,
            })

        # --- Diabetic Macular Edema ---
        if dme_flag:
            evidence.append({
                "feature_type": "Diabetic Macular Edema (DME)",
                "count_or_area": "CSME suspected",
                "icdrs_criterion": "Macular involvement — independent referral indicator",
                "clinical_significance": "Central vision threatened regardless of DR grade",
                "supports_grade": max(grade, 2),
            })

        # --- Vessel Abnormalities ---
        if tortuosity > 5.0 or vessel_density > 0.15:
            evidence.append({
                "feature_type": "Vascular Abnormalities",
                "count_or_area": f"Density: {vessel_density:.4f} | Tortuosity: {tortuosity:.3f}",
                "icdrs_criterion": "Vascular compromise indicator",
                "clinical_significance": "Elevated vessel tortuosity/density may indicate IRMA or venous beading",
                "supports_grade": 3 if tortuosity > 8.0 else 2,
            })

        # --- Optic Disc Localization (structural) ---
        if od_center is not None:
            evidence.append({
                "feature_type": "Optic Disc",
                "count_or_area": f"Center: ({od_center[0]}, {od_center[1]})",
                "icdrs_criterion": "Structural landmark — reference for NV and macular proximity",
                "clinical_significance": "Successfully localized for spatial lesion analysis",
                "supports_grade": grade,
            })

        # --- No pathology found ---
        if not evidence:
            evidence.append({
                "feature_type": "No Pathology",
                "count_or_area": "None detected",
                "icdrs_criterion": "Grade 0: No abnormalities",
                "clinical_significance": "Normal retinal appearance",
                "supports_grade": 0,
            })

        return evidence


# ── Singleton ────────────────────────────────────────────────
findings_generator = FindingsGenerator()

