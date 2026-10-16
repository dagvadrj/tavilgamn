/** Give the committed destination's skeleton a paint before starting its data request. */
export function afterPagePaint(callback: () => void): () => void {
  let frame = requestAnimationFrame(() => {
    frame = requestAnimationFrame(callback);
  });
  return () => cancelAnimationFrame(frame);
}
