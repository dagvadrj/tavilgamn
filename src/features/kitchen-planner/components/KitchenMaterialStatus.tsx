"use client";
import { useKitchenAppearanceStatus, type KitchenAppearance } from "@/store/kitchenAppearanceStatus";

export type KitchenMaterialScope = "selected" | "all";

/** K4 scope: the selected instance, or every cabinet the material fits. */
export function KitchenMaterialScopeToggle({
  scope,
  onScope,
  count,
}: {
  scope: KitchenMaterialScope;
  onScope: (scope: KitchenMaterialScope) => void;
  count: number;
}) {
  return (
    <div className="kitchen-k-scope">
      <div className="kitchen-k-segmented" role="group" aria-label="Хамрах хүрээ">
        <button type="button" aria-pressed={scope === "selected"} onClick={() => onScope("selected")}>
          Сонгосон модуль
        </button>
        <button type="button" aria-pressed={scope === "all"} onClick={() => onScope("all")}>
          Бүх тохирох · {count}
        </button>
      </div>
      <p className="kitchen-k-muted">
        {scope === "all"
          ? `Нүүр, их биеийн материал ${count} шүүгээнд хамт солигдоно.`
          : "Зөвхөн сонгосон модулийн материал солигдоно."}
      </p>
    </div>
  );
}

/**
 * K4 load state across the cabinets: pending keeps the previous model
 * (dimmed), an error keeps it in full with retry and revert.
 */
export function KitchenMaterialStatus({
  onRevert,
}: {
  onRevert: (previous: Record<string, KitchenAppearance>) => void;
}) {
  const byCabinet = useKitchenAppearanceStatus((state) => state.byCabinet);
  const previous = useKitchenAppearanceStatus((state) => state.previous);
  const ids = Object.keys(byCabinet);
  const failed = ids.filter((id) => byCabinet[id] === "error");
  if (failed.length)
    return (
      <div className="kitchen-k-banner is-error" role="alert">
        <strong>Материал ачаалагдсангүй · {failed.length} модуль</strong>
        <span>Өмнөх зөв загвар харагдсаар байна. Үнэ өөрчлөгдөөгүй; «Буцаах» нь өмнөх материалыг сэргээнэ.</span>
        <div className="kitchen-k-banner-actions">
          <button
            type="button"
            className="kitchen-k-primary"
            onClick={() => failed.forEach((id) => useKitchenAppearanceStatus.getState().retry(id))}
          >
            Дахин оролдох
          </button>
          <button
            type="button"
            className="kitchen-k-secondary"
            onClick={() => onRevert(Object.fromEntries(failed.map((id) => [id, previous[id] ?? {}])))}
          >
            Буцаах
          </button>
        </div>
      </div>
    );
  if (ids.length)
    return (
      <p className="kitchen-k-banner" role="status">
        Шинэ материал ачаалж байна · {ids.length} модуль — өмнөх загвар харагдсаар
      </p>
    );
  return null;
}
