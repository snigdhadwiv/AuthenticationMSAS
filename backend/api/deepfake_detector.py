"""
Deepfake & Anti-Spoofing Detector
─────────────────────────────────
Real OpenCV-based texture analysis module that replaces the previous
simulation heuristic. Uses three complementary signal processing
techniques to determine whether a face image is a live human or a
spoof (printed photo, screen replay, or synthetic/deepfake media).

Techniques:
  1. Laplacian Variance — measures micro-texture sharpness (prints and
     screens lose high-frequency detail).
  2. Local Binary Pattern (LBP) Histogram — captures skin micro-texture
     patterns that differ between real skin and flat reproductions.
  3. High-Frequency Energy Ratio (DCT) — frequency-domain analysis to
     detect the unnatural smoothness or periodic artifacts present in
     screen replays and GAN-generated faces.
"""

import cv2
import numpy as np
from typing import Tuple


# ─────────────────────────────────────────────────────────────────────────────
#  Signal 1 : Laplacian Variance (Focus / Texture Sharpness)
# ─────────────────────────────────────────────────────────────────────────────

def _laplacian_variance(gray: np.ndarray) -> float:
    """
    Computes the variance of the Laplacian of the grayscale image.
    A real face captured through a camera has rich high-frequency texture
    (pores, fine hairs, skin creases) producing HIGH variance.
    A printed photo or screen-replayed video loses that detail, producing
    LOWER variance.
    """
    laplacian = cv2.Laplacian(gray, cv2.CV_64F)
    return float(laplacian.var())


# ─────────────────────────────────────────────────────────────────────────────
#  Signal 2 : Local Binary Pattern (LBP) Texture Histogram
# ─────────────────────────────────────────────────────────────────────────────

def _compute_lbp(gray: np.ndarray, radius: int = 1) -> np.ndarray:
    """
    Computes a simplified uniform Local Binary Pattern image.
    For each pixel, compares it against `radius`-distant neighbors
    in 8 directions and encodes the result as an 8-bit binary number.
    Real skin has a diverse, high-entropy LBP histogram;
    flat reproductions have a more uniform/low-entropy histogram.
    """
    rows, cols = gray.shape
    lbp = np.zeros_like(gray, dtype=np.uint8)

    # 8 neighbor offsets for the given radius
    offsets = [
        (-radius,  0),   (-radius,  radius), (0,  radius), (radius,  radius),
        ( radius,  0),   ( radius, -radius), (0, -radius), (-radius, -radius),
    ]

    for bit, (dy, dx) in enumerate(offsets):
        # Shifted version of the image
        y1 = max(0,  dy);  y2 = rows + min(0, dy)
        x1 = max(0,  dx);  x2 = cols + min(0, dx)

        cy1 = max(0, -dy); cy2 = rows + min(0, -dy)
        cx1 = max(0, -dx); cx2 = cols + min(0, -dx)

        neighbor = gray[y1:y2, x1:x2]
        center   = gray[cy1:cy2, cx1:cx2]

        lbp[cy1:cy2, cx1:cx2] |= ((neighbor >= center).astype(np.uint8) << bit)

    return lbp


def _lbp_entropy(gray: np.ndarray) -> float:
    """
    Returns the Shannon entropy of the LBP histogram.
    Higher entropy → richer texture → more likely real.
    """
    lbp = _compute_lbp(gray)
    hist, _ = np.histogram(lbp.ravel(), bins=256, range=(0, 256))
    hist = hist.astype(np.float64) / hist.sum()
    hist = hist[hist > 0]  # avoid log(0)
    entropy = -np.sum(hist * np.log2(hist))
    return float(entropy)


# ─────────────────────────────────────────────────────────────────────────────
#  Signal 3 : DCT High-Frequency Energy Ratio
# ─────────────────────────────────────────────────────────────────────────────

def _high_freq_energy_ratio(gray: np.ndarray, cutoff_fraction: float = 0.5) -> float:
    """
    Applies 2D Discrete Cosine Transform and measures the proportion
    of energy residing in the high-frequency quadrant.
    Real faces carry substantial high-frequency energy (skin texture,
    hair). Screen replays and GAN outputs often exhibit spectral
    smoothness — their energy concentrates in low frequencies.
    """
    # Resize to a fixed square for consistent DCT comparison
    img = cv2.resize(gray, (256, 256)).astype(np.float32)
    dct = cv2.dct(img)

    h, w = dct.shape
    ch, cw = int(h * cutoff_fraction), int(w * cutoff_fraction)

    total_energy = np.sum(dct ** 2)
    if total_energy < 1e-10:
        return 0.0

    low_energy = np.sum(dct[:ch, :cw] ** 2)
    high_energy = total_energy - low_energy

    return float(high_energy / total_energy)


# ─────────────────────────────────────────────────────────────────────────────
#  Composite Spoof Detector (Public API)
# ─────────────────────────────────────────────────────────────────────────────

def analyze_face_frame(image_bytes: bytes) -> dict:
    """
    Accepts raw image bytes (JPEG/PNG) from a webcam frame capture.
    Returns a detailed anti-spoofing analysis dict.

    Returns:
        {
            "is_live": bool,          # final live/spoof verdict
            "liveness_score": float,  # 0.0–1.0 composite score
            "laplacian_variance": float,
            "lbp_entropy": float,
            "high_freq_energy": float,
            "signals": {             # per-signal pass/fail
                "laplacian": bool,
                "lbp": bool,
                "frequency": bool,
            },
            "detail": str,           # human-readable explanation
        }
    """
    # Decode image bytes → OpenCV BGR image
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        return {
            "is_live": False, "liveness_score": 0.0,
            "laplacian_variance": 0, "lbp_entropy": 0, "high_freq_energy": 0,
            "signals": {"laplacian": False, "lbp": False, "frequency": False},
            "detail": "Failed to decode image frame.",
        }

    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # ── Detect and crop face region for focused analysis ─────────────────────
    face_cascade = cv2.CascadeClassifier(
        cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
    )
    faces = face_cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(80, 80))

    if len(faces) > 0:
        # Use the largest detected face
        x, y, w, h = max(faces, key=lambda f: f[2] * f[3])
        # Add some margin
        margin = int(0.15 * max(w, h))
        y1 = max(0, y - margin)
        y2 = min(gray.shape[0], y + h + margin)
        x1 = max(0, x - margin)
        x2 = min(gray.shape[1], x + w + margin)
        face_roi = gray[y1:y2, x1:x2]
    else:
        # No face detected — use center crop as fallback
        ch, cw = gray.shape
        face_roi = gray[ch//4:3*ch//4, cw//4:3*cw//4]

    # Ensure minimum ROI size
    if face_roi.shape[0] < 50 or face_roi.shape[1] < 50:
        face_roi = gray

    # ── Compute the three signals ────────────────────────────────────────────
    lap_var  = _laplacian_variance(face_roi)
    lbp_ent  = _lbp_entropy(face_roi)
    hf_ratio = _high_freq_energy_ratio(face_roi)

    # ── Thresholds (tuned for webcam-quality 480p–720p captures) ─────────────
    #  - Laplacian variance: real faces typically > 80; screens/prints < 50
    #  - LBP entropy: real skin > 5.5 bits; flat surfaces < 5.0
    #  - HF energy ratio: real > 0.25; replays/GAN < 0.20
    LAP_THRESHOLD = 50.0
    LBP_THRESHOLD = 5.0
    HFE_THRESHOLD = 0.20

    lap_ok = lap_var  >= LAP_THRESHOLD
    lbp_ok = lbp_ent  >= LBP_THRESHOLD
    hfe_ok = hf_ratio >= HFE_THRESHOLD

    # ── Weighted composite score ─────────────────────────────────────────────
    # Normalize each signal into [0, 1] range, then weight them
    lap_norm = min(1.0, lap_var / 200.0)    # 200 = typical high-quality live
    lbp_norm = min(1.0, lbp_ent / 7.5)     # 7.5 = max practical entropy
    hfe_norm = min(1.0, hf_ratio / 0.45)    # 0.45 = strong HF energy

    liveness_score = (
        0.40 * lap_norm +
        0.35 * lbp_norm +
        0.25 * hfe_norm
    )

    # Final verdict: at least 2 of 3 signals must pass AND composite >= 0.45
    signals_passed = sum([lap_ok, lbp_ok, hfe_ok])
    is_live = signals_passed >= 2 and liveness_score >= 0.45

    # ── Build human-readable detail ──────────────────────────────────────────
    detail_parts = []
    if not lap_ok:
        detail_parts.append(f"Low texture sharpness (Laplacian={lap_var:.1f}, threshold={LAP_THRESHOLD})")
    if not lbp_ok:
        detail_parts.append(f"Low skin micro-texture diversity (LBP entropy={lbp_ent:.2f}, threshold={LBP_THRESHOLD})")
    if not hfe_ok:
        detail_parts.append(f"Weak high-frequency energy (ratio={hf_ratio:.3f}, threshold={HFE_THRESHOLD})")

    if is_live:
        detail = f"Live face verified ({signals_passed}/3 signals passed, score={liveness_score:.2f})."
    else:
        detail = f"Potential spoof detected ({signals_passed}/3 signals passed, score={liveness_score:.2f}). " + "; ".join(detail_parts)

    return {
        "is_live": is_live,
        "liveness_score": round(liveness_score, 3),
        "laplacian_variance": round(lap_var, 2),
        "lbp_entropy": round(lbp_ent, 3),
        "high_freq_energy": round(hf_ratio, 4),
        "signals": {
            "laplacian": lap_ok,
            "lbp": lbp_ok,
            "frequency": hfe_ok,
        },
        "detail": detail,
    }


# ── Synthetic Audio Spectral Analysis ────────────────────────────────────────

def analyze_audio_authenticity(audio_array: np.ndarray, sr: int = 16000) -> dict:
    """
    Analyzes an audio waveform for synthetic/deepfake artifacts using
    spectral analysis. Replaces the previous mock heuristic.

    Techniques:
      1. Spectral Flatness (Wiener Entropy) — real speech has more tonal
         structure (lower flatness); TTS/VC output often exhibits unnaturally
         even spectral distribution.
      2. Zero-Crossing Rate Variance — natural speech has high ZCR variation
         between voiced/unvoiced segments; synthetic audio is more uniform.
      3. Spectral Rolloff Consistency — real speech has variable rolloff
         across frames; deepfakes tend to be more consistent.

    Returns:
        {
            "is_authentic": bool,
            "authenticity_score": float,   # 0.0–1.0
            "spectral_flatness": float,
            "zcr_variance": float,
            "rolloff_variance": float,
            "detail": str,
        }
    """
    import librosa

    if len(audio_array) < sr:
        return {
            "is_authentic": False,
            "authenticity_score": 0.0,
            "spectral_flatness": 0, "zcr_variance": 0, "rolloff_variance": 0,
            "detail": "Audio too short for analysis.",
        }

    # 1. Spectral Flatness (Wiener Entropy)
    flatness = librosa.feature.spectral_flatness(y=audio_array)
    mean_flatness = float(np.mean(flatness))

    # 2. Zero-Crossing Rate Variance
    zcr = librosa.feature.zero_crossing_rate(y=audio_array)
    zcr_var = float(np.var(zcr))

    # 3. Spectral Rolloff Variance
    rolloff = librosa.feature.spectral_rolloff(y=audio_array, sr=sr)
    rolloff_var = float(np.var(rolloff)) / (sr ** 2)  # normalize

    # ── Scoring ──────────────────────────────────────────────────────────────
    # Real speech: lower flatness (more tonal), higher ZCR variance,
    # higher rolloff variance
    FLATNESS_THRESHOLD = 0.15    # real speech typically < 0.10
    ZCR_VAR_THRESHOLD  = 0.001   # real speech typically > 0.002
    ROLLOFF_THRESHOLD  = 0.005   # real speech typically > 0.01

    flatness_ok = mean_flatness < FLATNESS_THRESHOLD
    zcr_ok      = zcr_var > ZCR_VAR_THRESHOLD
    rolloff_ok  = rolloff_var > ROLLOFF_THRESHOLD

    # Composite score
    flat_score    = max(0, min(1.0, 1.0 - (mean_flatness / 0.30)))
    zcr_score     = min(1.0, zcr_var / 0.005)
    rolloff_score = min(1.0, rolloff_var / 0.02)

    authenticity_score = (
        0.40 * flat_score +
        0.30 * zcr_score +
        0.30 * rolloff_score
    )

    signals_passed = sum([flatness_ok, zcr_ok, rolloff_ok])
    is_authentic = signals_passed >= 2 and authenticity_score >= 0.40

    detail_parts = []
    if not flatness_ok:
        detail_parts.append(f"Unnaturally flat spectrum (flatness={mean_flatness:.4f})")
    if not zcr_ok:
        detail_parts.append(f"Low ZCR variance (var={zcr_var:.6f})")
    if not rolloff_ok:
        detail_parts.append(f"Low spectral rolloff variance (var={rolloff_var:.6f})")

    if is_authentic:
        detail = f"Audio appears authentic ({signals_passed}/3 signals passed, score={authenticity_score:.2f})."
    else:
        detail = f"Potential synthetic audio ({signals_passed}/3 signals passed, score={authenticity_score:.2f}). " + "; ".join(detail_parts)

    return {
        "is_authentic": is_authentic,
        "authenticity_score": round(authenticity_score, 3),
        "spectral_flatness": round(mean_flatness, 5),
        "zcr_variance": round(zcr_var, 6),
        "rolloff_variance": round(rolloff_var, 6),
        "detail": detail,
    }
