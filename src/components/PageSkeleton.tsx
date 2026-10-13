import { BrandLoader } from "@/components/BrandLoader";

export type SkeletonVariant =
  "home" | "catalog" | "detail" | "dashboard" | "planner" | "form";

export function PageSkeleton({
  variant = "home",
  label = "Хуудсыг ачаалж байна…",
  compact = false,
}: {
  variant?: SkeletonVariant;
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={`page-skeleton page-skeleton--${variant}${compact ? " page-skeleton--compact" : ""}`}
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
        {(variant === "dashboard" || variant === "planner") && (
          <div className="page-skeleton-sidebar">
            <div className="skeleton-block skeleton-line skeleton-line--title" />
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} className="skeleton-block skeleton-field" />
            ))}
          </div>
        )}
        <div className="page-skeleton-body">
          {(variant === "home" ||
            variant === "detail" ||
            variant === "planner") && (
            <div className="skeleton-block page-skeleton-hero" />
          )}
          <div className="page-skeleton-heading">
            <div className="skeleton-block skeleton-line skeleton-line--title" />
            <div className="skeleton-block skeleton-line skeleton-line--short" />
          </div>
          {variant === "form" ? (
            <div className="page-skeleton-fields">
              {[0, 1, 2, 3].map((index) => (
                <div key={index} className="skeleton-block skeleton-field" />
              ))}
              <div className="skeleton-block skeleton-button" />
            </div>
          ) : (
            <div className="page-skeleton-grid">
              {Array.from({ length: compact ? 2 : 4 }, (_, index) => (
                <div className="page-skeleton-card" key={index}>
                  <div className="skeleton-block page-skeleton-photo" />
                  <div className="skeleton-block skeleton-line" />
                  <div className="skeleton-block skeleton-line skeleton-line--short" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
