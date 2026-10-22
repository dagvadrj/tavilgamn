/** Non-interactive placeholders. The parent owns the single live loading announcement. */
type SkeletonField =
  string | { readonly label: string; readonly kind: "textarea" | "checkbox" };
export function SkeletonFields({
  fields,
  columns = 1,
}: {
  fields: readonly SkeletonField[];
  columns?: number;
}) {
  return (
    <div
      className={`page-skeleton-fields${columns > 1 ? " page-skeleton-fields--columns" : ""}`}
      aria-hidden="true"
    >
      {fields.map((field) => (
        <div
          className={`skeleton-form-field${typeof field === "string" ? "" : ` skeleton-form-field--${field.kind}`}`}
          key={typeof field === "string" ? field : field.label}
        >
          <span className="skeleton-field-label">
            {typeof field === "string" ? field : field.label}
          </span>
          <div className="skeleton-block skeleton-field" />
        </div>
      ))}
    </div>
  );
}
export function SkeletonLines({ count = 2 }: { count?: number }) {
  return (
    <div className="skeleton-lines" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className={`skeleton-block skeleton-line${i === 0 ? " skeleton-line--title" : i === count - 1 ? " skeleton-line--short" : ""}`}
        />
      ))}
    </div>
  );
}
export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <div className="skeleton-rows" aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <div className="skeleton-row" key={i}>
          <div className="skeleton-block skeleton-row-photo" />
          <SkeletonLines />
          <div className="skeleton-block skeleton-control" />
        </div>
      ))}
    </div>
  );
}
