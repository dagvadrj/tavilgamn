"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, X, ChevronRight } from "lucide-react";
import { CATEGORY_LABEL } from "@/lib/products";
import type { Category } from "@/lib/types";
import { CategoryBrowser } from "./CategoryBrowser";
import { useCatalog } from "@/store/catalog";
import { CatalogProducts } from "./CatalogProducts";
import { getRoomCatalogGroup } from "@/lib/catalogNavigation";

export function CatalogView({
  initialCategory,
  initialQuery,
  initialSort,
  initialRoom,
  initialOffers,
  initialFacet = "",
}: {
  initialCategory?: Category;
  initialQuery?: string;
  initialSort?: string;
  initialRoom?: string;
  initialOffers?: boolean;
  initialFacet?: string;
}) {
  const catalog = useCatalog();
  const [facet, setFacet] = useState(initialFacet);
  const room = getRoomCatalogGroup(initialRoom);
  const [query, setQuery] = useState(initialQuery ?? "");
  const [categories, setCategories] = useState<Set<Category>>(
    new Set(initialCategory ? [initialCategory] : (room?.categories ?? [])),
  );
  const [resetVersion, setResetVersion] = useState(0);
  const resetFilters = () => {
    setCategories(new Set());
    setQuery("");
    setFacet("");
    setResetVersion((value) => value + 1);
  };
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!filtersOpen) {
      filterDialog.current?.close();
      return;
    }
    filterDialog.current?.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const desktop = window.matchMedia("(min-width: 1024px)");
    const dismissOnDesktop = () => {
      if (desktop.matches) setFiltersOpen(false);
    };
    desktop.addEventListener("change", dismissOnDesktop);
    return () => {
      document.body.style.overflow = previousOverflow;
      desktop.removeEventListener("change", dismissOnDesktop);
    };
  }, [filtersOpen]);
  useEffect(() => {
    setQuery(initialQuery ?? "");
  }, [initialQuery]);

  useEffect(() => {
    setFacet(initialFacet);
    setCategories(
      new Set(initialCategory ? [initialCategory] : (room?.categories ?? [])),
    );
  }, [initialCategory, initialFacet, room]);
  const roomFilterActive =
    !initialCategory &&
    room &&
    categories.size === room.categories.length &&
    room.categories.every((category) => categories.has(category));

  const toggleCategory = (c: Category) => {
    setFacet("");
    setCategories((current) => {
      const next = new Set(current);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const categoryFilters = (
    <>
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold">Ангилал</h2>
        {(categories.size > 0 || query) && (
          <button
            type="button"
            onClick={() => {
              setCategories(new Set());
              setQuery("");
              setFacet("");
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
          onClick={() => {
            setCategories(new Set());
            setFacet("");
          }}
          className="category-all-button"
        >
          Бүх ангилал
        </button>
        <CategoryBrowser
          products={catalog.products}
          ready={catalog.ready}
          selected={[...categories]}
          facet={facet}
          onSelect={(category, nextFacet) => {
            setCategories(new Set([category]));
            setFacet(nextFacet);
          }}
        />
      </div>
    </>
  );

  return (
    <div className="shop-container catalog-shell">
      <nav aria-label="Хуудасны зам" className="breadcrumbs">
        <Link href="/">Нүүр</Link>
        <ChevronRight size={12} />
        <span>Тавилга</span>
        {initialCategory && (
          <>
            <ChevronRight size={12} />
            <span>{CATEGORY_LABEL[initialCategory]}</span>
          </>
        )}
      </nav>
      <header className="catalog-heading mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#68686F]">
          Таны орон зай, таны сонголт
        </p>
        <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
              {initialCategory
                ? CATEGORY_LABEL[initialCategory]
                : roomFilterActive
                  ? room.label
                  : initialOffers
                    ? "Хямдрал, урамшуулал"
                    : "Тавилга, гэрийн сонголтууд"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#68686F]">
              {roomFilterActive
                ? room.description
                : "Загвар, өнгө, материалаа харьцуулж, өөрт тохирохыг сонгоорой."}
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
              enterKeyHint="search"
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
          aria-controls="catalog-filter-dialog"
          aria-haspopup="dialog"
          onClick={() => setFiltersOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#111111]/15 px-4 text-sm lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Шүүлтүүр
          {categories.size > 0 && ` (${categories.size})`}
        </button>
      </div>

      <dialog
        ref={filterDialog}
        id="catalog-filter-dialog"
        className="catalog-filter-dialog"
        aria-labelledby="catalog-filter-title"
        onClose={() => setFiltersOpen(false)}
        onCancel={() => setFiltersOpen(false)}
        onClick={(event) => {
          if (event.target === event.currentTarget) setFiltersOpen(false);
        }}
      >
        <div className="catalog-filter-sheet">
          <header>
            <h2 id="catalog-filter-title">Ангиллаар шүүх</h2>
            <button
              type="button"
              aria-label="Шүүлтүүр хаах"
              onClick={() => setFiltersOpen(false)}
              autoFocus
            >
              <X size={22} />
            </button>
          </header>
          <div className="catalog-filter-body">{categoryFilters}</div>
          <footer>
            <button
              type="button"
              className="btn-primary"
              onClick={() => setFiltersOpen(false)}
            >
              Бараануудыг үзэх
              {categories.size > 0 ? ` · ${categories.size} ангилал` : ""}
            </button>
          </footer>
        </div>
      </dialog>

      <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <aside
          id="catalog-filters"
          className="catalog-sidebar hidden rounded-2xl border border-ui-line p-5 lg:sticky lg:block"
        >
          {categoryFilters}
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
          <CatalogProducts
            key={resetVersion}
            query={query}
            categories={[...categories]}
            facet={facet}
            initialSort={initialSort}
            initialOffers={resetVersion === 0 && initialOffers}
            onReset={resetFilters}
          />
        </div>
      </div>
    </div>
  );
}
