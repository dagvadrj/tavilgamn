"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";

/** A DOM overlay follows demand-rendered camera frames without its own render loop. */
export function TourOverlay({
  position,
  children,
}: {
  position?: [number, number, number];
  children: ReactNode;
}) {
  const { gl, invalidate } = useThree();
  const element = useRef<HTMLDivElement | null>(null);
  const root = useRef<Root | null>(null);
  const projected = useRef(new Vector3());
  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return;
    const node = gl.domElement.ownerDocument.createElement("div");
    Object.assign(node.style, {
      position: "absolute",
      pointerEvents: position ? "auto" : "none",
      zIndex: position ? "12" : "10",
      ...(position
        ? { display: "none", transform: "translate(-50%, -50%) scaleY(.5)" }
        : { inset: "0" }),
    });
    host.appendChild(node);
    const mountedRoot = createRoot(node);
    element.current = node;
    root.current = mountedRoot;
    invalidate();
    return () => {
      element.current = null;
      root.current = null;
      node.remove();
      // R3F may be committing its own root. Tear down the DOM root afterwards.
      queueMicrotask(() => mountedRoot.unmount());
    };
    // Coordinates change on camera jumps; the overlay host stays mounted.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, invalidate, !!position]);
  useEffect(() => {
    root.current?.render(children);
  }, [children]);
  useFrame(({ camera, size }) => {
    const node = element.current;
    if (!node || !position) return;
    const p = projected.current.set(...position).project(camera);
    const visible =
      p.z > -1 && p.z < 1 && Math.abs(p.x) < 1 && Math.abs(p.y) < 1;
    node.style.display = visible ? "block" : "none";
    if (visible) {
      node.style.left = `${((p.x + 1) * size.width) / 2}px`;
      node.style.top = `${((1 - p.y) * size.height) / 2}px`;
    }
  });
  return null;
}
