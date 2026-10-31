"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import type {
  CeilingFixture,
  RoomDesign,
  RoomOpening,
  RoomWall,
} from "@/lib/types";
import {
  getRoomGeometry,
  polygonArea,
  type RoomSegment,
} from "@/lib/roomGeometry";
import { sharedCutsForSegment, type SharedWallCut } from "@/lib/roomLayout";
import { TrayCeiling } from "./TrayCeiling";
import { fixtureMountHeight, automaticCeilingFixtures, RECESSED_FIXTURE_RADIUS, MAX_ROOM_LIGHT_SOURCES } from "@/lib/roomCeiling";
import {
  ROOM_WALL_THICKNESS,
  ROOM_SKIRTING_DEPTH,
  ROOM_SKIRTING_HEIGHT,
  wallMiterEnds,
  wallOpenEnds,
  wallBlocksFocus,
} from "@/lib/roomRendering";
import { sunDirection, exteriorWindowBearing } from "@/lib/roomSunlight";
import { solarLighting } from "@/lib/roomLighting";
import { plannerLighting } from "@/lib/plannerLighting";
import { openingWorldTransform } from "@/lib/roomOpenings";
import { createWallGeometry, type WallCut, type WallEnds } from "./wallCsg";
import { assignWallSurfaceGroups } from "./wallSurfaceGroups";
import { useRoomMaterial } from "./roomMaterials";
import { OpeningMesh } from "./OpeningMesh";
import { animateToward } from "./demandAnimation";
import { isSceneNavigationGesture } from "./sceneNavigation";
import { applyRoomCutaway, cutawayRaycast } from "./roomCutaway";
import { roomFloorFinish } from "./roomFloorFinish";
import { RoomDaylightFill } from "./RoomDaylightFill";
import { useRoomPaintEnvironment } from "./useRoomPaintEnvironment";

const WALL_THICKNESS = ROOM_WALL_THICKNESS;
const noRaycast = () => {};
const WALL_IDS: RoomWall[] = ["north", "east", "south", "west"];

export interface RoomStructureProps {
  onSurfaceDoubleClick?: (
    surface: "wall" | "floor" | "ceiling",
    wall: RoomWall | undefined,
    x: number,
    y: number,
  ) => void;
  design: RoomDesign;
  sharedCuts?: SharedWallCut[];
  sharedBoundaries?: SharedWallCut[];
  wallEnds?: WallEnds;
  connectionOpenings?: RoomOpening[];
  readOnly?: boolean;
  interior?: boolean;
  /** Selected room centre in scene coordinates, used to cut away obstructing neighbours. */
  wallFocus?: [number, number];
  view: "plan" | "perspective";
  onSelect: (id: string | null) => void;
  selectedWall?: RoomWall | null;
  onSelectWall?: (wall: RoomWall) => void;
  selectedOpening?: string | null;
  onSelectOpening?: (id: string | null) => void;
  onUpdateOpening?: (opening: RoomOpening) => void;
  placementTemplate?: string | null;
  onPlaceOpening?: (wall: RoomWall, position: number) => void;
  onPlacementError?: (message: string) => void;
  onDragChange: (value: boolean) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}

function wallIdFor(segment: RoomSegment): RoomWall {
  return Math.abs(segment.nx) > 0.5
    ? segment.nx > 0
      ? "west"
      : "east"
    : segment.nz > 0
      ? "north"
      : "south";
}

function isBaseWall(design: RoomDesign, wall: RoomSegment, id: RoomWall) {
  const x = (wall.a.x + wall.b.x) / 2,
    z = (wall.a.z + wall.b.z) / 2;
  return id === "north"
    ? Math.abs(z + design.depth / 2) < 0.001
    : id === "south"
      ? Math.abs(z - design.depth / 2) < 0.001
      : id === "east"
        ? Math.abs(x - design.width / 2) < 0.001
        : Math.abs(x + design.width / 2) < 0.001;
}

function normalizedPosition(
  design: RoomDesign,
  wall: RoomWall,
  point: THREE.Vector3,
) {
  return wall === "north"
    ? (point.x + design.width / 2) / design.width
    : wall === "south"
      ? (design.width / 2 - point.x) / design.width
      : wall === "east"
        ? (point.z + design.depth / 2) / design.depth
        : (design.depth / 2 - point.z) / design.depth;
}

function RoomWallMesh({
  segment,
  paintEnvironment,
  ...props
}: RoomStructureProps & { segment: RoomSegment; paintEnvironment?: THREE.Texture | null }) {
  const {
    design,
    view,
    selectedWall,
    onSelectWall,
    onSelect,
    placementTemplate,
    onPlaceOpening,
    onPlacementError,
  } = props;
  const id = wallIdFor(segment);
  const x = (segment.a.x + segment.b.x) / 2,
    z = (segment.a.z + segment.b.z) / 2;
  const height = design.height ?? 2.7;
  const rotation = -Math.atan2(
    segment.b.z - segment.a.z,
    segment.b.x - segment.a.x,
  );
  const base = isBaseWall(design, segment, id);
  const finish = design.wallMaterials?.[id];
  const materialProps = useRoomMaterial(
    finish?.mode === "wallpaper" ? finish.materialId : "wall-paint",
    segment.length,
    height,
    finish?.color ?? design.wallColor,
  );
  const meshRef =
    useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[]>>(null);
  const cutawayRoot = useRef<THREE.Group>(null);
  const openingCuts = (design.openings ?? [])
    .filter((opening) => opening.segmentId ? opening.segmentId === segment.id : opening.wallId === id && base)
    .flatMap((opening) => {
      const world = openingWorldTransform(design, opening);
      const along =
        (world.x - x) * Math.cos(rotation) - (world.z - z) * Math.sin(rotation);
      if (
        along - opening.width / 2 < -segment.length / 2 - 0.001 ||
        along + opening.width / 2 > segment.length / 2 + 0.001
      )
        return [];
      return [
        {
          x: along,
          width: opening.width,
          height: opening.height,
          sillHeight: opening.sillHeight,
        },
      ];
    });
  const startExtension = props.wallEnds?.start ?? 0,
    endExtension = props.wallEnds?.end ?? 0;
  const openStart = props.wallEnds?.openStart ?? false,
    openEnd = props.wallEnds?.openEnd ?? false;
  const connectionCuts = sharedCutsForSegment(
    design,
    segment,
    props.sharedCuts ?? [],
  ).map((cut) => {
    if (cut.height < height) return cut;
    const from =
      cut.x -
      cut.width / 2 -
      (cut.x - cut.width / 2 <= -segment.length / 2 + 0.002
        ? Math.max(0, startExtension)
        : 0);
    const to =
      cut.x +
      cut.width / 2 +
      (cut.x + cut.width / 2 >= segment.length / 2 - 0.002
        ? Math.max(0, endExtension)
        : 0);
    return { ...cut, x: (from + to) / 2, width: to - from };
  });
  openingCuts.push(...connectionCuts);
  // A door's open state or selection does not invalidate its expensive CSG geometry.
  const cutKey = JSON.stringify(openingCuts);
  const wallGeometry = useMemo(
    () =>
      assignWallSurfaceGroups(createWallGeometry(
        segment.length,
        height,
        WALL_THICKNESS,
        JSON.parse(cutKey) as WallCut[],
        {
          start: startExtension,
          end: endExtension,
          openStart,
          openEnd,
        },
      )),
    [
      segment.length,
      height,
      cutKey,
      startExtension,
      endExtension,
      openStart,
      openEnd,
    ],
  );
  useEffect(() => () => wallGeometry.dispose(), [wallGeometry]);
  const baseboardPieces = useMemo(() => {
    const cuts = (JSON.parse(cutKey) as WallCut[])
      .filter((cut) => cut.sillHeight < ROOM_SKIRTING_HEIGHT)
      .sort((a, b) => a.x - b.x);
    const pieces: { x: number; width: number }[] = [];
    let start = -segment.length / 2;
    for (const cut of cuts) {
      if (cut.x - cut.width / 2 > start)
        pieces.push({
          x: (start + cut.x - cut.width / 2) / 2,
          width: cut.x - cut.width / 2 - start,
        });
      start = cut.x + cut.width / 2;
    }
    if (start < segment.length / 2)
      pieces.push({
        x: (start + segment.length / 2) / 2,
        width: segment.length / 2 - start,
      });
    return pieces;
  }, [segment.length, cutKey]);

  const worldCentre = useMemo(() => new THREE.Vector3(), []);
  useFrame(({ camera, invalidate }, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.getWorldPosition(worldCentre);
    const outside =
      (camera.position.x - worldCentre.x) * segment.nx +
        (camera.position.z - worldCentre.z) * segment.nz <
      -0.06;
    const obscuresRoom =
      props.readOnly &&
      props.wallFocus &&
      wallBlocksFocus(
        camera.position,
        { x: props.wallFocus[0], z: props.wallFocus[1] },
        {
          x: worldCentre.x,
          z: worldCentre.z,
          nx: segment.nx,
          nz: segment.nz,
          length: segment.length,
          start: startExtension,
          end: endExtension,
        },
      );
    const faded =
      !props.interior && (view === "plan" || outside || obscuresRoom);
    const animation = animateToward(
      (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).opacity,
      faded ? 0 : 1,
      12,
      delta,
    );
    applyRoomCutaway(cutawayRoot.current ?? mesh, animation.value);
    if (animation.moving) invalidate();
    // Color-write suppression keeps hidden walls out of the image. Shadow
    // geometry stays active so orbiting cannot change the room's sunlight.
    mesh.castShadow = true;
  });

  const click = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 4) return;
    if (props.readOnly) {
      event.stopPropagation();
      onSelect(null);
      return;
    }
    event.stopPropagation();
    if (placementTemplate) {
      if (!base) {
        onPlacementError?.(
          "Хаалга, цонхыг үндсэн ханын шулуун хэсэгт байрлуулна уу.",
        );
        return;
      }
      onPlaceOpening?.(id, normalizedPosition(design, id, event.point));
    } else {
      onSelect(null);
      onSelectWall?.(id);
    }
  };

  return (
    <group ref={cutawayRoot} position={[x, 0, z]} rotation={[0, rotation, 0]}
      userData={{ previewWall: { nx: segment.nx, nz: segment.nz } }}>
      <mesh
        ref={meshRef}
        name="room-wall"
        geometry={wallGeometry}
        position={[0, height / 2, -WALL_THICKNESS / 2]}
        receiveShadow
        userData={{
          openingWall: base && !props.readOnly ? id : null,
        }}
        onClick={click}
        onDoubleClick={(event) => {
          event.stopPropagation();
          props.onSurfaceDoubleClick?.(
            "wall",
            id,
            event.clientX,
            event.clientY,
          );
        }}
        raycast={function (
          this: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[]>,
          raycaster,
          intersections,
        ) {
          const mesh = this;
          if ((Array.isArray(mesh.material) ? mesh.material[0] : mesh.material).opacity < 0.2 && !placementTemplate) return;
          THREE.Mesh.prototype.raycast.call(mesh, raycaster, intersections);
        }}
      >
        <meshStandardMaterial
          attach="material-0"
          {...materialProps}
          envMap={finish?.mode !== "wallpaper" ? paintEnvironment ?? null : null}
          emissive={selectedWall === id ? "#1677b8" : "#000000"}
          emissiveIntensity={selectedWall === id ? 0.09 : 0}
        />
        <meshStandardMaterial attach="material-1" color="#e2dfd8" roughness={0.92} metalness={0} />
      </mesh>
      <group userData={{ cutawayDecoration: true }} raycast={cutawayRaycast}>
      {baseboardPieces.map((piece, index) => (
        <RoundedBox
          key={index}
          args={[piece.width, ROOM_SKIRTING_HEIGHT, ROOM_SKIRTING_DEPTH]}
          radius={Math.min(0.004, piece.width / 4)}
          smoothness={2}
          position={[
            piece.x,
            ROOM_SKIRTING_HEIGHT / 2,
            ROOM_SKIRTING_DEPTH / 2,
          ]}
          receiveShadow
          onClick={click}
        >
          <meshStandardMaterial
            // Semi-gloss trim reads apart from matte wall paint, as real skirting does.
            color={selectedWall === id ? "#5aa0cf" : "#f7f6f2"}
            roughness={0.42}
          />
          {selectedWall === id && <Edges color="#006ab5" raycast={noRaycast} />}
        </RoundedBox>
      ))}
      <WallContactShade pieces={baseboardPieces} />
      </group>
      {/* A low perimeter remains clickable from every angle and in the top-down plan. */}
      {baseboardPieces.map((piece, index) => (
        <mesh
          key={`hit-${index}`}
          position={[piece.x, 0.075, -WALL_THICKNESS / 2]}
          onClick={click}
        >
          <boxGeometry args={[piece.width, 0.15, WALL_THICKNESS]} />
          <meshBasicMaterial
            transparent
            opacity={0}
            depthWrite={false}
            colorWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

/** Subtle contact shade keeps walls grounded even when the camera hides their fronts. */
function WallContactShade({
  pieces,
}: {
  pieces: { x: number; width: number }[];
}) {
  const texture = useMemo(() => {
    const pixels = new Uint8Array(2 * 32 * 4);
    for (let y = 0; y < 32; y++)
      for (let x = 0; x < 2; x++)
        pixels[(y * 2 + x) * 4 + 3] = Math.round((y / 31) ** 2 * 255);
    const map = new THREE.DataTexture(pixels, 2, 32, THREE.RGBAFormat);
    map.magFilter = THREE.LinearFilter;
    map.minFilter = THREE.LinearFilter;
    map.needsUpdate = true;
    return map;
  }, []);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <group>
      {pieces.map((piece, index) => (
        <mesh
          key={index}
          position={[piece.x, 0.003, 0.12]}
          rotation={[-Math.PI / 2, 0, 0]}
          raycast={noRaycast}
        >
          <planeGeometry args={[piece.width, 0.24]} />
          <meshBasicMaterial
            map={texture}
            color="#594b3b"
            transparent
            opacity={0.18}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function RoomSurfaces({
  design,
  view,
  onSelect,
  onSelectOpening,
  onSurfaceDoubleClick,
}: RoomStructureProps) {
  const gl = useThree((state) => state.gl);
  const roomGeometry = getRoomGeometry(design);
  const bounds = roomGeometry.bounds;
  const spanX = bounds.maxX - bounds.minX,
    spanZ = bounds.maxZ - bounds.minZ;
  const floorProps = useRoomMaterial(
    design.floorMaterial,
    spanX,
    spanZ,
    design.floorColor,
  );
  const ceilingProps = useRoomMaterial(
    design.ceilingMaterial ?? "ceiling-white",
    spanX,
    spanZ,
    "#ffffff",
  );
  const ceiling = useRef<THREE.Mesh>(null);
  const height = design.height ?? 2.7;
  const geometries = useMemo(() => {
    const outer = roomGeometry.loops.find((loop) => polygonArea(loop) > 0)!;
    const shape = new THREE.Shape(
      outer.map((point) => new THREE.Vector2(point.x, point.z)),
    );
    for (const loop of roomGeometry.loops.filter(
      (points) => polygonArea(points) < 0,
    ))
      shape.holes.push(
        new THREE.Path(
          loop.map((point) => new THREE.Vector2(point.x, point.z)),
        ),
      );
    const floor = new THREE.ExtrudeGeometry(shape, {
      depth: 0.08,
      bevelEnabled: false,
    });
    const roof = new THREE.ShapeGeometry(shape);
    for (const geometry of [floor, roof]) {
      const positions = geometry.getAttribute("position"),
        uv = geometry.getAttribute("uv");
      for (let i = 0; i < positions.count; i++)
        uv.setXY(
          i,
          (positions.getX(i) - bounds.minX) / spanX,
          (positions.getY(i) - bounds.minZ) / spanZ,
        );
      uv.needsUpdate = true;
    }
    return { floor, roof };
  }, [roomGeometry, bounds.minX, bounds.minZ, spanX, spanZ]);
  useEffect(
    () => () => {
      geometries.floor.dispose();
      geometries.roof.dispose();
    },
    [geometries],
  );
  useFrame(({ camera }) => {
    if (ceiling.current)
      ceiling.current.visible =
        view !== "plan" && camera.position.y < height - 0.04;
  });
  return (
    <>
      <mesh
        rotation={[Math.PI / 2, 0, 0]}
        geometry={geometries.floor}
        receiveShadow
        onDoubleClick={(event) => {
          event.stopPropagation();
          onSurfaceDoubleClick?.(
            "floor",
            undefined,
            event.clientX,
            event.clientY,
          );
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          if (
            event.pointerType === "touch" &&
            isSceneNavigationGesture(gl.domElement)
          )
            return;
          event.stopPropagation();
          onSelect(null);
          onSelectOpening?.(null);
        }}
      >
        <meshPhysicalMaterial
          {...floorProps}
          {...roomFloorFinish(design.floorMaterial, floorProps)}
        />
      </mesh>
      <group
        userData={{ previewRoof: true }}
        onDoubleClick={(event) => {
          event.stopPropagation();
          onSurfaceDoubleClick?.(
            "ceiling",
            undefined,
            event.clientX,
            event.clientY,
          );
        }}
      >
        <TrayCeiling design={design} view={view} />
      </group>
      {/* An invisible roof still casts a physical shadow: sun enters through openings. */}
      <mesh
        position={[0, height, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        geometry={geometries.roof}
        castShadow
        raycast={noRaycast}
      >
        <meshBasicMaterial
          colorWrite={false}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>
      <mesh
        ref={ceiling}
        userData={{ previewRoof: true }}
        visible={false}
        position={[0, height, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        geometry={geometries.roof}
        receiveShadow
        onDoubleClick={(event) => {
          event.stopPropagation();
          onSurfaceDoubleClick?.(
            "ceiling",
            undefined,
            event.clientX,
            event.clientY,
          );
        }}
      >
        <meshStandardMaterial {...ceilingProps} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}

function OpeningDropTarget(props: RoomStructureProps) {
  const { gl, camera, scene } = useThree();
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    const element = gl.domElement;
    const dragOver = (event: DragEvent) => {
      if (
        !latest.current.placementTemplate &&
        !event.dataTransfer?.types.includes("application/x-room-opening")
      )
        return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const drop = (event: DragEvent) => {
      const current = latest.current;
      const template =
        event.dataTransfer?.getData("application/x-room-opening") ||
        current.placementTemplate;
      if (!template) return;
      event.preventDefault();
      event.stopPropagation();
      const rect = element.getBoundingClientRect();
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - rect.left) / rect.width) * 2 - 1,
          (-(event.clientY - rect.top) / rect.height) * 2 + 1,
        ),
        camera,
      );
      const hits: THREE.Intersection[] = [];
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh && object.userData.openingWall)
          THREE.Mesh.prototype.raycast.call(object, raycaster, hits);
      });
      hits.sort((a, b) => a.distance - b.distance);
      if (current.view === "perspective" && hits.length) {
        const hit = hits[0],
          wall = hit.object.userData.openingWall as RoomWall;
        current.onPlaceOpening?.(
          wall,
          normalizedPosition(current.design, wall, hit.point),
        );
        return;
      }
      const point = raycaster.ray.intersectPlane(
        new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
        new THREE.Vector3(),
      );
      if (!point) return;
      const walls = WALL_IDS.map((wall) => ({
        wall,
        distance:
          wall === "north"
            ? Math.abs(point.z + current.design.depth / 2)
            : wall === "south"
              ? Math.abs(point.z - current.design.depth / 2)
              : wall === "east"
                ? Math.abs(point.x - current.design.width / 2)
                : Math.abs(point.x + current.design.width / 2),
      }));
      walls.sort((a, b) => a.distance - b.distance);
      if (walls[0].distance > 0.75) {
        current.onPlacementError?.("Хаалга, цонхоо хананд ойртуулж тавина уу.");
        return;
      }
      current.onPlaceOpening?.(
        walls[0].wall,
        normalizedPosition(current.design, walls[0].wall, point),
      );
    };
    element.addEventListener("dragover", dragOver);
    element.addEventListener("drop", drop);
    return () => {
      element.removeEventListener("dragover", dragOver);
      element.removeEventListener("drop", drop);
    };
  }, [gl, camera, scene]);
  return null;
}

export function RoomStructure(props: RoomStructureProps) {
  const { design, view } = props;
  const paintEnvironment = useRoomPaintEnvironment(design);
  const geometry = getRoomGeometry(design);
  const height = design.height ?? 2.7;
  return (
    <group>
      <RoomSurfaces {...props} />
      {geometry.segments
        .filter((segment) => !segment.hole)
        .map((segment, index) => {
          const x = (segment.a.x + segment.b.x) / 2,
            z = (segment.a.z + segment.b.z) / 2;
          const onColumn = (design.columns ?? []).some((column) => {
            const left = column.x - design.width / 2,
              top = column.z - design.depth / 2;
            return (
              x >= left - 1e-6 &&
              x <= left + column.width + 1e-6 &&
              z >= top - 1e-6 &&
              z <= top + column.depth + 1e-6
            );
          });
          return onColumn ? null : (
            <RoomWallMesh
              key={index}
              {...props}
              segment={segment}
              paintEnvironment={paintEnvironment}
              wallEnds={{
                ...wallMiterEnds(
                  design,
                  segment,
                  geometry.segments,
                  props.sharedBoundaries,
                ),
                ...wallOpenEnds(
                  design,
                  segment,
                  geometry.segments,
                  props.sharedBoundaries,
                ),
              }}
            />
          );
        })}
      {(design.columns ?? []).map((column) => (
        <mesh
          key={column.id}
          position={[
            column.x + column.width / 2 - design.width / 2,
            (view === "plan" ? 0.2 : height) / 2,
            column.z + column.depth / 2 - design.depth / 2,
          ]}
          castShadow
          receiveShadow
        >
          <boxGeometry
            args={[column.width, view === "plan" ? 0.2 : height, column.depth]}
          />
          <meshStandardMaterial color={design.wallColor} roughness={0.92} />
          <Edges color="#9a9c91" />
        </mesh>
      ))}
      {(design.openings ?? []).map((opening) => (
        <OpeningMesh
          key={opening.id}
          design={design}
          opening={opening}
          view={view}
          interior={props.interior}
          cutawayFocus={props.readOnly ? props.wallFocus : undefined}
          selected={props.selectedOpening === opening.id}
          onSelect={props.onSelectOpening}
          onUpdate={props.onUpdateOpening}
          onDragChange={props.onDragChange}
          onEditStart={props.onEditStart}
          onEditEnd={props.onEditEnd}
          onError={props.onPlacementError}
        />
      ))}
      {(props.connectionOpenings ?? []).map((opening) => (
        <OpeningMesh
          key={opening.id}
          design={design}
          opening={opening}
          view={view}
          interior={props.interior}
          cutawayFocus={props.readOnly ? props.wallFocus : undefined}
          selected={false}
          onDragChange={props.onDragChange}
        />
      ))}
      {!props.readOnly && <OpeningDropTarget {...props} />}
    </group>
  );
}

function CeilingLamp({
  fixture,
  height,
  span,
  level,
  shadows,
  sourceIntensity,
}: {
  fixture: CeilingFixture;
  height: number;
  span: number;
  /** 1 at night or when switched on, a softer daytime level otherwise. */
  level: number;
  shadows: boolean;
  sourceIntensity?: number;
}) {
  const target = useMemo(() => new THREE.Object3D(), []);
  const housing = useRef<THREE.Group>(null);
  useFrame(({ camera }) => { if (housing.current) housing.current.visible = camera.position.y < height + .02; });
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    target.position.set(0, -height + 0.13, 0);
    target.updateMatrixWorld();
    invalidate();
  }, [height, target, invalidate]);
  const intensity = level > 0 ? fixture.intensity : 0,
    lightPower = (sourceIntensity ?? fixture.intensity) * level,
    kind = fixture.kind ?? "flush",
    drop =
      kind === "pendant"
        ? Math.max(0.2, Math.min(1.2, fixture.pendantDrop ?? 0.6))
        : 0;
  const radius = kind === "recessed" ? RECESSED_FIXTURE_RADIUS : 0.19;
  return (
    <group position={[fixture.x, height - 0.035, fixture.z]}>
      <primitive object={target} />
      <group ref={housing}>
      {kind === "pendant" && (
        <mesh position={[0, -drop / 2, 0]} raycast={noRaycast}>
          <cylinderGeometry args={[0.004, 0.004, drop, 12]} />
          <meshStandardMaterial
            color="#5c6267"
            metalness={0.65}
            roughness={0.3}
          />
        </mesh>
      )}
      {kind === "linear" ? (
        <>
          <mesh castShadow raycast={noRaycast}>
            <boxGeometry args={[1, 0.045, 0.12]} />
            <meshStandardMaterial
              color="#f0efeb"
              metalness={0.12}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[0, -0.028, 0]} raycast={noRaycast}>
            <boxGeometry args={[0.94, 0.008, 0.1]} />
            <meshStandardMaterial
              color="#ffffff"
              emissive={fixture.color}
              emissiveIntensity={intensity > 0 ? 0.9 : 0}
            />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, -drop, 0]} castShadow raycast={noRaycast}>
            <cylinderGeometry
              args={[
                kind === "pendant" ? 0.13 : radius,
                kind === "pendant" ? 0.22 : radius,
                kind === "pendant" ? 0.15 : kind === "recessed" ? 0.015 : 0.045,
                40,
              ]}
            />
            <meshStandardMaterial
              color={kind === "recessed" ? "#ffffff" : "#f0efeb"}
              metalness={0.12}
              roughness={0.3}
            />
          </mesh>
          <mesh
            position={[
              0,
              -drop -
                (kind === "pendant"
                  ? 0.08
                  : kind === "recessed"
                    ? 0.009
                    : 0.028),
              0,
            ]}
            rotation={[Math.PI / 2, 0, 0]}
            raycast={noRaycast}
          >
            <circleGeometry
              args={[kind === "pendant" ? 0.2 : radius * 0.87, 40]}
            />
            <meshStandardMaterial
              color={intensity > 0 ? "#fff6de" : "#e8e6de"}
              emissive={fixture.color}
              emissiveIntensity={intensity > 0 ? 0.9 : 0}
              roughness={0.65}
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )}
      </group>
      {sourceIntensity !== 0 && <><spotLight
        target={target}
        position={[0, -drop - 0.12, 0]}
        intensity={lightPower * 1.25}
        color={fixture.color}
        angle={kind === "recessed" ? 0.95 : 1.23}
        penumbra={0.85}
        distance={Math.max(span * 1.6, height * 2)}
        decay={2}
        castShadow={shadows && intensity > 0}
        shadow-mapSize-width={512}
        shadow-mapSize-height={512}
        shadow-bias={-0.0002}
        shadow-normalBias={0.015}
        shadow-camera-near={0.05}
        shadow-radius={2}
      />
      <pointLight
        position={[0, -drop - 0.15, 0]}
        intensity={lightPower * 0.14}
        color={fixture.color}
        distance={span * 1.5}
        decay={2}
      /></>}
    </group>
  );
}

/** Window glass per floor area over every room: how much sky the design admits. */
function designGlazing(design: RoomDesign) {
  const rooms = design.rooms?.length ? design.rooms : [design];
  let glass = 0, floor = 0;
  for (const room of rooms) {
    floor += room.width * room.depth;
    for (const opening of room.openings ?? [])
      if (opening.kind === "window") glass += opening.width * opening.height;
  }
  return floor > 0 ? glass / floor : undefined;
}

export function RoomLighting({
  design,
  includeSun = true,
  extent = 20,
  centre = [0, 0],
  fixtureShadows = true,
  windowDaylight = true,
}: {
  design: RoomDesign;
  includeSun?: boolean;
  extent?: number;
  centre?: [number, number];
  fixtureShadows?: boolean;
  windowDaylight?: boolean;
}) {
  const lighting = design.lighting,
    solar = solarLighting(lighting);
  const rig = plannerLighting(lighting, {
    glazing: designGlazing(design),
    floorColor: design.floorColor,
    wallColor: design.wallColor,
  });
  const target = useMemo(() => new THREE.Object3D(), []);
  const invalidate = useThree((state) => state.invalidate);
  const [centreX, centreZ] = centre;
  useEffect(() => {
    target.position.set(centreX, 0, centreZ);
    target.updateMatrixWorld();
    invalidate();
  }, [target, centreX, centreZ, invalidate]);
  const radius = Math.max(18, extent * 1.5);
  const fixtures = useMemo(() => lighting?.fixtureLayout === "auto" || !lighting
    ? automaticCeilingFixtures(design, design.activeRoomId ?? design.id)
    : lighting.fixtures, [lighting, design]);
  // Keep all small housings, but group automatic illumination to a bounded budget.
  const powers = new Map<string, number>();
  if ((!lighting || lighting.fixtureLayout === "auto") && fixtures.length > MAX_ROOM_LIGHT_SOURCES) {
    const sources = Array.from({ length: MAX_ROOM_LIGHT_SOURCES }, (_, i) => fixtures[Math.floor((i + .5) * fixtures.length / MAX_ROOM_LIGHT_SOURCES)]);
    for (const fixture of fixtures) {
      const nearest = sources.reduce((a, b) => Math.hypot(fixture.x - a.x, fixture.z - a.z) <= Math.hypot(fixture.x - b.x, fixture.z - b.z) ? a : b);
      powers.set(nearest.id, (powers.get(nearest.id) ?? 0) + fixture.intensity);
    }
  } else for (const fixture of fixtures) powers.set(fixture.id, fixture.intensity);
  const shadowSource = fixtures.find(fixture => powers.has(fixture.id))?.id;
  const sun = sunDirection(
    lighting,
    includeSun ? exteriorWindowBearing(design) : 0,
  );
  return (
    <>
      {includeSun && (
        <>
          <primitive object={target} />
          <ambientLight
            intensity={rig.ambientIntensity}
            color={rig.ambientColor}
          />
          <hemisphereLight
            intensity={rig.hemisphereIntensity}
            color={rig.skyColor}
            groundColor={rig.groundColor}
          />
          <directionalLight
            target={target}
            castShadow
            color={rig.sunColor}
            intensity={rig.sunlightIntensity}
            position={[
              centreX + sun.x * radius,
              sun.y * radius,
              centreZ + sun.z * radius,
            ]}
            shadow-mapSize-width={2048}
            shadow-mapSize-height={2048}
            shadow-camera-left={-extent}
            shadow-camera-right={extent}
            shadow-camera-top={extent}
            shadow-camera-bottom={-extent}
            shadow-camera-far={radius * 4}
            shadow-bias={-0.00015}
            shadow-normalBias={0.012}
            shadow-radius={2}
          />
        </>
      )}
      {windowDaylight && <RoomDaylightFill design={design} daylight={solar.daylight} />}
      {fixtures.map((fixture) => (
        <CeilingLamp
          key={fixture.id}
          fixture={fixture}
          height={fixtureMountHeight(design, fixture)}
          span={Math.max(design.width, design.depth)}
          level={solar.lampLevel}
          shadows={fixtureShadows && fixture.id === shadowSource}
          sourceIntensity={powers.get(fixture.id) ?? 0}
        />
      ))}
    </>
  );
}
