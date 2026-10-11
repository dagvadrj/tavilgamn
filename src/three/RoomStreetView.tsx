"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import type {
  RoomInteriorCamera,
  RoomShape,
  PlacedFurniture,
} from "@/lib/types";
import { RoomTourNavigation } from "./RoomTourNavigation";
import { tourRouteClear, type TourPoint } from "./roomCameraPlacement";
import type { CameraRequest } from "@/lib/plannerCamera";
import {
  lookAround,
  clampTourFov,
  tourVerticalFov,
} from "@/lib/roomInteriorCamera";

export function RoomStreetView({
  pose,
  roomId,
  locked,
  request,
  onSave,
  room,
  onLookingChange,
}: {
  pose: RoomInteriorCamera;
  roomId: string;
  locked: boolean;
  request?: CameraRequest;
  onSave?: (pose: RoomInteriorCamera) => void;
  room: RoomShape & { pieces: PlacedFurniture[] };
  onLookingChange?: (looking: boolean) => void;
}) {
  const { camera, gl, invalidate, size } = useThree();
  const current = useRef(pose),
    save = useRef(onSave),
    handled = useRef(request?.id);
  const looking = useRef(onLookingChange);
  looking.current = onLookingChange;
  const aspect = size
    ? size.width / Math.max(1, size.height)
    : (camera as THREE.PerspectiveCamera).aspect;
  save.current = onSave;
  const apply = () => {
    const p = current.current;
    camera.position.set(p.x, p.eyeHeight, p.z);
    camera.up.set(0, 1, 0);
    camera.rotation.set(p.pitch, p.yaw, 0, "YXZ");
    camera.updateMatrixWorld();
    invalidate();
  };
  useLayoutEffect(() => {
    current.current = pose;
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, roomId, pose.x, pose.z, pose.eyeHeight, pose.yaw, pose.pitch]);
  useLayoutEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    current.current = { ...current.current, fov: clampTourFov(pose.fov) };
    perspective.fov = tourVerticalFov(clampTourFov(pose.fov), aspect);
    perspective.zoom = 1;
    perspective.near = 0.03;
    perspective.updateProjectionMatrix();
    invalidate();
    return () => {
      perspective.near = 0.1;
      perspective.updateProjectionMatrix();
    };
  }, [camera, roomId, aspect, pose.fov, invalidate]);
  const setFov = (fov: number) => {
    current.current = { ...current.current, fov: clampTourFov(fov) };
    const perspective = camera as THREE.PerspectiveCamera;
    perspective.fov = tourVerticalFov(current.current.fov!, aspect);
    perspective.updateProjectionMatrix();
    invalidate();
    save.current?.(current.current);
  };
  const jump = (point: TourPoint) => {
    if (locked || !tourRouteClear(room, current.current, point)) return false;
    current.current = { ...current.current, ...point };
    apply();
    save.current?.(current.current);
    return true;
  };
  useEffect(() => {
    if (!request || request.id === handled.current) return;
    handled.current = request.id;
    if (locked) return;
    if (request.action === "zoom-in" || request.action === "zoom-out") {
      setFov(
        clampTourFov(current.current.fov) +
          (request.action === "zoom-in" ? -5 : 5),
      );
    } else if (
      request.action === "rotate-left" ||
      request.action === "rotate-right"
    ) {
      current.current = {
        ...current.current,
        yaw:
          current.current.yaw +
          (request.action === "rotate-left" ? 0.35 : -0.35),
      };
      apply();
      save.current?.(current.current);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, camera, locked, aspect, invalidate]);
  useEffect(() => {
    const canvas = gl.domElement;
    const keyboard = canvas.ownerDocument ?? canvas;
    let drag: { id: number; x: number; y: number } | null = null;
    const before = canvas.style.touchAction;
    canvas.style.touchAction = "none";
    const down = (event: PointerEvent) => {
      event.stopImmediatePropagation();
      if (locked || event.button !== 0) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      looking.current?.(true);
      canvas.focus();
      canvas.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      event.stopImmediatePropagation();
      if (!drag || event.pointerId !== drag.id) return;
      current.current = lookAround(
        current.current,
        event.clientX - drag.x,
        event.clientY - drag.y,
      );
      drag.x = event.clientX;
      drag.y = event.clientY;
      apply();
    };
    const up = (event: PointerEvent) => {
      event.stopImmediatePropagation();
      if (!drag || drag.id !== event.pointerId) return;
      drag = null;
      looking.current?.(false);
      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
      save.current?.(current.current);
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (locked) return;
      setFov(clampTourFov(current.current.fov) + Math.sign(event.deltaY) * 3);
    };
    const key = (event: KeyboardEvent) => {
      if (
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        (event.target as HTMLElement)?.closest?.(
          "input,textarea,select,[contenteditable=true]",
        )
      )
        return;
      if (
        locked ||
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      current.current = lookAround(
        current.current,
        event.key === "ArrowLeft" ? -40 : event.key === "ArrowRight" ? 40 : 0,
        event.key === "ArrowUp" ? -40 : event.key === "ArrowDown" ? 40 : 0,
      );
      apply();
      save.current?.(current.current);
    };
    const blur = () => {
      if (drag) save.current?.(current.current);
      drag = null;
      looking.current?.(false);
    };
    const tabIndex = canvas.tabIndex;
    canvas.tabIndex = 0;
    canvas.addEventListener("pointerdown", down, true);
    canvas.addEventListener("pointermove", move, true);
    canvas.addEventListener("pointerup", up, true);
    canvas.addEventListener("pointercancel", up, true);
    canvas.addEventListener("wheel", wheel, { capture: true, passive: false });
    keyboard.addEventListener("keydown", key, true);
    canvas.ownerDocument?.defaultView?.addEventListener("blur", blur);
    return () => {
      canvas.style.touchAction = before;
      canvas.tabIndex = tabIndex;
      canvas.removeEventListener("pointerdown", down, true);
      canvas.removeEventListener("pointermove", move, true);
      canvas.removeEventListener("pointerup", up, true);
      canvas.removeEventListener("pointercancel", up, true);
      canvas.removeEventListener("wheel", wheel, true);
      keyboard.removeEventListener("keydown", key, true);
      canvas.ownerDocument?.defaultView?.removeEventListener("blur", blur);
      looking.current?.(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, locked, roomId, aspect, invalidate]);
  return locked ? null : (
    <RoomTourNavigation room={room} pose={pose} onJump={jump} />
  );
}

export function CameraPointPlacement({
  onPlace,
}: {
  onPlace: (x: number, z: number) => void;
}) {
  const { camera, gl } = useThree();
  useEffect(() => {
    const canvas = gl.domElement;
    const ray = new THREE.Raycaster(),
      plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.stopImmediatePropagation();
      const bounds = canvas.getBoundingClientRect();
      ray.setFromCamera(
        new THREE.Vector2(
          ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
          1 - ((event.clientY - bounds.top) / bounds.height) * 2,
        ),
        camera,
      );
      const point = ray.ray.intersectPlane(plane, new THREE.Vector3());
      if (point) onPlace(point.x, point.z);
    };
    canvas.addEventListener("pointerdown", down, true);
    return () => canvas.removeEventListener("pointerdown", down, true);
  }, [camera, gl, onPlace]);
  return null;
}
