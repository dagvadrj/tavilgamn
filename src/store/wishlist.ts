"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WishlistItem } from "@/lib/types";

interface WishlistState {
  items: WishlistItem[];
  toggle: (productId: string) => void;
  has: (productId: string) => boolean;
  remove: (productId: string) => void;
  clear: () => void;
}

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (productId) => {
        if (get().items.some((i) => i.productId === productId)) {
          set({ items: get().items.filter((i) => i.productId !== productId) });
        } else {
          set({
            items: [...get().items, { productId, addedAt: Date.now() }],
          });
        }
      },
      has: (productId) => get().items.some((i) => i.productId === productId),
      remove: (productId) =>
        set({ items: get().items.filter((i) => i.productId !== productId) }),
      clear: () => set({ items: [] }),
    }),
    { name: "casa-wishlist-guest" },
  ),
);
export function requestGuestWishlistTransfer() {
  if (typeof window === "undefined" || useWishlist.persist.getOptions().name !== "casa-wishlist-guest") return;
  try { window.sessionStorage.setItem("casa-wishlist-auth-handoff", JSON.stringify({ createdAt: Date.now(), items: useWishlist.getState().items })); } catch { /* The guest list stays available on this device. */ }
}

export function setWishlistOwner(userId: string | null) {
  if (typeof window === "undefined") return;

  const storageName = `casa-wishlist-${userId ?? "guest"}`;
  let items: WishlistItem[] = [];

  try {
    const saved = window.localStorage.getItem(storageName);
    const parsed = saved
      ? (JSON.parse(saved) as {
          state?: { items?: WishlistItem[] };
        })
      : null;

    if (Array.isArray(parsed?.state?.items)) {
      items = parsed.state.items;
    }
  } catch {
    items = [];
  }

  let transferred = false;
  if (userId) try {
    const pending = JSON.parse(window.sessionStorage.getItem("casa-wishlist-auth-handoff") ?? "null");
    if (Array.isArray(pending?.items) && Number.isFinite(pending.createdAt) && Date.now() - pending.createdAt >= 0 && Date.now() - pending.createdAt < 86400000) {
      for (const item of pending.items) if (typeof item?.productId === "string" && item.productId.length <= 100 && Number.isFinite(item.addedAt) && !items.some(saved => saved.productId === item.productId)) items.push({ productId: item.productId, addedAt: item.addedAt });
      transferred = true;
    }
  } catch { /* Ignore invalid handoffs without changing account ownership. */ }

  useWishlist.persist.setOptions({ name: storageName });
  useWishlist.setState({ items });
  if (transferred) window.sessionStorage.removeItem("casa-wishlist-auth-handoff");
}
