import type { PlacementMetadata, RoomType } from "./types";
/** Unknown or malformed metadata never promotes a floor object to wall-only. */
export function normalizePlacementMetadata(raw: unknown): PlacementMetadata {
    if (typeof raw === "string") {
        try {
            raw = JSON.parse(raw);
        }
        catch {
            raw = undefined;
        }
    }
    if (!raw || typeof raw !== "object")
        return { surfaces: ["floor"] };
    const value = raw as Record<string, unknown>;
    const allowed = new Set(["floor", "wall", "surface"]);
    const surfaces = Array.isArray(value.surfaces) ? [...new Set(value.surfaces.filter((s): s is PlacementMetadata["surfaces"][number] => typeof s === "string" && allowed.has(s)))] : [];
    const finite = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0;
    const supportSurfaces = Array.isArray(value.supportSurfaces) ? value.supportSurfaces.flatMap(rawSurface => {
        if (!rawSurface || typeof rawSurface !== "object")
            return [];
        const s = rawSurface as Record<string, unknown>;
        if (typeof s.id !== "string" || !s.id || !finite(s.width) || !finite(s.depth) || !finite(s.elevation) || !(Number(s.width) > 0 && Number(s.depth) > 0))
            return [];
        return [{ id: s.id, width: Number(s.width), depth: Number(s.depth), elevation: Number(s.elevation) }];
    }) : [];
    return { surfaces: surfaces.length ? surfaces : ["floor"], ...(finite(value.defaultElevation) ? { defaultElevation: Number(value.defaultElevation) } : {}), ...(finite(value.gap) ? { gap: Number(value.gap) } : {}), ...(supportSurfaces.length ? { supportSurfaces } : {}) };
}
export function normalizeRoomTypes(raw: unknown): RoomType[] | undefined {
    if (typeof raw === "string") {
        try {
            raw = JSON.parse(raw);
        }
        catch {
            return undefined;
        }
    }
    const rooms: RoomType[] = ["living", "bedroom", "kitchen", "office", "bathroom", "other"];
    return Array.isArray(raw) ? [...new Set(raw.filter((type): type is RoomType => rooms.includes(type)))] : undefined;
}

/** Writes reject invalid room IDs instead of silently widening catalog eligibility. */
export function parsePlannerRoomTypes(raw: unknown): RoomType[] {
    const normalized = normalizeRoomTypes(raw);
    let values = raw;
    if (typeof values === "string") {
        try { values = JSON.parse(values); } catch { values = null; }
    }
    if (!Array.isArray(values) || values.length > 6 || !normalized || values.some(value => !normalized.includes(value))) {
        throw new Error("Өрөөний сонголт буруу байна.");
    }
    return normalized;
}
