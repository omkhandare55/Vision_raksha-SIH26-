"""
Tests for newly added clinical features required by SIH26038 (MathWorks):
  - Optic disc localization & fovea estimation
  - Hemorrhage sub-classification (dot, blot, flame)
  - Neovascularization detection
  - Referable DR clinical metrics (>90% sensitivity, >85% specificity)
  - Lesion-to-ICDRS evidence chain generation
"""

import pytest
import numpy as np
from ai.image_analyzer import analyze_image, AnalysisFeatures
from ai.dr_grader import compute_referable_dr_metrics
from ai.findings import findings_generator, FindingsResult

def test_analyze_image_new_fields():
    # Create synthetic retinal image (500x500 RGB)
    img = np.zeros((500, 500, 3), dtype=np.uint8)
    # Orange-red retinal background
    cv2_circle_mask = np.zeros((500, 500), dtype=np.uint8)
    import cv2
    cv2.circle(cv2_circle_mask, (250, 250), 220, 255, -1)
    img[cv2_circle_mask > 0] = [180, 80, 20] # Orange-red fundus

    # Bright optic disc
    cv2.circle(img, (150, 250), 30, [255, 230, 180], -1)

    # Some small dark spots (microaneurysms)
    cv2.circle(img, (280, 240), 3, [80, 10, 10], -1)
    cv2.circle(img, (290, 260), 3, [80, 10, 10], -1)

    features = analyze_image(img)
    assert isinstance(features, AnalysisFeatures)

    # Verify new fields exist and have correct types
    assert hasattr(features, "optic_disc_center")
    assert hasattr(features, "optic_disc_radius")
    assert hasattr(features, "fovea_center")
    assert hasattr(features, "dot_hemorrhage_count")
    assert hasattr(features, "blot_hemorrhage_count")
    assert hasattr(features, "flame_hemorrhage_count")
    assert hasattr(features, "hemorrhage_quadrant_count")
    assert hasattr(features, "neovascularization_detected")
    assert hasattr(features, "neovascularization_confidence")

    # If OD was localized, fovea should be estimated
    if features.optic_disc_center is not None:
        assert features.fovea_center is not None

def test_referable_dr_metrics_computation():
    # 10 patients: 5 non-referable (0, 1), 5 referable (2, 3, 4)
    ground_truth = [0, 0, 1, 1, 0, 2, 2, 3, 3, 4]
    predictions  = [0, 0, 1, 1, 0, 2, 2, 3, 2, 4] # Perfect referable classification

    metrics = compute_referable_dr_metrics(predictions, ground_truth, referable_threshold=2)

    assert metrics["referable_threshold"] == 2
    assert metrics["sensitivity"] == 100.0
    assert metrics["specificity"] == 100.0
    assert metrics["meets_sensitivity_target"] is True
    assert metrics["meets_specificity_target"] is True
    assert "confusion_matrix" in metrics
    assert "quadratic_weighted_kappa" in metrics
    assert metrics["quadratic_weighted_kappa"] > 0.90

def test_evidence_chain_generation():
    features = AnalysisFeatures(
        microaneurysm_count=4,
        exudate_count=3,
        hemorrhage_area=0.015,
        vessel_density=0.12,
        red_intensity=120.0,
        dark_spot_count=5,
        bright_spot_count=8,
        contrast_score=0.45,
        raw_score=2.3,
        macular_exudate_count=2,
        dme_detected=True,
        dot_hemorrhage_count=6,
        blot_hemorrhage_count=4,
        flame_hemorrhage_count=2,
        hemorrhage_quadrant_count=3,
        neovascularization_detected=False,
    )

    result = findings_generator.generate(
        grade=2,
        cv_features=features,
        age=58,
        hba1c=8.2,
        diabetes_years=12,
        sys_bp=145,
    )

    assert isinstance(result, FindingsResult)
    assert result.evidence_chain is not None
    assert len(result.evidence_chain) > 0

    # Verify structured evidence items contain required fields
    for item in result.evidence_chain:
        assert "feature_type" in item
        assert "count_or_area" in item
        assert "icdrs_criterion" in item
        assert "clinical_significance" in item
        assert "supports_grade" in item
