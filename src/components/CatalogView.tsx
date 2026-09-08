"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search, SlidersHorizontal, X, MapPin, Phone, ChevronRight } from "lucide-react";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/products";
import { STORES } from "@/lib/stores";
import type { Category, Store } from "@/lib/types";
import { cn } from "@/lib/format";
import { CatalogProducts } from "./CatalogProducts";

type Sort = "featured" | "name-asc" | "name-desc" | "most-categories";

const SORTS: { id: Sort; label: string }[] = [
  { id: "featured", label: "Онцлох" },
  { id: "name-asc", label: "Нэр: А → Я" },
  { id: "name-desc", label: "Нэр: Я → А" },
  { id: "most-categories", label: "Хамгийн олон төрөл" },
];

export function CatalogView({
  initialCategory,
  initialQuery,
  initialSort,
}: {
  initialCategory?: Category;
  initialQuery?: string;
  initialSort?: string;
}) {
  const [query, setQuery] = useState(initialQuery ?? "");
  const [sort, setSort] = useState<Sort>("featured");
  const [categories, setCategories] = useState<Set<Category>>(
    new Set(initialCategory ? [initialCategory] : []),
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<"products" | "stores">("products");
  useEffect(() => {
    setQuery(initialQuery ?? "");
  }, [initialQuery]);

  useEffect(() => {
    setCategories(new Set(initialCategory ? [initialCategory] : []));
  }, [initialCategory]);

  const filtered = useMemo(() => {
    let list: Store[] = STORES;

    if (categories.size > 0) {
      list = list.filter((s) => s.categories.some((c) => categories.has(c)));
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.city.toLowerCase().includes(q) ||
          s.district.toLowerCase().includes(q) ||
          s.categories.some((c) => CATEGORY_LABEL[c].toLowerCase().includes(q)),
      );
    }

    switch (sort) {
      case "name-asc":
        list = [...list].sort((a, b) => a.name.localeCompare(b.name, "mn"));
        break;
      case "name-desc":
        list = [...list].sort((a, b) => b.name.localeCompare(a.name, "mn"));
        break;
      case "most-categories":
        list = [...list].sort(
          (a, b) => b.categories.length - a.categories.length,
        );
        break;
    }

    return list;
  }, [query, sort, categories]);

  const toggleCategory = (c: Category) => {
    const next = new Set(categories);
    if (next.has(c)) next.delete(c);
    else next.add(c);
    setCategories(next);
  };

  return (
    <div className="shop-container catalog-shell">
      <nav aria-label="Хуудасны зам" className="breadcrumbs"><Link href="/">Нүүр</Link><ChevronRight size={12} /><span>Тавилга</span>{initialCategory && <><ChevronRight size={12} /><span>{CATEGORY_LABEL[initialCategory]}</span></>}</nav>
      <header className="catalog-heading mb-6">
        <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#6C726B]">
          Таны орон зай, таны сонголт
        </p>
        <div className="mt-3 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-medium leading-tight tracking-tight sm:text-4xl">
              {initialCategory ? CATEGORY_LABEL[initialCategory] : "Өөрт тохирох тавилгаа олоорой"}
            </h1>
            <p className="mt-3 text-sm leading-6 text-[#6C726B]">
              Загвар, өнгө, материалаа харьцуулж, өөрт тохирохыг сонгоорой.
            </p>
          </div>
          <div className="relative w-full shrink-0 lg:w-80">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6C726B]"
            />
            <input
              type="search"
              aria-label="Тавилга, дэлгүүр хайх"
              autoFocus={initialQuery !== undefined}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Тавилга, дэлгүүр хайх…"
              className="h-12 w-full rounded-xl border border-[#293C32]/15 bg-[#FFFFFF] pl-11 pr-4 text-sm outline-none focus:border-[#42634F] focus:ring-2 focus:ring-[#42634F]/20"
            />
          </div>
        </div>
      </header>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-[#293C32]/10 pb-4">
        <div
          className="inline-flex gap-1 rounded-xl bg-[#EEEEE7] p-1"
          role="group"
          aria-label="Каталогийн төрөл"
        >
          {(
            [
              { id: "products", label: "Тавилга" },
              { id: "stores", label: "Дэлгүүрүүд" },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={view === item.id}
              onClick={() => setView(item.id)}
              className={cn(
                "min-h-11 rounded-lg px-5 text-sm font-medium transition",
                view === item.id
                  ? "bg-[#293C32] text-white shadow-sm"
                  : "text-[#6C726B] hover:text-[#293C32]",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="catalog-filters"
          onClick={() => setFiltersOpen((open) => !open)}
          className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#293C32]/15 px-4 text-sm lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" aria-hidden="true" /> Шүүлтүүр
          {categories.size > 0 && ` (${categories.size})`}
        </button>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
        <aside
          id="catalog-filters"
          className={cn(
            "catalog-sidebar rounded-2xl border border-[#293C32]/10 p-5 lg:sticky lg:block",
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
                className="min-h-11 text-xs text-[#AD6547] underline underline-offset-4"
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
                  ? "bg-[#42634F]/10 font-medium text-[#42634F]"
                  : "text-[#6C726B] hover:bg-[#EEEEE7]/60",
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
                    ? "bg-[#42634F]/10 font-medium text-[#42634F]"
                    : "text-[#6C726B] hover:bg-[#EEEEE7]/60",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    "grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px]",
                    categories.has(category.id)
                      ? "border-[#42634F] bg-[#42634F] text-white"
                      : "border-[#293C32]/25",
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
                  className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[#42634F]/20 bg-[#42634F]/5 px-3 text-xs text-[#42634F]"
                >
                  {CATEGORY_LABEL[category]}
                  <X aria-hidden="true" className="h-3.5 w-3.5" />
                </button>
              ))}
            </div>
          )}
          <div hidden={view !== "products"}>
            <CatalogProducts query={query} categories={[...categories]} initialSort={initialSort} />
          </div>
          {view === "stores" && (
            <section aria-label="Дэлгүүрүүд">
              <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-medium">
                  Дэлгүүрүүд{" "}
                  <span className="ml-2 text-sm font-normal text-[#6C726B]">
                    {filtered.length} илэрц
                  </span>
                </h2>
                <select
                  aria-label="Дэлгүүр эрэмбэлэх"
                  value={sort}
                  onChange={(event) => setSort(event.target.value as Sort)}
                  className="min-h-11 rounded-xl border border-[#293C32]/15 bg-[#FFFFFF] px-3 text-sm"
                >
                  {SORTS.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
              {filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#293C32]/20 bg-[#FFFFFF] px-6 py-16 text-center">
                  <h3 className="text-lg font-medium">Дэлгүүр олдсонгүй</h3>
                  <p className="mt-2 text-sm text-[#6C726B]">
                    Хайх үгээ өөрчлөх эсвэл ангиллын шүүлтүүрээ цэвэрлээрэй.
                  </p>
                </div>
              ) : (
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {filtered.map((store) => (
                    <StoreCard key={store.id} store={store} />
                  ))}
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function StoreCard({ store }: { store: Store }) {
  const initials = store.name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const location = store.district !== "-" ? store.district : store.city;

  return (
    <Link
      href={`/catalog/stores/${store.id}`}
      className="flex flex-col overflow-hidden rounded-2xl border border-[#293C32]/10 bg-[#FFFFFF] transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="flex-1 p-5">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[#293C32]/15 text-sm font-mono font-medium text-[#293C32]">
            {store.image ? (
              <img
                src={store.image}
                alt={store.name}
                className="h-12 w-12 rounded-full object-cover"
              />
            ) : (
              <span>{initials}</span>
            )}
          </div>
          <p className="flex items-center gap-1.5 text-sm text-[#6C726B]">
            <MapPin className="h-4 w-4 shrink-0" />
            {location}
          </p>
        </div>

        <p className="mt-4 line-clamp-5 text-sm leading-relaxed text-[#6C726B]">
          {store.description}
        </p>

        <div className="mt-4 flex flex-wrap gap-1.5">
          {store.categories.map((c) => (
            <span
              key={c}
              className="rounded-sm bg-[#42634F]/10 px-2.5 py-1 font-mono text-xs text-[#42634F]"
            >
              {CATEGORY_LABEL[c]}
            </span>
          ))}
        </div>

        <div className="mt-4 border-t border-dashed border-[#293C32]/15 pt-3">
          {store.productIds.length > 0 ? (
            <p className="font-mono text-xs text-[#737D6C]">
              {store.productIds.length} бүтээгдэхүүн байршуулсан
            </p>
          ) : (
            <p className="text-xs italic text-[#737D6C]">
              Одоогоор бүтээгдэхүүн байршуулаагүй байна
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[#293C32]/10 px-5 py-3">
        <p className="text-base text-[#293C32]">{store.name}</p>
        {store.phone !== "-" && (
          <p className="flex items-center gap-1.5 font-mono text-xs text-[#6C726B]">
            <Phone className="h-3.5 w-3.5 shrink-0" />
            {store.phone}
          </p>
        )}
      </div>
    </Link>
  );
}

