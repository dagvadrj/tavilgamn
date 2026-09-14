"use client";
import { useEffect, useMemo } from "react";
import { Path, Shape, type Texture } from "three";
import { hasCooktop, ovenSlot, OVEN_BODY } from "@/lib/plitka";
import {
  componentColor,
  componentSurface,
  getComponentSize,
  getComponents,
} from "@/lib/kitchenComponents";
import { FINISHES, type Finish } from "@/lib/kitchen";
import type {
  Countertop,
  ModularCabinet,
  ModularKitchen,
} from "@/lib/kitchenCabinets";
import { cabinetAxes, fitCountertops } from "@/lib/kitchenPlacement";
import { kitchenEnvelope } from "@/lib/kitchenAssembly";
import { createKitchenTexture } from "./kitchenTextures";
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
    <mesh position={at} castShadow receiveShadow>
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
function Front({
  width,
  height,
  at,
  cabinet,
  map,
  kind = "door-front",
}: {
  width: number;
  height: number;
  at: XYZ;
  cabinet: ModularCabinet;
  map: Texture | null;
  kind?: "door-front" | "drawer-front";
}) {
  const components = getComponents(cabinet),
    part = components.find((c) => c.type === kind)!;
  const handle = components.find((c) => c.type === "handle");
  const w = width - 0.004,
    h = height - 0.004,
    framed = part.model !== "flat";
  const surface = {
    color: componentColor(cabinet, part),
    ...componentSurface(part),
    map,
  };
  return (
    <group
      position={at}
      name={`Component-${kind}-${cabinet.id}`}
      userData={{ component: kind }}
    >
      {framed ? (
        <>
          <mesh>
            <boxGeometry args={[w - 0.06, h - 0.06, 0.012]} />
            <meshStandardMaterial
              {...surface}
              color={part.model === "glass" ? "#b6ced0" : surface.color}
              map={part.model === "glass" ? null : map}
              transparent={part.model === "glass"}
              opacity={part.model === "glass" ? 0.32 : 1}
            />
          </mesh>
          {[-1, 1].map((sign) => (
            <group key={sign}>
              <Board
                size={[0.03, h, 0.018]}
                at={[sign * (w / 2 - 0.015), 0, 0]}
                {...surface}
              />
              <Board
                size={[w - 0.06, 0.03, 0.018]}
                at={[0, sign * (h / 2 - 0.015), 0]}
                {...surface}
              />
            </group>
          ))}
        </>
      ) : (
        <Board size={[w, h, 0.018]} at={[0, 0, 0]} {...surface} />
      )}
      {handle?.model === "bar" && (
        <Board
          size={[getComponentSize(cabinet, handle).width / 1000, 0.014, 0.022]}
          at={[0, h / 2 - 0.045, 0.02]}
          color={componentColor(cabinet, handle)}
          {...componentSurface(handle)}
        />
      )}
      {handle?.model === "knob" && (
        <mesh position={[0, h / 2 - 0.045, 0.025]}>
          <sphereGeometry args={[0.015, 12, 8]} />
          <meshStandardMaterial
            color={componentColor(cabinet, handle)}
            {...componentSurface(handle)}
          />
        </mesh>
      )}
    </group>
  );
}
export function CabinetBody({
  cabinet,
  open = false,
}: {
  cabinet: ModularCabinet;
  open?: boolean;
}) {
  const finish =
    cabinet.finish ??
    (cabinet.material === "wood"
      ? "oak"
      : cabinet.material === "gloss"
        ? "gloss"
        : "matte");
  const map = useMemo(() => createKitchenTexture(finish), [finish]);
  useEffect(() => () => map?.dispose(), [map]);
  const components = getComponents(cabinet);
  const frame = components.find((c) => c.type === "frame")!,
    plinth = components.find((c) => c.type === "plinth");
  const frameOverride = cabinet.components?.find((c) => c.type === "frame");
  const frameColor = frameOverride ? componentColor(cabinet, frame) : undefined;
  const frontFinish =
    (components.find((c) => c.type === "door-front")?.finish as Finish) ??
    finish;
  const drawerFinish =
    (components.find((c) => c.type === "drawer-front")?.finish as Finish) ??
    finish;
  const frameFinish = (frame.finish as Finish) ?? finish;
  const plinthFinish = (plinth?.finish as Finish) ?? "matte";
  const frontMap = useMemo(
    () => (frontFinish === finish ? null : createKitchenTexture(frontFinish)),
    [frontFinish, finish],
  );
  const drawerMap = useMemo(
    () => (drawerFinish === finish ? null : createKitchenTexture(drawerFinish)),
    [drawerFinish, finish],
  );
  const frameMap = useMemo(
    () => (frameOverride?.finish ? createKitchenTexture(frameFinish) : null),
    [frameOverride?.finish, frameFinish],
  );
  const plinthMap = useMemo(
    () => (plinth?.finish ? createKitchenTexture(plinthFinish) : null),
    [plinth?.finish, plinthFinish],
  );
  useEffect(() => () => frontMap?.dispose(), [frontMap]);
  useEffect(() => () => drawerMap?.dispose(), [drawerMap]);
  useEffect(() => () => frameMap?.dispose(), [frameMap]);
  useEffect(() => () => plinthMap?.dispose(), [plinthMap]);
  const slot = ovenSlot(cabinet);
  const w = cabinet.width / 1000,
    h = cabinet.height / 1000,
    d = cabinet.depth / 1000;
  const toe = cabinet.type === "base" ? 0.08 : 0,
    opening = cabinet.opening ?? "doors";
  const drawers =
    opening === "drawers"
      ? Math.max(1, cabinet.drawerCount)
      : cabinet.drawerCount;
  const drawerHeight = opening === "drawers" ? (h - toe) / drawers : 0.12;
  const doorsHeight = h - toe - drawerHeight * drawers;
  return (
    <>
      <Board
        size={[w, h - toe, 0.018]}
        at={[0, (h + toe) / 2, -d / 2 + 0.009]}
        color={frameColor ?? "#e6e0d4"}
        map={frameMap}
        {...componentSurface(frame)}
      />
      {[-1, 1].map((sign) => (
        <Board
          key={sign}
          size={[0.018, h - toe, d]}
          at={[sign * (w / 2 - 0.009), (h + toe) / 2, 0]}
          color={frameColor ?? cabinet.color}
          map={frameOverride ? frameMap : map}
        />
      ))}
      {(slot
        ? [
            toe + 0.009,
            (slot.bottom - 9) / 1000,
            (slot.top + 9) / 1000,
            ...(cabinet.type === "tall" ? [h - 0.009] : []),
          ]
        : [toe + 0.009, (h + toe) / 2, h - 0.009].filter((_, i) =>
            opening === "sink" ? i === 0 : !hasCooktop(cabinet) || i !== 2,
          )
      ).map((y) => (
        <Board
          key={y}
          size={[w - 0.036, 0.018, d - 0.025]}
          at={[0, y, -0.005]}
          color={frameColor ?? "#e6e0d4"}
          map={frameMap}
          {...componentSurface(frame)}
        />
      ))}
      {toe > 0 && plinth && (
        <group name={`Component-plinth-${cabinet.id}`}>
          {plinth.model === "legs" ? (
            [-1, 1].flatMap((x) =>
              [-1, 1].map((z) => (
                <Board
                  key={`${x}:${z}`}
                  size={[0.03, toe, 0.03]}
                  at={[x * (w / 2 - 0.04), toe / 2, z * (d / 2 - 0.05)]}
                  color={componentColor(cabinet, plinth)}
                  map={plinthMap}
                  {...componentSurface(plinth)}
                />
              )),
            )
          ) : (
            <Board
              size={[w - 0.04, toe, d - 0.09]}
              at={[0, toe / 2, -0.025]}
              color={componentColor(cabinet, plinth)}
              map={plinthMap}
              {...componentSurface(plinth)}
            />
          )}
        </group>
      )}
      {!slot &&
        opening !== "open" &&
        doorsHeight > 0.01 &&
        Array.from({ length: cabinet.doorCount }, (_, index) => {
          const dw = w / cabinet.doorCount,
            right = index === 1,
            hinge = right ? w / 2 : -w / 2;
          return (
            <group
              key={`door-${index}`}
              position={[hinge, toe + doorsHeight / 2, d / 2 - 0.009]}
              rotation={[0, open ? (right ? 1 : -1) * Math.PI * 0.38 : 0, 0]}
            >
              <Front
                width={dw}
                height={doorsHeight}
                at={[right ? -dw / 2 : dw / 2, 0, 0]}
                cabinet={cabinet}
                map={frontFinish === finish ? map : frontMap}
              />
            </group>
          );
        })}
      {!slot &&
        opening !== "open" &&
        Array.from({ length: drawers }, (_, i) => (
          <Front
            key={`drawer-${i}`}
            width={w}
            height={drawerHeight}
            at={[
              0,
              h - drawerHeight * (i + 0.5),
              d / 2 - 0.009 + (open ? 0.18 : 0),
            ]}
            cabinet={cabinet}
            kind="drawer-front"
            map={drawerFinish === finish ? map : drawerMap}
          />
        ))}
      {slot && (
        <>
          {cabinet.type === "tall"
            ? [
                [0, slot.bottom - 18],
                [slot.top + 18, cabinet.height],
              ].map(([bottom, top]) => (
                <group key={bottom}>
                  {Array.from({ length: cabinet.doorCount }, (_, index) => {
                    const dw = w / cabinet.doorCount,
                      right = index === 1;
                    return (
                      <group
                        key={index}
                        position={[
                          right ? w / 2 : -w / 2,
                          (top + bottom) / 2000,
                          d / 2 - 0.009,
                        ]}
                        rotation={[
                          0,
                          open ? (right ? 1 : -1) * Math.PI * 0.38 : 0,
                          0,
                        ]}
                      >
                        <Front
                          width={dw}
                          height={(top - bottom) / 1000}
                          at={[right ? -dw / 2 : dw / 2, 0, 0]}
                          cabinet={cabinet}
                          map={frontFinish === finish ? map : frontMap}
                        />
                      </group>
                    );
                  })}
                </group>
              ))
            : [
                [80, slot.bottom - 18],
                [slot.top + 18, cabinet.height],
              ].map(([bottom, top]) => (
                <Board
                  key={bottom}
                  size={[w - 0.004, (top - bottom) / 1000, 0.018]}
                  at={[0, (top + bottom) / 2000, d / 2 - 0.009]}
                  color={cabinet.color}
                  map={map}
                />
              ))}
          <group
            name={`Appliance-oven-${cabinet.id}`}
            userData={{ appliance: "oven", cabinetId: cabinet.id }}
          >
            <Board
              size={[
                OVEN_BODY.width / 1000,
                OVEN_BODY.height / 1000,
                OVEN_BODY.depth / 1000,
              ]}
              at={[0, slot.y / 1000, slot.z / 1000]}
              color="#252a29"
            />
            <Board
              size={[0.594, 0.594, 0.018]}
              at={[0, (slot.bottom + 300) / 1000, d / 2 - 0.009]}
              color={
                components.find((c) => c.type === "oven")?.color ??
                (components.find((c) => c.type === "oven")?.model === "steel"
                  ? "#aeb5b3"
                  : "#202726")
              }
              roughness={0.3}
            />
            <Board
              size={[0.49, 0.4, 0.004]}
              at={[0, (slot.bottom + 260) / 1000, d / 2 + 0.002]}
              color="#091213"
              roughness={0.12}
            />
            <Board
              size={[0.38, 0.018, 0.018]}
              at={[0, (slot.bottom + 486) / 1000, d / 2 + 0.013]}
              color="#b9c0bd"
              roughness={0.25}
            />
            <Board
              size={[0.1, 0.03, 0.002]}
              at={[0, (slot.bottom + 553) / 1000, d / 2 + 0.001]}
              color="#75a994"
            />
            {[-1, 1].map((sign) => (
              <Board
                key={sign}
                size={[0.027, 0.027, 0.008]}
                at={[sign * 0.19, (slot.bottom + 553) / 1000, d / 2 + 0.004]}
                color="#b9c0bd"
              />
            ))}
          </group>
        </>
      )}
    </>
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
      const hw = sinkSize ? sinkSize.width / 2000 : 0.25,
        hd = sinkSize ? sinkSize.depth / 2000 : 0.2;
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
      {kitchen.backsplash && (
        <Board
          size={[top.width / 1000, kitchen.wallClearance / 1000, 0.012]}
          at={[
            0,
            top.thickness / 1000 + kitchen.wallClearance / 2000,
            -top.depth / 2000 + 0.006,
          ]}
          color={top.color ?? finishInfo.color}
          map={map}
        />
      )}
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
            size={[0.498, 0.044, 0.398]}
            at={[0, -0.022, 0]}
            color="#252a29"
          />
          <Board
            size={[0.52, 0.002, 0.44]}
            at={[0, 0.001, 0]}
            color={componentColor(c, hob)}
            roughness={0.2}
          />
          {[-1, 1].flatMap((x) =>
            [-1, 1].map((z) => (
              <mesh
                key={`${x}:${z}`}
                position={[x * 0.13, 0.003, z * 0.11]}
                rotation={[-Math.PI / 2, 0, 0]}
              >
                <ringGeometry
                  args={[hob.model === "ceramic" ? 0.035 : 0.05, 0.053, 24]}
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
export function KitchenTops({ kitchen }: { kitchen: ModularKitchen }) {
  const tops = useMemo(() => fitCountertops(kitchen), [kitchen]);
  return (
    <>
      {tops.map((top) => (
        <Top key={top.id} top={top} kitchen={kitchen} />
      ))}
      {kitchen.cabinets
        .filter((c) => c.opening === "sink" || hasCooktop(c))
        .map((c) => (
          <CounterAppliance key={c.id} cabinet={c} kitchen={kitchen} />
        ))}
    </>
  );
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
