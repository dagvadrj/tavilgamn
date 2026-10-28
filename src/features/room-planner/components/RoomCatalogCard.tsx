"use client";

import { useState } from "react";
import Image from "next/image";
import { Armchair, Box, Loader2, Plus } from "lucide-react";
import { useRoomModelStatus } from "@/store/roomModelStatus";

/**
 * One catalog card for 3D and photo-only products. The add button shows
 * «Ачаалж байна…» while an instance of this product is still loading in the room.
 */
export function RoomCatalogCard({
  name,
  merchant,
  image,
  fallbackImage = null,
  dimensions,
  price,
  has3d,
  placedIds,
  onAdd,
  onAddToCart,
  onPrefetch,
}: {
  name: string;
  merchant?: string;
  image: string | null;
  /** Used when `image` is missing or fails to load (e.g. no model thumbnail). */
  fallbackImage?: string | null;
  dimensions: string;
  price: string;
  has3d: boolean;
  /** Instances of this product already placed in the active room. */
  placedIds: string[];
  onAdd: () => void;
  onAddToCart?: () => void;
  onPrefetch?: () => void;
}) {
  const [failedImages, setFailedImages] = useState<string[]>([]);
  const source = [image, fallbackImage].find(
    (candidate): candidate is string =>
      !!candidate && !failedImages.includes(candidate),
  );
  const loading = useRoomModelStatus((state) =>
    placedIds.some((id) => state.byInstance[id] === "loading"),
  );
  return (
    <article
      className="room-catalog-card"
      onPointerEnter={onPrefetch}
      onFocus={onPrefetch}
    >
      <div className="room-catalog-card-image">
        {source ? (
          <Image
            key={source}
            src={source}
            alt=""
            fill
            unoptimized={source.startsWith("/api/")}
            sizes="(max-width: 959px) 45vw, 180px"
            className="object-contain"
            onError={() => setFailedImages((list) => [...list, source])}
          />
        ) : (
          <Armchair size={36} aria-hidden="true" />
        )}
        {has3d ? (
          <span className="room-catalog-badge is-3d">
            <Box size={11} aria-hidden="true" /> 3D
          </span>
        ) : (
          <span className="room-catalog-badge is-missing">3D байхгүй</span>
        )}
        {placedIds.length > 0 && (
          <span className="room-catalog-badge is-placed">
            Өрөөнд {placedIds.length}
          </span>
        )}
      </div>
      <div className="room-catalog-card-body">
        {merchant && <span className="room-catalog-merchant">{merchant}</span>}
        <strong>{name}</strong>
        <span className="room-catalog-dims">{dimensions}</span>
        <span className="room-catalog-price">{price}</span>
        <div className="room-catalog-card-actions">
          {has3d ? (
            <button
              type="button"
              className="room-catalog-add"
              aria-label={`${name} — өрөөнд нэмэх`}
              disabled={loading}
              aria-busy={loading}
              onClick={onAdd}
            >
              {loading ? (
                <>
                  <Loader2
                    size={15}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  Ачаалж байна…
                </>
              ) : (
                <>
                  <Plus size={15} aria-hidden="true" /> Өрөөнд нэмэх
                </>
              )}
            </button>
          ) : (
            <>
              <button type="button" className="room-catalog-add" disabled>
                Өрөөнд нэмэх боломжгүй
              </button>
              {onAddToCart && (
                <button
                  type="button"
                  className="room-catalog-cart-link"
                  onClick={onAddToCart}
                >
                  Шууд сагсанд нэмэх
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </article>
  );
}

/** Product footprint for cards and rows: «200 × 90 × 80 см». */
export function formatFurnitureCm(w: number, d: number, h: number) {
  return `${Math.round(w * 100)} × ${Math.round(d * 100)} × ${Math.round(h * 100)} см`;
}
