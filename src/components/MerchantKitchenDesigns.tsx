"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  CheckCircle2,
  ImagePlus,
  LoaderCircle,
  RefreshCw,
  Send,
  Store,
  Upload,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import type { KitchenDesignSummary } from "@/lib/kitchenMarketplace";

type SavedKitchen = { id: string; name: string };
type LoadResult = {
  eligible: boolean;
  storeType: string | null;
  designs: KitchenDesignSummary[];
};

async function request<T>(
  path: string,
  owner: string,
  init?: RequestInit,
): Promise<T> {
  const response = await authFetch(path, init, owner);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new Error(data?.error ?? "Мэдээллийг ачаалж чадсангүй.");
  return data as T;
}

const reviewLabel: Record<KitchenDesignSummary["reviewStatus"], string> = {
  draft: "Draft",
  submitted: "Хяналтад",
  changes_requested: "Засвар хүссэн",
  approved: "Зөвшөөрсөн",
  rejected: "Татгалзсан",
};

export function MerchantKitchenDesigns({ owner }: { owner: string }) {
  const [data, setData] = useState<LoadResult | null>(null);
  const [kitchens, setKitchens] = useState<SavedKitchen[]>([]);
  const [sourceKitchenId, setSourceKitchenId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceFrom, setPriceFrom] = useState("");
  const [leadTimeDays, setLeadTimeDays] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [marketplace, saved] = await Promise.all([
        request<LoadResult>("/api/merchant/kitchen-designs", owner),
        request<{ kitchens: SavedKitchen[] }>("/api/kitchens", owner),
      ]);
      setData(marketplace);
      setKitchens(saved.kitchens);
      setSourceKitchenId((current) => current || saved.kitchens[0]?.id || "");
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Мэдээллийг ачаалж чадсангүй.",
      );
    }
  }, [owner]);

  useEffect(() => {
    void load();
  }, [load]);

  async function createDraft(event: React.FormEvent) {
    event.preventDefault();
    setBusy("create");
    setError(null);
    try {
      await request("/api/merchant/kitchen-designs", owner, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceKitchenId,
          title,
          shortDescription: description,
          description,
          style: "modern",
          pricingMode: priceFrom ? "from" : "quote",
          priceFrom: priceFrom || null,
          leadTimeDays: leadTimeDays || null,
          installationIncluded: false,
          tags: [],
          serviceAreas: [],
          inclusions: [],
          exclusions: [],
        }),
      });
      setTitle("");
      setDescription("");
      setPriceFrom("");
      setLeadTimeDays("");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Draft үүсгэж чадсангүй.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function uploadMedia(
    design: KitchenDesignSummary,
    file: File | null,
    kind: "thumbnail" | "render",
  ) {
    if (!file) return;
    setBusy(`media:${design.id}`);
    setError(null);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("versionId", design.versionId);
      form.set("kind", kind);
      form.set("isPrimary", String(kind === "thumbnail"));
      form.set("alt", design.title);
      await request(`/api/merchant/kitchen-designs/${design.id}/media`, owner, {
        method: "POST",
        body: form,
      });
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Зураг хадгалж чадсангүй.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function action(
    design: KitchenDesignSummary,
    command: "submit" | "publish" | "archive",
  ) {
    setBusy(`${command}:${design.id}`);
    setError(null);
    try {
      await request(`/api/merchant/kitchen-designs/${design.id}`, owner, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: command, versionId: design.versionId }),
      });
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Үйлдэл амжилтгүй боллоо.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (!data && !error)
    return <div className="merchant-load-state">Загваруудыг ачаалж байна…</div>;
  return (
    <section className="space-y-5">
      <div className="merchant-page-heading">
        <div>
          <span className="merchant-eyebrow">MARKETPLACE</span>
          <h1>Гал тогооны загвар</h1>
          <p>Хадгалсан төслөө бүтээгдэхүүн болгон бэлдэж, хянуулан нийтэлнэ.</p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => void load()}>
          <RefreshCw size={16} />
          Шинэчлэх
        </button>
      </div>
      {error && (
        <p className="merchant-error" role="alert">
          {error}
        </p>
      )}
      {data && !data.eligible ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <Store className="mb-3" /> Marketplace-д үйлдвэр эсвэл гар хийцийн
          төрлийн идэвхтэй дэлгүүр загвар нийтэлнэ. Одоогийн төрөл:{" "}
          <strong>{data.storeType ?? "дэлгүүргүй"}</strong>.
        </div>
      ) : (
        <>
          <form
            onSubmit={createDraft}
            className="grid gap-4 rounded-2xl border border-black/10 bg-white p-5 lg:grid-cols-2"
          >
            <div className="lg:col-span-2">
              <h2 className="font-semibold">Шинэ marketplace draft</h2>
              <p className="text-sm text-black/55">
                Planner-т хадгалсан төслийн snapshot хуулбарлагдана.
              </p>
            </div>
            <label className="label">
              Хадгалсан төсөл
              <select
                className="input mt-1 w-full"
                required
                value={sourceKitchenId}
                onChange={(e) => setSourceKitchenId(e.target.value)}
              >
                <option value="">Сонгоно уу</option>
                {kitchens.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="label">
              Marketplace нэр
              <input
                className="input mt-1 w-full"
                required
                minLength={3}
                maxLength={160}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </label>
            <label className="label lg:col-span-2">
              Тайлбар
              <textarea
                className="input mt-1 min-h-24 w-full"
                maxLength={300}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </label>
            <label className="label">
              Эхлэх үнэ (₮)
              <input
                className="input mt-1 w-full"
                type="number"
                min="0"
                value={priceFrom}
                onChange={(e) => setPriceFrom(e.target.value)}
                placeholder="Хоосон бол үнийн санал"
              />
            </label>
            <label className="label">
              Үйлдвэрлэх хоног
              <input
                className="input mt-1 w-full"
                type="number"
                min="1"
                max="365"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(e.target.value)}
              />
            </label>
            <button
              className="btn-primary w-fit"
              disabled={busy === "create" || !kitchens.length}
            >
              {busy === "create" ? (
                <LoaderCircle className="animate-spin" size={16} />
              ) : (
                <Upload size={16} />
              )}
              Draft үүсгэх
            </button>
          </form>
          <div className="grid gap-4 xl:grid-cols-2">
            {data?.designs.map((design) => (
              <article
                key={design.id}
                className="overflow-hidden rounded-2xl border border-black/10 bg-white"
              >
                <div className="relative h-48 bg-[#f1efe9]">
                  {design.thumbnailUrl ? (
                    <Image
                      src={design.thumbnailUrl}
                      alt={design.title}
                      fill
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-black/35">
                      <ImagePlus size={36} />
                    </div>
                  )}
                </div>
                <div className="space-y-3 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-semibold">{design.title}</h3>
                      <p className="text-xs text-black/50">
                        v{design.versionNo} · {design.cabinetCount} шүүгээ ·{" "}
                        {design.roomWidthMm}×{design.roomDepthMm} мм
                      </p>
                    </div>
                    <span className="rounded-full bg-black/5 px-2 py-1 text-xs">
                      {reviewLabel[design.reviewStatus]}
                    </span>
                  </div>
                  <p className="text-sm text-black/60">
                    {design.shortDescription || "Тайлбар оруулаагүй"}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(["draft", "changes_requested"] as const).includes(
                      design.reviewStatus as "draft" | "changes_requested",
                    ) && (
                      <label className="btn-ghost cursor-pointer">
                        <ImagePlus size={15} />
                        {design.thumbnailUrl
                          ? "Thumbnail солих"
                          : "Thumbnail нэмэх"}
                        <input
                          className="sr-only"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) =>
                            void uploadMedia(
                              design,
                              e.target.files?.[0] ?? null,
                              "thumbnail",
                            )
                          }
                        />
                      </label>
                    )}
                    {(["draft", "changes_requested"] as const).includes(
                      design.reviewStatus as "draft" | "changes_requested",
                    ) && (
                      <label className="btn-ghost cursor-pointer">
                        <ImagePlus size={15} />
                        Render жишээ нэмэх
                        <input
                          className="sr-only"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          onChange={(e) =>
                            void uploadMedia(
                              design,
                              e.target.files?.[0] ?? null,
                              "render",
                            )
                          }
                        />
                      </label>
                    )}
                    {(["draft", "changes_requested"] as const).includes(
                      design.reviewStatus as "draft" | "changes_requested",
                    ) && (
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={!design.thumbnailUrl || !!busy}
                        onClick={() => void action(design, "submit")}
                      >
                        <Send size={15} />
                        Хяналтад илгээх
                      </button>
                    )}
                    {design.reviewStatus === "approved" &&
                      design.publicationStatus !== "published" && (
                        <button
                          type="button"
                          className="btn-primary"
                          disabled={!!busy}
                          onClick={() => void action(design, "publish")}
                        >
                          <CheckCircle2 size={15} />
                          Нийтлэх
                        </button>
                      )}
                    {design.publicationStatus !== "archived" && (
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={!!busy}
                        onClick={() => void action(design, "archive")}
                      >
                        Архивлах
                      </button>
                    )}
                  </div>
                </div>
              </article>
            ))}
            {data?.designs.length === 0 && (
              <p className="rounded-2xl border border-dashed border-black/15 p-8 text-sm text-black/55">
                Marketplace draft хараахан байхгүй.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
