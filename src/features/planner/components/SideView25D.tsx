"use client";

import { useMemo, useState, type ReactNode } from "react";
import "./side-view-25d.css";

/** Kitchen naming; the room planner maps north → back, east → right, south → front, west → left. */
export type SideViewWall = "back" | "right" | "front" | "left";

export interface SideViewBox {
  id: string;
  /** Footprint centre in metres; x from the left (west) wall, z from the back (north) wall. */
  x: number;
  z: number;
  /** Bottom above the floor, metres. */
  y: number;
  width: number;
  depth: number;
  height: number;
  /** Radians around the vertical axis, three.js convention. */
  rotation: number;
  color: string;
  label?: string;
}

export interface SideViewOpening {
  id: string;
  kind: "door" | "window";
  wall: SideViewWall;
  /** Centre along the wall in room coordinates: x for back/front, z for left/right. */
  centre: number;
  width: number;
  bottom: number;
  top: number;
}

export const SIDE_VIEW_WALLS: readonly { wall: SideViewWall; letter: string; label: string }[] = [
  { wall: "back", letter: "A", label: "Арын хана" },
  { wall: "right", letter: "B", label: "Баруун хана" },
  { wall: "front", letter: "C", label: "Урд хана" },
  { wall: "left", letter: "D", label: "Зүүн хана" },
];

type P3 = { u: number; v: number; d: number };
type Face = {
  key: string;
  points: P3[];
  fill: string;
  shade: number;
  ownerId?: string;
  className?: string;
  /** Distance from the eye; drawn far to near. */
  distance: number;
};

const PX = 100;

function shadeColor(hex: string, factor: number) {
  const value = hex.replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value.padEnd(6, "0");
  const channel = (i: number) => Math.round(Math.max(0, Math.min(255, parseInt(full.slice(i, i + 2), 16) * factor)));
  return `rgb(${channel(0)} ${channel(2)} ${channel(4)})`;
}

/**
 * Room coordinates (x, z) to the viewer's frame for one wall: `u` runs left to
 * right along that wall as seen from inside, `d` is the distance in front of it.
 */
function toView(wall: SideViewWall, width: number, depth: number) {
  switch (wall) {
    case "back": return { length: width, room: depth, map: (x: number, z: number) => ({ u: x, d: z }) };
    case "front": return { length: width, room: depth, map: (x: number, z: number) => ({ u: width - x, d: depth - z }) };
    case "left": return { length: depth, room: width, map: (x: number, z: number) => ({ u: depth - z, d: x }) };
    case "right": return { length: depth, room: width, map: (x: number, z: number) => ({ u: z, d: width - x }) };
  }
}

/**
 * «Хажуугаас 2.5D»: one-point perspective from behind the opposite wall, with
 * that wall cut away, like standing in the doorway. The chosen wall is drawn
 * at true scale (its dimension line is exact); floor, ceiling and side walls
 * recede to it, and every module or piece of furniture is a shaded box with a
 * soft contact shadow, sorted far to near. It is drawn from the saved data, so
 * it opens instantly and needs no WebGL.
 */
export function SideView25D({
  width,
  depth,
  height,
  boxes,
  openings = [],
  wallColor = "#ece8e1",
  floorColor = "#cdb79a",
  selectedId,
  onSelect,
  initialWall = "back",
  measure,
  footer,
}: {
  width: number;
  depth: number;
  height: number;
  boxes: SideViewBox[];
  openings?: SideViewOpening[];
  wallColor?: string;
  floorColor?: string;
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  initialWall?: SideViewWall;
  /** Formats a length in metres for the dimension lines. */
  measure: (metres: number) => string;
  footer?: (wall: SideViewWall) => ReactNode;
}) {
  const [wall, setWall] = useState<SideViewWall>(initialWall);
  const drawing = useMemo(() => {
    const view = toView(wall, width, depth);
    const L = view.length, R = view.room;
    // Eye a step beyond the cut-away wall, at standing height: side walls and
    // floor read as planes without the far wall shrinking below legibility.
    // The cut edge is drawn at most 1.6× the target wall, whatever the room's
    // depth: a long galley stays a readable 2.5D drawing, not a deep tunnel.
    const eye = { u: L / 2, v: Math.min(1.55, height * 0.58), d: Math.max(R + Math.max(1.6, L * 0.75), (R * 1.6) / 0.6) };
    const E = eye.d;
    const project = (p: P3) => {
      const s = E / Math.max(0.05, E - p.d);
      return { x: (p.u - eye.u) * s * PX, y: (eye.v - p.v) * s * PX };
    };
    const faces: Face[] = [];
    const distanceTo = (points: P3[]) => {
      const c = points.reduce((a, p) => ({ u: a.u + p.u / points.length, v: a.v + p.v / points.length, d: a.d + p.d / points.length }), { u: 0, v: 0, d: 0 });
      return Math.hypot(c.u - eye.u, c.v - eye.v, c.d - eye.d);
    };
    // Shell: the near edge of floor/ceiling/side walls stops at the cut line.
    const near = R;
    faces.push(
      { key: "wall", points: [{ u: 0, v: 0, d: 0 }, { u: L, v: 0, d: 0 }, { u: L, v: height, d: 0 }, { u: 0, v: height, d: 0 }], fill: wallColor, shade: 1, className: "sv25-wall sv25-target", distance: Infinity },
      { key: "floor", points: [{ u: 0, v: 0, d: 0 }, { u: L, v: 0, d: 0 }, { u: L, v: 0, d: near }, { u: 0, v: 0, d: near }], fill: floorColor, shade: 0.96, className: "sv25-floor", distance: Infinity },
      { key: "ceiling", points: [{ u: 0, v: height, d: 0 }, { u: L, v: height, d: 0 }, { u: L, v: height, d: near }, { u: 0, v: height, d: near }], fill: "#f7f6f3", shade: 0.97, className: "sv25-ceiling", distance: Infinity },
      { key: "side-l", points: [{ u: 0, v: 0, d: 0 }, { u: 0, v: 0, d: near }, { u: 0, v: height, d: near }, { u: 0, v: height, d: 0 }], fill: wallColor, shade: 0.88, className: "sv25-wall", distance: Infinity },
      { key: "side-r", points: [{ u: L, v: 0, d: 0 }, { u: L, v: 0, d: near }, { u: L, v: height, d: near }, { u: L, v: height, d: 0 }], fill: wallColor, shade: 0.84, className: "sv25-wall", distance: Infinity },
    );
    const shell = faces.length;
    // Openings sit on the target wall and both side walls.
    const sideOf = { back: { back: "target", right: "side-r", left: "side-l" }, right: { right: "target", front: "side-r", back: "side-l" }, front: { front: "target", left: "side-r", right: "side-l" }, left: { left: "target", back: "side-r", front: "side-l" } } as const;
    const openingFaces: Face[] = [];
    for (const opening of openings) {
      const place = (sideOf[wall] as Record<string, string | undefined>)[opening.wall];
      if (!place) continue;
      const half = opening.width / 2;
      const ends = (opening.wall === "back" || opening.wall === "front"
        ? [[opening.centre - half, opening.wall === "back" ? 0 : depth], [opening.centre + half, opening.wall === "back" ? 0 : depth]]
        : [[opening.wall === "left" ? 0 : width, opening.centre - half], [opening.wall === "left" ? 0 : width, opening.centre + half]]
      ).map(([x, z]) => view.map(x, z));
      const [a, b] = ends;
      openingFaces.push({
        key: `opening:${opening.id}`,
        points: [{ ...a, v: opening.bottom }, { ...b, v: opening.bottom }, { ...b, v: opening.top }, { ...a, v: opening.top }],
        fill: opening.kind === "window" ? "#cfe3f1" : "#b48a62",
        shade: 1,
        className: `sv25-opening sv25-${opening.kind}`,
        distance: Infinity,
      });
    }
    const shadows: { key: string; cx: number; cy: number; rx: number; ry: number }[] = [];
    for (const box of boxes) {
      const cos = Math.cos(box.rotation), sin = Math.sin(box.rotation);
      const corner = (a: number, b: number) => view.map(
        box.x + a * cos * box.width / 2 + b * sin * box.depth / 2,
        box.z - a * sin * box.width / 2 + b * cos * box.depth / 2,
      );
      const base = [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)];
      const y0 = box.y, y1 = box.y + box.height;
      const low = base.map((p) => ({ ...p, v: y0 }));
      const high = base.map((p) => ({ ...p, v: y1 }));
      const centre = { u: base.reduce((s, p) => s + p.u, 0) / 4, d: base.reduce((s, p) => s + p.d, 0) / 4 };
      const add = (key: string, points: P3[], shade: number) => {
        // Back-face cull against the eye using the face's outward direction.
        const c = points.reduce((a, p) => ({ u: a.u + p.u / 4, v: a.v + p.v / 4, d: a.d + p.d / 4 }), { u: 0, v: 0, d: 0 });
        const n = key === "top" ? { u: 0, v: 1, d: 0 } : key === "bottom" ? { u: 0, v: -1, d: 0 } : { u: c.u - centre.u, v: 0, d: c.d - centre.d };
        if (n.u * (eye.u - c.u) + n.v * (eye.v - c.v) + n.d * (eye.d - c.d) <= 0) return;
        faces.push({ key: `${box.id}:${key}`, points, fill: box.color, shade, ownerId: box.id, className: "sv25-box", distance: distanceTo(points) });
      };
      add("top", high, 1.1);
      add("bottom", low, 0.62);
      for (let i = 0; i < 4; i++) {
        const j = (i + 1) % 4;
        const facing = Math.abs(high[i].u - high[j].u) > Math.abs(high[i].d - high[j].d);
        add(`side${i}`, [low[i], low[j], high[j], high[i]], facing ? 0.97 : 0.8);
      }
      if (y0 < 0.05) {
        const pa = project({ u: centre.u, v: 0, d: centre.d });
        const span = Math.max(...base.map((p) => Math.abs(p.u - centre.u))) * 1.15;
        const sa = project({ u: centre.u + span, v: 0, d: centre.d });
        shadows.push({ key: box.id, cx: pa.x, cy: pa.y, rx: Math.abs(sa.x - pa.x), ry: Math.max(4, Math.abs(sa.x - pa.x) * 0.16) });
      }
    }
    const items = faces.slice(shell).sort((a, b) => b.distance - a.distance);
    const corners = [{ u: 0, v: 0, d: near }, { u: L, v: height, d: near }].map(project);
    const pad = 70;
    const viewBox = [corners[0].x - pad, corners[1].y - pad, corners[1].x - corners[0].x + pad * 2, corners[0].y - corners[1].y + pad * 2.2];
    const target = [{ u: 0, v: 0, d: 0 }, { u: L, v: 0, d: 0 }, { u: L, v: height, d: 0 }].map(project);
    return { L, faces: faces.slice(0, shell), openingFaces, items, shadows, project, viewBox, target };
  }, [wall, width, depth, height, boxes, openings, wallColor, floorColor]);

  const toPoints = (points: P3[]) => points.map((p) => { const q = drawing.project(p); return `${q.x.toFixed(1)},${q.y.toFixed(1)}`; }).join(" ");
  const letter = SIDE_VIEW_WALLS.find((item) => item.wall === wall)!.letter;
  const [a, b, c] = drawing.target;
  return (
    <div className="sv25">
      <div className="sv25-walls" role="group" aria-label="Хажуугаас харах хана">
        {SIDE_VIEW_WALLS.map((item) => (
          <button key={item.wall} type="button" aria-pressed={item.wall === wall} onClick={() => setWall(item.wall)} title={item.label}>
            <svg viewBox="0 0 20 20" aria-hidden="true">
              <rect x="3" y="3" width="14" height="14" rx="1.5" />
              <path d={{ back: "M3 3H17", right: "M17 3V17", front: "M3 17H17", left: "M3 3V17" }[item.wall]} />
            </svg>
            <span>{item.letter} хана</span>
          </button>
        ))}
      </div>
      <svg className="sv25-canvas" viewBox={drawing.viewBox.join(" ")} role="img"
        aria-label={`${letter} хана, хажуугаас 2.5D · ${measure(drawing.L)}`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <filter id="sv25-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7" /></filter>
          <linearGradient id="sv25-floor-depth" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.16" />
            <stop offset="0.35" stopColor="#000" stopOpacity="0.03" />
            <stop offset="1" stopColor="#fff" stopOpacity="0.06" />
          </linearGradient>
          <radialGradient id="sv25-corner" cx="0.5" cy="0.5" r="0.75">
            <stop offset="0.6" stopColor="#000" stopOpacity="0" />
            <stop offset="1" stopColor="#000" stopOpacity="0.12" />
          </radialGradient>
        </defs>
        {drawing.faces.map((face) => (
          <polygon key={face.key} points={toPoints(face.points)} fill={shadeColor(face.fill, face.shade)} className={face.className} />
        ))}
        {/* Light falls off into the far corners and along the skirting: the same cue AO gives the 3D view. */}
        <polygon points={toPoints(drawing.faces[1].points)} fill="url(#sv25-floor-depth)" className="sv25-overlay" />
        <polygon points={toPoints(drawing.faces[0].points)} fill="url(#sv25-corner)" className="sv25-overlay" />
        {drawing.openingFaces.map((face) => (
          <polygon key={face.key} points={toPoints(face.points)} fill={face.fill} className={face.className} />
        ))}
        <g filter="url(#sv25-blur)" className="sv25-shadows">
          {drawing.shadows.map((shadow) => (
            <ellipse key={shadow.key} cx={shadow.cx} cy={shadow.cy} rx={shadow.rx} ry={shadow.ry} />
          ))}
        </g>
        {drawing.items.map((face) => (
          <polygon
            key={face.key}
            points={toPoints(face.points)}
            fill={shadeColor(face.fill, face.shade)}
            className={face.className}
            data-selected={face.ownerId === selectedId || undefined}
            onClick={face.ownerId && onSelect ? () => onSelect(face.ownerId!) : undefined}
          />
        ))}
        <g className="sv25-dim">
          {/* Dimensions sit on the target wall's top edge and right edge, where nothing covers them. */}
          <line x1={a.x} x2={b.x} y1={c.y + 18} y2={c.y + 18} />
          <line x1={a.x} x2={a.x} y1={c.y + 8} y2={c.y + 28} />
          <line x1={b.x} x2={b.x} y1={c.y + 8} y2={c.y + 28} />
          <text x={(a.x + b.x) / 2} y={c.y + 40} textAnchor="middle">{letter} хана · {measure(drawing.L)}</text>
          <line x1={b.x - 18} x2={c.x - 18} y1={b.y} y2={c.y} />
          <text x={b.x - 30} y={(b.y + c.y) / 2} transform={`rotate(-90 ${b.x - 30} ${(b.y + c.y) / 2})`} textAnchor="middle">{measure(height)}</text>
        </g>
      </svg>
      {footer?.(wall)}
    </div>
  );
}
