"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import * as THREE from "three";
import type { RoomDesign, RoomOpening, RoomWall } from "@/lib/types";
import { getRoomGeometry, polygonArea, type RoomSegment } from "@/lib/roomGeometry";
import { openingWorldTransform } from "@/lib/roomOpenings";
import { createWallGeometry, type WallCut } from "./wallCsg";
import { useRoomMaterial } from "./roomMaterials";
import { OpeningMesh } from "./OpeningMesh";

const WALL_THICKNESS = 0.12;
const noRaycast = () => {};
const WALL_IDS: RoomWall[] = ["north", "east", "south", "west"];

export interface RoomStructureProps {
  design: RoomDesign;
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
  return Math.abs(segment.nx) > 0.5 ? segment.nx > 0 ? "west" : "east" : segment.nz > 0 ? "north" : "south";
}

function isBaseWall(design: RoomDesign, wall: RoomSegment, id: RoomWall) {
  const x = (wall.a.x + wall.b.x) / 2, z = (wall.a.z + wall.b.z) / 2;
  return id === "north" ? Math.abs(z + design.depth / 2) < 0.001
    : id === "south" ? Math.abs(z - design.depth / 2) < 0.001
      : id === "east" ? Math.abs(x - design.width / 2) < 0.001 : Math.abs(x + design.width / 2) < 0.001;
}

function normalizedPosition(design: RoomDesign, wall: RoomWall, point: THREE.Vector3) {
  return wall === "north" ? (point.x + design.width / 2) / design.width
    : wall === "south" ? (design.width / 2 - point.x) / design.width
      : wall === "east" ? (point.z + design.depth / 2) / design.depth : (design.depth / 2 - point.z) / design.depth;
}

function RoomWallMesh({ segment, ...props }: RoomStructureProps & { segment: RoomSegment }) {
  const { design, view, selectedWall, onSelectWall, onSelect, placementTemplate, onPlaceOpening, onPlacementError } = props;
  const id = wallIdFor(segment);
  const x = (segment.a.x + segment.b.x) / 2, z = (segment.a.z + segment.b.z) / 2;
  const height = design.height ?? 2.7;
  const rotation = -Math.atan2(segment.b.z - segment.a.z, segment.b.x - segment.a.x);
  const base = isBaseWall(design, segment, id);
  const finish = design.wallMaterials?.[id];
  const materialProps = useRoomMaterial(finish?.mode === "wallpaper" ? finish.materialId : undefined, segment.length, height, finish?.color ?? design.wallColor);
  const meshRef = useRef<THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>>(null);
  const openingCuts = (design.openings ?? []).filter(opening => opening.wallId === id && base).flatMap(opening => {
    const world = openingWorldTransform(design, opening);
    const along = (world.x - x) * Math.cos(rotation) - (world.z - z) * Math.sin(rotation);
    if (along - opening.width / 2 < -segment.length / 2 - 0.001 || along + opening.width / 2 > segment.length / 2 + 0.001) return [];
    return [{ x: along, width: opening.width, height: opening.height, sillHeight: opening.sillHeight }];
  });
  // A door's open state or selection does not invalidate its expensive CSG geometry.
  const cutKey = JSON.stringify(openingCuts);
  const wallGeometry = useMemo(() => createWallGeometry(segment.length, height, WALL_THICKNESS, JSON.parse(cutKey) as WallCut[]), [segment.length, height, cutKey]);
  useEffect(() => () => wallGeometry.dispose(), [wallGeometry]);
  const baseboardPieces = useMemo(() => {
    const cuts = (JSON.parse(cutKey) as WallCut[]).filter(cut => cut.sillHeight < 0.1).sort((a, b) => a.x - b.x);
    const pieces: { x: number; width: number }[] = [];
    let start = -segment.length / 2;
    for (const cut of cuts) {
      if (cut.x - cut.width / 2 > start) pieces.push({ x: (start + cut.x - cut.width / 2) / 2, width: cut.x - cut.width / 2 - start });
      start = cut.x + cut.width / 2;
    }
    if (start < segment.length / 2) pieces.push({ x: (start + segment.length / 2) / 2, width: segment.length / 2 - start });
    return pieces;
  }, [segment.length, cutKey]);

  useFrame(({ camera }, delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const outside = (camera.position.x - x) * segment.nx + (camera.position.z - z) * segment.nz < -0.06;
    const faded = view === "plan" || outside;
    mesh.material.opacity = THREE.MathUtils.damp(mesh.material.opacity, faded ? 0.065 : 1, 12, delta);
    mesh.material.depthWrite = !faded;
    mesh.castShadow = !faded;
  });

  const click = (event: ThreeEvent<MouseEvent>) => {
    if (event.delta > 4) return;
    event.stopPropagation();
    if (placementTemplate) {
      if (!base) { onPlacementError?.("Хаалга, цонхыг үндсэн ханын шулуун хэсэгт байрлуулна уу."); return; }
      onPlaceOpening?.(id, normalizedPosition(design, id, event.point));
    } else {
      onSelect(null);
      onSelectWall?.(id);
    }
  };

  return <group position={[x, 0, z]} rotation={[0, rotation, 0]}>
    <mesh ref={meshRef} geometry={wallGeometry} position={[0, height / 2, -WALL_THICKNESS / 2]} receiveShadow
      userData={{ openingWall: base ? id : null }} onClick={click}
      raycast={function (this: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>, raycaster, intersections) {
        const mesh = this;
        if (mesh.material.opacity < 0.2 && !placementTemplate) return;
        THREE.Mesh.prototype.raycast.call(mesh, raycaster, intersections);
      }}>
      <meshStandardMaterial {...materialProps} transparent emissive={selectedWall === id ? "#1677b8" : "#000000"} emissiveIntensity={selectedWall === id ? 0.09 : 0} />
    </mesh>
    {baseboardPieces.map((piece, index) => <mesh key={index} position={[piece.x, 0.065, 0.018]} receiveShadow onClick={click}>
      <boxGeometry args={[piece.width, 0.13, 0.036]} />
      <meshStandardMaterial color={selectedWall === id ? "#5aa0cf" : "#eeece5"} roughness={0.7} />
      {selectedWall === id && <Edges color="#006ab5" raycast={noRaycast} />}
    </mesh>)}
    {/* A low perimeter remains clickable from every angle and in the top-down plan. */}
    <mesh position={[0, 0.075, -WALL_THICKNESS / 2]} onClick={click}>
      <boxGeometry args={[segment.length, 0.15, WALL_THICKNESS]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} colorWrite={false} />
    </mesh>
  </group>;
}

function RoomSurfaces({ design, view, onSelect, onSelectOpening }: RoomStructureProps) {
  const roomGeometry = getRoomGeometry(design);
  const bounds = roomGeometry.bounds;
  const spanX = bounds.maxX - bounds.minX, spanZ = bounds.maxZ - bounds.minZ;
  const floorProps = useRoomMaterial(design.floorMaterial, spanX, spanZ, design.floorColor);
  const ceilingProps = useRoomMaterial(design.ceilingMaterial ?? "ceiling-white", spanX, spanZ, "#ffffff");
  const ceiling = useRef<THREE.Mesh>(null);
  const height = design.height ?? 2.7;
  const geometries = useMemo(() => {
    const outer = roomGeometry.loops.find(loop => polygonArea(loop) > 0)!;
    const shape = new THREE.Shape(outer.map(point => new THREE.Vector2(point.x, point.z)));
    for (const loop of roomGeometry.loops.filter(points => polygonArea(points) < 0)) shape.holes.push(new THREE.Path(loop.map(point => new THREE.Vector2(point.x, point.z))));
    const floor = new THREE.ExtrudeGeometry(shape, { depth: 0.08, bevelEnabled: false });
    const roof = new THREE.ShapeGeometry(shape);
    for (const geometry of [floor, roof]) {
      const positions = geometry.getAttribute("position"), uv = geometry.getAttribute("uv");
      for (let i = 0; i < positions.count; i++) uv.setXY(i, (positions.getX(i) - bounds.minX) / spanX, (positions.getY(i) - bounds.minZ) / spanZ);
      uv.needsUpdate = true;
    }
    return { floor, roof };
  }, [roomGeometry, bounds.minX, bounds.minZ, spanX, spanZ]);
  useEffect(() => () => { geometries.floor.dispose(); geometries.roof.dispose(); }, [geometries]);
  useFrame(({ camera }) => {
    if (ceiling.current) ceiling.current.visible = view !== "plan" && camera.position.y < height - 0.04;
  });
  return <>
    <mesh rotation={[Math.PI / 2, 0, 0]} geometry={geometries.floor} receiveShadow onPointerDown={event => {
      event.stopPropagation(); onSelect(null); onSelectOpening?.(null);
    }}><meshStandardMaterial {...floorProps} /></mesh>
    <mesh ref={ceiling} visible={false} position={[0, height, 0]} rotation={[Math.PI / 2, 0, 0]} geometry={geometries.roof} receiveShadow raycast={noRaycast}>
      <meshStandardMaterial {...ceilingProps} side={THREE.DoubleSide} />
    </mesh>
  </>;
}

function OpeningDropTarget(props: RoomStructureProps) {
  const { gl, camera, scene } = useThree();
  const latest = useRef(props);
  latest.current = props;
  useEffect(() => {
    const element = gl.domElement;
    const dragOver = (event: DragEvent) => {
      if (!latest.current.placementTemplate && !event.dataTransfer?.types.includes("application/x-room-opening")) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
    };
    const drop = (event: DragEvent) => {
      const current = latest.current;
      const template = event.dataTransfer?.getData("application/x-room-opening") || current.placementTemplate;
      if (!template) return;
      event.preventDefault(); event.stopPropagation();
      const rect = element.getBoundingClientRect();
      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), camera);
      const hits: THREE.Intersection[] = [];
      scene.traverse(object => {
        if (object instanceof THREE.Mesh && object.userData.openingWall) THREE.Mesh.prototype.raycast.call(object, raycaster, hits);
      });
      hits.sort((a, b) => a.distance - b.distance);
      if (current.view === "perspective" && hits.length) {
        const hit = hits[0], wall = hit.object.userData.openingWall as RoomWall;
        current.onPlaceOpening?.(wall, normalizedPosition(current.design, wall, hit.point));
        return;
      }
      const point = raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), new THREE.Vector3());
      if (!point) return;
      const walls = WALL_IDS.map(wall => ({ wall, distance: wall === "north" ? Math.abs(point.z + current.design.depth / 2)
        : wall === "south" ? Math.abs(point.z - current.design.depth / 2) : wall === "east" ? Math.abs(point.x - current.design.width / 2) : Math.abs(point.x + current.design.width / 2) }));
      walls.sort((a, b) => a.distance - b.distance);
      if (walls[0].distance > 0.75) { current.onPlacementError?.("Хаалга, цонхоо хананд ойртуулж тавина уу."); return; }
      current.onPlaceOpening?.(walls[0].wall, normalizedPosition(current.design, walls[0].wall, point));
    };
    element.addEventListener("dragover", dragOver);
    element.addEventListener("drop", drop);
    return () => { element.removeEventListener("dragover", dragOver); element.removeEventListener("drop", drop); };
  }, [gl, camera, scene]);
  return null;
}

export function RoomStructure(props: RoomStructureProps) {
  const { design, view } = props;
  const geometry = getRoomGeometry(design);
  const height = design.height ?? 2.7;
  return <group>
    <RoomSurfaces {...props} />
    {geometry.segments.filter(segment => !segment.hole).map((segment, index) => {
      const x = (segment.a.x + segment.b.x) / 2, z = (segment.a.z + segment.b.z) / 2;
      const onColumn = (design.columns ?? []).some(column => {
        const left = column.x - design.width / 2, top = column.z - design.depth / 2;
        return x >= left - 1e-6 && x <= left + column.width + 1e-6 && z >= top - 1e-6 && z <= top + column.depth + 1e-6;
      });
      return onColumn ? null : <RoomWallMesh key={index} {...props} segment={segment} />;
    })}
    {(design.columns ?? []).map(column => <mesh key={column.id}
      position={[column.x + column.width / 2 - design.width / 2, (view === "plan" ? 0.2 : height) / 2, column.z + column.depth / 2 - design.depth / 2]} castShadow receiveShadow>
      <boxGeometry args={[column.width, view === "plan" ? 0.2 : height, column.depth]} />
      <meshStandardMaterial color={design.wallColor} roughness={0.92} /><Edges color="#9a9c91" />
    </mesh>)}
    {(design.openings ?? []).map(opening => <OpeningMesh key={opening.id} design={design} opening={opening} view={view}
      selected={props.selectedOpening === opening.id} onSelect={props.onSelectOpening} onUpdate={props.onUpdateOpening}
      onDragChange={props.onDragChange} onEditStart={props.onEditStart} onEditEnd={props.onEditEnd} onError={props.onPlacementError} />)}
    <OpeningDropTarget {...props} />
  </group>;
}

export function RoomLighting({ design }: { design: RoomDesign }) {
  const lighting = design.lighting;
  const evening = lighting?.mode === "evening";
  const height = design.height ?? 2.7;
  return <>
    <ambientLight intensity={lighting?.ambient ?? 0.55} color={evening ? "#ffdeba" : "#f8fbff"} />
    <hemisphereLight intensity={evening ? 0.22 : 0.7} color="#e5efff" groundColor="#bda88c" />
    <directionalLight castShadow color={evening ? "#f2ad73" : "#fff7e9"} intensity={lighting?.sunlight ?? 1.8} position={[6, 10, 7]}
      shadow-mapSize-width={2048} shadow-mapSize-height={2048} shadow-camera-left={-20} shadow-camera-right={20}
      shadow-camera-top={20} shadow-camera-bottom={-20} shadow-bias={-0.0002} shadow-normalBias={0.025} />
    <directionalLight color="#dce7f2" intensity={evening ? 0.08 : 0.35} position={[-5, 5, -4]} />
    {(lighting?.fixtures ?? []).map(fixture => <group key={fixture.id} position={[fixture.x, height - 0.1, fixture.z]}>
      <mesh castShadow raycast={noRaycast}><cylinderGeometry args={[0.12, 0.12, 0.08, 24]} /><meshStandardMaterial color="#e7e5df" metalness={0.15} roughness={0.3} /></mesh>
      <mesh position={[0, -0.045, 0]} raycast={noRaycast}><sphereGeometry args={[0.085, 16, 12]} /><meshStandardMaterial color={fixture.color} emissive={fixture.color} emissiveIntensity={fixture.intensity > 0 ? 1 : 0} /></mesh>
      <pointLight position={[0, -0.12, 0]} intensity={fixture.intensity} color={fixture.color} distance={Math.max(design.width, design.depth) * 2} decay={2} />
    </group>)}
  </>;
}
