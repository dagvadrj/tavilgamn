"use client";

import { startTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, RotateCw } from "lucide-react";

/**
 * Error state for a streamed page or section. «Дахин оролдох» refetches the
 * server data (router.refresh) and re-renders the failed boundary (reset).
 */
export function RetryError({
  reset,
  title = "Мэдээллийг ачаалж чадсангүй",
  compact = false,
}: {
  reset: () => void;
  title?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  return (
    <section
      className={`retry-error${compact ? " retry-error--compact" : ""}`}
      role="alert"
    >
      <CircleAlert size={compact ? 20 : 26} aria-hidden="true" />
      <h2>{title}</h2>
      <p>Холболт удаан эсвэл түр алдаа гарлаа. Дахин оролдоно уу.</p>
      <button
        type="button"
        className="btn-primary"
        onClick={() =>
          startTransition(() => {
            router.refresh();
            reset();
          })
        }
      >
        <RotateCw size={17} aria-hidden="true" />
        Дахин оролдох
      </button>
    </section>
  );
}
