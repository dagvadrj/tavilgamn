"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import type { PlacedFurniture, RoomShape, RoomWall } from "@/lib/types";
import { getRoomGeometry, type Bounds, type Point } from "@/lib/roomGeometry";
import {
  getRoomWallTargets,
  moveRoomWall,
  type RoomWallTarget,
} from "@/lib/roomWallEditing";
import { RoomPlanPreview } from "./RoomPlanPreview";
import { pieceRects } from "@/three/collision";

type Gesture = {
  pointerId: number;
  target: RoomWallTarget;
  room: RoomShape;
  start: Point;
  inverse: DOMMatrix;
  bounds: Bounds;
  contentShift: Point;
};

/** Keep one coordinate system for the whole gesture, even as the room resizes. */
export function RoomWallPlan({
  room,
  pieces,
  onChange,
  onMovePiece,
  onSelectPiece,
  selectedPiece,
  onSurfaceDoubleClick,
}: {
  onSurfaceDoubleClick?: (
    surface: "wall" | "floor" | "ceiling",
    wall: RoomWall | undefined,
    x: number,
    y: number,
  ) => void;
  onMovePiece?: (id: string, x: number, z: number) => string | null;
  onSelectPiece?: (id: string) => void;
  selectedPiece?: string | null;
  room: RoomShape;
  pieces?: PlacedFurniture[];
  onChange: (room: RoomShape, contentShift?: Point) => string | null;
}) {
  const pieceGesture = useRef<{
    pointer: number;
    inverse: DOMMatrix;
    piece: PlacedFurniture;
    start: Point;
  } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const pendingFrame = useRef<number | null>(null);
  const pendingPoint = useRef<Point | null>(null);
  const [dragView, setDragView] = useState<{
    bounds: Bounds;
    offset: Point;
  } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [issue, setIssue] = useState("");
  const helpId = useId();
  const moveFurniture = (event: PointerEvent<SVGSVGElement>) => {
    const furniture = pieceGesture.current;
    if (!furniture || furniture.pointer !== event.pointerId) return false;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      furniture.inverse,
    );
    setIssue(
      onMovePiece?.(
        furniture.piece.instanceId,
        Math.round((furniture.piece.x + p.x - furniture.start.x) * 1000) / 1000,
        Math.round((furniture.piece.z + p.y - furniture.start.z) * 1000) / 1000,
      ) ?? "",
    );
    return true;
  };
  useEffect(
    () => () => {
      if (pendingFrame.current !== null)
        cancelAnimationFrame(pendingFrame.current);
      gesture.current = null;
      pieceGesture.current = null;
    },
    [],
  );
  const targets = getRoomWallTargets(room);
  const selected = targets.find((target) => target.id === selectedId);
  const geometry = getRoomGeometry(room);
  const bounds = dragView?.bounds ?? geometry.bounds;
  const span = Math.max(bounds.maxX - bounds.minX, bounds.maxZ - bounds.minZ);
  const grip = span / 55;

  const applyMove = (
    source: RoomShape,
    target: RoomWallTarget,
    delta: number,
    previousShift: Point = { x: 0, z: 0 },
  ) => {
    const result = moveRoomWall(source, target, delta);
    const { width, depth, height, wallFeatures, columns, openings } =
      result.room;
    const shift = result.contentShift ?? { x: 0, z: 0 };
    const error =
      result.error ??
      onChange(
        { width, depth, height, wallFeatures, columns, openings },
        {
          x: shift.x - previousShift.x,
          z: shift.z - previousShift.z,
        },
      );
    setIssue(error ?? "");
    return error ? null : { room: result.room, shift };
  };
  const movePointer = (point: Point) => {
    const active = gesture.current;
    if (!active) return;
    const next = applyMove(
      active.room,
      active.target,
      point[active.target.axis] - active.start[active.target.axis],
      active.contentShift,
    );
    if (!next) return;
    // Compensate the normalized room origin on screen. The same shift is
    // applied inversely to furniture/lights so the opposite wall stays still.
    active.contentShift = next.shift;
    const offset = { x: -next.shift.x, z: -next.shift.z };
    setDragView({ bounds: active.bounds, offset });
  };
  const pointerPoint = (
    event: PointerEvent<SVGSVGElement>,
    active: Gesture,
  ) => {
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      active.inverse,
    );
    return { x: point.x, z: point.y };
  };
  const startDrag = (
    event: PointerEvent<SVGElement>,
    target: RoomWallTarget,
    focusTarget?: SVGElement | null,
  ) => {
    if (event.button !== 0 || gesture.current) return;
    const svg = svgRef.current,
      matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return;
    event.preventDefault();
    (focusTarget ?? event.currentTarget).focus({ preventScroll: true });
    const inverse = matrix.inverse();
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      inverse,
    );
    gesture.current = {
      pointerId: event.pointerId,
      target,
      room,
      inverse,
      start: { x: point.x, z: point.y },
      bounds: geometry.bounds,
      contentShift: { x: 0, z: 0 },
    };
    setSelectedId(target.id);
    setIssue("");
    setDragView({ bounds: geometry.bounds, offset: { x: 0, z: 0 } });
    svg.setPointerCapture(event.pointerId);
  };
  const flushPointer = () => {
    if (pendingFrame.current !== null)
      cancelAnimationFrame(pendingFrame.current);
    pendingFrame.current = null;
    if (pendingPoint.current) movePointer(pendingPoint.current);
    pendingPoint.current = null;
  };
  const endDrag = (event: PointerEvent<SVGSVGElement>, cancelled = false) => {
    const active = gesture.current;
    if (!active || event.pointerId !== active.pointerId) return;
    // A browser-cancelled gesture keeps the last valid result, never a phantom
    // pointer coordinate. Pointer-up consumes its final coordinate immediately.
    if (!cancelled) pendingPoint.current = pointerPoint(event, active);
    flushPointer();
    gesture.current = null;
    setDragView(null);
    if (svgRef.current?.hasPointerCapture(event.pointerId))
      svgRef.current.releasePointerCapture(event.pointerId);
  };
  const keyMove = (
    event: KeyboardEvent<SVGElement>,
    target: RoomWallTarget,
  ) => {
    const direction =
      target.axis === "x"
        ? { ArrowLeft: -1, ArrowRight: 1 }[event.key]
        : { ArrowUp: -1, ArrowDown: 1 }[event.key];
    if (direction === undefined) return;
    event.preventDefault();
    event.stopPropagation();
    if (!gesture.current)
      applyMove(room, target, direction * (event.shiftKey ? 0.01 : 0.001));
  };

  return (
    <section className="room-wall-plan" aria-label="Хана чирж төлөвлөх">
      <p id={helpId} className="room-shape-help">
        Хана эсвэл дугуй бариулыг чирж хэмжээг өөрчилнө. Сум: 1 мм · Shift +
        сум: 10 мм.
      </p>
      <div className="room-wall-live" aria-live="polite" aria-atomic="true">
        <span>
          <strong>
            {Math.round(room.width * 1000)} × {Math.round(room.depth * 1000)}
          </strong>{" "}
          мм
        </span>
        <span>
          <strong>{geometry.area.toFixed(2)}</strong> м²
        </span>
      </div>
      <RoomPlanPreview
        room={room}
        pieces={pieces}
        editing={{
          svgRef,
          bounds: dragView?.bounds,
          offset: dragView?.offset,
          svgProps: {
            onDoubleClick: (event) => {
              if (
                (event.target as Element).classList?.contains("room-plan-floor")
              )
                onSurfaceDoubleClick?.(
                  "floor",
                  undefined,
                  event.clientX,
                  event.clientY,
                );
            },
            "aria-describedby": helpId,
            onPointerMove: (event) => {
              if (moveFurniture(event)) return;
              const active = gesture.current;
              if (!active || active.pointerId !== event.pointerId) return;
              pendingPoint.current = pointerPoint(event, active);
              if (pendingFrame.current === null)
                pendingFrame.current = requestAnimationFrame(() => {
                  pendingFrame.current = null;
                  const point = pendingPoint.current;
                  pendingPoint.current = null;
                  if (point) movePointer(point);
                });
            },
            onPointerUp: (event) => {
              if (pieceGesture.current?.pointer === event.pointerId) {
                moveFurniture(event);
                pieceGesture.current = null;
                svgRef.current?.releasePointerCapture(event.pointerId);
              } else endDrag(event);
            },
            onPointerCancel: (event) => {
              if (pieceGesture.current?.pointer === event.pointerId)
                pieceGesture.current = null;
              endDrag(event, true);
            },
            onLostPointerCapture: (event) => {
              if (pieceGesture.current?.pointer === event.pointerId)
                pieceGesture.current = null;
              endDrag(event, true);
            },
          },
          overlay: (
            <g className="room-wall-handles">
              {onMovePiece &&
                pieces?.flatMap((piece) =>
                  pieceRects(piece).map((r, i) => (
                    <g
                      key={`${piece.instanceId}:${i}`}
                      transform={`translate(${r.cx} ${r.cz}) rotate(${(r.rot * 180) / Math.PI})`}
                    >
                      <rect
                        x={-r.w / 2}
                        y={-r.d / 2}
                        width={r.w}
                        height={r.d}
                        fill="transparent"
                        stroke={
                          selectedPiece === piece.instanceId
                            ? "#0876c2"
                            : "transparent"
                        }
                        strokeWidth={2}
                        vectorEffect="non-scaling-stroke"
                        role="button"
                        tabIndex={0}
                        aria-label={`${piece.details?.name ?? "Тавилга"} · чирж зөөх`}
                        style={{ cursor: "move" }}
                        onPointerDown={(event) => {
                          if (event.button !== 0) return;
                          event.stopPropagation();
                          event.preventDefault();
                          const matrix = svgRef.current?.getScreenCTM();
                          if (!matrix) return;
                          const inverse = matrix.inverse();
                          const p = new DOMPoint(
                            event.clientX,
                            event.clientY,
                          ).matrixTransform(inverse);
                          pieceGesture.current = {
                            pointer: event.pointerId,
                            inverse,
                            piece,
                            start: { x: p.x, z: p.y },
                          };
                          onSelectPiece?.(piece.instanceId);
                          svgRef.current?.setPointerCapture(event.pointerId);
                        }}
                        onKeyDown={(event) => {
                          const move = (
                            {
                              ArrowLeft: [-0.01, 0],
                              ArrowRight: [0.01, 0],
                              ArrowUp: [0, -0.01],
                              ArrowDown: [0, 0.01],
                            } as Record<string, number[]>
                          )[event.key];
                          if (!move) return;
                          event.preventDefault();
                          onSelectPiece?.(piece.instanceId);
                          setIssue(
                            onMovePiece(
                              piece.instanceId,
                              piece.x + move[0],
                              piece.z + move[1],
                            ) ?? "",
                          );
                        }}
                      />
                    </g>
                  )),
                )}
              {targets.map((target) => {
                const { a, b } = target.segment;
                return (
                  <g
                    key={`wall:${target.id}`}
                    className={`room-wall-handle room-wall-handle-${target.axis}${selectedId === target.id ? " is-selected" : ""}`}
                    onDoubleClick={(event) => {
                      event.stopPropagation();
                      onSurfaceDoubleClick?.(
                        "wall",
                        target.wall,
                        event.clientX,
                        event.clientY,
                      );
                    }}
                    onPointerDown={(event) =>
                      startDrag(
                        event,
                        target,
                        Array.from(
                          svgRef.current?.querySelectorAll<SVGCircleElement>(
                            ".room-wall-grip",
                          ) ?? [],
                        ).find((grip) => grip.dataset.wallTarget === target.id),
                      )
                    }
                  >
                    <title>{target.label} · чирж өөрчлөх</title>
                    <line
                      className="room-wall-hit"
                      x1={a.x}
                      y1={a.z}
                      x2={b.x}
                      y2={b.z}
                    />
                    <line
                      className="room-wall-highlight"
                      x1={a.x}
                      y1={a.z}
                      x2={b.x}
                      y2={b.z}
                    />
                  </g>
                );
              })}
              {targets.map((target) => {
                const { a, b } = target.segment;
                const x = (a.x + b.x) / 2,
                  z = (a.z + b.z) / 2;
                // All grips sit above all wall hit areas. A neighboring short wall's
                // wide touch target must not cover this wall's visible handle.
                return (
                  <g
                    key={`grip:${target.id}`}
                    className={`room-wall-handle room-wall-handle-${target.axis}${selectedId === target.id ? " is-selected" : ""}`}
                    onPointerDown={(event) =>
                      startDrag(
                        event,
                        target,
                        event.currentTarget.querySelector<SVGCircleElement>(
                          ".room-wall-grip",
                        ),
                      )
                    }
                  >
                    <circle
                      className="room-wall-grip-hit"
                      cx={x}
                      cy={z}
                      r={grip * 2.8}
                    />
                    <circle
                      className="room-wall-grip"
                      data-wall-target={target.id}
                      cx={x}
                      cy={z}
                      r={grip * 1.7}
                      role="button"
                      tabIndex={0}
                      aria-label={`${target.label} · ${Math.round(target.segment.length * 1000)} мм · чирж өөрчлөх`}
                      aria-pressed={selectedId === target.id}
                      aria-describedby={helpId}
                      onFocus={() => setSelectedId(target.id)}
                      onPointerDown={(event) => startDrag(event, target)}
                      onKeyDown={(event) => keyMove(event, target)}
                    />
                    <path
                      className="room-wall-grip-arrow"
                      transform={`translate(${x} ${z})${target.axis === "z" ? " rotate(90)" : ""}`}
                      d={`M${-grip},0 H${grip} M${-grip * 0.5},${-grip * 0.5} L${-grip},0 L${-grip * 0.5},${grip * 0.5} M${grip * 0.5},${-grip * 0.5} L${grip},0 L${grip * 0.5},${grip * 0.5}`}
                    />
                  </g>
                );
              })}
            </g>
          ),
        }}
      />
      <div
        className={`room-wall-feedback${issue ? " has-error" : ""}`}
        role="status"
        aria-live="polite"
      >
        {issue ||
          (selected
            ? `${selected.label} · ${Math.round(selected.segment.length * 1000)} мм`
            : "Хана сонгоход тухайн хэсгийн хэмжээ энд харагдана.")}
      </div>
    </section>
  );
}
