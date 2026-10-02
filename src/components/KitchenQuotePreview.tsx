"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { parseKitchen } from "@/lib/kitchenAssembly";
import type { ModularKitchen } from "@/lib/kitchenCabinets";
import { buildKitchenBom } from "@/lib/kitchenBom";
import { Plan } from "@/features/kitchen-planner/components/PlannerPanels";
import { useKitchenCatalog } from "@/features/kitchen-planner/hooks/useKitchenCatalog";

const Scene = dynamic(() => import("@/three/ModularKitchenScene").then(module => module.ModularKitchenScene), { ssr: false });
const noop = () => {};
export function KitchenQuotePreview({ owner, quoteId }: { owner: string; quoteId: string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<{ name: string; design: ModularKitchen } | null>(null);
  const [error, setError] = useState("");
  const { moduleCatalog, materialCatalog } = useKitchenCatalog(open);
  const variants = useMemo(() => Object.fromEntries(moduleCatalog.flatMap(module => module.variants.map(variant => [variant.furnitureModelId, variant]))), [moduleCatalog]);
  const materials = useMemo(() => Object.fromEntries(materialCatalog.map(material => [material.id, material])), [materialCatalog]);
  const bom = useMemo(() => data ? buildKitchenBom(data.design, moduleCatalog, []) : null, [data, moduleCatalog]);
  useEffect(() => {
    if (!open) return;
    const previewDialog = dialog.current;
    previewDialog?.showModal();
    const controller = new AbortController(); setData(null); setError("");
    void authFetch(`/api/merchant/kitchen-quotes/${quoteId}/project`, { signal: controller.signal }, owner)
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Загвар ачаалагдсангүй.");
        if (!controller.signal.aborted) setData({ name: result.name, design: parseKitchen(result.design) });
      }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : "Загвар ачаалагдсангүй."); });
    return () => { controller.abort(); previewDialog?.close(); };
  }, [open, owner, quoteId]);
  return <>
    <button type="button" className="btn-ghost mb-3" onClick={() => setOpen(true)}>Илгээсэн 3D загвар / материалын жагсаалт</button>
    <dialog ref={dialog} onCancel={() => setOpen(false)} aria-labelledby={`quote-preview-${quoteId}`}
      className="m-auto max-h-[90dvh] w-[min(1000px,95vw)] overflow-y-auto rounded-2xl bg-white p-5 backdrop:bg-black/50">
      <header className="mb-3 flex items-center justify-between gap-3"><h2 id={`quote-preview-${quoteId}`} className="font-semibold">{data?.name ?? "Илгээсэн загвар"}</h2>
        <button type="button" className="btn-ghost" aria-label="Загварын цонх хаах" onClick={() => setOpen(false)}><X size={18} /></button></header>
      <p className="mb-3 text-xs text-black/55">Хүсэлт илгээх үеийн өөрчлөгдөхгүй хувилбар. Энэ нь үйлдвэрлэлийн cut-list биш.</p>
      {error ? <p role="alert">{error}</p> : !data ? <p role="status">Ачаалж байна…</p> : <>
        <div className="h-80 overflow-hidden rounded-xl bg-[#f1efe9]"><Scene kitchen={data.design} selectedId={null} mode="orbit" open
          onSelect={noop} onStart={noop} onMove={noop} onEnd={noop} onCancel={noop} variantModels={variants} materialDefinitions={materials} /></div>
        <p className="my-3 text-sm">Өрөө: {data.design.room.width} × {data.design.room.depth} × {data.design.room.height} мм</p>
        <div className="max-h-96 overflow-auto"><Plan kitchen={data.design} selectedId={null} onSelect={noop} readOnly /></div>
        <div className="mt-4 overflow-x-auto"><table className="w-full text-left text-xs"><thead><tr><th>Бүрдэл</th><th>Тоо</th><th>Хэмжээ</th><th>Материал</th></tr></thead>
          <tbody>{bom?.items.map(item => <tr key={item.id} className="border-t border-black/10"><td className="py-2 pr-3">{item.label}</td><td>{item.quantity} {item.unit}</td><td className="pr-3">{item.dimensions}</td><td>{item.material}</td></tr>)}</tbody></table></div>
      </>}
    </dialog>
  </>;
}
