import type { RoomShape, RoomSurfaces, RoomWall, RoomVertex } from "./types";
import { getRoomGeometry } from "./roomGeometry";
import { validateRoomOpenings } from "./roomOpenings";
import { roomTemplateOutline, transformRoomOutline, type RoomTemplate } from "./roomPolygon";
export type RoomBuilderDraft = RoomShape & RoomSurfaces & {
    wallColor: string;
    floorColor: string;
    height: number;
};
export const BUILDER_STAGES = ["Хэлбэр", "Хэмжээ", "Хаалга, цонх", "Хана, шал"];
export function builderInteraction(stage: number, ceiling = false) {
    return { view: (stage < 2 && !ceiling ? "plan" : "perspective") as "plan" | "perspective", orbit: stage >= 2 || ceiling, wallEditing: stage === 1 && !ceiling, openingEditing: stage === 2 };
}
export function createRoomBuilderDraft(room: RoomShape & Partial<RoomSurfaces & {
    wallColor: string;
    floorColor: string;
}>): RoomBuilderDraft {
    return structuredClone({ width: room.width, depth: room.depth, height: room.height ?? 2.7, outline: room.outline, wallFeatures: room.wallFeatures, columns: room.columns, openings: room.openings, wallColor: room.wallColor ?? "#EFE6D6", floorColor: room.floorColor ?? "#C9A37A", floorMaterial: room.floorMaterial ?? "parquet-oak", wallMaterials: room.wallMaterials, ceilingMaterial: room.ceilingMaterial, ceiling: room.ceiling, lighting: room.lighting });
}
export function chooseRoomTemplate(draft: RoomBuilderDraft, template: RoomTemplate): RoomBuilderDraft {
    return { ...draft, outline: roomTemplateOutline(template, draft.width, draft.depth), wallFeatures: [], columns: [], openings: [], wallMaterials: {}, wallColor: "#EFE6D6", floorColor: "#C9A37A", floorMaterial: "parquet-oak" };
}
export function resizeRoomBuilder(draft: RoomBuilderDraft, width: number, depth: number): RoomBuilderDraft {
    return { ...draft, width, depth, outline: draft.outline?.map(p => ({ ...p, x: p.x * width / draft.width, z: p.z * depth / draft.depth })), wallFeatures: draft.wallFeatures?.map(f => ({ ...f, offset: f.offset * (f.wall === "north" || f.wall === "south" ? width / draft.width : depth / draft.depth), length: f.length * (f.wall === "north" || f.wall === "south" ? width / draft.width : depth / draft.depth) })) };
}
export function transformRoomBuilder(draft: RoomBuilderDraft, transform: "flip-x" | "flip-z" | "rotate"): RoomBuilderDraft {
    if (draft.columns?.length)
        throw new Error("Багануудын байрлалыг эхлээд тохируулна уу.");
    const points: RoomVertex[] = draft.outline ?? getRoomGeometry(draft).loops[0].map((p, i) => ({ ...p, id: `legacy-v${i}`, segmentId: `legacy-s${i}` }));
    // Legacy openings are bound to their actual segment before any transformation.
    const openings = (draft.openings ?? []).map(o => {
        if (o.segmentId)
            return { ...o, position: transform === "rotate" ? o.position : Math.round((1 - o.position) * 1e12) / 1e12, hinge: transform === "rotate" ? o.hinge : o.hinge === "left" ? "right" as const : "left" as const };
        const index = ({ north: 0, east: 1, south: 2, west: 3 } as Record<RoomWall, number>)[o.wallId];
        if (points.length !== 4)
            throw new Error("Эхлээд нээлхийг ханын хэсэгт холбоно уу.");
        return { ...o, segmentId: points[index].segmentId, position: transform === "rotate" ? o.position : Math.round((1 - o.position) * 1e12) / 1e12, hinge: transform === "rotate" ? o.hinge : o.hinge === "left" ? "right" as const : "left" as const };
    });
    return { ...draft, width: transform === "rotate" ? draft.depth : draft.width, depth: transform === "rotate" ? draft.width : draft.depth, outline: transformRoomOutline(points, transform), openings, wallFeatures: [], columns: [] };
}
export function validateRoomBuilder(draft: RoomBuilderDraft) {
    return validateRoomOpenings(draft);
}
