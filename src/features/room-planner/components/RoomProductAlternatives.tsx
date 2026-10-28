"use client";
import { useMemo, useState } from "react";
import Image from "next/image";
import type { PlacedFurniture, Product, RoomShape } from "@/lib/types";
import type { PlacementRoom } from "@/three/collision";
import { replaceRoomProduct } from "@/lib/roomProductReplacement";
import { formatFurnitureCm } from "./RoomCatalogCard";
import { formatPrice } from "@/lib/format";

/** «Ижил бүтээгдэхүүнээр солих»: same category, same pose and instance. */
export function RoomProductAlternatives({ piece, product, products, pieces, room, roomId, context, storeId, onReplace, onNotice }: {
  piece: PlacedFurniture; product?: Product | null; products: Product[]; pieces: PlacedFurniture[]; room: RoomShape; roomId: string;
  context: { room: PlacementRoom; pieces: PlacedFurniture[] }; storeId?: string;
  onReplace: (pieces: PlacedFurniture[]) => void; onNotice: (text: string) => void;
}) {
  const [query, setQuery] = useState("");
  const category = product?.category ?? piece.details?.category;
  const choices = useMemo(() => products.filter(p => p.id !== piece.productId && p.category === category && p.model &&
    (!storeId || p.storeIds?.includes(storeId)) &&
    `${p.name} ${p.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map(p => ({ product: p,
      result: replaceRoomProduct(piece, p, pieces, room, roomId, context) })).sort((a, b) => Number(Boolean(a.result.error)) - Number(Boolean(b.result.error)) || a.product.basePrice - b.product.basePrice),
  [products, piece, pieces, room, roomId, context, category, query, storeId]);
  if (piece.kitchen) return <p className="room-options-empty">Өөрийн гарнитурыг гарнитурын тохиргооноос солино.</p>;
  if (!category) return <p className="room-options-empty">Ангилал тодорхойгүй тул ижил бүтээгдэхүүн санал болгох боломжгүй.</p>;
  const fitting = choices.filter(c => !c.result.error).length;
  return <div className="room-options-list">
    <label className="room-options-search"><span className="sr-only">Нэр, кодоор хайх</span>
      <input type="search" value={query} placeholder="Нэр, кодоор хайх" onChange={e => setQuery(e.target.value)} />
    </label>
    <p role="status" className="room-options-count">{fitting} бүтээгдэхүүн энэ байрлалд багтана · байрлал, эргэлт хэвээр</p>
    <ul>{choices.slice(0, 16).map(({ product: p, result }) => <li key={p.id} data-fit={result.error ? "no" : "yes"}>
      <span className="room-options-thumb">{p.image ? <Image src={p.image} alt="" width={72} height={72} /> : null}</span>
      <span className="room-options-body">
        <strong>{p.name}</strong>
        <small>{formatFurnitureCm(p.dimensions.w, p.dimensions.d, p.dimensions.h)}</small>
        <b>{p.basePrice > 0 ? formatPrice(p.basePrice) : "Үнэ тодруулах"}</b>
        {result.error ? <small className="room-options-reason">{result.error}</small> : <button type="button" onClick={() => {
          // Re-validate against the room as it is now, not the list's earlier result.
          const checked = replaceRoomProduct(piece, p, pieces, room, roomId, context);
          if (!checked.pieces) { onNotice(checked.error!); return; }
          onReplace(checked.pieces); onNotice(`${p.name}-ээр солилоо. Өмнөх загвар шинэ нь ачаалагдтал харагдана.`);
        }}>Үүгээр солих</button>}
      </span>
    </li>)}</ul>
    {!choices.length && <p className="room-options-empty">{query ? "Хайлтад тохирох ижил бүтээгдэхүүн алга." : "Энэ ангилалд бэлэн 3D хувилбар олдсонгүй."}</p>}
  </div>;
}
