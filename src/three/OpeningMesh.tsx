"use client";

import { useEffect, useRef, useState } from "react";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Edges, Html } from "@react-three/drei";
import * as THREE from "three";
import type { RoomDesign, RoomOpening } from "@/lib/types";
import { openingWorldTransform, validateOpening, wallLength } from "@/lib/roomOpenings";

const noRaycast = () => {};
type CaptureTarget = { setPointerCapture?: (id: number) => void; releasePointerCapture?: (id: number) => void };

function DoorLeaf({ width, height, hinge, swing, open }: { width: number; height: number; hinge: "left" | "right"; swing: "inward" | "outward"; open: boolean }) {
  const ref = useRef<THREE.Group>(null);
  const side = hinge === "left" ? 1 : -1;
  const angle = (open ? Math.PI * 0.47 : 0) * (swing === "inward" ? -1 : 1) * side;
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y = THREE.MathUtils.damp(ref.current.rotation.y, angle, 9, delta);
  });
  return <group ref={ref} position={[-side * width / 2, 0, -0.025]}>
    <mesh position={[side * width / 2, height / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[width, height, 0.045]} />
      <meshStandardMaterial color="#d5bd9c" roughness={0.56} />
    </mesh>
    {[0.29, 0.73].map(y => <mesh key={y} position={[side * width / 2, height * y, 0.024]}>
      <boxGeometry args={[Math.max(0.1, width - 0.15), height * 0.31, 0.012]} />
      <meshStandardMaterial color="#c6ab86" roughness={0.6} />
    </mesh>)}
    {[-1, 1].map(face => <mesh key={face} position={[side * (width - 0.09), Math.min(1.03, height * 0.48), face * 0.043]}>
      <boxGeometry args={[0.11, 0.022, 0.035]} />
      <meshStandardMaterial color="#6e7274" metalness={0.85} roughness={0.25} />
    </mesh>)}
  </group>;
}

function Door({ opening }: { opening: RoomOpening }) {
  const { width: w, height: h } = opening;
  const frame = 0.05;
  const double = opening.templateId === "door-double";
  return <group>
    {[-1, 1].map(side => <mesh key={side} position={[side * (w / 2 - frame / 2), h / 2, -0.05]} castShadow receiveShadow>
      <boxGeometry args={[frame, h, 0.2]} /><meshStandardMaterial color="#f2eee6" roughness={0.62} />
    </mesh>)}
    <mesh position={[0, h - frame / 2, -0.05]} castShadow receiveShadow>
      <boxGeometry args={[w, frame, 0.2]} /><meshStandardMaterial color="#f2eee6" roughness={0.62} />
    </mesh>
    {double ? [-1, 1].map(side => <group key={side} position={[side * (w - 2 * frame) / 4, 0.012, 0]}>
      <DoorLeaf width={(w - 2 * frame) / 2 - 0.006} height={h - frame - 0.018} hinge={side === -1 ? "left" : "right"} swing={opening.swing} open={opening.open} />
    </group>) : <group position={[0, 0.012, 0]}><DoorLeaf width={w - 2 * frame - 0.006} height={h - frame - 0.018} hinge={opening.hinge} swing={opening.swing} open={opening.open} /></group>}
  </group>;
}

function Window({ opening }: { opening: RoomOpening }) {
  const { width: w, height: h } = opening;
  const sliding = opening.templateId === "window-sliding";
  const frame = 0.055;
  return <group>
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[side * (w - frame) / 2, h / 2, -0.05]} castShadow receiveShadow>
        <boxGeometry args={[frame, h, 0.19]} /><meshStandardMaterial color="#f5f4ef" roughness={0.48} />
      </mesh>
      <mesh position={[0, side === -1 ? frame / 2 : h - frame / 2, -0.05]} castShadow receiveShadow>
        <boxGeometry args={[w, frame, 0.19]} /><meshStandardMaterial color="#f5f4ef" roughness={0.48} />
      </mesh>
    </group>)}
    {(sliding ? [-1, 1] : [0]).map(side => <mesh key={side} position={[side * (w - 2 * frame) / 4, h / 2, -0.05 + side * 0.015]} receiveShadow>
      <boxGeometry args={[sliding ? (w - 2 * frame) / 2 : w - 2 * frame, h - 2 * frame, 0.016]} />
      <meshPhysicalMaterial color="#e2f2f7" transmission={0.82} transparent opacity={0.64} roughness={0.06} thickness={0.016} ior={1.45} metalness={0} depthWrite={false} />
    </mesh>)}
    {sliding && <mesh position={[0, h / 2, -0.025]} castShadow>
      <boxGeometry args={[frame, h - frame * 2, 0.12]} /><meshStandardMaterial color="#ebece6" roughness={0.48} />
    </mesh>}
    <mesh position={[0, -0.025, 0.035]} receiveShadow castShadow>
      <boxGeometry args={[w + 0.14, 0.05, 0.32]} /><meshStandardMaterial color="#f3f1e9" roughness={0.48} />
    </mesh>
  </group>;
}

export interface OpeningMeshProps {
  design: RoomDesign;
  opening: RoomOpening;
  selected: boolean;
  view: "plan" | "perspective";
  onSelect?: (id: string | null) => void;
  onUpdate?: (opening: RoomOpening) => void;
  onDragChange: (value: boolean) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
  onError?: (message: string) => void;
}

export function OpeningMesh(props: OpeningMeshProps) {
  const { design, opening, selected, onSelect, onUpdate, onDragChange, onEditStart, onError } = props;
  const { camera, gl } = useThree();
  const latest = useRef(props);
  latest.current = props;
  const dragging = useRef<{ pointerId: number; target: CaptureTarget; offset: number; clientX: number; clientY: number; moved: boolean } | null>(null);
  const [invalid, setInvalid] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const transform = openingWorldTransform(design, opening);
  const groupRef = useRef<THREE.Group>(null);
  const ghosted = useRef(false);
  const visualMeshes = useRef<{ mesh: THREE.Mesh; material: THREE.MeshStandardMaterial; opacity: number; castShadow: boolean }[]>([]);

  useEffect(() => {
    const originalRaycasts: { mesh: THREE.Mesh; raycast: THREE.Mesh["raycast"] }[] = [];
    visualMeshes.current = [];
    groupRef.current?.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      originalRaycasts.push({ mesh: object, raycast: object.raycast });
      object.raycast = function (raycaster, hits) {
        if (!ghosted.current || latest.current.selected) THREE.Mesh.prototype.raycast.call(this, raycaster, hits);
      };
      if (object.material instanceof THREE.MeshStandardMaterial) {
        const material = object.material;
        visualMeshes.current.push({ mesh: object, material, opacity: material.opacity, castShadow: object.castShadow });
        material.transparent = true;
      }
    });
    return () => {
      for (const { mesh, raycast } of originalRaycasts) mesh.raycast = raycast;
      for (const { material, opacity, mesh, castShadow } of visualMeshes.current) { material.opacity = opacity; mesh.castShadow = castShadow; }
    };
  }, [opening.kind, opening.templateId, selected]);

  useFrame(({ camera }, delta) => {
    const normalX = Math.sin(transform.rotation), normalZ = Math.cos(transform.rotation);
    ghosted.current = props.view !== "plan" && (camera.position.x - transform.x) * normalX + (camera.position.z - transform.z) * normalZ < -0.06;
    const fade = ghosted.current ? selected ? 0.78 : 0.09 : 1;
    for (const { mesh, material, opacity, castShadow } of visualMeshes.current) {
      material.opacity = THREE.MathUtils.damp(material.opacity, opacity * fade, 12, delta);
      material.depthWrite = !ghosted.current && !(material instanceof THREE.MeshPhysicalMaterial);
      mesh.castShadow = castShadow && !ghosted.current;
    }
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
    return current.opening.position + hit.sub(center).dot(along) / wallLength(current.design, current.opening.wallId);
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
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      window.removeEventListener("blur", blur);
      finish();
    };
  }, []);

  useEffect(() => { if (invalid) onError?.(invalid); }, [invalid, onError]);

  const start = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    onSelect?.(opening.id);
    if (!onUpdate) return;
    const position = projectPosition(event.clientX, event.clientY);
    if (position === null) return;
    const target = event.target as CaptureTarget;
    dragging.current = { pointerId: event.pointerId, target, offset: opening.position - position, clientX: event.clientX, clientY: event.clientY, moved: false };
    target.setPointerCapture?.(event.pointerId);
    onEditStart?.();
    setIsDragging(true);
    onDragChange(true);
  };

  return <group ref={groupRef} position={[transform.x, opening.sillHeight, transform.z]} rotation={[0, transform.rotation, 0]}
    onPointerDown={start}
    onClick={event => event.stopPropagation()}
    onDoubleClick={event => {
      event.stopPropagation();
      if (opening.kind === "door") onUpdate?.({ ...opening, open: !opening.open });
    }}>
    {opening.kind === "door" ? <Door opening={opening} /> : <Window opening={opening} />}
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
      <span className={`block whitespace-nowrap rounded-lg px-2 py-1 text-[10px] font-semibold shadow-sm ${invalid ? "bg-red-600 text-white" : "bg-white/95 text-slate-700"}`}>
        {invalid ? "Энэ байрлалд багтахгүй" : isDragging ? "Ханын дагуу зөөж байна" : `${Math.round(opening.width * 100)} × ${Math.round(opening.height * 100)} см`}
      </span>
    </Html>}
  </group>;
}
