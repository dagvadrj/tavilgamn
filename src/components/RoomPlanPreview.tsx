"use client";
import type { ReactNode, Ref, SVGProps } from "react";
import type { PlacedFurniture, RoomOpening, RoomShape } from "@/lib/types";
import { getRoomGeometry, roomPath, type Bounds, type Point } from "@/lib/roomGeometry";
import { openingWorldTransform, validateOpening } from "@/lib/roomOpenings";
import { pieceRects } from "@/three/collision";

function OpeningPlanMark({ room, opening, index, font }: { room: RoomShape; opening: RoomOpening; index: number; font: number }) {
  const position = openingWorldTransform(room, opening), half = opening.width / 2;
  const isDoor = opening.kind === "door", inward = opening.swing === "inward", direction = inward ? 1 : -1;
  const double = opening.templateId === "door-double", leafWidth = opening.width / (double ? 2 : 1);
  const hinges = double ? [-1, 1] : [opening.hinge === "left" ? -1 : 1];
  const name = `${isDoor ? "Хаалга" : "Цонх"} ${index + 1}`;
  const description = `${name} · ${Math.round(opening.width * 1000)} × ${Math.round(opening.height * 1000)} мм${isDoor ? ` · ${inward ? "Дотогш" : "Гадагш"} нээгдэнэ` : ` · Шалнаас ${Math.round(opening.sillHeight * 1000)} мм`}`;
  return <g className={`room-plan-opening room-plan-${opening.kind}`} transform={`translate(${position.x} ${position.z}) rotate(${-position.rotation * 180 / Math.PI})`}>
    <title>{description}</title>
    <line x1={-half} y1={0} x2={half} y2={0} stroke="#f8f9f5" strokeWidth={6} vectorEffect="non-scaling-stroke" />
    <g fill="none" stroke={isDoor ? "#9a6939" : "#4481a5"} strokeWidth={1.5} vectorEffect="non-scaling-stroke">
      <path d={`M${-half},-.09 V.09 M${half},-.09 V.09`} vectorEffect="non-scaling-stroke" />
      {isDoor ? hinges.map(side => {
        const hinge = side * half, end = hinge - side * leafWidth;
        return <g key={side}>
          <line x1={hinge} y1={0} x2={hinge} y2={direction * leafWidth} vectorEffect="non-scaling-stroke" />
          <path className="room-plan-door-swing" d={`M${end},0 A${leafWidth},${leafWidth} 0 0 ${side * direction < 0 ? 1 : 0} ${hinge},${direction * leafWidth}`} strokeDasharray="3 3" strokeWidth={1} vectorEffect="non-scaling-stroke" />
        </g>;
      }) : <>
        <rect x={-half} y={-.065} width={opening.width} height={.13} fill="#deedf4" vectorEffect="non-scaling-stroke" />
        <line x1={-half} y1={0} x2={half} y2={0} vectorEffect="non-scaling-stroke" />
        <line x1={0} y1={-.065} x2={0} y2={.065} vectorEffect="non-scaling-stroke" />
      </>}
    </g>
    <text x={0} y={font * 1.7} fontSize={font * .7} textAnchor="middle">{isDoor ? "Ха" : "Ц"}{index + 1} · {Math.round(opening.width * 1000)} мм</text>
  </g>;
}

export function RoomPlanPreview({ room, pieces = [], editing }: {
  room: RoomShape; pieces?: PlacedFurniture[];
  editing?: { overlay: ReactNode; bounds?: Bounds; offset?: Point; svgRef: Ref<SVGSVGElement>; svgProps: SVGProps<SVGSVGElement> };
}) {
  const geometry = getRoomGeometry(room), b = geometry.bounds;
  const viewport = editing?.bounds ?? b;
  const span = Math.max(viewport.maxX - viewport.minX, viewport.maxZ - viewport.minZ), pad = span * .24, font = span / (editing ? 22 : 32);
  const label = (length: number) => `${Math.round(length * 1000)} мм`;
  const validOpenings = (room.openings ?? []).filter(opening => !validateOpening(room, opening));
  return <figure className={`room-measured-plan${editing ? " room-measured-plan-editable" : ""}`}>
    <figcaption>{editing ? "Ханыг чирж өрөөгөө төлөвлөх" : "Өрөөний plan · дээрээс харах · мм"}</figcaption>
    <svg ref={editing?.svgRef} role={editing ? "group" : "img"} aria-label={`Өрөө ${Math.round(room.width * 1000)} × ${Math.round(room.depth * 1000)} мм, хана, багана, хаалга, цонх, тавилгын бодит байрлал`}
      {...editing?.svgProps}
      viewBox={`${viewport.minX - pad} ${viewport.minZ - pad} ${viewport.maxX - viewport.minX + 2 * pad} ${viewport.maxZ - viewport.minZ + 2 * pad}`}>
      <g transform={editing?.offset ? `translate(${editing.offset.x} ${editing.offset.z})` : undefined}>
      <path className="room-plan-floor" d={roomPath(room)} fillRule="evenodd" />
      {(room.columns ?? []).map((c, i) => <g key={c.id}>
        <rect className="room-plan-column" x={c.x - room.width / 2} y={c.z - room.depth / 2} width={c.width} height={c.depth} />
        <text className="room-plan-label" x={c.x - room.width / 2 + c.width / 2} y={c.z - room.depth / 2 + c.depth / 2} fontSize={font * .7} textAnchor="middle">Б{i + 1}</text>
      </g>)}
      {pieces.flatMap((piece, i) => pieceRects(piece).map((r, j) => <g key={`${piece.instanceId}:${j}`} transform={`translate(${r.cx} ${r.cz}) rotate(${r.rot * 180 / Math.PI})`}>
        <rect className="room-plan-furniture" x={-r.w / 2} y={-r.d / 2} width={r.w} height={r.d} />
        {j === 0 && <text x={0} y={0} fontSize={font * .8} textAnchor="middle" dominantBaseline="middle">{i + 1}</text>}
      </g>))}
      {validOpenings.map((opening, index) => <OpeningPlanMark key={opening.id} room={room} opening={opening} index={index} font={font} />)}
      {geometry.segments.filter(s => !s.hole).map((s, i) => {
        const offset = pad * .33, ax = s.a.x - s.nx * offset, az = s.a.z - s.nz * offset;
        const bx = s.b.x - s.nx * offset, bz = s.b.z - s.nz * offset;
        const vertical = Math.abs(bz - az) > Math.abs(bx - ax), small = s.length < span * .1;
        const x = (ax + bx) / 2, z = (az + bz) / 2;
        return <g key={i} className="room-plan-dimension">
          <line x1={ax} y1={az} x2={bx} y2={bz} />
          <line x1={s.a.x} y1={s.a.z} x2={ax - s.nx * font / 3} y2={az - s.nz * font / 3} />
          <line x1={s.b.x} y1={s.b.z} x2={bx - s.nx * font / 3} y2={bz - s.nz * font / 3} />
          <text x={x} y={z} transform={vertical ? `rotate(-90 ${x} ${z})` : undefined} dy={-font * .25} fontSize={small ? font * .65 : font * .85} textAnchor="middle">
            {small ? `Х${i + 1}` : `Х${i + 1} · ${label(s.length)}`}
          </text>
        </g>;
      })}
      {[["A", -room.width / 2, -room.depth / 2], ["B", room.width / 2, -room.depth / 2], ["C", room.width / 2, room.depth / 2], ["D", -room.width / 2, room.depth / 2]].map(([name, x, z]) =>
        <text key={String(name)} x={Number(x)} y={Number(z)} dx={font / 3} dy={font} fontSize={font} className="room-plan-corner">{name}</text>)}
      <text x={(b.minX + b.maxX) / 2} y={b.minZ - pad * .76} textAnchor="middle" fontSize={font}>AB · {label(room.width)}</text>
      <text x={(b.minX + b.maxX) / 2} y={b.maxZ + pad * .8} textAnchor="middle" fontSize={font}>BC · {label(room.depth)} · Тааз {label(room.height ?? 2.7)}</text>
      {editing?.overlay}
      </g>
    </svg>
    <p>Б — багана · Ха — хаалга · Ц — цонх · Нум — хаалга нээгдэх чиглэл · Дугаартай дүрс — тавилга · Богино ханын хэмжээг доорх Х дугаараар харна.</p>
    {!!validOpenings.length && <ul>{validOpenings.map((opening, index) => <li key={opening.id}>{opening.kind === "door" ? "Ха" : "Ц"}{index + 1}: {label(opening.width)} × {label(opening.height)}{opening.kind === "window" ? ` · шалнаас ${label(opening.sillHeight)}` : ""}</li>)}</ul>}
    {!!room.columns?.length && <ul>{room.columns.map((c, i) => <li key={c.id}>Б{i + 1}: {label(c.width)} × {label(c.depth)}</li>)}</ul>}
  </figure>;
}
