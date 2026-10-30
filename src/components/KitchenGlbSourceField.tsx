"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  Box,
  CheckCircle2,
  Combine,
  Eye,
  EyeOff,
  FileUp,
  Frame,
  Hand,
  ListChecks,
  LoaderCircle,
  MousePointer2,
  Palette,
  Plus,
  RotateCcw,
  Ruler,
  SquareDashedMousePointer,
  SquarePlus,
  Trash2,
  TriangleAlert,
  Undo2,
  X,
} from "lucide-react";
import { merchantRequest } from "@/features/merchant/merchantApi";
import {
  KITCHEN_GLB_UNITS,
  kitchenGlbIssues,
  prepareKitchenDesignGlb,
  type KitchenGlbModelInfo,
  type KitchenGlbUnit,
} from "@/lib/kitchenDesignGlb";
import { KITCHEN_LAYOUT_LABELS } from "@/lib/kitchenListingSuggestions";
import { KITCHEN_GLB_LAYOUTS } from "@/lib/kitchenMarketplace";
import {
  KITCHEN_GLB_ROLE_LABELS,
  kitchenGlbManualModule,
  kitchenGlbModuleName,
  type KitchenGlbDetection,
  type KitchenGlbFinish,
  type KitchenGlbModule,
  type KitchenGlbModuleRole,
  type KitchenGlbPart,
} from "@/lib/kitchenGlbModules";
import { kitchenGlbApplianceLines } from "@/lib/kitchenGlbCarcass";
import {
  KITCHEN_GLB_CATEGORY_COLORS,
  KITCHEN_GLB_CATEGORY_LABELS,
  kitchenGlbBom,
  kitchenGlbMergeModules,
  kitchenGlbModuleIssues,
  kitchenGlbPartCategories,
  type KitchenGlbCategory,
} from "@/lib/kitchenGlbChecks";
import {
  KITCHEN_GLB_VIEW_LABELS,
  renderKitchenGlbPreview,
  type KitchenGlbPick,
  type KitchenGlbTool,
  type KitchenGlbView,
} from "@/three/kitchenGlbPreview";
import "./kitchen-glb-source.css";

export type KitchenGlbUpload = {
  uploadId: string;
  fileName: string;
  info: KitchenGlbModelInfo;
  /** Straight front view: the listing's primary picture. */
  thumbnail: File;
  /** Right, back, left and 3D views added as extra listing pictures. */
  renders: File[];
  /** Colour-coded, numbered picture of the confirmed modules (BOM sheet). */
  captureBom?: () => Promise<File>;
  parts: KitchenGlbPart[];
  /** Detected modules, then corrected by the merchant in the preview. */
  detection: KitchenGlbDetection;
};

type Preview = Awaited<ReturnType<typeof renderKitchenGlbPreview>>;

type Stage = "idle" | "preparing" | "uploading" | "ready" | "invalid" | "error";
const stageLabel: Record<Stage, string> = {
  idle: "",
  preparing: "Загварыг боловсруулж байна…",
  uploading: "Серверт хадгалж байна…",
  ready: "Бэлэн",
  invalid: "Засах шаардлагатай",
  error: "Алдаа гарлаа",
};

const TOOLS: Array<{
  value: KitchenGlbTool;
  label: string;
  key: string;
  icon: typeof Hand;
}> = [
  { value: "select", label: "Сонгох", key: "V", icon: MousePointer2 },
  {
    value: "multi",
    label: "Олныг сонгох",
    key: "M",
    icon: SquareDashedMousePointer,
  },
  { value: "hand", label: "Гар (зөөх)", key: "H", icon: Hand },
  { value: "measure", label: "Хэмжих", key: "R", icon: Ruler },
  { value: "add", label: "Модуль нэмэх", key: "A", icon: SquarePlus },
];
const TOOL_HINTS: Record<KitchenGlbTool, string> = {
  select: "Шүүгээ дээр дарж сонгоно. Shift дарж олныг сонгоно.",
  multi:
    "Олон модуль, хэсэг дээр дараалан дарж сонгоод \"Нэг модуль болгох\"-оор нэгтгэнэ.",
  hand: "Чирж харагдацыг зөөнө.",
  measure:
    "Хоёр цэг дээр дарж зайг хэмжинэ. Хавтангийн ирмэг, буланд 12 мм-ийн зайд наалдана. Esc: цэвэрлэх.",
  add: "Модульд ороогүй хавтан дээр дарахад тэр шүүгээг бүхэлд нь шинэ модуль болгоно.",
};
const LEGEND: KitchenGlbCategory[] = [
  "base",
  "wall",
  "tall",
  "countertop",
  "appliance",
  "light",
  "curved",
  "other",
];

const LAYOUT_OPTIONS = KITCHEN_GLB_LAYOUTS.map((value) => ({
  value,
  label:
    value === "l-left"
      ? "L хэлбэр · зүүн"
      : value === "l-right"
        ? "L хэлбэр · баруун"
        : (KITCHEN_LAYOUT_LABELS[value] ?? value),
}));

/**
 * Source picker for a ready-made kitchen delivered as one GLB: prepares the file
 * in the browser, previews it in 3D with editing tools, checks every detected
 * cabinet's sizes for manufacture, captures the listing pictures and stores the
 * prepared model privately until the draft is created.
 */
export function KitchenGlbSourceField({
  owner,
  upload,
  onUpload,
  layout,
  onLayout,
  cabinetCount,
  onCabinetCount,
  disabled = false,
}: {
  owner: string;
  upload: KitchenGlbUpload | null;
  onUpload: (value: KitchenGlbUpload | null) => void;
  layout: string;
  onLayout: (value: string) => void;
  cabinetCount: string;
  onCabinetCount: (value: string) => void;
  disabled?: boolean;
}) {
  const inputId = useId();
  const stage = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [unit, setUnit] = useState<KitchenGlbUnit | null>(null);
  const [zUp, setZUp] = useState(false);
  const [status, setStatus] = useState<Stage>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [info, setInfo] = useState<KitchenGlbModelInfo | null>(null);
  const [detectedUnit, setDetectedUnit] = useState<KitchenGlbUnit | null>(null);
  const [dragging, setDragging] = useState(false);
  const uploadCallback = useRef(onUpload);
  uploadCallback.current = onUpload;
  const preview = useRef<Preview | null>(null);
  // Bumped when a preview is ready, so effects push the current state into it.
  const [previewKey, setPreviewKey] = useState(0);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [selectedParts, setSelectedParts] = useState<number[]>([]);
  const [pickedPart, setPickedPart] = useState<number | null>(null);
  const [tool, setTool] = useState<KitchenGlbTool>("select");
  const [showModules, setShowModules] = useState(true);
  const [showEdges, setShowEdges] = useState(true);
  const [showColors, setShowColors] = useState(true);
  const [showDimensions, setShowDimensions] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const modules = useMemo(() => upload?.detection.modules ?? [], [upload]);
  const selected =
    selectedIds.length === 1
      ? (modules.find((item) => item.id === selectedIds[0]) ?? null)
      : null;
  const part =
    pickedPart === null
      ? null
      : (upload?.parts.find((item) => item.id === pickedPart) ?? null);
  // Module edits can be undone step by step (merge, delete, add, size).
  const history = useRef<KitchenGlbModule[][]>([]);
  const [undoCount, setUndoCount] = useState(0);
  const updateModules = (next: KitchenGlbModule[]) => {
    if (!upload) return;
    history.current = [...history.current.slice(-29), modules];
    setUndoCount(history.current.length);
    onUpload({ ...upload, detection: { ...upload.detection, modules: next } });
    // Any change to the modules needs a fresh confirmation of the sizes.
    setConfirmed(false);
  };
  const editModule = (id: string, change: Partial<KitchenGlbModule>) =>
    updateModules(
      modules.map((item) => (item.id === id ? { ...item, ...change } : item)),
    );
  const undo = () => {
    const previous = history.current.pop();
    setUndoCount(history.current.length);
    if (!upload || !previous) return;
    onUpload({
      ...upload,
      detection: { ...upload.detection, modules: previous },
    });
    setConfirmed(false);
    setSelectedIds([]);
    setSelectedParts([]);
  };
  const clearSelection = () => {
    setSelectedIds([]);
    setSelectedParts([]);
    setPickedPart(null);
  };
  const removeSelected = () => {
    if (!selectedIds.length) return;
    updateModules(modules.filter((item) => !selectedIds.includes(item.id)));
    clearSelection();
  };
  const newId = () => `u${Date.now().toString(36)}`;
  const mergeSelected = () => {
    if (!upload || selectedIds.length + selectedParts.length < 2) return;
    const id = newId();
    updateModules(
      kitchenGlbMergeModules(
        modules,
        selectedIds,
        selectedParts,
        upload.parts,
        id,
      ),
    );
    setSelectedIds([id]);
    setSelectedParts([]);
  };
  const addModuleFromPart = (partId: number) => {
    if (!upload) return;
    const source = upload.parts.find((item) => item.id === partId);
    if (!source) return;
    const id = newId();
    updateModules([
      ...modules,
      kitchenGlbManualModule(
        source,
        upload.parts,
        id,
        new Set(upload.detection.countertopParts ?? []),
      ),
    ]);
    setSelectedIds([id]);
    setPickedPart(null);
  };
  const fixedPart = (partId: number) =>
    (upload?.detection.countertopParts ?? []).includes(partId) ||
    (upload?.detection.appliances ?? []).some((item) =>
      item.parts.includes(partId),
    );
  const pick = useRef<(value: KitchenGlbPick) => void>(() => {});
  pick.current = ({ moduleId, partId, additive }) => {
    if (tool === "add") {
      if (partId === null || fixedPart(partId)) return;
      const holder = modules.find((item) => item.parts.includes(partId));
      if (holder) setSelectedIds([holder.id]);
      else addModuleFromPart(partId);
      return;
    }
    const holder =
      moduleId ??
      modules.find((item) => partId !== null && item.parts.includes(partId))
        ?.id ??
      null;
    if (additive) {
      setPickedPart(null);
      if (holder)
        setSelectedIds((current) =>
          current.includes(holder)
            ? current.filter((item) => item !== holder)
            : [...current, holder],
        );
      else if (partId !== null && !fixedPart(partId))
        setSelectedParts((current) =>
          current.includes(partId)
            ? current.filter((item) => item !== partId)
            : [...current, partId],
        );
      return;
    }
    setSelectedParts([]);
    // The worktop and appliances are not cabinets: clicking them selects nothing.
    if (partId !== null && !holder && fixedPart(partId)) {
      clearSelection();
      return;
    }
    setSelectedIds(holder ? [holder] : []);
    setPickedPart(holder ? null : partId);
  };
  // The worktop and appliances are outlined apart from the cabinet modules.
  const markers = useMemo(() => {
    if (!upload) return [];
    const boxes = (ids: readonly number[]) =>
      ids.flatMap((id) => {
        const part = upload.parts.find((item) => item.id === id);
        return part ? [{ kind: "countertop" as const, box: part.box }] : [];
      });
    return [
      ...boxes(upload.detection.countertopParts ?? []),
      ...(upload.detection.appliances ?? []).map((item) => ({
        kind: "appliance" as const,
        box: item.box,
      })),
    ];
  }, [upload]);
  const categories = useMemo(
    () =>
      upload ? kitchenGlbPartCategories(upload.detection, upload.parts) : null,
    [upload],
  );
  const legend = useMemo(() => {
    const counts = new Map<KitchenGlbCategory, number>();
    if (!upload || !categories) return counts;
    for (const cabinet of modules)
      counts.set(cabinet.role, (counts.get(cabinet.role) ?? 0) + 1);
    counts.set("countertop", upload.detection.countertopParts?.length ?? 0);
    counts.set("appliance", upload.detection.appliances?.length ?? 0);
    for (const kind of ["light", "curved", "other"] as const)
      counts.set(
        kind,
        [...categories.values()].filter((value) => value === kind).length,
      );
    return counts;
  }, [upload, categories, modules]);
  const issues = useMemo(
    () => (upload ? kitchenGlbModuleIssues(upload.detection, upload.parts) : []),
    [upload],
  );
  const bom = useMemo(
    () => (upload ? kitchenGlbBom(upload.detection, upload.parts) : []),
    [upload],
  );
  const errors = issues.filter((item) => item.level === "error").length;
  const unchecked = modules.filter((item) => !item.checked).length;
  const flagged = useMemo(
    () => new Set(issues.flatMap((item) => item.moduleIds)),
    [issues],
  );

  useEffect(() => {
    preview.current?.setModules(modules, selectedIds, markers);
  }, [modules, selectedIds, markers, previewKey]);
  useEffect(() => {
    preview.current?.setSelectedParts(selectedParts);
  }, [selectedParts, previewKey]);
  useEffect(() => {
    if (!categories) return;
    preview.current?.setCategories(
      new Map(
        [...categories].map(([id, kind]) => [
          id,
          KITCHEN_GLB_CATEGORY_COLORS[kind],
        ]),
      ),
    );
  }, [categories, previewKey]);
  useEffect(() => {
    preview.current?.showCategories(showColors);
  }, [showColors, previewKey]);
  useEffect(() => {
    preview.current?.showModules(showModules);
  }, [showModules, previewKey]);
  useEffect(() => {
    preview.current?.showEdges(showEdges);
  }, [showEdges, previewKey]);
  useEffect(() => {
    preview.current?.showDimensions(showDimensions);
  }, [showDimensions, modules, previewKey]);
  useEffect(() => {
    preview.current?.setTool(tool);
  }, [tool, previewKey]);

  useEffect(() => {
    if (!file || !stage.current) return;
    const host = stage.current;
    let cancelled = false;
    let dispose = () => {};
    setStatus("preparing");
    setMessage(null);
    setSelectedIds([]);
    setSelectedParts([]);
    setPickedPart(null);
    setConfirmed(false);
    history.current = [];
    setUndoCount(0);
    uploadCallback.current(null);
    void (async () => {
      const prepared = await prepareKitchenDesignGlb(file, {
        unit: unit ?? undefined,
        zUp,
      });
      if (cancelled) return;
      setInfo(prepared.info);
      setDetectedUnit(prepared.unit);
      const view = await renderKitchenGlbPreview(host, prepared.file, {
        editing: true,
      });
      dispose = () => {
        view.dispose();
        if (preview.current === view) preview.current = null;
      };
      if (cancelled) return dispose();
      preview.current = view;
      view.onPick((value) => pick.current(value));
      const issues = kitchenGlbIssues(prepared.info);
      if (issues.length) {
        setStatus("invalid");
        setMessage(issues.join(" "));
        setPreviewKey((value) => value + 1);
        return;
      }
      setStatus("uploading");
      // Straight front view for the thumbnail, the other sides as extras.
      const thumbnail = await view.capture();
      const renders = await view.captureViews();
      view.setModules(prepared.detection.modules, null);
      const form = new FormData();
      form.set("file", prepared.file);
      const saved = await merchantRequest<{ uploadId: string }>(
        "/api/merchant/kitchen-designs/models",
        owner,
        { method: "POST", body: form },
      );
      if (cancelled) return;
      setStatus("ready");
      setPreviewKey((value) => value + 1);
      uploadCallback.current({
        uploadId: saved.uploadId,
        fileName: file.name,
        info: prepared.info,
        thumbnail,
        renders,
        captureBom: () => view.captureBom(),
        parts: prepared.parts,
        detection: prepared.detection,
      });
    })().catch((reason) => {
      if (cancelled) return;
      setStatus("error");
      setMessage(
        reason instanceof Error
          ? reason.message
          : "GLB файлыг боловсруулж чадсангүй.",
      );
    });
    return () => {
      cancelled = true;
      dispose();
    };
  }, [file, unit, zUp, owner]);

  const choose = (next: File | undefined) => {
    if (!next) return;
    if (!/\.glb$/i.test(next.name)) {
      setStatus("error");
      setMessage("Зөвхөн .glb файл сонгоно уу.");
      return;
    }
    setUnit(null);
    setZUp(false);
    setFile(next);
  };
  const busy = status === "preparing" || status === "uploading";
  const megabytes = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;
  const onKeys = (event: KeyboardEvent) => {
    const target = event.target as HTMLElement;
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
      event.preventDefault();
      undo();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeSelected();
      return;
    }
    if (event.key === "Escape") {
      clearSelection();
      preview.current?.clearMeasurements();
      return;
    }
    const next = TOOLS.find((item) => item.key === event.key.toUpperCase());
    if (next && !event.ctrlKey && !event.metaKey) setTool(next.value);
    else if (event.key.toUpperCase() === "D")
      setShowDimensions((value) => !value);
  };

  return (
    <section className="kg-source" aria-label="Бэлэн GLB файл">
      {!file ? (
        <label
          htmlFor={inputId}
          className={`kg-drop ${dragging ? "is-dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            choose(event.dataTransfer.files[0]);
          }}
        >
          <FileUp size={22} />
          <strong>Гал тогооны бүтэн GLB файлаа энд чирж оруулна уу</strong>
          <span>
            Эсвэл дарж сонгоно. 50 MB хүртэл, шахаагүй glTF 2.0 (.glb). Нэгж,
            тэнхлэг, эх цэгийг автоматаар тааруулна.
          </span>
        </label>
      ) : (
        <div className="kg-workbench">
          <div className="kg-viewport" onKeyDown={onKeys}>
            {upload && (
              <div
                className="kg-toolbar"
                role="toolbar"
                aria-label="3D засварын хэрэгсэл"
              >
                <span className="kg-tool-group">
                  {TOOLS.map(({ value, label, key, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      className="kg-tool"
                      aria-pressed={tool === value}
                      title={`${label} (${key})`}
                      aria-label={label}
                      onClick={() => setTool(value)}
                    >
                      <Icon size={15} />
                    </button>
                  ))}
                </span>
                <span className="kg-tool-group">
                  <button
                    type="button"
                    className="kg-tool"
                    aria-pressed={showDimensions}
                    title="Хэмжээс харуулах (D)"
                    aria-label="Хэмжээс харуулах"
                    onClick={() => setShowDimensions(!showDimensions)}
                  >
                    <span className="kg-tool-dim" aria-hidden="true">
                      ↔
                    </span>
                  </button>
                  <button
                    type="button"
                    className="kg-tool"
                    aria-pressed={showColors}
                    title="Төрлөөр өнгө ялгах"
                    aria-label="Төрлөөр өнгө ялгах"
                    onClick={() => setShowColors(!showColors)}
                  >
                    <Palette size={15} />
                  </button>
                  <button
                    type="button"
                    className="kg-tool"
                    aria-pressed={showModules}
                    title="Модулийн хайрцаг"
                    aria-label="Модулийн хайрцаг"
                    onClick={() => setShowModules(!showModules)}
                  >
                    <Box size={15} />
                  </button>
                  <button
                    type="button"
                    className="kg-tool"
                    aria-pressed={showEdges}
                    title="Хавтангийн хүрээ"
                    aria-label="Хавтангийн хүрээ"
                    onClick={() => setShowEdges(!showEdges)}
                  >
                    <Frame size={15} />
                  </button>
                </span>
                <span className="kg-tool-group">
                  <button
                    type="button"
                    className="kg-tool"
                    disabled={!undoCount}
                    title="Буцаах (Ctrl+Z)"
                    aria-label="Буцаах"
                    onClick={undo}
                  >
                    <Undo2 size={15} />
                  </button>
                  <button
                    type="button"
                    className="kg-tool is-danger"
                    disabled={!selectedIds.length}
                    title="Сонгосон модулийг устгах (Delete)"
                    aria-label="Сонгосон модулийг устгах"
                    onClick={removeSelected}
                  >
                    <Trash2 size={15} />
                  </button>
                </span>
                <span className="kg-tool-group kg-views">
                  {(Object.keys(KITCHEN_GLB_VIEW_LABELS) as KitchenGlbView[]).map(
                    (view) => (
                      <button
                        key={view}
                        type="button"
                        className="kg-tool is-text"
                        title={`${KITCHEN_GLB_VIEW_LABELS[view]} талаас харах`}
                        onClick={() => preview.current?.view(view)}
                      >
                        {KITCHEN_GLB_VIEW_LABELS[view]}
                      </button>
                    ),
                  )}
                </span>
              </div>
            )}
            <div
              className="kg-stage"
              ref={stage}
              tabIndex={0}
              aria-label="3D урьдчилан харах"
            >
              {busy && (
                <span className="kg-stage-status" role="status">
                  <LoaderCircle className="animate-spin" size={15} />
                  {stageLabel[status]}
                </span>
              )}
            </div>
            {upload && (
              <>
                <p className="kg-tool-hint">{TOOL_HINTS[tool]}</p>
                {selectedIds.length + selectedParts.length > 1 && (
                  <div className="kg-multi-bar" role="status">
                    <span>
                      {selectedIds.length} модуль
                      {selectedParts.length
                        ? `, ${selectedParts.length} хэсэг`
                        : ""}{" "}
                      сонгосон
                    </span>
                    <button
                      type="button"
                      className="kg-link"
                      onClick={mergeSelected}
                    >
                      <Combine size={13} /> Нэг модуль болгох
                    </button>
                    {!!selectedIds.length && (
                      <button
                        type="button"
                        className="kg-link is-danger"
                        onClick={removeSelected}
                      >
                        <Trash2 size={13} /> Устгах
                      </button>
                    )}
                    <button
                      type="button"
                      className="kg-link"
                      onClick={clearSelection}
                    >
                      <X size={13} /> Цуцлах
                    </button>
                  </div>
                )}
                <ul className="kg-legend" aria-label="Өнгөний тайлбар">
                  {LEGEND.filter(
                    (kind) =>
                      (legend.get(kind) ?? 0) > 0 ||
                      ["base", "wall", "tall"].includes(kind),
                  ).map((kind) => (
                    <li key={kind}>
                      <i
                        style={{ background: KITCHEN_GLB_CATEGORY_COLORS[kind] }}
                      />
                      {KITCHEN_GLB_CATEGORY_LABELS[kind]}
                      <b>{legend.get(kind) ?? 0}</b>
                    </li>
                  ))}
                </ul>
                <div
                  className={`kg-checks ${errors ? "has-errors" : ""}`}
                  aria-label="Хэмжээний шалгалт"
                >
                  <div className="kg-checks-head">
                    <TriangleAlert size={15} />
                    <strong>Үйлдвэрт өгөхөөс өмнө хэмжээг шалгана уу</strong>
                  </div>
                  <p>
                    Гал тогооны тавилга мм-ийн нарийвчлалтай хийгддэг тул
                    автоматаар уншсан хэмжээ бодит зурагнаас зөрж болно. Модуль
                    бүрийг сонгож хэмжээг нь зурагтайгаа тулгаад
                    &quot;Шалгасан&quot; гэж тэмдэглээрэй.
                  </p>
                  {issues.length ? (
                    <ul>
                      {issues.map((item, index) => (
                        <li key={index} className={`is-${item.level}`}>
                          <button
                            type="button"
                            disabled={!item.moduleIds.length}
                            onClick={() => {
                              setSelectedIds(item.moduleIds);
                              setSelectedParts([]);
                              setPickedPart(null);
                            }}
                          >
                            {item.text}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="kg-ok">
                      <CheckCircle2 size={14} /> Илэрхий алдаа олдсонгүй.
                    </p>
                  )}
                </div>
                <details className="kg-bom" open>
                  <summary>
                    <ListChecks size={14} /> BOM · дэлгэрэнгүй бүрдэл (
                    {bom.length})
                  </summary>
                  <div className="kg-bom-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Нэр</th>
                          <th>Ө × Ө × Г, мм</th>
                          <th>Тоо</th>
                          <th>Тайлбар</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bom.map((row) => {
                          const cabinet = row.moduleId
                            ? modules.find((item) => item.id === row.moduleId)
                            : null;
                          return (
                            <tr
                              key={row.key}
                              aria-selected={
                                !!row.moduleId &&
                                selectedIds.includes(row.moduleId)
                              }
                              className={
                                row.moduleId && flagged.has(row.moduleId)
                                  ? "is-flagged"
                                  : undefined
                              }
                              onClick={() => {
                                if (!row.moduleId) return;
                                setSelectedIds([row.moduleId]);
                                setSelectedParts([]);
                                setPickedPart(null);
                              }}
                            >
                              <td>
                                <span className="kg-bom-group">{row.group}</span>
                                {row.name}
                              </td>
                              <td className="is-number">{row.size}</td>
                              <td className="is-number">{row.quantity}</td>
                              <td>
                                {cabinet?.checked && (
                                  <CheckCircle2
                                    size={12}
                                    className="kg-checked"
                                    aria-label="Шалгасан"
                                  />
                                )}
                                {row.note}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </details>
              </>
            )}
          </div>
          <div className="kg-facts">
            <div className="kg-file">
              <Box size={16} />
              <span title={file.name}>{file.name}</span>
              <label htmlFor={inputId} className="kg-replace">
                <RotateCcw size={13} /> Солих
              </label>
            </div>
            {info && (
              <dl className="kg-dimensions">
                <div>
                  <dt>Өргөн</dt>
                  <dd>{info.widthMm.toLocaleString("mn-MN")} мм</dd>
                </div>
                <div>
                  <dt>Гүн</dt>
                  <dd>{info.depthMm.toLocaleString("mn-MN")} мм</dd>
                </div>
                <div>
                  <dt>Өндөр</dt>
                  <dd>{info.heightMm.toLocaleString("mn-MN")} мм</dd>
                </div>
              </dl>
            )}
            {info && (
              <p className="kg-meta">
                {megabytes(info.bytes)} · {info.meshes} mesh ·{" "}
                {info.triangles.toLocaleString("mn-MN")} гурвалжин ·{" "}
                {info.materialNames.length} материал
              </p>
            )}
            <div className="kg-adjust">
              <label>
                Файлын нэгж
                <select
                  className="input"
                  value={unit ?? detectedUnit ?? "m"}
                  disabled={busy || disabled}
                  onChange={(event) =>
                    setUnit(event.target.value as KitchenGlbUnit)
                  }
                >
                  {Object.entries(KITCHEN_GLB_UNITS).map(([value, item]) => (
                    <option key={value} value={value}>
                      {item.label}
                      {value === detectedUnit && !unit ? " · автомат" : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="kg-check">
                <input
                  type="checkbox"
                  checked={zUp}
                  disabled={busy || disabled}
                  onChange={(event) => setZUp(event.target.checked)}
                />
                Хэвтсэн харагдвал: Z тэнхлэг дээш
              </label>
            </div>
            <div className="kg-adjust">
              <label>
                Хэлбэр
                <select
                  className="input"
                  value={layout}
                  disabled={disabled}
                  onChange={(event) => onLayout(event.target.value)}
                >
                  {LAYOUT_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Модулийн тоо *
                <input
                  className="input"
                  type="number"
                  min={1}
                  max={80}
                  required
                  value={cabinetCount}
                  disabled={disabled}
                  placeholder="Жишээ: 12"
                  onChange={(event) => onCabinetCount(event.target.value)}
                />
              </label>
            </div>
            {upload && modules.length > 0 && cabinetCount !== String(modules.length) && (
              <div className="km-suggestions">
                <button
                  type="button"
                  onClick={() => onCabinetCount(String(modules.length))}
                >
                  <Plus size={11} /> Танигдсан {modules.length} модуль
                </button>
              </div>
            )}
            {upload && (
              <div className="kg-modules">
                <div className="kg-modules-head">
                  <strong>Модулиуд · {modules.length}</strong>
                  <span className="kg-meta">
                    {unchecked
                      ? `${unchecked} шалгаагүй`
                      : "Бүгд шалгасан"}
                  </span>
                </div>
                <label className="kg-countertop">
                  Тавцангийн өнгө
                  <input
                    className="input kg-color"
                    type="color"
                    value={upload.detection.countertopColor ?? "#e8e4dc"}
                    onChange={(event) =>
                      onUpload({
                        ...upload,
                        detection: {
                          ...upload.detection,
                          countertopColor: event.target.value,
                        },
                      })
                    }
                  />
                  <span>
                    {upload.detection.countertopM2
                      ? `${upload.detection.countertopM2} м²`
                      : "Тавцан танигдсангүй"}
                  </span>
                </label>
                {!!upload.detection.appliances?.length && (
                  <div className="kg-appliances" aria-label="Техник хэрэгсэл">
                    {kitchenGlbApplianceLines(upload.detection.appliances).map(
                      (line) => (
                        <span key={line}>{line}</span>
                      ),
                    )}
                  </div>
                )}
                <div
                  className="kg-module-list"
                  role="listbox"
                  aria-label="Модулиуд"
                  aria-multiselectable="true"
                >
                  {modules.map((item, index) => (
                    <button
                      key={item.id}
                      type="button"
                      role="option"
                      aria-selected={selectedIds.includes(item.id)}
                      className={`kg-module is-${item.role} ${flagged.has(item.id) ? "is-flagged" : ""}`}
                      onClick={(event) => {
                        setPickedPart(null);
                        if (event.shiftKey || tool === "multi")
                          setSelectedIds((current) =>
                            current.includes(item.id)
                              ? current.filter((value) => value !== item.id)
                              : [...current, item.id],
                          );
                        else
                          setSelectedIds(
                            selectedIds.length === 1 &&
                              selectedIds[0] === item.id
                              ? []
                              : [item.id],
                          );
                      }}
                    >
                      {item.checked && <CheckCircle2 size={11} />}
                      {index + 1}. {item.name}
                    </button>
                  ))}
                </div>
                {selected && (
                  <div className="kg-module-editor">
                    <label>
                      Нэр
                      <input
                        className="input"
                        value={selected.name}
                        maxLength={60}
                        onChange={(event) =>
                          editModule(selected.id, { name: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Төрөл
                      <select
                        className="input"
                        value={selected.role}
                        onChange={(event) => {
                          const role = event.target
                            .value as KitchenGlbModuleRole;
                          const named =
                            selected.name ===
                            kitchenGlbModuleName(
                              selected.role,
                              selected.widthMm,
                            );
                          editModule(selected.id, {
                            role,
                            ...(named
                              ? {
                                  name: kitchenGlbModuleName(
                                    role,
                                    selected.widthMm,
                                  ),
                                }
                              : {}),
                          });
                        }}
                      >
                        {Object.entries(KITCHEN_GLB_ROLE_LABELS).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    {(
                      [
                        ["widthMm", "Өргөн, мм", "width"],
                        ["heightMm", "Өндөр, мм", "height"],
                        ["depthMm", "Гүн, мм", "depth"],
                      ] as const
                    ).map(([key, label, measure]) => (
                      <label
                        key={key}
                        className={
                          selected.measured?.[measure] === "estimated"
                            ? "is-estimated"
                            : undefined
                        }
                      >
                        {label}
                        <input
                          className="input"
                          type="number"
                          min={50}
                          max={3500}
                          value={selected[key]}
                          onChange={(event) => {
                            const value = Math.round(Number(event.target.value));
                            if (!Number.isFinite(value) || value <= 0) return;
                            editModule(selected.id, {
                              [key]: value,
                              checked: false,
                              measured: {
                                ...(selected.measured ?? {
                                  width: "front",
                                  height: "front",
                                  depth: "estimated",
                                }),
                                [measure]: "manual",
                              },
                            });
                          }}
                        />
                        {selected.measured && (
                          <small>
                            {MEASURE_NOTES[selected.measured[measure]]}
                          </small>
                        )}
                      </label>
                    ))}
                    <label>
                      Нүүрний өнгө
                      <input
                        className="input kg-color"
                        type="color"
                        value={selected.color ?? "#d9d4c7"}
                        onChange={(event) =>
                          editModule(selected.id, { color: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Гадаргуу
                      <select
                        className="input"
                        value={selected.finish ?? "matte"}
                        onChange={(event) =>
                          editModule(selected.id, {
                            finish: event.target.value as KitchenGlbFinish,
                          })
                        }
                      >
                        <option value="matte">Матт</option>
                        <option value="gloss">Гялгар</option>
                        <option value="wood">Модон</option>
                      </select>
                    </label>
                    <p className="kg-meta">
                      {selected.parts.length} хэсэг · {selected.facing} тал
                      руу харсан
                    </p>
                    <label className="kg-check kg-module-check">
                      <input
                        type="checkbox"
                        checked={!!selected.checked}
                        onChange={(event) =>
                          onUpload({
                            ...upload,
                            detection: {
                              ...upload.detection,
                              modules: modules.map((item) =>
                                item.id === selected.id
                                  ? { ...item, checked: event.target.checked }
                                  : item,
                              ),
                            },
                          })
                        }
                      />
                      Хэмжээг зурагтай тулгаж шалгасан
                    </label>
                    <button
                      type="button"
                      className="kg-link is-danger"
                      onClick={removeSelected}
                    >
                      <Trash2 size={13} /> Модулийг хасах
                    </button>
                  </div>
                )}
                {part && (
                  <div className="kg-module-editor">
                    <p className="kg-meta">
                      Сонгосон хэсэг: {part.name || `#${part.id}`} ·{" "}
                      {Math.round(part.box.max[0] - part.box.min[0])} ×{" "}
                      {Math.round(part.box.max[1] - part.box.min[1])} ×{" "}
                      {Math.round(part.box.max[2] - part.box.min[2])} мм
                      {part.thicknessMm ? ` · зузаан ${part.thicknessMm} мм` : ""}
                    </p>
                    <button
                      type="button"
                      className="kg-link"
                      onClick={() => addModuleFromPart(part.id)}
                    >
                      <Plus size={13} /> Шинэ модуль болгох
                    </button>
                  </div>
                )}
                <label className="kg-confirm">
                  <input
                    type="checkbox"
                    required
                    checked={confirmed}
                    disabled={disabled}
                    onChange={(event) => setConfirmed(event.target.checked)}
                  />
                  <span>
                    Бүх модулийн өргөн, өндөр, гүнийг зурагтайгаа дахин
                    шалгасан. Буруу хэмжээ үйлдвэрт очвол шүүгээ байрандаа
                    таарахгүйг ойлгож байна.
                    {unchecked > 0 && (
                      <small>
                        {unchecked} модулийг тус бүрээр нь шалгаагүй байна.
                      </small>
                    )}
                  </span>
                </label>
              </div>
            )}
            {status === "ready" && upload && (
              <p className="kg-ok">
                <CheckCircle2 size={14} /> Хадгалагдсан. Нүүр зургийг урд
                талаас тэгш авч, бусад 3 тал ба 3D харагдацыг нэмэлт зураг
                болгоно.
              </p>
            )}
            {message && (
              <p className="kg-issue" role="alert">
                {message}
              </p>
            )}
            <p className="kg-hint">
              Модулийн тоо, бүрдэл доорх 01–03 хэсэгт автоматаар бөглөгдөж,
              танигдсан шүүгээнүүд талбар бүрийн доор нэмэх товч болж гарна.
            </p>
          </div>
        </div>
      )}
      <input
        id={inputId}
        type="file"
        accept=".glb,model/gltf-binary"
        hidden
        disabled={disabled || busy}
        onChange={(event) => {
          choose(event.target.files?.[0]);
          event.target.value = "";
        }}
      />
    </section>
  );
}

const MEASURE_NOTES: Record<string, string> = {
  carcass: "Их биеэр хэмжсэн",
  front: "Нүүрээр хэмжсэн · шалгана уу",
  solid: "Хайрцгаар хэмжсэн",
  estimated: "Таамагласан · заавал шалгана",
  merged: "Нэгтгэсэн · шалгана уу",
  manual: "Гараар оруулсан",
};
