"use client";

import { AlertTriangle, SearchX, Store } from "lucide-react";

/** Real card proportions so nothing jumps when the catalog arrives (B1.1). */
export function RoomCatalogSkeleton() {
  return (
    <div
      className="room-catalog-skeleton"
      role="status"
      aria-busy="true"
      aria-label="Тавилга ачаалж байна…"
    >
      <div className="room-skeleton-chips" aria-hidden="true">
        {[52, 72, 96, 64].map((width) => (
          <span key={width} style={{ width }} />
        ))}
      </div>
      <div className="room-catalog-grid" aria-hidden="true">
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="room-skeleton-card">
            <span />
            <span />
            <span />
            <span />
          </div>
        ))}
      </div>
    </div>
  );
}

/** Only the catalog section fails; tabs and the scene keep working (B1.2). */
export function RoomCatalogError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="room-panel-empty is-error" role="alert">
      <AlertTriangle size={22} aria-hidden="true" />
      <strong>Каталог ачаалагдсангүй</strong>
      <p>
        {/[А-Яа-яӨөҮүЁё]/.test(message)
          ? message
          : "Сүлжээний холболтоо шалгаад дахин оролдоно уу."}{" "}
        Өрөө, нэмсэн тавилга, сагс хэвийн ажилласаар байна.
      </p>
      <button type="button" className="is-primary" onClick={onRetry}>
        Дахин оролдох
      </button>
    </div>
  );
}

/**
 * B1.3 (a search found nothing) and B1.4 (the room or store has no products)
 * have different causes, so they say different things and offer different exits.
 */
export function RoomCatalogEmpty({
  query,
  category,
  elsewhere,
  scope,
  merchant,
  onAllCategories,
  onClearQuery,
  onAllStores,
  onReset,
}: {
  query: string;
  /** Active category label, or null for «Бүгд». */
  category: string | null;
  /** Matches for the same search in every category. */
  elsewhere: number;
  /** Labels of the narrowing room/store filters that are active. */
  scope: string | null;
  merchant: string | null;
  onAllCategories: () => void;
  onClearQuery: () => void;
  onAllStores: () => void;
  onReset: () => void;
}) {
  if (query.trim())
    return (
      <div className="room-panel-empty" role="status">
        <SearchX size={22} aria-hidden="true" />
        <strong>«{query.trim()}» олдсонгүй</strong>
        <p>
          {category && elsewhere > 0
            ? `«${category}» ангилалд алга. Бусад ангилалд ${elsewhere} илэрц байна.`
            : "Өөр үгээр хайж эсвэл шүүлтүүрээ өөрчилж үзнэ үү."}
        </p>
        <div className="room-panel-empty-actions">
          {category && elsewhere > 0 && (
            <button
              type="button"
              className="is-primary"
              onClick={onAllCategories}
            >
              Бүх ангилалд харах
            </button>
          )}
          <button type="button" onClick={onClearQuery}>
            Хайлт арилгах
          </button>
        </div>
      </div>
    );
  const where = [scope, merchant].filter(Boolean).join(" · ");
  return (
    <div className="room-panel-empty" role="status">
      <Store size={22} aria-hidden="true" />
      <strong>
        {where ? `${where}-д 3D бараа алга` : "Каталогт одоогоор бараа алга"}
      </strong>
      <p>
        {where
          ? "Энэ сонголтод өрөөнд байрлуулах бараа хараахан нэмэгдээгүй байна."
          : "Дэлгүүрүүд бараагаа нэмэхэд энд харагдана."}
      </p>
      <div className="room-panel-empty-actions">
        {(scope || merchant) && (
          <button type="button" className="is-primary" onClick={onAllStores}>
            Бүх дэлгүүрээс харах
          </button>
        )}
        {(category || !where) && (
          <button type="button" onClick={onReset}>
            Шүүлтүүр цэвэрлэх
          </button>
        )}
      </div>
    </div>
  );
}
