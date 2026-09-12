"use client";

import { Html, Line } from "@react-three/drei";
import type { Measurement, MeasurementPoint } from "@/lib/furnitureMeasurements";
import { formatMeasurement } from "@/lib/furnitureMeasurements";

function MeasurementLine({ measurement }: { measurement: Measurement }) {
  const { from, to, value, label, kind, vertical } = measurement;
  const middle = from.map((v, i) => (v + to[i]) / 2) as MeasurementPoint;
  const dx = to[0] - from[0], dz = to[2] - from[2];
  const length = Math.hypot(dx, dz);
  const tick: MeasurementPoint = vertical || length < 1e-7 ? [0.07, 0, 0] : [-dz / length * 0.07, 0, dx / length * 0.07];
  const color = kind === "size" ? "#2267a0" : "#334b3d";
  return <group>
    {Math.abs(value) > 1e-7 && <Line points={[from, to]} color={color} lineWidth={1.5}
      depthTest={false} depthWrite={false} renderOrder={1000} raycast={() => {}} />}
    {[from, to].map((point, i) => <Line key={i}
      points={[point.map((v, axis) => v - tick[axis]) as MeasurementPoint, point.map((v, axis) => v + tick[axis]) as MeasurementPoint]}
      color={color} lineWidth={1.5} depthTest={false} depthWrite={false} renderOrder={1000} raycast={() => {}} />)}
    <Html position={middle} center zIndexRange={[9, 0]} style={{ pointerEvents: "none" }}>
      <span className={`planner-measure-label ${kind === "size" ? "planner-measure-size" : ""}`}>
        {label} · {formatMeasurement(value)}
      </span>
    </Html>
  </group>;
}

export function FurnitureMeasurements({ measurements, view }: { measurements: Measurement[]; view: "plan" | "perspective" }) {
  // Vertical distances remain available in the readout when viewed directly from above.
  return <group>{measurements.filter(item => view !== "plan" || !item.vertical)
    .map(item => <MeasurementLine key={item.id} measurement={item} />)}</group>;
}
