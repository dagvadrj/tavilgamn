"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useAuth } from "@/store/auth";
import { useKitchens } from "@/store/kitchens";
import { kitchenEnvelope, type SavedKitchen } from "@/lib/kitchenAssembly";
import { cabinetCorners } from "@/lib/kitchenPlacement";
import { Trash2, ArrowUpRight, Pencil } from "lucide-react";

export function SavedKitchenList({
  onPlace,
  variant = "planner",
}: {
  onPlace?: (kitchen: SavedKitchen) => void;
  variant?: "planner" | "account";
}) {
  const account = variant === "account";
  const user = useAuth((s) => s.user),
    initialized = useAuth((s) => s.initialized);
  const { owner, items, loading, loaded, error, refresh, remove } =
    useKitchens();
  useEffect(() => {
    if (owner && owner === user?.id && !loaded && !loading && !error)
      void refresh();
  }, [owner, user?.id, loaded, loading, error, refresh]);
  if (!initialized)
    return (
      <p className="py-4 text-sm" role="status">
        Бүртгэл шалгаж байна…
      </p>
    );
  if (!user)
    return (
      <p className="py-4 text-sm">
        <Link
          className="underline"
          href="/login?next=%2Faccount%23kitchen-garniture"
        >
          Нэвтэрч
        </Link>{" "}
        хадгалсан гарнитураа харна уу.
      </p>
    );
  return (
    <div className={account ? "account-kitchen-grid" : "space-y-3"}>
      {loading && (
        <p role="status" className="text-sm">
          Гарнитуруудыг ачаалж байна…
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}{" "}
          <button
            type="button"
            className="min-h-11 underline"
            onClick={() => void refresh()}
          >
            Дахин оролдох
          </button>
        </p>
      )}
      {loaded && !items.length && (
        <div className={account ? "account-empty col-span-full" : "py-4 text-sm text-[#52525b]"}>
          <p>
          Хадгалсан гарнитур алга.{" "}
          </p>
          <Link className={account ? "account-button" : "underline"} href="/kitchen">
            Гал тогоогоо төлөвлөх
          </Link>
        </div>
      )}
      {owner === user.id &&
        items.map((item) => {
          const bounds = kitchenEnvelope(item.design),
            pad = 100;
          return (
            <article key={item.id} className={account ? "account-card account-kitchen-card" : "rounded-xl border border-[#e4e4e7] bg-white p-3 text-[#171717]"}>
              <div className={account ? "account-kitchen-preview" : "relative h-40 w-full overflow-hidden rounded-lg bg-[#f3f4ee]"}>
                {item.thumbnailUrl ? (
                  <Image
                    src={item.thumbnailUrl}
                    alt={`${item.name} 3D зураг`}
                    fill
                    sizes={account ? "(max-width: 700px) calc(100vw - 32px), (max-width: 900px) 60vw, 440px" : "300px"}
                    className="object-contain"
                  />
                ) : (
                  <svg
                    role="img"
                    aria-label={`${item.name} гарнитурын байрлал`}
                    className="h-full w-full rounded-lg"
                    viewBox={`${bounds.minX - pad} ${bounds.minZ - pad} ${bounds.w * 1000 + pad * 2} ${bounds.d * 1000 + pad * 2}`}
                  >
                    {item.design.cabinets.map((c) => (
                      <polygon
                        key={c.id}
                        points={cabinetCorners(c)
                          .map((p) => `${p.x},${p.z}`)
                          .join(" ")}
                        fill={c.color}
                        stroke="#576652"
                        strokeWidth={1}
                        vectorEffect="non-scaling-stroke"
                        fillOpacity={c.type === "wall" ? 0.65 : 1}
                      />
                    ))}
                  </svg>
                )}
              </div>
              <div className={account ? "account-kitchen-info" : "pt-3"}>
                <h3 className="break-words font-medium">{item.name}</h3>
                <p className="mt-2 text-xs text-[#68686f]">
                  {Math.round(bounds.w * 1000)} × {Math.round(bounds.d * 1000)} ×{" "}
                  {Math.round(bounds.h * 1000)} мм
                </p>
                <p className="mt-1 text-xs text-[#68686f]">{item.design.cabinets.length} шүүгээ</p>
                <div className={account ? "account-kitchen-actions" : "mt-2 flex flex-wrap gap-3 text-sm"}>
                  {onPlace && (
                    <button
                      type="button"
                      className="min-h-11 rounded-lg bg-[#293c32] px-3 text-white"
                      onClick={() => onPlace(item)}
                    >
                      Өрөөнд байрлуулах
                    </button>
                  )}
                  <Link
                    className={account ? "account-button" : "inline-flex min-h-11 items-center underline"}
                    href={`/kitchen?design=${encodeURIComponent(item.id)}`}
                  >
                    {account && <Pencil size={14} aria-hidden="true" />}
                    Засах
                  </Link>
                  {!onPlace && (
                    <Link
                      className={account ? "account-button account-button-primary" : "inline-flex min-h-11 items-center underline"}
                      href={`/planner?kitchen=${encodeURIComponent(item.id)}`}
                    >
                      Өрөөнд байрлуулах
                      {account && <ArrowUpRight size={14} aria-hidden="true" />}
                    </Link>
                  )}
                  <button
                    type="button"
                    className={account ? "account-icon-button account-danger" : "min-h-11 text-red-700 underline"}
                    aria-label={`${item.name} гарнитурыг устгах`}
                    title="Устгах"
                    onClick={() => {
                      if (
                        window.confirm(
                          `“${item.name}” гарнитурыг устгах уу? Өрөөнд байрлуулсан хуулбарууд үлдэнэ.`,
                        )
                      )
                        void remove(item.id);
                    }}
                  >
                    {account ? <Trash2 size={16} aria-hidden="true" /> : "Устгах"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
    </div>
  );
}
