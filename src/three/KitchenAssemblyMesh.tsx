"use client";
import { useEffect, useMemo } from "react";
import { Path, Shape, type Texture } from "three";
import { FINISHES } from "@/lib/kitchen";
import type { Countertop, ModularCabinet, ModularKitchen } from "@/lib/kitchenCabinets";
import { cabinetAxes, fitCountertops } from "@/lib/kitchenPlacement";
import { kitchenEnvelope } from "@/lib/kitchenAssembly";
import { createKitchenTexture } from "./kitchenTextures";
type XYZ = [number, number, number];
function Board({ size, at, color, roughness = .7, map }: { size: XYZ; at: XYZ; color: string; roughness?: number; map?: Texture | null }) {
  return <mesh position={at} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={roughness} map={map} /></mesh>;
}
function Front({ width, height, at, cabinet, map }: { width: number; height: number; at: XYZ; cabinet: ModularCabinet; map: Texture | null }) {
  const w = width - .004, h = height - .004, framed = cabinet.frontStyle && cabinet.frontStyle !== "flat";
  const surface = { color: cabinet.color, roughness: cabinet.material === "gloss" ? .15 : .8, map };
  return <group position={at}>
    {framed ? <>
      <mesh><boxGeometry args={[w - .06, h - .06, .012]} /><meshStandardMaterial {...surface}
        color={cabinet.frontStyle === "glass" ? "#b6ced0" : cabinet.color} map={cabinet.frontStyle === "glass" ? null : map}
        transparent={cabinet.frontStyle === "glass"} opacity={cabinet.frontStyle === "glass" ? .32 : 1} /></mesh>
      {[-1, 1].map(sign => <group key={sign}>
        <Board size={[.03, h, .018]} at={[sign * (w / 2 - .015), 0, 0]} {...surface} />
        <Board size={[w - .06, .03, .018]} at={[0, sign * (h / 2 - .015), 0]} {...surface} />
      </group>)}
    </> : <Board size={[w, h, .018]} at={[0, 0, 0]} {...surface} />}
    {cabinet.handleStyle === "bar" && <Board size={[Math.min(w * .5, .14), .014, .022]} at={[0, h / 2 - .045, .02]} color="#3d413c" />}
    {cabinet.handleStyle === "knob" && <mesh position={[0, h / 2 - .045, .025]}><sphereGeometry args={[.015, 12, 8]} /><meshStandardMaterial color="#8e7b54" metalness={.7} roughness={.3} /></mesh>}
  </group>;
}
export function CabinetBody({ cabinet, open = false }: { cabinet: ModularCabinet; open?: boolean }) {
  const finish = cabinet.finish ?? (cabinet.material === "wood" ? "oak" : cabinet.material === "gloss" ? "gloss" : "matte");
  const map = useMemo(() => createKitchenTexture(finish), [finish]);
  useEffect(() => () => map?.dispose(), [map]);
  const w = cabinet.width / 1000, h = cabinet.height / 1000, d = cabinet.depth / 1000;
  const toe = cabinet.type === "base" ? .08 : 0, opening = cabinet.opening ?? "doors";
  const drawers = opening === "drawers" ? Math.max(1, cabinet.drawerCount) : cabinet.drawerCount;
  const drawerHeight = opening === "drawers" ? (h - toe) / drawers : .12;
  const doorsHeight = h - toe - drawerHeight * drawers;
  return <>
    <Board size={[w, h - toe, .018]} at={[0, (h + toe) / 2, -d / 2 + .009]} color="#e6e0d4" />
    {[-1, 1].map(sign => <Board key={sign} size={[.018, h - toe, d]} at={[sign * (w / 2 - .009), (h + toe) / 2, 0]} color={cabinet.color} map={map} />)}
    {[toe + .009, (h + toe) / 2, h - .009].filter((_, i) => opening !== "sink" || i === 0).map(y => <Board key={y} size={[w - .036, .018, d - .025]} at={[0, y, -.005]} color="#e6e0d4" />)}
    {toe > 0 && <Board size={[w - .04, toe, d - .09]} at={[0, toe / 2, -.025]} color="#5c6057" />}
    {opening !== "open" && doorsHeight > .01 && Array.from({ length: cabinet.doorCount }, (_, index) => {
      const dw = w / cabinet.doorCount, right = index === 1, hinge = right ? w / 2 : -w / 2;
      return <group key={`door-${index}`} position={[hinge, toe + doorsHeight / 2, d / 2 - .009]}
        rotation={[0, open ? (right ? 1 : -1) * Math.PI * .38 : 0, 0]}>
        <Front width={dw} height={doorsHeight} at={[right ? -dw / 2 : dw / 2, 0, 0]} cabinet={cabinet} map={map} />
      </group>;
    })}
    {opening !== "open" && Array.from({ length: drawers }, (_, i) => <Front key={`drawer-${i}`} width={w} height={drawerHeight}
      at={[0, h - drawerHeight * (i + .5), d / 2 - .009 + (open ? .18 : 0)]} cabinet={cabinet} map={map} />)}
  </>;
}
function Top({ top, kitchen }: { top: Countertop; kitchen: ModularKitchen }) {
  const finish = top.finish ?? (top.material === "wood" ? "oak" : top.material === "granite" ? "marble" : "matte");
  const map = useMemo(() => createKitchenTexture(finish), [finish]);
  useEffect(() => () => map?.dispose(), [map]);
  const holes = useMemo(() => kitchen.cabinets.filter(c => top.cabinetIds.includes(c.id) && ["sink", "hob"].includes(c.opening ?? "")), [kitchen.cabinets, top.cabinetIds]);
  const shape = useMemo(() => {
    const s = new Shape(), w = top.width / 1000, d = top.depth / 1000;
    s.moveTo(-w / 2, -d / 2); s.lineTo(w / 2, -d / 2); s.lineTo(w / 2, d / 2); s.lineTo(-w / 2, d / 2); s.closePath();
    const { right, front } = cabinetAxes(top.position.rotation);
    for (const c of holes) {
      const dx = c.position.x - top.position.x, dz = c.position.z - top.position.z;
      const x = (dx * right.x + dz * right.z) / 1000, z = (dx * front.x + dz * front.z) / 1000;
      const hw = c.opening === "sink" ? .22 : .25, hd = c.opening === "sink" ? .17 : .2;
      const hole = new Path(); hole.moveTo(x - hw, z - hd); hole.lineTo(x - hw, z + hd); hole.lineTo(x + hw, z + hd); hole.lineTo(x + hw, z - hd); hole.closePath(); s.holes.push(hole);
    }
    return s;
  // Geometry is rebuilt when any placement or opening changes.
  }, [top, holes]);
  const finishInfo = FINISHES.find(f => f.id === finish)!;
  return <group position={[top.position.x / 1000, top.position.y / 1000, top.position.z / 1000]} rotation={[0, top.position.rotation, 0]}>
    <mesh position={[0, top.thickness / 1000, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow raycast={() => {}}>
      <extrudeGeometry args={[shape, { depth: top.thickness / 1000, bevelEnabled: false }]} />
      <meshStandardMaterial color={finishInfo.color} roughness={finishInfo.roughness} map={map} />
    </mesh>
    {kitchen.backsplash && <Board size={[top.width / 1000, kitchen.wallClearance / 1000, .012]}
      at={[0, top.thickness / 1000 + kitchen.wallClearance / 2000, -top.depth / 2000 + .006]} color={finishInfo.color} map={map} />}
  </group>;
}
export function KitchenTops({ kitchen }: { kitchen: ModularKitchen }) {
  const tops = useMemo(() => fitCountertops(kitchen), [kitchen]);
  return <>{tops.map(top => <Top key={top.id} top={top} kitchen={kitchen} />)}
    {kitchen.cabinets.filter(c => ["sink", "hob"].includes(c.opening ?? "")).map(c => <group key={c.id}
      position={[c.position.x / 1000, (c.height + kitchen.countertop.thickness) / 1000, c.position.z / 1000]} rotation={[0, c.position.rotation, 0]}>
      {c.opening === "hob" ? <>
        <Board size={[.52, .006, .44]} at={[0, -.004, 0]} color="#191d20" roughness={.2} />
        {[-1, 1].flatMap(x => [-1, 1].map(z => <mesh key={`${x}:${z}`} position={[x * .13, -.0005, z * .11]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[.05, .053, 24]} /><meshStandardMaterial color="#929b98" /></mesh>))}
      </> : <>
        <Board size={[.022, .26, .022]} at={[0, .13, -.235]} color="#3d413c" />
        <Board size={[.022, .022, .16]} at={[0, .249, -.166]} color="#3d413c" />
        <Board size={[.44, .008, .34]} at={[0, -.15, 0]} color="#929d9f" />
        {[-1, 1].map(sign => <group key={sign}>
          <Board size={[.008, .15, .34]} at={[sign * .216, -.075, 0]} color="#929d9f" />
          <Board size={[.44, .15, .008]} at={[0, -.075, sign * .166]} color="#929d9f" />
        </group>)}
      </>}
    </group>)}
  </>;
}
/** Used verbatim by the editor and room planner; scale is always 1. */
export function KitchenAssemblyMesh({ kitchen, centered = false, open = false }: { kitchen: ModularKitchen; centered?: boolean; open?: boolean }) {
  const bounds = kitchenEnvelope(kitchen);
  return <group position={centered ? [-bounds.centerX / 1000, 0, -bounds.centerZ / 1000] : [0, 0, 0]}>
    {kitchen.cabinets.map(c => <group key={c.id} position={[c.position.x / 1000, c.position.y / 1000, c.position.z / 1000]} rotation={[0, c.position.rotation, 0]}>
      <CabinetBody cabinet={c} open={open} />
    </group>)}<KitchenTops kitchen={kitchen} />
  </group>;
}
