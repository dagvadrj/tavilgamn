"use client";

import { useEffect, useMemo, useState } from "react";
import { SceneHtml as Html } from "./SceneHtml";
import { useThree } from "@react-three/fiber";
import { type Group } from "three";
import type { ModularCabinet } from "@/lib/kitchenCabinets";
import type { KitchenCatalogVariant } from "@/lib/kitchenModuleCatalog";
import {
  getKitchenGlbAssembly,
  resolveKitchenPartOption,
  type KitchenGlbAssembly,
  type KitchenGlbOption,
} from "@/lib/kitchenGlbAssembly";
import { modelPlacement } from "@/lib/modelPlacement";
import { GLBFurnitureMesh } from "./GLBFurnitureMesh";
import {
  acquireModel,
  cloneModel,
  disposeModelClone,
  type LoadedModel,
} from "./modelLoader";
import {
  composeKitchenGlb,
  type KitchenPartMotion,
} from "./kitchenGlbComposition";
import { useKitchenOpenAnimation } from "./useKitchenOpenAnimation";
import { applyKitchenPartMaterial } from "./kitchenPartMaterial";
import { acquireKitchenMaterialTextures } from "./kitchenMaterialTextures";

import { KitchenApplianceBody } from "./KitchenCabinetBody";
import type { KitchenMaterialDefinition } from "@/lib/kitchenMaterials";

type Props = {
  cabinet: ModularCabinet;
  variant?: KitchenCatalogVariant;
  open?: boolean;
  selected?: boolean;
  materialDefinitions?: Record<string, KitchenMaterialDefinition>;
};
type AssemblyDisplay = {
  key: string;
  root: Group;
  frame: LoadedModel;
  motions: KitchenPartMotion[];
};

function assetUrl(modelId: string, file: string) {
  return `/api/models/files/${encodeURIComponent(modelId)}/${file.split("/").map(encodeURIComponent).join("/")}`;
}

function AssemblyModel({
  cabinet,
  variant,
  assembly,
  materialDefinitions,
  open = false,
  selected = false,
}: Props & { variant: KitchenCatalogVariant; assembly: KitchenGlbAssembly }) {
  const { gl, invalidate } = useThree();
  const [display, setDisplay] = useState<AssemblyDisplay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const selectionsKey = JSON.stringify(cabinet.partSelections ?? {});
  const key = `${variant.furnitureModelId}:${variant.glbFile}:${JSON.stringify(assembly)}:${selectionsKey}:${JSON.stringify(materialDefinitions)}:${cabinet.width}:${cabinet.height}:${cabinet.depth}`;

  useEffect(() => {
    let cancelled = false;
    const releases: (() => void)[] = [];
    const clones: LoadedModel[] = [];
    setError(null);
    setDisplay(null);
    async function load(modelId: string, file: string) {
      const lease = acquireModel(gl, assetUrl(modelId, file), {
        preserveHierarchy: true,
      });
      releases.push(lease.release);
      const model = await lease.promise;
      if (cancelled) return null;
      const cloned = cloneModel(model);
      cloned.scene.animations = cloned.animations ?? [];
      clones.push(cloned);
      return cloned;
    }
    const selections = JSON.parse(selectionsKey) as Record<string, string>;
    const selectedParts = assembly.slots.map((slot) => ({
      slot,
      option: resolveKitchenPartOption(slot, selections),
    }));
    // Removing a door also removes its dependent handle, without fetching that handle.
    const byId = new Map(selectedParts.map((item) => [item.slot.id, item]));
    const visible = (item: (typeof selectedParts)[number]): boolean =>
      Boolean(item.option) &&
      (!item.slot.parentSlotId || visible(byId.get(item.slot.parentSlotId)!));
    void (async () => {
      try {
        const [frame, entries] = await Promise.all([
          load(variant.furnitureModelId, variant.glbFile!),
          Promise.all(
            selectedParts.filter(visible).map(async ({ slot, option }) => {
              const part = option as KitchenGlbOption;
              if (!part.glbFile)
                throw new Error(
                  `${slot.label}: сонгосон 3D файл бэлэн болоогүй байна.`,
                );
              const model = await load(part.modelId, part.glbFile);
              if (model && part.materialId) {
                const material = materialDefinitions?.[part.materialId];
                if (!material)
                  throw new Error(`${slot.label}: материал олдсонгүй.`);
                const lease = acquireKitchenMaterialTextures(
                  material.texturePaths,
                );
                releases.push(lease.release);
                const textures = await lease.promise;
                if (cancelled) return [slot.id, null] as const;
                if (
                  Object.keys(material.texturePaths).some(
                    (kind) => !textures[kind as keyof typeof textures],
                  )
                )
                  throw new Error(`${slot.label}: texture ачаалж чадсангүй.`);
                releases.push(
                  applyKitchenPartMaterial(model.scene, material, textures),
                );
              }
              return [slot.id, model] as const;
            }),
          ),
        ]);
        if (cancelled || !frame) return;
        const parts = new Map(
          entries.flatMap(([id, model]) =>
            model ? [[id, model.scene] as const] : [],
          ),
        );
        const placement = modelPlacement(
          frame.bounds,
          {
            w: cabinet.width / 1000,
            h: cabinet.height / 1000,
            d: cabinet.depth / 1000,
          },
          true,
        );
        const result = composeKitchenGlb(
          frame.scene,
          assembly,
          selections,
          parts,
          placement.position,
        );
        setDisplay({ key, frame, ...result });
        invalidate();
      } catch (failure) {
        if (!cancelled)
          setError(
            failure instanceof Error
              ? failure.message
              : "3D файл ачаалж чадсангүй.",
          );
      }
    })();
    return () => {
      cancelled = true;
      clones.forEach(disposeModelClone);
      releases.forEach((release) => release());
    };
    // key includes all immutable assembly and placement inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, invalidate, key, retry]);

  const ready = display?.key === key ? display : null;
  const clip = assembly.openAnimation
    ? ready?.frame.animations?.find(
        (item) => item.name === assembly.openAnimation,
      )
    : undefined;
  useKitchenOpenAnimation(ready?.frame.scene, clip, open, ready?.motions);

  return (
    <group
      userData={{ deliveryPending: !ready, deliveryReady: Boolean(ready) }}
    >
      {ready && <primitive object={ready.root} dispose={null} />}
      {selected && !ready && (
        <Html
          center
          position={[0, cabinet.height / 1000 + 0.06, 0]}
          zIndexRange={[8, 0]}
        >
          {error ? (
            <div
              role="status"
              className="whitespace-nowrap rounded border bg-white px-3 py-2 text-center text-xs shadow-sm"
            >
              <span className="block">{error}</span>
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
              className="whitespace-nowrap rounded-md bg-white/95 px-3 py-2 text-xs shadow-sm"
            >
              3D ачаалж байна…
            </span>
          )}
        </Html>
      )}
    </group>
  );
}

/** Render catalog models only; never invent replacement cabinet geometry. */
export function KitchenCabinetGLB({
  cabinet,
  variant,
  materialDefinitions,
  open = false,
  selected = false,
}: Props) {
  const assembly = useMemo(
    () => getKitchenGlbAssembly(variant?.configuration),
    [variant?.configuration],
  );
  if (!variant?.glbFile)
    return <KitchenApplianceBody cabinet={cabinet} open={open} />;
  if (assembly)
    return (
      <AssemblyModel
        cabinet={cabinet}
        variant={variant}
        assembly={assembly}
        materialDefinitions={materialDefinitions}
        open={open}
        selected={selected}
      />
    );
  const nominal = variant.nominalSizeMm;
  const fitPlannedSize =
    nominal &&
    (nominal.width !== cabinet.width ||
      nominal.height !== cabinet.height ||
      nominal.depth !== cabinet.depth);
  return (
    <group>
      {cabinet.opening === "hood" && (
        <KitchenApplianceBody cabinet={cabinet} open={open} />
      )}
      <GLBFurnitureMesh
        modelId={variant.furnitureModelId}
        basePath={`/api/models/files/${variant.furnitureModelId}`}
        glbFile={variant.glbFile}
        selected={selected}
        showLoadStatus={selected}
        preservePhysicalSize={fitPlannedSize ? false : variant.physicalSize}
        w={cabinet.width / 1000}
        h={cabinet.height / 1000}
        d={cabinet.depth / 1000}
        frontMaterial={
          cabinet.frontMaterialId
            ? materialDefinitions?.[cabinet.frontMaterialId]
            : undefined
        }
        carcassMaterial={
          cabinet.carcassMaterialId
            ? materialDefinitions?.[cabinet.carcassMaterialId]
            : undefined
        }
        open={open}
        openAnimation={
          typeof variant.configuration.openAnimation === "string"
            ? variant.configuration.openAnimation
            : undefined
        }
      />
    </group>
  );
}
