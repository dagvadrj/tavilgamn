"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RoomInteriorCamera } from "@/lib/types";
import type { CameraRequest } from "@/lib/plannerCamera";
import {
  lookAround,
  walkCamera,
  clampTourFov,
  tourVerticalFov,
  type WalkDirection,
} from "@/lib/roomInteriorCamera";

export function RoomStreetView({
  pose,
  roomId,
  locked,
  request,
  onSave,
  canWalk,
  walkDirection,
}: {
  pose: RoomInteriorCamera;
  roomId: string;
  locked: boolean;
  request?: CameraRequest;
  onSave?: (pose: RoomInteriorCamera) => void;
  canWalk?: (x: number, z: number) => boolean;
  walkDirection?: WalkDirection | null;
}) {
  const { camera, gl, invalidate, size } = useThree();
  const current = useRef(pose),
    save = useRef(onSave),
    handled = useRef(request?.id);
  const keys = useRef(new Set<WalkDirection>()),
    previousWalk = useRef(walkDirection);
  const movement = useRef({ canWalk, walkDirection });
  movement.current = { canWalk, walkDirection };
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
  useFrame((_, delta) => {
    if (locked || !movement.current.canWalk) return;
    const active = new Set(keys.current);
    if (movement.current.walkDirection)
      active.add(movement.current.walkDirection);
    if (!active.size) return;
    const forward =
      Number(active.has("forward")) - Number(active.has("backward"));
    const right = Number(active.has("right")) - Number(active.has("left"));
    current.current = walkCamera(
      current.current,
      forward,
      right,
      delta,
      movement.current.canWalk,
    );
    apply();
  });
  useEffect(() => {
    if (previousWalk.current && !walkDirection && !locked)
      save.current?.(current.current);
    previousWalk.current = walkDirection;
    if (walkDirection && !locked) invalidate();
  }, [walkDirection, locked, invalidate]);
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
    const pressed = keys.current;
    pressed.clear();
    let drag: { id: number; x: number; y: number } | null = null;
    const before = canvas.style.touchAction;
    canvas.style.touchAction = "none";
    const down = (event: PointerEvent) => {
      event.stopImmediatePropagation();
      if (locked || event.button !== 0) return;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
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
    const direction = (key: string): WalkDirection | undefined =>
      (({ w: "forward", s: "backward", a: "left", d: "right" }) as const)[
        key.toLowerCase().replace(/^key/, "") as "w" | "s" | "a" | "d"
      ];
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
      const walking = direction(event.code || event.key);
      if (!locked && walking) {
        event.preventDefault();
        event.stopImmediatePropagation();
        pressed.add(walking);
        invalidate();
        return;
      }
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
    const keyUp = (event: KeyboardEvent) => {
      const walking = direction(event.code || event.key);
      if (!walking || !pressed.delete(walking)) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!pressed.size) save.current?.(current.current);
    };
    const blur = () => {
      if (pressed.size) save.current?.(current.current);
      pressed.clear();
    };
    const tabIndex = canvas.tabIndex;
    canvas.tabIndex = 0;
    canvas.addEventListener("pointerdown", down, true);
    canvas.addEventListener("pointermove", move, true);
    canvas.addEventListener("pointerup", up, true);
    canvas.addEventListener("pointercancel", up, true);
    canvas.addEventListener("wheel", wheel, { capture: true, passive: false });
    keyboard.addEventListener("keydown", key, true);
    keyboard.addEventListener("keyup", keyUp, true);
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
      keyboard.removeEventListener("keyup", keyUp, true);
      canvas.ownerDocument?.defaultView?.removeEventListener("blur", blur);
      pressed.clear();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, gl, locked, roomId, aspect, invalidate]);
  return null;
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
