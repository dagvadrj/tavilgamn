"use client";

import { useId, useState } from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { CATEGORIES } from "@/lib/catalogCategories";
import { categoryFacets, categoryHref } from "@/lib/catalogFacets";
import { hasAvailableStock } from "@/lib/inventory";
import type { Category, Product } from "@/lib/types";

/** The same inventory-backed hierarchy in navigation and the filter sheet. */
export function CategoryBrowser({
  products,
  ready,
  selected = [],
  facet = "",
  onSelect,
  onNavigate,
}: {
  products: Product[];
  ready: boolean;
  selected?: Category[];
  facet?: string;
  onSelect?: (category: Category, facet: string) => void;
  onNavigate?: () => void;
}) {
  const id = useId();
  const [expanded, setExpanded] = useState<Category | null>(
    selected[0] ?? null,
  );
  return (
    <div className="category-browser" aria-label="Тавилгын ангилал ба төрөл">
      {CATEGORIES.map((category) => {
        const count = products.filter(
          (product) =>
            product.category === category.id && hasAvailableStock(product),
        ).length;
        const options = categoryFacets(products, category.id);
        const open = expanded === category.id;
        const active = selected.includes(category.id);
        return (
          <section key={category.id} className="category-branch">
            <button
              type="button"
              className="category-branch-trigger"
              aria-expanded={open}
              aria-controls={`${id}-${category.id}`}
              data-selected={active || undefined}
              onClick={() => setExpanded(open ? null : category.id)}
            >
              <span>{category.name}</span>
              <span className="category-count">{ready ? count : "—"}</span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
            <div
              id={`${id}-${category.id}`}
              hidden={!open}
              className="category-branch-options"
            >
              {[
                {
                  id: "",
                  label: `Бүх ${category.name.toLocaleLowerCase("mn-MN")}`,
                  count,
                },
                ...options,
              ].map((option) =>
                onSelect ? (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active && facet === option.id}
                    onClick={() => onSelect(category.id, option.id)}
                  >
                    <span>{option.label}</span>
                    <span className="category-count">
                      {ready ? option.count : "—"}
                    </span>
                  </button>
                ) : (
                  <Link
                    key={option.id}
                    href={categoryHref(category.id, option.id)}
                    onClick={onNavigate}
                  >
                    <span>{option.label}</span>
                    <span className="category-count">
                      {ready ? option.count : "—"}
                    </span>
                  </Link>
                ),
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
