/** CSS source width required before the browser applies its display pixel density. */
export function cardImageSourceWidth({
  width,
  height,
  naturalWidth,
  naturalHeight,
  fit,
}: {
  width: number;
  height: number;
  naturalWidth: number;
  naturalHeight: number;
  fit: string;
}) {
  if (width <= 0 || height <= 0 || naturalWidth <= 0 || naturalHeight <= 0)
    return 0;
  const sourceWidth =
    fit === "cover"
      ? Math.max(width, height * (naturalWidth / naturalHeight))
      : width;
  // Keep the photograph sharp during the small hover zoom as well.
  return Math.ceil(sourceWidth * 1.04);
}
