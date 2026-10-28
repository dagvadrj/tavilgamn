import type { RoomDesign } from "./types";
import { syncDesignRooms } from "./roomDesign";
import { plannerContentKey } from "./plannerContentKey";

/** Ignore capture/time metadata when comparing the working plan to its saved copy. */
export function roomContentKey(design: RoomDesign): string {
  const normalized = syncDesignRooms(design);
  return plannerContentKey({ id: normalized.id, name: normalized.name, size: normalized.size,
    rooms: normalized.rooms, connections: normalized.connections });
}

export function roomSaveStatus(current: RoomDesign, saved: RoomDesign | undefined, persisted: boolean | undefined) {
  if (persisted === undefined) return { kind: "checking", label: "Ажлын явцыг хадгалж байна…", detail: "Энэ төхөөрөмжийн хадгалалтыг шалгаж байна." };
  if (!persisted) return { kind: "error", label: "Төхөөрөмж дээр хадгалж чадсангүй", detail: "Browser-ийн хадгалах зай, зөвшөөрлийг шалгаад «Хадгалах» товчоор дахин оролдоно уу." };
  if (!saved) return { kind: "draft", label: "Ажлын явц энэ төхөөрөмж дээр үлдсэн", detail: "Нэр өгч «Хадгалах» дарвал хадгалсан загварууддаа нэмнэ. Өөр төхөөрөмжид автоматаар шилжихгүй." };
  if (roomContentKey(current) !== roomContentKey(saved)) return { kind: "modified", label: "Хадгалсан хувилбараас өөрчлөгдсөн", detail: "Одоогийн ажлын явц энэ төхөөрөмж дээр үлдсэн. «Хадгалах» дарвал нэртэй хувилбар шинэчлэгдэнэ." };
  return { kind: "saved", label: "Загвар энэ төхөөрөмж дээр хадгалагдсан", detail: "Хадгалсан загваруудаасаа дахин нээнэ. Өөр төхөөрөмжид автоматаар шилжихгүй." };
}

export type RoomSaveChip = { tone: "dirty" | "saving" | "saved" | "error"; label: string; retry: boolean };

/** Header chip. The cart is a separate store, so cart edits never mark the room dirty. */
export function roomSaveChip(kind: ReturnType<typeof roomSaveStatus>["kind"], savedAt: number | undefined): RoomSaveChip {
  if (kind === "checking") return { tone: "saving", label: "Хадгалж байна…", retry: false };
  if (kind === "error") return { tone: "error", label: "Хадгалж чадсангүй", retry: true };
  if (kind === "saved") {
    // 24-hour HH:MM by hand: browsers without mn-MN data fall back to «03:07 AM».
    const date = savedAt ? new Date(savedAt) : null;
    const time = date ? `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}` : null;
    return { tone: "saved", label: time ? `Хадгалсан · ${time}` : "Хадгалсан", retry: false };
  }
  return { tone: "dirty", label: "Хадгалаагүй өөрчлөлт", retry: false };
}
