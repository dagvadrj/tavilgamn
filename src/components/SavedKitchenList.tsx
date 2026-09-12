"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useAuth } from "@/store/auth";
import { useKitchens } from "@/store/kitchens";
import { kitchenEnvelope, type SavedKitchen } from "@/lib/kitchenAssembly";
import { cabinetCorners } from "@/lib/kitchenPlacement";

export function SavedKitchenList({ onPlace }: { onPlace?: (kitchen: SavedKitchen) => void }) {
  const user = useAuth(s => s.user), initialized = useAuth(s => s.initialized);
  const { owner, items, loading, loaded, error, refresh, remove } = useKitchens();
  useEffect(() => { if (owner && owner === user?.id && !loaded && !loading && !error) void refresh(); }, [owner, user?.id, loaded, loading, error, refresh]);
  if (!initialized) return <p className="py-4 text-sm" role="status">Бүртгэл шалгаж байна…</p>;
  if (!user) return <p className="py-4 text-sm"><Link className="underline" href="/login?next=%2Faccount%23kitchen-garniture">Нэвтэрч</Link> хадгалсан гарнитураа харна уу.</p>;
  return <div className="space-y-3">
    {loading && <p role="status" className="text-sm">Гарнитуруудыг ачаалж байна…</p>}
    {error && <p role="alert" className="text-sm text-red-700">{error} <button type="button" className="min-h-11 underline" onClick={() => void refresh()}>Дахин оролдох</button></p>}
    {loaded && !items.length && <p className="py-4 text-sm text-[#69756c]">Хадгалсан гарнитур алга. <Link className="underline" href="/kitchen">Гал тогоогоо төлөвлөх</Link></p>}
    {owner === user.id && items.map(item => {
      const bounds = kitchenEnvelope(item.design), pad = 100;
      return <article key={item.id} className="rounded-xl border border-[#cbd3c7] bg-white p-3">
        <svg role="img" aria-label={`${item.name} гарнитурын байрлал`} className="h-28 w-full rounded-lg bg-[#f3f4ee]"
          viewBox={`${bounds.minX - pad} ${bounds.minZ - pad} ${bounds.w * 1000 + pad * 2} ${bounds.d * 1000 + pad * 2}`}>
          {item.design.cabinets.map(c => <polygon key={c.id} points={cabinetCorners(c).map(p => `${p.x},${p.z}`).join(" ")}
            fill={c.color} stroke="#576652" strokeWidth={1} vectorEffect="non-scaling-stroke" fillOpacity={c.type === "wall" ? .65 : 1} />)}
        </svg>
        <h3 className="mt-3 break-words font-medium">{item.name}</h3>
        <p className="mt-1 text-sm text-[#69756c]">{Math.round(bounds.w * 1000)} × {Math.round(bounds.d * 1000)} × {Math.round(bounds.h * 1000)} мм</p>
        <div className="mt-2 flex flex-wrap gap-3 text-sm">
          {onPlace && <button type="button" className="min-h-11 rounded-lg bg-[#293c32] px-3 text-white" onClick={() => onPlace(item)}>Өрөөнд байрлуулах</button>}
          <Link className="inline-flex min-h-11 items-center underline" href={`/kitchen?design=${encodeURIComponent(item.id)}`}>Засах</Link>
          {!onPlace && <Link className="inline-flex min-h-11 items-center underline" href={`/planner?kitchen=${encodeURIComponent(item.id)}`}>Өрөөнд байрлуулах</Link>}
          <button type="button" className="min-h-11 text-red-700 underline" onClick={() => { if (window.confirm(`“${item.name}” гарнитурыг устгах уу? Өрөөнд байрлуулсан хуулбарууд үлдэнэ.`)) void remove(item.id); }}>Устгах</button>
        </div>
      </article>;
    })}
  </div>;
}
