"use client";

import { useEffect, useState } from "react";
import type { Category } from "@/lib/types";
import { useCatalog } from "@/store/catalog";
import { CATEGORY_LABEL } from "@/lib/products";
import { ProductCard } from "./ProductCard";
import { CatalogStatus } from "./CatalogStatus";
import { hasAvailableStock } from "@/lib/inventory";

export function CatalogProducts({
  query,
  categories,
  initialSort,
}: {
  query: string;
  categories: Category[];
  initialSort?: string;
}) {
  const catalog = useCatalog();
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState(initialSort === "new" ? "new" : "featured");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  useEffect(() => { setSort(initialSort === "new" ? "new" : "featured"); }, [initialSort]);

  const categoryKey = [...categories].sort().join(",");

  useEffect(() => {
    setPage(1);
  }, [query, categoryKey, sort, minPrice, maxPrice]);

  if (catalog.loading || !catalog.ready) {
    return (
      <CatalogStatus
        loading={catalog.loading}
        error={catalog.error}
        retry={() => void catalog.refresh()}
      />
    );
  }

  const filtered = catalog.products.filter(
    (product) =>
      hasAvailableStock(product) &&
      (!categories.length || categories.includes(product.category)) &&
      (!minPrice || product.basePrice >= Number(minPrice)) &&
      (!maxPrice || product.basePrice <= Number(maxPrice)) &&
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
      <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-[#e5e7df] bg-white p-3">
        <span className="text-xs font-medium">Үнэ ₮</span>
        <div className="price-range-inputs flex min-w-0 items-center gap-2">
          <input type="number" min="0" inputMode="numeric" aria-label="Хамгийн бага үнэ" placeholder="Доод үнэ" value={minPrice} onChange={e => setMinPrice(e.target.value)} className="h-11 w-full min-w-0 rounded-lg border border-[#e5e7df] bg-[#faf9f6] px-3 text-xs sm:w-28" />
          <span aria-hidden="true">–</span>
          <input type="number" min="0" inputMode="numeric" aria-label="Хамгийн их үнэ" placeholder="Дээд үнэ" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} className="h-11 w-full min-w-0 rounded-lg border border-[#e5e7df] bg-[#faf9f6] px-3 text-xs sm:w-28" />
        </div>
        {(minPrice || maxPrice) && <button type="button" onClick={() => { setMinPrice(""); setMaxPrice(""); }} className="min-h-11 text-xs underline sm:ml-auto">Арилгах</button>}
      </div>
      {minPrice && maxPrice && Number(minPrice) > Number(maxPrice) && <p role="status" className="mb-4 text-sm text-[#ad6547]">Дээд үнэ нь доод үнээс их байх ёстой.</p>}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-medium">
          Тавилга{" "}
          <span className="ml-2 text-sm font-normal text-[#6C726B]">
            {filtered.length} илэрц
          </span>
        </h2>
        <select
          aria-label="Бараа эрэмбэлэх"
          className="min-h-11 rounded-xl border border-[#293C32]/15 bg-[#FFFFFF] px-3 text-sm"
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
      {catalog.error && (
        <CatalogStatus
          loading={false}
          error={catalog.error}
          retry={() => void catalog.refresh()}
        />
      )}

      {!filtered.length ? (
        <div className="rounded-2xl border border-dashed border-[#293C32]/20 bg-[#FFFFFF] px-6 py-16 text-center">
          <h3 className="text-lg font-medium">Тавилга олдсонгүй</h3>
          <p className="mt-2 text-sm text-[#6C726B]">
            Хайх үгээ өөрчлөх эсвэл ангиллын шүүлтүүрээ цэвэрлээрэй.
          </p>
        </div>
      ) : (
        <div className="catalog-results-grid">
          {filtered.slice((current - 1) * 24, current * 24).map((product) => (
            <ProductCard key={product.id} product={product} catalogStyle />
          ))}
        </div>
      )}
      {pages > 1 && (
        <nav
          aria-label="Тавилгын хуудаслалт"
          className="mt-8 flex flex-wrap items-center justify-center gap-4 border-t border-[#293C32]/10 pt-6"
        >
          <button
            type="button"
            className="min-h-11 rounded-xl border border-[#293C32]/15 bg-[#FFFFFF] px-4 text-sm transition hover:border-[#42634F] disabled:cursor-not-allowed disabled:opacity-40"
            disabled={current === 1}
            onClick={() => setPage(current - 1)}
          >
            Өмнөх
          </button>
          <span
            className="text-sm tabular-nums text-[#6C726B]"
            aria-live="polite"
          >
            {current} / {pages}
          </span>
          <button
            type="button"
            className="min-h-11 rounded-xl border border-[#293C32]/15 bg-[#FFFFFF] px-4 text-sm transition hover:border-[#42634F] disabled:cursor-not-allowed disabled:opacity-40"
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

