"use client";
import { useMemo, useRef, useState, type PointerEvent } from "react";
import { createPortal } from "react-dom";
import { Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { ArrowUp } from "lucide-react";
import * as THREE from "three";
import type {
  PlacedFurniture,
  RoomInteriorCamera,
  RoomShape,
} from "@/lib/types";
import { tourStepTargets, type TourPoint } from "./roomCameraPlacement";

export function RoomTourNavigation({
  room,
  pose,
  onJump,
}: {
  room: RoomShape & { pieces: PlacedFurniture[] };
  pose: RoomInteriorCamera;
  onJump: (point: TourPoint) => boolean;
}) {
  const { camera, gl } = useThree();
  const targets = useMemo(() => tourStepTargets(room, pose), [room, pose]);
  const alignment = (point: TourPoint) => {
    const dx = point.x - pose.x,
      dz = point.z - pose.z;
    return (
      (-Math.sin(pose.yaw) * dx - Math.cos(pose.yaw) * dz) / Math.hypot(dx, dz)
    );
  };
  const next = [...targets].sort((a, b) => alignment(b) - alignment(a))[0];
  return (
    <>
      {targets.map((point) => (
        <Html
          key={`${point.x}:${point.z}`}
          position={[point.x, 0.04, point.z]}
          transform
          rotation={[
            -Math.PI / 2,
            0,
            -Math.atan2(point.x - pose.x, -(point.z - pose.z)),
          ]}
          distanceFactor={4}
          zIndexRange={[12, 11]}
        >
          <TourArrow
            point={point}
            onJump={onJump}
            camera={camera}
            canvas={gl.domElement}
          />
        </Html>
      ))}
      <Html
        fullscreen
        calculatePosition={(_, __, size) => [size.width / 2, size.height / 2]}
        onOcclude={() => {}}
        zIndexRange={[10, 10]}
        style={{ pointerEvents: "none" }}
      >
        <div
          className="absolute bottom-32 left-1/2 -translate-x-1/2 text-center"
          style={{ pointerEvents: "auto" }}
        >
          <TourArrow
            point={next}
            compact
            onJump={onJump}
            camera={camera}
            canvas={gl.domElement}
          />
          <span className="mt-1 block rounded bg-white/80 px-2 py-1 text-xs">
            {next ? "Дарж шилжих · Чирж цэг сонгох" : "Чирж цэг сонгох"}
          </span>
        </div>
      </Html>
    </>
  );
}

/** DOM dragging never invalidates the WebGL scene; only an accepted drop moves it. */
export function TourArrow({
  point,
  onJump,
  camera,
  canvas,
  compact = false,
}: {
  point?: TourPoint;
  onJump: (point: TourPoint) => boolean;
  camera: THREE.Camera;
  canvas: HTMLCanvasElement;
  compact?: boolean;
}) {
  const drag = useRef<{
    id: number;
    x: number;
    y: number;
    moved: boolean;
  } | null>(null);
  const [message, setMessage] = useState("");
  const [ghost, setGhost] = useState<{ x: number; y: number } | null>(null);
  const floorPoint = (event: PointerEvent<HTMLButtonElement>) => {
    const bounds = canvas.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        1 - ((event.clientY - bounds.top) / bounds.height) * 2,
      ),
      camera,
    );
    const hit = ray.ray.intersectPlane(
      new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
      new THREE.Vector3(),
    );
    return hit ? { x: hit.x, z: hit.z } : null;
  };
  const finish = (
    event: PointerEvent<HTMLButtonElement>,
    cancelled = false,
  ) => {
    const active = drag.current;
    if (!active || active.id !== event.pointerId) return;
    drag.current = null;
    setGhost(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (cancelled) return;
    const target = active.moved ? floorPoint(event) : point;
    if (!target) {
      setMessage("Сумыг шалан дээр чирж тавина уу.");
    } else if (!onJump(target)) {
      setMessage("Хана, тавилгаас зайтай, хүрэх боломжтой шал сонгоно уу.");
    } else setMessage("");
  };
  return (
    <>
      <button
        type="button"
        aria-label={
          point
            ? "Энэ цэг рүү шилжих; сумыг чирж өөр цэг сонгох"
            : "Шилжих цэг сонгох — сумыг шалан дээр чирнэ үү"
        }
        title={
          point ? "Дарж шилжих · Чирж цэг сонгох" : "Шалан дээр чирж тавих"
        }
        className={`mx-auto flex items-center justify-center border-2 border-white/80 bg-white/70 text-gray-700 shadow-lg ${point && !compact ? "h-16 w-16 rounded-full" : "h-12 w-12 rounded-full"}`}
        style={{ touchAction: "none", cursor: "grab" }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.preventDefault();
          event.stopPropagation();
          drag.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
          setMessage("");
        }}
        onPointerMove={(event) => {
          const active = drag.current;
          if (!active || active.id !== event.pointerId) return;
          event.stopPropagation();
          const dx = event.clientX - active.x,
            dy = event.clientY - active.y;
          if (Math.hypot(dx, dy) > 6) active.moved = true;
          if (active.moved) setGhost({ x: event.clientX, y: event.clientY });
        }}
        onPointerUp={(event) => finish(event)}
        onPointerCancel={(event) => finish(event, true)}
        onLostPointerCapture={(event) => finish(event, true)}
        onClick={(event) => {
          // Keyboard/assistive activation has no preceding pointer event.
          if (event.detail === 0 && point) onJump(point);
          else if (event.detail === 0)
            setMessage("Сумыг шалан дээр чирж тавина уу.");
        }}
      >
        <ArrowUp size={point && !compact ? 38 : 26} strokeWidth={3} />
      </button>
      {message && (
        <span
          role="status"
          className="mt-2 block max-w-60 rounded-lg bg-white px-3 py-2 text-xs text-gray-700"
        >
          {message}
        </span>
      )}
      {ghost &&
        createPortal(
          <div
            aria-hidden="true"
            className="fixed flex h-14 w-14 items-center justify-center rounded-full border-2 border-white bg-white/80 text-gray-700 shadow-lg"
            style={{
              left: ghost.x,
              top: ghost.y,
              transform: "translate(-50%, -50%)",
              pointerEvents: "none",
              zIndex: 2147483647,
            }}
          >
            <ArrowUp size={32} strokeWidth={3} />
          </div>,
          canvas.ownerDocument.body,
        )}
    </>
  );
}
