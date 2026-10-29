"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import { PlannerLink as Link } from "@/components/PlannerLink";
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
  Ruler,
  Camera,
  Truck,
  ArrowUpRight,
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
import { productGallery } from "@/lib/productGallery";
import { installmentAmounts } from "@/lib/productExperience";
import { FREE_SHIPPING_THRESHOLD, STANDARD_SHIPPING_FEE } from "@/lib/orders";
import type { Group } from "three";
import { ProductScaleHUD } from "./ProductScaleHUD";
import { ProductFinancingOptions } from "./ProductFinancingOptions";
import { ProductFinancing } from "./ProductFinancing";
import { PublishedProductReviews } from "./StoreFeedback";

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
  const galleryImages = useMemo(() => productGallery(product), [product]);
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
    void prefetchModel(modelDeliveryUrl(product.model.id, product.model.file));
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
  const installment = installmentAmounts(price * qty)[0] ?? 0;
  // The planner places this exact variant; it ignores unknown options.
  const plannerHref = `/planner?product=${encodeURIComponent(product.id)}&color=${encodeURIComponent(color)}&material=${encodeURIComponent(material)}&source=product`;
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
      madeToOrder: product.madeToOrder,
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
          <section className="pdp-gallery-card" aria-label="Барааны зураг">
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
                  sizes="(max-width: 1023px) 100vw, 60vw"
                  className="object-contain"
                />
                {viewerActive && (
                  <div className="pdp-photo-caption" role="status">
                    <p className="text-sm font-medium">
                      3D загварыг ачаалж байна…
                    </p>
                    <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/30">
                      <span className="viewer-loading-bar block h-full w-1/3 rounded-full bg-white" />
                    </div>
                  </div>
                )}
              </div>
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
              >
                <Image
                  src={image}
                  alt=""
                  fill
                  sizes="128px"
                  className="object-cover"
                />
              </button>
            ))}
            {product.model && (
              <button
                type="button"
                className="pdp-thumbnail-3d"
                onClick={() => setViewerActive(true)}
                aria-label="3D загвараар харах"
                aria-pressed={viewerActive}
              >
                <Box size={22} aria-hidden="true" />
                <span>3D</span>
              </button>
            )}
          </div>
        </div>

        <div className="pdp-summary min-w-0 text-[#111111] [&_button]:focus-visible:outline [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-4 [&_button]:focus-visible:outline-[#2563EB]">
          <div className="pdp-product-meta">
            <Link href={"/catalog/" + product.category}>
              {CATEGORY_LABEL[product.category]}
            </Link>
            {product.reviewCount > 0 && (
              <a
                href="#product-reviews"
                onClick={(event) => {
                  event.preventDefault();
                  openDetailTab("reviews");
                }}
              >
                <Star size={13} aria-hidden="true" />
                <strong>{product.rating.toFixed(1)}</strong>
                <span>{product.reviewCount} сэтгэгдэл</span>
              </a>
            )}
          </div>
          <h1 className="mt-3 break-words text-3xl font-semibold leading-[1.18] tracking-[-.03em] sm:text-4xl">
            {product.name}
          </h1>
          <div className="pdp-price-card">
            <p className="text-3xl font-semibold tabular-nums text-[#111111]">
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
                {price !== product.basePrice && " · үндсэн загварын урамшуулал"}
              </p>
            )}
            {installment > 0 && (
              <a className="pdp-installment-hint" href="#product-financing">
                эсвэл 4 төлөлтөөр · {formatPrice(installment)}-аас
              </a>
            )}
          </div>

          <div className="pdp-size-row">
            <span className="pdp-size-value">
              <Ruler size={16} aria-hidden="true" />
              {Math.round(product.dimensions.w * 100)} ×{" "}
              {Math.round(product.dimensions.d * 100)} ×{" "}
              {Math.round(product.dimensions.h * 100)} см
            </span>
            <ProductScaleHUD product={product} />
          </div>

          <fieldset className="pdp-option-group">
            <legend className="mb-3 flex w-full items-center gap-2 text-sm font-medium">
              Өнгө:
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
            <legend className="mb-3 text-sm font-medium">Материал</legend>
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
            <div className="pdp-purchase-actions">
              <div
                className="pdp-quantity"
                role="group"
                aria-label="Тоо ширхэг"
              >
                <button
                  type="button"
                  aria-label="Тоо ширхэг хасах"
                  disabled={qty <= 1 || !product.inStock}
                  onClick={() => setQty((value) => Math.max(1, value - 1))}
                >
                  <Minus className="h-4 w-4" aria-hidden="true" />
                </button>
                <span aria-live="polite">{qty}</span>
                <button
                  type="button"
                  aria-label="Тоо ширхэг нэмэх"
                  disabled={qty >= limit}
                  onClick={() => setQty((value) => Math.min(limit, value + 1))}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
              <button
                type="button"
                onClick={onAdd}
                disabled={limit < 1 || qty > limit}
                className="btn-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                {added ? <Check size={17} /> : <ShoppingBag size={17} />}
                <span>
                  {added
                    ? "Дахин нэмэх"
                    : product.stockQuantity == null
                      ? "Нөөц шалгаж байна"
                      : product.inStock
                        ? "Сагсанд нэмэх"
                        : "Нөөц дууссан"}
                </span>
                <span className="pdp-cart-total" aria-live="polite">
                  {formatPrice(price * qty)}
                </span>
              </button>
              <button
                type="button"
                onClick={() => toggleWish(product.id)}
                aria-label={
                  mounted && inWish
                    ? "Хүслийн жагсаалтаас хасах"
                    : "Хүслийн жагсаалтад хадгалах"
                }
                aria-pressed={mounted && inWish}
                className="pdp-wish"
              >
                <Heart
                  className={cn("h-5 w-5", mounted && inWish && "fill-current")}
                  aria-hidden="true"
                />
              </button>
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

          <div className="pdp-room-cta">
            {product.model ? (
              <Link href={plannerHref} className="pdp-room-link">
                <Box size={18} aria-hidden="true" />
                Өрөөндөө байрлуулж үзэх
              </Link>
            ) : (
              <span className="pdp-room-link" aria-disabled="true">
                <Box size={18} aria-hidden="true" />
                Өрөөндөө байрлуулж үзэх
              </span>
            )}
            <p>
              {product.model
                ? `${selectedColor?.name ?? ""} · ${selectedMaterial?.name ?? ""} сонголтоороо 3D өрөө төлөвлөгчид нэмэгдэнэ.`
                : "Өрөөнд байрлуулах болон AR ашиглахад барааны 3D модел шаардлагатай."}
            </p>
            {product.model && (
              <button
                type="button"
                className="pdp-ar-entry"
                onClick={openAR}
                aria-haspopup="dialog"
              >
                <Camera size={16} aria-hidden="true" />
                Камераараа харах (AR)
              </button>
            )}
          </div>

          <ul className="pdp-facts">
            <li data-low={stock > 0 && stock <= 3}>
              <span>Нөөц</span>
              <strong role="status" aria-label={stockLabel(product)}>
                {product.madeToOrder && stock === 0
                  ? "Захиалгаар хийнэ · 7–14 хоног"
                  : product.stockQuantity == null
                    ? "Нөөц шалгаж байна"
                    : stock > 0
                      ? `${stock} ширхэг бэлэн`
                      : "Нөөц дууссан"}
              </strong>
            </li>
            <li>
              <span>Хүргэлт</span>
              <a
                href="#product-delivery"
                onClick={(event) => {
                  event.preventDefault();
                  openDetailTab("delivery");
                }}
              >
                <Truck size={16} aria-hidden="true" />
                Нөхцөл харах
              </a>
            </li>
          </ul>
          <ProductFinancingOptions total={price * qty} />
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
              href="/#contact"
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
          <PublishedProductReviews productId={product.id} />
        </section>
      </div>
      <ProductFinancing total={price * qty} />
    </section>
  );
}
