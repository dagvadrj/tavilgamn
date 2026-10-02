"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Heart, Star, Plus, Check, Box, Truck } from "lucide-react";
import type { Product } from "@/lib/types";
import { defaultCartSelection, hasProductPhoto, marketplacePrice } from "@/lib/homeMarketplace";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/orders";
import { useCart } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";
import { CATEGORY_LABEL } from "@/lib/products";
import { hasAvailableStock, stockLabel } from "@/lib/inventory";
import { productOffer } from "@/lib/catalogPresentation";

export function ProductCard({ product, catalogStyle = false, offerCheckedAt, flashSale = false }: { product: Product; catalogStyle?: boolean; offerCheckedAt?: number; flashSale?: boolean }) {
  const has = useWishlist(s => s.has(product.id));
  const toggle = useWishlist(s => s.toggle);
  const add = useCart(state => state.add);
  const [cartMessage, setCartMessage] = useState("");
  const [mounted, setMounted] = useState(false);
  const [checkedAt, setCheckedAt] = useState(offerCheckedAt);
  useEffect(() => {
    setMounted(true);
    setCheckedAt(Date.now());
    const expiration = product.promotionEndsAt ? Date.parse(product.promotionEndsAt) : NaN;
    if (!Number.isFinite(expiration)) return;
    if (expiration <= Date.now()) return;
    let timer: number;
    const checkExpiry = () => {
      const nextCheck = Date.now();
      setCheckedAt(nextCheck);
      if (expiration > nextCheck) timer = window.setTimeout(checkExpiry, Math.min(expiration - nextCheck + 1, 2_147_483_647));
    };
    timer = window.setTimeout(checkExpiry, Math.min(expiration - Date.now() + 1, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [product.promotionEndsAt]);
  const saved = mounted && has;
  const inStock = hasAvailableStock(product);
  const selection = defaultCartSelection(product);
  const displayPrice = selection?.unitPrice ?? product.basePrice;
  // The shown default selection and the cart must agree, including variant surcharges.
  const offer = productOffer({ ...product, basePrice: displayPrice }, checkedAt);
  const badge = offer.discountPercent !== null ? `−${offer.discountPercent}%` : offer.label || (product.isNew ? "Шинэ" : product.isBestSeller ? "Эрэлттэй" : product.badges?.[0]);
  const addToCart = () => {
    if (!inStock || !selection) return;
    const added = add({ productId: product.id, name: product.name, image: product.image,
      color: selection.color.id, material: selection.material.id, unitPrice: selection.unitPrice,
      stockQuantity: product.stockQuantity });
    setCartMessage(added ? "Сагсанд нэмэгдлээ" : "Сагс дахь тоо үлдэгдлийн хязгаарт хүрсэн");
  };

  return <article className="product-card marketplace-product-card">
    <div className="product-photo">
      <Link href={`/product/${product.id}`} aria-label={`${product.name} дэлгэрэнгүй үзэх`}>
        {hasProductPhoto(product) ? <Image src={product.image} alt={product.name} fill sizes={flashSale ? "220px" : catalogStyle ? "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1439px) 26vw, 300px" : "(max-width: 639px) 50vw, (max-width: 999px) 33vw, 240px"} className="object-cover" /> : <span className="product-photo-pending"><Box size={28} aria-hidden="true" />Зураг нэмэгдээгүй</span>}
      </Link>
      {badge ? <span className={`product-badge ${offer.compareAtPrice !== null || offer.label ? "offer" : product.isNew ? "new" : ""}`}>{badge}</span> : null}
      <button className={`wishlist-toggle ${saved ? "saved" : ""}`} type="button" onClick={() => toggle(product.id)} aria-label={`${product.name}${saved ? " — хадгалснаас хасах" : " — хадгалах"}`} aria-pressed={saved}><Heart size={18} fill={saved ? "currentColor" : "none"} strokeWidth={1.7} /></button>
      {product.model ? <span className="product-3d"><Box size={12} aria-hidden="true" /> 3D үзэх</span> : null}
    </div>
    <div className="product-info">
      <div className="product-meta">
        <span>{CATEGORY_LABEL[product.category]}</span>
      </div>
      <h3><Link href={`/product/${product.id}`}>{product.name}</Link></h3>
      {product.reviewCount > 0 && Number.isFinite(product.rating) && product.rating > 0 ? <div className="product-rating" aria-label={`${product.rating} үнэлгээ, ${product.reviewCount} сэтгэгдэл`}><Star size={12} fill="currentColor" aria-hidden="true" />{product.rating.toFixed(1)}<small>· {product.reviewCount} сэтгэгдэл</small></div> : <span className="product-unrated">Шинэ сонголт</span>}
      {inStock && displayPrice >= FREE_SHIPPING_THRESHOLD ? <span className="product-free-delivery"><Truck size={12} aria-hidden="true" />Үнэгүй хүргэлт</span> : null}
      <p className="product-size">{Math.round(product.dimensions.w * 100)} × {Math.round(product.dimensions.d * 100)} × {Math.round(product.dimensions.h * 100)} см</p>
      <div className="product-option-row">
        {product.colors.length > 0 ? <div className="product-swatches" aria-label="Боломжтой өнгөнүүд">{product.colors.slice(0, 4).map(c => <span key={c.id} title={c.name} role="img" aria-label={c.name} style={{ backgroundColor: c.hex }} />)}{product.colors.length > 4 ? <small>+{product.colors.length - 4}</small> : null}</div> : null}
        {offer.label && offer.discountPercent !== null ? <span className="product-promotion-note">{offer.label}</span> : null}
      </div>
      <div className="product-price">
        <div className="product-price-values">
          {offer.compareAtPrice !== null ? <del aria-label={`Өмнөх үнэ ${marketplacePrice(offer.compareAtPrice)}`}>{marketplacePrice(offer.compareAtPrice)}</del> : null}
          <strong>{marketplacePrice(displayPrice)}</strong>
        </div>
        <button type="button" className="product-add-cart" onClick={addToCart} disabled={!inStock || !selection}
          aria-label={`${product.name} — үндсэн сонголтоор сагсанд нэмэх`}
          title={selection ? `${selection.color.name} · ${selection.material.name}` : "Дэлгэрэнгүйгээс сонголтыг шалгана уу"}>
          {cartMessage === "Сагсанд нэмэгдлээ" ? <Check size={18} aria-hidden="true" /> : <Plus size={19} aria-hidden="true" />}
        </button>
      </div>
      <div className="product-availability"><span aria-hidden="true" className={inStock ? "stock-dot available" : "stock-dot"} /><span className={inStock ? "in-stock" : "out-of-stock"}>{stockLabel(product)}</span></div>
      {flashSale && <div className="product-stock-bar" aria-hidden="true"><span className={inStock ? "available" : ""} /></div>}
      <span className={cartMessage ? "product-cart-message" : "sr-only"} role="status" aria-live="polite">{cartMessage}</span>
      {product.deliveryTerms ? <p className="product-delivery" title={product.deliveryTerms}><Truck size={13} aria-hidden="true" /><span>{product.deliveryTerms}</span></p> : null}
    </div>
  </article>;
}

