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

export function calculateHeadPose(landmarks: Landmark[]): { yaw: string, pitch: string } {
  const nose = landmarks[1];
  const leftEar = landmarks[234];
  const rightEar = landmarks[454];
  
  const leftDist = calculateDistance(nose, leftEar);
  const rightDist = calculateDistance(nose, rightEar);
  const ratio = leftDist / rightDist;
  
  let yaw = 'center';
  if (ratio < 0.6) yaw = 'right';
  else if (ratio > 1.6) yaw = 'left';
  
  // Basic pitch estimation using nose vs eyes
  const leftEye = landmarks[159]; // Top of left eye
  const mouth = landmarks[13];    // Top lip
  
  const eyeMouthDist = Math.abs(leftEye.y - mouth.y);
  let pitch = 'center';
  if (eyeMouthDist < 0.1) pitch = 'up'; // relative screen coords
  if (eyeMouthDist > 0.3) pitch = 'down';
  
  return { yaw, pitch };
}
