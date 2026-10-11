"use client";
import { useEffect, useMemo, useState } from "react";
import {
  useDraftState,
  useDraftStatus,
  clearDashboardDraft,
} from "@/hooks/useDashboardDraft";
import {
  BadgeDollarSign,
  Box,
  RefreshCw,
  Save,
  Search,
  Star,
  Store,
  TrendingUp,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
import { STORE_TYPES } from "@/lib/storeTypes";

type MerchantOverview = {
  id: string;
  ownerId: string;
  name: string;
  storeType: string;
  city: string;
  district: string;
  image: string;
  active: boolean;
  commissionBps: number;
  isFeatured: boolean;
  featuredRank: number | null;
  createdAt: string;
  productCount: string;
  modelRequestCount: string;
  paidOrderCount: string;
  grossRevenue: string;
  platformRevenue: string;
  merchantNet: string;
};
type Filter = "all" | "active" | "featured" | "requests";
const money = (value: string | bigint) =>
  `${BigInt(value).toLocaleString("mn-MN")} ₮`;
const count = (value: string) => BigInt(value).toLocaleString("mn-MN");
const merchantKey = (m: MerchantOverview) =>
  [m.id, m.commissionBps, m.isFeatured, m.featuredRank, m.active].join("-");

export function AdminMerchants() {
  const userId = useAuth((state) => state.user?.id);
  const role = useAuth((state) => state.role);
  return userId && role === "admin" ? (
    <MerchantPanel key={userId} owner={userId} />
  ) : null;
}
function MerchantPanel({ owner }: { owner: string }) {
  const [merchants, setMerchants] = useState<MerchantOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    authFetch("/api/admin/merchants", { signal: controller.signal }, owner)
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok)
          throw new Error(
            data?.error ?? "Merchant мэдээллийг ачаалж чадсангүй.",
          );
        return data;
      })
      .then((data) => {
        if (
          active &&
          useAuth.getState().user?.id === owner &&
          useAuth.getState().role === "admin"
        )
          setMerchants(Array.isArray(data?.merchants) ? data.merchants : []);
      })
      .catch((reason) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Мэдээллийг ачаалж чадсангүй.",
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [owner, refresh]);
  const totals = useMemo(
    () =>
      merchants.reduce(
        (sum, m) => ({
          active: sum.active + Number(m.active),
          featured: sum.featured + Number(m.isFeatured),
          gross: sum.gross + BigInt(m.grossRevenue),
          platform: sum.platform + BigInt(m.platformRevenue),
          net: sum.net + BigInt(m.merchantNet),
          requests: sum.requests + BigInt(m.modelRequestCount),
        }),
        {
          active: 0,
          featured: 0,
          gross: 0n,
          platform: 0n,
          net: 0n,
          requests: 0n,
        },
      ),
    [merchants],
  );
  const topMerchant = [...merchants]
    .sort((a, b) =>
      BigInt(a.grossRevenue) > BigInt(b.grossRevenue)
        ? -1
        : BigInt(a.grossRevenue) < BigInt(b.grossRevenue)
          ? 1
          : 0,
    )
    .find((m) => BigInt(m.grossRevenue) > 0n);
  const normalized = query.trim().toLowerCase();
  const filtered = merchants.filter(
    (m) =>
      (!normalized ||
        [m.name, m.city, m.district, m.storeType]
          .join(" ")
          .toLowerCase()
          .includes(normalized)) &&
      (filter === "all" ||
        (filter === "active" && m.active) ||
        (filter === "featured" && m.isFeatured) ||
        (filter === "requests" && BigInt(m.modelRequestCount) > 0n)),
  );
  const selected = filtered.find((m) => m.id === selectedId) ?? filtered[0];
  const filters: { id: Filter; label: string; total: number }[] = [
    { id: "all", label: "Бүгд", total: merchants.length },
    { id: "active", label: "Идэвхтэй", total: totals.active },
    { id: "featured", label: "★ Featured", total: totals.featured },
    {
      id: "requests",
      label: "3D хүсэлттэй",
      total: merchants.filter((m) => BigInt(m.modelRequestCount) > 0n).length,
    },
  ];
  const editorProps = {
    owner,
    savingId,
    onSaving: setSavingId,
    onSaved: () => setRefresh((value) => value + 1),
  };
  return (
    <section className="reference-overview admin-merchants">
      <div className="reference-heading">
        <div>
          <span className="reference-eyebrow">
            MARKETPLACE · ДЭЛГҮҮРИЙН УДИРДЛАГА
          </span>
          <h1>Merchant дэлгүүрүүд</h1>
          <p>Борлуулалт, шимтгэл, Featured болон 3D хүсэлтийг хянах.</p>
        </div>
        <button
          type="button"
          className="btn-ghost"
          disabled={loading || Boolean(savingId)}
          onClick={() => setRefresh((value) => value + 1)}
        >
          <RefreshCw size={16} />
          Шинэчлэх
        </button>
      </div>
      <div className="reference-kpis reference-kpis-five">
        <MerchantStat
          icon={Store}
          label="Нийт Merchant"
          value={loading ? "—" : `${merchants.length} дэлгүүр`}
          detail={`${totals.active} идэвхтэй · ${totals.featured} Featured`}
        />
        <MerchantStat
          icon={TrendingUp}
          label="Нийт борлуулалт (GMV)"
          value={loading ? "—" : money(totals.gross)}
          detail="Төлөгдсөн захиалгууд"
        />
        <MerchantStat
          icon={BadgeDollarSign}
          label="Платформ орлого (Fee)"
          value={loading ? "—" : money(totals.platform)}
          detail={`Цэвэр шилжүүлэг: ${money(totals.net)}`}
          featured
        />
        <MerchantStat
          icon={Box}
          label="3D загвар хүсэлт"
          value={
            loading ? "—" : `${totals.requests.toLocaleString("mn-MN")} хүсэлт`
          }
          detail="Дэлгүүрүүдийн нийт хүсэлт"
        />
        <article className="reference-kpi reference-spotlight">
          <span>
            <Star size={14} />
            Тэргүүлэгч дэлгүүр
          </span>
          <strong>
            {loading ? "—" : (topMerchant?.name ?? "Борлуулалт бүртгэгдээгүй")}
          </strong>
          <div>{topMerchant ? money(topMerchant.grossRevenue) : "—"}</div>
          <small>
            {topMerchant
              ? `${count(topMerchant.paidOrderCount)} захиалга`
              : "Төлөгдсөн захиалгаар"}
          </small>
        </article>
      </div>
      <div className="reference-command">
        <div className="reference-filters" aria-label="Дэлгүүр шүүх">
          {filters.map((item) => (
            <button
              type="button"
              key={item.id}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label} ({item.total})
            </button>
          ))}
        </div>
        <label className="reference-search">
          <Search size={16} />
          <input
            type="search"
            aria-label="Дэлгүүр хайх"
            value={query}
            placeholder="Дэлгүүр, дүүрэг, төрлөөр хайх…"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      {loading ? (
        <div className="admin-loading" role="status">
          <RefreshCw size={20} className="animate-spin" />
          Merchant мэдээллийг ачаалж байна…
        </div>
      ) : error ? (
        <p className="admin-error" role="alert">
          {error}
        </p>
      ) : !filtered.length ? (
        <div className="reference-empty">
          <Store size={28} />
          <strong>Merchant олдсонгүй</strong>
        </div>
      ) : (
        <div className="reference-merchant-split">
          <div className="reference-table-card">
            <div className="reference-table-scroll">
              <table className="reference-merchant-table">
                <caption className="sr-only">
                  Дэлгүүрийн борлуулалт ба тохиргоо
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Дэлгүүр & Байршил</th>
                    <th scope="col">Борлуулалт & Шимтгэл</th>
                    <th scope="col">Бараа / 3D</th>
                    <th scope="col">Commission (%)</th>
                    <th scope="col">Featured эрэмбэ</th>
                    <th scope="col">Төлөв</th>
                    <th scope="col">Үйлдэл</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((merchant) => (
                    <MerchantEditor
                      key={merchantKey(merchant)}
                      {...editorProps}
                      merchant={merchant}
                      selected={selected?.id === merchant.id}
                      onSelect={() => setSelectedId(merchant.id)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {selected && (
            <MerchantEditor
              key={`inspector-${merchantKey(selected)}`}
              {...editorProps}
              merchant={selected}
              inspector
            />
          )}
        </div>
      )}
    </section>
  );
}
function MerchantEditor({
  owner,
  merchant,
  savingId,
  onSaving,
  onSaved,
  selected,
  onSelect,
  inspector = false,
}: {
  owner: string;
  merchant: MerchantOverview;
  savingId: string | null;
  onSaving: (id: string | null) => void;
  onSaved: () => void;
  selected?: boolean;
  onSelect?: () => void;
  inspector?: boolean;
}) {
  const draftScope = `admin:${owner}:merchant:${merchant.id}`;
  const [commission, setCommission] = useDraftState(
    draftScope,
    "commission",
    merchant.commissionBps / 100,
  );
  const [featured, setFeatured] = useDraftState(
    draftScope,
    "featured",
    merchant.isFeatured,
  );
  const [featuredRank, setFeaturedRank] = useDraftState(
    draftScope,
    "featuredRank",
    merchant.featuredRank ?? 1,
  );
  const [active, setActive] = useDraftState(
    draftScope,
    "active",
    merchant.active,
  );
  const draftStatus = useDraftStatus(draftScope);
  const [error, setError] = useState<string | null>(null);
  async function save() {
    if (savingId || draftStatus.loading) return;
    if (
      !Number.isFinite(commission) ||
      commission < 3 ||
      commission > 5 ||
      (featured && (!Number.isInteger(featuredRank) || featuredRank < 1))
    ) {
      setError("Шимтгэл 3–5%, Featured эрэмбэ эерэг бүхэл тоо байна.");
      return;
    }
    onSaving(merchant.id);
    setError(null);
    try {
      const response = await authFetch(
        "/api/admin/merchants",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: merchant.id,
            commissionBps: Math.round(commission * 100),
            isFeatured: featured,
            featuredRank: featured ? featuredRank : null,
            active,
          }),
        },
        owner,
      );
      const data = await response.json().catch(() => null);
      if (!response.ok) throw new Error(data?.error ?? "Хадгалж чадсангүй.");
      await clearDashboardDraft(draftScope, false);
      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Хадгалж чадсангүй.");
    } finally {
      onSaving(null);
    }
  }
  const saveButton = (
    <button
      type="button"
      className={
        draftStatus.dirty ? "reference-save is-dirty" : "reference-save"
      }
      disabled={Boolean(savingId) || draftStatus.loading}
      onClick={save}
      aria-label={`${merchant.name} тохиргоо хадгалах`}
    >
      <Save size={14} />
      {savingId === merchant.id ? "Хадгалж байна…" : "Хадгалах"}
    </button>
  );
  const status = (
    <>
      {error && (
        <small className="reference-error" role="alert">
          {error}
        </small>
      )}
      {draftStatus.dirty && (
        <small className="reference-draft" role="status">
          {draftStatus.error
            ? "Ноорог хадгалагдсангүй"
            : draftStatus.saving
              ? "Ноорог хадгалж байна…"
              : "Ноорог өөрчлөлт · Хадгалах шаардлагатай"}
        </small>
      )}
    </>
  );
  const featuredControl = (
    <div className="reference-featured-control">
      <label className={featured ? "is-featured" : ""}>
        <input
          type="checkbox"
          checked={featured}
          onChange={(event) => setFeatured(event.target.checked)}
        />
        <Star size={13} />
        Featured
      </label>
      {featured && (
        <input
          type="number"
          aria-label={`${merchant.name} Featured эрэмбэ`}
          min={1}
          step={1}
          value={featuredRank}
          onChange={(event) => setFeaturedRank(Number(event.target.value))}
        />
      )}
    </div>
  );
  const activeControl = (
    <label className={`reference-active-control ${active ? "is-active" : ""}`}>
      <input
        type="checkbox"
        checked={active}
        onChange={(event) => setActive(event.target.checked)}
      />
      {active ? "Идэвхтэй" : "Идэвхгүй"}
    </label>
  );
  if (inspector)
    return (
      <aside
        className="reference-inspector"
        aria-label="Сонгосон дэлгүүрийн хяналт"
        inert={draftStatus.loading || Boolean(savingId) || undefined}
      >
        <header>
          <span className="reference-store-avatar">
            {merchant.name.slice(0, 1)}
          </span>
          <div>
            <span className="reference-eyebrow">ДЭЛГЭРЭНГҮЙ ХЯНАЛТ</span>
            <h2>{merchant.name}</h2>
            <p>
              {STORE_TYPES.find((type) => type.id === merchant.storeType)
                ?.label ?? merchant.storeType}{" "}
              · {merchant.city}
              {merchant.district ? ` · ${merchant.district}` : ""}
            </p>
          </div>
        </header>
        <dl className="reference-inspector-finance">
          <div>
            <dt>Нийт борлуулалт (GMV)</dt>
            <dd>{money(merchant.grossRevenue)}</dd>
          </div>
          <div>
            <dt>Платформ шимтгэл</dt>
            <dd>{money(merchant.platformRevenue)}</dd>
          </div>
          <div>
            <dt>Дэлгүүрт очих цэвэр дүн</dt>
            <dd>{money(merchant.merchantNet)}</dd>
          </div>
        </dl>
        <div className="reference-commission-slider">
          <label htmlFor={`commission-${merchant.id}`}>
            Commission тохируулах <strong>{commission.toFixed(1)}%</strong>
          </label>
          <input
            id={`commission-${merchant.id}`}
            type="range"
            min={3}
            max={5}
            step={0.1}
            value={commission}
            onChange={(event) => setCommission(Number(event.target.value))}
          />
          <div>
            <span>3.0%</span>
            <span>4.0%</span>
            <span>5.0%</span>
          </div>
          <p>Шинэ шимтгэл дараагийн захиалгад үйлчилнэ.</p>
        </div>
        <div className="reference-mini-stats">
          <div>
            <span>Бараа</span>
            <strong>{count(merchant.productCount)}</strong>
          </div>
          <div>
            <span>Захиалга</span>
            <strong>{count(merchant.paidOrderCount)}</strong>
          </div>
          <div>
            <span>3D хүсэлт</span>
            <strong>{count(merchant.modelRequestCount)}</strong>
          </div>
        </div>
        <div className="reference-inspector-controls">
          {featuredControl}
          {activeControl}
        </div>
        <footer>
          {status}
          {saveButton}
        </footer>
      </aside>
    );
  return (
    <tr
      className={selected ? "is-selected" : ""}
      onClick={(event) => {
        if (!(event.target as HTMLElement).closest("button, input, label"))
          onSelect?.();
      }}
      inert={draftStatus.loading || Boolean(savingId) || undefined}
    >
      <td>
        <button
          type="button"
          className="reference-store-select"
          onClick={onSelect}
          aria-pressed={selected}
        >
          <span className="reference-store-avatar">
            {merchant.name.slice(0, 1)}
          </span>
          <span>
            <strong>{merchant.name}</strong>
            <small>
              {merchant.city}
              {merchant.district ? ` · ${merchant.district}` : ""}
            </small>
          </span>
        </button>
      </td>
      <td>
        <strong>{money(merchant.grossRevenue)}</strong>
        <small>Fee {money(merchant.platformRevenue)}</small>
      </td>
      <td>
        <strong>{count(merchant.productCount)} бараа</strong>
        <small>{count(merchant.modelRequestCount)} 3D хүсэлт</small>
      </td>
      <td>
        <label className="reference-commission-number">
          <input
            type="number"
            aria-label={`${merchant.name} шимтгэл`}
            min={3}
            max={5}
            step={0.1}
            value={commission}
            onChange={(event) => setCommission(Number(event.target.value))}
          />
          <span>%</span>
        </label>
      </td>
      <td>{featuredControl}</td>
      <td>{activeControl}</td>
      <td>
        {saveButton}
        {status}
      </td>
    </tr>
  );
}
function MerchantStat({
  icon: Icon,
  label,
  value,
  detail,
  featured = false,
}: {
  icon: typeof Store;
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
