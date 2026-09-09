import { notFound } from "next/navigation";
import { readProduct, readProducts } from "@/lib/catalogServer";

export const dynamic = "force-dynamic";
import { ProductCustomizer } from "@/components/ProductCustomizer";
import { ProductCard } from "@/components/ProductCard";
import { hasAvailableStock } from "@/lib/inventory";

export async function generateMetadata({ params }: { params: { id: string } }) {
  const product = await readProduct(params.id);

  if (!product) return {};

  return { title: `${product.name} — tavilga.mn` };
}

export default async function ProductPage({
  params,
}: {
  params: { id: string };
}) {
  const product = await readProduct(params.id);

  if (!product || !hasAvailableStock(product)) notFound();

  const related = (await readProducts())
    .filter(
      (item) => hasAvailableStock(item) && item.category === product.category && item.id !== product.id,
    )
    .slice(0, 4);
  return (
    <>
      <ProductCustomizer key={JSON.stringify(product)} product={product} />
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
