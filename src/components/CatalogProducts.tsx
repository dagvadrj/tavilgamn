"use client";

import { useEffect, useState } from "react";
import type { Category } from "@/lib/types";
import { useCatalog } from "@/store/catalog";
import { CATEGORY_LABEL } from "@/lib/products";
import { ProductCard } from "./ProductCard";
import { CatalogStatus } from "./CatalogStatus";
import { hasAvailableStock } from "@/lib/inventory";
import { hasProductOffer } from "@/lib/catalogPresentation";
import { Box, Tag, SlidersHorizontal } from "lucide-react";

export function CatalogProducts({
  query,
  categories,
  initialSort,
  initialOffers = false,
  onReset,
}: {
  query: string;
  categories: Category[];
  initialSort?: string;
  initialOffers?: boolean;
  onReset?: () => void;
}) {
  const catalog = useCatalog();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(initialSort === "new" ? "new" : "featured");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [offersOnly, setOffersOnly] = useState(initialOffers);
  const [modelsOnly, setModelsOnly] = useState(false);
  useEffect(() => { setSort(initialSort === "new" ? "new" : "featured"); }, [initialSort]);
  useEffect(() => { setOffersOnly(initialOffers); }, [initialOffers]);

  const categoryKey = [...categories].sort().join(",");

  useEffect(() => {
    setPage(1);
  }, [query, categoryKey, sort, minPrice, maxPrice, offersOnly, modelsOnly]);

  if (!catalog.ready) {
    return (
      <CatalogStatus
        loading={catalog.loading}
        error={catalog.error}
        retry={() => void catalog.refresh()}
      />
    );
  }

  const checkedAt = Date.now();
  const filtered = catalog.products.filter(
    (product) =>
      hasAvailableStock(product) &&
      (!categories.length || categories.includes(product.category)) &&
      (!minPrice || product.basePrice >= Number(minPrice)) &&
      (!maxPrice || product.basePrice <= Number(maxPrice)) &&
      (!offersOnly || hasProductOffer(product, checkedAt)) &&
      (!modelsOnly || !!product.model) &&
      `${product.name} ${product.description} ${CATEGORY_LABEL[product.category]}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );

  filtered.sort((a, b) =>
    sort === "price-up"
      ? a.basePrice - b.basePrice
      : sort === "price-down"
        ? b.basePrice - a.basePrice
        : sort === "new"
          ? Number(!!b.isNew) - Number(!!a.isNew)
          : sort === "featured"
            ? Number(!!b.isBestSeller) - Number(!!a.isBestSeller)
            : a.name.localeCompare(b.name, "mn"),
  );

  const pages = Math.max(1, Math.ceil(filtered.length / 24));
  const current = Math.min(page, pages);

  return (
    <section className="mb-10" aria-label="Тавилга">
      <div className="catalog-toolbar">
        <h2>Тавилга <span aria-live="polite">{filtered.length} илэрц</span></h2>
        <select
          aria-label="Бараа эрэмбэлэх"
          className="min-h-11 rounded-xl border border-[#111111]/15 bg-[#FFFFFF] px-3 text-sm"
          value={sort}
          onChange={(event) => setSort(event.target.value)}
        >
          <option value="featured">Онцлох нь эхэндээ</option>
          <option value="new">Шинэ загвар эхэндээ</option>
          <option value="name">Нэрээр : А → Я</option>
          <option value="price-up">Хямд нь эхэндээ</option>
          <option value="price-down">Үнэтэй нь эхэндээ</option>
        </select>
      </div>
      <div className="catalog-quick-filters" aria-label="Нэмэлт шүүлтүүр">
        <button type="button" aria-pressed={!offersOnly && !modelsOnly} onClick={() => { setOffersOnly(false); setModelsOnly(false); }}>Бүх сонголт</button>
        <button type="button" aria-pressed={offersOnly} onClick={() => setOffersOnly(value => !value)}><Tag size={14} aria-hidden="true" /> Хямдрал, урамшуулал</button>
        <button type="button" aria-pressed={modelsOnly} onClick={() => setModelsOnly(value => !value)}><Box size={14} aria-hidden="true" /> 3D загвартай</button>
        <details className="catalog-price-filter">
          <summary><SlidersHorizontal size={14} aria-hidden="true" /> Үнийн хүрээ{minPrice || maxPrice ? " · сонгосон" : ""}</summary>
          <div className="catalog-price-fields">
            <label>Доод үнэ, ₮<input type="number" min="0" inputMode="numeric" aria-label="Хамгийн бага үнэ" placeholder="0" value={minPrice} onChange={e => setMinPrice(e.target.value)} /></label>
            <span aria-hidden="true">–</span>
            <label>Дээд үнэ, ₮<input type="number" min="0" inputMode="numeric" aria-label="Хамгийн их үнэ" placeholder="Хязгааргүй" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} /></label>
            {minPrice || maxPrice ? <button type="button" onClick={() => { setMinPrice(""); setMaxPrice(""); }}>Үнийг цэвэрлэх</button> : null}
          </div>
        </details>
      </div>
      {(query || categories.length > 0 || minPrice || maxPrice || offersOnly || modelsOnly) && <div className="catalog-filter-summary">
        <span>Сонгосон шүүлтүүрээр харуулж байна</span>
        <button type="button" onClick={() => { setMinPrice(""); setMaxPrice(""); setOffersOnly(false); setModelsOnly(false); onReset?.(); }}>Бүх шүүлтүүрийг цэвэрлэх</button>
      </div>}
      {minPrice && maxPrice && Number(minPrice) > Number(maxPrice) ? <p role="status" className="catalog-price-error">Дээд үнэ нь доод үнээс их байх ёстой.</p> : null}
      {catalog.error && (
        <CatalogStatus
          loading={false}
          error={catalog.error}
          retry={() => void catalog.refresh()}
        />
      )}

      {!filtered.length ? (
        <div className="rounded-2xl border border-dashed border-[#111111]/20 bg-[#FFFFFF] px-6 py-16 text-center">
          <h3 className="text-lg font-medium">Тавилга олдсонгүй</h3>
          <p className="mt-2 text-sm text-[#68686F]">
            Хайх үг, ангилал эсвэл үнийн хүрээгээ өөрчлөөд дахин үзээрэй.
          </p>
        </div>
      ) : (
        <div className="catalog-results-grid">
          {filtered.slice((current - 1) * 24, current * 24).map((product) => (
            <ProductCard key={product.id} product={product} catalogStyle offerCheckedAt={checkedAt} />
          ))}
        </div>
      )}
      {pages > 1 && (
        <nav
          aria-label="Тавилгын хуудаслалт"
          className="mt-8 flex flex-wrap items-center justify-center gap-4 border-t border-[#111111]/10 pt-6"
        >
          <button
            type="button"
            className="min-h-11 rounded-xl border border-[#111111]/15 bg-[#FFFFFF] px-4 text-sm transition hover:border-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            Өмнөх
          </button>
          <span
            className="text-sm tabular-nums text-[#68686F]"
            aria-live="polite"
          >
            {current} / {pages}
          </span>
          <button
            type="button"
            className="min-h-11 rounded-xl border border-[#111111]/15 bg-[#FFFFFF] px-4 text-sm transition hover:border-[#2563EB] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={current === pages}
            onClick={() => setPage(current + 1)}
          >
            Дараах
          </button>
        </nav>
      )}
    </section>
  );
}
