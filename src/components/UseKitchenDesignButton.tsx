"use client";
import { startPlannerNavigation } from "@/lib/plannerNavigation";

import { useEffect, useRef, useState } from "react";
import { Copy, LoaderCircle, Sofa } from "lucide-react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";

export function UseKitchenDesignButton({
  designId,
  returnPath,
  target = "kitchen",
}: {
  designId: string;
  returnPath: string;
  /** "room" copies the design and drops it straight into the user's room plan. */
  target?: "kitchen" | "room";
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
      const id = encodeURIComponent(body.kitchen.id);
      const href = target === "room" ? `/planner?kitchen=${id}&fitRoom=1` : `/kitchen?design=${id}`;
      startPlannerNavigation(href);
      router.push(href);
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
        className={`${target === "room" ? "btn-ghost" : "btn-primary"} w-full disabled:cursor-wait disabled:opacity-60`}
        disabled={!initialized || busy}
        onClick={() => void handleUseDesign()}
      >
        {busy ? (
          <LoaderCircle className="animate-spin" size={16} />
        ) : target === "room" ? (
          <Sofa size={16} />
        ) : (
          <Copy size={16} />
        )}
        {busy ? "Хуулж байна…" : target === "room" ? "Өрөөндөө байрлуулж үзэх" : "Гал тогооны planner-т турших"}
      </button>
      {error ? (
        <p className="mt-2 text-xs leading-5 text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
