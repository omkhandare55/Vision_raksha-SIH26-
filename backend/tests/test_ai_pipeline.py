# backend/tests/test_ai_pipeline.py
# TEST-001 -- Unit tests for full AI pipeline
# Run: .\venv\Scripts\pytest.exe tests/ -v

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import numpy as np
import cv2
import pytest


# -- Helpers -------------------------------------------------------

def make_fundus(bright=True, size=380) -> bytes:
    img = np.zeros((size, size, 3), dtype=np.uint8)
    if bright:
        cy, cx = size // 2, size // 2
        cv2.circle(img, (cx, cy), size // 2 - 10, (140, 80, 60), -1)
        noise = np.random.randint(0, 30, (size, size, 3), dtype=np.uint8)
        img   = cv2.add(img, noise)
        for _ in range(20):
            rx = int(np.random.randint(cx - 100, cx + 100))
            ry = int(np.random.randint(cy - 100, cy + 100))
            cv2.circle(img, (rx, ry), 5, (200, 80, 80), -1)
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 90])
    return buf.tobytes()


BRIGHT = make_fundus(bright=True)
BLACK  = make_fundus(bright=False)


# ================================================================
# TEST-001a: Quality Checker
# ================================================================
class TestQualityChecker:

    def setup_method(self):
        from ai.quality_checker import QualityChecker
        self.qc = QualityChecker()

    def test_bright_image_accepted(self):
        r = self.qc.assess(BRIGHT)
        assert r.score >= 0.5, f"Expected score >= 0.5, got {r.score}"
        assert r.action.name == "ACCEPT"

    def test_black_image_rejected(self):
        r = self.qc.assess(BLACK)
        assert r.action.name == "REJECT"
        assert r.score < 0.5

    def test_details_on_rejection(self):
        # QualityResult has 'details', not 'suggestions'
        r = self.qc.assess(BLACK)
        assert r.details is not None

    def test_enhanced_flag_bool(self):
        r = self.qc.assess(BRIGHT)
        assert isinstance(r.enhanced, bool)

    def test_score_between_0_and_1(self):
        r = self.qc.assess(BRIGHT)
        assert 0.0 <= r.score <= 1.0


# ================================================================
# TEST-001b: DR Grader (demo mode)
# ================================================================
class TestDRGrader:

    def setup_method(self):
        from ai.dr_grader import DRGrader
        self.grader = DRGrader(model_path="nonexistent.pth")

    def test_model_not_loaded(self):
        # model=None means demo mode active
        assert self.grader.model is None

    def test_grade_returns_valid_range(self):
        r = self.grader.grade(BRIGHT)
        assert 0 <= r.grade <= 4, f"Grade {r.grade} out of range"

    def test_confidence_between_0_and_100(self):
        r = self.grader.grade(BRIGHT)
        assert 0.0 <= r.confidence <= 100.0

    def test_probabilities_sum_to_100(self):
        r = self.grader.grade(BRIGHT)
        total = sum(r.probabilities.values())
        assert abs(total - 100.0) < 1.0, f"Probs sum={total}"

    def test_probabilities_has_5_classes(self):
        r = self.grader.grade(BRIGHT)
        assert len(r.probabilities) == 5


# ================================================================
# TEST-001c: Grad-CAM (demo mode via pipeline)
# ================================================================
class TestGradCAMViaPipeline:
    """
    GradCAMEngine.generate() requires tensor + class_idx + original ndarray.
    Test via the full pipeline which wraps GradCAM correctly.
    """

    def setup_method(self):
        from ai.pipeline import AnalysisPipeline
        self.pipeline = AnalysisPipeline(model_path="nonexistent.pth")

    def test_heatmap_is_string(self):
        r = self.pipeline.analyse(BRIGHT)
        assert isinstance(r.heatmap_b64, str)
        assert len(r.heatmap_b64) > 100

    def test_original_image_preserved(self):
        r = self.pipeline.analyse(BRIGHT)
        assert isinstance(r.original_b64, str)
        assert len(r.original_b64) > 100


# ================================================================
# TEST-001d: Findings Generator
# ================================================================
class TestFindings:

    def setup_method(self):
        from ai.findings import FindingsGenerator
        self.gen = FindingsGenerator()

    @pytest.mark.parametrize("grade,expected_referral", [
        (0, False),
        (1, False),
        (2, True),
        (3, True),
        (4, True),
    ])
    def test_referral_flag(self, grade, expected_referral):
        r = self.gen.generate(grade, confidence=85.0)
        assert r.referral == expected_referral

    def test_findings_list_not_empty(self):
        for grade in range(5):
            r = self.gen.generate(grade, confidence=80.0)
            assert len(r.findings) >= 1

    def test_urgency_exists(self):
        for grade in range(5):
            r = self.gen.generate(grade, confidence=80.0)
            assert r.urgency is not None

    def test_icdrs_notes_present(self):
        r = self.gen.generate(2, confidence=80.0)
        assert r.icdrs_notes is not None


# ================================================================
# TEST-001e: Full Pipeline (end-to-end)
# ================================================================
class TestPipeline:

    def setup_method(self):
        from ai.pipeline import AnalysisPipeline
        self.pipeline = AnalysisPipeline(model_path="nonexistent.pth")

    def test_demo_mode_active(self):
        assert self.pipeline.demo_mode is True

    def test_analyse_returns_grade(self):
        r = self.pipeline.analyse(BRIGHT)
        assert r.grade is not None
        assert 0 <= r.grade <= 4

    def test_analyse_returns_heatmap(self):
        r = self.pipeline.analyse(BRIGHT)
        assert r.heatmap_b64 is not None
        assert len(r.heatmap_b64) > 100

    def test_analyse_returns_findings(self):
        r = self.pipeline.analyse(BRIGHT)
        assert isinstance(r.findings, list)
        assert len(r.findings) >= 1

    def test_quality_rejection_raises_value_error(self):
        with pytest.raises((ValueError, Exception)):
            self.pipeline.analyse(BLACK)

    def test_processing_time_recorded(self):
        r = self.pipeline.analyse(BRIGHT)
        assert r.processing_ms > 0
        assert r.processing_ms < 30_000

    def test_probabilities_all_grades_present(self):
        r = self.pipeline.analyse(BRIGHT)
        assert len(r.probabilities) == 5


# ================================================================
# TEST-001f: JWT Auth
# ================================================================
class TestAuth:

    def test_token_round_trip(self):
        from auth.jwt import create_access_token, decode_token, TokenData
        data  = TokenData(user_id="dr_test", role="doctor", phc_id="phc_001")
        token = create_access_token(data)
        dec   = decode_token(token)
        assert dec.user_id == "dr_test"
        assert dec.role    == "doctor"
        assert dec.phc_id  == "phc_001"

    def test_invalid_token_raises_401(self):
        from fastapi import HTTPException
        from auth.jwt import decode_token
        with pytest.raises(HTTPException) as exc:
            decode_token("not.a.valid.token")
        assert exc.value.status_code == 401

    def test_password_hash_and_verify(self):
        from auth.jwt import hash_password, verify_password
        h = hash_password("mypassword")
        assert verify_password("mypassword", h) is True
        assert verify_password("wrongpass",  h) is False

    def test_roles_encoded_in_token(self):
        from auth.jwt import create_access_token, decode_token, TokenData
        for role in ("asha", "doctor", "admin"):
            token = create_access_token(TokenData(user_id="u", role=role))
            assert decode_token(token).role == role
