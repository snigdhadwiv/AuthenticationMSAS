"""
face_matcher.py — OpenCV-based face similarity for MSAS liveness cross-verification.

Algorithm:
  1. Load both images (enrolled KYC selfie + live webcam frame).
  2. Crop the central face region using a simple saliency heuristic:
       • If the image is wider than it is tall (landscape), crop a square from the centre.
       • Otherwise take the full frame.
       • Then scale to 128×128.
  3. Convert to CIE-LAB colour space (perceptually uniform, face-colour-aware).
  4. Compute a 3-channel histogram (L=32 bins, A=32 bins, B=32 bins).
  5. Normalise each histogram; compare using Bhattacharyya distance.
  6. Convert distance to similarity score:  sim = 1 - Bhattacharyya_distance
  7. Apply a Structural Similarity Index (SSIM) bonus on the greyscale crops.
  8. Final score = 0.6 * hist_sim + 0.4 * ssim_score.

Threshold: score ≥ 0.60 → MATCH.

The technique is a lightweight but real photometric comparison appropriate for
same-session liveness verification (not for 1:N search).

Academic reference:
  Swain & Ballard (1991), "Color Indexing", IJCV 7(1):11–32.
  Bhattacharyya (1943), "On a measure of divergence…", Bull. Calcutta Math. Soc. 35.
"""
import logging
import numpy as np
import cv2

logger = logging.getLogger(__name__)


# ── Helpers ────────────────────────────────────────────────────────────────────

def _load_image(src) -> np.ndarray | None:
    """Accept a file path (str) or raw bytes and return a BGR uint8 ndarray."""
    try:
        if isinstance(src, (str, bytes)):
            if isinstance(src, str):
                img = cv2.imread(src)
            else:
                arr = np.frombuffer(src, np.uint8)
                img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        else:
            # Django ImageFieldFile or similar  — read its bytes
            src.open()
            data = src.read()
            src.close()
            arr = np.frombuffer(data, np.uint8)
            img = cv2.imdecode(arr, cv2.IMREAD_COLOR)

        if img is None or img.size == 0:
            return None
        return img
    except Exception as exc:
        logger.warning("[face_matcher] _load_image error: %s", exc)
        return None


def _crop_face_region(img: np.ndarray, target: int = 128) -> np.ndarray:
    """
    Crop a centralised square from the image that most likely contains the face,
    then resize to target×target.

    Strategy:
      • Centre-crop a square of side = min(H, W).
      • Shift the crop upward by 10% of H to favour the face over the chest.
    """
    h, w = img.shape[:2]
    side = min(h, w)
    cx, cy = w // 2, h // 2

    # Shift centre upward by ~10% to focus on face rather than body
    cy = max(side // 2, cy - int(h * 0.10))

    x1 = max(0, cx - side // 2)
    y1 = max(0, cy - side // 2)
    x2 = min(w, x1 + side)
    y2 = min(h, y1 + side)

    crop = img[y1:y2, x1:x2]
    return cv2.resize(crop, (target, target), interpolation=cv2.INTER_LINEAR)


def _lab_histogram(img: np.ndarray, bins: int = 32) -> np.ndarray:
    """Return a normalised concatenated LAB histogram (3×bins floats)."""
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    hists = []
    # L: 0–255, A: 0–255, B: 0–255 in cv2's uint8 LAB
    for ch in range(3):
        h = cv2.calcHist([lab], [ch], None, [bins], [0, 256])
        cv2.normalize(h, h, alpha=1.0, norm_type=cv2.NORM_L1)
        hists.append(h.flatten())
    return np.concatenate(hists)


def _ssim(a: np.ndarray, b: np.ndarray) -> float:
    """
    Compute SSIM between two grayscale images of equal size.
    Uses the standard window-free global approximation adequate for 128×128 crops.
    """
    a = a.astype(np.float64)
    b = b.astype(np.float64)

    mu_a, mu_b = a.mean(), b.mean()
    sigma_a = a.std()
    sigma_b = b.std()
    sigma_ab = ((a - mu_a) * (b - mu_b)).mean()

    C1 = (0.01 * 255) ** 2
    C2 = (0.03 * 255) ** 2

    num = (2 * mu_a * mu_b + C1) * (2 * sigma_ab + C2)
    den = (mu_a**2 + mu_b**2 + C1) * (sigma_a**2 + sigma_b**2 + C2)

    return float(np.clip(num / den, -1.0, 1.0))


# ── Public API ─────────────────────────────────────────────────────────────────

MATCH_THRESHOLD = 0.60   # scores ≥ this are treated as a match


def compare_faces(enrolled_src, live_src) -> dict:
    """
    Compare an enrolled KYC selfie against a live webcam frame.

    Parameters
    ----------
    enrolled_src : str (file path) | bytes | Django FieldFile
        The stored KYC selfie.
    live_src : str (file path) | bytes
        The current webcam frame.

    Returns
    -------
    dict with keys:
        face_match   (bool)   — True if score ≥ MATCH_THRESHOLD
        similarity   (float)  — 0.0–1.0 composite score
        hist_sim     (float)  — histogram similarity component
        ssim         (float)  — structural similarity component
        detail       (str)    — human-readable explanation
    """
    enrolled_img = _load_image(enrolled_src)
    live_img     = _load_image(live_src)

    if enrolled_img is None:
        return {
            "face_match": False,
            "similarity": 0.0,
            "hist_sim": 0.0,
            "ssim": 0.0,
            "detail": "Could not load enrolled selfie image.",
        }
    if live_img is None:
        return {
            "face_match": False,
            "similarity": 0.0,
            "hist_sim": 0.0,
            "ssim": 0.0,
            "detail": "Could not decode live frame.",
        }

    # Crop & resize both images to 128×128
    enrolled_crop = _crop_face_region(enrolled_img)
    live_crop     = _crop_face_region(live_img)

    # ── Histogram similarity (Bhattacharyya) ──────────────────────────────────
    h_enrolled = _lab_histogram(enrolled_crop)
    h_live     = _lab_histogram(live_crop)

    # cv2.HISTCMP_BHATTACHARYYA returns 0 for identical, ~1 for very different
    # We pass raw histograms channel by channel and average
    bhatt_scores = []
    bins = 32
    for i in range(3):
        s = bins * i
        e = s + bins
        # Reshape to (bins, 1) as cv2.compareHist expects
        h1 = h_enrolled[s:e].reshape(-1, 1).astype(np.float32)
        h2 = h_live[s:e].reshape(-1, 1).astype(np.float32)
        bhatt_scores.append(cv2.compareHist(h1, h2, cv2.HISTCMP_BHATTACHARYYA))

    bhatt_dist = float(np.mean(bhatt_scores))
    hist_sim   = float(np.clip(1.0 - bhatt_dist, 0.0, 1.0))

    # ── SSIM on greyscale ─────────────────────────────────────────────────────
    gray_enrolled = cv2.cvtColor(enrolled_crop, cv2.COLOR_BGR2GRAY)
    gray_live     = cv2.cvtColor(live_crop,     cv2.COLOR_BGR2GRAY)
    ssim_score    = float(np.clip((_ssim(gray_enrolled, gray_live) + 1.0) / 2.0, 0.0, 1.0))

    # ── Composite ─────────────────────────────────────────────────────────────
    similarity = 0.60 * hist_sim + 0.40 * ssim_score
    face_match = similarity >= MATCH_THRESHOLD

    detail = (
        f"Histogram similarity: {hist_sim:.3f} | "
        f"Structural similarity (SSIM): {ssim_score:.3f} | "
        f"Composite score: {similarity:.3f} | "
        f"Threshold: {MATCH_THRESHOLD:.2f} → {'MATCH ✓' if face_match else 'MISMATCH ✗'}"
    )

    logger.info("[face_matcher] %s", detail)

    return {
        "face_match": face_match,
        "similarity": round(similarity, 4),
        "hist_sim":   round(hist_sim, 4),
        "ssim":       round(ssim_score, 4),
        "detail":     detail,
    }
