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

/** Authored catalog data must fail visibly instead of silently becoming floor-only. */
export function parsePlannerPlacement(raw: unknown): PlacementMetadata {
    if (typeof raw === "string") { try { raw = JSON.parse(raw); } catch { raw = null; } }
    const fail = () => { throw new Error("Тавилгын байрлуулах гадаргууны тохиргоо буруу байна."); };
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail();
    const value = raw as Record<string, unknown>;
    if (Object.keys(value).some(key => !["surfaces", "defaultElevation", "gap", "supportSurfaces"].includes(key))) return fail();
    if (!Array.isArray(value.surfaces) || !value.surfaces.length || value.surfaces.length > 3 || value.surfaces.some(s => !["floor", "wall", "surface"].includes(s))) return fail();
    const number = (v: unknown, max: number, positive = false) => typeof v === "number" && Number.isFinite(v) && (positive ? v > 0 : v >= 0) && v <= max;
    if (value.defaultElevation !== undefined && !number(value.defaultElevation, 100)) return fail();
    if (value.gap !== undefined && !number(value.gap, .2)) return fail();
    if (value.supportSurfaces !== undefined) {
        if (!Array.isArray(value.supportSurfaces) || value.supportSurfaces.length > 8) return fail();
        const ids = new Set<string>();
        for (const rawSurface of value.supportSurfaces) {
            if (!rawSurface || typeof rawSurface !== "object" || Array.isArray(rawSurface)) return fail();
            const s = rawSurface as Record<string, unknown>;
            if (Object.keys(s).some(key => !["id", "width", "depth", "elevation"].includes(key)) || typeof s.id !== "string" || !/^[a-zA-Z0-9_-]{1,40}$/.test(s.id) || ids.has(s.id) || !number(s.width,100,true) || !number(s.depth,100,true) || !number(s.elevation,100)) return fail();
            ids.add(s.id);
        }
    }
    const result = normalizePlacementMetadata(value);
    if (JSON.stringify(result).length > 300) return fail();
    return result;
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
