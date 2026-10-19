"use client";

import { useEffect, useState } from "react";

import {
  BadgeDollarSign,
  Box,
  CalendarDays,
  CircleDollarSign,
  Package,
  RefreshCw,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
import {
  DashboardBarChart,
  DashboardDonut,
} from "@/features/dashboard/DashboardCharts";
import { OrderHistory } from "@/components/OrderHistory";

type TopMerchant = {
  id: string;
  name: string;
  image: string;

  commissionBps: number;

  grossRevenue: string;
  platformRevenue: string;
  merchantNet: string;
  orders: string;
};

type Analytics = {
  periodStart: string;
  asOf: string;

  gmv: string;
  platformRevenue: string;
  merchantNet: string;

  paidOrders: string;

  totalMerchants: string;
  activeMerchants: string;
  featuredMerchants: string;

  openModelRequests: string;

  topMerchants: TopMerchant[];
};

const money = (value: string) => `${BigInt(value).toLocaleString("mn-MN")} ₮`;

const count = (value: string) => BigInt(value).toLocaleString("mn-MN");

const dateLabel = (date: string) =>
  new Date(date).toLocaleString("mn-MN", {
    timeZone: "Asia/Ulaanbaatar",

    year: "numeric",
    month: "short",
    day: "numeric",
  });

export function AdminAnalytics() {
  const userId = useAuth((state) => state.user?.id);

  const role = useAuth((state) => state.role);

  if (!userId || role !== "admin") {
    return null;
  }

  return <AnalyticsPanel key={userId} owner={userId} />;
}

function AnalyticsPanel({ owner }: { owner: string }) {
  const [result, setResult] = useState<Analytics | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    let active = true;

    setLoading(true);
    setError(null);

    authFetch(
      "/api/admin/analytics",
      {
        signal: controller.signal,
      },
      owner,
    )
      .then(async (response) => {
        const data = await response.json().catch(() => null);

        if (!response.ok || !data) {
          throw new Error(data?.error ?? "Аналитик ачаалсангүй.");
        }

        return data;
      })
      .then((data) => {
        if (
          !active ||
          useAuth.getState().user?.id !== owner ||
          useAuth.getState().role !== "admin"
        ) {
          return;
        }

        setResult(data);
      })
      .catch((reason) => {
        if (!active) return;

        setError(reason instanceof Error ? reason.message : "Алдаа гарлаа.");
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
  }, [owner, refresh]);

  return (
    <section className="reference-overview">
      <div className="reference-heading">
        <div>
          <span className="reference-eyebrow">
            MARKETPLACE · СҮҮЛИЙН 30 ХОНОГ
          </span>
          <h1>Ерөнхий тойм</h1>
          <p>Нийт GMV, шимтгэл болон дэлгүүрүүдийн гүйцэтгэл.</p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          disabled={loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          <RefreshCw size={15} />
          Шинэчлэх
        </button>
      </div>
      {loading ? (
        <div className="admin-loading" role="status">
          <RefreshCw size={22} />
          <p>Marketplace аналитик ачаалж байна…</p>
        </div>
      ) : error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : result ? (
        <>
          <div className="reference-date-range">
            <CalendarDays size={14} />
            {dateLabel(result.periodStart)} — {dateLabel(result.asOf)}
          </div>
          <div className="reference-kpis">
            <Metric
              icon={TrendingUp}
              label="Нийт GMV (30 хоног)"
              value={money(result.gmv)}
              detail={count(result.paidOrders) + " төлөгдсөн захиалга"}
            />
            <Metric
              icon={BadgeDollarSign}
              label="Платформын цэвэр орлого"
              value={money(result.platformRevenue)}
              detail="Төлөгдсөн захиалгын шимтгэл"
              featured
            />
            <Metric
              icon={CircleDollarSign}
              label="Merchant-д очих цэвэр дүн"
              value={money(result.merchantNet)}
              detail={
                count(result.activeMerchants) +
                " идэвхтэй дэлгүүр · " +
                count(result.featuredMerchants) +
                " Featured"
              }
            />
            <Metric
              icon={Box}
              label="Нээлттэй 3D хүсэлт"
              value={count(result.openModelRequests) + " хүсэлт"}
              detail="Шийдвэрлэх шаардлагатай загварууд"
            />
          </div>
          <RevenuePanels result={result} />
        </>
      ) : null}
      <section className="reference-orders">
        <div className="admin-panel-heading">
          <div>
            <h2>Захиалгын мэдээлэл</h2>
            <p>Marketplace-ийн бүх захиалга.</p>
          </div>
          <Package size={21} />
        </div>
        <OrderHistory admin />
      </section>
    </section>
  );
}

function ratio(value: string, total: string) {
  const denominator = BigInt(total);
  if (denominator <= 0n) return 0;
  return Math.max(
    0,
    Math.min(100, Number((BigInt(value) * 10000n) / denominator) / 100),
  );
}

function RevenuePanels({ result }: { result: Analytics }) {
  const merchants = result.topMerchants.slice(0, 5);
  const total = (
    BigInt(result.platformRevenue) + BigInt(result.merchantNet)
  ).toString();
  return (
    <div className="reference-analysis-grid">
      <section
        className="reference-panel"
        aria-labelledby="admin-revenue-heading"
      >
        <header>
          <div>
            <h2 id="admin-revenue-heading">Дэлгүүрүүдийн борлуулалт</h2>
            <p>Төлөгдсөн захиалгаар · Сүүлийн 30 хоног</p>
          </div>
          <TrendingUp size={18} />
        </header>
        <DashboardBarChart
          data={merchants.map((merchant) => ({
            label: merchant.name,
            primary: Number(merchant.merchantNet),
            secondary: Number(merchant.platformRevenue),
            primaryDisplay: money(merchant.merchantNet),
            secondaryDisplay: money(merchant.platformRevenue),
          }))}
          primaryLabel="Дэлгүүрийн цэвэр орлого"
          secondaryLabel="Платформын шимтгэл"
          formatValue={(value) => value.toLocaleString("mn-MN") + " ₮"}
        />
        <ul className="v14-merchant-ranking">
          {merchants.map((merchant, index) => (
            <li key={merchant.id}>
              <span>
                <i>{String(index + 1).padStart(2, "0")}</i>
                {merchant.name}
              </span>
              <strong>
                {money(merchant.grossRevenue)}
                <small>
                  {count(merchant.orders)} захиалга ·{" "}
                  {(merchant.commissionBps / 100).toFixed(1)}%
                </small>
              </strong>
            </li>
          ))}
        </ul>
      </section>
      <section
        className="reference-panel reference-split-panel"
        aria-labelledby="admin-split-heading"
      >
        <header>
          <div>
            <h2 id="admin-split-heading">Борлуулалтын хуваарилалт</h2>
            <p>GMV → Merchant net + Platform fee</p>
          </div>
        </header>
        <DashboardDonut
          segments={[
            {
              label: "Дэлгүүрийн цэвэр орлого",
              value: Number(result.merchantNet),
              display: money(result.merchantNet),
            },
            {
              label: "Платформын шимтгэл",
              value: Number(result.platformRevenue),
              display: money(result.platformRevenue),
            },
          ]}
          center={ratio(result.merchantNet, total).toFixed(1) + "%"}
          caption="Дэлгүүрүүдэд"
        />
        <div className="reference-pipeline">
          <div>
            <Box size={17} />
            <strong>3D загварын хүсэлт</strong>
            <span>{count(result.openModelRequests)} нээлттэй</span>
          </div>
          <p>Загваруудыг “3D загварууд” хэсгээс хянана уу.</p>
        </div>
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
  featured = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  featured?: boolean;
}) {
  return (
    <article className={`reference-kpi ${featured ? "is-featured" : ""}`}>
      <div className="reference-kpi-label">
        <span>{label}</span>
        <Icon size={18} />
      </div>
      <strong>{value}</strong>
      <small>{detail}</small>
    </article>
  );
}
