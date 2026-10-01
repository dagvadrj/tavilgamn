"use client";
import { useEffect, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Edges, Html } from "@react-three/drei";
import * as THREE from "three";
import {
  kitchenCabinetSurface,
  type KitchenMaterialDefinition,
} from "@/lib/kitchenMaterials";
import {
  acquireKitchenMaterialTextures,
  type KitchenMaterialTextureSet,
} from "./kitchenMaterialTextures";

import {
  acquireModel,
  cloneModel,
  disposeModelClone,
  type LoadedModel,
} from "./modelLoader";
import { reportModelPerformance } from "@/lib/modelPerformance";

export interface GLBFurnitureMeshProps {
  modelId: string;
  basePath: string;
  glbFile: string;
  previewGlbFile?: string;
  w: number;
  d: number;
  h: number;
  selected?: boolean;
  deferUntilVisible?: boolean;
  /** @deprecated Use frontMaterial and carcassMaterial for kitchen models. */
  materialOverride?: {
    color: string;
    roughness: number;
    metalness: number;
    texturePaths?: Record<string, string>;
  };
  frontMaterial?: KitchenMaterialDefinition;
  frontColor?: string;
  carcassMaterial?: KitchenMaterialDefinition;
  carcassColor?: string;
  onReady?: () => void;
  onError?: () => void;
}
type Display = {
  key: string;
  url: string;
  variant: "preview" | "high";
  requestedAt: number;
  asset: LoadedModel;
  release: () => void;
};
function releaseDisplay(display: Display) {
  display.asset.scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material)
      ? object.material
      : [object.material])
      material.dispose();
  });
  disposeModelClone(display.asset);
  display.release();
}

function applyTextureSet(
  material: THREE.MeshStandardMaterial,
  textures: KitchenMaterialTextureSet,
) {
  if (textures.baseColor) material.map = textures.baseColor;
  if (textures.normal) material.normalMap = textures.normal;
  if (textures.roughness) material.roughnessMap = textures.roughness;
  if (textures.metalness) material.metalnessMap = textures.metalness;
}
export function GLBFurnitureMesh({
  modelId,
  basePath,
  glbFile,
  previewGlbFile,
  selected = false,
  deferUntilVisible = false,
  w,
  d,
  h,
  materialOverride,
  frontMaterial,
  frontColor,
  carcassMaterial,
  carcassColor,
  onReady,
  onError,
}: GLBFurnitureMeshProps) {
  const { gl } = useThree();
  const root = useRef<THREE.Group>(null);
  const pendingPreviewDraw = useRef<(() => void) | undefined>(undefined);
  const visibility = useRef({
    frustum: new THREE.Frustum(),
    matrix: new THREE.Matrix4(),
    bounds: new THREE.Box3(),
  });
  const [seen, setSeen] = useState(!deferUntilVisible || selected);
  const enabled = seen || selected || !deferUntilVisible;
  useEffect(() => {
    // Selection can start an off-screen asset; deselection must not restart it.
    if (enabled) setSeen(true);
  }, [enabled]);
  useFrame(({ camera }) => {
    if ((enabled && !pendingPreviewDraw.current) || !root.current) return;
    const { frustum, matrix, bounds } = visibility.current;
    root.current.updateWorldMatrix(true, false);
    camera.updateWorldMatrix(true, false);
    matrix.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    frustum.setFromProjectionMatrix(matrix);
    bounds.min.set(-w / 2, 0, -d / 2);
    bounds.max.set(w / 2, h, d / 2);
    bounds.applyMatrix4(root.current.matrixWorld);
    const visible = frustum.intersectsBox(bounds);
    if (!enabled && visible) setSeen(true);
    // Non-deferred assemblies may contain cabinets behind the camera. They
    // still need their high assets ready for whole-assembly exports.
    if (enabled && !visible) {
      pendingPreviewDraw.current?.();
      pendingPreviewDraw.current = undefined;
    }
  });
  const callbacks = useRef({ onReady, onError });
  callbacks.current = { onReady, onError };
  const [display, setDisplay] = useState<Display | null>(null);
  const owned = useRef(new Set<Display>());

  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const highKey = `${modelId}:${base}${glbFile}`;
  const previewFile =
    previewGlbFile && previewGlbFile !== glbFile ? previewGlbFile : null;
  const previewKey = previewFile
    ? `${modelId}:${base}${previewFile}`
    : null;
  const front = frontMaterial ?? materialOverride;
  const carcass = carcassMaterial ?? materialOverride;
  const frontTexturePaths = front?.texturePaths;
  const carcassTexturePaths = carcass?.texturePaths;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    let readyShown = false;
    let assetPrepared = false;
    let releaseRenderWait: (() => void) | undefined;
    const startedAt = performance.now();
    setError(false);
    setDisplay(null);

    const loadStage = async (file: string, stageKey: string, final: boolean) => {
      const url = base + file;
      const requestedAt = performance.now();
      const lease = acquireModel(gl, url);
      const frontTextureLease = acquireKitchenMaterialTextures(frontTexturePaths);
      const carcassTextureLease =
        acquireKitchenMaterialTextures(carcassTexturePaths);
      let transferred = false;
      try {
        const [asset, frontTextures, carcassTextures] = await Promise.all([
          lease.promise,
          frontTextureLease.promise,
          carcassTextureLease.promise,
        ]);
        if (cancelled) return;
        const cloned = cloneModel(asset);

        cloned.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;

          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          const clonedMaterials = materials.map((material) => {
            const clonedMaterial = material.clone();
            if (clonedMaterial instanceof THREE.MeshStandardMaterial) {
              clonedMaterial.normalMap = null;
              clonedMaterial.aoMap = null;
              clonedMaterial.side = THREE.DoubleSide;
              const surface = kitchenCabinetSurface(
                object.name,
                clonedMaterial.name,
              );
              const definition =
                surface === "front"
                  ? front
                  : surface === "carcass"
                    ? carcass
                    : undefined;
              const color =
                surface === "front"
                  ? frontColor
                  : surface === "carcass"
                    ? carcassColor
                    : undefined;
              if (surface && definition) {
                clonedMaterial.color.set(
                  color ??
                    ("baseColor" in definition
                      ? definition.baseColor
                      : definition.color),
                );
                clonedMaterial.roughness = definition.roughness;
                clonedMaterial.metalness = definition.metalness;
                applyTextureSet(
                  clonedMaterial,
                  surface === "front" ? frontTextures : carcassTextures,
                );
              }
              clonedMaterial.needsUpdate = true;
            }
            return clonedMaterial;
          });
          object.material = Array.isArray(object.material)
            ? clonedMaterials
            : clonedMaterials[0];
        });
        const next: Display = {
          key: stageKey,
          url,
          variant: final ? "high" : "preview",
          requestedAt,
          asset: cloned,
          release: () => {
            frontTextureLease.release();
            carcassTextureLease.release();
            lease.release();
          },
        };
        const rendered = new Promise<void>((resolve) => {
          releaseRenderWait = resolve;
          if (!final) pendingPreviewDraw.current = resolve;
          let firstFrame = true;
          cloned.scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            object.onAfterRender = () => {
              if (!firstFrame || cancelled) return;
              firstFrame = false;
              if (!final) pendingPreviewDraw.current = undefined;
              reportModelPerformance({
                asset: new URL(url, window.location.origin).pathname,
                variant: next.variant,
                readyMs: performance.now() - requestedAt,
                totalReadyMs: performance.now() - startedAt,
                cacheHit: lease.cacheHit,
                queueMs: lease.cacheHit ? 0 : asset.metrics.queueMs,
                loadDecodeMs: lease.cacheHit ? 0 : asset.metrics.loadDecodeMs,
                resourceDurationMs: lease.cacheHit ? 0 : asset.metrics.resourceDurationMs,
                encodedBodySize: lease.cacheHit ? 0 : asset.metrics.encodedBodySize,
              });
              if (!readyShown) {
                readyShown = true;
                callbacks.current.onReady?.();
              }
              resolve();
            };
          });
        });
        transferred = true;
        assetPrepared = true;
        owned.current.add(next);
        setDisplay(next);
        // Let preview reach the screen before even a cached high can replace it.
        if (!final) await rendered;
        return true;
      } catch (error) {
        console.error("[GlbFurnitureMesh]", error);
        if (!cancelled && final && !assetPrepared) {
          setError(true);
          callbacks.current.onError?.();
        }
        return false;
      } finally {
        if (!transferred) {
          frontTextureLease.release();
          carcassTextureLease.release();
          lease.release();
        }
      }
    };

    void (async () => {
      if (previewFile && previewKey) {
        await loadStage(previewFile, previewKey, false);
      }
      if (!cancelled) {
        await loadStage(glbFile, highKey, true);
      }
    })();
    return () => {
      cancelled = true;
      releaseRenderWait?.();
      pendingPreviewDraw.current = undefined;
    };
  }, [
    gl,
    enabled,
    base,
    glbFile,
    highKey,
    previewFile,
    previewKey,
    retry,
    front,
    carcass,
    frontColor,
    carcassColor,
    frontTexturePaths,
    carcassTexturePaths,
  ]);

  useEffect(() => {
    // Cached low/high promises may settle in the same React batch. Release even
    // clones whose intermediate state never reached a commit.
    for (const item of owned.current)
      if (item !== display) {
        releaseDisplay(item);
        owned.current.delete(item);
      }
  }, [display]);
  useEffect(() => {
    const items = owned.current;
    return () => {
      for (const item of items) {
        releaseDisplay(item);
      }
      items.clear();
    };
  }, []);

  const ready =
    display?.key === highKey || display?.key === previewKey ? display : null;
  const size = ready?.asset.bounds.getSize(new THREE.Vector3());
  const origin = ready?.asset.bounds.getCenter(new THREE.Vector3());
  const valid = size && origin && Math.min(size.x, size.y, size.z) > 1e-9;
  return (
    <group ref={root} userData={{ deliveryPending: !ready || ready.variant !== "high" }}>
      {ready && valid ? (
        <group scale={[w / size.x, h / size.y, d / size.z]} dispose={null}>
          <primitive
            object={ready.asset.scene}
            position={[-origin.x, -ready.asset.bounds.min.y, -origin.z]}
            dispose={null}
          />
        </group>
      ) : (
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w, h, d]} />
          <meshStandardMaterial
            color={error ? "#d5a995" : "#d4dcd0"}
            transparent
            opacity={0.45}
          />
          <Edges color="#6b7e68" />
        </mesh>
      )}
      {enabled && (!ready || error) && (
        <Html position={[0, h + 0.1, 0]} center zIndexRange={[8, 0]}>
          {error ? (
            <button
              type="button"
              className="rounded bg-white px-2 py-1 text-xs whitespace-nowrap"
              onClick={(event) => {
                event.stopPropagation();
                setRetry((value) => value + 1);
              }}
            >
              3D дахин ачаалах
            </button>
          ) : (
            <span
              role="status"
              className="pointer-events-none whitespace-nowrap rounded bg-white/90 px-2 py-1 text-xs"
            >
              3D ачаалж байна…
            </span>
          )}
        </Html>
      )}
    </group>
  );
}
