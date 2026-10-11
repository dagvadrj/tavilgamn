"use client";
import { useEffect, useRef, useState } from "react";
import {
  Box,
  ChevronRight,
  Columns3,
  DoorOpen,
  Droplets,
  Grid2X2,
  Maximize,
  Minus,
  Paintbrush,
  Plus,
  Refrigerator,
  Ruler,
  Scan,
  SlidersHorizontal,
  Trash2,
  Wind,
  X,
  Zap,
} from "lucide-react";
import { DimensionInput } from "./PlannerPanels";
import {
  KitchenRoomDraft,
  ROOM_ITEM_NAMES,
  ROOM_WALL_NAMES,
  type RoomWallId,
} from "./KitchenRoomDraft";
import type {
  CabinetType,
  KitchenRoom,
  KitchenSpaceItem,
  ModularKitchen,
} from "@/lib/kitchenCabinets";
import {
  parseKitchenSpace,
  resizeKitchenRoom,
  spaceItemCandidates,
} from "@/lib/kitchenSpace";
import { placementIssues } from "@/lib/kitchenPlacement";
import "./kitchen-room-setup.css";

export function KitchenSpaceEditor({
  kitchen,
  disabled,
  onChange,
  onClose,
  onMaterials = onClose,
  onView3D = onClose,
  onCatalog,
}: {
  kitchen: ModularKitchen;
  disabled: boolean;
  onChange: (next: ModularKitchen) => boolean;
  onClose: () => void;
  onReview: () => void;
  onSelectCabinet: (id: string) => void;
  onMaterials?: () => void;
  onView3D?: () => void;
  onCatalog?: (type: CabinetType | "appliances") => void;
}) {
  const [wall, setWall] = useState<RoomWallId | null>("back");
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const [fitZoom, setFitZoom] = useState(1);
  const canvas = useRef<HTMLDivElement>(null);
  const heightInput = useRef<HTMLDivElement>(null);
  const room = kitchen.room,
    items = room.items ?? [];
  const item = items.find((i) => i.id === selected);
  useEffect(() => {
    const root = canvas.current;
    if (!root) return;
    const observer = new ResizeObserver(([entry]) => {
      const ratio = (room.depth + 1300) / (room.width + 1240);
      const fit = Math.max(
        0.25,
        Math.min(
          1.8,
          (entry.contentRect.width - 64) / 700,
          (entry.contentRect.height - 64) / (700 * ratio),
        ),
      );
      setFitZoom(fit);
      setZoom(fit);
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [room.width, room.depth]);
  useEffect(() => {
    const clear = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setWall(null);
        setSelected(null);
      }
    };
    window.addEventListener("keydown", clear);
    return () => window.removeEventListener("keydown", clear);
  }, []);
  function updateRoom(next: KitchenRoom) {
    if (disabled) return false;
    try {
      parseKitchenSpace(next);
      const issue = placementIssues({ ...kitchen, room: next }).find(
        (i) => i.severity === "error",
      );
      if (issue) throw new Error(issue.message);
      if (!onChange({ ...kitchen, room: next }))
        throw new Error("Өөрчлөлтийг хадгалж чадсангүй.");
      setError("");
      return true;
    } catch (reason) {
      setError((reason as Error).message);
      return false;
    }
  }
  function resize(
    patch: Partial<Pick<KitchenRoom, "width" | "depth" | "height">>,
  ) {
    try {
      updateRoom(resizeKitchenRoom(room, patch));
    } catch (reason) {
      setError((reason as Error).message);
    }
  }
  function add(kind: KitchenSpaceItem["kind"]) {
    if (disabled) return;
    for (const nextItem of spaceItemCandidates(
      room,
      kind,
      wall ?? "back",
      crypto.randomUUID(),
      kind === "window" ? 1400 : undefined,
    )) {
      const next = { ...room, items: [...items, nextItem] };
      if (
        ["water", "power", "vent"].includes(kind) &&
        items.some(
          (i) =>
            ["water", "power", "vent"].includes(i.kind) &&
            Math.hypot(i.x - nextItem.x, i.z - nextItem.z) < 300,
        )
      )
        continue;
      try {
        parseKitchenSpace(next);
      } catch {
        continue;
      }
      if (
        placementIssues({ ...kitchen, room: next }).some(
          (i) => i.severity === "error",
        )
      )
        continue;
      if (updateRoom(next)) {
        setSelected(nextItem.id);
        setWall(nextItem.wall);
      }
      return;
    }
    setError(
      "Сул зай олдсонгүй. Өөр хана сонгох эсвэл өрөөний хэмжээг өөрчилнө үү.",
    );
  }
  function changeItem(patch: Partial<KitchenSpaceItem>) {
    updateRoom({
      ...room,
      items: items.map((i) => (i.id === selected ? { ...i, ...patch } : i)),
    });
  }
  function changeWall(nextWall: RoomWallId) {
    if (!item) return;
    const horizontal = ["back", "front"].includes(nextWall);
    const extent = horizontal ? room.width : room.depth;
    const position = Math.min(
      extent - item.width / 2,
      Math.max(item.width / 2, horizontal ? item.x : item.z),
    );
    changeItem({
      wall: nextWall,
      x: horizontal ? position : nextWall === "left" ? 0 : room.width,
      z: horizontal ? (nextWall === "back" ? 0 : room.depth) : position,
    });
    setWall(nextWall);
  }
  const utilityKinds = ["water", "power", "vent"] as const;
  return (
    <section className="kroom-setup" aria-label="Өрөөг хэмжих">
      <aside className="kroom-catalog" aria-label="Модуль каталоги">
        <header>
          <small>МОДУЛЬ КАТАЛОГИ</small>
          <h2>Гал тогооны элементүүд</h2>
        </header>
        <nav>
          {(
            [
              ["base", "Доод шүүгээ (Base)", Refrigerator],
              ["wall", "Дээд шүүгээ (Wall)", Box],
              ["tall", "Багана шүүгээ (Tall)", Columns3],
              ["appliances", "Цахилгаан хэрэгсэл", Zap],
            ] as const
          ).map(([type, label, Icon]) => (
            <button
              type="button"
              key={type}
              disabled={disabled}
              onClick={() => {
                if (onCatalog) onCatalog(type);
                else onClose();
              }}
            >
              <Icon size={20} />
              {label}
            </button>
          ))}
          <button type="button" disabled={disabled} onClick={onMaterials}>
            <Paintbrush size={20} />
            Тавцан ба фасад
          </button>
        </nav>
        <footer>
          <span>
            Сүлжээний тор: <b>100 мм</b>
          </span>
          <span>
            Хананд наалдах: <b>Идэвхтэй</b>
          </span>
        </footer>
      </aside>
      <aside
        className="kroom-config"
        aria-label="Өрөөний хэмжээ болон холболтууд"
      >
        <div className="kroom-config-body">
          <header className="kroom-intro">
            <div>
              <small>АЛХАМ 01 / 04</small>
              <span>CAD Ноорог</span>
            </div>
            <h1>Өрөөг хэмжих</h1>
            <p>
              Ханын үндсэн хэмжээс болон инженерийн холболтын цэгүүдийг заана
              уу.
            </p>
          </header>
          <section>
            <h2>ӨРӨӨНИЙ ХЭЛБЭР</h2>
            <div className="kroom-shapes">
              {[
                { label: "Тэгш өнцөгт", openFront: false },
                { label: "Урд тал нээлттэй", openFront: true },
              ].map((shape) => (
                <button
                  type="button"
                  key={shape.label}
                  disabled={disabled}
                  aria-pressed={!!room.openFront === shape.openFront}
                  onClick={() =>
                    updateRoom({ ...room, openFront: shape.openFront })
                  }
                >
                  <Grid2X2 size={21} />
                  {shape.label}
                </button>
              ))}
            </div>
          </section>
          <section className="kroom-sizes">
            <div className="kroom-section-head">
              <h2>ӨРӨӨНИЙ ХЭМЖЭЭ (ММ)</h2>
              <span>
                <Ruler size={13} />
                Алхам 1 мм
              </span>
            </div>
            <div className="kroom-dimension">
              <i>X</i>
              <DimensionInput
                label="Урт (Нүүр тал)"
                value={room.width}
                min={2000}
                max={8000}
                disabled={disabled}
                onCommit={(width) => resize({ width: Math.round(width) })}
              />
            </div>
            <div className="kroom-dimension">
              <i>Z</i>
              <DimensionInput
                label="Өргөн (Хажуу хана)"
                value={room.depth}
                min={2000}
                max={8000}
                disabled={disabled}
                onCommit={(depth) => resize({ depth: Math.round(depth) })}
              />
            </div>
            <div className="kroom-dimension" ref={heightInput}>
              <i>Y</i>
              <DimensionInput
                label="Таазны өндөр"
                value={room.height}
                min={2200}
                max={3500}
                disabled={disabled}
                onCommit={(height) => resize({ height: Math.round(height) })}
              />
            </div>
            <div className="kroom-area">
              <strong>
                <Maximize size={16} />
                {((room.width * room.depth) / 1000000).toFixed(2)} м² талбай
              </strong>
              <span>
                Периметр: {(((room.width + room.depth) * 2) / 1000).toFixed(1)}{" "}
                м
              </span>
            </div>
          </section>
          <section>
            <h2>ХААЛГА, ЦОНХ БАЙРШУУЛАХ</h2>
            <div className="kroom-openings">
              <button
                type="button"
                disabled={disabled}
                onClick={() => add("door")}
              >
                <DoorOpen size={19} />+ Хаалга (900)
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => add("window")}
              >
                <Grid2X2 size={19} />+ Цонх (1400)
              </button>
            </div>
            <p className="kroom-help">
              {wall
                ? `${ROOM_WALL_NAMES[wall]}д нэмнэ. Өөр хана сонгохдоо зураг дээр дарна уу.`
                : "Нэмэх ханан дээрээ дарж сонгоно уу."}
            </p>
          </section>
          <section>
            <div className="kroom-section-head">
              <h2>САНТЕХНИК & ЦАХИЛГААНЫ ХОЛБОЛТ</h2>
              <span>
                {
                  items.filter((i) =>
                    utilityKinds.includes(
                      i.kind as (typeof utilityKinds)[number],
                    ),
                  ).length
                }{" "}
                цэг
              </span>
            </div>
            <div className="kroom-utilities">
              {utilityKinds.map((kind) => {
                const Icon =
                  kind === "water" ? Droplets : kind === "power" ? Zap : Wind;
                const existing = items.filter((i) => i.kind === kind);
                return (
                  <div key={kind}>
                    {existing.map((point) => (
                      <button
                        type="button"
                        key={point.id}
                        disabled={disabled}
                        aria-pressed={selected === point.id}
                        onClick={() => {
                          setSelected(point.id);
                          setWall(point.wall);
                        }}
                      >
                        <i className={`is-${kind}`}>
                          <Icon size={16} />
                        </i>
                        <span>{ROOM_ITEM_NAMES[kind]}</span>
                        <b>
                          {kind === "vent"
                            ? `D: ${point.width}`
                            : `X: ${["back", "front"].includes(point.wall) ? point.x : point.z}`}{" "}
                          мм
                        </b>
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={disabled}
                      onClick={() => add(kind)}
                      className="kroom-add-utility"
                    >
                      <i className={`is-${kind}`}>
                        <Icon size={16} />
                      </i>
                      <span>
                        {existing.length
                          ? "Нэмж байрлуулах"
                          : ROOM_ITEM_NAMES[kind]}
                      </span>
                      <Plus size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          </section>
          <details className="kroom-structure">
            <summary>Багана ба бусад элемент</summary>
            <button
              type="button"
              disabled={disabled}
              onClick={() => add("column")}
            >
              <Plus size={16} />
              Багана нэмэх
            </button>
            {items
              .filter((i) => i.kind === "column")
              .map((i) => (
                <button
                  type="button"
                  key={i.id}
                  onClick={() => setSelected(i.id)}
                >
                  {ROOM_ITEM_NAMES[i.kind]} {i.width} × {i.depth} мм
                </button>
              ))}
          </details>
          {item && (
            <fieldset className="kroom-item-editor" disabled={disabled}>
              <legend>{ROOM_ITEM_NAMES[item.kind]} тохируулах</legend>
              {item.kind !== "column" && (
                <label>
                  Хана
                  <select
                    value={item.wall}
                    onChange={(event) =>
                      changeWall(event.target.value as RoomWallId)
                    }
                  >
                    {Object.entries(ROOM_WALL_NAMES)
                      .filter(([id]) => !room.openFront || id !== "front")
                      .map(([id, label]) => (
                        <option key={id} value={id}>
                          {label}
                        </option>
                      ))}
                  </select>
                </label>
              )}
              <DimensionInput
                label={item.kind === "vent" ? "Диаметр" : "Өргөн"}
                value={item.width}
                min={50}
                max={3000}
                onCommit={(width) => changeItem({ width: Math.round(width) })}
              />
              <DimensionInput
                label={
                  item.kind === "column"
                    ? "Зүүн хананаас"
                    : "Хананы эхнээс төв хүртэл"
                }
                value={
                  item.kind === "column" ||
                  ["back", "front"].includes(item.wall)
                    ? item.x
                    : item.z
                }
                min={0}
                max={
                  item.kind === "column" ||
                  ["back", "front"].includes(item.wall)
                    ? room.width
                    : room.depth
                }
                onCommit={(value) =>
                  changeItem(
                    item.kind === "column" ||
                      ["back", "front"].includes(item.wall)
                      ? { x: Math.round(value) }
                      : { z: Math.round(value) },
                  )
                }
              />
              {item.kind === "column" && (
                <>
                  <DimensionInput
                    label="Арын хананаас"
                    value={item.z}
                    min={0}
                    max={room.depth}
                    onCommit={(z) => changeItem({ z: Math.round(z) })}
                  />
                  <DimensionInput
                    label="Гүн"
                    value={item.depth}
                    min={50}
                    max={3000}
                    onCommit={(depth) =>
                      changeItem({ depth: Math.round(depth) })
                    }
                  />
                </>
              )}
              <button
                type="button"
                className="kroom-delete"
                onClick={() => {
                  if (
                    updateRoom({
                      ...room,
                      items: items.filter((i) => i.id !== selected),
                    })
                  )
                    setSelected(null);
                }}
              >
                <Trash2 size={15} />
                Устгах
              </button>
            </fieldset>
          )}
          {error && (
            <p className="kroom-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <footer className="kroom-next">
          <button type="button" disabled={disabled} onClick={onClose}>
            Байрлал сонгох
            <ChevronRight size={20} />
          </button>
          <small>
            <span />
            Энэ төхөөрөмж дээр автоматаар хадгална
          </small>
        </footer>
      </aside>
      <div className="kroom-workspace">
        <div
          className="kroom-view-controls"
          role="group"
          aria-label="Зургийн харагдац"
        >
          <button type="button" aria-pressed="true">
            <Grid2X2 size={16} />
            2D Хавтгай
          </button>
          <button type="button" disabled={disabled} onClick={onView3D}>
            <Box size={16} />
            3D Харах
          </button>
          <span className="kroom-control-divider" />
          <button
            type="button"
            aria-label="Жижигрүүлэх"
            disabled={zoom <= 0.25}
            onClick={() => setZoom((value) => Math.max(0.25, value - 0.15))}
          >
            <Minus size={17} />
          </button>
          <b>{Math.round((zoom / fitZoom) * 100)}%</b>
          <button
            type="button"
            aria-label="Томруулах"
            disabled={zoom >= 3}
            onClick={() => setZoom((value) => Math.min(3, value + 0.15))}
          >
            <Plus size={17} />
          </button>
          <button
            type="button"
            aria-label="Өрөөг бүтнээр харах"
            onClick={() => setZoom(fitZoom)}
          >
            <Scan size={18} />
          </button>
        </div>
        <div
          className="kroom-wall-toolbar"
          role="group"
          aria-label="Сонгосон хананы хэрэгсэл"
          hidden={!wall || !!selected}
        >
          <SlidersHorizontal size={20} />
          <strong>
            Сонгосон хана:{" "}
            {(wall === "back" || wall === "front"
              ? room.width
              : room.depth
            ).toLocaleString("mn-MN")}{" "}
            мм
          </strong>
          <span>Өндөр: {room.height.toLocaleString("mn-MN")} мм</span>
          <label className="kroom-wall-color">
            <Paintbrush size={17} />
            Өнгө сонгох
            <input
              type="color"
              aria-label="Сонгосон хананы өнгө"
              disabled={disabled}
              value={wall ? (room.wallColors?.[wall] ?? "#efe6d6") : "#efe6d6"}
              onChange={(event) => {
                if (wall)
                  updateRoom({
                    ...room,
                    wallColors: {
                      ...room.wallColors,
                      [wall]: event.target.value,
                    },
                  });
              }}
            />
          </label>
          <button
            type="button"
            disabled={disabled}
            onClick={() => heightInput.current?.querySelector("input")?.focus()}
          >
            <Ruler size={16} />
            Өндөр
          </button>
          <button
            type="button"
            aria-label="Ханын хэрэгслийг хаах"
            onClick={() => setWall(null)}
          >
            <X size={16} />
          </button>
        </div>
        <div
          className="kroom-plan-card"
          ref={canvas}
          onClick={() => {
            setWall(null);
            setSelected(null);
          }}
        >
          <div
            className="kroom-plan-sheet"
            style={{ width: `${700 * zoom}px` }}
          >
            <KitchenRoomDraft
              room={room}
              wall={wall}
              selectedItem={selected}
              disabled={disabled}
              onWall={(wall) => {
                setWall(wall);
                setSelected(null);
              }}
              onItem={(id) => {
                setSelected(id);
                setWall(items.find((i) => i.id === id)?.wall ?? null);
              }}
              onClear={() => {
                setWall(null);
                setSelected(null);
              }}
            />
          </div>
        </div>
        <aside className="kroom-compass" aria-label="Өрөөний зүг чиг">
          <small>ЗҮГ ЧИГ</small>
          <span>Y ↑</span>
          <svg viewBox="0 0 100 66" aria-hidden="true">
            <rect
              x={20}
              y={10}
              width={60}
              height={46}
              fill="#eeecff"
              stroke="#303039"
              strokeWidth={2}
            />
            <path d="M20 10H80" stroke="#0051d5" strokeWidth={5} />
            {!room.openFront && (
              <path d="M20 56H80" stroke="#303039" strokeWidth={2} />
            )}
          </svg>
          <p>
            Харах өнцөг <b>0.0°</b>
          </p>
        </aside>
        <p className="kroom-shortcuts">
          <kbd>Enter</kbd>Хэмжээг батлах <span>·</span>
          <kbd>Esc</kbd>Сонголт арилгах
        </p>
      </div>
    </section>
  );
}
