"use client";
import { useRef, useState, type PointerEvent, type KeyboardEvent } from "react";
import { Droplets, Wind, Zap } from "lucide-react";
import { roomWalls, type KitchenRoom, type KitchenSpaceItem } from "@/lib/kitchenCabinets";
import {
  roomArea,
  roomOutline,
  roomBoundary,
  roomOutlinePath,
  wallPath,
} from "@/lib/kitchenRoomOutline";
import { KitchenRoomOutlineEditor } from "./KitchenRoomOutlineEditor";

export const ROOM_WALL_NAMES = {
  back: "Арын хана",
  front: "Нүүр талын хана",
  left: "Зүүн хана",
  right: "Баруун хана",
};
export const ROOM_ITEM_NAMES = {
  door: "Хаалга",
  window: "Цонх",
  column: "Багана",
  water: "Цэвэр/бохир ус",
  power: "Цахилгааны холболт",
  vent: "Агааржуулалтын яндан",
};
export type RoomWallId = KitchenSpaceItem["wall"];
export function KitchenRoomDraft({
  room: savedRoom,
  wall,
  selectedItem,
  disabled,
  onWall,
  onItem,
  onClear,
  onRoomChange,
}: {
  room: KitchenRoom;
  wall: RoomWallId | null;
  selectedItem: string | null;
  disabled: boolean;
  onWall: (wall: RoomWallId) => void;
  onItem: (id: string) => void;
  onClear: () => void;
  onRoomChange?: (room: KitchenRoom) => void;
}) {
  const [preview, setPreview] = useState<KitchenRoom | null>(null);
  const room = preview ?? savedRoom;
  const drag = useRef<{ pointerId: number; item: KitchenSpaceItem; base: KitchenRoom; next: KitchenRoom; dx: number; dz: number; inverse: DOMMatrix } | null>(null);
  function point(event: PointerEvent<SVGElement>, inverse: DOMMatrix) {
    const svg = event.currentTarget.ownerSVGElement ?? event.currentTarget as SVGSVGElement;
    const p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
    return p.matrixTransform(inverse);
  }
  function moveUtility(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    event.stopPropagation();
    const p = point(event, current.inverse), x = p.x + current.dx, z = p.y + current.dz;
    let nearest = { wall: current.item.wall, x: current.item.x, z: current.item.z, distance: Infinity };
    for (const segment of roomWalls(current.base)) {
      const { x: ax, z: az } = segment.start, { x: bx, z: bz } = segment.end;
      const vx = bx - ax, vz = bz - az, length = vx * vx + vz * vz;
      if (!length) continue;
      const t = Math.max(0, Math.min(1, ((x - ax) * vx + (z - az) * vz) / length));
      const px = Math.round(ax + t * vx), pz = Math.round(az + t * vz), distance = Math.hypot(x - px, z - pz);
      if (distance < nearest.distance) nearest = { wall: segment.sourceWall ?? segment.id as RoomWallId, x: px, z: pz, distance };
    }
    current.next = { ...current.base, items: current.base.items?.map(item => item.id === current.item.id ? { ...item, wall: nearest.wall, x: nearest.x, z: nearest.z } : item) };
    setPreview(current.next);
  }
  function finishUtility(event: PointerEvent<SVGSVGElement>, cancel = false) {
    const current = drag.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!cancel) moveUtility(event);
    drag.current = null;
    setPreview(null);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    if (!cancel && onRoomChange) onRoomChange(current.next);
  }
  const { width: w, depth: d } = room;
  const walls: {
    id: RoomWallId;
    path: string;
    start: [number, number];
    end: [number, number];
  }[] = room.outline
    ? roomOutline(room).map((p, i, points) => ({
        id: p.wall,
        path: wallPath(p, points[(i + 1) % points.length]),
        start: [p.x, p.z] as [number, number],
        end: [
          points[(i + 1) % points.length].x,
          points[(i + 1) % points.length].z,
        ] as [number, number],
      }))
    : [
        { id: "back", path: `M0 0H${w}`, start: [0, 0], end: [w, 0] },
        { id: "right", path: `M${w} 0V${d}`, start: [w, 0], end: [w, d] },
        { id: "front", path: `M0 ${d}H${w}`, start: [0, d], end: [w, d] },
        { id: "left", path: `M0 0V${d}`, start: [0, 0], end: [0, d] },
      ];
  const action =
    (callback: () => void) => (event: KeyboardEvent<SVGGElement>) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        if (!disabled) callback();
      }
    };
  const badge = (
    x: number,
    y: number,
    value: number,
    active: boolean,
    vertical = false,
  ) => (
    <g
      transform={`translate(${x} ${y})${vertical ? " rotate(-90)" : ""}`}
      className="kroom-dimension-badge"
    >
      <rect
        x={-380}
        y={-90}
        width={760}
        height={180}
        rx={90}
        fill={active ? "#42634f" : "#293c32"}
      />
      <text
        textAnchor="middle"
        dominantBaseline="central"
        fill="white"
        fontSize="82"
        fontWeight="600"
      >
        {value.toLocaleString("mn-MN")} мм
      </text>
    </g>
  );
  return (
    <svg
      className="kroom-draft"
      viewBox={`-620 -650 ${w + 1240} ${d + 1300}`}
      role="group"
      aria-label="Өрөөний хэмжээс ба холболтын 2D зураг"
      style={{ touchAction: "none" }}
      onPointerMove={moveUtility}
      onPointerUp={event => finishUtility(event)}
      onPointerCancel={event => finishUtility(event, true)}
      onLostPointerCapture={() => { drag.current = null; setPreview(null); }}
      onKeyDown={event => { if (event.key === "Escape") { drag.current = null; setPreview(null); } }}
      onClick={onClear}
    >
      <path d={roomOutlinePath(roomOutline(room))} fill="#faf9f6" />
      <g fill="none" stroke="#79817c" strokeWidth={7}>
        <path
          d={`M0 -50V-380M${w} -50V-380M-40 -330H${w + 40}M-40 -360l80 60M${w - 40} -360l80 60`}
        />
        <path
          d={`M0 ${d + 50}V${d + 380}M${w} ${d + 50}V${d + 380}M-40 ${d + 330}H${w + 40}M-40 ${d + 300}l80 60M${w - 40} ${d + 300}l80 60`}
        />
        <path
          d={`M-50 0H-380M-50 ${d}H-380M-330 -40V${d + 40}M-360 -40l60 80M-360 ${d - 40}l60 80`}
        />
        <path
          d={`M${w + 50} 0H${w + 380}M${w + 50} ${d}H${w + 380}M${w + 330} -40V${d + 40}M${w + 300} -40l60 80M${w + 300} ${d - 40}l60 80`}
        />
      </g>
      {badge(w / 2, -330, w, wall === "back")}
      {badge(w / 2, d + 330, w, wall === "front")}
      {badge(-330, d / 2, d, wall === "left", true)}
      {badge(w + 330, d / 2, d, wall === "right", true)}
      {walls
        .filter((item) => !room.openFront || item.id !== "front")
        .map((item, index) => (
          <g
            key={`${item.id}-${index}`}
            role="button"
            aria-label={`${ROOM_WALL_NAMES[item.id]} сонгох`}
            aria-pressed={wall === item.id}
            tabIndex={disabled ? -1 : 0}
            onKeyDown={action(() => onWall(item.id))}
            onClick={(event) => {
              event.stopPropagation();
              if (!disabled) onWall(item.id);
            }}
          >
            <path
              d={item.path}
              stroke="transparent"
              strokeWidth={220}
              fill="none"
            />
            <path
              d={item.path}
              fill="none"
              stroke={wall === item.id ? "#42634f" : "#303039"}
              strokeWidth={95}
              className={wall === item.id ? "is-selected" : ""}
            />
            {!onRoomChange &&
              wall === item.id &&
              [item.start, item.end].map(([x, y], index) => (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r={43}
                  fill="white"
                  stroke="#42634f"
                  strokeWidth={22}
                />
              ))}
          </g>
        ))}
      <text
        x={w / 2}
        y={d / 2}
        textAnchor="middle"
        fontSize={100}
        fill="#727974"
        letterSpacing={8}
      >
        ГАЛ ТОГООНЫ ЗАЙ
      </text>
      <text
        x={w / 2}
        y={d / 2 + 160}
        textAnchor="middle"
        fontSize={85}
        fill="#42634f"
      >
        {(roomArea(roomBoundary(room)) / 1000000).toFixed(2)} м²
      </text>
      {(room.items ?? []).map((item) => {
        const rotation =
          item.wall === "right"
            ? 90
            : item.wall === "front"
              ? 180
              : item.wall === "left"
                ? -90
                : 0;
        const utility = ["water", "power", "vent"].includes(item.kind);
        const Icon =
          item.kind === "power" ? Zap : item.kind === "vent" ? Wind : Droplets;
        const color =
          item.kind === "power"
            ? "#bd7b00"
            : item.kind === "vent"
              ? "#727974"
              : "#42634f";
        return (
          <g
            key={item.id}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={`${ROOM_ITEM_NAMES[item.kind]} сонгох`}
            aria-pressed={selectedItem === item.id}
            style={{ cursor: utility && onRoomChange && !disabled ? "grab" : undefined }}
            onPointerDown={event => {
              if (!utility || !onRoomChange || disabled || event.button !== 0) return;
              event.stopPropagation(); event.preventDefault();
              const svg = event.currentTarget.ownerSVGElement;
              const inverse = svg?.getScreenCTM()?.inverse();
              if (!svg || !inverse) return;
              const p = point(event, inverse);
              drag.current = { pointerId: event.pointerId, item, base: savedRoom, next: savedRoom, dx: item.x - p.x, dz: item.z - p.y, inverse };
              svg.setPointerCapture(event.pointerId);
              onItem(item.id);
            }}
            onKeyDown={action(() => onItem(item.id))}
            onClick={(event) => {
              event.stopPropagation();
              if (!disabled) onItem(item.id);
            }}
          >
            {utility ? (
              <g
                transform={`translate(${item.x + (item.wall === "left" ? 220 : item.wall === "right" ? -220 : 0)} ${item.z + (item.wall === "back" ? 280 : item.wall === "front" ? -280 : 0)})`}
              >
                <circle
                  r={120}
                  fill={color}
                  stroke={selectedItem === item.id ? "#42634f" : "white"}
                  strokeWidth={16}
                />
                <Icon x={-65} y={-65} width={130} height={130} color="white" />
                <rect
                  x={-350}
                  y={150}
                  width={700}
                  height={145}
                  rx={30}
                  fill={color}
                />
                <text
                  y={225}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={65}
                >
                  {item.kind === "vent"
                    ? `D: ${item.width} мм`
                    : `${item.kind === "water" ? "Ус" : "Цахилгаан"}: ${["back", "front"].includes(item.wall) ? item.x : item.z} мм`}
                </text>
              </g>
            ) : (
              <g
                transform={`translate(${item.x} ${item.z}) rotate(${rotation})`}
              >
                {item.kind === "column" ? (
                  <rect
                    x={-item.width / 2}
                    y={-item.depth / 2}
                    width={item.width}
                    height={item.depth}
                    fill="#d4d7d2"
                    stroke="#293c32"
                    strokeWidth={15}
                  />
                ) : (
                  <>
                    <path
                      d={`M${-item.width / 2} 0H${item.width / 2}`}
                      stroke="white"
                      strokeWidth={115}
                    />
                    {item.kind === "window" ? (
                      <>
                        <path
                          d={`M${-item.width / 2} -20H${item.width / 2}M${-item.width / 2} 20H${item.width / 2}`}
                          stroke="#2267a0"
                          strokeWidth={12}
                        />
                        <path
                          d={`M${-item.width / 2} -70V70M${item.width / 2} -70V70`}
                          stroke="#303039"
                          strokeWidth={14}
                        />
                      </>
                    ) : (
                      <>
                        <path
                          d={`M${-item.width / 2} 0V${item.width}`}
                          stroke="#76503a"
                          strokeWidth={22}
                        />
                        <path
                          d={`M${-item.width / 2} ${item.width}A${item.width} ${item.width} 0 0 0 ${item.width / 2} 0`}
                          fill="none"
                          stroke="#727974"
                          strokeWidth={10}
                          strokeDasharray="24 20"
                        />
                      </>
                    )}
                  </>
                )}
                <rect
                  x={-280}
                  y={100}
                  width={560}
                  height={150}
                  rx={30}
                  fill={selectedItem === item.id ? "#42634f" : "#293c32"}
                />
                <text
                  y={180}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill="white"
                  fontSize={65}
                >
                  {ROOM_ITEM_NAMES[item.kind]} {item.width}
                </text>
              </g>
            )}
          </g>
        );
      })}
      {onRoomChange && (
        <KitchenRoomOutlineEditor
          room={room}
          disabled={disabled}
          onChange={onRoomChange}
        />
      )}
    </svg>
  );
}
