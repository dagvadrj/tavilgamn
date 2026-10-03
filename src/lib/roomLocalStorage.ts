import type { RoomDesign } from "./types";
import { parseRoomDesign, UUID_PATTERN } from "./roomProjectValidation";
export type RoomCloudLink = { id: string; revision: number; signature: string };
const blocked = new Set<string>(), errors = new Map<string, string>();
export function readRoomLocalState(raw: string) {
  const payload = JSON.parse(raw), state = payload?.state;
  if (!state || (state.schemaVersion !== undefined && state.schemaVersion !== 1) || (payload.version !== undefined && payload.version !== 0))
    throw new Error("Хуучин local өгөгдлийн хувилбарыг editor дэмжихгүй. Эх өгөгдлийг өөрчлөхгүй.");
  if (state.designs !== undefined && (!Array.isArray(state.designs) || state.designs.length > 200)) throw new Error("Local загварын жагсаалт буруу байна.");
  const designs: RoomDesign[] = (state.designs ?? []).map(parseRoomDesign), current: RoomDesign | null = state.current ? parseRoomDesign(state.current) : null;
  const cloudLinks: Record<string, RoomCloudLink> = {};
  if (state.cloudLinks !== undefined) {
    if (!state.cloudLinks || typeof state.cloudLinks !== "object" || Array.isArray(state.cloudLinks)) throw new Error("Local project холбоос буруу байна.");
    for (const [key, v] of Object.entries(state.cloudLinks as Record<string, RoomCloudLink>)) {
      if (key === "__proto__" || !v || !UUID_PATTERN.test(v.id) || !Number.isSafeInteger(v.revision) || v.revision < 0 || typeof v.signature !== "string")
        throw new Error("Local project холбоос буруу байна.");
      cloudLinks[key] = { id: v.id, revision: v.revision, signature: v.signature };
    }
  }
  return { designs, current, cloudLinks };
}
function report(key: string, error: string) {
  if (error) errors.set(key, error); else errors.delete(key);
  if (typeof window !== "undefined" && typeof window.dispatchEvent === "function" && typeof CustomEvent !== "undefined")
    window.dispatchEvent(new CustomEvent("room-storage-status", { detail: key }));
}
export const roomStorage = {
  getItem(key: string): string | null {
    if (typeof window === "undefined") return null;
    try { const raw = window.localStorage.getItem(key); if (raw) readRoomLocalState(raw); return raw; }
    catch { blocked.add(key); report(key, "Local өгөгдөл уншигдсангүй. Эх файлыг дарахгүй; шинэ ажил editor-д байна. Backup татаж авах эсвэл cloud-д хадгална уу."); return null; }
  },
  setItem(key: string, value: string) {
    if (typeof window === "undefined" || blocked.has(key)) return;
    try { window.localStorage.setItem(key, value); if (errors.has(key)) report(key, ""); }
    catch { report(key, "Энэ төхөөрөмжид хадгалах зай эсвэл эрх хүрэлцэхгүй байна. Draft editor-д хэвээр; JSON татах эсвэл cloud-д хадгална уу."); }
  },
  removeItem(key: string) { if (typeof window !== "undefined" && !blocked.has(key)) window.localStorage.removeItem(key); },
};
export const roomStorageError = (key: string) => errors.get(key) ?? "";
export function downloadRoomJson(value: unknown, filename = "room-draft.json") {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = filename; anchor.click(); URL.revokeObjectURL(url);
}
export function localRoomImportCandidates(userId: string) {
  const candidates = new Map<string, { design: RoomDesign; source: string }>(), warnings: string[] = [];
  for (const [key, source] of [[`casa-designs-${userId}`, "Энэ бүртгэл"], ["casa-designs-guest", "Зочны загвар"], ["casa-designs", "Хуучин загвар"]]) {
    try {
      const raw = window.localStorage.getItem(key); if (!raw) continue;
      const saved = readRoomLocalState(raw);
      for (const design of [...saved.designs, ...(saved.current ? [saved.current] : [])]) {
        if (!candidates.has(design.id) || source === "Энэ бүртгэл") candidates.set(design.id, { design, source });
      }
    } catch { warnings.push(`${source}: уншигдахгүй өгөгдлийг импортлоогүй. Local эх хувилбар хэвээр байна.`); }
  }
  return { items: [...candidates.values()], warnings };
}
