"use client";
import { useId, type KeyboardEvent } from "react";
import { Droplets, Wind, Zap } from "lucide-react";
import type { KitchenRoom, KitchenSpaceItem } from "@/lib/kitchenCabinets";

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
  room,
  wall,
  selectedItem,
  disabled,
  onWall,
  onItem,
  onClear,
}: {
  room: KitchenRoom;
  wall: RoomWallId | null;
  selectedItem: string | null;
  disabled: boolean;
  onWall: (wall: RoomWallId) => void;
  onItem: (id: string) => void;
  onClear: () => void;
}) {
  const pattern = useId().replace(/:/g, "");
  const { width: w, depth: d } = room;
  const walls: {
    id: RoomWallId;
    path: string;
    start: [number, number];
    end: [number, number];
  }[] = [
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
        fill={active ? "#0051d5" : "#293c32"}
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
      onClick={onClear}
    >
      <defs>
        <pattern
          id={pattern}
          width={100}
          height={100}
          patternUnits="userSpaceOnUse"
        >
          <path d="M100 0H0V100" fill="none" stroke="#e8e5f1" strokeWidth={2} />
        </pattern>
      </defs>
      <rect width={w} height={d} fill="#faf8ff" />
      <rect width={w} height={d} fill={`url(#${pattern})`} />
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
        .map((item) => (
          <g
            key={item.id}
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
              stroke={wall === item.id ? "#0051d5" : "#303039"}
              strokeWidth={95}
              className={wall === item.id ? "is-selected" : ""}
            />
            {wall === item.id &&
              [item.start, item.end].map(([x, y], index) => (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r={43}
                  fill="white"
                  stroke="#0051d5"
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
        fill="#0051d5"
      >
        {((w * d) / 1000000).toFixed(2)} м²
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
              : "#0051d5";
        return (
          <g
            key={item.id}
            role="button"
            tabIndex={disabled ? -1 : 0}
            aria-label={`${ROOM_ITEM_NAMES[item.kind]} сонгох`}
            aria-pressed={selectedItem === item.id}
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
                  stroke={selectedItem === item.id ? "#0051d5" : "white"}
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
                  fill={selectedItem === item.id ? "#0051d5" : "#293c32"}
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
    </svg>
  );
}
