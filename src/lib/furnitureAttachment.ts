import type { PlacedFurniture, RoomShape } from "./types";
import { getRoomGeometry, type RoomSegment } from "./roomGeometry";
import { dimsFor, findFreePlacement, isPlacementValid } from "@/three/collision";
import { openingWorldTransform } from "./roomOpenings";
import { normalizePlacementMetadata } from "./placementMetadata";
/** Legacy edge identity deliberately changes with its geometry; never rebind by index. */
export const furnitureWallId = (s: RoomSegment) => s.id ?? `edge:${s.a.x},${s.a.z}:${s.b.x},${s.b.z}`;
export function moveAttachedFurniture(piece: PlacedFurniture, x: number, z: number, room: RoomShape, roomId: string, pieces: PlacedFurniture[]): PlacedFurniture {
    const attachment=piece.attachment;
    if(attachment?.kind==="wall") {
        const wall=getRoomGeometry(room).segments.find(s=>furnitureWallId(s)===attachment.segmentId);
        if(!wall)throw new Error("Тавилгын холбогдсон хана олдсонгүй.");
        const along=((x-wall.a.x)*(wall.b.x-wall.a.x)+(z-wall.a.z)*(wall.b.z-wall.a.z))/wall.length;
        return wallAttachedPiece(piece,room,roomId,attachment.segmentId,along,attachment.elevation);
    }
    if(attachment?.kind==="surface") {
        const parent=pieces.find(p=>p.instanceId===attachment.parentInstanceId);
        if(!parent)throw new Error("Тулгуур тавилга олдсонгүй.");
        const dx=x-parent.x,dz=z-parent.z,cos=Math.cos(parent.rotation),sin=Math.sin(parent.rotation);
        const candidate={...piece,attachment:{...attachment,localPosition:[dx*cos-dz*sin,attachment.localPosition[1],dx*sin+dz*cos] as [number,number,number]}};
        return resolveFurnitureAttachments(pieces.map(p=>p.instanceId===piece.instanceId?candidate:p),room,roomId,piece.instanceId)[0];
    }
    return {...piece,x,z,...(attachment?.kind==="floor"?{attachment:{...attachment,x,z}}:{})};
}
export function wallAttachedPiece(piece: PlacedFurniture, room: RoomShape, roomId: string, segmentId: string, along: number, elevation: number): PlacedFurniture {
    const wall = getRoomGeometry(room).segments.find(s => !s.hole && furnitureWallId(s) === segmentId);
    if (!wall)
        throw new Error("Тавилгын холбогдсон хана өөрчлөгдсөн. Ханыг дахин сонгоно уу.");
    const metadata = normalizePlacementMetadata(piece.placement);
    if (!metadata.surfaces.includes("wall"))
        throw new Error("Энэ тавилгад хананд бэхлэх тохиргоо өгөөгүй байна.");
    const dimensions = dimsFor(piece), margin = dimensions.w / 2 + .01;
    if (wall.length < margin * 2 || dimensions.h > (room.height ?? 2.7))
        throw new Error("Тавилга энэ хананд багтахгүй байна.");
    const position = Math.max(margin, Math.min(wall.length - margin, along));
    const y = Math.max(0, Math.min((room.height ?? 2.7) - dimensions.h, elevation));
    const gap = Math.min(.2, metadata.gap ?? .01), offset = dimensions.d / 2 + gap;
    for (const opening of room.openings ?? []) {
        const world = openingWorldTransform(room, opening);
        const distance = Math.abs((world.x - wall.a.x) * wall.nx + (world.z - wall.a.z) * wall.nz);
        if (opening.segmentId ? opening.segmentId !== wall.id : distance > .001)
            continue;
        const center = ((world.x - wall.a.x) * (wall.b.x - wall.a.x) + (world.z - wall.a.z) * (wall.b.z - wall.a.z)) / wall.length;
        if (Math.abs(center - position) < (opening.width + dimensions.w) / 2 + .06 && y < opening.sillHeight + opening.height + .06 && y + dimensions.h > opening.sillHeight - .06)
            throw new Error("Хананд бэхлэх тавилга хаалга эсвэл цонхтой давхцаж байна.");
    }
    return { ...piece, x: wall.a.x + (wall.b.x - wall.a.x) / wall.length * position + wall.nx * offset, z: wall.a.z + (wall.b.z - wall.a.z) / wall.length * position + wall.nz * offset,
        rotation: -Math.atan2(wall.b.z - wall.a.z, wall.b.x - wall.a.x), elevation: y,
        attachment: { kind: "wall", roomId, segmentId, along: position, elevation: y, offset } };
}
export function resolveFurnitureAttachments(pieces: PlacedFurniture[], room: RoomShape, roomId: string, onlyId?: string): PlacedFurniture[] {
    const resolved = new Map<string, PlacedFurniture>(), visiting = new Set<string>();
    function resolve(piece: PlacedFurniture): PlacedFurniture {
        if (resolved.has(piece.instanceId))
            return resolved.get(piece.instanceId)!;
        if (visiting.has(piece.instanceId))
            throw new Error("Тавилгын гадаргууны холбоос тойрог үүсгэсэн байна.");
        visiting.add(piece.instanceId);
        const attachment = piece.attachment;
        let result = piece;
        if (attachment?.kind === "wall") {
            if (attachment.roomId !== roomId)
                throw new Error("Тавилгын холбогдсон өрөө тохирохгүй байна.");
            const wall = getRoomGeometry(room).segments.find(s => furnitureWallId(s) === attachment.segmentId), d = dimsFor(piece);
            if (wall && (attachment.along < d.w / 2 + .01 - 1e-6 || attachment.along > wall.length - d.w / 2 - .01 + 1e-6 || attachment.elevation < 0 || attachment.elevation + d.h > (room.height ?? 2.7) + 1e-6))
                throw new Error("Ханын шинэ хэмжээнд бэхэлгээ багтахгүй байна. Эхлээд тавилгын байрлалыг өөрчилнө үү.");
            result = wallAttachedPiece(piece, room, roomId, attachment.segmentId, attachment.along, attachment.elevation);
        }
        else if (attachment?.kind === "surface") {
            const rawParent = pieces.find(p => p.instanceId === attachment.parentInstanceId);
            if (!rawParent)
                throw new Error("Тавилгын тулгуур гадаргуу олдсонгүй.");
            const parent = resolve(rawParent), surface = parent.placement?.supportSurfaces?.find(s => s.id === attachment.surfaceId);
            if (!surface || !normalizePlacementMetadata(piece.placement).surfaces.includes("surface"))
                throw new Error("Тулгуур гадаргууны мэдээлэл тохирохгүй байна.");
            const [x, y, z] = attachment.localPosition, size = dimsFor(piece), q = attachment.localQuaternion;
            if (![x, y, z, ...q].every(Number.isFinite) || Math.abs(Math.hypot(...q) - 1) > .001 || Math.abs(y - surface.elevation) > .001)
                throw new Error("Тавилгын гадаргуу дээрх байрлал буруу байна.");
            if (Math.abs(q[0]) > .001 || Math.abs(q[2]) > .001)
                throw new Error("Тулгуур дээр тавилгыг босоо байрлуулна уу.");
            const yaw = 2 * Math.atan2(q[1], q[3]);
            const hx = (Math.abs(Math.cos(yaw)) * size.w + Math.abs(Math.sin(yaw)) * size.d) / 2, hz = (Math.abs(Math.sin(yaw)) * size.w + Math.abs(Math.cos(yaw)) * size.d) / 2;
            if (Math.abs(x) + hx > surface.width / 2 + 1e-6 || Math.abs(z) + hz > surface.depth / 2 + 1e-6)
                throw new Error("Тавилга тулгуур гадаргуунаас илүү гарч байна.");
            const cos = Math.cos(parent.rotation), sin = Math.sin(parent.rotation);
            result = { ...piece, x: parent.x + x * cos + z * sin, z: parent.z - x * sin + z * cos, elevation: (parent.elevation ?? 0) + y, rotation: parent.rotation + yaw };
        }
        else if (attachment?.kind === "floor")
            result = { ...piece, x: attachment.x, z: attachment.z, rotation: attachment.yaw, elevation: 0 };
        visiting.delete(piece.instanceId);
        resolved.set(piece.instanceId, result);
        return result;
    }
    return pieces.filter(piece => !onlyId || piece.instanceId === onlyId).map(resolve);
}
export function findInitialFurniturePlacement(piece: PlacedFurniture, others: PlacedFurniture[], room: RoomShape, roomId: string) {
    const metadata = normalizePlacementMetadata(piece.placement);
    if (metadata.surfaces.includes("floor")) {
        const floor = findFreePlacement({ ...piece, elevation: 0, attachment: undefined }, others, room);
        if (floor)
            return floor;
    }
    if (metadata.surfaces.includes("wall")) {
        for (const wall of getRoomGeometry(room).segments.filter(s => !s.hole)) {
            for (const position of [.5, .25, .75, .1, .9])
                try {
                    const candidate = wallAttachedPiece(piece, room, roomId, furnitureWallId(wall), wall.length * position, metadata.defaultElevation ?? 1.4);
                    if (isPlacementValid(candidate, others, room))
                        return candidate;
                }
                catch { /* Try the next deterministic candidate. */ }
        }
    }
    if (metadata.surfaces.includes("surface")) {
        const ownerIds="pieces" in room&&Array.isArray(room.pieces)?new Set((room.pieces as PlacedFurniture[]).map(p=>p.instanceId)):null;
        for (const parent of others)
            for (const surface of parent.placement?.supportSurfaces ?? []) {
                if (parent.instanceId === piece.instanceId || (ownerIds&&!ownerIds.has(parent.instanceId)))
                    continue;
                for (const [x, z] of [[0, 0], [-surface.width / 4, 0], [surface.width / 4, 0], [0, -surface.depth / 4], [0, surface.depth / 4]])
                    try {
                        const attached: PlacedFurniture = { ...piece, attachment: { kind: "surface", parentInstanceId: parent.instanceId, surfaceId: surface.id, localPosition: [x, surface.elevation, z], localQuaternion: [0, 0, 0, 1] } };
                        const candidate = resolveFurnitureAttachments([...others, attached], room, roomId,attached.instanceId)[0];
                        if (isPlacementValid(candidate, others, room))
                            return candidate;
                    }
                    catch { /* Select a different support surface or location. */ }
            }
    }
    return null;
}
