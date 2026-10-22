"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type ReactNode,
} from "react";
import { useFrame, useThree, type ThreeElements } from "@react-three/fiber";
import {
  Raycaster,
  Vector2,
  Vector3,
  type Object3D,
  type Group,
  type Mesh,
} from "three";
import { mountSceneOverlayRoot } from "./sceneOverlayRoot";

type SceneHtmlProps = Omit<ThreeElements["group"], "children"> & {
  children: ReactNode;
  center?: boolean;
  style?: CSSProperties;
  className?: string;
  zIndexRange?: [number, number];
  occlude?: boolean;
};

function visibleInScene(object: Object3D) {
  for (let node: Object3D | null = object; node; node = node.parent)
    if (!node.visible) return false;
  return true;
}

/** Screen-space scene labels with independently owned, deferred DOM-root teardown.
 * Implements the projection/centering/occlusion used by our planners; no CSS-3D
 * transforms or extra render loop. Children retain real DOM refs and handlers.
 */
export function SceneHtml({
  children,
  center,
  style,
  className,
  zIndexRange = [20, 0],
  occlude = false,
  ...groupProps
}: SceneHtmlProps) {
  const { gl, events, invalidate } = useThree();
  const target = (events.connected ||
    gl.domElement.parentElement) as HTMLElement | null;
  const group = useRef<Group>(null);
  const mounted = useRef<ReturnType<typeof mountSceneOverlayRoot> | null>(null);
  const vectors = useMemo(
    () => ({
      world: new Vector3(),
      projected: new Vector3(),
      camera: new Vector3(),
      screen: new Vector2(),
      raycaster: new Raycaster(),
    }),
    [],
  );

  useLayoutEffect(() => {
    if (!target) return;
    const overlay = mountSceneOverlayRoot(target);
    Object.assign(overlay.element.style, {
      position: "absolute",
      top: "0",
      left: "0",
      transformOrigin: "0 0",
      pointerEvents: "none",
      display: "none",
    });
    mounted.current = overlay;
    invalidate();
    return () => {
      if (mounted.current === overlay) mounted.current = null;
      overlay.dispose();
    };
  }, [target, invalidate]);

  useLayoutEffect(() => {
    mounted.current?.render(
      <div
        className={className}
        ref={(node) => {
          if (node) invalidate();
        }}
        style={{
          position: "absolute",
          transform: center ? "translate(-50%, -50%)" : undefined,
          pointerEvents: "auto",
          ...style,
        }}
      >
        {children}
      </div>,
    );
  });

  useFrame(({ camera, scene, size }) => {
    const anchor = group.current,
      element = mounted.current?.element;
    if (!anchor || !element) return;
    anchor.updateWorldMatrix(true, false);
    camera.updateMatrixWorld();
    anchor.getWorldPosition(vectors.world);
    vectors.projected.copy(vectors.world).project(camera);
    const p = vectors.projected;
    let visible =
      visibleInScene(anchor) &&
      Number.isFinite(p.x + p.y + p.z) &&
      p.z >= -1 &&
      p.z <= 1;
    if (visible && occlude) {
      vectors.screen.set(p.x, p.y);
      vectors.raycaster.setFromCamera(vectors.screen, camera);
      const distance = vectors.raycaster.ray.origin.distanceTo(vectors.world);
      visible = !vectors.raycaster
        .intersectObjects(scene.children, true)
        .some((hit) => {
          if (hit.distance >= distance - 0.001 || !visibleInScene(hit.object))
            return false;
          const material = (hit.object as Mesh).material;
          const materials = Array.isArray(material)
            ? material
            : material
              ? [material]
              : [];
          return materials.some(
            (value) =>
              value.visible &&
              value.colorWrite &&
              (!value.transparent || value.opacity > 0.01),
          );
        });
    }
    element.style.display = visible ? "block" : "none";
    if (!visible) return;
    element.style.transform = `translate3d(${((p.x + 1) * size.width) / 2}px,${((1 - p.y) * size.height) / 2}px,0)`;
    camera.getWorldPosition(vectors.camera);
    const distance = vectors.camera.distanceTo(vectors.world);
    const ratio = Math.max(
      0,
      Math.min(1, (distance - camera.near) / (camera.far - camera.near)),
    );
    element.style.zIndex = String(
      Math.round(zIndexRange[0] + (zIndexRange[1] - zIndexRange[0]) * ratio),
    );
  });
  return <group {...groupProps} ref={group} />;
}
