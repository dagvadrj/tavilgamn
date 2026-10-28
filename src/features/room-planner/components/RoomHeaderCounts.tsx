"use client";
import { Heart, ShoppingBag } from "lucide-react";
import { PlannerLink as Link } from "@/components/PlannerLink";
import { useCart } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";

/** D1: the wishlist and the cart are separate lists with separate counts. */
export function RoomHeaderCounts({ onCart }: { onCart: () => void }) {
  const wished = useWishlist((state) => state.items.length);
  const inCart = useCart((state) =>
    (state.items ?? []).reduce((sum, item) => sum + item.qty, 0),
  );
  return (
    <div className="room-header-counts">
      <Link
        href="/wishlist"
        target="_blank"
        rel="noopener noreferrer"
        title="Хүслийн жагсаалт — сагснаас тусдаа"
      >
        <Heart size={15} aria-hidden="true" />
        Хүсэл {wished}
      </Link>
      <button
        type="button"
        title="Сагс — худалдан авах тоо"
        onClick={onCart}
      >
        <ShoppingBag size={15} aria-hidden="true" />
        Сагс {inCart}
      </button>
    </div>
  );
}
