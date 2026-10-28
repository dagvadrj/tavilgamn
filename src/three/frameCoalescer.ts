/**
 * Apply the first pointer sample of a frame at once (no added latency) and fold
 * any further samples in that frame into one trailing update. High-rate mice
 * otherwise cause several store updates and React renders per displayed frame.
 */
export function createFrameCoalescer(apply: (x: number, y: number) => void) {
  let frame: number | null = null;
  let pending: { x: number; y: number } | null = null;
  const schedule = typeof requestAnimationFrame === "function" ? requestAnimationFrame : null;
  const run = (x: number, y: number) => {
    apply(x, y);
    if (!schedule) return;
    frame = schedule(() => {
      frame = null;
      const next = pending;
      pending = null;
      if (next) run(next.x, next.y);
    });
  };
  return {
    push(x: number, y: number) {
      if (frame !== null) pending = { x, y };
      else run(x, y);
    },
    /** Apply a held sample immediately, e.g. before a pointer release commits. */
    flush() {
      const next = pending;
      pending = null;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      if (next) apply(next.x, next.y);
    },
    cancel() {
      pending = null;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
    },
  };
}
