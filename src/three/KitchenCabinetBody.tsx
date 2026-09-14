"use client";
import { useEffect, useMemo } from "react";
import type { Texture } from "three";
import { ovenSlot, OVEN_BODY } from "@/lib/plitka";
import { componentColor, componentSurface, getComponentSize, getComponents } from "@/lib/kitchenComponents";
import type { ModularCabinet } from "@/lib/kitchenCabinets";
import type { Finish } from "@/lib/kitchen";
import { cabinetCarcassPanels, cabinetDrawers, cabinetFronts, cabinetToe, frontPanels, type CabinetFront, type KitchenPanel } from "@/lib/kitchenPanels";
import { createKitchenTexture } from "./kitchenTextures";

type XYZ = [number, number, number];
function Board({ size, at, color, map, metalness = 0, roughness = .7 }: { size: XYZ; at: XYZ; color: string; map?: Texture | null; metalness?: number; roughness?: number }) {
  return <mesh position={at} userData={{ sizeMm: size.map(value => Math.round(value * 1e9) / 1e6), positionMm: at.map(value => Math.round(value * 1e9) / 1e6) }}
    castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} map={map} metalness={metalness} roughness={roughness} /></mesh>;
}
function AuthoredPanel({ panel, color, map, roughness = .7, metalness = 0, offset = [0, 0, 0] }: { panel: KitchenPanel; color: string; map?: Texture | null; roughness?: number; metalness?: number; offset?: XYZ }) {
  const glass = panel.role === "glass";
  return <mesh name={`Panel-${panel.id}`} position={panel.position.map((value, i) => (value - offset[i]) / 1000) as XYZ}
    userData={{ panelId: panel.id, panelRole: panel.role, dimensionsMm: panel.size, sizeMm: panel.size, positionMm: panel.position }} castShadow receiveShadow>
    <boxGeometry args={panel.size.map(value => value / 1000) as XYZ} />
    <meshStandardMaterial color={glass ? "#b6ced0" : color} map={glass ? null : map} roughness={glass ? .15 : roughness} metalness={metalness} transparent={glass} opacity={glass ? .32 : 1} />
  </mesh>;
}
function Front({ cabinet, front, map, offset = [0, 0, 0] }: { cabinet: ModularCabinet; front: CabinetFront; map: Texture | null; offset?: XYZ }) {
  const components = getComponents(cabinet), part = components.find(item => item.type === front.kind);
  const handle = front.kind === "filler" ? undefined : components.find(item => item.type === "handle");
  const [x, y, z] = front.position.map((value, i) => (value - offset[i]) / 1000);
  const handleY = y + front.height / 2000 - .045;
  return <group name={`Component-${front.kind}-${cabinet.id}`} userData={{ component: front.kind, frontId: front.id }}>
    {frontPanels(cabinet, front).map(panel => <AuthoredPanel key={panel.id} panel={panel} offset={offset} color={part ? componentColor(cabinet, part) : cabinet.color} map={map} {...(part ? componentSurface(part) : {})} />)}
    {handle?.model === "bar" && <Board size={[getComponentSize(cabinet, handle).width / 1000, .014, .022]}
      at={[x, handleY, z + .02]} color={componentColor(cabinet, handle)} {...componentSurface(handle)} />}
    {handle?.model === "knob" && <mesh position={[x, handleY, z + .025]}>
      <sphereGeometry args={[.015, 12, 8]} /><meshStandardMaterial color={componentColor(cabinet, handle)} {...componentSurface(handle)} />
    </mesh>}
  </group>;
}

/** Cabinet solids and manufacturing export consume exactly the same authored panels. */
export function CabinetBody({ cabinet: c, open = false }: { cabinet: ModularCabinet; open?: boolean }) {
  const finish = c.finish ?? (c.material === "wood" ? "oak" : c.material === "gloss" ? "gloss" : "matte");
  const components = getComponents(c), frame = components.find(item => item.type === "frame"), plinth = components.find(item => item.type === "plinth");
  const frameOverride = c.components?.find(item => item.type === "frame");
  const doorFinish = (components.find(item => item.type === "door-front")?.finish as Finish) ?? finish;
  const drawerFinish = (components.find(item => item.type === "drawer-front")?.finish as Finish) ?? finish;
  const frameFinish = (frame?.finish as Finish) ?? finish;
  const map = useMemo(() => createKitchenTexture(finish), [finish]);
  const doorMap = useMemo(() => doorFinish === finish ? null : createKitchenTexture(doorFinish), [doorFinish, finish]);
  const drawerMap = useMemo(() => drawerFinish === finish ? null : createKitchenTexture(drawerFinish), [drawerFinish, finish]);
  const frameMap = useMemo(() => frameOverride?.finish ? createKitchenTexture(frameFinish) : null, [frameOverride?.finish, frameFinish]);
  useEffect(() => () => map?.dispose(), [map]);
  useEffect(() => () => doorMap?.dispose(), [doorMap]);
  useEffect(() => () => drawerMap?.dispose(), [drawerMap]);
  useEffect(() => () => frameMap?.dispose(), [frameMap]);
  if (c.opening === "refrigerator") return <Refrigerator cabinet={c} open={open} />;
  if (c.opening === "hood" && c.hoodMount === "wall") return <Hood cabinet={c} />;
  const faces = cabinetFronts(c), drawers = cabinetDrawers(c), slot = ovenSlot(c);
  const toe = cabinetToe(c), w = c.width / 1000, d = c.depth / 1000;
  return <>
    {cabinetCarcassPanels(c).map(panel => <AuthoredPanel key={panel.id} panel={panel}
      color={frameOverride && frame ? componentColor(c, frame) : panel.id.startsWith("side-") ? c.color : "#e6e0d4"}
      map={frameOverride ? frameMap : panel.id.startsWith("side-") ? map : null} {...(frameOverride && frame ? componentSurface(frame) : {})} />)}
    {toe > 0 && plinth?.model === "legs" && <group name={`Component-plinth-${c.id}`}>{[-1, 1].flatMap(x => [-1, 1].map(z => <Board key={`leg-${x}-${z}`}
      size={[.03, toe / 1000, .03]} at={[x * (w / 2 - .04), toe / 2000, z * (d / 2 - .05)]} color={componentColor(c, plinth)} {...componentSurface(plinth)} />))}</group>}
    {faces.filter(face => face.kind !== "drawer-front").map(face => {
      if (!face.hinge) return <Front key={face.id} cabinet={c} front={face} map={map} />;
      const pivot: XYZ = [face.position[0] + (face.hinge === "right" ? 1 : -1) * face.width / 2, face.position[1], face.position[2]];
      return <group key={face.id} position={pivot.map(value => value / 1000) as XYZ}
        rotation={[0, open ? (face.hinge === "right" ? 1 : -1) * Math.PI * .38 : 0, 0]}>
        <Front cabinet={c} front={face} offset={pivot} map={doorFinish === finish ? map : doorMap} />
      </group>;
    })}
    {drawers.map(drawer => <group key={drawer.id} name={`Drawer-${c.id}-${drawer.index + 1}`} position={[0, 0, open ? drawer.travel / 1000 : 0]}>
      {drawer.panels.map(panel => <AuthoredPanel key={panel.id} panel={panel} color="#dedbd1" />)}
      <Front cabinet={c} front={faces.find(face => face.drawerIndex === drawer.index)!} map={drawerFinish === finish ? map : drawerMap} />
    </group>)}
    {slot && <Oven cabinet={c} />}
    {c.opening === "hood" && <Hood cabinet={c} />}
  </>;
}
function Oven({ cabinet: c }: { cabinet: ModularCabinet }) {
  const slot = ovenSlot(c)!;
  const part = getComponents(c).find(item => item.type === "oven")!;
  const front = c.depth / 2000, y = (slot.bottom + 300) / 1000;
  return <group name={`Appliance-oven-${c.id}`} userData={{ appliance: "oven", cabinetId: c.id }}>
    <Board size={[OVEN_BODY.width / 1000, OVEN_BODY.height / 1000, OVEN_BODY.depth / 1000]} at={[0, slot.y / 1000, slot.z / 1000]} color="#252a29" />
    {/* The appliance's metal surround frames its glass; no wood crossbar covers its controls. */}
    <Board size={[.594, .594, .018]} at={[0, y, front - .009]} color={componentColor(c, part)} roughness={.3} />
    <Board size={[.54, .456, .004]} at={[0, y - .043, front + .002]} color="#091213" roughness={.12} />
    <Board size={[.54, .068, .004]} at={[0, y + .242, front + .002]} color="#101718" roughness={.12} />
    <Board size={[.38, .018, .018]} at={[0, y + .18, front + .013]} color="#b9c0bd" roughness={.25} />
    <Board size={[.1, .03, .002]} at={[0, y + .242, front + .005]} color="#75a994" />
    {[-1, 1].map(sign => <Board key={sign} size={[.027, .027, .008]} at={[sign * .19, y + .242, front + .008]} color="#b9c0bd" />)}
  </group>;
}
function Hood({ cabinet: c }: { cabinet: ModularCabinet }) {
  const integrated = c.hoodMount !== "wall", w = c.width / 1000, h = c.height / 1000, d = c.depth / 1000;
  const part = getComponents(c).find(item => item.type === "hood");
  const color = part ? componentColor(c, part) : "#aeb5b3";
  // Integrated hoods occupy the bottom of their cabinet envelope, keeping clearance accurate.
  const hoodHeight = integrated ? .08 : Math.min(.12, h * .18);
  return <group name={`Appliance-hood-${c.id}`} userData={{ appliance: "hood", cabinetId: c.id }}>
    <Board size={[w, hoodHeight, d]} at={[0, hoodHeight / 2, 0]} color={color} metalness={.8} roughness={.3} />
    <Board size={[w * .78, .004, d * .7]} at={[0, .002, -.015]} color="#333c39" metalness={.6} />
    {[-1, 1].map(sign => <mesh key={sign} position={[sign * w * .34, .004, d * .32]} rotation={[Math.PI / 2, 0, 0]}>
      <circleGeometry args={[.018, 16]} /><meshStandardMaterial color="#fff7d8" emissive="#fff1bf" emissiveIntensity={.7} side={2} />
    </mesh>)}
    <Board size={[.07, .012, .004]} at={[0, hoodHeight * .55, d / 2 - .002]} color="#25322d" />
    {!integrated && <>
      <mesh position={[0, hoodHeight + h * .16, 0]} scale={[1, 1, d / w]} castShadow receiveShadow>
        <cylinderGeometry args={[Math.min(w * .2, .16), w / Math.SQRT2 - .005, h * .32, 4, 1, false, Math.PI / 4]} />
        <meshStandardMaterial color={color} metalness={.8} roughness={.3} />
      </mesh>
      <Board size={[Math.min(.22, w * .3), Math.max(.01, h - hoodHeight - h * .32), Math.min(.2, d * .4)]}
        at={[0, (h + hoodHeight + h * .32) / 2, 0]} color={color} metalness={.8} roughness={.3} />
    </>}
  </group>;
}
function Refrigerator({ cabinet: c, open }: { cabinet: ModularCabinet; open: boolean }) {
  const w = c.width / 1000, h = c.height / 1000, d = c.depth / 1000, sideBySide = c.refrigeratorStyle === "side-by-side";
  const part = getComponents(c).find(item => item.type === "refrigerator"), color = part ? componentColor(c, part) : "#aeb5b3";
  const thickness = .035, frontZ = d / 2 - .041;
  const bodyDepth = d - .066, interiorDepth = bodyDepth - thickness;
  const faces = sideBySide ? [
    { x: -w / 4, y: h / 2, width: w / 2 - .002, height: h - .004, right: false },
    { x: w / 4, y: h / 2, width: w / 2 - .002, height: h - .004, right: true },
  ] : [
    { x: 0, y: h * .325, width: w - .004, height: h * .65 - .002, right: false },
    { x: 0, y: h * .825, width: w - .004, height: h * .35 - .004, right: false },
  ];
  return <group name={`Appliance-refrigerator-${c.id}`} userData={{ appliance: "refrigerator", cabinetId: c.id, dimensionsMm: [c.width, c.height, c.depth] }}>
    <Board size={[w, h, thickness]} at={[0, h / 2, -d / 2 + thickness / 2]} color={color} metalness={.6} />
    {[-1, 1].map(sign => <Board key={sign} size={[thickness, h, interiorDepth]} at={[sign * (w / 2 - thickness / 2), h / 2, (thickness - .066) / 2]} color={color} metalness={.6} />)}
    {[thickness / 2, h - thickness / 2].map(y => <Board key={y} size={[w - thickness * 2, thickness, interiorDepth]} at={[0, y, (thickness - .066) / 2]} color="#dce2df" />)}
    {[.2, .4, .65, .8].flatMap(fraction => (sideBySide ? [-1, 1] : [0]).map(side =>
      <Board key={`${fraction}-${side}`} size={[sideBySide ? (w - thickness * 2 - .024) / 2 : w - thickness * 2, .008, interiorDepth - .016]}
        at={[sideBySide ? side * (w - thickness * 2 + .024) / 4 : 0, h * fraction, (thickness - .066) / 2 - .004]} color="#c4d8d7" roughness={.15} />))}
    {sideBySide && <Board size={[.024, h - thickness * 2, interiorDepth]} at={[0, h / 2, (thickness - .066) / 2]} color="#dce2df" />}
    {faces.map((face, i) => {
      const hinge = face.x + (face.right ? face.width / 2 : -face.width / 2), localX = face.x - hinge;
      return <group key={i} position={[hinge, face.y, frontZ]} rotation={[0, open ? (face.right ? 1 : -1) * Math.PI * .38 : 0, 0]}>
        <Board size={[face.width, face.height, .05]} at={[localX, 0, 0]} color={color} metalness={.75} roughness={.28} />
        <Board size={[.015, Math.min(.4, face.height * .6), .022]} at={[localX + (face.right ? -1 : 1) * (face.width / 2 - .04), 0, .03]} color="#606e68" metalness={.85} />
        {sideBySide && i === 0 && <Board size={[Math.min(.14, face.width * .5), .2, .004]} at={[localX, .05, .027]} color="#202d29" />}
      </group>;
    })}
  </group>;
}
