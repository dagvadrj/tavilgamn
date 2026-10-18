"use client";
import { useEffect, useRef, type CSSProperties } from "react";
import { CheckCircle2, Clock3, ArrowUpRight, Package } from "lucide-react";
import {
  DELIVERY_STAGE_LABEL,
  DELIVERY_STAGES,
  type DeliveryStage,
} from "@/lib/merchantDelivery";
import { useMerchantResource } from "./useMerchantResource";
export type ProgressOrder = {
  id: string;
  stage: DeliveryStage;
  progress: number;
  createdAt: string;
  updatedAt: string;
  customer: string;
  subtotal: string;
  title: string;
  itemCount: number;
  held: boolean;
};
export type ProgressStats = {
  asOf: string;
  selectedDate: string;
  total: number;
  hasMore: boolean;
  dayTotals: {
    orders: number;
    paidOrders: number;
    gross: string;
    net: string;
    completed: number;
  };
  dates: {
    date: string;
    count: number;
    gross: string;
    net: string;
    completed: number;
  }[];
  counts: Record<DeliveryStage, number>;
  held: number;
  aging: number[];
  orders: ProgressOrder[];
};
type Trends = {
  asOf: string;
  months: { month: string; gross: string; net: string; orders: number }[];
};
export const todayInUlaanbaatar = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
function daySpark(stats: ProgressStats | null, index: number) {
  return (stats?.dates ?? [])
    .slice(0, 7)
    .reverse()
    .map((day) =>
      Number(
        index === 0
          ? day.count
          : index === 1
            ? day.gross
            : index === 2
              ? day.net
              : day.completed,
      ),
    );
}
export function StatSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div
      className="merchant-stat-skeleton"
      role="status"
      aria-label="Мэдээлэл ачаалж байна"
    >
      <span className="sr-only">Мэдээлэл ачаалж байна…</span>
      {Array.from({ length: rows }, (_, i) => (
        <i key={i} aria-hidden="true" />
      ))}
    </div>
  );
}
export function AnimatedNumber({
  value,
  money = false,
}: {
  value: string | number;
  money?: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null),
    previous = useRef(0);
  const label = Number.isSafeInteger(Number(value))
    ? Number(value).toLocaleString("mn-MN")
    : BigInt(value).toLocaleString("mn-MN");
  useEffect(() => {
    const node = ref.current,
      target = Number(value);
    if (!node) return;
    if (
      !Number.isSafeInteger(target) ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      node.textContent = label;
      previous.current = target;
      return;
    }
    const from = Number.isSafeInteger(previous.current)
        ? previous.current
        : target,
      start = performance.now();
    let frame = 0;
    const tick = (time: number) => {
      const t = Math.min(1, (time - start) / 650);
      node.textContent = Math.round(
        from + (target - from) * (1 - Math.pow(1 - t, 3)),
      ).toLocaleString("mn-MN");
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    previous.current = target;
    return () => cancelAnimationFrame(frame);
  }, [value, label]);
  return (
    <span aria-label={label + (money ? " ₮" : "")}>
      <span ref={ref} aria-hidden="true">
        {label}
      </span>
      {money && <span aria-hidden="true"> ₮</span>}
    </span>
  );
}
export function OrderProgressCards({
  stats,
  loading,
  error,
  date,
  page,
  onDate,
  onPage,
  onRetry,
  onDelivery,
}: {
  stats: ProgressStats | null;
  loading: boolean;
  error: string | null;
  date: string;
  page: number;
  onDate: (day: string) => void;
  onPage: (page: number) => void;
  onRetry: () => void;
  onDelivery?: () => void;
}) {
  return (
    <section
      className="merchant-stat-panel merchant-order-progress"
      aria-labelledby="merchant-progress-title"
    >
      <header>
        <div>
          <h2 id="merchant-progress-title">Захиалгуудын явц</h2>
          <p>Сонгосон өдрийн захиалга · явцын хувиар өндөрөөс нь</p>
        </div>
        <label className="merchant-date-picker">
          Огноо
          <input
            type="date"
            value={date}
            onChange={(e) => {
              if (e.target.value) onDate(e.target.value);
            }}
          />
        </label>
      </header>
      <div
        className="merchant-day-totals"
        aria-label="Сонгосон өдрийн статистик"
      >
        {[
          ["Нийт захиалга", stats?.dayTotals.orders, false],
          ["Төлбөр төлөгдсөн дүн", stats?.dayTotals.gross, true],
          ["Цэвэр орлого", stats?.dayTotals.net, true],
          ["Дууссан захиалга", stats?.dayTotals.completed, false],
        ].map(([label, value, money], index) => (
          <div key={String(label)}>
            <span>{label}</span>
            <strong>
              {value === undefined && error ? (
                "—"
              ) : value === undefined ? (
                <StatSkeleton rows={1} />
              ) : (
                <AnimatedNumber
                  value={value as string | number}
                  money={Boolean(money)}
                />
              )}
            </strong>
            {index === 3 && stats && (
              <small>
                {Math.round(
                  (stats.dayTotals.completed /
                    Math.max(1, stats.dayTotals.orders)) *
                    100,
                )}
                % нь дууссан
              </small>
            )}
            <div className="merchant-day-spark" aria-hidden="true">
              {daySpark(stats, index).map((v, i) => (
                <i
                  key={i}
                  style={{
                    height:
                      (v / Math.max(1, ...daySpark(stats, index))) * 32 + "px",
                    opacity: 0.3 + ((i + index) % 6) / 9,
                  }}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="merchant-date-strip" aria-label="Захиалгын огноо">
        {(stats?.dates ?? [{ date, count: 0 }]).map((day) => (
          <button
            key={day.date}
            type="button"
            aria-pressed={day.date === date}
            onClick={() => onDate(day.date)}
          >
            <span>{day.date.slice(5).replace("-", " / ")}</span>
            <small>{stats ? day.count + " захиалга" : "…"}</small>
          </button>
        ))}
      </div>
      {error && (
        <p className="merchant-error" role="alert">
          {error}{" "}
          <button type="button" onClick={onRetry}>
            Дахин оролдох
          </button>
        </p>
      )}
      {!stats && error ? null : !stats ? (
        <StatSkeleton rows={3} />
      ) : (
        <>
          <p className="merchant-progress-caption" role="status">
            {stats.selectedDate} · {stats.total} захиалга
            {loading ? " · Шинэчилж байна…" : ""}
          </p>
          <div className="merchant-progress-cards">
            {stats.orders.map((order) => {
              const elapsed = Math.max(
                0,
                Math.floor(
                  (Date.parse(stats.asOf) - Date.parse(order.createdAt)) /
                    3600000,
                ),
              );
              return (
                <article className="merchant-progress-card" key={order.id}>
                  <div className="merchant-progress-identity">
                    <span>
                      {order.customer?.slice(0, 1) || <Package size={18} />}
                    </span>
                    <div>
                      <strong>{order.customer || "Хэрэглэгч"}</strong>
                      <small>
                        #{order.id.slice(0, 8).toUpperCase()} ·{" "}
                        {new Date(order.createdAt).toLocaleTimeString("mn-MN", {
                          timeZone: "Asia/Ulaanbaatar",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </small>
                    </div>
                    <span className="merchant-stage-tag">
                      {order.held
                        ? "Түр хүлээж буй"
                        : DELIVERY_STAGE_LABEL[order.stage]}
                    </span>
                  </div>
                  <h3>
                    {order.title}
                    {order.itemCount > 1 && (
                      <small> +{order.itemCount - 1}</small>
                    )}
                  </h3>
                  <div className="merchant-order-meter">
                    <div
                      className="merchant-progress-ring"
                      role="progressbar"
                      aria-label="Захиалгын үе шатны явц"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={order.progress}
                      style={
                        {
                          "--ring-target": 100 - order.progress,
                        } as CSSProperties
                      }
                    >
                      <svg viewBox="0 0 42 42" aria-hidden="true">
                        <circle cx="21" cy="21" r="16" />
                        <circle
                          cx="21"
                          cy="21"
                          r="16"
                          pathLength="100"
                          strokeDasharray="100"
                          strokeDashoffset={100 - order.progress}
                        />
                      </svg>
                      <strong>
                        <AnimatedNumber value={order.progress} />%
                      </strong>
                    </div>
                    <div>
                      <strong>{order.progress / 20} / 5 алхам</strong>
                      <small>
                        {order.stage === "completed"
                          ? "Захиалга дууссан"
                          : `Дараагийн: ${DELIVERY_STAGE_LABEL[DELIVERY_STAGES[DELIVERY_STAGES.indexOf(order.stage) + 1]]}`}
                      </small>
                      <div className="merchant-progress-track">
                        <i style={{ width: order.progress + "%" }} />
                      </div>
                    </div>
                  </div>
                  <footer>
                    <span>
                      <Clock3 size={13} />
                      {elapsed >= 24
                        ? Math.floor(elapsed / 24) + " өдөр"
                        : elapsed + " цаг"}{" "}
                      өнгөрсөн
                    </span>
                    <strong>
                      <AnimatedNumber value={order.subtotal} money />
                    </strong>
                  </footer>
                </article>
              );
            })}
          </div>
          {!stats.orders.length && (
            <div className="merchant-progress-empty">
              <CheckCircle2 size={25} />
              <p>Энэ өдөр захиалга бүртгэгдээгүй байна.</p>
            </div>
          )}
          <footer className="merchant-progress-footer">
            <span>
              Үе шатны хувь ·{" "}
              <time dateTime={stats.asOf}>
                {new Date(stats.asOf).toLocaleTimeString("mn-MN", {
                  timeZone: "Asia/Ulaanbaatar",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </time>{" "}
              шинэчлэгдсэн · 15 сек тутам
            </span>
            <div>
              <button
                type="button"
                disabled={!page || loading}
                onClick={() => onPage(page - 1)}
              >
                Өмнөх
              </button>
              <span>{page + 1}</span>
              <button
                type="button"
                disabled={!stats.hasMore || loading}
                onClick={() => onPage(page + 1)}
              >
                Дараах
              </button>
              {onDelivery && (
                <button type="button" onClick={onDelivery}>
                  Хүргэлтийн самбар <ArrowUpRight size={14} />
                </button>
              )}
            </div>
          </footer>
        </>
      )}
    </section>
  );
}
export function MerchantTrends({
  owner,
  enabled,
}: {
  owner: string;
  enabled: boolean;
}) {
  const result = useMerchantResource<Trends>(
      owner,
      "/api/merchant/dashboard?section=trends",
      enabled,
      60000,
    ),
    months = result.data?.months;
  const max = Math.max(1, ...(months ?? []).map((m) => Number(m.gross)));
  const path = (field: "gross" | "net") =>
    (months ?? [])
      .map(
        (m, i) =>
          `${i ? "L" : "M"} ${40 + i * 100} ${180 - (Number(m[field]) / max) * 145}`,
      )
      .join(" ");
  return (
    <section className="merchant-stat-panel merchant-trends">
      <header>
        <div>
          <h2>Борлуулалтын хандлага</h2>
          <p>Сүүлийн 6 сар · төлбөр төлөгдсөн захиалга</p>
        </div>
        <span>₮</span>
      </header>
      {result.error && (
        <p className="merchant-error" role="alert">
          {result.error}
          <button onClick={result.refresh}>Дахин оролдох</button>
        </p>
      )}
      {!months && result.error ? null : !months ? (
        <StatSkeleton rows={4} />
      ) : (
        <>
          <div className="merchant-chart-total">
            <AnimatedNumber
              value={months
                .reduce((sum, m) => sum + BigInt(m.net), 0n)
                .toString()}
              money
            />
            <small>Худалдаа эрхлэгчийн цэвэр орлого</small>
          </div>
          <svg
            className="merchant-sales-chart"
            viewBox="0 0 580 220"
            role="img"
            aria-label="Сарын нийт борлуулалт ба цэвэр орлогын график"
          >
            {[35, 83, 131, 180].map((y) => (
              <line key={y} x1="35" x2="550" y1={y} y2={y} />
            ))}
            <path d={path("gross")} className="merchant-chart-gross" />
            <path d={path("net")} className="merchant-chart-net" />
            {months.map((m, i) => (
              <g key={m.month}>
                <circle
                  cx={40 + i * 100}
                  cy={180 - (Number(m.net) / max) * 145}
                  r="4"
                >
                  <title>
                    {m.month}: {BigInt(m.net).toLocaleString("mn-MN")} ₮ ·{" "}
                    {m.orders} захиалга
                  </title>
                </circle>
                <text x={40 + i * 100} y="210" textAnchor="middle">
                  {m.month.slice(5)} сар
                </text>
              </g>
            ))}
          </svg>
          <div className="merchant-chart-legend">
            <span>● Цэвэр орлого</span>
            <span>┄ Нийт борлуулалт</span>
            {result.loading && <small>Шинэчилж байна…</small>}
          </div>
        </>
      )}
    </section>
  );
}
