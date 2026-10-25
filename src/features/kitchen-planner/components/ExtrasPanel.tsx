"use client";
import { PageSkeleton } from "@/components/PageSkeleton";
import { useState } from "react";
import Image from "next/image";
import type { Product } from "@/lib/types";
import { EXTRA_CATEGORIES, type KitchenExtra } from "@/lib/kitchenExtras";
import { DimensionInput } from "./PlannerPanels";
import { PcmallApplianceLibrary } from "./PcmallApplianceLibrary";
import {
  assetGroup,
  kitchenAsset,
  KITCHEN_ASSET_GROUPS,
  KITCHEN_ASSET_TYPES,
} from "@/lib/kitchenAssetCatalog";
export function ExtrasPanel({
  initialTab = "dining",
  products,
  selected,
  room,
  disabled,
  error,
  loading,
  onAdd,
  onChange,
  onDelete,
  onDuplicate,
  onFocus,
}: {
  initialTab?: "dining" | "extra" | "appliances";
  products: Product[];
  selected?: KitchenExtra;
  room: { width: number; depth: number; height: number };
  disabled: boolean;
  error: string | null;
  loading: boolean;
  onAdd: (product: Product) => void;
  onChange: (extra: KitchenExtra) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onFocus?: () => void;
}) {
  const [tab, setTab] = useState<string>(initialTab),
    [query, setQuery] = useState("");
  const options = products.filter(
    (p) =>
      Boolean(p.model) &&
      EXTRA_CATEGORIES.includes(p.category) &&
      (kitchenAsset(p.specifications)
        ? tab === "extra"
          ? ["extras", "water"].includes(
              assetGroup(kitchenAsset(p.specifications)!),
            )
          : assetGroup(kitchenAsset(p.specifications)!) === tab
        : tab === "dining" && ["dining-table", "chair"].includes(p.category)) &&
      p.name.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section
      className="kp-panel studio-extras-panel"
      aria-label="Dining болон нэмэлт тавилга"
    >
      {selected ? (
        <fieldset disabled={disabled} className="km-fields">
          <h2>{selected.name}</h2>
          {onFocus && <button type="button" onClick={onFocus}>Төхөөрөмж рүү ойртуулах</button>}
          <p>
            {selected.width} × {selected.height} × {selected.depth} мм
          </p>
          {selected.asset && (
            <DimensionInput
              label="Шалнаас өндөр (Y) · мм"
              value={selected.position.y}
              min={0}
              max={room.height - selected.height}
              onCommit={(y) =>
                onChange({ ...selected, position: { ...selected.position, y } })
              }
            />
          )}
          <DimensionInput
            label="Нэмэлт тавилгын X"
            value={selected.position.x}
            min={0}
            max={room.width}
            onCommit={(x) =>
              onChange({ ...selected, position: { ...selected.position, x } })
            }
          />
          <DimensionInput
            label="Нэмэлт тавилгын Z"
            value={selected.position.z}
            min={0}
            max={room.depth}
            onCommit={(z) =>
              onChange({ ...selected, position: { ...selected.position, z } })
            }
          />
          <button
            type="button"
            onClick={() =>
              onChange({
                ...selected,
                position: {
                  ...selected.position,
                  rotation: selected.position.rotation + Math.PI / 2,
                },
              })
            }
          >
            Нэмэлт тавилгыг 90° эргүүлэх
          </button>
          {selected.model ? (
            <p>GLB-ийн эх материал, өнгийг хадгална.</p>
          ) : (
            <>
              <label>
                Нэмэлт тавилгын өнгө{" "}
                <input
                  aria-label="Нэмэлт тавилгын өнгө"
                  type="color"
                  value={selected.color}
                  onChange={(e) =>
                    onChange({ ...selected, color: e.target.value })
                  }
                />
              </label>
              <label>
                Нэмэлт тавилгын материал{" "}
                <select
                  value={selected.material}
                  onChange={(e) =>
                    onChange({
                      ...selected,
                      material: e.target.value as KitchenExtra["material"],
                    })
                  }
                >
                  {(
                    ["wood", "metal", "fabric", "leather", "velvet"] as const
                  ).map((material) => (
                    <option key={material} value={material}>
                      {material}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <button type="button" onClick={onDuplicate}>
            Нэмэлт тавилгыг хувилах
          </button>
          <button type="button" onClick={onDelete}>
            Нэмэлт тавилгыг устгах
          </button>
        </fieldset>
      ) : (
        <>
          <h2>Гал тогооны хэрэгслийн сан</h2>
          <p>Гал тогоонд зориулж нэмсэн төхөөрөмж, гэрэл, тавилга.</p>
          <div
            className="studio-extras-tabs"
            role="group"
            aria-label="Нэмэлт каталогийн төрөл"
          >
            {(["appliances", "water", "extras", "dining"] as const).map(
              (id) => (
                <button
                  type="button"
                  key={id}
                  aria-pressed={
                    tab === id || (tab === "extra" && id === "extras")
                  }
                  onClick={() => setTab(id)}
                >
                  {KITCHEN_ASSET_GROUPS[id]}
                </button>
              ),
            )}
          </div>
          <label className="kp-field">
            {tab === "appliances" ? "Төхөөрөмж хайх" : "Тавилга хайх"}{" "}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {tab === "appliances" && <PcmallApplianceLibrary disabled={disabled} onAdd={onAdd} query={query} />}
          {error ? (
            <p role="alert">{error}</p>
          ) : loading ? (
            !options.length && <PageSkeleton compact layout="rows" label="Каталог ачаалж байна…" />
          ) : !options.length && tab !== "appliances" ? (
            <p>Энэ төрөлд 3D загвартай бүтээгдэхүүн олдсонгүй.</p>
          ) : null}
          <div className="km-extras-list">
            {options.map((product) => (
              <button
                type="button"
                key={product.id}
                disabled={
                  disabled ||
                  kitchenAsset(product.specifications)?.installation ===
                    "integrated" ||
                  kitchenAsset(product.specifications)?.placement === "cabinet"
                }
                aria-label={`Нэмэх: ${product.name}`}
                onClick={() => onAdd(product)}
              >
                <Image src={product.image} alt="" width={76} height={56} />
                <span>
                  {product.name}
                  {kitchenAsset(product.specifications) && (
                    <small>
                      {
                        KITCHEN_ASSET_TYPES[
                          kitchenAsset(product.specifications)!.type
                        ].label
                      }
                      {kitchenAsset(product.specifications)!.installation ===
                        "integrated" ||
                      kitchenAsset(product.specifications)!.placement ===
                        "cabinet"
                        ? " · Шүүгээний эд ангиар сонгоно"
                        : ""}
                    </small>
                  )}
                  <small>
                    {Math.round(product.dimensions.w * 1000)} ×{" "}
                    {Math.round(product.dimensions.d * 1000)} мм
                  </small>
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
