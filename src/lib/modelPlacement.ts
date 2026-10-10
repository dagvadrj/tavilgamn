type Point = { x: number; y: number; z: number };
type Bounds = { min: Point; max: Point };
type Size = { w: number; h: number; d: number };
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
