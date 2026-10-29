/** Pure overview math: one date range drives every block, compared with the period before it. */

export type TrendPoint = {
  date: string;
  gross: string;
  net: string;
  orders: string;
};

export const OVERVIEW_RANGES = [
  { days: 7, label: "7х" },
  { days: 30, label: "30х" },
  { days: 90, label: "90х" },
  { days: 365, label: "Жил" },
] as const;
export type OverviewDays = (typeof OVERVIEW_RANGES)[number]["days"];

export type PeriodTotals = {
  gross: bigint;
  platform: bigint;
  merchant: bigint;
  orders: bigint;
  average: bigint;
};

function totals(points: TrendPoint[]): PeriodTotals {
  let gross = 0n,
    platform = 0n,
    orders = 0n;
  for (const point of points) {
    gross += BigInt(point.gross);
    platform += BigInt(point.net);
    orders += BigInt(point.orders);
  }
  return {
    gross,
    platform,
    merchant: gross - platform,
    orders,
    average: orders ? gross / orders : 0n,
  };
}

/** Percent change, or null when there is no earlier period to compare with. */
export function delta(current: bigint, previous: bigint | undefined) {
  if (previous === undefined || previous === 0n) return null;
  return Number(((current - previous) * 10000n) / previous) / 100;
}

/** `series` holds up to 2×days points, oldest first; the last `days` are the current period. */
export function summarizeRange(series: TrendPoint[], days: number) {
  const current = series.slice(-days);
  const before = series.length >= days * 2 ? series.slice(-days * 2, -days) : null;
  const now = totals(current);
  const previous = before ? totals(before) : undefined;
  return {
    current,
    previous: before,
    totals: now,
    deltas: {
      gross: delta(now.gross, previous?.gross),
      platform: delta(now.platform, previous?.platform),
      merchant: delta(now.merchant, previous?.merchant),
      average: delta(now.average, previous?.average),
    },
    commissionRate: now.gross
      ? Number((now.platform * 1000n) / now.gross) / 10
      : null,
  };
}

/** Groups a period into at most `count` bars (24 for KPI micro charts). */
export function microBars(
  points: TrendPoint[],
  pick: (point: TrendPoint) => bigint,
  count = 24,
) {
  if (!points.length) return [];
  const size = Math.ceil(points.length / count);
  const bars: bigint[] = [];
  for (let index = 0; index < points.length; index += size)
    bars.push(
      points
        .slice(index, index + size)
        .reduce((sum, point) => sum + pick(point), 0n),
    );
  return bars;
}

/** One money format everywhere: 48.6 сая ₮, 227 мян ₮, 950 ₮. */
export function formatMNT(value: bigint | number) {
  const amount = typeof value === "bigint" ? Number(value) : value;
  const abs = Math.abs(amount);
  const trim = (n: number, digits: number) =>
    n.toFixed(digits).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
  if (abs >= 1_000_000)
    return { value: trim(amount / 1_000_000, abs >= 100_000_000 ? 0 : abs >= 10_000_000 ? 1 : 2), unit: "сая ₮" };
  if (abs >= 1_000) return { value: trim(amount / 1_000, 0), unit: "мян ₮" };
  return { value: String(Math.round(amount)), unit: "₮" };
}

export const formatDelta = (value: number | null) =>
  value === null
    ? ""
    : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(1)}%`;

const MONTHS = [
  "1-р", "2-р", "3-р", "4-р", "5-р", "6-р",
  "7-р", "8-р", "9-р", "10-р", "11-р", "12-р",
];
const WEEKDAYS = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];

/** "9-р сарын 29 – 10-р сарын 29, 2026" from YYYY-MM-DD keys. */
export function rangeLabel(first: string, last: string) {
  const part = (date: string) => {
    const [, month, day] = date.split("-").map(Number);
    return `${MONTHS[month - 1]} сарын ${day}`;
  };
  return `${part(first)} – ${part(last)}, ${last.slice(0, 4)}`;
}

/** "10.23" and "10.23 · Пүрэв" chart labels. */
export const shortDate = (date: string) =>
  `${Number(date.slice(5, 7))}.${date.slice(8, 10)}`;
export const dayLabel = (date: string) =>
  `${shortDate(date)} · ${WEEKDAYS[new Date(`${date}T12:00:00Z`).getUTCDay()]}`;

/** Relative age for the action inbox: 2м, 1ц, 1ө. */
export function relativeAge(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - Date.parse(iso)) / 60000));
  if (minutes < 60) return `${minutes}м`;
  const hours = Math.round(minutes / 60);
  return hours < 24 ? `${hours}ц` : `${Math.round(hours / 24)}ө`;
}
