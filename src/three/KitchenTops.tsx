/** Planned worktops, splashbacks and counter appliances share the manufacturing geometry. */
"use client";
import { KitchenCatalogAppliance } from "./KitchenCatalogAppliance";
import { useEffect, useMemo } from "react";
import type { ThreeEvent } from "@react-three/fiber";
import { ExtrudeGeometry, Path, Shape, type Texture } from "three";
import { Edges } from "@react-three/drei";
import { KITCHEN_WALL_MATERIALS } from "@/lib/kitchenWallMaterials";
import { kitchenCornerGeometry } from "@/lib/kitchenCornerGeometry";
import type { KitchenMaterialDefinition } from "@/lib/kitchenMaterials";
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
import {
  cabinetAxes,
  fitCountertops,
} from "@/lib/kitchenPlacement";
import { fitBacksplashes, type BacksplashPanel } from "@/lib/kitchenBacksplash";
import type { KitchenServicePoint } from "@/lib/kitchenServices";
import { useKitchenSurfaceTextures } from "./useKitchenSurfaceTextures";
import { resolveKitchenPaintMaterial } from "@/lib/kitchenPaint";
type XYZ = [number, number, number];
function Board({
  size,
  at,
  color,
  roughness = 0.7,
  metalness = 0,
  map,
  normalMap,
  roughnessMap,
  metalnessMap,
}: {
  size: XYZ;
  at: XYZ;
  color: string;
  roughness?: number;
  metalness?: number;
  map?: Texture | null;
  normalMap?: Texture | null;
  roughnessMap?: Texture | null;
  metalnessMap?: Texture | null;
}) {
  return (
    <mesh
      position={at}
      userData={{
        sizeMm: size.map((value) => Math.round(value * 1e9) / 1e6),
        positionMm: at.map((value) => Math.round(value * 1e9) / 1e6),
      }}
      castShadow
      receiveShadow
    >
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
        map={map}
        normalMap={normalMap}
        roughnessMap={roughnessMap}
        metalnessMap={metalnessMap}
      />
    </mesh>
  );
}
function Top({
  top,
  kitchen,
  materialDefinitions,
  onSelect,
  onPointerDown,
  selected,
}: {
  top: Countertop;
  kitchen: ModularKitchen;
  materialDefinitions?: Record<string, KitchenMaterialDefinition>;
  onSelect?: (top: Countertop) => void;
  onPointerDown?: (event: ThreeEvent<PointerEvent>, top: Countertop) => void;
  selected?: boolean;
}) {
  const finish =
    top.finish ??
    (top.material === "wood"
      ? "oak"
      : top.material === "granite"
        ? "marble"
        : "matte");
  const definition = resolveKitchenPaintMaterial(top.materialId ?? finish, materialDefinitions);
  const textures = useKitchenSurfaceTextures(definition, finish);
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
    const anchor = top.cutoutAnchor ?? top.position;
    const { right, front } = cabinetAxes(anchor.rotation);
    for (const c of holes) {
      const dx = c.position.x - anchor.x,
        dz = c.position.z - anchor.z;
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
      name={top.id}
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
        onPointerDown={onPointerDown ? event => onPointerDown(event, top) : onSelect ? event => event.stopPropagation() : undefined}
        onClick={onSelect ? event => { event.stopPropagation(); if (event.delta <= 5) onSelect(top); } : undefined}
      >
        <extrudeGeometry
          args={[shape, { depth: top.thickness / 1000, bevelEnabled: false }]}
        />
        <meshStandardMaterial
          color={top.color ?? definition?.baseColor ?? finishInfo.color}
          roughness={definition?.roughness ?? finishInfo.roughness}
          metalness={definition?.metalness ?? 0}
          {...textures}
        />
        {selected && <Edges color="#0078d4" linewidth={2} raycast={() => {}} />}
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
      {hob && c.catalogAdaptation ? <KitchenCatalogAppliance cabinet={c} cooktop /> : hob ? (
        <>
          <Board
            size={[
              (hobSize.cutoutWidth - 2) / 1000,
              0.044,
              (hobSize.cutoutDepth - 2) / 1000,
            ]}
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
                position={[
                  (x * hobSize.width) / 4000,
                  0.003,
                  (z * hobSize.depth) / 4000,
                ]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <ringGeometry
                  args={[
                    hob.model.startsWith("ceramic") ? 0.035 : 0.05,
                    0.053,
                    24,
                  ]}
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
export function KitchenTops({
  kitchen,
  materialDefinitions,
  onBacksplashPointerDown,
  catalogApplianceIds = [],
  onSelectCountertop,
  onCountertopPointerDown,
  selectedId,
  servicePoints = [],
}: {
  kitchen: ModularKitchen;
  /** Outlets on the splashback get a real cut-out in the tiles. */
  servicePoints?: KitchenServicePoint[];
  materialDefinitions?: Record<string, KitchenMaterialDefinition>;
  catalogApplianceIds?: string[];
  onSelectCountertop?: (top: Countertop) => void;
  onCountertopPointerDown?: (event: ThreeEvent<PointerEvent>, top: Countertop) => void;
  selectedId?: string | null;
  onBacksplashPointerDown?: (
    event: ThreeEvent<PointerEvent>,
    id: string,
  ) => void;
}) {
  const tops = useMemo(() => fitCountertops(kitchen), [kitchen]);
  const backsplashes = useMemo(() => fitBacksplashes(kitchen), [kitchen]);
  const corner = kitchenCornerGeometry(kitchen);
  return (
    <>
      {tops.map((top) => (
        <Top
          key={top.id}
          top={top}
          kitchen={kitchen}
          materialDefinitions={materialDefinitions}
          onSelect={onSelectCountertop}
          onPointerDown={onCountertopPointerDown}
          selected={top.id === selectedId}
        />
      ))}
      {backsplashes.map((panel) => (
        <BacksplashBoard
          key={panel.id}
          panel={panel}
          cutouts={servicePoints}
          tiles={(kitchen.backsplashMaterialId ?? "wall-tiles-white").startsWith("wall-tiles")}
          onPointerDown={(event) => onBacksplashPointerDown?.(event, panel.id)}
          materialDefinition={
            resolveKitchenPaintMaterial(kitchen.backsplashMaterialId ?? "wall-tiles-white", { ...Object.fromEntries(KITCHEN_WALL_MATERIALS.map(m => [m.id, m])), ...materialDefinitions })
          }
        />
      ))}
      {corner?.panels.map(panel => <FinishedBoard key={panel.id} id={panel.id} width={panel.width} height={panel.height} depth={panel.thickness}
        position={panel.position} finish={panel.cabinet.finish ?? "matte"}
        materialDefinition={resolveKitchenPaintMaterial(panel.cabinet.frontMaterialId ?? panel.cabinet.carcassMaterialId, materialDefinitions)}
        color={!panel.cabinet.frontMaterialId && !panel.cabinet.carcassMaterialId ? "#f1f0ed" : undefined} />)}
      {kitchen.cabinets
        .filter((c) => !catalogApplianceIds.includes(c.id) && (c.opening === "sink" || hasCooktop(c)))
        .map((c) => (
          <CounterAppliance key={c.id} cabinet={c} kitchen={kitchen} />
        ))}
    </>
  );
}
/** One tile repeat (4 rows of 75 mm brick-laid tiles) in metres. */
const TILE_REPEAT = 0.3;
/** Splashback with real openings where outlets are set into the tiles; texture keeps true tile size. */
function BacksplashBoard({
  panel,
  cutouts,
  tiles,
  materialDefinition,
  onPointerDown,
}: {
  panel: BacksplashPanel;
  cutouts: KitchenServicePoint[];
  tiles: boolean;
  materialDefinition?: KitchenMaterialDefinition;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
}) {
  const textures = useKitchenSurfaceTextures(materialDefinition, "matte");
  const material = FINISHES.find((item) => item.id === "matte")!;
  const shape = useMemo(() => {
    const w = panel.width / 1000, h = panel.height / 1000;
    const s = new Shape();
    s.moveTo(-w / 2, 0); s.lineTo(w / 2, 0); s.lineTo(w / 2, h); s.lineTo(-w / 2, h); s.closePath();
    const { right, front } = cabinetAxes(panel.position.rotation);
    for (const point of cutouts) {
      if (!point.onBacksplash) continue;
      const dx = point.x - panel.position.x, dz = point.z - panel.position.z;
      const along = dx * right.x + dz * right.z, across = dx * front.x + dz * front.z;
      const y = point.y - panel.position.y;
      const hw = point.width / 2 + 3, hh = point.height / 2 + 3;
      if (Math.abs(across) > panel.thickness + 5 || Math.abs(along) + hw > panel.width / 2 || y - hh < 0 || y + hh > panel.height) continue;
      const hole = new Path();
      hole.moveTo((along - hw) / 1000, (y - hh) / 1000);
      hole.lineTo((along - hw) / 1000, (y + hh) / 1000);
      hole.lineTo((along + hw) / 1000, (y + hh) / 1000);
      hole.lineTo((along + hw) / 1000, (y - hh) / 1000);
      hole.closePath();
      s.holes.push(hole);
    }
    return s;
  }, [panel, cutouts]);
  const geometry = useMemo(() => {
    const g = new ExtrudeGeometry(shape, { depth: panel.thickness / 1000, bevelEnabled: false });
    // Extrude UVs are in metres; scale them so a tile reads at its real size.
    const uv = g.getAttribute("uv"), scale = tiles ? 1 / TILE_REPEAT : 1;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * scale, uv.getY(i) * scale);
    uv.needsUpdate = true;
    return g;
  }, [shape, panel.thickness, tiles]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <group
      name={panel.id}
      onPointerDown={onPointerDown}
      position={[panel.position.x / 1000, panel.position.y / 1000, panel.position.z / 1000]}
      rotation={[0, panel.position.rotation, 0]}
    >
      <mesh geometry={geometry} position={[0, 0, -panel.thickness / 2000]} castShadow receiveShadow
        userData={{ sizeMm: [panel.width, panel.height, panel.thickness] }}>
        <meshStandardMaterial
          {...textures}
          color={materialDefinition?.baseColor ?? material.color}
          roughness={materialDefinition?.roughness ?? material.roughness}
          metalness={materialDefinition?.metalness ?? 0}
        />
      </mesh>
    </group>
  );
}
function FinishedBoard({
  id,
  width,
  height,
  depth,
  position,
  color,
  finish = "matte",
  materialDefinition,
  onPointerDown,
}: {
  id: string;
  width: number;
  height: number;
  depth: number;
  position: ModularCabinet["position"];
  color?: string;
  finish?: Countertop["finish"];
  materialDefinition?: KitchenMaterialDefinition;
  onPointerDown?: (event: ThreeEvent<PointerEvent>) => void;
}) {
  const textures = useKitchenSurfaceTextures(materialDefinition, finish);
  const material = FINISHES.find((item) => item.id === finish)!;
  return (
    <group
      name={id}
      onPointerDown={onPointerDown}
      position={[position.x / 1000, position.y / 1000, position.z / 1000]}
      rotation={[0, position.rotation, 0]}
    >
      <Board
        size={[width / 1000, height / 1000, depth / 1000]}
        at={[0, height / 2000, 0]}
        {...textures}
        color={color ?? materialDefinition?.baseColor ?? material.color}
        roughness={materialDefinition?.roughness ?? material.roughness}
        metalness={materialDefinition?.metalness ?? 0}
      />
    </group>
  );
}
