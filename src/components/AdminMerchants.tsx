"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BadgeDollarSign,
  Box,
  Package,
  RefreshCw,
  Save,
  Search,
  Star,
  Store,
} from "lucide-react";

import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";

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

function money(value: string | bigint) {
  return `${BigInt(value).toLocaleString("mn-MN")} ₮`;
}

function count(value: string) {
  return BigInt(value).toLocaleString("mn-MN");
}

export function AdminMerchants() {
  const userId = useAuth((state) => state.user?.id);

  const role = useAuth((state) => state.role);

  if (!userId || role !== "admin") {
    return null;
  }

  return <MerchantPanel key={userId} owner={userId} />;
}

function MerchantPanel({ owner }: { owner: string }) {
  const [merchants, setMerchants] = useState<MerchantOverview[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  const [query, setQuery] = useState("");

  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    let active = true;

    setLoading(true);
    setError(null);

    authFetch(
      "/api/admin/merchants",
      {
        signal: controller.signal,
      },
      owner,
    )
      .then(async (response) => {
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(
            data?.error ?? "Merchant мэдээллийг ачаалж чадсангүй.",
          );
        }

        return data;
      })
      .then((data) => {
        if (!active) return;

        setMerchants(Array.isArray(data?.merchants) ? data.merchants : []);
      })
      .catch((reason) => {
        if (!active) return;

        setError(
          reason instanceof Error
            ? reason.message
            : "Merchant мэдээллийг ачаалж чадсангүй.",
        );
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

  const totals = useMemo(() => {
    return merchants.reduce(
      (result, merchant) => {
        if (merchant.active) {
          result.active += 1;
        }

        result.gross += BigInt(merchant.grossRevenue);

        result.platform += BigInt(merchant.platformRevenue);

        result.requests += BigInt(merchant.modelRequestCount);

        return result;
      },
      {
        active: 0,
        gross: 0n,
        platform: 0n,
        requests: 0n,
      },
    );
  }, [merchants]);

  const topMerchant =
    merchants.find((merchant) => BigInt(merchant.grossRevenue) > 0n) ?? null;

  const normalized = query.trim().toLowerCase();

  const filtered = merchants.filter(
    (merchant) =>
      !normalized ||
      [merchant.name, merchant.city, merchant.district, merchant.storeType]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
  );

  return (
    <div className="admin-merchants">
      <div className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">MARKETPLACE</span>

          <h1>Merchant дэлгүүрүүд</h1>

          <p>Борлуулалт, commission, Featured болон 3D хүсэлтийг хянах.</p>
        </div>

        <button
          type="button"
          className="btn-ghost"
          disabled={loading}
          onClick={() => setRefresh((value) => value + 1)}
        >
          <RefreshCw size={16} />
          Шинэчлэх
        </button>
      </div>

      <div className="admin-merchant-stats">
        <MerchantStat
          icon={Store}
          label="Нийт merchant"
          value={merchants.length.toString()}
          detail={`${totals.active} идэвхтэй`}
        />

        <MerchantStat
          icon={BadgeDollarSign}
          label="Нийт борлуулалт"
          value={money(totals.gross)}
          detail="Төлөгдсөн захиалгууд"
        />

        <MerchantStat
          icon={BadgeDollarSign}
          label="Platform орлого"
          value={money(totals.platform)}
          detail="Commission орлого"
          featured
        />

        <MerchantStat
          icon={Box}
          label="3D хүсэлт"
          value={totals.requests.toLocaleString("mn-MN")}
          detail="Merchant хүсэлт"
        />
      </div>

      <div className="admin-merchant-highlight">
        <div>
          <span>ХАМГИЙН ИХ БОРЛУУЛАЛТ</span>

          <strong>
            {topMerchant ? topMerchant.name : "Одоогоор борлуулалт алга"}
          </strong>
        </div>

        {topMerchant && (
          <div>
            <strong>{money(topMerchant.grossRevenue)}</strong>

            <small>{count(topMerchant.paidOrderCount)} захиалга</small>
          </div>
        )}
      </div>

      <div className="admin-merchant-toolbar">
        <label>
          <Search size={17} />

          <input
            type="search"
            value={query}
            placeholder="Merchant хайх..."
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>

        <span>{filtered.length} дэлгүүр</span>
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
        <div className="admin-merchant-empty">
          <Store size={28} />

          <strong>Merchant олдсонгүй</strong>
        </div>
      ) : (
        <div className="admin-merchant-list">
          <div className="admin-merchant-list-head">
            <span>Дэлгүүр</span>
            <span>Борлуулалт</span>
            <span>Бараа</span>
            <span>Захиалга</span>
            <span>Commission</span>
            <span>Featured</span>
            <span>Төлөв</span>
            <span />
          </div>

          {filtered.map((merchant) => (
            <MerchantRow
              key={[
                merchant.id,
                merchant.commissionBps,
                merchant.isFeatured,
                merchant.featuredRank,
                merchant.active,
              ].join("-")}
              owner={owner}
              merchant={merchant}
              onSaved={() => setRefresh((value) => value + 1)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function MerchantRow({
  owner,
  merchant,
  onSaved,
}: {
  owner: string;
  merchant: MerchantOverview;
  onSaved: () => void;
}) {
  const [commission, setCommission] = useState(merchant.commissionBps / 100);

  const [featured, setFeatured] = useState(merchant.isFeatured);

  const [featuredRank, setFeaturedRank] = useState(merchant.featuredRank ?? 1);

  const [active, setActive] = useState(merchant.active);

  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (saving) return;

    setSaving(true);
    setError(null);

    try {
      const response = await authFetch(
        "/api/admin/merchants",
        {
          method: "PATCH",

          headers: {
            "Content-Type": "application/json",
          },

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

      if (!response.ok) {
        throw new Error(data?.error ?? "Хадгалж чадсангүй.");
      }

      onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Хадгалж чадсангүй.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="admin-merchant-row">
      <div className="admin-merchant-store">
        <span className="admin-merchant-avatar">
          {merchant.name.slice(0, 1).toUpperCase()}
        </span>

        <div>
          <strong>{merchant.name}</strong>

          <small>
            {merchant.city}
            {merchant.district ? ` · ${merchant.district}` : ""}
          </small>
        </div>
      </div>

      <div className="admin-merchant-money">
        <strong>{money(merchant.grossRevenue)}</strong>

        <small>Fee {money(merchant.platformRevenue)}</small>
      </div>

      <div className="admin-merchant-count">
        <Package size={15} />

        <strong>{count(merchant.productCount)}</strong>

        {BigInt(merchant.modelRequestCount) > 0n && (
          <small>{merchant.modelRequestCount} 3D хүсэлт</small>
        )}
      </div>

      <div className="admin-merchant-count">
        <strong>{count(merchant.paidOrderCount)}</strong>
      </div>

      <label className="admin-merchant-commission">
        <input
          type="number"
          min={3}
          max={5}
          step={0.1}
          value={commission}
          onChange={(event) => setCommission(Number(event.target.value))}
        />

        <span>%</span>
      </label>

      <div className="admin-merchant-featured">
        <label>
          <input
            type="checkbox"
            checked={featured}
            onChange={(event) => setFeatured(event.target.checked)}
          />
          <Star size={15} />
          Featured
        </label>

        {featured && (
          <input
            type="number"
            aria-label="Featured эрэмбэ"
            min={1}
            step={1}
            value={featuredRank}
            onChange={(event) => setFeaturedRank(Number(event.target.value))}
          />
        )}
      </div>

      <label className="admin-merchant-active">
        <input
          type="checkbox"
          checked={active}
          onChange={(event) => setActive(event.target.checked)}
        />

        <span>{active ? "Идэвхтэй" : "Идэвхгүй"}</span>
      </label>

      <div className="admin-merchant-save">
        <button type="button" disabled={saving} onClick={save} title="Хадгалах">
          <Save size={16} />
        </button>

        {error && <small title={error}>{error}</small>}
      </div>
    </div>
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
    <article className={`admin-merchant-stat ${featured ? "featured" : ""}`}>
      <div>
        <span>{label}</span>

        <Icon size={18} />
      </div>

      <strong>{value}</strong>

      <small>{detail}</small>
    </article>
  );
}
