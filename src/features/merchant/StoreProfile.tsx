"use client";

import {
  useDraftState,
  useDraftStatus,
  clearDashboardDraft,
} from "@/hooks/useDashboardDraft";
import { DashboardDraftNotice } from "@/components/DashboardDraftNotice";
import { useState } from "react";
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
      className="merchant-panel"
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
          const result = await merchantRequest<{ store: Store }>(
            "/api/merchant/store",
            owner,
            {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(draft),
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
      <h2>{store ? "Дэлгүүрийн мэдээлэл" : "Дэлгүүрээ нээх"}</h2>
      <p>
        {store
          ? "Энэ мэдээлэл хэрэглэгчдэд таны дэлгүүрийн хуудсанд харагдана."
          : "Эхлээд дэлгүүрийн мэдээллээ бүртгээд бүтээгдэхүүнээ нэмээрэй."}
      </p>
      <DashboardDraftNotice scope={draftScope} disabled={busy} />
      <fieldset disabled={busy || draftStatus.loading}>
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
