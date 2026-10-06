import { notFound } from "next/navigation";
import { readProduct, readProducts } from "@/lib/catalogServer";

export const dynamic = "force-dynamic";
import { ProductCustomizer } from "@/components/ProductCustomizer";
import { ProductCard } from "@/components/ProductCard";
import { hasAvailableStock } from "@/lib/inventory";
import { cache, Suspense } from "react";

const getProduct = cache(readProduct);

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const product = await getProduct(id);

  if (!product) return {};

  return { title: `${product.name} — tavilga.mn` };
}

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ view?: string; color?: string }>;
}) {
  const { id } = await params;
  const [product, options] = await Promise.all([getProduct(id), searchParams ?? Promise.resolve({ view: undefined, color: undefined })]);

  if (!product || !hasAvailableStock(product)) notFound();

  return (
    <>
      <ProductCustomizer key={JSON.stringify([product, options.color])} product={product} initialView3D={options.view === "3d"} initialColor={options.color} />
      <Suspense fallback={null}><RelatedProducts product={product} /></Suspense>
    </>
  );
}

async function RelatedProducts({ product }: { product: NonNullable<Awaited<ReturnType<typeof readProduct>>> }) {
  const related = (await readProducts())
    .filter(
      (item) => hasAvailableStock(item) && item.category === product.category && item.id !== product.id,
    )
    .slice(0, 4);
  return (
    <>
      {related.length > 0 && (
        <section className="shop-container pb-16 pt-8">
          <h2 className="mb-8 text-2xl">Төстэй бараа</h2>
          <div className="product-grid">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
