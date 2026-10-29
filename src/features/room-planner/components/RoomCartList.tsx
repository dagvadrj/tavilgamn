"use client";

import Image from "next/image";
import { useState } from "react";
import { Armchair, Info, Minus, Plus, Trash2 } from "lucide-react";
import { PlannerLink as Link } from "@/components/PlannerLink";
import { useCart } from "@/store/cart";
import { getProduct } from "@/store/catalog";
import { formatPrice } from "@/lib/format";
import { MAX_ITEM_QUANTITY } from "@/lib/inventory";
import type { CartItem } from "@/lib/types";

/**
 * The real purchase list (src/store/cart.ts). Placing an item in the room adds a
 * scene instance and never changes the quantity to buy.
 */
export function RoomCartList({
  storeNames,
  placedCount,
  onPlace,
  onRemoved,
  onBrowse,
  roomPieceCount,
  onBuyRoom,
}: {
  storeNames: Map<string, string>;
  placedCount: (item: CartItem) => number;
  onPlace: (item: CartItem) => void;
  onRemoved: (item: CartItem, restore: () => void) => void;
  onBrowse: () => void;
  /** Furniture placed in the room; an empty cart offers to buy all of it. */
  roomPieceCount: number;
  onBuyRoom: () => void;
}) {
  const items = useCart((state) => state.items) ?? [];
  const setQty = useCart((state) => state.setQty);
  const remove = useCart((state) => state.remove);
  if (!items.length)
    return (
      <div className="room-cart">
        <div className="room-panel-empty">
          <strong>Сагс хоосон байна</strong>
          {roomPieceCount > 0 ? (
            <>
              <p>
                Өрөөнд байрлуулсан тавилга сагсанд автоматаар орохгүй. Худалдан
                авах бол сагсална уу.
              </p>
              <button type="button" className="is-primary" onClick={onBuyRoom}>
                Өрөөний {roomPieceCount} тавилгыг сагслах
              </button>
            </>
          ) : (
            <>
              <p>Каталогоос тавилга сонгож өрөөндөө байрлуулаад сагслаарай.</p>
              <button type="button" className="is-primary" onClick={onBrowse}>
                Каталог үзэх
              </button>
            </>
          )}
        </div>
      </div>
    );
  return (
    <div className="room-cart">
      <p className="room-panel-info">
        <Info size={15} aria-hidden="true" />
        Сагс бол худалдан авах жагсаалт. «Өрөөнд байрлуулах» нь сагсны тоог
        өөрчлөхгүй.
      </p>
      <ul className="room-cart-list" aria-label="Сагсанд байгаа тавилга">
        {items.map((item) => {
          const product = getProduct(item.productId);
          const merchant = product?.storeIds
            ?.map((id) => storeNames.get(id))
            .find(Boolean);
          const variant = [
            product?.colors.find((color) => color.id === item.color)?.name,
            product?.materials.find((material) => material.id === item.material)
              ?.name,
          ]
            .filter(Boolean)
            .join(" · ");
          const placed = placedCount(item);
          const has3d = !!product?.model;
          return (
            <li key={item.id}>
              <div className="room-cart-row">
                <CartThumb image={item.image} />
                <div className="room-cart-text">
                  {merchant && <span>{merchant}</span>}
                  <strong>{item.name}</strong>
                  {variant && <span>{variant}</span>}
                  <span>{formatPrice(item.unitPrice)} / ш</span>
                </div>
                <button
                  type="button"
                  className="room-cart-remove"
                  aria-label={`${item.name} сагснаас хасах`}
                  onClick={() => {
                    const index = useCart
                      .getState()
                      .items.findIndex((entry) => entry.id === item.id);
                    remove(item.id);
                    onRemoved(item, () =>
                      useCart.setState((state) => {
                        if (state.items.some((entry) => entry.id === item.id))
                          return state;
                        const next = [...state.items];
                        next.splice(Math.max(0, index), 0, item);
                        return { items: next };
                      }),
                    );
                  }}
                >
                  <Trash2 size={16} />
                </button>
              </div>
              <div className="room-cart-quantity">
                <div role="group" aria-label={`${item.name} тоо ширхэг`}>
                  <button
                    type="button"
                    aria-label="Нэгээр хасах"
                    disabled={item.qty <= 1}
                    onClick={() => setQty(item.id, Math.max(1, item.qty - 1))}
                  >
                    <Minus size={15} />
                  </button>
                  <output aria-live="polite">{item.qty}</output>
                  <button
                    type="button"
                    aria-label="Нэгээр нэмэх"
                    disabled={item.qty >= MAX_ITEM_QUANTITY}
                    onClick={() => setQty(item.id, item.qty + 1)}
                  >
                    <Plus size={15} />
                  </button>
                </div>
                <strong>{formatPrice(item.unitPrice * item.qty)}</strong>
              </div>
              <div className="room-cart-place">
                <span>Өрөөнд {placed} байрлуулсан</span>
                <button
                  type="button"
                  disabled={!has3d}
                  onClick={() => onPlace(item)}
                >
                  Өрөөнд байрлуулах
                </button>
              </div>
              {!has3d && (
                <p className="room-panel-warning">
                  3D загваргүй тул өрөөнд харагдахгүй. Захиалгад нөлөөлөхгүй.
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function CartThumb({ image }: { image: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <span className="room-added-thumb">
      {image && !failed ? (
        <Image
          src={image}
          alt=""
          width={56}
          height={56}
          unoptimized={image.startsWith("/api/")}
          onError={() => setFailed(true)}
        />
      ) : (
        <Armchair size={22} aria-hidden="true" />
      )}
    </span>
  );
}

/** «N төрөл · N ширхэг», total and the two exits from the planner. */
export function RoomCartFooter() {
  const items = useCart((state) => state.items) ?? [];
  if (!items.length) return null;
  const count = items.reduce((sum, item) => sum + item.qty, 0);
  const total = items.reduce((sum, item) => sum + item.unitPrice * item.qty, 0);
  return (
    <>
      <div className="room-panel-total">
        <span>
          {items.length} төрөл · {count} ширхэг
        </span>
        <strong>{formatPrice(total)}</strong>
      </div>
      <div className="room-panel-footer-actions">
        <Link href="/cart" className="is-secondary">
          Сагс руу очих
        </Link>
        <Link href="/checkout" className="is-primary">
          Захиалах
        </Link>
      </div>
    </>
  );
}
