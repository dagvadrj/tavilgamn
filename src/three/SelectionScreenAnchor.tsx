"use client";
import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { clearSelectionAnchor, setSelectionAnchor } from "@/store/selectionAnchor";

/**
 * Projects the selected piece's box to screen pixels. It runs inside the
 * demand frameloop, so an idle camera produces no work and no store writes.
 */
export function SelectionScreenAnchor({ instanceId, w, h, d }: { instanceId: string; w: number; h: number; d: number }) {
  const ref = useRef<THREE.Group>(null);
  const { camera, gl, invalidate } = useThree();
  const last = useRef("");
  const corners = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (const x of [-w / 2, w / 2]) for (const y of [0, h]) for (const z of [-d / 2, d / 2]) points.push(new THREE.Vector3(x, y, z));
    return points;
  }, [w, h, d]);
  const point = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    const group = ref.current;
    if (!group) return;
    group.updateWorldMatrix(true, false);
    const canvas = gl.domElement.getBoundingClientRect();
    let left = Infinity, top = Infinity, right = -Infinity, bottom = -Infinity, visible = 0;
    for (const corner of corners) {
      point.copy(corner).applyMatrix4(group.matrixWorld).project(camera);
      if (point.z > 1) continue;
      visible++;
      const x = canvas.left + ((point.x + 1) / 2) * canvas.width;
      const y = canvas.top + ((1 - point.y) / 2) * canvas.height;
      left = Math.min(left, x); right = Math.max(right, x);
      top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
    const rect = visible ? { left, top, right, bottom } : null;
    const key = rect ? `${Math.round(left)},${Math.round(top)},${Math.round(right)},${Math.round(bottom)}` : "none";
    if (key === last.current) return;
    last.current = key;
    setSelectionAnchor(instanceId, rect);
  });

  // One frame after selecting, so the toolbar anchors without waiting for the
  // camera to move. It is a single invalidate, not a loop.
  useEffect(() => {
    invalidate();
    return () => {
      // A cleared anchor must be written again even if the rect is unchanged.
      last.current = "";
      clearSelectionAnchor(instanceId);
    };
  }, [instanceId, w, h, d, invalidate]);
  return <group ref={ref} />;
}
