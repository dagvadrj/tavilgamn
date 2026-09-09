"use client";
import Link from "next/link";
import { Heart, ArrowRight } from "lucide-react";
import { useWishlist } from "@/store/wishlist";
import { getProduct, useCatalog } from "@/store/catalog";
import { CatalogStatus } from "@/components/CatalogStatus";
import { ProductCard } from "@/components/ProductCard";
import { hasAvailableStock } from "@/lib/inventory";

export default function WishlistPage() {
  const catalog = useCatalog();
  const items = useWishlist((s) => s.items);
  const products = items
    .map((i) => getProduct(i.productId))
    .filter((p): p is NonNullable<typeof p> => p != null && hasAvailableStock(p));

  if (catalog.loading || !catalog.ready) {
    return (
      <CatalogStatus
        loading={catalog.loading}
        error={catalog.error}
        retry={() => void catalog.refresh()}
      />
    );
  }
  if (products.length === 0) {
    return (
      <div className="shop-container py-10 sm:py-16"><div className="shop-empty">
        <Heart size={44} strokeWidth={1.3} />
        <h1>Таны дуртай тавилга энд хадгалагдана</h1>
        <p className="mt-3 max-w-md text-ink/60">
          Таалагдсан тавилгын зүрхэн дээр дарж хадгалаарай. Бид дараагийн
          удаагийн төлөө хадгалж үлдээх болно.
        </p>
        <Link href="/catalog" className="btn-primary mt-6">
          Тавилга үзэх <ArrowRight size={17} />
        </Link>
      </div></div>
    );
  }

  return (
    <div className="shop-container py-8 sm:py-12">
      <p className="label mb-2">Хүслийн жагсаалт</p>
      <h1 className="text-3xl font-semibold tracking-tight">Хадгалсан тавилга</h1>
      <p className="mt-2 text-sm text-ink/60">{products.length} ширхэг</p>
      <div className="product-grid mt-8">
        {products.map((p) => (
          <ProductCard key={p.id} product={p} />
        ))}
      </div>
    </div>
  );
}

