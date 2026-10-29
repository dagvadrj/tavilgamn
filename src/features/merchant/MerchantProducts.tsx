"use client";

import { useDraftState } from "@/hooks/useDashboardDraft";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Archive,
  Download,
  FileSpreadsheet,
  ImageOff,
  Info,
  MoreHorizontal,
  Package,
  Pencil,
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
  missingImage,
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
const ProductImportFlow = dynamic(() =>
  import("@/features/dashboard/ProductImportFlow").then(
    (m) => m.ProductImportFlow,
  ),
);
const MerchantMissingImages = dynamic(() =>
  import("./MerchantMissingImages").then((m) => m.MerchantMissingImages),
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
  const [screen, setScreen] = useState<"list" | "import" | "images">("list");
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
    !editing && screen === "list",
    60000,
  );
  const products = resource.data?.products ?? [],
    loading = !resource.data && !resource.error;
  const refreshAll = () => {
    resource.refresh();
    void useCatalogStore.getState().refresh(true);
  };
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
          refreshAll();
        }}
      />
    );
  if (screen === "import")
    return (
      <ProductImportFlow
        owner={owner}
        endpoint="/api/merchant/products/import"
        existingNames={products.map((product) => product.name)}
        onImported={refreshAll}
        onClose={() => setScreen("list")}
        onMissingImages={() => setScreen("images")}
      />
    );
  if (screen === "images")
    return (
      <MerchantMissingImages
        owner={owner}
        products={products}
        onSaved={refreshAll}
        onClose={() => setScreen("list")}
      />
    );
  const missingImages = products.filter(missingImage).length;
  const filtered = products.filter(
    (product) =>
      (!category || product.category === category) &&
      product.name.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const exportProducts = async (format: "xlsx" | "pdf") => {
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
      setError(e instanceof Error ? e.message : "Экспорт амжилтгүй боллоо.");
    } finally {
      setExportBusy("");
    }
  };
  const startCreate = () => {
    setSaved(false);
    setEditing({ product: blankProduct(), create: true });
  };
  return (
    <section>
      <div className="merchant-section-heading">
        <div>
          <h2 className="text-2xl">Миний бүтээгдэхүүн</h2>
          <p className="merchant-muted">{products.length} бараа</p>
        </div>
      </div>
      <div className="dashboard-choice-grid" role="group" aria-label="Бараа нэмэх арга">
        <button type="button" className="dashboard-choice is-primary" onClick={() => setScreen("import")}>
          <FileSpreadsheet size={26} aria-hidden="true" />
          <strong>Excel-ээр оруулах</strong>
          <small>Олон барааг нэг дор · хамгийн хурдан</small>
        </button>
        <button type="button" className="dashboard-choice" onClick={startCreate}>
          <Plus size={26} aria-hidden="true" />
          <strong>Нэг бүтээгдэхүүн нэмэх</strong>
          <small>Зураг, үнэ, хэмжээг гараар бөглөнө</small>
        </button>
        {missingImages > 0 && (
          <button type="button" className="dashboard-choice is-warning" onClick={() => setScreen("images")}>
            <ImageOff size={26} aria-hidden="true" />
            <strong>Зураг дутуу · {missingImages}</strong>
            <small>Олон зургийг нэрээр нь автоматаар холбоно</small>
          </button>
        )}
      </div>
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
        <label className="merchant-muted flex items-center gap-2">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(event) => setIncludeArchived(event.target.checked)}
          />
          Архивласныг харах
        </label>
        <details className="dashboard-menu">
          <summary className="btn-ghost">
            <Download size={16} /> {exportBusy ? "Үүсгэж байна…" : "Экспорт"}
          </summary>
          <div className="dashboard-menu-list">
            <button type="button" disabled={!!exportBusy || loading} onClick={() => void exportProducts("xlsx")}>
              Excel ({filtered.length} бараа)
            </button>
            <button type="button" disabled={!!exportBusy || loading} onClick={() => void exportProducts("pdf")}>
              PDF ({filtered.length} бараа)
            </button>
          </div>
        </details>
      </div>
      {saved && (
        <p className="merchant-success" role="status">
          Бүтээгдэхүүн хадгалагдлаа.
        </p>
      )}
      {(error || resource.error) && (
        <p className="merchant-error" role="alert">
          {error || resource.error}
        </p>
      )}
      {loading ? (
        <div className="merchant-state" role="status">
          <StatSkeleton rows={5} />
        </div>
      ) : !filtered.length ? (
        <div className="merchant-panel merchant-state">
          <Package size={32} />
          <h3>{query || category ? "Бараа олдсонгүй" : "Эхний бараагаа Excel-ээр оруулъя"}</h3>
          <p>
            {query || category
              ? "Хайх үг эсвэл ангиллаа өөрчилж дахин оролдоорой."
              : "Excel загвар татаж бөглөөд, бүх бараагаа нэг дор оруулна."}
          </p>
          {!query && !category && (
            <button type="button" className="btn-primary" onClick={() => setScreen("import")}>
              <FileSpreadsheet size={16} /> Excel template татаж эхлэх
            </button>
          )}
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
                <details className="dashboard-menu">
                  <summary className="btn-ghost" aria-label={`${product.name}: бусад үйлдэл`}>
                    <MoreHorizontal size={16} />
                  </summary>
                  <div className="dashboard-menu-list">
                    <button
                      type="button"
                      aria-label={`${product.name} дэлгэрэнгүй`}
                      onClick={() => setDetailsId(product.id)}
                    >
                      <Info size={15} /> Дэлгэрэнгүй
                    </button>
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
                      type="button"
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
                          refreshAll();
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
                </details>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
