"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Camera, Group } from "three";
import { ContactShadows } from "@react-three/drei";
import { useCameraMotionPreview } from "./CameraMotionPreview";
import {
  ROOM_CONTACT_SHADOW_LAYER,
  syncRoomContactShadowCasters,
} from "./roomContactShadowCasters";

/** Spend fewer pixels during interaction; authored mesh and textures stay intact. */
export function RoomMotionResolution({
  dpr,
}: {
  dpr: number | [number, number];
}) {
  const moving = useCameraMotionPreview();
  const initialDpr = useThree(state => state.viewport.initialDpr);
  const setDpr = useThree(state => state.setDpr);
  const invalidate = useThree(state => state.invalidate);
  const restingDpr = typeof dpr === "number" ? dpr : Math.max(dpr[0], Math.min(dpr[1], initialDpr));
  // Keep at least one sample per CSS pixel on desktop, so cabinet edges and
  // handles stay legible while orbiting. Low-end 1x canvases keep a smaller budget.
  const previewDpr = Math.min(restingDpr, Array.isArray(dpr) || restingDpr > 1
    ? Math.max(1, Math.min(1.25, restingDpr * 0.75))
    : Math.max(0.5, restingDpr * 0.85));
  useEffect(() => {
    if (initialDpr <= 0) return;
    setDpr(moving ? previewDpr : restingDpr);
    invalidate();
  }, [moving, initialDpr, restingDpr, previewDpr, setDpr, invalidate]);
  useEffect(
    () => () => {
      if (initialDpr > 0) setDpr(restingDpr);
    },
    [initialDpr, restingDpr, setDpr],
  );
  return null;
}

/** Orbiting does not move the sun or the furniture: reuse their physical shadows. */
export function PlannerMotionShadows({
  updatingLayout,
  revision,
}: {
  updatingLayout: boolean;
  revision: unknown;
}) {
  const moving = useCameraMotionPreview();
  const gl = useThree((state) => state.gl);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    // Edits still refresh shadows, including edits made during a camera gesture.
    gl.shadowMap.needsUpdate = true;
    invalidate();
  }, [gl, invalidate, revision]);
  useEffect(() => {
    if (!moving || updatingLayout) return;
    const autoUpdate = gl.shadowMap.autoUpdate;
    gl.shadowMap.autoUpdate = false;
    // A newly delivered model may join the scene while the camera is orbiting.
    const refresh = () => {
      gl.shadowMap.needsUpdate = true;
      invalidate();
    };
    window.addEventListener("tavilga:model-performance", refresh);
    return () => {
      window.removeEventListener("tavilga:model-performance", refresh);
      gl.shadowMap.autoUpdate = autoUpdate;
      refresh();
    };
  }, [moving, updatingLayout, gl, invalidate]);
  return null;
}

/** Camera movement does not change the floor's contact-shadow projection. */
export function RoomContactShadows({
  updatingLayout,
  ...props
}: ComponentProps<typeof ContactShadows> & {
  updatingLayout: boolean;
}) {
  const moving = useCameraMotionPreview();
  const root = useRef<Group>(null);
  const motionSynced = useRef(false);
  useFrame(({ scene }) => {
    const frozen = Boolean(moving && !updatingLayout);
    if (frozen && motionSynced.current) return;
    // Run before drei's depth capture. Async GLB children are picked up without
    // changing their main-camera visibility, material or physical sun shadows.
    const camera = root.current?.children.find(
      (child) => (child as Camera).isCamera,
    );
    if (!camera) return;
    camera.layers.set(ROOM_CONTACT_SHADOW_LAYER);
    syncRoomContactShadowCasters(scene);
    motionSynced.current = frozen;
  }, -1);
  return (
    <ContactShadows
      ref={root}
      {...props}
      frames={moving && !updatingLayout ? 1 : Infinity}
    />
  );
}
