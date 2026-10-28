"use client";

import { useEffect, useRef } from "react";
import { ChevronRight, Save, ShoppingBag, X } from "lucide-react";
import { PlannerLink as Link } from "@/components/PlannerLink";
import { useCart } from "@/store/cart";
import { formatPrice } from "@/lib/format";

/** Room furniture and the purchase list are different totals; never one number. */
export function RoomSummaryModal({
  name,
  room,
  pieceCount,
  roomTotal,
  canBuyRoom,
  onBuyRoom,
  onSave,
  onClose,
}: {
  name: string;
  room: string;
  pieceCount: number;
  roomTotal: number;
  canBuyRoom: boolean;
  onBuyRoom: () => void;
  onSave: () => void;
  onClose: () => void;
}) {
  const items = useCart((state) => state.items) ?? [];
  const cartCount = items.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = items.reduce(
    (sum, item) => sum + item.unitPrice * item.qty,
    0,
  );
  const dialog = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    return () => opener?.focus?.();
  }, []);
  return (
    <div className="room-summary-backdrop" onClick={onClose}>
      <div
        ref={dialog}
        className="room-summary-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="room-summary-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.stopPropagation();
            onClose();
          }
        }}
      >
        <header>
          <div>
            <span>Төслийн тойм</span>
            <h2 id="room-summary-title">{name}</h2>
            <p>{room}</p>
          </div>
          <button type="button" aria-label="Тойм хаах" onClick={onClose}>
            <X size={18} />
          </button>
        </header>
        <section className="room-summary-figure">
          <span>Өрөөний тавилгын дүн</span>
          <strong>{formatPrice(roomTotal)}</strong>
          <small>{pieceCount} тавилга өрөөнд байрласан</small>
          <button type="button" disabled={!canBuyRoom} onClick={onBuyRoom}>
            <ShoppingBag size={16} aria-hidden="true" /> Өрөөний тавилгыг
            бүгдийг сагслах
          </button>
        </section>
        <section className="room-summary-figure">
          <span>Сагсны дүн</span>
          <strong>{formatPrice(cartTotal)}</strong>
          <small>
            {items.length} төрөл · {cartCount} ширхэг · худалдан авах жагсаалт
          </small>
          <Link href="/cart" className="room-summary-link">
            Сагс руу очих <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </section>
        <footer>
          <button type="button" onClick={onSave}>
            <Save size={16} aria-hidden="true" /> Загвар хадгалах
          </button>
          <Link href="/kitchen" className="room-summary-link">
            Гал тогооны төлөвлөгч <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </footer>
      </div>
    </div>
  );
}
