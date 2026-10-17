"use client";
import { BrandLoader } from "@/components/BrandLoader";
import { PlannerTour } from "@/features/planner/components/PlannerTour";
import { KitchenDesignSuggestions } from "@/features/kitchen-planner/components/KitchenDesignSuggestions";

import { ExtrasPanel } from "@/features/kitchen-planner/components/ExtrasPanel";
import "@/features/kitchen-planner/components/kitchen-editor.css";
import "@/features/kitchen-planner/components/kitchen-flow.css";
import "@/features/kitchen-planner/components/kitchen-stitch.css";
import { KitchenPlannerHeader, type KitchenToolbarTool } from "@/features/kitchen-planner/components/KitchenPlannerHeader";
import { KitchenModelLibrary } from "@/features/kitchen-planner/components/KitchenModelLibrary";
import { KitchenPlanWorkspace } from "@/features/kitchen-planner/components/KitchenPlanWorkspace";
import { KitchenSelectionPanel } from "@/features/kitchen-planner/components/KitchenSelectionPanel";
import { KitchenSpaceEditor } from "@/features/kitchen-planner/components/KitchenSpaceEditor";
import { KitchenStartDialog } from "@/features/kitchen-planner/components/KitchenStartDialog";
import { Plan } from "@/features/kitchen-planner/components/PlannerPanels";
import { ProjectReport } from "@/features/kitchen-planner/components/ProjectReport";
import { useKitchenDialog } from "@/features/kitchen-planner/components/useKitchenDialog";
import { VersionHistory } from "@/features/kitchen-planner/components/VersionHistory";
import { useKitchenCatalog } from "@/features/kitchen-planner/hooks/useKitchenCatalog";
import "@/features/planner/components/planner-reference.css";
import "@/features/planner/components/planner-sidebar.css";
import "@/features/planner/components/planner-studio.css";
import "@/features/planner/components/planner-tools.css";
import "@/features/planner/components/planner-usability.css";
import { usePlannerPanel } from "@/features/planner/components/usePlannerPanel";
import { ViewportControls } from "@/features/planner/components/ViewportControls";
import { EditorHistory } from "@/lib/editorHistory";
import { FINISHES } from "@/lib/kitchen";
import {
  arrangeKitchen,
  cloneKitchen,
  createUnifiedKitchen,
  kitchenEnvelope,
  parseKitchen
} from "@/lib/kitchenAssembly";
import {
  fitBacksplashes,
  parseBacksplashSettings
} from "@/lib/kitchenBacksplash";
import { buildKitchenBom } from "@/lib/kitchenBom";
import {
  cabinetLabel,
  createCabinet,
  roomWalls,
  validateCabinet,
  type CabinetPose,
  type ModularCabinet,
  type ModularKitchen
} from "@/lib/kitchenCabinets";
import { cabinetFromCatalog } from "@/lib/kitchenCatalogInsertion";
import {
  componentTypes,
  parseComponents,
  withOpening
} from "@/lib/kitchenComponents";
import {
  extraFromProduct,
  findExtraSpace,
  parseKitchenExtras,
  type KitchenExtra,
} from "@/lib/kitchenExtras";
import { type KitchenMaterialDefinition } from "@/lib/kitchenMaterials";
import {
  applyKitchenCatalogVariants,
  type KitchenCatalogModule,
  type KitchenCatalogVariant,
} from "@/lib/kitchenModuleCatalog";
import {
  cabinetAxes,
  findCabinetSpace,
  fitCountertops,
  placementIssues,
  proposeCabinetMove,
  resolveElevations,
  snapCabinet
} from "@/lib/kitchenPlacement";
import { parseKitchenSpace } from "@/lib/kitchenSpace";
import type { CameraRequest } from "@/lib/plannerCamera";
import type { Product } from "@/lib/types";
import { useAuth } from "@/store/auth";
import { useCatalog } from "@/store/catalog";
import { useKitchens } from "@/store/kitchens";
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Grid2X2,
  HelpCircle,
  Layers3,
  LayoutPanelTop,
  Move,
  Orbit,
  Save,
  X
} from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback,useEffect,useMemo,useRef,useState } from "react";
import type { Group } from "three";
import { KitchenExportButtons } from "./KitchenExportButtons";
import { KitchenQuoteRequest } from "./KitchenQuoteRequest";

import "@/features/kitchen-planner/components/kitchen-glb-workspace.css";
import "@/features/kitchen-planner/components/kitchen-ikea-layout.css";

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
      <p className="kp-viewer-message" role="status">
        <BrandLoader />
        3D загварыг бэлдэж байна…
      </p>
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
  const [design, setDesign] = useState<ModularKitchen>(() => ({ ...createUnifiedKitchen(), cabinets: [] }));
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
  const marketplaceSource = library.items.find(
    (item) => item.id === savedId,
  )?.sourceMarketplaceDesignId;
  const [versionBusy, setVersionBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [spaceOpen, setSpaceOpen] = useState(
    () => new URLSearchParams(queryString).get("space") === "1",
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogCategory, setCatalogCategory] = useState<"all" | "appliances">("all");
  const [extrasTab, setExtrasTab] = useState<"dining" | "extra">("dining");
  const [annotations, setAnnotations] = useState(true);
  const [searchRequest, setSearchRequest] = useState(0);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [startOpen, setStartOpen] = useState(false);
  const [tourRequest, setTourRequest] = useState(0);
  const [workspaceView, setWorkspaceView] = useState<"2d" | "3d" | "interior">(
    "3d",
  );
  const catalogRef = usePlannerPanel(
    catalogOpen && !spaceOpen && !startOpen && !reviewOpen && !settingsOpen,
    () => setCatalogOpen(false),
    759,
  );
  const settingsRef = usePlannerPanel(
    settingsOpen && !spaceOpen && !startOpen && !reviewOpen,
    () => setSettingsOpen(false),
    759,
  );
  const [inspectorTab, setInspector] = useState<
    keyof typeof KITCHEN_INSPECTOR_LABELS
  >(() =>
    new URLSearchParams(queryString).get("new") === "1" ? "room" : "catalog",
  );
  const reviewRef = useKitchenDialog(reviewOpen, () => setReviewOpen(false));
  const [reviewImage, setReviewImage] = useState<string | null>(null);
  const {
    moduleCatalog,
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
        const raw =
          guestRaw ??
          localStorage.getItem(draftKey) ??
          localStorage.getItem(legacyDraftKey);
        if (raw && query.get("new") !== "1") {
          const draft = JSON.parse(raw),
            next = parseKitchen(draft.design, { allowEmpty: true });
          setDesign(next);
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
  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(
        draftKey,
        JSON.stringify({ id: savedId, name, design, revision }),
      );
    } catch {
      /* Saving to the account remains available. */
    }
  }, [ready, draftKey, savedId, name, design, revision]);
  const designRef = useRef(design);
  designRef.current = design;
  useEffect(() => {
    if (!ready || !moduleCatalog.some((module) => module.variants.length))
      return;
    setDesign((current) => {
      const next = applyKitchenCatalogVariants(current, moduleCatalog);
      if (next !== current) designRef.current = next;
      return next;
    });
  }, [moduleCatalog, ready]);
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
          module.variants.map((variant) => [variant.furnitureModelId, { ...variant, nominalSizeMm: { width: module.widthMm, height: module.heightMm, depth: module.depthMm } }]),
        ),
      ),
    [moduleCatalog],
  );
  const selectableMaterials = materialCatalog.length
    ? materialCatalog
    : FALLBACK_MATERIALS;
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
  const bounds = kitchenEnvelope(kitchen),
    busy = dragging || saving || versionBusy || !ready;
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
      const keepSelection = selectedId && (next.cabinets.some(cabinet => cabinet.id === selectedId) ||
        next.extras?.some(extra => extra.id === selectedId));
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
    if (busy) return;
    if (!product.model) {
      setMessage("Энэ барааны 3D загвар хараахан бэлэн болоогүй.");
      return;
    }
    const extra = findExtraSpace(
      design,
      extraFromProduct(product, crypto.randomUUID()),
    );
    if (!extra) {
      setMessage("Энэ тавилга байрлуулах сул зай алга.");
      return;
    }
    if (commit({ ...design, extras: [...(design.extras ?? []), extra] }))
      selectCabinet(extra.id);
  }
  function changeExtra(extra: KitchenExtra) {
    commit({
      ...design,
      extras: design.extras?.map((e) => (e.id === extra.id ? extra : e)),
    });
  }
  function duplicateExtra() {
    if (!selectedExtra || busy) return;
    if (!selectedExtra.model) {
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
  async function save(place = false) {
    if (busy || !user) return;
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
        const thumbnail = image
          ? await library.saveThumbnail(saved.id, image, saved.revision)
          : null;
        setSuccessMessage(
          thumbnail
            ? "Гарнитур болон 3D нүүр зураг хадгалагдлаа."
            : "Гарнитур хадгалагдлаа. 3D нүүр зургийг энэ удаа хадгалж чадсангүй.",
        );
        if (place) router.push(`/planner?kitchen=${saved.id}`);
        return saved;
      } else
        setMessage(
          useKitchens.getState().error ||
            "Хадгалж чадсангүй. Дахин оролдоно уу.",
        );
    } finally {
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
      parseBacksplashSettings(next.backsplashSettings, next.room);
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
  function selectCabinet(id: string) {
    if (fitBacksplashes(kitchen).some((panel) => panel.id === id)) {
      setMessage(
        "Ханын хавтанг чирж зөөнө. Өндөр, хэмжээ, нарийн байрлалыг Тавцан хэсгээс тохируулна.",
      );
      return;
    }
    setSelectedId(id);
    setOpen(false);
    setCatalogOpen(false);
    setInspector(
      design.extras?.some((extra) => extra.id === id) ? "extras" : "selection",
    );
    setSettingsOpen(true);
  }
  function start(id: string) {
    if (busy) return;
    setOpen(false);

    setSettingsOpen(false);
    if (
      design.cabinets.some((c) => c.id === id) ||
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
    const base = dragBase.current,
      extra = base.extras?.find((e) => e.id === id);
    if (extra) {
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
      );
      const next = {
        ...base,
        extras: base.extras?.map((e) =>
          e.id === id ? { ...e, position: result.position } : e,
        ),
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
    const result = proposeCabinetMove(dragBase.current, id, pose);
    draftRef.current = result.kitchen;
    setPreview(result.kitchen);
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
      delete updated.variantId;
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
  function changeStage(stage: "space" | "design" | "suggestions" | "finish") {
    setSuggestionsOpen(stage === "suggestions");
    setSpaceOpen(stage === "space");
    setReviewOpen(stage === "finish");
    if (stage === "design") {
      setInspector(selected ? "selection" : "catalog");
      setSettingsOpen(Boolean(selected));
      setCatalogOpen(!selected);
      setWorkspaceView("3d");
    }
  }

  function openToolbarTool(tool: KitchenToolbarTool) {
    setSuggestionsOpen(false);
    if (tool === "photo") { changeStage("finish"); return; }
    setSpaceOpen(false);
    setReviewOpen(false);
    if (tool === "annotation") {
      setWorkspaceView("2d");
      setAnnotations(value => !value);
      return;
    }
    setSelectedId(null);
    if (tool === "dining" || tool === "items") {
      setExtrasTab(tool === "dining" ? "dining" : "extra");
      setInspector("extras");
      setCatalogOpen(false);
      setSettingsOpen(true);
    } else {
      setCatalogCategory(tool === "appliances" ? "appliances" : "all");
      setInspector("catalog");
      setSettingsOpen(false);
      setCatalogOpen(true);
      if (tool === "search") setSearchRequest(value => value + 1);
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
    if (!cabinet) return;
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
    replaceCabinet(nextCabinet);
  }
  return (
    <main
      className="kp kp-shell planner-studio planner-reference kitchen-reference kitchen-refined kitchen-flow kitchen-glb-workspace kitchen-ikea-layout"
      data-room-setup={spaceOpen}
      data-workflow-stage={reviewOpen ? "finish" : suggestionsOpen ? "suggestions" : spaceOpen ? "space" : "design"}
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
      <PlannerTour kind="kitchen" enabled={active && ready && !startOpen && !spaceOpen && !reviewOpen} request={tourRequest} />
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
        stage={reviewOpen ? "finish" : suggestionsOpen ? "suggestions" : spaceOpen ? "space" : "design"}
        onStage={changeStage}
        activeTool={catalogOpen ? catalogCategory === "appliances" ? "appliances" : "cabinets" : inspector === "extras" && settingsOpen ? extrasTab === "dining" ? "dining" : "items" : undefined}
        onTool={openToolbarTool}
        busy={busy}
        canUndo={Boolean(history.current.undoCount)} canRedo={Boolean(history.current.redoCount)}
        onUndo={() => historyAction("undo")} onRedo={() => historyAction("redo")}
        onSave={user ? () => void save() : undefined}
        loginHref={`/login?next=${encodeURIComponent(new URLSearchParams(queryString).has("design") ? `/kitchen?${queryString}` : `/kitchen?importGuest=1${draftToken ? `&draft=${encodeURIComponent(draftToken)}` : ""}`)}`}
        name={name} onName={setName} subtotal={bom.knownSubtotal} annotations={annotations}
        utilities={<>
          <button type="button" aria-label="Ашиглах заавар" title="Ашиглах заавар" aria-haspopup="dialog" onClick={() => { setSpaceOpen(false); setReviewOpen(false); setStartOpen(false); setCatalogOpen(false); setSettingsOpen(false); setTourRequest(value => value + 1); }}><HelpCircle size={18} /></button>
          <details className="km-layout-menu kp-top-menu" data-planner-tour="kitchen-layout">
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
          <details className="kp-top-menu kp-more-menu">
            <summary aria-label="Нэмэлт үйлдэл">•••</summary>
            <div className="kp-more-content">
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
        </>}
      />
      {suggestionsOpen && <KitchenDesignSuggestions kitchen={design} disabled={busy} onApply={commit} onBack={() => changeStage("design")} onFinish={() => changeStage("finish")} />}
      {spaceOpen && (
        <KitchenSpaceEditor
          kitchen={design}
          disabled={busy}
          onChange={commit}
          onCatalog={(type) => openToolbarTool(type === "appliances" ? "appliances" : "cabinets")}
          onClose={() => {
            setSpaceOpen(false);
            setInspector("catalog");
            setWorkspaceView("2d");
            setSettingsOpen(false);
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
        data-settings-open={settingsOpen}
        data-left-open={settingsOpen || catalogOpen}
        hidden={spaceOpen || suggestionsOpen}
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
          className={`kitchen-flow-catalog ${catalogOpen ? "is-open" : ""}`}
          aria-label="Шүүгээ, төхөөрөмжийн каталог"
        >
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
          <KitchenModelLibrary key={catalogCategory} modules={moduleCatalog} loading={catalogLoading} error={catalogError} retry={retryCatalog} disabled={busy || kitchen.cabinets.length >= 80} onAdd={addCatalogCabinet} category={catalogCategory} searchRequest={searchRequest}/>
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
        <div className="kp-workspace">
          <section className="kp-preview" aria-label="Модуль шүүгээ байрлуулах" data-planner-tour="kitchen-stage">
            <div className="kp-preview-bar">
              <div
                className="kitchen-view-tabs"
                data-planner-tour="kitchen-view"
                role="group"
                aria-label="Харагдах байдал"
              >
                <button
                  type="button"
                  aria-pressed={workspaceView === "2d"}
                  onClick={() => setWorkspaceView("2d")}
                >
                  <Grid2X2 size={16} /> 2D план
                </button>
                <button
                  type="button"
                  aria-pressed={workspaceView === "3d"}
                  onClick={() => setWorkspaceView("3d")}
                >
                  <Orbit size={16} /> 3D
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWorkspaceView("3d");
                    setCameraRequest((p) => ({
                      id: (p?.id ?? 0) + 1,
                      action: "front",
                    }));
                  }}
                >
                  Урдаас
                </button>
                <button
                  type="button"
                  aria-pressed={workspaceView === "interior"}
                  onClick={() => {
                    setWorkspaceView("interior");
                    setMode("orbit");
                  }}
                >
                  Дотроос
                </button>
              </div>
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
                  onClick={() => setMode("move")}
                >
                  <Move size={17} /><span>{"Тавилга зөөх"}</span>
                </button>
                <button type="button" disabled={busy}
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
            <div
              className={`kp-canvas ${workspaceView === "2d" ? "is-hidden" : ""}`}
            >
              {active && ready && (workspaceView !== "2d" || reviewOpen) && (
                <Scene
                  key={`${viewKey}:${design.room.width}:${design.room.depth}:${design.room.height}`}
                  exportRoot={setExportRoot}
                  capture={registerKitchenCapture}
                  kitchen={sceneKitchen}
                  open={open}
                  selectedId={selectedId}
                  mode={saving ? "orbit" : mode}
                  interior={workspaceView === "interior" && !reviewOpen}
                  cameraRequest={cameraRequest}
                  onSelect={selectCabinet}
                  onDeselect={() => {
                    setSelectedId(null);
                    setInspector((previous) =>
                      previous === "selection" ? "materials" : previous,
                    );
                    setSettingsOpen(false);

                  }}
                  onStart={start}
                  onMove={move}
                  onEnd={() => finish()}
                  onCancel={() => finish(true)}
                  variantModels={variantModels}
                  materialDefinitions={materialDefinitions}
                />
              )}
            </div>
            {workspaceView === "2d" && (
              <KitchenPlanWorkspace
                measurements={annotations} onMeasurementsChange={setAnnotations}
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
              <details className="kitchen-navigation-map" open>
                <summary>Өрөөний зураг</summary>
                <Plan kitchen={kitchen} selectedId={selectedId} onSelect={selectCabinet} readOnly showMeasurements={false} showSpaceItems={false}/>
                <button type="button" onClick={() => setWorkspaceView("2d")}>2D план нээх</button>
              </details>
            )}
            {!catalogLoading && !catalogError && sceneKitchen.cabinets.some(c => !variantModels[c.variantId ?? ""]?.glbFile && !["refrigerator", "hood"].includes(c.opening ?? "")) && workspaceView !== "2d" && (
              <div className="kitchen-missing-models" role="status">
                {sceneKitchen.cabinets.filter(c => !variantModels[c.variantId ?? ""]?.glbFile && !["refrigerator", "hood"].includes(c.opening ?? "")).length} шүүгээнд бэлэн 3D загвар сонгоно уу.
                <button type="button" onClick={() => { const missing = sceneKitchen.cabinets.find(c => !variantModels[c.variantId ?? ""]?.glbFile && !["refrigerator", "hood"].includes(c.opening ?? "")); if (missing) selectCabinet(missing.id); }}>Шүүгээ сонгож загвар солих</button>
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
          <button type="button" className="planner-inspector-backdrop" aria-label="Самбар хаах" onClick={() => setSettingsOpen(false)} />
        )}
        <aside ref={settingsRef} className={`kp-settings kitchen-left-inspector ${settingsOpen ? "is-open" : ""}`} aria-label="Тавилгын тохиргоо">
          {selected && (inspector === "selection" || inspector === "materials") ? (
            <KitchenSelectionPanel
              key={`${selected.id}:${selected.variantId ?? ""}:${inspector}`}
              cabinet={sceneKitchen.cabinets.find(c => c.id === selected.id) ?? selected}
              variant={variantModels[sceneKitchen.cabinets.find(c => c.id === selected.id)?.variantId ?? ""]}
              modules={moduleCatalog}
              disabled={busy}
              initialMode={inspector === "materials" ? "modify" : "overview"}
              isOpen={open}
              onToggleOpen={() => { setOpen(value => !value); setWorkspaceView("3d"); setMode("orbit"); }}
              onZoom={() => { setWorkspaceView("3d"); setMode("orbit"); setCameraRequest(previous => ({ id: (previous?.id ?? 0) + 1, action: "fit", targetId: selected.id })); }}
              onChangeSelections={partSelections => updateCabinet({ partSelections })}
              onReplace={replaceWithCatalogVariant}
              onPositionChange={position => updateCabinet({ position })}
              onDuplicate={duplicateCabinet}
              onRemove={() => { if (commit({ ...design, cabinets: design.cabinets.filter(c => c.id !== selected.id) })) { setSelectedId(null); setSettingsOpen(false); } }}
              onClose={() => { setSettingsOpen(false); setSelectedId(null); setOpen(false); }}
            />
          ) : (
            <>
              <div className="kp-settings-head"><strong>{KITCHEN_INSPECTOR_LABELS[inspector]}</strong><button type="button" aria-label="Самбар хаах" onClick={() => setSettingsOpen(false)}><X size={19} /></button></div>
              {inspector === "extras" ? (
                <ExtrasPanel key={extrasTab} initialTab={extrasTab} products={products.products} selected={selectedExtra} room={design.room} disabled={busy} error={products.error} loading={products.loading} onAdd={addExtra} onChange={changeExtra} onDuplicate={duplicateExtra} onDelete={() => { if (commit({ ...design, extras: design.extras?.filter(e => e.id !== selectedId) })) setSelectedId(null); }} />
              ) : inspector === "room" ? (
                <section className="kp-panel"><p>Өрөөний хэмжээ, хаалга, цонхоо тохируулна.</p><button type="button" className="kp-primary" onClick={() => { setSettingsOpen(false); setSpaceOpen(true); }}>Өрөө тохируулах</button></section>
              ) : inspector === "materials" ? (
                <section className="kitchen-style-selection">
                  <p>Загвар, өнгийг өөрчлөх шүүгээгээ сонгоно уу.</p>
                  {kitchen.cabinets.map(cabinet => <button type="button" key={cabinet.id} disabled={busy} onClick={() => { setSelectedId(cabinet.id); setOpen(false); }}><span>{variantModels[cabinet.variantId ?? ""]?.modelName || cabinetLabel(cabinet)}</span><small>{cabinet.width} × {cabinet.height} × {cabinet.depth} мм</small><ChevronRight size={16}/></button>)}
                  {!kitchen.cabinets.length && <button type="button" className="kp-primary" onClick={() => { setSettingsOpen(false); setCatalogOpen(true); }}>Шүүгээ нэмэх</button>}
                </section>
              ) : (
                <KitchenModelLibrary modules={moduleCatalog} loading={catalogLoading} error={catalogError} retry={retryCatalog} disabled={busy || kitchen.cabinets.length >= 80} onAdd={addCatalogCabinet}/>
              )}
            </>
          )}
        </aside>
      </div>
      {reviewOpen && (
        <section
          ref={reviewRef}
          className="kp-review-layer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kp-review-title"
        >
          <header className="kp-review-head">
            <nav className="kp-review-navigation" aria-label="Дуусгах хэсгээс буцах">
              <button type="button" onClick={() => setReviewOpen(false)}>
                <ArrowLeft size={18} /> 3D рүү буцах
              </button>
              <button type="button" onClick={() => { setReviewOpen(false); setSpaceOpen(true); }}>
                Өрөөгөө тохируулах
              </button>
              <Link href="/kitchen?setup=1">Сонголт руу буцах</Link>
            </nav>
            <div>
              <p>ТӨЛӨВЛӨГӨӨГ ШАЛГАХ</p>
              <h2 id="kp-review-title">{name}</h2>
            </div>
            <button
              type="button"
              aria-label="Шалгах хэсгийг хаах"
              onClick={() => setReviewOpen(false)}
            >
              <X size={21} />
            </button>
          </header>
          <div className="kp-review-body">
            <div className="kitchen-review-main">
              <section
                className="kp-review-plan"
                aria-label="Гал тогооны 2D төлөвлөгөө"
              >
                {reviewImage && (
                  <Image
                    unoptimized
                    width={1200}
                    height={750}
                    className="kitchen-review-image"
                    src={reviewImage}
                    alt="Таны гал тогооны 3D харагдац"
                  />
                )}
                <div className="kp-review-plan-title">
                  <span>
                    <Layers3 size={18} /> Дээрээс харах төлөвлөгөө
                  </span>
                  <strong>
                    {design.room.width} × {design.room.depth} мм
                  </strong>
                </div>
                <Plan
                  kitchen={kitchen}
                  selectedId={selectedId}
                  onSelect={(id) => {
                    selectCabinet(id);
                    setReviewOpen(false);
                  }}
                />
                <p>
                  Шүүгээ дээр дарвал 3D хэсэгт тухайн шүүгээний тохиргоо
                  нээгдэнэ.
                </p>
              </section>
              <ProjectReport
                name={name}
                kitchen={kitchen}
                modules={moduleCatalog}
                products={products.products}
                disabled={busy}
                capture={async () => (await captureKitchen.current?.()) ?? null}
              />
            </div>
            <aside
              className="kp-review-summary"
              aria-label="Төлөвлөгөөний тойм"
            >
              <div className="kitchen-financial-summary">
                <small>САНХҮҮГИЙН НЭГТГЭЛ</small>
                <p>Үнэтэй бүтээгдэхүүний дэд дүн</p>
                <strong>₮{bom.knownSubtotal.toLocaleString("mn-MN")}</strong>
                <p>
                  {bom.unpricedCount
                    ? `${bom.unpricedCount} мөрийн үнийг тодруулна. Эцсийн нийт үнэ биш.`
                    : "Урьдчилсан тооцоо. Үйлдвэрлэгчээр баталгаажуулна."}
                </p>
              </div>
              <div className="kp-review-summary-heading">
                <ClipboardCheck size={22} />
                <div>
                  <p>Таны төлөвлөгөө</p>
                  <strong>
                    {issues.some((issue) => issue.severity === "error")
                      ? "Засах зүйл байна"
                      : "Байрлал зөв байна"}
                  </strong>
                </div>
              </div>
              <dl className="kp-review-stats">
                <div>
                  <dt>Доод шүүгээ</dt>
                  <dd>
                    {
                      kitchen.cabinets.filter(
                        (cabinet) => cabinet.type === "base",
                      ).length
                    }
                  </dd>
                </div>
                <div>
                  <dt>Дээд шүүгээ</dt>
                  <dd>
                    {
                      kitchen.cabinets.filter(
                        (cabinet) => cabinet.type === "wall",
                      ).length
                    }
                  </dd>
                </div>
                <div>
                  <dt>Өндөр шүүгээ</dt>
                  <dd>
                    {
                      kitchen.cabinets.filter(
                        (cabinet) => cabinet.type === "tall",
                      ).length
                    }
                  </dd>
                </div>
                <div>
                  <dt>Тавцан</dt>
                  <dd>{tops.length}</dd>
                </div>
              </dl>
              <div className="kp-review-dimensions">
                <span>Нийт эзлэх хэмжээ</span>
                <strong>
                  {Math.round(bounds.w * 1000)} × {Math.round(bounds.d * 1000)}{" "}
                  × {Math.round(bounds.h * 1000)} мм
                </strong>
              </div>
              <div
                className={`kp-review-issues ${issues.some((issue) => issue.severity === "error") ? "has-error" : ""}`}
              >
                <strong>
                  {issues.length
                    ? `${issues.length} анхаарах зүйл`
                    : "Давхцал, өрөөний хязгаарын алдаа алга"}
                </strong>
                {issues.slice(0, 4).map((issue, index) => (
                  <p key={`${issue.code}-${index}`}>{issue.message}</p>
                ))}
              </div>
              <KitchenRoomFitStatus kitchen={design} name={name} />
              <div className="kp-review-actions">
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => setReviewOpen(false)}
                >
                  Төлөвлөгөөг засах
                </button>
                {user ? (
                  <button
                    type="button"
                    className="kp-primary"
                    disabled={busy}
                    onClick={() => void save()}
                  >
                    <Save size={17} /> Хадгалах
                  </button>
                ) : (
                  <Link
                    className="kp-primary"
                    href={`/login?next=${encodeURIComponent(new URLSearchParams(queryString).has("design") ? `/kitchen?${queryString}` : `/kitchen?importGuest=1${draftToken ? `&draft=${encodeURIComponent(draftToken)}` : ""}`)}`}
                  >
                    Нэвтэрч хадгалах
                  </Link>
                )}
              </div>
              {user && (
                <button
                  type="button"
                  className="kp-primary kitchen-import-room"
                  disabled={busy}
                  onClick={() => void save(true)}
                >
                  Хадгалаад өрөөнд байрлуулах <ChevronRight size={17} />
                </button>
              )}
              <KitchenExportButtons
                root={exportRoot}
                name={name}
                disabled={busy || !kitchen.cabinets.length}
              />

              {user && savedId && marketplaceSource && (
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
              )}
            </aside>
          </div>
        </section>
      )}
      {message && (
        <div
          className="kp-error"
          data-tone={notice.tone}
          role={notice.tone === "success" ? "status" : "alert"}
        >
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")}>
            Хаах
          </button>
        </div>
      )}
    </main>
  );
}
