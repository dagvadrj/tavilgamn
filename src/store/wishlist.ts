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

  useWishlist.persist.setOptions({ name: storageName });
  useWishlist.setState({ items });
}