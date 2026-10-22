export const KPI_IDS = [
  "revenue",
  "orders",
  "inventory-val",
  "stock-alert",
] as const;
export const WIDGET_IDS = [
  "inventory-control",
  "category-chart",
  "order-progress",
] as const;
export type KpiId = (typeof KPI_IDS)[number];
export type WidgetId = (typeof WIDGET_IDS)[number];
export type MerchantDashboardLayout = {
  version: 1;
  kpis: KpiId[];
  widgets: WidgetId[];
};

export function defaultMerchantLayout(): MerchantDashboardLayout {
  return { version: 1, kpis: [...KPI_IDS], widgets: [...WIDGET_IDS] };
}

function normalizeOrder<T extends string>(
  value: unknown,
  allowed: readonly T[],
): T[] {
  const saved = Array.isArray(value)
    ? value.filter((id): id is T => allowed.includes(id))
    : [];
  return [...new Set([...saved, ...allowed])];
}

/** Missing/new cards are appended; unknown and duplicate IDs never hide real data. */
export function parseMerchantLayout(
  raw: string | null,
): MerchantDashboardLayout {
  try {
    const value = JSON.parse(raw ?? "null");
    if (value?.version !== 1) return defaultMerchantLayout();
    return {
      version: 1,
      kpis: normalizeOrder(value.kpis, KPI_IDS),
      widgets: normalizeOrder(value.widgets, WIDGET_IDS),
    };
  } catch {
    return defaultMerchantLayout();
  }
}

export function merchantLayoutKey(owner: string, storeId: string) {
  return `tavilga:merchant-layout:v1:${encodeURIComponent(owner)}:${encodeURIComponent(storeId)}`;
}

/** Reorder only visible cards, retaining the positions of cards hidden by overview mode. */
export function moveVisibleCards<T extends string>(
  order: T[],
  visible: readonly T[],
  active: string,
  over: string,
): T[] {
  const shown = order.filter((id) => visible.includes(id));
  const from = shown.indexOf(active as T),
    to = shown.indexOf(over as T);
  if (from < 0 || to < 0 || from === to) return order;
  const [item] = shown.splice(from, 1);
  shown.splice(to, 0, item);
  let index = 0;
  return order.map((id) => (visible.includes(id) ? shown[index++] : id));
}
