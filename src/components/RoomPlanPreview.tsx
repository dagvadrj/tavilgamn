"use client";
import type { PlacedFurniture, RoomShape } from "@/lib/types";
import { getRoomGeometry, roomPath } from "@/lib/roomGeometry";
import { pieceRects } from "@/three/collision";

export function RoomPlanPreview({ room, pieces = [] }: { room: RoomShape; pieces?: PlacedFurniture[] }) {
  const geometry = getRoomGeometry(room), b = geometry.bounds;
  const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ), pad = span * .24, font = span / 32;
  const label = (length: number) => `${Math.round(length * 1000)} мм`;
  return <figure className="room-measured-plan">
    <figcaption>Өрөөний plan · дээрээс харах · мм</figcaption>
    <svg role="img" aria-label={`Өрөө ${Math.round(room.width * 1000)} × ${Math.round(room.depth * 1000)} мм, хана, багана, тавилгын бодит байрлал`}
      viewBox={`${b.minX - pad} ${b.minZ - pad} ${b.maxX - b.minX + 2 * pad} ${b.maxZ - b.minZ + 2 * pad}`}>
      <path className="room-plan-floor" d={roomPath(room)} fillRule="evenodd" />
      {(room.columns ?? []).map((c, i) => <g key={c.id}>
        <rect className="room-plan-column" x={c.x - room.width / 2} y={c.z - room.depth / 2} width={c.width} height={c.depth} />
        <text className="room-plan-label" x={c.x - room.width / 2 + c.width / 2} y={c.z - room.depth / 2 + c.depth / 2} fontSize={font * .7} textAnchor="middle">Б{i + 1}</text>
      </g>)}
      {pieces.flatMap((piece, i) => pieceRects(piece).map((r, j) => <g key={`${piece.instanceId}:${j}`} transform={`translate(${r.cx} ${r.cz}) rotate(${r.rot * 180 / Math.PI})`}>
        <rect className="room-plan-furniture" x={-r.w / 2} y={-r.d / 2} width={r.w} height={r.d} />
        {j === 0 && <text x={0} y={0} fontSize={font * .8} textAnchor="middle" dominantBaseline="middle">{i + 1}</text>}
      </g>))}
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
    </svg>
    <p>Б — багана · Дугаартай дүрс — тавилга · Богино ханын хэмжээг доорх Х дугаараар харна.</p>
    {!!room.columns?.length && <ul>{room.columns.map((c, i) => <li key={c.id}>Б{i + 1}: {label(c.width)} × {label(c.depth)}</li>)}</ul>}
  </figure>;
}
