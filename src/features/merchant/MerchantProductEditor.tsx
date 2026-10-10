"use client";

import {
  useDraftState,
  useDraftStatus,
  clearDashboardDraft,
} from "@/hooks/useDashboardDraft";
import { DashboardDraftNotice } from "@/components/DashboardDraftNotice";
import { useEffect, useState } from "react";
import Image from "next/image";
import { ArrowLeft, Box, ImagePlus, Save, X } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import type { Product } from "@/lib/types";
import { CATEGORIES } from "@/lib/products";
import { parseProduct } from "@/lib/catalogValidation";
import { MAX_STOCK_QUANTITY } from "@/lib/inventory";
import {
  type MerchantProduct,
  isOwner,
  merchantRequest,
} from "@/features/merchant/merchantApi";

export function MerchantProductEditor({
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
  const draftScope = `merchant:${owner}:product:${create ? "new" : product.id}`;
  const [draft, setDraft] = useDraftState(draftScope, "draft", product);

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

  const [modelRequested, setModelRequested] = useDraftState(
    draftScope,
    "modelRequested",
    Boolean(product.modelRequested),
  );

  const draftStatus = useDraftStatus(draftScope);
  const [busy, setBusy] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  useEffect(() => {
    if (!imageFile) {
      setImagePreview(null);
      return;
    }
    const url = URL.createObjectURL(imageFile);
    setImagePreview(url);
    return () => URL.revokeObjectURL(url);
  }, [imageFile]);
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
        if (busy || draftStatus.loading) return;
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
          void clearDashboardDraft(draftScope);
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
      <DashboardDraftNotice
        scope={draftScope}
        disabled={busy}
        files={[imageFile, ...galleryFiles]}
      />
      <fieldset disabled={busy || draftStatus.loading}>
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
          <label>
            Хямдралын өмнөх бодит үнэ (₮) · заавал биш
            <input
              className="input"
              type="number"
              min={0}
              max={Number.MAX_SAFE_INTEGER}
              step={1}
              value={draft.compareAtPrice ?? ""}
              onChange={(event) => {
                const value =
                  event.target.value === "" ? null : event.target.valueAsNumber;
                setDraft((current) => ({
                  ...current,
                  compareAtPrice: value,
                  ...(value == null
                    ? { promotionLabel: null, promotionEndsAt: null }
                    : {}),
                }));
              }}
            />
            <small>
              Худалдах үнээс өндөр, өмнө нь бодитоор мөрдсөн үнэ. Хоосон бол
              хямдрал харуулахгүй.
            </small>
          </label>
          <label>
            Урамшууллын нэр · заавал биш
            <input
              className="input"
              maxLength={80}
              disabled={draft.compareAtPrice == null}
              value={draft.promotionLabel ?? ""}
              onChange={(event) => field("promotionLabel", event.target.value)}
            />
          </label>
          <label>
            Урамшуулал дуусах · таны төхөөрөмжийн цаг
            <input
              className="input"
              type="datetime-local"
              disabled={draft.compareAtPrice == null}
              value={
                draft.promotionEndsAt
                  ? new Date(
                      Date.parse(draft.promotionEndsAt) -
                        new Date(draft.promotionEndsAt).getTimezoneOffset() *
                          60000,
                    )
                      .toISOString()
                      .slice(0, 16)
                  : ""
              }
              onChange={(event) =>
                field(
                  "promotionEndsAt",
                  event.target.value
                    ? new Date(event.target.value).toISOString()
                    : null,
                )
              }
            />
            <small>
              Дуусмагц хямдралын тэмдэг нуугдана. Худалдах үнэ автоматаар
              өөрчлөгдөхгүй.
            </small>
          </label>
          <label className="merchant-span">
            Хүргэлт, үйлдвэрлэлийн нөхцөл · заавал биш
            <textarea
              className="input"
              maxLength={1000}
              rows={2}
              value={draft.deliveryTerms ?? ""}
              placeholder="Жишээ: Улаанбаатарын бүсэд 3–5 хоног; хүргэлтийн үнэ захиалгын шатанд баталгаажина."
              onChange={(event) => field("deliveryTerms", event.target.value)}
            />
            <small>
              Зөвхөн үнэн бодит нөхцөлөө оруулна. Энэ тайлбар хүргэлтийн үнийг
              автоматаар тооцоолохгүй.
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

            {(imagePreview || draft.image) && (
              <div className="merchant-image-preview">
                <Image
                  src={imagePreview ?? draft.image}
                  alt={draft.name || "Бүтээгдэхүүний үндсэн зураг"}
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
                    <Image
                      src={url}
                      alt={`${draft.name || "Бүтээгдэхүүн"} — нэмэлт зураг`}
                      width={90}
                      height={70}
                      sizes="90px"
                    />

                    <button
                      type="button"
                      aria-label="Нэмэлт зураг хасах"
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
