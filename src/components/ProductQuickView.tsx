"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowRight,
  Box,
  Check,
  Hand,
  ImageIcon,
  Loader2,
  Ruler,
  ShoppingBag,
  Star,
  X,
} from "lucide-react";
import type { Product } from "@/lib/types";
import {
  defaultCartSelection,
  hasProductPhoto,
  marketplacePrice,
} from "@/lib/homeMarketplace";
import { hasAvailableStock, stockLabel } from "@/lib/inventory";
import { CATEGORY_LABEL } from "@/lib/products";
import "./product-quick-view.css";

const ProductViewer = dynamic(
  () => import("@/three/ProductViewer").then((module) => module.ProductViewer),
  {
    ssr: false,
    loading: () => (
      <div className="product-quick-loading" role="status">
        <Loader2 size={22} className="animate-spin" aria-hidden="true" />
        3D дүрсийг бэлдэж байна…
      </div>
    ),
  },
);

export function ProductQuickView({
  product,
  price,
  compareAtPrice,
  selection,
  viewHref,
  detailHref,
  cartMessage,
  onAddToCart,
  onClose,
}: {
  product: Product;
  price: number;
  compareAtPrice: number | null;
  selection: ReturnType<typeof defaultCartSelection>;
  viewHref: string;
  detailHref: string;
  cartMessage: string;
  onAddToCart: () => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const backdropPress = useRef(false);
  const [showModel, setShowModel] = useState(Boolean(product.model));
  const [viewerStatus, setViewerStatus] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const handleViewerReady = useCallback(() => setViewerStatus("ready"), []);
  const handleViewerError = useCallback(() => setViewerStatus("error"), []);
  const viewerActive = Boolean(product.model) && showModel;
  const color =
    selection?.color ??
    product.colors?.find((option) => option.id === product.defaultColor) ??
    product.colors?.[0];
  const material = selection?.material ?? product.materials?.[0];
  const inStock = hasAvailableStock(product);
  const added = cartMessage === "Сагсанд нэмэгдлээ";
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    const previous = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    element.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
      if (previous instanceof HTMLElement && previous.isConnected)
        previous.focus();
    };
  }, []);

  return createPortal(
    <dialog
      ref={dialog}
      className="site-ui product-quick-view"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (!dialog.current?.open) onClose();
      }}
      onPointerDown={(event) => {
        backdropPress.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (!backdropPress.current || event.target !== event.currentTarget)
          return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (
          event.clientX < bounds.left ||
          event.clientX > bounds.right ||
          event.clientY < bounds.top ||
          event.clientY > bounds.bottom
        )
          onClose();
      }}
    >
      <div className="product-quick-layout">
        <button
          type="button"
          className="product-quick-close"
          onClick={onClose}
          aria-label="Шуурхай харах цонх хаах"
          autoFocus
        >
          <X size={19} aria-hidden="true" />
        </button>
        <div className="product-quick-photo">
          {viewerActive ? (
            <div className="product-quick-canvas">
              <ProductViewer
                stockQuantity={product.stockQuantity}
                showStockBadge={false}
                model={product.model}
                color={color?.hex ?? "#C9A37A"}
                material={material?.id ?? "fabric"}
                dimensions={product.dimensions}
                onReady={handleViewerReady}
                onError={handleViewerError}
              />
            </div>
          ) : hasProductPhoto(product) ? (
            <Image
              src={product.image}
              alt={product.name}
              fill
              sizes="(max-width: 639px) 95vw, 440px"
            />
          ) : (
            <span>
              <Box size={36} aria-hidden="true" />
              Зураг нэмэгдээгүй
            </span>
          )}
          {viewerActive && (
            <p
              className={`product-quick-viewer-status${viewerStatus === "error" ? " is-error" : ""}`}
              role="status"
              aria-live="polite"
            >
              {viewerStatus === "loading" ? (
                <>
                  <Loader2
                    size={15}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                  3D загварыг ачаалж байна…
                </>
              ) : viewerStatus === "error" ? (
                "3D ачаалагдсангүй. Дахин ачаалах товчийг ашиглана уу."
              ) : (
                <>
                  <Hand size={15} aria-hidden="true" />
                  Чирж эргүүлэх · Ойртуулах
                </>
              )}
            </p>
          )}
        </div>
        <div className="product-quick-content">
          <div className="product-quick-meta">
            <span>{CATEGORY_LABEL[product.category]}</span>
            {product.reviewCount > 0 &&
              Number.isFinite(product.rating) &&
              product.rating > 0 && (
                <span className="product-quick-rating">
                  <Star size={13} fill="currentColor" aria-hidden="true" />
                  <b>{product.rating.toFixed(1)}</b> ({product.reviewCount}{" "}
                  сэтгэгдэл)
                </span>
              )}
          </div>
          <h2 id={titleId}>{product.name}</h2>
          <div className="product-quick-price">
            <strong>{marketplacePrice(price)}</strong>
            {compareAtPrice !== null && (
              <del>{marketplacePrice(compareAtPrice)}</del>
            )}
          </div>
          {product.description && (
            <p className="product-quick-description">{product.description}</p>
          )}
          <div className="product-quick-specs">
            <span>
              <Ruler size={15} aria-hidden="true" />
              {Math.round(product.dimensions.w * 100)} ×{" "}
              {Math.round(product.dimensions.d * 100)} ×{" "}
              {Math.round(product.dimensions.h * 100)} см
            </span>
            {selection && (
              <span className="product-quick-selection">
                <i style={{ backgroundColor: selection.color.hex }} />
                {selection.color.name} · {selection.material.name}
              </span>
            )}
            <span className={inStock ? "is-available" : ""}>
              {stockLabel(product)}
            </span>
          </div>
          <div className="product-quick-actions">
            <button
              type="button"
              className="product-quick-cart"
              disabled={!inStock || !selection}
              onClick={onAddToCart}
            >
              {added ? (
                <Check size={17} aria-hidden="true" />
              ) : (
                <ShoppingBag size={17} aria-hidden="true" />
              )}
              {added ? "Сагсанд нэмэгдлээ" : "Сагсанд нэмэх"}
            </button>
            {product.model && (
              <Link
                className="product-quick-3d"
                href={viewHref}
                onClick={onClose}
              >
                <Box size={17} aria-hidden="true" />
                3D / AR-аар харах <ArrowRight size={16} aria-hidden="true" />
              </Link>
            )}
            <Link
              className="product-quick-details"
              href={added ? "/cart" : detailHref}
              onClick={onClose}
            >
              {added ? "Сагс руу очих" : "Бүтээгдэхүүний дэлгэрэнгүй"}
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </div>
          <p
            className={cartMessage ? "product-quick-message" : "sr-only"}
            role="status"
            aria-live="polite"
          >
            {cartMessage}
          </p>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
