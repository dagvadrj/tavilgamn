"use client";

import { RemotePage } from "@/components/RemotePage";
import type { PageData } from "@/lib/pageData";
import { ProductCustomizer } from "@/components/ProductCustomizer";
import { ProductCard } from "@/components/ProductCard";

export function ProductPageClient({
  id,
  view,
  color,
}: {
  id: string;
  view?: string;
  color?: string;
}) {
  return (
    <RemotePage page="product" id={id} variant="detail">
      {(data) => <ProductContent {...data} view={view} color={color} />}
    </RemotePage>
  );
}

export function ProductContent({
  product,
  related,
  view,
  color,
}: PageData["product"] & { view?: string; color?: string }) {
  return (
    <>
      <title>{`${product.name} — tavilga.mn`}</title>
      <ProductCustomizer
        key={JSON.stringify([product, color])}
        product={product}
        initialView3D={view === "3d"}
        initialColor={color}
      />
      {related.length > 0 && (
        <section className="shop-container pb-16 pt-8">
          <h2 className="mb-8 text-2xl">Төстэй бараа</h2>
          <div className="product-grid">
            {related.map((item) => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
