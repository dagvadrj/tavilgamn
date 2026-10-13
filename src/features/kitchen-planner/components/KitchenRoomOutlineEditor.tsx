"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import type { KitchenRoom } from "@/lib/kitchenCabinets";
import {
  roomOutline,
  roomOutlinePath,
  splitRoomWall,
  wallPoint,
  wallSamples,
  roomWithOutline,
  type RoomOutlinePoint,
} from "@/lib/kitchenRoomOutline";
import "./kitchen-room-outline.css";

export function KitchenRoomOutlineEditor({
  room,
  disabled = false,
  onChange,
}: {
  room: KitchenRoom;
  disabled?: boolean;
  onChange: (room: KitchenRoom) => void;
}) {
  const [preview, setPreview] = useState<RoomOutlinePoint[] | null>(null);
  const [error, setError] = useState("");
  const drag = useRef<{
    pointer: number;
    target: SVGGElement;
    svg: SVGSVGElement;
    matrix: DOMMatrix;
    points: RoomOutlinePoint[];
    index: number;
    x: number;
    z: number;
    room: KitchenRoom;
    curve: boolean;
  } | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const suppressClick = useRef(false);
  const points = preview ?? roomOutline(room);
  const radius = Math.max(room.width, room.depth) / 160;
  function cancel() {
    const active = drag.current;
    drag.current = null;
    setPreview(null);
    if (active?.target.hasPointerCapture(active.pointer))
      active.target.releasePointerCapture(active.pointer);
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && drag.current) {
        e.preventDefault();
        cancel();
      }
    };
    window.addEventListener("keydown", key);
    window.addEventListener("blur", cancel);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("blur", cancel);
      cancel();
    };
  }, []);
  useEffect(() => {
    if (disabled) cancel();
  }, [disabled]);
  function commit(next: RoomOutlinePoint[], base = room) {
    try {
      const result = roomWithOutline(base, next);
      setError("");
      change.current(result);
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  function start(
    event: PointerEvent<SVGGElement>,
    index: number,
    insert = false,
    curve = false,
  ) {
    event.stopPropagation();
    if (
      disabled ||
      event.button !== 0 ||
      drag.current ||
      (insert && points.length >= 40)
    )
      return;
    const svg = event.currentTarget.ownerSVGElement,
      matrix = svg?.getScreenCTM()?.inverse();
    if (!svg || !matrix) return;
    event.preventDefault();
    event.currentTarget.focus?.();
    const p = svg.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    const local = p.matrixTransform(matrix);
    let next = roomOutline(room).map((p) => ({ ...p }));
    if (insert) {
      next = splitRoomWall(next, index);
      index++;
    }
    if (curve && !next[index].curve)
      next[index].curve = curveControl(
        next[index],
        next[(index + 1) % next.length],
      );
    const origin = curve ? next[index].curve! : next[index];
    drag.current = {
      pointer: event.pointerId,
      target: event.currentTarget,
      svg,
      matrix,
      points: next,
      index,
      x: local.x - origin.x,
      z: local.y - origin.z,
      room,
      curve,
    };
    setPreview(next);
    setError("");
    suppressClick.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function sample(event: PointerEvent<SVGGElement>) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return null;
    const p = active.svg.createSVGPoint();
    p.x = event.clientX;
    p.y = event.clientY;
    const local = p.matrixTransform(active.matrix),
      clamp = (n: number) => Math.max(0, Math.min(8000, Math.round(n)));
    return active.points.map((p, i) =>
      i === active.index
        ? active.curve
          ? {
              ...p,
              curve: {
                x: clamp(local.x - active.x),
                z: clamp(local.y - active.z),
              },
            }
          : { ...p, x: clamp(local.x - active.x), z: clamp(local.y - active.z) }
        : p,
    );
  }
  function curveControl(a: RoomOutlinePoint, b: RoomOutlinePoint) {
    if (a.curve) return a.curve;
    const dx = b.x - a.x,
      dz = b.z - a.z,
      length = Math.hypot(dx, dz) || 1;
    return {
      x: Math.max(
        0,
        Math.min(8000, Math.round((a.x + b.x) / 2 - (dz / length) * 160)),
      ),
      z: Math.max(
        0,
        Math.min(8000, Math.round((a.z + b.z) / 2 + (dx / length) * 160)),
      ),
    };
  }
  return (
    <g
      className="kroom-outline-editor"
      aria-label="Өрөөний хүрээний цэгүүд"
      onClick={(event) => {
        event.stopPropagation();
        suppressClick.current = false;
      }}
      onPointerMove={(event) => {
        if (drag.current) {
          event.stopPropagation();
          const next = sample(event);
          if (next) setPreview(next);
        }
      }}
      onPointerUp={(event) => {
        if (drag.current?.pointer === event.pointerId) {
          event.stopPropagation();
          const next = sample(event),
            base = drag.current.room;
          cancel();
          if (next) commit(next, base);
        }
      }}
      onPointerCancel={(event) => {
        if (drag.current?.pointer === event.pointerId) {
          event.stopPropagation();
          cancel();
        }
      }}
      onLostPointerCapture={() => {
        if (drag.current) cancel();
      }}
    >
      {preview && (
        <path className="kroom-outline-preview" d={roomOutlinePath(points)} />
      )}
      {points.map((p, i) => {
        const q = points[(i + 1) % points.length],
          { x, z } = wallPoint(p, q, 0.5),
          control = curveControl(p, q),
          samples = wallSamples(p, q);
        const length = samples
          .slice(1)
          .reduce(
            (sum, p, j) =>
              sum + Math.hypot(p.x - samples[j].x, p.z - samples[j].z),
            0,
          );
        return (
          <g key={i}>
            <text
              className="kroom-outline-length"
              x={x}
              y={z - 65}
              textAnchor="middle"
              fontSize={55}
              pointerEvents="none"
            >
              {Math.round(length)} мм{p.curve ? " · нум" : ""}
            </text>
            <g
              data-room-point={i}
              role="button"
              aria-label={`Өрөөний ${i + 1}-р цэгийг чирэх`}
              tabIndex={disabled ? -1 : 0}
              onPointerDown={(e) => start(e, i)}
              onKeyDown={(e) => {
                if (disabled) return;
                const step = e.shiftKey ? 100 : 10,
                  delta: Record<string, [number, number]> = {
                    ArrowLeft: [-step, 0],
                    ArrowRight: [step, 0],
                    ArrowUp: [0, -step],
                    ArrowDown: [0, step],
                  };
                if (delta[e.key]) {
                  e.preventDefault();
                  e.stopPropagation();
                  const [dx, dz] = delta[e.key];
                  commit(
                    points.map((p, j) =>
                      i === j
                        ? {
                            ...p,
                            x: Math.max(0, Math.min(8000, p.x + dx)),
                            z: Math.max(0, Math.min(8000, p.z + dz)),
                          }
                        : p,
                    ),
                  );
                }
                if (
                  (e.key === "Delete" || e.key === "Backspace") &&
                  points.length > 3
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  commit(points.filter((_, j) => j !== i));
                }
              }}
            >
              <circle
                className="kroom-outline-hit"
                cx={p.x}
                cy={p.z}
                r={radius}
              />
              <circle
                className="kroom-outline-point"
                cx={p.x}
                cy={p.z}
                r={radius}
              />
              <title>
                Чирж өөрчлөх · Сум: 10 мм · Shift: 100 мм · Delete: цэг устгах
              </title>
            </g>
            {points.length < 40 && (
              <g
                data-room-midpoint={i}
                role="button"
                aria-label={`${i + 1}-р ханын дунд цэг нэмэх`}
                tabIndex={disabled ? -1 : 0}
                onPointerDown={(e) => start(e, i, true)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (disabled || suppressClick.current) {
                    suppressClick.current = false;
                    return;
                  }
                  commit(splitRoomWall(points, i));
                }}
                onKeyDown={(e) => {
                  if (!disabled && (e.key === "Enter" || e.key === " ")) {
                    e.preventDefault();
                    e.stopPropagation();
                    commit(splitRoomWall(points, i));
                  }
                }}
              >
                <circle
                  className="kroom-outline-hit"
                  cx={x}
                  cy={z}
                  r={radius}
                />
                <circle
                  className="kroom-outline-midpoint"
                  cx={x}
                  cy={z}
                  r={radius}
                />
                <path
                  className="kroom-outline-plus"
                  d={`M${x - radius / 2} ${z}h${radius}M${x} ${z - radius / 2}v${radius}`}
                  pointerEvents="none"
                />
                <title>Дунд цэг нэмэх · Чирж шинэ булан үүсгэх</title>
              </g>
            )}
            <g
              data-room-curve={i}
              role="button"
              aria-label={`${i + 1}-р ханыг нумруулах`}
              tabIndex={disabled ? -1 : 0}
              onPointerDown={(e) => start(e, i, false, true)}
              onKeyDown={(e) => {
                if (disabled) return;
                const step = e.shiftKey ? 100 : 10,
                  moves: Record<string, [number, number]> = {
                    ArrowLeft: [-step, 0],
                    ArrowRight: [step, 0],
                    ArrowUp: [0, -step],
                    ArrowDown: [0, step],
                  };
                if (
                  moves[e.key] ||
                  ["Enter", " ", "Delete", "Backspace"].includes(e.key)
                ) {
                  e.preventDefault();
                  e.stopPropagation();
                  const next = points.map((p) => ({ ...p }));
                  if (["Delete", "Backspace"].includes(e.key))
                    delete next[i].curve;
                  else {
                    const [dx, dz] = moves[e.key] ?? [0, 0];
                    next[i].curve = {
                      x: Math.max(0, Math.min(8000, control.x + dx)),
                      z: Math.max(0, Math.min(8000, control.z + dz)),
                    };
                  }
                  commit(next);
                }
              }}
            >
              <line
                className="kroom-outline-curve-guide"
                x1={x}
                y1={z}
                x2={control.x}
                y2={control.z}
                pointerEvents="none"
              />
              <circle
                className="kroom-outline-hit"
                cx={control.x}
                cy={control.z}
                r={radius}
              />
              <circle
                className="kroom-outline-curve"
                cx={control.x}
                cy={control.z}
                r={radius * 1.15}
              />
              <path
                className="kroom-outline-plus"
                d={`M${control.x - radius * 0.6} ${control.z + radius * 0.3}Q${control.x} ${control.z - radius} ${control.x + radius * 0.6} ${control.z + radius * 0.3}`}
                pointerEvents="none"
              />
              <title>
                Нумтай бариулыг чирж муруй хана үүсгэнэ · Delete: шулуун болгох
              </title>
            </g>
          </g>
        );
      })}
      {error && (
        <text
          role="alert"
          className="kroom-outline-error"
          x={room.width / 2}
          y={room.depth / 2}
          textAnchor="middle"
          fontSize={60}
        >
          {error}
        </text>
      )}
    </g>
  );
}
