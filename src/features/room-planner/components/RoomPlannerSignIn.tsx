"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogIn } from "lucide-react";
import { useAuth } from "@/store/auth";
import { prepareRoomAuthReturn } from "@/store/designs";
import { loginPathForDestination } from "@/lib/authRedirect";

export function RoomPlannerSignIn() {
  const user = useAuth((state) => state.user),
    router = useRouter();
  const [error, setError] = useState("");
  if (user) return null;
  return (
    <div className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        className="btn-ghost min-h-11"
        aria-label="Нэвтэрч үргэлжлүүлэх"
        onClick={() => {
          try {
            setError("");
            router.push(loginPathForDestination(prepareRoomAuthReturn()));
          } catch (reason) {
            setError(
              reason instanceof Error
                ? reason.message
                : "Загварыг хадгалж чадсангүй.",
            );
          }
        }}
      >
        <LogIn size={16} />
        <span>Нэвтэрч үргэлжлүүлэх</span>
      </button>
      {error && (
        <span className="max-w-xs text-xs text-red-700" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
