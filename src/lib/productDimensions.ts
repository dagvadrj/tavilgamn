import { Vector3, type Camera, type Object3D } from "three";
import { formatMeasurement } from "./furnitureMeasurements";

export type ProductBounds = {
  min: [number, number, number];
  max: [number, number, number];
};
type Point = [number, number, number];
export function productDimensionAnnotations(bounds: ProductBounds) {
  const [x0, y0, z0] = bounds.min,
    [x1, y1, z1] = bounds.max;
  if (
    ![x0, y0, z0, x1, y1, z1].every(Number.isFinite) ||
    x1 <= x0 ||
    y1 <= y0 ||
    z1 <= z0
  )
    return [];
  const offset = Math.min(
    0.15,
    Math.max(0.04, Math.max(x1 - x0, y1 - y0, z1 - z0) * 0.06),
  );
  return [
    {
      id: "width",
      label: `Өргөн: ${formatMeasurement(x1 - x0)}`,
      color: "#e7b837",
      from: [x0, y1 + offset, z1] as Point,
      to: [x1, y1 + offset, z1] as Point,
      anchor: [(x0 + x1) / 2, y1 + offset, z1] as Point,
    },
    {
      id: "height",
      label: `Өндөр: ${formatMeasurement(y1 - y0)}`,
      color: "#37bce8",
      from: [x0 - offset, y0, z1] as Point,
      to: [x0 - offset, y1, z1] as Point,
      anchor: [x0 - offset, (y0 + y1) / 2, z1] as Point,
    },
    {
      id: "depth",
      label: `Гүн: ${formatMeasurement(z1 - z0)}`,
      color: "#42d7a0",
      from: [x1 + offset, y0 + offset, z0] as Point,
      to: [x1 + offset, y0 + offset, z1] as Point,
      anchor: [x1 + offset, y0 + offset, (z0 + z1) / 2] as Point,
    },
  ];
}

/** Project world anchors every camera frame; keep screen-facing labels inside the viewer. */
export function dimensionLabelPosition(
  object: Object3D,
  camera: Camera,
  size: { width: number; height: number },
) {
  const point = new Vector3()
    .setFromMatrixPosition(object.matrixWorld)
    .project(camera);
  const inset = Math.min(88, Math.max(12, size.width / 2 - 8));
  return [
    Math.max(
      inset,
      Math.min(size.width - inset, ((point.x + 1) * size.width) / 2),
    ),
    Math.max(20, Math.min(size.height - 20, ((1 - point.y) * size.height) / 2)),
  ];
}

export function productDimensionLabelPositions(
  bounds: ProductBounds,
  camera: Camera,
  size: { width: number; height: number },
) {
  const top = Math.min(84, size.height / 3),
    bottom = Math.max(top, size.height - 76);
  const inset = Math.min(88, Math.max(12, size.width / 2 - 8));
  const placed: number[][] = [];
  return productDimensionAnnotations(bounds).map((item) => {
    const p = new Vector3(...item.anchor).project(camera);
    const x = Math.max(
      inset,
      Math.min(size.width - inset, ((p.x + 1) * size.width) / 2),
    );
    const y = Math.max(top, Math.min(bottom, ((1 - p.y) * size.height) / 2));
    const candidates = [
      y,
      y + 34,
      y - 34,
      top,
      bottom,
      (top + bottom) / 2,
    ].filter((v) => v >= top && v <= bottom);
    const free =
      candidates.find((v) =>
        placed.every(
          (other) =>
            Math.abs(other[0] - x) >= 168 || Math.abs(other[1] - v) >= 33,
        ),
      ) ?? y;
    const point = [x, free];
    placed.push(point);
    return { id: item.id, point };
  });
}
