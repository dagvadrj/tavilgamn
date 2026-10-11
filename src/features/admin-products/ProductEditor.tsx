"use client";

import {
  useDraftState,
  useDraftStatus,
  clearDashboardDraft,
} from "@/hooks/useDashboardDraft";
import { DashboardDraftNotice } from "@/components/DashboardDraftNotice";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import dynamic from "next/dynamic";
import type { GlbPreviewResult } from "@/components/GlbUploadPreview";
import { ArrowLeft, Save } from "lucide-react";
import type { Product, Material, Store } from "@/lib/types";
import { CATEGORIES } from "@/lib/products";
import { useAuth } from "@/store/auth";
import { useCatalogStore } from "@/store/catalog";
import { authFetch } from "@/lib/authFetch";
import { useKitchenCatalog } from "@/features/kitchen-planner/hooks/useKitchenCatalog";
import { DimensionHelp } from "./DimensionHelp";
import { specificationFields } from "@/lib/productSpecifications";
import {
  saveProductWithModel,
  type ProductSaveCheckpoint,
} from "./saveProductWithModel";
import "./product-editor.css";
import { MAX_STOCK_QUANTITY } from "@/lib/inventory";

export const GlbUploadPreview = dynamic(
  () => import("@/components/GlbUploadPreview"),
  {
    ssr: false,
  },
);

export const blank = (): Product => ({
  id: "new",
  name: "",
  category: "sofa",
  description: "",
  image: "",
  images: [],
  specifications: {},
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

export const materialNames: Record<Material, string> = {
  wood: "Мод",
  metal: "Металл",
  fabric: "Даавуу",
  leather: "Арьс",
  velvet: "Хилэн",
};

export function ProductEditor({
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
  const draftScope = `admin:${owner}:product:${create ? "new" : product.id}`;
  const [draft, setDraft] = useDraftState<Product>(draftScope, "draft", () =>
    structuredClone(product),
  );
  const [imageFile, setImageFile] = useDraftState<File | null>(
    draftScope,
    "imageFile",
    null,
  );
  const [galleryFiles, setGalleryFiles] = useDraftState<File[]>(
    draftScope,
    "galleryFiles",
    [],
  );
  const [glbFile, setGlbFile] = useDraftState<File | null>(
    draftScope,
    "glbFile",
    null,
  );
  const [glbPreview, setGlbPreview] = useState<GlbPreviewResult | null>(null);
  const { moduleCatalog } = useKitchenCatalog(
    draft.category === "kitchen-cabinet",
  );
  const [cabinetModuleId, setCabinetModuleId] = useDraftState(
    draftScope,
    "cabinetModuleId",
    "",
  );
  const [glbMessage, setGlbMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const [checkpoint, setCheckpoint] =
    useDraftState<ProductSaveCheckpoint | null>(
      draftScope,
      "saveCheckpoint",
      create
        ? null
        : { id: product.id, stockQuantity: product.stockQuantity ?? null },
    );
  type FieldErrors = {
    name?: string;
    basePrice?: string;
    stockQuantity?: string;
    image?: string;
    gallery?: string;
    glb?: string;
    description?: string;
    w?: string;
    d?: string;
    h?: string;
    colors?: string;
    materials?: string;
  };

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [storesError, setStoresError] = useState(false);
  const [storesRefresh, setStoresRefresh] = useState(0);
  const draftStatus = useDraftStatus(draftScope);
  const editorRef = useRef<HTMLFormElement>(null);
  const glbInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    editorRef.current?.focus({ preventScroll: true });
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setStoresError(false);
    authFetch("/api/admin/stores", { signal: controller.signal }, owner)
      .then(async (response) => {
        if (!response.ok) throw new Error("stores");
        return response.json();
      })
      .then((result) => {
        if (!controller.signal.aborted) setStores(result.stores);
      })
      .catch(() => {
        if (!controller.signal.aborted) setStoresError(true);
      });
    return () => controller.abort();
  }, [owner, storesRefresh]);

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
        if (saving.current || busy || draftStatus.loading) return;
        const nextErrors: FieldErrors = {};

        if (!draft.name.trim()) {
          nextErrors.name = "Бүтээгдэхүүний нэр оруулна уу.";
        }

        if (!Number.isFinite(draft.basePrice) || draft.basePrice < 0) {
          nextErrors.basePrice = "Үнэ 0-ээс багагүй байна.";
        }

        if (
          draft.stockQuantity == null ||
          !Number.isSafeInteger(draft.stockQuantity) ||
          draft.stockQuantity < 0 ||
          draft.stockQuantity > MAX_STOCK_QUANTITY
        ) {
          nextErrors.stockQuantity =
            "Нөөцийн тоо 0–1,000,000 хооронд бүхэл тоо байна.";
        }

        if (!Number.isFinite(draft.dimensions.w) || draft.dimensions.w <= 0) {
          nextErrors.w = "Өргөн 0-ээс их байна.";
        }

        if (!Number.isFinite(draft.dimensions.d) || draft.dimensions.d <= 0) {
          nextErrors.d = "Гүн 0-ээс их байна.";
        }

        if (!Number.isFinite(draft.dimensions.h) || draft.dimensions.h <= 0) {
          nextErrors.h = "Өндөр 0-ээс их байна.";
        }

        if (!draft.image && !imageFile) {
          nextErrors.image = "Барааны үндсэн зураг сонгоно уу.";
        }

        if ((draft.images?.length ?? 0) + galleryFiles.length > 12) {
          nextErrors.gallery = "Нэмэлт зураг нийт 12-оос олонгүй байна.";
        }

        if (draft.colors.length === 0) {
          nextErrors.colors = "Дор хаяж нэг өнгө шаардлагатай.";
        }

        if (draft.materials.length === 0) {
          nextErrors.materials = "Дор хаяж нэг материал шаардлагатай.";
        }

        if (
          glbFile &&
          (!glbPreview ||
            glbPreview.file !== glbFile ||
            !glbPreview.frontConfirmed)
        ) {
          nextErrors.glb =
            "3D урьдчилсан харагдац дээр хэмжээ, босоо байрлал болон нүүрэн талыг шалгаж батална уу.";
        }
        if (
          create &&
          glbFile &&
          draft.category === "kitchen-cabinet" &&
          !cabinetModuleId
        ) {
          nextErrors.glb =
            "Гал тогооны шүүгээний 3D загварт ижил хэмжээтэй модулийг сонгоно уу.";
        }

        setFieldErrors(nextErrors);

        if (Object.keys(nextErrors).length > 0) {
          return;
        }

        saving.current = true;
        setBusy(true);
        setError(null);

        try {
          let image = draft.image;
          const uploadImage = async (file: File) => {
            if (
              !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
              file.size === 0 ||
              file.size > 3 * 1024 * 1024
            ) {
              throw new Error(
                "JPG, PNG эсвэл WebP зураг сонгоно уу. Хэмжээ: 3 MB хүртэл.",
              );
            }

            const form = new FormData();
            form.set("file", file);

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
              throw new Error("Админ нэвтрэлт өөрчлөгдсөн байна.");
            }
            return result.url as string;
          };

          if ((draft.images?.length ?? 0) + galleryFiles.length > 12) {
            throw new Error("Нэмэлт зураг 12-оос олонгүй байна.");
          }

          if (imageFile) image = await uploadImage(imageFile);
          const uploadedGallery = await Promise.all(
            galleryFiles.map(uploadImage),
          );
          const images = [
            ...new Set([...(draft.images ?? []), ...uploadedGallery]),
          ].filter((item) => item !== image);

          setDraft((current) => ({ ...current, image, images }));
          setImageFile(null);
          setGalleryFiles([]);
          await saveProductWithModel({
            product: { ...draft, image, images },
            checkpoint,
            file: glbFile,
            preview: glbPreview,
            moduleId: cabinetModuleId,
            request: (url, init) => authFetch(url, init, owner),
            assertOwner: () => {
              if (
                useAuth.getState().user?.id !== owner ||
                useAuth.getState().role !== "admin"
              )
                throw new Error("Админ нэвтрэлт өөрчлөгдсөн байна.");
            },
            onSaved: (value) => {
              setCheckpoint(value);
              setDraft((current) => ({ ...current, id: value.id }));
            },
            onProgress: setGlbMessage,
          });
          setGlbFile(null);
          setGlbPreview(null);

          await useCatalogStore.getState().refresh(true);
          void clearDashboardDraft(draftScope);
          close();
        } catch (error) {
          setError(error instanceof Error ? error.message : "Алдаа гарлаа.");
        } finally {
          saving.current = false;
          setBusy(false);
          setGlbMessage(null);
        }
      }}
    >
      <button
        type="button"
        className="admin-edit-button"
        disabled={busy}
        onClick={close}
      >
        <ArrowLeft size={14} />
        Жагсаалт руу буцах
      </button>
      <h2>{create ? "Шинэ бүтээгдэхүүн" : "Бүтээгдэхүүн засах"}</h2>

      <DashboardDraftNotice
        scope={draftScope}
        disabled={busy}
        files={[imageFile, glbFile, ...galleryFiles]}
      />
      <fieldset disabled={busy || draftStatus.loading} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            Нэр
            <input
              className="input mt-1"
              required
              maxLength={200}
              value={draft.name}
              onChange={(event) => {
                field("name", event.target.value);

                setFieldErrors((current) => ({
                  ...current,
                  name: undefined,
                }));
              }}
            />
          </label>
          {fieldErrors.name && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.name}</p>
          )}

          <label className="text-sm">
            Ангилал
            <select
              className="input mt-1"
              value={draft.category}
              onChange={(event) => {
                field("category", event.target.value as Product["category"]);
                setGlbPreview(null);
                setCabinetModuleId("");
              }}
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
              onChange={(event) => {
                field("basePrice", event.target.valueAsNumber);
                setFieldErrors((current) => ({
                  ...current,
                  basePrice: undefined,
                }));
              }}
            />
          </label>
          {fieldErrors.basePrice && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.basePrice}</p>
          )}

          <label className="text-sm">
            Нөөцийн үлдэгдэл (ширхэг)
            <input
              className="input mt-1"
              required
              type="number"
              min="0"
              max={MAX_STOCK_QUANTITY}
              step="1"
              value={draft.stockQuantity ?? ""}
              onChange={(event) => {
                const value = event.target.valueAsNumber;

                setDraft((current) => ({
                  ...current,
                  stockQuantity: value,
                  inStock: value > 0,
                }));

                setFieldErrors((current) => ({
                  ...current,
                  stockQuantity: undefined,
                }));
              }}
            />
            <span className="text-xs text-ink/60">
              Өнгө, материалын бүх сонголтын нийт боломжтой үлдэгдэл. 0 бол
              нөөцгүй.
            </span>
          </label>
          {fieldErrors.stockQuantity && (
            <p className="mt-1 text-xs text-red-600">
              {fieldErrors.stockQuantity}
            </p>
          )}
          <label className="text-sm">
            Барааны зураг
            <input
              className="input mt-1"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              required={!draft.image && !imageFile}
              onChange={(event) => {
                setImageFile(event.target.files?.[0] ?? null);

                setFieldErrors((current) => ({
                  ...current,
                  image: undefined,
                }));
              }}
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
          <label className="text-sm">
            Нэмэлт зургууд
            <input
              className="input mt-1"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={(event) => {
                setGalleryFiles(Array.from(event.target.files ?? []));

                setFieldErrors((current) => ({
                  ...current,
                  gallery: undefined,
                }));
              }}
            />
            <span className="text-xs text-ink/60">
              Нэг удаад олон зураг сонгож болно. Нийт 12 хүртэл, зураг бүр 3
              MB-аас ихгүй.
            </span>
            {galleryFiles.length > 0 && (
              <p className="mt-1 text-xs text-ink/60">
                Хадгалах зураг:{" "}
                {galleryFiles.map((file) => file.name).join(", ")}
              </p>
            )}
          </label>
          {fieldErrors.gallery && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.gallery}</p>
          )}
        </div>
        {(draft.images?.length ?? 0) > 0 && (
          <div>
            <p className="mb-2 text-sm">Одоогийн нэмэлт зургууд</p>
            <div className="flex flex-wrap gap-3">
              {draft.images?.map((url) => (
                <div
                  key={url}
                  className="rounded-xl border border-ink/10 bg-white p-2"
                >
                  <Image
                    src={url}
                    alt=""
                    width={92}
                    height={70}
                    className="h-[70px] w-[92px] rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    className="mt-2 block min-h-10 w-full text-xs text-red-700 underline"
                    onClick={() =>
                      field(
                        "images",
                        draft.images?.filter((item) => item !== url) ?? [],
                      )
                    }
                  >
                    Хасах
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <section
          className="product-editor-section"
          aria-labelledby="product-specifications-editor-heading"
        >
          <h3 id="product-specifications-editor-heading">
            Бүтээгдэхүүний үзүүлэлт
          </h3>
          <p>
            Ангилалд тохирох үзүүлэлтүүд. Мэдэхгүй мэдээллээ хоосон үлдээнэ.
            Өнгө, материал болон хэмжээсийг үндсэн талбаруудаас авна.
          </p>
          <div className="product-specification-fields">
            {specificationFields(draft.category).map((spec) => (
              <label key={spec.key}>
                {spec.label}
                <input
                  className="input mt-1"
                  maxLength={300}
                  placeholder={spec.placeholder}
                  value={draft.specifications?.[spec.key] ?? ""}
                  onChange={(event) =>
                    field("specifications", {
                      ...draft.specifications,
                      [spec.key]: event.target.value,
                    })
                  }
                />
              </label>
            ))}
          </div>
        </section>

        <section
          className="product-editor-section space-y-2"
          aria-labelledby="product-model-heading"
        >
          <h3 id="product-model-heading">3D загвар</h3>
          <p>
            GLB файлаа энд сонгоно. Бүтээгдэхүүн болон 3D загвар “Хадгалах” үед
            хамт бүртгэгдэнэ. 3D файл заавал оруулах шаардлагагүй.
          </p>
          <label className="block text-sm">
            3D загварын эх GLB файл (200 MB хүртэл)
            <input
              ref={glbInputRef}
              className="input mt-1"
              type="file"
              accept=".glb,model/gltf-binary"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;

                setGlbFile(file);
                setGlbPreview(null);
                setGlbMessage(null);

                setFieldErrors((current) => ({
                  ...current,
                  glb: undefined,
                }));
              }}
            />
          </label>
          {fieldErrors.glb && (
            <p role="alert" className="text-xs text-red-600">
              {fieldErrors.glb}
            </p>
          )}

          <p className="text-xs text-ink/60">
            Одоогийн файл: {draft.model?.file ?? "GLB нэмээгүй"}
          </p>
          <p className="text-xs text-ink/60">
            Original GLB файл оруул. Web-д зориулсан хувилбар автоматаар
            боловсруулагдана.
          </p>
          <GlbUploadPreview
            key={draft.category}
            allowFrontProjection={draft.category === "kitchen-cabinet"}
            file={glbFile}
            expected={{
              widthMm: draft.dimensions.w * 1000,
              heightMm: draft.dimensions.h * 1000,
              depthMm: draft.dimensions.d * 1000,
            }}
            onChange={setGlbPreview}
          />
          {draft.category === "kitchen-cabinet" && (
            <label className="label">
              Гал тогооны модуль
              <select
                className="input"
                value={cabinetModuleId}
                onChange={(event) => setCabinetModuleId(event.target.value)}
              >
                <option value="">
                  {create ? "Ижил хэмжээтэй модуль сонгох" : "Одоогийн модуль"}
                </option>
                {moduleCatalog
                  .filter(
                    (module) =>
                      Math.abs(module.widthMm - draft.dimensions.w * 1000) <=
                        5 &&
                      Math.abs(module.heightMm - draft.dimensions.h * 1000) <=
                        5 &&
                      Math.abs(module.depthMm - draft.dimensions.d * 1000) <= 5,
                  )
                  .map((module) => (
                    <option value={module.id} key={module.id}>
                      {module.code}
                    </option>
                  ))}
              </select>
            </label>
          )}
          {glbFile && (
            <button
              type="button"
              className="btn-ghost"
              onClick={() => {
                setGlbFile(null);
                setGlbPreview(null);
                if (glbInputRef.current) glbInputRef.current.value = "";
                setFieldErrors((current) => ({ ...current, glb: undefined }));
              }}
            >
              Сонгосон 3D файлыг хасах
            </button>
          )}
        </section>
        <section
          className="product-editor-section"
          aria-labelledby="product-dimensions-heading"
        >
          <h3 id="product-dimensions-heading">Хэмжээс</h3>
          <p>Бүх хэмжээсийг метрээр оруулна.</p>
          <div className="product-dimensions">
            {(
              [
                [
                  "w",
                  "Өргөн",
                  "Урд талаас харахад зүүнээс баруун хүртэлх хэмжээ. 3D загварын X тэнхлэг.",
                ],
                [
                  "d",
                  "Гүн / урт",
                  "Урд ирмэгээс арын ирмэг хүртэлх хэмжээ. 3D загварын Z тэнхлэг.",
                ],
                [
                  "h",
                  "Өндөр",
                  "Шалнаас тавилгын хамгийн дээд цэг хүртэлх хэмжээ. 3D загварын Y тэнхлэг.",
                ],
              ] as const
            ).map(([key, label, help]) => (
              <div key={key}>
                <div className="product-dimension-label">
                  <label htmlFor={"product-dimension-" + key}>
                    {label} (м)
                  </label>
                  <DimensionHelp label={label}>{help}</DimensionHelp>
                </div>
                <input
                  id={"product-dimension-" + key}
                  className="input"
                  required
                  type="number"
                  min="0.001"
                  max="100"
                  step="any"
                  value={draft.dimensions[key]}
                  aria-invalid={!!fieldErrors[key]}
                  onChange={(event) => {
                    field("dimensions", {
                      ...draft.dimensions,
                      [key]: event.target.valueAsNumber,
                    });
                    setGlbPreview(null);
                    setFieldErrors((current) => ({
                      ...current,
                      [key]: undefined,
                    }));
                  }}
                />
                {fieldErrors[key] && (
                  <p className="mt-1 text-xs text-red-600">
                    {fieldErrors[key]}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>

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
          {fieldErrors.colors && (
            <p className="text-xs text-red-600">{fieldErrors.colors}</p>
          )}
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
          {fieldErrors.materials && (
            <p className="text-xs text-red-600">{fieldErrors.materials}</p>
          )}
        </fieldset>

        <fieldset className="admin-field-section">
          <legend>Харагдах дэлгүүрүүд</legend>
          <p className="text-xs text-[#7b896c]">
            Дэлгүүрүүдийг чагталж сонгоорой. Сонгоогүй бараа нийт каталогт
            харагдана.
          </p>
          {storesError && (
            <p role="alert">
              Дэлгүүрүүдийг ачаалж чадсангүй.{" "}
              <button
                type="button"
                className="underline"
                onClick={() => setStoresRefresh((value) => value + 1)}
              >
                Дахин оролдох
              </button>
            </p>
          )}
          <div className="admin-store-checkboxes">
            {stores.map((store) => (
              <label key={store.id}>
                <input
                  type="checkbox"
                  checked={(draft.storeIds ?? []).includes(store.id)}
                  onChange={(event) =>
                    field(
                      "storeIds",
                      event.target.checked
                        ? [...(draft.storeIds ?? []), store.id]
                        : (draft.storeIds ?? []).filter(
                            (id) => id !== store.id,
                          ),
                    )
                  }
                />
                {store.name}
              </label>
            ))}
          </div>
        </fieldset>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {glbMessage && (
        <p role="status" className="product-save-progress">
          {glbMessage}
        </p>
      )}
      {create && checkpoint && (
        <p role="status" className="text-sm">
          Бүтээгдэхүүн бүртгэгдсэн. Үлдсэн өөрчлөлт, 3D файлыг дахин хадгалахад
          энэ бүтээгдэхүүн шинэчлэгдэнэ.
        </p>
      )}

      <div className="admin-editor-actions">
        <button
          type="submit"
          className="btn-primary"
          disabled={busy || draftStatus.loading}
        >
          <Save size={16} />

          {busy
            ? "Хадгалж байна…"
            : glbFile
              ? "Бүтээгдэхүүн, 3D загварыг хадгалах"
              : "Хадгалах"}
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
