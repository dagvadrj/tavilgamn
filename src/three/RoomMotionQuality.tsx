"use client";

import { useEffect, useRef, type ComponentProps } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Camera, Group } from "three";
import { ContactShadows } from "@react-three/drei";
import { useCameraMotionPreview } from "./CameraMotionPreview";
import { ROOM_CONTACT_SHADOW_LAYER, syncRoomContactShadowCasters } from "./roomContactShadowCasters";

/** Spend fewer pixels during interaction; authored mesh and textures stay intact. */
export function RoomMotionResolution({ dpr }: { dpr: number | [number, number] }) {
  const moving = useCameraMotionPreview();
  const initialDpr = useThree(state => state.viewport.initialDpr);
  const setDpr = useThree(state => state.setDpr);
  const invalidate = useThree(state => state.invalidate);
  const restingDpr = typeof dpr === "number" ? dpr : Math.max(dpr[0], Math.min(dpr[1], initialDpr));
  useEffect(() => {
    if (initialDpr <= 0) return;
    setDpr(moving ? Math.min(1, restingDpr) : restingDpr);
    invalidate();
  }, [moving, initialDpr, restingDpr, setDpr, invalidate]);
  useEffect(() => () => { if (initialDpr > 0) setDpr(restingDpr); }, [initialDpr, restingDpr, setDpr]);
  return null;
}

/** Camera movement does not change the floor's contact-shadow projection. */
export function RoomContactShadows({ updatingLayout, ...props }: ComponentProps<typeof ContactShadows> & {
  updatingLayout: boolean;
}) {
  const moving = useCameraMotionPreview();
  const root = useRef<Group>(null);
  useFrame(({ scene }) => {
    // Run before drei's depth capture. Async GLB children are picked up without
    // changing their main-camera visibility, material or physical sun shadows.
    const camera = root.current?.children.find(child => (child as Camera).isCamera);
    if (!camera) return;
    camera.layers.set(ROOM_CONTACT_SHADOW_LAYER);
    syncRoomContactShadowCasters(scene);
  }, -1);
  return <ContactShadows ref={root} {...props} frames={moving && !updatingLayout ? 1 : Infinity} />;
}
