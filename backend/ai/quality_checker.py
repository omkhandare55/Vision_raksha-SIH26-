# backend/ai/quality_checker.py
# Module 1 — Image Quality Assessment
# Spec: TRD Section 4.1
# Accepts/rejects/enhances fundus images before AI grading

import io
import cv2
import numpy as np
from PIL import Image
from dataclasses import dataclass
from enum import Enum


class QualityAction(str, Enum):
    ACCEPT  = "accepted"
    ENHANCE = "enhanced"
    REJECT  = "rejected"


@dataclass
class QualityResult:
    score:     float         # 0.0 – 1.0
    action:    QualityAction
    enhanced:  bool
    image:     np.ndarray    # display image (original or CLAHE-enhanced)
    raw_image: np.ndarray    # always the original — passed to model
    details:   dict          # sub-scores for debugging



class QualityChecker:
    """
    Rule-based image quality gate per TRD 4.1.

    Thresholds (from TRD):
      score >= 0.8  → ACCEPT  (process as-is)
      score  0.5–0.8 → ENHANCE (apply CLAHE, then accept)
      score <  0.5  → REJECT  (ask user to retake)
    """

    ACCEPT_THRESHOLD  = 0.8
    ENHANCE_THRESHOLD = 0.5

    # ── sub-score thresholds calibrated for clinical fundus cameras ─
    FOCUS_MIN       = 25.0    # Laplacian variance (healthy smooth retina is ~40–80)
    BRIGHTNESS_MIN  = 12.0    # Average brightness with black circular border
    BRIGHTNESS_MAX  = 240.0
    COVERAGE_MIN    = 0.35    # fraction of non-black pixels

    def assess(self, image_bytes: bytes) -> QualityResult:
        """
        Main entry point.
        Args:
            image_bytes: raw bytes of uploaded image
        Returns:
            QualityResult with score, action, raw_image (for model),
            and image (for display, possibly CLAHE-enhanced)
        """
        img = self._load(image_bytes)
        details = self._score(img)
        score = self._aggregate(details)

        if score >= self.ACCEPT_THRESHOLD:
            return QualityResult(score, QualityAction.ACCEPT, False, img, img, details)

        if score >= self.ENHANCE_THRESHOLD:
            enhanced = self._apply_clahe(img)
            return QualityResult(score, QualityAction.ENHANCE, True, enhanced, img, details)

        return QualityResult(score, QualityAction.REJECT, False, img, img, details)

    # ── private helpers ─────────────────────────────────────

    def _load(self, image_bytes: bytes) -> np.ndarray:
        """Decode bytes → RGB numpy array."""
        pil = Image.open(io.BytesIO(image_bytes)).convert("RGB")
        return np.array(pil)

    def _score(self, img: np.ndarray) -> dict:
        """Compute individual quality sub-scores."""
        gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)

        # Focus — Laplacian variance (higher = sharper)
        focus_val  = float(cv2.Laplacian(gray, cv2.CV_64F).var())
        focus_ok   = focus_val >= self.FOCUS_MIN
        focus_norm = min(max(focus_val / (self.FOCUS_MIN * 2.5), 0.1), 1.0)   # normalise to [0,1]

        # Brightness — mean pixel value inside the retinal area
        retina_mask = gray > 15
        if retina_mask.any():
            retina_bright = float(gray[retina_mask].mean())
        else:
            retina_bright = float(gray.mean())

        bright_val = float(gray.mean())
        overexposed = retina_bright >= self.BRIGHTNESS_MAX
        bright_ok  = (retina_bright >= 30.0 or bright_val >= self.BRIGHTNESS_MIN) and not overexposed
        if overexposed:
            bright_norm = max(0.0, 1.0 - (retina_bright - self.BRIGHTNESS_MAX) / 15.0)
        else:
            bright_norm = 1.0 if bright_ok else max(0.0, bright_val / self.BRIGHTNESS_MIN)

        # Coverage — fraction of non-black pixels (retina area)
        coverage   = float((gray > 15).mean())
        cov_ok     = coverage >= self.COVERAGE_MIN
        cov_norm   = min(coverage / self.COVERAGE_MIN, 1.0)

        # ── Fundus vs External Eye / Selfie Detection ──────────
        # 1. Fundus cameras produce a circular field with black border/corners.
        # 2. Unbordered fundus photos have deep orange/red hue (H in [0,25] or [170,180] & S > 80).
        # 3. External eye selfies have skin tones, sclera, eyelashes and H > 30.
        corners = [
            img[:25, :25],
            img[:25, -25:],
            img[-25:, :25],
            img[-25:, -25:],
        ]
        corners_dark = all(float(c.mean()) < 35 for c in corners)

        hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
        h_channel = hsv[:, :, 0]
        s_channel = hsv[:, :, 1]
        fundus_pixels = ((h_channel <= 25) | (h_channel >= 170)) & (s_channel > 75)
        fundus_ratio = float(fundus_pixels.mean())

        is_fundus = corners_dark or (fundus_ratio > 0.35)

        return {
            "focus_value":      focus_val,
            "focus_ok":         focus_ok,
            "focus_score":      round(focus_norm, 3),
            "brightness_value": bright_val,
            "brightness_ok":    bright_ok,
            "overexposed":      overexposed,
            "brightness_score": round(bright_norm, 3),
            "coverage_value":   round(coverage, 3),
            "coverage_ok":      cov_ok,
            "coverage_score":   round(cov_norm, 3),
            "is_fundus":        is_fundus,
            "fundus_score":     1.0 if is_fundus else 0.1,
        }

    def _aggregate(self, details: dict) -> float:
        """Weighted average of sub-scores → single quality score."""
        if not details.get("is_fundus", True):
            return 0.2  # Immediate REJECT if not a fundus image

        weights = {
            "focus_score":      0.45,
            "brightness_score": 0.25,
            "coverage_score":   0.30,
        }
        score = sum(details[k] * w for k, w in weights.items() if k in details)
        return round(score, 3)

    def _apply_clahe(self, img: np.ndarray) -> np.ndarray:
        """
        CLAHE on L channel of LAB colour space.
        Preserves colour while improving retinal contrast.
        Spec: TRD 4.1 + TRD 11.3
        """
        lab = cv2.cvtColor(img, cv2.COLOR_RGB2LAB)
        l, a, b = cv2.split(lab)
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        l_eq = clahe.apply(l)
        enhanced_lab = cv2.merge([l_eq, a, b])
        return cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2RGB)

    def enhance_full(self, img: np.ndarray) -> np.ndarray:
        """
        Full multi-step enhancement pipeline for display and CV segmentation.
        Steps: CLAHE → Adaptive Gamma → Bilateral Denoise → Unsharp Mask Sharpen.
        Does NOT modify the original — returns a new enhanced copy.
        """
        enhanced = img.copy()

        # Step 1: CLAHE contrast enhancement
        enhanced = self._apply_clahe(enhanced)

        # Step 2: Adaptive gamma correction (brighten dark images, dim overexposed)
        gray_mean = float(cv2.cvtColor(enhanced, cv2.COLOR_RGB2GRAY).mean())
        if gray_mean < 80:
            gamma = 0.7   # brighten dark fundus images
        elif gray_mean > 200:
            gamma = 1.4   # tone down overexposed images
        else:
            gamma = 1.0   # no change needed
        if gamma != 1.0:
            inv_gamma = 1.0 / gamma
            lut = np.array([((i / 255.0) ** inv_gamma) * 255
                            for i in range(256)]).astype(np.uint8)
            enhanced = cv2.LUT(enhanced, lut)

        # Step 3: Bilateral filter for edge-preserving denoising
        bgr = cv2.cvtColor(enhanced, cv2.COLOR_RGB2BGR)
        denoised = cv2.bilateralFilter(bgr, d=7, sigmaColor=50, sigmaSpace=50)
        enhanced = cv2.cvtColor(denoised, cv2.COLOR_BGR2RGB)

        # Step 4: Unsharp mask sharpening (enhance vessel and lesion edges)
        blurred = cv2.GaussianBlur(enhanced, (0, 0), sigmaX=2.0)
        enhanced = cv2.addWeighted(enhanced, 1.4, blurred, -0.4, 0)

        return np.clip(enhanced, 0, 255).astype(np.uint8)

    def get_rejection_message(self, details: dict) -> list[str]:
        """Return human-readable suggestions when image is rejected."""
        suggestions = []
        if not details.get("is_fundus", True):
            suggestions.append(
                "External eye photo detected. RetinAI requires a Retinal Fundus image (interior retina) captured via fundus camera or smartphone retinal lens attachment."
            )
        if not details["focus_ok"]:
            suggestions.append("Image is blurry — hold the camera steady")
        if not details["brightness_ok"]:
            if details.get("overexposed", False):
                suggestions.append("Image overexposed — reduce glare and lighting")
            elif details["brightness_value"] < self.BRIGHTNESS_MIN:
                suggestions.append("Image too dark — improve lighting")
            else:
                suggestions.append("Image brightness issue — adjust lighting")
        if not details["coverage_ok"]:
            suggestions.append("Retina not fully visible — adjust camera angle")
        return suggestions or ["Please retake the image"]


# ── Singleton for import ─────────────────────────────────────
quality_checker = QualityChecker()

