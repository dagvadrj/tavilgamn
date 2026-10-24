"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Heart, Star, ShoppingBag, Check, Box } from "lucide-react";
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
import { cardImageSourceWidth } from "@/lib/cardImageResolution";

export function ProductCard({
  product,
  catalogStyle = false,
  offerCheckedAt,
  flashSale = false,
  imageSizes,
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
  const [loadedPhoto, setLoadedPhoto] = useState<{
    element: HTMLImageElement;
    naturalWidth: number;
    naturalHeight: number;
  } | null>(null);
  const [sourceWidth, setSourceWidth] = useState(0);
  useEffect(() => {
    if (!loadedPhoto) return;
    const container = loadedPhoto.element.closest(".gallery-photo-trigger");
    if (!container) return;
    const updateResolution = () => {
      const bounds = container.getBoundingClientRect();
      const nextWidth = cardImageSourceWidth({
        width: bounds.width,
        height: bounds.height,
        naturalWidth: loadedPhoto.naturalWidth,
        naturalHeight: loadedPhoto.naturalHeight,
        fit: getComputedStyle(loadedPhoto.element).objectFit,
      });
      if (nextWidth > 0) setSourceWidth(nextWidth);
    };
    updateResolution();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(updateResolution);
    observer.observe(container);
    return () => observer.disconnect();
  }, [loadedPhoto, product.image]);
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
      ? "(max-width: 767px) 46vw, (max-width: 999px) 33vw, 310px"
      : catalogStyle
        ? "(max-width: 767px) 46vw, (max-width: 999px) 45vw, 30vw"
        : "(max-width: 767px) 46vw, (max-width: 999px) 30vw, 280px");
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
      madeToOrder: product.madeToOrder,
    });
    setCartMessage(
      added ? "Сагсанд нэмэгдлээ" : "Сагс дахь тоо үлдэгдлийн хязгаарт хүрсэн",
    );
  };

  return (
    <article className="product-card marketplace-product-card product-card-premium gallery-product-card clean-product-card">
      <div className="product-photo">
        <Link
          className="gallery-photo-trigger"
          href={detailHref}
          aria-label={`${product.name} — дэлгэрэнгүй үзэх`}
        >
          {hasProductPhoto(product) ? (
            <>
              <Image
                src={product.image}
                alt={product.name}
                fill
                sizes={sourceWidth > 0 ? `${sourceWidth}px` : sizes}
                quality={95}
                onLoad={(event) =>
                  setLoadedPhoto({
                    element: event.currentTarget,
                    naturalWidth: event.currentTarget.naturalWidth,
                    naturalHeight: event.currentTarget.naturalHeight,
                  })
                }
                className="product-primary-image"
              />
            </>
          ) : (
            <span className="product-photo-pending">
              <Box size={28} aria-hidden="true" />
              Зураг нэмэгдээгүй
            </span>
          )}
        </Link>
      </div>
      <div className="gallery-card-topline">
        <span
          className={`product-badge${offer.discountPercent !== null ? " offer" : ""}`}
        >
          {badge}
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
      <div className="gallery-product-info">
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
            aria-label={`${product.name} — сонгосон өнгөөр сагслах`}
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
