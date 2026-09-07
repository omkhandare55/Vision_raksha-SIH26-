# backend/ai/pipeline.py
# Full Analysis Pipeline Orchestrator
# Ties together: QualityChecker → DRGrader → GradCAM → ImageAnalyzer → FindingsGenerator
#
# Key design: model sees raw_image (no CLAHE), display/heatmap uses enhanced image.

import io
import base64
import logging
import time
import numpy as np
from PIL import Image
from dataclasses import dataclass, field

from ai.quality_checker import QualityChecker, QualityAction
from ai.dr_grader       import DRGrader, GradeResult
from ai.gradcam         import GradCAMEngine
from ai.findings        import FindingsGenerator, FindingsResult

logger = logging.getLogger(__name__)


@dataclass
class PipelineResult:
    # Quality
    quality_score:    float
    quality_action:   str
    quality_enhanced: bool

    # Grade
    grade:            int
    grade_label:      str
    confidence:       float
    action:           str
    color:            str
    probabilities:    dict

    # Explainability
    original_b64:     str       # base64 JPEG of (enhanced) original
    heatmap_b64:      str       # base64 JPEG of Grad-CAM overlay

    # Findings
    findings:         list[str]
    referral:         bool
    urgency:          str
    icdrs_notes:      str

    # Multi-Modal Risk & DME
    systemic_risk:               str   = "low"
    progression_risk_5yr:        float = 5.0
    doctor_summary:              str   = ""
    dme_risk:                    str   = "none"
    dme_notes:                   str   = ""
    recommended_action_timeline: str   = ""
    evidence_chain:              list  = field(default_factory=list)

    # Meta
    processing_ms:    int   = 0
    demo_mode:        bool  = False


class AnalysisPipeline:
    """
    Full DR screening pipeline:
      1. QualityChecker  — accept / enhance / reject
      2. DRGrader        — EfficientNet-B5 + TTA → grade 0–4
      3. GradCAMEngine   — attention heatmap
      4. FindingsGenerator — clinical text + multi-modal risk

    Key: raw_image (no CLAHE) → model. Enhanced image → display/heatmap.
    """

    def __init__(self, model_path: str, device: str = "cpu"):
        self.quality_checker = QualityChecker()
        self.grader          = DRGrader(model_path, device)
        self.findings_gen    = FindingsGenerator()
        self.gradcam         = GradCAMEngine(self.grader.model, device)
        self.demo_mode       = not self.grader.is_loaded()

        logger.info(
            f"AnalysisPipeline ready | "
            f"model={'loaded' if not self.demo_mode else 'DEMO MODE'} | "
            f"device={device}"
        )

    # ── Public API ───────────────────────────────────────────

    def analyse(
        self,
        image_bytes:    bytes,
        age:            int   = None,
        hba1c:          float = None,
        diabetes_years: int   = None,
        sys_bp:         int   = None,
    ) -> PipelineResult:
        """
        Run full multi-modal pipeline with Patient Age and Clinical Vitals.
        Model sees raw image (no CLAHE). Display uses enhanced image.
        """
        t0 = time.monotonic()

        # ── Step 1: Quality ──────────────────────────────────
        q = self.quality_checker.assess(image_bytes)

        if q.action == QualityAction.REJECT:
            msgs = self.quality_checker.get_rejection_message(q.details)
            raise ValueError(f"IMAGE_QUALITY_INSUFFICIENT: {'; '.join(msgs)}")

        raw_image     = q.raw_image   # original, un-enhanced → for MODEL
        display_image = q.image       # possibly CLAHE-enhanced → for DISPLAY

        # ── Step 2: Grade (model sees raw_image) ─────────────
        tensor       = self.grader.preprocess(raw_image)
        grade_result = self.grader.grade(tensor)

        # ── Step 3: Grad-CAM (overlay on display image) ──────
        cam_out = self.gradcam.generate(
            tensor    = tensor,
            class_idx = grade_result.grade,
            original  = display_image,
        )

        # ── Step 4: CV Feature Analysis (supplementary) ──────
        # Use fully enhanced image for better vessel/lesion detection.
        # Model grading (Step 2) still uses raw_image — this is correct.
        cv_features = None
        try:
            from ai.image_analyzer import analyze_image
            enhanced_for_cv = self.quality_checker.enhance_full(raw_image)
            cv_features = analyze_image(enhanced_for_cv)
        except Exception:
            pass  # CV analysis is optional

        # ── Step 5: Findings & Multi-Modal Risk ──────────────
        findings_result = self.findings_gen.generate(
            grade          = grade_result.grade,
            cam_array      = cam_out.get("cam_array"),
            confidence     = grade_result.confidence,
            cv_features    = cv_features,
            age            = age,
            hba1c          = hba1c,
            diabetes_years = diabetes_years,
            sys_bp         = sys_bp,
        )

        processing_ms = max(1, int((time.monotonic() - t0) * 1000))

        return PipelineResult(
            # quality
            quality_score    = q.score,
            quality_action   = q.action.value,
            quality_enhanced = q.enhanced,

            # grade
            grade            = grade_result.grade,
            grade_label      = grade_result.grade_label,
            confidence       = grade_result.confidence,
            action           = grade_result.action,
            color            = grade_result.color,
            probabilities    = grade_result.probabilities,

            # images
            original_b64     = self._encode(display_image),
            heatmap_b64      = cam_out["heatmap_b64"],

            # findings
            findings         = findings_result.findings,
            referral         = findings_result.referral,
            urgency          = findings_result.urgency,
            icdrs_notes      = findings_result.icdrs_notes,

            # multi-modal & dme
            systemic_risk               = findings_result.systemic_risk,
            progression_risk_5yr        = findings_result.progression_risk_5yr,
            doctor_summary              = findings_result.doctor_summary,
            dme_risk                    = findings_result.dme_risk,
            dme_notes                   = findings_result.dme_notes,
            recommended_action_timeline = findings_result.recommended_action_timeline,
            evidence_chain              = findings_result.evidence_chain,

            # meta
            processing_ms    = processing_ms,
            demo_mode        = self.demo_mode,
        )

    # ── Private ──────────────────────────────────────────────

    def _encode(self, img: np.ndarray) -> str:
        """numpy RGB → base64 JPEG string."""
        buf = io.BytesIO()
        Image.fromarray(img.astype(np.uint8)).save(buf, format="JPEG", quality=85)
        return base64.b64encode(buf.getvalue()).decode("utf-8")


# ── Lazy singleton (initialised in main.py startup) ──────────
_pipeline: AnalysisPipeline | None = None


def get_pipeline() -> AnalysisPipeline:
    """FastAPI dependency — returns shared pipeline instance."""
    if _pipeline is None:
        raise RuntimeError("Pipeline not initialised — call init_pipeline() first")
    return _pipeline


def init_pipeline(model_path: str, device: str = "cpu") -> AnalysisPipeline:
    """Call once at FastAPI startup event."""
    global _pipeline
    _pipeline = AnalysisPipeline(model_path, device)
    return _pipeline
