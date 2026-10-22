"use client";
import dynamic from "next/dynamic";
import { ArrowLeft, ArrowRight, Check, X, Undo2, Redo2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RoomDesign, RoomShape, RoomSurfaces } from "@/lib/types";
import { getRoomGeometry } from "@/lib/roomGeometry";
import { ROOM_TEMPLATES, type RoomTemplate } from "@/lib/roomPolygon";
import {
  BUILDER_STAGES,
  builderInteraction,
  builderWallIndex,
  chooseRoomTemplate,
  initializeRoomBuilder,
  selectedRoomTemplate,
  transformRoomBuilder,
  validateRoomBuilder,
  type RoomBuilderDraft,
} from "@/lib/roomBuilderDraft";
import {
  createRoomBuilderHistory,
  reduceRoomBuilderHistory,
  type RoomBuilderAction,
} from "@/lib/roomBuilderHistory";
import { createOpening, PLANNER_OPENING_TEMPLATES as OPENING_TEMPLATES } from "@/lib/roomOpenings";
import { FLOOR_MATERIALS } from "@/lib/roomMaterials";
import { OpeningQuickEditor } from "./OpeningQuickEditor";
import { RoomWallPlan } from "./RoomWallPlan";
import { RoomDimensionSidebar } from "./RoomDimensionSidebar";
import {
  resizeDrawnWall,
  wallUnitLabel,
  wallUnitScale,
  type WallDrawingUnit,
} from "@/lib/roomWallDrawing";
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
  const [unit, setUnit] = useState<WallDrawingUnit>("cm");
  const [drawing, setDrawing] = useState(false);
  const [furthestStage, setFurthestStage] = useState(0);
  const [openingKind, setOpeningKind] = useState<"door" | "window">("door");
  const [selectedOpening, setSelectedOpening] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [stage]);
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
    if (drawing) {
      setError("Зурж буй хүрээгээ эхлээд хаах эсвэл болино уу.");
      return;
    }
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
  ) => (
    <label>
      {label} ({wallUnitLabel[unit]})
      <input
        key={`${label}-${value}-${unit}`}
        type="number"
        defaultValue={Number((value * wallUnitScale[unit]).toFixed(2))}
        step={unit === "m" ? 0.01 : 1}
        min={0.05 * wallUnitScale[unit]}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        onBlur={(event) => {
          const number = Number(event.target.value) / wallUnitScale[unit];
          if (
            !event.target.value.trim() ||
            !Number.isFinite(number) ||
            (number !== value && !update(number))
          )
            event.currentTarget.value = String(
              Number((value * wallUnitScale[unit]).toFixed(2)),
            );
        }}
      />
    </label>
  );
  const walls = geometry.segments.filter((s) => !s.hole);
  const wallIndex = builderWallIndex(selected, walls.length);
  const template = selectedRoomTemplate(draft);
  return (
    <section
      className={`room-builder${stage === 1 ? " is-dimensions" : ""}`}
      aria-label="Дөрвөн алхамтай өрөө байгуулагч"
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
        {stage !== 1 && (
          <ol
            className="room-builder-steps"
            aria-label="Өрөө байгуулах алхмууд"
          >
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
        )}
        <div className="room-builder-content">
          <header className="room-builder-stage-heading">
            <p className="room-builder-progress" aria-live="polite">
              Алхам {stage + 1} / 4
            </p>
            <h2 ref={heading} tabIndex={-1}>
              {
                [
                  "Өрөөний хэлбэрээ сонгоё",
                  "Ханын хэмжээгээ тохируулъя",
                  "Хаалга, цонхоо нэмье",
                  "Өнгө, материалаа сонгоё",
                ][stage]
              }
            </h2>
            <p>
              {
                [
                  "Өрөөнийхөө план зурагтай хамгийн төстэй хэлбэрийг сонгоорой.",
                  "Ханаа чирж хэмжээг нь өөрчилнө. Шинэ хэлбэр зурах бол дээрх Line хэрэгслийг сонгоорой.",
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
              <RoomDimensionSidebar
                draft={draft}
                selected={wallIndex}
                unit={unit}
                onUnit={setUnit}
                onTransform={(transform) => {
                  if (drawing) {
                    setError("Зурж буй хүрээгээ эхлээд хаах эсвэл болино уу.");
                    return;
                  }
                  try {
                    change(
                      transformRoomBuilder(historyRef.current.draft, transform),
                    );
                  } catch (reason) {
                    setError((reason as Error).message);
                  }
                }}
              />
              {ceiling &&
                measure("Таазны өндөр", draft.height, (height) =>
                  change({ ...historyRef.current.draft, height }),
                )}
              {drawing && (
                <p className="room-builder-note">
                  Эхний цэг дээр дарж хүрээгээ хаагаарай. Escape дарвал одоогийн
                  зургийг болино.
                </p>
              )}
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
            disabled={drawing}
            onClick={() => {
              endEdit();
              if (drawing) {
                setError("Зурж буй хүрээгээ эхлээд хаагаарай.");
                return;
              }
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
          {stage === 1 && (
            <div
              className="room-builder-view-tabs"
              role="group"
              aria-label="Хэмжээ засах харагдац"
            >
              <button
                type="button"
                aria-pressed={!ceiling}
                disabled={drawing}
                onClick={() => setCeiling(false)}
              >
                Шалны план
              </button>
              <button
                type="button"
                aria-pressed={ceiling}
                disabled={drawing}
                onClick={() => setCeiling(true)}
              >
                Таазны өндөр
              </button>
            </div>
          )}
          {!mode.wallEditing && (
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
          )}
        </div>
        {mode.wallEditing ? (
          <RoomWallPlan
            draft={draft}
            selected={wallIndex}
            unit={unit}
            onSelect={setSelected}
            onChange={change}
            onDrawingChange={setDrawing}
            onError={setError}
            onEditStart={beginEdit}
            onEditEnd={(cancel) => send({ type: cancel ? "cancel" : "end" })}
            canUndo={!!past.length || !!history.baseline}
            canRedo={!!future.length && !history.baseline}
            onUndo={() => send({ type: "undo" })}
            onRedo={() => send({ type: "redo" })}
            onResizeWall={(length) => {
              try {
                return change(
                  resizeDrawnWall(historyRef.current.draft, wallIndex, length),
                );
              } catch (reason) {
                setError((reason as Error).message);
                return false;
              }
            }}
          />
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
        {!mode.wallEditing && (
          <p className="room-builder-preview-hint">
            {mode.wallEditing
              ? "Цэгийг чирж хэлбэрээ өөрчлөх · Escape: чирэлтийг болих"
              : mode.orbit
                ? "Чирж эргүүлэх · Гүйлгэж ойртуулах"
                : "Хэлбэрээ сонгоод хэмжээгээ тохируулаарай"}
          </p>
        )}
      </div>
    </section>
  );
}
