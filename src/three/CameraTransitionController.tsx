"use client";
import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { PerspectiveCamera } from "three";
import { advanceCameraTransition, cancelCameraTransition } from "@/lib/cameraTransition";
import type { NavigationControls } from "@/lib/plannerCamera";
/** The only frame writer for programmatic orbit-camera transitions. */
export function CameraTransitionController() {
    const { camera, controls, gl, invalidate } = useThree();
    useEffect(() => {
        const cancel = () => cancelCameraTransition(camera as PerspectiveCamera);
        const element = gl.domElement;
        const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
        const reduce = () => { if (media?.matches) {
            advanceCameraTransition(camera as PerspectiveCamera, controls && "target" in controls ? controls as unknown as NavigationControls : undefined, Infinity);
            invalidate();
        } };
        media?.addEventListener?.("change", reduce);
        element.addEventListener("pointerdown", cancel, true);
        element.addEventListener("wheel", cancel, true);
        element.addEventListener("keydown", cancel, true);
        const orbit = controls as unknown as {
            addEventListener?: (name: string, cb: () => void) => void;
            removeEventListener?: (name: string, cb: () => void) => void;
        };
        orbit?.addEventListener?.("start", cancel);
        return () => {
            element.removeEventListener("pointerdown", cancel, true);
            element.removeEventListener("wheel", cancel, true);
            element.removeEventListener("keydown", cancel, true);
            orbit?.removeEventListener?.("start", cancel);
            media?.removeEventListener?.("change", reduce);
        };
    }, [camera, controls, gl, invalidate]);
    // Changing OrbitControls to MapControls must not cancel a view transition
    // that the camera rig has just started in a layout effect.
    useEffect(() => () => cancelCameraTransition(camera as PerspectiveCamera), [camera]);
    useFrame((_, delta) => {
        if (advanceCameraTransition(camera as PerspectiveCamera, controls && "target" in controls ? controls as unknown as NavigationControls : undefined, delta))
            invalidate();
    });
    return null;
}
