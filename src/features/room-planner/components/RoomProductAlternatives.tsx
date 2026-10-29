"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import type { PlacedFurniture, Product, RoomShape } from "@/lib/types";
import type { PlacementRoom } from "@/three/collision";
import { replaceRoomProduct } from "@/lib/roomProductReplacement";
import { hasAvailableStock } from "@/lib/inventory";
import { formatFurnitureCm } from "./RoomCatalogCard";
import { formatPrice } from "@/lib/format";

export type AlternativeFit =
  | { kind: "fits" }
  | { kind: "no-model" }
  | { kind: "no-stock" }
  | { kind: "blocked"; reason: string };

/** D3 card state: why a same-category product can or cannot replace this one. */
export function alternativeFit(
  piece: PlacedFurniture,
  product: Product,
  pieces: PlacedFurniture[],
  room: RoomShape,
  roomId: string,
  context: { room: PlacementRoom; pieces: PlacedFurniture[] },
): AlternativeFit {
  if (!product.model) return { kind: "no-model" };
  if (!hasAvailableStock(product)) return { kind: "no-stock" };
  const result = replaceRoomProduct(piece, product, pieces, room, roomId, context);
  return result.error ? { kind: "blocked", reason: result.error } : { kind: "fits" };
}

const FIT_TEXT = {
  fits: "Энэ байрлалд багтана",
  "no-model": "3D бэлэн биш",
  "no-stock": "Нөөц дууссан",
} as const;

/** «Ижил бүтээгдэхүүнээр солих»: same category, same instance, pose and attachment. */
export function RoomProductAlternatives({ piece, product, products, pieces, room, roomId, context, storeId, onReplace, onNotice }: {
  piece: PlacedFurniture; product?: Product | null; products: Product[]; pieces: PlacedFurniture[]; room: RoomShape; roomId: string;
  context: { room: PlacementRoom; pieces: PlacedFurniture[] }; storeId?: string;
  onReplace: (pieces: PlacedFurniture[]) => void; onNotice: (text: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  const category = product?.category ?? piece.details?.category;
  const choices = useMemo(() => products
    .filter(p => p.id !== piece.productId && p.category === category && (!storeId || p.storeIds?.includes(storeId)) &&
      `${p.name} ${p.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .map(p => ({ product: p, fit: alternativeFit(piece, p, pieces, room, roomId, context) }))
    .sort((a, b) => Number(a.fit.kind !== "fits") - Number(b.fit.kind !== "fits") || a.product.basePrice - b.product.basePrice),
  [products, piece, pieces, room, roomId, context, category, query, storeId]);
  if (piece.kitchen) return <p className="room-options-empty">Өөрийн гарнитурыг гарнитурын тохиргооноос солино.</p>;
  if (!category) return <p className="room-options-empty">Оруулсан загварт дэлгүүрийн ангилал байхгүй тул санал гаргахгүй.</p>;
  const fitting = choices.filter(c => c.fit.kind === "fits").length;
  return <div className="room-options-list">
    <label className="room-options-search"><span className="sr-only">Нэр, кодоор хайх</span>
      <input type="search" value={query} placeholder="Нэр, кодоор хайх" onChange={e => setQuery(e.target.value)} />
    </label>
    <p role="status" className="room-options-count">{fitting} бүтээгдэхүүн энэ байрлалд багтана · байрлал, эргэлт хэвээр, өрөөний тоо өсөхгүй</p>
    <ul>{choices.slice(0, 16).map(({ product: p, fit }) => <li key={p.id} data-fit={fit.kind === "fits" ? "yes" : "no"}>
      <span className="room-options-thumb">{p.image && !broken.has(p.id)
        ? <Image src={p.image} alt="" width={72} height={72} onError={() => setBroken(set => new Set(set).add(p.id))} />
        : <ImageOff size={20} aria-hidden="true" />}</span>
      <span className="room-options-body">
        <strong>{p.name}</strong>
        <small>{formatFurnitureCm(p.dimensions.w, p.dimensions.d, p.dimensions.h)}</small>
        <b>{p.basePrice > 0 ? formatPrice(p.basePrice) : "Үнэ тодруулах"}</b>
        <small className={fit.kind === "fits" ? "room-options-ok" : "room-options-reason"}>
          {fit.kind === "blocked" ? `Багтахгүй — ${fit.reason}` : FIT_TEXT[fit.kind]}
        </small>
        {fit.kind === "fits" && <button type="button" onClick={() => {
          // Re-validate against the room as it is now, not the list's earlier result.
          const checked = replaceRoomProduct(piece, p, pieces, room, roomId, context);
          if (!checked.pieces) { onNotice(`Солигдсонгүй — ${checked.error}`); return; }
          onReplace(checked.pieces); onNotice(`${p.name}-ээр солилоо. Өмнөх загвар шинэ нь ачаалагдтал харагдана.`);
        }}>Үүгээр солих</button>}
      </span>
    </li>)}</ul>
    {!choices.length && <p className="room-options-empty">{query ? "Хайлтад тохирох ижил бүтээгдэхүүн алга." : "Энэ ангилалд байрлалд тохирох өөр 3D бараа алга."}</p>}
    {choices.length > 0 && !fitting && !query && <p className="room-options-empty">Энэ ангилалд байрлалд тохирох өөр 3D бараа алга.</p>}
  </div>;
}
