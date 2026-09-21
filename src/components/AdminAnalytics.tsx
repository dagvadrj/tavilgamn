"use client";

import { useEffect, useState } from "react";

import {
  BadgeDollarSign,
  Box,
  CalendarDays,
  CircleDollarSign,
  Package,
  RefreshCw,
  ShoppingBag,
  Star,
  Store,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
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
    <div>
      <div className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">MARKETPLACE OVERVIEW</span>

          <h1>Ерөнхий тойм</h1>

          <p>
            Marketplace-ийн борлуулалт, commission болон merchant performance.
          </p>
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
          <div className="admin-date-range">
            <CalendarDays size={15} />

            <span>
              {dateLabel(result.periodStart)}
              {" — "}
              {dateLabel(result.asOf)}
            </span>

            <span>· Сүүлийн 30 хоног</span>
          </div>

          <div className="admin-metrics">
            <Metric
              icon={TrendingUp}
              label="GMV"
              value={money(result.gmv)}
              detail="Merchant-уудын нийт төлөгдсөн борлуулалт"
            />

            <Metric
              icon={BadgeDollarSign}
              label="Platform орлого"
              value={money(result.platformRevenue)}
              detail="3–5% commission"
            />

            <Metric
              icon={ShoppingBag}
              label="Төлөгдсөн захиалга"
              value={count(result.paidOrders)}
              detail="Сүүлийн 30 хоног"
            />

            <Metric
              icon={Store}
              label="Идэвхтэй merchant"
              value={`${count(result.activeMerchants)} / ${count(
                result.totalMerchants,
              )}`}
              detail={`${count(result.featuredMerchants)} Featured merchant`}
            />
          </div>

          <div className="admin-marketplace-secondary">
            <article>
              <div>
                <CircleDollarSign size={18} />

                <span>Merchant-д очих цэвэр дүн</span>
              </div>

              <strong>{money(result.merchantNet)}</strong>
            </article>

            <article>
              <div>
                <Box size={18} />

                <span>Нээлттэй 3D хүсэлт</span>
              </div>

              <strong>{count(result.openModelRequests)}</strong>
            </article>

            <article>
              <div>
                <Star size={18} />

                <span>Featured merchant</span>
              </div>

              <strong>{count(result.featuredMerchants)}</strong>
            </article>
          </div>

          <section className="admin-top-merchants">
            <div className="admin-panel-heading">
              <div>
                <h2>Top merchants</h2>

                <p>Сүүлийн 30 хоногийн төлөгдсөн борлуулалтаар.</p>
              </div>

              <Store size={21} />
            </div>

            {!result.topMerchants.length ? (
              <div className="admin-empty">
                <Store size={28} />

                <strong>Merchant мэдээлэл алга</strong>
              </div>
            ) : (
              <div className="admin-top-merchant-list">
                {result.topMerchants.map((merchant, index) => (
                  <article key={merchant.id}>
                    <span className="admin-top-rank">{index + 1}</span>

                    <div className="admin-top-merchant-name">
                      <strong>{merchant.name}</strong>

                      <small>
                        Commission {(merchant.commissionBps / 100).toFixed(1)}%
                      </small>
                    </div>

                    <div>
                      <small>Борлуулалт</small>

                      <strong>{money(merchant.grossRevenue)}</strong>
                    </div>

                    <div>
                      <small>Platform fee</small>

                      <strong>{money(merchant.platformRevenue)}</strong>
                    </div>

                    <div>
                      <small>Захиалга</small>

                      <strong>{count(merchant.orders)}</strong>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      ) : null}

      <section className="mt-8">
        <div className="admin-panel-heading rounded-t-2xl border border-[#e3e7dc] bg-white">
          <div>
            <h2>Захиалгын мэдээлэл</h2>

            <p>Marketplace-ийн бүх захиалга.</p>
          </div>

          <Package size={21} />
        </div>

        <OrderHistory admin />
      </section>
    </div>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="admin-metric">
      <div className="admin-metric-top">
        <span>{label}</span>

        <Icon size={21} strokeWidth={1.6} />
      </div>

      <strong>{value}</strong>

      <p>{detail}</p>
    </div>
  );
}
