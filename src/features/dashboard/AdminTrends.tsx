"use client";
import { useState } from "react";
import { TopbarActions } from "./DashboardTopbarSlot";
import { OVERVIEW_RANGES, type OverviewDays } from "./overviewMath";
import { DashboardBarChart } from "./DashboardCharts";
import { useAdminResource } from "./useAdminResource";
import {
  groupInsightSeries,
  type InsightPeriod,
} from "@/features/merchant/insightSeries";
import { StatSkeleton } from "@/features/merchant/MerchantStats";
import type { MerchantInsightsData } from "@/lib/merchantGrowth";

export function AdminTrends({ owner }: { owner: string }) {
  // One range control; the grouping follows from it instead of a second toggle.
  const [days, setDays] = useState<OverviewDays>(30);
  const resource = useAdminResource<{ series: MerchantInsightsData["series"] }>(
    owner,
    `/api/admin/trends?days=${days}`,
  );
  const period: InsightPeriod =
    days <= 30 ? "day" : days <= 90 ? "week" : "month";
  const series = groupInsightSeries(resource.data?.series ?? [], period);
  return (
    <section className="dashboard-time-trends">
      <TopbarActions>
        <div className="dashboard-segmented" role="group" aria-label="Хугацаа">
          {OVERVIEW_RANGES.map((range) => (
            <button
              key={range.days}
              type="button"
              aria-pressed={days === range.days}
              onClick={() => setDays(range.days)}
            >
              {range.label}
            </button>
          ))}
        </div>
      </TopbarActions>
      <header className="dashboard-trend-controls">
        <div>
          <h2>Борлуулалтын хандлага</h2>
          <p>
            Төлөгдсөн захиалга ·{" "}
            {period === "day" ? "өдрөөр" : period === "week" ? "долоо хоногоор" : "сараар"}
          </p>
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
