"use client";

import { useMemo, useState, type KeyboardEvent } from "react";
import { ArrowRight, Download } from "lucide-react";
import { useCatalog } from "@/store/catalog";
import type { AdminGrowth } from "@/lib/merchantGrowth";
import type { Store } from "@/lib/types";
import type { AdminTab } from "@/components/AdminSidebar";
import { useAdminResource } from "./useAdminResource";
import { TopbarActions } from "./DashboardTopbarSlot";
import {
  OVERVIEW_RANGES,
  dayLabel,
  formatDelta,
  formatMNT,
  microBars,
  rangeLabel,
  relativeAge,
  shortDate,
  summarizeRange,
  type OverviewDays,
  type TrendPoint,
} from "./overviewMath";
import "./admin-overview.css";

type Analytics = { activeMerchants: string; openModelRequests: string };
type AdminOrder = {
  id: string;
  status: string;
  total: number | string;
  created_at: string;
  items: { name: string; qty: number }[];
  delivery: { name: string };
  merchant_order_fulfillments: { store_id: string }[];
};
const ORDER_STATUS: Record<string, [string, "paid" | "pending" | "neutral" | "muted"]> = {
  pending_payment: ["Хүлээгдэж буй", "pending"],
  paid: ["Төлөгдсөн", "paid"],
  processing: ["Төлөгдсөн", "paid"],
  shipped: ["Хүргэлтэд", "neutral"],
  delivered: ["Хүргэгдсэн", "neutral"],
  cancelled: ["Цуцлагдсан", "muted"],
};
const LOW_STOCK = 2;

export function AdminOverview({
  owner,
  onNavigate,
}: {
  owner: string;
  onNavigate: (tab: AdminTab) => void;
}) {
  const [days, setDays] = useState<OverviewDays>(30);
  const [compare, setCompare] = useState(false);
  const [metric, setMetric] = useState<"gross" | "orders">("gross");
  const [hover, setHover] = useState<number | null>(null);
  const trends = useAdminResource<{ series: TrendPoint[] }>(
    owner,
    `/api/admin/trends?days=${Math.min(days * 2, 730)}`,
  );
  const analytics = useAdminResource<Analytics>(owner, "/api/admin/analytics");
  const growth = useAdminResource<AdminGrowth>(owner, "/api/admin/merchant-growth");
  const orders = useAdminResource<{ orders: AdminOrder[] }>(owner, "/api/admin/orders?page=0");
  const stores = useAdminResource<{ stores: Store[] }>(owner, "/api/admin/stores");
  const catalog = useCatalog();
  const summary = useMemo(
    () => (trends.data ? summarizeRange(trends.data.series, days) : null),
    [trends.data, days],
  );
  const chart = useMemo(() => {
    if (!summary) return [];
    const pick = (point: TrendPoint) =>
      BigInt(metric === "gross" ? point.gross : point.orders);
    // A year is grouped so every bar stays wide enough to read and tap.
    const size = Math.ceil(summary.current.length / 60);
    return summary.current
      .filter((_, index) => index % size === 0)
      .map((point, index) => {
        const group = summary.current.slice(index * size, index * size + size);
        const previous = summary.previous?.slice(index * size, index * size + size);
        return {
          date: point.date,
          value: Number(group.reduce((sum, item) => sum + pick(item), 0n)),
          amount: group.reduce((sum, item) => sum + BigInt(item.gross), 0n),
          count: group.reduce((sum, item) => sum + BigInt(item.orders), 0n),
          previous: previous
            ? Number(previous.reduce((sum, item) => sum + pick(item), 0n))
            : null,
        };
      });
  }, [summary, metric]);
  const max = Math.max(1, ...chart.map((bar) => Math.max(bar.value, compare ? bar.previous ?? 0 : 0)));
  const inbox = useMemo(() => {
    const rows: { title: string; sub: string; at?: string; urgent: boolean; tab: AdminTab }[] = [];
    const models = growth.data?.models.filter((item) => item.status === "pending") ?? [];
    const requests = Number(analytics.data?.openModelRequests ?? 0);
    if (models.length || requests)
      rows.push({
        title: "3D загвар батлах хүлээгдэж байна",
        sub: models.length
          ? `${models[0].storeName ?? "Дэлгүүр"} · ${models[0].original_name}${models.length > 1 ? `, +${models.length - 1}` : ""}`
          : `${requests} хүсэлт`,
        at: models[0]?.created_at,
        urgent: true,
        tab: "models",
      });
    const payouts = growth.data?.withdrawals.filter((item) => item.status === "pending") ?? [];
    if (payouts.length)
      rows.push({
        title: "Дэлгүүрийн тооцоо илгээх",
        sub: `${payouts[0].storeName ?? "Дэлгүүр"} · ${Object.values(formatMNT(BigInt(payouts[0].amount))).join(" ")}${payouts.length > 1 ? `, +${payouts.length - 1}` : ""}`,
        at: payouts[0].created_at,
        urgent: true,
        tab: "merchant-ops",
      });
    const applications = growth.data?.profiles.filter((item) => item.verification_status === "pending") ?? [];
    if (applications.length)
      rows.push({
        title: "Шинэ дэлгүүр бүртгүүлэх хүсэлт",
        sub: applications.map((item) => item.legal_name).filter(Boolean).slice(0, 2).join(", ") || `${applications.length} хүсэлт`,
        urgent: false,
        tab: "merchant-ops",
      });
    const low = catalog.products.filter(
      (product) =>
        product.category !== "kitchen-cabinet" &&
        !product.madeToOrder &&
        product.stockQuantity != null &&
        product.stockQuantity <= LOW_STOCK,
    );
    if (low.length)
      rows.push({
        title: "Үлдэгдэл дуусаж байна",
        sub: `${low[0].name} · ${low[0].stockQuantity} ширхэг үлдсэн${low.length > 1 ? `, +${low.length - 1}` : ""}`,
        urgent: false,
        tab: "furniture",
      });
    return rows;
  }, [growth.data, analytics.data, catalog.products]);
  const storeName = (id?: string) =>
    stores.data?.stores.find((store) => store.id === id)?.name ?? "—";

  const exportCsv = () => {
    if (!summary) return;
    const lines = [
      "Огноо,Борлуулалт (₮),Платформын орлого (₮),Захиалга",
      ...summary.current.map((point) => `${point.date},${point.gross},${point.net},${point.orders}`),
    ];
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `toim-${days}x.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 30000);
  };
  const onRangeKey = (event: KeyboardEvent<HTMLDivElement>) => {
    const index = OVERVIEW_RANGES.findIndex((range) => range.days === days);
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = OVERVIEW_RANGES[(index + step + OVERVIEW_RANGES.length) % OVERVIEW_RANGES.length];
    setDays(next.days);
    (event.currentTarget.querySelector(`[data-days="${next.days}"]`) as HTMLElement | null)?.focus();
  };
  const range = (
    <div className="dashboard-segmented overview-range" role="radiogroup" aria-label="Хугацаа" onKeyDown={onRangeKey}>
      {OVERVIEW_RANGES.map((item) => (
        <button
          key={item.days}
          type="button"
          role="radio"
          data-days={item.days}
          aria-checked={days === item.days}
          tabIndex={days === item.days ? 0 : -1}
          onClick={() => setDays(item.days)}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
  const kpis = summary
    ? [
        { label: "Нийт борлуулалт", short: "Борлуулалт", value: summary.totals.gross, delta: summary.deltas.gross, context: <><b>{summary.totals.orders.toLocaleString("en-US")}</b> төлөгдсөн захиалга</>, bars: microBars(summary.current, (p) => BigInt(p.gross)) },
        { label: "Платформын орлого", short: "Платформ", value: summary.totals.platform, delta: summary.deltas.platform, context: summary.commissionRate === null ? null : <>Шимтгэл <b>{summary.commissionRate}%</b></>, bars: microBars(summary.current, (p) => BigInt(p.net)) },
        { label: "Дэлгүүрт олгох", short: "Дэлгүүрт", value: summary.totals.merchant, delta: summary.deltas.merchant, context: analytics.data ? <><b>{analytics.data.activeMerchants}</b> идэвхтэй дэлгүүр</> : null, bars: microBars(summary.current, (p) => BigInt(p.gross) - BigInt(p.net)) },
        { label: "Дундаж захиалга", short: "Дундаж", value: summary.totals.average, delta: summary.deltas.average, context: null, bars: microBars(summary.current, (p) => (BigInt(p.orders) ? BigInt(p.gross) / BigInt(p.orders) : 0n)) },
      ]
    : [];
  const recent = orders.data?.orders.slice(0, 5) ?? [];
  const today = chart.at(-1);

  return (
    <section className="admin-overview" aria-labelledby="overview-heading">
      <TopbarActions>
        {range}
        <button type="button" className="dashboard-outline-button overview-compare" aria-pressed={compare} onClick={() => setCompare((value) => !value)}>
          Өмнөх үетэй харьцуулах <i aria-hidden="true" />
        </button>
        <button type="button" className="dashboard-outline-button" disabled={!summary} onClick={exportCsv}>
          <Download size={14} aria-hidden="true" /> Экспорт
        </button>
      </TopbarActions>
      <header className="overview-heading">
        <h1 id="overview-heading">Тойм</h1>
        {summary?.current.length ? (
          <p>{rangeLabel(summary.current[0].date, summary.current.at(-1)!.date)}</p>
        ) : null}
      </header>
      <div className="overview-mobile-range">{range}</div>

      {trends.error ? (
        <p className="overview-error" role="alert">
          {trends.error}
          <button type="button" className="dashboard-outline-button" onClick={trends.refresh}>Дахин оролдох</button>
        </p>
      ) : null}

      <div className="overview-kpis" aria-busy={!summary}>
        {summary
          ? kpis.map((kpi) => {
              const money = formatMNT(kpi.value);
              const peak = kpi.bars.reduce((top, value) => (value > top ? value : top), 1n);
              return (
                <article key={kpi.label} className="overview-kpi">
                  <div className="overview-kpi-head">
                    <span><span className="is-long">{kpi.label}</span><span className="is-short">{kpi.short}</span></span>
                    {kpi.value > 0n && kpi.delta !== null && (
                      <span className={kpi.delta < 0 ? "is-down" : undefined}>{formatDelta(kpi.delta)}</span>
                    )}
                  </div>
                  <p className="overview-kpi-value">
                    {money.value} <small>{money.unit}</small>
                  </p>
                  {kpi.context && <p className="overview-kpi-context">{kpi.context}</p>}
                  <div className="overview-micro" aria-hidden="true">
                    {kpi.bars.map((value, index) => (
                      <i
                        key={index}
                        data-now={index === kpi.bars.length - 1 || undefined}
                        style={{ height: `${Math.max(8, Number((value * 100n) / peak))}%` }}
                      />
                    ))}
                  </div>
                </article>
              );
            })
          : Array.from({ length: 4 }, (_, index) => (
              <article key={index} className="overview-kpi">
                <span className="overview-skeleton" style={{ width: "50%" }} />
                <span className="overview-skeleton is-tall" style={{ width: "40%" }} />
                <span className="overview-skeleton" style={{ width: "70%" }} />
              </article>
            ))}
      </div>

      <div className="overview-grid">
        <section className="overview-panel overview-chart" aria-labelledby="overview-chart-heading">
          <header>
            <h2 id="overview-chart-heading">
              Өдрийн борлуулалт <small>{metric === "gross" ? "· сая ₮" : "· захиалга"}</small>
            </h2>
            {today && (
              <span className="overview-today">
                Өнөөдөр {Object.values(formatMNT(today.amount)).join(" ")}
              </span>
            )}
            <div className="dashboard-segmented" role="group" aria-label="Үзүүлэлт">
              {(
                [
                  ["gross", "Борлуулалт"],
                  ["orders", "Захиалга"],
                ] as const
              ).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={metric === value} onClick={() => setMetric(value)}>
                  {label}
                </button>
              ))}
            </div>
          </header>
          <div className="overview-chart-body">
            {summary && !summary.totals.orders ? (
              <p className="overview-chart-empty">Энэ хугацаанд захиалга алга.</p>
            ) : null}
            <div className="overview-axis" aria-hidden="true">
              {chart.some((bar) => bar.value) && [3, 2, 1].map((step) => (
                <span key={step} style={{ bottom: `${(step / 3) * 100}%` }}>
                  {metric === "gross"
                    ? (((max * step) / 3) / 1_000_000).toFixed(1)
                    : Math.round((max * step) / 3)}
                </span>
              ))}
            </div>
            <div className="overview-bars" onMouseLeave={() => setHover(null)}>
              {chart.map((bar, index) => (
                <button
                  key={bar.date}
                  type="button"
                  className="overview-bar"
                  data-now={index === chart.length - 1 || undefined}
                  data-active={hover === index || undefined}
                  aria-label={`${dayLabel(bar.date)}: ${Object.values(formatMNT(bar.amount)).join(" ")}, ${bar.count} захиалга`}
                  onMouseEnter={() => setHover(index)}
                  onFocus={() => setHover(index)}
                  onClick={() => setHover(index)}
                >
                  {compare && bar.previous !== null && (
                    <i className="overview-bar-previous" style={{ height: `${(bar.previous / max) * 100}%` }} />
                  )}
                  <i style={{ height: bar.value ? `${Math.max(2, (bar.value / max) * 100)}%` : "4px" }} />
                  {hover === index && (
                    <span className="overview-tooltip" role="tooltip">
                      <small>{dayLabel(bar.date)}</small>
                      <strong>
                        {Object.values(formatMNT(bar.amount)).join(" ")} · {bar.count.toString()}
                      </strong>
                    </span>
                  )}
                </button>
              ))}
            </div>
            <div className="overview-dates" aria-hidden="true">
              {chart
                .filter((_, index) => index % Math.max(1, Math.ceil(chart.length / 5)) === 0 || index === chart.length - 1)
                .map((bar) => (
                  <span key={bar.date}>{shortDate(bar.date)}</span>
                ))}
            </div>
          </div>
        </section>

        <section className="overview-panel overview-inbox" aria-labelledby="overview-inbox-heading">
          <header>
            <h2 id="overview-inbox-heading">
              Анхаарах зүйлс <small>{inbox.length}</small>
            </h2>
          </header>
          {inbox.length ? (
            <ul>
              {inbox.map((item, index) => (
                <li key={item.title} data-extra={index > 1 || undefined}>
                  <button type="button" onClick={() => onNavigate(item.tab)}>
                    <i className={item.urgent ? "is-urgent" : undefined} aria-hidden="true" />
                    <span>
                      <strong>{item.title}</strong>
                      <small>{item.sub}</small>
                    </span>
                    {item.at && <time dateTime={item.at}>{relativeAge(item.at)}</time>}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="overview-empty">Анхаарах зүйл алга ✓</p>
          )}
        </section>
      </div>

      <section className="overview-panel overview-orders" aria-labelledby="overview-orders-heading">
        <header>
          <h2 id="overview-orders-heading">Сүүлийн захиалгууд</h2>
          <button type="button" className="overview-link" onClick={() => onNavigate("orders")}>
            Бүгдийг харах <ArrowRight size={14} aria-hidden="true" />
          </button>
        </header>
        {orders.error ? (
          <p className="overview-error" role="alert">
            {orders.error}
            <button type="button" className="dashboard-outline-button" onClick={orders.refresh}>Дахин оролдох</button>
          </p>
        ) : !orders.data ? (
          <div className="overview-empty"><span className="overview-skeleton" style={{ width: "60%" }} /></div>
        ) : !recent.length ? (
          <p className="overview-empty">Захиалга алга.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th scope="col">Дугаар</th>
                <th scope="col">Бүтээгдэхүүн</th>
                <th scope="col">Дэлгүүр</th>
                <th scope="col">Худалдан авагч</th>
                <th scope="col">Төлөв</th>
                <th scope="col">Дүн</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((order) => {
                const [label, tone] = ORDER_STATUS[order.status] ?? [order.status, "neutral"];
                const items = order.items ?? [];
                return (
                  <tr key={order.id}>
                    <td data-label="Дугаар">#{order.id.slice(0, 8)}</td>
                    <td className="overview-product">
                      {items[0] ? `${items[0].name}${items[0].qty > 1 ? ` ×${items[0].qty}` : ""}${items.length > 1 ? ` +${items.length - 1}` : ""}` : "—"}
                    </td>
                    <td className="overview-store">
                      <span className="overview-mobile-id">#{order.id.slice(0, 8)} · </span>
                      {storeName(order.merchant_order_fulfillments?.[0]?.store_id)}
                    </td>
                    <td className="overview-buyer">{order.delivery?.name ?? "—"}</td>
                    <td>
                      <span className="overview-status" data-tone={tone}>
                        <i aria-hidden="true" /> {label}
                      </span>
                    </td>
                    <td className="overview-amount">{Number(order.total).toLocaleString("en-US")} ₮</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </section>
  );
}
