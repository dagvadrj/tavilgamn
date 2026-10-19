"use client";
import { useState, type ReactNode } from "react";
import { TrendingUp, Trophy } from "lucide-react";
import {
  growthCount,
  growthMoney,
  type MerchantInsightsData,
  type TopProduct,
} from "@/lib/merchantGrowth";
import { DashboardBarChart } from "@/features/dashboard/DashboardCharts";
import { useMerchantResource } from "./useMerchantResource";
import { StatSkeleton } from "./MerchantStats";
import "./merchant-growth.css";

export function MerchantInsights({
  owner,
  enabled,
  children,
}: {
  owner: string;
  enabled: boolean;
  children?: ReactNode;
}) {
  const [days, setDays] = useState(30),
    [metric, setMetric] = useState<"net" | "orders">("net");
  const result = useMerchantResource<MerchantInsightsData>(
    owner,
    `/api/merchant/growth/insights?days=${days}`,
    enabled,
    60000,
  );
  const data = result.data;
  return (
    <div className="merchant-insights-workspace">
      <div className="merchant-stat-grid">
        <section className="merchant-stat-panel merchant-insights-chart">
          <header>
            <div>
              <h2>Захиалга ба орлогын хандлага</h2>
              <p>Төлбөр баталгаажсан борлуулалт · Улаанбаатарын цагаар</p>
            </div>
            <TrendingUp size={18} />
          </header>
          <div className="merchant-insights-filters">
            <div role="group" aria-label="Статистикийн хугацаа">
              {[7, 30, 90].map((value) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={days === value}
                  onClick={() => setDays(value)}
                >
                  {value} хоног
                </button>
              ))}
            </div>
            <div role="group" aria-label="Графикийн үзүүлэлт">
              <button
                type="button"
                aria-pressed={metric === "net"}
                onClick={() => setMetric("net")}
              >
                Цэвэр орлого
              </button>
              <button
                type="button"
                aria-pressed={metric === "orders"}
                onClick={() => setMetric("orders")}
              >
                Захиалга
              </button>
            </div>
          </div>
          {result.error && (
            <p role="alert" className="merchant-error">
              {result.error}
              <button type="button" onClick={result.refresh}>
                Дахин оролдох
              </button>
            </p>
          )}
          {!data ? (
            result.error ? null : (
              <StatSkeleton rows={4} />
            )
          ) : (
            <>
              <div className="merchant-insights-summary">
                <strong>
                  {metric === "net"
                    ? growthMoney(data.net)
                    : growthCount(data.orders) + " захиалга"}
                </strong>
                <small>
                  Сүүлийн {data.days} хоног · Нийт борлуулалт{" "}
                  {growthMoney(data.gross)}
                </small>
              </div>
              <DashboardBarChart
                mode="line"
                primaryLabel={metric === "net" ? "Цэвэр орлого" : "Захиалга"}
                formatValue={(value) =>
                  metric === "net"
                    ? value.toLocaleString("mn-MN") + " ₮"
                    : value.toLocaleString("mn-MN")
                }
                data={data.series.map((day) => ({
                  label: day.date.slice(5).replace("-", "/"),
                  primary: Number(day[metric]),
                  primaryDisplay:
                    metric === "net"
                      ? growthMoney(day.net)
                      : growthCount(day.orders),
                }))}
              />
            </>
          )}
        </section>
        {children}
      </div>
      <div className="merchant-top-products">
        <TopProducts
          title="Борлуулалтын дүнгээр тэргүүлэгч"
          products={data?.topRevenue}
          metric="revenue"
          error={Boolean(result.error)}
        />
        <TopProducts
          title="Борлогдсон тоогоор тэргүүлэгч"
          products={data?.topQuantity}
          metric="quantity"
          error={Boolean(result.error)}
        />
      </div>
    </div>
  );
}
function TopProducts({
  title,
  products,
  metric,
  error,
}: {
  title: string;
  products?: TopProduct[];
  metric: "revenue" | "quantity";
  error: boolean;
}) {
  return (
    <section className="merchant-growth-panel">
      <header>
        <Trophy size={18} />
        <h2>{title}</h2>
      </header>
      {!products ? (
        error ? (
          <p>Мэдээлэл ачаалагдаагүй.</p>
        ) : (
          <StatSkeleton rows={3} />
        )
      ) : !products.length ? (
        <p>Энэ хугацаанд төлөгдсөн борлуулалт бүртгэгдээгүй.</p>
      ) : (
        <ol className="merchant-top-list">
          {products.map((product, index) => (
            <li key={product.id}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{product.name}</strong>
                <small>
                  {metric === "revenue"
                    ? growthCount(product.quantity) + " ширхэг"
                    : growthMoney(product.revenue)}
                </small>
              </div>
              <strong>
                {metric === "revenue"
                  ? growthMoney(product.revenue)
                  : growthCount(product.quantity) + " ш"}
              </strong>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
