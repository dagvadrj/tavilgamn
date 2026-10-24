"use client";
import { useState } from "react";
import { DashboardBarChart } from "./DashboardCharts";
import { useAdminResource } from "./useAdminResource";
import {
  groupInsightSeries,
  type InsightPeriod,
} from "@/features/merchant/insightSeries";
import { StatSkeleton } from "@/features/merchant/MerchantStats";
import type { MerchantInsightsData } from "@/lib/merchantGrowth";

export function AdminTrends({ owner }: { owner: string }) {
  const resource = useAdminResource<{ series: MerchantInsightsData["series"] }>(
    owner,
    "/api/admin/trends",
  );
  const [period, setPeriod] = useState<InsightPeriod>("day");
  const [days, setDays] = useState(30);
  const series = groupInsightSeries(
    resource.data?.series.slice(-days) ?? [],
    period,
  );
  return (
    <section className="dashboard-time-trends">
      <header className="dashboard-trend-controls">
        <div>
          <h2>Борлуулалтын хандлага</h2>
          <p>Төлөгдсөн marketplace захиалга · үүссэн огноогоор</p>
        </div>
        <div
          className="v14-chart-toggle"
          role="group"
          aria-label="Графикийн нэгж"
        >
          {(
            [
              ["day", "Өдөр"],
              ["week", "Долоо хоног"],
              ["month", "Сар"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={period === value}
              onClick={() => setPeriod(value)}
            >
              {label}
            </button>
          ))}
        </div>
        <div
          className="v14-chart-toggle"
          role="group"
          aria-label="Статистикийн хугацаа"
        >
          {[7, 30, 90].map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={days === value}
              onClick={() => setDays(value)}
            >
              {value} хоног
            </button>
          ))}
        </div>
      </header>
      {resource.error && (
        <p role="alert">
          {resource.error}{" "}
          <button
            type="button"
            className="btn-ghost"
            onClick={resource.refresh}
          >
            Дахин оролдох
          </button>
        </p>
      )}
      {!resource.data ? (
        !resource.error && <StatSkeleton />
      ) : (
        <div className="reference-analysis-grid">
          {(
            [
              ["gross", "Борлуулалтын дүн"],
              ["orders", "Захиалгын тоо"],
            ] as const
          ).map(([metric, title]) => (
            <section className="reference-panel" key={metric}>
              <h3>{title}</h3>
              <DashboardBarChart
                mode={metric === "gross" ? "line" : "bar"}
                primaryLabel={title}
                formatValue={(v) =>
                  v.toLocaleString("mn-MN") + (metric === "gross" ? " ₮" : "")
                }
                data={series.map((day) => ({
                  label:
                    period === "month"
                      ? day.date
                      : day.date.slice(5).replace("-", "/"),
                  primary: Number(day[metric]),
                  primaryDisplay:
                    BigInt(day[metric]).toLocaleString("mn-MN") +
                    (metric === "gross" ? " ₮" : ""),
                }))}
              />
            </section>
          ))}
        </div>
      )}
      {period !== "day" && (
        <p className="dashboard-trend-note">
          Сонгосон хугацааны захын {period === "week" ? "долоо хоног" : "сар"}{" "}
          бүтэн бус байж болно.
        </p>
      )}
    </section>
  );
}
