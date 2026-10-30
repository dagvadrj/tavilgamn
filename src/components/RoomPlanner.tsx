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
  type RoomPanelTab,
  type RoomPanelView,
} from "@/features/room-planner/hooks/useRoomPlannerUi";
import {
  CompareModal,
  NumberControl,
  PlannerSkeleton,
} from "@/features/room-planner/components/PlannerPanels";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RoomPlannerStart } from "@/features/room-planner/components/RoomPlannerStart";
import {
  sortPlannerCatalog,
  type PlannerCatalogSort,
} from "@/features/planner/components/PlannerCatalogToolbar";
import { RoomCatalogFilters } from "@/features/room-planner/components/RoomCatalogFilters";
import { RoomPlacementHelp } from "@/features/room-planner/components/RoomPlacementHelp";
import { useRoomSaveStatus } from "@/features/room-planner/hooks/useRoomSaveStatus";
import { roomSaveChip } from "@/lib/roomSaveStatus";
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
  DEFAULT_ROOM_CATALOG_FILTERS,
  roomPlannerCatalog,
  type RoomCatalogScope,
} from "@/lib/roomCatalogPolicy";
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
  Repeat,
  Combine,
} from "lucide-react";
import {
  RoomProductOptions,
  RoomProductPairings,
  RoomVariantStatus,
  type ProductOptionsMode,
} from "@/features/room-planner/components/RoomProductOptions";
import {
  RoomSelectionToolbar,
  type SelectionAction,
} from "@/features/room-planner/components/RoomSelectionToolbar";
import { RoomHeaderCounts } from "@/features/room-planner/components/RoomHeaderCounts";
import { complementaryProducts } from "@/lib/roomProductOptions";
import { priceFor } from "@/lib/products";
import { getProduct, useCatalog, useCatalogStore } from "@/store/catalog";
import { hasAvailableStock } from "@/lib/inventory";
import {
  RoomCatalogEmpty,
  RoomCatalogError,
  RoomCatalogSkeleton,
} from "@/features/room-planner/components/RoomCatalogStates";
import { useDesigns, ROOM_DIMENSIONS } from "@/store/designs";
import { stockLabel } from "@/lib/inventory";
import { useCart } from "@/store/cart";
import type {
  PlacedFurniture,
  Product,
  RoomDesign,
  RoomSize,
  Material,
  RoomShape,
  RoomType,
  RoomWall,
  RoomOpening,
} from "@/lib/types";
import { getRoomGeometry, ROOM_TYPES } from "@/lib/roomGeometry";
import { roomSetupNumber } from "@/lib/roomSetup";
import { kitchenFittedRoom } from "@/lib/kitchenRoomFit";
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
// Last: the workspace panel owns the editor layout over the older inspector styles.
import "@/features/room-planner/components/room-workspace.css";
import {
  RoomCatalogCard,
  formatFurnitureCm,
} from "@/features/room-planner/components/RoomCatalogCard";
import {
  RoomWorkspacePanel,
  ROOM_PANEL_TABS,
} from "@/features/room-planner/components/RoomWorkspacePanel";
import {
  RoomAddedList,
  type RoomAddedRow,
} from "@/features/room-planner/components/RoomAddedList";
import {
  RoomCartList,
  RoomCartFooter,
} from "@/features/room-planner/components/RoomCartList";
import { RoomSummaryModal } from "@/features/room-planner/components/RoomSummaryModal";
import { useStoreNames } from "@/features/room-planner/hooks/useStoreNames";
import { useRoomModelStatus } from "@/store/roomModelStatus";
import {
  MerchantConflictDialog,
  MerchantPublishDialog,
  MerchantRoomCameraPanel,
  MerchantRoomHeader,
  MerchantRoomPreview,
  useMerchantRoomEditor,
} from "@/features/room-planner/components/MerchantRoomEditor";
import { defaultCartSelection } from "@/lib/homeMarketplace";
import type { CartItem } from "@/lib/types";
import { type DbModelInfo, getDbModel } from "@/lib/modelRegistry";

const RoomCanvas = dynamic(
  () => import("@/three/RoomCanvas").then((m) => m.RoomCanvas),
  { ssr: false, loading: () => <PlannerSkeleton /> },
);

const STATIC_PRESETS: CustomInterior[] = [
  {
    id: "tvfurniture",
    basePath: "/models/tv/",
    glb: "tv.glb",
    scale: 0.001,
    label: "tv (өөрийн загвар)",
  },
];

const modelThumbnail = (model: DbModelInfo | null | undefined) =>
  model?.thumbnailFile
    ? `/api/models/files/${model.fileModelId ?? model.id}/${model.thumbnailFile}`
    : null;

/** One cart line of a catalog product in a chosen variant. */
const cartLine = (
  product: Product,
  variant: Pick<CartItem, "color" | "material" | "unitPrice">,
) => ({
  productId: product.id,
  name: product.name,
  image: product.image,
  ...variant,
  qty: 1,
  stockQuantity: product.stockQuantity,
  madeToOrder: product.madeToOrder,
});

/** Below 960px the panel is an overlay drawer or sheet, not a column. */
const narrowPanel = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(max-width: 959px)").matches;

const ROOM_EDITOR_OPEN_KEY = "casa-room-editor-open";
const PLACED_KITCHEN_KEY = "casa-room-placed-kitchen";

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
  const refreshedForKitchen = useRef<string | null>(null);
  const [kitchenOnly, setKitchenOnly] = useState(false);
  const [catalogScope, setCatalogScope] = useState<RoomCatalogScope>(
    DEFAULT_ROOM_CATALOG_FILTERS.scope,
  );
  const [catalogFormat, setCatalogFormat] = useState<"all" | "glb" | "photo">(
    "all",
  );
  // Returning to /planner in the same tab reopens the room that was being edited
  // instead of the start screen.
  const [roomStartOpen, setRoomStartOpen] = useState(() => {
    try {
      return !current || sessionStorage.getItem(ROOM_EDITOR_OPEN_KEY) !== current.id;
    } catch {
      return true;
    }
  });
  const currentId = current?.id;
  useEffect(() => {
    try {
      if (!roomStartOpen && currentId) sessionStorage.setItem(ROOM_EDITOR_OPEN_KEY, currentId);
      else if (roomStartOpen) sessionStorage.removeItem(ROOM_EDITOR_OPEN_KEY);
    } catch {
      /* Without session storage the start screen still offers to resume the draft. */
    }
  }, [roomStartOpen, currentId]);
  const loadTemplate = useCallback((design: RoomDesign) => {
    useDesigns.getState().importTemplate(design);
    setRoomStartOpen(false);
    return useDesigns.getState().current!.id;
  }, []);
  const templateAdmin = useRoomTemplateAdmin(loadTemplate);
  // C3: `?merchantRoom=` edits a store's own furnished room.
  const merchantRoom = useMerchantRoomEditor(loadTemplate);
  const merchantMode = merchantRoom.active && !!merchantRoom.meta;
  const [merchantDialog, setMerchantDialog] = useState<
    "publish" | "preview" | null
  >(null);
  useEffect(() => {
    if (merchantMode) setRoomStartOpen(false);
  }, [merchantMode]);
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
  const [handTool, setHandTool] = useState(false);
  const {
    panelOpen,
    setPanelOpen,
    panelTab,
    setPanelTab,
    panelView,
    setPanelView,
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
    optionsMode,
    setOptionsMode,
    optionsReveal,
    setOptionsReveal,
  } = useRoomPlannerUi();
  // The nested views reuse the former inspector sections unchanged.
  const roomDetailsTab =
    panelView === "detail"
      ? "selection"
      : panelView === "designs"
        ? "project"
        : "room";
  /** Opens a tab list; on drawer/sheet widths closing hands the screen back. */
  const setLeftOpen = useCallback(
    (open: boolean) => {
      if (open) {
        setPanelOpen(true);
        setPanelTab("add");
        setPanelView("list");
        setSummaryOpen(false);
        setShowStartHint(false);
      } else if (narrowPanel()) setPanelOpen(false);
    },
    [setPanelOpen, setPanelTab, setPanelView, setShowStartHint],
  );
  const openNested = useCallback(
    (next: Exclude<RoomPanelView, "list">) => {
      setPanelOpen(true);
      setPanelView(next);
      if (next !== "room") setEnvironmentTab("room");
      setSummaryOpen(false);
      setShowStartHint(false);
    },
    [setPanelOpen, setPanelView, setEnvironmentTab, setShowStartHint],
  );
  /** «Буцах»: the tab, its search, filters and scroll are where they were. */
  const closeNested = useCallback(() => {
    setPanelView("list");
  }, [setPanelView]);
  const showTab = useCallback(
    (tab: RoomPanelTab) => {
      setPanelOpen(true);
      setPanelTab(tab);
      setPanelView("list");
      setShowStartHint(false);
    },
    [setPanelOpen, setPanelTab, setPanelView, setShowStartHint],
  );
  useEffect(() => {
    if (panelView === "detail" && !selected) setPanelView("list");
  }, [panelView, selected, setPanelView]);
  const [noticeAction, setNoticeAction] = useState<{
    message: string;
    label: string;
    run: () => void;
  } | null>(null);
  const showNotice = useCallback(
    (message: string, action?: { label: string; run: () => void }) => {
      setNotice(message);
      setNoticeAction(action ? { message, ...action } : null);
    },
    [setNotice],
  );
  const [focusedOn, setFocusedOn] = useState<string | null>(null);
  useEffect(() => {
    if (focusedOn && focusedOn !== selected) setFocusedOn(null);
  }, [focusedOn, selected]);
  const storeNames = useStoreNames();
  const [catalogMerchant, setCatalogMerchant] = useState("all");
  // The merchant editor shows only the store's own products («Миний бараа»).
  const merchantStoreId = merchantMode ? merchantRoom.store?.id : undefined;
  useEffect(() => {
    if (merchantStoreId && catalogMerchant !== merchantStoreId)
      setCatalogMerchant(merchantStoreId);
  }, [merchantStoreId, catalogMerchant]);
  const cartItems = useCart((state) => state.items) ?? [];
  const dbModels = useMemo(
    () =>
      catalog.products
        .filter((product) => product.model)
        .map((product) => getDbModel(product.id))
        .filter((model): model is DbModelInfo => !!model),
    [catalog.products],
  );
  const dbModelById = useMemo(
    () => new Map(dbModels.map((model) => [model.id, model])),
    [dbModels],
  );
  const workspaceRef = useRef<HTMLDivElement>(null);
  const [cameraRequest, setCameraRequest] = useState<CameraRequest>();
  const [settledPlan, setSettledPlan] = useState<string | null>(null);
  const [rendererUnavailable, setRendererUnavailable] = useState(false);
  const planReady = roomView === "top" && (rendererUnavailable || settledPlan === current?.id);
  useEffect(() => { setRendererUnavailable(false); }, [current?.id]);
  useEffect(() => {
    if (roomView !== "top") setSettledPlan(null);
  }, [roomView]);
  const [addRoomType, setAddRoomType] = useState<RoomType | null>(null);
  function navigateView(action: CameraAction) {
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
      // The panel, menus and dialogs handle their own Escape first.
      if (event.defaultPrevented) return;
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
    const params = new URLSearchParams(window.location.search);
    const id = params.get("kitchen");
    // A marketplace "try in my room" builds a kitchen room sized to the design.
    const fitRoom = params.get("fitRoom") === "1";
    // The router can restore a handled ?kitchen= on reload; place it only once.
    try {
      if (id && sessionStorage.getItem(PLACED_KITCHEN_KEY) === id)
        handledKitchen.current = id;
    } catch {
      /* Without session storage the in-memory guard still applies. */
    }
    if (
      roomStartOpen ||
      !id ||
      handledKitchen.current === id ||
      (!current && !fitRoom)
    )
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
    if (kitchenLibrary.loading) return;
    const saved = kitchenLibrary.items.find((item) => item.id === id);
    // A marketplace copy made after the list loaded needs one fresh fetch.
    if (!saved && refreshedForKitchen.current !== id) {
      refreshedForKitchen.current = id;
      void kitchenLibrary.refresh();
      return;
    }
    handledKitchen.current = id;
    try {
      sessionStorage.setItem(PLACED_KITCHEN_KEY, id);
    } catch {
      /* See above. */
    }
    const room = saved && fitRoom ? kitchenFittedRoom(saved) : null;
    if (saved && room)
      useDesigns.getState().createNew("40", saved.name, "kitchen", room);
    const result = saved ? useDesigns.getState().placeKitchen(saved) : null;
    const piece = result?.piece;
    if (piece) {
      setSelected(piece.instanceId);
      showTab("added");
      setNotice(
        room
          ? `Гарнитурт таарсан ${roomSetupNumber(room.width)} × ${roomSetupNumber(room.depth)} м гал тогооны өрөө бэлдлээ. Өөрийн өрөөний хэмжээг «Өрөө ба материал» хэсгээс өөрчилнө үү.`
          : `Гарнитурыг өрөөнд байрлууллаа. ${result.message}`,
      );
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
    url.searchParams.delete("fitRoom");
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
    showTab,
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
        catalog.products.filter(
          (p) =>
            !p.model &&
            (catalogMerchant === "all" || p.storeIds?.includes(catalogMerchant)),
        ),
        catalogMerchant === "all"
          ? dbModels
          : dbModels.filter((model) =>
              getProduct(model.id)?.storeIds?.includes(catalogMerchant),
            ),
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
      catalogMerchant,
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
  /** The same search in every category, for «Бусад ангилалд N илэрц» (B1.3). */
  const searchElsewhere = useMemo(() => {
    if (!query.trim() || scopedCatalog.category === "all") return 0;
    const everywhere = roomPlannerCatalog(
      catalog.products.filter(
        (p) =>
          !p.model &&
          (catalogMerchant === "all" || p.storeIds?.includes(catalogMerchant)),
      ),
      catalogMerchant === "all"
        ? dbModels
        : dbModels.filter((model) =>
            getProduct(model.id)?.storeIds?.includes(catalogMerchant),
          ),
      {
        roomType: activeRoomType,
        scope: catalogScope,
        category: "all",
        query,
        format: catalogFormat,
      },
    );
    return (
      (catalogFormat === "glb" ? 0 : everywhere.photos.length) +
      (catalogFormat === "photo" ? 0 : everywhere.models.length)
    );
  }, [
    query,
    scopedCatalog.category,
    catalog.products,
    dbModels,
    catalogMerchant,
    activeRoomType,
    catalogScope,
    catalogFormat,
  ]);
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
  // Variant chosen on the product page (or a showroom QR) before opening here.
  const showroomVariant = useRef<{
    color: string | null;
    material: string | null;
    source: string | null;
  }>({ color: null, material: null, source: null });
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    showroomVariant.current = {
      color: params.get("color"),
      material: params.get("material"),
      source: params.get("source"),
    };
    setShowroomProduct(params.get("product"));
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
    const variant = showroomVariant.current;
    if (!product?.model) {
      setNotice(
        variant.source === "showroom"
          ? "QR-ийн барааны 3D загвар одоогоор ашиглах боломжгүй байна."
          : "Энэ барааны 3D загвар одоогоор ашиглах боломжгүй байна.",
      );
      return;
    }
    const color = product.colors.some((option) => option.id === variant.color)
      ? variant.color!
      : product.defaultColor;
    const material =
      product.materials.find((option) => option.id === variant.material) ??
      product.materials[0];
    const result = useDesigns.getState().placeFurniture({
      instanceId: `p_${crypto.randomUUID()}`,
      productId: product.id,
      x: 0,
      z: 0,
      rotation: 0,
      color,
      material: material?.id ?? "wood",
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
    url.searchParams.delete("color");
    url.searchParams.delete("material");
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
  const saveChip = storageStatus
    ? roomSaveChip(
        storageStatus.kind,
        designs.find((design) => design.id === current?.id)?.updatedAt,
      )
    : null;
  if (merchantRoom.active && (merchantRoom.error || !merchantRoom.meta))
    return (
      <main className="container-page py-10">
        <p role={merchantRoom.error ? "alert" : "status"}>
          {merchantRoom.error || "Өрөөг нээж байна…"}
        </p>
        <Link href="/merchant?tab=rooms">Өрөөнүүд рүү буцах</Link>
      </main>
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
            {showroomVariant.current.source === "showroom"
              ? "QR-аар сонгосон бараа: "
              : "Өрөөндөө байрлуулах бараа: "}
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
            setSummaryOpen(false);
            setPanelView("list");
            setKitchenOnly(type === "kitchen");
            if (type === "kitchen") setLeftOpen(true);
          }}
        />
      </>
    );
  }

  /** «… өрөөнд нэмэгдлээ · Харах» once the 3D model has actually rendered. */
  const announceWhenReady = (piece: PlacedFurniture) => {
    const name = piece.details?.name ?? "Тавилга";
    const view = () => {
      setSelected(piece.instanceId);
      setSelectedOpening(null);
      setSelectedWall(null);
      showTab("added");
    };
    const settle = (status: string | undefined) => {
      if (status === "ready") {
        showNotice(`${name} өрөөнд нэмэгдлээ.`, { label: "Харах", run: view });
        return true;
      }
      if (status === "error") {
        showNotice(`${name}-ийн 3D загвар ачаалагдсангүй. Байрлал хадгалагдсан.`, {
          label: "Харах",
          run: view,
        });
        return true;
      }
      return false;
    };
    const stop = useRoomModelStatus.subscribe((state) => {
      if (settle(state.byInstance[piece.instanceId])) stop();
    });
    // Give up quietly if the piece is removed before it ever loads.
    window.setTimeout(stop, 60_000);
  };
  const placeNewPiece = (
    piece: PlacedFurniture,
    { select = true }: { select?: boolean } = {},
  ): string | null => {
    const latest = useDesigns.getState().current;
    if (!latest || latest.id !== current.id) {
      setNotice("Өрөө өөрчлөгдсөн байна. Тавилгаа дахин сонгоно уу.");
      return null;
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
      return null;
    }
    rememberFurniture(result.piece);
    if (!piece.modelId && !piece.kitchen)
      trackProduct3d(piece.productId, "placement");
    announceWhenReady(result.piece);
    if (!select) return result.piece.instanceId;
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
    return result.piece.instanceId;
  };
  const addPiece = (
    productId: string,
    variant?: { color: string; material: Material },
    options?: { select?: boolean },
  ) => {
    const product = getProduct(productId);
    if (!product) return null;
    if (!product.model) {
      setNotice("Энэ барааны 3D загвар хараахан бэлэн болоогүй.");
      return null;
    }
    const piece: PlacedFurniture = {
      instanceId: `p_${crypto.randomUUID()}`,
      productId,
      placement: product.placement,
      x: 0,
      z: 0,
      rotation: 0,
      color: variant?.color ?? product.defaultColor,
      material: variant?.material ?? product.materials[0]?.id ?? "wood",
      details: {
        name: product.name,
        dimensions: { ...product.dimensions },
        image: product.image,
        category: product.category,
      },
    };
    return placeNewPiece(piece, options);
  };

  const addModelPiece = (
    model: DbModelInfo,
    variant?: { color: string; material: Material },
  ) => {
    const defaultColor = variant?.color ?? model.colors[0]?.id ?? "default";
    const defaultMaterial =
      variant?.material ?? ((model.materials[0]?.id ?? "wood") as Material);
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

  /** C3 cover: only from a fully loaded room, never a half-drawn one. */
  const captureCover = () => {
    const status = useRoomModelStatus.getState().byInstance;
    if (
      addedRows.some(
        (row) => !row.has3d || status[row.instanceId] !== "ready",
      )
    ) {
      showTab("cart");
      setNotice("Бүх загвар ачаалагдсаны дараа cover болгоно.");
      return;
    }
    const image = previewCapture.current?.();
    if (!image) {
      setNotice("Cover зураг үүссэнгүй. 3D өрөө бэлэн болсны дараа дахин оролдоно уу.");
      return;
    }
    merchantRoom.setCover(image);
    setNotice("Одоогийн харагдац cover болж тогтлоо.");
  };
  const focusSelected = () => {
    if (!selected) return;
    setFocusedOn(selected);
    setLocked(false);
    // B3: the sheet drops to peek (the drawer closes) so the camera is visible.
    if (narrowPanel()) setPanelOpen(false);
    setCameraRequest((previous) => ({
      id: (previous?.id ?? 0) + 1,
      action: "focus",
      targetId: selected,
    }));
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
    if (selected) removePiece(selected);
  };
  /** Removes one instance with whatever stands on it; one undo step and «Буцаах». */
  const removePiece = (instanceId: string) => {
    const piece = current.pieces.find((p) => p.instanceId === instanceId);
    if (!piece) return;
    const removed = new Set([instanceId]);
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
    const name =
      piece.kitchen?.name ??
      getProduct(piece.productId)?.name ??
      getDbPieceModel(piece)?.name ??
      piece.details?.name ??
      "Тавилга";
    const wasSelected = selected === instanceId;
    updatePieces(current.pieces.filter((p) => !removed.has(p.instanceId)));
    if (selected && removed.has(selected)) setSelected(null);
    const head = useDesigns.getState().past.length;
    showNotice(`${name} өрөөнөөс хасагдлаа.`, {
      label: "Буцаах",
      run: () => {
        if (useDesigns.getState().past.length !== head) {
          showNotice("Дараа нь өөр өөрчлөлт хийсэн тул Ctrl+Z ашиглана уу.");
          return;
        }
        undo();
        if (wasSelected) setSelected(instanceId);
      },
    });
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
    dbModelById.get(piece.modelId ?? piece.productId);

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
      const count = addToCart(
        cartLine(product, {
          color: piece.color,
          material: piece.material,
          unitPrice: getPiecePrice(piece),
        }),
      );
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

  const selectedDbModel = selectedPiece ? getDbPieceModel(selectedPiece) : null;

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
  /** Instances per catalog product: «Өрөөнд N» badges and the #n row numbers. */
  const placedByProduct = new Map<string, string[]>();
  for (const piece of current.pieces) {
    const key = piece.modelId ?? piece.productId;
    placedByProduct.set(key, [
      ...(placedByProduct.get(key) ?? []),
      piece.instanceId,
    ]);
  }
  const pieceNumber = (piece: PlacedFurniture) =>
    (placedByProduct.get(piece.modelId ?? piece.productId) ?? []).indexOf(
      piece.instanceId,
    ) + 1;
  // New delivery jobs no longer render model thumbnails, so a 3D card falls
  // back to the catalog photo of the product that uses this model.
  const catalogPhoto = (modelId: string, fileModelId?: string) =>
    getProduct(modelId)?.image ||
    catalog.products.find(
      (product) =>
        product.model &&
        (product.model.id === modelId || product.model.id === fileModelId),
    )?.image ||
    null;
  const merchantName = (ids?: string[]) =>
    ids?.map((id) => storeNames.get(id)).find(Boolean);
  const catalogMerchants = [...storeNames]
    .filter(([id]) =>
      catalog.products.some((product) => product.storeIds?.includes(id)),
    )
    .map(([id, name]) => ({ id, name }))
    .sort((a, b) => a.name.localeCompare(b.name, "mn"));
  // Clears only what the visitor chose. The scope goes back to the default
  // «this room only» view; it used to jump to every room, which widened the
  // catalog instead of undoing the visitor's filters.
  const resetCatalogFilters = () => {
    setCatalogScope(DEFAULT_ROOM_CATALOG_FILTERS.scope);
    setPaletteCat(DEFAULT_ROOM_CATALOG_FILTERS.category);
    setQuery(DEFAULT_ROOM_CATALOG_FILTERS.query);
    setCatalogFormat(DEFAULT_ROOM_CATALOG_FILTERS.format);
    setCatalogMerchant(DEFAULT_ROOM_CATALOG_FILTERS.merchant);
  };
  const addedRows: RoomAddedRow[] = current.pieces.map((piece) => {
    const product = getProduct(piece.productId);
    const model = getDbPieceModel(piece);
    const dims = dimsFor(piece);
    const colors = product?.colors ?? model?.colors ?? [];
    const materials = product?.materials ?? model?.materials ?? [];
    const variant = piece.kitchen
      ? "Өөрийн гарнитур"
      : [
          colors.find((color) => color.id === piece.color)?.name,
          materials.find((material) => material.id === piece.material)?.name,
        ]
          .filter(Boolean)
          .join(" · ");
    return {
      instanceId: piece.instanceId,
      productId: piece.modelId ?? piece.productId,
      color: piece.color,
      material: piece.material,
      name:
        piece.kitchen?.name ??
        product?.name ??
        model?.name ??
        piece.details?.name ??
        "Тавилга",
      number: pieceNumber(piece),
      image:
        product?.image ||
        modelThumbnail(model) ||
        piece.details?.image ||
        null,
      meta: [formatFurnitureCm(dims.w, dims.d, dims.h), variant]
        .filter(Boolean)
        .join(" · "),
      price: piece.kitchen ? "Тусдаа үнэ" : formatPrice(getPiecePrice(piece)),
      has3d: !piece.kitchen && !!(product?.model ?? model),
      purchasable: !piece.kitchen && !!product,
    };
  });
  /** «Шууд сагсанд нэмэх» for photo-only products, default variant only. */
  const addProductToCart = (product: Product) => {
    const selection = defaultCartSelection(product);
    if (!selection) {
      setNotice("Энэ барааны өнгө, материалын сонголт бүрэн биш байна.");
      return;
    }
    const added = addToCart(
      cartLine(product, {
        color: selection.color.id,
        material: selection.material.id,
        unitPrice: selection.unitPrice,
      }),
    );
    showNotice(
      added
        ? `${product.name} сагсанд нэмэгдлээ.`
        : "Нөөц хүрэлцэхгүй тул сагсанд нэмэгдсэнгүй.",
      added ? { label: "Сагс харах", run: () => showTab("cart") } : undefined,
    );
  };
  /** A new scene instance of the cart variant; the quantity to buy is untouched. */
  const placeCartItem = (item: CartItem) => {
    const variant = { color: item.color, material: item.material };
    const model = getDbModel(item.productId);
    if (model) addModelPiece(model, variant);
    else addPiece(item.productId, variant);
  };
  const addSelectedToCart = () => {
    if (!selectedPiece || selectedPiece.kitchen) return;
    const product = getProduct(selectedPiece.productId);
    if (!product) {
      setNotice("Энэ тавилга дэлгүүрийн бараа биш тул сагслах боломжгүй.");
      return;
    }
    const added = addToCart(
      cartLine(product, {
        color: selectedPiece.color,
        material: selectedPiece.material,
        unitPrice: getPiecePrice(selectedPiece),
      }),
    );
    showNotice(
      added
        ? `${product.name} энэ хувилбараар сагсанд нэмэгдлээ.`
        : "Нөөц хүрэлцэхгүй тул сагсанд нэмэгдсэнгүй.",
      added ? { label: "Сагс харах", run: () => showTab("cart") } : undefined,
    );
  };
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
  const setSelectedVariant = (
    patch: Partial<Pick<PlacedFurniture, "color" | "material">>,
  ) => {
    if (!selectedPiece) return;
    const id = selectedPiece.instanceId;
    if (!selectedPiece.modelId) {
      if (patch.color && patch.color !== selectedPiece.color)
        trackProduct3d(selectedPiece.productId, "color", patch.color);
      if (patch.material && patch.material !== selectedPiece.material)
        trackProduct3d(selectedPiece.productId, "material", patch.material);
    }
    updatePieces(
      current.pieces.map((piece) =>
        piece.instanceId === id ? { ...piece, ...patch } : piece,
      ),
    );
  };
  /**
   * D2 «Буцаах» after a failed replacement: the previous product returns at
   * the piece's current pose, validated like any other placement.
   */
  const revertSwap = (instanceId: string) => {
    const status = useRoomModelStatus.getState();
    const previous = status.previous[instanceId];
    const piece = current.pieces.find((p) => p.instanceId === instanceId);
    if (!previous || !piece) return;
    const candidate: PlacedFurniture = {
      ...previous,
      x: piece.x,
      z: piece.z,
      rotation: piece.rotation,
      elevation: piece.elevation,
      attachment: piece.attachment,
    };
    if (!isPlacementValid(candidate, placement.pieces, placement.room)) {
      setNotice(
        "Өмнөх бараа одоогийн байрлалд багтахгүй байна. Ctrl+Z ашиглана уу.",
      );
      return;
    }
    status.forget(instanceId);
    updatePieces(
      current.pieces.map((p) => (p.instanceId === instanceId ? candidate : p)),
    );
    setNotice("Өмнөх бараа сэргэлээ.");
  };
  /** «Солих» / «Хослуулах»: the options view with that list brought into view. */
  const openOptions = (mode: ProductOptionsMode) => {
    setOptionsMode(mode);
    openNested("detail");
    setOptionsReveal((value) => value + 1);
  };
  /** A complementary product is a new instance; the selection and cart stay. */
  const addComplement = (product: Product) => {
    const id = addPiece(product.id, undefined, { select: false });
    if (!id) return;
    showNotice(`${product.name} өрөөнд нэмэгдлээ. Сонгосон тавилга хэвээр байна.`, {
      label: "Харах",
      run: () => setSelected(id),
    });
  };
  const complementSuggestions =
    selectedProduct && panelView === "detail" && optionsMode === "pair"
      ? complementaryProducts(selectedProduct, catalog.products, {
          roomType: current.roomType ?? "other",
          storeId: merchantStoreId,
        })
      : [];
  const selectionActions: SelectionAction[] = [];
  if (selectedPiece) {
    const id = selectedPiece.instanceId;
    if (!merchantMode && selectedProduct && !selectedPiece.kitchen)
      selectionActions.push({
        id: "cart",
        label: "Сагсанд",
        icon: <ShoppingBag size={16} />,
        run: addSelectedToCart,
        primary: true,
      });
    if (!selectedPiece.attachment || selectedPiece.attachment.kind === "floor")
      selectionActions.push({
        id: "rotate",
        label: "Эргүүлэх",
        icon: <RotateCw size={16} />,
        run: rotateSelected,
      });
    // Imported models and own kitchens have no store category to match.
    if (
      !selectedPiece.kitchen &&
      (selectedProduct ||
        (!selectedDbModel && selectedPiece.details?.category))
    )
      selectionActions.push({
        id: "replace",
        label: "Солих",
        icon: <Repeat size={16} />,
        run: () => openOptions("replace"),
      });
    if (selectedProduct)
      selectionActions.push({
        id: "pair",
        label: "Хослуулах",
        icon: <Combine size={16} />,
        run: () => openOptions("pair"),
      });
    selectionActions.push(
      {
        id: "copy",
        label: "Хуулбарлах",
        icon: <Copy size={16} />,
        run: duplicateSelected,
        more: true,
      },
      {
        id: "remove",
        label: "Устгах",
        menuLabel: "Өрөөнөөс устгах",
        icon: <Trash2 size={16} />,
        run: () => removePiece(id),
        more: true,
      },
      {
        id: "focus",
        label: "Төвлөрүүлэх",
        menuLabel: "Төвлөрүүлж харах",
        icon: <Focus size={16} />,
        run: focusSelected,
        more: true,
      },
    );
  }
  const save = () => {
    endEdit();
    saveCurrent(saveName.trim() || current.name.trim() || "Миний өрөө");
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
    save: merchantMode ? () => void merchantRoom.save() : save,
    h: () => { if (roomView !== "interior") { setHandTool(true); setLocked(false); setPlacementTemplate(null); } },
    v: () => setHandTool(false),
    r: rotateSelected,
    delete: removeSelected,
    backspace: removeSelected,
    arrowup: () => nudge(0, -0.1),
    arrowdown: () => nudge(0, 0.1),
    arrowleft: () => nudge(-0.1, 0),
    arrowright: () => nudge(0.1, 0),
    // B3: Escape goes down exactly one level per press.
    escape: () => {
      if (summaryOpen || showCompare) {
        setSummaryOpen(false);
        setShowCompare(false);
        return;
      }
      if (handTool) { setHandTool(false); return; }
      if (panelView !== "list") {
        closeNested();
        return;
      }
      if (selected || selectedWall || selectedOpening || placementTemplate) {
        setSelected(null);
        setSelectedWall(null);
        setSelectedOpening(null);
        setPlacementTemplate(null);
        return;
      }
      if (roomView === "interior") {
        navigateView("fit");
        return;
      }
      if (expanded) setExpanded(false);
      else setLeftOpen(false);
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
    setEnvironmentTab("room");
    openNested("room");
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
    openNested("room");
  };
  const armPlacement = (templateId: string | null) => {
    setPlacementTemplate(templateId);
    setSelected(null);
    setSelectedOpening(null);
    if (templateId) {
      setActivePreset(null);
      setLocalFile(null);
      setLocalUrl(null);
      if (narrowPanel()) setPanelOpen(false);
    }
  };

  return (
    <div
      ref={workspaceRef}
      data-planner-ready="room"
      className={cn(
        "room-planner-layout planner-workspace planner-studio planner-reference room-simple relative overflow-hidden",
        panelOpen && "room-workspace-open",
        // Phones show one slot under the scene: the dock or the selection bar.
        selected && selectedPiece && "room-has-selection",
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
      {merchantMode ? (
        <MerchantRoomHeader
          editor={merchantRoom}
          onPreview={() => setMerchantDialog("preview")}
          onPublish={() => setMerchantDialog("publish")}
        />
      ) : (
      <header className="studio-header room-studio-header">
        <Link href="/" className="studio-brand" aria-label="Tavilga.mn нүүр">
          <House size={19} />
          <span>tavilga.mn</span>
        </Link>
        <div className="room-project-name">
          <span>Өрөөний төлөвлөгч</span>
          <div>
            <input
              aria-label="Төслийн нэр"
              value={current.name}
              onFocus={beginEdit}
              onBlur={endEdit}
              onChange={(event) => updateRoom({ name: event.target.value })}
            />
            {saveChip && (
              <span
                className="room-save-chip"
                data-tone={saveChip.tone}
                aria-live="polite"
                title={storageStatus?.detail}
              >
                <i aria-hidden="true" />
                {saveChip.label}
                {saveChip.retry && (
                  <button type="button" onClick={save}>
                    Дахин оролдох
                  </button>
                )}
              </span>
            )}
          </div>
        </div>
        <div className="studio-file-actions">
          <RoomPlannerSignIn />
          <button
            type="button"
            title="Хадгалсан загварууд"
            aria-label="Хадгалсан загварууд"
            onClick={() => openNested("designs")}
          >
            <Layers size={18} />
            <span>Загварууд</span>
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
          <RoomHeaderCounts onCart={() => showTab("cart")} />
          <span className="room-header-price">
            <small>Өрөөний дүн</small>
            {formatPrice(totalPrice)}
          </span>
          <button
            type="button"
            className="room-summary-button"
            aria-haspopup="dialog"
            aria-expanded={summaryOpen}
            onClick={() => {
              endEdit();
              setPlacementTemplate(null);
              setShowStartHint(false);
              setSummaryOpen((value) => !value);
            }}
          >
            <span>Тойм</span>
            <small className="room-summary-price">
              {formatPrice(totalPrice)}
            </small>
            <ChevronRight size={20} />
          </button>
        </div>
      </header>
      )}
      {notice && (
        <div className="planner-notice" role="status">
          <Check size={17} />
          <span>{notice}</span>
          {noticeAction?.message === notice && (
            <button
              type="button"
              className="planner-notice-action"
              onClick={() => {
                const action = noticeAction;
                setNotice("");
                setNoticeAction(null);
                action.run();
              }}
            >
              {noticeAction.label}
            </button>
          )}
          <button aria-label="Мэдэгдэл хаах" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {/* One left workspace panel: three tabs, with editing as nested views. */}
      <RoomWorkspacePanel
        open={panelOpen}
        onOpenChange={setPanelOpen}
        tab={panelTab}
        onTab={(tab) => {
          setPanelTab(tab);
          setShowStartHint(false);
        }}
        view={panelView}
        onBack={closeNested}
        labels={
          merchantMode
            ? { add: "Миний бараа", added: "Байрлуулсан", cart: "Өрөө ба камер" }
            : undefined
        }
        meta={merchantMode ? {
          add: `${catalogEntries.length} бараа`,
          added: `${current.pieces.length} тавилга`,
          cart: merchantRoom.cover ? "Cover бэлэн" : "Cover сонгоогүй",
        } : {
          add: kitchenOnly
            ? "Миний гарнитур"
            : `${catalogEntries.length} бараа`,
          added: `${current.pieces.length} тавилга`,
          cart: `${cartItems.reduce((sum, item) => sum + item.qty, 0)} ширхэг`,
        }}
        nestedEyebrow={
          panelView === "detail"
            ? (merchantMode
                ? { add: "Миний бараа", added: "Байрлуулсан", cart: "Өрөө ба камер" }
                : { add: "Тавилга", added: "Өрөөнд", cart: "Сагс" })[panelTab]
            : panelView === "room"
              ? "Өрөө ба материал"
              : "Төсөл"
        }
        nestedTitle={
          panelView === "detail"
            ? "Бүтээгдэхүүний сонголт"
            : panelView === "room"
              ? environmentTab === "surfaces"
                ? "Өнгө, материал"
                : environmentTab === "openings"
                  ? "Хаалга, цонх"
                  : environmentTab === "lighting"
                    ? "Гэрэлтүүлэг"
                    : (current.roomName ?? "Өрөө")
              : "Миний загварууд"
        }
        expandRequest={optionsReveal}
        onNestedClose={
          panelView === "detail" && selectedPiece
            ? {
                label: "Сонголтыг хаах — тавилга өрөөнд үлдэнэ",
                run: () => setSelected(null),
              }
            : undefined
        }
        peekLine={merchantMode ? `${current.pieces.length} тавилга өрөөнд · ${merchantRoom.cover ? "cover бэлэн" : "cover сонгоогүй"}` : `${current.pieces.length} тавилга өрөөнд · ${formatPrice(totalPrice)} · сагсанд ${cartItems.reduce((sum, item) => sum + item.qty, 0)} ш`}
        footer={
          panelView === "detail" && selectedPiece ? (
            <div className="room-panel-footer-actions">
              <button type="button" onClick={duplicateSelected}>
                <Copy size={16} /> Хуулбарлах
              </button>
              <button
                type="button"
                className="is-danger"
                onClick={removeSelected}
              >
                <Trash2 size={16} /> Өрөөнөөс устгах
              </button>
            </div>
          ) : panelView !== "list" || merchantMode ? null : panelTab === "added" ? (
            current.pieces.length > 0 && (
              <>
                <div className="room-panel-total">
                  <span>Өрөөний тавилгын дүн</span>
                  <strong>{formatPrice(totalPrice)}</strong>
                </div>
                <button
                  type="button"
                  className="room-panel-footer-primary"
                  onClick={buyEverything}
                >
                  <ShoppingBag size={17} /> Өрөөний тавилгыг бүгдийг сагслах
                </button>
              </>
            )
          ) : panelTab === "cart" && cartItems.length > 0 ? (
            <RoomCartFooter />
          ) : null
        }
      >
        {panelView !== "list" ? (
          <div className="room-panel-nested">
        {panelView === "room" && <nav
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
        </nav>}
        {panelView === "room" && environmentTab !== "room" && (
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
        <div hidden={panelView === "room" && environmentTab !== "room"}>
          <div
            className="planner-inspector-intro"
            hidden={panelView === "detail"}
          >
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
                        closeNested();
                        if (narrowPanel()) setPanelOpen(false);
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
                  setLeftOpen(true);
                }}
              >
                Болсон, тавилга байрлуулах <Check size={17} />
              </button>
            </div>
          </div>
          <div hidden={roomDetailsTab !== "selection"}>
            {selectedPiece && selectedDetails ? (
              <div className="room-detail">
                <RoomProductOptions
                  key={selectedPiece.instanceId}
                  product={selectedPiece.kitchen ? null : (selectedProduct ?? null)}
                  fallback={{
                    name: selectedDetails.name,
                    image:
                      modelThumbnail(selectedDbModel) ??
                      selectedPiece.details?.image ??
                      null,
                    dimensions: dimsFor(selectedPiece),
                    note: selectedPiece.kitchen
                      ? "Өөрийн гарнитур — үнэ, сагсыг гарнитурын тохиргооноос гаргана."
                      : selectedDbModel
                        ? "Оруулсан 3D загвар. Дэлгүүрийн бараа биш тул дэлгэрэнгүй хуудас, сагс байхгүй."
                        : "Энэ бараа каталогт олдсонгүй. Өрөөнд хадгалсан хэмжээгээр л харагдана.",
                  }}
                  instanceLabel={`#${pieceNumber(selectedPiece)}`}
                  storeName={
                    selectedProduct?.storeIds
                      ?.map((id) => storeNames.get(id))
                      .find(Boolean)
                  }
                  canWish={!merchantMode}
                  price={
                    selectedPiece.kitchen || selectedDetails.basePrice <= 0
                      ? null
                      : getPiecePrice(selectedPiece)
                  }
                  colors={selectedDetails.colors}
                  materials={selectedDetails.materials}
                  colorId={selectedPiece.color}
                  materialId={selectedPiece.material}
                  onColor={(color) => setSelectedVariant({ color })}
                  onMaterial={(material) =>
                    setSelectedVariant({ material: material as Material })
                  }
                  appearanceTracksVariant={false}
                  canBuy={!merchantMode && !selectedPiece.kitchen && !!selectedProduct}
                  onAddToCart={addSelectedToCart}
                  mode={optionsMode}
                  onMode={setOptionsMode}
                  revealRecommendations={optionsReveal}
                  variantStatus={
                    <RoomVariantStatus
                      instanceId={selectedPiece.instanceId}
                      name={selectedDetails.name}
                      onRevert={() => revertSwap(selectedPiece.instanceId)}
                    />
                  }
                  replace={
                    <RoomProductAlternatives
                      key={selectedPiece.instanceId}
                      piece={selectedPiece}
                      product={selectedProduct}
                      products={catalog.products}
                      pieces={current.pieces}
                      room={current}
                      roomId={current.activeRoomId ?? `${current.id}-room-1`}
                      context={placement}
                      storeId={merchantStoreId}
                      onReplace={(pieces) => {
                        // The visible product stays the revert target until
                        // the new model is on screen (D2).
                        useRoomModelStatus.getState().remember(selectedPiece);
                        updatePieces(pieces);
                      }}
                      onNotice={setNotice}
                    />
                  }
                  pair={
                    <RoomProductPairings
                      hasSource={!!selectedProduct && !selectedPiece.kitchen}
                      suggestions={complementSuggestions}
                      onAdd={addComplement}
                      state={catalog.error ? "error" : catalog.loading && !catalog.products.length ? "loading" : "ready"}
                      onRetry={() => void useCatalogStore.getState().refresh(true)}
                    />
                  }
                >
                {selectedPiece.kitchen && (
                  <p className="room-options-note">
                    Бодит хэмжээгээр байрласан гарнитур.{" "}
                    <Link
                      className="underline"
                      href={`/kitchen?design=${selectedPiece.kitchen.id}`}
                    >
                      Гарнитурын тохиргоог нээх →
                    </Link>
                  </p>
                )}
                <section className="room-detail-section" aria-label="Хэмжээ">
                  <h3>Хэмжээ</h3>
                  <div className="room-selection-size">
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
                </section>
                <section
                  className="room-detail-section planner-transform"
                  aria-label="Байрлал"
                >
                  <h3>Байрлал</h3>
                  <dl className="room-options-facts is-placement">
                    <div>
                      <dt>Бэхэлгээ</dt>
                      <dd>
                        {selectedPiece.attachment?.kind === "wall"
                          ? "Хана · эргүүлэх боломжгүй"
                          : selectedPiece.attachment?.kind === "surface"
                            ? "Тавилга дээр"
                            : "Шал"}
                      </dd>
                    </div>
                    <div>
                      <dt>Эргэлт</dt>
                      <dd>
                        {(Math.round((selectedPiece.rotation * 180) / Math.PI) %
                          360 +
                          360) %
                          360}
                        °
                      </dd>
                    </div>
                    <div>
                      <dt>Шалнаас</dt>
                      <dd>
                        {formatMeasurement(selectedPiece.elevation ?? 0)}
                      </dd>
                    </div>
                  </dl>
                  <p className="room-detail-label">Өрөөний төвөөс</p>
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
                </section>
                </RoomProductOptions>
              </div>
            ) : (
              <div className="border-b border-ui-line p-4 text-xs text-ui-muted">
                Тавилга дээр дарж тохиргоог нь өөрчилнө үү.
              </div>
            )}

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
                  closeNested();
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
          </div>
        ) : panelTab === "add" ? (
          <div className="room-panel-add">
            {!merchantMode && <div
              className="room-segmented"
              role="group"
              aria-label="Каталогийн горим"
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
            </div>}
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
            {!kitchenOnly && catalog.error && (
              <RoomCatalogError
                message={catalog.error}
                onRetry={() => void catalog.refresh(true)}
              />
            )}
            {!kitchenOnly && !catalog.ready && !catalog.error && (
              <RoomCatalogSkeleton />
            )}
            {!kitchenOnly && catalog.ready && (
              <>
                <RoomCatalogFilters
                  categories={scopedCatalog.categories}
                  category={scopedCatalog.category}
                  onCategory={setPaletteCat}
                  scope={catalogScope}
                  onScope={setCatalogScope}
                  merchant={catalogMerchant}
                  merchants={catalogMerchants}
                  onMerchant={setCatalogMerchant}
                  format={catalogFormat}
                  onFormat={setCatalogFormat}
                  sort={catalogSort}
                  onSort={setCatalogSort}
                  roomName={ROOM_TYPES[activeRoomType].label}
                  query={query}
                  onQuery={setQuery}
                  count={catalogEntries.length}
                  onReset={resetCatalogFilters}
                  merchantLocked={
                    merchantMode ? merchantRoom.store?.name : undefined
                  }
                />
                {!catalogEntries.length && (
                  <RoomCatalogEmpty
                    query={query}
                    category={
                      scopedCatalog.category === "all"
                        ? null
                        : (scopedCatalog.categories.find(
                            (item) => item.id === scopedCatalog.category,
                          )?.name ?? null)
                    }
                    elsewhere={searchElsewhere}
                    scope={
                      catalogScope === "room"
                        ? ROOM_TYPES[activeRoomType].label
                        : null
                    }
                    merchant={
                      catalogMerchant === "all"
                        ? null
                        : (storeNames.get(catalogMerchant) ?? null)
                    }
                    onAllCategories={() => setPaletteCat("all")}
                    onClearQuery={() => setQuery("")}
                    onAllStores={() => {
                      setCatalogScope("all");
                      setCatalogMerchant("all");
                    }}
                    onReset={resetCatalogFilters}
                  />
                )}
                <div className="room-catalog-grid">
                  {catalogEntries.map((entry) =>
                    entry.kind === "photo" ? (
                      <RoomCatalogCard
                        key={entry.item.id}
                        name={entry.item.name}
                        merchant={merchantName(entry.item.storeIds)}
                        image={entry.item.image || null}
                        dimensions={formatFurnitureCm(
                          entry.item.dimensions.w,
                          entry.item.dimensions.d,
                          entry.item.dimensions.h,
                        )}
                        price={formatPrice(entry.item.basePrice)}
                        has3d={false}
                        placedIds={placedByProduct.get(entry.item.id) ?? []}
                        onAdd={() => addPiece(entry.item.id)}
                        onAddToCart={
                          merchantMode
                            ? undefined
                            : () => addProductToCart(entry.item)
                        }
                      />
                    ) : (
                      <RoomCatalogCard
                        key={entry.item.id}
                        name={entry.item.name}
                        merchant={merchantName(
                          getProduct(entry.item.id)?.storeIds,
                        )}
                        image={modelThumbnail(entry.item)}
                        fallbackImage={catalogPhoto(
                          entry.item.id,
                          entry.item.fileModelId,
                        )}
                        dimensions={formatFurnitureCm(
                          entry.item.dimensionsW,
                          entry.item.dimensionsD,
                          entry.item.dimensionsH,
                        )}
                        price={
                          entry.item.basePrice > 0
                            ? formatPrice(entry.item.basePrice)
                            : stockLabel(entry.item)
                        }
                        has3d
                        placedIds={placedByProduct.get(entry.item.id) ?? []}
                        onAdd={() => addModelPiece(entry.item)}
                        onPrefetch={() =>
                          void prefetchModel(
                            modelDeliveryUrl(
                              entry.item.fileModelId ?? entry.item.id,
                              entry.item.glbFile,
                            ),
                          )
                        }
                      />
                    ),
                  )}
                </div>
              </>
            )}
          </div>
        ) : panelTab === "added" ? (
          <RoomAddedList
            rows={
              merchantMode
                ? addedRows.map((row) => ({ ...row, purchasable: false }))
                : addedRows
            }
            selected={selected}
            room={`${current.roomName ?? "Зочны өрөө"} · ${current.width} × ${current.depth} м · ${geometry.area.toFixed(1)} м²`}
            summary={`${current.pieces.length} тавилга өрөөнд · ${formatPrice(totalPrice)}`}
            onRoom={() => {
              setEnvironmentTab("room");
              openNested("room");
            }}
            onSelect={(id) => {
              setSelected(id);
              setSelectedOpening(null);
              setSelectedWall(null);
              setPlacementTemplate(null);
              // D1: a row opens its product options; «Буцах» returns here.
              openNested("detail");
            }}
            onFocus={focusSelected}
            onDuplicate={duplicateSelected}
            onRemove={removePiece}
            onEdit={() => openNested("detail")}
            onAddFurniture={() => showTab("add")}
            onTemplates={() => {
              endEdit();
              previewCapture.current?.();
              setRoomStartOpen(true);
            }}
          />
        ) : merchantMode ? (
          <MerchantRoomCameraPanel
            design={current}
            cover={merchantRoom.cover}
            rows={addedRows}
            onCover={captureCover}
            onRoom={() => {
              setEnvironmentTab("room");
              openNested("room");
            }}
          />
        ) : (
          <RoomCartList
            storeNames={storeNames}
            placedCount={(item) =>
              current.pieces.filter(
                (piece) =>
                  (piece.modelId ?? piece.productId) === item.productId &&
                  piece.color === item.color &&
                  piece.material === item.material,
              ).length
            }
            onPlace={placeCartItem}
            onRemoved={(item, restore) =>
              showNotice(`${item.name} сагснаас хасагдлаа.`, {
                label: "Буцаах",
                run: restore,
              })
            }
            onBrowse={() => showTab("add")}
            roomPieceCount={current.pieces.length}
            onBuyRoom={buyEverything}
          />
        )}
      </RoomWorkspacePanel>

      {/* CENTER: canvas */}
      <div
        className="planner-stage relative h-full"
        data-planner-tour="room-stage"
      >
        <div className="room-stage-actions">
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
              setPanelView("list");
              if (narrowPanel()) setPanelOpen(false);
            }}
            onEditRoom={() => {
              setShowRoomGeometry(true);
            }}
            onDuplicateRoom={duplicateRoom}
            onRemoveRoom={removeRoom}
            onMove={moveRoom}
            onConnection={updateConnection}
            onNotice={setNotice}
            beginEdit={beginEdit}
            endEdit={endEdit}
          />
        )}
        <RoomPlannerControls
          handTool={handTool}
          onHandTool={() => { setHandTool(value => !value); setLocked(false); setPlacementTemplate(null); }}
          onCover={merchantMode ? captureCover : undefined}
          roomActive={panelOpen && panelView === "room"}
          view={roomView}
          onView={(next) => {
            if (next === "interior") setHandTool(false);
            setLocked(false);
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
            setHandTool(false);
            if (roomView === "interior") navigateView("fit");
            endEdit();
            setSelected(null);
            setSelectedOpening(null);
            setSelectedWall(null);
            setPlacementTemplate("window-panoramic");
            setEnvironmentTab("openings");
            openNested("room");
          }}
          onLightingSettings={() => {
            endEdit();
            setPlacementTemplate(null);
            setEnvironmentTab("lighting");
            openNested("room");
          }}
          onRoom={() => {
            endEdit();
            setPlacementTemplate(null);
            if (panelOpen && panelView === "room") {
              closeNested();
              return;
            }
            setEnvironmentTab("room");
            openNested("room");
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
                  openNested("room");
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
          {focusedOn && (
            <button
              type="button"
              className="room-fit-chip"
              onClick={() => {
                setFocusedOn(null);
                navigateView("fit");
              }}
            >
              <Maximize size={14} /> Бүтэн өрөө харах
            </button>
          )}
        </div>

        {selectedPiece && (
          <RoomSelectionToolbar
            key={selectedPiece.instanceId}
            instanceId={selectedPiece.instanceId}
            title={selectedDetails?.name ?? "Тавилга"}
            number={pieceNumber(selectedPiece)}
            actions={selectionActions}
            onOpen={
              panelOpen && panelView === "detail"
                ? undefined
                : () => openNested("detail")
            }
            onClose={() => setSelected(null)}
            // The SVG plan has no projected anchor; focus moves the bounds.
            docked={planReady || focusedOn === selectedPiece.instanceId}
            panelOpen={panelOpen}
          />
        )}

        {!welcomeDismissed &&
          (showStartHint ||
            (current.pieces.length === 0 &&
              !panelOpen &&
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
                  setEnvironmentTab("room");
                  openNested("room");
                }}
              >
                Өрөөний хэмжээ тохируулах
              </button>
            </div>
          )}
        <div className="room-camera-guide" role="status">
          {handTool
            ? "Гар: чирж харагдацыг зөөнө · V / Esc: сонгох горим"
            : roomView === "interior"
            ? "W/A/S/D — өрөө дотор алхах · Чирэх — эргэн харах · Дугуй — ойртуулах, цааш гүйлгэвэл гадагш гарна"
            : placementTemplate
              ? "Хаалга, цонх байрлуулах ханандаа дарна уу · Esc цуцлах"
              : selected
                ? "Тавилгыг чирж байрлуулна · Эргүүлэх товч: 90° · Сумтай товч: 10 см"
                : "Тавилга: дарж сонгох, чирж байрлуулах · Хоосон хэсгийг чирж эргүүлэх · Дугуйгаар ойртож өрөөнд орно"}
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
            onPointerDownCapture={() => { if (!handTool) beginEdit(); }}
            onPointerUp={endEdit}
            onPointerCancel={endEdit}
            onLostPointerCapture={endEdit}
          >
            <RoomWallPlan
              handTool={handTool}
              locked={locked}
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
            handTool={handTool}
            onRendererUnavailable={setRendererUnavailable}
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
            onCameraSave={(pose) => updateRoom({ interiorCamera: pose })}
            onEnterInterior={(pose) => {
              setHandTool(false);
              updateRoom({ interiorCamera: pose });
              setRoomView("interior");
              setView("perspective");
              setPlacementTemplate(null);
              setShowStartHint(false);
            }}
            onExitInterior={() => {
              // The canvas has already walked the camera out; no fit request.
              setRoomView("dollhouse");
              setView("perspective");
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
                // D1: with the panel open, a scene pick shows its options. A
                // closed panel stays closed; the toolbar title opens it.
                if (panelOpen) setPanelView("detail");
              }
            }}
            selectedWall={selectedWall}
            onSelectWall={selectWall}
            onSurfaceDoubleClick={(surface, wall, x, y) => {
              setSurfacePopup({ surface, wall, x, y });
              setSurface(surface);
              if (wall) selectWall(wall);
              closeNested();
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
            onRemovePiece={removePiece}
            onRevertSwap={revertSwap}
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

      {merchantMode && merchantDialog === "publish" && (
        <MerchantPublishDialog
          editor={merchantRoom}
          rows={addedRows}
          onShow={(id) => {
            // «Харуулах»: select the blocking piece and bring the camera to it.
            setSelected(id);
            setFocusedOn(id);
            setLocked(false);
            setCameraRequest((previous) => ({
              id: (previous?.id ?? 0) + 1,
              action: "focus",
              targetId: id,
            }));
          }}
          onClose={() => setMerchantDialog(null)}
        />
      )}
      {merchantMode && merchantDialog === "preview" && (
        <MerchantRoomPreview
          editor={merchantRoom}
          design={current}
          rows={addedRows}
          onClose={() => setMerchantDialog(null)}
        />
      )}
      {merchantMode && merchantRoom.conflict && (
        <MerchantConflictDialog editor={merchantRoom} />
      )}
      {summaryOpen && !merchantMode && (
        <RoomSummaryModal
          name={current.name}
          room={`${current.roomName ?? "Миний өрөө"} · ${geometry.area.toFixed(1)} м²`}
          pieceCount={current.pieces.length}
          roomTotal={totalPrice}
          canBuyRoom={current.pieces.length > 0}
          onBuyRoom={buyEverything}
          onSave={save}
          onClose={() => setSummaryOpen(false)}
        />
      )}


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
