"use client";
import { useMemo, useState } from "react";
import { X } from "lucide-react";
import type { ModularKitchen } from "@/lib/kitchenCabinets";
import { arrangeKitchenCorner } from "@/lib/kitchenCornerLayout";

export function KitchenCornerPanel({ kitchen, disabled, onApply, onClose }: {
  kitchen: ModularKitchen; disabled: boolean; onApply: (next: ModularKitchen) => void; onClose: () => void;
}) {
  const count = kitchen.cabinets.filter(c => c.type === "base").length;
  const [side, setSide] = useState<"left" | "right">(kitchen.cornerPlan?.side ?? "left");
  const [clearanceMm, setClearance] = useState(kitchen.cornerPlan?.clearanceMm ?? 60);
  const [mainCount, setMainCount] = useState(Math.min(Math.max(1, kitchen.cornerPlan?.mainCount ?? Math.ceil(count * .6)), Math.max(1, count - 1)));
  const result = useMemo(() => {
    if (count < 2) return { error: "Булан үүсгэхийн тулд доод талын 2-оос доошгүй шүүгээ нэмээрэй." };
    try { return { kitchen: arrangeKitchenCorner(kitchen, { side, clearanceMm, mainCount }) }; }
    catch (error) { return { error: (error as Error).message }; }
  }, [kitchen, side, clearanceMm, mainCount, count]);
  return <section className="kitchen-selection-panel" data-view="corner" aria-label="Булангийн шийдэл">
    <header className="ksp-header"><h2>L булангийн шийдэл</h2><button type="button" className="ksp-icon-button" aria-label="Булангийн тохиргоог хаах" onClick={onClose}><X size={18} /></button></header>
    <div className="ksp-scroll"><div className="ksp-appearance">
      <p className="ksp-note">Буланд хоосон зай үлдээж, хоёр талаас нь зайны хавтангаар хаана. Тавцан буланг бүхэлд нь бүрхэнэ.</p>
      <div className="ksp-surface-switch" role="group" aria-label="Булангийн тал">
        <button type="button" aria-pressed={side === "left"} onClick={() => setSide("left")}>Зүүн булан</button>
        <button type="button" aria-pressed={side === "right"} onClick={() => setSide("right")}>Баруун булан</button>
      </div>
      <label className="ksp-top-picker">Арын ханын шүүгээний тоо<select aria-label="Арын ханын шүүгээний тоо" value={mainCount} onChange={event => setMainCount(Number(event.target.value))} disabled={disabled || count < 2}>
        {Array.from({ length: Math.max(0, count - 1) }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} шүүгээ · буцах талд {count - i - 1}</option>)}
      </select></label>
      <label className="ksp-top-picker">Хаалга нээгдэх булангийн зай<select aria-label="Булангийн зай мм" value={clearanceMm} onChange={event => setClearance(Number(event.target.value))} disabled={disabled}>
        {[40, 60, 80, 100, 150].map(value => <option key={value} value={value}>{value} мм</option>)}
      </select></label>
      <p className="ksp-note">Одоо байгаа боксуудын хэмжээ, загвар, материал хадгалагдана. Байрлал нь L хэлбэрт шилжиж, дээд шүүгээ ханан дээр дагаж байрлана. Салгасан тавцанг буцааж бокст тааруулна.</p>
      {result.error && <p className="ksp-note" role="alert">{result.error}</p>}
      <button type="button" className="ksp-primary" disabled={disabled || !result.kitchen} onClick={() => { if (result.kitchen) onApply(result.kitchen); }}>L булангаар байрлуулах</button>
    </div></div>
  </section>;
}
