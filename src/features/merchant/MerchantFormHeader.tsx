import type { ReactNode } from "react";

export function MerchantFormHeader({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <div className="merchant-form-heading">
      <div>
        <span className="merchant-page-kicker">МЭДЭЭЛЭЛ ЗАСАХ</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      <div className="merchant-form-actions">{children}</div>
    </div>
  );
}
