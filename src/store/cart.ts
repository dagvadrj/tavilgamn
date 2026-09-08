"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem } from "@/lib/types";

import { MAX_ITEM_QUANTITY, quantityLimit } from "@/lib/inventory";

interface CartState {
  items: CartItem[];
  add: (item: Omit<CartItem, "id" | "qty"> & { qty?: number; stockQuantity?: number | null }) => number;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
  subtotal: () => number;
  count: () => number;
}

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      add: (item) => {
        if (!Number.isInteger(item.qty ?? 1) || (item.qty ?? 1) < 1) return 0;
        const allowed = quantityLimit({ id: item.productId, stockQuantity: item.stockQuantity === undefined ? Number.MAX_SAFE_INTEGER : item.stockQuantity }, get().items, item);
        const amount = Math.min(item.qty ?? 1, allowed);
        if (amount < 1) return 0;
        const { stockQuantity: _stock, ...cartItem } = item;
        const existing = get().items.find(
          (i) =>
            i.productId === item.productId &&
            i.color === item.color &&
            i.material === item.material,
        );
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.id === existing.id ? { ...i, qty: i.qty + amount } : i,
            ),
          });
        } else {
          set({
            items: [
              ...get().items,
              {
                ...cartItem,
                id: `${item.productId}-${item.color}-${item.material}-${Date.now()}`,
                qty: amount,
              },
            ],
          });
        }
        return amount;
      },
      remove: (id) => set({ items: get().items.filter((i) => i.id !== id) }),
      setQty: (id, qty) =>
        set({
          items: get()
            .items.map((i) => (i.id === id && Number.isInteger(qty) ? { ...i, qty: Math.min(MAX_ITEM_QUANTITY, qty) } : i))
            .filter((i) => i.qty > 0),
        }),
      clear: () => set({ items: [] }),
      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.unitPrice * i.qty, 0),
      count: () => get().items.reduce((sum, i) => sum + i.qty, 0),
    }),
    { name: "casa-cart-guest" },
  ),
);
export function requestGuestCartTransfer() {
  if (typeof window === "undefined") return;
  try { window.sessionStorage.setItem("casa-transfer-guest-cart", "yes"); } catch { /* Storage may be unavailable. */ }
}

export function setCartOwner(userId: string | null) {
  if (typeof window === "undefined") return;

  const storageName = `casa-cart-${userId ?? "guest"}`;
  let items: CartItem[] = [];

  try {
    const saved = window.localStorage.getItem(storageName);
    const parsed = saved
      ? (JSON.parse(saved) as {
          state?: { items?: CartItem[] };
        })
      : null;

    if (Array.isArray(parsed?.state?.items)) {
      items = parsed.state.items;
    }
  } catch {
    items = [];
  }

  useCart.persist.setOptions({ name: storageName });
  let transferGuest = false;
  try {
    transferGuest = !!userId && window.sessionStorage.getItem("casa-transfer-guest-cart") === "yes";
    if (transferGuest) {
      const guest = JSON.parse(window.localStorage.getItem("casa-cart-guest") ?? "null");
      if (Array.isArray(guest?.state?.items)) {
        for (const item of guest.state.items as CartItem[]) {
          if (!Number.isInteger(item.qty) || item.qty < 1) continue;
          const existing = items.find((saved) => saved.productId === item.productId && saved.color === item.color && saved.material === item.material);
          if (existing) existing.qty = Math.min(MAX_ITEM_QUANTITY, existing.qty + item.qty);
          else items.push({ ...item, qty: Math.min(MAX_ITEM_QUANTITY, item.qty) });
        }
      }
    }
  } catch { transferGuest = false; }
  useCart.setState({ items });
  if (transferGuest) {
    window.sessionStorage.removeItem("casa-transfer-guest-cart");
    window.localStorage.removeItem("casa-cart-guest");
  }
}
