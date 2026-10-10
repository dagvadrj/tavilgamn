"use client";

import { useDraftState } from "@/hooks/useDashboardDraft";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Archive,
  Package,
  Pencil,
  Info,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { CATEGORY_LABEL } from "@/lib/products";
import { formatPrice } from "@/lib/format";
import { stockLabel } from "@/lib/inventory";
import { useCatalogStore } from "@/store/catalog";
import {
  type MerchantProduct,
  blankProduct,
  merchantRequest,
} from "@/features/merchant/merchantApi";
import { MerchantProductEditor } from "@/features/merchant/MerchantProductEditor";
import { ProductDetails } from "@/features/admin-products/ProductDetails";

export function MerchantProducts({
  owner,
  initialCreate = false,
  onCreateOpened,
}: {
  owner: string;
  initialCreate?: boolean;
  onCreateOpened?: () => void;
}) {
  const [products, setProducts] = useState<MerchantProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useDraftState<{
    product: MerchantProduct;
    create: boolean;
  } | null>(`merchant:${owner}:products-navigation`, "editing", null);
  const [saved, setSaved] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  useEffect(() => {
    if (!initialCreate) return;
    setSaved(false);
    setEditing({ product: blankProduct(), create: true });
    onCreateOpened?.();
  }, [initialCreate, onCreateOpened, setEditing]);
  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    merchantRequest<{ products: MerchantProduct[] }>(
      `/api/merchant/products${includeArchived ? "?archived=1" : ""}`,
      owner,
      {
        signal: controller.signal,
      },
    )
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
  }, [owner, refresh, includeArchived]);
  if (detailsId)
    return (
      <ProductDetails
        key={detailsId}
        productId={detailsId}
        owner={owner}
        scope="merchant"
        close={() => setDetailsId(null)}
      />
    );
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
      <label className="merchant-muted flex items-center gap-2 mb-4">
        <input
          type="checkbox"
          checked={includeArchived}
          onChange={(event) => setIncludeArchived(event.target.checked)}
        />
        Архивласан барааг хамт харах
      </label>
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
              <Image
                src={product.image}
                alt={product.name}
                width={76}
                height={76}
                sizes="60px"
              />
              <div className="merchant-product-info">
                <h3>{product.name}</h3>
                <p>
                  {CATEGORY_LABEL[product.category]} ·{" "}
                  {product.archivedAt ? "Архивласан" : stockLabel(product)}
                </p>
              </div>
              <strong className="merchant-product-price">
                {formatPrice(product.basePrice)}
              </strong>
              <button
                className="btn-ghost"
                disabled={
                  Boolean(product.archivedAt) || archiveBusy === product.id
                }
                aria-label={`${product.name} засах`}
                onClick={() => {
                  setSaved(false);
                  setEditing({ product, create: false });
                }}
              >
                <Pencil size={15} />
                Засах
              </button>
              <button
                type="button"
                className="btn-ghost"
                aria-label={`${product.name} дэлгэрэнгүй`}
                onClick={() => setDetailsId(product.id)}
              >
                <Info size={15} /> Дэлгэрэнгүй
              </button>
              <button
                type="button"
                className="btn-ghost"
                disabled={archiveBusy === product.id}
                aria-label={`${product.name} ${product.archivedAt ? "сэргээх" : "архивлах"}`}
                onClick={async () => {
                  if (
                    !product.archivedAt &&
                    !window.confirm(
                      "Барааг худалдаанаас түр нууж архивлах уу? Зураг, 3D болон захиалгын түүх устахгүй.",
                    )
                  )
                    return;
                  setArchiveBusy(product.id);
                  setError(null);
                  try {
                    await merchantRequest(
                      `/api/merchant/products/${encodeURIComponent(product.id)}`,
                      owner,
                      {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ archived: !product.archivedAt }),
                      },
                    );
                    setRefresh((value) => value + 1);
                    void useCatalogStore.getState().refresh(true);
                  } catch (reason) {
                    setError(
                      reason instanceof Error
                        ? reason.message
                        : "Архивлаж чадсангүй.",
                    );
                  } finally {
                    setArchiveBusy(null);
                  }
                }}
              >
                <Archive size={15} />{" "}
                {product.archivedAt ? "Сэргээх" : "Архивлах"}
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
