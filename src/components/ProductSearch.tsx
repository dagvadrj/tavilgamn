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

export function ProductSearch() {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  const pathname = usePathname();
  const router = useRouter();
  const { products, ready, loading, error, refresh } = useCatalogStore();
  const matches = searchProducts(products, query);
  const results = matches.slice(0, 6);
  const visible = open && !!query.trim();
  const selected = ready && visible ? results[active] : undefined;

  // Reuse the catalog cache; opening the home page does not fetch the entire catalog.
  useEffect(() => {
    if (visible && !ready && !loading && !error) void refresh();
  }, [visible, ready, loading, error, refresh]);
  useEffect(() => { setOpen(false); setActive(-1); }, [pathname]);
  useEffect(() => {
    if (visible && active >= 0) root.current?.querySelectorAll<HTMLElement>('[role="option"]')[active]?.scrollIntoView({ block: "nearest" });
  }, [active, visible]);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) { setOpen(false); setActive(-1); }
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  return <div ref={root} className="product-search" onBlur={event => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) { setOpen(false); setActive(-1); }
  }}>
    <Form action="/catalog" role="search" className="store-search" onSubmit={() => {
      setOpen(false); setActive(-1);
    }}>
      <input type="search" name="q" role="combobox" aria-label="Тавилга хайх"
        aria-autocomplete="list" aria-expanded={visible} aria-controls={`${id}-results`}
        aria-activedescendant={selected ? `${id}-${selected.id}` : undefined}
        autoComplete="off" placeholder="Тавилга хайх…" value={query}
        onFocus={() => setOpen(true)} onChange={event => { setQuery(event.target.value); setActive(-1); setOpen(true); }}
        onKeyDown={event => {
          if (event.key === "Escape") { event.preventDefault(); setOpen(false); setActive(-1); }
          if (event.key === "Enter" && selected) {
            event.preventDefault(); router.push(`/product/${selected.id}`); setOpen(false); setActive(-1);
          }
          if ((event.key === "ArrowDown" || event.key === "ArrowUp") && results.length) {
            event.preventDefault(); setOpen(true);
            setActive(previous => event.key === "ArrowDown" ? (previous + 1) % results.length : (previous <= 0 ? results.length - 1 : previous - 1));
          }
        }}/>
      <button type="submit" aria-label="Хайх"><Search size={18} aria-hidden="true" /></button>
    </Form>
    {visible && <div className="search-popover">
      <div className="search-popover-heading"><strong>Тавилга</strong><span role="status">{ready ? `${matches.length} илэрц` : "Хайж байна…"}</span></div>
      {!ready && (error ? <div className="search-message"><p>Тавилгын мэдээллийг ачаалж чадсангүй.</p><button type="button" onClick={() => void refresh(true)}>Дахин оролдох</button></div>
        : <p className="search-message" role="status">Тавилга ачаалж байна…</p>)}
      {ready && !matches.length && <p className="search-message">«{query.trim()}» гэсэн тавилга олдсонгүй. Өөр нэр эсвэл ангиллаар хайгаарай.</p>}
      <div id={`${id}-results`} role="listbox" aria-label="Хайлтын тавилгууд" className="search-result-list">
        {ready && results.map((product, index) => <Link key={product.id} href={`/product/${product.id}`}
          id={`${id}-${product.id}`} role="option" aria-selected={active === index} tabIndex={-1}
          className="search-result" onPointerMove={() => setActive(index)} onClick={() => { setOpen(false); setActive(-1); }}>
          <span className="search-result-image">{product.image ? <Image src={product.image} alt="" width={56} height={56} unoptimized/> : <Box size={22}/>}</span>
          <span className="search-result-copy"><strong>{product.name}</strong><small>{CATEGORY_LABEL[product.category]} · {stockLabel(product)}</small>
            <b>{formatPrice(priceFor(product, product.defaultColor, product.materials[0]?.id ?? "wood"))}</b></span>
          <ArrowUpRight size={16} aria-hidden="true"/>
        </Link>)}
      </div>
      <Link className="search-all" href={`/catalog?q=${encodeURIComponent(query.trim())}`} onClick={() => setOpen(false)}>
        Бүх үр дүнг үзэх <ArrowUpRight size={16} aria-hidden="true"/>
      </Link>
    </div>}
  </div>;
}
