"use client";
import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Heart, Star, ArrowUpRight } from "lucide-react";
import type { Product } from "@/lib/types";
import { formatPrice } from "@/lib/format";
import { useWishlist } from "@/store/wishlist";
import { CATEGORY_LABEL } from "@/lib/products";

import { stockLabel } from "@/lib/inventory";

export function ProductCard({ product, catalogStyle = false }: { product: Product; catalogStyle?: boolean }) {
  const has = useWishlist(s => s.has(product.id));
  const toggle = useWishlist(s => s.toggle);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const saved = mounted && has;
  return <article className="product-card">
    <div className="product-photo">
      <Link href={"/product/" + product.id} aria-label={product.name + " дэлгэрэнгүй үзэх"}><Image src={product.image} alt={product.name} fill sizes={catalogStyle ? "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw" : "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, 25vw"} className="object-cover" /></Link>
      {(product.isNew || product.isBestSeller || product.badges?.[0]) && <span className={"product-badge " + (product.isNew ? "new" : "")}>{product.isNew ? "Шинэ" : product.isBestSeller ? "Эрэлттэй" : product.badges?.[0]}</span>}
      <button className={"wishlist-toggle " + (saved ? "saved" : "")} type="button" onClick={() => toggle(product.id)} aria-label={product.name + (saved ? " — хадгалснаас хасах" : " — хадгалах")} aria-pressed={saved}><Heart size={18} fill={saved ? "currentColor" : "none"} strokeWidth={1.7} /></button>
      {product.model && <span className="product-3d">3D</span>}
    </div>
    <div className="product-info">
      <div className="product-meta"><span>{CATEGORY_LABEL[product.category]}</span>{product.reviewCount > 0 && <span aria-label={product.rating + " үнэлгээ, " + product.reviewCount + " сэтгэгдэл"}><Star size={12} fill="currentColor" />{product.rating}</span>}</div>
      <h3><Link href={"/product/" + product.id}>{product.name}</Link></h3>
      <p className="product-size">{Math.round(product.dimensions.w * 100)} × {Math.round(product.dimensions.d * 100)} × {Math.round(product.dimensions.h * 100)} см</p>
      <div className="product-swatches" aria-label="Боломжтой өнгөнүүд">{product.colors.slice(0, 4).map(c => <span key={c.id} title={c.name} role="img" aria-label={c.name} style={{ backgroundColor: c.hex }} />)}{product.colors.length > 4 && <small>+{product.colors.length - 4}</small>}</div>
      <div className="product-price"><div><strong>{formatPrice(product.basePrice)}</strong><span className={product.inStock ? "in-stock" : "out-of-stock"}>{stockLabel(product)}</span></div><Link href={"/product/" + product.id} className="product-view" aria-label={product.name + " сонголтуудыг үзэх"}><ArrowUpRight size={19} /></Link></div>
    </div>
  </article>;
}

