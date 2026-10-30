"use client";
import { useMemo } from "react";
import { Quaternion, Vector3 } from "three";
import type { KitchenServicePlan, KitchenServicePoint } from "@/lib/kitchenServices";

const noRaycast = () => {};
/** Water blue, power amber, outlets for fixed appliances orange. */
export const SERVICE_COLORS: Record<KitchenServicePoint["kind"], string> = {
  socket: "#f2a900", "socket-double": "#f2a900", "appliance-socket": "#f2a900",
  "cooker-outlet": "#e4572e", "water-cold": "#2f80ed", "water-hot": "#e03e3e", drain: "#5f6b7a",
};
const PLATE = "#f5f5f2";

/** One European (Schuko) outlet: recessed cup with two pin holes. */
function Outlet({ x, size = 40 }: { x: number; size?: number }) {
  const r = size / 2000;
  return (
    <group position={[x, 0, 0.008]}>
      <mesh rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
        <cylinderGeometry args={[r, r, 0.002, 28]} />
        <meshStandardMaterial color="#dcdcd8" roughness={0.45} />
      </mesh>
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * r * 0.45, 0, 0.0012]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
          <cylinderGeometry args={[0.0025, 0.0025, 0.001, 12]} />
          <meshBasicMaterial color="#1d1d1b" />
        </mesh>
      ))}
    </group>
  );
}

/** The real fitting: faceplate on the wall, or set into the cut tile on a splashback. */
function Fitting({ point }: { point: KitchenServicePoint }) {
  const w = point.width / 1000, h = point.height / 1000;
  const socket = point.kind === "socket" || point.kind === "socket-double" || point.kind === "appliance-socket";
  return (
    <group position={[point.x / 1000, point.y / 1000, point.z / 1000]} rotation={[0, point.rotation, 0]} name={`Service-${point.id}`}>
      {point.onBacksplash && (
        // Tile cut-out: a dark back box shows as a thin gap around the plate.
        <mesh position={[0, 0, -0.008]} raycast={noRaycast}>
          <boxGeometry args={[w + 0.006, h + 0.006, 0.012]} />
          <meshStandardMaterial color="#2a2a28" roughness={0.9} />
        </mesh>
      )}
      {socket && (
        <>
          <mesh position={[0, 0, point.onBacksplash ? -0.002 : 0.004]} castShadow raycast={noRaycast}>
            <boxGeometry args={[w, h, 0.008]} />
            <meshStandardMaterial color={PLATE} roughness={0.35} />
          </mesh>
          <group position={[0, 0, point.onBacksplash ? -0.006 : 0]}>
            {point.kind === "socket-double" ? <><Outlet x={-w / 4} /><Outlet x={w / 4} /></> : <Outlet x={0} />}
          </group>
        </>
      )}
      {point.kind === "cooker-outlet" && (
        <>
          <mesh position={[0, 0, 0.006]} raycast={noRaycast}>
            <boxGeometry args={[w, h, 0.012]} />
            <meshStandardMaterial color={PLATE} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0, 0.013]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
            <cylinderGeometry args={[0.03, 0.03, 0.003, 32]} />
            <meshStandardMaterial color={SERVICE_COLORS["cooker-outlet"]} roughness={0.5} />
          </mesh>
        </>
      )}
      {(point.kind === "water-cold" || point.kind === "water-hot") && (
        <group>
          <mesh position={[0, 0, 0.03]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
            <cylinderGeometry args={[0.009, 0.009, 0.06, 16]} />
            <meshStandardMaterial color="#c9ccd0" metalness={0.9} roughness={0.25} />
          </mesh>
          <mesh position={[0, 0.012, 0.045]} raycast={noRaycast}>
            <boxGeometry args={[0.012, 0.024, 0.012]} />
            <meshStandardMaterial color={SERVICE_COLORS[point.kind]} roughness={0.5} />
          </mesh>
        </group>
      )}
      {point.kind === "drain" && (
        <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]} raycast={noRaycast}>
          <cylinderGeometry args={[0.025, 0.025, 0.08, 20]} />
          <meshStandardMaterial color="#9aa3ad" roughness={0.6} />
        </mesh>
      )}
    </group>
  );
}

/** Drawn through cabinets so covered connections stay findable. */
function XrayMarker({ point }: { point: KitchenServicePoint }) {
  const color = SERVICE_COLORS[point.kind];
  return (
    <group position={[point.x / 1000, point.y / 1000, point.z / 1000]} rotation={[0, point.rotation, 0]} renderOrder={20}>
      <mesh position={[0, 0, 0.02]} renderOrder={20} raycast={noRaycast}>
        <circleGeometry args={[0.032, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.021]} renderOrder={21} raycast={noRaycast}>
        <ringGeometry args={[0.04, 0.05, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.55} depthTest={false} depthWrite={false} />
      </mesh>
      <mesh position={[0, 0, 0.022]} renderOrder={22} raycast={noRaycast}>
        <circleGeometry args={[0.011, 20]} />
        <meshBasicMaterial color="#ffffff" depthTest={false} depthWrite={false} />
      </mesh>
    </group>
  );
}

function Duct({ points, xray }: { points: { x: number; y: number; z: number }[]; xray: boolean }) {
  const segments = useMemo(() => points.slice(1).map((p, i) => {
    const a = new Vector3(points[i].x, points[i].y, points[i].z).divideScalar(1000);
    const b = new Vector3(p.x, p.y, p.z).divideScalar(1000);
    const length = a.distanceTo(b);
    const mid = a.clone().add(b).multiplyScalar(.5);
    const quaternion = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
    return { length, mid, quaternion };
  }).filter(s => s.length > .001), [points]);
  return (
    <group name="Hood-duct">
      {segments.map((s, i) => (
        <mesh key={i} position={s.mid} quaternion={s.quaternion} renderOrder={xray ? 19 : 0} raycast={noRaycast}>
          <cylinderGeometry args={[0.0625, 0.0625, s.length + 0.06, 24, 1, true]} />
          <meshStandardMaterial color="#b8bec5" metalness={0.75} roughness={0.35} transparent={xray} opacity={xray ? 0.45 : 1}
            depthTest={!xray} depthWrite={!xray} />
        </mesh>
      ))}
    </group>
  );
}

/** Real outlets on the wall; with `xray` the covered ones and the hood duct show through cabinets. */
export function KitchenServicePoints({ plan, xray }: { plan: KitchenServicePlan; xray: boolean }) {
  return (
    <group name="Kitchen-services">
      {plan.points.map(point => <Fitting key={point.id} point={point} />)}
      {xray && plan.points.filter(point => point.hidden).map(point => <XrayMarker key={`xray:${point.id}`} point={point} />)}
      {xray && plan.ducts.map(duct => <Duct key={duct.id} points={duct.points} xray={xray} />)}
    </group>
  );
}
