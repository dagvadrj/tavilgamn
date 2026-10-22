/** Shared viewing behaviour; model transforms and saved designs are independent. */
export const PLANNER_CAMERA = {
  fov: 45,
  rotateSpeed: 0.75,
  dampingFactor: 0.055,
  transitionSeconds: 0.28,
  focusElevation: (25 * Math.PI) / 180,
  interiorSmoothingSeconds: 0.09,
} as const;
