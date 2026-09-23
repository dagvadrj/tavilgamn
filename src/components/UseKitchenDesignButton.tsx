"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";

export function UseKitchenDesignButton({
  designId,
  returnPath,
}: {
  designId: string;
  returnPath: string;
}) {
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const initialized = useAuth((state) => state.initialized);
  const initialize = useAuth((state) => state.initialize);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const projectId = useRef<string | null>(null);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const handleUseDesign = async () => {
    if (!initialized || busy) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }

    setBusy(true);
    setError("");
    projectId.current ??= crypto.randomUUID();
    try {
      const response = await authFetch(
        `/api/kitchen-designs/${encodeURIComponent(designId)}/clone`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: projectId.current }),
        },
        user.id,
      );
      const body = await response.json().catch(() => null);
      if (!response.ok || typeof body?.kitchen?.id !== "string") {
        throw new Error(
          body?.error ?? "Загварыг өөрийн төсөлд хуулж чадсангүй.",
        );
      }
      router.push(`/kitchen?design=${encodeURIComponent(body.kitchen.id)}`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Загварыг өөрийн төсөлд хуулж чадсангүй.",
      );
      setBusy(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#293c32] px-5 text-sm font-medium text-white disabled:cursor-wait disabled:opacity-60"
        disabled={!initialized || busy}
        onClick={() => void handleUseDesign()}
      >
        {busy ? (
          <LoaderCircle className="animate-spin" size={16} />
        ) : (
          <Copy size={16} />
        )}
        {busy ? "Төсөл үүсгэж байна…" : "Өөрийн төсөлд ашиглах"}
      </button>
      {error ? (
        <p className="mt-2 text-xs leading-5 text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
