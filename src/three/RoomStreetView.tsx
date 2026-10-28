"use client";
import { useEffect, useLayoutEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type {
  RoomInteriorCamera,
  RoomShape,
  PlacedFurniture,
} from "@/lib/types";
import { RoomTourNavigation } from "./RoomTourNavigation";
import { tourRouteClear, type TourPoint } from "./roomCameraPlacement";
import type { CameraRequest } from "@/lib/plannerCamera";
import { PLANNER_CAMERA } from "@/lib/plannerCameraProfile";
import {
  lookAround,
  clampTourFov,
  tourVerticalFov,
  dampInteriorLook,
  MAX_TOUR_FOV,
} from "@/lib/roomInteriorCamera";
import {
  pointerHitsFurniture,
  type InteriorEntryChannel,
} from "./roomEntryChannel";
import { SCENE_NAVIGATION_START } from "./sceneNavigation";

export function RoomStreetView({
  pose,
  roomId,
  locked,
  request,
  onSave,
  room,
  onLookingChange,
  originX = 0,
  originZ = 0,
  channel,
}: {
  pose: RoomInteriorCamera;
  roomId: string;
  locked: boolean;
  request?: CameraRequest;
  onSave?: (pose: RoomInteriorCamera) => void;
  room: RoomShape & { pieces: PlacedFurniture[] };
  onLookingChange?: (looking: boolean) => void;
  originX?: number;
  originZ?: number;
  /** Wheel entry/exit takes the camera through this hand-over. */
  channel?: InteriorEntryChannel;
}) {
  const { camera, gl, invalidate, size, scene } = useThree();
  const current = useRef(pose),
    save = useRef(onSave),
    handled = useRef(request?.id);
  const looking = useRef(onLookingChange);
  const desired = useRef(pose);
  const zoom = useRef<{ from: number; to: number; elapsed: number } | null>(
    null,
  );
  const reducedMotion = useRef(true);
  const pendingSave = useRef(false);
  const freshMotion = useRef(false);
  const travel = useRef<{
    from: TourPoint;
    to: TourPoint;
    elapsed: number;
    duration: number;
  } | null>(null);
  looking.current = onLookingChange;
  const aspect = size
    ? size.width / Math.max(1, size.height)
    : (camera as THREE.PerspectiveCamera).aspect;
  save.current = onSave;
  const apply = () => {
    const p = current.current;
    camera.position.set(p.x + originX, p.eyeHeight, p.z + originZ);
    camera.up.set(0, 1, 0);
    camera.rotation.set(p.pitch, p.yaw, 0, "YXZ");
    const perspective = camera as THREE.PerspectiveCamera;
    const fov = tourVerticalFov(clampTourFov(p.fov), aspect);
    if (perspective.fov !== fov) {
      perspective.fov = fov;
      perspective.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
    invalidate();
  };
  useLayoutEffect(() => {
    travel.current = null;
    current.current = pose;
    desired.current = pose;
    zoom.current = null;
    pendingSave.current = false;
    apply();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    camera,
    roomId,
    pose.x,
    pose.z,
    pose.eyeHeight,
    pose.yaw,
    pose.pitch,
    originX,
    originZ,
  ]);
  useLayoutEffect(() => {
    const perspective = camera as THREE.PerspectiveCamera;
    current.current = { ...current.current, fov: clampTourFov(pose.fov) };
    desired.current = { ...desired.current, fov: clampTourFov(pose.fov) };
    zoom.current = null;
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
    const to = clampTourFov(fov);
    desired.current = { ...desired.current, fov: to };
    freshMotion.current = !zoom.current;
    zoom.current = { from: clampTourFov(current.current.fov), to, elapsed: 0 };
    pendingSave.current = true;
    if (reducedMotion.current) {
      current.current = { ...current.current, fov: to };
      zoom.current = null;
      pendingSave.current = false;
      apply();
      save.current?.(current.current);
    }
    invalidate();
  };
  const zoomBy = (scale: number) =>
    setFov(
      THREE.MathUtils.radToDeg(
        2 *
          Math.atan(
            Math.tan(
              THREE.MathUtils.degToRad(clampTourFov(desired.current.fov) / 2),
            ) * scale,
          ),
      ),
    );
  const aim = (next: RoomInteriorCamera) => {
    freshMotion.current =
      current.current.yaw === desired.current.yaw &&
      current.current.pitch === desired.current.pitch &&
      !zoom.current;
    desired.current = next;
    if (reducedMotion.current) {
      current.current = {
        ...current.current,
        yaw: next.yaw,
        pitch: next.pitch,
      };
      apply();
    }
    invalidate();
  };
  const saveWhenSettled = () => {
    pendingSave.current = true;
    if (
      !zoom.current &&
      current.current.yaw === desired.current.yaw &&
      current.current.pitch === desired.current.pitch
    ) {
      pendingSave.current = false;
      save.current?.(current.current);
    }
  };
  useEffect(() => {
    const media =
      typeof window === "undefined"
        ? undefined
        : window.matchMedia?.("(prefers-reduced-motion: reduce)");
    const update = () => {
      reducedMotion.current = !media || media.matches;
      if (media?.matches) {
        current.current = {
          ...current.current,
          yaw: desired.current.yaw,
          pitch: desired.current.pitch,
          fov: desired.current.fov,
        };
        zoom.current = null;
        if (travel.current) {
          current.current = { ...current.current, ...travel.current.to };
          travel.current = null;
          pendingSave.current = true;
        }
        apply();
        if (pendingSave.current) {
          pendingSave.current = false;
          save.current?.(current.current);
        }
      }
    };
    update();
    media?.addEventListener?.("change", update);
    return () => media?.removeEventListener?.("change", update);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [camera, aspect, originX, originZ]);
  const jump = (point: TourPoint) => {
    if (locked || !tourRouteClear(room, current.current, point)) return false;
    if (reducedMotion.current) {
      current.current = { ...current.current, ...point };
      apply();
      save.current?.(current.current);
    } else {
      travel.current = {
        from: { x: current.current.x, z: current.current.z },
        to: point,
        elapsed: 0,
        duration: Math.min(
          1.5,
          Math.max(
            0.3,
            Math.hypot(
              point.x - current.current.x,
              point.z - current.current.z,
            ) * 0.4,
          ),
        ),
      };
      invalidate();
    }
    return true;
  };
  useEffect(() => {
    if (!channel) return;
    channel.atWidestView = () =>
      clampTourFov(desired.current.fov) >= MAX_TOUR_FOV - 0.01;
    channel.hold = () => {
      travel.current = null;
      zoom.current = null;
      desired.current = current.current;
      pendingSave.current = false;
    };
    channel.resume = apply;
    return () => {
      channel.suspended = false;
      channel.atWidestView = () => false;
      channel.hold = () => {};
      channel.resume = () => {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channel, camera, aspect, originX, originZ]);
  useFrame((_, delta) => {
    if (channel?.suspended) return;
    if (locked) {
      travel.current = null;
      zoom.current = null;
      desired.current = current.current;
      pendingSave.current = false;
      return;
    }
    const active = travel.current;
    const turning =
      current.current.yaw !== desired.current.yaw ||
      current.current.pitch !== desired.current.pitch;
    if (!active && !zoom.current && !turning) return;
    const step = freshMotion.current && delta > 0.1 ? 0 : Math.min(0.1, delta);
    freshMotion.current = false;
    if (turning)
      current.current = dampInteriorLook(
        current.current,
        desired.current,
        step,
      );
    if (zoom.current) {
      const z = zoom.current;
      z.elapsed += step;
      const t = Math.min(1, z.elapsed / PLANNER_CAMERA.transitionSeconds);
      current.current = {
        ...current.current,
        fov: z.from + (z.to - z.from) * (1 - (1 - t) ** 3),
      };
      if (t === 1) zoom.current = null;
    }
    if (active) {
      active.elapsed += step;
      const t = Math.min(1, active.elapsed / active.duration),
        eased = 1 - (1 - t) ** 3;
      current.current = {
        ...current.current,
        x: active.from.x + (active.to.x - active.from.x) * eased,
        z: active.from.z + (active.to.z - active.from.z) * eased,
      };
      if (t === 1) {
        travel.current = null;
        pendingSave.current = true;
      }
    }
    apply();
    if (
      !travel.current &&
      !zoom.current &&
      current.current.yaw === desired.current.yaw &&
      current.current.pitch === desired.current.pitch &&
      pendingSave.current
    ) {
      pendingSave.current = false;
      save.current?.(current.current);
    }
  });
  useEffect(() => {
    if (!request || request.id === handled.current) return;
    handled.current = request.id;
    if (locked) return;
    if (request.action === "zoom-in" || request.action === "zoom-out") {
      zoomBy(request.action === "zoom-in" ? 0.8 : 1.25);
    } else if (
      request.action === "rotate-left" ||
      request.action === "rotate-right"
    ) {
      aim({
        ...desired.current,
        yaw:
          desired.current.yaw +
          (request.action === "rotate-left" ? 0.35 : -0.35),
      });
      saveWhenSettled();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request, camera, locked, aspect, invalidate]);
  useEffect(() => {
    const canvas = gl.domElement;
    const keyboard = canvas.ownerDocument ?? canvas;
    let drag: { id: number; x: number; y: number } | null = null;
    const touches = new Map<number, { x: number; y: number }>();
    let pinching = false;
    const distance = () => {
      const [a, b] = [...touches.values()];
      return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : 0;
    };
    // A press that starts on furniture is the furniture drag's gesture; its
    // pointer passes through to the scene untouched until it is released.
    let furniture: { id: number; x: number; y: number } | null = null;
    const before = canvas.style.touchAction;
    canvas.style.touchAction = "none";
    const down = (event: PointerEvent) => {
      if (channel?.suspended) {
        event.stopImmediatePropagation();
        return;
      }
      if (
        event.button === 0 &&
        !furniture &&
        !drag &&
        !touches.size &&
        pointerHitsFurniture(scene, camera, canvas, event.clientX, event.clientY)
      ) {
        furniture = { id: event.pointerId, x: event.clientX, y: event.clientY };
        return;
      }
      event.stopImmediatePropagation();
      if (locked || event.button !== 0) return;
      if (event.pointerType === "touch" && furniture) {
        // A second finger turns the gesture into a pinch: roll the drag back.
        canvas.dispatchEvent(new Event(SCENE_NAVIGATION_START));
        touches.set(furniture.id, { x: furniture.x, y: furniture.y });
        furniture = null;
      }
      if (event.pointerType === "touch") {
        touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
        canvas.setPointerCapture(event.pointerId);
        if (touches.size > 1 || pinching) {
          event.preventDefault();
          pinching = true;
          drag = null;
          desired.current = current.current;
          zoom.current = null;
          looking.current?.(false);
          return;
        }
      }
      travel.current = null;
      zoom.current = null;
      desired.current = current.current;
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY };
      looking.current?.(true);
      canvas.focus();
      canvas.setPointerCapture(event.pointerId);
    };
    const move = (event: PointerEvent) => {
      if (furniture?.id === event.pointerId) {
        furniture.x = event.clientX;
        furniture.y = event.clientY;
        return;
      }
      event.stopImmediatePropagation();
      if (touches.has(event.pointerId)) {
        const before = distance();
        touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (pinching) {
          event.preventDefault();
          const after = distance();
          if (!locked && touches.size === 2 && before > 1 && after > 1)
            zoomBy(before / after);
          return;
        }
      }
      if (!drag || event.pointerId !== drag.id) return;
      aim(
        lookAround(
          desired.current,
          event.clientX - drag.x,
          event.clientY - drag.y,
        ),
      );
      drag.x = event.clientX;
      drag.y = event.clientY;
    };
    const up = (event: PointerEvent) => {
      if (furniture?.id === event.pointerId) {
        furniture = null;
        return;
      }
      event.stopImmediatePropagation();
      if (event.type === "pointercancel") {
        blur();
        return;
      }
      touches.delete(event.pointerId);
      if (pinching) {
        if (canvas.hasPointerCapture(event.pointerId))
          canvas.releasePointerCapture(event.pointerId);
        if (!touches.size) pinching = false;
        saveWhenSettled();
        return;
      }
      if (!drag || drag.id !== event.pointerId) return;
      drag = null;
      looking.current?.(false);
      if (canvas.hasPointerCapture(event.pointerId))
        canvas.releasePointerCapture(event.pointerId);
      saveWhenSettled();
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (locked || channel?.suspended) return;
      travel.current = null;
      const pixels =
        event.deltaY *
        (event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? Math.max(1, size.height)
            : 1);
      const scale = Math.exp(THREE.MathUtils.clamp(pixels, -600, 600) * 0.0015);
      zoomBy(scale);
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
        channel?.suspended ||
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
      travel.current = null;
      aim(
        lookAround(
          desired.current,
          event.key === "ArrowLeft" ? -40 : event.key === "ArrowRight" ? 40 : 0,
          event.key === "ArrowUp" ? -40 : event.key === "ArrowDown" ? 40 : 0,
        ),
      );
      saveWhenSettled();
    };
    const blur = () => {
      const moving =
        !!zoom.current ||
        current.current.yaw !== desired.current.yaw ||
        current.current.pitch !== desired.current.pitch;
      zoom.current = null;
      desired.current = current.current;
      pendingSave.current = false;
      if (travel.current) {
        travel.current = null;
        save.current?.(current.current);
      }
      if (drag || moving) save.current?.(current.current);
      if (drag && canvas.hasPointerCapture(drag.id))
        canvas.releasePointerCapture(drag.id);
      drag = null;
      for (const id of touches.keys())
        if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
      touches.clear();
      pinching = false;
      furniture = null;
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
  }, [camera, gl, scene, channel, locked, roomId, aspect, invalidate, originX, originZ]);
  return locked ? null : (
    <RoomTourNavigation
      room={room}
      pose={pose}
      onJump={jump}
      originX={originX}
      originZ={originZ}
    />
  );
}
