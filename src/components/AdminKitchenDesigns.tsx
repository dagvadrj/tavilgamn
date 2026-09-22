"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, EyeOff, RefreshCw, RotateCcw, X } from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import type { KitchenDesignSummary } from "@/lib/kitchenMarketplace";

type ReviewAction =
  | "approved"
  | "changes_requested"
  | "rejected"
  | "unpublished";

export function AdminKitchenDesigns({ owner }: { owner: string }) {
  const [designs, setDesigns] = useState<KitchenDesignSummary[]>([]);
  const [filter, setFilter] = useState("all");
  const [note, setNote] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await authFetch(
        "/api/admin/kitchen-designs",
        undefined,
        owner,
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data)
        throw new Error(data?.error ?? "Мэдээллийг ачаалж чадсангүй.");
      setDesigns(data.designs);
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

  const visible = useMemo(
    () =>
      designs.filter(
        (item) =>
          filter === "all" ||
          item.reviewStatus === filter ||
          item.publicationStatus === filter,
      ),
    [designs, filter],
  );

  async function review(design: KitchenDesignSummary, action: ReviewAction) {
    setBusy(`${design.id}:${action}`);
    setError(null);
    try {
      const response = await authFetch(
        "/api/admin/kitchen-designs",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            designId: design.id,
            versionId: design.versionId,
            action,
            note: note[design.id] ?? "",
          }),
        },
        owner,
      );
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(data?.error ?? "Шийдвэрийг хадгалж чадсангүй.");
      setNote((current) => ({ ...current, [design.id]: "" }));
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Шийдвэрийг хадгалж чадсангүй.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-5">
      <div className="admin-page-heading">
        <div>
          <span className="admin-eyebrow">MARKETPLACE</span>
          <h1>Гал тогооны загварууд</h1>
          <p>
            Merchant-ийн snapshot, зураг, үнэ болон нийтлэх хүсэлтийг нэг дор
            хянана.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => void load()}>
          <RefreshCw size={16} />
          Шинэчлэх
        </button>
      </div>
      <div className="flex flex-wrap gap-2">
        {[
          "all",
          "submitted",
          "changes_requested",
          "approved",
          "published",
          "suspended",
        ].map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={filter === value ? "btn-primary" : "btn-ghost"}
          >
            {value === "all" ? "Бүгд" : value}
          </button>
        ))}
      </div>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      <div className="grid gap-4 xl:grid-cols-2">
        {visible.map((design) => (
          <article
            key={design.id}
            className="overflow-hidden rounded-2xl border border-black/10 bg-white"
          >
            <div className="relative h-56 bg-[#f1efe9]">
              {design.thumbnailUrl ? (
                <Image
                  src={design.thumbnailUrl}
                  alt={design.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-black/40">
                  Thumbnail байхгүй
                </div>
              )}
            </div>
            <div className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold">{design.title}</h2>
                  <p className="text-sm text-black/55">
                    {design.storeName} · v{design.versionNo}
                  </p>
                </div>
                <div className="text-right text-xs">
                  <div>{design.reviewStatus}</div>
                  <div className="text-black/45">
                    {design.publicationStatus}
                  </div>
                </div>
              </div>
              <p className="text-sm text-black/65">
                {design.description || design.shortDescription || "Тайлбаргүй"}
              </p>
              {design.media.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {design.media
                    .filter((item) => !item.isPrimary)
                    .map((item) => (
                      <div
                        key={item.id}
                        className="relative h-20 w-28 shrink-0 overflow-hidden rounded-lg bg-black/5"
                      >
                        <Image
                          src={item.url}
                          alt={item.altText || design.title}
                          fill
                          className="object-cover"
                        />
                        <span className="absolute bottom-1 left-1 rounded bg-black/65 px-1.5 py-0.5 text-[9px] text-white">
                          {item.source === "ai" ? "AI render" : item.kind}
                        </span>
                      </div>
                    ))}
                </div>
              )}
              <dl className="grid grid-cols-2 gap-2 rounded-xl bg-black/[0.03] p-3 text-xs">
                <div>
                  <dt className="text-black/45">Өрөө</dt>
                  <dd>
                    {design.roomWidthMm}×{design.roomDepthMm}×
                    {design.maxHeightMm} мм
                  </dd>
                </div>
                <div>
                  <dt className="text-black/45">Шүүгээ</dt>
                  <dd>{design.cabinetCount}</dd>
                </div>
                <div>
                  <dt className="text-black/45">Үнэ</dt>
                  <dd>
                    {design.priceFrom == null
                      ? "Үнийн санал"
                      : `${design.priceFrom.toLocaleString()} ₮-с`}
                  </dd>
                </div>
                <div>
                  <dt className="text-black/45">Хугацаа</dt>
                  <dd>
                    {design.leadTimeDays
                      ? `${design.leadTimeDays} хоног`
                      : "Тодорхойгүй"}
                  </dd>
                </div>
              </dl>
              {design.reviewStatus === "submitted" && (
                <>
                  <textarea
                    className="input min-h-20 w-full"
                    aria-label={`${design.title} хяналтын тайлбар`}
                    placeholder="Merchant-д өгөх тайлбар"
                    maxLength={5000}
                    value={note[design.id] ?? ""}
                    onChange={(event) =>
                      setNote((current) => ({
                        ...current,
                        [design.id]: event.target.value,
                      }))
                    }
                  />
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn-primary"
                      disabled={!!busy}
                      onClick={() => void review(design, "approved")}
                    >
                      <Check size={15} />
                      Зөвшөөрөх
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={!!busy}
                      onClick={() => void review(design, "changes_requested")}
                    >
                      <RotateCcw size={15} />
                      Засвар хүсэх
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={!!busy}
                      onClick={() => void review(design, "rejected")}
                    >
                      <X size={15} />
                      Татгалзах
                    </button>
                  </div>
                </>
              )}
              {design.publicationStatus === "published" && (
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={!!busy}
                  onClick={() => void review(design, "unpublished")}
                >
                  <EyeOff size={15} />
                  Marketplace-с буулгах
                </button>
              )}
            </div>
          </article>
        ))}
        {visible.length === 0 && (
          <p className="rounded-2xl border border-dashed border-black/15 p-8 text-sm text-black/55">
            Энэ төлөвт загвар байхгүй.
          </p>
        )}
      </div>
    </section>
  );
}
