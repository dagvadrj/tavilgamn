"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Heart,
  Plus,
  Minus,
  Star,
  ImageIcon,
  Box,
  Check,
  ShoppingBag,
  ChevronRight,
  Hand,
  Camera,
  Truck,
  ArrowUpRight,
  MessageSquare,
} from "lucide-react";
import type { Product } from "@/lib/types";
import { productSpecificationRows } from "@/lib/productSpecifications";
import { priceFor, CATEGORY_LABEL } from "@/lib/products";
import { formatPrice, cn } from "@/lib/format";
import { useCart } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";

import { availableStock, quantityLimit, stockLabel } from "@/lib/inventory";
import { modelDeliveryUrl, prefetchModel } from "@/lib/modelPrefetch";
import { productOffer } from "@/lib/catalogPresentation";
import { FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING_FEE } from "@/lib/orders";
import type { Group } from "three";
import { ProductScaleHUD } from "./ProductScaleHUD";
import { ProductFinancingOptions } from "./ProductFinancingOptions";
import { ProductFinancing } from "./ProductFinancing";

const ProductAR = dynamic(
  () => import("./ProductAR").then((module) => module.ProductAR),
  { ssr: false },
);

const ProductViewer = dynamic(
  () => import("@/three/ProductViewer").then((m) => m.ProductViewer),
  { ssr: false, loading: () => <ViewerSkeleton /> },
);

const detailTabs = [
  { id: "specifications", label: "Бүтээгдэхүүний үзүүлэлт" },
  { id: "description", label: "Дэлгэрэнгүй тайлбар" },
  { id: "delivery", label: "Хүргэлт" },
  { id: "reviews", label: "Сэтгэгдэл" },
] as const;
type DetailTab = (typeof detailTabs)[number]["id"];

function ViewerSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#F4F4F5]">
      <div className="text-sm text-[#68686F]">3D дүрсийг бэлдэж байна…</div>
    </div>
  );
}

export function ProductCustomizer({
  product,
  initialView3D = false,
  initialColor,
}: {
  product: Product;
  initialView3D?: boolean;
  initialColor?: string;
}) {
  const galleryImages = useMemo(
    () => Array.from(new Set([product.image, ...(product.images ?? [])])),
    [product.image, product.images],
  );
  const [color, setColor] = useState(
    product.colors.some((option) => option.id === initialColor)
      ? initialColor!
      : product.defaultColor,
  );
  const [viewerRequested, setViewerActive] = useState(initialView3D);
  const viewerActive = Boolean(product.model) && viewerRequested;
  const [arScene, setArScene] = useState<Group | null>(null);
  const [arOpen, setArOpen] = useState(false);
  const handleRootReady = useCallback(
    (root: Group | null) => setArScene(root),
    [],
  );
  const openAR = () => {
    if (!product.model) return;
    setViewerActive(true);
    setArOpen(true);
  };
  useEffect(() => {
    if (initialView3D) setViewerActive(true);
  }, [initialView3D]);
  const [material, setMaterial] = useState(product.materials[0].id);
  const [qty, setQty] = useState(1);
  const [detailTab, setDetailTab] = useState<DetailTab>("specifications");
  const stock = availableStock(product);
  const openDetailTab = (tab: DetailTab) => {
    setDetailTab(tab);
    document
      .getElementById("product-details")
      ?.scrollIntoView({ block: "start" });
  };
  useEffect(() => {
    const syncHash = () => {
      const tab = detailTabs.find(
        ({ id }) => window.location.hash === `#product-${id}`,
      );
      if (tab) {
        setDetailTab(tab.id);
        requestAnimationFrame(() =>
          document
            .getElementById("product-details")
            ?.scrollIntoView({ block: "start" }),
        );
      }
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    return () => window.removeEventListener("hashchange", syncHash);
  }, []);
  const [selectedImage, setSelectedImage] = useState(galleryImages[0]);
  const [viewerReady, setViewerReady] = useState(false);
  const [viewerError, setViewerError] = useState(false);
  const [showViewerHint, setShowViewerHint] = useState(false);
  const [added, setAdded] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [offerNow, setOfferNow] = useState<number | undefined>();
  useEffect(() => {
    setMounted(true);
    setOfferNow(Date.now());
  }, []);
  useEffect(() => {
    if (!product.promotionEndsAt) return;
    const expires = Date.parse(product.promotionEndsAt);
    if (!Number.isFinite(expires) || expires <= Date.now()) return;
    const timer = window.setTimeout(
      () => setOfferNow(Date.now()),
      Math.max(0, Math.min(expires - Date.now() + 50, 2_147_483_647)),
    );
    return () => window.clearTimeout(timer);
  }, [product.promotionEndsAt, offerNow]);
  useEffect(() => {
    if (!product.model || !viewerActive) return;
    void prefetchModel(
      modelDeliveryUrl(
        product.model.id,
        product.model.file,
      ),
    );
  }, [product.model, viewerActive]);
  useEffect(() => {
    setAdded(false);
  }, [color, material, qty]);
  useEffect(() => {
    setSelectedImage(galleryImages[0]);
  }, [galleryImages]);
  useEffect(() => {
    if (!showViewerHint) return;
    const timeout = window.setTimeout(() => setShowViewerHint(false), 4200);
    return () => window.clearTimeout(timeout);
  }, [showViewerHint]);
  const cartItems = useCart((s) => s.items);
  const limit = mounted
    ? quantityLimit(product, cartItems, { color, material })
    : 0;
  const [stockError, setStockError] = useState("");
  const add = useCart((s) => s.add);
  const inWish = useWishlist((s) => s.has(product.id));
  const toggleWish = useWishlist((s) => s.toggle);

  const price = useMemo(
    () => priceFor(product, color, material),
    [product, color, material],
  );
  const selectedColor = product.colors.find((c) => c.id === color);
  const offer = productOffer(product, offerNow);
  const selectedMaterial = product.materials.find((m) => m.id === material);
  const colorHex = selectedColor?.hex ?? "#C9A37A";
  const handleViewerReady = useCallback(() => {
    setViewerError(false);
    setViewerReady(true);
    setShowViewerHint(true);
  }, []);
  const handleViewerError = useCallback(() => {
    setViewerError(true);
    setViewerReady(true);
    setShowViewerHint(false);
  }, []);

  const onAdd = () => {
    if (
      qty >
      quantityLimit(product, useCart.getState().items, { color, material })
    ) {
      setStockError(
        "Нөөц хүрэлцэхгүй байна. Сагсны тоо болон сонгосон ширхэгээ шалгана уу.",
      );
      return;
    }
    setStockError("");

    add({
      productId: product.id,
      name: product.name,
      image: product.image,
      color,
      material,
      unitPrice: price,
      stockQuantity: availableStock(product),
      qty,
    });
    setAdded(true);
  };

  return (
    <section className="shop-container pdp-experience py-5 sm:py-8">
      {arOpen && (
        <ProductAR
          scene={arScene}
          name={product.name}
          selectionKey={`${color}:${material}`}
          close={() => setArOpen(false)}
        />
      )}
      <nav className="breadcrumbs" aria-label="Хуудасны зам">
        <Link href="/">Нүүр</Link>
        <ChevronRight size={12} />
        <Link href="/catalog">Тавилга</Link>
        <ChevronRight size={12} />
        <Link href={"/catalog/" + product.category}>
          {CATEGORY_LABEL[product.category]}
        </Link>
        <ChevronRight size={12} />
        <span>{product.name}</span>
      </nav>
      <div className="pdp-main-grid">
        <div className="pdp-media-column">
          <section className="pdp-gallery-card">
            <div className="pdp-gallery-toolbar">
              <h2 className="flex items-center gap-2 text-sm font-medium text-[#111111]">
                <Box className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
                {viewerActive ? "Интерактив 3D загвар" : "Барааны зураг"}
              </h2>
              <div
                className="pdp-view-modes"
                role="group"
                aria-label="Бараа харах горим"
              >
                <button
                  type="button"
                  aria-pressed={!viewerActive}
                  onClick={() => {
                    setViewerActive(false);
                    setViewerReady(false);
                    setViewerError(false);
                  }}
                >
                  <ImageIcon size={14} aria-hidden="true" />
                  Фото
                </button>
                <button
                  type="button"
                  aria-pressed={viewerActive}
                  disabled={!product.model}
                  title={
                    !product.model
                      ? "3D загвар хараахан бэлэн болоогүй"
                      : undefined
                  }
                  onClick={() => setViewerActive(true)}
                >
                  <Box size={14} aria-hidden="true" />
                  3D
                </button>
              </div>
            </div>
            <div className="product-gallery pdp-hero-image relative overflow-hidden">
              {viewerActive && (
                <ProductViewer
                  stockQuantity={product.stockQuantity}
                  showStockBadge={false}
                  model={product.model}
                  color={colorHex}
                  material={material}
                  dimensions={product.dimensions}
                  onReady={handleViewerReady}
                  onError={handleViewerError}
                  onRootReady={handleRootReady}
                />
              )}
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 z-10 bg-[#F4F4F5] transition-opacity duration-700",
                  viewerActive && viewerReady ? "opacity-0" : "opacity-100",
                )}
                aria-hidden={viewerActive}
              >
                <Image
                  src={selectedImage}
                  alt={viewerActive ? "" : product.name}
                  fill
                  priority
                  sizes="(max-width: 1023px) 100vw, 55vw"
                  className="object-contain"
                />
                <div className="pdp-photo-caption">
                  <p className="text-sm font-medium">
                    {viewerActive
                      ? "3D загварыг ачаалж байна…"
                      : product.model
                        ? "Өнгө, хэмжээ, загвараа 3D-ээр хараарай"
                        : "Барааны зураг"}
                  </p>
                  {viewerActive && (
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/30">
                      <span className="viewer-loading-bar block h-full w-1/3 rounded-full bg-white" />
                    </div>
                  )}
                </div>
              </div>
              {!viewerActive && product.model && (
                <button
                  type="button"
                  onClick={() => setViewerActive(true)}
                  className="pdp-photo-3d-entry"
                >
                  <Box size={18} aria-hidden="true" />
                  3D-ээр үзэх
                </button>
              )}
              {viewerError && (
                <p
                  className="pointer-events-none absolute inset-x-4 bottom-4 z-20 rounded-xl bg-white/95 px-4 py-3 text-center text-sm text-[#2563EB] shadow-lg"
                  role="status"
                >
                  3D загвар ачаалагдсангүй. Дэлгэц дээрх дахин ачаалах товчийг
                  ашиглана уу.
                </p>
              )}
              <div
                className={cn(
                  "pointer-events-none absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-500",
                  viewerReady && showViewerHint ? "opacity-100" : "opacity-0",
                )}
                aria-hidden="true"
              >
                <div className="viewer-drag-hint flex animate-[pulse_5s_infinite] flex-col items-center gap-2 rounded-2xl bg-[#111111]/75 px-5 py-4 text-white shadow-xl backdrop-blur-sm">
                  <span className="viewer-drag-hand inline-flex">
                    <Hand className="h-7 w-7" />
                  </span>
                  <span className="text-xs font-medium">Чирж эргүүлнэ</span>
                </div>
              </div>
            </div>
          </section>
          <div
            className="pdp-thumbnails"
            role="group"
            aria-label="Барааны зураг сонгох"
          >
            {galleryImages.map((image, index) => (
              <button
                key={image}
                type="button"
                onClick={() => {
                  setSelectedImage(image);
                  setViewerActive(false);
                  setViewerReady(false);
                  setViewerError(false);
                }}
                aria-label={`${index + 1}-р зураг харах`}
                aria-pressed={!viewerActive && selectedImage === image}
                className={cn(
                  "relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border-2 bg-[#F4F4F5] transition sm:h-24 sm:w-28",
                  !viewerActive && selectedImage === image
                    ? "border-[#2563EB] shadow-[0_0_0_2px_rgba(66,99,79,.12)]"
                    : "border-transparent opacity-75 hover:opacity-100",
                )}
              >
                <Image
                  src={image}
                  alt=""
                  fill
                  sizes="112px"
                  className="object-cover"
                />
                <span className="absolute bottom-1.5 left-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-[#111111]/75 px-1 text-[10px] text-white">
                  {index + 1}
                </span>
              </button>
            ))}
          </div>

          <div className="pdp-viewer-tools">
            <p role="status">
              {selectedColor?.name} · {selectedMaterial?.name}
              <small>
                {!product.model
                  ? "Энэ барааны 3D загвар хараахан бэлэн болоогүй."
                  : viewerActive
                    ? "Өнгө, материал 3D-д шууд шинэчлэгдэнэ"
                    : "Өнгө эсвэл материал сонгоод 3D-д үзээрэй"}
              </small>
            </p>
            <button
              type="button"
              className="pdp-ar-entry"
              disabled={!product.model}
              onClick={openAR}
              aria-haspopup="dialog"
            >
              <Camera size={18} aria-hidden="true" />
              Камераараа өрөөндөө байрлуулах (AR)
            </button>
            {!product.model && (
              <span className="pdp-ar-unavailable">
                AR ашиглахад барааны 3D модел шаардлагатай.
              </span>
            )}
          </div>

          <div className="pdp-dimensions">
            <ProductScaleHUD product={product} />
          </div>
        </div>

        <div className="pdp-summary  min-w-0 text-[#111111] [&_button]:focus-visible:outline [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-4 [&_button]:focus-visible:outline-[#2563EB]">
          <div className="pdp-product-meta">
            <span className="pdp-category-label">
              {CATEGORY_LABEL[product.category]}
            </span>
            <div
              className="pdp-stock-indicator "
              data-low={stock > 0 && stock <= 3}
              role="status"
              aria-label={stockLabel(product)}
            >
              <span>
                {product.stockQuantity == null ? (
                  "Нөөц шалгаж байна"
                ) : stock > 0 ? (
                  <>
                    <strong>{stock}</strong> ширхэг бэлэн
                  </>
                ) : (
                  "Нөөц дууссан"
                )}
              </span>
              <span
                className="pdp-stock-blocks"
                aria-hidden="true"
                title="Нэг тэмдэглэгээ = 1 ширхэг, 10 хүртэл"
              >
                {Array.from({ length: 10 }, (_, index) => (
                  <i key={index} data-filled={index < stock} />
                ))}
              </span>
            </div>
          </div>
          <h1 className="mt-4 break-words text-3xl font-semibold leading-[1.18] tracking-[-.03em] sm:text-4xl">
            {product.name}
          </h1>
          <div className="pdp-rating-row">
            <div className="pdp-price-card">
              <p className="text-xs font-medium uppercase tracking-[.1em] text-[#68686F]">
                Сонголтын үнэ
              </p>
              <p className="mt-1 text-3xl font-semibold tabular-nums text-[#111111]">
                {formatPrice(price)}
              </p>
              {offer.compareAtPrice != null && price === product.basePrice && (
                <p className="mt-2 flex flex-wrap items-center gap-3 text-sm">
                  <del className="text-[#68686F]">
                    {formatPrice(offer.compareAtPrice)}
                  </del>
                  {offer.discountPercent && (
                    <span className="rounded-md bg-[#EFF6FF] px-2 py-1 text-xs font-medium text-[#2563EB]">
                      −{offer.discountPercent}%
                    </span>
                  )}
                </p>
              )}
              {offer.label && (
                <p className="mt-2 text-sm text-[#2563EB]">
                  {offer.label}
                  {price !== product.basePrice &&
                    " · үндсэн загварын урамшуулал"}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => toggleWish(product.id)}
              aria-label="Хүслийн жагсаалт"
              aria-pressed={mounted && inWish}
              className={cn(
                "inline-flex min-h-11 items-center gap-2 rounded-full border px-4 text-sm transition",
                mounted && inWish
                  ? "border-[#2563EB] bg-[#2563EB]/10 text-[#2563EB]"
                  : "border-[#111111]/15 hover:bg-[#111111]/5",
              )}
            >
              <Heart
                className={cn("h-4 w-4", mounted && inWish && "fill-current")}
                aria-hidden="true"
              />
              {mounted && inWish ? "Хадгалсан" : "Хадгалах"}
            </button>
          </div>

          <fieldset className="pdp-option-group">
            <legend className="mb-3 flex w-full items-center justify-between gap-3 pr-1 text-sm font-medium">
              <span className="flex items-center gap-2">Өнгө</span>
              <span className="font-normal text-[#68686F]">
                {selectedColor?.name}
              </span>
            </legend>
            <div className="pdp-color-swatches">
              {product.colors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setColor(c.id);
                    setViewerActive(true);
                  }}
                  aria-pressed={color === c.id}
                  aria-label={c.name}
                  title={c.name}
                  className="pdp-color-swatch"
                >
                  <span
                    className="pdp-color-dot"
                    style={{ backgroundColor: c.hex }}
                  />
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="pdp-option-group">
            <legend className="mb-3 flex w-full items-center justify-between gap-3 pr-1 text-sm font-medium">
              <span className="flex items-center gap-2">Материал</span>
              <span className="font-normal text-[#68686F]">
                {selectedMaterial?.name}
              </span>
            </legend>
            <div className="pdp-material-choices">
              {product.materials.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMaterial(m.id);
                    setViewerActive(true);
                  }}
                  aria-pressed={material === m.id}
                  className="pdp-material-choice"
                >
                  <span>{m.name}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="product-purchase pdp-purchase-card">
            <div className="pdp-quantity-row">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  Тоо ширхэг
                </p>
              </div>
              <div
                className="flex items-center rounded-full border border-[#111111]/15"
                role="group"
                aria-label="Тоо ширхэг"
              >
                <button
                  type="button"
                  aria-label="Тоо ширхэг хасах"
                  disabled={qty <= 1 || !product.inStock}
                  onClick={() => setQty((value) => Math.max(1, value - 1))}
                  className="grid h-11 w-11 place-items-center rounded-full transition hover:bg-[#111111]/5 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <span
                  className="min-w-8 px-1 text-center text-sm tabular-nums"
                  aria-live="polite"
                >
                  {qty}
                </span>
                <button
                  type="button"
                  aria-label="Тоо ширхэг нэмэх"
                  disabled={qty >= limit}
                  onClick={() => setQty((value) => Math.min(limit, value + 1))}
                  className="grid h-11 w-11 place-items-center rounded-full transition hover:bg-[#111111]/5 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div
              className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-[#111111]/10 pt-4"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="text-sm text-[#68686F]">
                Нийт · {qty} ширхэг
              </span>
              <strong className="text-2xl font-semibold tabular-nums text-[#111111]">
                {formatPrice(price * qty)}
              </strong>
            </div>
            <div className="pdp-purchase-actions mt-5 flex gap-2">
              <button
                type="button"
                onClick={onAdd}
                disabled={limit < 1 || qty > limit}
                className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {added ? <Check size={17} /> : <ShoppingBag size={17} />}
                {added
                  ? "Дахин нэмэх"
                  : product.stockQuantity == null
                    ? "Нөөц шалгаж байна"
                    : product.inStock
                      ? "Сагсанд нэмэх"
                      : "Нөөц дууссан"}
              </button>
              <Link href="/planner" className="pdp-room-link">
                <Box size={16} aria-hidden="true" />
                Өрөөнд үзэх
              </Link>
            </div>
            {stockError && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                {stockError}
              </p>
            )}
            {limit < qty && (
              <p className="mt-3 text-sm text-[#2563eb]">
                {product.stockQuantity == null
                  ? "Үлдэгдэл баталгаажсаны дараа сагсанд нэмэх боломжтой."
                  : limit === 0
                    ? "Нөөц хүрэлцэхгүй эсвэл боломжтой бүх ширхэг сагсанд байна."
                    : "Сагсанд нэмж болох тоо: " +
                      limit +
                      ". Тоо ширхэгээ бууруулна уу."}
              </p>
            )}
            <div role="status" aria-live="polite">
              {added && (
                <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#2563eb]">
                  <Check size={15} />
                  Сагсанд нэмэгдлээ.
                  <Link
                    href="/cart"
                    className="min-h-11 inline-flex items-center font-medium underline"
                  >
                    Сагсаа үзэх →
                  </Link>
                </p>
              )}
            </div>
          </div>
          <ProductFinancingOptions total={price * qty} />
          <a
            href="#product-delivery"
            className="pdp-delivery-link"
            onClick={(event) => {
              event.preventDefault();
              openDetailTab("delivery");
            }}
          >
            <Truck size={18} aria-hidden="true" />
            <span>Хүргэлт ба захиалгын нөхцөл</span>
            <ArrowUpRight size={16} aria-hidden="true" />
          </a>
        </div>
      </div>
      <div id="product-details" className="pdp-details-area">
        <div className="pdp-details-navigation">
          <div
            className="pdp-section-nav"
            role="tablist"
            aria-label="Барааны дэлгэрэнгүй мэдээлэл"
          >
            {detailTabs.map((tab, index) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`product-tab-${tab.id}`}
                aria-controls={`product-${tab.id}`}
                aria-selected={detailTab === tab.id}
                tabIndex={detailTab === tab.id ? 0 : -1}
                onClick={() => setDetailTab(tab.id)}
                onKeyDown={(event) => {
                  let next: number;
                  if (event.key === "ArrowRight")
                    next = (index + 1) % detailTabs.length;
                  else if (event.key === "ArrowLeft")
                    next = (index + detailTabs.length - 1) % detailTabs.length;
                  else if (event.key === "Home") next = 0;
                  else if (event.key === "End") next = detailTabs.length - 1;
                  else return;
                  event.preventDefault();
                  setDetailTab(detailTabs[next].id);
                  document
                    .getElementById(`product-tab-${detailTabs[next].id}`)
                    ?.focus();
                }}
              >
                {tab.label}
                {tab.id === "reviews" && (
                  <span className="pdp-review-count">
                    {product.reviewCount}
                  </span>
                )}
              </button>
            ))}
          </div>
          <a className="pdp-financing-shortcut" href="#product-financing">
            Зээлийн нөхцөл <ArrowUpRight size={14} aria-hidden="true" />
          </a>
        </div>
        <section
          id="product-specifications"
          className="pdp-specifications"
          role="tabpanel"
          aria-labelledby="product-tab-specifications"
          hidden={detailTab !== "specifications"}
          tabIndex={0}
        >
          <h2
            id="product-specifications-heading"
            className="mb-3 text-lg font-semibold"
          >
            Бүтээгдэхүүний үзүүлэлт
          </h2>
          <table className="w-full table-fixed text-left text-sm">
            <colgroup>
              <col style={{ width: "32%" }} />
              <col />
            </colgroup>
            <thead>
              <tr className="border-b border-[#111111]/10">
                <th scope="col" className="w-2/5 py-3 pr-3">
                  Үзүүлэлт
                </th>
                <th scope="col" className="py-3">
                  Мэдээлэл
                </th>
              </tr>
            </thead>
            <tbody>
              {productSpecificationRows(product).map((row) => (
                <tr key={row.label} className="border-b border-[#111111]/10">
                  <th
                    scope="row"
                    className="py-3 pr-3 font-normal text-[#68686F]"
                  >
                    {row.label}
                  </th>
                  <td className="break-words py-3">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section
          id="product-description"
          className="pdp-information-card"
          role="tabpanel"
          aria-labelledby="product-tab-description"
          hidden={detailTab !== "description"}
          tabIndex={0}
        >
          <h2>Дэлгэрэнгүй тайлбар</h2>
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-[#68686F]">
            {product.description ||
              "Дэлгэрэнгүй тайлбар хараахан нэмэгдээгүй байна."}
          </p>
        </section>
        <section
          id="product-delivery"
          className="pdp-information-card"
          role="tabpanel"
          aria-labelledby="product-tab-delivery"
          hidden={detailTab !== "delivery"}
          tabIndex={0}
        >
          <h2>Хүргэлт ба захиалгын нөхцөл</h2>
          <div className="mt-3 space-y-2 text-xs leading-relaxed text-[#68686F]">
            {product.deliveryTerms && (
              <p className="whitespace-pre-wrap break-words">
                Дэлгүүрийн нөхцөл: {product.deliveryTerms}
              </p>
            )}
            <p>
              Хүргэлтийн төлбөр: захиалгын барааны дүн{" "}
              {formatPrice(FREE_SHIPPING_THRESHOLD)}-өөс бага бол{" "}
              {formatPrice(STANDARD_SHIPPING_FEE)}, түүнээс дээш бол 0₮.
              Баталгаажуулах дэлгэцийн нийт дүнг шалгана уу.
            </p>
            <p>
              Хүргэлтэд гарахаас өмнө цуцлах хүсэлт гаргаж болно. Төлбөр төлсөн
              бол админ шалгаж, мөнгөний буцаалтыг тусад нь бүртгэнэ. Хүргэлтэд
              гарсан барааны буцаалтаар бидэнтэй холбоо барина уу.
            </p>
            <Link
              className="inline-block min-h-11 pt-3 underline"
              href="/about#contact"
            >
              Хүргэлтийн бүс, хугацааг лавлах
            </Link>
          </div>
        </section>
        <section
          id="product-reviews"
          className="pdp-information-card pdp-reviews-panel"
          role="tabpanel"
          aria-labelledby="product-tab-reviews"
          hidden={detailTab !== "reviews"}
          tabIndex={0}
        >
          {product.reviewCount > 0 ? (
            <>
              <div className="pdp-review-summary">
                <Star size={24} aria-hidden="true" />
                <strong>{product.rating.toFixed(1)}</strong>
                <span>/ 5 · {product.reviewCount} сэтгэгдэл</span>
              </div>
              <p>
                Сэтгэгдлийн дэлгэрэнгүй мэдээлэл хараахан нэмэгдээгүй байна.
              </p>
            </>
          ) : (
            <>
              <MessageSquare size={28} aria-hidden="true" />
              <h2>Сэтгэгдэл хараахан байхгүй</h2>
              <p>
                Энэ бүтээгдэхүүнд одоогоор үнэлгээ, сэтгэгдэл нэмэгдээгүй байна.
              </p>
            </>
          )}
        </section>
      </div>
      <ProductFinancing total={price * qty} />
    </section>
  );
}
