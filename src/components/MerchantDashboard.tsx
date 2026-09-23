"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  Box,
  Boxes,
  CircleAlert,
  ImagePlus,
  Package,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Search,
  Store as StoreIcon,
  WalletCards,
  X,
} from "lucide-react";
import { MerchantAnalytics } from "./MerchantAnalytics";
import { useAuth } from "@/store/auth";
import { authFetch } from "@/lib/authFetch";
import type { Product, Store } from "@/lib/types";
type MerchantProduct = Product & {
  modelRequested?: boolean;
};
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/products";
import { STORE_TYPES } from "@/lib/storeTypes";
import { parseProduct } from "@/lib/catalogValidation";
import { formatPrice } from "@/lib/format";
import { MAX_STOCK_QUANTITY, stockLabel } from "@/lib/inventory";
import {
  merchantLocationPath,
  readMerchantLocation,
} from "@/lib/merchantNavigation";
import { useCatalogStore } from "@/store/catalog";
import { MerchantOrders } from "./MerchantOrders";
import { MerchantShell } from "./MerchantShell";
import type { MerchantTab } from "./MerchantSidebar";
import { MerchantKitchenDesigns } from "./MerchantKitchenDesigns";

const blankProduct = (): MerchantProduct => ({
  id: "new",
  name: "",
  category: "sofa",
  description: "",
  image: "",
  images: [],
  basePrice: 0,
  rating: 0,
  reviewCount: 0,
  defaultColor: "natural",

  colors: [
    {
      id: "natural",
      name: "Байгалийн өнгө",
      hex: "#C9A37A",
      priceDelta: 0,
    },
  ],

  materials: [
    {
      id: "wood",
      name: "Мод",
      priceDelta: 0,
    },
  ],

  dimensions: {
    w: 1,
    d: 1,
    h: 1,
  },

  stockQuantity: 0,
  inStock: false,

  modelRequested: false,
});

const isOwner = (owner: string) =>
  useAuth.getState().user?.id === owner &&
  useAuth.getState().role === "merchant";

async function merchantRequest<T>(
  path: string,
  owner: string,
  init?: RequestInit,
): Promise<T> {
  const response = await authFetch(path, init, owner);
  const result = await response.json().catch(() => null);
  if (!response.ok || !result)
    throw new Error(
      result?.error ?? "Мэдээллийг ачаалж чадсангүй. Дахин оролдоно уу.",
    );
  if (!isOwner(owner))
    throw new Error("Нэвтрэлт өөрчлөгдсөн байна. Дахин нэвтэрнэ үү.");
  return result as T;
}

export function MerchantDashboard() {
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const role = useAuth((state) => state.role);
  const initialized = useAuth((state) => state.initialized);
  const initialize = useAuth((state) => state.initialize);
  useEffect(() => {
    void initialize();
  }, [initialize]);
  useEffect(() => {
    if (initialized && !user) router.replace("/login?next=/merchant");
  }, [initialized, user, router]);
  if (!initialized || !user)
    return (
      <div className="merchant-state" role="status">
        <StoreIcon size={32} />
        Дэлгүүрийн эрхийг шалгаж байна…
      </div>
    );
  if (role !== "merchant")
    return (
      <div className="merchant-state">
        <StoreIcon size={32} />
        <h1>Худалдаа эрхлэгчийн хэсэг</h1>
        <p>Дэлгүүр нээхийн тулд админаар merchant эрхээ идэвхжүүлнэ үү.</p>
        <Link href="/account" className="btn-ghost">
          Миний бүртгэл
        </Link>
      </div>
    );
  return (
    <MerchantWorkspace key={user.id} owner={user.id} userName={user.name} />
  );
}

function MerchantWorkspace({
  owner,
  userName,
}: {
  owner: string;
  userName: string;
}) {
  const [store, setStore] = useState<Store | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [tab, setTab] = useState<MerchantTab>("overview");
  const [focusedKitchenId, setFocusedKitchenId] = useState<string | null>(null);

  useEffect(() => {
    const syncLocation = () => {
      const location = readMerchantLocation(window.location.search);
      setTab(location.tab);
      setFocusedKitchenId(location.designId);
    };

    syncLocation();
    window.addEventListener("popstate", syncLocation);
    return () => window.removeEventListener("popstate", syncLocation);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    setLoaded(false);
    setError(null);

    merchantRequest<{ store: Store | null }>("/api/merchant/store", owner, {
      signal: controller.signal,
    })
      .then((result) => {
        if (active) {
          setStore(result.store);
          setLoaded(true);
        }
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Дэлгүүрийг ачаалж чадсангүй.",
          );
        }
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [owner, refresh]);

  const changeTab = (next: MerchantTab) => {
    setTab(next);
    setFocusedKitchenId(null);

    window.history.pushState(
      window.history.state,
      "",
      merchantLocationPath(
        window.location.pathname,
        window.location.search,
        window.location.hash,
        next,
      ),
    );

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  const openKitchen = (designId?: string) => {
    setTab("kitchens");
    setFocusedKitchenId(designId ?? null);

    window.history.pushState(
      window.history.state,
      "",
      merchantLocationPath(
        window.location.pathname,
        window.location.search,
        window.location.hash,
        "kitchens",
        designId,
      ),
    );
  };

  return (
    <MerchantShell
      active={tab}
      onChange={changeTab}
      userName={userName}
      storeName={store?.name ?? "Миний дэлгүүр"}
      owner={owner}
      onOpenKitchen={openKitchen}
      hasStore={Boolean(store)}
    >
      {!loaded ? (
        error ? (
          <div className="merchant-load-state">
            <p role="alert" className="merchant-error">
              {error}
            </p>

            <button
              type="button"
              className="btn-ghost"
              onClick={() => setRefresh((value) => value + 1)}
            >
              <RefreshCw size={16} />
              Дахин оролдох
            </button>
          </div>
        ) : (
          <div className="merchant-load-state" role="status">
            Дэлгүүрийг ачаалж байна…
          </div>
        )
      ) : (
        <>
          {tab === "overview" && <MerchantAnalytics owner={owner} />}
          {tab === "overview" && (
            <MerchantOverview
              owner={owner}
              store={store}
              onProducts={() => changeTab("products")}
              onStore={() => changeTab("store")}
            />
          )}

          {tab === "store" && (
            <StoreProfile
              key={store?.id ?? "new"}
              owner={owner}
              store={store}
              onSave={(savedStore) => {
                setStore(savedStore);
                setTab("overview");
              }}
            />
          )}

          {tab === "products" && store && <MerchantProducts owner={owner} />}

          {tab === "orders" && store && <MerchantOrders owner={owner} />}

          {tab === "kitchens" && store && (
            <MerchantKitchenDesigns
              owner={owner}
              focusedDesignId={focusedKitchenId}
            />
          )}
        </>
      )}
    </MerchantShell>
  );
}
function MerchantOverview({
  owner,
  store,
  onProducts,
  onStore,
}: {
  owner: string;
  store: Store | null;
  onProducts: () => void;
  onStore: () => void;
}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(Boolean(store));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!store) {
      setProducts([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    let active = true;

    setLoading(true);
    setError(null);

    merchantRequest<{
      products: MerchantProduct[];
    }>("/api/merchant/products", owner, { signal: controller.signal })
      .then((result) => {
        if (active) {
          setProducts(result.products);
        }
      })
      .catch((reason) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Dashboard мэдээллийг ачаалж чадсангүй.",
          );
        }
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
  }, [owner, store]);

  if (!store) {
    return (
      <section className="merchant-empty-dashboard">
        <span className="merchant-overview-icon">
          <StoreIcon size={26} />
        </span>

        <h1>Дэлгүүрээ эхлээд бүртгэнэ үү</h1>

        <p>
          Дэлгүүрийн үндсэн мэдээллээ бүртгэсний дараа бүтээгдэхүүн, нөөц болон
          захиалгын dashboard идэвхжинэ.
        </p>

        <button type="button" className="btn-primary" onClick={onStore}>
          Дэлгүүр нээх
          <ArrowUpRight size={16} />
        </button>
      </section>
    );
  }

  const totalStock = products.reduce(
    (sum, product) => sum + Number(product.stockQuantity ?? 0),
    0,
  );

  const inventoryValue = products.reduce(
    (sum, product) =>
      sum + product.basePrice * Number(product.stockQuantity ?? 0),
    0,
  );

  const lowStock = products.filter(
    (product) => Number(product.stockQuantity ?? 0) <= 5,
  ).length;

  const categoryMap = new Map<Product["category"], number>();

  for (const product of products) {
    categoryMap.set(
      product.category,
      (categoryMap.get(product.category) ?? 0) + 1,
    );
  }

  const categories = [...categoryMap.entries()]
    .map(([category, count]) => ({
      category,
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const topProducts = [...products]
    .sort((a, b) => Number(b.stockQuantity ?? 0) - Number(a.stockQuantity ?? 0))
    .slice(0, 6);

  const maxStock = Math.max(
    1,
    ...topProducts.map((product) => Number(product.stockQuantity ?? 0)),
  );

  const colors = [
    "#2563eb",
    "#60a5fa",
    "#93c5fd",
    "#bfdbfe",
    "#dbeafe",
    "#e5e7eb",
  ];

  let cursor = 0;

  const donutStops = categories.length
    ? categories
        .map((item, index) => {
          const start = cursor;

          const share = (item.count / Math.max(1, products.length)) * 100;

          cursor += share;

          return `${colors[index % colors.length]} ${start}% ${cursor}%`;
        })
        .join(", ")
    : "#e5e7eb 0 100%";

  return (
    <section className="merchant-overview">
      <div className="merchant-overview-heading">
        <div>
          <span>Агуулах</span>
          <h2>Нөөцийн тойм</h2>
          <p>Бүтээгдэхүүн болон нөөцийн өнөөгийн мэдээлэл.</p>
        </div>

        <Link
          href={`/catalog/stores/${store.id}`}
          className="merchant-view-store"
        >
          Дэлгүүр үзэх
          <ArrowUpRight size={15} />
        </Link>
      </div>

      {error && (
        <p className="merchant-error" role="alert">
          {error}
        </p>
      )}

      <div className="merchant-kpis">
        <article className="merchant-kpi">
          <div className="merchant-kpi-icon">
            <WalletCards size={20} />
          </div>

          <div>
            <span>Нөөцийн үнэлгээ</span>
            <strong>{formatPrice(inventoryValue)}</strong>
            <small>Одоогийн нийт барааны үнэлгээ</small>
          </div>
        </article>

        <article className="merchant-kpi">
          <div className="merchant-kpi-icon">
            <Package size={20} />
          </div>

          <div>
            <span>Бүтээгдэхүүн</span>
            <strong>{loading ? "—" : products.length}</strong>
            <small>Нийт бүртгэлтэй бараа</small>
          </div>
        </article>

        <article className="merchant-kpi">
          <div className="merchant-kpi-icon">
            <Boxes size={20} />
          </div>

          <div>
            <span>Нийт нөөц</span>
            <strong>{loading ? "—" : totalStock}</strong>
            <small>Бэлэн байгаа ширхэг</small>
          </div>
        </article>

        <article className="merchant-kpi">
          <div className="merchant-kpi-icon warning">
            <CircleAlert size={20} />
          </div>

          <div>
            <span>Бага нөөцтэй</span>
            <strong>{loading ? "—" : lowStock}</strong>
            <small>5 болон түүнээс бага үлдэгдэл</small>
          </div>
        </article>
      </div>

      <div className="merchant-dashboard-grid">
        <article className="merchant-dashboard-card merchant-stock-chart">
          <header>
            <div>
              <h2>Нөөцийн төлөв</h2>
              <p>Нөөц хамгийн ихтэй бүтээгдэхүүнүүд</p>
            </div>

            <button type="button" onClick={onProducts}>
              Бүгдийг харах
              <ArrowUpRight size={14} />
            </button>
          </header>

          <div className="merchant-bars">
            {!topProducts.length ? (
              <div className="merchant-chart-empty">
                Бүтээгдэхүүн бүртгэгдээгүй байна.
              </div>
            ) : (
              topProducts.map((product) => {
                const stock = Number(product.stockQuantity ?? 0);

                return (
                  <div className="merchant-bar-row" key={product.id}>
                    <div className="merchant-bar-label">
                      <span>{product.name}</span>
                      <strong>{stock}</strong>
                    </div>

                    <div className="merchant-bar-track">
                      <span
                        style={{
                          width: `${Math.max(4, (stock / maxStock) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="merchant-dashboard-card merchant-category-card">
          <header>
            <div>
              <h2>Ангиллын бүтэц</h2>
              <p>Бүтээгдэхүүний ангиллаар</p>
            </div>
          </header>

          <div className="merchant-category-body">
            <div
              className="merchant-donut"
              style={{
                background: `conic-gradient(${donutStops})`,
              }}
            >
              <div>
                <strong>{products.length}</strong>
                <span>Бараа</span>
              </div>
            </div>

            <div className="merchant-category-legend">
              {categories.slice(0, 6).map((item, index) => (
                <div key={item.category}>
                  <span
                    className="merchant-legend-dot"
                    style={{
                      backgroundColor: colors[index % colors.length],
                    }}
                  />

                  <span>{CATEGORY_LABEL[item.category]}</span>

                  <strong>
                    {Math.round(
                      (item.count / Math.max(1, products.length)) * 100,
                    )}
                    %
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </article>
      </div>

      <article className="merchant-dashboard-card merchant-products-preview">
        <header>
          <div>
            <h2>Бүтээгдэхүүний тойм</h2>
            <p>Нөөц хамгийн ихтэй бүтээгдэхүүнүүд</p>
          </div>

          <button type="button" onClick={onProducts}>
            Бүх бүтээгдэхүүн
            <ArrowUpRight size={14} />
          </button>
        </header>

        <div className="merchant-preview-list">
          {topProducts.slice(0, 5).map((product) => (
            <div key={product.id}>
              <Image src={product.image} alt="" width={52} height={52} />

              <div>
                <strong>{product.name}</strong>
                <span>{CATEGORY_LABEL[product.category]}</span>
              </div>

              <span className="merchant-preview-price">
                {formatPrice(product.basePrice)}
              </span>

              <span className="merchant-preview-stock">
                {stockLabel(product)}
              </span>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}
function StoreProfile({
  owner,
  store,
  onSave,
}: {
  owner: string;
  store: Store | null;
  onSave: (store: Store) => void;
}) {
  const [draft, setDraft] = useState(() => ({
    name: store?.name ?? "",
    storeType: store?.storeType ?? "factory",
    city: store?.city ?? "Улаанбаатар",
    district: store?.district ?? "",
    address: store?.address ?? "",
    phone: store?.phone ?? "",
    description: store?.description ?? "",
    image: store?.image ?? "",
    categories: store?.categories ?? [],
  }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  function field<K extends keyof typeof draft>(
    key: K,
    value: (typeof draft)[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }
  return (
    <form
      className="merchant-panel"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setError(null);
        setSaved(false);
        if (!draft.categories.length) {
          setError("Хамгийн багадаа нэг барааны ангилал сонгоно уу.");
          return;
        }
        setBusy(true);
        try {
          const result = await merchantRequest<{ store: Store }>(
            "/api/merchant/store",
            owner,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(draft),
            },
          );
          onSave(result.store);
          setSaved(true);
        } catch (reason) {
          setError(
            reason instanceof Error ? reason.message : "Хадгалж чадсангүй.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{store ? "Дэлгүүрийн мэдээлэл" : "Дэлгүүрээ нээх"}</h2>
      <p>
        {store
          ? "Энэ мэдээлэл хэрэглэгчдэд таны дэлгүүрийн хуудсанд харагдана."
          : "Эхлээд дэлгүүрийн мэдээллээ бүртгээд бүтээгдэхүүнээ нэмээрэй."}
      </p>
      <fieldset disabled={busy}>
        <div className="merchant-form-grid">
          <label>
            Дэлгүүрийн нэр
            <input
              className="input"
              required
              maxLength={200}
              value={draft.name}
              onChange={(event) => field("name", event.target.value)}
            />
          </label>
          <label>
            Дэлгүүрийн төрөл
            <select
              className="input"
              value={draft.storeType}
              onChange={(event) =>
                field("storeType", event.target.value as typeof draft.storeType)
              }
            >
              {STORE_TYPES.map((type) => (
                <option key={type.id} value={type.id}>
                  {type.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Утас
            <input
              className="input"
              type="tel"
              required
              maxLength={40}
              value={draft.phone}
              onChange={(event) => field("phone", event.target.value)}
            />
          </label>
          <label>
            Хот, аймаг
            <input
              className="input"
              required
              maxLength={100}
              value={draft.city}
              onChange={(event) => field("city", event.target.value)}
            />
          </label>
          <label>
            Дүүрэг, сум
            <input
              className="input"
              maxLength={100}
              value={draft.district}
              onChange={(event) => field("district", event.target.value)}
            />
          </label>
          <label>
            Дэлгэрэнгүй хаяг
            <input
              className="input"
              required
              maxLength={500}
              value={draft.address}
              onChange={(event) => field("address", event.target.value)}
            />
          </label>
          <label className="merchant-span">
            Танилцуулга
            <textarea
              className="input"
              rows={4}
              maxLength={5000}
              value={draft.description}
              onChange={(event) => field("description", event.target.value)}
            />
          </label>
          <label className="merchant-span">
            Дэлгүүрийн зургийн холбоос · заавал биш
            <input
              className="input"
              placeholder="https://res.cloudinary.com/…"
              maxLength={2000}
              value={draft.image}
              onChange={(event) => field("image", event.target.value)}
            />
            <small>
              Cloudinary эсвэл Unsplash дээр байршуулсан HTTPS зургийн холбоос.
            </small>
          </label>
        </div>
        <fieldset className="mt-6">
          <legend className="text-sm font-medium">
            Худалдаалах барааны ангилал
          </legend>
          <div className="merchant-checks">
            {CATEGORIES.map((category) => (
              <label key={category.id}>
                <input
                  type="checkbox"
                  checked={draft.categories.includes(category.id)}
                  onChange={(event) =>
                    field(
                      "categories",
                      event.target.checked
                        ? [...draft.categories, category.id]
                        : draft.categories.filter((id) => id !== category.id),
                    )
                  }
                />
                {category.name}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="merchant-actions">
          <button className="btn-primary" disabled={busy}>
            <Save size={16} />
            {busy
              ? "Хадгалж байна…"
              : store
                ? "Өөрчлөлт хадгалах"
                : "Дэлгүүр нээх"}
          </button>
        </div>
      </fieldset>
      {error && (
        <p className="merchant-error" role="alert">
          {error}
        </p>
      )}
      {saved && (
        <p className="merchant-success" role="status">
          Дэлгүүрийн мэдээлэл хадгалагдлаа.
        </p>
      )}
    </form>
  );
}

function MerchantProducts({ owner }: { owner: string }) {
  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{
    product: MerchantProduct;
    create: boolean;
  } | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    merchantRequest<{ products: Product[] }>("/api/merchant/products", owner, {
      signal: controller.signal,
    })
      .then((result) => {
        if (active) setProducts(result.products);
      })
      .catch((reason) => {
        if (active) {
          setProducts([]);
          setError(
            reason instanceof Error
              ? reason.message
              : "Барааг ачаалж чадсангүй.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [owner, refresh]);
  if (editing)
    return (
      <MerchantProductEditor
        key={`${editing.create}-${editing.product.id}`}
        owner={owner}
        {...editing}
        close={() => setEditing(null)}
        onSave={() => {
          setEditing(null);
          setSaved(true);
          setRefresh((value) => value + 1);
          void useCatalogStore.getState().refresh(true);
        }}
      />
    );
  const filtered = products.filter((product) =>
    `${product.name} ${CATEGORY_LABEL[product.category]}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );
  return (
    <section>
      <div className="merchant-section-heading">
        <div>
          <h2 className="text-2xl">Миний бүтээгдэхүүн</h2>
          <p className="merchant-muted">{products.length} бараа</p>
        </div>
        <button
          className="btn-primary"
          onClick={() => {
            setSaved(false);
            setEditing({ product: blankProduct(), create: true });
          }}
        >
          <Plus size={18} />
          Бараа нэмэх
        </button>
      </div>
      <div className="merchant-search">
        <Search size={18} />
        <input
          className="input"
          aria-label="Өөрийн бараа хайх"
          placeholder="Барааны нэрээр хайх…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          className="btn-ghost"
          disabled={loading}
          onClick={() => setRefresh((value) => value + 1)}
          aria-label="Барааны жагсаалт шинэчлэх"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      {saved && (
        <p className="merchant-success" role="status">
          Бүтээгдэхүүн хадгалагдлаа.
        </p>
      )}
      {loading ? (
        <div className="merchant-state" role="status">
          Барааг ачаалж байна…
        </div>
      ) : error ? (
        <p className="merchant-error" role="alert">
          {error}
        </p>
      ) : !filtered.length ? (
        <div className="merchant-panel merchant-state">
          <Package size={32} />
          <h3>{query ? "Бараа олдсонгүй" : "Эхний бүтээгдэхүүнээ нэмээрэй"}</h3>
          <p>
            {query
              ? "Хайх үгээ өөрчилж дахин оролдоорой."
              : "Барааны зураг, үнэ, хэмжээ, нөөцөө оруулж худалдаагаа эхлүүлээрэй."}
          </p>
        </div>
      ) : (
        <div className="merchant-products">
          {filtered.map((product) => (
            <article className="merchant-product" key={product.id}>
              <Image src={product.image} alt="" width={76} height={76} />
              <div className="merchant-product-info">
                <h3>{product.name}</h3>
                <p>
                  {CATEGORY_LABEL[product.category]} · {stockLabel(product)}
                </p>
              </div>
              <strong className="merchant-product-price">
                {formatPrice(product.basePrice)}
              </strong>
              <button
                className="btn-ghost"
                aria-label={`${product.name} засах`}
                onClick={() => {
                  setSaved(false);
                  setEditing({ product, create: false });
                }}
              >
                <Pencil size={15} />
                Засах
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function MerchantProductEditor({
  owner,
  product,
  create,
  close,
  onSave,
}: {
  owner: string;
  product: MerchantProduct;
  create: boolean;
  close: () => void;
  onSave: () => void;
}) {
  const [draft, setDraft] = useState(product);

  const [imageFile, setImageFile] = useState<File | null>(null);

  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);

  const [modelRequested, setModelRequested] = useState(
    Boolean(product.modelRequested),
  );

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);
  function field<K extends keyof Product>(key: K, value: Product[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }
  async function uploadImage(file: File) {
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size === 0 ||
      file.size > 3 * 1024 * 1024
    ) {
      throw new Error(
        "JPG, PNG эсвэл WebP зураг сонгоно уу. Хэмжээ 3 MB хүртэл.",
      );
    }

    const form = new FormData();
    form.set("file", file);

    const response = await authFetch(
      "/api/merchant/images",
      {
        method: "POST",
        body: form,
      },
      owner,
    );

    const data = await response.json().catch(() => null);

    if (!response.ok || typeof data?.url !== "string") {
      throw new Error(data?.error ?? "Зургийг оруулж чадсангүй.");
    }

    if (!isOwner(owner)) {
      throw new Error("Merchant нэвтрэлт өөрчлөгдсөн байна.");
    }

    return data.url as string;
  }
  return (
    <form
      className="merchant-panel"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;
        setError(null);
        setBusy(true);
        try {
          if ((draft.images?.length ?? 0) + galleryFiles.length > 12) {
            throw new Error("Нэмэлт зураг 12-оос олонгүй байна.");
          }

          let image = draft.image;

          if (imageFile) {
            image = await uploadImage(imageFile);
          }

          if (!image) {
            throw new Error("Үндсэн зураг сонгоно уу.");
          }

          const uploadedGallery = await Promise.all(
            galleryFiles.map(uploadImage),
          );

          const images = [
            ...new Set([...(draft.images ?? []), ...uploadedGallery]),
          ].filter((url) => url !== image);

          const parsed = parseProduct({
            ...draft,
            image,
            images,
          });

          await merchantRequest<{ id: string }>(
            "/api/merchant/products",
            owner,
            {
              method: create ? "POST" : "PUT",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                ...parsed,
                modelRequested,
                expectedStockQuantity: product.stockQuantity ?? null,
              }),
            },
          );
          onSave();
        } catch (reason) {
          setError(
            reason instanceof Error
              ? reason.message
              : "Барааг хадгалж чадсангүй.",
          );
        } finally {
          setBusy(false);
        }
      }}
    >
      <button
        type="button"
        className="btn-ghost mb-4"
        disabled={busy}
        onClick={close}
      >
        <ArrowLeft size={15} />
        Бүтээгдэхүүн рүү буцах
      </button>
      <h2>{create ? "Бараа нэмэх" : "Бүтээгдэхүүн засах"}</h2>
      <fieldset disabled={busy}>
        <div className="merchant-form-grid">
          <label>
            Барааны нэр
            <input
              className="input"
              required
              maxLength={200}
              value={draft.name}
              onChange={(event) => field("name", event.target.value)}
            />
          </label>
          <label>
            Барааны ангилал
            <select
              className="input"
              value={draft.category}
              onChange={(event) =>
                field("category", event.target.value as Product["category"])
              }
            >
              {CATEGORIES.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Үндсэн үнэ (₮)
            <input
              className="input"
              type="number"
              required
              min={0}
              max={Number.MAX_SAFE_INTEGER}
              step={1}
              value={draft.basePrice}
              onChange={(event) =>
                field("basePrice", event.target.valueAsNumber)
              }
            />
          </label>
          <label>
            Нөөцийн үлдэгдэл (ширхэг)
            <input
              className="input"
              type="number"
              required
              min={0}
              max={MAX_STOCK_QUANTITY}
              step={1}
              value={draft.stockQuantity ?? ""}
              onChange={(event) =>
                field("stockQuantity", event.target.valueAsNumber)
              }
            />
            <small>
              Өнгө, материалын бүх сонголтын нийт нөөц. Дууссан бол 0.
            </small>
          </label>
          <div className="merchant-span merchant-image-upload">
            <label>
              Үндсэн зураг
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  setImageFile(event.target.files?.[0] ?? null)
                }
              />
              <span className="merchant-upload-button">
                <ImagePlus size={18} />

                {imageFile
                  ? imageFile.name
                  : draft.image
                    ? "Зураг солих"
                    : "Зураг сонгох"}
              </span>
            </label>

            {(imageFile || draft.image) && (
              <div className="merchant-image-preview">
                <Image
                  src={imageFile ? URL.createObjectURL(imageFile) : draft.image}
                  alt=""
                  width={160}
                  height={120}
                />
              </div>
            )}
          </div>
          <div className="merchant-span merchant-image-upload">
            <label>
              Нэмэлт зургууд
              <input
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  setGalleryFiles(
                    Array.from(event.target.files ?? []).slice(0, 12),
                  )
                }
              />
              <span className="merchant-upload-button">
                <ImagePlus size={18} />
                Нэмэлт зураг сонгох
              </span>
            </label>

            <small>JPG, PNG, WebP · 3 MB хүртэл · нийт 12 зураг</small>

            {!!draft.images?.length && (
              <div className="merchant-gallery-preview">
                {draft.images.map((url) => (
                  <div key={url}>
                    <Image src={url} alt="" width={90} height={70} />

                    <button
                      type="button"
                      onClick={() =>
                        field(
                          "images",
                          draft.images?.filter((item) => item !== url) ?? [],
                        )
                      }
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
          <label className="merchant-span">
            Тайлбар
            <textarea
              className="input"
              maxLength={10000}
              rows={4}
              value={draft.description}
              onChange={(event) => field("description", event.target.value)}
            />
          </label>
          <div className="merchant-span merchant-dimensions">
            {(
              [
                ["w", "Өргөн"],
                ["d", "Гүн"],
                ["h", "Өндөр"],
              ] as const
            ).map(([key, label]) => (
              <label key={key}>
                {label} (мм)
                <input
                  className="input"
                  type="number"
                  required
                  min={1}
                  max={100000}
                  step={1}
                  value={
                    Number.isFinite(draft.dimensions[key])
                      ? Math.round(draft.dimensions[key] * 1000)
                      : ""
                  }
                  onChange={(event) =>
                    field("dimensions", {
                      ...draft.dimensions,
                      [key]: event.target.valueAsNumber / 1000,
                    })
                  }
                />
              </label>
            ))}
          </div>
        </div>

        <div className="merchant-span merchant-3d-request">
          <label>
            <input
              type="checkbox"
              checked={modelRequested}
              onChange={(event) => setModelRequested(event.target.checked)}
            />

            <span>
              <strong>3D загварт оруулах хүсэлт</strong>

              <small>
                Манай баг тухайн барааг scan хийж, 3D planner-д ашиглах GLB
                загвар бэлдэнэ.
              </small>
            </span>
          </label>

          {modelRequested && (
            <p>
              <Box size={15} />
              Хүсэлт Admin → 3D Models → Requests хэсэгт харагдана.
            </p>
          )}
        </div>

        {create ? (
          <div className="merchant-form-grid">
            <label>
              Үндсэн өнгөний нэр
              <input
                className="input"
                required
                maxLength={200}
                value={draft.colors[0].name}
                onChange={(event) =>
                  field("colors", [
                    { ...draft.colors[0], name: event.target.value },
                  ])
                }
              />
            </label>
            <label>
              Өнгө
              <input
                type="color"
                className="h-11 w-full"
                value={draft.colors[0].hex}
                onChange={(event) =>
                  field("colors", [
                    { ...draft.colors[0], hex: event.target.value },
                  ])
                }
              />
            </label>
            <label>
              Материал
              <select
                className="input"
                value={draft.materials[0].id}
                onChange={(event) =>
                  field("materials", [
                    {
                      id: event.target
                        .value as Product["materials"][number]["id"],
                      name: event.target.selectedOptions[0].text,
                      priceDelta: 0,
                    },
                  ])
                }
              >
                <option value="wood">Мод</option>
                <option value="metal">Металл</option>
                <option value="fabric">Даавуу</option>
                <option value="leather">Арьс</option>
                <option value="velvet">Хилэн</option>
              </select>
            </label>
          </div>
        ) : (
          <p className="merchant-muted mt-5">
            Өнгө: {draft.colors.map((color) => color.name).join(", ")} ·
            Материал:{" "}
            {draft.materials.map((material) => material.name).join(", ")}
          </p>
        )}
        <div className="merchant-actions">
          <button className="btn-primary" disabled={busy}>
            <Save size={16} />
            {busy ? "Хадгалж байна…" : "Хадгалах"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={busy}
            onClick={close}
          >
            Болих
          </button>
        </div>
      </fieldset>
      {error && (
        <p className="merchant-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
