"use client";

import { useMemo, useState } from "react";
import { Search, Box } from "lucide-react";
import { PlannerModelCard } from "@/features/planner/components/PlannerModelCard";
import type { KitchenCatalogModule, KitchenCatalogVariant } from "@/lib/kitchenModuleCatalog";
import { prefetchModel } from "@/lib/modelPrefetch";

const TYPES = { base: "Доод", wall: "Дээд", tall: "Өндөр", corner: "Булан", appliance: "Төхөөрөмж" };

export function KitchenModelLibrary({ modules, loading, error, retry, disabled, onAdd }: {
  modules: KitchenCatalogModule[]; loading: boolean; error: boolean; retry: () => void;
  disabled: boolean; onAdd: (module: KitchenCatalogModule, variant: KitchenCatalogVariant) => void;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const models = useMemo(() => modules.filter(module => module.active && module.cabinetType !== "appliance")
    .flatMap(module => module.variants.filter(variant => variant.active && variant.glbFile)
      .map(variant => ({ module, variant }))), [modules]);
  const filtered = models.filter(({ module, variant }) => (type === "all" || module.cabinetType === type) &&
    `${module.name} ${module.code} ${variant.modelName} ${variant.glbFile}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <section className="planner-model-library" data-inspector-section="catalog">
    <div className="planner-inspector-intro"><Box size={20}/><h2>3D загварын сан</h2>
      <p>Зураг дээр дарж гарнитуртаа нэмээрэй. Хэмжээг өргөн × гүн × өндөр гэсэн дарааллаар харуулсан.</p>
    </div>
    <label className="planner-search"><Search size={17}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Шүүгээний нэрээр хайх…" aria-label="Шүүгээний загвар хайх"/></label>
    <div className="planner-filter-pills" aria-label="3D загварын төрөл">
      <button type="button" aria-pressed={type === "all"} onClick={() => setType("all")}>Бүгд · {models.length}</button>
      {Object.entries(TYPES).filter(([id]) => models.some(item => item.module.cabinetType === id)).map(([id, label]) =>
        <button type="button" key={id} aria-pressed={type === id} onClick={() => setType(id)}>{label}</button>)}
    </div>
    {loading && <p className="planner-empty" role="status">3D загваруудыг ачаалж байна…</p>}
    {error && <div className="planner-empty" role="alert"><p>3D загварын санг ачаалж чадсангүй.</p><button type="button" className="planner-secondary-button" onClick={retry}>Дахин оролдох</button></div>}
    {!loading && !error && !filtered.length && <p className="planner-empty">{models.length ? "Хайлтад тохирох загвар олдсонгүй." : "Одоогоор бэлэн 3D загвар алга. Бэлэн шүүгээ табаас сонгож болно."}</p>}
    {!loading && !error && models.length > 0 && <div className="kitchen-result-count"><span>{filtered.length} загвар</span>{(query || type !== "all") && <button type="button" onClick={() => { setQuery(""); setType("all"); }}>Шүүлтүүр арилгах</button>}</div>}
    <div className="planner-model-grid">{filtered.map(({ module, variant }) =>
      <PlannerModelCard key={variant.furnitureModelId} name={variant.modelName || module.name}
        image={variant.thumbnailUrl} dimensions={`${module.widthMm} × ${module.depthMm} × ${module.heightMm} мм`}
        file={variant.glbFile!} showFile={false} actionLabel="гарнитурт нэмэх" disabled={disabled} onAdd={() => onAdd(module, variant)}
        onPrefetch={() => { const url = variant.previewGlbUrl ?? variant.glbUrl; if (url) void prefetchModel(url); }}/>
    )}</div>
  </section>;
}
