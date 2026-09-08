"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Search, RefreshCw, Plus, Pencil, Box, ChevronLeft, ChevronRight, ArrowLeft, Save } from "lucide-react";
import type { Product, Material } from "@/lib/types";
import { CATEGORIES, CATEGORY_LABEL } from "@/lib/products";
import { STORES } from "@/lib/stores";
import { useAuth } from "@/store/auth";
import { useCatalog, useCatalogStore } from "@/store/catalog";
import { authFetch } from "@/lib/authFetch";
import { formatPrice } from "@/lib/format";
import { CatalogStatus } from "./CatalogStatus";

import { stockLabel, MAX_STOCK_QUANTITY } from "@/lib/inventory";

const blank = (): Product => ({
  id: "new",
  name: "",
  category: "sofa",
  description: "",
  image: "",
  basePrice: 0,
  rating: 0,
  reviewCount: 0,
  defaultColor: "oak",
  colors: [
    {
      id: "oak",
      name: "Байгалийн царс",
      hex: "#C9A37A",
      priceDelta: 0,
    },
  ],
  materials: [{ id: "wood", name: "Мод", priceDelta: 0 }],
  dimensions: { w: 1, d: 1, h: 1 },
  stockQuantity: 0,
  inStock: false,
  isNew: false,
  isBestSeller: false,
  storeIds: [],
});

const materialNames: Record<Material, string> = {
  wood: "Мод",
  metal: "Металл",
  fabric: "Даавуу",
  leather: "Арьс",
  velvet: "Хилэн",
};

export function AdminProducts({ onAddModel }: { onAddModel: () => void }) {
  const userId = useAuth((state) => state.user?.id);
  const role = useAuth((state) => state.role);

  if (!userId || role !== "admin") return null;

  return <ProductList key={userId} owner={userId} onAddModel={onAddModel} />;
}

function ProductList({
  owner,
  onAddModel,
}: {
  owner: string;
  onAddModel: () => void;
}) {
  const catalog = useCatalog();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [stock, setStock] = useState("");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<{
    product: Product;
    create: boolean;
  } | null>(null);

  const filtered = catalog.products.filter((product) =>
    (!category || product.category === category) &&
    (!stock || (stock === "available" ? product.inStock : !product.inStock)) &&
    `${product.name} ${CATEGORY_LABEL[product.category]}`
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  );

  const pages = Math.max(1, Math.ceil(filtered.length / 20));
  const currentPage = Math.min(page, pages);
  const items = filtered.slice((currentPage - 1) * 20, currentPage * 20);

  return <div>
    <div className="admin-page-heading"><div><span className="admin-eyebrow">БАРААНЫ УДИРДЛАГА</span><h1>Бүтээгдэхүүн</h1><p>{catalog.ready ? catalog.products.length + " бүтээгдэхүүн · Үнэ, нөөц, сонголтуудаа удирдах." : "Барааны мэдээлэл"}</p></div><div className="admin-actions"><button type="button" className="btn-ghost" onClick={onAddModel}><Box size={16} />3D загвар</button><button type="button" className="btn-primary" onClick={() => setEditing({product:blank(),create:true})}><Plus size={17} />Бараа нэмэх</button></div></div>
    {editing ? <ProductEditor key={editing.create + "-" + editing.product.id} owner={owner} product={editing.product} create={editing.create} close={() => setEditing(null)} /> : <>
      <div className="admin-toolbar"><label className="admin-search"><Search size={18} /><input aria-label="Бүтээгдэхүүн хайх" placeholder="Барааны нэрээр хайх…" value={query} onChange={e => {setQuery(e.target.value);setPage(1);}} /></label><select className="input" aria-label="Барааны ангилал" value={category} onChange={e=>{setCategory(e.target.value);setPage(1);}}><option value="">Бүх ангилал</option>{CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select><select className="input" aria-label="Нөөцийн төлөв" value={stock} onChange={e=>{setStock(e.target.value);setPage(1);}}><option value="">Бүх нөөц</option><option value="available">Нөөцтэй</option><option value="empty">Дууссан</option></select><button type="button" disabled={catalog.loading} className="btn-ghost" onClick={()=>void catalog.refresh()} aria-label="Бүтээгдэхүүн шинэчлэх"><RefreshCw size={16} /></button></div>
      {catalog.loading || !catalog.ready ? <CatalogStatus loading={catalog.loading} error={catalog.error} retry={()=>void catalog.refresh()} /> : <>
        <p className="admin-result-count">{filtered.length} илэрц{(query || category || stock) && <button type="button" className="ml-3 min-h-10 underline" onClick={()=>{setQuery("");setCategory("");setStock("");setPage(1);}}>Шүүлтүүр арилгах</button>}</p>
        {!items.length ? <div className="admin-empty"><Box size={30} /><strong>Бүтээгдэхүүн олдсонгүй</strong><p>Хайх үг эсвэл шүүлтүүрээ өөрчлөөрэй.</p></div> : <div className="admin-panel"><table className="admin-data-table"><thead><tr>{["Бүтээгдэхүүн","Ангилал","Үндсэн үнэ","Нөөц","Үйлдэл"].map(label=><th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{items.map(product=><tr key={product.id}><td data-label="Бүтээгдэхүүн"><div className="admin-product-name"><Image src={product.image} alt="" width={48} height={48} /><div><strong>{product.name}</strong><small>{product.model ? "3D загвартай" : "Энгийн бүтээгдэхүүн"}{product.isNew ? " · Шинэ" : product.isBestSeller ? " · Онцлох" : ""}</small></div></div></td><td data-label="Ангилал">{CATEGORY_LABEL[product.category]}</td><td data-label="Үнэ"><span className="whitespace-nowrap font-medium tabular-nums">{formatPrice(product.basePrice)}</span></td><td data-label="Нөөц"><span className={"admin-status " + (!product.inStock ? "low" : "")}>{stockLabel(product)}</span></td><td className="admin-row-action"><button type="button" className="admin-edit-button" aria-label={product.name + " засах"} onClick={()=>setEditing({product,create:false})}><Pencil size={13} />Засах</button></td></tr>)}</tbody></table></div>}
        <nav className="admin-pagination" aria-label="Барааны хуудаслалт"><span aria-live="polite">Хуудас {currentPage} / {pages}</span><button type="button" disabled={currentPage===1} onClick={()=>setPage(currentPage-1)}><ChevronLeft size={14} />Өмнөх</button><button type="button" disabled={currentPage===pages} onClick={()=>setPage(currentPage+1)}>Дараах<ChevronRight size={14} /></button></nav>
      </>}
    </>}
  </div>;
}

function ProductEditor({
  owner,
  product,
  create,
  close,
}: {
  owner: string;
  product: Product;
  create: boolean;
  close: () => void;
}) {
  const [draft, setDraft] = useState<Product>(() => structuredClone(product));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [glbFile, setGlbFile] = useState<File | null>(null);
  const [glbMessage, setGlbMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<HTMLFormElement>(null);
  useEffect(() => { editorRef.current?.focus({ preventScroll: true }); }, []);

  const field = <K extends keyof Product>(key: K, value: Product[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <form
      ref={editorRef}
      tabIndex={-1}
      aria-label={create ? "Шинэ бүтээгдэхүүн" : "Бүтээгдэхүүн засах"}
      className="admin-editor space-y-6"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy) return;

        setBusy(true);
        setError(null);

        try {
          if (!Number.isSafeInteger(draft.stockQuantity) || draft.stockQuantity == null || draft.stockQuantity < 0 || draft.stockQuantity > MAX_STOCK_QUANTITY) throw new Error("Нөөцийн ширхэгийг 0–1,000,000 хооронд бүхэл тоогоор оруулна уу.");
          let image = draft.image;

          if (imageFile) {
            if (
              !["image/jpeg", "image/png", "image/webp"].includes(
                imageFile.type,
              ) ||
              imageFile.size === 0 ||
              imageFile.size > 3 * 1024 * 1024
            ) {
              throw new Error(
                "JPG, PNG эсвэл WebP зураг сонгоно уу. Хэмжээ: 3 MB хүртэл.",
              );
            }

            const form = new FormData();
            form.set("file", imageFile);

            const upload = await authFetch(
              "/api/admin/images",
              {
                method: "POST",
                body: form,
              },
              owner,
            );

            const result = await upload.json().catch(() => null);

            if (!upload.ok || typeof result?.url !== "string") {
              throw new Error(
                result?.error ??
                  "Зураг оруулахад алдаа гарлаа. /api/admin/images замыг шалгана уу.",
              );
            }

            if (
              useAuth.getState().user?.id !== owner ||
              useAuth.getState().role !== "admin"
            ) {
              return;
            }

            image = result.url;
            field("image", image);
            setImageFile(null);
          }
          const response = await authFetch(
            "/api/admin/products",
            {
              method: create ? "POST" : "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...draft, image, expectedStockQuantity: product.stockQuantity ?? null }),
            },
            owner,
          );

          const data = await response.json();

          if (!response.ok) {
            throw new Error(data.error ?? "Хадгалж чадсангүй.");
          }

          if (
            useAuth.getState().user?.id !== owner ||
            useAuth.getState().role !== "admin"
          ) {
            return;
          }

          await useCatalogStore.getState().refresh(true);
          close();
        } catch (error) {
          setError(error instanceof Error ? error.message : "Алдаа гарлаа.");
        } finally {
          setBusy(false);
        }
      }}
    >
      <button type="button" className="admin-edit-button" disabled={busy} onClick={close}><ArrowLeft size={14} />Жагсаалт руу буцах</button>
      <h2>
        {create ? "Шинэ бүтээгдэхүүн" : "Бүтээгдэхүүн засах"}
      </h2>

      <fieldset disabled={busy} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Нэр
            <input
              className="input mt-1"
              required
              maxLength={200}
              value={draft.name}
              onChange={(event) => field("name", event.target.value)}
            />
          </label>

          <label className="text-sm">
            Ангилал
            <select
              className="input mt-1"
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

          <label className="text-sm">
            Үндсэн үнэ (₮)
            <input
              className="input mt-1"
              required
              type="number"
              min="0"
              step="1"
              value={draft.basePrice}
              onChange={(event) =>
                field("basePrice", event.target.valueAsNumber)
              }
            />
          </label>

          <label className="text-sm">
            Нөөцийн үлдэгдэл (ширхэг)
            <input className="input mt-1" required type="number" min="0" max={MAX_STOCK_QUANTITY} step="1" value={draft.stockQuantity ?? ""} onChange={event => setDraft(current => ({...current, stockQuantity: event.target.valueAsNumber, inStock: event.target.valueAsNumber > 0}))} />
            <span className="text-xs text-ink/60">Өнгө, материалын бүх сонголтын нийт боломжтой үлдэгдэл. 0 бол нөөцгүй.</span>
          </label>
          <label className="text-sm">
            Барааны зураг
            <input
              className="input mt-1"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required={!draft.image}
              onChange={(event) =>
                setImageFile(event.target.files?.[0] ?? null)
              }
            />
            <span className="text-xs text-ink/60">
              JPG, PNG, WebP · 3 MB хүртэл. Хадгалах үед зураг шинэчлэгдэнэ.
            </span>
            {draft.image && (
              <p className="mt-1 text-xs text-ink/60">
                Одоогийн зураг хадгалагдсан. Шинэ файл сонгож сольж болно.
              </p>
            )}
          </label>
        </div>
        {!create && (
          <div className="space-y-2">
            <label className="block text-sm">
              3D загварын GLB файл (50 MB хүртэл)
              <input
                className="input mt-1"
                type="file"
                accept=".glb,model/gltf-binary"
                onChange={(event) => {
                  setGlbFile(event.target.files?.[0] ?? null);
                  setGlbMessage(null);
                }}
              />
            </label>

            <p className="text-xs text-ink/60">
              Одоогийн файл: {draft.model?.file ?? "GLB нэмээгүй"}
            </p>

            <button
              type="button"
              className="btn-ghost"
              disabled={busy || !glbFile}
              onClick={async () => {
                if (busy || !glbFile) return;

                setBusy(true);
                setError(null);
                setGlbMessage(null);

                try {
                  if (
                    !glbFile.name.toLowerCase().endsWith(".glb") ||
                    glbFile.size < 12 ||
                    glbFile.size > 50 * 1024 * 1024
                  ) {
                    throw new Error("50 MB-аас ихгүй GLB файл сонгоно уу.");
                  }

                  const form = new FormData();
                  form.set("glb", glbFile);
                  form.set("expectedFile", draft.model?.file ?? "");

                  const response = await authFetch(
                    `/api/admin/products/${draft.id}/glb`,
                    {
                      method: "POST",
                      body: form,
                    },
                    owner,
                  );

                  const data = await response.json().catch(() => null);

                  if (!response.ok || typeof data?.model?.file !== "string") {
                    throw new Error(data?.error ?? "GLB солиход алдаа гарлаа.");
                  }

                  if (
                    useAuth.getState().user?.id !== owner ||
                    useAuth.getState().role !== "admin"
                  ) {
                    return;
                  }

                  field("model", data.model);

                  setGlbFile(null);
                  await useCatalogStore.getState().refresh(true);
                  setGlbMessage("GLB файл солигдлоо.");
                } catch (error) {
                  setError(
                    error instanceof Error ? error.message : "Алдаа гарлаа.",
                  );
                } finally {
                  setBusy(false);
                }
              }}
            >
              {draft.model ? "GLB солих" : "GLB нэмэх"}
            </button>

            {glbMessage && (
              <p role="status" className="text-sm text-green-700">
                {glbMessage}
              </p>
            )}
          </div>
        )}
        <label className="block text-sm">
          Тайлбар
          <textarea
            className="input mt-1"
            maxLength={10000}
            rows={3}
            value={draft.description}
            onChange={(event) => field("description", event.target.value)}
          />
        </label>

        <div className="grid grid-cols-3 gap-3">
          {(
            [
              ["w", "Өргөн"],
              ["d", "Гүн"],
              ["h", "Өндөр"],
            ] as const
          ).map(([key, name]) => (
            <label key={key} className="text-sm">
              {name} (м)
              <input
                className="input mt-1"
                required
                type="number"
                min="0.001"
                max="100"
                step="any"
                value={draft.dimensions[key]}
                onChange={(event) =>
                  field("dimensions", {
                    ...draft.dimensions,
                    [key]: event.target.valueAsNumber,
                  })
                }
              />
            </label>
          ))}
        </div>

        <div className="flex flex-wrap gap-4">
          {(
            [
              ["isNew", "Шинэ бараа"],
              ["isBestSeller", "Онцлох бараа"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!draft[key]}
                onChange={(event) => field(key, event.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm">Өнгө ба нэмэлт үнэ (₮)</legend>

          {draft.colors.map((color, index) => (
            <div key={color.id} className="flex flex-wrap items-center gap-2">
              <input
                aria-label="Үндсэн өнгө"
                type="radio"
                name={`default-${draft.id}`}
                checked={draft.defaultColor === color.id}
                onChange={() => field("defaultColor", color.id)}
              />

              <input
                aria-label="Өнгөний нэр"
                className="input !w-40"
                required
                maxLength={200}
                value={color.name}
                onChange={(event) =>
                  field(
                    "colors",
                    draft.colors.map((item, currentIndex) =>
                      currentIndex === index
                        ? { ...item, name: event.target.value }
                        : item,
                    ),
                  )
                }
              />

              <input
                aria-label="Өнгө"
                type="color"
                value={color.hex}
                onChange={(event) =>
                  field(
                    "colors",
                    draft.colors.map((item, currentIndex) =>
                      currentIndex === index
                        ? { ...item, hex: event.target.value }
                        : item,
                    ),
                  )
                }
              />

              <input
                aria-label="Өнгөний нэмэлт үнэ"
                className="input !w-32"
                type="number"
                required
                step="1"
                value={color.priceDelta ?? 0}
                onChange={(event) =>
                  field(
                    "colors",
                    draft.colors.map((item, currentIndex) =>
                      currentIndex === index
                        ? {
                            ...item,
                            priceDelta: event.target.valueAsNumber,
                          }
                        : item,
                    ),
                  )
                }
              />

              <button
                type="button"
                className="text-sm underline disabled:opacity-40"
                disabled={draft.colors.length === 1}
                onClick={() => {
                  const colors = draft.colors.filter(
                    (_, currentIndex) => currentIndex !== index,
                  );

                  setDraft((current) => ({
                    ...current,
                    colors,
                    defaultColor:
                      current.defaultColor === color.id
                        ? colors[0].id
                        : current.defaultColor,
                  }));
                }}
              >
                Хасах
              </button>
            </div>
          ))}

          <button
            type="button"
            className="text-sm underline"
            onClick={() =>
              field("colors", [
                ...draft.colors,
                {
                  id: crypto.randomUUID(),
                  name: "Шинэ өнгө",
                  hex: "#C9A37A",
                  priceDelta: 0,
                },
              ])
            }
          >
            Өнгө нэмэх
          </button>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-sm">Материал ба нэмэлт үнэ (₮)</legend>

          {(Object.entries(materialNames) as [Material, string][]).map(
            ([id, name]) => {
              const selected = draft.materials.find(
                (material) => material.id === id,
              );

              return (
                <div key={id} className="flex items-center gap-3">
                  <label className="flex w-32 gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={!!selected}
                      onChange={(event) =>
                        field(
                          "materials",
                          event.target.checked
                            ? [...draft.materials, { id, name, priceDelta: 0 }]
                            : draft.materials.filter(
                                (material) => material.id !== id,
                              ),
                        )
                      }
                    />
                    {name}
                  </label>

                  {selected && (
                    <input
                      aria-label={`${name} нэмэлт үнэ`}
                      className="input !w-40"
                      required
                      type="number"
                      step="1"
                      value={selected.priceDelta}
                      onChange={(event) =>
                        field(
                          "materials",
                          draft.materials.map((material) =>
                            material.id === id
                              ? {
                                  ...material,
                                  priceDelta: event.target.valueAsNumber,
                                }
                              : material,
                          ),
                        )
                      }
                    />
                  )}
                </div>
              );
            },
          )}
        </fieldset>

        <fieldset className="admin-field-section">
          <legend>Харагдах дэлгүүрүүд</legend>
          <p className="text-xs text-[#7b896c]">Дэлгүүрүүдийг чагталж сонгоорой. Сонгоогүй бараа нийт каталогт харагдана.</p>
          <div className="admin-store-checkboxes">{STORES.map(store => <label key={store.id}><input type="checkbox" checked={(draft.storeIds ?? []).includes(store.id)} onChange={event => field("storeIds", event.target.checked ? [...(draft.storeIds ?? []), store.id] : (draft.storeIds ?? []).filter(id => id !== store.id))} />{store.name}</label>)}</div>
        </fieldset>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="admin-editor-actions">
        <button disabled={busy} className="btn-primary disabled:opacity-40">
          <Save size={16} />
          {busy ? "Хадгалж байна…" : "Хадгалах"}
        </button>
        <button
          type="button"
          disabled={busy}
          className="btn-ghost"
          onClick={close}
        >
          Болих
        </button>
      </div>
    </form>
  );
}


