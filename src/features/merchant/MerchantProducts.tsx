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
  Upload,
  Download,
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
import { useMerchantResource } from "./useMerchantResource";
import { StatSkeleton } from "./MerchantStats";
import { ProductDetails } from "@/features/admin-products/ProductDetails";
import {
  MadeToOrderSwitch,
  ProductQrButton,
  ModelRequestButton,
} from "./MerchantShowroom";
import { MerchantGlbDownload } from "./MerchantGlbDownload";
import dynamic from "next/dynamic";
import { CATEGORIES } from "@/lib/catalogCategories";
import { merchantDownload } from "./merchantDownload";
import "./merchant-commerce.css";
const MerchantProductImport = dynamic(() =>
  import("./MerchantProductImport").then((m) => m.MerchantProductImport),
);

export function MerchantProducts({
  owner,
  initialCreate = false,
  onCreateOpened,
}: {
  owner: string;
  initialCreate?: boolean;
  onCreateOpened?: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useDraftState<{
    product: MerchantProduct;
    create: boolean;
  } | null>(`merchant:${owner}:products-navigation`, "editing", null);
  const [saved, setSaved] = useState(false);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [archiveBusy, setArchiveBusy] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [category, setCategory] = useState("");
  const [importing, setImporting] = useState(false);
  const [exportBusy, setExportBusy] = useState("");
  useEffect(() => {
    if (!initialCreate) return;
    setSaved(false);
    setEditing({ product: blankProduct(), create: true });
    onCreateOpened?.();
  }, [initialCreate, onCreateOpened, setEditing]);
  const resource = useMerchantResource<{ products: MerchantProduct[] }>(
    owner,
    `/api/merchant/products${includeArchived ? "?archived=1" : ""}`,
    !editing,
    60000,
  );
  const products = resource.data?.products ?? [],
    loading = !resource.data && !resource.error;
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
          resource.refresh();
          void useCatalogStore.getState().refresh(true);
        }}
      />
    );
  const filtered = products.filter(
    (product) =>
      (!category || product.category === category) &&
      product.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  return (
    <section>
      <div className="merchant-section-heading">
        <div>
          <h2 className="text-2xl">Миний бүтээгдэхүүн</h2>
          <p className="merchant-muted">{products.length} бараа</p>
        </div>
        <div className="merchant-commerce-toolbar">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setImporting(true)}
          >
            <Upload size={16} /> Excel импорт
          </button>
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
      </div>
      {importing && (
        <MerchantProductImport
          owner={owner}
          onClose={() => setImporting(false)}
          onImported={() => {
            resource.refresh();
            void useCatalogStore.getState().refresh(true);
          }}
        />
      )}
      <div className="merchant-search">
        <Search size={18} />
        <input
          className="input"
          type="search"
          aria-label="Өөрийн бараа хайх"
          placeholder="Барааны нэрээр хайх…"
          value={query}
          maxLength={100}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          className="btn-ghost"
          disabled={loading}
          onClick={resource.refresh}
          aria-label="Барааны жагсаалт шинэчлэх"
        >
          <RefreshCw size={16} />
        </button>
      </div>
      <div className="merchant-commerce-toolbar mb-4">
        <label>
          Ангилал
          <select
            className="input"
            aria-label="Барааны ангилал"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Бүх ангилал</option>
            {CATEGORIES.filter((c) => c.id !== "kitchen-cabinet").map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        {(["xlsx", "pdf"] as const).map((format) => (
          <button
            key={format}
            type="button"
            className="btn-ghost"
            disabled={!!exportBusy || loading}
            onClick={async () => {
              setError(null);
              setExportBusy(format);
              try {
                const params = new URLSearchParams({
                  format,
                  category,
                  search: query.trim(),
                });
                if (includeArchived) params.set("archived", "1");
                await merchantDownload(
                  "/api/merchant/products/export?" + params,
                  owner,
                  `baraa-${category || "all"}.${format}`,
                );
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Экспорт амжилтгүй боллоо.",
                );
              } finally {
                setExportBusy("");
              }
            }}
          >
            <Download size={16} />
            {exportBusy === format
              ? "Үүсгэж байна…"
              : format === "xlsx"
                ? "Excel экспорт"
                : "PDF экспорт"}
          </button>
        ))}
        <span className="merchant-muted">
          {filtered.length} бараа · Экспорт энэ шүүлтүүрээр гарна
        </span>
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
          <StatSkeleton rows={5} />
        </div>
      ) : error || resource.error ? (
        <p className="merchant-error" role="alert">
          {error || resource.error}
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
            <article
              className="merchant-product merchant-showroom-product"
              key={product.id}
            >
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
              <MadeToOrderSwitch owner={owner} product={product} />
              <div className="merchant-product-actions">
                <ProductQrButton owner={owner} product={product} />
                <ModelRequestButton
                  owner={owner}
                  product={product}
                  onEdit={() => setEditing({ product, create: false })}
                />
                {product.model && !product.archivedAt && (
                  <MerchantGlbDownload owner={owner} productId={product.id} />
                )}
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
                          body: JSON.stringify({
                            archived: !product.archivedAt,
                          }),
                        },
                      );
                      resource.refresh();
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
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
