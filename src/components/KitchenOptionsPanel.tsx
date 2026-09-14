"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowLeftRight,
  Check,
  ChevronRight,
  Search,
  Settings2,
} from "lucide-react";
import {
  CABINET_DEFAULTS,
  cabinetLabel,
  CABINET_WIDTHS,
  type ModularCabinet,
  type ModularKitchen,
} from "@/lib/kitchenCabinets";
import {
  COMPONENT_LABELS,
  COMPONENT_OPTIONS,
  componentColor,
  componentMaterials,
  componentSizeFields,
  compatibleOptions,
  compatibleReplacement,
  getComponents,
  getComponentSize,
  type CabinetComponent,
  type ComponentType,
} from "@/lib/kitchenComponents";
import { ovenSlot } from "@/lib/plitka";
import { KitchenComponentSheet } from "./KitchenComponentSheet";

function Thumbnail({
  type,
  model,
  color = "#b7c5b8",
}: {
  type: ComponentType;
  model?: string;
  color?: string;
}) {
  const paths: Record<ComponentType, string> = {
    sink: "M7 20h50v26H7z M12 25h40v16H12z M30 25v16",
    tap: "M25 51V19a10 10 0 0 1 20 0v7 M17 51h22 M45 26h6",
    oven: "M12 8h40v48H12z M17 23h30v25H17z M19 19h26 M19 13h3 M41 13h3",
    hood: "M26 8h12v25l17 15H9l17-15z M9 48v6h46v-6 M18 51h20",
    refrigerator: "M14 5h36v54H14z M14 25h36 M42 13v7 M42 31v14",
    cooktop:
      "M5 15h54v36H5z M13 27a6 6 0 1 0 12 0a6 6 0 1 0-12 0 M37 27a6 6 0 1 0 12 0a6 6 0 1 0-12 0 M13 42a6 6 0 1 0 12 0a6 6 0 1 0-12 0 M37 42a6 6 0 1 0 12 0a6 6 0 1 0-12 0",
    "door-front": "M15 7h34v50H15z M39 28v8",
    "drawer-front": "M8 13h48v38H8z M8 32h48 M25 23h14 M25 42h14",
    handle: "M10 24v20 M54 24v20 M10 28h44 M10 33h44",
    worktop: "M7 24 43 13l15 13-36 12z M7 24v7l15 14 36-12v-7 M22 38v7",
    plinth: "M8 29h48v16H8z M13 20v9 M51 20v9",
    frame: "M11 11h42v44H11z M16 16h32v34H16z M16 34h32",
  };
  if (type === "door-front" && model === "shaker")
    paths[type] += " M20 12h24v40H20z";
  if (type === "door-front" && model === "glass")
    paths[type] =
      "M15 7h34v50H15z M19 11h26v42H19z M22 36l18-18 M24 45l14-14 M39 28v8";
  if (type === "drawer-front" && model === "shaker")
    paths[type] += " M12 17h40v11H12z M12 36h40v11H12z";
  if (type === "drawer-front" && model === "glass")
    paths[type] += " M15 27l10-10 M30 28l11-11 M15 47l10-10 M30 47l11-11";
  if (type === "cooktop" && model === "ceramic")
    paths[type] =
      "M5 15h54v36H5z M10 27a9 9 0 1 0 18 0a9 9 0 1 0-18 0 M14 27a5 5 0 1 0 10 0a5 5 0 1 0-10 0 M36 28a7 7 0 1 0 14 0a7 7 0 1 0-14 0 M16 43h6 M36 43h13";
  if (type === "handle" && model === "knob")
    paths[type] =
      "M22 32a10 10 0 1 0 20 0a10 10 0 1 0-20 0 M28 32a4 4 0 1 0 8 0a4 4 0 1 0-8 0";
  if (type === "handle" && model === "push-open")
    paths[type] = "M12 10h40v44H12z M39 27l-6 5 6 5";
  if (type === "sink" && model === "single")
    paths[type] = paths.sink.replace(" M30 25v16", "");
  if (type === "plinth" && model === "legs")
    paths[type] =
      "M8 20h48v6H8z M12 26h6v26h-6z M46 26h6v26h-6z M24 26h4v18h-4z M36 26h4v18h-4z";
  if (type === "tap" && model === "angled")
    paths[type] = "M25 51V19l18-6 8 12 M17 51h22 M48 25h8";
  return (
    <svg className="kco-thumbnail" viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="12" fill="#eef1e9" />
      <path
        d={paths[type]}
        fill={color}
        fillOpacity={model === "glass" ? ".2" : ".45"}
        stroke="#3e5a49"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SizeInput({
  label,
  value,
  min,
  max,
  disabled,
  onCommit,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  disabled?: boolean;
  onCommit: (value: number) => string | undefined;
}) {
  const [draft, setDraft] = useState(String(value));
  const [invalid, setInvalid] = useState(false);
  const hintId = useId();
  useEffect(() => {
    setDraft(String(value));
    setInvalid(false);
  }, [value]);
  return (
    <label className="kp-field kco-size-field">
      <span>{label}</span>
      <div className="kco-number">
        <input
          type="number"
          value={draft}
          min={min}
          max={max}
          step={1}
          disabled={disabled}
          inputMode="numeric"
          aria-describedby={hintId}
          aria-invalid={invalid || undefined}
          onChange={(event) => {
            setDraft(event.target.value);
            setInvalid(false);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") event.currentTarget.blur();
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              event.currentTarget.value = String(value);
              setDraft(String(value));
              event.currentTarget.blur();
            }
          }}
          onBlur={(event) => {
            const next = event.currentTarget.value.trim()
              ? event.currentTarget.valueAsNumber
              : NaN;
            if (next === value) return;
            const problem = onCommit(next);
            setInvalid(!!problem);
            if (problem) setDraft(String(value));
          }}
        />
        <span aria-hidden="true">мм</span>
      </div>
      <small id={hintId}>
        {min}–{max} мм
      </small>
    </label>
  );
}

const modelLabel = (item: CabinetComponent) =>
  COMPONENT_OPTIONS.find(
    (option) => option.type === item.type && option.model === item.model,
  )?.label ?? item.model;
const sizeLabel = (size: ReturnType<typeof getComponentSize>) =>
  size.width === 0 && size.height === 0
    ? "Бариулгүй нүүр"
    : `${Number(size.width.toFixed(3))} × ${Number(size.height.toFixed(3))} × ${Number(size.depth.toFixed(3))} мм`;

export function KitchenOptionsPanel({
  cabinet,
  kitchen,
  disabled,
  onReplace,
  onCabinetChange,
  showOverview = false,
  onOverviewClose,
}: {
  cabinet: ModularCabinet;
  kitchen: ModularKitchen;
  disabled: boolean;
  onReplace: (item: CabinetComponent) => string | undefined;
  onCabinetChange: (patch: Partial<ModularCabinet>) => string | undefined;
  showOverview?: boolean;
  onOverviewClose?: () => void;
}) {
  const [category, setCategory] = useState<ComponentType | null>(null);
  const [overview, setOverview] = useState(showOverview);
  const [mode, setMode] = useState<"settings" | "replace">("settings");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const categoryNav = useRef<HTMLElement>(null);
  const selectedCabinet = {
    ...cabinet,
    components: getComponents(cabinet, kitchen),
  };
  const selected = selectedCabinet.components.find(
    (item) => item.type === category,
  );
  const options = selected ? compatibleOptions(cabinet, selected.type) : [];
  const filteredOptions = options.filter((option) =>
    `${option.label} ${option.model}`
      .toLocaleLowerCase()
      .includes(search.trim().toLocaleLowerCase()),
  );
  const hiddenHandle =
    selected?.type === "handle" && selected.model === "push-open";
  const materials =
    selected && !hiddenHandle ? componentMaterials(selected.type) : [];
  const sizeFields = selected ? componentSizeFields(cabinet, selected) : [];
  const size = selected ? getComponentSize(cabinet, selected, kitchen) : null;
  const slot = ovenSlot(cabinet);

  useEffect(() => {
    if (showOverview) {
      setOverview(true);
      setCategory(null);
      setError("");
      setSearch("");
    }
  }, [showOverview, cabinet.id]);
  useEffect(() => {
    const active = categoryNav.current?.querySelector<HTMLElement>(
      '[aria-pressed="true"]',
    );
    active?.scrollIntoView({
      block: "nearest",
      inline: "nearest",
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
    });
  }, [category]);

  function change(item: CabinetComponent) {
    const problem = onReplace(item);
    setError(problem ?? "");
    return problem;
  }
  function dimensions(patch: Partial<ModularCabinet>) {
    const problem = onCabinetChange(patch);
    setError(problem ?? "");
    return problem;
  }
  function openCategory(type: ComponentType) {
    setCategory(type);
    setMode("settings");
    setError("");
    setSearch("");
  }
  function closeSheet() {
    setCategory(null);
    setOverview(false);
    setError("");
    setSearch("");
    onOverviewClose?.();
  }
  function editSize(
    key: "width" | "height" | "depth",
    value: number,
    min: number,
    max: number,
    label: string,
  ) {
    if (!selected) return "Бүрэлдэхүүн хэсгийг сонгоно уу.";
    if (!Number.isInteger(value) || value < min || value > max) {
      const problem = `${label} ${min}–${max} мм-ийн хооронд бүхэл тоо байна.`;
      setError(problem);
      return problem;
    }
    return change({ ...selected, size: { ...selected.size, [key]: value } });
  }
  const categoryRows = selectedCabinet.components.map((item) => (
    <button
      key={item.type}
      type="button"
      disabled={disabled}
      onClick={() => openCategory(item.type)}
      aria-haspopup="dialog"
      aria-label={`${COMPONENT_LABELS[item.type]} тохируулах`}
    >
      <Thumbnail
        type={item.type}
        model={item.model}
        color={componentColor(cabinet, item)}
      />
      <span>
        <strong>{COMPONENT_LABELS[item.type]}</strong>
        <small>{modelLabel(item)}</small>
        <span className="kco-dimension-caption">
          {sizeLabel(getComponentSize(cabinet, item, kitchen))}
        </span>
      </span>
      <ChevronRight size={17} />
    </button>
  ));

  return (
    <section
      className="kp-panel kco-panel"
      aria-label="Сонгосон шүүгээний бүрэлдэхүүн"
    >
      <p className="kp-eyebrow">СОНГОСОН ШҮҮГЭЭ</p>
      <h2>{cabinetLabel(cabinet)}</h2>
      <p className="kco-caption">
        {cabinet.width} × {cabinet.height} × {cabinet.depth} мм ·{" "}
        {selectedCabinet.components.length} бүрэлдэхүүн
      </p>
      <div className="kco-list">{categoryRows}</div>
      {(overview || selected) && (
        <KitchenComponentSheet
          title={
            selected ? COMPONENT_LABELS[selected.type] : "Шүүгээний бүрэлдэхүүн"
          }
          onClose={closeSheet}
        >
          {selected ? (
            <>
              <button
                type="button"
                className="kco-back"
                onClick={() => {
                  setCategory(null);
                  setOverview(true);
                  setError("");
                  setSearch("");
                }}
              >
                <ArrowLeft size={16} />
                Бүх бүрэлдэхүүн
              </button>
              <nav
                ref={categoryNav}
                className="kco-category-nav"
                aria-label="Бүрэлдэхүүн хэсэг сонгох"
              >
                {selectedCabinet.components.map((item) => (
                  <button
                    type="button"
                    key={item.type}
                    aria-pressed={selected.type === item.type}
                    onClick={() => openCategory(item.type)}
                  >
                    {COMPONENT_LABELS[item.type]}
                  </button>
                ))}
              </nav>
              <div className="kco-detail" key={selected.type}>
                <div className="kco-part">
                  <Thumbnail
                    type={selected.type}
                    model={selected.model}
                    color={componentColor(cabinet, selected)}
                  />
                  <div>
                    <strong>{modelLabel(selected)}</strong>
                    <p>{size && sizeLabel(size)}</p>
                    <small>Өргөн × өндөр × гүн</small>
                  </div>
                </div>
                <div
                  className="kco-tabs"
                  role="group"
                  aria-label="Бүрэлдэхүүний үйлдэл"
                >
                  <button
                    type="button"
                    aria-pressed={mode === "settings"}
                    onClick={() => setMode("settings")}
                  >
                    <Settings2 size={16} />
                    Тохиргоо
                  </button>
                  <button
                    type="button"
                    aria-pressed={mode === "replace"}
                    onClick={() => setMode("replace")}
                  >
                    <ArrowLeftRight size={16} />
                    Солих
                  </button>
                </div>
                {error && (
                  <p className="kco-error" role="alert">
                    {error}
                  </p>
                )}
                <fieldset className="km-fields kco-fields" disabled={disabled}>
                  {mode === "replace" ? (
                    <>
                      <label className="kp-field kco-search">
                        <span>Загвар хайх</span>
                        <div>
                          <Search size={17} aria-hidden="true" />
                          <input
                            type="search"
                            value={search}
                            placeholder="Загварын нэрээр хайх"
                            onChange={(event) => setSearch(event.target.value)}
                          />
                        </div>
                      </label>
                      <p className="kco-caption" role="status">
                        Угсрах хэмжээнд тохирох {filteredOptions.length} загвар
                      </p>
                      <div className="kco-replacements">
                        {filteredOptions.map((option) => {
                          const replacement = compatibleReplacement(cabinet, {
                            ...selected,
                            model: option.model,
                          });
                          return (
                            <button
                              type="button"
                              key={option.model}
                              aria-pressed={selected.model === option.model}
                              onClick={() => change(replacement)}
                            >
                              <Thumbnail
                                type={option.type}
                                model={option.model}
                                color={componentColor(cabinet, replacement)}
                              />
                              <strong>{option.label}</strong>
                              <small>
                                {sizeLabel(
                                  getComponentSize(
                                    cabinet,
                                    replacement,
                                    kitchen,
                                  ),
                                )}
                              </small>
                              <span className="kco-option-state">
                                {selected.model === option.model ? (
                                  <>
                                    <Check size={14} />
                                    Сонгосон
                                  </>
                                ) : (
                                  "Сонгох"
                                )}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                      {!filteredOptions.length && (
                        <p className="kco-empty">
                          Энэ хайлтад тохирох загвар алга. Нэрээ өөрчилж хайна
                          уу.
                        </p>
                      )}
                      <p className="kp-help">
                        Солиход тохируулсан өнгө, материал, хэмжээ хадгалагдана.
                      </p>
                    </>
                  ) : (
                    <>
                      {materials.length > 0 && (
                        <div className="kco-setting-group">
                          <h3>Материал</h3>
                          <div
                            className="kco-materials"
                            role="group"
                            aria-label={`${COMPONENT_LABELS[selected.type]} материал`}
                          >
                            {materials.map((material) => (
                              <button
                                type="button"
                                key={material.id}
                                aria-pressed={selected.finish === material.id}
                                onClick={() =>
                                  change({
                                    ...selected,
                                    finish: material.id,
                                    color: material.color,
                                  })
                                }
                              >
                                <span
                                  className={`kco-material-swatch kco-material-${material.id}`}
                                  style={{ backgroundColor: material.color }}
                                >
                                  {selected.finish === material.id && (
                                    <Check size={15} />
                                  )}
                                </span>
                                <span>{material.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                      {!hiddenHandle && (
                        <label className="kp-field">
                          <span>Өнгө</span>
                          <input
                            type="color"
                            value={componentColor(cabinet, selected)}
                            onChange={(event) =>
                              change({ ...selected, color: event.target.value })
                            }
                          />
                        </label>
                      )}
                      {selected.type === "frame" ? (
                        <div className="kco-setting-group">
                          <h3>Шүүгээний хэмжээ</h3>
                          <label className="kp-field">
                            <span>Шүүгээний өргөн</span>
                            <select
                              value={cabinet.width}
                              onChange={(event) => {
                                const width = Number(
                                  event.target.value,
                                ) as ModularCabinet["width"];
                                dimensions({
                                  width,
                                  doorCount:
                                    width < 600 ? 1 : cabinet.doorCount,
                                });
                              }}
                            >
                              {CABINET_WIDTHS.map((width) => (
                                <option key={width} value={width}>
                                  {width} мм
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="kco-size-grid">
                            {(["height", "depth"] as const).map((key) => (
                              <SizeInput
                                key={key}
                                label={
                                  key === "height"
                                    ? "Шүүгээний өндөр"
                                    : "Шүүгээний гүн"
                                }
                                value={cabinet[key]}
                                min={
                                  CABINET_DEFAULTS[cabinet.type][
                                    `${key}Range`
                                  ][0]
                                }
                                max={
                                  CABINET_DEFAULTS[cabinet.type][
                                    `${key}Range`
                                  ][1]
                                }
                                disabled={
                                  key === "height" &&
                                  cabinet.type === "tall" &&
                                  cabinet.fitToCeiling
                                }
                                onCommit={(value) =>
                                  dimensions({ [key]: value })
                                }
                              />
                            ))}
                          </div>
                        </div>
                      ) : (
                        sizeFields.length > 0 &&
                        size && (
                          <div className="kco-setting-group">
                            <h3>Хэмжээ</h3>
                            <div className="kco-size-grid">
                              {sizeFields.map((field) => (
                                <SizeInput
                                  key={field.key}
                                  label={field.label}
                                  value={size[field.key]}
                                  min={field.min}
                                  max={field.max}
                                  onCommit={(value) =>
                                    editSize(
                                      field.key,
                                      value,
                                      field.min,
                                      field.max,
                                      field.label,
                                    )
                                  }
                                />
                              ))}
                            </div>
                          </div>
                        )
                      )}
                      {["door-front", "drawer-front"].includes(
                        selected.type,
                      ) && (
                        <p className="kp-help">
                          Өөрчлөлт зөвхөн энэ төрлийн нүүрэнд үйлчилнэ. Угсрах
                          өргөн, өндрийг шүүгээний хэмжээнээс тооцно.
                        </p>
                      )}
                      {selected.type === "oven" && slot && (
                        <p className="kp-help">
                          Нүх: {slot.width} × {slot.height} × {slot.depth} мм.
                          Шалнаас {slot.bottom} мм.{" "}
                          {cabinet.type === "base"
                            ? "Плиткатай нэг босоо тэнхлэгт байрлана."
                            : "Өндөр шүүгээний дунд хэсэгт суулгана."}
                        </p>
                      )}
                      {selected.type === "worktop" && (
                        <p className="kp-help">
                          Өөрчлөлт зөвхөн энэ шүүгээний тавцанд үйлчилнэ. Урт нь
                          шүүгээний өргөнтэй хамт өөрчлөгдөнө.
                        </p>
                      )}
                      {selected.type !== "frame" &&
                        !sizeFields.length &&
                        !["door-front", "drawer-front", "oven"].includes(
                          selected.type,
                        ) && (
                          <p className="kp-help">
                            Угсрах хэмжээ тогтмол. Ижил хэмжээтэй загварыг
                            «Солих» хэсгээс сонгоно.
                          </p>
                        )}
                    </>
                  )}
                </fieldset>
              </div>
            </>
          ) : (
            <div className="kco-detail kco-overview" key="overview">
              <p className="kco-overview-heading">
                {cabinetLabel(cabinet)}
              </p>
              <p className="kco-caption">
                {cabinet.width} × {cabinet.height} × {cabinet.depth} мм
              </p>
              <p className="kco-overview-hint">Өөрчлөх хэсгээ сонгоно уу.</p>
              <div className="kco-list">{categoryRows}</div>
            </div>
          )}
        </KitchenComponentSheet>
      )}
    </section>
  );
}
