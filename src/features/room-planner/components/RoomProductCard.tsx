"use client";

import { useState } from "react";
import Image from "next/image";
import { Armchair } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { stockLabel } from "@/lib/inventory";

export function RoomProductCard({
  product,
  onAdd,
}: {
  product: Product;
  onAdd: () => void;
}) {
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const unavailable = !product.model;
  const reason = "3D загвар хараахан бэлэн болоогүй";
  return (
    <button
      type="button"
      className="room-product-card"
      disabled={unavailable}
      title={unavailable ? reason : undefined}
      aria-label={`${product.name} — ${unavailable ? reason : "өрөөнд нэмэх"}`}
      onClick={onAdd}
    >
      <div className="room-product-image">
        {product.image && failedImage !== product.image ? (
          <Image
            src={product.image}
            alt=""
            fill
            sizes="(max-width: 959px) 170px, 150px"
            className="object-contain"
            onError={() => setFailedImage(product.image)}
          />
        ) : (
          <Armchair size={36} aria-hidden="true" />
        )}
      </div>
      <div className="room-product-info">
        <p className="font-medium">{product.name}</p>
        <p className="room-product-price">{formatPrice(product.basePrice)}</p>
        <p className="room-product-stock">{stockLabel(product)}</p>
        {unavailable && <p className="room-product-unavailable">{reason}</p>}
      </div>
    </button>
  );
}
