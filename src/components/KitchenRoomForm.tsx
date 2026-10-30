"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Ruler, X } from "lucide-react";
import type { KitchenBuyerRoom } from "@/lib/kitchenRoomMatch";

const STORAGE_KEY = "tavilga:kitchen-buyer-room:v1";

/** The buyer's own room size, kept in the URL and remembered on this device. */
export function KitchenRoomForm({ room, query }: { room: KitchenBuyerRoom | null; query: string }) {
  const router = useRouter();
  const href = (next: KitchenBuyerRoom | null) => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (next) { params.set("w", String(next.widthMm)); params.set("d", String(next.depthMm)); }
    const search = params.toString();
    return search ? `/kitchens?${search}` : "/kitchens";
  };

  useEffect(() => {
    try {
      if (room) localStorage.setItem(STORAGE_KEY, JSON.stringify(room));
      else {
        const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as KitchenBuyerRoom | null;
        if (saved?.widthMm && saved?.depthMm) router.replace(href(saved), { scroll: false });
      }
    } catch { /* Storage is a convenience only. */ }
    // Runs for each room change; href only depends on room and query.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.widthMm, room?.depthMm]);

  function clear() {
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    router.replace(href(null), { scroll: false });
  }

  return (
    <form
      className="kitchen-room-form"
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const widthMm = Math.round(Number(data.get("w"))), depthMm = Math.round(Number(data.get("d")));
        if (widthMm >= 1000 && depthMm >= 1000) router.replace(href({ widthMm, depthMm }), { scroll: false });
      }}
    >
      <Ruler size={16} aria-hidden="true" />
      <span>Миний өрөө</span>
      <input name="w" type="number" inputMode="numeric" min={1000} max={20000} step={10} required
        aria-label="Өрөөний өргөн, мм" placeholder="Өргөн" defaultValue={room?.widthMm} key={`w${room?.widthMm}`} />
      <span aria-hidden="true">×</span>
      <input name="d" type="number" inputMode="numeric" min={1000} max={20000} step={10} required
        aria-label="Өрөөний урт, мм" placeholder="Урт" defaultValue={room?.depthMm} key={`d${room?.depthMm}`} />
      <small>мм</small>
      <button type="submit">Тааруулах</button>
      {room && (
        <button type="button" className="kitchen-room-clear" aria-label="Өрөөний хэмжээ арилгах" onClick={clear}>
          <X size={15} />
        </button>
      )}
    </form>
  );
}
