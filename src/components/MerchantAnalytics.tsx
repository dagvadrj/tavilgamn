"use client";
import { PageSkeleton } from "@/components/PageSkeleton";

import { useMerchantResource } from "@/features/merchant/useMerchantResource";

import {
  BadgeDollarSign,
  Box,
  CircleDollarSign,
  Package,
  RefreshCw,
  ShoppingBag,
  TriangleAlert,
} from "lucide-react";

export type MerchantAnalyticsData = {
  periodStart: string;
  asOf: string;

  storeId: string;
  storeName: string;

  commissionBps: number;

  grossRevenue: string;
  platformFee: string;
  merchantNet: string;

  paidOrders: string;

  pendingOrders: string;
  processingOrders: string;
  shippedOrders: string;

  productCount: string;
  totalStock: string;
  lowStockCount: string;

  modelRequestCount: string;
};

function money(value: string) {
  return `${BigInt(value).toLocaleString("mn-MN")} ₮`;
}

function count(value: string) {
  return BigInt(value).toLocaleString("mn-MN");
}

export function useMerchantAnalytics(owner: string, enabled = true) {
  const result = useMerchantResource<{
    analytics: MerchantAnalyticsData | null;
  }>(owner, "/api/merchant/analytics", enabled, 60000);
  return {
    analytics: result.data?.analytics ?? null,
    loading: result.loading,
    error: result.error,
    refresh: result.refresh,
  };
}

export function MerchantAnalytics({ owner }: { owner: string }) {
  const { analytics, loading, error, refresh } = useMerchantAnalytics(owner);
  if (loading) {
    return (
      <PageSkeleton compact layout="metrics" />
    );
  }

  if (error) {
    return (
      <div className="merchant-panel">
        <p className="merchant-error" role="alert">
          {error}
        </p>

        <button type="button" className="btn-ghost" onClick={refresh}>
          <RefreshCw size={16} />
          Дахин оролдох
        </button>
      </div>
    );
  }

  if (!analytics) {
    return null;
  }

  const commission = analytics.commissionBps / 100;

  return (
    <section className="merchant-finance-overview">
      <div className="merchant-overview-heading">
        <div>
          <span className="merchant-eyebrow">СҮҮЛИЙН 30 ХОНОГ</span>

          <h2>Санхүүгийн тойм</h2>

          <p>Борлуулалт болон платформын шимтгэлийн мэдээлэл.</p>
        </div>

        <button type="button" className="btn-ghost" onClick={refresh}>
          <RefreshCw size={15} />
          Шинэчлэх
        </button>
      </div>

      <div className="merchant-metrics">
        <Metric
          icon={ShoppingBag}
          label="Нийт борлуулалт"
          value={money(analytics.grossRevenue)}
          detail="Төлөгдсөн захиалга"
        />

        <Metric
          icon={BadgeDollarSign}
          label="Платформын шимтгэл"
          value={money(analytics.platformFee)}
          detail={`${commission.toFixed(1)}% шимтгэл`}
        />

        <Metric
          icon={CircleDollarSign}
          label="Цэвэр орлого"
          value={money(analytics.merchantNet)}
          detail="Шимтгэл хассан дүн"
          featured
        />

        <Metric
          icon={Package}
          label="Төлөгдсөн захиалга"
          value={count(analytics.paidOrders)}
          detail="Сүүлийн 30 хоног"
        />
      </div>

      <div className="merchant-overview-secondary">
        <article>
          <Box size={18} />

          <div>
            <span>3D загварын хүсэлт</span>

            <strong>{count(analytics.modelRequestCount)}</strong>
          </div>
        </article>
      </div>

      <div className="merchant-order-summary">
        <div>
          <span>Хүлээгдэж буй</span>

          <strong>{count(analytics.pendingOrders)}</strong>
        </div>

        <div>
          <span>Бэлтгэж байгаа</span>

          <strong>{count(analytics.processingOrders)}</strong>
        </div>

        <div>
          <span>Хүргэлтэд гарсан</span>

          <strong>{count(analytics.shippedOrders)}</strong>
        </div>
      </div>
    </section>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  featured = false,
}: {
  icon: typeof Package;
  label: string;
  value: string;
  detail: string;
  featured?: boolean;
}) {
  return (
    <article className={`merchant-metric ${featured ? "featured" : ""}`}>
      <div>
        <span>{label}</span>
        <Icon size={18} />
      </div>

      <strong>{value}</strong>

      <small>{detail}</small>
    </article>
  );
}
