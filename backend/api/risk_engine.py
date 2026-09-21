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

    # ── Signal 4: Device Velocity ─────────────────────────────
    # Randomly simulate a new device (SIM-swap pattern) for large amounts to show dynamic scoring
    if amount > 75000:
        device_velocity_score = 0.85
    else:
        device_velocity_score = 0.1

    # ── Signal 5: Location Change ─────────────────────────────
    # Simulate unusual location if time is odd and amount is medium-high
    if time_score > 0.5 and amount > 20000:
        location_change_score = 0.75
    else:
        location_change_score = 0.1

    # ── Combined Score (weighted average) ────────────────────────────────────
    weights = {
        'transfer_amount': 0.40,
        'payee_risk':      0.25,
        'device_velocity': 0.15,
        'location_change': 0.10,
        'time_of_day':     0.10,
    }

    final_score = (
        (amount_score * weights['transfer_amount']) +
        (payee_score * weights['payee_risk']) +
        (device_velocity_score * weights['device_velocity']) +
        (location_change_score * weights['location_change']) +
        (time_score * weights['time_of_day'])
    )

    return {
        'risk_score': round(final_score, 2),
        'risk_factors': {
            'transfer_amount': amount_score,
            'payee_risk':      payee_score,
            'device_velocity': device_velocity_score,
            'location_change': location_change_score,
            'time_of_day':     time_score,
        },
        'challenge_required': final_score >= 0.35
    }
