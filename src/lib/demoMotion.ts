export type DemoAxis = { value: number; velocity: number; target: number };

/** Exact critically damped response; retargeting preserves velocity instead of restarting an ease. */
export function advanceDemoAxis(
  axis: DemoAxis,
  delta: number,
  reduced = false,
) {
  if (reduced) {
    axis.value = axis.target;
    axis.velocity = 0;
    return false;
  }
  const dt = Math.max(0, Math.min(delta, 1 / 15));
  const frequency = 13;
  const offset = axis.value - axis.target;
  const impulse = axis.velocity + frequency * offset;
  const decay = Math.exp(-frequency * dt);
  axis.value = axis.target + (offset + impulse * dt) * decay;
  axis.velocity = (axis.velocity - frequency * impulse * dt) * decay;
  if (
    Math.abs(axis.value - axis.target) < 0.0002 &&
    Math.abs(axis.velocity) < 0.001
  ) {
    axis.value = axis.target;
    axis.velocity = 0;
    return false;
  }
  return true;
}
