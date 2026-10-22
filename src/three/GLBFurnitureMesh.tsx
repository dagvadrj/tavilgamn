"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Edges } from "@react-three/drei";
import { useKitchenOpenAnimation } from "./useKitchenOpenAnimation";
import { SceneHtml as Html } from "./SceneHtml";
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
import { registerModelFloorBand } from "./furnitureFloorBand";
import { modelPlacement, modelSizeIssue } from "@/lib/modelPlacement";

export interface GLBFurnitureMeshProps {
  strictDimensions?: boolean;
  frontProjectionMm?: number;
  preservePhysicalSize?: boolean;
  /** Reflection fill for room lighting; leaves authored colour and texture factors intact. */
  environmentBoost?: number;
  /** Legacy AO override; verified local AO bakes retain their authored crease shading. */
  bakedOcclusionIntensity?: number;
  trackFloorBand?: boolean;
  modelId: string;
  basePath: string;
  glbFile: string;
  /** @deprecated Accepted for saved scenes only; only glbFile is loaded. */
  previewGlbFile?: string;
  w: number;
  d: number;
  h: number;
  selected?: boolean;
  /** Kitchen editors show load notices only for the selected product. */
  showLoadStatus?: boolean;
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
  /** Sample an authored opening animation; imported furniture is never rebuilt. */
  open?: boolean;
  openAnimation?: string;
}
type Display = {
  request: object;
  dimensions: { w: number; h: number; d: number };
  preservePhysicalSize: boolean;
  url: string;
  variant: "high";
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
  material.map = textures.baseColor ?? null;
  material.normalMap = textures.normal ?? null;
  material.roughnessMap = textures.roughness ?? null;
  material.metalnessMap = textures.metalness ?? null;
}
export function GLBFurnitureMesh({
  modelId,
  basePath,
  glbFile,
  selected = false,
  showLoadStatus = true,
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
  preservePhysicalSize = false,
  strictDimensions = false,
  frontProjectionMm = 0,
  environmentBoost = 1,
  bakedOcclusionIntensity,
  trackFloorBand = false,
  open = false,
  openAnimation,
}: GLBFurnitureMeshProps) {
  const { gl } = useThree();
  const root = useRef<THREE.Group>(null);
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
    if (enabled || !root.current) return;
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

  });
  const callbacks = useRef({ onReady, onError });
  callbacks.current = { onReady, onError };
  const [display, setDisplay] = useState<Display | null>(null);
  const owned = useRef(new Set<Display>());

  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const base = basePath.endsWith("/") ? basePath : `${basePath}/`;
  const front = frontMaterial ?? materialOverride;
  const carcass = carcassMaterial ?? materialOverride;
  const frontTexturePaths = front?.texturePaths;
  const carcassTexturePaths = carcass?.texturePaths;
  // Identify the complete requested appearance, including material-only updates.
  // A retained model must not count as the newly requested delivery for exports.
  const request = useMemo(
    () => ({
      enabled,
      base,
      glbFile,
      retry,
      front,
      carcass,
      frontColor,
      carcassColor,
      frontTexturePaths,
      carcassTexturePaths,
      environmentBoost,
      bakedOcclusionIntensity,
      trackFloorBand,
      modelId,
      w,
      h,
      d,
      preservePhysicalSize,
      strictDimensions,
      frontProjectionMm,
    }),
    [
      enabled,
      base,
      glbFile,
      retry,
      front,
      carcass,
      frontColor,
      carcassColor,
      frontTexturePaths,
      carcassTexturePaths,
      environmentBoost,
      bakedOcclusionIntensity,
      trackFloorBand,
      modelId,
      w,
      h,
      d,
      preservePhysicalSize,
      strictDimensions,
      frontProjectionMm,
    ],
  );

  useEffect(() => {
    const {
      enabled,
      base,
      glbFile,
      front,
      carcass,
      frontColor,
      carcassColor,
      frontTexturePaths,
      carcassTexturePaths,
      environmentBoost,
      bakedOcclusionIntensity,
      trackFloorBand,
      modelId,
      w,
      h,
      d,
      preservePhysicalSize,
      strictDimensions,
      frontProjectionMm,
    } = request;
    if (!enabled) return;
    let cancelled = false;
    let readyShown = false;
    let assetPrepared = false;
    const startedAt = performance.now();
    setError(false);
    // Keep the last complete scene attached while the next GLB and its textures
    // load. A new piece has no retained scene and shows its measured placeholder.

    const loadDelivery = async () => {
      const url = base + glbFile;
      const requestedAt = performance.now();
      const lease = acquireModel(gl, url);
      const frontTextureLease =
        acquireKitchenMaterialTextures(frontTexturePaths);
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
        if (strictDimensions) {
          const issue = modelSizeIssue(asset.bounds, { w, h, d }, frontProjectionMm);
          if (issue) throw new Error(issue);
        }
        const cloned = cloneModel(asset);
        cloned.scene.animations = cloned.animations ?? [];
        if (trackFloorBand)
          registerModelFloorBand(
            modelId,
            cloned.scene,
            cloned.bounds,
            { w, h, d },
            preservePhysicalSize,
            url,
            true,
          );

        cloned.scene.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;

          const materials = Array.isArray(object.material)
            ? object.material
            : [object.material];
          const clonedMaterials = materials.map((material) => {
            const clonedMaterial = material.clone();
            if (clonedMaterial instanceof THREE.MeshStandardMaterial) {
              // Preserve imported fabric grain, colour maps and baked occlusion.
              clonedMaterial.envMapIntensity *= environmentBoost;
              if (bakedOcclusionIntensity !== undefined &&
                  !(clonedMaterial.aoMap && clonedMaterial.userData.qualityBakeOcclusion === 1))
                clonedMaterial.aoMapIntensity = Math.max(
                  0,
                  Math.min(1, bakedOcclusionIntensity),
                );
              // Preserve authored face culling. Forced DoubleSide exposes the
              // backs of overlapping scan surfaces at grazing camera angles.
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
          request,
          dimensions: { w, h, d },
          preservePhysicalSize,
          url,
          variant: "high",
          requestedAt,
          asset: cloned,
          release: () => {
            frontTextureLease.release();
            carcassTextureLease.release();
            lease.release();
          },
        };
        {
          let firstFrame = true;
          cloned.scene.traverse((object) => {
            if (!(object instanceof THREE.Mesh)) return;
            object.onAfterRender = () => {
              if (!firstFrame || cancelled) return;
              firstFrame = false;
              reportModelPerformance({
                asset: new URL(url, window.location.origin).pathname,
                variant: next.variant,
                readyMs: performance.now() - requestedAt,
                totalReadyMs: performance.now() - startedAt,
                cacheHit: lease.cacheHit,
                queueMs: lease.cacheHit ? 0 : asset.metrics.queueMs,
                loadDecodeMs: lease.cacheHit ? 0 : asset.metrics.loadDecodeMs,
                resourceDurationMs: lease.cacheHit
                  ? 0
                  : asset.metrics.resourceDurationMs,
                encodedBodySize: lease.cacheHit
                  ? 0
                  : asset.metrics.encodedBodySize,
              });
              if (!readyShown) {
                readyShown = true;
                callbacks.current.onReady?.();
              }
            };
          });
        }
        transferred = true;
        assetPrepared = true;
        owned.current.add(next);
        setDisplay(next);
        return true;
      } catch (error) {
        console.error("[GlbFurnitureMesh]", error);
        if (!cancelled && !assetPrepared) {
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

    void loadDelivery();
    return () => {
      cancelled = true;
    };
  }, [gl, request]);

  useEffect(() => {
    // Retain only the currently attached clone; shared source leases stay cached.
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

  const ready = strictDimensions && display?.request !== request ? null : display;
  const currentDelivery = ready?.request === request;
  const openingClip = ready?.asset.animations?.find((animation) =>
      openAnimation
        ? animation.name === openAnimation
        : /^(open|opening)$/i.test(animation.name),
    );
  useKitchenOpenAnimation(ready?.asset.scene, openingClip, open);
  const size = ready?.asset.bounds.getSize(new THREE.Vector3());
  const origin = ready?.asset.bounds.getCenter(new THREE.Vector3());
  const valid = size && origin && Math.min(size.x, size.y, size.z) > 1e-9;
  const placement =
    ready && valid
      ? modelPlacement(
          ready.asset.bounds,
          ready.dimensions,
          ready.preservePhysicalSize,
        )
      : null;
  return (
    <group
      ref={root}
      userData={{
        deliveryReady: Boolean(currentDelivery),
        deliveryPending: !currentDelivery,
      }}
    >
      {ready && valid ? (
        <group
          scale={placement!.scale}
          userData={{ productDelivery: true }}
          dispose={null}
        >
          <primitive
            object={ready.asset.scene}
            position={placement!.position}
            dispose={null}
          />
        </group>
      ) : null}
      {!ready && (
        <mesh
          name="FurnitureLoadingPlaceholder"
          position={[0, h / 2, 0]}
          userData={{ exportExclude: true, deliveryPlaceholder: true }}
        >
          <boxGeometry args={[w, h, d]} />
          <meshBasicMaterial
            color="#9ab7d0"
            transparent
            opacity={0.22}
            depthWrite={false}
          />
          <Edges color="#1463df" lineWidth={1} />
        </mesh>
      )}
      {showLoadStatus && enabled && (
        <Html position={[0, h + 0.1, 0]} center zIndexRange={[8, 0]}
          style={{ display: !currentDelivery || error ? undefined : "none" }}>
          {error ? (
            <div
              role="status"
              className="rounded border bg-white px-3 py-2 text-center text-xs shadow-sm whitespace-nowrap"
            >
              <span className="block">
                {ready
                  ? "Шинэ загвар ачаалж чадсангүй."
                  : "Загвар ачаалж чадсангүй."}
              </span>
              <button
                type="button"
                className="mt-1 text-blue-700 underline"
                onClick={(event) => {
                  event.stopPropagation();
                  setRetry((value) => value + 1);
                }}
              >
                Дахин оролдох
              </button>
            </div>
          ) : (
            <span
              role="status"
              className="pointer-events-none whitespace-nowrap rounded-full border border-[#cfdeeb] bg-[#f3f7fb]/95 px-3 py-1.5 text-xs text-[#496a86]"
            >
              {ready ? "Тавилгыг шинэчилж байна…" : "Тавилга ачаалж байна…"}
            </span>
          )}
        </Html>
      )}
    </group>
  );
}
