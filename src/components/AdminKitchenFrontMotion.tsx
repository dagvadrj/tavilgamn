"use client";

import { createCabinet } from "@/lib/kitchenCabinets";
import {
  KITCHEN_FRONT_KIND_LABELS,
  type KitchenFrontMotionMap,
  type KitchenFrontOverride,
} from "@/lib/kitchenFrontMotion";
import type {
  KitchenCatalogVariant,
  KitchenModelCandidate,
  KitchenOpening,
} from "@/lib/kitchenModuleCatalog";
import type { KitchenMaterialDefinition } from "@/lib/kitchenMaterials";
import { KitchenCabinetGLB } from "@/three/KitchenCabinetGLB";
import type { KitchenDetectedFront } from "@/three/kitchenDoorMotion";
import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useState } from "react";
import { BoxHelper, type Material, type Object3D } from "three";

const COLORS = {
  door: "#2563eb",
  drawer: "#16a34a",
  fixed: "#9ca3af",
  active: "#f59e0b",
} as const;

/** door·left → door·right → drawer → fixed → door·left */
function nextOverride(front: KitchenDetectedFront): KitchenFrontOverride {
  if (front.kind === "door")
    return front.hinge === "left"
      ? { kind: "door", hinge: "right" }
      : { kind: "drawer" };
  if (front.kind === "drawer") return { kind: "fixed" };
  return { kind: "door", hinge: "left" };
}

function frontLabel(front: KitchenDetectedFront) {
  return front.kind === "door"
    ? `Хаалга · нугас ${front.hinge === "left" ? "зүүн" : "баруун"}`
    : KITCHEN_FRONT_KIND_LABELS[front.kind];
}

function FrontOutlines({
  fronts,
  active,
}: {
  fronts: KitchenDetectedFront[];
  active: string | null;
}) {
  const helpers = useMemo(
    () =>
      fronts.map((front) => {
        const helper = new BoxHelper(
          front.object,
          front.key === active ? COLORS.active : COLORS[front.kind],
        );
        // Outlines must not steal clicks from the fronts behind them.
        helper.raycast = () => {};
        return helper;
      }),
    [fronts, active],
  );
  useEffect(
    () => () =>
      helpers.forEach((helper) => {
        helper.geometry.dispose();
        (helper.material as Material).dispose();
      }),
    [helpers],
  );
  useFrame(() => helpers.forEach((helper) => helper.update()));
  return (
    <>
      {helpers.map((helper, index) => (
        <primitive key={index} object={helper} />
      ))}
    </>
  );
}

export default function AdminKitchenFrontMotion({
  baseModel,
  opening,
  value,
  onChange,
  materials = [],
}: {
  baseModel: KitchenModelCandidate;
  opening: KitchenOpening;
  value: KitchenFrontMotionMap;
  onChange: (value: KitchenFrontMotionMap) => void;
  materials?: KitchenMaterialDefinition[];
}) {
  const [open, setOpen] = useState(false);
  const [fronts, setFronts] = useState<KitchenDetectedFront[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const configuration = useMemo(() => ({ frontMotion: value }), [value]);
  const variant: KitchenCatalogVariant = {
    furnitureModelId: baseModel.id,
    productId: baseModel.productId,
    modelName: baseModel.name,
    variantCode: "PREVIEW",
    opening,
    doorCount: 0,
    drawerCount: 0,
    configuration,
    isDefault: false,
    sortOrder: 0,
    active: true,
    glbFile: baseModel.glbFile ?? null,
    glbUrl: null,
    previewGlbFile: null,
    previewGlbUrl: null,
    thumbnailUrl: null,
    processingStatus: "ready",
    physicalSize: true,
  };
  const cabinet = useMemo(
    () => ({
      ...createCabinet("base", "front-motion-preview"),
      width: baseModel.widthMm,
      height: baseModel.heightMm,
      depth: baseModel.depthMm,
    }),
    [baseModel],
  );
  const materialDefinitions = useMemo(
    () => Object.fromEntries(materials.map((item) => [item.id, item])),
    [materials],
  );
  const moving = opening === "doors" || opening === "drawers";

  function cycle(front: KitchenDetectedFront) {
    setActive(front.key);
    onChange({ ...value, [front.key]: nextOverride(front) });
  }
  function pick(event: ThreeEvent<MouseEvent>) {
    event.stopPropagation();
    for (let node: Object3D | null = event.object; node; node = node.parent) {
      const key = node.userData.kitchenFrontKey;
      if (typeof key !== "string") continue;
      const front = fronts.find((item) => item.key === key);
      if (front) cycle(front);
      return;
    }
  }

  const h = baseModel.heightMm / 1000;
  const distance =
    Math.max(h, baseModel.widthMm / 1000, baseModel.depthMm / 1000) * 1.7;
  return (
    <div
      className="overflow-hidden rounded-lg border border-black/10"
      aria-label="Хаалга, шургуулгын автомат танилт"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 bg-white px-3 py-2 text-xs">
        <strong>Хаалга, шургуулга · автомат танилт</strong>
        <span className="flex gap-1">
          {Object.keys(value).length > 0 && (
            <button
              type="button"
              className="btn-ghost !min-h-8 text-xs"
              onClick={() => {
                setActive(null);
                onChange({});
              }}
            >
              Автомат руу буцаах
            </button>
          )}
          <button
            type="button"
            className="btn-ghost !min-h-8 text-xs"
            aria-pressed={open}
            disabled={!moving}
            onClick={() => setOpen((current) => !current)}
          >
            {open ? "Хаах" : "Нээж шалгах"}
          </button>
        </span>
      </div>
      <div className="h-80 bg-[#f5f6f7]">
        <Canvas
          key={baseModel.id}
          camera={{
            position: [distance * 0.6, h * 0.6 + distance * 0.3, distance],
            fov: 45,
          }}
          dpr={[1, 1.5]}
        >
          <color attach="background" args={["#f5f6f7"]} />
          <ambientLight intensity={1.6} />
          <directionalLight position={[4, 5, 4]} intensity={3} />
          <group onClick={pick}>
            <KitchenCabinetGLB
              cabinet={cabinet}
              variant={variant}
              open={open}
              materialDefinitions={materialDefinitions}
              onFrontsDetected={setFronts}
            />
          </group>
          <FrontOutlines fronts={fronts} active={active} />
          <gridHelper
            args={[Math.max(3, distance * 2), 20, "#ccd0d4", "#e3e5e7"]}
          />
          <OrbitControls target={[0, h / 2, 0]} makeDefault enableDamping />
        </Canvas>
      </div>
      <div className="space-y-2 bg-white px-3 py-2 text-xs">
        {!moving ? (
          <p className="text-black/55">
            Энэ хийцийн хувилбар нээгддэггүй. Хаалга эсвэл шургуулгатай
            хувилбар сонгоно уу.
          </p>
        ) : fronts.length ? (
          <>
            <p className="text-black/55">
              Өнгө: <span style={{ color: COLORS.door }}>■ хаалга</span>{" "}
              <span style={{ color: COLORS.drawer }}>■ шургуулга</span>{" "}
              <span style={{ color: COLORS.fixed }}>■ хөдөлгөөнгүй</span>.
              Буруу танигдсан нүүр дээр дарж солино.
            </p>
            <ol className="grid gap-1 sm:grid-cols-2">
              {fronts.map((front, index) => (
                <li key={front.key}>
                  <button
                    type="button"
                    className="flex w-full items-center justify-between gap-2 rounded-md border border-black/10 px-2 py-1.5 text-left"
                    style={{
                      borderColor:
                        front.key === active ? COLORS.active : undefined,
                    }}
                    onMouseEnter={() => setActive(front.key)}
                    onClick={() => cycle(front)}
                  >
                    <span>
                      <span style={{ color: COLORS[front.kind] }}>■</span>{" "}
                      {index + 1}. {frontLabel(front)}
                    </span>
                    <span className="text-black/45">
                      {front.handles ? `бариул ${front.handles}` : "бариулгүй"}
                      {front.corrected ? " · зассан" : ""}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </>
        ) : (
          <p className="text-black/55">
            Хаалга, шургуулгын нүүр олдсонгүй. GLB-д нүүр тусдаа mesh биш
            (бүгд нэг mesh болж нэгдсэн) байж магадгүй.
          </p>
        )}
      </div>
    </div>
  );
}
