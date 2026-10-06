"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, X, ChevronRight } from "lucide-react";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/products";
import type { Category } from "@/lib/types";
import { cn } from "@/lib/format";
import { CatalogProducts } from "./CatalogProducts";
import { getRoomCatalogGroup } from "@/lib/catalogNavigation";

export function CatalogView({
  initialCategory,
  initialQuery,
  initialSort,
  initialRoom,
  initialOffers,
}: {
  initialCategory?: Category;
  initialQuery?: string;
  initialSort?: string;
  initialRoom?: string;
  initialOffers?: boolean;
}) {
  const room = getRoomCatalogGroup(initialRoom);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [categories, setCategories] = useState<Set<Category>>(
    new Set(initialCategory ? [initialCategory] : room?.categories ?? []),
  );
  const [resetVersion, setResetVersion] = useState(0);
  const resetFilters = () => { setCategories(new Set()); setQuery(""); setResetVersion(value => value + 1); };
  const [filtersOpen, setFiltersOpen] = useState(false);
  useEffect(() => {
    setQuery(initialQuery ?? "");
  }, [initialQuery]);

  useEffect(() => {
    setCategories(new Set(initialCategory ? [initialCategory] : room?.categories ?? []));
  }, [initialCategory, room]);
  const roomFilterActive = !initialCategory && room && categories.size === room.categories.length && room.categories.every(category => categories.has(category));

  const toggleCategory = (c: Category) => {
    setCategories(current => {
      const next = new Set(current);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  return (
    <div className="shop-container catalog-shell">
      <nav aria-label="Хуудасны зам" className="breadcrumbs"><Link href="/">Нүүр</Link><ChevronRight size={12} /><span>Тавилга</span>{initialCategory && <><ChevronRight size={12} /><span>{CATEGORY_LABEL[initialCategory]}</span></>}</nav>
      <header className="catalog-heading mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#68686F]">
          Таны орон зай, таны сонголт
        </p>
        <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
              {initialCategory ? CATEGORY_LABEL[initialCategory] : roomFilterActive ? room.label : initialOffers ? "Хямдрал, урамшуулал" : "Тавилга, гэрийн сонголтууд"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#68686F]">
              {roomFilterActive ? room.description : "Загвар, өнгө, материалаа харьцуулж, өөрт тохирохыг сонгоорой."}
            </p>
          </div>
          <div className="relative w-full shrink-0 lg:w-80">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#68686F]"
            />
            <input
              type="search"
              aria-label="Тавилга хайх"
              autoFocus={initialQuery !== undefined}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Тавилга хайх…"
              className="h-12 w-full rounded-xl border border-[#111111]/15 bg-[#FFFFFF] pl-11 pr-4 text-sm outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20"
            />
          </div>
        </div>
      </header>
      <div className="mb-6 flex justify-end lg:hidden">
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="catalog-filters"
          onClick={() => setFiltersOpen((open) => !open)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#111111]/15 px-4 text-sm lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Шүүлтүүр
          {categories.size > 0 && ` (${categories.size})`}
        </button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <aside
          id="catalog-filters"
          className={cn(
            "catalog-sidebar rounded-2xl border border-[#111111]/10 p-5 lg:sticky lg:block",
            !filtersOpen && "hidden",
          )}
        >
          <div className="mb-4 flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">Ангилал</h2>
            {(categories.size > 0 || query) && (
              <button
                type="button"
                onClick={() => {
                  setCategories(new Set());
                  setQuery("");
                }}
                className="min-h-11 text-xs text-[#2563EB] underline underline-offset-4"
              >
                Цэвэрлэх
              </button>
            )}
          </div>
          <div className="grid gap-1.5">
            <button
              type="button"
              aria-pressed={categories.size === 0}
              onClick={() => setCategories(new Set())}
              className={cn(
                "min-h-11 rounded-lg px-3 text-left text-sm transition",
                categories.size === 0
                  ? "bg-[#2563EB]/10 font-medium text-[#2563EB]"
                  : "text-[#68686F] hover:bg-[#F4F4F5]/60",
              )}
            >
              Бүх ангилал
            </button>
            {CATEGORIES.map((category) => (
              <button
                key={category.id}
                type="button"
                aria-pressed={categories.has(category.id)}
                onClick={() => toggleCategory(category.id)}
                className={cn(
                  "flex min-h-11 items-center gap-3 rounded-lg px-3 text-left text-sm transition",
                  categories.has(category.id)
                    ? "bg-[#2563EB]/10 font-medium text-[#2563EB]"
                    : "text-[#68686F] hover:bg-[#F4F4F5]/60",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px]",
                    categories.has(category.id)
                      ? "border-[#2563EB] bg-[#2563EB] text-white"
                      : "border-[#111111]/25",
                  )}
                >
                  {categories.has(category.id) ? "✓" : ""}
                </span>
                {category.name}
              </button>
            ))}
          </div>
        </aside>

        <div className="min-w-0">
          {categories.size > 0 && (
            <div
              className="mb-5 flex flex-wrap gap-2"
              aria-label="Сонгосон ангиллууд"
            >
              {[...categories].map((category) => (
                <button
                  key={category}
                  type="button"
                  onClick={() => toggleCategory(category)}
                  aria-label={`${CATEGORY_LABEL[category]} шүүлтүүрийг хасах`}
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#2563EB]/20 bg-[#2563EB]/5 px-3 text-xs text-[#2563EB]"
                >
                  {CATEGORY_LABEL[category]}
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          )}
          <CatalogProducts key={resetVersion} query={query} categories={[...categories]} initialSort={initialSort} initialOffers={resetVersion === 0 && initialOffers} onReset={resetFilters} />
        </div>
      </div>
    </div>
  );
}

