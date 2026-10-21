"use client";
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Box3, PerspectiveCamera, Vector3 } from "three";
import type { ProductBounds } from "@/lib/productDimensions";

export function ProductFrame({ bounds }: { bounds: ProductBounds | null }) {
  const { camera, controls, size, invalidate } = useThree();
  useEffect(() => {
    if (!bounds || !(camera instanceof PerspectiveCamera)) return;
    const orbit = controls as unknown as {
      target: Vector3;
      minDistance: number;
      maxDistance: number;
      update: () => void;
    } | null;
    if (!orbit?.target) return;
    const box = new Box3(
      new Vector3(...bounds.min),
      new Vector3(...bounds.max),
    );
    const center = box.getCenter(new Vector3()),
      extent = box.getSize(new Vector3());
    const direction = camera.position.clone().sub(orbit.target).normalize();
    const aspect = Math.max(0.1, size.width / Math.max(1, size.height));
    const fit =
      Math.max(extent.y, extent.x / aspect) /
      (2 * Math.tan((camera.fov * Math.PI) / 360));
    const distance = Math.max(0.5, (fit + extent.z / 2) * 1.28);
    camera.position.copy(center).addScaledVector(direction, distance);
    orbit.target.copy(center);
    orbit.minDistance = Math.max(0.25, distance * 0.35);
    orbit.maxDistance = distance * 3;
    camera.near = Math.max(0.01, distance / 100);
    camera.far = Math.max(100, distance * 30);
    camera.updateProjectionMatrix();
    orbit.update();
    invalidate();
  }, [bounds, camera, controls, invalidate, size.width, size.height]);
  return null;
}
