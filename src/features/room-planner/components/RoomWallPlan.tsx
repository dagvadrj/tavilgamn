"use client";

import { useEffect, useId, useRef, useState, type PointerEvent } from "react";
import {
  Check,
  CornerDownRight,
  Grid2X2,
  MousePointer2,
  PencilLine,
  Redo2,
  Undo2,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { getRoomGeometry, roomPath, type Point } from "@/lib/roomGeometry";
import { getRoomMaterial } from "@/lib/roomMaterials";
import type { RoomBuilderDraft } from "@/lib/roomBuilderDraft";
import {
  formatWallLength,
  roomFromWallDrawing,
  snapWallPoint,
  wallDrawingIssue,
  wallLengthCm,
  wallUnitLabel,
  wallUnitScale,
  type WallDrawingUnit,
} from "@/lib/roomWallDrawing";
import "./room-wall-plan.css";

type Props = {
  draft: RoomBuilderDraft;
  selected: number;
  unit: WallDrawingUnit;
  onSelect: (index: number) => void;
  onChange: (draft: RoomBuilderDraft) => boolean;
  onEditStart: () => void;
  onEditEnd: (cancel?: boolean) => void;
  onDrawingChange: (drawing: boolean) => void;
  onError: (message: string) => void;
  onResizeWall: (length: number) => boolean;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
};

export function RoomWallPlan(props: Props) {
  const { draft, selected, unit, onDrawingChange } = props;
  const [tool, setTool] = useState<"select" | "line">("select");
  const [chain, setChainState] = useState<Point[]>([]);
  const chainRef = useRef(chain);
  const [redo, setRedoState] = useState<Point[]>([]);
  const redoRef = useRef(redo);
  const setRedo = (next: Point[]) => {
    redoRef.current = next;
    setRedoState(next);
  };
  const [cursor, setCursor] = useState<Point | null>(null);
  const [grid, setGrid] = useState(true);
  const [orthogonal, setOrthogonal] = useState(true);
  const [exact, setExact] = useState("");
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{
    pointer: number;
    before: RoomBuilderDraft;
    start: Point;
    indices: number[];
    normal?: Point;
    matrix: DOMMatrix;
    element: SVGSVGElement;
  } | null>(null);
  const id = useId().replace(/:/g, "");
  const geometry = getRoomGeometry(draft);
  const walls = geometry.segments.filter((s) => !s.hole);
  const points = draft.outline;
  const material = getRoomMaterial(draft.floorMaterial);
  const frame = drag.current?.before ?? draft;
  const width = (frame.width + 2.4) * zoom,
    depth = (frame.depth + 2.4) * zoom;
  const textSize = Math.max(width, depth) / 68;
  const radius = textSize * 0.55;
  const setChain = (next: Point[]) => {
    chainRef.current = next;
    setChainState(next);
    onDrawingChange(next.length > 0);
  };
  const reset = () => {
    setChain([]);
    setRedo([]);
    setCursor(null);
    setExact("");
    props.onError("");
  };
  const cleanup = useRef({ onDrawingChange, onEditEnd: props.onEditEnd });
  cleanup.current = { onDrawingChange, onEditEnd: props.onEditEnd };
  useEffect(() => {
    setExact("");
    setCursor(null);
  }, [unit]);
  useEffect(
    () => () => {
      if (drag.current) cleanup.current.onEditEnd(true);
      cleanup.current.onDrawingChange(false);
    },
    [],
  );
  useEffect(() => {
    const cancel = () => {
      const active = drag.current;
      if (!active) return;
      drag.current = null;
      cleanup.current.onEditEnd(true);
      if (active.element.hasPointerCapture(active.pointer))
        active.element.releasePointerCapture(active.pointer);
    };
    window.addEventListener("blur", cancel);
    return () => window.removeEventListener("blur", cancel);
  }, []);

  function close() {
    try {
      const next = roomFromWallDrawing(draft, chainRef.current);
      if (props.onChange(next)) {
        reset();
        setTool("select");
        setZoom(1);
        props.onSelect(0);
      }
    } catch (reason) {
      props.onError((reason as Error).message);
    }
  }
  function candidate(raw: Point) {
    const vertices = chainRef.current;
    if (
      vertices.length >= 3 &&
      Math.hypot(raw.x - vertices[0].x, raw.z - vertices[0].z) < radius * 2.5
    )
      return vertices[0];
    return snapWallPoint(
      raw,
      vertices.at(-1),
      grid,
      orthogonal,
      exact.trim() ? (Number(exact) / wallUnitScale[unit]) * 100 : undefined,
    );
  }
  function add(raw: Point) {
    try {
      const next = candidate(raw),
        vertices = chainRef.current;
      if (vertices.length >= 3 && next === vertices[0]) {
        close();
        return;
      }
      const issue = wallDrawingIssue(vertices, next);
      if (issue) {
        props.onError(issue);
        return;
      }
      setChain([...vertices, next]);
      setRedo([]);
      setCursor(null);
      setExact("");
      props.onError("");
    } catch (reason) {
      props.onError((reason as Error).message);
    }
  }
  function localUndo() {
    const vertices = chainRef.current;
    if (vertices.length) {
      setRedo([...redoRef.current, vertices.at(-1)!]);
      setChain(vertices.slice(0, -1));
      setCursor(null);
      props.onError("");
    } else if (!redoRef.current.length) props.onUndo();
  }
  function localRedo() {
    if (redoRef.current.length) {
      setChain([...chainRef.current, redoRef.current.at(-1)!]);
      setRedo(redoRef.current.slice(0, -1));
    } else if (!chainRef.current.length) props.onRedo();
  }
  function location(event: PointerEvent<SVGElement>): Point | null {
    const matrix = svgRef.current?.getScreenCTM()?.inverse();
    if (!matrix) return null;
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix,
    );
    return { x: p.x, z: p.y };
  }
  function startDrag(
    event: PointerEvent<SVGElement>,
    indices: number[],
    index: number,
    normal?: Point,
  ) {
    if (tool !== "select" || event.button !== 0 || drag.current) return;
    const element = svgRef.current,
      matrix = element?.getScreenCTM()?.inverse(),
      start = location(event);
    if (!element || !matrix || !start || !points) return;
    event.preventDefault();
    event.stopPropagation();
    props.onSelect(index);
    props.onEditStart();
    drag.current = {
      pointer: event.pointerId,
      before: structuredClone(draft),
      start,
      indices,
      normal,
      matrix,
      element,
    };
    element.setPointerCapture(event.pointerId);
  }
  function finish(event: PointerEvent<SVGSVGElement>, cancel = false) {
    const active = drag.current;
    if (!active || active.pointer !== event.pointerId) return;
    drag.current = null;
    props.onEditEnd(cancel);
    if (active.element.hasPointerCapture(event.pointerId))
      active.element.releasePointerCapture(event.pointerId);
  }
  const preview =
    cursor && chain.length
      ? (() => {
          try {
            return candidate(cursor);
          } catch {
            return null;
          }
        })()
      : null;
  const selectedWall = walls[selected];
  const label = (a: Point, b: Point, key: string, live = false) => {
    const length = Math.hypot(b.x - a.x, b.z - a.z);
    if (!length) return null;
    const nx = -(b.z - a.z) / length,
      nz = (b.x - a.x) / length;
    let angle = (Math.atan2(b.z - a.z, b.x - a.x) * 180) / Math.PI;
    if (angle > 90) angle -= 180;
    if (angle < -90) angle += 180;
    return (
      <text
        key={key}
        className={live ? "room-wall-live-length" : "room-wall-length"}
        x={(a.x + b.x) / 2 - nx * textSize * 2}
        y={(a.z + b.z) / 2 - nz * textSize * 2}
        fontSize={textSize}
        textAnchor="middle"
        dominantBaseline="middle"
        transform={`rotate(${angle} ${(a.x + b.x) / 2 - nx * textSize * 2} ${(a.z + b.z) / 2 - nz * textSize * 2})`}
      >
        {formatWallLength(length, unit)}
      </text>
    );
  };
  return (
    <div
      className={`room-wall-plan is-${tool}`}
      onKeyDown={(event) => {
        if (
          (event.target as HTMLElement).tagName === "INPUT" &&
          event.key !== "Escape"
        )
          return;
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          const active = drag.current;
          if (active) {
            drag.current = null;
            props.onEditEnd(true);
            if (active.element.hasPointerCapture(active.pointer))
              active.element.releasePointerCapture(active.pointer);
          } else reset();
        } else if (event.key === "Enter" && chainRef.current.length >= 3) {
          event.preventDefault();
          close();
        } else if (event.key === "Backspace" && chainRef.current.length) {
          event.preventDefault();
          localUndo();
        }
      }}
    >
      <div
        className="room-wall-tools"
        role="toolbar"
        aria-label="Ханын зураг зурах хэрэгслүүд"
      >
        <div>
          <button
            type="button"
            aria-pressed={tool === "select"}
            onClick={() => {
              if (chain.length) reset();
              setTool("select");
            }}
          >
            <MousePointer2 size={17} /> Сонгох
          </button>
          <button
            type="button"
            aria-pressed={tool === "line"}
            onClick={() => {
              if (tool === "line") return;
              reset();
              setTool("line");
              svgRef.current?.focus();
            }}
          >
            <PencilLine size={17} /> Line
          </button>
        </div>
        <div>
          <button
            type="button"
            aria-label="10 см-ийн торонд тааруулах"
            title="10 см-ийн торонд тааруулах"
            aria-pressed={grid}
            onClick={() => setGrid(!grid)}
          >
            <Grid2X2 size={17} />
          </button>
          <button
            type="button"
            aria-label="90 градусын өнцөг барих"
            title="90 градусын өнцөг барих"
            aria-pressed={orthogonal}
            onClick={() => setOrthogonal(!orthogonal)}
          >
            <CornerDownRight size={17} />
            <span>90°</span>
          </button>
        </div>
        <div>
          <button
            type="button"
            aria-label="Үйлдэл буцаах"
            title="Үйлдэл буцаах"
            disabled={!chain.length && (!!redo.length || !props.canUndo)}
            onClick={localUndo}
          >
            <Undo2 size={17} />
          </button>
          <button
            type="button"
            aria-label="Дахин хийх"
            title="Дахин хийх"
            disabled={!redo.length && (!!chain.length || !props.canRedo)}
            onClick={localRedo}
          >
            <Redo2 size={17} />
          </button>
          <button
            type="button"
            aria-label="Холдуулах"
            title="Холдуулах"
            disabled={zoom >= 3}
            onClick={() => setZoom(Math.min(3, zoom * 1.25))}
          >
            <ZoomOut size={17} />
          </button>
          <button
            type="button"
            aria-label="Ойртуулах"
            title="Ойртуулах"
            disabled={zoom <= 0.5}
            onClick={() => setZoom(Math.max(0.5, zoom / 1.25))}
          >
            <ZoomIn size={17} />
          </button>
        </div>
        {chain.length > 0 && (
          <div>
            <button type="button" disabled={chain.length < 3} onClick={close}>
              <Check size={17} /> Хаах
            </button>
            <button
              type="button"
              aria-label="Зурж буй хүрээг болих"
              onClick={reset}
            >
              <X size={17} />
            </button>
          </div>
        )}
      </div>
      <label className="room-wall-exact">
        {tool === "line" ? "Дараагийн хана" : `Хана ${selected + 1}`}
        <input
          type="number"
          aria-label={`Ханын урт (${wallUnitLabel[unit]})`}
          min={0.05 * wallUnitScale[unit]}
          max={20 * wallUnitScale[unit]}
          step={unit === "m" ? 0.01 : 1}
          key={`${tool}-${chain.length}-${selectedWall?.length}-${unit}`}
          disabled={tool === "line" && !chain.length}
          defaultValue={
            tool === "select" && selectedWall
              ? Number((selectedWall.length * wallUnitScale[unit]).toFixed(2))
              : ""
          }
          onChange={(event) => {
            if (tool === "line") setExact(event.target.value);
          }}
          onBlur={(event) => {
            if (tool !== "select") return;
            const value = Number(event.target.value);
            if (!event.target.value.trim() || !Number.isFinite(value)) {
              event.target.value = String(
                (selectedWall?.length ?? 0) * wallUnitScale[unit],
              );
              return;
            }
            if (
              value / wallUnitScale[unit] !== selectedWall?.length &&
              !props.onResizeWall(value / wallUnitScale[unit])
            )
              event.target.value = String(
                (selectedWall?.length ?? 0) * wallUnitScale[unit],
              );
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              if (tool === "line") reset();
              else {
                event.currentTarget.value = String(
                  (selectedWall?.length ?? 0) * wallUnitScale[unit],
                );
                event.currentTarget.blur();
              }
              return;
            }
            if (event.key === "Enter") {
              event.preventDefault();
              event.stopPropagation();
              if (tool === "line" && chainRef.current.length)
                add(
                  cursor ?? {
                    x: chainRef.current.at(-1)!.x + 1,
                    z: chainRef.current.at(-1)!.z,
                  },
                );
              else event.currentTarget.blur();
            }
          }}
        />
        <span>{wallUnitLabel[unit]}</span>
      </label>
      <svg
        ref={svgRef}
        className="room-wall-canvas"
        viewBox={`${-width / 2} ${-depth / 2} ${width} ${depth}`}
        tabIndex={0}
        aria-label="Өрөөний шугаман план"
        style={{ touchAction: "none" }}
        onPointerDown={(event) => {
          if (tool === "line" && event.button === 0) {
            event.preventDefault();
            svgRef.current?.focus();
            const p = location(event);
            if (p) add(p);
          }
        }}
        onPointerMove={(event) => {
          const active = drag.current;
          if (!active) {
            if (tool === "line") setCursor(location(event));
            return;
          }
          if (event.pointerId !== active.pointer) return;
          const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(
            active.matrix,
          );
          let dx = p.x - active.start.x,
            dz = p.y - active.start.z;
          if (active.normal) {
            const distance = dx * active.normal.x + dz * active.normal.z;
            dx = distance * active.normal.x;
            dz = distance * active.normal.z;
          }
          if (grid) {
            dx = Math.round(dx * 10) / 10;
            dz = Math.round(dz * 10) / 10;
          }
          const outline = active.before.outline!.map((v, i) =>
            active.indices.includes(i) ? { ...v, x: v.x + dx, z: v.z + dz } : v,
          );
          props.onChange({
            ...active.before,
            outline,
            width: Math.max(
              active.before.width,
              ...outline.map((v) => Math.abs(v.x) * 2),
            ),
            depth: Math.max(
              active.before.depth,
              ...outline.map((v) => Math.abs(v.z) * 2),
            ),
          });
        }}
        onPointerLeave={() => {
          if (!drag.current) setCursor(null);
        }}
        onPointerUp={(event) => finish(event)}
        onPointerCancel={(event) => finish(event, true)}
        onLostPointerCapture={(event) => finish(event, true)}
      >
        <defs>
          <pattern
            id={`${id}-floor`}
            width={material?.tileMetersX ?? 1.8}
            height={material?.tileMetersY ?? 1.4}
            patternUnits="userSpaceOnUse"
          >
            <rect
              width="100%"
              height="100%"
              fill={material?.color ?? draft.floorColor}
            />
            {material?.texturePaths?.color ? (
              <image
                href={material.texturePaths.color}
                width={material.tileMetersX}
                height={material.tileMetersY}
                preserveAspectRatio="none"
              />
            ) : (
              <path
                d="M0 .2H3M0 .4H3M0 .6H3M0 .8H3M0 1H3M0 1.2H3M.6 0V.2M1.2 .2V.4M.3 .4V.6M.9 .6V.8"
                stroke={material?.accent ?? "#aaa"}
                strokeWidth=".008"
                opacity=".3"
              />
            )}
          </pattern>
          <pattern
            id={`${id}-grid`}
            width=".1"
            height=".1"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M.1 0H0V.1"
              fill="none"
              stroke="#aab0b6"
              strokeWidth=".003"
              opacity=".25"
            />
          </pattern>
          <linearGradient id={`${id}-wall`} x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#fff" />
            <stop offset=".48" stopColor="#f5f5f4" />
            <stop offset="1" stopColor="#c9c9c7" />
          </linearGradient>
          <filter
            id={`${id}-shadow`}
            x="-20%"
            y="-20%"
            width="140%"
            height="140%"
          >
            <feDropShadow
              dx="0"
              dy=".035"
              stdDeviation=".045"
              floodOpacity=".18"
            />
          </filter>
        </defs>
        {tool === "line" && grid && (
          <rect
            x={-width / 2}
            y={-depth / 2}
            width={width}
            height={depth}
            fill={`url(#${id}-grid)`}
            pointerEvents="none"
          />
        )}
        <g
          opacity={chain.length ? 0.2 : 1}
          pointerEvents={tool === "line" ? "none" : undefined}
        >
          <path
            d={roomPath(draft)}
            fill={`url(#${id}-floor)`}
            stroke="#fff"
            strokeWidth=".22"
            strokeLinejoin="miter"
            filter={`url(#${id}-shadow)`}
          />
          <path
            d={roomPath(draft)}
            fill="none"
            stroke={`url(#${id}-wall)`}
            strokeWidth=".16"
            strokeLinejoin="miter"
            pointerEvents="none"
          />
          {walls.map((wall, index) => (
            <g key={wall.id ?? index}>
              <line
                x1={wall.a.x}
                y1={wall.a.z}
                x2={wall.b.x}
                y2={wall.b.z}
                stroke={index === selected ? "var(--site-accent)" : "#555b61"}
                strokeWidth={index === selected ? 3 : 1.5}
                vectorEffect="non-scaling-stroke"
              />
              <line
                className="room-wall-hit"
                x1={wall.a.x}
                y1={wall.a.z}
                x2={wall.b.x}
                y2={wall.b.z}
                stroke="transparent"
                strokeWidth="22"
                vectorEffect="non-scaling-stroke"
                role="button"
                tabIndex={tool === "select" ? 0 : -1}
                aria-label={`Хана ${index + 1}, ${formatWallLength(wall.length, unit)}`}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    props.onSelect(index);
                  }
                }}
                onPointerDown={(event) =>
                  startDrag(event, [index, (index + 1) % walls.length], index, {
                    x: wall.nx,
                    z: wall.nz,
                  })
                }
              />
              {!chain.length && label(wall.a, wall.b, `label-${index}`)}
            </g>
          ))}
          {points?.map((p, index) => (
            <circle
              key={p.id}
              cx={p.x}
              cy={p.z}
              r={radius}
              fill="white"
              stroke={index === selected ? "var(--site-accent)" : "#71717a"}
              strokeWidth="1.5"
              vectorEffect="non-scaling-stroke"
              role="button"
              tabIndex={tool === "select" ? 0 : -1}
              aria-label={`Өрөөний цэг ${index + 1}`}
              onPointerDown={(event) => startDrag(event, [index], index)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  props.onSelect(index);
                }
              }}
            />
          ))}
        </g>
        {chain.length > 0 && (
          <g className="room-wall-drawing" pointerEvents="none">
            <polyline
              points={[...chain, ...(preview ? [preview] : [])]
                .map((p) => `${p.x},${p.z}`)
                .join(" ")}
              fill="none"
              stroke="var(--site-accent)"
              strokeWidth="3"
              vectorEffect="non-scaling-stroke"
            />
            {chain
              .slice(1)
              .map((p, index) => label(chain[index], p, `draw-${index}`))}
            {preview && label(chain.at(-1)!, preview, "live", true)}
            {chain.map((p, index) => (
              <circle
                key={index}
                cx={p.x}
                cy={p.z}
                r={index ? radius * 0.65 : radius * 1.3}
                fill={index ? "white" : "var(--site-accent)"}
                stroke="var(--site-accent)"
                strokeWidth="2"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        )}
      </svg>
      <p className="room-wall-status" role="status">
        {tool === "line"
          ? chain.length
            ? `${chain.length - 1} хана · ${preview ? formatWallLength(wallLengthCm(chain.at(-1)!, preview) / 100, unit) : "Дараагийн цэгээ сонгоно уу"} · Эхний цэг дээр дарж хаана`
            : "Эхний цэгээ сонгоод хануудаа дараалан зурна · Escape: болих"
          : "Ханыг чирж хэмжээ өөрчлөх · Булангийн цэгийг чирж хэлбэр засах"}
      </p>
    </div>
  );
}
