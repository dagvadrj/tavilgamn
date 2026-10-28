/** A room at rest owns one scene; a transition owns only its two endpoints. */
export function roomStageMask(travel: number) {
  const t = Math.max(0, Math.min(2, Number.isFinite(travel) ? travel : 0));
  const closest = Math.round(t);
  if (Math.abs(t - closest) < 0.015) return 1 << closest;
  return (1 << Math.floor(t)) | (1 << Math.ceil(t));
}

/** Bound framebuffer memory independently of monitor resolution and device DPR. */
export function roomPixelRatio(
  width: number,
  height: number,
  deviceRatio: number,
  moving: boolean,
  constrained: boolean,
) {
  const pixels = Math.max(1, width * height);
  const budget = moving ? 1_000_000 : 1_800_000;
  const cap = constrained ? (moving ? 0.75 : 1) : moving ? 1 : 1.25;
  return Math.max(
    0.1,
    Math.min(deviceRatio || 1, cap, Math.sqrt(budget / pixels)),
  );
}
