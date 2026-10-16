import type { RoomShape, RoomVertex } from "./types";
import type { Point, RoomGeometry } from "./roomGeometry";
const EPS = 1e-7;
const cross = (a: Point, b: Point, c: Point) => (b.x - a.x) * (c.z - a.z) - (b.z - a.z) * (c.x - a.x);
export function pointOnEdge(p: Point, a: Point, b: Point) {
    return Math.abs(cross(a, b, p)) < EPS && p.x >= Math.min(a.x, b.x) - EPS && p.x <= Math.max(a.x, b.x) + EPS && p.z >= Math.min(a.z, b.z) - EPS && p.z <= Math.max(a.z, b.z) + EPS;
}
export function edgesCross(a: Point, b: Point, c: Point, d: Point) {
    return cross(a, b, c) * cross(a, b, d) < -EPS && cross(c, d, a) * cross(c, d, b) < -EPS;
}
export function polygonContains(points: Point[], p: Point, boundary = true) {
    let inside = false;
    for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[j], b = points[i];
        if (pointOnEdge(p, a, b))
            return boundary;
        if ((a.z > p.z) !== (b.z > p.z) && p.x < (b.x - a.x) * (p.z - a.z) / (b.z - a.z) + a.x)
            inside = !inside;
    }
    return inside;
}
export function polygonContainsPolygon(outer: Point[], points: Point[]) {
    if (points.some(p => !polygonContains(outer, p)))
        return false;
    if (outer.some(p => polygonContains(points, p, false)))
        return false;
    return points.every((a, i) => {
        const b = points[(i + 1) % points.length];
        return polygonContains(outer, { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }) && !outer.some((c, j) => edgesCross(a, b, c, outer[(j + 1) % outer.length]));
    });
}
/** Exact vertical decomposition for a footprint over non-overlapping connected rooms. */
export function polygonsCoverPolygon(regions: Point[][][], footprint: Point[]) {
    const minX = Math.min(...footprint.map(p => p.x)), maxX = Math.max(...footprint.map(p => p.x));
    const xs = new Set([minX, maxX]);
    const edges = (loop: Point[]) => loop.map((a, i) => ({ a, b: loop[(i + 1) % loop.length] }));
    const boundary = regions.flatMap(region => region.flatMap(edges)), target = edges(footprint);
    for (const { a, b } of boundary) {
        if (a.x > minX && a.x < maxX)
            xs.add(a.x);
        for (const { a: c, b: d } of target) {
            const dx = b.x - a.x, dz = b.z - a.z, ex = d.x - c.x, ez = d.z - c.z, den = dx * ez - dz * ex;
            if (Math.abs(den) < EPS)
                continue;
            const t = ((c.x - a.x) * ez - (c.z - a.z) * ex) / den, u = ((c.x - a.x) * dz - (c.z - a.z) * dx) / den;
            if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
                const x = a.x + t * dx;
                if (x > minX && x < maxX)
                    xs.add(x);
            }
        }
    }
    const spans = (loops: Point[][], x: number) => {
        const zs = loops.flatMap(loop => edges(loop).flatMap(({ a, b }) => (a.x > x) !== (b.x > x) ? [a.z + (x - a.x) * (b.z - a.z) / (b.x - a.x)] : [])).sort((a, b) => a - b);
        const result: number[][] = [];
        for (let i = 0; i + 1 < zs.length; i += 2)
            result.push([zs[i], zs[i + 1]]);
        return result;
    };
    const ordered = [...xs].sort((a, b) => a - b);
    for (let i = 1; i < ordered.length; i++) {
        if (ordered[i] - ordered[i - 1] < EPS)
            continue;
        const x = (ordered[i] + ordered[i - 1]) / 2, wanted = spans([footprint], x), available = regions.flatMap(region => spans(region, x)).sort((a, b) => a[0] - b[0]);
        for (const [lo, hi] of wanted) {
            let end = lo;
            for (const [a, b] of available) {
                if (a > end + EPS)
                    break;
                if (b > end)
                    end = b;
                if (end >= hi - EPS)
                    break;
            }
            if (end < hi - EPS)
                return false;
        }
    }
    return true;
}
export function validateRoomPolygon(room: RoomShape): string | null {
    const points = room.outline;
    if (!points || points.length < 3 || points.length > 48)
        return "Өрөөний хүрээ 3–48 цэгтэй байна.";
    if (new Set(points.map(p => p.id)).size !== points.length || new Set(points.map(p => p.segmentId)).size !== points.length || points.some(p => !p.id || !p.segmentId))
        return "Цэг болон ханын дугаар давхцаж байна.";
    if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.z) || Math.abs(p.x) > room.width / 2 + EPS || Math.abs(p.z) > room.depth / 2 + EPS))
        return "Хүрээний цэг өрөөний хэмжээнд багтсан байна.";
    let area = 0;
    for (let i = 0; i < points.length; i++) {
        const a = points[i], b = points[(i + 1) % points.length];
        if (Math.hypot(b.x - a.x, b.z - a.z) < .05)
            return "Ханын урт 50 мм-ээс бага байж болохгүй.";
        area += a.x * b.z - b.x * a.z;
        for (let j = i + 1; j < points.length; j++) {
            if (j === i + 1 || (i === 0 && j === points.length - 1))
                continue;
            const c = points[j], d = points[(j + 1) % points.length];
            if (edgesCross(a, b, c, d) || pointOnEdge(a, c, d) || pointOnEdge(b, c, d) || pointOnEdge(c, a, b) || pointOnEdge(d, a, b))
                return "Өрөөний хананууд огтлолцож байна.";
        }
    }
    if (area < 2)
        return "Өрөөний хүрээг зөв чиглэлд, 1 м²-аас их талбайтай зурна уу.";
    if (room.wallFeatures?.length || room.columns?.length)
        return "Олон өнцөгт хүрээний дотор ханын хуучин хэсэг эсвэл багана давхар оруулахгүй.";
    return null;
}
export function polygonRoomGeometry(room: RoomShape): RoomGeometry {
    const issue = validateRoomPolygon(room);
    if (issue)
        throw new Error(issue);
    const points = room.outline!;
    return {
        bounds: { minX: Math.min(...points.map(p => p.x)), maxX: Math.max(...points.map(p => p.x)), minZ: Math.min(...points.map(p => p.z)), maxZ: Math.max(...points.map(p => p.z)) },
        loops: [points], voids: [], connected: true, simple: true,
        area: points.reduce((sum, p, i) => { const q = points[(i + 1) % points.length]; return sum + p.x * q.z - q.x * p.z; }, 0) / 2,
        segments: points.map((a, i) => {
            const b = points[(i + 1) % points.length], length = Math.hypot(b.x - a.x, b.z - a.z);
            return { id: a.segmentId, a, b, length, nx: -(b.z - a.z) / length, nz: (b.x - a.x) / length, hole: false };
        }),
    };
}
export const ROOM_TEMPLATES = {
    rectangle: { label: "Тэгш өнцөгт", points: [[0, 0], [1, 0], [1, 1], [0, 1]] },
    l: { label: "L хэлбэр", points: [[0, 0], [1, 0], [1, 1], [.5, 1], [.5, .5], [0, .5]] },
    cut: { label: "Тайрсан булан", points: [[0, 0], [1, 0], [1, .65], [.65, 1], [0, 1]] },
    t: { label: "T хэлбэр", points: [[0, 0], [1, 0], [1, .4], [.65, .4], [.65, 1], [.35, 1], [.35, .4], [0, .4]] },
    u: { label: "U хэлбэр", points: [[0, 0], [1, 0], [1, 1], [.65, 1], [.65, .4], [.35, .4], [.35, 1], [0, 1]] },
    beveled: { label: "Налуу булангууд", points: [[.2, 0], [.8, 0], [1, .3], [1, 1], [0, 1], [0, .3]] },
};
export type RoomTemplate = keyof typeof ROOM_TEMPLATES;
export function roomTemplateOutline(template: RoomTemplate, width: number, depth: number): RoomVertex[] {
    const prefix = crypto.randomUUID();
    return ROOM_TEMPLATES[template].points.map(([x, z], i) => ({ id: `${prefix}:v${i}`, segmentId: `${prefix}:s${i}`, x: (x - .5) * width, z: (z - .5) * depth }));
}
export function transformRoomOutline(points: RoomVertex[], transform: "flip-x" | "flip-z" | "rotate") {
    const transformed = points.map(p => ({ ...p, x: transform === "flip-x" ? -p.x : transform === "rotate" ? -p.z : p.x, z: transform === "flip-z" ? -p.z : transform === "rotate" ? p.x : p.z }));
    // A reflection reverses edge direction. The edge identity follows the same physical wall.
    return transform === "rotate" ? transformed : transformed.map((p, i) => ({ ...p, segmentId: points[(i + points.length - 1) % points.length].segmentId })).reverse();
}
