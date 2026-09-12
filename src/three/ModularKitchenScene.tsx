"use client";

import { Component, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges, OrbitControls } from "@react-three/drei";
import { Plane, Vector3, type Texture } from "three";
import { roomWalls, type CabinetPose, type ModularCabinet, type ModularKitchen } from "@/lib/kitchenCabinets";
import { fitCountertops, placementIssues } from "@/lib/kitchenPlacement";
import { createKitchenTexture } from "./kitchenTextures";

export interface ModularSceneProps {
  kitchen: ModularKitchen; selectedId: string | null; mode: "move" | "orbit";
  onSelect: (id: string) => void; onStart: (id: string) => void;
  onMove: (id: string, pose: CabinetPose) => void; onEnd: () => void; onCancel: () => void;
}
type XYZ = [number, number, number];
function Board({ size, at, color, roughness = .7, map }: { size: XYZ; at: XYZ; color: string; roughness?: number; map?: Texture | null }) {
  return <mesh position={at} castShadow receiveShadow><boxGeometry args={size} /><meshStandardMaterial color={color} roughness={roughness} map={map} /></mesh>;
}
function Front({ width, height, at, cabinet, map }: { width: number; height: number; at: XYZ; cabinet: ModularCabinet; map: Texture | null }) {
  return <group position={at}>
    <Board size={[width - .004, height - .004, .018]} at={[0, 0, 0]} color={cabinet.color}
      roughness={cabinet.material === "gloss" ? .15 : .8} map={cabinet.material === "wood" ? map : null} />
    {cabinet.handleStyle === "bar" && <Board size={[Math.min(width * .5, .14), .014, .022]}
      at={[0, height / 2 - .045, .02]} color="#3d413c" />}
    {cabinet.handleStyle === "knob" && <mesh position={[0, height / 2 - .045, .025]}>
      <sphereGeometry args={[.015, 10, 8]} /><meshStandardMaterial color="#8e7b54" metalness={.7} roughness={.3} />
    </mesh>}
  </group>;
}
function CabinetBody({ cabinet, map }: { cabinet: ModularCabinet; map: Texture | null }) {
  const w = cabinet.width / 1000, h = cabinet.height / 1000, d = cabinet.depth / 1000;
  const toe = cabinet.type === "base" ? .08 : 0, drawerHeight = .12;
  const doorsHeight = h - toe - drawerHeight * cabinet.drawerCount;
  return <>
    <Board size={[w, h - toe, d - .025]} at={[0, (h + toe) / 2, -.0125]} color="#d8d1c3" />
    {toe > 0 && <Board size={[w - .04, toe, d - .09]} at={[0, toe / 2, -.025]} color="#5c6057" />}
    {Array.from({ length: cabinet.doorCount }, (_, index) => <Front key={`door-${index}`} cabinet={cabinet} map={map}
      width={w / cabinet.doorCount} height={doorsHeight}
      at={[-w / 2 + w / cabinet.doorCount * (index + .5), toe + doorsHeight / 2, d / 2 - .009]} />)}
    {Array.from({ length: cabinet.drawerCount }, (_, index) => <Front key={`drawer-${index}`} cabinet={cabinet} map={map}
      width={w} height={drawerHeight} at={[0, h - drawerHeight * (index + .5), d / 2 - .009]} />)}
  </>;
}
function CameraFit({ kitchen }: { kitchen: ModularKitchen }) {
  const { camera, size } = useThree();
  const { width, depth, height } = kitchen.room;
  useEffect(() => {
    const target = new Vector3(width / 2000, .8, depth / 2000);
    const distance = Math.max(width, depth, height) / 1000 * Math.max(1.6, size.height / Math.max(1, size.width) * 1.8);
    camera.position.copy(target).add(new Vector3(.5, .85, 1).normalize().multiplyScalar(distance));
    camera.lookAt(target); camera.updateProjectionMatrix();
  }, [camera, width, depth, height, size.width, size.height]);
  return null;
}
type CaptureTarget = { setPointerCapture: (id: number) => void; releasePointerCapture: (id: number) => void };
function Scene(props: ModularSceneProps) {
  const { kitchen, selectedId, mode } = props;
  const { gl } = useThree();
  const callbacks = useRef(props); callbacks.current = props;
  const drag = useRef<{ id: string; pointerId: number; plane: Plane; offset: Vector3; pose: CabinetPose; target: CaptureTarget } | null>(null);
  const map = useMemo(() => createKitchenTexture("oak"), []);
  useEffect(() => () => { map?.dispose(); }, [map]);
  const invalid = new Set(placementIssues(kitchen).filter(issue => issue.severity === "error").flatMap(issue => issue.ids));
  const tops = fitCountertops(kitchen);
  function finish(cancel: boolean) {
    const current = drag.current;
    if (!current) return;
    drag.current = null;
    try { current.target.releasePointerCapture(current.pointerId); } catch { /* Pointer may already have been released by the browser. */ }
    if (cancel) callbacks.current.onCancel(); else callbacks.current.onEnd();
  }
  const finishRef = useRef(finish); finishRef.current = finish;
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") finishRef.current(true); };
    const cancel = () => finishRef.current(true);
    const lostCapture = (event: PointerEvent) => { if (drag.current?.pointerId === event.pointerId) cancel(); };
    window.addEventListener("keydown", escape); window.addEventListener("blur", cancel);
    gl.domElement.addEventListener("lostpointercapture", lostCapture);
    return () => {
      window.removeEventListener("keydown", escape); window.removeEventListener("blur", cancel);
      gl.domElement.removeEventListener("lostpointercapture", lostCapture); cancel();
    };
  }, [gl]);
  function start(event: ThreeEvent<PointerEvent>, cabinet: ModularCabinet) {
    if (event.button !== 0 || drag.current) return;
    event.stopPropagation(); props.onSelect(cabinet.id);
    if (mode !== "move") return;
    const plane = new Plane(new Vector3(0, 1, 0), -event.point.y), point = new Vector3();
    if (!event.ray.intersectPlane(plane, point)) return;
    const target = event.target as unknown as CaptureTarget;
    target.setPointerCapture(event.pointerId);
    drag.current = { id: cabinet.id, pointerId: event.pointerId, plane, pose: cabinet.position, target,
      offset: new Vector3(cabinet.position.x / 1000 - point.x, 0, cabinet.position.z / 1000 - point.z) };
    props.onStart(cabinet.id);
  }
  function move(event: ThreeEvent<PointerEvent>) {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    event.stopPropagation();
    const point = event.ray.intersectPlane(current.plane, new Vector3());
    if (!point) return;
    point.add(current.offset);
    callbacks.current.onMove(current.id, { ...current.pose, x: Math.round(point.x * 1000), z: Math.round(point.z * 1000) });
  }
  const width = kitchen.room.width / 1000, depth = kitchen.room.depth / 1000;
  return <>
    <CameraFit kitchen={kitchen} />
    <color attach="background" args={["#eaece8"]} />
    <ambientLight intensity={1.2} /><directionalLight position={[2, 7, 4]} intensity={2.3} />
    <OrbitControls enabled={mode === "orbit"} target={[width / 2, .8, depth / 2]} minDistance={1} maxDistance={18} maxPolarAngle={Math.PI / 2.05} />
    <mesh position={[width / 2, -.015, depth / 2]} receiveShadow><boxGeometry args={[width, .03, depth]} /><meshStandardMaterial color="#d8d5cd" /></mesh>
    <gridHelper args={[Math.max(width, depth), Math.max(kitchen.room.width, kitchen.room.depth) / 100, "#9daba0", "#c2c6bc"]}
      position={[width / 2, .001, depth / 2]} />
    {roomWalls(kitchen.room).map(wall => {
      const length = Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z) / 1000;
      return <group key={wall.id} position={[(wall.start.x + wall.end.x) / 2000 - wall.inward.x * .025, .3, (wall.start.z + wall.end.z) / 2000 - wall.inward.z * .025]}
        rotation={[0, Math.atan2(wall.inward.x, wall.inward.z), 0]}>
        <mesh raycast={() => {}}><boxGeometry args={[length, .6, .05]} /><meshStandardMaterial color="#a5afa1" transparent opacity={.3} depthWrite={false} /></mesh>
      </group>;
    })}
    {kitchen.cabinets.map(cabinet => <group key={cabinet.id}
      position={[cabinet.position.x / 1000, cabinet.position.y / 1000, cabinet.position.z / 1000]} rotation={[0, cabinet.position.rotation, 0]}
      onPointerDown={event => start(event, cabinet)} onPointerMove={move}
      onPointerUp={event => { if (drag.current?.pointerId === event.pointerId) { event.stopPropagation(); finish(false); } }}
      onPointerCancel={event => { if (drag.current?.pointerId === event.pointerId) finish(true); }}>
      <CabinetBody cabinet={cabinet} map={map} />
      {(selectedId === cabinet.id || invalid.has(cabinet.id)) && <mesh raycast={() => {}} position={[0, cabinet.height / 2000, 0]}>
        <boxGeometry args={[cabinet.width / 1000 + .003, cabinet.height / 1000 + .003, cabinet.depth / 1000 + .003]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
        <Edges color={invalid.has(cabinet.id) ? "#d62828" : "#246847"} linewidth={2} raycast={() => {}} />
      </mesh>}
    </group>)}
    {tops.map(top => <group key={top.id} position={[top.position.x / 1000, top.position.y / 1000, top.position.z / 1000]} rotation={[0, top.position.rotation, 0]}>
      <mesh position={[0, top.thickness / 2000, 0]} raycast={() => {}} castShadow receiveShadow>
        <boxGeometry args={[top.width / 1000, top.thickness / 1000, top.depth / 1000]} />
        <meshStandardMaterial color="#f1eee5" roughness={.45} />
      </mesh>
    </group>)}
  </>;
}
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <p className="kp-viewer-message" role="status">3D дүрслэл ачаалагдсангүй. Байрлалыг доорх зураг болон хэмжээгээр тохируулж болно.</p> : this.props.children; }
}
export function ModularKitchenScene(props: ModularSceneProps) {
  return <SceneBoundary><Canvas dpr={[1, 1.5]} frameloop="demand" camera={{ position: [4, 5, 6], fov: 45 }}
    fallback={<p className="kp-viewer-message">3D дэмжигдэхгүй байна. Доорх зураг, хэмжээсийг ашиглана уу.</p>}>
    <Scene {...props} />
  </Canvas></SceneBoundary>;
}
