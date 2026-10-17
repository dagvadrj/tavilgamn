"use client";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight, Check, X, Undo2, Redo2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react";
import type { RoomDesign, RoomShape, RoomSurfaces } from "@/lib/types";
import { getRoomGeometry, roomPath } from "@/lib/roomGeometry";
import { ROOM_TEMPLATES, type RoomTemplate } from "@/lib/roomPolygon";
import {
  BUILDER_STAGES,
  builderInteraction,
  builderWallIndex,
  chooseRoomTemplate,
  initializeRoomBuilder,
  selectedRoomTemplate,
  resizeRoomBuilder,
  transformRoomBuilder,
  validateRoomBuilder,
  type RoomBuilderDraft,
} from "@/lib/roomBuilderDraft";
import {
  createRoomBuilderHistory,
  reduceRoomBuilderHistory,
  type RoomBuilderAction,
} from "@/lib/roomBuilderHistory";
import { createOpening, OPENING_TEMPLATES } from "@/lib/roomOpenings";
import { FLOOR_MATERIALS } from "@/lib/roomMaterials";
import { OpeningQuickEditor } from "./OpeningQuickEditor";
import "./room-builder.css";
const RoomCanvas = dynamic(
  () => import("@/three/RoomCanvas").then((m) => m.RoomCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="room-builder-loading" role="status">
        Өрөөг бэлдэж байна…
      </div>
    ),
  },
);
export function RoomBuilder({
  initial,
  onComplete,
  onCancel,
}: {
  initial: RoomShape &
    Partial<
      RoomSurfaces & {
        wallColor: string;
        floorColor: string;
      }
    >;
  onComplete: (draft: RoomBuilderDraft) => string | null;
  onCancel: () => void;
}) {
  const [history, setHistory] = useState(() =>
    createRoomBuilderHistory(initializeRoomBuilder(initial)),
  );
  const historyRef = useRef(history);
  const { draft, past, future } = history;
  const [stage, setStage] = useState(0),
    [ceiling, setCeiling] = useState(false);
  const [error, setError] = useState(""),
    [selected, setSelected] = useState(0);
  const [unit, setUnit] = useState<"cm" | "ft">("cm");
  const [furthestStage, setFurthestStage] = useState(0);
  const [openingKind, setOpeningKind] = useState<"door" | "window">("door");
  const [selectedOpening, setSelectedOpening] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [stage]);
  const gesture = useRef<{
    pointer: number;
    index: number;
    matrix: DOMMatrix;
    before: RoomBuilderDraft;
    element: SVGSVGElement;
  } | null>(null);
  const geometry = useMemo(() => getRoomGeometry(draft), [draft]);
  const mode = builderInteraction(stage, ceiling);
  const preview = useMemo(
    () =>
      ({
        ...draft,
        id: "room-builder-preview",
        name: "Өрөөний ноорог",
        size: "80",
        pieces: [],
        createdAt: 0,
        updatedAt: 0,
      }) as RoomDesign,
    [draft],
  );
  const send = useCallback((action: RoomBuilderAction) => {
    const next = reduceRoomBuilderHistory(historyRef.current, action);
    historyRef.current = next;
    setHistory(next);
    setError(next.error ?? "");
    return !next.error;
  }, []);
  const change = (next: RoomBuilderDraft) =>
    send({ type: "change", draft: next });
  const beginEdit = useCallback(() => {
    send({ type: "begin" });
  }, [send]);
  const endEdit = useCallback(() => {
    send({ type: "end" });
  }, [send]);
  function selectStage(next: number) {
    endEdit();
    const issue = validateRoomBuilder(historyRef.current.draft);
    if (issue) {
      setError(issue);
      return;
    }
    setStage(next);
    setFurthestStage((value) => Math.max(value, next));
    setCeiling(false);
    setError("");
  }
  const measure = (
    label: string,
    value: number,
    update: (value: number) => boolean,
  ) => {
    if (unit === "cm")
      return (
        <label>
          {label} (см)
          <input
            key={`${label}-${value}-cm`}
            type="number"
            defaultValue={Number((value * 100).toFixed(2))}
            step="0.1"
            min="5"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
            onBlur={(e) => {
              const number = Number(e.target.value) / 100;
              if (
                !e.target.value.trim() ||
                !Number.isFinite(number) ||
                (number !== value && !update(number))
              ) {
                e.currentTarget.value = String(
                  Number((value * 100).toFixed(2)),
                );
              }
            }}
          />
        </label>
      );
    const totalInches = Math.round((value / 0.0254) * 100) / 100,
      feet = Math.floor(totalInches / 12),
      inches = Number((totalInches - feet * 12).toFixed(2));
    return (
      <fieldset className="room-builder-history">
        <legend>{label} · фут, инч</legend>
        <label>
          Фут
          <input
            key={`${label}-${value}-feet`}
            type="number"
            min="0"
            step="1"
            defaultValue={feet}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (
                !e.target.value.trim() ||
                !Number.isInteger(n) ||
                n < 0 ||
                !update((n * 12 + inches) * 0.0254)
              )
                e.currentTarget.value = String(feet);
            }}
          />
        </label>
        <label>
          Инч
          <input
            key={`${label}-${value}-inches`}
            type="number"
            min="0"
            max="11.99"
            step=".1"
            defaultValue={inches}
            onBlur={(e) => {
              const n = Number(e.target.value);
              if (
                !e.target.value.trim() ||
                !Number.isFinite(n) ||
                n < 0 ||
                n >= 12 ||
                !update((feet * 12 + n) * 0.0254)
              )
                e.currentTarget.value = String(inches);
            }}
          />
        </label>
      </fieldset>
    );
  };
  function finishGesture(event: PointerEvent<SVGSVGElement>, cancel = false) {
    const active = gesture.current;
    if (!active || active.pointer !== event.pointerId) return;
    gesture.current = null;
    send({ type: cancel ? "cancel" : "end" });
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
  }
  const points = draft.outline;
  const walls = geometry.segments.filter((s) => !s.hole);
  const wallIndex = builderWallIndex(selected, walls.length);
  const template = selectedRoomTemplate(draft);
  return (
    <section
      className="room-builder"
      aria-label="Дөрвөн алхамтай өрөө байгуулагч"
      onKeyDown={(event) => {
        if (event.key === "Escape" && gesture.current) {
          event.preventDefault();
          event.stopPropagation();
          const active = gesture.current;
          gesture.current = null;
          send({ type: "cancel" });
          if (active.element.hasPointerCapture(active.pointer))
            active.element.releasePointerCapture(active.pointer);
        }
      }}
    >
      <aside className="room-builder-panel">
        <div className="room-builder-brand">
          <span>Өрөөгөө байгуулах</span>
          <button
            type="button"
            className="room-builder-close"
            onClick={onCancel}
            aria-label="Өрөө байгуулахыг болих"
          >
            <X size={18} />
          </button>
        </div>
        <ol className="room-builder-steps" aria-label="Өрөө байгуулах алхмууд">
          {BUILDER_STAGES.map((label, i) => (
            <li key={label}>
              <button
                type="button"
                disabled={i > furthestStage}
                aria-current={stage === i ? "step" : undefined}
                onClick={() => selectStage(i)}
              >
                <span>
                  {i < stage ? <Check size={14} aria-hidden="true" /> : i + 1}
                </span>
                <small>{label}</small>
              </button>
            </li>
          ))}
        </ol>
        <div className="room-builder-content">
          <header className="room-builder-stage-heading">
            <p className="room-builder-progress" aria-live="polite">
              Алхам {stage + 1} / 4
            </p>
            <h2 ref={heading} tabIndex={-1}>
              {
                [
                  "Өрөөний хэлбэрээ сонгоё",
                  "Бодит хэмжээгээ оруулъя",
                  "Хаалга, цонхоо нэмье",
                  "Өнгө, материалаа сонгоё",
                ][stage]
              }
            </h2>
            <p>
              {
                [
                  "Өрөөнийхөө план зурагтай хамгийн төстэй хэлбэрийг сонгоорой.",
                  "Эхлээд өргөн, уртаа оруулаад таазны өндрөө тохируулна.",
                  "Ханаа сонгоод хаалга эсвэл цонх нэмээрэй. Дараа нь чирж байрлуулж болно.",
                  "Өөрчлөлт бүр өрөөн дээр шууд харагдана. Дуусгаад тавилгаа байрлуулаарай.",
                ][stage]
              }
            </p>
          </header>
          {stage === 0 && (
            <>
              <div className="room-builder-templates">
                {(Object.keys(ROOM_TEMPLATES) as RoomTemplate[]).map((key) => (
                  <button
                    type="button"
                    key={key}
                    aria-pressed={template === key}
                    onClick={() => {
                      if (template === key) return;
                      change(chooseRoomTemplate(historyRef.current.draft, key));
                      setSelected(0);
                    }}
                  >
                    <svg viewBox="-5 -5 110 110" aria-hidden="true">
                      <polygon
                        points={ROOM_TEMPLATES[key].points
                          .map(([x, z]) => `${x * 100},${z * 100}`)
                          .join(" ")}
                      />
                    </svg>
                    <strong>{ROOM_TEMPLATES[key].label}</strong>
                    {template === key && (
                      <span className="room-builder-choice-check">
                        <Check size={14} aria-hidden="true" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <p className="room-builder-note">
                Дараагийн алхамд хэмжээг нь өөрчилж болно. Өөр хэлбэр сонговол
                өмнөх хаалга, цонх, материал шинэчлэгдэнэ.
              </p>
            </>
          )}
          {stage === 1 && (
            <>
              <div className="room-builder-history">
                <button
                  type="button"
                  aria-pressed={!ceiling}
                  onClick={() => setCeiling(false)}
                >
                  Шалны план
                </button>
                <button
                  type="button"
                  aria-pressed={ceiling}
                  onClick={() => setCeiling(true)}
                >
                  Таазны өндөр
                </button>
              </div>
              <label>
                Хэмжих нэгж
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as typeof unit)}
                >
                  <option value="cm">Сантиметр</option>
                  <option value="ft">Фут, инч</option>
                </select>
              </label>
              {ceiling ? (
                measure("Таазны өндөр", draft.height, (height) =>
                  change({ ...draft, height }),
                )
              ) : (
                <>
                  {measure("Өргөн", draft.width, (width) =>
                    change(resizeRoomBuilder(draft, width, draft.depth)),
                  )}
                  {measure("Урт", draft.depth, (depth) =>
                    change(resizeRoomBuilder(draft, draft.width, depth)),
                  )}
                  <details className="room-builder-advanced">
                    <summary>Ханын хэлбэрийг нарийвчлан засах</summary>
                    <label>
                      Ханын хэсэг
                      <select
                        value={wallIndex}
                        onChange={(e) => setSelected(Number(e.target.value))}
                      >
                        {walls.map((s, i) => (
                          <option key={s.id ?? i} value={i}>
                            Хана {i + 1} · {(s.length * 100).toFixed(1)} см
                          </option>
                        ))}
                      </select>
                    </label>
                    {points &&
                      points[wallIndex] &&
                      measure(
                        "Ханын урт",
                        walls[wallIndex].length,
                        (length) => {
                          const a = points[wallIndex],
                            b = points[(wallIndex + 1) % points.length],
                            ratio = length / walls[wallIndex].length;
                          return change({
                            ...draft,
                            outline: points.map((p, i) =>
                              i === (wallIndex + 1) % points.length
                                ? {
                                    ...p,
                                    x: a.x + (b.x - a.x) * ratio,
                                    z: a.z + (b.z - a.z) * ratio,
                                  }
                                : p,
                            ),
                          });
                        },
                      )}
                    <button
                      type="button"
                      onClick={() => {
                        if (!points) return;
                        const next = [...points],
                          a = points[wallIndex],
                          b = points[(wallIndex + 1) % points.length],
                          segmentId = crypto.randomUUID();
                        next.splice(wallIndex + 1, 0, {
                          id: crypto.randomUUID(),
                          segmentId,
                          x: (a.x + b.x) / 2,
                          z: (a.z + b.z) / 2,
                        });
                        const openings = draft.openings?.map((o) =>
                          o.segmentId === a.segmentId
                            ? {
                                ...o,
                                segmentId:
                                  o.position <= 0.5 ? a.segmentId : segmentId,
                                position:
                                  o.position <= 0.5
                                    ? o.position * 2
                                    : (o.position - 0.5) * 2,
                              }
                            : o,
                        );
                        change({ ...draft, outline: next, openings });
                      }}
                    >
                      Хананд цэг нэмэх
                    </button>
                    <button
                      type="button"
                      disabled={!points || points.length <= 3}
                      onClick={() => {
                        if (!points) return;
                        if (
                          change({
                            ...draft,
                            outline: points.filter((_, i) => i !== wallIndex),
                          })
                        )
                          setSelected(0);
                      }}
                    >
                      Сонгосон цэг устгах
                    </button>
                    <p>
                      Цэгүүдийг чирж хэлбэрээ өөрчилнө. Хэмжээг батлахад
                      хананууд огтлолцвол өмнөх зөв хэлбэр үлдэнэ.
                    </p>
                  </details>
                </>
              )}
              <details className="room-builder-advanced">
                <summary>Хэлбэрийг эргүүлэх</summary>
                <div className="room-builder-history">
                  {(["flip-x", "flip-z", "rotate"] as const).map((id, i) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => {
                        try {
                          change(transformRoomBuilder(draft, id));
                        } catch (reason) {
                          setError((reason as Error).message);
                        }
                      }}
                    >
                      {["Хэвтээ эргүүлэх", "Босоо эргүүлэх", "90° эргүүлэх"][i]}
                    </button>
                  ))}
                </div>
              </details>
            </>
          )}
          {stage === 2 && (
            <>
              <label>
                Байрлуулах хана
                <select
                  value={wallIndex}
                  onChange={(e) => setSelected(Number(e.target.value))}
                >
                  {walls.map((wall, i) => (
                    <option key={wall.id ?? i} value={i}>
                      Хана {i + 1} · {(wall.length * 100).toFixed()} см
                    </option>
                  ))}
                </select>
              </label>
              <div
                className="room-builder-tabs"
                role="group"
                aria-label="Нээлхийн төрөл"
              >
                <button
                  type="button"
                  aria-pressed={openingKind === "door"}
                  onClick={() => setOpeningKind("door")}
                >
                  Хаалга
                </button>
                <button
                  type="button"
                  aria-pressed={openingKind === "window"}
                  onClick={() => setOpeningKind("window")}
                >
                  Цонх
                </button>
              </div>
              <div className="room-builder-opening-choices">
                {OPENING_TEMPLATES.filter(
                  (item) => item.kind === openingKind,
                ).map((template) => (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      const wall = walls[wallIndex];
                      if (!wall) return;
                      const cardinal =
                        Math.abs(wall.nx) > 0.5
                          ? wall.nx > 0
                            ? "west"
                            : "east"
                          : wall.nz > 0
                            ? "north"
                            : "south";
                      const opening = {
                        ...createOpening(template.id, cardinal),
                        ...(wall.id ? { segmentId: wall.id } : {}),
                      };
                      for (const position of [0.5, 0.25, 0.75, 0.15, 0.85]) {
                        const next = {
                          ...draft,
                          openings: [
                            ...(draft.openings ?? []),
                            { ...opening, position },
                          ],
                        };
                        if (!validateRoomBuilder(next)) {
                          change(next);
                          setSelectedOpening(opening.id);
                          return;
                        }
                      }
                      setError(
                        "Энэ хананд сонгосон хаалга, цонх багтахгүй байна.",
                      );
                    }}
                  >
                    <span
                      className={`room-builder-opening-icon ${template.kind}`}
                      aria-hidden="true"
                    />
                    <strong>{template.label}</strong>
                    <small>
                      {Math.round(template.width * 100)} ×{" "}
                      {Math.round(template.height * 100)} см · Нэмэх
                    </small>
                  </button>
                ))}
              </div>
              {!draft.openings?.length && (
                <p className="room-builder-note">
                  Хаалга, цонхоо дараа нь ч нэмж болно. Одоохондоо алгасаад
                  үргэлжлүүлэх боломжтой.
                </p>
              )}
              <div className="room-builder-opening-list">
                {draft.openings?.map((opening, i) => (
                  <button
                    type="button"
                    key={opening.id}
                    aria-pressed={selectedOpening === opening.id}
                    onClick={() =>
                      setSelectedOpening(
                        selectedOpening === opening.id ? null : opening.id,
                      )
                    }
                  >
                    <span>
                      {opening.kind === "door" ? "Хаалга" : "Цонх"} {i + 1}
                    </span>
                    <small>
                      {Math.round(opening.width * 100)} ×{" "}
                      {Math.round(opening.height * 100)} см · Засах
                    </small>
                  </button>
                ))}
              </div>
              {draft.openings
                ?.filter((opening) => opening.id === selectedOpening)
                .map((opening) => (
                  <OpeningQuickEditor
                    key={opening.id}
                    opening={opening}
                    room={draft}
                    onChange={(next) =>
                      change({
                        ...draft,
                        openings: draft.openings?.map((o) =>
                          o.id === next.id ? next : o,
                        ),
                      })
                    }
                    beginEdit={beginEdit}
                    endEdit={endEdit}
                    onRemove={() =>
                      change({
                        ...draft,
                        openings: draft.openings?.filter(
                          (o) => o.id !== opening.id,
                        ),
                      })
                    }
                  />
                ))}
            </>
          )}
          {stage === 3 && (
            <>
              <fieldset className="room-builder-finishes">
                <legend>Ханын өнгө</legend>
                <div className="room-builder-colors">
                  {[
                    ["#F3F1EB", "Цагаан"],
                    ["#EFE6D6", "Дулаан шаргал"],
                    ["#C6C3BB", "Саарал"],
                    ["#B6C1B0", "Зөөлөн ногоон"],
                    ["#6E8595", "Хөх саарал"],
                    ["#866252", "Бор"],
                  ].map(([color, label]) => (
                    <button
                      type="button"
                      key={color}
                      title={label}
                      aria-label={label}
                      aria-pressed={
                        draft.wallColor.toLowerCase() === color.toLowerCase()
                      }
                      style={{ background: color }}
                      onClick={() =>
                        change({
                          ...historyRef.current.draft,
                          wallColor: color,
                          wallMaterials: {},
                        })
                      }
                    >
                      {draft.wallColor.toLowerCase() ===
                        color.toLowerCase() && <Check size={18} />}
                    </button>
                  ))}
                </div>
                <label className="room-builder-custom-color">
                  Өөр өнгө сонгох
                  <input
                    type="color"
                    onFocus={beginEdit}
                    onBlur={endEdit}
                    value={draft.wallColor}
                    onChange={(e) =>
                      change({
                        ...historyRef.current.draft,
                        wallColor: e.target.value,
                        wallMaterials: {},
                      })
                    }
                  />
                </label>
              </fieldset>
              <fieldset className="room-builder-finishes">
                <legend>Шалны материал</legend>
                <div className="room-builder-materials">
                  {FLOOR_MATERIALS.map((material) => (
                    <button
                      type="button"
                      key={material.id}
                      aria-pressed={draft.floorMaterial === material.id}
                      onClick={() =>
                        change({
                          ...historyRef.current.draft,
                          floorMaterial: material.id,
                        })
                      }
                    >
                      <span
                        style={{ background: material.swatch }}
                        aria-hidden="true"
                      />
                      <strong>{material.label}</strong>
                      <small>{material.category}</small>
                      {draft.floorMaterial === material.id && (
                        <Check
                          className="room-builder-material-check"
                          size={16}
                        />
                      )}
                    </button>
                  ))}
                </div>
                <details className="room-builder-advanced">
                  <summary>Нэг өнгийн шал</summary>
                  <label>
                    Шалны өнгө
                    <input
                      type="color"
                      onFocus={beginEdit}
                      onBlur={endEdit}
                      value={draft.floorColor}
                      onChange={(e) =>
                        change({
                          ...historyRef.current.draft,
                          floorColor: e.target.value,
                          floorMaterial: "legacy",
                        })
                      }
                    />
                  </label>
                </details>
              </fieldset>
              <div className="room-builder-summary">
                <strong>Таны өрөө</strong>
                <dl>
                  <div>
                    <dt>Хэмжээ</dt>
                    <dd>
                      {draft.width.toFixed(2)} × {draft.depth.toFixed(2)} м
                    </dd>
                  </div>
                  <div>
                    <dt>Таазны өндөр</dt>
                    <dd>{draft.height.toFixed(2)} м</dd>
                  </div>
                  <div>
                    <dt>Хаалга / цонх</dt>
                    <dd>
                      {draft.openings?.filter((o) => o.kind === "door")
                        .length ?? 0}{" "}
                      /{" "}
                      {draft.openings?.filter((o) => o.kind === "window")
                        .length ?? 0}
                    </dd>
                  </div>
                </dl>
              </div>
            </>
          )}
          {error && (
            <p role="alert" className="room-builder-error">
              {error}
            </p>
          )}
        </div>
        <footer>
          <button
            type="button"
            onClick={() => {
              if (stage > 0) {
                selectStage(stage - 1);
              } else onCancel();
            }}
          >
            <ArrowLeft size={16} aria-hidden="true" /> Буцах
          </button>
          <button
            className="room-builder-next"
            type="button"
            onClick={() => {
              endEdit();
              const issue = validateRoomBuilder(historyRef.current.draft);
              if (issue) {
                setError(issue);
                return;
              }
              if (stage < 3) {
                selectStage(stage + 1);
              } else
                setError(
                  onComplete(structuredClone(historyRef.current.draft)) ?? "",
                );
            }}
          >
            {stage === 3 ? "Өрөөг батлах" : "Үргэлжлүүлэх"}{" "}
            <ArrowRight size={17} aria-hidden="true" />
          </button>
        </footer>
      </aside>
      <div
        className="room-builder-preview"
        data-camera={mode.view}
        data-orbit={mode.orbit}
        data-wall-editing={mode.wallEditing}
      >
        <div className="room-builder-preview-toolbar">
          <span>
            {mode.view === "plan" ? "Дээрээс харах" : "3D харагдац"} ·{" "}
            {geometry.area.toFixed(2)} м²
          </span>
          <div>
            <button
              type="button"
              title="Үйлдэл буцаах"
              aria-label="Үйлдэл буцаах"
              disabled={!past.length && !history.baseline}
              onClick={() => send({ type: "undo" })}
            >
              <Undo2 size={18} />
            </button>
            <button
              type="button"
              title="Дахин хийх"
              aria-label="Дахин хийх"
              disabled={!future.length || !!history.baseline}
              onClick={() => send({ type: "redo" })}
            >
              <Redo2 size={18} />
            </button>
          </div>
        </div>
        {mode.wallEditing ? (
          <svg
            viewBox={`${-draft.width / 2 - 0.5} ${-draft.depth / 2 - 0.5} ${draft.width + 1} ${draft.depth + 1}`}
            aria-label="Өрөөний шугаман план"
            style={{ touchAction: "none" }}
            onPointerMove={(e) => {
              const drag = gesture.current;
              if (!drag || drag.pointer !== e.pointerId) return;
              const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(
                drag.matrix,
              );
              change({
                ...drag.before,
                outline: drag.before.outline?.map((v, i) =>
                  i === drag.index
                    ? {
                        ...v,
                        x: Math.round(p.x * 1000) / 1000,
                        z: Math.round(p.y * 1000) / 1000,
                      }
                    : v,
                ),
              });
            }}
            onPointerUp={(e) => finishGesture(e)}
            onPointerCancel={(e) => finishGesture(e, true)}
            onLostPointerCapture={(e) => finishGesture(e, true)}
          >
            <path
              d={roomPath(draft)}
              fill={draft.floorColor}
              stroke="#526859"
              strokeWidth={0.025}
            />
            {walls.map((s, i) => (
              <text
                key={s.id ?? i}
                x={(s.a.x + s.b.x) / 2}
                y={(s.a.z + s.b.z) / 2 - 0.08}
                fontSize={0.11}
                textAnchor="middle"
              >
                {(s.length * 100).toFixed(1)} см
              </text>
            ))}
            {mode.wallEditing &&
              points?.map((p, i) => (
                <circle
                  key={p.id}
                  cx={p.x}
                  cy={p.z}
                  r={0.07}
                  fill={i === wallIndex ? "#0058a3" : "white"}
                  stroke="#0058a3"
                  strokeWidth={0.02}
                  role="button"
                  tabIndex={0}
                  aria-label={`Өрөөний цэг ${i + 1}`}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setSelected(i);
                    }
                  }}
                  onPointerDown={(e) => {
                    if (e.button !== 0) return;
                    const svg = e.currentTarget.ownerSVGElement,
                      matrix = svg?.getScreenCTM()?.inverse();
                    if (!svg || !matrix) return;
                    e.preventDefault();
                    setSelected(i);
                    beginEdit();
                    gesture.current = {
                      pointer: e.pointerId,
                      index: i,
                      matrix,
                      before: structuredClone(historyRef.current.draft),
                      element: svg,
                    };
                    svg.setPointerCapture(e.pointerId);
                  }}
                />
              ))}
          </svg>
        ) : (
          <RoomCanvas
            design={preview}
            view={mode.view}
            selected={null}
            selectedOpening={mode.openingEditing ? selectedOpening : null}
            onSelectOpening={
              mode.openingEditing ? setSelectedOpening : undefined
            }
            onPlacementError={setError}
            onSelect={() => {}}
            onMove={() => {}}
            locked={!mode.orbit}
            snapEnabled={false}
            onEditStart={beginEdit}
            onEditEnd={endEdit}
            onUpdateOpening={
              mode.openingEditing
                ? (opening) =>
                    change({
                      ...draft,
                      openings: draft.openings?.map((o) =>
                        o.id === opening.id ? opening : o,
                      ),
                    })
                : undefined
            }
          />
        )}
        <p className="room-builder-preview-hint">
          {mode.wallEditing
            ? "Цэгийг чирж хэлбэрээ өөрчлөх · Escape: чирэлтийг болих"
            : mode.orbit
              ? "Чирж эргүүлэх · Гүйлгэж ойртуулах"
              : "Хэлбэрээ сонгоод хэмжээгээ тохируулаарай"}
        </p>
      </div>
    </section>
  );
}
