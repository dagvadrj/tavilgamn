"use client";
import { startPlannerNavigation } from "@/lib/plannerNavigation";

import { useEffect, useRef, useState } from "react";
import { Copy, LoaderCircle, Sofa } from "lucide-react";
import { useRouter } from "next/navigation";
import { authFetch } from "@/lib/authFetch";
import { useAuth } from "@/store/auth";
import { useKitchens } from "@/store/kitchens";
import { parseKitchen, type SavedKitchen } from "@/lib/kitchenAssembly";
import { placeKitchenInRoom, type KitchenFootprint } from "@/lib/kitchenRoomChoice";
import { KitchenRoomPicker } from "@/components/KitchenRoomPicker";

const CLONE_FAILED = "Загварыг өөрийн төсөлд хуулж чадсангүй.";

export function UseKitchenDesignButton({
  designId,
  returnPath,
  target = "kitchen",
  footprint,
}: {
  designId: string;
  returnPath: string;
  /** "room" copies the design and drops it straight into the user's room plan. */
  target?: "kitchen" | "room";
  /** Outer size of the design; with it the kitchen target first asks which room to use. */
  footprint?: KitchenFootprint;
}) {
  const router = useRouter();
  const user = useAuth((state) => state.user);
  const initialized = useAuth((state) => state.initialized);
  const initialize = useAuth((state) => state.initialize);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [picking, setPicking] = useState(false);
  const projectId = useRef<string | null>(null);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  const cloneDesign = async (userId: string) => {
    projectId.current ??= crypto.randomUUID();
    const response = await authFetch(
      `/api/kitchen-designs/${encodeURIComponent(designId)}/clone`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: projectId.current }),
      },
      userId,
    );
    const body = await response.json().catch(() => null);
    if (!response.ok || typeof body?.kitchen?.id !== "string") {
      throw new Error(body?.error ?? CLONE_FAILED);
    }
    return body.kitchen as { id: string; name: string; design: unknown };
  };

  /** Copies the design, optionally into one of the buyer's rooms, then opens it. */
  const openDesign = async (room?: SavedKitchen) => {
    if (!initialized || busy) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }

    setBusy(room?.id ?? "new");
    setError("");
    try {
      const kitchen = await cloneDesign(user.id);
      if (room) {
        const placed = placeKitchenInRoom(parseKitchen(kitchen.design), room.design.room);
        if (!placed) throw new Error("Гарнитур энэ өрөөнд багтахгүй байна.");
        // A fresh copy is revision 1; saving also puts it in the planner's library.
        const saved = await useKitchens.getState().save(kitchen.id, kitchen.name, placed, 1);
        if (!saved) throw new Error(useKitchens.getState().error || CLONE_FAILED);
      }
      const id = encodeURIComponent(kitchen.id);
      const href = target === "room" ? `/planner?kitchen=${id}&fitRoom=1` : `/kitchen?design=${id}`;
      startPlannerNavigation(href);
      router.push(href);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : CLONE_FAILED);
      setBusy(null);
    }
  };

  const handleClick = () => {
    if (!initialized || busy) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(returnPath)}`);
      return;
    }
    if (target === "kitchen" && footprint) {
      setError("");
      setPicking(true);
      return;
    }
    void openDesign();
  };

  return (
    <div>
      <button
        type="button"
        className={`${target === "room" ? "btn-ghost" : "btn-primary"} w-full disabled:cursor-wait disabled:opacity-60`}
        disabled={!initialized || !!busy}
        onClick={handleClick}
      >
        {busy && !picking ? (
          <LoaderCircle className="animate-spin" size={16} />
        ) : target === "room" ? (
          <Sofa size={16} />
        ) : (
          <Copy size={16} />
        )}
        {busy && !picking ? "Хуулж байна…" : target === "room" ? "Өрөөндөө байрлуулж үзэх" : "Гал тогооны planner-т турших"}
      </button>
      {error && !picking ? (
        <p className="mt-2 text-xs leading-5 text-red-700" role="alert">
          {error}
        </p>
      ) : null}
      {picking && footprint ? (
        <KitchenRoomPicker
          footprint={footprint}
          busy={busy}
          error={error}
          onClose={() => setPicking(false)}
          onNewRoom={() => void openDesign()}
          onRoom={(room) => void openDesign(room)}
        />
      ) : null}
    </div>
  );
}
