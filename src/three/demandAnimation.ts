// Keep an on-demand canvas awake only until the animation has settled.
export function animateToward(current: number, target: number, speed: number, delta: number) {
  if (Math.abs(current - target) < 0.001) return { value: target, moving: false };
  // A long idle gap must not jump straight to the final door angle/opacity.
  const value = target + (current - target) * Math.exp(-speed * Math.max(0, Math.min(delta, 0.1)));
  return Math.abs(value - target) < 0.001
    ? { value: target, moving: false }
    : { value, moving: true };
}
