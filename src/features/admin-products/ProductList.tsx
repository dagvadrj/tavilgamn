"use client";

import { useDraftState } from "@/hooks/useDashboardDraft";
import { useEffect, useState } from "react";
import Image from "next/image";
import {
  Search,
  RefreshCw,
  Plus,
  Pencil,
  Info,
  Box,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { Product, Store } from "@/lib/types";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/products";
import { useCatalog } from "@/store/catalog";
import { authFetch } from "@/lib/authFetch";
import { formatPrice } from "@/lib/format";
import { CatalogStatus } from "@/components/CatalogStatus";
import { stockLabel } from "@/lib/inventory";
import { blank, ProductEditor } from "@/features/admin-products/ProductEditor";
import { ProductDetails } from "@/features/admin-products/ProductDetails";

export function ProductList({
  owner,
  onAddModel,
  initialProductId,
  onProductOpened,
}: {
  owner: string;
  onAddModel: () => void;
  initialProductId?: string | null;
  onProductOpened?: () => void;
}) {
  const catalog = useCatalog();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState("");
  const [page, setPage] = useState(1);
  const [storeId, setStoreId] = useState("");
  const [stores, setStores] = useState<Store[]>([]);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [editing, setEditing] = useDraftState<{
    product: Product;
    create: boolean;
  } | null>(`admin:${owner}:products-navigation`, "editing", null);
  useEffect(() => {
    if (!initialProductId || !catalog.ready) {
      return;
    }

    const product = catalog.products.find(
      (item) => item.id === initialProductId,
    );

    if (product) {
      setEditing({
        product,
        create: false,
      });
      onProductOpened?.();
    }
  }, [
    initialProductId,
    catalog.ready,
    catalog.products,
    setEditing,
    onProductOpened,
  ]);
  useEffect(() => {
    const controller = new AbortController();

    authFetch(
      "/api/admin/stores",
      {
        signal: controller.signal,
      },
      owner,
    )
      .then(async (response) => {
        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error ?? "Дэлгүүрүүдийг ачаалж чадсангүй.");
        }

        return data;
      })
      .then((data) => {
        if (!controller.signal.aborted) {
          setStores(Array.isArray(data?.stores) ? data.stores : []);
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setStores([]);
        }
      });

    return () => controller.abort();
  }, [owner]);

  const storeMap = new Map(stores.map((store) => [store.id, store.name]));

  const storeNames = (product: Product) => {
    const ids = product.storeIds ?? [];

    if (!ids.length) {
      return "Дэлгүүр оноогоогүй";
    }

    return ids.map((id) => storeMap.get(id) ?? id).join(", ");
  };

  const filtered = catalog.products.filter(
    (product) =>
      (!storeId || product.storeIds?.includes(storeId)) &&
      (!category || product.category === category) &&
      (!stock ||
        (stock === "available" ? product.inStock : !product.inStock)) &&
      `${product.name} ${
        CATEGORY_LABEL[product.category]
      } ${storeNames(product)}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
  );

  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages);
  const items = filtered.slice((currentPage - 1) * 20, currentPage * 20);

  if (detailsId)
    return (
      <ProductDetails
        key={detailsId}
        productId={detailsId}
        owner={owner}
        scope="admin"
        close={() => setDetailsId(null)}
      />
    );
  if (editing)
    return (
      <ProductEditor
        key={editing.create + "-" + editing.product.id}
        owner={owner}
        product={editing.product}
        create={editing.create}
        close={() => setEditing(null)}
      />
    );

  return (
    <div>
      <div className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">БАРААНЫ УДИРДЛАГА</span>
          <h1>Бүтээгдэхүүн</h1>
          <p>
            {catalog.ready
              ? catalog.products.length +
                " бүтээгдэхүүн · Үнэ, нөөц, сонголтуудаа удирдах."
              : "Барааны мэдээлэл"}
          </p>
        </div>
        <div className="admin-actions">
          <button type="button" className="btn-ghost" onClick={onAddModel}>
            <Box size={16} />
            3D загвар
          </button>
          <button
            type="button"
            className="btn-primary"
            onClick={() => setEditing({ product: blank(), create: true })}
          >
            <Plus size={17} />
            Бараа нэмэх
          </button>
        </div>
      </div>
      <>
        <div className="admin-toolbar">
          <label className="admin-search">
            <Search size={18} />
            <input
              aria-label="Бүтээгдэхүүн хайх"
              placeholder="Барааны нэрээр хайх…"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(1);
              }}
            />
          </label>
          <select
            className="input"
            aria-label="Дэлгүүрээр шүүх"
            value={storeId}
            onChange={(event) => {
              setStoreId(event.target.value);

              setPage(1);
            }}
          >
            <option value="">Бүх дэлгүүр</option>

            {stores.map((store) => (
              <option key={store.id} value={store.id}>
                {store.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            aria-label="Барааны ангилал"
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Бүх ангилал</option>
            {CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select
            className="input"
            aria-label="Нөөцийн төлөв"
            value={stock}
            onChange={(e) => {
              setStock(e.target.value);
              setPage(1);
            }}
          >
            <option value="">Бүх нөөц</option>
            <option value="available">Нөөцтэй</option>
            <option value="empty">Дууссан</option>
          </select>
          <button
            type="button"
            disabled={catalog.loading}
            className="btn-ghost"
            onClick={() => void catalog.refresh()}
            aria-label="Бүтээгдэхүүн шинэчлэх"
          >
            <RefreshCw size={16} />
          </button>
        </div>
        {catalog.loading || !catalog.ready ? (
          <CatalogStatus
            loading={catalog.loading}
            error={catalog.error}
            retry={() => void catalog.refresh()}
          />
        ) : (
          <>
            <p className="admin-result-count">
              {filtered.length} илэрц
              {(query || storeId || category || stock) && (
                <button
                  type="button"
                  className="ml-3 min-h-10 underline"
                  onClick={() => {
                    setQuery("");
                    setStoreId("");
                    setCategory("");
                    setStock("");
                    setPage(1);
                  }}
                >
                  Шүүлтүүр арилгах
                </button>
              )}
            </p>
            {!items.length ? (
              <div className="admin-empty">
                <Box size={30} />
                <strong>Бүтээгдэхүүн олдсонгүй</strong>
                <p>Хайх үг эсвэл шүүлтүүрээ өөрчлөөрэй.</p>
              </div>
            ) : (
              <div className="admin-panel">
                <table className="admin-data-table">
                  <thead>
                    <tr>
                      {[
                        "Бүтээгдэхүүн",
                        "Дэлгүүр",
                        "Ангилал",
                        "Үндсэн үнэ",
                        "Нөөц",
                        "Үйлдэл",
                      ].map((label) => (
                        <th key={label} scope="col">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((product) => (
                      <tr key={product.id}>
                        <td data-label="Бүтээгдэхүүн">
                          <div className="admin-product-name">
                            <Image
                              src={product.image}
                              alt=""
                              width={48}
                              height={48}
                            />
                            <div>
                              <strong>{product.name}</strong>
                              <small>
                                {product.model
                                  ? "3D загвартай"
                                  : "Энгийн бүтээгдэхүүн"}
                                {product.isNew
                                  ? " · Шинэ"
                                  : product.isBestSeller
                                    ? " · Онцлох"
                                    : ""}
                              </small>
                            </div>
                          </div>
                        </td>
                        <td data-label="Дэлгүүр">
                          <span className="admin-product-store">
                            {storeNames(product)}
                          </span>
                        </td>
                        <td data-label="Ангилал">
                          {CATEGORY_LABEL[product.category]}
                        </td>
                        <td data-label="Үнэ">
                          <span className="whitespace-nowrap font-medium tabular-nums">
                            {formatPrice(product.basePrice)}
                          </span>
                        </td>
                        <td data-label="Нөөц">
                          <span
                            className={
                              "admin-status " + (!product.inStock ? "low" : "")
                            }
                          >
                            {stockLabel(product)}
                          </span>
                        </td>
                        <td className="admin-row-action">
                          <div className="product-list-actions">
                            <button
                              type="button"
                              className="admin-edit-button"
                              aria-label={product.name + " засах"}
                              onClick={() =>
                                setEditing({ product, create: false })
                              }
                            >
                              <Pencil size={13} />
                              Засах
                            </button>
                            <button
                              type="button"
                              className="admin-edit-button"
                              aria-label={product.name + " дэлгэрэнгүй"}
                              onClick={() => setDetailsId(product.id)}
                            >
                              <Info size={13} /> Дэлгэрэнгүй
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <nav className="admin-pagination" aria-label="Барааны хуудаслалт">
              <span aria-live="polite">
                Хуудас {currentPage} / {pages}
              </span>
              <button
                type="button"
                disabled={currentPage === 1}
                onClick={() => setPage(currentPage - 1)}
              >
                <ChevronLeft size={14} />
                Өмнөх
              </button>
              <button
                type="button"
                disabled={currentPage === pages}
                onClick={() => setPage(currentPage + 1)}
              >
                Дараах
                <ChevronRight size={14} />
              </button>
            </nav>
          </>
        )}
      </>
    </div>
  );
}
