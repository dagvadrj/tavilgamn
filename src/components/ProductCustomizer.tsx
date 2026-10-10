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
  Ruler,
  Hand,
  Camera,
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
import { ProductInstallments } from "./ProductInstallments";

const ProductAR = dynamic(
  () => import("./ProductAR").then((module) => module.ProductAR),
  { ssr: false },
);

const ProductViewer = dynamic(
  () => import("@/three/ProductViewer").then((m) => m.ProductViewer),
  { ssr: false, loading: () => <ViewerSkeleton /> },
);

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
        product.model.previewFile ?? product.model.file,
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
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.45fr)_minmax(360px,.8fr)] lg:gap-10 xl:gap-14">
        <div className="min-w-0 space-y-6">
          <section className="overflow-hidden rounded-[22px] border border-[#111111]/10 bg-[#F4F4F5] shadow-[0_24px_70px_rgba(17,17,17,.04)]">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#111111]/10 bg-white/70 px-4 py-3 sm:px-5">
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
            <div className="product-gallery relative !aspect-[4/3] overflow-hidden lg:!min-h-[520px]">
              {viewerActive && (
                <ProductViewer
                  stockQuantity={product.stockQuantity}
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
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#111111]/45 to-transparent px-5 pb-5 pt-14 text-white">
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
                  className="absolute left-1/2 top-1/2 z-20 inline-flex min-h-12 -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-[#111111] shadow-xl"
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

          <section className="overflow-hidden rounded-[22px] border border-[#111111]/10 bg-white shadow-[0_18px_55px_rgba(17,17,17,.03)]">
            <div className="flex items-center justify-between gap-3 border-b border-[#111111]/10 px-4 py-4 sm:px-5">
              <h2 className="flex items-center gap-2 text-sm font-medium text-[#111111]">
                <ImageIcon
                  className="h-4 w-4 text-[#2563EB]"
                  aria-hidden="true"
                />
                Барааны зургууд
              </h2>
              <span className="text-xs text-[#68686F]">
                {galleryImages.length} зураг
              </span>
            </div>
            <div className="relative aspect-[4/3] bg-[#F4F4F5]">
              <Image
                key={selectedImage}
                src={selectedImage}
                alt={`${product.name} — сонгосон зураг`}
                fill
                sizes="(max-width: 1023px) 100vw, 55vw"
                className="animate-[product-photo-in_.35s_ease-out] object-cover"
              />
            </div>
            <div
              className="flex gap-3 overflow-x-auto p-4 sm:p-5"
              role="group"
              aria-label="Барааны зураг сонгох"
            >
              {galleryImages.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setSelectedImage(image)}
                  aria-label={`${index + 1}-р зураг харах`}
                  aria-pressed={selectedImage === image}
                  className={cn(
                    "relative h-20 w-24 shrink-0 overflow-hidden rounded-xl border-2 bg-[#F4F4F5] transition sm:h-24 sm:w-28",
                    selectedImage === image
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
          </section>
        </div>

        <div className="min-w-0 text-[#111111] [&_button]:focus-visible:outline [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-4 [&_button]:focus-visible:outline-[#2563EB]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#111111] px-3 py-1 text-[11px] font-medium uppercase tracking-[.08em] text-white">
              {CATEGORY_LABEL[product.category]}
            </span>
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                product.inStock
                  ? "bg-[#2563EB]/10 text-[#2563EB]"
                  : "bg-[#111111]/5 text-[#68686F]",
              )}
            >
              {stockLabel(product)}
            </span>
          </div>
          <h1 className="mt-4 break-words text-3xl font-medium leading-[1.08] tracking-[-.03em] sm:text-4xl xl:text-[42px]">
            {product.name}
          </h1>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-b border-[#111111]/10 pb-5">
            {product.reviewCount > 0 ? (
              <div className="flex items-center gap-1.5 text-sm text-[#68686F]">
                <Star
                  className="h-4 w-4 fill-[#2563EB] text-[#2563EB]"
                  aria-hidden="true"
                />
                {product.rating} · {product.reviewCount} сэтгэгдэл
              </div>
            ) : (
              <span className="text-xs text-[#68686F]">
                Сэтгэгдэл хараахан байхгүй
              </span>
            )}
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

          <div className="py-6">
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
                {price !== product.basePrice && " · үндсэн загварын урамшуулал"}
              </p>
            )}
            <ProductInstallments total={price * qty} />
          </div>

          <p className="border-b border-[#111111]/10 pb-6 text-sm leading-7 text-[#68686F]">
            {product.description}
          </p>
          <details className="mt-4 rounded-xl border border-[#111111]/10 bg-[#FAFAFA] p-4 text-sm">
            <summary className="cursor-pointer font-medium">
              Хүргэлт ба захиалгын нөхцөл
            </summary>
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
                Хүргэлтэд гарахаас өмнө цуцлах хүсэлт гаргаж болно. Төлбөр
                төлсөн бол админ шалгаж, мөнгөний буцаалтыг тусад нь бүртгэнэ.
                Хүргэлтэд гарсан барааны буцаалтаар бидэнтэй холбоо барина уу.
              </p>
              <Link
                className="inline-block min-h-11 pt-3 underline"
                href="/about#contact"
              >
                Хүргэлтийн бүс, хугацааг лавлах
              </Link>
            </div>
          </details>

          <div className="border-b border-[#111111]/10 py-5">
            <div className="mb-3 flex items-center gap-2 text-sm font-medium">
              <Ruler className="h-4 w-4 text-[#2563EB]" aria-hidden="true" />
              Хэмжээ
            </div>
            <dl className="grid grid-cols-3 divide-x divide-[#111111]/10 rounded-xl bg-[#F4F4F5] py-3 text-center">
              {[
                { label: "Өргөн", value: product.dimensions.w },
                { label: "Гүн", value: product.dimensions.d },
                { label: "Өндөр", value: product.dimensions.h },
              ].map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-[11px] text-[#68686F]">{label}</dt>
                  <dd className="mt-1 text-sm font-semibold tabular-nums">
                    {Math.round(value * 100)} см
                  </dd>
                </div>
              ))}
            </dl>
            <ProductScaleHUD product={product} />
          </div>

          <section
            className="border-b border-[#111111]/10 py-5"
            aria-labelledby="product-specifications-heading"
          >
            <h2
              id="product-specifications-heading"
              className="mb-3 text-lg font-semibold"
            >
              Бүтээгдэхүүний үзүүлэлт
            </h2>
            <table className="w-full table-fixed text-left text-sm">
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

          <fieldset className="pt-6">
            <legend className="mb-3 flex w-full items-center justify-between gap-3 pr-1 text-sm font-medium">
              <span className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#111111] text-[11px] text-white">
                  1
                </span>
                Өнгө
              </span>
              <span className="font-normal text-[#68686F]">
                {selectedColor?.name}
              </span>
            </legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3">
              {product.colors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setColor(c.id);
                    setViewerActive(true);
                  }}
                  aria-pressed={color === c.id}
                  className={cn(
                    "relative inline-flex min-h-14 items-center gap-2 rounded-xl border px-3 py-2 text-left text-sm transition",
                    color === c.id
                      ? "border-[#2563EB] bg-[#2563EB]/5 shadow-[inset_0_0_0_1px_#2563EB]"
                      : "border-[#111111]/15 bg-[#FFFFFF] hover:border-[#111111]/40",
                  )}
                >
                  <span
                    className="h-6 w-6 shrink-0 rounded-full border border-black/10"
                    style={{ backgroundColor: c.hex }}
                  />
                  <span className="min-w-0 truncate">{c.name}</span>
                  {color === c.id && (
                    <Check
                      className="ml-auto h-3.5 w-3.5 shrink-0 text-[#2563EB]"
                      aria-hidden="true"
                    />
                  )}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-6 border-t border-[#111111]/10 pt-6">
            <legend className="mb-3 flex w-full items-center justify-between gap-3 pr-1 text-sm font-medium">
              <span className="flex items-center gap-2">
                <span className="grid h-6 w-6 place-items-center rounded-full bg-[#111111] text-[11px] text-white">
                  2
                </span>
                Материал
              </span>
              <span className="font-normal text-[#68686F]">
                {selectedMaterial?.name}
              </span>
            </legend>
            <div className="grid gap-2">
              {product.materials.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setMaterial(m.id);
                    setViewerActive(true);
                  }}
                  aria-pressed={material === m.id}
                  className={cn(
                    "flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition",
                    material === m.id
                      ? "border-[#2563EB] bg-[#2563EB]/5"
                      : "border-[#111111]/15 bg-[#FFFFFF] hover:border-[#111111]/40",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-4 w-4 shrink-0 rounded-full border",
                        material === m.id
                          ? "border-[5px] border-[#2563EB]"
                          : "border-[#111111]/25",
                      )}
                    />
                    {m.name}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-[#68686F]">
                    {m.priceDelta === 0
                      ? "Багтсан"
                      : `${m.priceDelta > 0 ? "+" : ""}${formatPrice(m.priceDelta)}`}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="product-purchase !static mt-7 rounded-2xl border border-[#111111]/10 bg-[#FAFAFA] p-4 shadow-none sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="flex items-center gap-2 text-sm font-medium">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-[#111111] text-[11px] text-white">
                    3
                  </span>
                  Тоо ширхэг
                </p>
                <p className="mt-2 text-xs text-[#68686F]">
                  Нэгж үнэ · {formatPrice(price)}
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
        </div>
      </div>
    </section>
  );
}
