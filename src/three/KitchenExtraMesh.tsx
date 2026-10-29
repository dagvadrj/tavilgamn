"use client";
import type { KitchenExtra } from "@/lib/kitchenExtras";
import { GLBFurnitureMesh } from "./GLBFurnitureMesh";
import {
  pcmallAppliance,
  PCMALL_MODEL_BASE_PATH,
} from "@/lib/pcmallAppliances";
import { Edges } from "@react-three/drei";
export function KitchenExtraMesh({
  extra,
  selected = false,
}: {
  extra: KitchenExtra;
  selected?: boolean;
}) {
  const dimensions = {
    w: extra.width / 1000,
    h: extra.height / 1000,
    d: extra.depth / 1000,
  };
  const imported = extra.model
    ? pcmallAppliance(extra.productId, extra.model)
    : undefined;
  if (extra.planningFurniture) {
    const { w, h, d } = dimensions,
      thickness = 0.035,
      bodyHeight = h - thickness;
    const box = (
      name: string,
      size: [number, number, number],
      at: [number, number, number],
      color: string,
    ) => (
      <mesh key={name} name={name} position={at} castShadow receiveShadow>
        <boxGeometry args={size} />
        <meshStandardMaterial color={color} roughness={0.55} />
        {selected && <Edges color="#0078d4" raycast={() => {}} />}
      </mesh>
    );
    return (
      <group
        name={
          extra.planningFurniture === "island"
            ? "Kitchen-island"
            : "Kitchen-bar"
        }
      >
        {box(
          "Countertop",
          [w, thickness, d],
          [0, h - thickness / 2, 0],
          "#ece7dc",
        )}
        {extra.planningFurniture === "island" ? (
          <>
            {box(
              "Island-body",
              [w - 0.08, bodyHeight - 0.08, d - 0.28],
              [0, 0.08 + (bodyHeight - 0.08) / 2, -0.1],
              extra.color,
            )}
            {box(
              "Island-plinth",
              [w - 0.15, 0.08, d - 0.36],
              [0, 0.04, -0.1],
              "#49443d",
            )}
            {Array.from(
              { length: Math.max(1, Math.round(w / 0.6)) },
              (_, i) => {
                const cells = Math.max(1, Math.round(w / 0.6));
                return box(
                  `Island-front-${i}`,
                  [(w - 0.08) / cells - 0.004, bodyHeight - 0.09, 0.018],
                  [
                    -w / 2 + 0.04 + ((i + 0.5) * (w - 0.08)) / cells,
                    0.08 + (bodyHeight - 0.09) / 2,
                    -d / 2 + 0.031,
                  ],
                  extra.color,
                );
              },
            )}
          </>
        ) : (
          <>
            {box(
              "Bar-left-support",
              [0.035, bodyHeight, d - 0.04],
              [-w / 2 + 0.045, bodyHeight / 2, 0],
              extra.color,
            )}
            {box(
              "Bar-right-support",
              [0.035, bodyHeight, d - 0.04],
              [w / 2 - 0.045, bodyHeight / 2, 0],
              extra.color,
            )}
            {box(
              "Bar-back-rail",
              [w - 0.09, 0.12, 0.035],
              [0, bodyHeight - 0.06, -d / 2 + 0.04],
              extra.color,
            )}
          </>
        )}
      </group>
    );
  }
  return extra.model ? (
    <GLBFurnitureMesh
      modelId={extra.model.id}
      basePath={
        imported
          ? PCMALL_MODEL_BASE_PATH
          : `/api/models/files/${extra.model.id}`
      }
      glbFile={extra.model.file}
      selected={selected}
      preservePhysicalSize={Boolean(imported)}
      strictDimensions={Boolean(imported)}
      showLoadStatus={selected}
      {...dimensions}
    />
  ) : null;
}
