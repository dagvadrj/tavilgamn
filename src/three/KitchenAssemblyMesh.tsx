"use client";
import { useEffect, useMemo } from "react";
import { Path, Shape, type Texture } from "three";
import { hasCooktop, ovenSlot, OVEN_BODY } from "@/lib/kitchenAppliances";
import { componentColor, componentSurface, getComponentSize, getComponents } from "@/lib/kitchenComponents";
import { FINISHES, type Finish } from "@/lib/kitchen";
import type { Countertop, ModularCabinet, ModularKitchen } from "@/lib/kitchenCabinets";
import { cabinetAxes, fitCountertops } from "@/lib/kitchenPlacement";
import { kitchenEnvelope } from "@/lib/kitchenAssembly";
import { createKitchenTexture } from "./kitchenTextures";
type XYZ = [number, number, number];
function Board({ size, at, color, roughness = .7, metalness = 0, map }: { size: XYZ; at: XYZ; color: string; roughness?: number; metalness?: number; map?: Texture | null }) {
  return <mesh position={at} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={roughness} metalness={metalness} map={map} /></mesh>;
}
function Front({ width, height, at, cabinet, map, kind = "door-front" }: { width: number; height: number; at: XYZ; cabinet: ModularCabinet; map: Texture | null; kind?: "door-front" | "drawer-front" }) {
  const components = getComponents(cabinet), part = components.find(c => c.type === kind)!;
  const handle = components.find(c => c.type === "handle");
  const w = width - .004, h = height - .004, framed = part.model !== "flat";
  const surface = { color: componentColor(cabinet, part), ...componentSurface(part), map };
  return <group position={at} name={`Component-${kind}-${cabinet.id}`} userData={{ component: kind }}>
    {framed ? <>
      <mesh><boxGeometry args={[w - .06, h - .06, .012]} /><meshStandardMaterial {...surface}
        color={part.model === "glass" ? "#b6ced0" : surface.color} map={part.model === "glass" ? null : map}
        transparent={part.model === "glass"} opacity={part.model === "glass" ? .32 : 1} /></mesh>
      {[-1, 1].map(sign => <group key={sign}>
        <Board size={[.03, h, .018]} at={[sign * (w / 2 - .015), 0, 0]} {...surface} />
        <Board size={[w - .06, .03, .018]} at={[0, sign * (h / 2 - .015), 0]} {...surface} />
      </group>)}
    </> : <Board size={[w, h, .018]} at={[0, 0, 0]} {...surface} />}
    {handle?.model === "bar" && <Board size={[getComponentSize(cabinet, handle).width / 1000, .014, .022]} at={[0, h / 2 - .045, .02]} color={componentColor(cabinet, handle)} {...componentSurface(handle)} />}
    {handle?.model === "knob" && <mesh position={[0, h / 2 - .045, .025]}><sphereGeometry args={[.015, 12, 8]} /><meshStandardMaterial color={componentColor(cabinet, handle)} {...componentSurface(handle)} /></mesh>}
  </group>;
}
export function CabinetBody({ cabinet, open = false }: { cabinet: ModularCabinet; open?: boolean }) {
  const finish = cabinet.finish ?? (cabinet.material === "wood" ? "oak" : cabinet.material === "gloss" ? "gloss" : "matte");
  const map = useMemo(() => createKitchenTexture(finish), [finish]);
  useEffect(() => () => map?.dispose(), [map]);
  const components = getComponents(cabinet);
  const frame = components.find(c => c.type === "frame")!, plinth = components.find(c => c.type === "plinth");
  const frameOverride = cabinet.components?.find(c => c.type === "frame");
  const frameColor = frameOverride ? componentColor(cabinet, frame) : undefined;
  const frontFinish = components.find(c => c.type === "door-front")?.finish as Finish ?? finish;
  const drawerFinish = components.find(c => c.type === "drawer-front")?.finish as Finish ?? finish;
  const frameFinish = frame.finish as Finish ?? finish;
  const plinthFinish = plinth?.finish as Finish ?? "matte";
  const frontMap = useMemo(() => frontFinish === finish ? null : createKitchenTexture(frontFinish), [frontFinish, finish]);
  const drawerMap = useMemo(() => drawerFinish === finish ? null : createKitchenTexture(drawerFinish), [drawerFinish, finish]);
  const frameMap = useMemo(() => frameOverride?.finish ? createKitchenTexture(frameFinish) : null, [frameOverride?.finish, frameFinish]);
  const plinthMap = useMemo(() => plinth?.finish ? createKitchenTexture(plinthFinish) : null, [plinth?.finish, plinthFinish]);
  useEffect(() => () => frontMap?.dispose(), [frontMap]);
  useEffect(() => () => drawerMap?.dispose(), [drawerMap]);
  useEffect(() => () => frameMap?.dispose(), [frameMap]);
  useEffect(() => () => plinthMap?.dispose(), [plinthMap]);
  const slot = ovenSlot(cabinet);
  const w = cabinet.width / 1000, h = cabinet.height / 1000, d = cabinet.depth / 1000;
  const toe = cabinet.type === "base" ? .08 : 0, opening = cabinet.opening ?? "doors";
  const drawers = opening === "drawers" ? Math.max(1, cabinet.drawerCount) : cabinet.drawerCount;
  const drawerHeight = opening === "drawers" ? (h - toe) / drawers : .12;
  const doorsHeight = h - toe - drawerHeight * drawers;
  return <>
    <Board size={[w, h - toe, .018]} at={[0, (h + toe) / 2, -d / 2 + .009]} color={frameColor ?? "#e6e0d4"} map={frameMap} {...componentSurface(frame)} />
    {[-1, 1].map(sign => <Board key={sign} size={[.018, h - toe, d]} at={[sign * (w / 2 - .009), (h + toe) / 2, 0]} color={frameColor ?? cabinet.color} map={frameOverride ? frameMap : map} />)}
    {(slot ? [toe + .009, (slot.bottom - 9) / 1000, (slot.top + 9) / 1000, ...(cabinet.type === "tall" ? [h - .009] : [])] : [toe + .009, (h + toe) / 2, h - .009].filter((_, i) => opening === "sink" ? i === 0 : !hasCooktop(cabinet) || i !== 2)).map(y => <Board key={y} size={[w - .036, .018, d - .025]} at={[0, y, -.005]} color={frameColor ?? "#e6e0d4"} map={frameMap} {...componentSurface(frame)} />)}
    {toe > 0 && plinth && <group name={`Component-plinth-${cabinet.id}`}>
      {plinth.model === "legs" ? [-1, 1].flatMap(x => [-1, 1].map(z => <Board key={`${x}:${z}`}
        size={[.03, toe, .03]} at={[x * (w / 2 - .04), toe / 2, z * (d / 2 - .05)]}
        color={componentColor(cabinet, plinth)} map={plinthMap} {...componentSurface(plinth)} />))
        : <Board size={[w - .04, toe, d - .09]} at={[0, toe / 2, -.025]} color={componentColor(cabinet, plinth)} map={plinthMap} {...componentSurface(plinth)} />}
    </group>}
    {!slot && opening !== "open" && doorsHeight > .01 && Array.from({ length: cabinet.doorCount }, (_, index) => {
      const dw = w / cabinet.doorCount, right = index === 1, hinge = right ? w / 2 : -w / 2;
      return <group key={`door-${index}`} position={[hinge, toe + doorsHeight / 2, d / 2 - .009]}
        rotation={[0, open ? (right ? 1 : -1) * Math.PI * .38 : 0, 0]}>
        <Front width={dw} height={doorsHeight} at={[right ? -dw / 2 : dw / 2, 0, 0]} cabinet={cabinet} map={frontFinish === finish ? map : frontMap} />
      </group>;
    })}
    {!slot && opening !== "open" && Array.from({ length: drawers }, (_, i) => <Front key={`drawer-${i}`} width={w} height={drawerHeight}
      at={[0, h - drawerHeight * (i + .5), d / 2 - .009 + (open ? .18 : 0)]} cabinet={cabinet} kind="drawer-front" map={drawerFinish === finish ? map : drawerMap} />)}
    {slot && <>
      {cabinet.type === "tall" ? [[0, slot.bottom - 18], [slot.top + 18, cabinet.height]].map(([bottom, top]) =>
        <group key={bottom}>{Array.from({ length: cabinet.doorCount }, (_, index) => {
          const dw = w / cabinet.doorCount, right = index === 1;
          return <group key={index} position={[right ? w / 2 : -w / 2, (top + bottom) / 2000, d / 2 - .009]}
            rotation={[0, open ? (right ? 1 : -1) * Math.PI * .38 : 0, 0]}>
            <Front width={dw} height={(top - bottom) / 1000} at={[right ? -dw / 2 : dw / 2, 0, 0]} cabinet={cabinet} map={frontFinish === finish ? map : frontMap} />
          </group>;
        })}</group>)
        : [[80, slot.bottom - 18], [slot.top + 18, cabinet.height]].map(([bottom, top]) => <Board key={bottom}
          size={[w - .004, (top - bottom) / 1000, .018]} at={[0, (top + bottom) / 2000, d / 2 - .009]} color={cabinet.color} map={map} />)}
      <group name={`Appliance-oven-${cabinet.id}`} userData={{ appliance: "oven", cabinetId: cabinet.id }}>
        <Board size={[OVEN_BODY.width / 1000, OVEN_BODY.height / 1000, OVEN_BODY.depth / 1000]}
          at={[0, slot.y / 1000, slot.z / 1000]} color="#252a29" />
        <Board size={[.594, .594, .018]} at={[0, (slot.bottom + 300) / 1000, d / 2 - .009]}
          color={components.find(c => c.type === "oven")?.color ?? (components.find(c => c.type === "oven")?.model === "steel" ? "#aeb5b3" : "#202726")} roughness={.3} />
        <Board size={[.49, .4, .004]} at={[0, (slot.bottom + 260) / 1000, d / 2 + .002]} color="#091213" roughness={.12} />
        <Board size={[.38, .018, .018]} at={[0, (slot.bottom + 486) / 1000, d / 2 + .013]} color="#b9c0bd" roughness={.25} />
        <Board size={[.1, .03, .002]} at={[0, (slot.bottom + 553) / 1000, d / 2 + .001]} color="#75a994" />
        {[-1, 1].map(sign => <Board key={sign} size={[.027, .027, .008]} at={[sign * .19, (slot.bottom + 553) / 1000, d / 2 + .004]} color="#b9c0bd" />)}
      </group>
    </>}
  </>;
}
function Top({ top, kitchen }: { top: Countertop; kitchen: ModularKitchen }) {
  const finish = top.finish ?? (top.material === "wood" ? "oak" : top.material === "granite" ? "marble" : "matte");
  const map = useMemo(() => createKitchenTexture(finish), [finish]);
  useEffect(() => () => map?.dispose(), [map]);
  const holes = useMemo(() => kitchen.cabinets.filter(c => top.cabinetIds.includes(c.id) && (c.opening === "sink" || hasCooktop(c))), [kitchen.cabinets, top.cabinetIds]);
  const shape = useMemo(() => {
    const s = new Shape(), w = top.width / 1000, d = top.depth / 1000;
    s.moveTo(-w / 2, -d / 2); s.lineTo(w / 2, -d / 2); s.lineTo(w / 2, d / 2); s.lineTo(-w / 2, d / 2); s.closePath();
    const { right, front } = cabinetAxes(top.position.rotation);
    for (const c of holes) {
      const dx = c.position.x - top.position.x, dz = c.position.z - top.position.z;
      const x = (dx * right.x + dz * right.z) / 1000, z = (dx * front.x + dz * front.z) / 1000;
      const sink = getComponents(c).find(item => item.type === "sink");
      const sinkSize = sink ? getComponentSize(c, sink) : null;
      const hw = sinkSize ? sinkSize.width / 2000 : .25, hd = sinkSize ? sinkSize.depth / 2000 : .2;
      const hole = new Path(); hole.moveTo(x - hw, z - hd); hole.lineTo(x - hw, z + hd); hole.lineTo(x + hw, z + hd); hole.lineTo(x + hw, z - hd); hole.closePath(); s.holes.push(hole);
    }
    return s;
  // Geometry is rebuilt when any placement or opening changes.
  }, [top, holes]);
  const finishInfo = FINISHES.find(f => f.id === finish)!;
  return <group position={[top.position.x / 1000, top.position.y / 1000, top.position.z / 1000]} rotation={[0, top.position.rotation, 0]}>
    <mesh position={[0, top.thickness / 1000, 0]} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow raycast={() => {}}>
      <extrudeGeometry args={[shape, { depth: top.thickness / 1000, bevelEnabled: false }]} />
      <meshStandardMaterial color={top.color ?? finishInfo.color} roughness={finishInfo.roughness} map={map} />
    </mesh>
    {kitchen.backsplash && <Board size={[top.width / 1000, kitchen.wallClearance / 1000, .012]}
      at={[0, top.thickness / 1000 + kitchen.wallClearance / 2000, -top.depth / 2000 + .006]} color={top.color ?? finishInfo.color} map={map} />}
  </group>;
}
function CounterAppliance({ cabinet: c, kitchen }: { cabinet: ModularCabinet; kitchen: ModularKitchen }) {
  const components = getComponents(c), hob = components.find(item => item.type === "cooktop"), sink = components.find(item => item.type === "sink"), tap = components.find(item => item.type === "tap");
  const bowl = sink ? getComponentSize(c, sink) : { width: 440, height: 150, depth: 340 };
  const faucet = tap ? getComponentSize(c, tap) : { width: 22, height: 260, depth: 160 };
  const w = bowl.width / 1000, d = bowl.depth / 1000, h = bowl.height / 1000;
  return <group name={`Appliance-${sink ? "sink" : "cooktop"}-${c.id}`}
    position={[c.position.x / 1000, (c.position.y + c.height + kitchen.countertop.thickness) / 1000, c.position.z / 1000]} rotation={[0, c.position.rotation, 0]}>
    {hob ? <>
      <Board size={[.498, .044, .398]} at={[0, -.022, 0]} color="#252a29" />
      <Board size={[.52, .002, .44]} at={[0, .001, 0]} color={componentColor(c, hob)} roughness={.2} />
      {[-1, 1].flatMap(x => [-1, 1].map(z => <mesh key={`${x}:${z}`} position={[x * .13, .003, z * .11]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[hob.model === "ceramic" ? .035 : .05, .053, 24]} /><meshStandardMaterial color="#929b98" /></mesh>))}
    </> : sink && tap ? <>
      <group name={`Component-tap-${c.id}`}>
        <Board size={[.022, faucet.height / 1000, .022]} at={[0, faucet.height / 2000, -.235]} color={componentColor(c, tap)} {...componentSurface(tap)} />
        <group rotation={[0, tap.model === "angled" ? .3 : 0, 0]} position={[0, 0, -.235]}>
          <Board size={[.022, .022, faucet.depth / 1000]} at={[0, (faucet.height - 11) / 1000, (faucet.depth / 2 - 11) / 1000]} color={componentColor(c, tap)} {...componentSurface(tap)} />
        </group>
      </group>
      <group name={`Component-sink-${c.id}`}>
        {sink.model === "double" && <Board size={[.008, h, d]} at={[0, -h / 2, 0]} color={componentColor(c, sink)} {...componentSurface(sink)} />}
        <Board size={[w, .008, d]} at={[0, -h + .004, 0]} color={componentColor(c, sink)} {...componentSurface(sink)} />
        {[-1, 1].map(sign => <group key={sign}>
          <Board size={[.008, h, d]} at={[sign * (w / 2 - .004), -h / 2, 0]} color={componentColor(c, sink)} {...componentSurface(sink)} />
          <Board size={[w, h, .008]} at={[0, -h / 2, sign * (d / 2 - .004)]} color={componentColor(c, sink)} {...componentSurface(sink)} />
        </group>)}
      </group>
    </> : null}
  </group>;
}
export function KitchenTops({ kitchen }: { kitchen: ModularKitchen }) {
  const tops = useMemo(() => fitCountertops(kitchen), [kitchen]);
  return <>{tops.map(top => <Top key={top.id} top={top} kitchen={kitchen} />)}
    {kitchen.cabinets.filter(c => c.opening === "sink" || hasCooktop(c)).map(c => <CounterAppliance key={c.id} cabinet={c} kitchen={kitchen} />)}
  </>;
}
/** Used verbatim by the editor and room planner; scale is always 1. */
export function KitchenAssemblyMesh({ kitchen, centered = false, open = false }: { kitchen: ModularKitchen; centered?: boolean; open?: boolean }) {
  const bounds = kitchenEnvelope(kitchen);
  return <group position={centered ? [-bounds.centerX / 1000, 0, -bounds.centerZ / 1000] : [0, 0, 0]}>
    {kitchen.cabinets.map(c => <group key={c.id} name={`Cabinet-${c.id}`} position={[c.position.x / 1000, c.position.y / 1000, c.position.z / 1000]} rotation={[0, c.position.rotation, 0]}>
      <CabinetBody cabinet={c} open={open} />
    </group>)}<KitchenTops kitchen={kitchen} />
  </group>;
}
