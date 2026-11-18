// Utility functions for MediaPipe Face Mesh

export type Landmark = { x: number; y: number; z: number };

// Calculate 3D euclidean distance
export function calculateDistance(point1: Landmark, point2: Landmark): number {
  return Math.sqrt(
    Math.pow(point1.x - point2.x, 2) +
      Math.pow(point1.y - point2.y, 2) +
      Math.pow(point1.z - point2.z, 2)
  );
}

// Calculate Eye Aspect Ratio (EAR)
export function calculateEAR(landmarks: Landmark[], eyeIndices: number[]): number {
  // Eye landmarks: [p1, p2, p3, p4, p5, p6]
  // p1: Outer, p4: Inner
  // p2, p3: Top, p6, p5: Bottom
  const p1 = landmarks[eyeIndices[0]];
  const p2 = landmarks[eyeIndices[1]];
  const p3 = landmarks[eyeIndices[2]];
  const p4 = landmarks[eyeIndices[3]];
  const p5 = landmarks[eyeIndices[4]];
  const p6 = landmarks[eyeIndices[5]];

  const ear =
    (calculateDistance(p2, p6) + calculateDistance(p3, p5)) /
    (2.0 * calculateDistance(p1, p4));

  return ear;
}

export const LEFT_EYE = [33, 160, 158, 133, 153, 144];
export const RIGHT_EYE = [362, 385, 387, 263, 373, 380];

export function isBlinking(landmarks: Landmark[]): boolean {
  const leftEAR = calculateEAR(landmarks, LEFT_EYE);
  const rightEAR = calculateEAR(landmarks, RIGHT_EYE);
  const avgEAR = (leftEAR + rightEAR) / 2.0;

  // 0.25 threshold — covers more face types and lighting conditions
  return avgEAR < 0.25;
}

export function isHeadCentered(landmarks: Landmark[]): boolean {
  // Simple heuristic: distance between nose and ears to check if head is turned too much
  const nose = landmarks[1];
  const leftEar = landmarks[234];
  const rightEar = landmarks[454];

  const leftDist = calculateDistance(nose, leftEar);
  const rightDist = calculateDistance(nose, rightEar);

  const ratio = leftDist / rightDist;
  
  // If the ratio is very skewed, the head is turned
  return ratio > 0.6 && ratio < 1.6;
}

/**
 * Calculates head yaw (left/right) and pitch (up/down) from MediaPipe Face Mesh landmarks.
 *
 * Strategy:
 *  - YAW: Use only the X-axis positions of the left temple (234), right temple (454),
 *    and nose tip (1). The nose's horizontal offset from the midpoint of the two
 *    temples gives a stable yaw signal — unaffected by noisy Z depths.
 *
 *    noseOffset = nose.x - (leftTemple.x + rightTemple.x) / 2
 *    Positive offset → nose has drifted right → head turned LEFT  (mirror-flip aware)
 *    Negative offset → nose has drifted left  → head turned RIGHT
 *
 *    Threshold: ±0.06 in normalised coords (empirically ~20–25°).
 *
 *  - PITCH: Use nose tip (1) Y vs chin (152) Y vs forehead centre (10) Y.
 *    When looking up, forehead-to-nose distance shrinks; looking down, it grows.
 *    Ratio = (nose.y - forehead.y) / (chin.y - forehead.y)
 *    Center ≈ 0.45–0.60; <0.40 → up; >0.65 → down.
 */
export function calculateHeadPose(landmarks: Landmark[]): { yaw: string; pitch: string } {
  // ── Yaw ─────────────────────────────────────────────────────────────────────
  const nose      = landmarks[1];
  const leftTemple  = landmarks[234];
  const rightTemple = landmarks[454];

  const midTempleX  = (leftTemple.x + rightTemple.x) / 2;
  const noseOffset  = nose.x - midTempleX;   // positive → head turned left; negative → right

  // Normalise by inter-temple width so it's scale-independent
  const templeWidth = Math.abs(rightTemple.x - leftTemple.x) || 0.001;
  const yawNorm     = noseOffset / templeWidth;  // typical range: -0.5 … +0.5

  let yaw = 'center';
  if (yawNorm >  0.12) yaw = 'left';   // nose shifted right relative to temples
  else if (yawNorm < -0.12) yaw = 'right';

  // ── Pitch ───────────────────────────────────────────────────────────────────
  const forehead = landmarks[10];   // top of forehead
  const chin     = landmarks[152];  // chin bottom

  const faceHeight = (chin.y - forehead.y) || 0.001;
  const pitchRatio = (nose.y - forehead.y) / faceHeight;

  // pitchRatio ~0.45-0.60 is neutral; looking up shrinks top-half, ratio drops
  let pitch = 'center';
  if (pitchRatio < 0.40) pitch = 'up';
  else if (pitchRatio > 0.65) pitch = 'down';

  return { yaw, pitch };
}
