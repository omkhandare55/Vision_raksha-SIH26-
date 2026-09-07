# backend/ai/image_analyzer.py
# Rule-Based DR Feature Detector — works on ANY eye/fundus image
# Uses classical computer vision (no neural network required)
# Detects: microaneurysms, exudates, hemorrhages, vessel density

import cv2
import numpy as np
from dataclasses import dataclass


@dataclass
class AnalysisFeatures:
    microaneurysm_count:   int
    exudate_count:         int
    hemorrhage_area:       float   # fraction of image
    vessel_density:        float   # fraction of image (Frangi-based)
    red_intensity:         float   # mean red channel
    dark_spot_count:       int
    bright_spot_count:     int
    contrast_score:        float
    raw_score:             float   # continuous 0–4
    macular_exudate_count: int  = 0
    dme_detected:          bool = False
    vessel_branch_count:   int  = 0
    tortuosity_index:      float = 0.0
    # ── Optic Disc / Fovea Localization ──
    optic_disc_center:     tuple = None   # (x, y) pixel coordinates
    optic_disc_radius:     int   = 0      # radius in pixels
    fovea_center:          tuple = None   # (x, y) estimated fovea location
    # ── Hemorrhage Sub-Classification ──
    dot_hemorrhage_count:  int   = 0
    blot_hemorrhage_count: int   = 0
    flame_hemorrhage_count: int  = 0
    hemorrhage_quadrant_count: int = 0    # quadrants with hemorrhages (0–4)
    # ── Neovascularization Detection ──
    neovascularization_detected: bool  = False
    neovascularization_confidence: float = 0.0


def analyze_image(img: np.ndarray) -> AnalysisFeatures:
    """
    Detect DR features using classical CV.
    img: HxWx3 numpy array (RGB)
    """
    # Convert to BGR for OpenCV
    bgr = cv2.cvtColor(img, cv2.COLOR_RGB2BGR)
    h, w = bgr.shape[:2]
    total_pixels = h * w

    # ── Retinal mask (non-black area) ──────────────────────────
    gray = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
    _, retina_mask = cv2.threshold(gray, 15, 255, cv2.THRESH_BINARY)
    retina_area = float((retina_mask > 0).sum())
    if retina_area < total_pixels * 0.1:
        retina_area = total_pixels * 0.7

    # ── Red channel analysis (hemorrhage indicator) ────────────
    r_channel = img[:, :, 0].astype(float)
    g_channel = img[:, :, 1].astype(float)
    b_channel = img[:, :, 2].astype(float)
    mean_red   = float(r_channel.mean())

    # ── Microaneurysm detection (small dark red dots) ──────────
    # Isolate red-dominant regions
    red_mask = ((r_channel > 80) &
                (r_channel > g_channel * 1.3) &
                (r_channel > b_channel * 1.2)).astype(np.uint8) * 255

    # CLAHE enhance for better detection
    clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    r_eq  = clahe.apply(img[:, :, 0])

    # Find small dark spots in green channel (MA appear dark on green)
    g_inv = cv2.bitwise_not(img[:, :, 1])
    _, ma_thresh = cv2.threshold(g_inv, 200, 255, cv2.THRESH_BINARY)
    ma_kernel  = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    ma_cleaned = cv2.morphologyEx(ma_thresh, cv2.MORPH_OPEN, ma_kernel)
    ma_contours, _ = cv2.findContours(ma_cleaned,
                                      cv2.RETR_EXTERNAL,
                                      cv2.CHAIN_APPROX_SIMPLE)
    # Microaneurysms: 5–80 pixel area
    microaneurysms = [c for c in ma_contours
                      if 5 <= cv2.contourArea(c) <= 80]

    # ── Exudate detection (bright yellow/white patches) ────────
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    # Yellow-white: high value, low-medium saturation
    ex_mask1 = cv2.inRange(hsv, (15, 20, 180), (45, 255, 255))   # yellow
    ex_mask2 = cv2.inRange(hsv, (0,  0,  200), (180, 40, 255))   # white
    exudate_mask = cv2.bitwise_or(ex_mask1, ex_mask2)
    ex_kernel    = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    exudate_mask = cv2.morphologyEx(exudate_mask, cv2.MORPH_OPEN, ex_kernel)
    ex_contours, _ = cv2.findContours(exudate_mask,
                                      cv2.RETR_EXTERNAL,
                                      cv2.CHAIN_APPROX_SIMPLE)
    exudates = [c for c in ex_contours if cv2.contourArea(c) >= 20]

    # ── Macular / DME Analysis ─────────────────────────────────
    center_x, center_y = w // 2, h // 2
    macula_radius = min(w, h) * 0.22  # Central 22% zone
    macular_exudate_count = 0
    for c in exudates:
        M = cv2.moments(c)
        if M["m00"] > 0:
            cx = int(M["m10"] / M["m00"])
            cy = int(M["m01"] / M["m00"])
            if (cx - center_x) ** 2 + (cy - center_y) ** 2 <= (macula_radius ** 2):
                macular_exudate_count += 1
    dme_detected = macular_exudate_count >= 1

    # ── Hemorrhage detection (large dark red areas) ────────────
    # Hemorrhages: darker, larger than microaneurysms
    hem_mask = ((r_channel > 60) &
                (r_channel < 160) &
                (r_channel > g_channel * 1.5) &
                (g_channel < 80)).astype(np.uint8) * 255
    hem_kernel  = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (7, 7))
    hem_cleaned = cv2.morphologyEx(hem_mask, cv2.MORPH_OPEN, hem_kernel)
    hemorrhage_area = float((hem_cleaned > 0).sum()) / retina_area

    # ── Hemorrhage Sub-Classification (dot / blot / flame) ─────
    # Uses eccentricity and area from connected component analysis
    dot_count, blot_count, flame_count = 0, 0, 0
    hem_quadrants = set()  # track which quadrants have hemorrhages
    hem_contours_sub, _ = cv2.findContours(hem_cleaned, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for c in hem_contours_sub:
        area = cv2.contourArea(c)
        if area < 5:
            continue
        # Compute eccentricity from fitted ellipse (needs >= 5 points)
        if len(c) >= 5:
            _, (ma, MA), _ = cv2.fitEllipse(c)
            eccentricity = np.sqrt(1 - (min(ma, MA) / (max(ma, MA) + 1e-6)) ** 2)
        else:
            eccentricity = 0.0
        # Sub-classify per clinical morphology
        if area < 100 and eccentricity < 0.5:
            dot_count += 1      # dot hemorrhage (round, small)
        elif area >= 100 and eccentricity >= 0.7:
            flame_count += 1    # flame-shaped (elongated, nerve fiber layer)
        else:
            blot_count += 1     # blot hemorrhage (larger, round-ish)
        # Determine quadrant for ICDRS "4-2-1 rule" evaluation
        M = cv2.moments(c)
        if M["m00"] > 0:
            cx_h = int(M["m10"] / M["m00"])
            cy_h = int(M["m01"] / M["m00"])
            q = (0 if cx_h < center_x else 1) + (0 if cy_h < center_y else 2)
            hem_quadrants.add(q)

    # ── Optic Disc Localization (Circular Hough Transform) ─────
    # The optic disc appears as the brightest circular region in the fundus
    od_center = None
    od_radius = 0
    try:
        # Enhance bright regions for OD detection
        gray_blur = cv2.GaussianBlur(gray, (15, 15), 5)
        # Threshold for bright regions (OD is the brightest structure)
        bright_thresh_od = np.percentile(gray_blur[retina_mask > 0], 92) if retina_area > 100 else 200
        _, od_bright = cv2.threshold(gray_blur, int(bright_thresh_od), 255, cv2.THRESH_BINARY)
        od_bright = cv2.bitwise_and(od_bright, retina_mask)
        # Circular Hough Transform — OD radius ~1/12 to 1/5 of image height
        min_r = max(h // 20, 10)
        max_r = max(h // 6, min_r + 10)
        circles = cv2.HoughCircles(
            od_bright, cv2.HOUGH_GRADIENT, dp=1.5,
            minDist=h // 3, param1=50, param2=20,
            minRadius=min_r, maxRadius=max_r
        )
        if circles is not None and len(circles[0]) > 0:
            # Pick the brightest candidate circle
            best_circle = None
            best_brightness = 0
            for circ in circles[0]:
                cx_od, cy_od, r_od = int(circ[0]), int(circ[1]), int(circ[2])
                # Create circle mask and measure mean brightness
                circ_mask = np.zeros((h, w), dtype=np.uint8)
                cv2.circle(circ_mask, (cx_od, cy_od), r_od, 255, -1)
                mean_val = cv2.mean(gray, mask=circ_mask)[0]
                if mean_val > best_brightness:
                    best_brightness = mean_val
                    best_circle = (cx_od, cy_od, r_od)
            if best_circle:
                od_center = (best_circle[0], best_circle[1])
                od_radius = best_circle[2]
    except Exception:
        pass  # OD detection is best-effort

    # ── Fovea Estimation (anatomical offset from OD) ───────────
    # Fovea is ~2.5× OD diameters temporal from the OD center
    fovea_center = None
    if od_center is not None and od_radius > 0:
        fovea_offset = int(2.5 * 2 * od_radius)  # 2.5× OD diameter
        # Determine temporal direction: OD is nasal, fovea is temporal
        # If OD is left of center → right eye → fovea is further left (temporal)
        # If OD is right of center → left eye → fovea is further right (temporal)
        if od_center[0] < center_x:
            # OD is left → right eye → fovea is to the right of OD
            fovea_x = min(od_center[0] + fovea_offset, w - 1)
        else:
            # OD is right → left eye → fovea is to the left of OD
            fovea_x = max(od_center[0] - fovea_offset, 0)
        fovea_center = (fovea_x, od_center[1])

    # ── Blood vessel segmentation (Multi-Scale Frangi Vesselness) ──
    # Frangi filter detects tubular structures by analysing Hessian eigenvalues
    # across multiple sigma scales. Far superior to simple Otsu thresholding.
    g_float = clahe.apply(img[:, :, 1]).astype(np.float64) / 255.0
    vesselness = np.zeros_like(g_float)
    for sigma in [1.0, 1.5, 2.0, 3.0]:
        # Compute Hessian matrix components via Gaussian 2nd derivatives
        gx  = cv2.GaussianBlur(g_float, (0, 0), sigma)
        Dxx = cv2.Sobel(gx, cv2.CV_64F, 2, 0, ksize=3)
        Dyy = cv2.Sobel(gx, cv2.CV_64F, 0, 2, ksize=3)
        Dxy = cv2.Sobel(gx, cv2.CV_64F, 1, 1, ksize=3)
        # Eigenvalues of the Hessian
        tmp   = np.sqrt((Dxx - Dyy) ** 2 + 4.0 * Dxy ** 2)
        lam1  = 0.5 * (Dxx + Dyy + tmp)
        lam2  = 0.5 * (Dxx + Dyy - tmp)
        # Frangi vesselness: tubular structures have |lam2| >> |lam1|
        # and lam2 < 0 (dark vessels on bright background in inverted green channel)
        abs2  = np.abs(lam2) + 1e-10
        Rb2   = (lam1 / abs2) ** 2
        S2    = lam1 ** 2 + lam2 ** 2
        beta  = 0.5
        c     = 0.5 * S2.max() if S2.max() > 0 else 1.0
        v     = np.exp(-Rb2 / (2 * beta ** 2)) * (1 - np.exp(-S2 / (2 * c)))
        v[lam2 > 0] = 0  # vessels are dark (lam2 < 0 on inverted green)
        vesselness = np.maximum(vesselness, v)
    # Normalize and threshold
    if vesselness.max() > 0:
        vesselness = vesselness / vesselness.max()
    vessel_mask = (vesselness > 0.15).astype(np.uint8) * 255
    vessel_density = float((vessel_mask > 0).sum()) / retina_area

    # Count vessel branches (connected components as proxy)
    vessel_branch_count = 0
    tortuosity_index = 0.0
    try:
        n_labels, _ = cv2.connectedComponents(vessel_mask)
        vessel_branch_count = max(0, n_labels - 1)  # subtract background
        # Tortuosity: ratio of total vessel contour perimeter to vessel area
        v_contours, _ = cv2.findContours(vessel_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        total_perimeter = sum(cv2.arcLength(c, True) for c in v_contours)
        total_area = max(float((vessel_mask > 0).sum()), 1.0)
        tortuosity_index = round(total_perimeter / (total_area ** 0.5 + 1e-6), 3)
    except Exception:
        pass

    # ── Neovascularization Detection (NV) ──────────────────────
    # NV appears as abnormal vessel proliferation near the optic disc.
    # Compare vessel density in the OD region vs rest of the image.
    nv_detected = False
    nv_confidence = 0.0
    if od_center is not None and od_radius > 0:
        try:
            # Create OD-region mask (2× OD radius around center)
            nv_region_r = int(2.0 * od_radius)
            od_region_mask = np.zeros((h, w), dtype=np.uint8)
            cv2.circle(od_region_mask, od_center, nv_region_r, 255, -1)
            # Vessel pixels in OD region vs rest
            vessel_in_od = float(cv2.bitwise_and(vessel_mask, od_region_mask).sum())
            od_area = max(float((od_region_mask > 0).sum()), 1.0)
            rest_mask = cv2.bitwise_and(vessel_mask, cv2.bitwise_not(od_region_mask))
            rest_area = max(retina_area - od_area, 1.0)
            vessel_in_rest = float(rest_mask.sum())
            od_vessel_density = vessel_in_od / od_area
            rest_vessel_density = vessel_in_rest / rest_area
            # NV indicator: OD-region vessel density is abnormally high (> 2× average)
            if rest_vessel_density > 0:
                nv_ratio = od_vessel_density / (rest_vessel_density + 1e-6)
                if nv_ratio > 2.0:
                    nv_detected = True
                    nv_confidence = min(round((nv_ratio - 2.0) / 2.0, 2), 1.0)
        except Exception:
            pass

    # ── Contrast score ─────────────────────────────────────────
    contrast_score = float(gray.std()) / 128.0

    # ── Dark & bright spot count ───────────────────────────────
    _, dark_thresh  = cv2.threshold(gray, 40, 255, cv2.THRESH_BINARY_INV)
    dark_cnts, _    = cv2.findContours(dark_thresh,
                                       cv2.RETR_EXTERNAL,
                                       cv2.CHAIN_APPROX_SIMPLE)
    dark_spots = [c for c in dark_cnts
                  if 10 <= cv2.contourArea(c) <= 500]

    _, bright_thresh = cv2.threshold(gray, 220, 255, cv2.THRESH_BINARY)
    bright_cnts, _   = cv2.findContours(bright_thresh,
                                        cv2.RETR_EXTERNAL,
                                        cv2.CHAIN_APPROX_SIMPLE)
    bright_spots = [c for c in bright_cnts
                    if 10 <= cv2.contourArea(c) <= 2000]

    # ── Compute continuous DR score (0–4) ─────────────────────
    ma_score  = min(len(microaneurysms) / 10.0, 1.0)    # 0–1
    ex_score  = min(len(exudates)        / 8.0,  1.0)    # 0–1
    hem_score = min(hemorrhage_area      / 0.05, 1.0)    # 0–1
    dk_score  = min(len(dark_spots)      / 20.0, 1.0)    # 0–1
    br_score  = min(len(bright_spots)    / 15.0, 1.0)    # 0–1

    # Weighted combination → 0–4 scale
    raw_score = (
        ma_score  * 0.35 +
        ex_score  * 0.25 +
        hem_score * 0.20 +
        dk_score  * 0.10 +
        br_score  * 0.10
    ) * 4.0

    return AnalysisFeatures(
        microaneurysm_count   = len(microaneurysms),
        exudate_count         = len(exudates),
        hemorrhage_area       = round(hemorrhage_area, 4),
        vessel_density        = round(vessel_density, 4),
        red_intensity         = round(mean_red, 1),
        dark_spot_count       = len(dark_spots),
        bright_spot_count     = len(bright_spots),
        contrast_score        = round(contrast_score, 3),
        raw_score             = round(raw_score, 4),
        macular_exudate_count = macular_exudate_count,
        dme_detected          = dme_detected,
        vessel_branch_count   = vessel_branch_count,
        tortuosity_index      = tortuosity_index,
        optic_disc_center     = od_center,
        optic_disc_radius     = od_radius,
        fovea_center          = fovea_center,
        dot_hemorrhage_count  = dot_count,
        blot_hemorrhage_count = blot_count,
        flame_hemorrhage_count = flame_count,
        hemorrhage_quadrant_count = len(hem_quadrants),
        neovascularization_detected = nv_detected,
        neovascularization_confidence = nv_confidence,
    )


def score_to_grade(raw_score: float,
                   thresholds: list = None) -> tuple[int, dict]:
    """
    Convert raw score 0–4 to grade index + probability distribution.
    Returns (grade_idx, probs_dict)
    """
    if thresholds is None:
        thresholds = [0.5, 1.5, 2.5, 3.5]

    thresholds = sorted(thresholds)
    grade = int(np.digitize([raw_score], thresholds)[0])
    grade = min(max(grade, 0), 4)

    # Soft probability from distance to grade centers
    centers = [0, 1, 2, 3, 4]
    dists   = [abs(raw_score - c) for c in centers]
    sim     = np.exp(-np.array(dists) * 2.0)
    sim    /= sim.sum()

    labels = ["No DR", "Mild DR", "Moderate DR",
              "Severe DR", "Proliferative DR"]
    probs  = {labels[i]: round(float(sim[i]) * 100, 1) for i in range(5)}

    return grade, probs
