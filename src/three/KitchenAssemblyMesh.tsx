"use client";
import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { Path, Shape, type Texture } from "three";
import { cooktopGeometry, hasCooktop } from "@/lib/plitka";
import {
  componentColor,
  componentSurface,
  getComponentSize,
  getComponents,
} from "@/lib/kitchenComponents";
import { FINISHES } from "@/lib/kitchen";
import type {
  Countertop,
  ModularCabinet,
  ModularKitchen,
} from "@/lib/kitchenCabinets";
import { cabinetAxes, fitCountertops, fitPlinths } from "@/lib/kitchenPlacement";
import { kitchenEnvelope } from "@/lib/kitchenAssembly";
import { fitBacksplashes } from "@/lib/kitchenBacksplash";
import { createKitchenTexture } from "./kitchenTextures";
import { CabinetBody } from "./KitchenCabinetBody";
export { CabinetBody } from "./KitchenCabinetBody";
type XYZ = [number, number, number];
function Board({
  size,
  at,
  color,
  roughness = 0.7,
  metalness = 0,
  map,
}: {
  size: XYZ;
  at: XYZ;
  color: string;
  roughness?: number;
  metalness?: number;
  map?: Texture | null;
}) {
  return (
    <mesh position={at} userData={{ sizeMm: size.map(value => Math.round(value * 1e9) / 1e6), positionMm: at.map(value => Math.round(value * 1e9) / 1e6) }} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        map={map}
      />
    </mesh>
  );
}
function Top({ top, kitchen }: { top: Countertop; kitchen: ModularKitchen }) {
  const finish =
    top.finish ??
    (top.material === "wood"
      ? "oak"
      : top.material === "granite"
        ? "marble"
        : "matte");
  const map = useMemo(() => createKitchenTexture(finish), [finish]);
  useEffect(() => () => map?.dispose(), [map]);
  const holes = useMemo(
    () =>
      kitchen.cabinets.filter(
        (c) =>
          top.cabinetIds.includes(c.id) &&
          (c.opening === "sink" || hasCooktop(c)),
      ),
    [kitchen.cabinets, top.cabinetIds],
  );
  const shape = useMemo(() => {
    const s = new Shape(),
      w = top.width / 1000,
      d = top.depth / 1000;
    s.moveTo(-w / 2, -d / 2);
    s.lineTo(w / 2, -d / 2);
    s.lineTo(w / 2, d / 2);
    s.lineTo(-w / 2, d / 2);
    s.closePath();
    const { right, front } = cabinetAxes(top.position.rotation);
    for (const c of holes) {
      const dx = c.position.x - top.position.x,
        dz = c.position.z - top.position.z;
      const x = (dx * right.x + dz * right.z) / 1000,
        z = (dx * front.x + dz * front.z) / 1000;
      const sink = getComponents(c).find((item) => item.type === "sink");
      const sinkSize = sink ? getComponentSize(c, sink) : null;
      const hobSize = cooktopGeometry(c);
      const hw = sinkSize ? sinkSize.width / 2000 : hobSize.cutoutWidth / 2000,
        hd = sinkSize ? sinkSize.depth / 2000 : hobSize.cutoutDepth / 2000;
      const hole = new Path();
      hole.moveTo(x - hw, z - hd);
      hole.lineTo(x - hw, z + hd);
      hole.lineTo(x + hw, z + hd);
      hole.lineTo(x + hw, z - hd);
      hole.closePath();
      s.holes.push(hole);
    }
    return s;
    // Geometry is rebuilt when any placement or opening changes.
  }, [top, holes]);
  const finishInfo = FINISHES.find((f) => f.id === finish)!;
  return (
    <group
      position={[
        top.position.x / 1000,
        top.position.y / 1000,
        top.position.z / 1000,
      ]}
      rotation={[0, top.position.rotation, 0]}
    >
      <mesh
        position={[0, top.thickness / 1000, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        castShadow
        receiveShadow
        raycast={() => {}}
      >
        <extrudeGeometry
          args={[shape, { depth: top.thickness / 1000, bevelEnabled: false }]}
        />
        <meshStandardMaterial
          color={top.color ?? finishInfo.color}
          roughness={finishInfo.roughness}
          map={map}
        />
      </mesh>
    </group>
  );
}
function CounterAppliance({
  cabinet: c,
  kitchen,
}: {
  cabinet: ModularCabinet;
  kitchen: ModularKitchen;
}) {
  const components = getComponents(c),
    hob = components.find((item) => item.type === "cooktop"),
    sink = components.find((item) => item.type === "sink"),
    tap = components.find((item) => item.type === "tap");
  const bowl = sink
    ? getComponentSize(c, sink)
    : { width: 440, height: 150, depth: 340 };
  const faucet = tap
    ? getComponentSize(c, tap)
    : { width: 22, height: 260, depth: 160 };
  const w = bowl.width / 1000,
    d = bowl.depth / 1000,
    h = bowl.height / 1000;
  const hobSize = cooktopGeometry(c, hob?.model);
  return (
    <group
      name={`Appliance-${sink ? "sink" : "cooktop"}-${c.id}`}
      position={[
        c.position.x / 1000,
        (c.position.y + c.height + kitchen.countertop.thickness) / 1000,
        c.position.z / 1000,
      ]}
      rotation={[0, c.position.rotation, 0]}
    >
      {hob ? (
        <>
          <Board
            size={[(hobSize.cutoutWidth - 2) / 1000, 0.044, (hobSize.cutoutDepth - 2) / 1000]}
            at={[0, -0.022, 0]}
            color="#252a29"
          />
          <Board
            size={[hobSize.width / 1000, 0.002, hobSize.depth / 1000]}
            at={[0, 0.001, 0]}
            color={componentColor(c, hob)}
            roughness={0.2}
          />
          {(hobSize.width < 400 ? [0] : [-1, 1]).flatMap((x) =>
            [-1, 1].map((z) => (
              <mesh
                key={`${x}:${z}`}
                position={[x * hobSize.width / 4000, 0.003, z * hobSize.depth / 4000]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <ringGeometry
                  args={[hob.model.startsWith("ceramic") ? 0.035 : 0.05, 0.053, 24]}
                />
                <meshStandardMaterial color="#929b98" />
              </mesh>
            )),
          )}
        </>
      ) : sink && tap ? (
        <>
          <group name={`Component-tap-${c.id}`}>
            <Board
              size={[0.022, faucet.height / 1000, 0.022]}
              at={[0, faucet.height / 2000, -0.235]}
              color={componentColor(c, tap)}
              {...componentSurface(tap)}
            />
            <group
              rotation={[0, tap.model === "angled" ? 0.3 : 0, 0]}
              position={[0, 0, -0.235]}
            >
              <Board
                size={[0.022, 0.022, faucet.depth / 1000]}
                at={[
                  0,
                  (faucet.height - 11) / 1000,
                  (faucet.depth / 2 - 11) / 1000,
                ]}
                color={componentColor(c, tap)}
                {...componentSurface(tap)}
              />
            </group>
          </group>
          <group name={`Component-sink-${c.id}`}>
            {sink.model === "double" && (
              <Board
                size={[0.008, h, d]}
                at={[0, -h / 2, 0]}
                color={componentColor(c, sink)}
                {...componentSurface(sink)}
              />
            )}
            <Board
              size={[w, 0.008, d]}
              at={[0, -h + 0.004, 0]}
              color={componentColor(c, sink)}
              {...componentSurface(sink)}
            />
            {[-1, 1].map((sign) => (
              <group key={sign}>
                <Board
                  size={[0.008, h, d]}
                  at={[sign * (w / 2 - 0.004), -h / 2, 0]}
                  color={componentColor(c, sink)}
                  {...componentSurface(sink)}
                />
                <Board
                  size={[w, h, 0.008]}
                  at={[0, -h / 2, sign * (d / 2 - 0.004)]}
                  color={componentColor(c, sink)}
                  {...componentSurface(sink)}
                />
              </group>
            ))}
          </group>
        </>
      ) : null}
    </group>
  );
}
export function KitchenTops({ kitchen, onBacksplashPointerDown }: { kitchen: ModularKitchen; onBacksplashPointerDown?: (event: ThreeEvent<PointerEvent>, id: string) => void }) {
  const tops = useMemo(() => fitCountertops(kitchen), [kitchen]);
  const plinths = useMemo(() => fitPlinths(kitchen), [kitchen]);
  const backsplashes = useMemo(() => fitBacksplashes(kitchen), [kitchen]);
  return (
    <>
      {tops.map((top) => (
        <Top key={top.id} top={top} kitchen={kitchen} />
      ))}
      {plinths.map(plinth => <FinishedBoard key={plinth.id} id={`Component-plinth-${plinth.cabinetIds[0]}`} width={plinth.width} height={plinth.height} depth={plinth.depth}
        position={plinth.position} color={plinth.color} finish={plinth.finish} />)}
      {backsplashes.map(panel => <FinishedBoard key={panel.id} id={panel.id} width={panel.width} height={panel.height} depth={panel.thickness}
        onPointerDown={event => onBacksplashPointerDown?.(event, panel.id)}
        position={panel.position} color={kitchen.countertop.color} finish={kitchen.countertop.finish ?? (kitchen.countertop.material === "wood" ? "oak" : kitchen.countertop.material === "granite" ? "marble" : "matte")} />)}
      {kitchen.cabinets
        .filter((c) => c.opening === "sink" || hasCooktop(c))
        .map((c) => (
          <CounterAppliance key={c.id} cabinet={c} kitchen={kitchen} />
        ))}
    </>
  );
}
function FinishedBoard({ id, width, height, depth, position, color, finish = "matte", onPointerDown }: {
  id: string; width: number; height: number; depth: number; position: ModularCabinet["position"]; color?: string; finish?: Countertop["finish"];
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
}) {
  const map = useMemo(() => createKitchenTexture(finish), [finish]);
  useEffect(() => () => map?.dispose(), [map]);
  const material = FINISHES.find(item => item.id === finish)!;
  return <group name={id} onPointerDown={onPointerDown} position={[position.x / 1000, position.y / 1000, position.z / 1000]} rotation={[0, position.rotation, 0]}>
    <Board size={[width / 1000, height / 1000, depth / 1000]} at={[0, height / 2000, 0]} map={map} color={color ?? material.color} roughness={material.roughness} />
  </group>;
}
/** Used verbatim by the editor and room planner; scale is always 1. */
export function KitchenAssemblyMesh({
  kitchen,
  centered = false,
  open = false,
}: {
  kitchen: ModularKitchen;
  centered?: boolean;
  open?: boolean;
}) {
  const bounds = kitchenEnvelope(kitchen);
  return (
    <group
      position={
        centered
          ? [-bounds.centerX / 1000, 0, -bounds.centerZ / 1000]
          : [0, 0, 0]
      }
    >
      {kitchen.cabinets.map((c) => (
        <group
          key={c.id}
          name={`Cabinet-${c.id}`}
          position={[
            c.position.x / 1000,
            c.position.y / 1000,
            c.position.z / 1000,
          ]}
          rotation={[0, c.position.rotation, 0]}
        >
          <CabinetBody cabinet={c} open={open} />
        </group>
      ))}
      <KitchenTops kitchen={kitchen} />
    </group>
  );
}
