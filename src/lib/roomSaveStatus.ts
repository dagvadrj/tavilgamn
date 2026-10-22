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
