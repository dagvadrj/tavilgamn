type Point = { x: number; y: number; z: number };
type Bounds = { min: Point; max: Point };
type Size = { w: number; h: number; d: number };
/** Compare decoded metre bounds before any scene scaling can conceal a mismatch. */
export function modelSizeIssue(bounds: Bounds, footprint: Size, frontProjectionMm = 0): string | null {
  const actual = [bounds.max.x - bounds.min.x, bounds.max.y - bounds.min.y, bounds.max.z - bounds.min.z];
  const expected = [footprint.w, footprint.h, footprint.d + frontProjectionMm / 1000];
  if (!Number.isFinite(frontProjectionMm) || frontProjectionMm < 0 || frontProjectionMm > 100 ||
    actual.some((n, i) => !Number.isFinite(n) || n <= 0 || !Number.isFinite(expected[i]) || expected[i] <= 0 || Math.abs(n - expected[i]) > .0050001))
    return "3D файлын бодит хэмжээ каталогийн бүтээгдэхүүнтэй тохирохгүй байна.";
  return null;
}
/** Keep validated physical size and align the carcass back, including handle overhang. */
export function modelPlacement(
  bounds: Bounds,
  footprint: Size,
  physical: boolean,
  previewTarget?: Size,
) {
  const size = {
    w: bounds.max.x - bounds.min.x,
    h: bounds.max.y - bounds.min.y,
    d: bounds.max.z - bounds.min.z,
  };
  const target = physical ? (previewTarget ?? size) : footprint;
  const scale: [number, number, number] = [
    target.w / size.w,
    target.h / size.h,
    target.d / size.d,
  ];
  const position: [number, number, number] = [
    -(bounds.min.x + bounds.max.x) / 2,
    -bounds.min.y,
    physical
      ? -footprint.d / (2 * scale[2]) - bounds.min.z
      : -(bounds.min.z + bounds.max.z) / 2,
  ];
  return { scale, position };
}
