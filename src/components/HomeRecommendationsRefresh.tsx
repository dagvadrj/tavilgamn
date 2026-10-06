"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { useCatalogStore } from "@/store/catalog";

export function HomeRecommendationsRefresh() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      <button
        type="button"
        className="market-refresh-button"
        aria-label="Тавилгын мэдээллийг шинэчлэх"
        title="Шинэчлэх"
        aria-busy={pending}
        disabled={pending}
        onClick={() => startTransition(async () => {
          setError(null);
          await useCatalogStore.getState().refresh(true);
          const refreshError = useCatalogStore.getState().error;
          if (refreshError) {
            setError(refreshError);
            return;
          }
          router.refresh();
        })}
      >
        <RefreshCw size={20} aria-hidden="true" className={pending ? "animate-spin" : undefined} />
      </button>
      {pending && <p className="sr-only" role="status">Тавилгын мэдээллийг шинэчилж байна…</p>}
      {error && <p className="market-refresh-error" role="alert">{error}</p>}
    </>
  );
}
