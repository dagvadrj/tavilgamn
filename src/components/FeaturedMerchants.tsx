import Link from "next/link";
import { ArrowUpRight, Star, MapPin } from "lucide-react";
import type { Product, Store } from "@/lib/types";
import { storeCatalogStats } from "@/lib/homeMarketplace";

export function FeaturedMerchants({ stores, products }: { stores: Store[]; products: Product[] }) {
  const featured = stores.map(store => ({ store, stats: storeCatalogStats(store, products) }))
    .sort((a, b) => b.stats.productCount - a.stats.productCount).slice(0, 4);
  if (!featured.length) return null;

  return <section id="stores" className="market-panel featured-merchants" aria-labelledby="stores-title">
    <div className="market-section-heading">
      <h2 id="stores-title">Онцлох дэлгүүрүүд</h2>
      <Link href="/stores">Бүх дэлгүүр <ArrowUpRight size={15} aria-hidden="true" /></Link>
    </div>
    <div className="featured-merchants-grid">
      {featured.map(({ store, stats }) => <Link key={store.id} href={`/catalog/stores/${store.id}`} className="featured-merchant-card">
        <span className="store-monogram" aria-hidden="true">{store.name.trim().slice(0, 2).toLocaleUpperCase("mn")}</span>
        <div className="featured-merchant-body">
          <h3>{store.name}</h3>
          <p><MapPin size={12} aria-hidden="true" />{store.district && store.district !== "-" ? store.district : store.city}</p>
          <div className="merchant-stats">
            {stats.rating !== null ? <span title="Каталогийн бараануудын сэтгэгдлээр жигнэсэн үнэлгээ"><Star size={12} fill="currentColor" aria-hidden="true" />{stats.rating.toFixed(1)} <small>Барааны үнэлгээ</small></span> : <small>Үнэлгээ хүлээж байна</small>}
            <span>{stats.productCount} бараа</span>
          </div>
        </div>
        <ArrowUpRight size={15} className="merchant-arrow" aria-hidden="true" />
      </Link>)}
    </div>
  </section>;
}
