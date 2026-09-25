"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Box, Check, Search } from "lucide-react";
import type { ModularCabinet } from "@/lib/kitchenCabinets";
import {
  similarKitchenVariants,
  type KitchenCatalogModule,
  type KitchenCatalogVariant,
  type KitchenOpening,
} from "@/lib/kitchenModuleCatalog";

const OPENING_LABELS: Record<KitchenOpening, string> = {
  doors: "Хаалгатай",
  drawers: "Шургуулгатай",
  open: "Ил тавиур",
  sink: "Угаалтууртай",
  hob: "Плиткатай",
  oven: "Зуухтай",
  hood: "Утаа сорогчтой",
  refrigerator: "Хөргөгч",
};

function proceduralOpenings(cabinet: ModularCabinet): KitchenOpening[] {
  if (["hood", "refrigerator"].includes(cabinet.opening ?? "")) {
    return [cabinet.opening as KitchenOpening];
  }
  if (cabinet.type === "wall") return ["doors", "open"];
  if (cabinet.type === "tall") {
    return cabinet.width === 600 && cabinet.depth >= 580
      ? ["doors", "open", "oven"]
      : ["doors", "open"];
  }
  const result: KitchenOpening[] = ["doors", "drawers", "open"];
  if (cabinet.width >= 600) result.push("sink", "hob");
  if (cabinet.width === 600 && cabinet.depth >= 580) result.push("oven");
  return result;
}

function CabinetFallback({ opening }: { opening: KitchenOpening }) {
  return (
    <span className={`ksc-fallback ksc-${opening}`} aria-hidden="true">
      <i />
      <i />
      <i />
      <Box size={28} />
    </span>
  );
}

export function KitchenSimilarCabinets({
  cabinet,
  modules,
  disabled,
  onVariant,
  onOpening,
}: {
  cabinet: ModularCabinet;
  modules: KitchenCatalogModule[];
  disabled?: boolean;
  onVariant: (
    module: KitchenCatalogModule,
    variant: KitchenCatalogVariant,
  ) => void;
  onOpening: (opening: KitchenOpening) => void;
}) {
  const [query, setQuery] = useState("");
  const candidates = useMemo(
    () => similarKitchenVariants(modules, cabinet),
    [cabinet, modules],
  );
  const normalizedQuery = query.trim().toLocaleLowerCase("mn");
  const visibleCandidates = normalizedQuery
    ? candidates.filter(({ module, variant }) =>
        `${module.name} ${module.code} ${variant.modelName} ${variant.variantCode} ${OPENING_LABELS[variant.opening]}`
          .toLocaleLowerCase("mn")
          .includes(normalizedQuery),
      )
    : candidates;
  const fallback = proceduralOpenings(cabinet).filter(
    (opening) =>
      !normalizedQuery ||
      OPENING_LABELS[opening].toLocaleLowerCase("mn").includes(normalizedQuery),
  );

  return (
    <section
      className="kp-panel ksc-panel"
      aria-labelledby="similar-cabinets-title"
    >
      <div className="ksc-heading">
        <div>
          <p>СОНГОСОН ШҮҮГЭЭТЭЙ ТӨСТЭЙ</p>
          <h2 id="similar-cabinets-title">Шүүгээний загвар солих</h2>
        </div>
        <span>{candidates.length || fallback.length} сонголт</span>
      </div>
      <label className="ksc-search">
        <Search size={17} />
        <span className="sr-only">Төстэй шүүгээ хайх</span>
        <input
          type="search"
          value={query}
          placeholder="Загвар, кодоор хайх"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      <div className="ksc-list">
        {visibleCandidates.map(({ module, variant }) => {
          const current = cabinet.variantId === variant.furnitureModelId;
          return (
            <button
              type="button"
              key={variant.furnitureModelId}
              className={current ? "is-current" : ""}
              disabled={disabled || current}
              aria-pressed={current}
              onClick={() => onVariant(module, variant)}
            >
              <span className="ksc-image">
                {variant.thumbnailUrl ? (
                  <Image src={variant.thumbnailUrl} alt="" fill sizes="92px" />
                ) : (
                  <CabinetFallback opening={variant.opening} />
                )}
              </span>
              <span className="ksc-copy">
                <strong>{variant.modelName}</strong>
                <small>
                  {module.name} · {OPENING_LABELS[variant.opening]}
                </small>
                <small>
                  {module.widthMm} × {module.heightMm} × {module.depthMm} мм
                </small>
              </span>
              {current ? (
                <span className="ksc-current">
                  <Check size={15} /> Одоогийн
                </span>
              ) : (
                <span className="ksc-replace">Солих</span>
              )}
            </button>
          );
        })}
        {!candidates.length &&
          fallback.map((opening) => {
            const current = (cabinet.opening ?? "doors") === opening;
            return (
              <button
                type="button"
                key={opening}
                className={current ? "is-current" : ""}
                disabled={disabled || current}
                aria-pressed={current}
                onClick={() => onOpening(opening)}
              >
                <CabinetFallback opening={opening} />
                <span className="ksc-copy">
                  <strong>{OPENING_LABELS[opening]}</strong>
                  <small>Стандарт {cabinet.width} мм загвар</small>
                  <small>
                    {cabinet.width} × {cabinet.height} × {cabinet.depth} мм
                  </small>
                </span>
                {current ? (
                  <span className="ksc-current">
                    <Check size={15} /> Одоогийн
                  </span>
                ) : (
                  <span className="ksc-replace">Солих</span>
                )}
              </button>
            );
          })}
        {!visibleCandidates.length &&
          (candidates.length > 0 || !fallback.length) && (
            <p className="ksc-empty">Энэ хайлтад тохирох шүүгээ олдсонгүй.</p>
          )}
      </div>
    </section>
  );
}
