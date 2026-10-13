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
  Truck,
  Ruler,
  ArrowUpRight,
} from "lucide-react";
import type { Product } from "@/lib/types";
import {
  defaultCartSelection,
  hasProductPhoto,
  marketplacePrice,
} from "@/lib/homeMarketplace";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/orders";
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
}: {
  product: Product;
  catalogStyle?: boolean;
  offerCheckedAt?: number;
  flashSale?: boolean;
}) {
  const has = useWishlist((s) => s.has(product.id));
  const toggle = useWishlist((s) => s.toggle);
  const add = useCart((state) => state.add);
  const [cartMessage, setCartMessage] = useState("");
  const [mounted, setMounted] = useState(false);
  const [checkedAt, setCheckedAt] = useState(offerCheckedAt);
  const [colorId, setColorId] = useState(product.defaultColor);
  const [quickViewOpen, setQuickViewOpen] = useState(false);
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
  const secondaryImage = product.images?.find(
    (image) => image !== product.image && hasProductPhoto({ image }),
  );
  const sizes = flashSale
    ? "(max-width: 639px) 72vw, (max-width: 999px) 33vw, 310px"
    : catalogStyle
      ? "(max-width: 639px) 50vw, (max-width: 1023px) 33vw, (max-width: 1439px) 26vw, 340px"
      : "(max-width: 639px) 50vw, (max-width: 999px) 33vw, 320px";
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

  return (
    <article className="product-card marketplace-product-card product-card-premium">
      <div className={`product-photo ${secondaryImage ? "has-secondary" : ""}`}>
        <Link href={detailHref} aria-label={`${product.name} дэлгэрэнгүй үзэх`}>
          {hasProductPhoto(product) ? (
            <>
              <Image
                src={product.image}
                alt={product.name}
                fill
                sizes={sizes}
                className="product-primary-image"
              />
              {secondaryImage && (
                <Image
                  src={secondaryImage}
                  alt=""
                  aria-hidden="true"
                  fill
                  sizes={sizes}
                  className="product-secondary-image"
                />
              )}
            </>
          ) : (
            <span className="product-photo-pending">
              <Box size={28} aria-hidden="true" />
              Зураг нэмэгдээгүй
            </span>
          )}
        </Link>
        <div className="product-badge-stack">
          {badge && (
            <span
              className={`product-badge ${offer.compareAtPrice !== null || offer.label ? "offer" : product.isNew ? "new" : ""}`}
            >
              {badge}
            </span>
          )}
          {product.isBestSeller &&
            (offer.discountPercent !== null ||
              offer.label ||
              product.isNew) && (
              <span className="product-badge bestseller">Эрэлттэй</span>
            )}
        </div>
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
            strokeWidth={1.7}
            aria-hidden="true"
          />
        </button>
        <div className="product-media-actions">
          {product.model && (
            <button
              type="button"
              onClick={() => setQuickViewOpen(true)}
              aria-haspopup="dialog"
              className="product-3d"
              aria-label={`${product.name} — 3D үзэх, шуурхай харах цонх нээх`}
            >
              <Box size={14} aria-hidden="true" />
              3D / AR харах
            </button>
          )}
          <Link
            href={detailHref}
            className="product-details-link"
            aria-label={`${product.name} — дэлгэрэнгүй`}
          >
            Дэлгэрэнгүй <ArrowUpRight size={14} aria-hidden="true" />
          </Link>
        </div>
      </div>
      <div className="product-info">
        <div className="product-meta">
          <Link href={`/catalog/${product.category}`}>
            {CATEGORY_LABEL[product.category]}
          </Link>
          {product.reviewCount > 0 &&
            Number.isFinite(product.rating) &&
            product.rating > 0 && (
              <div
                className="product-rating"
                aria-label={`${product.rating} үнэлгээ, ${product.reviewCount} сэтгэгдэл`}
              >
                <Star size={12} fill="currentColor" aria-hidden="true" />
                {product.rating.toFixed(1)}
                <small>({product.reviewCount})</small>
                <span className="sr-only">{product.reviewCount} сэтгэгдэл</span>
              </div>
            )}
        </div>
        <h3>
          <Link href={detailHref}>{product.name}</Link>
        </h3>
        <p className="product-size">
          <Ruler size={14} aria-hidden="true" />
          {Math.round(product.dimensions.w * 100)} ×{" "}
          {Math.round(product.dimensions.d * 100)} ×{" "}
          {Math.round(product.dimensions.h * 100)} см
        </p>
        {product.colors.length > 0 && (
          <div className="product-option-row">
            <div
              className="product-swatches"
              role="group"
              aria-label={`${product.name} — өнгө сонгох`}
            >
              {product.colors.slice(0, 4).map((c) => (
                <button
                  type="button"
                  key={c.id}
                  title={c.name}
                  aria-label={c.name}
                  aria-pressed={selection?.color.id === c.id}
                  onClick={() => {
                    setColorId(c.id);
                    setCartMessage("");
                  }}
                >
                  <span style={{ backgroundColor: c.hex }} />
                </button>
              ))}
              {product.colors.length > 4 && (
                <Link href={detailHref} aria-label="Бүх өнгийг харах">
                  +{product.colors.length - 4}
                </Link>
              )}
            </div>
            <span className="product-color-name" title={selection?.color.name}>
              {selection?.color.name}
            </span>
          </div>
        )}
        <div className="product-price">
          <div className="product-price-values">
            <strong>{marketplacePrice(displayPrice)}</strong>
            {offer.compareAtPrice !== null && (
              <del
                aria-label={`Өмнөх үнэ ${marketplacePrice(offer.compareAtPrice)}`}
              >
                {marketplacePrice(offer.compareAtPrice)}
              </del>
            )}
          </div>
          {offer.compareAtPrice !== null && (
            <span className="product-saving">
              Хэмнэлт {marketplacePrice(offer.compareAtPrice - displayPrice)}
            </span>
          )}
          {offer.label && offer.discountPercent !== null && (
            <span className="product-promotion-note">{offer.label}</span>
          )}
        </div>
        <div className="card-delivery-status">
          {inStock && displayPrice >= FREE_SHIPPING_THRESHOLD && (
            <span className="product-free-delivery">
              <Truck size={14} aria-hidden="true" />
              Үнэгүй хүргэлт
            </span>
          )}
          <div className="product-availability">
            <span
              aria-hidden="true"
              className={inStock ? "stock-dot available" : "stock-dot"}
            />
            <span className={inStock ? "in-stock" : "out-of-stock"}>
              {stockLabel(product)}
            </span>
          </div>
        </div>
        {product.deliveryTerms && (
          <p className="product-delivery" title={product.deliveryTerms}>
            <Truck size={13} aria-hidden="true" />
            <span>{product.deliveryTerms}</span>
          </p>
        )}
        <div className="product-footer-actions">
          <button
            type="button"
            className="product-add-cart"
            onClick={addToCart}
            disabled={!inStock || !selection}
            aria-label={`${product.name} — сонгосон өнгөөр сагсанд нэмэх`}
            title={
              selection
                ? `${selection.color.name} · ${selection.material.name}`
                : "Дэлгэрэнгүйгээс сонголтыг шалгана уу"
            }
          >
            {cartMessage === "Сагсанд нэмэгдлээ" ? (
              <Check size={17} aria-hidden="true" />
            ) : (
              <ShoppingBag size={17} aria-hidden="true" />
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
              onClick={() => setQuickViewOpen(true)}
              aria-haspopup="dialog"
              className="product-view-model"
              aria-label={`${product.name} — 3D загварын шуурхай харах цонх нээх`}
              title="Шуурхай харах"
            >
              <Box size={18} aria-hidden="true" />
              <span>3D</span>
            </button>
          )}
        </div>
        <span
          className={cartMessage ? "product-cart-message" : "sr-only"}
          role="status"
          aria-live="polite"
        >
          {cartMessage}
        </span>
      </div>
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
