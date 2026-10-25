"use client";

import { useEffect, useMemo, useState } from "react";
import { Edges, Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { type Group } from "three";
import type { ModularCabinet } from "@/lib/kitchenCabinets";
import { kitchenVariantFits, type KitchenCatalogVariant } from "@/lib/kitchenModuleCatalog";
import { getKitchenGlbAssembly, resolveKitchenPartOption, type KitchenGlbAssembly, type KitchenGlbOption } from "@/lib/kitchenGlbAssembly";
import { modelPlacement, modelSizeIssue } from "@/lib/modelPlacement";
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
import { configureModelTextureSampling } from "./modelTextureSampling";

import { KitchenApplianceBody } from "./KitchenCabinetBody";
import type { KitchenMaterialDefinition } from "@/lib/kitchenMaterials";
import { resolveKitchenPaintMaterial } from "@/lib/kitchenPaint";

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
  frontMaterial,
  carcassMaterial,
  open = false,
  selected = false,
}: Props & { variant: KitchenCatalogVariant; assembly: KitchenGlbAssembly; frontMaterial?: KitchenMaterialDefinition; carcassMaterial?: KitchenMaterialDefinition }) {
  const { gl, invalidate } = useThree();
  const [display, setDisplay] = useState<AssemblyDisplay | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const selectionsKey = JSON.stringify(cabinet.partSelections ?? {});
  const key = `${variant.furnitureModelId}:${variant.glbFile}:${JSON.stringify(assembly)}:${selectionsKey}:${JSON.stringify(materialDefinitions)}:${JSON.stringify([frontMaterial, carcassMaterial])}:${cabinet.width}:${cabinet.height}:${cabinet.depth}`;

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
    async function finish(model: LoadedModel, material: KitchenMaterialDefinition, target?: "front" | "carcass" | "cabinet") {
      const lease = acquireKitchenMaterialTextures(material.texturePaths);
      releases.push(lease.release);
      const textures = await lease.promise;
      if (cancelled) return;
      if (Object.entries(material.texturePaths).some(([kind, value]) => value && !textures[kind as keyof typeof textures]))
        throw new Error("Сонгосон материалын texture ачаалж чадсангүй.");
      releases.push(applyKitchenPartMaterial(model.scene, material, textures, target));
      configureModelTextureSampling(model.scene, gl);
    }
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
              if (model) {
                const override = ["door", "drawer-front"].includes(slot.kind) ? frontMaterial
                  : ["frame", "shelf", "drawer", "cover-panel", "filler"].includes(slot.kind) ? carcassMaterial : undefined;
                const material = override ?? (part.materialId ? materialDefinitions?.[part.materialId] : undefined);
                if (!material && !part.materialId) return [slot.id, model] as const;
                if (!material)
                  throw new Error(`${slot.label}: материал олдсонгүй.`);
                await finish(model, material, override ? "cabinet" : undefined);
                if (cancelled) return [slot.id, null] as const;
              }
              return [slot.id, model] as const;
            }),
          ),
        ]);
        if (cancelled || !frame) return;
        if (carcassMaterial) await finish(frame, carcassMaterial, "carcass");
        if (frontMaterial) await finish(frame, frontMaterial, "front");
        if (cancelled) return;
        const sizeIssue = modelSizeIssue(frame.bounds, { w: cabinet.width / 1000, h: cabinet.height / 1000, d: cabinet.depth / 1000 }, variant.frontProjectionMm);
        if (sizeIssue) throw new Error(sizeIssue);
        const parts = new Map(entries.flatMap(([id, model]) => model ? [[id, model.scene] as const] : []));
        const placement = modelPlacement(frame.bounds, { w: cabinet.width / 1000, h: cabinet.height / 1000, d: cabinet.depth / 1000 }, true);
        const result = composeKitchenGlb(frame.scene, assembly, selections, parts, placement.position);
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

export function MissingKitchenModel({ cabinet, selected }: Props) {
  return <group userData={{ deliveryPending: true, deliveryReady: false, missingCatalogModel: true }}>
    <mesh position={[0, cabinet.height / 2000, 0]}>
      <boxGeometry args={[cabinet.width / 1000, cabinet.height / 1000, cabinet.depth / 1000]} />
      <meshBasicMaterial transparent opacity={0.035} depthWrite={false} color="#64748b" />
      <Edges color={selected ? "#2563eb" : "#94a3b8"} />
    </mesh>
    {selected && <Html center position={[0, cabinet.height / 1000 + .06, 0]} zIndexRange={[8, 0]}>
      <span role="status" className="whitespace-nowrap rounded-md bg-white/95 px-3 py-2 text-xs shadow-sm">Тохирох 3D загвар бэлэн биш · Солих цэснээс сонгоорой</span>
    </Html>}
  </group>;
}

/** Only render the model of the selected product at its catalog dimensions. */
export function KitchenCabinetGLB({ cabinet, variant: candidate, materialDefinitions, open = false, selected = false }: Props) {
  const variant = kitchenVariantFits(candidate, cabinet) ? candidate : undefined;
  const assembly = useMemo(() => getKitchenGlbAssembly(variant?.configuration), [variant?.configuration]);
  const frontMaterial = useMemo(() => resolveKitchenPaintMaterial(cabinet.frontMaterialId, materialDefinitions), [cabinet.frontMaterialId, materialDefinitions]);
  const carcassMaterial = useMemo(() => resolveKitchenPaintMaterial(cabinet.carcassMaterialId, materialDefinitions), [cabinet.carcassMaterialId, materialDefinitions]);
  if (!variant?.glbFile) return ["hood", "oven", "refrigerator"].includes(cabinet.opening ?? "")
    ? <KitchenApplianceBody cabinet={cabinet} open={open} /> : <MissingKitchenModel cabinet={cabinet} selected={selected} />;
  if (assembly) return <AssemblyModel cabinet={cabinet} variant={variant} assembly={assembly} materialDefinitions={materialDefinitions} frontMaterial={frontMaterial} carcassMaterial={carcassMaterial} open={open} selected={selected} />;
  return <group>
    {cabinet.opening === "hood" && <KitchenApplianceBody cabinet={cabinet} open={open} />}
    <GLBFurnitureMesh modelId={variant.furnitureModelId} basePath={`/api/models/files/${variant.furnitureModelId}`}
    glbFile={variant.glbFile} selected={selected} showLoadStatus={selected}
    frontMaterial={frontMaterial}
    carcassMaterial={carcassMaterial}
    preserveHierarchy preservePhysicalSize strictDimensions frontProjectionMm={variant.frontProjectionMm} w={cabinet.width / 1000} h={cabinet.height / 1000} d={cabinet.depth / 1000}
    open={open} cabinetOpening={variant.opening === "doors" || variant.opening === "drawers" ? variant.opening : undefined}
    openAnimation={typeof variant.configuration.openAnimation === "string" ? variant.configuration.openAnimation : undefined} />
  </group>;
}
