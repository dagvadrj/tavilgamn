"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react";
import {
  ArrowDownWideNarrow,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import "./planner-catalog-toolbar.css";

export type PlannerCatalogSort = "default" | "name-asc" | "name-desc";
export function sortPlannerCatalog<T>(
  items: readonly T[],
  sort: PlannerCatalogSort,
  name: (item: T) => string,
): T[] {
  if (sort === "default") return [...items];
  return [...items].sort(
    (a, b) =>
      name(a).localeCompare(name(b), "mn", { numeric: true }) *
      (sort === "name-desc" ? -1 : 1),
  );
}

/** A single control row shared by both planners; advanced fields only occupy space on demand. */
export function PlannerCatalogToolbar({
  query,
  onQuery,
  label,
  placeholder,
  inputRef,
  filters,
  filterCount = 0,
  sort,
  onSort,
}: {
  query: string;
  onQuery: (value: string) => void;
  label: string;
  placeholder: string;
  inputRef?: Ref<HTMLInputElement>;
  filters: ReactNode;
  filterCount?: number;
  sort: PlannerCatalogSort;
  onSort: (value: PlannerCatalogSort) => void;
}) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [open]);
  return (
    <div
      ref={root}
      className="planner-catalog-controls"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <div
        className="planner-catalog-toolbar"
        role="group"
        aria-label="Хайлт, шүүлтүүр, эрэмбэ"
      >
        <button
          ref={trigger}
          type="button"
          className="planner-catalog-filter"
          aria-label={
            "Шүүлтүүр" + (filterCount ? ", " + filterCount + " идэвхтэй" : "")
          }
          title="Шүүлтүүр"
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen((value) => !value)}
        >
          <SlidersHorizontal size={18} />
          {filterCount > 0 && (
            <span className="planner-filter-count">{filterCount}</span>
          )}
        </button>
        <label className="planner-catalog-search">
          <Search size={16} aria-hidden="true" />
          <input
            ref={inputRef}
            type="search"
            aria-label={label}
            placeholder={placeholder}
            value={query}
            onChange={(event) => onQuery(event.target.value)}
          />
        </label>
        <label className="planner-catalog-sort" title="Эрэмбэлэх">
          <ArrowDownWideNarrow size={18} aria-hidden="true" />
          <select
            aria-label="Эрэмбэлэх"
            value={sort}
            onChange={(event) =>
              onSort(event.target.value as PlannerCatalogSort)
            }
          >
            <option value="default">Үндсэн дараалал</option>
            <option value="name-asc">Нэр · А–Я</option>
            <option value="name-desc">Нэр · Я–А</option>
          </select>
        </label>
      </div>
      <section
        id={id}
        className="planner-catalog-filter-panel"
        aria-label="Каталогийн шүүлтүүр"
        hidden={!open}
      >
        <header>
          <strong>Шүүлтүүр</strong>
          <button
            type="button"
            aria-label="Шүүлтүүр хаах"
            onClick={() => {
              setOpen(false);
              trigger.current?.focus();
            }}
          >
            <X size={18} />
          </button>
        </header>
        {filters}
      </section>
    </div>
  );
}
