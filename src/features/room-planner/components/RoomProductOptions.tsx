"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import { PlannerLink as Link } from "@/components/PlannerLink";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  ImageOff,
  ShoppingBag,
  Star,
  Truck,
} from "lucide-react";
import type { ColorOption, MaterialOption, Product } from "@/lib/types";
import { productGallery } from "@/lib/productGallery";
import { CATEGORY_LABEL } from "@/lib/catalogCategories";
import { stockLabel } from "@/lib/inventory";
import { formatPrice } from "@/lib/format";
import { useWishlist } from "@/store/wishlist";
import { formatFurnitureCm } from "./RoomCatalogCard";

export type ProductOptionsMode = "replace" | "pair";

export interface ProductOptionsFallback {
  name: string;
  image: string | null;
  dimensions: { w: number; d: number; h: number };
  note: string;
}

/**
 * Selected-instance options in the left panel. Commerce rows only appear for
 * catalog products; custom models and kitchens say plainly what they lack.
 */
export function RoomProductOptions({
  product,
  fallback,
  instanceLabel,
  storeName,
  canWish,
  price,
  colors,
  materials,
  colorId,
  materialId,
  onColor,
  onMaterial,
  appearanceTracksVariant,
  canBuy,
  onAddToCart,
  mode,
  onMode,
  revealRecommendations,
  replace,
  pair,
  children,
}: {
  product: Product | null;
  fallback: ProductOptionsFallback;
  instanceLabel: string;
  /** Selling store, when the directory knows it. */
  storeName?: string;
  /** The merchant editor keeps no wishlist. */
  canWish: boolean;
  price: number | null;
  colors: ColorOption[];
  materials: MaterialOption[];
  colorId: string;
  materialId: string;
  onColor: (id: string) => void;
  onMaterial: (id: string) => void;
  /** False when the 3D model keeps its authored finish whatever is chosen. */
  appearanceTracksVariant: boolean;
  canBuy: boolean;
  onAddToCart: () => void;
  mode: ProductOptionsMode;
  onMode: (mode: ProductOptionsMode) => void;
  /** Bumped by the toolbar's «Солих» / «Хослуулах» to bring the list into view. */
  revealRecommendations: number;
  replace: ReactNode;
  pair: ReactNode;
  children?: ReactNode;
}) {
  const images = useMemo(
    () => (product ? productGallery(product) : fallback.image ? [fallback.image] : []),
    [product, fallback.image],
  );
  const [index, setIndex] = useState(0);
  const [broken, setBroken] = useState<Set<string>>(() => new Set());
  // A different product never shows the previous product's photo.
  useEffect(() => {
    setIndex(0);
    setBroken(new Set());
  }, [images]);
  const current = images[Math.min(index, images.length - 1)];
  const step = (delta: number) =>
    setIndex((value) => (value + delta + images.length) % images.length);

  const inWishlist = useWishlist((state) => (product ? state.has(product.id) : false));
  const toggleWishlist = useWishlist((state) => state.toggle);

  const recommendations = useRef<HTMLElement>(null);
  useEffect(() => {
    if (revealRecommendations > 0)
      recommendations.current?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [revealRecommendations]);

  const dims = product?.dimensions ?? fallback.dimensions;
  const colorName = colors.find((color) => color.id === colorId)?.name;
  const name = product?.name ?? fallback.name;

  return (
    <div className="room-options">
      <section className="room-options-hero" aria-label="Бүтээгдэхүүн">
        <div
          className="room-options-gallery"
          role="group"
          aria-roledescription="зургийн цомог"
          aria-label={`${name} — зураг ${images.length ? index + 1 : 0}/${images.length}`}
          tabIndex={images.length > 1 ? 0 : undefined}
          onKeyDown={(event) => {
            if (images.length < 2) return;
            if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
            // Arrow keys otherwise nudge the selected furniture by 10 cm.
            event.preventDefault();
            step(event.key === "ArrowLeft" ? -1 : 1);
          }}
        >
          {current && !broken.has(current) ? (
            <Image
              key={current}
              src={current}
              alt={name}
              width={360}
              height={270}
              sizes="(max-width: 600px) 90vw, 380px"
              onError={() => setBroken((set) => new Set(set).add(current))}
            />
          ) : (
            <span className="room-options-noimage">
              <ImageOff size={28} aria-hidden="true" />
              Зураг алга
            </span>
          )}
          {images.length > 1 && (
            <>
              <button type="button" className="room-options-arrow is-prev" aria-label="Өмнөх зураг" onClick={() => step(-1)}>
                <ChevronLeft size={18} />
              </button>
              <button type="button" className="room-options-arrow is-next" aria-label="Дараах зураг" onClick={() => step(1)}>
                <ChevronRight size={18} />
              </button>
            </>
          )}
        </div>
        {images.length > 1 && (
          <div className="room-options-thumbs" role="tablist" aria-label="Зургууд">
            {images.map((src, i) => (
              <button
                key={src}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Зураг ${i + 1}`}
                onClick={() => setIndex(i)}
              >
                {broken.has(src) ? <ImageOff size={16} aria-hidden="true" /> : (
                  <Image src={src} alt="" width={56} height={56} onError={() => setBroken((set) => new Set(set).add(src))} />
                )}
              </button>
            ))}
          </div>
        )}
        <div className="room-options-title">
          <div>
            {product && (
              <span className="room-options-category">
                {[CATEGORY_LABEL[product.category], storeName].filter(Boolean).join(" · ")}
              </span>
            )}
            <h3>
              {name} <small>{instanceLabel}</small>
            </h3>
          </div>
          {product && canWish && (
            <button
              type="button"
              className="room-options-wish"
              aria-pressed={inWishlist}
              aria-label={inWishlist ? "Хүслийн жагсаалтаас хасах" : "Хүслийн жагсаалтад хадгалах"}
              title={inWishlist ? "Хүслийн жагсаалтад байна" : "Хүслийн жагсаалтад хадгалах"}
              onClick={() => toggleWishlist(product.id)}
            >
              <Heart size={19} fill={inWishlist ? "currentColor" : "none"} />
            </button>
          )}
        </div>
        {product?.description && <p className="room-options-description">{product.description}</p>}
        <dl className="room-options-facts">
          <div>
            <dt>Хэмжээ</dt>
            <dd>{formatFurnitureCm(dims.w, dims.d, dims.h)}</dd>
          </div>
          {product && (
            <div>
              <dt>Үнэлгээ</dt>
              <dd>
                {product.reviewCount > 0 ? (
                  <>
                    <Star size={13} fill="currentColor" aria-hidden="true" /> {product.rating.toFixed(1)} · {product.reviewCount} сэтгэгдэл
                  </>
                ) : (
                  "Сэтгэгдэл хараахан алга"
                )}
              </dd>
            </div>
          )}
        </dl>
        <div className="room-options-price">
          <strong>{price !== null && price > 0 ? formatPrice(price) : "Үнэ тогтоогдоогүй"}</strong>
          {product && price !== null && price > 0 && <small>сонгосон хувилбарын үнэ</small>}
        </div>
        {!product && <p className="room-options-note">{fallback.note}</p>}
        <div className="room-options-cta">
          {canBuy && (
            <button type="button" className="room-options-buy" onClick={onAddToCart}>
              <ShoppingBag size={17} /> Сагсанд нэмэх
            </button>
          )}
          {product && (
            <Link className="room-options-details" href={`/product/${product.id}`} target="_blank" rel="noopener noreferrer">
              Дэлгэрэнгүй <ExternalLink size={14} aria-hidden="true" />
            </Link>
          )}
        </div>
      </section>

      {product && (
        <section className="room-options-section" aria-label="Авах боломж">
          <h4>Авах боломж</h4>
          <p className="room-options-row">
            <Truck size={16} aria-hidden="true" />
            <span>
              <strong>{stockLabel(product)}</strong>
              {product.deliveryTerms ? (
                <small>
                  Дэлгүүрийн хүргэлтийн нөхцөл: {product.deliveryTerms} · хүргэлтийн үнийн санал биш
                </small>
              ) : (
                <small>Хүргэлтийн нөхцөлийг дэлгүүр оруулаагүй — төлбөрийн үед тооцогдоно.</small>
              )}
            </span>
          </p>
          <p className="room-options-note">Очиж авах, дэлгүүрт үзэх мэдээлэл бүртгэгдээгүй.</p>
        </section>
      )}

      {(colors.length > 0 || materials.length > 0) && (
        <section className="room-options-section" aria-label="Хувилбар">
          <h4>Хувилбар</h4>
          {colors.length > 0 && (
            <>
              <p className="room-detail-label">Өнгө · {colorName ?? "—"}</p>
              <div className="room-detail-swatches">
                {colors.map((color) => (
                  <button
                    key={color.id}
                    type="button"
                    aria-label={color.name}
                    aria-pressed={colorId === color.id}
                    title={color.name}
                    style={{ background: color.hex }}
                    onClick={() => onColor(color.id)}
                  />
                ))}
              </div>
            </>
          )}
          {materials.length > 0 && (
            <>
              <p className="room-detail-label">Материал</p>
              <div className="room-detail-materials">
                {materials.map((material) => (
                  <button
                    key={material.id}
                    type="button"
                    aria-pressed={materialId === material.id}
                    onClick={() => onMaterial(material.id)}
                  >
                    {material.name}
                    {material.priceDelta > 0 && ` (+${formatPrice(material.priceDelta)})`}
                  </button>
                ))}
              </div>
            </>
          )}
          {!appearanceTracksVariant && (
            <p className="room-options-note">
              3D загвар үндсэн өнгөөр харагдана. Сонгосон өнгө, материал нь үнэ болон сагсанд хамаарна.
            </p>
          )}
          <p className="room-detail-label">Хэмжээ · {formatFurnitureCm(dims.w, dims.d, dims.h)}</p>
          <p className="room-options-note">Энэ барааны өөр хэмжээний хувилбар бүртгэгдээгүй.</p>
        </section>
      )}

      <section className="room-options-section" aria-label="Санал болгох" ref={recommendations}>
        <div className="room-options-modes" role="tablist" aria-label="Санал болгох төрөл">
          <button type="button" role="tab" aria-selected={mode === "replace"} onClick={() => onMode("replace")}>
            Ижил бүтээгдэхүүнээр солих
          </button>
          <button type="button" role="tab" aria-selected={mode === "pair"} onClick={() => onMode("pair")}>
            Хослуулах
          </button>
        </div>
        <div role="tabpanel">{mode === "replace" ? replace : pair}</div>
      </section>

      {children}
    </div>
  );
}

/** «Хослуулах»: a new instance beside the selection; the selection stays. */
export function RoomProductPairings({
  suggestions,
  hasSource,
  onAdd,
}: {
  suggestions: { product: Product; reason: string }[];
  hasSource: boolean;
  onAdd: (product: Product) => void;
}) {
  if (!hasSource)
    return <p className="room-options-empty">Энэ тавилга дэлгүүрийн бараа биш тул хослуулах санал гаргахгүй.</p>;
  if (!suggestions.length)
    return <p className="room-options-empty">Энэ өрөөнд хослуулах 3D бэлэн бараа одоогоор алга.</p>;
  return (
    <div className="room-options-list">
      <p className="room-options-count">Нэмэхэд шинэ тавилга өрөөнд орно — сонгосон тавилга, сагс өөрчлөгдөхгүй.</p>
      <ul>
        {suggestions.map(({ product, reason }) => (
          <li key={product.id}>
            <span className="room-options-thumb">{product.image ? <Image src={product.image} alt="" width={72} height={72} /> : null}</span>
            <span className="room-options-body">
              <strong>{product.name}</strong>
              <small>{formatFurnitureCm(product.dimensions.w, product.dimensions.d, product.dimensions.h)} · {stockLabel(product)}</small>
              <b>{product.basePrice > 0 ? formatPrice(product.basePrice) : "Үнэ тодруулах"}</b>
              <small className="room-options-why">{reason}</small>
              <button type="button" onClick={() => onAdd(product)}>Өрөөнд нэмэх</button>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
