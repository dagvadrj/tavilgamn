"use client";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import {
  Plus,
  Save,
  Trash2,
  RotateCw,
  Eye,
  LayoutGrid,
  Magnet,
  Copy,
  Layers,
  ShoppingBag,
  Maximize,
  Lock,
  Unlock,
  Menu,
  Settings,
  X,
  Sparkles,
  Upload,
  Undo2, Redo2, Ruler, Search, Download, Scan, Check, Move, ArrowUp, ArrowDown, ArrowLeft, ArrowRight,
} from "lucide-react";
import { CATEGORIES, priceFor } from "@/lib/products";
import { getProduct, useCatalog } from "@/store/catalog";
import { CatalogStatus } from "@/components/CatalogStatus";
import { useDesigns, ROOM_DIMENSIONS } from "@/store/designs";
import { stockLabel } from "@/lib/inventory";
import { useCart } from "@/store/cart";
import type {
  Category,
  PlacedFurniture,
  RoomDesign,
  RoomSize,
  Material,
} from "@/lib/types";
import { formatPrice, cn } from "@/lib/format";
import { isPlacementValid, findFreePlacement } from "@/three/collision";
import "./room-planner.css";
import { type DbModelInfo, getDbModel } from "@/lib/modelRegistry";

const RoomCanvas = dynamic(
  () => import("@/three/RoomCanvas").then((m) => m.RoomCanvas),
  { ssr: false, loading: () => <PlannerSkeleton /> },
);

const ROOM_OPTIONS: { id: RoomSize; label: string; sub: string }[] = [
  { id: "40", label: "40 м² орон сууц", sub: "6.3 × 6.3 м" },
  { id: "80", label: "80 м² орон сууц", sub: "8.9 × 8.9 м" },
  { id: "120", label: "120 м² байшин", sub: "11 × 11 м" },
];

const WALL_COLORS = [
  "#EFE6D6",
  "#F7F4EE",
  "#D6CFC1",
  "#A8B5A0",
  "#1F2638",
  "#3D2F26",
];
const FLOOR_COLORS = [
  "#C9A37A",
  "#8C6A4A",
  "#D9C9A8",
  "#6B4226",
  "#3D2F26",
  "#A8A8A8",
];

interface CustomInterior {
  id: string;
  basePath: string;
  glb: string;
  scale?: number;
  label: string;
}

const STATIC_PRESETS: CustomInterior[] = [
  {
    id: "tvfurniture",
    basePath: "/models/tv/",
    glb: "tv.glb",
    scale: 0.001,
    label: "tv (өөрийн загвар)",
  },
];

export function RoomPlanner() {
  const {
    current,
    designs,
    createNew,
    loadDesign,
    saveCurrent,
    deleteDesign,
    duplicateDesign,
    updatePieces,
    updateRoom,
    past, future, undo, redo, beginEdit, endEdit,
  } = useDesigns();
  const catalog = useCatalog();
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<"plan" | "perspective">("perspective");
  const [snapEnabled, setSnapEnabled] = useState(true);
  const [locked, setLocked] = useState(false);
  const [paletteCat, setPaletteCat] = useState<Category>("sofa");
  const [showCompare, setShowCompare] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [saveName, setSaveName] = useState("");
  const [leftOpen, setLeftOpen] = useState(false);
  const [rightOpen, setRightOpen] = useState(false);
  const [activePreset, setActivePreset] = useState<CustomInterior | null>(null);
  const [presetStatus, setPresetStatus] = useState<
    "idle" | "loading" | "loaded" | "error"
  >("idle");
  const [presetError, setPresetError] = useState<string | null>(null);
  const dbModels = useMemo(
    () =>
      catalog.products
        .filter((product) => product.model)
        .map((product) => getDbModel(product.id))
        .filter((model): model is DbModelInfo => !!model),
    [catalog.products],
  );
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [localUrl, setLocalUrl] = useState<string | null>(null);
  const [localScale, setLocalScale] = useState(1);
  const [query, setQuery] = useState("");
  const [gridEnabled, setGridEnabled] = useState(false);
  const [showDimensions, setShowDimensions] = useState(true);
  const [resetKey, setResetKey] = useState(0);
  const [notice, setNotice] = useState("");
  const [expanded, setExpanded] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);
  const shortcuts = useRef<Record<string, () => void>>({});
  const addToCart = useCart((s) => s.add);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);
  useEffect(() => {
    if (selected && !current?.pieces.some(piece => piece.instanceId === selected)) setSelected(null);
  }, [current, selected]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable=true]")) return;
      const key = event.key.toLowerCase();
      const command = event.metaKey || event.ctrlKey;
      const action = command ? (key === "z" ? (event.shiftKey ? "redo" : "undo") : key === "y" ? "redo" : key === "d" ? "duplicate" : key === "s" ? "save" : "") : key;
      if (shortcuts.current[action]) { event.preventDefault(); shortcuts.current[action](); }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    if (!current) createNew("80", "Миний зочны өрөө");
  }, [current, createNew]);

  useEffect(() => {
    return () => {
      if (localUrl) URL.revokeObjectURL(localUrl);
    };
  }, [localUrl]);

  const handleLocalGlbSelect = (file: File | null) => {
    if (file && (!/\.glb$/i.test(file.name) || file.size > 100 * 1024 * 1024)) {
      setNotice("100 MB хүртэл хэмжээтэй .glb файл сонгоно уу.");
      return;
    }
    if (localUrl) URL.revokeObjectURL(localUrl);
    if (!file) {
      setLocalFile(null);
      setLocalUrl(null);
      setPresetStatus("idle");
      setPresetError(null);
      return;
    }
    setActivePreset(null);
    setLocalFile(file);
    setLocalUrl(URL.createObjectURL(file));
    setPresetStatus("loading");
    setPresetError(null);
  };

  const paletteItems = useMemo(
    () =>
      catalog.products.filter(
        (product) => !product.model && product.category === paletteCat && product.name.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [catalog.products, paletteCat, query],
  );
  const dbPaletteItems = useMemo(
    () => dbModels.filter((m) => m.category === paletteCat && m.name.toLowerCase().includes(query.trim().toLowerCase())),
    [dbModels, paletteCat, query],
  );
  if (catalog.loading || !catalog.ready) {
    shortcuts.current = {};
    return (
      <CatalogStatus
        loading={catalog.loading}
        error={catalog.error}
        retry={() => void catalog.refresh()}
      />
    );
  }

  if (!current) { shortcuts.current = {}; return <PlannerSkeleton />; }

  const addPiece = (productId: string) => {
    const product = getProduct(productId);
    if (!product) return;
    const piece: PlacedFurniture = {
      instanceId: `p_${Math.random().toString(36).slice(2, 10)}`,
      productId,
      x: 0,
      z: 0,
      rotation: 0,
      color: product.defaultColor,
      material: product.materials[0].id,
    };
    const room = { width: current.width, depth: current.depth };
    const placed = findFreePlacement(piece, current.pieces, room);
    if (!placed) { setNotice("Тавилга байрлуулах сул зай хүрэлцэхгүй байна. Өрөөг томруулах эсвэл байрлалаа өөрчилнө үү."); return; }
    updatePieces([...current.pieces, placed]);
    setSelected(placed.instanceId);
    setLeftOpen(false);
  };

  const addModelPiece = (model: DbModelInfo) => {
    const defaultColor = model.colors[0]?.id ?? "default";
    const defaultMaterial = (model.materials[0]?.id ?? "wood") as Material;
    const piece: PlacedFurniture = {
      instanceId: `m_${Math.random().toString(36).slice(2, 10)}`,
      productId: model.id,
      modelId: model.id,
      x: 0,
      z: 0,
      rotation: 0,
      color: defaultColor,
      material: defaultMaterial,
    };
    const room = { width: current.width, depth: current.depth };
    const placed = findFreePlacement(piece, current.pieces, room);
    if (!placed) { setNotice("Энэ загварыг байрлуулах сул зай хүрэлцэхгүй байна."); return; }
    updatePieces([...current.pieces, placed]);
    setSelected(placed.instanceId);
    setLeftOpen(false);
  };

  const onMove = (id: string, x: number, z: number) => {
    updatePieces(
      current.pieces.map((p) => (p.instanceId === id ? { ...p, x, z } : p)),
    );
  };

  const rotateSelected = () => {
    if (!selected) return;
    const piece = current.pieces.find((p) => p.instanceId === selected);
    if (!piece) return;
    const rotated: PlacedFurniture = {
      ...piece,
      rotation: (piece.rotation + Math.PI / 2) % (Math.PI * 2),
    };
    const room = { width: current.width, depth: current.depth };
    if (!isPlacementValid(rotated, current.pieces, room)) { setNotice("Эргүүлэхэд хана эсвэл бусад тавилгатай давхцаж байна."); return; }

    updatePieces(
      current.pieces.map((p) => (p.instanceId === selected ? rotated : p)),
    );
  };

  const removeSelected = () => {
    if (!selected) return;
    updatePieces(current.pieces.filter((p) => p.instanceId !== selected));
    setSelected(null);
  };

  const resizeRoom = (size: RoomSize) => {
    const dims = ROOM_DIMENSIONS[size];
    const resizedRoom = {
      width: dims.w,
      depth: dims.d,
    };
    const allPiecesValid = current.pieces.every((p) =>
      isPlacementValid(p, current.pieces, resizedRoom),
    );
    if (!allPiecesValid) { setNotice("Энэ хэмжээнд тавилга багтахгүй байна. Эхлээд байрлалыг нь өөрчилнө үү."); return; }
    updateRoom({ size, width: dims.w, depth: dims.d });
  };

  const togglePreset = (preset: CustomInterior) => {
    if (localUrl) {
      URL.revokeObjectURL(localUrl);
      setLocalUrl(null);
      setLocalFile(null);
    }
    if (activePreset?.id === preset.id) {
      setActivePreset(null);
      setPresetStatus("idle");
      setPresetError(null);
    } else {
      setActivePreset(preset);
      setPresetStatus("loading");
      setPresetError(null);
    }
  };

  const allPresets = STATIC_PRESETS;

  const getDbPieceModel = (piece: PlacedFurniture) =>
    dbModels.find((model) => model.id === (piece.modelId ?? piece.productId));

  const getPiecePrice = (piece: PlacedFurniture) => {
    const product = getProduct(piece.productId);

    if (product) {
      return priceFor(product, piece.color, piece.material);
    }

    const model = getDbPieceModel(piece);
    if (!model) return 0;

    const colorDelta =
      model.colors.find((color) => color.id === piece.color)?.priceDelta ?? 0;

    const materialDelta =
      model.materials.find((material) => material.id === piece.material)
        ?.priceDelta ?? 0;

    return model.basePrice + colorDelta + materialDelta;
  };

  const totalPrice = current.pieces.reduce(
    (sum, piece) => sum + getPiecePrice(piece),
    0,
  );

  const buyEverything = () => {
    if (!current.pieces.length) return;
    let added = 0;
    let skipped = 0;
    current.pieces.forEach(piece => {
      const product = getProduct(piece.productId);
      if (!product?.inStock || !product.colors.some(c => c.id === piece.color) || !product.materials.some(m => m.id === piece.material)) { skipped++; return; }
      const count = addToCart({ productId: product.id, name: product.name, image: product.image,
        color: piece.color, material: piece.material, unitPrice: getPiecePrice(piece), qty: 1, stockQuantity: product.stockQuantity });
      added += count;
      if (!count) skipped++;
    });
    setNotice(added ? added + " тавилгыг сагсанд нэмлээ." + (skipped ? " " + skipped + " тавилга нөөц хүрэлцэхгүй эсвэл сонголт өөрчлөгдсөн тул нэмэгдсэнгүй." : "") : "Тавилга нэмэгдсэнгүй. Нөөц болон сагсны тоо ширхэгээ шалгана уу.");
  };

  const selectedPiece = selected
    ? current.pieces.find((p) => p.instanceId === selected)
    : null;
  const selectedProduct = selectedPiece
    ? getProduct(selectedPiece.productId)
    : null;

  const selectedDbModel = selectedPiece
    ? dbModels.find(
        (model) =>
          model.id === (selectedPiece.modelId ?? selectedPiece.productId),
      )
    : null;

  const selectedDetails = selectedProduct ?? selectedDbModel;

  const transformSelected = (patch: Partial<Pick<PlacedFurniture, "x" | "z" | "rotation">>) => {
    if (!selectedPiece) return;
    const candidate = { ...selectedPiece, ...patch };
    if (!isPlacementValid(candidate, current.pieces, current)) { setNotice("Энэ байрлалд хана эсвэл өөр тавилга байна."); return; }
    updatePieces(current.pieces.map(piece => piece.instanceId === candidate.instanceId ? candidate : piece));
  };
  const duplicateSelected = () => {
    if (!selectedPiece) return;
    const copy = findFreePlacement({ ...selectedPiece, instanceId: `p_${crypto.randomUUID()}` }, current.pieces, current);
    if (!copy) { setNotice("Хуулбар байрлуулах зай хүрэлцэхгүй байна."); return; }
    updatePieces([...current.pieces, copy]);
    setSelected(copy.instanceId);
  };
  const save = () => { endEdit(); saveCurrent(saveName.trim() || current.name.trim() || "Миний өрөө"); setSaveName(""); setNotice("Загварыг энэ төхөөрөмж дээр хадгаллаа."); };
  const nudge = (x: number, z: number) => {
    if (selectedPiece) transformSelected({ x: Math.round((selectedPiece.x + x) * 100) / 100, z: Math.round((selectedPiece.z + z) * 100) / 100 });
  };
  shortcuts.current = { undo, redo, duplicate: duplicateSelected, save, r: rotateSelected, delete: removeSelected, backspace: removeSelected,
    arrowup: () => nudge(0, -0.1), arrowdown: () => nudge(0, 0.1), arrowleft: () => nudge(-0.1, 0), arrowright: () => nudge(0.1, 0),
    escape: () => { setSelected(null); setLeftOpen(false); setRightOpen(false); setExpanded(false); setShowCompare(false); },
  };
  const exportImage = () => {
    const canvas = workspaceRef.current?.querySelector("canvas");
    if (!canvas) { setNotice("3D дүрслэл ачаалсны дараа дахин оролдоно уу."); return; }
    try {
      const link = document.createElement("a");
      link.download = `${current.name.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80) || "room"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setNotice("Өрөөний зургийг PNG хэлбэрээр татлаа.");
    } catch { setNotice("Зураг татаж чадсангүй. Загвар бүрэн ачаалсны дараа дахин оролдоно уу."); }
  };

  return (
    <div ref={workspaceRef} className={cn("room-planner-layout planner-workspace relative overflow-hidden xl:grid", expanded && "planner-expanded")}>
      {notice && <div className="planner-notice" role="status"><Check size={17} /><span>{notice}</span><button aria-label="Мэдэгдэл хаах" onClick={() => setNotice("")}><X size={16} /></button></div>}
      {/* MOBILE TOOLBAR */}
      <div className="planner-mobile-toolbar absolute left-0 right-0 top-0 z-30 flex items-center justify-between border-b border-[#293C32]/10 bg-[#FAF9F6]/95 px-3 py-2 backdrop-blur xl:hidden">
        <button
          onClick={() => setLeftOpen(true)}
          className="flex items-center gap-2 rounded-full bg-[#293C32] px-3 py-1.5 text-xs text-[#FFFFFF]"
        >
          <Menu className="h-3.5 w-3.5" /> Тавилга
        </button>
        <p className="truncate  text-sm">{current.name}</p>
        <button
          onClick={() => setRightOpen(true)}
          className="flex items-center gap-2 rounded-full border border-[#293C32]/15 px-3 py-1.5 text-xs"
        >
          <Settings className="h-3.5 w-3.5" /> Тохиргоо
        </button>
      </div>

      {/* LEFT: catalog palette */}
      <Drawer
        side="left"
        open={leftOpen}
        onClose={() => setLeftOpen(false)}
        title="Тавилгын каталог"
      >
        <div className="border-b border-[#293C32]/10 p-4">
          <div className="planner-panel-heading"><span>Тавилгын сан</span><small>Сонгоод өрөөндөө нэмээрэй</small></div>
          <label className="planner-search"><Search size={17} /><input aria-label="Тавилга нэрээр хайх" placeholder="Тавилга хайх…" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <div className="flex flex-wrap gap-1">
            {CATEGORIES.map((c) => (
              <button
                key={c.id}
                onClick={() => setPaletteCat(c.id)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs transition",
                  paletteCat === c.id
                    ? "bg-[#293C32] text-white"
                    : "bg-white text-[#293C32] hover:bg-[#293C32]/10",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          <div className="grid gap-3">
            {!paletteItems.length && !dbPaletteItems.length && <p className="planner-empty">Энэ ангилалд тохирох тавилга олдсонгүй.</p>}
            {paletteItems.map((p) => (
              <button
                key={p.id}
                onClick={() => addPiece(p.id)}
                className="group flex gap-3 rounded-lg border border-[#293C32]/10 bg-white p-2 text-left transition hover:border-[#293C32]/30"
              >
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-[#EEEEE7]">
                  <Image
                    src={p.image}
                    alt={p.name}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{p.name}</p>
                  <p className="mt-0.5 font-mono text-xs text-[#6C726B]">
                    {formatPrice(p.basePrice)}
                    <span className="mt-1 block text-xs">{stockLabel(p)}</span>
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-[#737D6C]/70">
                    {p.dimensions.w} × {p.dimensions.d} м
                  </p>
                </div>
                <div className="grid h-7 w-7 self-center place-items-center rounded-full bg-[#293C32]/5 text-[#293C32] group-hover:bg-[#AD6547] group-hover:text-[#FFFFFF]">
                  <Plus className="h-3.5 w-3.5" />
                </div>
              </button>
            ))}
            {dbPaletteItems.map((m) => (
              <button
                key={m.id}
                onClick={() => addModelPiece(m)}
                className="group flex gap-3 rounded-lg border border-[#AD6547]/30 bg-white p-2 text-left transition hover:border-[#AD6547]/60"
              >
                <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-[#EEEEE7]">
                  {m.thumbnailFile ? (
                    <Image
                      src={`/api/models/files/${m.fileModelId ?? m.id}/${m.thumbnailFile}`}
                      alt={m.name}
                      width={64}
                      height={64}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center">
                      <Sparkles className="h-6 w-6 text-[#AD6547]/40" />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-medium">{m.name}</p>
                    <span className="flex-shrink-0 rounded-full bg-[#AD6547]/10 px-1.5 py-0.5 text-[10px] text-[#AD6547]">
                      3D
                    </span>
                  </div>
                  <p className="mt-0.5 font-mono text-xs text-[#6C726B]">
                    {m.basePrice > 0
                      ? formatPrice(m.basePrice)
                      : "Үнэ тогтоогдоогүй"}
                  </p>
                  <p className="mt-0.5 font-mono text-xs text-[#737D6C]/70">
                    {m.dimensionsW} × {m.dimensionsD} м
                    <span className="mt-1 block text-xs">{stockLabel(m)}</span>
                  </p>
                </div>
                <div className="grid h-7 w-7 self-center place-items-center rounded-full bg-[#293C32]/5 text-[#293C32] group-hover:bg-[#AD6547] group-hover:text-[#FFFFFF]">
                  <Plus className="h-3.5 w-3.5" />
                </div>
              </button>
            ))}
          </div>
        </div>
      </Drawer>

      {/* CENTER: canvas */}
      <div className="relative h-full">
        <div className="planner-view-toolbar">
          <div className="planner-segment" aria-label="Харах горим">
            <button aria-pressed={view === "plan"} onClick={() => setView("plan")}><LayoutGrid size={16} /> 2D</button>
            <button aria-pressed={view === "perspective"} onClick={() => setView("perspective")}><Eye size={16} /> 3D</button>
          </div>
          <div className="planner-tool-group">
            <button title="Буцаах (Ctrl+Z)" aria-label="Буцаах" disabled={!past.length} onClick={undo}><Undo2 size={18} /></button>
            <button title="Дахин хийх (Ctrl+Shift+Z)" aria-label="Дахин хийх" disabled={!future.length} onClick={redo}><Redo2 size={18} /></button>
          </div>
          <div className="planner-tool-group">
            <button title="25 см тор ба торонд тааруулах" aria-label="Торонд тааруулах" aria-pressed={gridEnabled} onClick={() => setGridEnabled(v => !v)}><LayoutGrid size={18} /></button>
            <button title="Хананд наалдуулах" aria-label="Хананд наалдуулах" aria-pressed={snapEnabled} onClick={() => setSnapEnabled(v => !v)}><Magnet size={18} /></button>
            <button title="Хэмжээсийн шугам" aria-label="Хэмжээс харуулах" aria-pressed={showDimensions} onClick={() => setShowDimensions(v => !v)}><Ruler size={18} /></button>
          </div>
          <div className="planner-tool-group">
            <button title="Камерын хөдөлгөөн түгжих" aria-label="Камер түгжих" aria-pressed={locked} onClick={() => setLocked(v => !v)}>{locked ? <Lock size={18} /> : <Unlock size={18} />}</button>
            <button title="Камерыг эхний байрлалд" aria-label="Камер дахин төвлөрүүлэх" onClick={() => setResetKey(v => v + 1)}><Scan size={18} /></button>
            <button title="Томруулах / буцаах" aria-label="Ажлын талбай томруулах" aria-pressed={expanded} onClick={() => setExpanded(v => !v)}><Maximize size={18} /></button>
          </div>
          <div className="planner-tool-group">
            <button title="PNG зураг татах" aria-label="Зураг татах" onClick={exportImage}><Download size={18} /></button>
            <button title="Хадгалах (Ctrl+S)" aria-label="Загвар хадгалах" onClick={save}><Save size={18} /></button>
          </div>
        </div>
        <div className="planner-room-caption"><strong>{current.width} × {current.depth} м</strong><span>{(current.width * current.depth).toFixed(1)} м² · {current.pieces.length} тавилга</span></div>

        {/* preset loading status */}
        {(activePreset || localFile) && (
          <div className="absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-full border border-[#293C32]/10 bg-white/95 px-4 py-2 text-xs shadow-sm backdrop-blur md:top-16">
            {presetStatus === "loading" && "Загвар ачаалж байна…"}
            {presetStatus === "loaded" && "✓ Загвар амжилттай ачааллаа"}
            {presetStatus === "error" && (
              <span className="text-red-600">
                ⚠ Алдаа: {presetError ?? "загвар олдсонгүй"}
              </span>
            )}
          </div>
        )}

        {/* right-side selection actions */}
        <div className="planner-selection-toolbar">
          {selected && (
            <>
              <button onClick={() => setRightOpen(true)} title="Сонгосон тавилгын тохиргоо" className="planner-selection-name"><Settings size={16} /><span>{selectedDetails?.name ?? "Тавилга"}</span></button>
              <button onClick={duplicateSelected} aria-label="Сонгосон тавилгыг хуулах" title="Хуулах (Ctrl+D)"><Copy size={16} /></button>
              <button
                onClick={rotateSelected}
                className="flex items-center gap-1.5 rounded-full bg-[#293C32] px-3 py-2 text-xs font-medium text-[#FFFFFF]"
              >
                <RotateCw className="h-3 w-3" /> 90°
              </button>
              <button
                onClick={removeSelected}
                className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-50 px-3 py-2 text-xs font-medium text-red-700"
              >
                <Trash2 className="h-3 w-3" /> Устгах
              </button>
            </>
          )}
        </div>

        {/* bottom info bar */}
        <div className="planner-budget-bar">
          <span className="whitespace-nowrap text-[#6C726B]">
            {current.pieces.length} тавилга ·{" "}
            <strong className="font-mono text-[#293C32]">
              {formatPrice(totalPrice)}
            </strong>
          </span>
          <span className="h-4 w-px bg-[#293C32]/10" />
          <button
            onClick={buyEverything}
            disabled={!current.pieces.length}
            className="flex flex-shrink-0 items-center gap-1.5 text-[#AD6547] font-medium hover:underline"
          >
            <ShoppingBag className="h-3.5 w-3.5" /> Бүгдийг сагсанд
          </button>
        </div>

        {!current.pieces.length && !activePreset && !localFile && <div className="planner-start-hint"><Move size={20} /><strong>Өрөөгөө тохижуулж эхлээрэй</strong><span>Тавилга нэмээд чирж байрлуулна. Хэмжээсээ тохиргооноос өөрчилнө.</span><button onClick={() => setLeftOpen(true)}>Тавилга сонгох <Plus size={15} /></button></div>}

        <div className="planner-canvas h-full w-full pt-10 xl:pt-0">
          <RoomCanvas
            design={current}
            selected={selected}
            onSelect={setSelected}
            onMove={onMove}
            view={view}
            snapEnabled={snapEnabled}
            locked={locked}
            gridEnabled={gridEnabled}
            showDimensions={showDimensions}
            resetKey={resetKey}
            onEditStart={beginEdit}
            onEditEnd={endEdit}
            customInterior={
              localUrl
                ? {
                    basePath: "",
                    glb: localUrl,
                    scale: localScale,
                    onLoaded: () => setPresetStatus("loaded"),
                    onError: (msg) => {
                      setPresetStatus("error");
                      setPresetError(msg);
                    },
                  }
                : activePreset
                  ? {
                      basePath: activePreset.basePath,
                      glb: activePreset.glb,
                      scale: activePreset.scale,
                      onLoaded: () => setPresetStatus("loaded"),
                      onError: (msg) => {
                        setPresetStatus("error");
                        setPresetError(msg);
                      },
                    }
                  : null
            }
          />
        </div>
      </div>

      {/* RIGHT: properties + saved designs */}
      <Drawer
        side="right"
        open={rightOpen}
        onClose={() => setRightOpen(false)}
        title="Тохиргоо"
      >
        <div className="border-b border-[#293C32]/10 p-4">
          <p className="label mb-2">Загвар</p>
          <input
            aria-label="Загварын нэр"
            value={current.name}
            onFocus={beginEdit}
            onBlur={endEdit}
            onChange={(e) => updateRoom({ name: e.target.value })}
            className="input !py-2"
          />
          <div className="mt-3 flex items-center gap-2">
            <input
              aria-label="Хадгалах загварын нэр"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Дараах нэрээр хадгалах…"
              className="input !py-2"
            />
            <button
              onClick={save}
              aria-label="Загвар хадгалах"
              className="btn-primary !py-2.5 !px-4"
            >
              <Save className="h-3.5 w-3.5" />
            </button>
          </div>
          <p className="planner-storage-note">Ажлын явц энэ төхөөрөмж дээр автоматаар үлдэнэ. Хадгалсан хувилбараа доороос нээнэ.</p>
        </div>

        <div className="border-b border-[#293C32]/10 p-4">
          <p className="label mb-3">Өрөөний бодит хэмжээ</p>
          <RoomSizeEditor key={`${current.width}-${current.depth}`} width={current.width} depth={current.depth} onApply={(width, depth) => {
            if (!current.pieces.every(piece => isPlacementValid(piece, current.pieces, { width, depth }))) { setNotice("Шинэ хэмжээнд зарим тавилга багтахгүй байна. Байрлалыг нь өөрчилнө үү."); return; }
            updateRoom({ width, depth });
            setNotice("Өрөөний хэмжээг шинэчиллээ.");
          }} />
          <p className="label mb-3 mt-5">Хана</p>
          <div className="flex flex-wrap gap-1.5">
            {WALL_COLORS.map((c) => (
              <button
                key={c}
                aria-label={`Ханын өнгө ${c}`}
                aria-pressed={current.wallColor === c}
                onClick={() => updateRoom({ wallColor: c })}
                style={{ background: c }}
                className={cn(
                  "h-7 w-7 rounded-full border-2",
                  current.wallColor === c ? "border-[#293C32]" : "border-white",
                )}
              />
            ))}
          </div>
          <p className="label mb-3 mt-4">Шал</p>
          <div className="flex flex-wrap gap-1.5">
            {FLOOR_COLORS.map((c) => (
              <button
                key={c}
                aria-label={`Шалны өнгө ${c}`}
                aria-pressed={current.floorColor === c}
                onClick={() => updateRoom({ floorColor: c })}
                style={{ background: c }}
                className={cn(
                  "h-7 w-7 rounded-full border-2",
                  current.floorColor === c
                    ? "border-[#293C32]"
                    : "border-white",
                )}
              />
            ))}
          </div>
        </div>

        {selectedPiece && selectedDetails ? (
          <div className="border-b border-[#293C32]/10 p-4">
            <p className="label mb-3">Сонгосон</p>

            <div className="flex gap-3">
              {selectedProduct ? (
                <Image
                  src={selectedProduct.image}
                  alt={selectedProduct.name}
                  width={56}
                  height={56}
                  className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                />
              ) : selectedDbModel?.thumbnailFile ? (
                  <Image
                  src={`/api/models/files/${selectedDbModel.fileModelId ?? selectedDbModel.id}/${selectedDbModel.thumbnailFile}`}
                  alt={selectedDbModel.name}
                  width={56}
                  height={56}
                  unoptimized
                  className="h-14 w-14 flex-shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-lg bg-[#EEEEE7]">
                  <Sparkles className="h-5 w-5 text-[#AD6547]/50" />
                </div>
              )}

              <div>
                <p className="text-sm font-medium">{selectedDetails.name}</p>
                <p className="mt-1 text-xs">{stockLabel(selectedProduct ?? selectedDbModel ?? {})}</p>
                <p className="font-mono text-xs text-[#6C726B]">
                  {selectedDetails.basePrice > 0
                    ? formatPrice(getPiecePrice(selectedPiece))
                    : "Үнэ тогтоогдоогүй"}
                </p>
              </div>
            </div>
            <div className="planner-transform">
              <p className="label">Байрлал · өрөөний төвөөс</p>
              <div className="planner-fields">
                <NumberControl label="X · метр" value={selectedPiece.x} min={-current.width / 2} max={current.width / 2} step={0.1} onCommit={x => transformSelected({ x })} />
                <NumberControl label="Z · метр" value={selectedPiece.z} min={-current.depth / 2} max={current.depth / 2} step={0.1} onCommit={z => transformSelected({ z })} />
              </div>
              <NumberControl label="Эргэлт · градус" value={Math.round(selectedPiece.rotation * 180 / Math.PI * 100) / 100} min={0} max={360} step={15} onCommit={degrees => transformSelected({ rotation: degrees % 360 * Math.PI / 180 })} />
              <div className="planner-nudge" aria-label="10 см шилжүүлэх">
                <button aria-label="Зүүн тийш 10 см" onClick={() => nudge(-0.1, 0)}><ArrowLeft size={17} /></button>
                <button aria-label="Хойш 10 см" onClick={() => nudge(0, -0.1)}><ArrowUp size={17} /></button>
                <span>10 см</span>
                <button aria-label="Урагш 10 см" onClick={() => nudge(0, 0.1)}><ArrowDown size={17} /></button>
                <button aria-label="Баруун тийш 10 см" onClick={() => nudge(0.1, 0)}><ArrowRight size={17} /></button>
              </div>
              <div className="planner-fields"><button className="btn-ghost !px-2 !py-2" onClick={duplicateSelected}><Copy size={15} /> Хуулах</button><button className="btn-ghost !px-2 !py-2 text-red-700" onClick={removeSelected}><Trash2 size={15} /> Устгах</button></div>
            </div>
            <p className="label mb-2 mt-4">Өнгө</p>

            <div className="flex flex-wrap gap-1.5">
              {selectedDetails.colors.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  aria-label={color.name}
                  aria-pressed={selectedPiece.color === color.id}
                  onClick={() =>
                    updatePieces(
                      current.pieces.map((piece) =>
                        piece.instanceId === selectedPiece.instanceId
                          ? { ...piece, color: color.id }
                          : piece,
                      ),
                    )
                  }
                  style={{ background: color.hex }}
                  className={cn(
                    "h-7 w-7 rounded-full border-2",
                    selectedPiece.color === color.id
                      ? "border-[#293C32]"
                      : "border-white",
                  )}
                  title={color.name}
                />
              ))}
            </div>
            <p className="label mb-2 mt-4">Материал</p>

            <div className="flex flex-wrap gap-2">
              {selectedDetails.materials.map((material) => (
                <button
                  key={material.id}
                  type="button"
                  onClick={() =>
                    updatePieces(
                      current.pieces.map((piece) =>
                        piece.instanceId === selectedPiece.instanceId
                          ? { ...piece, material: material.id }
                          : piece,
                      ),
                    )
                  }
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-xs transition",
                    selectedPiece.material === material.id
                      ? "border-[#293C32] bg-[#293C32] text-white"
                      : "border-[#293C32]/15 bg-white text-[#6C726B] hover:border-[#293C32]/40",
                  )}
                >
                  {material.name}
                  {material.priceDelta > 0 &&
                    ` (+${formatPrice(material.priceDelta)})`}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="border-b border-[#293C32]/10 p-4 text-xs text-[#737D6C]">
            Тавилга дээр дарж тохиргоог нь өөрчилнө үү.
          </div>
        )}

        <section className="planner-object-list">
          <p className="label"><Layers size={15} /> Өрөөн дэх тавилга · {current.pieces.length}</p>
          {!current.pieces.length && <p className="planner-empty">Одоогоор тавилга нэмээгүй байна.</p>}
          {current.pieces.map((piece, index) => <button key={piece.instanceId} aria-pressed={selected === piece.instanceId} onClick={() => { setSelected(piece.instanceId); setRightOpen(true); }}><span className="planner-object-number">{index + 1}</span><span><strong>{getProduct(piece.productId)?.name ?? getDbPieceModel(piece)?.name ?? "Тавилга"}</strong><small>{formatPrice(getPiecePrice(piece))}</small></span><Move size={14} /></button>)}
        </section>
        <details className="planner-advanced"><summary>Нэмэлт · 3D файл оруулах</summary><div className="planner-advanced-fields">
          <select
            value={ROOM_DIMENSIONS[current.size].w === current.width && ROOM_DIMENSIONS[current.size].d === current.depth ? current.size : "custom"}
            onChange={(e) => resizeRoom(e.target.value as RoomSize)}
            className="rounded-full border border-[#293C32]/10 bg-white/90 px-3 py-2 text-xs font-medium backdrop-blur"
          >
            <option value="custom" disabled>Өөрийн хэмжээ · {current.width} × {current.depth} м</option>
            {ROOM_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>
          {allPresets.map((preset) => (
            <button
              key={preset.id}
              onClick={() => togglePreset(preset)}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium backdrop-blur transition",
                activePreset?.id === preset.id
                  ? "border-[#AD6547] bg-[#AD6547] text-[#FFFFFF]"
                  : "border-[#293C32]/10 bg-white/90 text-[#6C726B]",
              )}
              title="GLB загварыг ачаалах"
            >
              <Sparkles className="h-3 w-3" />
              {activePreset?.id === preset.id ? "Идэвхтэй" : preset.label}
            </button>
          ))}
          <label
            className={cn(
              "flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-medium backdrop-blur transition",
              localFile
                ? "border-[#AD6547] bg-[#AD6547] text-[#FFFFFF]"
                : "border-[#293C32]/10 bg-white/90 text-[#6C726B]",
            )}
            title="Компьютероосоо GLB файл сонгож турших"
          >
            <Upload className="h-3 w-3" />
            <span className="max-w-[110px] truncate">
              {localFile ? localFile.name : "Локал GLB турших"}
            </span>
            <input
              type="file"
              accept=".glb,model/gltf-binary"
              className="hidden"
              onChange={(e) =>
                handleLocalGlbSelect(e.target.files?.[0] ?? null)
              }
            />
          </label>
          {localFile && (
            <>
              <input
                type="number"
                step="0.01"
                min="0.001"
                value={localScale}
                onChange={(e) =>
                  setLocalScale(Math.min(1000, Math.max(0.001, parseFloat(e.target.value) || 0.001)))
                }
                title="Масштаб (scale)"
                className="w-16 rounded-full border border-[#293C32]/10 bg-white/90 px-2 py-2 text-center text-xs font-mono backdrop-blur"
              />
              <button
                onClick={() => handleLocalGlbSelect(null)}
                title="Локал файлыг цуцлах"
                className="flex items-center gap-1 rounded-full border border-red-500/30 bg-red-50 px-2 py-2 text-xs font-medium text-red-700"
              >
                <X className="h-3 w-3" />
              </button>
            </>
          )}
        </div><p>Оруулсан GLB файл зөвхөн энэ удаагийн харагдацад ашиглагдана.</p></details>
        <details className="planner-advanced"><summary>Гарын товчлол</summary><p>Ctrl / ⌘ + Z — буцаах<br />Ctrl / ⌘ + Shift + Z — дахин хийх<br />Ctrl / ⌘ + D — тавилга хуулах<br />Ctrl / ⌘ + S — хадгалах<br />Сумнууд — 10 см шилжүүлэх<br />R — 90° эргүүлэх · Delete — устгах<br />Esc — сонголт цуцлах</p></details>
        <div className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <p className="label">Хадгалсан загвар · {designs.length}</p>
            {designs.length >= 2 && (
              <button
                onClick={() => setShowCompare(true)}
                disabled={designs.filter(design => compareIds.includes(design.id)).length < 2}
                title="Доороос 2–4 загвар сонгож харьцуулна"
                className="text-xs font-medium text-[#AD6547] hover:underline"
              >
                <Layers className="mr-1 inline h-3 w-3" /> Харьцуулах
              </button>
            )}
          </div>
          {designs.length === 0 && (
            <p className="rounded-lg bg-[#293C32]/5 p-4 text-xs text-[#6C726B]">
              Анхны загвараа хадгалснаар хэд хэдэн байрлалыг харьцуулах
              боломжтой.
            </p>
          )}
          <div className="space-y-2">
            {designs.map((d) => (
              <div
                key={d.id}
                className={cn(
                  "rounded-lg border bg-white p-3",
                  current.id === d.id
                    ? "border-[#AD6547]"
                    : "border-[#293C32]/10 hover:border-[#293C32]/20",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{d.name}</p>
                    <p className="text-xs text-[#6C726B]">
                      {d.width} × {d.depth} м ·{" "}
                      {d.pieces.length} тавилга
                    </p>
                  </div>
                  <div className="flex flex-shrink-0 gap-1">
                    <button
                      onClick={() => loadDesign(d.id)}
                      className="rounded-md p-1.5 hover:bg-[#293C32]/5"
                      title="Нээх"
                    >
                      <Maximize className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => duplicateDesign(d.id)}
                      className="rounded-md p-1.5 hover:bg-[#293C32]/5"
                      title="Хуулах"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteDesign(d.id)}
                      className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                      title="Устгах"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <input
                    type="checkbox"
                    aria-label={`${d.name} загварыг харьцуулах`}
                    checked={compareIds.includes(d.id)}
                    onChange={(e) =>
                      setCompareIds(
                        e.target.checked
                          ? [...compareIds, d.id].slice(-4)
                          : compareIds.filter((id) => id !== d.id),
                      )
                    }
                    className="accent-[#AD6547]"
                  />
                  <span className="text-xs text-[#6C726B]">
                    Харьцуулахаар сонгох
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[#293C32]/10 p-4">
          <button
            onClick={() => createNew("80", "Шинэ загвар")}
            className="btn-ghost w-full"
          >
            <Plus className="h-4 w-4" /> Шинэ загвар үүсгэх
          </button>
        </div>
      </Drawer>

      {showCompare && (
        <CompareModal
          designs={designs.filter((d) => compareIds.includes(d.id))}
          onClose={() => setShowCompare(false)}
          onLoad={(id) => {
            loadDesign(id);
            setShowCompare(false);
          }}
        />
      )}
    </div>
  );
}

/** Sidebar that's a static column on desktop, slide-over drawer on mobile. */
function Drawer({
  side,
  open,
  onClose,
  title,
  children,
}: {
  side: "left" | "right";
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!open || window.matchMedia("(min-width: 1280px)").matches) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const elements = () => Array.from(drawerRef.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input, select, summary, [tabindex="0"]') ?? []).filter(element => element.getClientRects().length);
    elements()[0]?.focus();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.stopPropagation(); closeRef.current(); }
      if (event.key !== "Tab") return;
      const items = elements();
      const first = items[0]; const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    const drawer = drawerRef.current;
    drawer?.addEventListener("keydown", handleKey);
    return () => { document.body.style.overflow = previousOverflow; drawer?.removeEventListener("keydown", handleKey); if (previous?.isConnected) previous.focus(); };
  }, [open]);
  return (
    <>
      {/* mobile backdrop */}
      {open && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-[60] bg-[#293C32]/40 xl:hidden"
        />
      )}
      <aside
        ref={drawerRef}
        aria-label={title}
        className={cn(
          "planner-drawer fixed inset-y-0 z-[70] flex w-[88vw] max-w-[340px] flex-col bg-[#FAF9F6] shadow-2xl transition-transform duration-300 xl:relative xl:z-auto xl:w-auto xl:max-w-none xl:translate-x-0 xl:shadow-none",
          side === "left"
            ? "left-0 border-r border-[#293C32]/10 xl:flex"
            : "right-0 border-l border-[#293C32]/10 xl:flex",
          !open && "planner-drawer-closed",
          !open && side === "left" && "-translate-x-full xl:translate-x-0",
          !open && side === "right" && "translate-x-full xl:translate-x-0",
        )}
      >
        <div className="flex items-center justify-between border-b border-[#293C32]/10 p-4 xl:hidden">
          <p className="text-lg text-[#293C32]">{title}</p>
          <button
            onClick={onClose}
            aria-label="Самбар хаах"
            className="grid h-9 w-9 place-items-center rounded-full hover:bg-[#293C32]/5"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="planner-drawer-body flex flex-1 flex-col">{children}</div>
      </aside>
    </>
  );
}

function CompareModal({
  designs,
  onClose,
  onLoad,
}: {
  designs: RoomDesign[];
  onClose: () => void;
  onLoad: (id: string) => void;
}) {
  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[80] grid place-items-center bg-[#293C32]/60 p-6"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-lg bg-[#FAF9F6] p-8"
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl text-[#293C32]">Загваруудыг харьцуулах</h2>
          <button onClick={onClose} className="btn-ghost !py-2">
            Хаах
          </button>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-2">
          {designs.map((d) => {
            const total = d.pieces.reduce((sum, piece) => {
              const product = getProduct(piece.productId);
              if (product) {
                return sum + priceFor(product, piece.color, piece.material);
              }
              const model = getDbModel(piece.modelId ?? piece.productId);
              if (!model) return sum;

              const colorDelta =
                model.colors.find((color) => color.id === piece.color)
                  ?.priceDelta ?? 0;

              const materialDelta =
                model.materials.find(
                  (material) => material.id === piece.material,
                )?.priceDelta ?? 0;
              return sum + model.basePrice + colorDelta + materialDelta;
            }, 0);
            return (
              <div key={d.id} className="card overflow-hidden">
                <div className="aspect-video bg-[#EEEEE7]">
                  <MiniTopDown design={d} />
                </div>
                <div className="p-5">
                  <p className="text-lg text-[#293C32]">{d.name}</p>
                  <p className="text-xs text-[#6C726B]">
                    {d.width} × {d.depth} м · {(d.width * d.depth).toFixed(1)} м²
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="label">Тавилга</p>
                      <p className="font-mono font-medium text-[#293C32]">
                        {d.pieces.length}
                      </p>
                    </div>
                    <div>
                      <p className="label">Нийт үнэ</p>
                      <p className="font-mono font-medium text-[#293C32]">
                        {formatPrice(total)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => onLoad(d.id)}
                    className="btn-primary mt-4 w-full !py-2.5"
                  >
                    Энэ загварыг нээх
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MiniTopDown({ design }: { design: RoomDesign }) {
  const scale = 32;
  const w = design.width * scale;
  const h = design.depth * scale;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="h-full w-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <rect x={0} y={0} width={w} height={h} fill={design.floorColor} />
      <rect
        x={0}
        y={0}
        width={w}
        height={h}
        fill="none"
        stroke={design.wallColor}
        strokeWidth={6}
      />
      {design.pieces.map((p) => {
        const product = getProduct(p.productId);
        const dbModel = getDbModel(p.modelId ?? p.productId);

        if (!product && !dbModel) return null;

        const dimensions = product
          ? product.dimensions
          : {
              w: dbModel!.dimensionsW,
              d: dbModel!.dimensionsD,
              h: dbModel!.dimensionsH,
            };
        const colors = product ? product.colors : dbModel!.colors;

        const px = (p.x + design.width / 2) * scale;
        const py = (p.z + design.depth / 2) * scale;
        const pw = dimensions.w * scale;
        const pd = dimensions.d * scale;
        const col = colors.find((color) => color.id === p.color)?.hex ?? "#888";
        const rotDeg = (-p.rotation * 180) / Math.PI;
        return (
          <g
            key={p.instanceId}
            transform={`translate(${px} ${py}) rotate(${rotDeg})`}
          >
            <rect
              x={-pw / 2}
              y={-pd / 2}
              width={pw}
              height={pd}
              fill={col}
              stroke="#1A1814"
              strokeWidth={1}
              opacity={0.85}
            />
          </g>
        );
      })}
    </svg>
  );
}

function NumberControl({ label, value, min, max, step, onCommit }: { label: string; value: number; min: number; max: number; step: number; onCommit: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  const cancelled = useRef(false);
  useEffect(() => setDraft(String(value)), [value]);
  return <label className="planner-number"><span>{label}</span><input type="number" min={min} max={max} step="any" value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => {
    if (event.key === "Enter") event.currentTarget.blur();
    if (event.key === "Escape") { cancelled.current = true; setDraft(String(value)); event.currentTarget.blur(); }
    if (event.key === "ArrowUp" || event.key === "ArrowDown") { event.preventDefault(); setDraft(String(Math.max(min, Math.min(max, Math.round((Number(draft) + (event.key === "ArrowUp" ? step : -step)) * 100) / 100)))); }
  }} onBlur={() => { const next = Number(draft); if (!cancelled.current && draft.trim() && Number.isFinite(next) && next >= min && next <= max) onCommit(next); cancelled.current = false; setDraft(String(value)); }} /></label>;
}

function RoomSizeEditor({ width, depth, onApply }: { width: number; depth: number; onApply: (width: number, depth: number) => void }) {
  return <form className="planner-room-form" onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const nextWidth = Number(data.get("width")); const nextDepth = Number(data.get("depth"));
    if ([nextWidth, nextDepth].every(value => Number.isFinite(value) && value >= 2 && value <= 20)) onApply(nextWidth, nextDepth);
  }}><div className="planner-fields"><label className="planner-number"><span>Өргөн · м</span><input name="width" type="number" min="2" max="20" step="0.1" defaultValue={width} required /></label><label className="planner-number"><span>Гүн · м</span><input name="depth" type="number" min="2" max="20" step="0.1" defaultValue={depth} required /></label></div><button type="submit" className="btn-ghost !py-2 w-full"><Ruler size={15} /> Хэмжээг хэрэглэх</button><small>Тал бүр 2–20 метр. Тавилга багтах эсэхийг шалгана.</small></form>;
}

function PlannerSkeleton() {
  return (
    <div className="grid h-full w-full place-items-center bg-[#EEEEE7]">
      <div className="text-sm text-[#6C726B]">
        Өрөөний төлөвлөгчийг ачаалж байна…
      </div>
    </div>
  );
}

