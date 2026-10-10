"use client";

import dynamic from "next/dynamic";
import { useKitchenCatalog } from "@/features/kitchen-planner/hooks/useKitchenCatalog";
import { KitchenStandardLibrary } from "@/features/kitchen-planner/components/KitchenStandardLibrary";
import {
  createStandardKitchenCabinet,
  type KitchenStandardType,
} from "@/lib/kitchenStandardCatalog";
import { KitchenModelLibrary } from "@/features/kitchen-planner/components/KitchenModelLibrary";
import { cabinetFromCatalog } from "@/lib/kitchenCatalogInsertion";
import { EditorHistory } from "@/lib/editorHistory";
import {
  extraFromProduct,
  findExtraSpace,
  parseKitchenExtras,
  type KitchenExtra,
} from "@/lib/kitchenExtras";
import { ExtrasPanel } from "@/features/kitchen-planner/components/ExtrasPanel";
import { ProjectReport } from "@/features/kitchen-planner/components/ProjectReport";
import { ViewportControls } from "@/features/planner/components/ViewportControls";
import { PlannerRail } from "@/features/planner/components/PlannerRail";
import {
  PlannerSwitcher,
  PlannerWorkflow,
} from "@/features/planner/components/PlannerWorkflow";
import { usePlannerPanel } from "@/features/planner/components/usePlannerPanel";
import "@/features/planner/components/planner-studio.css";
import "@/features/planner/components/planner-reference.css";
import "@/features/planner/components/planner-usability.css";
import "@/features/planner/components/planner-sidebar.css";
import "@/features/kitchen-planner/components/kitchen-editor.css";
import type { CameraRequest } from "@/lib/plannerCamera";
import { VersionHistory } from "@/features/kitchen-planner/components/VersionHistory";
import { useCatalog } from "@/store/catalog";
import type { Product } from "@/lib/types";
import {
  DimensionInput,
  Plan,
} from "@/features/kitchen-planner/components/PlannerPanels";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  House,
  Layers3,
  Plus,
  RotateCw,
  Save,
  Settings2,
  Trash2,
  LayoutPanelTop,
  X,
  Undo2,
  Redo2,
  Copy,
  Move,
  Orbit,
  Grid2X2,
  DoorOpen,
  Paintbrush,
  Ruler,
  ShoppingBag,
} from "lucide-react";
import {
  CABINET_DEFAULTS,
  cabinetWidths,
  createCabinet,
  createHood,
  createRefrigerator,
  cabinetLabel,
  validateCabinet,
  roomWalls,
  type CabinetPose,
  type CabinetType,
  type CabinetWidth,
  type ModularCabinet,
  type ModularKitchen,
} from "@/lib/kitchenCabinets";
import {
  cabinetAxes,
  findCabinetSpace,
  fitCountertops,
  placementIssues,
  proposeCabinetMove,
  snapCabinet,
  resolveElevations,
  wallCabinetClearance,
} from "@/lib/kitchenPlacement";
import {
  applyKitchenAppearance,
  arrangeKitchen,
  cloneKitchen,
  createUnifiedKitchen,
  kitchenEnvelope,
  parseKitchen,
  replaceCorner,
} from "@/lib/kitchenAssembly";
import { FINISHES, type Finish, type FrontStyle } from "@/lib/kitchen";
import { useAuth } from "@/store/auth";
import { useKitchens } from "@/store/kitchens";
import type { Group } from "three";
import { KitchenOptionsPanel } from "./KitchenOptionsPanel";
import { KitchenSimilarCabinets } from "./KitchenSimilarCabinets";
import {
  componentTypes,
  parseComponents,
  replaceComponent,
  withOpening,
  type CabinetComponent,
} from "@/lib/kitchenComponents";
import { KitchenExportButtons } from "./KitchenExportButtons";
import { KitchenQuoteRequest } from "./KitchenQuoteRequest";
import {
  fitBacksplashes,
  parseBacksplashSettings,
  type BacksplashPanel,
} from "@/lib/kitchenBacksplash";
import {
  applyKitchenCatalogVariants,
  type KitchenCatalogModule,
  type KitchenCatalogVariant,
} from "@/lib/kitchenModuleCatalog";
import { type KitchenMaterialDefinition } from "@/lib/kitchenMaterials";

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
const KNOWN_FINISH_IDS = new Set<string>(FINISHES.map((finish) => finish.id));
const KITCHEN_LAYOUT_OPTIONS = [
  ["straight", "I · Шулуун"],
  ["l-right", "L · баруун булан"],
  ["l-left", "L · зүүн булан"],
  ["u", "U · гурван талт"],
  ["double-side", "Хоёр талт"],
] as const;
const KITCHEN_INSPECTOR_LABELS = {
  materials: "Өнгө, материал",
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
  const [design, setDesign] = useState<ModularKitchen>(createUnifiedKitchen);
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
  const [componentOverview, setComponentOverview] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(
    () => new URLSearchParams(queryString).get("new") === "1",
  );
  const [catalogSource, setCatalogSource] = useState<"standard" | "models">(
    "standard",
  );
  const settingsRef = usePlannerPanel(settingsOpen, () =>
    setSettingsOpen(false),
  );
  const [inspectorTab, setInspector] = useState<
    keyof typeof KITCHEN_INSPECTOR_LABELS
  >(() =>
    new URLSearchParams(queryString).get("new") === "1" ? "room" : "catalog",
  );
  const [reviewOpen, setReviewOpen] = useState(false);
  const {
    moduleCatalog,
    materialCatalog,
    loading: catalogLoading,
    error: catalogError,
    retry: retryCatalog,
  } = useKitchenCatalog(active);
  const [exportRoot, setExportRoot] = useState<Group | null>(null);
  const captureKitchen = useRef<(() => Promise<Blob | null>) | null>(null);
  const registerKitchenCapture = useCallback(
    (capture: (() => Promise<Blob | null>) | null) => {
      captureKitchen.current = capture;
    },
    [],
  );
  const [viewKey, setViewKey] = useState(0);
  const [cameraRequest, setCameraRequest] = useState<CameraRequest>();
  const [scope, setScope] = useState<"all" | "base" | "wall" | "selected">(
    "all",
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
            next = parseKitchen(draft.design);
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
  const [mode, setMode] = useState<"move" | "orbit">("orbit");
  const [addType, setAddType] = useState<KitchenStandardType>("base");
  const [addWidth, setAddWidth] = useState<CabinetWidth>(600);
  const [message, setMessage] = useState("");
  const [snapMessage, setSnapMessage] = useState("");
  const [dragging, setDragging] = useState(false);
  const kitchen = preview ?? design;
  const selected = kitchen.cabinets.find((c) => c.id === selectedId);
  const inspector =
    inspectorTab === "selection" && !selected ? "materials" : inspectorTab;
  const selectedExtra = kitchen.extras?.find((e) => e.id === selectedId);
  const variantModels = useMemo(
    () =>
      Object.fromEntries(
        moduleCatalog.flatMap((module) =>
          module.variants.map((variant) => [variant.furnitureModelId, variant]),
        ),
      ),
    [moduleCatalog],
  );
  const selectableMaterials = materialCatalog.length
    ? materialCatalog
    : FALLBACK_MATERIALS;
  const frontMaterials = selectableMaterials.filter((material) =>
    ["general", "front"].includes(material.surfaceKind),
  );
  const carcassMaterials = selectableMaterials.filter((material) =>
    ["general", "carcass"].includes(material.surfaceKind),
  );
  const countertopMaterials = selectableMaterials.filter((material) =>
    ["general", "countertop"].includes(material.surfaceKind),
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
  const backsplashes = useMemo(() => fitBacksplashes(kitchen), [kitchen]);
  const clearance = selected ? wallCabinetClearance(selected, kitchen) : null;
  const bounds = kitchenEnvelope(kitchen),
    busy = dragging || saving || versionBusy || !ready;
  const appearanceIds =
    scope === "all"
      ? null
      : scope === "selected"
        ? [selectedId ?? ""]
        : design.cabinets
            .filter((c) =>
              scope === "wall" ? c.type === "wall" : c.type !== "wall",
            )
            .map((c) => c.id);
  const appearance = design.cabinets.find(
    (c) => !appearanceIds || appearanceIds.includes(c.id),
  );
  const legacyAppearanceMaterialId =
    appearance?.finish ??
    (appearance?.material === "wood" ? "oak" : appearance?.material);
  const countertopMaterialId =
    design.countertop.materialId ??
    design.countertop.finish ??
    (design.countertop.material === "wood"
      ? "oak"
      : design.countertop.material === "granite"
        ? "marble"
        : "matte");
  function style(patch: Parameters<typeof applyKitchenAppearance>[2]) {
    commit(applyKitchenAppearance(design, appearanceIds, patch));
  }
  const historyAction = useCallback(
    (action: "undo" | "redo") => {
      if (busy) return;
      const next = history.current[action](designRef.current);
      if (!next) return;
      designRef.current = next;
      setDesign(next);
      setSelectedId(null);
      setMessage("");
      redrawHistory((value) => value + 1);
    },
    [busy],
  );
  useEffect(() => {
    const shortcut = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
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
  }, [historyAction]);
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
        setMessage(
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
    setInspector(
      design.extras?.some((extra) => extra.id === id) ? "extras" : "selection",
    );
    setSettingsOpen(true);
  }
  function start(id: string) {
    if (busy) return;
    setOpen(false);
    setComponentOverview(false);
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
    if (!cancel && next && !commit(next))
      setMessage("Энд байрлуулах боломжгүй тул өмнөх байрлалд буцаалаа.");
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
  function changeComponent(item: CabinetComponent): string | undefined {
    if (!selected || busy) return "Өөрчлөлт дуусахыг хүлээнэ үү.";
    const result = replaceComponent(design, selected.id, item);
    if (result.error) return result.error;
    return commit(result.kitchen)
      ? undefined
      : "Энэ өөрчлөлт байрлалын шаардлага хангахгүй байна.";
  }
  function updatePose(patch: Partial<CabinetPose>) {
    if (!selected || dragging) return;
    commit(
      proposeCabinetMove(design, selected.id, {
        ...selected.position,
        ...patch,
      }).kitchen,
    );
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
      setMessage(`${variant.modelName || module.name} нэмэгдлээ.`);
    }
  }
  function addCabinet() {
    const id = crypto.randomUUID();
    if (busy || design.cabinets.length >= 80) return;
    const cabinet = createStandardKitchenCabinet(
      addType,
      id,
      addWidth,
      design.room.height,
    );
    if (appearance)
      Object.assign(cabinet, {
        finish: appearance.finish,
        frontStyle: appearance.frontStyle,
        handleStyle: appearance.handleStyle,
        material: appearance.material,
        color: appearance.color,
      });
    const next = findCabinetSpace(design, cabinet);
    if (!next) {
      setMessage(
        "Энэ хэмжээтэй шүүгээ багтах сул ханын зай алга. Шүүгээ зөөх, хасах эсвэл өрөөг томруулна уу.",
      );
      return;
    }
    if (commit(next)) {
      setSelectedId(cabinet.id);
      setMessage(
        `${cabinetLabel(cabinet)} нэмэгдлээ. 3D дээр дарж сонгоод тохируулаарай.`,
      );
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
  function updateBacksplash(id: string, patch: Partial<BacksplashPanel>) {
    commit({
      ...design,
      backsplashSettings: {
        mode: "manual",
        panels: fitBacksplashes(design).map((panel) =>
          panel.id === id ? { ...panel, ...patch } : panel,
        ),
      },
    });
  }
  return (
    <main className="kp kp-shell planner-studio planner-reference kitchen-reference">
      <header className="kp-planner-topbar">
        <Link
          href="/"
          className="kp-planner-brand"
          aria-label="Tavilga.mn нүүр"
        >
          <House size={18} /> <span>tavilga.mn</span>
        </Link>
        <div className="studio-heading kitchen-studio-heading">
          <span>Гал тогооны төлөвлөгч</span>
          <small>Өөрийнхөөрөө тохижуулах</small>
        </div>
        <PlannerSwitcher current="kitchen" />
        <nav className="kp-planner-steps" aria-label="Төлөвлөх үе шат">
          <span className="is-active">3D төлөвлөх</span>
          <button type="button" onClick={() => setReviewOpen(true)}>
            Шалгах
          </button>
          {user ? (
            <button type="button" disabled={busy} onClick={() => void save()}>
              Хадгалах
            </button>
          ) : (
            <Link href="/login?next=%2Fkitchen%3FimportGuest%3D1">
              Хадгалах
            </Link>
          )}
        </nav>
        <div className="kp-top-actions">
          <button
            type="button"
            aria-label="Буцаах"
            title="Ctrl/Cmd+Z"
            disabled={busy || !history.current.undoCount}
            onClick={() => historyAction("undo")}
          >
            <Undo2 size={18} />
          </button>
          <button
            type="button"
            aria-label="Дахин хийх"
            title="Ctrl/Cmd+Shift+Z"
            disabled={busy || !history.current.redoCount}
            onClick={() => historyAction("redo")}
          >
            <Redo2 size={18} />
          </button>
          <details className="km-layout-menu kp-top-menu">
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
            aria-label="Нэмэх"
            onClick={() => {
              setSelectedId(null);
              setInspector("catalog");
              setSettingsOpen(true);
            }}
          >
            <Plus size={18} /> <span>Нэмэх</span>
          </button>
          <button
            type="button"
            aria-label="Тохиргоо"
            onClick={() => {
              setSelectedId(null);
              setInspector("room");
              setSettingsOpen(true);
            }}
          >
            <Settings2 size={18} /> <span>Тохиргоо</span>
          </button>
          <label className="kp-project-name">
            <span className="sr-only">Загварын нэр</span>
            <input
              value={name}
              maxLength={100}
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          {user ? (
            <button
              className="kp-save-button"
              aria-label="Хадгалах"
              disabled={busy}
              onClick={() => void save()}
            >
              <Save size={18} />{" "}
              <span>{saving ? "Хадгалж байна…" : "Хадгалах"}</span>
            </button>
          ) : (
            <Link
              className="kp-save-button"
              aria-label="Нэвтэрч хадгалах"
              title="Нэвтэрч хадгалах"
              href={`/login?next=${encodeURIComponent(new URLSearchParams(queryString).has("design") ? `/kitchen?${queryString}` : `/kitchen?importGuest=1${draftToken ? `&draft=${encodeURIComponent(draftToken)}` : ""}`)}`}
            >
              <Save size={18} /> <span>Хадгалах</span>
            </Link>
          )}
          <details className="kp-top-menu kp-more-menu">
            <summary aria-label="Нэмэлт үйлдэл">•••</summary>
            <div className="kp-more-content">
              {user && (
                <button type="button" onClick={() => void save(true)}>
                  Хадгалаад өрөөнд байрлуулах
                </button>
              )}
              <Link href="/kitchen?new=1">Шинэ гарнитур</Link>
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
          <Link
            href="/planner"
            className="kp-close-planner"
            aria-label="Planner-оос гарах"
          >
            <X size={20} />
          </Link>
        </div>
      </header>
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
      <div className="kp-layout">
        <PlannerRail
          items={[
            {
              id: "room",
              label: "Өрөөний хэмжээ",
              Icon: House,
              active: inspector === "room",
              onClick: () => {
                setInspector("room");
                setSettingsOpen(true);
              },
            },
            {
              id: "catalog",
              label: "Шүүгээ, төхөөрөмж",
              Icon: Grid2X2,
              active: inspector === "catalog",
              onClick: () => {
                setInspector("catalog");
                setSettingsOpen(true);
              },
            },
            {
              id: "materials",
              label: "Өнгө, материал",
              Icon: Paintbrush,
              active: inspector === "materials",
              onClick: () => {
                setInspector("materials");
                setSettingsOpen(true);
              },
            },
            {
              id: "extras",
              label: "Тавилга, нэмэлт",
              Icon: ShoppingBag,
              active: inspector === "extras",
              onClick: () => {
                setInspector("extras");
                setSelectedId(null);
                setSettingsOpen(true);
              },
            },
            {
              id: "selection",
              label: "Сонгосон шүүгээ",
              Icon: Settings2,
              active: inspector === "selection",
              disabled: !selected,
              onClick: () => {
                setInspector("selection");
                setSettingsOpen(true);
              },
            },
            {
              id: "plan",
              label: "2D план, тайлан",
              Icon: Ruler,
              onClick: () => setReviewOpen(true),
            },
          ]}
        />
        <div className="kp-workspace">
          <section className="kp-preview" aria-label="Модуль шүүгээ байрлуулах">
            <PlannerWorkflow
              active={
                inspector === "room" ||
                inspector === "catalog" ||
                inspector === "materials"
                  ? inspector
                  : null
              }
              disabled={busy}
              onSelect={(step) => {
                setInspector(step);
                setSettingsOpen(true);
              }}
            />
            <div className="kp-preview-bar">
              <span>
                {Math.round(bounds.w * 1000)} × {Math.round(bounds.d * 1000)} ×{" "}
                {Math.round(bounds.h * 1000)} мм · {kitchen.cabinets.length}{" "}
                шүүгээ
              </span>
              <div
                className="km-view-tools"
                role="group"
                aria-label="3D үйлдэл"
              >
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={mode === "move"}
                  aria-label="Шүүгээ зөөх"
                  onClick={() => {
                    setMode("move");
                    setOpen(false);
                  }}
                >
                  <Move size={17} />
                  <span>Шүүгээ зөөх</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={mode === "orbit"}
                  aria-label="Харах өнцөг"
                  onClick={() => setMode("orbit")}
                >
                  <Orbit size={17} />
                  <span>Харах өнцөг</span>
                </button>
                <button
                  type="button"
                  disabled={busy || !selected}
                  aria-label="Бүрэлдэхүүн хэсгүүд"
                  onClick={() => setComponentOverview(true)}
                >
                  <Layers3 size={17} />
                  <span>Бүрэлдэхүүн хэсгүүд</span>
                </button>
                <button
                  type="button"
                  aria-label="2D план"
                  onClick={() => setReviewOpen(true)}
                >
                  <Grid2X2 size={17} />
                  <span>2D план</span>
                </button>
                <button
                  type="button"
                  disabled={busy}
                  aria-pressed={open}
                  aria-label={open ? "Хаалгуудыг хаах" : "Хаалгуудыг нээх"}
                  onClick={() => {
                    setMode("orbit");
                    setOpen(!open);
                  }}
                >
                  <DoorOpen size={17} />
                  <span>{open ? "Хаалгуудыг хаах" : "Хаалгуудыг нээх"}</span>
                </button>
              </div>
            </div>
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
            <div className="kp-canvas">
              {active && ready && (
                <Scene
                  key={viewKey}
                  exportRoot={setExportRoot}
                  capture={registerKitchenCapture}
                  kitchen={sceneKitchen}
                  open={open}
                  selectedId={selectedId}
                  mode={saving ? "orbit" : mode}
                  cameraRequest={cameraRequest}
                  onSelect={selectCabinet}
                  onDeselect={() => {
                    setSelectedId(null);
                    setInspector((previous) =>
                      previous === "selection" ? "materials" : previous,
                    );
                    setSettingsOpen(false);
                    setComponentOverview(false);
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
            <p className="kp-preview-hint">
              {mode === "move"
                ? "Шүүгээг чирж зөөнө · Хоёр хуруу: zoom, шилжүүлэх · Esc: буцаах"
                : "Чирж эргүүлэх · Дугуй: заасан цэг рүү zoom · Хоёр хуруу: zoom, шилжүүлэх"}
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
                Эхний шүүгээгээ баруун талын сонголтоос нэмээрэй.
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
          className={`kp-settings ${settingsOpen ? "is-open" : ""} ${selected || selectedExtra ? "is-selected" : "is-tools"}`}
          data-inspector={inspector}
          aria-label={
            inspector === "selection"
              ? "Сонгосон шүүгээний тохиргоо"
              : KITCHEN_INSPECTOR_LABELS[inspector]
          }
        >
          <div className="kp-settings-head">
            <strong>
              {inspector === "selection" && selected
                ? cabinetLabel(selected)
                : KITCHEN_INSPECTOR_LABELS[inspector]}
            </strong>
            <button
              type="button"
              aria-label="Тохиргооны хэсгийг хаах"
              onClick={() => setSettingsOpen(false)}
            >
              <X size={19} />
            </button>
          </div>
          <p className="kitchen-inspector-help">
            {inspector === "room"
              ? "1. Өрөөний хэмжээ, гарнитурын хэлбэрээ тохируулна."
              : inspector === "catalog"
                ? "2. Шүүгээ, төхөөрөмжөө сонгож нэмнэ."
                : inspector === "materials"
                  ? "3. Өнгө, материал, тавцангаа тохируулна."
                  : inspector === "selection"
                    ? "Сонгосон шүүгээний хэмжээ, хаалга, байрлалыг өөрчилнө."
                    : "Гал тогоондоо нэмэлт тавилга байрлуулна."}
          </p>
          <div data-inspector-section="extras">
            <ExtrasPanel
              products={products.products}
              selected={selectedExtra}
              room={design.room}
              disabled={busy}
              error={products.error}
              loading={products.loading}
              onAdd={addExtra}
              onChange={changeExtra}
              onDuplicate={duplicateExtra}
              onDelete={() => {
                if (
                  commit({
                    ...design,
                    extras: design.extras?.filter((e) => e.id !== selectedId),
                  })
                )
                  setSelectedId(null);
              }}
            />
          </div>
          {selected && (
            <section className="kp-panel" data-inspector-section="selection">
              <div className="kp-section-heading">
                <h2>{cabinetLabel(selected)}</h2>
                <button
                  type="button"
                  disabled={busy}
                  aria-label="Сонгосон шүүгээг хувилах"
                  onClick={duplicateCabinet}
                >
                  <Copy size={18} />
                </button>
                <button
                  type="button"
                  className="km-delete"
                  disabled={busy}
                  aria-label="Сонгосон шүүгээг устгах"
                  onClick={() => {
                    const next = {
                      ...design,
                      cabinets: design.cabinets.filter(
                        (c) => c.id !== selected.id,
                      ),
                    };
                    if (commit(next))
                      setSelectedId(next.cabinets[0]?.id ?? null);
                  }}
                >
                  <Trash2 size={18} />
                </button>
              </div>
              <fieldset className="km-fields" disabled={busy} key={selected.id}>
                {selected.corner !== undefined && (
                  <label className="kp-field">
                    <span>Булангийн төрөл</span>
                    <select
                      value={selected.corner ? "corner" : "regular"}
                      onChange={(e) => {
                        const corner = e.target.value === "corner";
                        updateCabinet(replaceCorner(selected, corner));
                      }}
                    >
                      <option value="corner">Булангийн шүүгээ</option>
                      <option value="regular">Энгийн шүүгээ</option>
                    </select>
                  </label>
                )}
                <label className="kp-field">
                  <span>Шүүгээний загвар</span>
                  <select
                    value={selected.opening ?? "doors"}
                    onChange={(e) => {
                      const opening = e.target
                        .value as ModularCabinet["opening"];
                      updateCabinet(withOpening(selected, opening));
                    }}
                  >
                    <option value="doors">Хаалгатай</option>
                    <option value="open">Ил тавиур</option>
                    {selected.type !== "wall" && (
                      <option value="drawers">Шургуулгатай</option>
                    )}
                    {selected.type === "base" && (
                      <>
                        <option value="sink" disabled={selected.width < 600}>
                          Угаалтууртай
                        </option>
                        <option value="hob" disabled={selected.width < 600}>
                          Зөвхөн плиткатай
                        </option>
                      </>
                    )}
                    {selected.type !== "wall" && (
                      <option
                        value="oven"
                        disabled={
                          selected.width !== 600 || selected.depth < 580
                        }
                      >
                        {selected.type === "base"
                          ? "Плитка + суурилуулсан зуух"
                          : "Дунд хэсэгт суурилуулсан зуух"}
                      </option>
                    )}
                    {selected.opening === "refrigerator" && (
                      <option value="refrigerator">Хөргөгч</option>
                    )}
                    {selected.opening === "hood" && (
                      <option value="hood">Утаа сорогч</option>
                    )}
                  </select>
                </label>
                {selected.opening === "drawers" && (
                  <label className="kp-field">
                    <span>Шургуулга</span>
                    <select
                      value={selected.drawerCount}
                      onChange={(e) =>
                        updateCabinet({ drawerCount: Number(e.target.value) })
                      }
                    >
                      <option value={2}>2 шургуулга</option>
                      <option value={3}>3 шургуулга</option>
                    </select>
                  </label>
                )}
                {selected.opening === "oven" && (
                  <label className="kp-field">
                    <span>Зуухны байрлал</span>
                    <select
                      value={selected.type}
                      onChange={(e) => {
                        const replacement = withOpening(
                          createCabinet(
                            e.target.value as "base" | "tall",
                            selected.id,
                            600,
                            design.room.height,
                          ),
                          "oven",
                        );
                        replaceCabinet({
                          ...replacement,
                          finish: selected.finish,
                          color: selected.color,
                          components: selected.components,
                          position: { ...selected.position, y: 0 },
                        });
                      }}
                    >
                      <option value="base">Тавцангийн доор · Worktop</option>
                      <option value="tall">
                        Өндөр шүүгээнд · High cabinet
                      </option>
                    </select>
                  </label>
                )}
                {selected.opening === "hood" && (
                  <label className="kp-field">
                    <span>Утаа сорогчийн байрлал</span>
                    <select
                      value={selected.hoodMount ?? "wall"}
                      onChange={(e) => {
                        const replacement = createHood(
                          selected.id,
                          e.target.value as "under-cabinet" | "wall",
                          selected.width,
                        );
                        const { front } = cabinetAxes(
                            selected.position.rotation,
                          ),
                          offset = (replacement.depth - selected.depth) / 2;
                        replaceCabinet({
                          ...replacement,
                          position: {
                            ...selected.position,
                            x: selected.position.x + front.x * offset,
                            z: selected.position.z + front.z * offset,
                          },
                        });
                      }}
                    >
                      <option value="under-cabinet">Шүүгээний доор</option>
                      <option value="wall">Шууд хананд</option>
                    </select>
                  </label>
                )}
                {selected.opening === "refrigerator" && (
                  <label className="kp-field">
                    <span>Хөргөгчийн хаалга</span>
                    <select
                      value={selected.refrigeratorStyle ?? "top-bottom"}
                      onChange={(e) => {
                        const replacement = createRefrigerator(
                          selected.id,
                          e.target.value as "top-bottom" | "side-by-side",
                        );
                        const { front } = cabinetAxes(
                            selected.position.rotation,
                          ),
                          offset = (replacement.depth - selected.depth) / 2;
                        replaceCabinet({
                          ...replacement,
                          position: {
                            ...selected.position,
                            x: selected.position.x + front.x * offset,
                            z: selected.position.z + front.z * offset,
                          },
                        });
                      }}
                    >
                      <option value="top-bottom">
                        Дээр, доор хоёр хаалгатай
                      </option>
                      <option value="side-by-side">
                        Зэрэгцээ хоёр том хаалгатай
                      </option>
                    </select>
                  </label>
                )}
                <details className="km-details">
                  <summary>Хэмжээ, байрлал өөрчлөх</summary>
                  <div className="km-fields">
                    {selected.opening === "refrigerator" ? (
                      <DimensionInput
                        label="Хөргөгчийн нийт өргөн"
                        value={selected.width}
                        min={450}
                        max={1200}
                        onCommit={(width) => updateCabinet({ width })}
                      />
                    ) : (
                      <label className="kp-field">
                        <span>Өргөн</span>
                        <select
                          value={selected.width}
                          onChange={(e) => {
                            const width = Number(
                              e.target.value,
                            ) as CabinetWidth;
                            updateCabinet({
                              width,
                              doorCount: width < 600 ? 1 : selected.doorCount,
                            });
                          }}
                        >
                          {(selected.corner
                            ? [selected.type === "wall" ? 800 : 1000]
                            : cabinetWidths(selected.type)
                          ).map((width) => (
                            <option key={width} value={width}>
                              {width} мм
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                    <DimensionInput
                      label="Өндөр"
                      value={selected.height}
                      min={
                        selected.opening === "refrigerator"
                          ? 1400
                          : selected.opening === "hood"
                            ? 200
                            : CABINET_DEFAULTS[selected.type].heightRange[0]
                      }
                      max={
                        selected.opening === "refrigerator"
                          ? 2300
                          : CABINET_DEFAULTS[selected.type].heightRange[1]
                      }
                      disabled={
                        selected.type === "tall" && selected.fitToCeiling
                      }
                      onCommit={(height) => updateCabinet({ height })}
                    />
                    <DimensionInput
                      label="Гүн"
                      value={selected.depth}
                      min={
                        selected.opening === "refrigerator"
                          ? 500
                          : CABINET_DEFAULTS[selected.type].depthRange[0]
                      }
                      max={
                        selected.opening === "refrigerator"
                          ? 900
                          : selected.opening === "hood"
                            ? 600
                            : CABINET_DEFAULTS[selected.type].depthRange[1]
                      }
                      onCommit={(depth) => {
                        const { front } = cabinetAxes(
                            selected.position.rotation,
                          ),
                          delta = (depth - selected.depth) / 2;
                        updateCabinet({
                          depth,
                          position: {
                            ...selected.position,
                            x: selected.position.x + front.x * delta,
                            z: selected.position.z + front.z * delta,
                          },
                        });
                      }}
                    />
                    <label className="kp-field">
                      <span>Хаалганы тоо</span>
                      <select
                        value={selected.doorCount}
                        onChange={(e) =>
                          updateCabinet({
                            doorCount: Number(e.target.value) as 1 | 2,
                          })
                        }
                      >
                        <option value={1}>1 хаалга</option>
                        <option value={2} disabled={selected.width < 600}>
                          2 хаалга
                        </option>
                      </select>
                    </label>
                    {selected.type !== "wall" &&
                      ![
                        "sink",
                        "open",
                        "oven",
                        "drawers",
                        "refrigerator",
                      ].includes(selected.opening ?? "") && (
                        <label className="kp-field">
                          <span>Шургуулганы тоо</span>
                          <select
                            value={selected.drawerCount}
                            onChange={(e) =>
                              updateCabinet({
                                drawerCount: Number(e.target.value),
                              })
                            }
                          >
                            {[0, 2, 3].map((count) => (
                              <option key={count} value={count}>
                                {count}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                    {selected.type === "tall" &&
                      selected.opening !== "refrigerator" && (
                        <label className="kp-checkbox">
                          <input
                            type="checkbox"
                            checked={selected.fitToCeiling}
                            onChange={(e) =>
                              updateCabinet({ fitToCeiling: e.target.checked })
                            }
                          />
                          Таазны өндөрт тааруулах
                        </label>
                      )}
                    {selected.type === "wall" && (
                      <>
                        <label className="kp-checkbox">
                          <input
                            type="checkbox"
                            checked={selected.autoElevation}
                            onChange={(e) =>
                              updateCabinet({ autoElevation: e.target.checked })
                            }
                          />
                          Тавцангаас өндрийг автоматаар тооцох
                        </label>
                        <DimensionInput
                          label="Шалнаас доод ирмэг хүртэл"
                          value={selected.position.y}
                          min={0}
                          max={kitchen.room.height - selected.height}
                          disabled={selected.autoElevation}
                          onCommit={(y) =>
                            updateCabinet({
                              position: { ...selected.position, y },
                            })
                          }
                        />
                        <p className="km-clearance">
                          {clearance === null
                            ? "Доор нь доод шүүгээ байрлаагүй байна."
                            : `Тавцангаас зай: ${Math.round(clearance)} мм`}
                        </p>
                      </>
                    )}
                    <details className="km-details">
                      <summary>Байрлалыг хэмжээгээр тохируулах</summary>
                      <div className="km-fields">
                        <DimensionInput
                          label="Зүүн хананаас төв хүртэл (X)"
                          value={selected.position.x}
                          min={0}
                          max={kitchen.room.width}
                          onCommit={(x) => updatePose({ x })}
                        />
                        <DimensionInput
                          label="Арын хананаас төв хүртэл (Z)"
                          value={selected.position.z}
                          min={0}
                          max={kitchen.room.depth}
                          onCommit={(z) => updatePose({ z })}
                        />
                        <button
                          type="button"
                          className="kp-primary"
                          onClick={() => {
                            // Explicit rotation is not immediately snapped back to the same wall.
                            updateCabinet({
                              position: {
                                ...selected.position,
                                rotation:
                                  selected.position.rotation + Math.PI / 2,
                              },
                            });
                          }}
                        >
                          <RotateCw size={16} />
                          90° эргүүлэх
                        </button>
                      </div>
                    </details>
                  </div>
                </details>
              </fieldset>
            </section>
          )}
          {selected && inspector === "selection" && (
            <KitchenSimilarCabinets
              key={`similar-${selected.id}`}
              cabinet={selected}
              modules={moduleCatalog}
              disabled={busy}
              onVariant={replaceWithCatalogVariant}
              onOpening={(opening) =>
                updateCabinet(withOpening(selected, opening))
              }
            />
          )}
          {selected && (inspector === "selection" || componentOverview) && (
            <KitchenOptionsPanel
              key={selected.id}
              cabinet={selected}
              kitchen={kitchen}
              disabled={busy}
              onReplace={changeComponent}
              onCabinetChange={updateCabinet}
              showOverview={componentOverview}
              onOverviewClose={() => setComponentOverview(false)}
            />
          )}
          <details
            className="kp-panel km-details planner-material-section"
            data-inspector-section="materials"
            open
          >
            <summary>Шүүгээний өнгө, материал</summary>
            <fieldset className="km-fields" disabled={busy}>
              <div className="planner-scope-control">
                <strong>Хаана хэрэглэх вэ?</strong>
                <div
                  className="planner-filter-pills"
                  aria-label="Материал өөрчлөх хэсэг"
                >
                  {(
                    [
                      ["all", "Бүгд"],
                      ["base", "Доод"],
                      ["wall", "Дээд"],
                      ["selected", "Сонгосон"],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={scope === value}
                      disabled={value === "selected" && !selected}
                      onClick={() => setScope(value)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <p className="planner-section-label">Хаалганы материал</p>
              <div
                className="km-finishes"
                role="group"
                aria-label="Фасадны материал"
              >
                {frontMaterials.map((f) => (
                  <button
                    type="button"
                    key={f.id}
                    disabled={!appearance}
                    aria-pressed={
                      (appearance?.frontMaterialId ??
                        legacyAppearanceMaterialId) === f.id
                    }
                    onClick={() =>
                      style({
                        frontMaterialId: f.id,
                        color: f.baseColor,
                        ...(KNOWN_FINISH_IDS.has(f.id)
                          ? { finish: f.id as Finish }
                          : {}),
                      })
                    }
                  >
                    <span style={{ background: f.baseColor }} />
                    {f.name}
                  </button>
                ))}
              </div>
              <p className="planner-section-label">Шүүгээний их бие</p>
              <div
                className="km-finishes"
                role="group"
                aria-label="Шүүгээний их биеийн материал"
              >
                {carcassMaterials.map((f) => (
                  <button
                    type="button"
                    key={f.id}
                    disabled={!appearance}
                    aria-pressed={
                      (appearance?.carcassMaterialId ??
                        legacyAppearanceMaterialId) === f.id
                    }
                    onClick={() => style({ carcassMaterialId: f.id })}
                  >
                    <span style={{ background: f.baseColor }} />
                    {f.name}
                  </button>
                ))}
              </div>
              <label className="kp-field">
                <span>Хаалганы өнгө</span>
                <input
                  type="color"
                  value={appearance?.color ?? "#ffffff"}
                  disabled={!appearance}
                  onChange={(e) => style({ color: e.target.value })}
                />
              </label>
              <label className="kp-field">
                <span>Хаалганы загвар</span>
                <select
                  value={appearance?.frontStyle ?? "flat"}
                  disabled={!appearance}
                  onChange={(e) =>
                    style({ frontStyle: e.target.value as FrontStyle })
                  }
                >
                  <option value="flat">Хавтгай</option>
                  <option value="shaker">Хүрээтэй</option>
                  <option value="glass">Шилэн</option>
                </select>
              </label>
              <label className="kp-field">
                <span>Бариул</span>
                <select
                  value={appearance?.handleStyle ?? "bar"}
                  disabled={!appearance}
                  onChange={(e) =>
                    style({
                      handleStyle: e.target
                        .value as ModularCabinet["handleStyle"],
                    })
                  }
                >
                  <option value="bar">Урт бариул</option>
                  <option value="knob">Товчин бариул</option>
                  <option value="push-open">Бариулгүй · дарж нээх</option>
                </select>
              </label>
              <p className="kp-help">
                Сонгосон материал бүх заасан шүүгээнд шууд үйлчилнэ.
              </p>
            </fieldset>
          </details>
          <details
            className="kp-panel km-details"
            data-inspector-section="materials"
          >
            <summary>Тавцан · нийт загвар</summary>
            <fieldset className="km-fields" disabled={busy}>
              <label className="kp-field">
                <span>Тавцангийн зузаан</span>
                <select
                  value={design.countertop.thickness}
                  onChange={(e) =>
                    commit({
                      ...design,
                      countertop: {
                        ...design.countertop,
                        thickness: Number(e.target.value),
                      },
                    })
                  }
                >
                  {[20, 28, 30, 38, 40].map((mm) => (
                    <option key={mm} value={mm}>
                      {mm} мм
                    </option>
                  ))}
                </select>
              </label>
              <label className="kp-field">
                <span>Урд ирмэгийн илүү</span>
                <select
                  value={design.countertop.frontOverhang}
                  onChange={(e) =>
                    commit({
                      ...design,
                      countertop: {
                        ...design.countertop,
                        frontOverhang: Number(e.target.value),
                      },
                    })
                  }
                >
                  {[0, 20, 30, 50, 100].map((mm) => (
                    <option key={mm} value={mm}>
                      {mm} мм · 600 мм шүүгээнд {600 + mm} мм тавцан
                    </option>
                  ))}
                </select>
              </label>
              <div
                className="km-finishes"
                role="group"
                aria-label="Тавцангийн материал"
              >
                {countertopMaterials.map((f) => (
                  <button
                    type="button"
                    key={f.id}
                    aria-pressed={countertopMaterialId === f.id}
                    onClick={() =>
                      commit({
                        ...design,
                        cabinets: design.cabinets.map((c) => ({
                          ...c,
                          ...(c.components
                            ? {
                                components: c.components.filter(
                                  (item) => item.type !== "worktop",
                                ),
                              }
                            : {}),
                        })),
                        countertop: {
                          ...design.countertop,
                          materialId: f.id,
                          color: f.baseColor,
                          ...(KNOWN_FINISH_IDS.has(f.id)
                            ? {
                                finish: f.id as Finish,
                                material: ["oak", "walnut"].includes(f.id)
                                  ? ("wood" as const)
                                  : f.id === "marble"
                                    ? ("granite" as const)
                                    : ("laminate" as const),
                              }
                            : {}),
                        },
                      })
                    }
                  >
                    <span style={{ background: f.baseColor }} />
                    {f.name}
                  </button>
                ))}
              </div>
              <label className="kp-checkbox">
                <input
                  type="checkbox"
                  checked={!!design.backsplash}
                  onChange={(e) =>
                    commit({ ...design, backsplash: e.target.checked })
                  }
                />
                Ханын хамгаалалтын хавтан
              </label>
              {design.backsplash && (
                <>
                  <label className="kp-field">
                    <span>Ханын хавтангийн урт, байрлал</span>
                    <select
                      value={design.backsplashSettings?.mode ?? "full-run"}
                      onChange={(e) =>
                        commit({
                          ...design,
                          backsplashSettings: {
                            mode: e.target.value as "full-run" | "manual",
                            panels:
                              e.target.value === "manual"
                                ? fitBacksplashes(design)
                                : [],
                          },
                        })
                      }
                    >
                      <option value="full-run">Тавилгуудын нийт уртаар</option>
                      <option value="manual">
                        Хэмжээ, байрлалыг өөрөө тохируулах
                      </option>
                    </select>
                  </label>
                  {design.backsplashSettings?.mode === "manual" &&
                    backsplashes.map((panel, i) => (
                      <details key={panel.id} className="km-details">
                        <summary>
                          Ханын хавтан {i + 1} · {panel.width} × {panel.height}{" "}
                          мм
                        </summary>
                        <div className="km-fields">
                          <DimensionInput
                            label="Урт"
                            value={panel.width}
                            min={100}
                            max={8000}
                            onCommit={(width) =>
                              updateBacksplash(panel.id, { width })
                            }
                          />
                          <DimensionInput
                            label="Өндөр"
                            value={panel.height}
                            min={100}
                            max={1500}
                            onCommit={(height) =>
                              updateBacksplash(panel.id, { height })
                            }
                          />
                          <DimensionInput
                            label="Зузаан"
                            value={panel.thickness}
                            min={6}
                            max={40}
                            onCommit={(thickness) =>
                              updateBacksplash(panel.id, { thickness })
                            }
                          />
                          <DimensionInput
                            label="Зүүн хананаас төв (X)"
                            value={panel.position.x}
                            min={0}
                            max={design.room.width}
                            onCommit={(x) =>
                              updateBacksplash(panel.id, {
                                position: { ...panel.position, x },
                              })
                            }
                          />
                          <DimensionInput
                            label="Арын хананаас төв (Z)"
                            value={panel.position.z}
                            min={0}
                            max={design.room.depth}
                            onCommit={(z) =>
                              updateBacksplash(panel.id, {
                                position: { ...panel.position, z },
                              })
                            }
                          />
                          <DimensionInput
                            label="Шалнаас доод ирмэг"
                            value={panel.position.y}
                            min={0}
                            max={design.room.height - panel.height}
                            onCommit={(y) =>
                              updateBacksplash(panel.id, {
                                position: { ...panel.position, y },
                              })
                            }
                          />
                          <button
                            type="button"
                            className="btn-ghost"
                            onClick={() =>
                              updateBacksplash(panel.id, {
                                position: {
                                  ...panel.position,
                                  rotation:
                                    panel.position.rotation + Math.PI / 2,
                                },
                              })
                            }
                          >
                            <RotateCw size={16} />
                            90° эргүүлэх
                          </button>
                        </div>
                      </details>
                    ))}
                </>
              )}
            </fieldset>
          </details>
          <section
            className="kitchen-catalog-panel"
            data-inspector-section="catalog"
            aria-label="Нэмэх загварын сан"
          >
            <div
              className="kitchen-catalog-tabs"
              role="group"
              aria-label="Загварын сан сонгох"
            >
              <button
                type="button"
                aria-pressed={catalogSource === "standard"}
                onClick={() => setCatalogSource("standard")}
              >
                Бэлэн шүүгээ
              </button>
              <button
                type="button"
                aria-pressed={catalogSource === "models"}
                onClick={() => setCatalogSource("models")}
              >
                3D загварын сан
              </button>
            </div>
            <div hidden={catalogSource !== "standard"}>
              <KitchenStandardLibrary
                type={addType}
                width={addWidth}
                disabled={busy}
                atLimit={kitchen.cabinets.length >= 80}
                onType={(type) => {
                  setAddType(type);
                  setAddWidth(600);
                }}
                onWidth={setAddWidth}
                onAdd={addCabinet}
              />
            </div>
            <div hidden={catalogSource !== "models"}>
              <KitchenModelLibrary
                modules={moduleCatalog}
                loading={catalogLoading}
                error={catalogError}
                retry={retryCatalog}
                disabled={busy || kitchen.cabinets.length >= 80}
                onAdd={addCatalogCabinet}
              />
            </div>
          </section>
          <details
            className="kp-panel km-details"
            data-inspector-section="room"
            open
          >
            <summary>Хэмжээ, байрлал</summary>
            <p className="kitchen-section-help">
              Өрөөний бодит хэмжээг миллиметрээр оруулна. Жишээ нь 4 метр = 4000
              мм.
            </p>
            <fieldset className="km-fields" disabled={busy}>
              <label className="kp-field">
                <span>Гарнитурын байрлал</span>
                <select
                  value={design.layout ?? "straight"}
                  onChange={(event) => {
                    const layout = KITCHEN_LAYOUT_OPTIONS.find(
                      ([value]) => value === event.target.value,
                    )?.[0];
                    if (layout && commit(arrangeKitchen(design, layout)))
                      setViewKey((key) => key + 1);
                  }}
                >
                  {KITCHEN_LAYOUT_OPTIONS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
              {(
                [
                  ["width", "Өрөөний өргөн", 2000, 8000],
                  ["depth", "Өрөөний урт", 2000, 8000],
                  ["height", "Таазны өндөр", 2200, 3500],
                ] as const
              ).map(([key, label, min, max]) => (
                <DimensionInput
                  key={key}
                  label={label}
                  value={design.room[key]}
                  min={min}
                  max={max}
                  onCommit={(value) =>
                    commit({
                      ...design,
                      room: { ...design.room, [key]: value },
                    })
                  }
                />
              ))}
              <DimensionInput
                label="Тавцангаас дээд шүүгээний зай"
                value={design.wallClearance}
                min={450}
                max={600}
                onCommit={(wallClearance) =>
                  commit({ ...design, wallClearance })
                }
              />
            </fieldset>
          </details>
          {(["room", "catalog", "materials"] as string[]).includes(
            inspector,
          ) && (
            <div className="kitchen-step-footer">
              <span>
                {kitchen.cabinets.length} шүүгээ ·{" "}
                {inspector === "room"
                  ? "Алхам 1 / 3"
                  : inspector === "catalog"
                    ? "Алхам 2 / 3"
                    : "Алхам 3 / 3"}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (inspector === "room") setInspector("catalog");
                  else if (inspector === "catalog") setInspector("materials");
                  else setReviewOpen(true);
                }}
              >
                {inspector === "room"
                  ? "Шүүгээ нэмэх"
                  : inspector === "catalog"
                    ? "Өнгө тохируулах"
                    : "Төлөвлөгөөг шалгах"}
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          )}
        </aside>
      </div>
      {reviewOpen && (
        <section
          className="kp-review-layer"
          role="dialog"
          aria-modal="true"
          aria-labelledby="kp-review-title"
        >
          <header className="kp-review-head">
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
            <section
              className="kp-review-plan"
              aria-label="Гал тогооны 2D төлөвлөгөө"
            >
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
                Шүүгээ дээр дарвал 3D хэсэгт тухайн шүүгээний тохиргоо нээгдэнэ.
              </p>
            </section>
            <aside
              className="kp-review-summary"
              aria-label="Төлөвлөгөөний тойм"
            >
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
                  3D рүү буцах
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
                    href="/login?next=%2Fkitchen%3FimportGuest%3D1"
                  >
                    Нэвтэрч хадгалах
                  </Link>
                )}
              </div>
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
        <div className="kp-error" role="alert">
          <span>{message}</span>
          <button type="button" onClick={() => setMessage("")}>
            Хаах
          </button>
        </div>
      )}
    </main>
  );
}
