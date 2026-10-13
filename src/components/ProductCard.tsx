"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import {
  Heart,
  Star,
  ShoppingBag,
  Check,
  Box,
  ArrowUpRight,
  X,
} from "lucide-react";
import type { Product } from "@/lib/types";
import {
  defaultCartSelection,
  hasProductPhoto,
  marketplacePrice,
} from "@/lib/homeMarketplace";
import { useCart } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";
import { CATEGORY_LABEL } from "@/lib/products";
import { hasAvailableStock, stockLabel } from "@/lib/inventory";
import { productOffer } from "@/lib/catalogPresentation";
import { ProductQuickView } from "./ProductQuickView";

export function ProductCard({
  product,
  catalogStyle = false,
  offerCheckedAt,
  flashSale = false,
  imageSizes,
  initialDetailsOpen = false,
}: {
  product: Product;
  catalogStyle?: boolean;
  offerCheckedAt?: number;
  flashSale?: boolean;
  imageSizes?: string;
  initialDetailsOpen?: boolean;
}) {
  const has = useWishlist((s) => s.has(product.id));
  const toggle = useWishlist((s) => s.toggle);
  const add = useCart((state) => state.add);
  const [cartMessage, setCartMessage] = useState("");
  const [mounted, setMounted] = useState(false);
  const [checkedAt, setCheckedAt] = useState(offerCheckedAt);
  const [colorId, setColorId] = useState(product.defaultColor);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
  const [detailsPinned, setDetailsPinned] = useState(initialDetailsOpen);
  const [detailsHovered, setDetailsHovered] = useState(false);
  const detailsOpen = detailsPinned || detailsHovered;
  useEffect(() => {
    setMounted(true);
    setCheckedAt(Date.now());
    const expiration = product.promotionEndsAt
      ? Date.parse(product.promotionEndsAt)
      : NaN;
    if (!Number.isFinite(expiration)) return;
    if (expiration <= Date.now()) return;
    let timer: number;
    const checkExpiry = () => {
      const nextCheck = Date.now();
      setCheckedAt(nextCheck);
      if (expiration > nextCheck)
        timer = window.setTimeout(
          checkExpiry,
          Math.min(expiration - nextCheck + 1, 2_147_483_647),
        );
    };
    timer = window.setTimeout(
      checkExpiry,
      Math.min(expiration - Date.now() + 1, 2_147_483_647),
    );
    return () => window.clearTimeout(timer);
  }, [product.promotionEndsAt]);
  const saved = mounted && has;
  const inStock = hasAvailableStock(product);
  const selection = defaultCartSelection({
    ...product,
    defaultColor: colorId ?? product.defaultColor,
  });
  const displayPrice = selection?.unitPrice ?? product.basePrice;
  // The displayed color and price must be the exact selection added to the cart.
  const offer = productOffer(
    { ...product, basePrice: displayPrice },
    checkedAt,
  );
  const badge =
    offer.discountPercent !== null
      ? `−${offer.discountPercent}%`
      : offer.label ||
        (product.isNew
          ? "Шинэ"
          : product.isBestSeller
            ? "Эрэлттэй"
            : product.badges?.[0]);
  const detailHref = `/product/${product.id}${selection ? `?color=${encodeURIComponent(selection.color.id)}` : ""}`;
  const viewHref = `${detailHref}${selection ? "&" : "?"}view=3d`;
  const sizes =
    imageSizes ??
    (flashSale
      ? "(max-width: 639px) 72vw, (max-width: 999px) 33vw, 310px"
      : catalogStyle
        ? "(max-width: 539px) 100vw, (max-width: 999px) 50vw, (max-width: 1439px) 33vw, 440px"
        : "(max-width: 539px) 100vw, (max-width: 999px) 50vw, 360px");
  const addToCart = () => {
    if (!inStock || !selection) return;
    const added = add({
      productId: product.id,
      name: product.name,
      image: product.image,
      color: selection.color.id,
      material: selection.material.id,
      unitPrice: selection.unitPrice,
      stockQuantity: product.stockQuantity,
    });
    setCartMessage(
      added ? "Сагсанд нэмэгдлээ" : "Сагс дахь тоо үлдэгдлийн хязгаарт хүрсэн",
    );
  };

  const toggleDetails = () => {
    setDetailsPinned((value) => !value);
    setDetailsHovered(false);
  };

  return (
    <article
      className={`product-card marketplace-product-card product-card-premium gallery-product-card${detailsOpen ? " is-revealed" : ""}`}
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") setDetailsHovered(true);
      }}
      onPointerLeave={(event) => {
        if (!event.currentTarget.contains(document.activeElement))
          setDetailsHovered(false);
      }}
      onFocus={() => setDetailsHovered(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setDetailsHovered(false);
          setDetailsPinned(false);
        }
      }}
      onKeyDown={(event) => {
        if (event.key !== "Escape" || quickViewOpen) return;
        event.currentTarget
          .querySelector<HTMLButtonElement>(".product-details-toggle")
          ?.focus();
        setDetailsPinned(false);
        setDetailsHovered(false);
      }}
    >
      <div className="product-photo">
        <button
          type="button"
          className="gallery-photo-trigger"
          onClick={toggleDetails}
          aria-label={`${product.name} — нэр, үнийг харах`}
          aria-expanded={detailsOpen}
        >
          {hasProductPhoto(product) ? (
            <>
              <Image
                src={product.image}
                alt={product.name}
                fill
                sizes={sizes}
                quality={90}
                className="product-primary-image"
              />
            </>
          ) : (
            <span className="product-photo-pending">
              <Box size={28} aria-hidden="true" />
              Зураг нэмэгдээгүй
            </span>
          )}
        </button>
      </div>
      <div className="gallery-card-veil" aria-hidden="true" />
      <div className="gallery-card-topline">
        <span
          className={`product-badge${offer.discountPercent !== null ? " offer" : ""}`}
        >
          {badge || CATEGORY_LABEL[product.category]}
        </span>
        <button
          className={`wishlist-toggle ${saved ? "saved" : ""}`}
          type="button"
          onClick={() => toggle(product.id)}
          aria-label={`${product.name}${saved ? " — хадгалснаас хасах" : " — хадгалах"}`}
          aria-pressed={saved}
        >
          <Heart
            size={18}
            fill={saved ? "currentColor" : "none"}
            strokeWidth={1.6}
            aria-hidden="true"
          />
        </button>
      </div>
      <button
        type="button"
        className="product-details-toggle"
        onClick={toggleDetails}
        aria-expanded={detailsOpen}
        aria-label={`${product.name} — ${detailsOpen ? "мэдээлэл хураах" : "дэлгэрэнгүй"}`}
      >
        <span>{detailsOpen ? "Хураах" : "Дэлгэрэнгүй"}</span>
        <span className="gallery-round-arrow">
          {detailsOpen ? (
            <X size={16} aria-hidden="true" />
          ) : (
            <ArrowUpRight size={16} aria-hidden="true" />
          )}
        </span>
      </button>
      <div
        className="gallery-product-info"
        aria-hidden={!detailsOpen}
        inert={!detailsOpen}
      >
        <div className="gallery-info-eyebrow">
          <Link href={`/catalog/${product.category}`}>
            {CATEGORY_LABEL[product.category]}
          </Link>
          {product.reviewCount > 0 &&
            Number.isFinite(product.rating) &&
            product.rating > 0 && (
              <span
                className="product-rating"
                aria-label={`${product.rating} үнэлгээ, ${product.reviewCount} сэтгэгдэл`}
              >
                <Star size={12} fill="currentColor" aria-hidden="true" />
                {product.rating.toFixed(1)}
                <span className="sr-only">{product.reviewCount} сэтгэгдэл</span>
              </span>
            )}
        </div>
        <h3>
          <Link href={detailHref}>{product.name}</Link>
        </h3>
        <div className="product-price">
          <strong>{marketplacePrice(displayPrice)}</strong>
          <span className="gallery-dimensions">
            {Math.round(product.dimensions.w * 100)} ×{" "}
            {Math.round(product.dimensions.d * 100)} ×{" "}
            {Math.round(product.dimensions.h * 100)} см
          </span>
          {offer.compareAtPrice !== null && (
            <del
              aria-label={`Өмнөх үнэ ${marketplacePrice(offer.compareAtPrice)}`}
            >
              {marketplacePrice(offer.compareAtPrice)}
            </del>
          )}
        </div>
        <span className="sr-only">
          {stockLabel(product)}. {product.deliveryTerms} {offer.label}
        </span>
        {product.colors.length > 1 && (
          <div
            className="product-swatches"
            role="group"
            aria-label={`${product.name} — өнгө сонгох`}
          >
            {product.colors.slice(0, 4).map((color) => (
              <button
                type="button"
                key={color.id}
                title={color.name}
                aria-label={color.name}
                aria-pressed={selection?.color.id === color.id}
                onClick={() => {
                  setColorId(color.id);
                  setCartMessage("");
                }}
              >
                <span style={{ backgroundColor: color.hex }} />
              </button>
            ))}
          </div>
        )}
        <div className="gallery-purchase-actions">
          <button
            type="button"
            className="product-add-cart"
            onClick={addToCart}
            disabled={!inStock || !selection}
            aria-label={`${product.name} — сонгосон өнгөөр сагсанд нэмэх`}
            title={
              selection
                ? `${selection.color.name} · ${selection.material.name}`
                : "Сонголт боломжгүй"
            }
          >
            {cartMessage === "Сагсанд нэмэгдлээ" ? (
              <Check size={18} aria-hidden="true" />
            ) : (
              <ShoppingBag size={18} aria-hidden="true" />
            )}
            <span>
              {cartMessage === "Сагсанд нэмэгдлээ"
                ? "Нэмэгдлээ"
                : "Сагсанд нэмэх"}
            </span>
          </button>
          {product.model && (
            <button
              type="button"
              className="product-view-model"
              onClick={() => setQuickViewOpen(true)}
              aria-haspopup="dialog"
              aria-label={`${product.name} — 3D загварын шуурхай харах цонх нээх`}
              title="3D / AR харах"
            >
              <span>3D</span>
            </button>
          )}
        </div>
      </div>
      <span
        className={cartMessage ? "gallery-cart-message" : "sr-only"}
        role="status"
        aria-live="polite"
      >
        {cartMessage}
      </span>
      {quickViewOpen && (
        <ProductQuickView
          product={product}
          price={displayPrice}
          compareAtPrice={offer.compareAtPrice}
          selection={selection}
          viewHref={viewHref}
          detailHref={detailHref}
          cartMessage={cartMessage}
          onAddToCart={addToCart}
          onClose={() => setQuickViewOpen(false)}
        />
      )}
    </article>
  );
}
