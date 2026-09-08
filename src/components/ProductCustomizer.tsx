"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Heart, Plus, Minus, Star, RotateCcw, ImageIcon, Box, Check, ShoppingBag, ChevronRight } from "lucide-react";
import type { Product } from "@/lib/types";
import { priceFor, CATEGORY_LABEL } from "@/lib/products";
import { formatPrice, cn } from "@/lib/format";
import { useCart } from "@/store/cart";
import { useWishlist } from "@/store/wishlist";

import { availableStock, quantityLimit, stockLabel } from "@/lib/inventory";

const ProductViewer = dynamic(
  () => import("@/three/ProductViewer").then((m) => m.ProductViewer),
  { ssr: false, loading: () => <ViewerSkeleton /> },
);

function ViewerSkeleton() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[#EEEEE7]">
      <div className="text-sm text-[#737D6C]">3D дүрсийг бэлдэж байна…</div>
    </div>
  );
}

export function ProductCustomizer({ product }: { product: Product }) {
  const [color, setColor] = useState(product.defaultColor);
  const [material, setMaterial] = useState(product.materials[0].id);
  const [qty, setQty] = useState(1);
  const [view, setView] = useState<"photo" | "3d">("photo");
  const [added, setAdded] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { setAdded(false); }, [color, material, qty]);
  const cartItems = useCart(s => s.items);
  const limit = mounted ? quantityLimit(product, cartItems, { color, material }) : 0;
  const [stockError, setStockError] = useState("");
  const add = useCart((s) => s.add);
  const inWish = useWishlist((s) => s.has(product.id));
  const toggleWish = useWishlist((s) => s.toggle);

  const price = useMemo(
    () => priceFor(product, color, material),
    [product, color, material],
  );
  const colorHex = product.colors.find((c) => c.id === color)?.hex ?? "#C9A37A";

  const onAdd = () => {
    if (qty > quantityLimit(product, useCart.getState().items, { color, material })) {
      setStockError("Нөөц хүрэлцэхгүй байна. Сагсны тоо болон сонгосон ширхэгээ шалгана уу."); return;
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
    <section className="shop-container py-6 sm:py-8">
      <nav className="breadcrumbs" aria-label="Хуудасны зам"><Link href="/">Нүүр</Link><ChevronRight size={12} /><Link href="/catalog">Тавилга</Link><ChevronRight size={12} /><Link href={"/catalog/" + product.category}>{CATEGORY_LABEL[product.category]}</Link><ChevronRight size={12} /><span>{product.name}</span></nav>
      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-12">
        <div className="min-w-0 lg:sticky lg:top-[156px]">
          <div className="overflow-hidden rounded-2xl border border-[#293C32]/10 bg-[#EFE6D6]">
            {view === "3d" && <div className="flex items-center justify-between border-b border-[#293C32]/10 px-5 py-4">
              <span className="text-sm font-medium text-[#293C32]">
                3D харагдац
              </span>
              <span className="flex items-center gap-1.5 text-xs text-[#6C726B]">
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Чирж
                эргүүлэх
              </span>
            </div>}
            <div className="product-gallery">
              {view === "photo" ? <Image src={product.image} alt={product.name} fill priority sizes="(max-width: 1023px) 100vw, 55vw" className="object-cover" /> :
              <ProductViewer
                stockQuantity={product.stockQuantity}
                model={product.model}
                category={product.category}
                color={colorHex}
                material={material}
                dimensions={product.dimensions}
              />}
            </div>
          </div>
          <div className="product-gallery-tabs" role="group" aria-label="Барааны харагдац"><button type="button" aria-pressed={view === "photo"} onClick={() => setView("photo")}><ImageIcon size={16} />Барааны зураг</button><button type="button" aria-pressed={view === "3d"} onClick={() => setView("3d")}><Box size={16} />3D харах</button></div>
          <dl className="mt-4 grid grid-cols-3 divide-x divide-[#293C32]/10 rounded-xl border border-[#293C32]/10 bg-[#FFFFFF] py-4 text-center">
            {[
              { label: "Өргөн", value: product.dimensions.w },
              { label: "Гүн", value: product.dimensions.d },
              { label: "Өндөр", value: product.dimensions.h },
            ].map(({ label, value }) => (
              <div key={label}>
                <dt className="text-xs text-[#6C726B]">{label}</dt>
                <dd className="mt-1 text-sm font-medium tabular-nums text-[#293C32]">
                  {value.toFixed(2)} м
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="min-w-0 text-[#293C32] [&_button]:focus-visible:outline [&_button]:focus-visible:outline-2 [&_button]:focus-visible:outline-offset-4 [&_button]:focus-visible:outline-[#42634F]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span
              className={cn(
                "rounded-full px-3 py-1 text-xs font-medium",
                product.inStock
                  ? "bg-[#42634F]/10 text-[#42634F]"
                  : "bg-[#293C32]/5 text-[#6C726B]",
              )}
            >
              {stockLabel(product)}
            </span>
            <div className="flex items-center gap-1.5 text-xs text-[#6C726B]">
              <Star
                className="h-3.5 w-3.5 fill-[#AD6547] text-[#AD6547]"
                aria-hidden="true"
              />
              {product.rating} · {product.reviewCount} сэтгэгдэл
            </div>
          </div>
          <h1 className="mt-4 break-words text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
            {product.name}
          </h1>
          <p className="mt-4 text-sm leading-7 text-[#6C726B]">
            {product.description}
          </p>

          <fieldset className="mt-7 border-t border-[#293C32]/10 pt-5">
            <legend className="pr-3 text-sm font-medium">Өнгө сонгох</legend>
            <div className="flex flex-wrap gap-2">
              {product.colors.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  aria-pressed={color === c.id}
                  className={cn(
                    "inline-flex min-h-11 items-center gap-2 rounded-full border px-3 py-2 text-sm transition",
                    color === c.id
                      ? "border-[#42634F] bg-[#42634F]/5"
                      : "border-[#293C32]/15 bg-[#FFFFFF] hover:border-[#293C32]/40",
                  )}
                >
                  <span
                    className="h-6 w-6 shrink-0 rounded-full border border-black/10"
                    style={{ backgroundColor: c.hex }}
                  />
                  {c.name}
                </button>
              ))}
            </div>
          </fieldset>

          <fieldset className="mt-6">
            <legend className="mb-3 text-sm font-medium">
              Материал сонгох
            </legend>
            <div className="grid gap-2">
              {product.materials.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMaterial(m.id)}
                  aria-pressed={material === m.id}
                  className={cn(
                    "flex min-h-12 items-center justify-between gap-3 rounded-xl border px-4 py-3 text-left text-sm transition",
                    material === m.id
                      ? "border-[#42634F] bg-[#42634F]/5"
                      : "border-[#293C32]/15 bg-[#FFFFFF] hover:border-[#293C32]/40",
                  )}
                >
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-4 w-4 shrink-0 rounded-full border",
                        material === m.id
                          ? "border-[5px] border-[#42634F]"
                          : "border-[#293C32]/25",
                      )}
                    />
                    {m.name}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-[#6C726B]">
                    {m.priceDelta === 0
                      ? "Багтсан"
                      : `${m.priceDelta > 0 ? "+" : ""}${formatPrice(m.priceDelta)}`}
                  </span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="product-purchase mt-7 rounded-2xl border border-[#293C32]/10 bg-white p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs text-[#6C726B]">Нэгж үнэ</p>
                <p className="mt-1 text-lg font-medium tabular-nums">
                  {formatPrice(price)}
                </p>
              </div>
              <div
                className="flex items-center rounded-full border border-[#293C32]/15"
                role="group"
                aria-label="Тоо ширхэг"
              >
                <button
                  type="button"
                  aria-label="Тоо ширхэг хасах"
                  disabled={qty <= 1 || !product.inStock}
                  onClick={() => setQty((value) => Math.max(1, value - 1))}
                  className="grid h-11 w-11 place-items-center rounded-full transition hover:bg-[#293C32]/5 disabled:cursor-not-allowed disabled:opacity-30"
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
                  className="grid h-11 w-11 place-items-center rounded-full transition hover:bg-[#293C32]/5 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div
              className="mt-4 flex flex-wrap items-baseline justify-between gap-2 border-t border-[#293C32]/10 pt-4"
              aria-live="polite"
              aria-atomic="true"
            >
              <span className="text-sm text-[#6C726B]">
                Нийт · {qty} ширхэг
              </span>
              <strong className="text-2xl font-semibold tabular-nums text-[#AD6547]">
                {formatPrice(price * qty)}
              </strong>
            </div>
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={onAdd}
                disabled={limit < 1 || qty > limit}
                className="btn-primary flex-1 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {added ? <Check size={17} /> : <ShoppingBag size={17} />}{added ? "Дахин нэмэх" : product.stockQuantity == null ? "Нөөц шалгаж байна" : product.inStock ? "Сагсанд нэмэх" : "Нөөц дууссан"}
              </button>
              <button
                type="button"
                onClick={() => toggleWish(product.id)}
                aria-label="Хүслийн жагсаалт"
                aria-pressed={mounted && inWish}
                className={cn(
                  "grid w-12 shrink-0 place-items-center rounded-xl border transition",
                  mounted && inWish
                    ? "border-[#AD6547] bg-[#AD6547]/10"
                    : "border-[#293C32]/15 hover:bg-[#293C32]/5",
                )}
              >
                <Heart
                  className={cn(
                    "h-5 w-5",
                    mounted && inWish && "fill-[#AD6547] text-[#AD6547]",
                  )}
                  aria-hidden="true"
                />
              </button>
            </div>
            {stockError && <p role="alert" className="mt-3 text-sm text-red-700">{stockError}</p>}
            {limit < qty && <p className="mt-3 text-sm text-[#ad6547]">{product.stockQuantity == null ? "Үлдэгдэл баталгаажсаны дараа сагсанд нэмэх боломжтой." : limit === 0 ? "Нөөц хүрэлцэхгүй эсвэл боломжтой бүх ширхэг сагсанд байна." : "Сагсанд нэмж болох тоо: " + limit + ". Тоо ширхэгээ бууруулна уу."}</p>}
            <div role="status" aria-live="polite">{added && <p className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#42634f]"><Check size={15} />Сагсанд нэмэгдлээ.<Link href="/cart" className="min-h-11 inline-flex items-center font-medium underline">Сагсаа үзэх →</Link></p>}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

