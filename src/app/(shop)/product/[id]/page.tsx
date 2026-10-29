import { Suspense, cache } from "react";
import Link from "next/link";
import { PageSkeleton } from "@/components/PageSkeleton";
import { SkeletonProductGrid } from "@/components/loading/SkeletonParts";
import { ProductCustomizer } from "@/components/ProductCustomizer";
import { ProductCard } from "@/components/ProductCard";
import { readProduct } from "@/lib/catalogServer";
import { readCachedProducts } from "@/lib/publicCatalog";
import { hasAvailableStock } from "@/lib/inventory";
import { withTimeout } from "@/lib/withTimeout";

export const metadata = { title: "Тавилгын дэлгэрэнгүй — tavilga.mn" };

/** One database read per request, shared by both sections. */
const availableProduct = cache(async (id: string) => {
  if (!id || id.length > 100) return undefined;
  const product = await withTimeout(readProduct(id), 8000, "Product");
  return product && hasAvailableStock(product) ? product : undefined;
});

/**
 * The product and its related items stream as separate sections: the product
 * (and its photo, the LCP) renders as soon as its own row arrives, without
 * waiting for the catalog read that feeds «Төстэй бараа».
 */
export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ view?: string; color?: string }>;
}) {
  const { id } = await params;
  const options = await searchParams;
  return (
    <>
      <Suspense fallback={<PageSkeleton variant="detail" />}>
        <ProductMain id={id} view={options?.view} color={options?.color} />
      </Suspense>
      <Suspense fallback={<RelatedSkeleton />}>
        <RelatedProducts id={id} />
      </Suspense>
    </>
  );
}

async function ProductMain({
  id,
  view,
  color,
}: {
  id: string;
  view?: string;
  color?: string;
}) {
  const product = await availableProduct(id);
  if (!product)
    return (
      <div className="shop-container py-16 text-center">
        <h1 className="text-xl font-semibold">Мэдээлэл олдсонгүй</h1>
        <p role="alert" className="my-4 text-sm">
          Таны хүссэн мэдээлэл олдсонгүй.
        </p>
        <Link href="/catalog" className="btn-primary">
          Каталог үзэх
        </Link>
      </div>
    );
  return (
    <>
      <title>{`${product.name} — tavilga.mn`}</title>
      <ProductCustomizer
        key={JSON.stringify([product, color])}
        product={product}
        initialView3D={view === "3d"}
        initialColor={color}
      />
    </>
  );
}

function RelatedSkeleton() {
  return (
    <section
      className="shop-container pb-16 pt-8"
      aria-busy="true"
      aria-label="Төстэй барааг ачаалж байна"
    >
      <h2 className="mb-8 text-2xl">Төстэй бараа</h2>
      <SkeletonProductGrid />
    </section>
  );
}

async function RelatedProducts({ id }: { id: string }) {
  // Related items are extra: a slow or failed catalog read hides the section
  // instead of taking the product down with it.
  const [product, catalog] = await Promise.all([
    availableProduct(id).catch(() => undefined),
    withTimeout(readCachedProducts(), 8000, "Catalog").catch(() => []),
  ]);
  if (!product) return null;
  const related = catalog
    .filter(
      (item) =>
        hasAvailableStock(item) &&
        item.category === product.category &&
        item.id !== product.id,
    )
    .slice(0, 4);
  if (!related.length) return null;
  return (
    <section className="shop-container pb-16 pt-8">
      <h2 className="mb-8 text-2xl">Төстэй бараа</h2>
      <div className="product-grid">
        {related.map((item) => (
          <ProductCard key={item.id} product={item} />
        ))}
      </div>
    </section>
  );
}
