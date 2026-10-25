"use client";
import { MadeToOrderSwitch } from "./MerchantShowroom";
import {
  Merchant3dInsights,
  MerchantWalletWidget,
} from "./MerchantShowroomInsights";
import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  ArrowUpRight,
  Box,
  CircleAlert,
  Package,
  Plus,
  RefreshCw,
  Store as StoreIcon,
  WalletCards,
} from "lucide-react";
import type { Store } from "@/lib/types";
import type { DashboardPreferences } from "@/features/dashboard/preferences";
import { CATEGORY_LABEL } from "@/lib/products";
import { formatPrice } from "@/lib/format";
import { stockLabel } from "@/lib/inventory";
import { STORE_TYPES } from "@/lib/storeTypes";
import { useMerchantAnalytics } from "@/components/MerchantAnalytics";
import { type MerchantProduct } from "@/features/merchant/merchantApi";
import { MerchantDashboardLayout } from "./MerchantDashboardLayout";
import { MerchantLaunchCard, MerchantStoreShare } from "./MerchantGrowth";
import { MerchantInsights } from "./MerchantInsights";
import { MerchantRiskSummary } from "./MerchantOperations";
import { useMerchantResource } from "./useMerchantResource";
import {
  AnimatedNumber,
  StatSkeleton,
  OrderProgressCards,
  todayInUlaanbaatar,
  type ProgressStats,
} from "./MerchantStats";
import "./merchant-stats.css";

const numberLabel = (value: string) => BigInt(value).toLocaleString("mn-MN");
const money = (value: string) => numberLabel(value) + " ₮";
const colors = [
  "#f26440",
  "#25232b",
  "#f6ae95",
  "#92909e",
  "#e9d1c7",
  "#c5c2d0",
];

export function MerchantOverview({
  owner,
  store,
  onProducts,
  onStore,
  onAddProduct,
  onQuotes,
  onOrders,
  onDelivery,
  onGrowth,
  storePending = false,
  mode = "all",
  customizing,
  onCustomize,
  section: selectedSection,
  onSectionChange,
}: {
  section?: string;
  onSectionChange?: (section: string) => void;
  owner: string;
  store: Store | null;
  onProducts: () => void;
  onStore: () => void;
  onAddProduct?: () => void;
  onQuotes?: () => void;
  onOrders?: () => void;
  onDelivery?: () => void;
  onGrowth?: (section: "activation" | "wallet") => void;
  storePending?: boolean;
  mode?: DashboardPreferences["overview"];
  customizing?: boolean;
  onCustomize?: (editing: boolean) => void;
}) {
  const [lowOnly, setLowOnly] = useState(false);
  const [localEditing, setLocalEditing] = useState(false);
  const [localSection, setLocalSection] = useState("overview");
  const section = selectedSection ?? localSection;
  const setSection = onSectionChange ?? setLocalSection;
  const [date, setDate] = useState(todayInUlaanbaatar);
  const [orderPage, setOrderPage] = useState(0);
  const progress = useMerchantResource<ProgressStats>(
    owner,
    `/api/merchant/dashboard?section=progress&date=${date}&page=${orderPage}`,
    Boolean(store) || storePending,
    15000,
  );
  const finance = useMerchantAnalytics(owner, Boolean(store) || storePending);
  const showInventory =
    section === "inventory" || (section === "overview" && mode !== "sales");
  const showSales =
    section === "sales" || (section === "overview" && mode !== "inventory");
  const inventory = useMerchantResource<{ products: MerchantProduct[] }>(
    owner,
    "/api/merchant/products",
    (Boolean(store) || storePending) &&
      showInventory &&
      (section === "inventory" ||
        !!progress.data ||
        !!finance.analytics ||
        !!progress.error ||
        !!finance.error),
    60000,
  );
  const products = inventory.data?.products ?? [],
    loading = !inventory.data && !inventory.error,
    error = inventory.error;
  if (!store && !storePending)
    return (
      <>
        <MerchantLaunchCard
          owner={owner}
          store={null}
          onSetup={onStore}
          onProducts={onProducts}
          onStore={onStore}
        />
        <section className="merchant-empty-dashboard">
          <span className="merchant-overview-icon">
            <StoreIcon size={26} />
          </span>
          <h1>Дэлгүүрээ эхлээд бүртгэнэ үү</h1>
          <p>
            Дэлгүүрийн үндсэн мэдээллээ бүртгэсний дараа бүтээгдэхүүн, нөөц
            болон захиалгын самбар идэвхжинэ.
          </p>
          <button type="button" className="btn-primary" onClick={onStore}>
            Дэлгүүр нээх
            <ArrowUpRight size={16} />
          </button>
        </section>
      </>
    );
  const a = finance.analytics;
  const stock = products.reduce((sum, p) => sum + (p.stockQuantity ?? 0), 0);
  const inventoryValue = products.reduce(
    (sum, p) => sum + BigInt(p.basePrice) * BigInt(p.stockQuantity ?? 0),
    0n,
  );
  const lowStock = products.filter(
    (p) => p.stockQuantity != null && p.stockQuantity <= 5,
  );
  const uncounted = products.filter((p) => p.stockQuantity == null).length;
  const models = products.filter((p) => p.model?.file).length;
  const categoryMap = new Map<MerchantProduct["category"], number>();
  for (const p of products)
    categoryMap.set(p.category, (categoryMap.get(p.category) ?? 0) + 1);
  const categories = [...categoryMap].sort((a, b) => b[1] - a[1]);
  let cursor = 0;
  const donutStops =
    categories
      .map(([, total], index) => {
        const start = cursor;
        cursor += (total / Math.max(1, products.length)) * 100;
        return `${colors[index % colors.length]} ${start}% ${cursor}%`;
      })
      .join(", ") || "#262930 0% 100%";
  const shownProducts = (
    lowOnly
      ? lowStock
      : [...products].sort(
          (a, b) => (b.stockQuantity ?? 0) - (a.stockQuantity ?? 0),
        )
  ).slice(0, 5);
  const financeReady = a;
  const inventoryReady = Boolean(inventory.data);
  return (
    <section className="reference-overview reference-merchant-overview">
      <div className="reference-heading">
        <div>
          <span className="reference-eyebrow">
            ДЭЛГҮҮРИЙН САМБАР · СҮҮЛИЙН 30 ХОНОГ
          </span>
          <h1>Миний дэлгүүрийн тойм</h1>
          <p>Орлого, захиалга болон нөөцийн хяналт.</p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          disabled={
            progress.loading ||
            (showInventory && loading) ||
            (showSales && finance.loading)
          }
          onClick={() => {
            progress.refresh();
            if (showInventory) inventory.refresh();
            if (showSales) finance.refresh();
          }}
        >
          <RefreshCw size={15} />
          Шинэчлэх
        </button>
      </div>
      <MerchantLaunchCard
        owner={owner}
        store={store}
        onSetup={() => (onGrowth ? onGrowth("activation") : onStore())}
        onProducts={onAddProduct ?? onProducts}
        onStore={onStore}
      />
      {!onSectionChange && (
        <nav
          className="merchant-stats-tabs"
          aria-label="Dashboard статистикийн хэсгүүд"
        >
          {[
            ["overview", "Ерөнхий тойм"],
            ["progress", "Захиалгуудын явц"],
            ["sales", "Борлуулалт"],
            ["inventory", "Нөөц ба бараа"],
          ].map(([id, label]) => (
            <button
              type="button"
              key={id}
              aria-pressed={section === id}
              onClick={() => setSection(id)}
            >
              {label}
            </button>
          ))}
        </nav>
      )}
      {section !== "progress" && store ? (
        <div className="reference-store-banner merchant-compact-store">
          <div>
            <span className="reference-store-avatar">
              {store.name.slice(0, 1)}
            </span>
            <div>
              <h2>
                {store.name}
                {store.isFeatured && (
                  <small className="reference-featured-badge">
                    ★ Featured
                    {store.featuredRank ? " #" + store.featuredRank : ""}
                  </small>
                )}
                {a && (
                  <small className="reference-success-badge">
                    Шимтгэл {(a.commissionBps / 100).toFixed(1)}%
                  </small>
                )}
              </h2>
              <p>
                {store.city}
                {store.district ? " · " + store.district : ""} ·{" "}
                {STORE_TYPES.find((type) => type.id === store.storeType)
                  ?.label ?? store.storeType}
              </p>
              <MerchantStoreShare owner={owner} store={store} />
            </div>
          </div>
          <div className="reference-banner-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={onAddProduct ?? onProducts}
            >
              <Plus size={16} />
              Бүтээгдэхүүн нэмэх
            </button>
            {onQuotes && (
              <button type="button" className="btn-ghost" onClick={onQuotes}>
                Үнийн хүсэлтүүд
                <ArrowUpRight size={14} />
              </button>
            )}
          </div>
        </div>
      ) : !store ? (
        <StatSkeleton rows={1} />
      ) : null}
      {finance.error && (
        <div className="reference-error" role="alert">
          {finance.error}
          <button type="button" onClick={finance.refresh}>
            Санхүүг дахин ачаалах
          </button>
        </div>
      )}
      {error && (
        <div className="reference-error" role="alert">
          {error}
          <button type="button" onClick={inventory.refresh}>
            Нөөцийг дахин ачаалах
          </button>
        </div>
      )}
      <div hidden={section === "progress"}>
        <MerchantDashboardLayout
          owner={owner}
          storeId={store?.id ?? "loading"}
          editing={customizing ?? localEditing}
          onEditingChange={onCustomize ?? setLocalEditing}
          analytics={
            (section === "overview" || section === "sales") && (
              <MerchantInsights
                owner={owner}
                enabled={Boolean(store) || storePending}
              >
                <section className="merchant-stat-panel v14-aging-panel">
                  <header>
                    <div>
                      <h2>Захиалгын насжилт</h2>
                      <p>Дуусаагүй захиалга · хүлээгдэж буй хугацаагаар</p>
                    </div>
                  </header>
                  {!progress.data && progress.error ? (
                    <p className="merchant-error">
                      Насжилтын мэдээлэл ачаалагдаагүй.
                    </p>
                  ) : !progress.data ? (
                    <StatSkeleton rows={4} />
                  ) : (
                    <>
                      <div className="merchant-aging-bars">
                        {progress.data.aging.map((count, index) => (
                          <div key={index}>
                            <strong>
                              <AnimatedNumber value={count} />
                            </strong>
                            <i
                              style={{
                                height:
                                  (count /
                                    Math.max(1, ...progress.data!.aging)) *
                                    100 +
                                  "px",
                              }}
                            />
                            <span>
                              {
                                ["0–1 өдөр", "1–3 өдөр", "3–7 өдөр", "7+ өдөр"][
                                  index
                                ]
                              }
                            </span>
                          </div>
                        ))}
                      </div>
                      <p className="merchant-progress-caption">
                        {progress.data.held} захиалга төлбөр эсвэл цуцлах хүсэлт
                        хүлээж байна.
                      </p>
                    </>
                  )}
                </section>
              </MerchantInsights>
            )
          }
          kpis={{
            revenue: showSales ? (
              <article className="reference-kpi is-featured">
                <div className="reference-kpi-label">
                  <span>Цэвэр орлого (30 хоног)</span>
                  <WalletCards size={18} />
                </div>
                <strong>
                  {financeReady ? (
                    <AnimatedNumber value={a.merchantNet} money />
                  ) : (
                    <StatSkeleton rows={1} />
                  )}
                </strong>
                <div className="reference-kpi-footer">
                  <small>
                    GMV: {financeReady ? money(a.grossRevenue) : "—"}
                  </small>
                  <small>
                    Fee: {financeReady ? money(a.platformFee) : "—"}
                  </small>
                </div>
              </article>
            ) : null,
            orders: showSales ? (
              <article className="reference-kpi">
                <div className="reference-kpi-label">
                  <span>Төлөгдсөн захиалга</span>
                  <Package size={18} />
                </div>
                <strong>
                  {financeReady ? (
                    <>
                      <AnimatedNumber value={a.paidOrders} /> захиалга
                    </>
                  ) : (
                    <StatSkeleton rows={1} />
                  )}
                </strong>
                <div className="reference-kpi-footer">
                  <small>
                    {financeReady
                      ? numberLabel(
                          (
                            BigInt(a.pendingOrders) +
                            BigInt(a.processingOrders) +
                            BigInt(a.shippedOrders)
                          ).toString(),
                        ) + " идэвхтэй"
                      : "—"}
                  </small>
                  <button type="button" onClick={onOrders ?? onProducts}>
                    Захиалга үзэх →
                  </button>
                </div>
              </article>
            ) : null,
            "inventory-val": showInventory ? (
              <article className="reference-kpi">
                <div className="reference-kpi-label">
                  <span>Агуулахын нөөцийн үнэлгээ</span>
                  <Box size={18} />
                </div>
                <strong>
                  {inventoryReady ? (
                    <AnimatedNumber value={inventoryValue.toString()} money />
                  ) : (
                    <StatSkeleton rows={1} />
                  )}
                </strong>
                <div className="reference-kpi-footer">
                  <small>
                    {products.length} бараа · {stock} ширхэг
                  </small>
                  <small>
                    {models} 3D загвартай
                    {uncounted ? ` · ${uncounted} нөөц тоолоогүй` : ""}
                  </small>
                </div>
              </article>
            ) : null,
            "stock-alert": showInventory ? (
              <article className="reference-kpi reference-stock-warning">
                <div className="reference-kpi-label">
                  <span>Нөөцийн анхааруулга</span>
                  <CircleAlert size={18} />
                </div>
                <strong>
                  {inventoryReady ? (
                    <>
                      <AnimatedNumber value={lowStock.length} /> бараа багассан
                    </>
                  ) : (
                    <StatSkeleton rows={1} />
                  )}
                </strong>
                <div className="reference-kpi-footer">
                  <small>≤ 5 ширхэг үлдэгдэлтэй</small>
                  <button
                    type="button"
                    aria-pressed={lowOnly}
                    onClick={() => setLowOnly((value) => !value)}
                  >
                    {lowOnly ? "Бүгдийг үзэх" : "Бага нөөцийг үзэх"} →
                  </button>
                </div>
              </article>
            ) : null,
          }}
          widgets={{
            "inventory-control": showInventory ? (
              <article className="reference-panel reference-inventory-panel">
                <header>
                  <div>
                    <h2>Бүтээгдэхүүн ба нөөцийн хяналт</h2>
                    <p>
                      {lowOnly
                        ? "Бага нөөцтэй бараа"
                        : "Нөөц хамгийн ихтэй 5 бараа"}
                    </p>
                  </div>
                  <button type="button" onClick={onProducts}>
                    Бүх бараа
                    <ArrowUpRight size={14} />
                  </button>
                </header>
                {loading ? (
                  <div className="reference-empty" role="status">
                    <StatSkeleton rows={3} />
                  </div>
                ) : error ? (
                  <div className="reference-empty">
                    Нөөцийн мэдээлэл ачаалагдаагүй.
                  </div>
                ) : shownProducts.length ? (
                  <ul className="reference-inventory-list">
                    {shownProducts.map((p, i) => (
                      <li key={p.id}>
                        {p.image ? (
                          <Image
                            src={p.image}
                            alt=""
                            width={40}
                            height={40}
                            sizes="40px"
                          />
                        ) : (
                          <span className="reference-product-number">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                        )}
                        <div>
                          <strong>{p.name}</strong>
                          <small>
                            {CATEGORY_LABEL[p.category]} ·{" "}
                            {p.model?.file
                              ? "3D загвартай"
                              : p.modelRequested
                                ? "3D хүсэлттэй"
                                : "3D загваргүй"}
                          </small>
                        </div>
                        <div>
                          <strong>{formatPrice(p.basePrice)}</strong>
                          <small
                            className={
                              p.stockQuantity != null && p.stockQuantity <= 5
                                ? "is-low-stock"
                                : "is-stocked"
                            }
                          >
                            {stockLabel(p)}
                          </small>
                        </div>
                        <MadeToOrderSwitch owner={owner} product={p} />
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="reference-empty">
                    {lowOnly
                      ? "Бага нөөцтэй бараа алга."
                      : "Бүтээгдэхүүн бүртгэгдээгүй байна."}
                  </div>
                )}
                <footer>
                  <Link href={`/catalog/stores/${store?.id ?? ""}`}>
                    Дэлгүүр үзэх
                    <ArrowUpRight size={14} />
                  </Link>
                  <button type="button" onClick={onStore}>
                    Дэлгүүрийн тохиргоо
                  </button>
                </footer>
              </article>
            ) : null,
            "category-chart": showInventory ? (
              <article className="reference-panel reference-category-panel">
                <header>
                  <div>
                    <h2>Ангиллын бүтэц</h2>
                    <p>
                      {loading
                        ? "Ачаалж байна…"
                        : products.length + " бүтээгдэхүүний эзлэх хувь"}
                    </p>
                  </div>
                </header>
                {loading ? (
                  <StatSkeleton rows={4} />
                ) : (
                  <div className="reference-category-body">
                    <div
                      className="reference-donut"
                      style={{ background: `conic-gradient(${donutStops})` }}
                      aria-hidden="true"
                    >
                      <div>
                        <strong>{products.length}</strong>
                        <small>Бараа</small>
                      </div>
                    </div>
                    <ul className="reference-category-legend">
                      {categories.map(([category, total], i) => (
                        <li key={category}>
                          <span>
                            <i
                              style={{
                                backgroundColor: colors[i % colors.length],
                              }}
                            />
                            {CATEGORY_LABEL[category]}
                          </span>
                          <strong>
                            {Math.round(
                              (total / Math.max(1, products.length)) * 100,
                            )}
                            % ({total})
                          </strong>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {onQuotes && (
                  <button
                    type="button"
                    className="reference-quote-link"
                    onClick={onQuotes}
                  >
                    <div>
                      <strong>Гал тогооны үнийн хүсэлтүүд</strong>
                      <ArrowUpRight size={16} />
                    </div>
                    <span>
                      Ирсэн хүсэлтүүдийг үзэж, үнийн саналаа илгээнэ үү.
                    </span>
                  </button>
                )}
              </article>
            ) : null,
            "order-progress": showSales ? (
              <div className="reference-panel reference-fulfillment">
                <header>
                  <div>
                    <h2>Захиалгын явц</h2>
                    <p>Одоогийн захиалгын төлөв</p>
                  </div>
                  <Box size={18} />
                </header>
                <div className="reference-mini-stats">
                  <div>
                    <span>Хүлээгдэж буй</span>
                    <strong>
                      {financeReady ? numberLabel(a.pendingOrders) : "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Бэлтгэж байгаа</span>
                    <strong>
                      {financeReady ? numberLabel(a.processingOrders) : "—"}
                    </strong>
                  </div>
                  <div>
                    <span>Хүргэлтэд гарсан</span>
                    <strong>
                      {financeReady ? numberLabel(a.shippedOrders) : "—"}
                    </strong>
                  </div>
                  <div>
                    <span>3D загварын хүсэлт</span>
                    <strong>
                      {financeReady ? numberLabel(a.modelRequestCount) : "—"}
                    </strong>
                  </div>
                </div>
              </div>
            ) : null,
          }}
        />
      </div>
      {showSales && (
        <>
          <MerchantWalletWidget
            owner={owner}
            onOpen={() => onGrowth?.("wallet")}
            onBank={() => onGrowth?.("activation")}
          />
          <Merchant3dInsights owner={owner} />
        </>
      )}
      {section !== "inventory" && (
        <>
          <MerchantRiskSummary owner={owner} date={date} />
          <OrderProgressCards
            stats={progress.data}
            loading={progress.loading}
            error={progress.error}
            date={date}
            page={orderPage}
            onDate={(day) => {
              setDate(day);
              setOrderPage(0);
            }}
            onPage={setOrderPage}
            onRetry={progress.refresh}
            onDelivery={onDelivery}
          />
        </>
      )}
    </section>
  );
}
