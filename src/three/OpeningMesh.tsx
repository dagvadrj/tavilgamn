"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import { SceneHtml as Html } from "./SceneHtml";
import * as THREE from "three";
import type { RoomDesign, RoomOpening } from "@/lib/types";
import { ROOM_WALL_THICKNESS, wallBlocksFocus } from "@/lib/roomRendering";
import { openingWorldTransform, validateOpening, wallLength, windowLayout, DEFAULT_DOOR_FINISH } from "@/lib/roomOpenings";
import { RoomWindow } from "./RoomWindow";
import { animateToward } from "./demandAnimation";
import { SCENE_NAVIGATION_START, holdOrbitControls, isSceneNavigationGesture } from "./sceneNavigation";
import { applyRoomCutaway, cutawayRaycast } from "./roomCutaway";

const noRaycast = () => {};
type CaptureTarget = { setPointerCapture?: (id: number) => void; releasePointerCapture?: (id: number) => void };

function DoorLeaf({ width, height, hinge, swing, open }: { width: number; height: number; hinge: "left" | "right"; swing: "inward" | "outward"; open: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const side = hinge === "left" ? 1 : -1;
  const angle = (open ? Math.PI * 0.47 : 0) * (swing === "inward" ? -1 : 1) * side;
  const invalidate = useThree(state => state.invalidate);
  useEffect(() => { invalidate(); }, [angle, invalidate]);
  useFrame((state, delta) => {
    if (!ref.current) return;
    const animation = animateToward(ref.current.rotation.y, angle, 9, delta);
    ref.current.rotation.y = animation.value;
    if (animation.moving) state.invalidate();
  });
  return <group ref={ref} position={[-side * width / 2, 0, -0.025]}>
    <mesh position={[side * width / 2, height / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[width, height, 0.045]} />
      <meshStandardMaterial color={DEFAULT_DOOR_FINISH.leaf} roughness={0.78} />
    </mesh>
    {[-1, 1].map(face => <group key={face}>
      {[0.27, 0.56, 0.79].map(y => <mesh key={y} position={[side * width / 2, height * y, face * .0228]}>
        <boxGeometry args={[Math.max(.08, width - .13), .0025, .001]} />
        <meshStandardMaterial color={DEFAULT_DOOR_FINISH.groove} roughness={.85} />
      </mesh>)}
      <group position={[side * (width - .085), Math.min(1.03, height * .48), face * .029]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[.026, .026, .009, 16]} />
          <meshStandardMaterial color={DEFAULT_DOOR_FINISH.hardware} metalness={.85} roughness={.3} />
        </mesh>
        <mesh position={[-side * .036, 0, face * .027]} rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[.008, .09, 4, 8]} />
          <meshStandardMaterial color={DEFAULT_DOOR_FINISH.hardware} metalness={.85} roughness={.3} />
        </mesh>
        <mesh position={[0, -.07, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[.017, .017, .008, 12]} />
          <meshStandardMaterial color={DEFAULT_DOOR_FINISH.hardware} metalness={.85} roughness={.35} />
        </mesh>
      </group>
    </group>)}
  </group>;
}

function Door({ opening }: { opening: RoomOpening }) {
  const { width: w, height: h } = opening;
  const frame = 0.05;
  const double = opening.templateId === "door-double";
  return <group>
    {[-1, 1].map(side => <mesh key={side} position={[side * (w / 2 - frame / 2), h / 2, -ROOM_WALL_THICKNESS / 2 + .015]} castShadow receiveShadow>
      <boxGeometry args={[frame, h, ROOM_WALL_THICKNESS + .06]} /><meshStandardMaterial color={DEFAULT_DOOR_FINISH.frame} roughness={0.78} />
    </mesh>)}
    <mesh position={[0, h - frame / 2, -ROOM_WALL_THICKNESS / 2 + .015]} castShadow receiveShadow>
      <boxGeometry args={[w, frame, ROOM_WALL_THICKNESS + .06]} /><meshStandardMaterial color={DEFAULT_DOOR_FINISH.frame} roughness={0.78} />
    </mesh>
    {double ? [-1, 1].map(side => <group key={side} position={[side * (w - 2 * frame) / 4, 0.012, 0]}>
      <DoorLeaf width={(w - 2 * frame) / 2 - 0.006} height={h - frame - 0.018} hinge={side === -1 ? "left" : "right"} swing={opening.swing} open={opening.open} />
    </group>) : <group position={[0, 0.012, 0]}><DoorLeaf width={w - 2 * frame - 0.006} height={h - frame - 0.018} hinge={opening.hinge} swing={opening.swing} open={opening.open} /></group>}
  </group>;
}

export interface OpeningMeshProps {
  design: RoomDesign;
  opening: RoomOpening;
  selected: boolean;
  view: "plan" | "perspective";
  interior?: boolean;
  cutawayFocus?: [number, number];
  onSelect?: (id: string | null) => void;
  onUpdate?: (opening: RoomOpening) => void;
  onDragChange: (value: boolean) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  onError?: (message: string) => void;
}

export function OpeningMesh(props: OpeningMeshProps) {
  const { design, opening, selected, onSelect, onUpdate, onDragChange, onEditStart, onError } = props;
  const { camera, gl, controls } = useThree();
  const latest = useRef(props);
  latest.current = props;
  const dragging = useRef<{ pointerId: number; target: CaptureTarget; offset: number; clientX: number; clientY: number; moved: boolean; release: () => void } | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const transform = openingWorldTransform(design, opening);
  const groupRef = useRef<THREE.Group>(null);
  const paneCount = windowLayout(opening).panes;
  const ghosted = useRef(false);
  const cutawayOpacity = useRef(1);
  const labelRef = useRef<HTMLSpanElement>(null);
  const visualMeshes = useRef<{ mesh: THREE.Mesh; material: THREE.MeshStandardMaterial; opacity: number; castShadow: boolean }[]>([]);

  useEffect(() => {
    const originalRaycasts: { mesh: THREE.Mesh; raycast: THREE.Mesh["raycast"] }[] = [];
    visualMeshes.current = [];
    groupRef.current?.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      originalRaycasts.push({ mesh: object, raycast: object.raycast });
      object.raycast = function (raycaster, hits) {
        if (!ghosted.current) THREE.Mesh.prototype.raycast.call(this, raycaster, hits);
      };
      if (object.material instanceof THREE.MeshStandardMaterial) {
        const material = object.material;
        visualMeshes.current.push({ mesh: object, material, opacity: material.opacity, castShadow: object.castShadow });
      }
    });
    return () => {
      for (const { mesh, raycast } of originalRaycasts) mesh.raycast = raycast;
      for (const { material, opacity, mesh, castShadow } of visualMeshes.current) { material.opacity = opacity; mesh.castShadow = castShadow; }
    };
  }, [opening.kind, opening.templateId, selected, paneCount]);

  useFrame(({ camera, invalidate }, delta) => {
    const normalX = Math.sin(transform.rotation), normalZ = Math.cos(transform.rotation);
    const world = groupRef.current?.getWorldPosition(new THREE.Vector3());
    const outside = !!world && (camera.position.x - world.x) * normalX + (camera.position.z - world.z) * normalZ < -0.06;
    const blocksFocus = !!world && props.cutawayFocus && wallBlocksFocus(camera.position,
      { x: props.cutawayFocus[0], z: props.cutawayFocus[1] },
      { x: world.x, z: world.z, nx: normalX, nz: normalZ, length: wallLength(design, opening.wallId), start: 0, end: 0 });
    ghosted.current = !props.interior && props.view !== "plan" && !!(outside || blocksFocus);
    const animation = animateToward(cutawayOpacity.current, ghosted.current ? 0 : 1, 12, delta);
    cutawayOpacity.current = animation.value;
    if (groupRef.current) applyRoomCutaway(groupRef.current, animation.value);
    if (labelRef.current) labelRef.current.style.visibility = ghosted.current ? "hidden" : "visible";
    if (animation.moving) invalidate();
  });

  const projectPosition = (clientX: number, clientY: number) => {
    const current = latest.current;
    const location = openingWorldTransform(current.design, current.opening);
    const rect = gl.domElement.getBoundingClientRect();
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1), camera);
    const normal = new THREE.Vector3(Math.sin(location.rotation), 0, Math.cos(location.rotation));
    const center = new THREE.Vector3(location.x, 0, location.z);
    const plane = Math.abs(raycaster.ray.direction.dot(normal)) < 0.08
      ? new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.08)
      : new THREE.Plane(normal, -normal.dot(center));
    const hit = raycaster.ray.intersectPlane(plane, new THREE.Vector3());
    if (!hit) return null;
    const along = new THREE.Vector3(Math.cos(location.rotation), 0, -Math.sin(location.rotation));
    return current.opening.position + hit.sub(center).dot(along) / wallLength(current.design, current.opening.wallId, current.opening.segmentId);
  };
  const projectRef = useRef(projectPosition);
  projectRef.current = projectPosition;

  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragging.current;
      if (!drag || event.pointerId !== drag.pointerId) return;
      if (!drag.moved && Math.hypot(event.clientX - drag.clientX, event.clientY - drag.clientY) < 4) return;
      drag.moved = true;
      const position = projectRef.current(event.clientX, event.clientY);
      if (position === null) return;
      const current = latest.current;
      const candidate = { ...current.opening, position: position + drag.offset };
      const error = validateOpening(current.design, candidate);
      setInvalid(error);
      if (!error) current.onUpdate?.(candidate);
    };
    const finish = (event?: PointerEvent) => {
      const drag = dragging.current;
      if (!drag || (event && event.pointerId !== drag.pointerId)) return;
      dragging.current = null;
      drag.release();
      try { drag.target.releasePointerCapture?.(drag.pointerId); } catch { /* Browser may already have released capture. */ }
      setIsDragging(false);
      setInvalid(null);
      latest.current.onDragChange(false);
      latest.current.onEditEnd?.();
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    const blur = () => finish();
    window.addEventListener("blur", blur);
    gl.domElement.addEventListener(SCENE_NAVIGATION_START, blur);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("blur", blur);
      gl.domElement.removeEventListener(SCENE_NAVIGATION_START, blur);
      finish();
    };
  }, [gl.domElement]);

  useEffect(() => { if (invalid) onError?.(invalid); }, [invalid, onError]);

  const start = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return;
    if (event.pointerType === "touch" && isSceneNavigationGesture(gl.domElement)) return;
    event.stopPropagation();
    onSelect?.(opening.id);
    if (!onUpdate) return;
    const position = projectPosition(event.clientX, event.clientY);
    if (position === null) return;
    const target = event.target as CaptureTarget;
    dragging.current = { pointerId: event.pointerId, target, offset: opening.position - position, clientX: event.clientX, clientY: event.clientY, moved: false, release: holdOrbitControls(controls) };
    target.setPointerCapture?.(event.pointerId);
    onEditStart?.();
    setIsDragging(true);
    onDragChange(true);
  };

  return <group ref={groupRef} position={[transform.x, opening.sillHeight, transform.z]} rotation={[0, transform.rotation, 0]}
    userData={{ previewWall: { nx: Math.sin(transform.rotation), nz: Math.cos(transform.rotation) } }}
    raycast={cutawayRaycast}
    onPointerDown={start}
    onClick={event => event.stopPropagation()}
    onDoubleClick={event => {
      event.stopPropagation();
      if (opening.kind === "door" || windowLayout(opening).operation !== "fixed") onUpdate?.({ ...opening, open: !opening.open });
    }}>
    {opening.kind === "door" ? <Door opening={opening} /> : <RoomWindow opening={opening} />}
    {/* An invisible hit target makes thin frames and transparent glass easy to grab. */}
    <mesh position={[0, opening.height / 2, 0]}>
      <boxGeometry args={[opening.width + 0.07, opening.height + 0.07, 0.22]} />
      <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
    </mesh>
    {selected && <mesh position={[0, opening.height / 2, 0]} raycast={noRaycast}>
      <boxGeometry args={[opening.width + 0.08, opening.height + 0.08, 0.24]} />
      <meshBasicMaterial transparent opacity={0} colorWrite={false} depthWrite={false} />
      <Edges color={invalid ? "#dc2626" : "#006ab5"} lineWidth={2} raycast={noRaycast} />
    </mesh>}
    {selected && <Html position={[0, opening.height + 0.19, 0]} center style={{ pointerEvents: "none" }}>
      <span ref={labelRef} className={`block whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-semibold shadow-sm ${invalid ? "bg-red-600 text-white" : "bg-white/95 text-slate-700"}`}>
        {invalid ? "Энэ байрлалд багтахгүй" : isDragging ? "Ханын дагуу зөөж байна" : `${Math.round(opening.width * 100)} × ${Math.round(opening.height * 100)} см`}
      </span>
    </Html>}
  </group>;
}
