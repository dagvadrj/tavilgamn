"use client";
import { useLayoutEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

interface CameraControls {
  target: THREE.Vector3;
  update: () => void;
}
interface Props {
  view: "plan" | "perspective";
  width: number;
  depth: number;
  height: number;
  centerX: number;
  centerZ: number;
  resetKey: number;
  originX: number;
  originZ: number;
}

/** Keep the same world-space view when the selected room changes local coordinates. */
export function RoomCameraRig({ view, width, depth, height, centerX, centerZ, resetKey, originX, originZ }: Props) {
  const camera = useThree(state => state.camera);
  const rawControls = useThree(state => state.controls);
  const controls = rawControls && "target" in rawControls && "update" in rawControls ? rawControls as unknown as CameraControls : undefined;
  const size = useThree(state => state.size);
  const invalidate = useThree(state => state.invalidate);
  const previous = useRef<{camera:THREE.Camera;view:Props["view"];resetKey:number;originX:number;originZ:number;target:THREE.Vector3;controls?:CameraControls} | null>(null);

  useLayoutEffect(() => {
    const last = previous.current;
    const target = (controls && controls === last?.controls ? controls.target : last?.target.clone()) ?? new THREE.Vector3();
    const perspective = camera as THREE.PerspectiveCamera;
    if (!last || last.camera !== camera || last.view !== view || last.resetKey !== resetKey) {
      perspective.fov = view === "plan" ? 35 : 40;
      const aspect = size.width / Math.max(size.height, 1);
      if (view === "plan") {
        target.set(centerX, 0, centerZ);
        camera.up.set(0, 0, -1);
        const distance = Math.max(depth + 1.8, (width + 1.8) / aspect) / (2 * Math.tan(THREE.MathUtils.degToRad(perspective.fov / 2)));
        camera.position.set(centerX, distance, centerZ + .001);
        perspective.far = Math.max(300, distance * 4);
      } else {
        const targetHeight = height * .4;
        target.set(centerX, targetHeight, centerZ);
        camera.up.set(0, 1, 0);
        const verticalHalfFov = THREE.MathUtils.degToRad(perspective.fov / 2);
        const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * aspect);
        const radius = Math.hypot(width / 2, depth / 2, Math.max(targetHeight, height - targetHeight));
        const distance = radius / Math.sin(Math.min(verticalHalfFov, horizontalHalfFov)) * 1.08;
        camera.position.copy(target).addScaledVector(new THREE.Vector3(.8, .68, .82).normalize(), distance);
        perspective.far = Math.max(300, distance * 4);
      }
      camera.lookAt(target);
    } else {
      // Moving both camera and orbit target preserves orbit angle, zoom and pan.
      const shift = new THREE.Vector3(last.originX - originX, 0, last.originZ - originZ);
      camera.position.add(shift);
      target.add(shift);
    }
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    if (controls) {
      controls.target.copy(target);
      controls.update();
    }
    previous.current = { camera, view, resetKey, originX, originZ, target: controls?.target ?? target, controls };
    invalidate();
  }, [camera, controls, view, width, depth, height, centerX, centerZ, resetKey, originX, originZ, size.width, size.height, invalidate]);
  return null;
}
