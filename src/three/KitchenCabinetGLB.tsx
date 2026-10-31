"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Edges, Html } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { type Group } from "three";
import type { ModularCabinet } from "@/lib/kitchenCabinets";
import { kitchenVariantFits, type KitchenCatalogVariant } from "@/lib/kitchenModuleCatalog";
import { getKitchenGlbAssembly, resolveKitchenPartOption, type KitchenGlbAssembly, type KitchenGlbOption } from "@/lib/kitchenGlbAssembly";
import { modelPlacement, modelSizeIssue } from "@/lib/modelPlacement";
import { GLBFurnitureMesh } from "./GLBFurnitureMesh";
import type { KitchenDetectedFront } from "./kitchenDoorMotion";
import { parseKitchenFrontMotion, parseKitchenFrontSlab } from "@/lib/kitchenFrontMotion";
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

import { KitchenCatalogAppliance } from "./KitchenCatalogAppliance";
import { CabinetBody } from "./KitchenCabinetBody";
import { cabinetToe } from "@/lib/kitchenPanels";
import { placeholderFronts } from "@/lib/kitchenPlaceholderFronts";
import type { KitchenMaterialDefinition } from "@/lib/kitchenMaterials";
import { resolveKitchenPaintMaterial } from "@/lib/kitchenPaint";
import { kitchenRetrySubscriber, useKitchenAppearanceStatus } from "@/store/kitchenAppearanceStatus";
import { SWAP_DIM_OPACITY, setModelOpacity } from "./FurnitureLoadState";

type Props = {
  cabinet: ModularCabinet;
  variant?: KitchenCatalogVariant;
  open?: boolean;
  selected?: boolean;
  materialDefinitions?: Record<string, KitchenMaterialDefinition>;
  /** Admin preview: receives the fronts detected in a fully assembled GLB. */
  onFrontsDetected?: (fronts: KitchenDetectedFront[]) => void;
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
  const retrySignal = useKitchenAppearanceStatus((state) => state.retries[cabinet.id] ?? 0);
  // K4: the last correct model stays until its replacement is ready, so its
  // resources are released when replaced or unmounted, not on every change.
  const owned = useRef<{ display: AssemblyDisplay; dispose: () => void } | null>(null);
  useEffect(
    () => () => {
      owned.current?.dispose();
      owned.current = null;
    },
    [],
  );
  const selectionsKey = JSON.stringify(cabinet.partSelections ?? {});
  const key = `${variant.furnitureModelId}:${variant.glbFile}:${JSON.stringify(assembly)}:${selectionsKey}:${JSON.stringify(materialDefinitions)}:${JSON.stringify([frontMaterial, carcassMaterial])}:${cabinet.width}:${cabinet.height}:${cabinet.depth}`;

  useEffect(() => {
    let cancelled = false;
    let adopted = false;
    const releases: (() => void)[] = [];
    const clones: LoadedModel[] = [];
    const dispose = () => {
      clones.forEach(disposeModelClone);
      releases.forEach((release) => release());
    };
    setError(null);
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
        const next = { key, frame, ...result };
        const previous = owned.current;
        owned.current = { display: next, dispose };
        adopted = true;
        setDisplay(next);
        previous?.dispose();
        useKitchenAppearanceStatus.getState().ready(cabinet.id);
        invalidate();
      } catch (failure) {
        if (cancelled) return;
        setError(
          failure instanceof Error
            ? failure.message
            : "3D файл ачаалж чадсангүй.",
        );
        // With a previous model on screen this is a failed material swap.
        useKitchenAppearanceStatus.getState().fail(cabinet.id);
        invalidate();
      }
    })();
    return () => {
      cancelled = true;
      if (!adopted) dispose();
    };
    // key includes all immutable assembly and placement inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, invalidate, key, retry, retrySignal]);

  const ready = display?.key === key ? display : null;
  const pending = !!display && !ready && !error;
  useEffect(() => {
    if (!display) return;
    setModelOpacity(display.root, pending ? SWAP_DIM_OPACITY : null);
    invalidate();
  }, [display, pending, invalidate]);
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
      {display && <primitive object={display.root} dispose={null} />}
      {selected && !display && (
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

/** Front thickness of the placeholder; enough to cast a gap shadow between fronts. */
const PLACEHOLDER_FRONT_DEPTH = 0.018;

/**
 * A cabinet without a catalog model: a matte grey box with its door and drawer
 * split, so the kitchen reads as furniture rather than empty outlines. The grey
 * keeps it apart from real finishes; it is never exported as delivered.
 */
export function MissingKitchenModel({ cabinet, selected }: Props) {
  const w = cabinet.width / 1000, h = cabinet.height / 1000, d = cabinet.depth / 1000;
  const toe = cabinetToe(cabinet) / 1000;
  const fronts = placeholderFronts(cabinet);
  const body = d - (fronts.length ? PLACEHOLDER_FRONT_DEPTH : 0);
  return <group userData={{ deliveryPending: true, deliveryReady: false, missingCatalogModel: true }}>
    <mesh position={[0, toe + (h - toe) / 2, -d / 2 + body / 2]} castShadow receiveShadow>
      <boxGeometry args={[w, h - toe, body]} />
      <meshStandardMaterial color="#d5d9de" roughness={0.85} />
      <Edges color={selected ? "#2563eb" : "#a3abb5"} threshold={20} />
    </mesh>
    {toe > 0 && <mesh position={[0, toe / 2, -0.03]} receiveShadow>
      <boxGeometry args={[w, toe, d - 0.06]} />
      <meshStandardMaterial color="#8d949c" roughness={0.9} />
    </mesh>}
    {fronts.map((front, index) => <mesh key={index} castShadow receiveShadow
      position={[(front.x + front.width / 2) / 1000 - w / 2, (front.y + front.height / 2) / 1000, d / 2 - PLACEHOLDER_FRONT_DEPTH / 2]}>
      <boxGeometry args={[front.width / 1000, front.height / 1000, PLACEHOLDER_FRONT_DEPTH]} />
      <meshStandardMaterial color={front.kind === "drawer" ? "#e6e9ec" : "#eceef1"} roughness={0.7} />
      <Edges color="#a3abb5" threshold={20} />
    </mesh>)}
    {selected && <Html center position={[0, cabinet.height / 1000 + .06, 0]} zIndexRange={[8, 0]}>
      <span role="status" className="whitespace-nowrap rounded-md bg-white/95 px-3 py-2 text-xs shadow-sm">Тохирох 3D загвар бэлэн биш · Солих цэснээс сонгоорой</span>
    </Html>}
  </group>;
}

/** Only render the model of the selected product at its catalog dimensions. */
export function KitchenCabinetGLB({ cabinet, variant: candidate, materialDefinitions, open = false, selected = false, onFrontsDetected }: Props) {
  const variant = kitchenVariantFits(candidate, cabinet) ? candidate : undefined;
  const assembly = useMemo(() => getKitchenGlbAssembly(variant?.configuration), [variant?.configuration]);
  const frontMotion = useMemo(() => parseKitchenFrontMotion(variant?.configuration.frontMotion), [variant?.configuration]);
  const frontSlabMm = parseKitchenFrontSlab(variant?.configuration.frontSlabMm);
  const frontHandleMm = parseKitchenFrontSlab(variant?.configuration.frontHandleMm, 1);
  const frontMaterial = useMemo(() => resolveKitchenPaintMaterial(cabinet.frontMaterialId, materialDefinitions), [cabinet.frontMaterialId, materialDefinitions]);
  const carcassMaterial = useMemo(() => resolveKitchenPaintMaterial(cabinet.carcassMaterialId, materialDefinitions), [cabinet.carcassMaterialId, materialDefinitions]);
  if (cabinet.catalogHousing === 'oven-tower') return <CabinetBody cabinet={cabinet} open={open} materialDefinitions={materialDefinitions} catalogAppliances />;
  if (cabinet.catalogHousing === 'fridge-integrated') return <CabinetBody cabinet={{ ...cabinet, opening: 'doors', components: undefined }} open={open} materialDefinitions={materialDefinitions} />;
  if (!variant?.glbFile) return ["hood", "oven", "refrigerator"].includes(cabinet.opening ?? "")
    ? <KitchenCatalogAppliance cabinet={cabinet} /> : <MissingKitchenModel cabinet={cabinet} selected={selected} />;
  // An authored GLB without extra parts keeps its own detected door motion.
  if (assembly?.slots.length) return <AssemblyModel cabinet={cabinet} variant={variant} assembly={assembly} materialDefinitions={materialDefinitions} frontMaterial={frontMaterial} carcassMaterial={carcassMaterial} open={open} selected={selected} />;
  return <group>
    {(cabinet.opening === "hood" || cabinet.catalogAdaptation === "oven") && <KitchenCatalogAppliance cabinet={cabinet} />}
    <GLBFurnitureMesh modelId={variant.furnitureModelId} basePath={`/api/models/files/${variant.furnitureModelId}`}
    glbFile={variant.glbFile} selected={selected} showLoadStatus={selected}
    frontMaterial={frontMaterial}
    carcassMaterial={carcassMaterial}
    retainWhilePending
    retrySubscribe={kitchenRetrySubscriber(cabinet.id)}
    onReady={() => useKitchenAppearanceStatus.getState().ready(cabinet.id)}
    onError={() => useKitchenAppearanceStatus.getState().fail(cabinet.id)}
    preserveHierarchy preservePhysicalSize strictDimensions frontProjectionMm={variant.frontProjectionMm} w={cabinet.width / 1000} h={cabinet.height / 1000} d={cabinet.depth / 1000}
    cabinetAdaptation={cabinet.catalogAdaptation}
    open={open} frontMotion={frontMotion} frontSlabMm={frontSlabMm} frontHandleMm={frontHandleMm} onFrontsDetected={onFrontsDetected} cabinetOpening={cabinet.catalogAdaptation === 'oven' ? undefined : cabinet.catalogAdaptation === 'sink' ? 'doors' : variant.opening === "doors" || variant.opening === "drawers" ? variant.opening : undefined}
    openAnimation={typeof variant.configuration.openAnimation === "string" ? variant.configuration.openAnimation : undefined} />
  </group>;
}
