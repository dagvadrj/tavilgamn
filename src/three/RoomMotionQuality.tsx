"use client";

import { useEffect, type ComponentProps } from "react";
import { useThree } from "@react-three/fiber";
import { ContactShadows } from "@react-three/drei";
import { useCameraMotionPreview } from "./CameraMotionPreview";

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
  return <ContactShadows {...props} frames={moving && !updatingLayout ? 1 : Infinity} />;
}
