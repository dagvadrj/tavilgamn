"use client";
import { DashboardFormSection } from "@/features/dashboard/DashboardFormSection";

import {
  useDraftState,
  useDraftStatus,
  clearDashboardDraft,
} from "@/hooks/useDashboardDraft";
import { MerchantFormHeader } from "./MerchantFormHeader";
import { DashboardDraftNotice } from "@/components/DashboardDraftNotice";
import { useState } from "react";
import { authFetch } from "@/lib/authFetch";
import { isOwner } from "@/features/merchant/merchantApi";
import { Save } from "lucide-react";
import type { Store } from "@/lib/types";
import { CATEGORIES } from "@/lib/products";
import { STORE_TYPES } from "@/lib/storeTypes";
import { merchantRequest } from "@/features/merchant/merchantApi";

export function StoreProfile({
  owner,
  store,
  onSave,
}: {
  owner: string;
  store: Store | null;
  onSave: (store: Store) => void;
}) {
  const draftScope = `merchant:${owner}:store`;
  const [draft, setDraft] = useDraftState(draftScope, "draft", () => ({
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
  const [imageFile, setImageFile] = useDraftState<File | null>(
    draftScope,
    "imageFile",
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const draftStatus = useDraftStatus(draftScope);
  function field<K extends keyof typeof draft>(
    key: K,
    value: (typeof draft)[K],
  ) {
    setDraft((current) => ({ ...current, [key]: value }));
    setSaved(false);
  }
  return (
    <form
      className="merchant-form-page"
      onSubmit={async (event) => {
        event.preventDefault();
        if (busy || draftStatus.loading) return;
        setError(null);
        setSaved(false);
        if (!draft.categories.length) {
          setError("Хамгийн багадаа нэг барааны ангилал сонгоно уу.");
          return;
        }
        setBusy(true);
        try {
          let image = draft.image;
          if (imageFile) {
            if (
              !["image/jpeg", "image/png", "image/webp"].includes(
                imageFile.type,
              ) ||
              !imageFile.size ||
              imageFile.size > 3 * 1024 * 1024
            )
              throw new Error(
                "JPG, PNG эсвэл WebP зураг сонгоно уу. Хэмжээ 3 MB хүртэл.",
              );
            const form = new FormData();
            form.set("file", imageFile);
            const response = await authFetch(
              "/api/merchant/images",
              { method: "POST", body: form },
              owner,
            );
            const uploaded = await response.json().catch(() => null);
            if (!response.ok || typeof uploaded?.url !== "string")
              throw new Error(uploaded?.error ?? "Зураг оруулж чадсангүй.");
            if (!isOwner(owner))
              throw new Error("Merchant нэвтрэлт өөрчлөгдсөн байна.");
            image = uploaded.url;
            field("image", image);
            setImageFile(null);
          }
          const result = await merchantRequest<{ store: Store }>(
            "/api/merchant/store",
            owner,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ ...draft, image }),
            },
          );
          void clearDashboardDraft(draftScope, false);
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
      <MerchantFormHeader
        title={store ? "Дэлгүүрийн мэдээлэл" : "Дэлгүүрээ нээх"}
        description="Энэ мэдээлэл дэлгүүрийн танилцуулгад харагдана."
      >
        <button
          type="button"
          className="btn-ghost"
          disabled={busy || draftStatus.loading}
          onClick={() => {
            void clearDashboardDraft(draftScope);
            setError(null);
            setSaved(false);
          }}
        >
          Болих
        </button>
        <button
          type="submit"
          className="btn-primary"
          disabled={busy || draftStatus.loading}
        >
          <Save size={16} />
          {busy
            ? "Хадгалж байна…"
            : store
              ? "Өөрчлөлт хадгалах"
              : "Дэлгүүр нээх"}
        </button>
      </MerchantFormHeader>
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
      <DashboardDraftNotice
        scope={draftScope}
        disabled={busy}
        files={[imageFile]}
      />
      <fieldset
        className="merchant-editor-grid"
        disabled={busy || draftStatus.loading}
      >
        <div className="merchant-editor-main">
          <section className="merchant-form-card ">
            <div className="merchant-card-heading">
              <h2>Дэлгүүрийн тухай</h2>
              <p>Таны брэнд болон үйл ажиллагааны танилцуулга.</p>
            </div>
            <div className="merchant-form-grid">
              {" "}
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
                    field(
                      "storeType",
                      event.target.value as typeof draft.storeType,
                    )
                  }
                >
                  {STORE_TYPES.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.label}
                    </option>
                  ))}
                </select>
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
            </div>
          </section>
          <section className="merchant-form-card ">
            <div className="merchant-card-heading">
              <h2>Холбоо барих мэдээлэл</h2>
              <p>Хэрэглэгч тантай холбогдох хаяг, утас.</p>
            </div>
            <div className="merchant-form-grid">
              {" "}
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
            </div>
          </section>
        </div>
        <div className="merchant-editor-aside">
          <DashboardFormSection title="Дэлгүүрийн зураг" optional>
            <div className="merchant-card-heading">
              <h2>Дэлгүүрийн зураг</h2>
              <p>Брэндээ илэрхийлэх танилцуулгын зураг.</p>
            </div>
            <label className="merchant-span">
              Зураг сонгох
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  setImageFile(event.target.files?.[0] ?? null)
                }
              />
              <small>
                {imageFile
                  ? imageFile.name
                  : "JPG, PNG, WebP · 3 MB хүртэл. Хадгалах үед зураг орно."}
              </small>
            </label>
            {imageFile && (
              <button
                type="button"
                className="btn-ghost"
                onClick={() => setImageFile(null)}
              >
                Сонгосон зураг хасах
              </button>
            )}
            <details>
              <summary>Зургийн холбоосоор оруулах</summary>
              <div className="merchant-form-grid">
                {" "}
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
                    Cloudinary эсвэл Unsplash дээр байршуулсан HTTPS зургийн
                    холбоос.
                  </small>
                </label>
              </div>
            </details>
          </DashboardFormSection>
          <section className="merchant-form-card ">
            <div className="merchant-card-heading">
              <h2>Барааны ангилал</h2>
              <p>Хамгийн багадаа нэг ангилал сонгоно уу.</p>
            </div>{" "}
            <fieldset className="merchant-category-fieldset">
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
                            : draft.categories.filter(
                                (id) => id !== category.id,
                              ),
                        )
                      }
                    />
                    {category.name}
                  </label>
                ))}
              </div>
            </fieldset>
          </section>
        </div>
      </fieldset>
    </form>
  );
}
