"use client";

import { useEffect, useId, useRef, useState } from "react";
import Form from "next/form";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { ArrowUpRight, Box, Search } from "lucide-react";
import { useCatalogStore } from "@/store/catalog";
import { searchProducts } from "@/lib/productSearch";
import { CATEGORY_LABEL, priceFor } from "@/lib/products";
import { formatPrice } from "@/lib/format";
import { stockLabel } from "@/lib/inventory";
type KitchenResult = {
  id: string;
  slug: string;
  title: string;
  storeName: string;
  thumbnailUrl: string | null;
  tags: string[];
};

export function ProductSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [kitchenSearch, setKitchenSearch] = useState<{
    query: string;
    designs: KitchenResult[];
    total: number;
    error: boolean;
  } | null>(null);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const pathname = usePathname();
  const router = useRouter();
  const { products, ready, loading, error, refresh } = useCatalogStore();
  const matches = searchProducts(products, query);
  const results = matches.slice(0, 6);
  const visible = open && !!query.trim();
  const kitchenResults =
    kitchenSearch?.query === query.trim() ? kitchenSearch.designs : [];
  const optionCount = (ready ? results.length : 0) + kitchenResults.length;
  const selected = ready && visible ? results[active] : undefined;
  const selectedKitchen = visible
    ? kitchenResults[active - (ready ? results.length : 0)]
    : undefined;
  const selectedId = selected
    ? `${id}-${selected.id}`
    : selectedKitchen
      ? `${id}-kitchen-${selectedKitchen.id}`
      : undefined;
  useEffect(() => {
    if (!visible) return;
    const controller = new AbortController();
    const term = query.trim();
    const timer = window.setTimeout(() => {
      void fetch(`/api/kitchen-designs/search?q=${encodeURIComponent(term)}`, {
        signal: controller.signal,
      })
        .then(async (response) => {
          const data = await response.json();
          if (!response.ok || !Array.isArray(data.designs))
            throw new Error("Search failed");
          if (!controller.signal.aborted)
            setKitchenSearch({
              query: term,
              designs: data.designs,
              total: data.total,
              error: false,
            });
        })
        .catch(() => {
          if (!controller.signal.aborted)
            setKitchenSearch({
              query: term,
              designs: [],
              total: 0,
              error: true,
            });
        });
    }, 250);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [query, visible]);

  // Reuse the catalog cache; opening the home page does not fetch the entire catalog.
  useEffect(() => {
    if (visible && !ready && !loading && !error) void refresh();
  }, [visible, ready, loading, error, refresh]);
  useEffect(() => {
    setOpen(false);
    setActive(-1);
  }, [pathname]);
  useEffect(() => {
    if (visible && active >= 0)
      root.current
        ?.querySelectorAll<HTMLElement>('[role="option"]')
        [active]?.scrollIntoView({ block: "nearest" });
  }, [active, visible]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  return (
    <div
      ref={root}
      className="product-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
          setActive(-1);
        }
      }}
    >
      <Form
        action={
          ready && !matches.length && kitchenResults.length
            ? "/kitchens"
            : "/catalog"
        }
        role="search"
        className="store-search"
        onSubmit={() => {
          setOpen(false);
          setActive(-1);
        }}
      >
        <input
          type="search"
          name="q"
          role="combobox"
          aria-label="Тавилга хайх"
          aria-autocomplete="list"
          aria-expanded={visible}
          aria-controls={`${id}-results`}
          aria-activedescendant={selectedId}
          autoComplete="off"
          placeholder="Тавилга хайх…"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(-1);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              setOpen(false);
              setActive(-1);
            }
            if (event.key === "Enter" && selected) {
              event.preventDefault();
              router.push(`/product/${selected.id}`);
              setOpen(false);
              setActive(-1);
            }
            if (event.key === "Enter" && selectedKitchen) {
              event.preventDefault();
              router.push(`/kitchens/${selectedKitchen.slug}`);
              setOpen(false);
              setActive(-1);
            }
            if (
              event.key === "Enter" &&
              active === -1 &&
              ready &&
              !matches.length &&
              kitchenResults.length
            ) {
              event.preventDefault();
              router.push(`/kitchens?q=${encodeURIComponent(query.trim())}`);
              setOpen(false);
            }
            if (
              (event.key === "ArrowDown" || event.key === "ArrowUp") &&
              optionCount
            ) {
              event.preventDefault();
              setOpen(true);
              setActive((previous) =>
                event.key === "ArrowDown"
                  ? (previous + 1) % optionCount
                  : previous <= 0
                    ? optionCount - 1
                    : previous - 1,
              );
            }
          }}
        />
        <button type="submit" aria-label="Хайх">
          <Search size={18} aria-hidden="true" />
        </button>
      </Form>
      {visible && (
        <div className="search-popover">
          <div className="search-popover-heading">
            <strong>Тавилга</strong>
            <span role="status">
              {ready ? `${matches.length} илэрц` : "Хайж байна…"}
            </span>
          </div>
          {!ready &&
            (error ? (
              <div className="search-message">
                <p>Тавилгын мэдээллийг ачаалж чадсангүй.</p>
                <button type="button" onClick={() => void refresh(true)}>
                  Дахин оролдох
                </button>
              </div>
            ) : (
              <p className="search-message" role="status">
                Тавилга ачаалж байна…
              </p>
            ))}
          {ready &&
            !matches.length &&
            kitchenSearch?.query === query.trim() &&
            !kitchenResults.length && (
              <p className="search-message">
                «{query.trim()}» гэсэн тавилга олдсонгүй. Өөр нэр эсвэл tag-аар
                хайгаарай.
              </p>
            )}
          <div
            id={`${id}-results`}
            role="listbox"
            aria-label="Хайлтын тавилгууд"
            className="search-result-list"
          >
            {ready &&
              results.map((product, index) => (
                <Link
                  key={product.id}
                  href={`/product/${product.id}`}
                  id={`${id}-${product.id}`}
                  role="option"
                  aria-selected={active === index}
                  tabIndex={-1}
                  className="search-result"
                  onPointerMove={() => setActive(index)}
                  onClick={() => {
                    setOpen(false);
                    setActive(-1);
                  }}
                >
                  <span className="search-result-image">
                    {product.image ? (
                      <Image
                        src={product.image}
                        alt=""
                        width={56}
                        height={56}
                        unoptimized
                      />
                    ) : (
                      <Box size={22} />
                    )}
                  </span>
                  <span className="search-result-copy">
                    <strong>{product.name}</strong>
                    <small>
                      {CATEGORY_LABEL[product.category]} · {stockLabel(product)}
                    </small>
                    <b>
                      {formatPrice(
                        priceFor(
                          product,
                          product.defaultColor,
                          product.materials[0]?.id ?? "wood",
                        ),
                      )}
                    </b>
                  </span>
                  <ArrowUpRight size={16} aria-hidden="true" />
                </Link>
              ))}
            {kitchenResults.length > 0 && (
              <div className="search-popover-heading" role="presentation">
                <strong>Гал тогооны загвар</strong>
                <span>{kitchenSearch?.total} илэрц</span>
              </div>
            )}
            {kitchenResults.map((design, index) => (
              <Link
                key={design.id}
                href={`/kitchens/${design.slug}`}
                id={`${id}-kitchen-${design.id}`}
                role="option"
                aria-selected={active === (ready ? results.length : 0) + index}
                tabIndex={-1}
                className="search-result"
                onPointerMove={() =>
                  setActive((ready ? results.length : 0) + index)
                }
                onClick={() => {
                  setOpen(false);
                  setActive(-1);
                }}
              >
                <span className="search-result-image">
                  {design.thumbnailUrl ? (
                    <Image
                      src={design.thumbnailUrl}
                      alt=""
                      width={56}
                      height={56}
                      unoptimized
                    />
                  ) : (
                    <Box size={22} />
                  )}
                </span>
                <span className="search-result-copy">
                  <strong>{design.title}</strong>
                  <small>{design.storeName}</small>
                  <small>{design.tags.slice(0, 3).join(" · ")}</small>
                </span>
                <ArrowUpRight size={16} aria-hidden="true" />
              </Link>
            ))}
          </div>
          <Link
            className="search-all"
            href={`/catalog?q=${encodeURIComponent(query.trim())}`}
            onClick={() => setOpen(false)}
          >
            Бүх үр дүнг үзэх <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
          <Link
            className="search-all"
            href={`/kitchens?q=${encodeURIComponent(query.trim())}`}
            onClick={() => setOpen(false)}
          >
            Гал тогооны бүх илэрц <ArrowUpRight size={16} aria-hidden="true" />
          </Link>
        </div>
      )}
    </div>
  );
}
