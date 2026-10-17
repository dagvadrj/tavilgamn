import type { PlacedFurniture, RoomShape } from "./types";
import { getRoomGeometry, type RoomSegment } from "./roomGeometry";
import { dimsFor, findFreePlacement, isInsideRoom, isPlacementValid, pieceRects, type PlacementRoom } from "@/three/collision";
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
    if (![along, elevation].every(Number.isFinite)) throw new Error("Бэхэлгээний байрлал, өндөр тоо байна.");
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
        else if (!normalizePlacementMetadata(piece.placement).surfaces.includes("floor"))
            throw new Error("Энэ тавилгыг зөвшөөрсөн хана эсвэл тулгуур дээр байрлуулна уу.");
        else if (attachment?.kind === "floor")
            result = { ...piece, x: attachment.x, z: attachment.z, rotation: attachment.yaw, elevation: 0 };
        visiting.delete(piece.instanceId);
        resolved.set(piece.instanceId, result);
        return result;
    }
    return pieces.filter(piece => !onlyId || piece.instanceId === onlyId).map(resolve);
}
export interface InitialPlacementHints {
    floor?: { x: number; z: number };
    walls?: { segmentId: string; along: number }[];
}
export function initialPlacementFailure(piece: PlacedFurniture): string {
    const { surfaces } = normalizePlacementMetadata(piece.placement);
    if (surfaces.length === 1 && surfaces[0] === "wall") return "Хананд бэхлэх сул зай олдсонгүй. Хаалга, цонхны зай болон бусад ханын тавилгын байрлалыг шалгана уу.";
    if (surfaces.length === 1 && surfaces[0] === "surface") return "Тохирох тулгуур гадаргуу дээр сул зай олдсонгүй. Тулгуур тавилга нэмэх эсвэл дээрх зүйлсийг зөөнө үү.";
    return "Сонгосон өрөөнд байрлуулах сул зай олдсонгүй. Өөр тавилга зөөх эсвэл өрөөний хэмжээг шалгана уу.";
}
export function findInitialFurniturePlacement(piece: PlacedFurniture, others: PlacedFurniture[], room: RoomShape, roomId: string, hints: InitialPlacementHints = {}) {
    const metadata = normalizePlacementMetadata(piece.placement);
    const geometry = getRoomGeometry(room);
    // Starting a new object is scoped to the active room, even when drag can cross an open seam.
    const activeBoundary: PlacementRoom = { ...room, placementGeometry: undefined };
    const inside = (candidate: PlacedFurniture) => isInsideRoom(candidate, activeBoundary);
    if (metadata.surfaces.includes("floor")) {
        const preferred = hints.floor && [hints.floor.x,hints.floor.z].every(Number.isFinite)
            ? { x: Math.max(geometry.bounds.minX,Math.min(geometry.bounds.maxX,hints.floor.x)), z: Math.max(geometry.bounds.minZ,Math.min(geometry.bounds.maxZ,hints.floor.z)) } : piece;
        for (const rotation of [piece.rotation, piece.rotation + Math.PI / 2]) {
            const floor = findFreePlacement({ ...piece, x: preferred.x, z: preferred.z, rotation, elevation: 0, attachment: undefined }, others, room, { bounds: geometry.bounds, accept: inside });
            if (floor) return floor;
        }
    }
    if (metadata.surfaces.includes("wall")) {
        const wallHints = (hints.walls ?? []).filter(hint => Number.isFinite(hint.along));
        const walls = geometry.segments.filter(s => !s.hole).sort((a,b) => {
            const rank = (wall: RoomSegment) => { const index = wallHints.findIndex(h => h.segmentId === furnitureWallId(wall)); return index < 0 ? Infinity : index; };
            return rank(a) - rank(b);
        });
        for (const wall of walls) {
            const preferred = wallHints.find(h => h.segmentId === furnitureWallId(wall))?.along ?? wall.length / 2;
            const dimensions = dimsFor(piece), margin = dimensions.w / 2 + .01;
            const positions = new Set([preferred, wall.length/2, margin, wall.length-margin]);
            for (let position=margin; position<=wall.length-margin; position+=.2) positions.add(position);
            // Exact opening/occupied edges find the gaps that evenly spaced samples miss.
            const along = (x:number,z:number) => ((x-wall.a.x)*(wall.b.x-wall.a.x)+(z-wall.a.z)*(wall.b.z-wall.a.z))/wall.length;
            for (const opening of room.openings ?? []) {
                const point=openingWorldTransform(room,opening);
                if (Math.abs((point.x-wall.a.x)*wall.nx+(point.z-wall.a.z)*wall.nz)>.001) continue;
                const center=along(point.x,point.z), clearance=(opening.width+dimensions.w)/2+.061;
                positions.add(center-clearance);positions.add(center+clearance);
            }
            for (const other of others) for(const rect of pieceRects(other)) {
                const c=Math.cos(rect.rot),s=Math.sin(rect.rot);
                const projected=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([x,z])=>along(rect.cx+x*rect.w/2*c-z*rect.d/2*s,rect.cz+x*rect.w/2*s+z*rect.d/2*c));
                positions.add(Math.min(...projected)-margin);positions.add(Math.max(...projected)+margin);
            }
            for (const position of [...positions].sort((a,b)=>Math.abs(a-preferred)-Math.abs(b-preferred)))
                try {
                    const candidate = wallAttachedPiece(piece, room, roomId, furnitureWallId(wall), position, piece.elevation ?? metadata.defaultElevation ?? 1.4);
                    const contactSegments=(room as PlacementRoom).placementGeometry?.segments;
                    const supported=!contactSegments || contactSegments.some(s => {
                        if(s.hole || s.nx*wall.nx+s.nz*wall.nz<.999 || Math.abs((s.a.x-wall.a.x)*wall.nx+(s.a.z-wall.a.z)*wall.nz)>.001) return false;
                        const a=along(s.a.x,s.a.z),b=along(s.b.x,s.b.z),center=along(candidate.x,candidate.z);
                        return center-dimensions.w/2>=Math.min(a,b)-1e-6 && center+dimensions.w/2<=Math.max(a,b)+1e-6;
                    });
                    if (supported && inside(candidate) && isPlacementValid(candidate, others, room))
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
                        if (inside(candidate) && isPlacementValid(candidate, others, room))
                            return candidate;
                    }
                    catch { /* Select a different support surface or location. */ }
            }
    }
    return null;
}

/** Duplicate on the same kind of surface, retaining authored permissions and height. */
export function duplicateFurniturePlacement(piece: PlacedFurniture, instanceId: string, others: PlacedFurniture[], room: RoomShape, roomId: string) {
    const metadata = normalizePlacementMetadata(piece.placement);
    const kind = piece.attachment?.kind;
    const copy = findInitialFurniturePlacement({ ...piece, instanceId, attachment: undefined, placement: kind ? { ...metadata, surfaces: [kind] } : metadata }, others, room, roomId);
    return copy ? { ...copy, placement: piece.placement } : null;
}
