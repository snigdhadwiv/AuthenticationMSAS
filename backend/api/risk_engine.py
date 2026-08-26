"""
Transaction Risk Engine
Scores a transaction 0.0 (safe) to 1.0 (high risk) based on 5 signals.
"""
from datetime import datetime


def compute_risk_score(amount: float, payee_name: str, hour: int = None) -> dict:
    """
    Returns a dict with individual signal scores and the combined risk_score.
    """
    if hour is None:
        hour = datetime.now().hour

    # ── Signal 1: Transfer Amount ──────────────────────────────────────────────
    if amount >= 100000:       # ₹1 lakh+
        amount_score = 1.0
    elif amount >= 50000:      # ₹50k–1 lakh
        amount_score = 0.7
    elif amount >= 10000:      # ₹10k–50k
        amount_score = 0.4
    else:
        amount_score = 0.1

    # ── Signal 2: Time of Day ─────────────────────────────────────────────────
    # Late-night / early-morning transactions are riskier
    if 23 <= hour or hour < 5:
        time_score = 0.9
    elif 5 <= hour < 8:
        time_score = 0.5
    else:
        time_score = 0.1

    # ── Signal 3: Payee Risk ──────────────────────────────────────────────────
    # Short or suspiciously generic names score higher risk
    name_len = len(payee_name.strip())
    if name_len < 4:
        payee_score = 0.9
    elif name_len < 8:
        payee_score = 0.5
    else:
        payee_score = 0.1

    # ── Signal 4: Device Velocity (mocked for V1) ─────────────────────────────
    device_velocity_score = 0.1   # Assume trusted device in V1

    # ── Signal 5: Location Change (mocked for V1) ─────────────────────────────
    location_change_score = 0.1   # Assume same location in V1

    # ── Combined Score (weighted average) ────────────────────────────────────
    risk_score = round(
        0.35 * amount_score
        + 0.20 * time_score
        + 0.25 * payee_score
        + 0.10 * device_velocity_score
        + 0.10 * location_change_score,
        4
    )

    return {
        "risk_score": risk_score,
        "risk_factors": {
            "transfer_amount":    round(amount_score, 2),
            "time_of_day":        round(time_score, 2),
            "payee_risk":         round(payee_score, 2),
            "device_velocity":    round(device_velocity_score, 2),
            "location_change":    round(location_change_score, 2),
        },
        "challenge_required": risk_score >= 0.35,
    }
