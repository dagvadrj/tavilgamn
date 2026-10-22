"use client";
import { PageSkeleton } from "@/components/PageSkeleton";

import { useEffect, useMemo, useRef, useState } from "react";
import { Box, Search } from "lucide-react";
import { PlannerModelCard } from "@/features/planner/components/PlannerModelCard";
import type {
  KitchenCatalogModule,
  KitchenCatalogVariant,
} from "@/lib/kitchenModuleCatalog";
import { prefetchModel } from "@/lib/modelPrefetch";

import {
  PlannerCatalogToolbar,
  sortPlannerCatalog,
  type PlannerCatalogSort,
} from "@/features/planner/components/PlannerCatalogToolbar";

const TYPES = {
  base: "Доод",
  wall: "Дээд",
  tall: "Өндөр",
  corner: "Булан",
  appliance: "Төхөөрөмж",
};

export function KitchenModelLibrary({
  modules,
  loading,
  error,
  retry,
  disabled,
  onAdd,
  category = "all",
  searchRequest = 0,
}: {
  category?: "all" | "appliances";
  searchRequest?: number;
  modules: KitchenCatalogModule[];
  loading: boolean;
  error: boolean;
  retry: () => void;
  disabled: boolean;
  onAdd: (module: KitchenCatalogModule, variant: KitchenCatalogVariant) => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (searchRequest) searchRef.current?.focus();
  }, [searchRequest]);
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const models = useMemo(() => modules.filter(module => module.active)
    .flatMap(module => module.variants.filter(variant => variant.active && variant.glbFile)
      .filter(variant => category !== "appliances" || module.cabinetType === "appliance" || ["oven", "hob", "hood", "refrigerator", "sink"].includes(variant.opening))
      .map(variant => ({ module, variant }))), [modules, category]);
  const filtered = models.filter(({ module, variant }) => (type === "all" || module.cabinetType === type) &&
    `${module.name} ${module.code} ${variant.modelName} ${variant.glbFile}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <section className="planner-model-library" data-inspector-section="catalog">
    <div className="planner-inspector-intro"><Box size={20}/><h2>3D загварын сан</h2>
      <p>Доод, дээд, өндөр шүүгээг төрлөөр нь сонгоорой. Дээд шүүгээ хананд, доод шүүгээ шалан дээр байрлана.</p>
    </div>
    <label className="planner-search"><Search size={17}/><input ref={searchRef} value={query} onChange={e => setQuery(e.target.value)} placeholder="Шүүгээний нэрээр хайх…" aria-label="Шүүгээний загвар хайх"/></label>
    <div className="planner-filter-pills" aria-label="3D загварын төрөл">
      <button type="button" aria-pressed={type === "all"} onClick={() => setType("all")}>Бүгд · {models.length}</button>
      {Object.entries(TYPES).filter(([id]) => models.some(item => item.module.cabinetType === id)).map(([id, label]) =>
        <button type="button" key={id} aria-pressed={type === id} onClick={() => setType(id)}>{label}</button>)}
    </div>
    {loading && <p className="planner-empty" role="status">3D загваруудыг ачаалж байна…</p>}
    {error && <div className="planner-empty" role="alert"><p>3D загварын санг ачаалж чадсангүй.</p><button type="button" className="planner-secondary-button" onClick={retry}>Дахин оролдох</button></div>}
    {!loading && !error && !filtered.length && <p className="planner-empty">{models.length ? "Хайлтад тохирох загвар олдсонгүй." : "Одоогоор энэ ангилалд GLB загвар алга. Админаас оруулсан загварууд энд харагдана."}</p>}
    {!loading && !error && models.length > 0 && <div className="kitchen-result-count"><span>{filtered.length} загвар</span>{(query || type !== "all") && <button type="button" onClick={() => { setQuery(""); setType("all"); }}>Шүүлтүүр арилгах</button>}</div>}
    <div className="planner-model-grid">{filtered.map(({ module, variant }) =>
      <PlannerModelCard key={variant.furnitureModelId} name={variant.modelName || module.name}
        detail={variant.assetValidationIssues?.length ? "3D файлын хэмжээ, байрлалыг засах шаардлагатай" : `${TYPES[module.cabinetType]} · ${module.cabinetType === "wall" ? "Хананд, тавцангийн дээр" : module.cabinetType === "appliance" ? "Төхөөрөмж" : "Шалан дээр"}`}
        image={variant.thumbnailUrl} dimensions={`${module.widthMm} × ${module.depthMm} × ${module.heightMm} мм`}
        file={variant.glbFile!} showFile={false} actionLabel="гарнитурт нэмэх" disabled={disabled || Boolean(variant.assetValidationIssues?.length)} onAdd={() => onAdd(module, variant)}
        onPrefetch={() => { const url = variant.previewGlbUrl ?? variant.glbUrl; if (url) void prefetchModel(url); }}/>
    )}</div>
  </section>;
}
