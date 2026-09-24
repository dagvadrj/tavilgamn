"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Ruler } from "lucide-react";
import { useMemo } from "react";
import type { ModularKitchen } from "@/lib/kitchenCabinets";
import { assessKitchenRoomFit } from "@/lib/kitchenRoomFit";
import { useDesigns } from "@/store/designs";

export function KitchenRoomFitStatus({
  kitchen,
  name,
}: {
  kitchen: ModularKitchen;
  name: string;
}) {
  const room = useDesigns((state) => state.current);
  const fit = useMemo(
    () =>
      room
        ? assessKitchenRoomFit(
            { id: "fit-preview", name, design: kitchen },
            room.pieces,
            room,
          )
        : null,
    [kitchen, name, room],
  );

  if (!room) {
    return (
      <div className="km-room-fit km-room-fit-empty" role="status">
        <Ruler aria-hidden="true" size={20} />
        <div>
          <strong>Шалгах өрөө сонгоогүй байна</strong>
          <p>Өрөө төлөвлөгч дээр хэмжээгээ оруулаад багтах эсэхийг шалгана.</p>
        </div>
        <Link href="/planner">Өрөө үүсгэх</Link>
      </div>
    );
  }

  const fits = fit?.code === "fits";
  return (
    <div
      className={`km-room-fit ${fits ? "km-room-fit-ok" : "km-room-fit-warning"}`}
      role="status"
      aria-live="polite"
    >
      {fits ? (
        <CheckCircle2 aria-hidden="true" size={20} />
      ) : (
        <AlertTriangle aria-hidden="true" size={20} />
      )}
      <div>
        <strong>
          “{room.roomName?.trim() || room.name}” өрөө ·{" "}
          {fits ? "багтана" : "тохируулах шаардлагатай"}
        </strong>
        <p>{fit?.message}</p>
      </div>
      <Link href="/planner">Өрөө засах</Link>
    </div>
  );
}
