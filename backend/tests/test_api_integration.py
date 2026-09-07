# backend/tests/test_api_integration.py
# TEST-002 -- API integration tests (FastAPI TestClient)
# Run: .\venv\Scripts\pytest.exe tests/ -v

import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

import numpy as np
import cv2
import pytest


# -- Helper -------------------------------------------------------

def bright_fundus_bytes() -> bytes:
    h, w = 380, 380
    img  = np.zeros((h, w, 3), dtype=np.uint8)
    cy, cx = h // 2, w // 2
    cv2.circle(img, (cx, cy), h // 2 - 10, (140, 80, 60), -1)
    noise = np.random.randint(0, 25, (h, w, 3), dtype=np.uint8)
    img   = cv2.add(img, noise)
    for _ in range(25):
        rx = int(np.random.randint(cx-100, cx+100))
        ry = int(np.random.randint(cy-100, cy+100))
        cv2.circle(img, (rx, ry), 5, (200, 80, 80), -1)
    _, buf = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, 90])
    return buf.tobytes()

def black_bytes() -> bytes:
    img = np.zeros((380, 380, 3), dtype=np.uint8)
    _, buf = cv2.imencode(".jpg", img)
    return buf.tobytes()


# ================================================================
# TEST-002a: Health
# ================================================================
class TestHealth:

    def test_health_returns_200(self, client):
        r = client.get("/health")
        assert r.status_code == 200

    def test_health_status_ok(self, client):
        r = client.get("/health")
        assert r.json()["status"] == "ok"

    def test_health_has_demo_mode_flag(self, client):
        r = client.get("/health")
        assert "demo_mode" in r.json()

    def test_root_returns_200(self, client):
        r = client.get("/")
        assert r.status_code == 200


# ================================================================
# TEST-002b: Auth endpoints
# ================================================================
class TestAuth:

    def test_login_with_demo_credentials(self, client):
        r = client.post("/auth/login",
            json={"username": "doctor_demo", "password": "doctor123"})
        assert r.status_code == 200
        assert "access_token" in r.json()
        assert r.json()["role"] == "doctor"

    def test_login_asha_role(self, client):
        r = client.post("/auth/login",
            json={"username": "asha_demo", "password": "asha123"})
        assert r.status_code == 200
        assert r.json()["role"] == "asha"

    def test_login_wrong_password(self, client):
        r = client.post("/auth/login",
            json={"username": "doctor_demo", "password": "wrong"})
        assert r.status_code == 401

    def test_login_unknown_user(self, client):
        r = client.post("/auth/login",
            json={"username": "nobody", "password": "pass"})
        assert r.status_code == 401

    def test_me_with_valid_token(self, client):
        token = client.post("/auth/login",
            json={"username": "asha_demo", "password": "asha123"}).json()["access_token"]
        r = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert r.json()["role"] == "asha"

    def test_me_without_token_returns_401(self, raw_client):
        r = raw_client.get("/auth/me")
        assert r.status_code == 401

    def test_refresh_token(self, client):
        token = client.post("/auth/login",
            json={"username": "admin", "password": "admin123"}).json()["access_token"]
        r = client.post("/auth/refresh", headers={"Authorization": f"Bearer {token}"})
        assert r.status_code == 200
        assert "access_token" in r.json()


# ================================================================
# TEST-002b2: Auth Enforcement (verify 401 on unprotected access)
# ================================================================
class TestAuthEnforcement:

    def test_analyse_without_token_returns_401(self, raw_client):
        r = raw_client.post("/api/analyse",
            files={"file": ("test.jpg", bright_fundus_bytes(), "image/jpeg")})
        assert r.status_code == 401

    def test_patients_without_token_returns_401(self, raw_client):
        r = raw_client.get("/api/patients")
        assert r.status_code == 401

    def test_report_without_token_returns_401(self, raw_client):
        r = raw_client.get("/api/report/scr_fake")
        assert r.status_code == 401

    def test_followups_without_token_returns_401(self, raw_client):
        r = raw_client.get("/api/followups")
        assert r.status_code == 401

    def test_validate_without_token_returns_401(self, raw_client):
        r = raw_client.post("/api/validate/scr_fake",
            json={"action": "confirmed"})
        assert r.status_code == 401


# ================================================================
# TEST-002c: Patients CRUD
# ================================================================
class TestPatients:

    def test_create_patient_returns_201(self, client):
        r = client.post("/api/patients",
            json={"name": "Test Patient", "age": 45, "gender": "M"})
        assert r.status_code == 201
        assert "patient_id" in r.json()

    def test_create_patient_missing_name_returns_422(self, client):
        r = client.post("/api/patients", json={"age": 45})
        assert r.status_code == 422

    def test_create_patient_invalid_age_returns_422(self, client):
        r = client.post("/api/patients", json={"name": "A", "age": 200})
        assert r.status_code == 422

    def test_list_patients_returns_200(self, client):
        r = client.get("/api/patients")
        assert r.status_code == 200
        assert "patients" in r.json()
        assert "total" in r.json()

    def test_list_patients_search(self, client):
        client.post("/api/patients", json={"name": "UniqueZZZ Patient", "age": 50})
        r = client.get("/api/patients?search=UniqueZZZ")
        assert r.status_code == 200
        assert r.json()["total"] >= 1

    def test_get_nonexistent_patient_returns_404(self, client):
        r = client.get("/api/patients/pat_doesnotexist")
        assert r.status_code == 404


# ================================================================
# TEST-002d: Analyse endpoint
# ================================================================
class TestAnalyse:

    def test_analyse_bright_image_returns_200(self, client):
        r = client.post("/api/analyse",
            files={"file": ("test.jpg", bright_fundus_bytes(), "image/jpeg")})
        assert r.status_code == 200

    def test_analyse_response_has_required_fields(self, client):
        r = client.post("/api/analyse",
            files={"file": ("test.jpg", bright_fundus_bytes(), "image/jpeg")})
        d = r.json()
        for field in ["grade", "grade_label", "confidence", "findings",
                      "heatmap_image", "original_image", "screening_id",
                      "referral", "probabilities"]:
            assert field in d, f"Missing field: {field}"

    def test_analyse_grade_in_valid_range(self, client):
        r = client.post("/api/analyse",
            files={"file": ("test.jpg", bright_fundus_bytes(), "image/jpeg")})
        assert 0 <= r.json()["grade"] <= 4

    def test_analyse_black_image_returns_400(self, client):
        r = client.post("/api/analyse",
            files={"file": ("black.jpg", black_bytes(), "image/jpeg")})
        assert r.status_code == 400

    def test_analyse_wrong_content_type_returns_400(self, client):
        r = client.post("/api/analyse",
            files={"file": ("doc.pdf", b"fake pdf", "application/pdf")})
        assert r.status_code == 400

    def test_analyse_confidence_0_to_100(self, client):
        r = client.post("/api/analyse",
            files={"file": ("test.jpg", bright_fundus_bytes(), "image/jpeg")})
        assert 0.0 <= r.json()["confidence"] <= 100.0


# ================================================================
# TEST-002e: Validate endpoint
# ================================================================
class TestValidate:

    @pytest.fixture
    def screening_id(self, client):
        r = client.post("/api/analyse",
            files={"file": ("test.jpg", bright_fundus_bytes(), "image/jpeg")})
        return r.json()["screening_id"]

    def test_validate_confirmed(self, client, screening_id):
        r = client.post(f"/api/validate/{screening_id}",
            json={"action": "confirmed", "doctor_id": "dr_test", "note": "OK"})
        assert r.status_code == 200
        assert r.json()["validation_status"] == "confirmed"

    def test_validate_override_requires_reason(self, client, screening_id):
        r = client.post(f"/api/validate/{screening_id}",
            json={"action": "overridden"})
        assert r.status_code == 400

    def test_validate_override_with_reason(self, client, screening_id):
        r = client.post(f"/api/validate/{screening_id}",
            json={"action": "overridden",
                  "override_reason": "Image quality insufficient for confident grading"})
        assert r.status_code == 200

    def test_validate_nonexistent_screening_returns_404(self, client):
        r = client.post("/api/validate/scr_doesnotexist",
            json={"action": "confirmed"})
        assert r.status_code == 404

    def test_double_validation_returns_409(self, client, screening_id):
        client.post(f"/api/validate/{screening_id}",
            json={"action": "confirmed", "doctor_id": "dr1"})
        r = client.post(f"/api/validate/{screening_id}",
            json={"action": "confirmed", "doctor_id": "dr2"})
        assert r.status_code == 409


# ================================================================
# TEST-002f: Stats endpoint
# ================================================================
class TestStats:

    def test_stats_returns_200(self, client):
        r = client.get("/api/stats")
        assert r.status_code == 200

    def test_stats_has_required_fields(self, client):
        r = client.get("/api/stats")
        d = r.json()
        for field in ["total_screened", "referral_needed", "by_grade",
                      "referral_rate_pct", "avg_confidence"]:
            assert field in d, f"Missing field: {field}"

    def test_stats_by_grade_has_5_entries(self, client):
        r = client.get("/api/stats")
        assert len(r.json()["by_grade"]) == 5

    def test_stats_after_analyse_increments(self, client):
        before = client.get("/api/stats").json()["total_screened"]
        client.post("/api/analyse",
            files={"file": ("t.jpg", bright_fundus_bytes(), "image/jpeg")})
        after = client.get("/api/stats").json()["total_screened"]
        assert after == before + 1


# ================================================================
# TEST-002g: Report endpoint
# ================================================================
class TestReport:

    @pytest.fixture
    def validated_id(self, client):
        r = client.post("/api/analyse",
            files={"file": ("t.jpg", bright_fundus_bytes(), "image/jpeg")})
        sid = r.json()["screening_id"]
        client.post(f"/api/validate/{sid}", json={"action": "confirmed"})
        return sid

    def test_report_returns_pdf(self, client, validated_id):
        r = client.get(f"/api/report/{validated_id}")
        assert r.status_code == 200
        assert r.headers["content-type"] == "application/pdf"

    def test_report_is_non_empty(self, client, validated_id):
        r = client.get(f"/api/report/{validated_id}")
        assert len(r.content) > 500

    def test_report_nonexistent_screening_returns_404(self, client):
        r = client.get("/api/report/scr_doesnotexist")
        assert r.status_code == 404


# ================================================================
# TEST-002h: Follow-Ups & Reminders
# ================================================================
class TestFollowUps:

    def test_list_followups_returns_200(self, client):
        r = client.get("/api/followups")
        assert r.status_code == 200
        assert "count" in r.json()
        assert "followups" in r.json()

    def test_list_overdue_followups(self, client):
        r = client.get("/api/followups/overdue")
        assert r.status_code == 200
        assert "count" in r.json()

    def test_complete_nonexistent_followup_returns_404(self, client):
        r = client.post("/api/followups/999999/complete")
        assert r.status_code == 404


# ================================================================
# TEST-002i: Disagreement Check & Longitudinal Progression
# ================================================================
class TestDisagreementAndProgression:

    def test_disagreement_classification(self, client):
        # Create screening
        r = client.post("/api/analyse",
            files={"file": ("t.jpg", bright_fundus_bytes(), "image/jpeg")})
        sid = r.json()["screening_id"]
        ai_grade = r.json()["grade"]

        # Doctor overrides with different grade
        doc_grade = 4 if ai_grade < 2 else 0
        v_resp = client.post(f"/api/validate/{sid}", json={
            "action": "overridden",
            "doctor_id": "dr_senior",
            "doctor_grade": doc_grade,
            "override_reason": "Clinical review disagrees with automated grading"
        })
        assert v_resp.status_code == 200
        v_data = v_resp.json()
        assert v_data["doctor_grade"] == doc_grade
        assert v_data["disagreement_level"] in ["minor", "major"]

    def test_longitudinal_progression_tracking(self, client):
        # Create patient
        p = client.post("/api/patients",
            json={"name": "Longitudinal Patient", "age": 52, "gender": "F"}).json()
        pid = p["patient_id"]

        # First screening
        s1 = client.post("/api/analyse",
            data={"patient_id": pid},
            files={"file": ("t1.jpg", bright_fundus_bytes(), "image/jpeg")}).json()
        assert s1["progression"] is None  # First visit has no prior

        # Second screening
        s2 = client.post("/api/analyse",
            data={"patient_id": pid},
            files={"file": ("t2.jpg", bright_fundus_bytes(), "image/jpeg")}).json()
        assert s2["progression"] is not None
        assert "grade_delta" in s2["progression"]
        assert "trend" in s2["progression"]
        assert s2["progression"]["previous_screening_id"] == s1["screening_id"]

