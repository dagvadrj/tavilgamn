"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { RefreshCw } from "lucide-react";
import type { Product } from "@/lib/types";
import { ProductCard } from "./ProductCard";

export function HomeRecommendations({ products, initialCount, offerCheckedAt }: {
  products: Product[];
  initialCount: number;
  offerCheckedAt: number;
}) {
  const [visibleCount, setVisibleCount] = useState(initialCount);
  const [pending, startTransition] = useTransition();
  const sentinel = useRef<HTMLDivElement>(null);
  const loading = useRef(false);
  const hasMore = visibleCount < products.length;

  useEffect(() => {
    loading.current = false;
    if (!hasMore || !sentinel.current) return;
    let active = true;

    const loadNext = () => {
      if (!active || loading.current) return;
      loading.current = true;
      startTransition(() => {
        setVisibleCount(count => Math.min(count + 10, products.length));
      });
    };

    if (typeof IntersectionObserver !== "undefined") {
      const observer = new IntersectionObserver(entries => {
        if (entries.some(entry => entry.isIntersecting)) loadNext();
      }, { rootMargin: "0px 0px 200px 0px" });
      observer.observe(sentinel.current);
      return () => {
        active = false;
        observer.disconnect();
      };
    }

    // Older browsers still load automatically when the list reaches the viewport.
    const onScroll = () => {
      const bounds = sentinel.current?.getBoundingClientRect();
      if (bounds && bounds.top <= window.innerHeight + 200 && bounds.bottom >= 0) loadNext();
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => {
      active = false;
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [visibleCount, hasMore, products.length, startTransition]);

  return (
    <>
      <div className="market-product-grid" aria-busy={pending}>
        {products.slice(0, visibleCount).map(product => (
          <ProductCard key={product.id} product={product} offerCheckedAt={offerCheckedAt} />
        ))}
      </div>
      {hasMore && (
        <div ref={sentinel} className="market-load-more" role="status">
          <RefreshCw size={20} aria-hidden="true" className={pending ? "market-scroll-loader animate-spin" : "market-scroll-loader"} />
          <span className="sr-only">
            {pending ? "Дараагийн тавилгуудыг ачаалж байна…" : "Доош гүйлгэхэд дараагийн тавилгууд автоматаар харагдана."}
          </span>
        </div>
      )}
    </>
  );
}
