import { BrandLoader } from "@/components/BrandLoader";
import {
  SkeletonFields,
  SkeletonLines,
  SkeletonRows,
} from "@/components/loading/SkeletonParts";
import {
  loadingForms,
  type LoadingForm,
} from "@/components/loading/loadingForms";

export type SkeletonVariant =
  "home" | "catalog" | "detail" | "dashboard" | "planner" | "form";
export type SkeletonLayout =
  | SkeletonVariant
  | LoadingForm
  | "status"
  | "cart"
  | "order"
  | "account"
  | "stores"
  | "kitchens"
  | "store"
  | "room-start"
  | "kitchen-planner"
  | "viewport"
  | "list"
  | "rows"
  | "cards"
  | "kitchen-detail"
  | "metrics"
  | "board"
  | "document";

/** Choose the destination's shape. Never infer a large hero for an unknown page. */
export function PageSkeleton({
  variant,
  layout = variant ?? "status",
  label = "Хуудсыг ачаалж байна…",
  compact = false,
}: {
  variant?: SkeletonVariant;
  layout?: SkeletonLayout;
  label?: string;
  compact?: boolean;
}) {
  const form = Object.hasOwn(loadingForms, layout)
    ? loadingForms[layout as LoadingForm]
    : null;
  const catalog = ["catalog", "stores", "kitchens", "store", "cards"].includes(
    layout,
  );
  const editor = ["planner", "kitchen-planner", "viewport"].includes(layout);
  return (
    <div
      className={`page-skeleton page-skeleton--${layout}${compact ? " page-skeleton--compact" : ""}`}
      data-loading-layout={layout}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <span className="sr-only">{label}</span>
      <div className="page-skeleton-status" aria-hidden="true">
        <BrandLoader />
        <span>{label}</span>
      </div>
      <div className="page-skeleton-layout" aria-hidden="true">
        <div className="page-skeleton-body">
          {form ? (
            <>
              <h1 className="skeleton-heading">{form.title}</h1>
              {"social" in form && form.social && (
                <div className="skeleton-social">
                  <div className="skeleton-block skeleton-field" />
                  <div className="skeleton-block skeleton-field" />
                </div>
              )}
              <div
                className={
                  layout === "checkout" ? "skeleton-summary" : undefined
                }
              >
                <SkeletonFields
                  fields={form.fields}
                  columns={"columns" in form ? form.columns : 1}
                />
                {layout === "checkout" && <SkeletonRows count={2} />}
              </div>
              <div className="skeleton-block skeleton-button" />
            </>
          ) : layout === "status" ? null : layout === "room-start" ? (
            <>
              <div className="skeleton-toolbar">
                <SkeletonLines count={1} />
                <div className="skeleton-block skeleton-control" />
              </div>
              <h1 className="skeleton-heading">Өөрийн орчныг бүтээе</h1>
              <div className="skeleton-room-choice">
                <div className="skeleton-room-card">
                  <div className="skeleton-block skeleton-plan" />
                  <SkeletonLines count={2} />
                  <SkeletonFields fields={["Өрөөний зориулалт"]} />
                  <div className="skeleton-block skeleton-button" />
                </div>
                <div className="skeleton-room-card">
                  <div className="skeleton-block skeleton-plan" />
                  <SkeletonLines count={3} />
                  <div className="skeleton-block skeleton-button" />
                </div>
              </div>
              <SkeletonLines count={2} />
            </>
          ) : editor ? (
            <div className="skeleton-editor">
              <div className="skeleton-toolbar">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="skeleton-block skeleton-control" />
                ))}
              </div>
              <div className="skeleton-editor-body">
                <div className="skeleton-block skeleton-viewport" />
                <div className="skeleton-editor-fields">
                  <SkeletonFields fields={["Өргөн", "Гүн", "Өндөр"]} />
                  <div className="skeleton-block skeleton-button" />
                </div>
              </div>
              <div className="skeleton-toolbar">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton-block skeleton-control" />
                ))}
              </div>
            </div>
          ) : layout === "detail" || layout === "kitchen-detail" ? (
            <div className="skeleton-product">
              <div className="skeleton-block skeleton-product-image" />
              <div>
                <SkeletonLines count={3} />
                {layout === "detail" ? <SkeletonFields fields={["Өнгө / Материал", "Тоо хэмжээ"]} /> : <SkeletonLines count={4} />}
                <div className="skeleton-block skeleton-button" />
              </div>
            </div>
          ) : layout === "cart" || layout === "order" ? (
            <>
              <h1 className="skeleton-heading">
                {layout === "cart" ? "Миний сагс" : "Захиалгын мэдээлэл"}
              </h1>
              <div className="skeleton-summary">
                <SkeletonRows count={2} />
                <div>
                  <SkeletonLines count={3} />
                  <div className="skeleton-block skeleton-button" />
                </div>
              </div>
            </>
          ) : layout === "account" ? (
            <>
              <h1 className="skeleton-heading">Миний бүртгэл</h1>
              <SkeletonFields fields={["Нэр", "Имэйл", "Утас"]} columns={2} />
              <SkeletonRows count={2} />
            </>
          ) : layout === "document" ? (
            <>
              <SkeletonLines count={2} />
              <SkeletonLines count={6} />
              <div className="skeleton-block skeleton-button" />
            </>
          ) : layout === "board" ? (
            <div className="skeleton-board">
              {[0, 1, 2].map((i) => (
                <div key={i}>
                  <SkeletonLines count={1} />
                  <SkeletonRows count={3} />
                </div>
              ))}
            </div>
          ) : layout === "dashboard" || layout === "metrics" ? (
            <>
              <SkeletonLines count={1} />
              <div className="skeleton-stats">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="skeleton-stat">
                    <SkeletonLines count={2} />
                  </div>
                ))}
              </div>
              <SkeletonRows count={3} />
            </>
          ) : layout === "rows" ? (
            <SkeletonRows count={4} />
          ) : layout === "list" ? (
            <>
              <SkeletonFields fields={["Хайх", "Ангилал"]} columns={2} />
              <SkeletonRows count={4} />
            </>
          ) : catalog ? (
            <>
              {layout === "store" && <SkeletonLines count={2} />}
              {layout !== "cards" && (
                <SkeletonFields fields={["Хайх", "Ангилал"]} columns={2} />
              )}
              <div className="page-skeleton-grid">
                {Array.from({ length: compact ? 2 : 4 }, (_, i) => (
                  <div className="page-skeleton-card" key={i}>
                    <div className="skeleton-block page-skeleton-photo" />
                    <SkeletonLines count={2} />
                  </div>
                ))}
              </div>
            </>
          ) : layout === "home" ? (
            <>
              <div className="skeleton-block page-skeleton-hero" />
              <SkeletonLines count={2} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
