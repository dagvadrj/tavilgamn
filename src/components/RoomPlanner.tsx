"use client";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PlannerViewport } from "@/features/planner/components/PlannerViewport";
import { RoomPlannerSignIn } from "@/features/room-planner/components/RoomPlannerSignIn";
import { trackProduct3d } from "@/lib/productEngagement";
import {
  duplicateFurniturePlacement,
  moveAttachedFurniture,
  resolveFurnitureAttachments,
} from "@/lib/furnitureAttachment";
import type { RoomPlacementHintSource } from "@/three/RoomPlacementHints";
import { FurnitureAttachmentControls } from "@/features/room-planner/components/FurnitureAttachmentControls";
import { RoomProductAlternatives } from "@/features/room-planner/components/RoomProductAlternatives";
import {
  createRoomBuilderDraft,
  resizeRoomBuilder,
} from "@/lib/roomBuilderDraft";
import { furnishRoom, suggestedFurniture } from "@/lib/roomFurnishing";
import "./room-planner-enhancements.css";
import "@/features/planner/components/planner-catalog-upgrades.css";
import {
  RoomSurfacePopover,
  type SurfaceSelection,
} from "./RoomSurfacePopover";
import { RoomMeasureInput } from "@/features/room-planner/components/RoomMeasureInput";
import {
  RoomMeasureUnit,
  useRoomMeasureUnit,
} from "@/features/room-planner/components/RoomMeasureUnit";
import { OpeningQuickEditor } from "@/features/room-planner/components/OpeningQuickEditor";
import { RoomWallPlan } from "./RoomWallPlan";
import { configureAddedRoom } from "@/lib/addRoomOptions";
import { newDesignRoom } from "@/lib/roomDesign";
import dynamic from "next/dynamic";
import {
  useRoomPlannerUi,
  type CustomInterior,
} from "@/features/room-planner/hooks/useRoomPlannerUi";
import {
  Drawer,
  CompareModal,
  NumberControl,
  PlannerSkeleton,
} from "@/features/room-planner/components/PlannerPanels";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RoomPlannerStart } from "@/features/room-planner/components/RoomPlannerStart";
import {
  PlannerCatalogToolbar,
  sortPlannerCatalog,
  type PlannerCatalogSort,
} from "@/features/planner/components/PlannerCatalogToolbar";
import { RoomCatalogFilters } from "@/features/room-planner/components/RoomCatalogFilters";
import { RoomPlacementHelp } from "@/features/room-planner/components/RoomPlacementHelp";
import { useRoomSaveStatus } from "@/features/room-planner/hooks/useRoomSaveStatus";
import { roomPlacementWarnings } from "@/lib/roomPlacementWarnings";
import {
  RoomTemplateAdminControls,
  useRoomTemplateAdmin,
} from "@/features/room-planner/components/RoomTemplateAdmin";
import { authFetch } from "@/lib/authFetch";
import {
  downloadKitchenFile,
  kitchenExportFilename,
} from "@/three/kitchenExport";
import { PlannerTour } from "@/features/planner/components/PlannerTour";
import {
  RoomPlannerControls,
  type RoomView,
} from "@/features/room-planner/components/RoomPlannerControls";
import {
  roomPlannerCatalog,
  type RoomCatalogScope,
} from "@/lib/roomCatalogPolicy";
import { PlannerModelCard } from "@/features/planner/components/PlannerModelCard";
import type { CameraAction, CameraRequest } from "@/lib/plannerCamera";
import Image from "next/image";
import { PlannerLink as Link } from "@/components/PlannerLink";
import {
  Plus,
  Save,
  Trash2,
  RotateCw,
  LayoutGrid,
  Copy,
  Layers,
  ShoppingBag,
  Maximize,
  Focus,
  Settings,
  X,
  Sparkles,
  Upload,
  Undo2,
  Redo2,
  Ruler,
  Download,
  Check,
  Move,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Paintbrush,
  DoorOpen,
  Lightbulb,
  House,
  ArrowUpRight,
  ChevronRight,
  ChevronDown,
  ChefHat,
} from "lucide-react";
import { priceFor } from "@/lib/products";
import { getProduct, useCatalog } from "@/store/catalog";
import { hasAvailableStock } from "@/lib/inventory";
import { CatalogStatus } from "@/components/CatalogStatus";
import { useDesigns, ROOM_DIMENSIONS } from "@/store/designs";
import { stockLabel } from "@/lib/inventory";
import { useCart } from "@/store/cart";
import type {
  PlacedFurniture,
  RoomDesign,
  RoomSize,
  Material,
  RoomShape,
  RoomType,
  RoomWall,
  RoomOpening,
} from "@/lib/types";
import { getRoomGeometry, ROOM_TYPES } from "@/lib/roomGeometry";
import { RoomPlacementMap } from "./RoomPlacementMap";
import { exteriorWindowBearing } from "@/lib/roomSunlight";
import { fixtureFitsCeiling } from "@/lib/roomCeiling";
import { roomsOverlap } from "@/lib/roomLayout";
import { RoomGeometryModal } from "./RoomGeometryModal";
import { RoomEnvironmentPanel } from "./RoomEnvironmentPanel";
import {
  createOpening,
  validateOpening,
  validateRoomOpenings,
} from "@/lib/roomOpenings";
import { SavedKitchenList } from "./SavedKitchenList";
import { useKitchens } from "@/store/kitchens";
import { useAuth } from "@/store/auth";
import type { SavedKitchen } from "@/lib/kitchenAssembly";
import { formatPrice, cn } from "@/lib/format";
import { modelDeliveryUrl, prefetchModel } from "@/lib/modelPrefetch";
import {
  roomPlacementContext,
  layoutFurnitureIssue,
  layoutClearanceIssue,
} from "@/three/roomPlacement";
import { RoomAddDialog } from "./RoomAddDialog";
import { RoomTourControls } from "./RoomTourControls";
import { interiorCamera } from "@/lib/roomInteriorCamera";
import { tourPointValid } from "@/three/roomCameraPlacement";
import { syncDesignRooms } from "@/lib/roomDesign";
import { isPlacementValid, dimsFor } from "@/three/collision";
import {
  getFurnitureMeasurements,
  formatMeasurement,
} from "@/lib/furnitureMeasurements";
import "./room-planner.css";
import "@/features/planner/components/planner-studio.css";
import "@/features/planner/components/planner-reference.css";
import "@/features/planner/components/planner-usability.css";
import "@/features/planner/components/planner-sidebar.css";
import "@/features/planner/components/planner-geometry.css";
import "@/features/room-planner/components/room-planner-simple.css";
import "@/features/room-planner/components/room-panel-theme.css";
import "@/features/planner/components/planner-tools.css";
import "@/features/room-planner/styles/studio-refresh.css";
import { RoomProductCard } from "@/features/room-planner/components/RoomProductCard";
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
  const { initialized, initialize, user } = useAuth();
  useEffect(() => {
    void initialize();
  }, [initialize]);
  if (!initialized)
    return (
      <PageSkeleton
        variant="planner"
        layout="room-start"
        label="Өмнөх өрөөг сэргээж байна…"
      />
    );
  return <RoomPlannerEditor key={user?.id ?? "guest"} />;
}

function RoomPlannerEditor() {
  const [tourRequest, setTourRequest] = useState(0);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  useEffect(() => {
    const preserveRoom = () => {
      const state = useDesigns.getState();
      state.endEdit();
      state.saveCurrent();
    };
    const preserveWhenHidden = () => {
      if (document.visibilityState === "hidden") preserveRoom();
    };
    window.addEventListener("pagehide", preserveRoom);
    document.addEventListener("visibilitychange", preserveWhenHidden);
    return () => {
      window.removeEventListener("pagehide", preserveRoom);
      document.removeEventListener("visibilitychange", preserveWhenHidden);
      preserveRoom();
    };
  }, []);
  const {
    current,
    furniture,
    rememberFurniture,
    duplicateRoom,
    removeRoom,
    savePreview,
    designs,
    createNew,
    addRoom,
    moveRoom,
    updateConnection,
    selectRoom,
    loadDesign,
    saveCurrent,
    deleteDesign,
    duplicateDesign,
    updatePieces,
    updateRoom,
    past,
    future,
    undo,
    redo,
    beginEdit,
    endEdit,
  } = useDesigns();
  const catalog = useCatalog();
  const kitchenLibrary = useKitchens(),
    kitchenUser = useAuth((state) => state.user);
  const handledKitchen = useRef<string | null>(null);
  const [roomDetailsTab, setRoomDetailsTab] = useState<
    "room" | "selection" | "project"
  >("room");
  const [kitchenOnly, setKitchenOnly] = useState(false);
  const [catalogScope, setCatalogScope] = useState<RoomCatalogScope>("room");
  const [catalogFormat, setCatalogFormat] = useState<"all" | "glb" | "photo">(
    "all",
  );
  const [roomStartOpen, setRoomStartOpen] = useState(true);
  const loadTemplate = useCallback((design: RoomDesign) => {
    useDesigns.getState().importTemplate(design);
    setRoomStartOpen(false);
    return useDesigns.getState().current!.id;
  }, []);
  const templateAdmin = useRoomTemplateAdmin(loadTemplate);
  const glbExporter = useRef<(() => Promise<Blob>) | null>(null);
  const exportReady = useCallback((exporter: (() => Promise<Blob>) | null) => {
    glbExporter.current = exporter;
  }, []);
  const previewCapture = useRef<(() => string | null) | null>(null);
  const placementHints = useRef<RoomPlacementHintSource | null>(null);
  const placementHintsReady = useCallback(
    (source: RoomPlacementHintSource | null) => {
      placementHints.current = source;
    },
    [],
  );
  const previewReady = useCallback((capture: (() => string | null) | null) => {
    previewCapture.current = capture;
  }, []);
  useEffect(() => {
    const leaving = () => previewCapture.current?.();
    const click = (event: MouseEvent) => {
      if ((event.target as Element)?.closest?.("a[href]")) leaving();
    };
    document.addEventListener("click", click, true);
    window.addEventListener("beforeunload", leaving);
    return () => {
      document.removeEventListener("click", click, true);
      window.removeEventListener("beforeunload", leaving);
    };
  }, []);
  const [surfacePopup, setSurfacePopup] = useState<SurfaceSelection | null>(
    null,
  );
  useEffect(() => {
    setSurfacePopup(null);
  }, [current?.activeRoomId]);
  const [recommendationsOpen, setRecommendationsOpen] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.has("kitchen") && params.get("setup") !== "1")
      setRoomStartOpen(false);
  }, []);
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [roomMapOpen, setRoomMapOpen] = useState(false);
  const measureUnit = useRoomMeasureUnit((state) => state.unit);
  const measureFactor = measureUnit === "мм" ? 1000 : 100;
  const [roomView, setRoomView] = useState<RoomView>("dollhouse");
  const {
    inspector,
    setInspector,
    selected,
    setSelected,
    environmentTab,
    setEnvironmentTab,
    surface,
    setSurface,
    selectedWall,
    setSelectedWall,
    selectedOpening,
    setSelectedOpening,
    placementTemplate,
    setPlacementTemplate,
    showStartHint,
    setShowStartHint,
    view,
    setView,
    snapEnabled,
    setSnapEnabled,
    locked,
    setLocked,
    paletteCat,
    setPaletteCat,
    showCompare,
    setShowCompare,
    showRoomGeometry,
    setShowRoomGeometry,
    compareIds,
    setCompareIds,
    saveName,
    setSaveName,
    leftOpen,
    setLeftOpen: setCatalogOpen,
    rightOpen,
    setRightOpen: setPropertiesOpen,
    activePreset,
    setActivePreset,
    presetStatus,
    setPresetStatus,
    presetError,
    setPresetError,
    localFile,
    setLocalFile,
    localUrl,
    setLocalUrl,
    localScale,
    setLocalScale,
    query,
    setQuery,
    gridEnabled,
    setGridEnabled,
    showDimensions,
    setShowDimensions,
    resetKey,
    setResetKey,
    notice,
    setNotice,
    expanded,
    setExpanded,
    newRoomType,
    setNewRoomType,
  } = useRoomPlannerUi();
  const setLeftOpen = useCallback(
    (open: boolean) => {
      setCatalogOpen(open);
      if (open) {
        setInspector("catalog");
        setPropertiesOpen(false);
        setSummaryOpen(false);
        setShowStartHint(false);
      }
    },
    [setCatalogOpen, setInspector, setPropertiesOpen, setShowStartHint],
  );
  const setRightOpen = useCallback(
    (open: boolean) => {
      setPropertiesOpen(open);
      if (open) {
        setInspector("environment");
        setCatalogOpen(false);
        setSummaryOpen(false);
        setShowStartHint(false);
      }
    },
    [setCatalogOpen, setInspector, setPropertiesOpen, setShowStartHint],
  );
  useEffect(() => {
    if (!selected) return;
    setRoomDetailsTab("selection");
    setEnvironmentTab("room");
    setRightOpen(true);
  }, [selected, setEnvironmentTab, setRightOpen]);
  const dbModels = useMemo(
    () =>
      catalog.products
        .filter((product) => product.model)
        .map((product) => getDbModel(product.id))
        .filter((model): model is DbModelInfo => !!model),
    [catalog.products],
  );
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [cameraRequest, setCameraRequest] = useState<CameraRequest>();
  const [settledPlan, setSettledPlan] = useState<string | null>(null);
  const planReady = roomView === "top" && settledPlan === current?.id;
  useEffect(() => {
    if (roomView !== "top") setSettledPlan(null);
  }, [roomView]);
  const [cameraPlacement, setCameraPlacement] = useState(false);
  const [addRoomType, setAddRoomType] = useState<RoomType | null>(null);
  function navigateView(action: CameraAction) {
    if (["fit", "top", "front", "back", "left", "right"].includes(action))
      setCameraPlacement(false);
    if (action === "top") {
      setView("plan");
      setRoomView("top");
    }
    if (
      action === "front" ||
      action === "back" ||
      action === "left" ||
      action === "right"
    ) {
      setView("perspective");
      setRoomView(action);
    }
    if (action === "fit") setRoomView(view === "plan" ? "top" : "dollhouse");
    if (
      roomView !== "interior" &&
      (action === "rotate-left" || action === "rotate-right")
    )
      setRoomView("dollhouse");
    setCameraRequest((previous) => ({ id: (previous?.id ?? 0) + 1, action }));
  }
  const shortcuts = useRef<Record<string, () => void>>({});
  const addToCart = useCart((s) => s.add);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 4500);
    return () => window.clearTimeout(timer);
  }, [notice, setNotice]);
  useEffect(() => {
    if (
      selected &&
      !current?.pieces.some((piece) => piece.instanceId === selected)
    )
      setSelected(null);
  }, [current, selected, setSelected]);
  const selectionDesignId = useRef(current?.id);
  useEffect(() => {
    const sameDesign = selectionDesignId.current === current?.id;
    selectionDesignId.current = current?.id;
    const activePieces = useDesigns.getState().current?.pieces;
    setSelected((id) =>
      sameDesign && activePieces?.some((piece) => piece.instanceId === id)
        ? id
        : null,
    );
    setSelectedWall(null);
    setSelectedOpening(null);
    setPlacementTemplate(null);
    setActivePreset(null);
    setLocalFile(null);
    setLocalUrl(null);
    setPaletteCat("all");
  }, [
    current?.id,
    current?.activeRoomId,
    current?.roomType,
    setSelected,
    setSelectedWall,
    setSelectedOpening,
    setPlacementTemplate,
    setActivePreset,
    setLocalFile,
    setLocalUrl,
    setResetKey,
    setPaletteCat,
    setView,
  ]);
  useEffect(() => {
    setResetKey((key) => key + 1);
    setRoomView("dollhouse");
    setView("perspective");
    setCameraRequest(undefined);
    setCameraPlacement(false);
    setAddRoomType(null);
  }, [current?.id, setView, setResetKey]);
  useEffect(() => {
    if (
      selectedOpening &&
      !current?.openings?.some((opening) => opening.id === selectedOpening)
    )
      setSelectedOpening(null);
  }, [current?.openings, selectedOpening, setSelectedOpening]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest(
          "dialog, input, textarea, select, [contenteditable=true]",
        )
      )
        return;
      const key = event.key.toLowerCase();
      const command = event.metaKey || event.ctrlKey;
      const action = command
        ? key === "z"
          ? event.shiftKey
            ? "redo"
            : "undo"
          : key === "y"
            ? "redo"
            : key === "d"
              ? "duplicate"
              : key === "s"
                ? "save"
                : ""
        : key;
      if (shortcuts.current[action]) {
        event.preventDefault();
        shortcuts.current[action]();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("kitchen");
    if (roomStartOpen || !id || handledKitchen.current === id || !current)
      return;
    if (!kitchenUser) {
      setKitchenOnly(true);
      setLeftOpen(true);
      return;
    }
    if (kitchenLibrary.owner !== kitchenUser.id) return;
    if (!kitchenLibrary.loaded) {
      if (!kitchenLibrary.loading && !kitchenLibrary.error)
        void kitchenLibrary.refresh();
      if (kitchenLibrary.error) setLeftOpen(true);
      return;
    }
    handledKitchen.current = id;
    const saved = kitchenLibrary.items.find((item) => item.id === id);
    const result = saved ? useDesigns.getState().placeKitchen(saved) : null;
    const piece = result?.piece;
    if (piece) {
      setSelected(piece.instanceId);
      setRightOpen(true);
      setNotice(`Гарнитурыг өрөөнд байрлууллаа. ${result.message}`);
    } else {
      setNotice(
        saved
          ? `${result?.error} Өрөөгөө тохируулаад «Миний гарнитур»-аас дахин нэмээрэй.`
          : "Хадгалсан гарнитур олдсонгүй.",
      );
      setKitchenOnly(true);
      setLeftOpen(true);
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("kitchen");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
  }, [
    roomStartOpen,
    current,
    kitchenLibrary,
    kitchenUser,
    updatePieces,
    setSelected,
    setNotice,
    setLeftOpen,
    setRightOpen,
  ]);

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

  const activeRoomType = current?.roomType ?? "living";
  const scopedCatalog = useMemo(
    () =>
      roomPlannerCatalog(
        catalog.products.filter((p) => !p.model),
        dbModels,
        {
          roomType: activeRoomType,
          scope: catalogScope,
          category: paletteCat,
          query,
          format: catalogFormat,
        },
      ),
    [
      catalog.products,
      dbModels,
      activeRoomType,
      catalogScope,
      paletteCat,
      query,
      catalogFormat,
    ],
  );
  const [catalogSort, setCatalogSort] = useState<PlannerCatalogSort>("default");
  const paletteItems = useMemo(
    () =>
      sortPlannerCatalog(
        scopedCatalog.photos,
        catalogSort,
        (item) => item.name,
      ),
    [scopedCatalog.photos, catalogSort],
  );
  const dbPaletteItems = useMemo(
    () =>
      sortPlannerCatalog(
        scopedCatalog.models,
        catalogSort,
        (item) => item.name,
      ),
    [scopedCatalog.models, catalogSort],
  );
  const catalogEntries = useMemo(
    () =>
      sortPlannerCatalog(
        [
          ...(catalogFormat === "glb"
            ? []
            : paletteItems.map((item) => ({ kind: "photo" as const, item }))),
          ...(catalogFormat === "photo"
            ? []
            : dbPaletteItems.map((item) => ({ kind: "model" as const, item }))),
        ],
        catalogSort,
        (entry) => entry.item.name,
      ),
    [paletteItems, dbPaletteItems, catalogFormat, catalogSort],
  );
  useEffect(() => {
    if (scopedCatalog.category !== paletteCat)
      setPaletteCat(scopedCatalog.category);
  }, [scopedCatalog.category, paletteCat, setPaletteCat]);
  const placement = useMemo(
    () => (current ? roomPlacementContext(current) : null),
    [current],
  );
  const activePlacement = useMemo(
    () =>
      placement
        ? {
            ...placement,
            room: { ...placement.room, placementGeometry: undefined },
          }
        : undefined,
    [placement],
  );
  const libraryReturnHandled = useRef(false);
  const authReturnHandled = useRef(false);
  useEffect(() => {
    if (authReturnHandled.current) return;
    const id = new URLSearchParams(window.location.search).get("design");
    if (!id) return;
    authReturnHandled.current = true;
    const state = useDesigns.getState();
    if (state.current?.id === id) setRoomStartOpen(false);
    else if (state.designs.some((design) => design.id === id)) {
      state.loadDesign(id);
      setRoomStartOpen(false);
    } else {
      setRoomStartOpen(true);
      setNotice(
        "Энэ загвар энэ хэрэглэгчийн төхөөрөмжийн хадгалалтад олдсонгүй.",
      );
    }
  }, [setNotice]);
  useEffect(() => {
    if (
      !current ||
      libraryReturnHandled.current ||
      new URLSearchParams(window.location.search).get("library") !== "mine"
    )
      return;
    libraryReturnHandled.current = true;
    setRoomStartOpen(false);
    setKitchenOnly(true);
    setLeftOpen(true);
  }, [current, setLeftOpen]);
  const handledShowroom = useRef<string | null>(null);
  const [showroomProduct, setShowroomProduct] = useState<string | null>(null);
  useEffect(() => {
    setShowroomProduct(
      new URLSearchParams(window.location.search).get("product"),
    );
  }, []);
  useEffect(() => {
    if (
      !showroomProduct ||
      roomStartOpen ||
      !current ||
      !catalog.ready ||
      catalog.loading ||
      handledShowroom.current === showroomProduct
    )
      return;
    const product = catalog.products.find((p) => p.id === showroomProduct);
    handledShowroom.current = showroomProduct;
    if (!product?.model) {
      setNotice("QR-ийн барааны 3D загвар одоогоор ашиглах боломжгүй байна.");
      return;
    }
    const result = useDesigns.getState().placeFurniture({
      instanceId: `p_${crypto.randomUUID()}`,
      productId: product.id,
      x: 0,
      z: 0,
      rotation: 0,
      color: product.defaultColor,
      material: product.materials[0]?.id ?? "wood",
      placement: product.placement,
      details: {
        name: product.name,
        dimensions: { ...product.dimensions },
        image: product.image,
        category: product.category,
      },
    });
    if (result.piece) {
      rememberFurniture(result.piece);
      setSelected(result.piece.instanceId);
      setCatalogOpen(false);
      setLeftOpen(false);
      trackProduct3d(product.id, "placement");
      setNotice(
        `${product.name}-г таны өрөөнд байрлууллаа. Чирж байрлалыг нь тохируулаарай.`,
      );
    } else
      setNotice(
        result.error ??
          "Өрөөнд багтах сул зай алга. Өрөөний хэмжээгээ шалгаад бараагаа каталогоос дахин сонгоорой.",
      );
    const url = new URL(window.location.href);
    url.searchParams.delete("product");
    url.searchParams.delete("source");
    window.history.replaceState(window.history.state, "", url);
  }, [
    showroomProduct,
    roomStartOpen,
    current,
    catalog.ready,
    catalog.loading,
    catalog.products,
    rememberFurniture,
    setSelected,
    setCatalogOpen,
    setLeftOpen,
    setNotice,
  ]);
  const placementWarnings = useMemo(
    () => (current ? roomPlacementWarnings(current, catalog.products) : []),
    [current, catalog.products],
  );
  const storageStatus = useRoomSaveStatus(
    current,
    designs,
    useDesigns.persist?.getOptions().name,
  );
  if (templateAdmin.loading || templateAdmin.error)
    return (
      <main className="container-page py-10">
        <p role={templateAdmin.error ? "alert" : "status"}>
          {templateAdmin.error || "Бэлэн өрөөг нээж байна…"}
        </p>
        <Link href="/admin?tab=rooms">Өрөөний сан руу буцах</Link>
      </main>
    );
  if (roomStartOpen || !current || !placement) {
    shortcuts.current = {};
    return (
      <>
        {showroomProduct && (
          <p className="container-page py-3 text-sm" role="status">
            QR-аар сонгосон бараа:{" "}
            <strong>
              {catalog.products.find((p) => p.id === showroomProduct)?.name ??
                "Ачаалж байна…"}
            </strong>
            . Гэрийнхээ хэмжээг оруулаарай. Өрөө байгуулахад барааг автоматаар
            байрлуулна.
          </p>
        )}
        <RoomPlannerStart
          onTemplate={loadTemplate}
          draft={current}
          designs={designs}
          onDelete={deleteDesign}
          onOpen={(id) => {
            loadDesign(id);
            setRoomStartOpen(false);
          }}
          onResume={() => setRoomStartOpen(false)}
          onStart={(type, dimensions, options) => {
            if (
              options?.furnishing === "preset" &&
              !suggestedFurniture(type, catalog.products).length
            )
              throw new Error(
                "Энэ төрлийн өрөөний 3D тавилга каталогт хараахан бэлэн болоогүй. Хоосон өрөө эсвэл Миний тавилга сонгоно уу.",
              );
            if (options?.furnishing === "mine" && !options.furnitureIds?.length)
              throw new Error("Миний тавилгын сангаас тавилгаа сонгоно уу.");
            const prepared = options
              ? configureAddedRoom(
                  { ...newDesignRoom(type, []), ...dimensions },
                  options,
                )
              : null;
            // Keep the previous draft available before starting a different room.
            if (useDesigns.getState().current) saveCurrent();
            createNew(
              "80",
              `${ROOM_TYPES[type].label} загвар`,
              type,
              dimensions,
              prepared ? createRoomBuilderDraft(prepared) : undefined,
            );
            if (options) {
              const configured = prepared!;
              const result = furnishRoom(
                configured,
                type,
                options,
                catalog.products,
                furniture ?? [],
                useDesigns.getState().current?.activeRoomId,
              );
              updateRoom({
                wallFeatures: configured.wallFeatures,
                openings: configured.openings,
                pieces: result.pieces,
              });
              result.pieces.forEach((piece) => rememberFurniture(piece));
              setRecommendationsOpen(
                (options.furnishing ?? "empty") !== "empty",
              );
              if (result.skipped.length)
                setNotice(
                  `Багтаагүй тавилга: ${result.skipped.join(", ")}. Тавилгын санд хадгалагдсан хэвээр.`,
                );
            }
            setRoomStartOpen(false);
            setShowStartHint(false);
            setCatalogOpen(false);
            setPropertiesOpen(false);
            setSummaryOpen(false);
            setKitchenOnly(type === "kitchen");
            setLeftOpen(type === "kitchen");
          }}
        />
      </>
    );
  }

  const placeNewPiece = (piece: PlacedFurniture) => {
    const latest = useDesigns.getState().current;
    if (!latest || latest.id !== current.id) {
      setNotice("Өрөө өөрчлөгдсөн байна. Тавилгаа дахин сонгоно уу.");
      return;
    }
    const source = placementHints.current;
    let hints;
    // The SVG plan has its own framing; never use a paused/hidden 3D camera for it.
    if (
      roomView !== "top" &&
      source?.designId === latest.id &&
      source.roomId === (latest.activeRoomId ?? `${latest.id}-room-1`)
    ) {
      try {
        hints = source.read(latest);
      } catch {
        /* Camera unavailable: deterministic local fallback. */
      }
    }
    const result = useDesigns.getState().placeFurniture(piece, hints);
    if (!result.piece) {
      setNotice(result.error ?? "Тавилга байрлуулж чадсангүй.");
      return;
    }
    rememberFurniture(result.piece);
    if (!piece.modelId && !piece.kitchen)
      trackProduct3d(piece.productId, "placement");
    setSelected(result.piece.instanceId);
    setSelectedOpening(null);
    setSelectedWall(null);
    setPlacementTemplate(null);
    setLeftOpen(false);
    setNotice(
      result.piece.attachment?.kind === "wall"
        ? "Тавилгыг хананд бэхэллээ. Ханын дагуу болон дээш, доош чирж зөөнө."
        : result.piece.attachment?.kind === "surface"
          ? "Тавилгыг тулгуур дээр байрлууллаа. Чирж байрлалыг нь тохируулаарай."
          : "Тавилгыг сул зайд байрлууллаа. Чирж зөөх эсвэл Эргүүлэх товчоор чиглэлийг нь өөрчилнө.",
    );
  };
  const addPiece = (productId: string) => {
    const product = getProduct(productId);
    if (!product) return;
    if (!product.model) {
      setNotice("Энэ барааны 3D загвар хараахан бэлэн болоогүй.");
      return;
    }
    const piece: PlacedFurniture = {
      instanceId: `p_${crypto.randomUUID()}`,
      productId,
      placement: product.placement,
      x: 0,
      z: 0,
      rotation: 0,
      color: product.defaultColor,
      material: product.materials[0]?.id ?? "wood",
      details: {
        name: product.name,
        dimensions: { ...product.dimensions },
        image: product.image,
        category: product.category,
      },
    };
    placeNewPiece(piece);
  };

  const addModelPiece = (model: DbModelInfo) => {
    const defaultColor = model.colors[0]?.id ?? "default";
    const defaultMaterial = (model.materials[0]?.id ?? "wood") as Material;
    const piece: PlacedFurniture = {
      instanceId: `m_${crypto.randomUUID()}`,
      productId: model.id,
      modelId: model.id,
      placement: model.placement,
      x: 0,
      z: 0,
      rotation: 0,
      color: defaultColor,
      material: defaultMaterial,
      details: {
        name: model.name,
        dimensions: {
          w: model.dimensionsW,
          d: model.dimensionsD,
          h: model.dimensionsH,
        },
        category: model.category,
      },
    };
    placeNewPiece(piece);
  };

  const onMove = (
    id: string,
    x: number,
    z: number,
    pose?: Partial<
      Pick<PlacedFurniture, "elevation" | "rotation" | "attachment">
    >,
  ) => {
    try {
      updatePieces(
        current.pieces.map((p) =>
          p.instanceId === id
            ? pose
              ? { ...p, x, z, ...pose }
              : moveAttachedFurniture(
                  p,
                  x,
                  z,
                  current,
                  current.activeRoomId ?? `${current.id}-room-1`,
                  current.pieces,
                )
            : p,
        ),
      );
    } catch (reason) {
      setNotice((reason as Error).message);
    }
  };

  const rotateSelected = () => {
    if (!selected) return;
    const piece = current.pieces.find((p) => p.instanceId === selected);
    if (!piece) return;
    if (piece.attachment && piece.attachment.kind !== "floor") {
      setNotice(
        "Бэхэлгээний тохиргооноос ханын байрлал эсвэл тулгуур гадаргууг өөрчилнө үү.",
      );
      return;
    }
    const rotated: PlacedFurniture = {
      ...piece,
      rotation: (piece.rotation + Math.PI / 2) % (Math.PI * 2),
    };
    if (rotated.attachment?.kind === "floor")
      rotated.attachment = { ...rotated.attachment, yaw: rotated.rotation };
    if (!isPlacementValid(rotated, placement.pieces, placement.room)) {
      setNotice(
        "Эргүүлэхэд өрөөний хана, багана эсвэл таазны хязгаараас гарч байна.",
      );
      return;
    }

    updatePieces(
      current.pieces.map((p) => (p.instanceId === selected ? rotated : p)),
    );
  };

  const removeSelected = () => {
    if (selectedOpening) {
      updateRoom({
        openings: (current.openings ?? []).filter(
          (opening) => opening.id !== selectedOpening,
        ),
      });
      setSelectedOpening(null);
      return;
    }
    if (!selected) return;
    const removed = new Set([selected]);
    for (let changed = true; changed;) {
      changed = false;
      for (const p of current.pieces)
        if (
          p.attachment?.kind === "surface" &&
          removed.has(p.attachment.parentInstanceId) &&
          !removed.has(p.instanceId)
        ) {
          removed.add(p.instanceId);
          changed = true;
        }
    }
    updatePieces(current.pieces.filter((p) => !removed.has(p.instanceId)));
    setSelected(null);
  };

  const resizeRoom = (size: RoomSize) => {
    const dims = ROOM_DIMENSIONS[size];
    const resizedRoom = {
      ...current,
      width: dims.w,
      depth: dims.d,
    };
    const shapeError = validateRoomOpenings(resizedRoom);
    if (shapeError) {
      setNotice(shapeError);
      return;
    }
    if (
      current.lighting?.fixtures.some(
        (fixture) => !fixtureFitsCeiling(resizedRoom, fixture),
      )
    ) {
      setNotice(
        "Таазны гэрэл шинэ өрөөний гадна үлдэж байна. Эхлээд гэрлийн байрлалыг өөрчилнө үү.",
      );
      return;
    }
    const resizedDesign = syncDesignRooms({ ...current, ...resizedRoom });
    const resizedPlacement = roomPlacementContext(resizedDesign);
    const allPiecesValid =
      !layoutFurnitureIssue(
        current,
        resizedDesign.rooms ?? [],
        resizedDesign.connections ?? [],
      ) &&
      !layoutClearanceIssue(current, resizedDesign) &&
      current.pieces.every((p) =>
        isPlacementValid(p, resizedPlacement.pieces, resizedPlacement.room),
      );
    if (!allPiecesValid) {
      setNotice(
        "Энэ хэмжээнд тавилга багтахгүй байна. Эхлээд байрлалыг нь өөрчилнө үү.",
      );
      return;
    }
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
    current.pieces.forEach((piece) => {
      const product = getProduct(piece.productId);
      if (
        !product?.inStock ||
        !product.colors.some((c) => c.id === piece.color) ||
        !product.materials.some((m) => m.id === piece.material)
      ) {
        skipped++;
        return;
      }
      const count = addToCart({
        productId: product.id,
        name: product.name,
        image: product.image,
        color: piece.color,
        material: piece.material,
        unitPrice: getPiecePrice(piece),
        qty: 1,
        stockQuantity: product.stockQuantity,
        madeToOrder: product.madeToOrder,
      });
      added += count;
      if (!count) skipped++;
    });
    setNotice(
      added
        ? added +
            " тавилгыг сагсанд нэмлээ." +
            (skipped
              ? " " +
                skipped +
                " тавилга нөөц хүрэлцэхгүй эсвэл сонголт өөрчлөгдсөн тул нэмэгдсэнгүй."
              : "")
        : "Тавилга нэмэгдсэнгүй. Нөөц болон сагсны тоо ширхэгээ шалгана уу.",
    );
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

  const selectedDetails = selectedPiece?.kitchen
    ? {
        name: selectedPiece.kitchen.name,
        basePrice: 0,
        colors: [],
        materials: [],
      }
    : (selectedProduct ??
      selectedDbModel ??
      (selectedPiece?.details
        ? { ...selectedPiece.details, basePrice: 0, colors: [], materials: [] }
        : null));
  const measurements =
    showDimensions && selectedPiece && selectedDetails
      ? getFurnitureMeasurements(
          current,
          selectedPiece,
          dimsFor(selectedPiece),
        ).filter((item) => !(activePreset || localUrl) || item.kind === "size")
      : [];

  const transformSelected = (
    patch: Partial<Pick<PlacedFurniture, "x" | "z" | "rotation">>,
  ) => {
    if (!selectedPiece) return;
    if (selectedPiece.attachment && selectedPiece.attachment.kind !== "floor") {
      setNotice("Бэхэлгээний тохиргоог ашиглах эсвэл тавилгыг чирж зөөнө үү.");
      return;
    }
    const candidate = { ...selectedPiece, ...patch };
    if (candidate.attachment?.kind === "floor")
      candidate.attachment = {
        ...candidate.attachment,
        x: candidate.x,
        z: candidate.z,
        yaw: candidate.rotation,
      };
    if (!isPlacementValid(candidate, placement.pieces, placement.room)) {
      setNotice(
        "Тавилга өрөөний хана, багана эсвэл таазны хязгаараас гарч байна.",
      );
      return;
    }
    updatePieces(
      current.pieces.map((piece) =>
        piece.instanceId === candidate.instanceId ? candidate : piece,
      ),
    );
  };
  const duplicateSelected = () => {
    if (!selectedPiece) return;
    const copy = duplicateFurniturePlacement(
      selectedPiece,
      `p_${crypto.randomUUID()}`,
      placement.pieces,
      placement.room,
      current.activeRoomId ?? `${current.id}-room-1`,
    );
    if (!copy) {
      setNotice("Хуулбар байрлуулах зай хүрэлцэхгүй байна.");
      return;
    }
    updatePieces([...current.pieces, copy]);
    setSelected(copy.instanceId);
  };
  const save = () => {
    endEdit();
    saveCurrent(saveName.trim() || current.name.trim() || "Миний өрөө");
    setSavedAt(
      new Date().toLocaleTimeString("mn-MN", {
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
    setSaveName("");
    setNotice("Загварыг энэ төхөөрөмж дээр хадгаллаа.");
  };
  const nudge = (x: number, z: number) => {
    if (selectedPiece)
      transformSelected({
        x: Math.round((selectedPiece.x + x) * 100) / 100,
        z: Math.round((selectedPiece.z + z) * 100) / 100,
      });
  };
  shortcuts.current = {
    undo,
    redo,
    duplicate: duplicateSelected,
    save,
    r: rotateSelected,
    delete: removeSelected,
    backspace: removeSelected,
    arrowup: () => nudge(0, -0.1),
    arrowdown: () => nudge(0, 0.1),
    arrowleft: () => nudge(-0.1, 0),
    arrowright: () => nudge(0.1, 0),
    escape: () => {
      setCameraPlacement(false);
      if (roomView === "interior") navigateView("fit");
      setSelected(null);
      setSelectedWall(null);
      setSelectedOpening(null);
      setPlacementTemplate(null);
      setLeftOpen(false);
      setRightOpen(false);
      setExpanded(false);
      setShowCompare(false);
      setSummaryOpen(false);
    },
  };
  const exportImage = () => {
    const canvas = workspaceRef.current?.querySelector("canvas");
    if (!canvas) {
      setNotice("3D дүрслэл ачаалсны дараа дахин оролдоно уу.");
      return;
    }
    try {
      const link = document.createElement("a");
      link.download = `${current.name.replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80) || "room"}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setNotice("Өрөөний зургийг PNG хэлбэрээр татлаа.");
    } catch {
      setNotice(
        "Зураг татаж чадсангүй. Загвар бүрэн ачаалсны дараа дахин оролдоно уу.",
      );
    }
  };
  const geometry = getRoomGeometry(current);
  const applyRoomShape = (
    shape: RoomShape,
    contentShift?: { x: number; z: number },
  ) => {
    // Pointer samples can arrive within one render. Validate and update the
    // latest room, including its already shifted contents, as one store write.
    const latest = useDesigns.getState().current;
    if (!latest) return "Өрөөг дахин нээнэ үү.";
    if (
      latest.outline &&
      (!shape.outline || shape.outline === latest.outline) &&
      (shape.width !== latest.width || shape.depth !== latest.depth)
    ) {
      const resized = resizeRoomBuilder(
        createRoomBuilderDraft(latest),
        shape.width,
        shape.depth,
      );
      shape = { ...shape, outline: resized.outline };
    }
    const shifted =
      contentShift && (contentShift.x !== 0 || contentShift.z !== 0);
    let pieces = shifted
      ? latest.pieces.map((piece) => ({
          ...piece,
          x: piece.x + contentShift.x,
          z: piece.z + contentShift.z,
        }))
      : latest.pieces;
    const lighting =
      shifted && latest.lighting
        ? {
            ...latest.lighting,
            fixtures: latest.lighting.fixtures.map((fixture) => ({
              ...fixture,
              x: fixture.x + contentShift.x,
              z: fixture.z + contentShift.z,
            })),
          }
        : latest.lighting;
    try {
      pieces = resolveFurnitureAttachments(
        pieces,
        { ...latest, ...shape },
        latest.activeRoomId ?? `${latest.id}-room-1`,
      );
    } catch (reason) {
      return (reason as Error).message;
    }
    const next = {
      ...latest,
      ...shape,
      openings: shape.openings ?? latest.openings,
      pieces,
      lighting,
    };
    const active = latest.rooms?.find(
      (room) => room.id === latest.activeRoomId,
    );
    if (
      active &&
      latest.rooms?.some(
        (room) =>
          room.id !== active.id && roomsOverlap({ ...active, ...shape }, room),
      )
    )
      return "Өрөөний шинэ хэмжээ хөрш өрөөтэй давхцаж байна. Эхлээд зураглал дээр зайлуулна уу.";
    const issue = validateRoomOpenings(next);
    if (issue) return issue;
    const nextDesign = syncDesignRooms(next);
    const nextPlacement = roomPlacementContext(nextDesign);
    if (
      layoutFurnitureIssue(
        latest,
        nextDesign.rooms ?? [],
        nextDesign.connections ?? [],
      ) ||
      layoutClearanceIssue(latest, nextDesign) ||
      !pieces.every((piece) =>
        isPlacementValid(piece, nextPlacement.pieces, nextPlacement.room),
      )
    )
      return "Хана, товойлт эсвэл багана тавилгатай давхцаж байна. Эхлээд тавилгын байрлалыг өөрчилнө үү.";
    if (
      nextDesign.lighting?.fixtures.some(
        (fixture) => !fixtureFitsCeiling(nextDesign, fixture),
      )
    )
      return "Таазны гэрэл шинэ өрөөний гадна үлдэж байна. Эхлээд гэрлийн байрлалыг өөрчилнө үү.";
    updateRoom({
      ...shape,
      openings: next.openings,
      pieces,
      lighting: nextDesign.lighting,
    });
    setActivePreset(null);
    setLocalFile(null);
    setLocalUrl(null);
    return null;
  };

  const selectOpening = (id: string | null) => {
    setSelectedOpening(id);
    if (id) {
      setSelected(null);
      setSelectedWall(
        current.openings?.find((item) => item.id === id)?.wallId ?? null,
      );
      setEnvironmentTab("openings");
    }
  };
  const selectWall = (wall: RoomWall) => {
    setSelectedWall(wall);
    setRoomDetailsTab("room");
    setEnvironmentTab("room");
    setRightOpen(true);
    setSelected(null);
    setSelectedOpening(null);
  };
  const changeOpening = (opening: RoomOpening) => {
    const issue = validateOpening(current, opening);
    if (issue) {
      setNotice(issue);
      return;
    }
    updateRoom({
      openings: (current.openings ?? []).map((item) =>
        item.id === opening.id ? opening : item,
      ),
    });
    setSelectedWall(opening.wallId);
  };
  const addOpening = (
    templateId: string,
    wallId: RoomWall,
    position?: number,
  ) => {
    const opening = createOpening(templateId, wallId, position ?? 0.5);
    if (position === undefined && validateOpening(current, opening)) {
      const positions = Array.from(
        { length: 99 },
        (_, i) => (i + 1) / 100,
      ).sort((a, b) => Math.abs(a - 0.5) - Math.abs(b - 0.5));
      const free = positions.find(
        (candidate) =>
          !validateOpening(current, { ...opening, position: candidate }),
      );
      if (free !== undefined) opening.position = free;
    }
    const issue = validateOpening(current, opening);
    if (issue) {
      setNotice(issue);
      return;
    }
    updateRoom({ openings: [...(current.openings ?? []), opening] });
    setActivePreset(null);
    setLocalFile(null);
    setLocalUrl(null);
    setSelected(null);
    setSelectedOpening(opening.id);
    setSelectedWall(wallId);
    setPlacementTemplate(null);
    setEnvironmentTab("openings");
    setRightOpen(true);
  };
  const armPlacement = (templateId: string | null) => {
    setPlacementTemplate(templateId);
    setSelected(null);
    setSelectedOpening(null);
    if (templateId) {
      setActivePreset(null);
      setLocalFile(null);
      setLocalUrl(null);
      setRightOpen(false);
    }
  };

  return (
    <div
      ref={workspaceRef}
      data-planner-ready="room"
      className={cn(
        "room-planner-layout planner-workspace planner-studio planner-reference room-simple relative overflow-hidden",
        (leftOpen || rightOpen || summaryOpen) && "room-panel-open",
        expanded && "planner-expanded",
        templateAdmin.isAdmin && "room-admin-mode",
      )}
    >
      <PlannerTour kind="room" request={tourRequest} />
      <PlannerViewport />
      {templateAdmin.isAdmin && (
        <RoomTemplateAdminControls
          key={current.id}
          design={current}
          initial={
            templateAdmin.loaded?.designId === current.id
              ? templateAdmin.loaded.template
              : undefined
          }
          customInterior={!!localUrl || !!activePreset}
          catalogReady={catalog.ready && !catalog.loading && !catalog.error}
          onCapture={() => previewCapture.current?.() ?? null}
          onExport={async () => {
            if (!catalog.ready || catalog.loading || catalog.error)
              throw new Error(
                "Тавилгын сан ачаалж дууссаны дараа GLB татна уу.",
              );
            if (!glbExporter.current || !kitchenUser)
              throw new Error("3D өрөө бэлэн болсны дараа дахин оролдоно уу.");
            const response = await authFetch(
              "/api/admin/room-templates/export",
              { method: "POST" },
              kitchenUser.id,
            );
            const data = await response.json();
            if (!response.ok) throw new Error(data.error);
            if (useDesigns.getState().current?.id !== current.id)
              throw new Error("Өрөө өөрчлөгдсөн байна. Дахин татна уу.");
            const exporter = glbExporter.current;
            if (!exporter)
              throw new Error("Өрөө өөрчлөгдсөн байна. Дахин оролдоно уу.");
            const blob = await exporter();
            if (
              useAuth.getState().user?.id !== kitchenUser.id ||
              useDesigns.getState().current?.id !== current.id
            )
              throw new Error(
                "Хэрэглэгч эсвэл өрөө өөрчлөгдсөн байна. Дахин татна уу.",
              );
            downloadKitchenFile(
              blob,
              kitchenExportFilename(current.name, "glb"),
            );
          }}
        />
      )}
      <header className="studio-header room-studio-header">
        <Link href="/" className="studio-brand" aria-label="Tavilga.mn нүүр">
          <House size={19} />
          <span>tavilga.mn</span>
        </Link>
        <label className="room-project-name">
          <span>
            {savedAt
              ? `Энэ төхөөрөмж дээр хадгалсан · ${savedAt}`
              : "Өрөөний төлөвлөгч"}
          </span>
          <input
            aria-label="Төслийн нэр"
            value={current.name}
            onFocus={beginEdit}
            onBlur={endEdit}
            onChange={(event) => updateRoom({ name: event.target.value })}
          />
        </label>
        <div className="studio-file-actions">
          <RoomPlannerSignIn />
          <button
            type="button"
            title="Хадгалсан загварууд"
            aria-label="Хадгалсан загварууд"
            onClick={() => {
              setRoomDetailsTab("project");
              setEnvironmentTab("room");
              setRightOpen(true);
            }}
          >
            <Layers size={18} />
            <span>Миний загварууд</span>
          </button>
          <button
            type="button"
            title="PNG зураг татах"
            aria-label="Зураг татах"
            onClick={exportImage}
          >
            <Download size={18} />
            <span>Зураг</span>
          </button>
          <button
            type="button"
            title="Хадгалах (Ctrl+S)"
            aria-label="Загвар хадгалах"
            className="room-save-primary"
            data-planner-tour="room-save"
            onClick={save}
          >
            <Save size={18} />
            <span>Хадгалах</span>
          </button>
          <span className="room-header-price">{formatPrice(totalPrice)}</span>
          <button
            type="button"
            className="room-summary-button"
            aria-expanded={summaryOpen}
            onClick={() => {
              endEdit();
              setPlacementTemplate(null);
              setLeftOpen(false);
              setRightOpen(false);
              setShowStartHint(false);
              setSummaryOpen((value) => !value);
            }}
          >
            <span>Тойм</span>
            <ChevronRight size={20} />
          </button>
        </div>
      </header>
      {notice && (
        <div className="planner-notice" role="status">
          <Check size={17} />
          <span>{notice}</span>
          <button aria-label="Мэдэгдэл хаах" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {/* One shared right inspector; the catalog no longer consumes canvas width on the left. */}
      <Drawer
        side="right"
        open={leftOpen}
        active={inspector === "catalog" && leftOpen}
        onClose={() => setLeftOpen(false)}
        title={kitchenOnly ? "Гарнитур нэмэх" : "Тавилга нэмэх"}
      >
        <div
          className="planner-inspector-tabs"
          role="group"
          aria-label="Тавилгын сангийн хэсэг"
        >
          <button
            type="button"
            aria-pressed={!kitchenOnly}
            onClick={() => setKitchenOnly(false)}
          >
            Каталог
          </button>
          <button
            type="button"
            aria-pressed={kitchenOnly}
            onClick={() => setKitchenOnly(true)}
          >
            Миний гарнитур
          </button>
        </div>
        {!kitchenOnly && (
          <div className="border-b border-ui-line p-4">
            <div className="planner-panel-heading">
              <span>
                <LayoutGrid size={18} /> Тавилгын сан
              </span>
              <small>Таалагдсан тавилга дээр дарж өрөөндөө нэмээрэй.</small>
            </div>
            <PlannerCatalogToolbar
              query={query}
              onQuery={setQuery}
              label="Тавилга нэрээр хайх"
              placeholder="Тавилга хайх…"
              sort={catalogSort}
              onSort={setCatalogSort}
              filterCount={
                Number(catalogScope !== "all") +
                Number(scopedCatalog.category !== "all") +
                Number(catalogFormat !== "all")
              }
              filters={
                <RoomCatalogFilters
                  categories={scopedCatalog.categories}
                  category={scopedCatalog.category}
                  onCategory={setPaletteCat}
                  scope={catalogScope}
                  onScope={setCatalogScope}
                  format={catalogFormat}
                  onFormat={setCatalogFormat}
                  roomName={ROOM_TYPES[activeRoomType].label}
                  query={query}
                  count={
                    (catalogFormat !== "glb" ? paletteItems.length : 0) +
                    (catalogFormat !== "photo" ? dbPaletteItems.length : 0)
                  }
                  onReset={() => {
                    setCatalogScope("all");
                    setPaletteCat("all");
                    setQuery("");
                    setCatalogFormat("all");
                  }}
                />
              }
            />
            <p className="room-catalog-compact-count" role="status">
              {(catalogFormat !== "glb" ? paletteItems.length : 0) +
                (catalogFormat !== "photo" ? dbPaletteItems.length : 0)}{" "}
              тавилга
            </p>
          </div>
        )}
        <div className="studio-catalog-scroll flex-1 overflow-y-auto p-3">
          {kitchenOnly && (
            <div className="room-kitchen-intro">
              <span className="room-kitchen-intro-icon">
                <ChefHat size={24} aria-hidden="true" />
              </span>
              <h2>Гарнитураа сонгоорой</h2>
              <p>
                Доорх хадгалсан загвараас сонгоод «Өрөөнд байрлуулах» дарна уу.
                Шинээр хийх бол эхлээд шүүгээ, хэмжээ, өнгөө сонгоорой.
              </p>
              <Link className="room-kitchen-create" href="/kitchen?new=1">
                <Plus size={18} aria-hidden="true" />
                <span>
                  <strong>Шинээр гарнитур хийх</strong>
                  <small>Шүүгээ, хэмжээ, өнгөө сонгоод хадгалах</small>
                </span>
                <ArrowRight size={18} aria-hidden="true" />
              </Link>
            </div>
          )}
          {kitchenOnly && (
            <section
              className="planner-kitchen-library"
              aria-label="Миний хадгалсан гарнитурууд"
            >
              <SavedKitchenList
                placement={activePlacement}
                onPlace={(saved: SavedKitchen) => {
                  const result = useDesigns.getState().placeKitchen(saved);
                  const piece = result.piece;
                  if (!piece) {
                    setNotice(result.error ?? result.message);
                    return;
                  }
                  setSelected(piece.instanceId);
                  setLeftOpen(false);
                  setActivePreset(null);
                  setLocalFile(null);
                  setLocalUrl(null);
                  setNotice(
                    `Гарнитурыг бодит хэмжээгээр байрлууллаа. ${result.message}`,
                  );
                }}
              />
            </section>
          )}
          {!kitchenOnly && (
            <>
              {(catalog.loading || !catalog.ready || catalog.error) && (
                <CatalogStatus
                  loading={catalog.loading}
                  error={catalog.error}
                  retry={() => void catalog.refresh()}
                />
              )}
              <div className="planner-model-grid">
                {catalog.ready &&
                  !catalog.loading &&
                  !(catalogFormat === "all"
                    ? dbPaletteItems.length + paletteItems.length
                    : catalogFormat === "glb"
                      ? dbPaletteItems.length
                      : paletteItems.length) && (
                    <p className="planner-empty">
                      {catalogFormat === "glb" && paletteItems.length > 0
                        ? "Энэ ангилалд 3D моделтой тавилга алга. Бусад ангилалын тавилгуудыг үзэж болно."
                        : catalogFormat === "photo" && dbPaletteItems.length > 0
                          ? "Энд зөвхөн 3D моделтой тавилга байна."
                          : query.trim()
                            ? "Тавилга олдсонгүй."
                            : "Энэ өрөө, ангилалд боломжтой тавилга одоогоор алга."}
                      {((catalogFormat === "glb" && paletteItems.length > 0) ||
                        (catalogFormat === "photo" &&
                          dbPaletteItems.length > 0)) && (
                        <button
                          type="button"
                          className="planner-secondary-button"
                          onClick={() => setCatalogFormat("all")}
                        >
                          Энэ сонголтын бүх тавилга
                        </button>
                      )}
                      <button
                        type="button"
                        className="planner-secondary-button"
                        onClick={() => {
                          setCatalogScope("all");
                          setPaletteCat("all");
                          setQuery("");
                          setCatalogFormat("all");
                        }}
                      >
                        Бүх тавилга харах
                      </button>
                    </p>
                  )}
                {catalogEntries.map((entry) =>
                  entry.kind === "photo" ? (
                    <RoomProductCard
                      key={entry.item.id}
                      product={entry.item}
                      onAdd={() => addPiece(entry.item.id)}
                    />
                  ) : (
                    (() => {
                      const m = entry.item;
                      return (
                        <PlannerModelCard
                          key={m.id}
                          name={m.name}
                          image={
                            m.thumbnailFile
                              ? `/api/models/files/${m.fileModelId ?? m.id}/${m.thumbnailFile}`
                              : null
                          }
                          dimensions={`${Math.round(m.dimensionsW * 1000)} × ${Math.round(m.dimensionsD * 1000)} × ${Math.round(m.dimensionsH * 1000)} мм`}
                          detail={
                            m.basePrice > 0
                              ? formatPrice(m.basePrice)
                              : stockLabel(m)
                          }
                          file={m.glbFile}
                          onAdd={() => addModelPiece(m)}
                          onPrefetch={() =>
                            void prefetchModel(
                              modelDeliveryUrl(
                                m.fileModelId ?? m.id,
                                m.glbFile,
                              ),
                            )
                          }
                        />
                      );
                    })()
                  ),
                )}
              </div>
            </>
          )}
        </div>
      </Drawer>

      {/* CENTER: canvas */}
      <div
        className="planner-stage relative h-full"
        data-planner-tour="room-stage"
      >
        <div className="room-stage-actions">
          <button
            type="button"
            className="room-add-button"
            data-planner-tour="room-catalog"
            aria-expanded={leftOpen && !kitchenOnly}
            onClick={() => {
              setKitchenOnly(false);
              setLeftOpen(!leftOpen || kitchenOnly);
            }}
          >
            <Plus size={20} /> Тавилга нэмэх
          </button>
          {current.roomType === "kitchen" && (
            <button
              type="button"
              className="room-kitchen-button"
              aria-expanded={leftOpen && kitchenOnly}
              onClick={() => {
                setKitchenOnly(true);
                setLeftOpen(!leftOpen || !kitchenOnly);
              }}
            >
              <ChefHat size={20} aria-hidden="true" />
              <span>Гарнитур нэмэх</span>
              <ChevronDown size={16} aria-hidden="true" />
            </button>
          )}
          <div
            className="room-history-controls"
            role="group"
            aria-label="Өөрчлөлт буцаах"
          >
            <button
              type="button"
              title="Буцаах (Ctrl+Z)"
              aria-label="Буцаах"
              disabled={!past.length}
              onClick={undo}
            >
              <Undo2 size={18} />
            </button>
            <button
              type="button"
              title="Дахин хийх (Ctrl+Shift+Z)"
              aria-label="Дахин хийх"
              disabled={!future.length}
              onClick={redo}
            >
              <Redo2 size={18} />
            </button>
          </div>
          <RoomPlacementHelp
            warnings={placementWarnings}
            onHelp={() => {
              setShowStartHint(false);
              setTourRequest((value) => value + 1);
            }}
            onSelect={(item) => {
              endEdit();
              selectRoom(item.roomId);
              setSelected(item.id);
              setSelectedOpening(null);
              setLocked(false);
              setCameraPlacement(false);
              setRoomView("dollhouse");
              setView("perspective");
              setCameraRequest((previous) => ({
                id: (previous?.id ?? 0) + 1,
                action: "focus",
                targetId: item.id,
              }));
            }}
          />
        </div>
        {recommendationsOpen && (
          <aside className="room-furniture-suggestions">
            <div className="flex justify-between">
              <strong>Өрөөнд санал болгох</strong>
              <button
                type="button"
                aria-label="Санал болгох хэсгийг хаах"
                onClick={() => setRecommendationsOpen(false)}
              >
                ×
              </button>
            </div>
            {suggestedFurniture(
              current.roomType ?? "living",
              catalog.products,
              current.pieces,
            ).map((product) => (
              <button
                key={product.id}
                type="button"
                onClick={() => addPiece(product.id)}
              >
                {product.name}
                <span>+ Нэмэх</span>
              </button>
            ))}
            {!suggestedFurniture(
              current.roomType ?? "living",
              catalog.products,
              current.pieces,
            ).length && <p>Тавилга нэмэх хэсгээс өөр сонголт үзээрэй.</p>}
          </aside>
        )}
        {!localUrl && !activePreset && (
          <RoomPlacementMap
            design={current}
            open={roomMapOpen}
            onOpen={setRoomMapOpen}
            onSelect={(id) => {
              selectRoom(id);
              setSelected(null);
              setSelectedOpening(null);
              setSelectedWall(null);
              setPlacementTemplate(null);
            }}
            onAdd={(type) => {
              setAddRoomType(type);
              setRoomMapOpen(true);
              setShowStartHint(false);
              setLeftOpen(false);
              setRightOpen(false);
            }}
            onEditRoom={() => {
              setShowRoomGeometry(true);
            }}
            onDuplicateRoom={duplicateRoom}
            onRemoveRoom={removeRoom}
            onVisitRoom={(id) => {
              selectRoom(id);
              setRoomView("interior");
              setView("perspective");
            }}
            onMove={moveRoom}
            onConnection={updateConnection}
            onNotice={setNotice}
            beginEdit={beginEdit}
            endEdit={endEdit}
          />
        )}
        <RoomPlannerControls
          onFurniture={() => {
            setKitchenOnly(false);
            setLeftOpen(!leftOpen || kitchenOnly);
          }}
          catalogOpen={leftOpen}
          view={roomView}
          onView={(next) => {
            setLocked(false);
            setCameraPlacement(false);
            setSelected(null);
            setSelectedWall(null);
            setSelectedOpening(null);
            setPlacementTemplate(null);
            setRoomView(next);
            setShowStartHint(false);
            setView(next === "top" ? "plan" : "perspective");
            if (next !== "interior")
              setCameraRequest((previous) => ({
                id: (previous?.id ?? 0) + 1,
                action: next === "dollhouse" ? "fit" : next,
              }));
          }}
          cameraPlacement={cameraPlacement}
          onCameraPlace={() => {
            setCameraPlacement(!cameraPlacement);
            setRoomView("top");
            setView("plan");
            setLocked(false);
            setSelected(null);
            setPlacementTemplate(null);
            setCameraRequest((previous) => ({
              id: (previous?.id ?? 0) + 1,
              action: "top",
            }));
          }}
          onZoom={navigateView}
          onRotate={navigateView}
          windowBearing={exteriorWindowBearing(current)}
          ceiling={current.ceiling}
          lighting={current.lighting}
          onLightingChange={(patch) =>
            updateRoom({ lighting: { ...current.lighting!, ...patch } })
          }
          beginLightingEdit={beginEdit}
          endLightingEdit={endEdit}
          onWindows={() => {
            if (roomView === "interior") navigateView("fit");
            setCameraPlacement(false);
            endEdit();
            setRoomDetailsTab("room");
            setSelected(null);
            setSelectedOpening(null);
            setSelectedWall(null);
            setPlacementTemplate("window-panoramic");
            setEnvironmentTab("openings");
            setRightOpen(true);
          }}
          onLightingSettings={() => {
            endEdit();
            setRoomDetailsTab("room");
            setPlacementTemplate(null);
            setEnvironmentTab("lighting");
            setRightOpen(true);
          }}
          onRoom={() => {
            endEdit();
            setPlacementTemplate(null);
            setRoomDetailsTab("room");
            setEnvironmentTab("room");
            setRightOpen(true);
          }}
          onMaterials={() => {
            endEdit();
            setRoomDetailsTab("room");
            setPlacementTemplate(null);
            setEnvironmentTab("surfaces");
            setRightOpen(true);
          }}
          onHelp={() => {
            setShowStartHint(false);
            setTourRequest((value) => value + 1);
          }}
          dimensions={showDimensions}
          onDimensions={() => setShowDimensions((value) => !value)}
          grid={gridEnabled}
          onGrid={() => setGridEnabled((value) => !value)}
          snap={snapEnabled}
          onSnap={() => setSnapEnabled((value) => !value)}
          locked={locked}
          onLock={() => setLocked((value) => !value)}
          expanded={expanded}
          onExpand={() => setExpanded((value) => !value)}
        />
        <div className="planner-room-caption">
          <strong>
            {current.roomName ?? "Зочны өрөө"} · {current.width} ×{" "}
            {current.depth} м
          </strong>
          <span>
            {geometry.area.toFixed(2)} м² ашиглах талбай ·{" "}
            {current.pieces.length} тавилга
          </span>
        </div>
        {showDimensions && (
          <div className="planner-measure-readout" role="status">
            <strong>
              <Ruler size={14} /> Хэмжээс · см
            </strong>
            {measurements.length ? (
              <>
                <span>{selectedDetails?.name ?? "Тавилга"}</span>
                <span>
                  {measurements
                    .filter((item) => item.kind === "size")
                    .map((item) => formatMeasurement(item.value))
                    .join(" × ")}{" "}
                  · өргөн × урт × өндөр
                </span>
                {measurements.find((item) => item.id === "ceiling") && (
                  <span>
                    Тааз хүртэл:{" "}
                    {formatMeasurement(
                      measurements.find((item) => item.id === "ceiling")!.value,
                    )}
                  </span>
                )}
                {(activePreset || localUrl) && (
                  <span>
                    Өөрийн 3D интерьерийн хана, таазны хэмжилт дэмжигдэхгүй.
                  </span>
                )}
              </>
            ) : activePreset || localUrl ? (
              <span>Хэмжих тавилга дээр дарна уу.</span>
            ) : (
              <>
                <span>{current.roomName ?? "Өрөө"}</span>
                <span>
                  {formatMeasurement(current.width)} ×{" "}
                  {formatMeasurement(current.depth)} · үндсэн өргөн × урт
                </span>
                <span>
                  Таазны өндөр · {formatMeasurement(current.height ?? 2.7)}
                </span>
                <span>
                  Өрөө тус бүрийг ханын дагуу хэмжинэ. Тавилгын хэмжээг харах
                  бол дээр нь дарна уу.
                </span>
              </>
            )}
          </div>
        )}

        {/* preset loading status */}
        {(activePreset || localFile) && (
          <div className="absolute left-1/2 top-24 z-20 -translate-x-1/2 rounded-full border border-ui-line bg-white/95 px-4 py-2 text-xs shadow-sm backdrop-blur md:top-16">
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
          {selectedOpening &&
            current.openings?.find((o) => o.id === selectedOpening) && (
              <details
                className="room-opening-context"
                open
                key={selectedOpening}
              >
                <summary>Хаалга, цонх засах</summary>
                <OpeningQuickEditor
                  room={current}
                  opening={current.openings.find(
                    (o) => o.id === selectedOpening,
                  )!}
                  onChange={changeOpening}
                  onRemove={removeSelected}
                  beginEdit={beginEdit}
                  endEdit={endEdit}
                />
              </details>
            )}
          {selectedOpening && (
            <>
              <button
                onClick={() => {
                  setEnvironmentTab("openings");
                  setRightOpen(true);
                }}
              >
                <DoorOpen size={16} /> Хаалга, цонхны тохиргоо
              </button>
              <button
                onClick={removeSelected}
                aria-label="Сонгосон нээлхийг устгах"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
          {selected && (
            <>
              <button
                onClick={() => {
                  setRoomDetailsTab("selection");
                  setEnvironmentTab("room");
                  setRightOpen(true);
                }}
                title="Сонгосон тавилгын тохиргоо"
                className="planner-selection-name"
              >
                <Settings size={16} />
                <span>{selectedDetails?.name ?? "Тавилга"}</span>
              </button>
              <button
                type="button"
                aria-label="Сонгосон тавилга дээр төвлөрөх"
                title="Сонгосон тавилга дээр төвлөрөх"
                onClick={() => {
                  setLocked(false);
                  setCameraPlacement(false);
                  setCameraRequest((previous) => ({
                    id: (previous?.id ?? 0) + 1,
                    action: "focus",
                    targetId: selected,
                  }));
                }}
              >
                <Focus size={16} />
                <span>Ойртуулж харах</span>
              </button>
              <button
                onClick={duplicateSelected}
                aria-label="Сонгосон тавилгыг хуулах"
                title="Хуулах (Ctrl+D)"
              >
                <Copy size={16} />
                <span>Хуулах</span>
              </button>
              <button
                onClick={rotateSelected}
                className="flex items-center gap-1.5 rounded-full bg-ui-accent px-3 py-2 text-xs font-medium text-[#FFFFFF]"
              >
                <RotateCw className="h-3 w-3" /> Эргүүлэх
              </button>
              <button
                type="button"
                onClick={() => {
                  setRoomDetailsTab("selection");
                  setEnvironmentTab("room");
                  setRightOpen(true);
                }}
              >
                <Move size={16} />
                <span>Байрлал</span>
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

        {!welcomeDismissed &&
          (showStartHint ||
            (current.pieces.length === 0 &&
              !leftOpen &&
              !rightOpen &&
              !summaryOpen)) &&
          !placementTemplate &&
          !selected &&
          !selectedOpening && (
            <div className="room-welcome-card">
              <button
                type="button"
                className="room-welcome-dismiss"
                aria-label="Эхлэх зөвлөмжийг хаах"
                onClick={() => {
                  setShowStartHint(false);
                  setWelcomeDismissed(true);
                }}
              >
                <X size={17} />
              </button>
              <span className="room-welcome-eyebrow">
                ӨӨРИЙНХӨӨ ӨРӨӨГ БҮТЭЭЕ
              </span>
              <strong>Өрөөгөө тохижуулж эхэлье</strong>
              <p className="room-welcome-intro">
                Тавилга нэмээд чирж байрлуулаарай. Сонгосон тавилгынхаа өнгө,
                материал, байрлалыг самбараас тохируулна.
              </p>
              <button
                type="button"
                className="room-welcome-start"
                onClick={() => {
                  setShowStartHint(false);
                  setKitchenOnly(false);
                  setLeftOpen(true);
                }}
              >
                <Plus size={18} /> Тавилга нэмэх
              </button>
              <button
                type="button"
                className="room-welcome-skip"
                onClick={() => {
                  setShowStartHint(false);
                  setRoomDetailsTab("room");
                  setEnvironmentTab("room");
                  setRightOpen(true);
                }}
              >
                Өрөөний хэмжээ тохируулах
              </button>
            </div>
          )}
        <div className="room-camera-guide" role="status">
          {cameraPlacement
            ? "Камер байрлуулах шалан дээр дарна уу · Esc цуцлах"
            : roomView === "interior"
              ? "W/A/S/D — өрөө дотор алхах · Чирэх — эргэн харах · Дугуй — харах өнцөг"
              : placementTemplate
                ? "Хаалга, цонх байрлуулах ханандаа дарна уу · Esc цуцлах"
                : selected
                  ? "Тавилгыг чирж байрлуулна · Эргүүлэх товч: 90° · Сумтай товч: 10 см"
                  : "Тавилга: дарж сонгох, чирж байрлуулах · Харах өнцөг: дунд товчоор чирэх · Ойртуулах: + / −"}
        </div>

        {roomView === "interior" && (
          <RoomTourControls
            design={current}
            locked={locked}
            onSelectRoom={selectRoom}
            onExit={() => navigateView("fit")}
            onFov={(fov) =>
              updateRoom({
                interiorCamera: { ...interiorCamera(current), fov },
              })
            }
            beginEdit={beginEdit}
            endEdit={endEdit}
          />
        )}
        {planReady && (
          <div
            className="room-plan-workspace"
            onPointerDownCapture={beginEdit}
            onPointerUp={endEdit}
            onPointerCancel={endEdit}
            onLostPointerCapture={endEdit}
          >
            <RoomWallPlan
              onSurfaceDoubleClick={(surface, wall, x, y) =>
                setSurfacePopup({ surface, wall, x, y })
              }
              key={current.activeRoomId}
              room={current}
              pieces={current.pieces}
              selectedPiece={selected}
              onSelectPiece={setSelected}
              onChange={applyRoomShape}
              onMovePiece={(id, x, z) => {
                const piece = current.pieces.find((p) => p.instanceId === id);
                if (!piece) return null;
                try {
                  const candidate = moveAttachedFurniture(
                    piece,
                    x,
                    z,
                    current,
                    current.activeRoomId ?? `${current.id}-room-1`,
                    current.pieces,
                  );
                  const pieces = resolveFurnitureAttachments(
                    current.pieces.map((p) =>
                      p.instanceId === id ? candidate : p,
                    ),
                    current,
                    current.activeRoomId ?? `${current.id}-room-1`,
                  );
                  const combined = placement.pieces.map(
                    (p) =>
                      pieces.find((next) => next.instanceId === p.instanceId) ??
                      p,
                  );
                  if (
                    !pieces.every((p) =>
                      isPlacementValid(p, combined, placement.room),
                    )
                  )
                    return "Тавилга өрөөний хана, багана эсвэл таазны хязгаараас гарч байна.";
                  updatePieces(pieces);
                  return null;
                } catch (reason) {
                  return (reason as Error).message;
                }
              }}
            />
            {selected && (
              <div className="room-plan-piece-actions">
                <button type="button" onClick={rotateSelected}>
                  Эргүүлэх
                </button>
                <button type="button" onClick={duplicateSelected}>
                  Хувилах
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedPiece) rememberFurniture(selectedPiece);
                    setNotice("Миний тавилгад хадгаллаа.");
                  }}
                >
                  Миний тавилгад
                </button>
                <button type="button" onClick={removeSelected}>
                  Устгах
                </button>
              </div>
            )}
          </div>
        )}
        <div
          className="planner-canvas h-full w-full pt-10 xl:pt-0"
          style={
            planReady
              ? { opacity: 0, pointerEvents: "none" }
              : roomView === "top"
                ? { pointerEvents: "none" }
                : undefined
          }
        >
          <RoomCanvas
            onExportReady={templateAdmin.isAdmin ? exportReady : undefined}
            paused={planReady}
            onViewSettled={(settledView) => {
              if (settledView === "plan") setSettledPlan(current.id);
            }}
            onPreview={savePreview}
            onPreviewReady={previewReady}
            onPlacementHintsReady={placementHintsReady}
            key={current.id}
            design={current}
            interior={roomView === "interior"}
            cameraPlacement={cameraPlacement}
            onCameraPlace={(x, z) => {
              if (!tourPointValid(current, x, z)) {
                setNotice(
                  "Камерыг өрөөний дотор, хана болон тавилгаас зайтай байрлуулна уу.",
                );
                return;
              }
              updateRoom({
                interiorCamera: { ...interiorCamera(current), x, z },
              });
              setCameraPlacement(false);
              setNotice(
                "Камерын байрлал хадгалагдлаа. Дотроос харах товчийг дарна уу.",
              );
            }}
            onCameraSave={(pose) => updateRoom({ interiorCamera: pose })}
            onVisitRoom={(id) => {
              selectRoom(id);
              setRoomView("interior");
              setView("perspective");
              setCameraPlacement(false);
              setLocked(false);
              setSelected(null);
              setPlacementTemplate(null);
              setShowStartHint(false);
            }}
            onSelectRoom={(id) => {
              selectRoom(id);
              setSelected(null);
              setSelectedOpening(null);
              setSelectedWall(null);
              setPlacementTemplate(null);
            }}
            selected={selected}
            onSelect={(id) => {
              setSelected(id);
              if (id) {
                setSelectedOpening(null);
                setSelectedWall(null);
                setPlacementTemplate(null);
                setRoomDetailsTab("selection");
                setEnvironmentTab("room");
                setRightOpen(true);
              }
            }}
            selectedWall={selectedWall}
            onSelectWall={selectWall}
            onSurfaceDoubleClick={(surface, wall, x, y) => {
              setSurfacePopup({ surface, wall, x, y });
              setSurface(surface);
              if (wall) selectWall(wall);
              setRightOpen(false);
            }}
            selectedOpening={selectedOpening}
            onSelectOpening={selectOpening}
            onUpdateOpening={changeOpening}
            placementTemplate={placementTemplate}
            onPlaceOpening={(wall, position) => {
              if (placementTemplate)
                addOpening(placementTemplate, wall, position);
            }}
            onPlacementError={setNotice}
            onMove={onMove}
            view={view}
            snapEnabled={snapEnabled}
            locked={locked}
            gridEnabled={gridEnabled}
            showDimensions={showDimensions}
            measurements={measurements}
            resetKey={resetKey}
            cameraRequest={cameraRequest}
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

      <Drawer
        side="right"
        open={summaryOpen}
        active={summaryOpen}
        onClose={() => setSummaryOpen(false)}
        title="Төслийн тойм"
      >
        <div className="room-summary-content">
          <h2>{current.name}</h2>
          <p>
            {current.roomName ?? "Миний өрөө"} · {geometry.area.toFixed(1)} м² ·{" "}
            {current.pieces.length} тавилга
          </p>
          <div className="room-summary-total">
            <span>Тавилгын нийт үнэ</span>
            <strong>{formatPrice(totalPrice)}</strong>
          </div>
          <p className="room-summary-note">
            Энэ өрөөнд байрлуулсан тавилгын үнэ. Өөрийн гарнитурын үнийг тусад
            нь тооцно.
          </p>
          {!current.pieces.length && (
            <div className="planner-empty">
              Өрөө тань одоогоор хоосон байна.
              <button
                type="button"
                className="planner-secondary-button"
                onClick={() => setLeftOpen(true)}
              >
                <Plus size={16} /> Тавилга нэмэх
              </button>
            </div>
          )}
          <div className="room-summary-list">
            {current.pieces.map((piece, index) => (
              <button
                type="button"
                key={piece.instanceId}
                onClick={() => {
                  setSelected(piece.instanceId);
                  setSelectedOpening(null);
                  setSelectedWall(null);
                  setRoomDetailsTab("selection");
                  setEnvironmentTab("room");
                  setRightOpen(true);
                }}
              >
                <span>{index + 1}</span>
                <div>
                  <strong>
                    {piece.kitchen?.name ??
                      getProduct(piece.productId)?.name ??
                      getDbPieceModel(piece)?.name ??
                      "Тавилга"}
                  </strong>
                  <small>
                    {piece.kitchen
                      ? "Өөрийн гарнитур"
                      : formatPrice(getPiecePrice(piece))}
                  </small>
                </div>
                <ChevronRight size={16} />
              </button>
            ))}
          </div>
          <button
            type="button"
            className="room-summary-cart"
            disabled={!current.pieces.length}
            onClick={buyEverything}
          >
            <ShoppingBag size={18} /> Тавилгыг сагсанд нэмэх
          </button>
          <Link className="room-summary-cart-link" href="/cart">
            Сагс харах <ChevronRight size={16} />
          </Link>
          <button
            type="button"
            className="planner-secondary-button"
            onClick={save}
          >
            <Save size={17} /> Загвар хадгалах
          </button>
          <p className="planner-storage-note">
            Ажлын явц энэ төхөөрөмж дээр автоматаар үлдэнэ.
          </p>
          <Link className="room-summary-cart-link" href="/kitchen">
            Гал тогооны төлөвлөгч <ChevronRight size={16} />
          </Link>
        </div>
      </Drawer>

      {/* RIGHT: properties + saved designs */}
      <Drawer
        side="right"
        open={rightOpen}
        active={inspector === "environment" && rightOpen}
        onClose={() => setRightOpen(false)}
        title={
          environmentTab === "surfaces"
            ? "Өнгө, материал"
            : environmentTab === "openings"
              ? "Хаалга, цонх"
              : environmentTab === "lighting"
                ? "Гэрэлтүүлэг"
                : roomDetailsTab === "selection"
                  ? "Тавилгын тохиргоо"
                  : roomDetailsTab === "project"
                    ? "Миний загварууд"
                    : "Өрөө засах"
        }
      >
        <nav
          className="room-environment-tabs"
          aria-label="Өрөөний тохиргооны хэсэг"
        >
          {(
            [
              { id: "room", label: "Өрөө", Icon: House },
              { id: "surfaces", label: "Материал", Icon: Paintbrush },
              { id: "openings", label: "Хаалга, цонх", Icon: DoorOpen },
              { id: "lighting", label: "Гэрэл", Icon: Lightbulb },
            ] as const
          ).map(({ id, label, Icon }) => (
            <button
              key={id}
              aria-pressed={environmentTab === id}
              onClick={() => {
                endEdit();
                setEnvironmentTab(id);
                setPlacementTemplate(null);
              }}
            >
              <Icon size={19} />
              <span>{label}</span>
            </button>
          ))}
        </nav>
        {environmentTab !== "room" && (
          <>
            {(activePreset || localFile) && (
              <div className="room-custom-notice">
                <p>Өрөөг тохируулахын тулд үндсэн өрөө рүү шилжинэ үү.</p>
                <button
                  className="room-secondary-action"
                  onClick={() => {
                    setActivePreset(null);
                    setLocalFile(null);
                    setLocalUrl(null);
                  }}
                >
                  Үндсэн өрөөг харуулах
                </button>
              </div>
            )}
            <RoomEnvironmentPanel
              key={`${current.id}:${current.activeRoomId}:${environmentTab}`}
              design={current}
              tab={environmentTab}
              surface={surface}
              onSurfaceChange={setSurface}
              selectedWall={selectedWall}
              onSelectWall={selectWall}
              selectedOpening={selectedOpening}
              onSelectOpening={selectOpening}
              placementTemplate={placementTemplate}
              onArmPlacement={armPlacement}
              onAddOpening={addOpening}
              onUpdateOpening={changeOpening}
              onUpdate={(patch) => {
                if (patch.ceiling || patch.lighting?.fixtures) {
                  const next = syncDesignRooms({ ...current, ...patch });
                  if (layoutClearanceIssue(current, next)) {
                    setNotice(
                      "Тааз эсвэл гэрэл тавилгатай тулж байна. Уналт, унжих уртыг багасгах эсвэл тавилгыг зөөнө үү.",
                    );
                    return;
                  }
                }
                updateRoom(patch);
                setShowStartHint(false);
                setActivePreset(null);
                setLocalFile(null);
                setLocalUrl(null);
              }}
              onHeight={(height) => {
                if (!Number.isFinite(height) || height < 2.4 || height > 3) {
                  setNotice("Таазны өндөр 240–300 см байна.");
                  return;
                }
                const issue = applyRoomShape({
                  width: current.width,
                  depth: current.depth,
                  height,
                });
                if (issue) setNotice(issue);
              }}
              onNotice={setNotice}
              beginEdit={beginEdit}
              endEdit={endEdit}
            />
          </>
        )}
        <div hidden={environmentTab !== "room"}>
          <div className="planner-inspector-intro">
            <h2>
              {roomDetailsTab === "room"
                ? "Өрөөний хэмжээ"
                : roomDetailsTab === "selection"
                  ? "Тавилгаа тохируулах"
                  : "Хадгалсан загварууд"}
            </h2>
            <p>
              {roomDetailsTab === "room"
                ? "Бодит хэмжээгээ сонгосон нэгжээр оруулаарай."
                : roomDetailsTab === "selection"
                  ? "Чирж байрлуулах эсвэл доорх сумтай товчоор хөдөлгөөрэй."
                  : "Энэ төхөөрөмж дээрх загваруудаа эндээс нээнэ."}
            </p>
          </div>
          <div hidden={roomDetailsTab !== "project"}>
            <div className="border-b border-ui-line p-4">
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
              <p className="planner-storage-note">
                {storageStatus?.label}
                <br />
                {storageStatus?.detail}
              </p>
            </div>
          </div>
          <div hidden={roomDetailsTab !== "room"}>
            <div className="border-b border-ui-line p-4">
              <div className="room-basic-dimensions">
                <RoomMeasureUnit />
                {(
                  [
                    ["width", "Өргөн"],
                    ["depth", "Урт"],
                    ["height", "Таазны өндөр"],
                  ] as const
                ).map(([key, label]) => (
                  <RoomMeasureInput
                    key={key}
                    beginEdit={beginEdit}
                    endEdit={endEdit}
                    label={label}
                    value={(current[key] ?? 2.7) * 100}
                    min={key === "height" ? 240 : 100}
                    max={key === "height" ? 300 : 2000}
                    step={10}
                    onChange={(value) => {
                      const issue = applyRoomShape({
                        ...current,
                        [key]: value / 100,
                      });
                      if (issue) setNotice(issue);
                    }}
                  />
                ))}
                <p className="room-size-note">
                  {geometry.area.toFixed(1)} м² талбай · Хэмжээг өөрчилсний
                  дараа Enter дарна уу.
                </p>
              </div>
              <details className="room-multiple-rooms">
                <summary>
                  <House size={16} /> Өрөөний нэр, төрөл, нэмэлт өрөө
                </summary>
                <section className="planner-rooms" aria-label="Өрөөнүүд">
                  <p className="label mb-3">
                    Өрөөнүүд · {current.rooms?.length ?? 1}
                  </p>
                  <label className="planner-number">
                    <span>Тохируулах өрөө</span>
                    <select
                      value={current.activeRoomId ?? ""}
                      onChange={(event) => selectRoom(event.target.value)}
                    >
                      {current.rooms?.map((room) => (
                        <option value={room.id} key={room.id}>
                          {room.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="planner-number">
                    <span>Өрөөний нэр</span>
                    <input
                      value={current.roomName ?? ""}
                      onFocus={beginEdit}
                      onBlur={endEdit}
                      onChange={(event) =>
                        updateRoom({ roomName: event.target.value })
                      }
                    />
                  </label>
                  <label className="planner-number">
                    <span>Өрөөний төрөл</span>
                    <select
                      value={current.roomType ?? "living"}
                      onChange={(event) =>
                        updateRoom({ roomType: event.target.value as RoomType })
                      }
                    >
                      {Object.entries(ROOM_TYPES).map(([type, option]) => (
                        <option key={type} value={type}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="planner-add-room">
                    <label className="planner-number">
                      <span>Нэмэх өрөө</span>
                      <select
                        value={newRoomType}
                        onChange={(event) =>
                          setNewRoomType(event.target.value as RoomType)
                        }
                      >
                        {Object.entries(ROOM_TYPES).map(([type, option]) => (
                          <option key={type} value={type}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <button
                      type="button"
                      className="btn-ghost"
                      onClick={() => {
                        setAddRoomType(newRoomType);
                        setLeftOpen(false);
                        setRightOpen(false);
                        setRoomMapOpen(true);
                      }}
                    >
                      <Plus size={16} /> Нэмэх
                    </button>
                  </div>
                  <p className="room-shape-help">
                    Өрөө бүрийн хэмжээ, хана, өнгө, тавилга тусдаа хадгалагдана.
                    Нэг төрлийн хэд хэдэн өрөө нэмж болно.
                  </p>
                  {current.roomType === "kitchen" && (
                    <Link className="planner-kitchen-link" href="/kitchen">
                      Гарнитур төлөвлөх <ArrowRight size={15} />
                    </Link>
                  )}
                </section>
              </details>
              <button
                type="button"
                className="room-geometry-trigger"
                aria-haspopup="dialog"
                onClick={() => setShowRoomGeometry(true)}
              >
                <Ruler size={20} />
                <span>
                  <strong>Ханын хэлбэр, багана тохируулах</strong>
                  <small>
                    {Number((current.width * measureFactor).toFixed(1))} ×{" "}
                    {Number((current.depth * measureFactor).toFixed(1))}{" "}
                    {measureUnit} · {geometry.area.toFixed(2)} м²
                  </small>
                  <small>
                    Ханын хэсэг {current.wallFeatures?.length ?? 0} · Багана{" "}
                    {current.columns?.length ?? 0}
                  </small>
                </span>
                <ArrowRight size={17} />
              </button>
              <button
                className="room-secondary-action mt-4"
                onClick={() => setEnvironmentTab("surfaces")}
              >
                <Paintbrush size={16} /> Шал, хана, таазны материал
              </button>
              <button
                type="button"
                className="room-welcome-start room-size-done"
                onClick={() => {
                  endEdit();
                  setRightOpen(false);
                }}
              >
                Болсон, тавилга байрлуулах <Check size={17} />
              </button>
            </div>
          </div>
          <div hidden={roomDetailsTab !== "selection"}>
            {selectedPiece && selectedDetails ? (
              <div className="border-b border-ui-line p-4">
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
                    <p className="text-sm font-medium">
                      {selectedDetails.name}
                    </p>
                    <p className="mt-1 text-xs">
                      {selectedPiece.kitchen
                        ? "Өөрийн гарнитур"
                        : stockLabel(selectedProduct ?? selectedDbModel ?? {})}
                    </p>
                    <p className="font-mono text-xs text-ui-muted">
                      {selectedDetails.basePrice > 0
                        ? formatPrice(getPiecePrice(selectedPiece))
                        : "Үнэ тогтоогдоогүй"}
                    </p>
                  </div>
                </div>
                <div
                  className="room-selection-size"
                  aria-label="Тавилгын хэмжээ"
                >
                  {Object.entries(dimsFor(selectedPiece)).map(
                    ([axis, value]) => (
                      <span key={axis}>
                        <small>
                          {axis === "w"
                            ? "Өргөн"
                            : axis === "d"
                              ? "Гүн"
                              : "Өндөр"}
                        </small>
                        <strong>{formatMeasurement(value)}</strong>
                      </span>
                    ),
                  )}
                </div>
                <div className="room-selection-actions">
                  <button type="button" onClick={rotateSelected}>
                    <RotateCw size={16} /> Эргүүлэх
                  </button>
                  <button type="button" onClick={duplicateSelected}>
                    <Copy size={16} /> Хувилах
                  </button>
                  <button type="button" onClick={removeSelected}>
                    <Trash2 size={16} /> Устгах
                  </button>
                </div>
                <RoomProductAlternatives
                  key={selectedPiece.instanceId}
                  piece={selectedPiece}
                  product={selectedProduct}
                  products={catalog.products}
                  pieces={current.pieces}
                  room={current}
                  roomId={current.activeRoomId ?? `${current.id}-room-1`}
                  context={placement}
                  onReplace={updatePieces}
                  onNotice={setNotice}
                />
                {showDimensions && measurements.length > 0 && (
                  <section
                    className="planner-measure-details"
                    aria-label="Сонгосон тавилгын хэмжээс"
                  >
                    <h3>Хэмжээ ба зай · см</h3>
                    <dl>
                      {measurements.map((item) => (
                        <div key={item.id}>
                          <dt>{item.label}</dt>
                          <dd>{formatMeasurement(item.value)}</dd>
                        </div>
                      ))}
                    </dl>
                    <p>
                      Ханын зайг тавилгын гадна хүрээнээс хэмжинэ. Багана урд нь
                      байвал багана хүртэлх зай гарна.
                    </p>
                  </section>
                )}
                <FurnitureAttachmentControls
                  piece={selectedPiece}
                  pieces={current.pieces}
                  room={current}
                  roomId={current.activeRoomId ?? `${current.id}-room-1`}
                  onChange={(candidate) => {
                    try {
                      const pieces = resolveFurnitureAttachments(
                        current.pieces.map((p) =>
                          p.instanceId === candidate.instanceId ? candidate : p,
                        ),
                        current,
                        current.activeRoomId ?? `${current.id}-room-1`,
                      );
                      if (
                        !pieces.every((p) =>
                          isPlacementValid(p, pieces, placement.room),
                        )
                      )
                        return "Тавилга өрөөний хана, багана эсвэл таазны хязгаараас гарч байна.";
                      updatePieces(pieces);
                      return null;
                    } catch (reason) {
                      return (reason as Error).message;
                    }
                  }}
                />
                <div className="planner-transform">
                  <p className="label">Байрлал · өрөөний төвөөс</p>
                  <div className="planner-fields">
                    <NumberControl
                      label="Хажуу тийш · метр"
                      value={selectedPiece.x}
                      min={geometry.bounds.minX}
                      max={geometry.bounds.maxX}
                      step={0.1}
                      onCommit={(x) => transformSelected({ x })}
                    />
                    <NumberControl
                      label="Урагш, хойш · метр"
                      value={selectedPiece.z}
                      min={geometry.bounds.minZ}
                      max={geometry.bounds.maxZ}
                      step={0.1}
                      onCommit={(z) => transformSelected({ z })}
                    />
                  </div>
                  <NumberControl
                    label="Эргэлт · градус"
                    value={
                      Math.round(
                        ((selectedPiece.rotation * 180) / Math.PI) * 100,
                      ) / 100
                    }
                    min={0}
                    max={360}
                    step={15}
                    onCommit={(degrees) =>
                      transformSelected({
                        rotation: ((degrees % 360) * Math.PI) / 180,
                      })
                    }
                  />
                  <div className="planner-nudge" aria-label="10 см шилжүүлэх">
                    <button
                      aria-label="Зүүн тийш 10 см"
                      onClick={() => nudge(-0.1, 0)}
                    >
                      <ArrowLeft size={17} />
                    </button>
                    <button
                      aria-label="Хойш 10 см"
                      onClick={() => nudge(0, -0.1)}
                    >
                      <ArrowUp size={17} />
                    </button>
                    <span>10 см</span>
                    <button
                      aria-label="Урагш 10 см"
                      onClick={() => nudge(0, 0.1)}
                    >
                      <ArrowDown size={17} />
                    </button>
                    <button
                      aria-label="Баруун тийш 10 см"
                      onClick={() => nudge(0.1, 0)}
                    >
                      <ArrowRight size={17} />
                    </button>
                  </div>
                  <div className="planner-fields">
                    <button
                      className="btn-ghost !px-2 !py-2"
                      onClick={duplicateSelected}
                    >
                      <Copy size={15} /> Хуулах
                    </button>
                    <button
                      className="btn-ghost !px-2 !py-2 text-red-700"
                      onClick={removeSelected}
                    >
                      <Trash2 size={15} /> Устгах
                    </button>
                  </div>
                </div>
                {selectedPiece.kitchen ? (
                  <p className="mt-4 text-xs leading-5">
                    Бодит хэмжээгээр байрласан гарнитур.{" "}
                    <Link
                      className="underline"
                      href={`/kitchen?design=${selectedPiece.kitchen.id}`}
                    >
                      Гарнитурын тохиргоог нээх →
                    </Link>
                    <br />
                    Зассан хувилбарыг хадгалж, Өөрийн загвараас дахин оруулна.
                  </p>
                ) : (
                  <>
                    <p className="label mb-2 mt-4">Өнгө</p>

                    <div className="flex flex-wrap gap-1.5">
                      {selectedDetails.colors.map((color) => (
                        <button
                          key={color.id}
                          type="button"
                          aria-label={color.name}
                          aria-pressed={selectedPiece.color === color.id}
                          onClick={() => {
                            if (
                              selectedPiece.color !== color.id &&
                              !selectedPiece.modelId
                            )
                              trackProduct3d(
                                selectedPiece.productId,
                                "color",
                                color.id,
                              );
                            updatePieces(
                              current.pieces.map((piece) =>
                                piece.instanceId === selectedPiece.instanceId
                                  ? { ...piece, color: color.id }
                                  : piece,
                              ),
                            );
                          }}
                          style={{ background: color.hex }}
                          className={cn(
                            "h-7 w-7 rounded-full border-2",
                            selectedPiece.color === color.id
                              ? "border-ui-line"
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
                          onClick={() => {
                            if (
                              selectedPiece.material !== material.id &&
                              !selectedPiece.modelId
                            )
                              trackProduct3d(
                                selectedPiece.productId,
                                "material",
                                material.id,
                              );
                            updatePieces(
                              current.pieces.map((piece) =>
                                piece.instanceId === selectedPiece.instanceId
                                  ? { ...piece, material: material.id }
                                  : piece,
                              ),
                            );
                          }}
                          className={cn(
                            "rounded-full border px-3 py-1.5 text-xs transition",
                            selectedPiece.material === material.id
                              ? "border-ui-line bg-ui-accent text-white"
                              : "border-ui-line bg-white text-ui-muted hover:border-ui-line",
                          )}
                        >
                          {material.name}
                          {material.priceDelta > 0 &&
                            ` (+${formatPrice(material.priceDelta)})`}
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="border-b border-ui-line p-4 text-xs text-ui-muted">
                Тавилга дээр дарж тохиргоог нь өөрчилнө үү.
              </div>
            )}

            <section className="planner-object-list">
              <p className="label">
                <Layers size={15} /> Өрөөн дэх тавилга · {current.pieces.length}
              </p>
              {!current.pieces.length && (
                <div className="planner-empty">
                  <p>Одоогоор тавилга нэмээгүй байна.</p>
                  <button
                    type="button"
                    className="planner-secondary-button"
                    onClick={() => setLeftOpen(true)}
                  >
                    <Plus size={16} /> Тавилга нэмэх
                  </button>
                </div>
              )}
              {current.pieces.map((piece, index) => (
                <button
                  key={piece.instanceId}
                  aria-pressed={selected === piece.instanceId}
                  onClick={() => {
                    setSelected(piece.instanceId);
                    setRightOpen(true);
                  }}
                >
                  <span className="planner-object-number">{index + 1}</span>
                  <span>
                    <strong>
                      {piece.kitchen?.name ??
                        getProduct(piece.productId)?.name ??
                        getDbPieceModel(piece)?.name ??
                        "Тавилга"}
                    </strong>
                    <small>
                      {piece.kitchen
                        ? "Өөрийн гарнитур · бодит хэмжээ"
                        : formatPrice(getPiecePrice(piece))}
                    </small>
                  </span>
                  <Move size={14} />
                </button>
              ))}
            </section>
          </div>
          <div hidden={roomDetailsTab !== "project"}>
            <details className="planner-advanced">
              <summary>Нэмэлт · 3D файл оруулах</summary>
              <div className="planner-advanced-fields">
                <select
                  value={
                    ROOM_DIMENSIONS[current.size].w === current.width &&
                    ROOM_DIMENSIONS[current.size].d === current.depth
                      ? current.size
                      : "custom"
                  }
                  onChange={(e) => resizeRoom(e.target.value as RoomSize)}
                  className="rounded-full border border-ui-line bg-white/90 px-3 py-2 text-xs font-medium backdrop-blur"
                >
                  <option value="custom" disabled>
                    Өөрийн хэмжээ · {current.width} × {current.depth} м
                  </option>
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
                        : "border-ui-line bg-white/90 text-ui-muted",
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
                      : "border-ui-line bg-white/90 text-ui-muted",
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
                        setLocalScale(
                          Math.min(
                            1000,
                            Math.max(
                              0.001,
                              parseFloat(e.target.value) || 0.001,
                            ),
                          ),
                        )
                      }
                      title="Масштаб (scale)"
                      className="w-16 rounded-full border border-ui-line bg-white/90 px-2 py-2 text-center text-xs font-mono backdrop-blur"
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
              </div>
              <p>
                Оруулсан GLB файл зөвхөн энэ удаагийн харагдацад ашиглагдана.
              </p>
            </details>
            <details className="planner-advanced">
              <summary>Гарын товчлол</summary>
              <p>
                Ctrl / ⌘ + Z — буцаах
                <br />
                Ctrl / ⌘ + Shift + Z — дахин хийх
                <br />
                Ctrl / ⌘ + D — тавилга хуулах
                <br />
                Ctrl / ⌘ + S — хадгалах
                <br />
                Сумнууд — 10 см шилжүүлэх
                <br />R — 90° эргүүлэх · Delete — устгах
                <br />
                Esc — сонголт цуцлах
              </p>
            </details>
            <div className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="label">Хадгалсан загвар · {designs.length}</p>
                {designs.length >= 2 && (
                  <button
                    onClick={() => setShowCompare(true)}
                    disabled={
                      designs.filter((design) => compareIds.includes(design.id))
                        .length < 2
                    }
                    title="Доороос 2–4 загвар сонгож харьцуулна"
                    className="text-xs font-medium text-[#AD6547] hover:underline"
                  >
                    <Layers className="mr-1 inline h-3 w-3" /> Харьцуулах
                  </button>
                )}
              </div>
              {designs.length === 0 && (
                <p className="rounded-lg bg-ui-ink/5 p-4 text-xs text-ui-muted">
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
                        : "border-ui-line hover:border-ui-line",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{d.name}</p>
                        <p className="text-xs text-ui-muted">
                          {d.rooms?.length ?? 1} өрөө ·{" "}
                          {d.roomName ?? "Зочны өрөө"} ·{" "}
                          {getRoomGeometry(d).area.toFixed(1)} м²
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 gap-1">
                        <button
                          onClick={() => loadDesign(d.id)}
                          className="rounded-md p-1.5 hover:bg-ui-ink/5"
                          title="Нээх"
                        >
                          <Maximize className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => duplicateDesign(d.id)}
                          className="rounded-md p-1.5 hover:bg-ui-ink/5"
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
                      <span className="text-xs text-ui-muted">
                        Харьцуулахаар сонгох
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-ui-line p-4">
              <button
                onClick={() => {
                  endEdit();
                  setLeftOpen(false);
                  setRightOpen(false);
                  previewCapture.current?.();
                  setRoomStartOpen(true);
                }}
                className="btn-ghost w-full"
              >
                <Plus className="h-4 w-4" /> Шинэ загвар үүсгэх
              </button>
            </div>
          </div>
        </div>
      </Drawer>

      {addRoomType && (
        <RoomAddDialog
          type={addRoomType}
          onClose={() => setAddRoomType(null)}
          onAdd={(type, options) => {
            if (
              options.furnishing === "preset" &&
              !suggestedFurniture(type, catalog.products).length
            )
              throw new Error(
                "Энэ төрлийн өрөөний 3D тавилга каталогт бэлэн болоогүй байна.",
              );
            if (options.furnishing === "mine" && !options.furnitureIds?.length)
              throw new Error("Миний тавилгын сангаас тавилгаа сонгоно уу.");
            addRoom(type, options);
            const latest = useDesigns.getState().current!;
            const result = furnishRoom(
              latest,
              type,
              options,
              catalog.products,
              furniture ?? [],
              latest.activeRoomId,
            );
            updatePieces(result.pieces);
            result.pieces.forEach((piece) => rememberFurniture(piece));
            setRecommendationsOpen((options.furnishing ?? "empty") !== "empty");
            if (result.skipped.length)
              setNotice(`Багтаагүй тавилга: ${result.skipped.join(", ")}.`);
            setAddRoomType(null);
            setRoomMapOpen(true);
            setCameraPlacement(false);
            setShowStartHint(false);
          }}
        />
      )}
      {surfacePopup && (
        <RoomSurfacePopover
          key={`${current.activeRoomId}:${surfacePopup.surface}:${surfacePopup.wall}`}
          selection={surfacePopup}
          design={current}
          onSurfaceChange={(surface) =>
            setSurfacePopup({ ...surfacePopup, surface })
          }
          onSelectWall={(wall) =>
            setSurfacePopup({ ...surfacePopup, wall: wall ?? undefined })
          }
          onClose={() => setSurfacePopup(null)}
          beginEdit={beginEdit}
          endEdit={endEdit}
          onUpdate={(patch) => {
            if (patch.height !== undefined) {
              const issue = applyRoomShape({
                ...current,
                height: patch.height,
              });
              if (issue) setNotice(issue);
              return;
            }
            if (patch.ceiling || patch.lighting) {
              const next = syncDesignRooms({ ...current, ...patch });
              if (layoutClearanceIssue(current, next)) {
                setNotice("Тааз эсвэл гэрэл тавилгатай тулж байна.");
                return;
              }
            }
            updateRoom(patch);
          }}
        />
      )}
      {showRoomGeometry && (
        <RoomGeometryModal
          key={`${current.id}:${current.activeRoomId}`}
          room={current}
          onApply={applyRoomShape}
          selectedPiece={selected}
          onSelectPiece={setSelected}
          onMovePiece={(id, x, z) => {
            const piece = current.pieces.find((p) => p.instanceId === id);
            if (!piece) return null;
            if (
              !isPlacementValid(
                { ...piece, x, z },
                placement.pieces,
                placement.room,
              )
            )
              return "Энэ байрлалд хана эсвэл өөр тавилга байна.";
            onMove(id, x, z);
            return null;
          }}
          onClose={() => setShowRoomGeometry(false)}
          beginEdit={beginEdit}
          endEdit={endEdit}
        />
      )}
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
