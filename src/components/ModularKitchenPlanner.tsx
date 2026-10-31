"use client";
import "@/features/planner/components/planner-catalog-upgrades.css";
import { KitchenSuggestionWizard } from "./KitchenSuggestionWizard";
import { KitchenServicesLegend } from "@/features/kitchen-planner/components/KitchenServicesLegend";
import { KitchenSetupSteps } from "@/features/kitchen-planner/components/KitchenSetupSteps";
import {
  isKitchenFlowStage,
  kitchenPreferences,
  restoreKitchenPreferences,
  type KitchenFlowStage,
  type KitchenSetupStage,
} from "@/lib/kitchenFlow";
import { DEFAULT_KITCHEN_SUGGESTION } from "@/lib/kitchenSuggestions";
import { furnishKitchenFromCatalog } from "@/lib/kitchenCatalogFurnishing";
import { createKitchenFromSelection } from "@/lib/kitchenSelectionDesign";
import { KitchenDesignSuggestions } from "@/features/kitchen-planner/components/KitchenDesignSuggestions";
import { PageSkeleton } from "@/components/PageSkeleton";
import { PlannerTour } from "@/features/planner/components/PlannerTour";
import { kitchenSaveStatus } from "@/lib/kitchenSaveStatus";
import { startPlannerNavigation } from "@/lib/plannerNavigation";

import { ExtrasPanel } from "@/features/kitchen-planner/components/ExtrasPanel";
import { pcmallAppliance } from "@/lib/pcmallAppliances";
import { resolveKitchenHoodMounts, snapKitchenHood } from "@/lib/kitchenHoodMounting";
import "@/features/kitchen-planner/components/kitchen-editor.css";
import "@/features/kitchen-planner/components/kitchen-flow.css";
import "@/features/kitchen-planner/components/kitchen-stitch.css";
import {
  KitchenPlannerHeader,
  type KitchenToolbarTool,
} from "@/features/kitchen-planner/components/KitchenPlannerHeader";
import { KitchenModelLibrary } from "@/features/kitchen-planner/components/KitchenModelLibrary";
import {
  KitchenViewDock,
  type KitchenWorkspaceView,
} from "@/features/kitchen-planner/components/KitchenViews";
import { KitchenWallElevation } from "@/features/kitchen-planner/components/KitchenWallElevation";
import { KitchenRoomPanel } from "@/features/kitchen-planner/components/KitchenRoomPanel";
import { KitchenBomTable, KitchenEstimatePanel } from "@/features/kitchen-planner/components/KitchenEstimate";
import { KitchenHandoffSheet, KitchenMeasurePanel } from "@/features/kitchen-planner/components/KitchenHandoff";
import { KitchenDesignTools } from "@/features/kitchen-planner/components/KitchenPlannerHeader";
import { kitchenProjectTitle, kitchenStepLock } from "@/lib/kitchenWorkspace";
import {
  KitchenMaterialScopeToggle,
  KitchenMaterialStatus,
  type KitchenMaterialScope,
} from "@/features/kitchen-planner/components/KitchenMaterialStatus";
import { useKitchenAppearanceStatus } from "@/store/kitchenAppearanceStatus";
import "@/features/kitchen-planner/components/kitchen-k.css";
import { KitchenPlanWorkspace } from "@/features/kitchen-planner/components/KitchenPlanWorkspace";
import { KitchenSelectionPanel } from "@/features/kitchen-planner/components/KitchenSelectionPanel";
import { KitchenCountertopAppearance } from "@/features/kitchen-planner/components/KitchenCountertopAppearance";
import { KitchenCornerPanel } from "@/features/kitchen-planner/components/KitchenCornerPanel";
import { KitchenFeaturesPanel } from "@/features/kitchen-planner/components/KitchenFeaturesPanel";
import { parseKitchenLineLighting } from "@/lib/kitchenLighting";
import { placeKitchenPlanningFurniture, type KitchenPlanningFurnitureKind } from "@/lib/kitchenPlanningFurniture";
import { withKitchenCountertopMaterial } from "@/lib/kitchenCountertopMaterial";
import { detachKitchenCountertops, updateKitchenCountertop, parseKitchenCountertopLayout } from "@/lib/kitchenCountertopLayout";
import { KitchenSpaceEditor } from "@/features/kitchen-planner/components/KitchenSpaceEditor";
import { KitchenStartDialog } from "@/features/kitchen-planner/components/KitchenStartDialog";
import { Plan } from "@/features/kitchen-planner/components/PlannerPanels";
import { KitchenMiniMap } from "@/features/kitchen-planner/components/KitchenMiniMap";
import { createKitchenCameraPoseStore } from "@/lib/kitchenCameraPose";
import { ProjectReport } from "@/features/kitchen-planner/components/ProjectReport";
import { VersionHistory } from "@/features/kitchen-planner/components/VersionHistory";
import { useKitchenCatalog } from "@/features/kitchen-planner/hooks/useKitchenCatalog";
import "@/features/planner/components/planner-reference.css";
import "@/features/planner/components/planner-sidebar.css";
import "@/features/planner/components/planner-studio.css";
import "@/features/planner/components/planner-tools.css";
import "@/features/planner/components/planner-usability.css";
import { usePlannerPanel } from "@/features/planner/components/usePlannerPanel";
import { PlannerSheetGrip } from "@/features/planner/components/PlannerSheetGrip";
import { PlannerViewport } from "@/features/planner/components/PlannerViewport";
import "@/features/planner/components/planner-responsive.css";
import { ViewportControls } from "@/features/planner/components/ViewportControls";
import { EditorHistory } from "@/lib/editorHistory";
import { FINISHES } from "@/lib/kitchen";
import { withKitchenSupplierMaterials } from "@/lib/kitchenSupplierMaterials";
import {
  arrangeKitchen,
  cloneKitchen,
  createUnifiedKitchen,
  parseKitchen,
} from "@/lib/kitchenAssembly";
import {
  fitBacksplashes,
  parseBacksplashSettings,
} from "@/lib/kitchenBacksplash";
import { buildKitchenBom } from "@/lib/kitchenBom";
import {
  cabinetLabel,
  createCabinet,
  roomWalls,
  validateCabinet,
  type CabinetPose,
  type ModularCabinet,
  type ModularKitchen,
} from "@/lib/kitchenCabinets";
import { cabinetFromCatalog } from "@/lib/kitchenCatalogInsertion";
import {
  componentTypes,
  parseComponents,
  withOpening,
} from "@/lib/kitchenComponents";
import {
  extraFromProduct,
  findExtraSpace,
  parseKitchenExtras,
  type KitchenExtra,
} from "@/lib/kitchenExtras";
import { type KitchenMaterialDefinition } from "@/lib/kitchenMaterials";
import {
  kitchenVariantFromModule,
  kitchenVariantFits,
  type KitchenCatalogModule,
  type KitchenCatalogVariant,
} from "@/lib/kitchenModuleCatalog";
import { reconcileKitchenCatalog as applyKitchenCatalogVariants } from "@/lib/kitchenCatalogRoleCorrections";
import {
  cabinetAxes,
  findCabinetSpace,
  fitCountertops,
  placementIssues,
  placementIssueAction,
  proposeCabinetMove,
  resolveElevations,
  settleWallCabinets,
  snapCabinet,
} from "@/lib/kitchenPlacement";
import { parseKitchenSpace } from "@/lib/kitchenSpace";
import type { CameraRequest } from "@/lib/plannerCamera";
import type { Product } from "@/lib/types";
import { useAuth } from "@/store/auth";
import { useCatalog } from "@/store/catalog";
import { useKitchens } from "@/store/kitchens";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Grid2X2,
  HelpCircle,
  LayoutPanelTop,
  Move,
  Orbit,
  Copy,
  Moon,
  Plug,
  Repeat,
  RotateCw,
  Ruler,
  Sparkles,
  Save,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import dynamic from "next/dynamic";
import { PlannerLink as Link } from "@/components/PlannerLink";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Group } from "three";
import { KitchenExportButtons } from "./KitchenExportButtons";
import { KitchenQuoteRequest } from "./KitchenQuoteRequest";

import "@/features/kitchen-planner/components/kitchen-glb-workspace.css";
import "@/features/kitchen-planner/components/kitchen-ikea-layout.css";
import "@/features/kitchen-planner/styles/kitchen-studio-polish.css";
import "@/features/kitchen-planner/styles/kitchen-interaction-stability.css";
import "@/features/kitchen-planner/styles/kitchen-supplier-appliances.css";

const FALLBACK_MATERIALS: KitchenMaterialDefinition[] = FINISHES.map(
  (finish) => ({
    id: finish.id,
    name: finish.name,
    surfaceKind: (["marble", "concrete"] as string[]).includes(finish.id)
      ? "countertop"
      : "general",
    baseColor: finish.color,
    roughness: finish.roughness,
    metalness: 0,
    texturePaths: {},
  }),
);
const KITCHEN_LAYOUT_OPTIONS = [
  ["straight", "I · Шулуун"],
  ["l-right", "L · баруун булан"],
  ["l-left", "L · зүүн булан"],
  ["u", "U · гурван талт"],
  ["double-side", "Хоёр талт"],
] as const;
const KITCHEN_INSPECTOR_LABELS = {
  lighting: "Шугаман гэрэл",
  island: "Тек / Арал",
  corner: "Булангийн шийдэл",
  countertop: "Тавцангийн материал",
  materials: "Загвар / Өнгө",
  catalog: "Шүүгээ, төхөөрөмж",
  room: "Өрөөний хэмжээ",
  extras: "Тавилга, нэмэлт",
  selection: "Сонгосон шүүгээ",
};

const Scene = dynamic(
  () =>
    import("@/three/ModularKitchenScene").then(
      (module) => module.ModularKitchenScene,
    ),
  {
    ssr: false,
    loading: () => (
      <PageSkeleton
        compact
        layout="viewport"
        label="3D загварыг бэлдэж байна…"
      />
    ),
  },
);
const KitchenRoomFitStatus = dynamic(
  () =>
    import("./KitchenRoomFitStatus").then(
      (module) => module.KitchenRoomFitStatus,
    ),
  { ssr: false },
);
export function ModularKitchenPlanner({
  active = true,
  queryString = "",
}: {
  active?: boolean;
  queryString?: string;
}) {
  // The room map starts folded so the scene fills the canvas; it opens on demand.
  const [navigationMapOpen, setNavigationMapOpen] = useState(false);
  const [cameraPose] = useState(createKitchenCameraPoseStore);
  const [design, setDesign] = useState<ModularKitchen>(() => ({
    ...createUnifiedKitchen(),
    cabinets: [],
  }));
  const products = useCatalog();
  const history = useRef(new EditorHistory<ModularKitchen>());
  const [, redrawHistory] = useState(0);
  const user = useAuth((state) => state.user),
    library = useKitchens(),
    router = useRouter();
  const draftToken =
    new URLSearchParams(queryString).get("draft") ??
    new URLSearchParams(queryString).get("design");
  const draftSuffix =
    draftToken && /^[0-9a-f-]{36}$/i.test(draftToken) ? `-${draftToken}` : "";
  const legacyDraftKey = `tavilga-kitchen-draft-${user?.id ?? "guest"}`;
  const draftKey = `${legacyDraftKey}${draftSuffix}`;
  const [ready, setReady] = useState(false),
    [saving, setSaving] = useState(false);
  const [name, setName] = useState("Миний гал тогоо"),
    [savedId, setSavedId] = useState("");
  const [revision, setRevision] = useState(0);
  const [saveFailure, setSaveFailure] = useState("");
  const saveInFlight = useRef(false);
  const [draftWrite, setDraftWrite] = useState<{
    key: string;
    ok: boolean;
  } | null>(null);
  const marketplaceSource = library.items.find(
    (item) => item.id === savedId,
  )?.sourceMarketplaceDesignId;
  const [versionBusy, setVersionBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [spaceOpen, setSpaceOpen] = useState(() =>
    ["space", "setup", "new"].some(
      (key) => new URLSearchParams(queryString).get(key) === "1",
    ),
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogCategory, setCatalogCategory] = useState<"all" | "appliances">(
    "all",
  );
  const [extrasTab, setExtrasTab] = useState<"dining" | "extra" | "appliances">(
    "dining",
  );
  const [annotations, setAnnotations] = useState(true);
  const [searchRequest, setSearchRequest] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [measurementOpen, setMeasurementOpen] = useState(false);
  const [reviewImage, setReviewImage] = useState<string | null>(null);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [setupStage, setSetupStage] = useState<KitchenSetupStage | null>(null);
  const [flowPreferences, setFlowPreferences] = useState(
    DEFAULT_KITCHEN_SUGGESTION,
  );
  const currentFlowStage: KitchenFlowStage =
    setupStage ??
    (reviewOpen
      ? measurementOpen
        ? "measurement"
        : "finish"
      : suggestionsOpen
        ? "suggestions"
        : spaceOpen
          ? "space"
          : "design");
  const [tourRequest, setTourRequest] = useState(0);
  const [workspaceView, setWorkspaceView] = useState<KitchenWorkspaceView>(
    "3d",
  );
  const showWorkspaceView = (view: KitchenWorkspaceView) => {
    setWorkspaceView(view);
    if (view === "interior" || view === "3d") setMode("orbit");
  };
  /** Invalid drafts in the K1 panel (never saved) plus design-level issues. */
  const [roomDraftIssues, setRoomDraftIssues] = useState(0);
  const [designTab, setDesignTab] = useState<"catalog" | "materials" | "views">("catalog");
  const [night, setNight] = useState(false);
  const [services, setServices] = useState(false);
  const [materialScope, setMaterialScope] = useState<KitchenMaterialScope>("selected");
  // K2: the design step always shows one panel; with nothing else open it is
  // the catalog (or the views list the person chose).
  useEffect(() => {
    if (spaceOpen || reviewOpen || startOpen || setupStage) return;
    if (!catalogOpen && !settingsOpen && designTab !== "views") setCatalogOpen(true);
  }, [spaceOpen, reviewOpen, startOpen, setupStage, catalogOpen, settingsOpen, designTab]);
  const catalogRef = usePlannerPanel(
    catalogOpen && !spaceOpen && !startOpen && !reviewOpen && !settingsOpen,
    () => setCatalogOpen(false),
    1279,
    false,
  );
  const settingsRef = usePlannerPanel(
    settingsOpen && !spaceOpen && !startOpen && !reviewOpen,
    () => setSettingsOpen(false),
    1279,
    false,
  );
  const [sheetExpanded, setSheetExpanded] = useState(false);
  useEffect(() => setSheetExpanded(false), [catalogOpen, settingsOpen]);
  const [inspectorTab, setInspector] = useState<
    keyof typeof KITCHEN_INSPECTOR_LABELS
  >(() =>
    new URLSearchParams(queryString).get("new") === "1" ? "room" : "catalog",
  );
  const {
    moduleCatalog,
    assets: kitchenAssets,
    materialCatalog,
    loading: catalogLoading,
    error: catalogError,
    retry: retryCatalog,
  } = useKitchenCatalog(active);
  const [exportRoot, setExportRoot] = useState<Group | null>(null);
  const captureKitchen = useRef<(() => Promise<Blob | null>) | null>(null);
  const [captureEpoch, setCaptureEpoch] = useState(0);
  const registerKitchenCapture = useCallback(
    (capture: (() => Promise<Blob | null>) | null) => {
      captureKitchen.current = capture;
      if (capture) setCaptureEpoch((value) => value + 1);
    },
    [],
  );
  const [viewKey, setViewKey] = useState(0);
  const [cameraRequest, setCameraRequest] = useState<CameraRequest>();
  const [notice, setNotice] = useState<{
    text: string;
    tone: "error" | "success";
  }>({ text: "", tone: "error" });
  const message = notice.text;
  useEffect(() => {
    if (notice.tone !== "success" || !notice.text) return;
    const timer = setTimeout(() => setNotice(current => current === notice
      ? { text: "", tone: "success" } : current), 4500);
    return () => clearTimeout(timer);
  }, [notice]);
  const setMessage = useCallback(
    (text: string) => setNotice({ text, tone: "error" }),
    [],
  );
  const setSuccessMessage = useCallback(
    (text: string) => setNotice({ text, tone: "success" }),
    [],
  );
  const initialRead = useRef(false);
  const attemptedProjectRefresh = useRef(false);
  useEffect(() => {
    if (ready || initialRead.current) return;
    const query = new URLSearchParams(queryString),
      id = query.get("design");
    if (id) {
      if (!user) {
        setMessage("Хадгалсан гарнитураа нээхийн тулд нэвтэрнэ үү.");
        return;
      }
      if (library.owner !== user.id) return;
      const saved = library.items.find((item) => item.id === id);
      if (saved) {
        const next = cloneKitchen(saved.design);
        setDesign(next);
        setFlowPreferences(kitchenPreferences(next));
        designRef.current = next;
        setName(saved.name);
        setSavedId(saved.id);
        setRevision(saved.revision ?? 1);
        setSelectedId(null);
        initialRead.current = true;
        setReady(true);
        return;
      }
      if (!library.loading && !attemptedProjectRefresh.current) {
        attemptedProjectRefresh.current = true;
        void library.refresh();
        return;
      }
      if (library.loading || !library.loaded) {
        return;
      }
      setMessage("Энэ гарнитур таны хадгалсан загварт олдсонгүй.");
      return;
    } else {
      try {
        const fromGuest = !!user && query.get("importGuest") === "1";
        const guestRaw = fromGuest
          ? (localStorage.getItem(
              `tavilga-kitchen-draft-guest${draftSuffix}`,
            ) ?? localStorage.getItem("tavilga-kitchen-draft-guest"))
          : null;
        // A plain /kitchen visit resumes the draft last edited in this browser,
        // even when it was started under a ?draft= token.
        const lastKey = draftSuffix
          ? null
          : localStorage.getItem(`${legacyDraftKey}-last`);
        const raw =
          guestRaw ??
          (lastKey?.startsWith(legacyDraftKey)
            ? localStorage.getItem(lastKey)
            : null) ??
          localStorage.getItem(draftKey) ??
          localStorage.getItem(legacyDraftKey);
        if (!raw && !query.has("design")) setSpaceOpen(true);
        if (raw && query.get("new") !== "1") {
          const draft = JSON.parse(raw),
            next = parseKitchen(draft.design, { allowEmpty: true });
          setDesign(next);
          setFlowPreferences(
            restoreKitchenPreferences(draft.preferences, next),
          );
          if (isKitchenFlowStage(draft.flowStage)) {
            const stage = draft.flowStage;
            setSetupStage(
              stage === "room" || stage === "size" || stage === "equipment"
                ? stage
                : null,
            );
            setSpaceOpen(stage === "space");
            setSuggestionsOpen(stage === "suggestions");
            setReviewOpen(stage === "finish" || stage === "measurement");
            setMeasurementOpen(stage === "measurement");
          }
          designRef.current = next;
          setSelectedId(null);
          setName(
            typeof draft.name === "string"
              ? draft.name.slice(0, 100)
              : "Миний гал тогоо",
          );
          setSavedId(!guestRaw && typeof draft.id === "string" ? draft.id : "");
          setRevision(
            !guestRaw &&
              Number.isSafeInteger(draft.revision) &&
              draft.revision >= 0
              ? draft.revision
              : 0,
          );
          if (guestRaw) {
            localStorage.setItem(
              draftKey,
              JSON.stringify({ id: "", name: draft.name, design: next }),
            );
            // Keep the guest copy until the authenticated project is safely saved.
          }
        }
      } catch {
        /* An invalid local draft must not prevent starting a new design. */
      }
    }
    initialRead.current = true;
    setReady(true);
  }, [
    ready,
    user,
    library,
    draftKey,
    queryString,
    draftSuffix,
    legacyDraftKey,
    setMessage,
  ]);
  const draftPayload = useMemo(
    () =>
      JSON.stringify({
        id: savedId,
        name,
        design,
        revision,
        preferences: flowPreferences,
        flowStage: currentFlowStage,
      }),
    [savedId, name, design, revision, flowPreferences, currentFlowStage],
  );
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(draftKey, draftPayload);
      localStorage.setItem(`${legacyDraftKey}-last`, draftKey);
      setDraftWrite({
        key: `${draftKey}:${draftPayload}`,
        ok: localStorage.getItem(draftKey) === draftPayload,
      });
    } catch {
      setDraftWrite({ key: `${draftKey}:${draftPayload}`, ok: false });
    }
  }, [ready, draftKey, legacyDraftKey, draftPayload]);
  useEffect(() => {
    setSaveFailure("");
  }, [design, name]);
  useEffect(() => {
    if (
      ready &&
      user &&
      savedId &&
      revision > 0 &&
      library.owner === user.id &&
      !library.loaded &&
      !library.loading &&
      !library.error
    )
      void library.refresh();
  }, [ready, user, savedId, revision, library]);
  const designRef = useRef(design);
  designRef.current = design;
  useEffect(() => {
    if (!ready || !moduleCatalog.some((module) => module.variants.length))
      return;
    setDesign((current) => {
      let next = applyKitchenCatalogVariants(current, moduleCatalog);
      const generated = !savedId && !current.extras?.length && current.cabinets.length > 0 &&
        current.cabinets.every(c => !c.variantId && /^(base-|wall-|suggested-)/.test(c.id));
      if (generated) next = furnishKitchenFromCatalog(current, moduleCatalog).design ?? next;
      if (next !== current) designRef.current = next;
      return next;
    });
  }, [moduleCatalog, ready, savedId]);
  const [preview, setPreview] = useState<ModularKitchen | null>(null);
  const draftRef = useRef<ModularKitchen | null>(null);
  const dragBase = useRef<ModularKitchen | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"move" | "orbit">("move");
  const [snapMessage, setSnapMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const kitchen = preview ?? design;
  const selected = kitchen.cabinets.find((c) => c.id === selectedId);
  const inspector =
    inspectorTab === "selection" && !selected ? "catalog" : inspectorTab;
  const selectedExtra = kitchen.extras?.find((e) => e.id === selectedId);
  const variantModels = useMemo(
    () =>
      Object.fromEntries(
        moduleCatalog.flatMap((module) =>
          module.active ? module.variants.filter(variant => variant.active).map((variant) => [variant.furnitureModelId, kitchenVariantFromModule(module, variant)]) : [],
        ),
      ),
    [moduleCatalog],
  );
  const selectableMaterials = useMemo(
    () => withKitchenSupplierMaterials(materialCatalog.length ? materialCatalog : FALLBACK_MATERIALS),
    [materialCatalog],
  );
  const materialDefinitions = useMemo(
    () =>
      Object.fromEntries(
        selectableMaterials.map((material) => [material.id, material]),
      ),
    [selectableMaterials],
  );
  const sceneKitchen = useMemo(
    () => applyKitchenCatalogVariants(kitchen, moduleCatalog),
    [kitchen, moduleCatalog],
  );
  const issues = useMemo(() => placementIssues(kitchen), [kitchen]);
  const tops = useMemo(() => fitCountertops(kitchen), [kitchen]);
  const busy = dragging || saving || versionBusy || !ready;
  const saveStatus = useMemo(
    () =>
      kitchenSaveStatus({
        name,
        design: applyKitchenCatalogVariants(design, moduleCatalog),
        saved:
          library.owner === user?.id
            ? library.items.find((item) => item.id === savedId)
            : undefined,
        signedIn: !!user,
        saving,
        localSaved:
          draftWrite?.key === `${draftKey}:${draftPayload}`
            ? draftWrite.ok
            : undefined,
        loading:
          !ready ||
          (!!user &&
            !!savedId &&
            revision > 0 &&
            (library.owner !== user.id || (!library.loaded && !library.error))),
        saveError:
          saveFailure ||
          (revision > 0 && !library.items.some((item) => item.id === savedId)
            ? library.error
            : ""),
      }),
    [
      name,
      design,
      moduleCatalog,
      library,
      user,
      savedId,
      saving,
      draftWrite,
      draftKey,
      draftPayload,
      ready,
      revision,
      saveFailure,
    ],
  );
  const bom = useMemo(
    () => buildKitchenBom(kitchen, moduleCatalog, products.products),
    [kitchen, moduleCatalog, products.products],
  );
  useEffect(() => {
    if (!reviewOpen) return;
    let cancelled = false,
      url: string | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    setReviewImage(null);
    const capture = async (attempt = 0) => {
      try {
        const blob = await captureKitchen.current?.();
        if (cancelled) return;
        if (!blob) {
          if (attempt < 12)
            timer = setTimeout(() => void capture(attempt + 1), 350);
          return;
        }
        url = URL.createObjectURL(blob);
        setReviewImage(url);
      } catch {
        // The measured plan remains available if the browser cannot capture WebGL.
      }
    };
    void capture();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      if (url) URL.revokeObjectURL(url);
    };
  }, [reviewOpen, design, exportRoot, captureEpoch]);
  const historyAction = useCallback(
    (action: "undo" | "redo") => {
      if (busy) return;
      const next = history.current[action](designRef.current);
      if (!next) return;
      designRef.current = next;
      setDesign(next);
      const keepSelection =
        selectedId &&
        (next.cabinets.some((cabinet) => cabinet.id === selectedId) ||
          next.extras?.some((extra) => extra.id === selectedId));
      setSelectedId(keepSelection ? selectedId : null);
      setOpen(false);
      if (selectedId && !keepSelection) setSettingsOpen(false);
      setMessage("");
      redrawHistory((value) => value + 1);
    },
    [busy, selectedId, setMessage],
  );
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (startOpen || reviewOpen) return;
      if (
        target?.closest("input,textarea,select,[contenteditable='true']") ||
        !(event.ctrlKey || event.metaKey)
      )
        return;
      const key = event.key.toLowerCase();
      if (key !== "z" && key !== "y") return;
      event.preventDefault();
      historyAction(key === "y" || event.shiftKey ? "redo" : "undo");
    };
    window.addEventListener("keydown", shortcut);
    return () => window.removeEventListener("keydown", shortcut);
  }, [historyAction, startOpen, reviewOpen]);
  function duplicateCabinet() {
    if (!selected || busy) return;
    const copy = {
      ...cloneKitchen(design).cabinets.find((c) => c.id === selected.id)!,
      id: crypto.randomUUID(),
    };
    const result = findCabinetSpace(design, copy);
    if (!result) {
      setMessage("Хуулбар шүүгээ байрлуулах сул зай алга.");
      return;
    }
    if (commit(result)) selectCabinet(copy.id);
  }
  function addExtra(product: Product) {
    if (busy) return false;
    if ((design.extras?.length ?? 0) >= 40) { setMessage("Нэмэлт төхөөрөмж, тавилга 40 хүртэл байна."); return false; }
    if (!product.model) {
      setMessage("Энэ барааны 3D загвар хараахан бэлэн болоогүй.");
      return false;
    }
    const extra = findExtraSpace(
      design,
      extraFromProduct(product, crypto.randomUUID()),
      selectedId ?? undefined,
    );
    if (!extra) {
      setMessage(pcmallAppliance(product.id)?.planningPlacement === "countertop"
        ? "Төхөөрөмж багтах сул тавцан алга. Эхлээд тохирох хэмжээтэй тавцан байрлуулаарай."
        : "Энэ тавилга байрлуулах сул зай алга.");
      return false;
    }
    if (commit({ ...design, extras: [...(design.extras ?? []), extra] })) {
      selectCabinet(extra.id);
      return true;
    }
    return false;
  }
  function changeExtra(extra: KitchenExtra) {
    if (extra.asset?.type === "hood") {
      const { mount: _mount, ...loose } = extra;
      extra = snapKitchenHood(design, loose) ?? loose;
    }
    commit({
      ...design,
      extras: design.extras?.map((e) => (e.id === extra.id ? extra : e)),
    });
  }
  function addPlanningFurniture(kind: KitchenPlanningFurnitureKind, size: { width: number; depth: number; height: number }) {
    if (busy) return false;
    const extra = placeKitchenPlanningFurniture(designRef.current, kind, crypto.randomUUID(), size);
    if (!extra) return false;
    if (!commit({ ...designRef.current, extras: [...(designRef.current.extras ?? []), extra] })) return false;
    selectCabinet(extra.id);
    setWorkspaceView("3d"); setMode("move");
    setCameraRequest(previous => ({ id: (previous?.id ?? 0) + 1, action: "focus", targetId: extra.id }));
    setSuccessMessage(`${extra.name} нэмэгдлээ. Чирж байрлуулах эсвэл хэмжээг тохируулаарай.`);
    return true;
  }
  function duplicateExtra() {
    if (!selectedExtra || busy) return;
    if (!selectedExtra.model && !selectedExtra.planningFurniture) {
      setMessage("Энэ тавилгын 3D загвар хараахан бэлэн болоогүй.");
      return;
    }
    const copy = findExtraSpace(design, {
      ...selectedExtra,
      id: crypto.randomUUID(),
    });
    if (!copy) {
      setMessage("Хуулбар тавилга байрлуулах сул зай алга.");
      return;
    }
    if (commit({ ...design, extras: [...(design.extras ?? []), copy] }))
      selectCabinet(copy.id);
  }
  const materialName = (id?: string) =>
    (id && materialDefinitions[id]?.name) || id || "Сонгоогүй";
  const fronts = kitchen.cabinets.map((cabinet) => cabinet.frontMaterialId).filter(Boolean);
  const finishLabel = {
    front: fronts.length
      ? materialName(fronts.sort((x, y) => fronts.filter((v) => v === y).length - fronts.filter((v) => v === x).length)[0])
      : "Сонгоогүй",
    countertop: materialName(kitchen.countertop.materialId),
  };
  // K7 conflict: keep mine as the next revision, or open the newer one.
  const [resave, setResave] = useState(0);
  useEffect(() => {
    if (resave) void save();
    // `save` reads the latest revision; only the request counter matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resave]);
  async function resolveConflict(mine: boolean) {
    if (!savedId || busy) return;
    try {
      const versions = await library.versions(savedId);
      const latest = Math.max(revision, ...versions.map((version) => version.revision));
      if (mine) {
        setRevision(latest);
        setResave((value) => value + 1);
        return;
      }
      const newer = await library.version(savedId, latest);
      if (commit(cloneKitchen(newer.design))) {
        setName(newer.name);
        setRevision(latest);
        setSelectedId(null);
        useKitchens.setState({ conflict: false, error: "" });
        setMessage(`v${latest} нээгдлээ. Таны өөрчлөлт буцаах түүхэнд байна.`);
      }
    } catch (error) {
      setMessage((error as Error).message || "Хувилбаруудыг ачаалж чадсангүй.");
    }
  }
  async function save(place = false) {
    if (busy || !user || saveInFlight.current) return;
    let checked: ModularKitchen;
    try {
      checked = parseKitchen(
        applyKitchenCatalogVariants(design, moduleCatalog),
      );
    } catch (error) {
      setMessage((error as Error).message);
      return;
    }
    if (!name.trim()) {
      setMessage("Гарнитурын нэрийг оруулна уу.");
      return;
    }
    const id = savedId || crypto.randomUUID();
    setSavedId(id);
    saveInFlight.current = true;
    setSaveFailure("");
    setSaving(true);
    try {
      const saved = await library.save(id, name.trim(), checked, revision);
      if (saved) {
        setRevision(saved.revision ?? 1);
        let image: Blob | null = null;
        try {
          image = (await captureKitchen.current?.()) ?? null;
        } catch {
          /* The JSON project is already safe. */
        }
        let thumbnail: string | null = null;
        try {
          thumbnail = image
            ? await library.saveThumbnail(saved.id, image, saved.revision)
            : null;
        } catch {
          /* The account project is already saved; a failed picture must not mark it unsaved. */
        }
        setSuccessMessage(
          thumbnail
            ? "Гарнитур болон 3D нүүр зураг хадгалагдлаа."
            : "Гарнитур хадгалагдлаа. 3D нүүр зургийг энэ удаа хадгалж чадсангүй.",
        );
        if (place) {
          const href = `/planner?kitchen=${saved.id}`;
          startPlannerNavigation(href);
          router.push(href);
        }
        return saved;
      } else {
        const error =
          useKitchens.getState().error ||
          "Хадгалж чадсангүй. Дахин оролдоно уу.";
        setSaveFailure(error);
        setMessage(error);
      }
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : "Хадгалж чадсангүй. Дахин оролдоно уу.";
      setSaveFailure(text);
      setMessage(text);
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }
  function commit(next: ModularKitchen): boolean {
    if (saving || !ready) return false;
    next = applyKitchenCatalogVariants(resolveElevations(next), moduleCatalog);
    const invalid = next.cabinets.map(validateCabinet).find(Boolean);
    try {
      next.cabinets.forEach((c) => {
        if (c.components) parseComponents(c);
      });
    } catch (error) {
      setMessage((error as Error).message);
      return false;
    }
    try {
      parseKitchenSpace(next.room);
      parseKitchenLineLighting(next.lineLighting);
      parseBacksplashSettings(next.backsplashSettings, next.room);
      parseKitchenCountertopLayout(next.countertopLayout, next);
      parseKitchenExtras(
        next.extras,
        new Set(next.cabinets.map((c) => c.id)),
        next.room,
      );
    } catch (error) {
      setMessage((error as Error).message);
      return false;
    }
    const problem =
      invalid ||
      placementIssues(next).find((issue) => issue.severity === "error")
        ?.message;
    if (problem) {
      setMessage(problem);
      return false;
    }
    history.current.record(designRef.current, next);
    redrawHistory((value) => value + 1);
    designRef.current = next;
    setDesign(next);
    setMessage("");
    return true;
  }
  function applyCatalogModels() {
    const result = furnishKitchenFromCatalog(design, moduleCatalog, { alignEquipment: true });
    if (!result.design) { setMessage(result.error ?? "Тохирох загвар алга."); return; }
    if (commit(result.design)) {
      setOpen(false); setSelectedId(null); setSettingsOpen(false);
      setMessage(`Сангийн box, төхөөрөмжүүдийг байрлалд таарууллаа.${result.omitted ? ` Бодит өргөнд тааруулж ${result.omitted} илүү жишиг дээд box-ийг хаслаа.` : ''}`);
    }
  }
  // A fresh marketplace copy may hold measured boxes without catalog models
  // (a merchant GLB): build it once from library boxes so it looks real.
  const preparedCopy = useRef("");
  useEffect(() => {
    if (!ready || !savedId || !marketplaceSource || catalogLoading || catalogError || !moduleCatalog.length) return;
    if (preparedCopy.current === savedId) return;
    preparedCopy.current = savedId;
    const settled = settleWallCabinets(design);
    const missing = settled.cabinets.some(c => !kitchenVariantFits(variantModels[c.variantId ?? ""], c) && !["refrigerator", "hood", "oven"].includes(c.opening ?? ""));
    if (!missing && settled === design) return;
    const furnished = missing ? furnishKitchenFromCatalog(settled, moduleCatalog, { alignEquipment: true }).design : settled;
    if (furnished && commit(furnished)) {
      setSuccessMessage(missing ? "Загварыг сангийн 3D box-оор угсарлаа. Буцаах бол Undo дарна уу." : "Дээд шүүгээний өндрийг тохирох зайд тааруулав.");
      return;
    }
    if (settled !== design) commit(settled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, savedId, marketplaceSource, catalogLoading, catalogError, moduleCatalog]);
  function selectCabinet(id: string) {
    setSheetExpanded(false);
    if (fitCountertops(kitchen).some(top => top.id === id)) { editCountertop(id); return; }
    if (fitBacksplashes(kitchen).some((panel) => panel.id === id)) {
      setMessage(
        "Ханын хавтанг чирж зөөнө. Өндөр, хэмжээ, нарийн байрлалыг Тавцан хэсгээс тохируулна.",
      );
      return;
    }
    setSelectedId(id);
    setOpen(false);
    setCatalogOpen(false);
    if (designRef.current.extras?.some((extra) => extra.id === id)) {
      setInspector("extras");
      setSettingsOpen(true);
      return;
    }
    // Cabinet details replace the view list in the left panel; no floating card over the stage.
    setInspector("selection");
    setSettingsOpen(false);
    setDesignTab("views");
  }
  function start(id: string) {
    if (busy) return;
    setOpen(false);

    if (
      design.cabinets.some((c) => c.id === id) ||
      fitCountertops(design).some(top => top.id === id) ||
      design.extras?.some((e) => e.id === id)
    )
      setSelectedId(id);
    dragBase.current = designRef.current;
    draftRef.current = designRef.current;
    setDragging(true);
    setMessage("");
  }
  function move(id: string, pose: CabinetPose) {
    if (!dragBase.current) return;
    if (fitCountertops(dragBase.current).some(top => top.id === id)) {
      const next = updateKitchenCountertop(dragBase.current, id, { position: pose });
      draftRef.current = next;
      setPreview(next);
      setSnapMessage("Тавцанг боксоос тусдаа зөөж байна · Esc буцаах");
      return;
    }
    const base = dragBase.current,
      extra = base.extras?.find((e) => e.id === id);
    if (extra) {
      if (extra.asset?.type === "hood") {
        const { mount: _mount, ...loose } = extra;
        const mounted = snapKitchenHood(base, { ...loose, position: pose });
        if (mounted) {
          const next = { ...base, extras: base.extras?.map(e => e.id === id ? mounted : e) };
          draftRef.current = next;
          setPreview(next);
          setSnapMessage("Сорогч box-ийн доор төвлөж, өндөр ба гүнд таарлаа");
          return;
        }
      }
      const footprint = (e: KitchenExtra): ModularCabinet => ({
        ...createCabinet("base", e.id),
        width: e.width,
        height: e.height,
        depth: e.depth,
        position: e.position,
      });
      const result = snapCabinet(
        footprint(extra),
        pose,
        [
          ...base.cabinets,
          ...(base.extras ?? []).filter((e) => e.id !== id).map(footprint),
        ],
        roomWalls(base.room),
        base.room,
        draftRef.current?.extras?.find((e) => e.id === id)?.position,
      );
      const next = {
        ...base,
        extras: base.extras?.map((e) => {
          if (e.id !== id) return e;
          const { mount: _mount, ...loose } = e;
          return { ...loose, position: result.position };
        }),
      };
      draftRef.current = next;
      setPreview(next);
      setSnapMessage(
        result.wallId
          ? "Нэмэлт тавилга хананд таарлаа"
          : "Нэмэлт тавилга зөөж байна",
      );
      return;
    }
    const panels = fitBacksplashes(dragBase.current);
    if (panels.some((panel) => panel.id === id)) {
      const next = {
        ...dragBase.current,
        backsplashSettings: {
          mode: "manual" as const,
          panels: panels.map((panel) =>
            panel.id === id ? { ...panel, position: pose } : panel,
          ),
        },
      };
      draftRef.current = next;
      setPreview(next);
      setSnapMessage("Ханын хавтан · байрлалыг миллиметрээр тохируулж байна");
      return;
    }
    const result = proposeCabinetMove(
      dragBase.current,
      id,
      pose,
      draftRef.current?.cabinets.find((c) => c.id === id)?.position,
    );
    const mounted = resolveKitchenHoodMounts(result.kitchen);
    draftRef.current = mounted;
    setPreview(mounted);
    setSnapMessage(
      [
        result.wallId ? "Хананд таарлаа" : "",
        result.neighbourId ? "Шүүгээтэй зайгүй таарлаа" : "",
      ]
        .filter(Boolean)
        .join(" · "),
    );
  }
  function finish(cancel = false) {
    if (!dragBase.current) return;
    const next = draftRef.current;
    if (!cancel && next) {
      const issue = placementIssues(next).find(
        (item) => item.severity === "error",
      );
      if (issue) setMessage(`${issue.message} Өмнөх байрлалд буцаалаа.`);
      else if (!commit(next))
        setMessage("Энд байрлуулах боломжгүй тул өмнөх байрлалд буцаалаа.");
    }
    dragBase.current = null;
    draftRef.current = null;
    setPreview(null);
    setDragging(false);
    setSnapMessage("");
    if (inspectorTab === "countertop") setSettingsOpen(true);
  }
  /** K4: cabinets whose GLB reports load state (procedural bodies do not). */
  const tracksAppearance = (cabinet: ModularCabinet) =>
    !!variantModels[cabinet.variantId ?? ""]?.glbFile && !cabinet.catalogHousing;
  const appearanceTargets = kitchen.cabinets.filter(tracksAppearance);
  function changeAppearance(patch: Partial<ModularCabinet>): string | undefined {
    const material = "frontMaterialId" in patch || "carcassMaterialId" in patch;
    if (!material || !selected) return updateCabinet(patch);
    const targets =
      materialScope === "all" ? design.cabinets.filter(tracksAppearance) : [selected];
    const status = useKitchenAppearanceStatus.getState();
    for (const cabinet of targets)
      if (
        tracksAppearance(cabinet) &&
        (("frontMaterialId" in patch && patch.frontMaterialId !== cabinet.frontMaterialId) ||
          ("carcassMaterialId" in patch && patch.carcassMaterialId !== cabinet.carcassMaterialId))
      )
        status.begin(cabinet.id, {
          frontMaterialId: cabinet.frontMaterialId,
          carcassMaterialId: cabinet.carcassMaterialId,
        });
    if (materialScope !== "all") return updateCabinet(patch);
    if (busy) return "Өөрчлөлт дуусахыг хүлээнэ үү.";
    const ids = new Set(targets.map((cabinet) => cabinet.id).concat(selected.id));
    return commit({
      ...design,
      cabinets: design.cabinets.map((cabinet) =>
        ids.has(cabinet.id) ? { ...cabinet, ...patch } : cabinet,
      ),
    })
      ? undefined
      : "Материал солиход алдаа гарлаа.";
  }
  function revertAppearance(previous: Record<string, Partial<ModularCabinet>>) {
    if (
      commit({
        ...design,
        cabinets: design.cabinets.map((cabinet) =>
          previous[cabinet.id] ? { ...cabinet, ...previous[cabinet.id] } : cabinet,
        ),
      })
    )
      for (const id of Object.keys(previous))
        useKitchenAppearanceStatus.getState().forget(id);
  }
  function updateCabinet(patch: Partial<ModularCabinet>): string | undefined {
    if (!selected || busy) return "Өөрчлөлт дуусахыг хүлээнэ үү.";
    if (patch.depth !== undefined && !patch.position) {
      const { front } = cabinetAxes(selected.position.rotation),
        delta = (patch.depth - selected.depth) / 2;
      patch = {
        ...patch,
        position: {
          ...selected.position,
          x: selected.position.x + front.x * delta,
          z: selected.position.z + front.z * delta,
        },
      };
    }
    const updated = { ...selected, ...patch };
    if (
      patch.variantId === undefined &&
      [
        "type",
        "width",
        "height",
        "depth",
        "opening",
        "doorCount",
        "drawerCount",
        "corner",
      ].some((key) => key in patch)
    )
      { delete updated.variantId; delete updated.catalogAdaptation; }
    if (updated.components)
      updated.components = updated.components.filter((item) =>
        componentTypes(updated).includes(item.type),
      );
    const error = validateCabinet(updated);
    if (error) {
      setMessage(error);
      return error;
    }
    const next = {
      ...design,
      cabinets: design.cabinets.map((c) =>
        c.id === selected.id ? updated : c,
      ),
    };
    try {
      if (updated.components) parseComponents(updated);
    } catch (error) {
      setMessage((error as Error).message);
      return (error as Error).message;
    }
    const problem = placementIssues(resolveElevations(next)).find(
      (issue) => issue.severity === "error",
    )?.message;
    if (problem) {
      setMessage(problem);
      return problem;
    }
    return commit(next) ? undefined : "Өөрчлөлтийг хийж чадсангүй.";
  }
  function editCountertop(id?: string) {
    if (busy) return;
    setOpen(false);
    setCatalogOpen(false);
    setInspector("countertop");
    setSettingsOpen(true);
    setSelectedId(id ?? fitCountertops(designRef.current)[0]?.id ?? null);
  }
  function changeCountertopMaterial(id: string | undefined): string | undefined {
    if (busy) return "Өөрчлөлт дуусахыг хүлээнэ үү.";
    try {
      return commit(withKitchenCountertopMaterial(designRef.current, id, materialDefinitions))
        ? undefined : "Тавцангийн материалыг сольж чадсангүй. Байрлалын мэдэгдлийг шалгана уу.";
    } catch (error) {
      return (error as Error).message;
    }
  }
  function changeStage(stage: KitchenFlowStage) {
    // K1: a room with errors keeps steps 2–4 closed, whichever control asked.
    const opensLaterStep = !["room", "size", "equipment", "space"].includes(stage);
    if (opensLaterStep && lockReason) {
      setMessage(lockReason);
      return;
    }
    if (stage === "equipment" && setupStage !== "equipment")
      setFlowPreferences(kitchenPreferences(designRef.current));
    setSetupStage(
      stage === "room" || stage === "size" || stage === "equipment"
        ? stage
        : null,
    );
    setCatalogOpen(false);
    setSettingsOpen(false);
    setSuggestionsOpen(stage === "suggestions");
    setSpaceOpen(stage === "space");
    setReviewOpen(stage === "finish" || stage === "measurement");
    setMeasurementOpen(stage === "measurement");
    if (stage === "design") {
      setInspector(selected ? "selection" : "catalog");
      setSettingsOpen(Boolean(selected));
      setCatalogOpen(!selected);
      setWorkspaceView("3d");
    }
  }

  function completeEquipment(preferences: typeof flowPreferences) {
    if (busy || catalogLoading) return false;
    try {
      const next = createKitchenFromSelection(designRef.current, preferences, moduleCatalog);
      if (!commit(next)) return false;
      setFlowPreferences(preferences); setSetupStage(null); setSpaceOpen(false);
      setSuggestionsOpen(false); setReviewOpen(false); setSettingsOpen(false); setCatalogOpen(false);
      setSelectedId(null); setWorkspaceView('3d'); setMode('orbit');
      setViewKey(key => key + 1); setMessage('Таны 4 сонголтод таарсан гал тогооны загвар үүслээ.');
      return true;
    } catch (reason) { setMessage((reason as Error).message); return false; }
  }

  function openToolbarTool(tool: KitchenToolbarTool) {
    if (tool === "corner" || tool === "lighting" || tool === "island") {
      setOpen(false); setSelectedId(null); setCatalogOpen(false); setSuggestionsOpen(false); setSpaceOpen(false); setReviewOpen(false);
      setInspector(tool); setSettingsOpen(true); setWorkspaceView("3d"); return;
    }
    setSuggestionsOpen(false);
    if (tool === "photo") {
      changeStage("finish");
      return;
    }
    setSpaceOpen(false);
    setReviewOpen(false);
    if (tool === "annotation") {
      setWorkspaceView("2d");
      setAnnotations((value) => !value);
      return;
    }
    setSelectedId(null);
    if (tool === "dining" || tool === "items" || tool === "appliances") {
      setExtrasTab(
        tool === "dining"
          ? "dining"
          : tool === "appliances"
            ? "appliances"
            : "extra",
      );
      setInspector("extras");
      setCatalogOpen(false);
      setSettingsOpen(true);
    } else {
      setCatalogCategory("all");
      setInspector("catalog");
      setSettingsOpen(false);
      setCatalogOpen(true);
      if (tool === "search") setSearchRequest((value) => value + 1);
    }
  }

  function addCatalogCabinet(
    module: KitchenCatalogModule,
    variant: KitchenCatalogVariant,
  ) {
    if (busy || design.cabinets.length >= 80) return;
    const cabinet = cabinetFromCatalog(
      module,
      variant,
      crypto.randomUUID(),
      design.room.height,
    );
    if (!cabinet) { setMessage("Энэ загварыг шүүгээ болгон байрлуулах боломжгүй. Тохирох төрлийн шүүгээ сонгоно уу."); return; }
    const issue = validateCabinet(cabinet);
    if (issue) {
      setMessage(issue);
      return;
    }
    const next = findCabinetSpace(design, cabinet);
    if (!next) {
      setMessage(
        "Энэ загвар багтах сул зай алга. Шүүгээ зөөх эсвэл өрөөний хэмжээг өөрчилнө үү.",
      );
      return;
    }
    if (commit(next)) {
      setSelectedId(cabinet.id);
      setInspector("selection");
      setCatalogOpen(false);
      setSettingsOpen(true);
      setSuccessMessage(`${variant.modelName || module.name} нэмэгдлээ.`);
    }
  }
  function replaceCabinet(cabinet: ModularCabinet) {
    const next = resolveElevations({
      ...design,
      cabinets: design.cabinets.map((c) => (c.id === cabinet.id ? cabinet : c)),
    });
    if (!placementIssues(next).some((issue) => issue.severity === "error")) {
      commit(next);
      return;
    }
    const fitted = findCabinetSpace(
      {
        ...design,
        cabinets: design.cabinets.filter((c) => c.id !== cabinet.id),
      },
      cabinet,
    );
    if (fitted) commit(fitted);
    else setMessage("Энэ төхөөрөмжийн хэмжээтэй сул зай алга.");
  }
  function replaceWithCatalogVariant(
    module: KitchenCatalogModule,
    variant: KitchenCatalogVariant,
  ) {
    if (!selected || busy) return;
    if (module.cabinetType !== (selected.corner ? "corner" : selected.type)) {
      setMessage("Тавилгын төрөл, бэхэлгээ тохирохгүй байна."); return;
    }
    const { front } = cabinetAxes(selected.position.rotation);
    const depthShift = (module.depthMm - selected.depth) / 2;
    const replacement = withOpening(
      createCabinet(
        selected.type,
        selected.id,
        module.widthMm,
        design.room.height,
      ),
      variant.opening,
    );
    const nextCabinet: ModularCabinet = {
      ...replacement,
      width: module.widthMm,
      height: module.heightMm,
      depth: module.depthMm,
      doorCount: variant.doorCount === 2 && module.widthMm >= 600 ? 2 : 1,
      drawerCount:
        variant.opening === "drawers"
          ? Math.max(1, Math.min(4, variant.drawerCount || 3))
          : 0,
      variantId: variant.furnitureModelId,
      finish: selected.finish,
      frontMaterialId: selected.frontMaterialId,
      carcassMaterialId: selected.carcassMaterialId,
      frontStyle: selected.frontStyle,
      handleStyle: selected.handleStyle,
      color: selected.color,
      material: selected.material,
      autoElevation: selected.type === "wall" && selected.autoElevation,
      fitToCeiling: false,
      corner: module.cabinetType === "corner",
      cornerSide:
        module.cabinetType === "corner"
          ? (selected.cornerSide ?? "right")
          : undefined,
      position: {
        ...selected.position,
        x: selected.position.x + front.x * depthShift,
        y: selected.type === "wall" ? selected.position.y : 0,
        z: selected.position.z + front.z * depthShift,
      },
    };
    const error = validateCabinet(nextCabinet);
    if (error) {
      setMessage(error);
      return;
    }
    const next = resolveElevations({ ...design, cabinets: design.cabinets.map(c => c.id === selected.id ? nextCabinet : c) });
    const conflict = placementIssues(next).find(issue => issue.severity === "error");
    if (conflict) { setMessage(`${conflict.message} Өөр хэмжээ сонгох эсвэл эхлээд байрлалаа өөрчилнө үү.`); return; }
    if (commit(next)) setSuccessMessage(`${variant.modelName || module.name} сонголоо.`);
  }
  const loginHref = `/login?next=${encodeURIComponent(new URLSearchParams(queryString).has("design") ? `/kitchen?${queryString}` : `/kitchen?importGuest=1${draftToken ? `&draft=${encodeURIComponent(draftToken)}` : ""}`)}`;
  const plannerNotice = (inline = false) =>
    message && (
      <div
        className={`kp-error ${inline ? "kp-sheet-notice" : "kp-global-notice"}`}
        data-tone={notice.tone}
        role={notice.tone === "success" ? "status" : "alert"}
      >
        <span>{message}</span>
        <button type="button" onClick={() => setMessage("")}>
          Хаах
        </button>
      </div>
    );
  const activeTool: KitchenToolbarTool | undefined = catalogOpen
    ? catalogCategory === "appliances"
      ? "appliances"
      : "cabinets"
    : (inspector === "corner" || inspector === "lighting" || inspector === "island") && settingsOpen
      ? inspector
      : inspector === "extras" && settingsOpen
        ? extrasTab === "dining"
          ? "dining"
          : extrasTab === "appliances"
            ? "appliances"
            : "items"
        : undefined;
  const materialsTab = settingsOpen && (inspector === "materials" || inspector === "countertop");
  // The view switcher lives on the canvas dock, so the third tab exists only as the selection's details.
  const shownDesignTab = materialsTab ? "materials" : selected && designTab === "views" && !catalogOpen && !settingsOpen ? "views" : "catalog";
  const selectedName = selected
    ? variantModels[selected.variantId ?? ""]?.modelName || cabinetLabel(selected)
    : null;
  const missingModelCabinets = sceneKitchen.cabinets.filter(
    (c) => !variantModels[c.variantId ?? ""]?.glbFile && !["refrigerator", "hood"].includes(c.opening ?? ""),
  );
  const missingModelIds = new Set(
    sceneKitchen.cabinets
      .filter((c) => !kitchenVariantFits(variantModels[c.variantId ?? ""], c) && !["refrigerator", "hood", "oven"].includes(c.opening ?? ""))
      .map((c) => c.id),
  );
  const designTabs = (
    <div className="kitchen-k-tabs" role="tablist" aria-label="Тохижуулах хэсэг" data-count={selected && !materialsTab ? 3 : 2}>
      {([
        ["catalog", "Каталог", `${kitchen.cabinets.length} модуль`],
        ["materials", "Материал", "Нүүр · тавцан"],
        ...(selected && !materialsTab
          ? ([["views", "Дэлгэрэнгүй", selectedName ?? ""]] as const)
          : []),
      ] as const).map(([id, label, meta]) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={shownDesignTab === id}
          onClick={() => {
            setDesignTab(id);
            if (id === "catalog") {
              setSettingsOpen(false);
              setCatalogOpen(true);
            } else if (id === "materials") {
              setCatalogOpen(false);
              setInspector("materials");
              setSettingsOpen(true);
            } else {
              setCatalogOpen(false);
              setSettingsOpen(false);
            }
          }}
        >
          <span>{label}</span>
          <small>{meta}</small>
        </button>
      ))}
    </div>
  );
  /** The selected cabinet's controls: inline in the left panel, or in the materials drawer. */
  function selectionPanel(initialMode: "overview" | "modify", layout: "drawer" | "detail" = "drawer") {
    if (!selected) return null;
    return (
    <KitchenSelectionPanel
      key={`${selected.id}:${selected.variantId ?? ""}:${inspector}:${layout}`}
      layout={layout}
      cabinet={
        sceneKitchen.cabinets.find((c) => c.id === selected.id) ??
        selected
      }
      variant={
        variantModels[
          sceneKitchen.cabinets.find((c) => c.id === selected.id)
            ?.variantId ?? ""
        ]
      }
      modules={moduleCatalog}
      materials={selectableMaterials}
      onChangeAppearance={changeAppearance}
      onEditCountertop={editCountertop}
      disabled={busy}
      initialMode={inspector === "materials" ? "modify" : "overview"}
      isOpen={open}
      onToggleOpen={() => {
        setOpen((value) => !value);
        setWorkspaceView("3d");
        setMode("orbit");
      }}
      onZoom={() => {
        setWorkspaceView("3d");
        setMode("orbit");
        setCameraRequest((previous) => ({
          id: (previous?.id ?? 0) + 1,
          action: "focus",
          targetId: selected.id,
        }));
      }}
      onChangeSelections={(partSelections) =>
        updateCabinet({ partSelections })
      }
      onReplace={replaceWithCatalogVariant}
      products={products.products}
      onPositionChange={position => updateCabinet({ position })}
      onDuplicate={duplicateCabinet}
      onRemove={() => {
        if (
          commit({
            ...design,
            cabinets: design.cabinets.filter(
              (c) => c.id !== selected.id,
            ),
            extras: design.extras?.filter(e => e.mount?.cabinetId !== selected.id),
          })
        ) {
          setSelectedId(null);
          setSettingsOpen(false);
        }
      }}
      onClose={() => {
        setSettingsOpen(false);
        setSelectedId(null);
        setOpen(false);
      }}
    />
    );
  }
  const lockReason =
    spaceOpen && roomDraftIssues
      ? `Өрөөний ${roomDraftIssues} алдааг засаад дараагийн алхам руу орно.`
      : kitchenStepLock(design.room);
  return (
    <main
      className="kp kp-shell kitchen-k planner-studio planner-reference kitchen-reference kitchen-refined kitchen-flow kitchen-glb-workspace kitchen-ikea-layout kitchen-simple-workflow"
      data-room-setup={spaceOpen}
      data-planner-ready={ready ? "kitchen" : undefined}
      data-workflow-stage={currentFlowStage}
      data-stage={
        reviewOpen
          ? "review"
          : spaceOpen
            ? "room"
            : inspector === "materials"
              ? "materials"
              : "layout"
      }
      data-view={workspaceView}
    >
      <PlannerTour
        kind="kitchen"
        enabled={
          active &&
          ready &&
          !setupStage &&
          !startOpen &&
          !spaceOpen &&
          !reviewOpen
        }
        request={tourRequest}
      />
      <PlannerViewport />
      {ready && startOpen && (
        <KitchenStartDialog
          kitchen={design}
          disabled={busy}
          onClose={() => setStartOpen(false)}
          onCreate={(next) => {
            if (!commit(next)) return false;
            setSelectedId(null);
            setSavedId("");
            setRevision(0);
            setName("Миний гал тогоо");
            setSettingsOpen(false);
            setWorkspaceView("2d");
            setViewKey((k) => k + 1);
            setSpaceOpen(true);
            return true;
          }}
        />
      )}
      <KitchenPlannerHeader
        stage={currentFlowStage}
        onStage={changeStage}
        title={kitchenProjectTitle(design.room)}
        lockReason={lockReason}
        onLocked={setMessage}
        activeTool={activeTool}
        onTool={openToolbarTool}
        busy={busy}
        canUndo={Boolean(history.current.undoCount)}
        canRedo={Boolean(history.current.redoCount)}
        onUndo={() => historyAction("undo")}
        onRedo={() => historyAction("redo")}
        onSave={user ? () => void save() : undefined}
        loginHref={`/login?next=${encodeURIComponent(new URLSearchParams(queryString).has("design") ? `/kitchen?${queryString}` : `/kitchen?importGuest=1${draftToken ? `&draft=${encodeURIComponent(draftToken)}` : ""}`)}`}
        name={name}
        onName={setName}
        subtotal={bom.knownSubtotal}
        annotations={annotations}
        itemCount={kitchen.cabinets.length + (kitchen.extras?.length ?? 0)}
        unpricedCount={bom.unpricedCount}
        saveStatus={saveStatus}
        utilities={
          <>
            <button
              type="button"
              aria-label="Ашиглах заавар"
              title="Ашиглах заавар"
              aria-haspopup="dialog"
              onClick={() => {
                setSpaceOpen(false);
                setReviewOpen(false);
                setStartOpen(false);
                setCatalogOpen(false);
                setSettingsOpen(false);
                setTourRequest((value) => value + 1);
              }}
            >
              <HelpCircle size={18} />
            </button>
            <details className="kp-top-menu kp-more-menu">
              <summary aria-label="Нэмэлт үйлдэл">•••</summary>
              <div className="kp-more-content">
                <details
                  className="km-layout-menu kp-top-menu"
                  data-planner-tour="kitchen-layout"
                >
                  <summary>
                    <LayoutPanelTop size={18} />
                    <span>Байрлал</span>
                    <ChevronDown size={15} />
                  </summary>
                  <div
                    className="km-layout-options"
                    role="group"
                    aria-label="Гарнитурын хэлбэр"
                  >
                    {KITCHEN_LAYOUT_OPTIONS.map(([layout, label]) => (
                      <button
                        key={layout}
                        type="button"
                        disabled={busy}
                        aria-pressed={(design.layout ?? "straight") === layout}
                        onClick={(event) => {
                          if (commit(arrangeKitchen(design, layout))) {
                            setViewKey((key) => key + 1);
                            event.currentTarget
                              .closest("details")
                              ?.removeAttribute("open");
                          }
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </details>
                <button
                  type="button"
                  disabled={busy}
                  onClick={(event) => {
                    changeStage("suggestions");
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open");
                  }}
                >
                  Байрлалын санал үзэх
                </button>
                <button type="button" disabled={busy || catalogLoading || catalogError} onClick={event => {
                  applyCatalogModels(); event.currentTarget.closest('details')?.removeAttribute('open');
                }}>Сангийн box, төхөөрөмжөөр солих</button>
                <button
                  type="button"
                  onClick={(event) => {
                    setSpaceOpen(false);
                    setReviewOpen(false);
                    setStartOpen(false);
                    setCatalogOpen(false);
                    setSettingsOpen(false);
                    setTourRequest((value) => value + 1);
                    event.currentTarget
                      .closest("details")
                      ?.removeAttribute("open");
                  }}
                >
                  Ашиглах заавар
                </button>
                {user && (
                  <button type="button" onClick={() => void save(true)}>
                    Хадгалаад өрөөнд байрлуулах
                  </button>
                )}
                <button type="button" onClick={() => setStartOpen(true)}>
                  Шинэ гал тогоо
                </button>
                {user && (
                  <Link href="/account#kitchen-garniture">
                    Өөрийн гарнитурууд
                  </Link>
                )}
                {user && savedId && revision > 0 && (
                  <VersionHistory
                    id={savedId}
                    revision={revision}
                    disabled={busy}
                    onBusyChange={setVersionBusy}
                    onRestore={(versionName, versionDesign) => {
                      if (commit(cloneKitchen(versionDesign))) {
                        setName(versionName);
                        setSelectedId(null);
                        setViewKey((key) => key + 1);
                        setMessage(
                          "Өмнөх хувилбар редакторт ачааллаа. Хадгалахад шинэ хувилбар болно.",
                        );
                      }
                    }}
                  />
                )}
                {user && savedId && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setSavedId("");
                      setRevision(0);
                      setMessage("Дараагийн хадгалалт шинэ хуулбар үүсгэнэ.");
                    }}
                  >
                    Шинэ хуулбар болгон хадгалах
                  </button>
                )}
                {ready && <KitchenRoomFitStatus kitchen={design} name={name} />}
                <KitchenExportButtons
                  root={exportRoot}
                  name={name}
                  disabled={busy || !kitchen.cabinets.length}
                />
              </div>
            </details>
          </>
        }
      />
      {setupStage && <div className="kitchen-early-steps">
        {setupStage === "equipment" ? <>
          <KitchenSuggestionWizard roomDimensions={{ width: design.room.width / 1000, depth: design.room.depth / 1000, height: design.room.height / 1000 }} room={design.room} initialPreferences={flowPreferences} onPreferencesChange={setFlowPreferences} onBack={() => changeStage("space")} onSkip={() => changeStage("design")} onComplete={completeEquipment} disabled={busy || catalogLoading} />
          {message && <p className="kitchen-setup-error" role="alert">{message}</p>}
        </> : <KitchenSetupSteps stage={setupStage} kitchen={design} disabled={busy} message={message} onChange={commit} onStage={changeStage} />}
      </div>}
      {suggestionsOpen && <KitchenDesignSuggestions kitchen={design} modules={moduleCatalog} products={products.products} variantModels={variantModels} materialDefinitions={materialDefinitions} disabled={busy} onApply={commit} onBack={() => changeStage("design")} onFinish={() => changeStage("finish")} />}
      {spaceOpen && (
        <aside className="kitchen-k-panel kitchen-k-room-panel" aria-label="Засварын самбар" data-sheet-expanded={sheetExpanded}>
          <PlannerSheetGrip expanded={sheetExpanded} onExpand={setSheetExpanded} onClose={() => setSheetExpanded(false)} />
          <div className="kitchen-k-panel-scroll">
            <KitchenRoomPanel
              kitchen={design}
              disabled={busy}
              onChange={commit}
              onIssues={setRoomDraftIssues}
            />
          </div>
          <footer className="kitchen-k-panel-foot">
            <span role="status" data-error={!!lockReason || undefined}>
              {lockReason ?? "Бүх хэмжээ зөв"}
            </span>
            <button
              type="button"
              className="kitchen-k-primary"
              disabled={busy}
              aria-disabled={!!lockReason || undefined}
              // An empty kitchen starts from the smart wizard; an existing one goes straight to editing.
              onClick={() => changeStage(lockReason || design.cabinets.length ? "design" : "equipment")}
            >
              Дараах: Тохижуулах
            </button>
          </footer>
        </aside>
      )}
      {spaceOpen && (
        <KitchenSpaceEditor
          kitchen={design}
          disabled={busy}
          onChange={commit}
          onCatalog={(type) =>
            openToolbarTool(type === "appliances" ? "appliances" : "cabinets")
          }
          onClose={() => {
            changeStage("design");
          }}
          onMaterials={() => {
            setSpaceOpen(false);
            setInspector("materials");
            setCatalogOpen(false);
            setSettingsOpen(true);
          }}
          onView3D={() => {
            setSpaceOpen(false);
            setWorkspaceView("3d");
          }}
          onReview={() => {
            setSpaceOpen(false);
            setReviewOpen(true);
          }}
          onSelectCabinet={selectCabinet}
        />
      )}
      {(!ready || library.error) && (
        <div
          className="kp-loading-strip"
          role={library.error ? "alert" : "status"}
        >
          {library.error || "Хадгалсан загварыг нээж байна…"}
          {library.error && (
            <button type="button" onClick={() => void library.refresh()}>
              Дахин оролдох
            </button>
          )}
        </div>
      )}
      <div
        className="kp-layout"
        inert={reviewOpen || undefined}
        data-settings-open={settingsOpen}
        data-left-open={settingsOpen || catalogOpen}
        hidden={Boolean(setupStage) || spaceOpen || suggestionsOpen}
      >
        {catalogOpen && (
          <button
            type="button"
            className="kitchen-catalog-backdrop"
            aria-label="Каталог хаах"
            onClick={() => setCatalogOpen(false)}
          />
        )}
        <aside
          ref={catalogRef}
          data-sheet-expanded={sheetExpanded}
          className={`kitchen-flow-catalog ${catalogOpen ? "is-open" : ""}`}
          aria-label="Шүүгээ, төхөөрөмжийн каталог"
        >
          <PlannerSheetGrip
            expanded={sheetExpanded}
            onExpand={setSheetExpanded}
            onClose={() => setCatalogOpen(false)}
          />
          {designTabs}
          <KitchenDesignTools
            activeTool={activeTool}
            annotations={annotations}
            busy={busy}
            onTool={openToolbarTool}
          />
          {catalogOpen && plannerNotice(true)}
          <header>
            <div>
              <small>МОДУЛЬ КАТАЛОГИ</small>
              <h2>Гал тогооны элементүүд</h2>
            </div>
            <button
              type="button"
              aria-label="Каталог хаах"
              onClick={() => setCatalogOpen(false)}
            >
              <X size={18} />
            </button>
          </header>
          <KitchenModelLibrary
            key={catalogCategory}
            modules={moduleCatalog}
            loading={catalogLoading}
            error={catalogError}
            retry={retryCatalog}
            disabled={busy || kitchen.cabinets.length >= 80}
            onAdd={addCatalogCabinet}
            category={catalogCategory}
            searchRequest={searchRequest}
          />
          <details className="kitchen-placed-list">
            <summary>
              Миний сонгосон тавилга (
              {kitchen.cabinets.length + (kitchen.extras?.length ?? 0)})
            </summary>
            {kitchen.cabinets.map((c) => (
              <button
                type="button"
                key={c.id}
                aria-pressed={selectedId === c.id}
                onClick={() => {
                  selectCabinet(c.id);
                  setCatalogOpen(false);
                }}
              >
                {cabinetLabel(c)}
                <small>
                  {c.width} × {c.depth} мм
                </small>
              </button>
            ))}
            {(kitchen.extras ?? []).map((e) => (
              <button
                type="button"
                key={e.id}
                onClick={() => {
                  selectCabinet(e.id);
                  setCatalogOpen(false);
                }}
              >
                {e.name}
              </button>
            ))}
          </details>
        </aside>
        {!spaceOpen && !reviewOpen && shownDesignTab === "views" && (
          <aside className="kitchen-k-panel kitchen-k-views-panel" aria-label="Сонгосон модулийн дэлгэрэнгүй" data-sheet-expanded={sheetExpanded}>
            <PlannerSheetGrip expanded={sheetExpanded} onExpand={setSheetExpanded} onClose={() => setSheetExpanded(false)} />
            {designTabs}
            <div className="kitchen-k-panel-scroll">
              {selectionPanel("overview", "detail")}
            </div>
          </aside>
        )}
        <div className="kp-workspace">
          <section
            className="kp-preview"
            aria-label="Модуль шүүгээ байрлуулах"
            data-planner-tour="kitchen-stage"
          >
            {(selected || selectedExtra) && !reviewOpen && !spaceOpen && (
              <div
                className="kitchen-k-toolbar"
                role="toolbar"
                aria-label="Сонгосон модулийн үйлдэл"
                // Toolbar presses never start a scene selection or drag.
                onPointerDown={(event) => event.stopPropagation()}
              >
                {workspaceView !== "2d" && workspaceView !== "elevation" && workspaceView !== "interior" && (
                  <button
                    type="button"
                    className="kitchen-k-move"
                    disabled={busy}
                    aria-pressed={mode === "move"}
                    title={mode === "move" ? "Зөөж дуусгах" : "Камер хөдлөхгүйгээр чирж зөөх"}
                    onClick={() => setMode((value) => (value === "move" ? "orbit" : "move"))}
                  >
                    {mode === "move" ? <Check size={16} aria-hidden="true" /> : <Move size={16} aria-hidden="true" />}
                    {mode === "move" ? "Болсон" : "Зөөх"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  aria-disabled={!!selected || undefined}
                  title={selected ? "Ханад бэхлэгдсэн модуль эргэхгүй" : "90° эргүүлэх"}
                  onClick={() => {
                    if (selected) {
                      setMessage("Ханад бэхлэгдсэн модуль эргэхгүй. Чөлөөт тавилга (ширээ) л эргэнэ.");
                      return;
                    }
                    if (selectedExtra)
                      changeExtra({
                        ...selectedExtra,
                        position: { ...selectedExtra.position, rotation: selectedExtra.position.rotation + Math.PI / 2 },
                      });
                  }}
                >
                  <RotateCw size={16} aria-hidden="true" /> Эргүүлэх
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => (selected ? duplicateCabinet() : duplicateExtra())}
                >
                  <Copy size={16} aria-hidden="true" /> Хуулах
                </button>
                {selected && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      setCatalogOpen(false);
                      setInspector("selection");
                      setSettingsOpen(true);
                    }}
                  >
                    <Repeat size={16} aria-hidden="true" /> Солих
                  </button>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (
                      commit({
                        ...design,
                        cabinets: design.cabinets.filter((c) => c.id !== selectedId),
                        extras: design.extras?.filter((e) => e.id !== selectedId),
                      })
                    ) {
                      setSelectedId(null);
                      setSettingsOpen(false);
                      setSuccessMessage("Өрөөнөөс хасагдлаа, BOM-оос мөн хасагдлаа. Header-ийн «Буцаах»-аар сэргээнэ.");
                    }
                  }}
                >
                  <Trash2 size={16} aria-hidden="true" /> Устгах
                </button>
              </div>
            )}
            <div className="kitchen-view-tabs" data-planner-tour="kitchen-view">
              <KitchenViewDock current={workspaceView} onView={showWorkspaceView} />
              {workspaceView !== "2d" && workspaceView !== "elevation" && (
                <button
                  type="button"
                  className="kitchen-night-toggle"
                  aria-pressed={night}
                  title={night ? "Өдрийн гэрэлтэй болгох" : "Шөнийн горим: таазны гэрлээр харах"}
                  onClick={() => setNight((value) => !value)}
                >
                  {night ? <Sun size={16} aria-hidden="true" /> : <Moon size={16} aria-hidden="true" />}
                  <span>{night ? "Өдөр" : "Шөнө"}</span>
                </button>
              )}
              {workspaceView !== "2d" && workspaceView !== "elevation" && (
                <button
                  type="button"
                  className="kitchen-services-toggle"
                  aria-pressed={services}
                  title={services ? "Холболтын цэгүүдийг нуух" : "Шүүгээний цаана орсон ус, цахилгаан, сорогчийн хоолойг харах"}
                  onClick={() => setServices((value) => !value)}
                >
                  <Plug size={16} aria-hidden="true" />
                  <span>Холболт</span>
                </button>
              )}
              {workspaceView === "2d" && (
                <button
                  type="button"
                  className="kitchen-dimensions-toggle"
                  aria-pressed={annotations}
                  title={annotations ? "Хэмжээсийн шугамыг нуух" : "Хэмжээсийн шугам харуулах"}
                  onClick={() => setAnnotations((value) => !value)}
                >
                  <Ruler size={16} aria-hidden="true" />
                  <span>Хэмжээс</span>
                </button>
              )}
              {workspaceView !== "2d" && (
                <ViewportControls
                  disabled={busy || !ready}
                  onAction={(action) => {
                    setMode("orbit");
                    setCameraRequest((previous) => ({
                      id: (previous?.id ?? 0) + 1,
                      action,
                    }));
                  }}
                />
              )}
              {services && workspaceView !== "2d" && workspaceView !== "elevation" && !reviewOpen && (
                <KitchenServicesLegend kitchen={sceneKitchen} />
              )}
            </div>
            <div className="kp-preview-bar">
              <div
                className="km-view-tools"
                hidden={workspaceView === "2d" || workspaceView === "interior"}
                role="group"
                aria-label="Харагдацын хэрэгслүүд"
              >
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={mode === "move"}
                  aria-label="Тавилга зөөх"
                  title="Тавилга зөөх"
                  onClick={() => setMode("move")}
                >
                  <Move size={17} />
                  <span>{"Тавилга зөөх"}</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={mode === "orbit"}
                  aria-label="Харах өнцөг"
                  onClick={() => setMode("orbit")}
                >
                  <Orbit size={17} />
                  <span>Эргүүлж харах</span>
                </button>
                <button
                  type="button"
                  aria-label="2D план"
                  onClick={() => setWorkspaceView("2d")}
                >
                  <Grid2X2 size={17} />
                  <span>Дээрээс харах</span>
                </button>
              </div>
            </div>
            <div
              className={`kp-canvas ${workspaceView === "2d" || workspaceView === "elevation" ? "is-hidden" : ""}`}
            >
              {active && ready && ((workspaceView !== "2d" && workspaceView !== "elevation") || reviewOpen) && (
                <Scene
                  key={`${viewKey}:${design.room.width}:${design.room.depth}:${design.room.height}`}
                  exportRoot={setExportRoot}
                  capture={registerKitchenCapture}
                  kitchen={sceneKitchen}
                  open={open}
                  selectedId={selectedId}
                  mode={saving ? "orbit" : mode}
                  interior={workspaceView === "interior" && !reviewOpen}
                  night={night}
                  services={services}
                  cameraRequest={cameraRequest}
                  cameraPose={navigationMapOpen ? cameraPose : undefined}
                  onSelect={selectCabinet}
                  onDeselect={() => {
                    setSelectedId(null);
                    setInspector((previous) =>
                      previous === "selection" ? "materials" : previous,
                    );
                    setSettingsOpen(false);
                  }}
                  onSelectCountertop={editCountertop}
                  onStart={start}
                  onMove={move}
                  onEnd={() => finish()}
                  onCancel={() => finish(true)}
                  variantModels={variantModels}
                  materialDefinitions={materialDefinitions}
                />
              )}
            </div>
            {workspaceView === "elevation" && (
              <KitchenWallElevation kitchen={kitchen} selectedId={selectedId} onSelect={selectCabinet} />
            )}
            {workspaceView === "2d" && (
              <KitchenPlanWorkspace
                measurements={annotations}
                onMeasurementsChange={setAnnotations}
                kitchen={kitchen}
                onRoomChange={(room) => {
                  if (!busy) commit({ ...design, room });
                }}
                selectedId={selectedId}
                disabled={busy}
                onSelect={selectCabinet}
                onStart={(id) => {
                  start(id);
                  setSettingsOpen(settingsOpen);
                }}
                onMove={move}
                onEnd={() => {
                  finish();
                  setSettingsOpen(true);
                }}
                onCancel={() => finish(true)}
                onRotate={() => {
                  if (selected)
                    updateCabinet({
                      position: {
                        ...selected.position,
                        rotation: selected.position.rotation + Math.PI / 2,
                      },
                    });
                  else if (selectedExtra)
                    changeExtra({
                      ...selectedExtra,
                      position: {
                        ...selectedExtra.position,
                        rotation: selectedExtra.position.rotation + Math.PI / 2,
                      },
                    });
                }}
                onDuplicate={() => {
                  if (selected) duplicateCabinet();
                  else if (selectedExtra) duplicateExtra();
                }}
                onDelete={() => {
                  if (
                    commit({
                      ...design,
                      cabinets: design.cabinets.filter(
                        (c) => c.id !== selectedId,
                      ),
                      extras: design.extras?.filter((e) => e.id !== selectedId),
                    })
                  )
                    setSelectedId(null);
                }}
              />
            )}
            {workspaceView !== "2d" && (
              <details
                className="kitchen-navigation-map"
                open={navigationMapOpen}
                onToggle={(event) =>
                  setNavigationMapOpen(event.currentTarget.open)
                }
              >
                <summary>Өрөөний зураг</summary>
                <KitchenMiniMap
                  kitchen={kitchen}
                  selectedId={selectedId}
                  missingIds={missingModelIds}
                  pose={cameraPose}
                  onSelect={selectCabinet}
                  onView={(side) => {
                    if (workspaceView !== "3d") setWorkspaceView("3d");
                    setMode("orbit");
                    setCameraRequest((previous) => ({ id: (previous?.id ?? 0) + 1, action: side }));
                  }}
                />
                <button type="button" onClick={() => setWorkspaceView("2d")}>
                  2D план нээх
                </button>
              </details>
            )}
            {!catalogLoading && !catalogError && sceneKitchen.cabinets.some(c => !kitchenVariantFits(variantModels[c.variantId ?? ""], c) && !["refrigerator", "hood", "oven"].includes(c.opening ?? "")) && workspaceView !== "2d" && !reviewOpen && (
              <div className="kitchen-missing-models" role="status">
                <Sparkles size={18} aria-hidden="true" />
                <p>
                  <strong>{missingModelCabinets.length} шүүгээ 3D загваргүй байна</strong>
                  <span>Одоо хайрцгаар харагдаж байна. Байрлал нь 2D планд хадгалагдсан.</span>
                </p>
                <button type="button" className="is-primary" disabled={busy} onClick={applyCatalogModels}>Автоматаар сонгох</button>
                <button type="button" onClick={() => { const missing = missingModelCabinets[0]; if (missing) selectCabinet(missing.id); }}>Нэг нэгээр сонгох</button>
              </div>
            )}
            <p className="kp-preview-hint" hidden={workspaceView === "2d"}>
              {workspaceView === "interior"
                ? "Чирж эргэн харах · Сум дээр дарж шилжих, чирж цэг сонгох"
                : mode === "move"
                  ? "Шүүгээг чирж зөөнө · Хоосон зайд зүүн/дунд товч: камер эргүүлэх · Shift + чирэх: шилжүүлэх"
                  : "Зүүн/дунд товч: камер эргүүлэх · Shift + чирэх: шилжүүлэх · Дугуй: ойртуулах"}
            </p>
            <div className="kitchen-project-caption">
              <strong>
                Гал тогоо · {design.room.width / 1000} ×{" "}
                {design.room.depth / 1000} м
              </strong>
              <span>
                {kitchen.cabinets.length} шүүгээ · Тааз{" "}
                {design.room.height / 1000} м
              </span>
            </div>
            <p
              className={`km-feedback ${issues.some((issue) => issue.severity === "error") ? "has-error" : ""}`}
              role="status"
              aria-live="polite"
            >
              {issues[0]?.message ||
                snapMessage ||
                "Хананд болон залгаа шүүгээнд автоматаар таарна."}
            </p>
            {issues.length > 0 && <ul className="kitchen-placement-actions" aria-label="Байрлалын асуудал засах">
              {issues.slice(0, 6).map((issue, index) => {
                const action = placementIssueAction(issue);
                return <li key={`${issue.code}-${index}`}><span>{issue.message}</span>
                  <button type="button" disabled={busy} onClick={() => {
                    if (action.target === "room") { setSpaceOpen(true); return; }
                    selectCabinet(issue.ids[0]);
                  }}>{action.label}</button></li>;
              })}
            </ul>}
          </section>
          <section className="kp-panel kp-reference-panel">
            <div className="kp-section-heading">
              <h2>Байрлал</h2>
              <span>Тасархай хүрээ: дээд шүүгээ</span>
            </div>
            <Plan
              kitchen={kitchen}
              selectedId={selectedId}
              onSelect={selectCabinet}
            />
            <div
              className="kp-module-list"
              role="group"
              aria-label="Шүүгээ сонгох"
            >
              {kitchen.cabinets.map((cabinet, i) => (
                <button
                  key={cabinet.id}
                  type="button"
                  disabled={dragging}
                  aria-pressed={selectedId === cabinet.id}
                  onClick={() => selectCabinet(cabinet.id)}
                >
                  <span className="kp-module-number">{i + 1}</span>
                  <strong>{cabinetLabel(cabinet)}</strong>
                  <span>
                    {cabinet.width} × {cabinet.height} × {cabinet.depth} мм
                  </span>
                </button>
              ))}
            </div>
            {!kitchen.cabinets.length && (
              <p className="km-empty">
                Шүүгээ icon дээр дарж эхний тавилгаа нэмээрэй.
              </p>
            )}
          </section>
          <section className="kp-panel kp-reference-panel">
            <h2>Тавцангийн хэмжээ</h2>
            {tops.length ? (
              <ul className="km-top-list">
                {tops.map((top, index) => (
                  <li key={top.id}>
                    Тавцан {index + 1}:{" "}
                    <strong>
                      {top.width} × {top.depth} × {top.thickness} мм
                    </strong>{" "}
                    · {top.cabinetIds.length} доод шүүгээ
                  </li>
                ))}
              </ul>
            ) : (
              <p className="kp-help">
                Доод шүүгээ нэмэхэд тавцан автоматаар үүснэ.
              </p>
            )}
          </section>
        </div>
        {settingsOpen && (
          <button
            type="button"
            className="planner-inspector-backdrop"
            aria-label="Самбар хаах"
            onClick={() => setSettingsOpen(false)}
          />
        )}
        <aside
          ref={settingsRef}
          data-sheet-expanded={sheetExpanded}
          className={`kp-settings kitchen-left-inspector ${settingsOpen ? "is-open" : ""}`}
          aria-label="Тавилгын тохиргоо"
        >
          <PlannerSheetGrip
            expanded={sheetExpanded}
            onExpand={setSheetExpanded}
            onClose={() => setSettingsOpen(false)}
          />
          {materialsTab && designTabs}
          {materialsTab && (
            <div className="kitchen-k-material-head">
              {selected && (
                <KitchenMaterialScopeToggle
                  scope={materialScope}
                  onScope={setMaterialScope}
                  count={appearanceTargets.length}
                />
              )}
              <KitchenMaterialStatus onRevert={revertAppearance} />
              <p className="kitchen-k-muted">
                3D загварын нүүр, их биеийг л буддаг; material map-гүй хувилбарт өнгө 3D-д харагдахгүй байж болно.
              </p>
            </div>
          )}
          {settingsOpen && plannerNotice(true)}
          {inspector === "lighting" || inspector === "island" ? <KitchenFeaturesPanel key={inspector} kitchen={design} section={inspector} disabled={busy}
            onClose={() => setSettingsOpen(false)} onAdd={addPlanningFurniture}
            onLighting={lineLighting => { if (!busy) commit({ ...designRef.current, lineLighting }); }} /> : inspector === "corner" ? <KitchenCornerPanel kitchen={design} disabled={busy} onClose={() => setSettingsOpen(false)}
            onApply={next => { if (commit(next)) { setSelectedId(null); setOpen(false); setWorkspaceView("3d"); setMode("orbit"); setSuccessMessage("L булан, зайны хавтан болон тавцан байрлалаа."); } }} /> : inspector === "countertop" ? (
            <KitchenCountertopAppearance kitchen={kitchen} selectedId={selectedId} materials={selectableMaterials}
              disabled={busy} onChange={changeCountertopMaterial}
              onSelect={setSelectedId}
              onUpdate={(id, patch) => { if (!busy) { try { commit(updateKitchenCountertop(designRef.current, id, patch)); } catch (error) { setMessage((error as Error).message); } } }}
              onLayout={manual => { if (!busy) commit(manual ? detachKitchenCountertops(designRef.current) : { ...designRef.current, countertopLayout: undefined }); }}
              onMove={() => { if (!busy) { if (!commit(detachKitchenCountertops(designRef.current))) return; setWorkspaceView("3d"); setMode("move"); setSuccessMessage("Тавцан дээр дарж чирнэ. Боксууд байрандаа үлдэнэ."); } }}
              onWall={(enabled, materialId) => busy ? "Өөрчлөлт дуусахыг хүлээнэ үү." : commit({ ...designRef.current, backsplash: enabled, backsplashMaterialId: materialId ?? designRef.current.backsplashMaterialId }) ? undefined : "Ханын өнгөлгөөг сольж чадсангүй."}
              onBack={() => setInspector(selected ? "materials" : "catalog")}
              onClose={() => setSettingsOpen(false)} />
          ) : selected &&
          (inspector === "selection" || inspector === "materials") ? (
            selectionPanel(inspector === "materials" ? "modify" : "overview")
          ) : (
            <>
              <div className="kp-settings-head">
                <strong>{KITCHEN_INSPECTOR_LABELS[inspector]}</strong>
                <button
                  type="button"
                  aria-label="Самбар хаах"
                  onClick={() => setSettingsOpen(false)}
                >
                  <X size={19} />
                </button>
              </div>
              {inspector === "extras" ? (
                <ExtrasPanel
                  key={extrasTab}
                  initialTab={extrasTab}
                  products={kitchenAssets}
                  selected={selectedExtra}
                  onFocus={() => {
                    if (!selectedExtra) return;
                    setWorkspaceView("3d"); setMode("orbit");
                    setCameraRequest(previous => ({ id: (previous?.id ?? 0) + 1, action: "focus", targetId: selectedExtra.id }));
                  }}
                  room={design.room}
                  disabled={busy}
                  error={
                    catalogError ? "Гал тогооны сан ачаалагдсангүй." : null
                  }
                  loading={catalogLoading}
                  onAdd={addExtra}
                  onChange={changeExtra}
                  onDuplicate={duplicateExtra}
                  onDelete={() => {
                    if (
                      commit({
                        ...design,
                        extras: design.extras?.filter(
                          (e) => e.id !== selectedId,
                        ),
                      })
                    )
                      setSelectedId(null);
                  }}
                />
              ) : inspector === "room" ? (
                <section className="kp-panel">
                  <p>Өрөөний хэмжээ, хаалга, цонхоо тохируулна.</p>
                  <button
                    type="button"
                    className="kp-primary"
                    onClick={() => {
                      setSettingsOpen(false);
                      setSpaceOpen(true);
                    }}
                  >
                    Өрөө тохируулах
                  </button>
                </section>
              ) : inspector === "materials" ? (
                <section className="kitchen-style-selection">
                  <p>Загвар, өнгийг өөрчлөх шүүгээгээ сонгоно уу.</p>
                  {kitchen.cabinets.map((cabinet) => (
                    <button
                      type="button"
                      key={cabinet.id}
                      disabled={busy}
                      onClick={() => {
                        setSelectedId(cabinet.id);
                        setOpen(false);
                      }}
                    >
                      <span>
                        {variantModels[cabinet.variantId ?? ""]?.modelName ||
                          cabinetLabel(cabinet)}
                      </span>
                      <small>
                        {cabinet.width} × {cabinet.height} × {cabinet.depth} мм
                      </small>
                      <ChevronRight size={16} />
                    </button>
                  ))}
                  {!kitchen.cabinets.length && (
                    <button
                      type="button"
                      className="kp-primary"
                      onClick={() => {
                        setSettingsOpen(false);
                        setCatalogOpen(true);
                      }}
                    >
                      Шүүгээ нэмэх
                    </button>
                  )}
                </section>
              ) : (
                <KitchenModelLibrary
                  modules={moduleCatalog}
                  loading={catalogLoading}
                  error={catalogError}
                  retry={retryCatalog}
                  disabled={busy || kitchen.cabinets.length >= 80}
                  onAdd={addCatalogCabinet}
                />
              )}
            </>
          )}
        </aside>
      </div>
      {reviewOpen && (
        <>
          <aside className="kitchen-k-panel" aria-label="Засварын самбар" data-sheet-expanded={sheetExpanded}>
            <PlannerSheetGrip expanded={sheetExpanded} onExpand={setSheetExpanded} onClose={() => setSheetExpanded(false)} />
            <div className="kitchen-k-panel-scroll">
              {measurementOpen ? (
                <KitchenMeasurePanel
                  conflict={library.conflict}
                  quoteRequest={user && savedId && marketplaceSource ? (
              <KitchenQuoteRequest
                key={savedId}
                designId={marketplaceSource}
                projectId={savedId}
                returnPath={`/kitchen?design=${savedId}`}
                disabled={busy}
                defaultRoom={{
                  widthMm: kitchen.room.width,
                  depthMm: kitchen.room.depth,
                  heightMm: kitchen.room.height,
                }}
                beforeSubmit={async () => {
                  if (!(await save()))
                    throw new Error(
                      useKitchens.getState().error ||
                        "Үнийн хүсэлт илгээхийн өмнө загвараа хадгална уу.",
                    );
                }}
              />
            ) : null}
                />
              ) : (
                <KitchenEstimatePanel
                  bom={bom}
                  measureDisabled={busy || !(kitchen.cabinets.length + (kitchen.extras?.length ?? 0))}
                  onMeasure={() => changeStage("measurement")}
                  onDesign={() => changeStage("design")}
                />
              )}
            </div>
          </aside>
          <section
            className="kitchen-k-contents"
            aria-label={measurementOpen ? "Хэмжилтийн хүсэлт" : "Урьдчилсан үнэ"}
          >
            {measurementOpen ? (
              <KitchenHandoffSheet
                kitchen={kitchen}
                bom={bom}
                revision={revision}
                saved={!!savedId && revision > 0}
                image={reviewImage}
                finishLabel={finishLabel}
                conflict={library.conflict}
                onKeepMine={() => void resolveConflict(true)}
                onOpenTheirs={() => void resolveConflict(false)}
                exports={
                  <>
                    <KitchenExportButtons
                      root={exportRoot}
                      name={name}
                      disabled={busy || !kitchen.cabinets.length}
                    />
                    <ProjectReport
                      name={name}
                      kitchen={kitchen}
                      modules={moduleCatalog}
                      products={products.products}
                      disabled={busy}
                      capture={async () => (await captureKitchen.current?.()) ?? null}
                    />
                  </>
                }
              />
            ) : (
              <KitchenBomTable bom={bom} />
            )}
          </section>
        </>
      )}
      {plannerNotice()}
    </main>
  );
}
