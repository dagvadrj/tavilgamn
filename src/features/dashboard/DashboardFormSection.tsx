"use client";

import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function DashboardFormSection({
  title,
  description,
  children,
  optional = false,
  defaultOpen = !optional,
  className = "",
}: {
  title: string;
  description?: string;
  children: ReactNode;
  optional?: boolean;
  defaultOpen?: boolean;
  className?: string;
}) {
  return (
    <details
      className={`dashboard-form-section ${className}`}
      open={defaultOpen || undefined}
    >
      <summary>
        <span>
          <strong>{title}</strong>
          {description && <small>{description}</small>}
        </span>
        {optional && (
          <span className="dashboard-form-optional">Сонголттой</span>
        )}
        <ChevronDown size={18} aria-hidden="true" />
      </summary>
      <div className="dashboard-form-section-body">{children}</div>
    </details>
  );
}
