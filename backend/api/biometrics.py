import librosa
import numpy as np
from scipy.spatial.distance import cosine

def extract_voiceprint(audio_array: np.ndarray, sr: int) -> list[float]:
    """
    Extracts a 20-dimensional mathematical voiceprint from an audio sample.
    Uses Mel-Frequency Cepstral Coefficients (MFCCs) averaged across time.
    """
    # Extract 20 MFCC features
    mfccs = librosa.feature.mfcc(y=audio_array, sr=sr, n_mfcc=20)
    
    # Average across the time axis to create a fixed-length 1D vector
    voiceprint = np.mean(mfccs, axis=1)
    
    return voiceprint.tolist()


def verify_speaker(enrolled_vp: list[float], challenge_vp: list[float], threshold: float = 0.85) -> tuple[bool, float]:
    """
    Compares two voiceprints using Cosine Similarity.
    Returns (is_match, similarity_score).
    """
    if not enrolled_vp or not challenge_vp:
        return False, 0.0
        
    # scipy cosine() returns distance (0 = identical, 1 = orthogonal)
    # We convert to similarity (1 = identical, 0 = orthogonal)
    similarity = 1.0 - cosine(enrolled_vp, challenge_vp)
    
    is_match = similarity >= threshold
    return bool(is_match), float(similarity)
