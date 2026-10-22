"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { PlacedFurniture, Product, RoomShape } from "@/lib/types";
import type { PlacementRoom } from "@/three/collision";
import { replaceRoomProduct } from "@/lib/roomProductReplacement";
import { formatPrice } from "@/lib/format";

export function RoomProductAlternatives({ piece, product, products, pieces, room, roomId, context, onReplace, onNotice }: {
  piece: PlacedFurniture; product?: Product | null; products: Product[]; pieces: PlacedFurniture[]; room: RoomShape; roomId: string;
  context: { room: PlacementRoom; pieces: PlacedFurniture[] }; onReplace: (pieces: PlacedFurniture[]) => void; onNotice: (text: string) => void;
}) {
  const [query, setQuery] = useState("");
  const category = product?.category ?? piece.details?.category;
  const choices = useMemo(() => products.filter(p => p.id !== piece.productId && p.category === category && p.model &&
    `${p.name} ${p.id}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())).map(p => ({ product: p,
      result: replaceRoomProduct(piece, p, pieces, room, roomId, context) })).sort((a, b) => Number(Boolean(a.result.error)) - Number(Boolean(b.result.error)) || a.product.basePrice - b.product.basePrice),
  [products, piece, pieces, room, roomId, context, category, query]);
  if (piece.kitchen) return null;
  return <details className="room-product-alternatives">
    <summary>Ижил байрлалд тавилга солих</summary>
    {product && <p><Link href={`/product/${product.id}`} target="_blank" rel="noopener noreferrer">Бүтээгдэхүүний дэлгэрэнгүй ↗</Link><br/><small>Бүтээгдэхүүний код: {product.id}</small></p>}
    <label>Нэр, кодоор хайх<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>
    <p role="status">{choices.filter(c => !c.result.error).length} бүтээгдэхүүн энэ байрлалд тохирно</p>
    <ul>{choices.slice(0, 16).map(({ product: p, result }) => <li key={p.id}>
      <strong>{p.name}</strong><small>{Math.round(p.dimensions.w * 100)} × {Math.round(p.dimensions.d * 100)} × {Math.round(p.dimensions.h * 100)} см · {p.basePrice > 0 ? formatPrice(p.basePrice) : "Үнэ тодруулах"}</small>
      {result.error ? <small>{result.error}</small> : <button type="button" onClick={() => {
        const checked = replaceRoomProduct(piece, p, pieces, room, roomId, context);
        if (!checked.pieces) { onNotice(checked.error!); return; }
        onReplace(checked.pieces); onNotice(`${p.name} сонголоо.`);
      }}>Энэ бүтээгдэхүүнээр солих</button>}
    </li>)}</ul>
    {!choices.length && <p>Энэ ангилалд бэлэн 3D хувилбар олдсонгүй.</p>}
  </details>;
}
