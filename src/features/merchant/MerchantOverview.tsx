"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import {
  ArrowUpRight,
  Boxes,
  CircleAlert,
  Package,
  Store as StoreIcon,
  WalletCards,
} from "lucide-react";
import type { Product, Store } from "@/lib/types";
import { CATEGORY_LABEL } from "@/lib/products";
import { formatPrice } from "@/lib/format";
import { hasAvailableStock, stockLabel } from "@/lib/inventory";
import {
  type MerchantProduct,
  merchantRequest,
} from "@/features/merchant/merchantApi";

export function MerchantOverview({
  owner,
  store,
  onProducts,
  onStore,
}: {
  owner: string;
  store: Store | null;
  onProducts: () => void;
  onStore: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(Boolean(store));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);

    merchantRequest<{
      products: MerchantProduct[];
    }>("/api/merchant/products", owner, { signal: controller.signal })
      .then((result) => {
        if (active) {
          setProducts(result.products);
        }
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Dashboard мэдээллийг ачаалж чадсангүй.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [owner, store]);

  if (!store) {
    return (
      <section className="merchant-empty-dashboard">
        <span className="merchant-overview-icon">
          <StoreIcon size={26} />
        </span>

        <h1>Дэлгүүрээ эхлээд бүртгэнэ үү</h1>

        <p>
          Дэлгүүрийн үндсэн мэдээллээ бүртгэсний дараа бүтээгдэхүүн, нөөц болон
          захиалгын dashboard идэвхжинэ.
        </p>

        <button type="button" className="btn-primary" onClick={onStore}>
          Дэлгүүр нээх
          <ArrowUpRight size={16} />
        </button>
      </section>
    );
  }

  const totalStock = products.reduce(
    (sum, product) => sum + Number(product.stockQuantity ?? 0),
    0,
  );

  const inventoryValue = products.reduce(
    (sum, product) =>
      sum + product.basePrice * Number(product.stockQuantity ?? 0),
    0,
  );

  const lowStock = products.filter(
    (product) => Number(product.stockQuantity ?? 0) <= 5,
  ).length;

  const categoryMap = new Map<Product["category"], number>();

  for (const product of products) {
    categoryMap.set(
      product.category,
      (categoryMap.get(product.category) ?? 0) + 1,
    );
  }

  const categories = [...categoryMap.entries()]
    .map(([category, count]) => ({
      category,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const topProducts = [...products]
    .sort((a, b) => Number(b.stockQuantity ?? 0) - Number(a.stockQuantity ?? 0))
    .slice(0, 6);

  const maxStock = Math.max(
    1,
    ...topProducts.map((product) => Number(product.stockQuantity ?? 0)),
  );

  const colors = [
    "#8b78ff",
    "#6c5bdd",
    "#b3a7ff",
    "#72c98a",
    "#b5bbca",
    "#4a4e59",
  ];

  let cursor = 0;

  const donutStops = categories.length
    ? categories
        .map((item, index) => {
          const start = cursor;

          const share = (item.count / Math.max(1, products.length)) * 100;

          cursor += share;

          return `${colors[index % colors.length]} ${start}% ${cursor}%`;
        })
        .join(", ")
    : "#27292d 0 100%";

  return (
    <section className="merchant-overview">
      <div className="merchant-overview-heading">
        <div>
          <span>Агуулах</span>
          <h2>Нөөцийн тойм</h2>
          <p>Бүтээгдэхүүн болон нөөцийн өнөөгийн мэдээлэл.</p>
        </div>

        <Link
          href={`/catalog/stores/${store.id}`}
          className="merchant-view-store"
        >
          Дэлгүүр үзэх
          <ArrowUpRight size={15} />
        </Link>
      </div>

      {error && (
        <p className="merchant-error" role="alert">
          {error}
        </p>
      )}

      <div className="merchant-kpis">
        <article className="merchant-kpi">
          <div className="merchant-kpi-icon">
            <WalletCards size={20} />
          </div>

          <div>
            <span>Нөөцийн үнэлгээ</span>
            <strong>{loading ? "—" : formatPrice(inventoryValue)}</strong>
            <small>Одоогийн нийт барааны үнэлгээ</small>
          </div>
        </article>

        <article className="merchant-kpi">
          <div className="merchant-kpi-icon">
            <Package size={20} />
          </div>

          <div>
            <span>Бүтээгдэхүүн</span>
            <strong>{loading ? "—" : products.length}</strong>
            <small>Нийт бүртгэлтэй бараа</small>
          </div>
        </article>

        <article className="merchant-kpi">
          <div className="merchant-kpi-icon">
            <Boxes size={20} />
          </div>

          <div>
            <span>Нийт нөөц</span>
            <strong>{loading ? "—" : totalStock}</strong>
            <small>Бэлэн байгаа ширхэг</small>
          </div>
        </article>

        <article className="merchant-kpi">
          <div className="merchant-kpi-icon warning">
            <CircleAlert size={20} />
          </div>

          <div>
            <span>Бага нөөцтэй</span>
            <strong>{loading ? "—" : lowStock}</strong>
            <small>5 болон түүнээс бага үлдэгдэл</small>
          </div>
        </article>
      </div>

      <div className="merchant-dashboard-grid">
        <article className="merchant-dashboard-card merchant-stock-chart">
          <header>
            <div>
              <h2>Нөөцийн төлөв</h2>
              <p>Нөөц хамгийн ихтэй бүтээгдэхүүнүүд</p>
            </div>

          </header>

          <div className="merchant-bars">
            {!topProducts.length ? (
              <div className="merchant-chart-empty">
                Бүтээгдэхүүн бүртгэгдээгүй байна.
              </div>
            ) : (
              topProducts.map((product) => {
                const stock = Number(product.stockQuantity ?? 0);

                return (
                  <div className="merchant-bar-row" key={product.id}>
                    <div className="merchant-bar-label">
                      <span>{product.name}</span>
                      <strong>{stock}</strong>
                    </div>

                    <div className="merchant-bar-track">
                      <span
                        style={{
                          width: `${Math.max(0, (stock / maxStock) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="merchant-dashboard-card merchant-category-card">
          <header>
            <div>
              <h2>Ангиллын бүтэц</h2>
              <p>Бүтээгдэхүүний ангиллаар</p>
            </div>
          </header>

          <div className="merchant-category-body">
            <div
              className="merchant-donut"
              style={{
                background: `conic-gradient(${donutStops})`,
              }}
            >
              <div>
                <strong>{products.length}</strong>
                <span>Бараа</span>
              </div>
            </div>

            <div className="merchant-category-legend">
              {categories.slice(0, 6).map((item, index) => (
                <div key={item.category}>
                  <span
                    className="merchant-legend-dot"
                    style={{
                      backgroundColor: colors[index % colors.length],
                    }}
                  />

                  <span>{CATEGORY_LABEL[item.category]}</span>

                  <strong>
                    {Math.round(
                      (item.count / Math.max(1, products.length)) * 100,
                    )}
                    %
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>

      <article className="merchant-dashboard-card merchant-products-preview">
        <header>
          <div>
            <h2>Бүтээгдэхүүний тойм</h2>
            <p>Нөөц хамгийн ихтэй бүтээгдэхүүнүүд</p>
          </div>

          <button type="button" onClick={onProducts}>
            Бүх бүтээгдэхүүн
            <ArrowUpRight size={14} />
          </button>
        </header>

        <div className="merchant-preview-list">
          {!topProducts.length && <div className="merchant-chart-empty">Бүтээгдэхүүн бүртгэгдээгүй байна. Бүх бүтээгдэхүүн хэсгээс эхний бараагаа нэмээрэй.</div>}
          {topProducts.slice(0, 5).map((product) => (
            <div key={product.id}>
              <Image
                src={product.image}
                alt={product.name}
                width={52}
                height={52}
                sizes="52px"
              />

              <div>
                <strong>{product.name}</strong>
                <span>{CATEGORY_LABEL[product.category]}</span>
              </div>

              <span className="merchant-preview-price">
                {formatPrice(product.basePrice)}
              </span>

              <span
                className={`merchant-preview-stock ${hasAvailableStock(product) ? "" : "is-unavailable"}`}
              >
                {stockLabel(product)}
              </span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
