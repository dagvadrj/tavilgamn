"use client";
import {
  useDraftState,
  useDraftStatus,
  clearDashboardDraft,
} from "@/hooks/useDashboardDraft";
import { DashboardDraftNotice } from "@/components/DashboardDraftNotice";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  CheckCircle,
  Link2,
  LoaderCircle,
  Power,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import dynamic from "next/dynamic";
import type { GlbPreviewResult } from "./GlbUploadPreview";
import {
  cabinetVariantCode,
  KITCHEN_MODULE_FAMILIES,
  type KitchenModuleFamily,
} from "@/lib/cabinetCodes";
import {
  CABINET_FAMILIES,
  cabinetFamily,
  KITCHEN_ASSET_GROUPS,
  KITCHEN_ASSET_TYPES,
  assetGroup,
  type KitchenAssetGroup,
  type KitchenAssetType,
  type KitchenAsset,
} from "@/lib/kitchenAssetCatalog";
import "./admin-kitchen-library.css";
import AdminKitchenAssemblyEditor, {
  PART_LABELS,
} from "./AdminKitchenAssemblyEditor";
import type { KitchenMaterialDefinition } from "@/lib/kitchenMaterials";
import { AdminKitchenCabinetSetup } from "./AdminKitchenCabinetSetup";
import {
  cabinetSetupAssembly,
  bindCabinetPart,
  bindFrontHandle,
  cabinetSetupProblem,
} from "@/lib/kitchenCabinetSetup";
import {
  getKitchenGlbAssembly,
  type KitchenGlbAssembly,
  type KitchenPartKind,
} from "@/lib/kitchenGlbAssembly";
const GlbUploadPreview = dynamic(() => import("./GlbUploadPreview"), {
  ssr: false,
});
const AdminKitchenFrontMotion = dynamic(
  () => import("./AdminKitchenFrontMotion"),
  { ssr: false },
);
import {
  parseKitchenFrontMotion,
  type KitchenFrontMotionMap,
} from "@/lib/kitchenFrontMotion";
import {
  type KitchenCatalogModule,
  type KitchenCatalogVariant,
  type KitchenModelCandidate,
  type KitchenOpening,
} from "@/lib/kitchenModuleCatalog";

const openingLabel: Record<KitchenOpening, string> = {
  doors: "Хаалга",
  drawers: "Шургуулга",
  open: "Ил тавиур",
  sink: "Угаалтуур",
  hob: "Плитка",
  oven: "Зуух",
  hood: "Сорох шүүгээ",
  refrigerator: "Хөргөгч",
};

type VariantPreset = {
  id: string;
  label: string;
  code: string;
  opening: KitchenOpening;
  doorCount: number;
  drawerCount: number;
  cabinetTypes: KitchenCatalogModule["cabinetType"][];
  widthMm?: number;
};

const VARIANT_PRESETS: VariantPreset[] = [
  {
    id: "door-1",
    label: "1 хаалгатай",
    code: "1-DOOR",
    opening: "doors",
    doorCount: 1,
    drawerCount: 0,
    cabinetTypes: ["base", "wall", "tall", "corner"],
  },
  {
    id: "door-2",
    label: "2 хаалгатай",
    code: "2-DOORS",
    opening: "doors",
    doorCount: 2,
    drawerCount: 0,
    cabinetTypes: ["base", "wall", "tall", "corner"],
  },
  {
    id: "door-1-drawer-1",
    label: "1 хаалга + 1 шургуулгатай",
    code: "1-DOOR-1-DRAWER",
    opening: "drawers",
    doorCount: 1,
    drawerCount: 1,
    cabinetTypes: ["base", "tall"],
  },
  {
    id: "drawers-2",
    label: "2 шургуулгатай",
    code: "2-DRAWERS",
    opening: "drawers",
    doorCount: 0,
    drawerCount: 2,
    cabinetTypes: ["base"],
  },
  {
    id: "drawers-3",
    label: "3 шургуулгатай",
    code: "3-DRAWERS",
    opening: "drawers",
    doorCount: 0,
    drawerCount: 3,
    cabinetTypes: ["base"],
  },
  {
    id: "drawers-4",
    label: "4 шургуулгатай",
    code: "4-DRAWERS",
    opening: "drawers",
    doorCount: 0,
    drawerCount: 4,
    cabinetTypes: ["base"],
  },
  {
    id: "open",
    label: "Задгай тавиур",
    code: "OPEN",
    opening: "open",
    doorCount: 0,
    drawerCount: 0,
    cabinetTypes: ["base", "wall", "tall", "corner"],
  },
  {
    id: "sink",
    label: "Угаалтуурын модуль",
    code: "SINK",
    opening: "sink",
    doorCount: 0,
    drawerCount: 0,
    cabinetTypes: ["base"],
  },
  {
    id: "hob",
    label: "Плитканы модуль",
    code: "HOB",
    opening: "hob",
    doorCount: 0,
    drawerCount: 0,
    cabinetTypes: ["base"],
  },
  {
    id: "oven",
    label: "Зуухны модуль",
    code: "OVEN",
    opening: "oven",
    doorCount: 0,
    drawerCount: 0,
    cabinetTypes: ["base", "tall"],
    widthMm: 600,
  },
  {
    id: "hood",
    label: "Утаа сорогчийн модуль",
    code: "HOOD",
    opening: "hood",
    doorCount: 0,
    drawerCount: 0,
    cabinetTypes: ["wall"],
  },
  {
    id: "refrigerator",
    label: "Хөргөгчийн модуль",
    code: "REFRIGERATOR",
    opening: "refrigerator",
    doorCount: 0,
    drawerCount: 0,
    cabinetTypes: ["tall"],
  },
];

const presetsFor = (module?: KitchenCatalogModule) =>
  !module
    ? VARIANT_PRESETS
    : VARIANT_PRESETS.filter(
        (preset) =>
          preset.cabinetTypes.includes(module.cabinetType) &&
          (preset.doorCount < 2 || module.widthMm >= 600) &&
          (!module.code.startsWith("CORNER-WALL-") ||
            ["doors", "open"].includes(preset.opening)) &&
          (preset.widthMm === undefined || preset.widthMm === module.widthMm),
      );
const variantLabel = (
  variant: Pick<KitchenCatalogVariant, "opening" | "doorCount" | "drawerCount">,
) =>
  variant.doorCount > 0 && variant.drawerCount > 0
    ? `${variant.doorCount} хаалга + ${variant.drawerCount} шургуулга`
    : variant.opening === "doors"
      ? `${variant.doorCount} хаалгатай`
      : variant.opening === "drawers"
        ? `${variant.drawerCount} шургуулгатай`
        : openingLabel[variant.opening];

export function AdminKitchenModules({ owner }: { owner: string }) {
  const draftScope = `admin:${owner}:kitchen-module`;
  const uploadScope = `admin:${owner}:kitchen-module-upload`;
  const [modules, setModules] = useState<KitchenCatalogModule[]>([]);
  const [models, setModels] = useState<KitchenModelCandidate[]>([]);
  const [materials, setMaterials] = useState<KitchenMaterialDefinition[]>([]);
  const [workspace, setWorkspace] = useState<"upload" | "link" | "library">(
    "upload",
  );
  const [group, setGroup] = useDraftState<KitchenAssetGroup>(
    uploadScope,
    "group",
    "cabinets",
  );
  const [assetType, setAssetType] = useDraftState<KitchenAssetType>(
    uploadScope,
    "assetType",
    "oven",
  );
  const [installation, setInstallation] = useDraftState<
    KitchenAsset["installation"]
  >(uploadScope, "installation", "freestanding");
  const [measuredSize, setMeasuredSize] = useState<{
    widthMm: number;
    heightMm: number;
    depthMm: number;
  } | null>(null);
  const [newModuleFamily, setNewModuleFamily] = useState<KitchenModuleFamily | "">("");
  const [creatingModule, setCreatingModule] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryGroup, setLibraryGroup] = useState("all");
  const [libraryStatus, setLibraryStatus] = useState("all");
  const [libraryWidth, setLibraryWidth] = useState("");
  const [pendingPart, setPendingPart] = useState<{
    slotId: string;
    kind: KitchenPartKind;
  } | null>(null);
  const [modelId, setModelId] = useDraftState(draftScope, "modelId", "");
  const [moduleId, setModuleId] = useDraftState(draftScope, "moduleId", "");
  const [presetId, setPresetId] = useDraftState(
    draftScope,
    "presetId",
    "door-1",
  );
  const [opening, setOpening] = useDraftState<KitchenOpening>(
    draftScope,
    "opening",
    "doors",
  );
  const [variantCode, setVariantCode] = useDraftState(
    draftScope,
    "variantCode",
    "",
  );
  const [designCode, setDesignCode] = useDraftState(
    draftScope,
    "designCode",
    "",
  );
  const [doorCount, setDoorCount] = useDraftState(draftScope, "doorCount", 1);
  const [drawerCount, setDrawerCount] = useDraftState(
    draftScope,
    "drawerCount",
    0,
  );
  const [isDefault, setIsDefault] = useDraftState(
    draftScope,
    "isDefault",
    false,
  );
  const [assembly, setAssembly] = useDraftState<KitchenGlbAssembly | null>(
    draftScope,
    "assembly",
    null,
  );
  const [frontMotion, setFrontMotion] = useDraftState<KitchenFrontMotionMap>(
    draftScope,
    "frontMotion",
    {},
  );
  const [assemblyMode, setAssemblyMode] = useDraftState<"parts" | "authored">(
    draftScope,
    "assemblyMode",
    "parts",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadName, setUploadName] = useDraftState(
    uploadScope,
    "uploadName",
    "",
  );
  const [uploadModuleId, setUploadModuleId] = useDraftState(
    uploadScope,
    "uploadModuleId",
    "",
  );
  const [uploadPartKind, setUploadPartKind] = useDraftState<
    KitchenPartKind | ""
  >(uploadScope, "uploadPartKind", "");
  const [authoredNodes, setAuthoredNodes] = useDraftState(
    uploadScope,
    "authoredNodes",
    false,
  );
  const [partSize, setPartSize] = useDraftState(uploadScope, "partSize", {
    widthMm: 300,
    heightMm: 740,
    depthMm: 18,
  });
  const [uploadGlb, setUploadGlb] = useDraftState<File | null>(
    uploadScope,
    "uploadGlb",
    null,
  );
  const [preview, setPreview] = useState<GlbPreviewResult | null>(null);
  const [uploadThumbnail, setUploadThumbnail] = useDraftState<File | null>(
    uploadScope,
    "uploadThumbnail",
    null,
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const draftStatus = useDraftStatus(draftScope);
  const uploadStatus = useDraftStatus(uploadScope);
  const glbInput = useRef<HTMLInputElement>(null);
  const thumbnailInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await authFetch(
        "/api/admin/kitchen-modules",
        undefined,
        owner,
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data)
        throw new Error(data?.error ?? "Catalog ачаалж чадсангүй.");
      setModules(data.modules);
      setModels(data.models);
      setMaterials(data.materials ?? []);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Catalog ачаалж чадсангүй.",
      );
    }
  }, [owner]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (
      !models.some(
        (model) =>
          !model.archivedAt &&
          ["queued", "processing"].includes(model.processingStatus),
      )
    )
      return;
    const timer = setTimeout(() => void load(), 3000);
    return () => clearTimeout(timer);
  }, [models, load]);

  const selectedModel = models.find((model) => model.id === modelId);
  const matchingModules = useMemo(
    () =>
      selectedModel
        ? modules.filter(
            (module) =>
              (selectedModel.moduleCode
                ? module.code === selectedModel.moduleCode
                : true) &&
              Math.abs(module.widthMm - selectedModel.widthMm) <= 5 &&
              Math.abs(module.heightMm - selectedModel.heightMm) <= 5 &&
              Math.abs(module.depthMm - selectedModel.depthMm) <= 5,
          )
        : modules,
    [modules, selectedModel],
  );
  const selectedModule = modules.find((module) => module.id === moduleId);
  // Cabinet modules are matched from the measured GLB instead of picked by hand.
  // Depth may include up to 100 mm of handle projection.
  const sizeMatchedModules = useMemo(
    () =>
      measuredSize
        ? modules
            .filter(
              (module) =>
                module.active &&
                Math.abs(module.widthMm - measuredSize.widthMm) <= 5 &&
                Math.abs(module.heightMm - measuredSize.heightMm) <= 5 &&
                measuredSize.depthMm >= module.depthMm - 5 &&
                measuredSize.depthMm <= module.depthMm + 105,
            )
            .sort(
              (a, b) =>
                Math.abs(a.depthMm - measuredSize.depthMm) -
                Math.abs(b.depthMm - measuredSize.depthMm),
            )
        : [],
    [modules, measuredSize],
  );
  const uploadModule = sizeMatchedModules.find(
    (module) => module.id === uploadModuleId,
  );
  const guessedModuleFamily: KitchenModuleFamily = !measuredSize
    ? "base"
    : measuredSize.heightMm >= 1400
      ? "tall"
      : measuredSize.depthMm <= 450
        ? "wall"
        : measuredSize.depthMm > 750
          ? "island"
          : "base";
  const moduleFamily = newModuleFamily || guessedModuleFamily;

  async function createMeasuredModule() {
    if (!measuredSize || creatingModule) return;
    setCreatingModule(true);
    setUploadError(null);
    try {
      const response = await authFetch(
        "/api/admin/kitchen-modules",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            family: moduleFamily,
            widthMm: Math.round(measuredSize.widthMm),
            heightMm: Math.round(measuredSize.heightMm),
            depthMm: Math.round(measuredSize.depthMm),
          }),
        },
        owner,
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.module)
        throw new Error(data?.error ?? "Module үүсгэж чадсангүй.");
      await load();
      setUploadModuleId(data.module.id);
    } catch (reason) {
      setUploadError(
        reason instanceof Error ? reason.message : "Module үүсгэж чадсангүй.",
      );
    } finally {
      setCreatingModule(false);
    }
  }
  const upperCabinet = selectedModule?.cabinetType === "wall";
  const setupAssembly = useMemo(
    () =>
      cabinetSetupAssembly(
        assembly,
        doorCount,
        drawerCount,
        selectedModule ??
          selectedModel ?? { widthMm: 600, heightMm: 840, depthMm: 600 },
      ),
    [assembly, doorCount, drawerCount, selectedModule, selectedModel],
  );
  const assetDefinition = KITCHEN_ASSET_TYPES[assetType];
  const isAsset = group !== "cabinets" && group !== "parts";
  const filteredModels = models.filter(
    (model) =>
      (!libraryWidth || model.widthMm === Number(libraryWidth)) &&
      (libraryStatus === "all" ||
        (libraryStatus === "ready"
          ? model.glbReady
          : libraryStatus === "archived"
            ? Boolean(model.archivedAt)
            : libraryStatus === "processing"
              ? ["queued", "processing", "idle"].includes(
                  model.processingStatus,
                )
              : model.processingStatus === "error")) &&
      (libraryGroup === "all" ||
        (model.asset
          ? assetGroup(model.asset)
          : model.partKind
            ? "parts"
            : "cabinets") === libraryGroup) &&
      `${model.name} ${model.moduleCode ?? ""}`
        .toLocaleLowerCase()
        .includes(libraryQuery.trim().toLocaleLowerCase()),
  );
  function chooseGroup(value: KitchenAssetGroup) {
    setGroup(value);
    setPreview(null);
    if (value === "cabinets") {
      setUploadPartKind("");
      return;
    }
    if (value === "parts") {
      setUploadPartKind("door");
      return;
    }
    const entry = Object.entries(KITCHEN_ASSET_TYPES).find(
      ([, definition]) => definition.group === value,
    )!;
    setAssetType(entry[0] as KitchenAssetType);
    setUploadPartKind(entry[1].partKind);
    setInstallation(
      entry[1].placement === "cabinet" ? "integrated" : "freestanding",
    );
  }
  const uploadSize = uploadPartKind
    ? partSize
    : {
        widthMm: uploadModule?.widthMm ?? 0,
        heightMm: uploadModule?.heightMm ?? 0,
        depthMm: uploadModule?.depthMm ?? 0,
      };
  const availablePresets = useMemo(
    () => presetsFor(selectedModule),
    [selectedModule],
  );

  useEffect(() => {
    if (uploadStatus.loading || uploadPartKind) return;
    if (!sizeMatchedModules.some((module) => module.id === uploadModuleId))
      setUploadModuleId(sizeMatchedModules[0]?.id ?? "");
  }, [
    sizeMatchedModules,
    uploadModuleId,
    uploadPartKind,
    setUploadModuleId,
    uploadStatus.loading,
  ]);
  useEffect(() => {
    if (draftStatus.loading) return;
    if (
      selectedModel &&
      !matchingModules.some((module) => module.id === moduleId)
    )
      setModuleId(matchingModules[0]?.id ?? "");
  }, [
    matchingModules,
    moduleId,
    selectedModel,
    setModuleId,
    draftStatus.loading,
  ]);
  useEffect(() => {
    if (!selectedModule || draftStatus.loading) return;
    const preset =
      availablePresets.find((item) => item.id === presetId) ??
      availablePresets[0];
    if (!preset) return;
    if (preset.id !== presetId) setPresetId(preset.id);
    setOpening(preset.opening);
    setDoorCount(preset.doorCount);
    setDrawerCount(preset.drawerCount);
    try {
      setVariantCode(
        cabinetVariantCode(
          selectedModule.code,
          preset.opening,
          preset.doorCount,
          preset.drawerCount,
          designCode,
        ),
      );
    } catch {
      setVariantCode("");
    }
  }, [
    availablePresets,
    presetId,
    selectedModule,
    designCode,
    draftStatus.loading,
    setPresetId,
    setOpening,
    setDoorCount,
    setDrawerCount,
    setVariantCode,
  ]);

  function choosePreset(value: string) {
    const preset = availablePresets.find((item) => item.id === value);
    if (!preset) return;
    setPresetId(preset.id);
    setOpening(preset.opening);
    setDoorCount(preset.doorCount);
    setDrawerCount(preset.drawerCount);
    if (selectedModule) {
      try {
        setVariantCode(
          cabinetVariantCode(
            selectedModule.code,
            preset.opening,
            preset.doorCount,
            preset.drawerCount,
            designCode,
          ),
        );
      } catch {
        setVariantCode("");
      }
    }
  }

  function uploadSetupPart(slotId: string, kind: KitchenPartKind) {
    let next = setupAssembly;
    // The handle slot must exist before upload so the finished GLB binds to it.
    if (kind === "handle" && !next.slots.some((slot) => slot.id === slotId))
      next = bindFrontHandle(
        next,
        slotId.slice("handle-".length),
        undefined,
        upperCabinet,
      );
    setAssembly(next);
    setPendingPart({ slotId, kind });
    chooseGroup("parts");
    setUploadPartKind(kind);
    setUploadName(
      `${selectedModel?.name ?? "Шүүгээ"} · ${next.slots.find((slot) => slot.id === slotId)?.label ?? PART_LABELS[kind]}`,
    );
    setUploadGlb(null);
    setMeasuredSize(null);
    setPreview(null);
    setUploadThumbnail(null);
    setWorkspace("upload");
  }

  function cancelPartUpload() {
    if (uploading) return;
    if (pendingPart)
      setAssembly((current) =>
        current
          ? {
              ...current,
              slots: current.slots.filter(
                (slot) =>
                  slot.id !== pendingPart.slotId ||
                  slot.kind !== "handle" ||
                  slot.options.some((option) => option.modelId),
              ),
            }
          : current,
      );
    setPendingPart(null);
  }

  function chooseCabinet(id: string) {
    cancelPartUpload();
    const linked = modules
      .flatMap((module) =>
        module.variants.map((variant) => ({ module, variant })),
      )
      .find((item) => item.variant.furnitureModelId === id);
    setModelId(id);
    setAssembly(
      linked ? getKitchenGlbAssembly(linked.variant.configuration) : null,
    );
    setFrontMotion(
      (linked &&
        parseKitchenFrontMotion(linked.variant.configuration.frontMotion)) ||
        {},
    );
    setAssemblyMode(
      linked?.variant.configuration.assemblyMode === "parts"
        ? "parts"
        : linked
          ? "authored"
          : "parts",
    );
    if (linked) {
      setModuleId(linked.module.id);
      setDesignCode(String(linked.variant.configuration.designCode ?? ""));
      setIsDefault(linked.variant.isDefault);
      const preset = VARIANT_PRESETS.find(
        (item) =>
          item.opening === linked.variant.opening &&
          item.doorCount === linked.variant.doorCount &&
          item.drawerCount === linked.variant.drawerCount,
      );
      if (preset) setPresetId(preset.id);
    }
    setWorkspace("link");
  }

  async function uploadModel(event: React.FormEvent) {
    event.preventDefault();
    if (uploading || uploadStatus.loading) return;
    setUploadError(null);
    setUploadSuccess(null);
    if (
      (!uploadPartKind && !uploadModule) ||
      !uploadGlb ||
      !uploadName.trim()
    ) {
      setUploadError(
        uploadGlb && !uploadPartKind && !uploadModule
          ? "GLB-ийн хэмжээнд тохирох шүүгээний module олдсонгүй."
          : "Загварын нэр болон GLB файлыг оруулна уу.",
      );
      return;
    }
    if (!preview || preview.file !== uploadGlb || !preview.frontConfirmed) {
      setUploadError(
        "GLB preview шалгалт болон нүүрэн талын баталгаажуулалт шаардлагатай.",
      );
      return;
    }
    if (
      !uploadGlb.name.toLowerCase().endsWith(".glb") ||
      uploadGlb.size < 12 ||
      uploadGlb.size > 200 * 1024 * 1024
    ) {
      setUploadError("200 MB-аас ихгүй GLB файл сонгоно уу.");
      return;
    }
    if (
      uploadThumbnail &&
      (!["image/jpeg", "image/png", "image/webp"].includes(
        uploadThumbnail.type,
      ) ||
        uploadThumbnail.size > 10 * 1024 * 1024)
    ) {
      setUploadError(
        "Thumbnail нь JPG, PNG эсвэл WebP, 10 MB-аас ихгүй байна.",
      );
      return;
    }

    setUploading(true);
    try {
      const form = new FormData();
      form.set("name", uploadName.trim());
      form.set("category", "kitchen-cabinet");
      form.set("cabinetModuleId", uploadPartKind ? "" : uploadModule!.id);
      form.set("kitchenPartKind", uploadPartKind);
      if (isAsset)
        form.set(
          "kitchenAsset",
          JSON.stringify({ version: 1, type: assetType, installation }),
        );
      form.set("authoredNodes", String(authoredNodes));
      form.set(
        "description",
        uploadPartKind
          ? `${PART_LABELS[uploadPartKind]} GLB`
          : `${uploadModule!.code} kitchen module GLB`,
      );
      form.set("basePrice", "0");
      form.set("stockQuantity", "0");
      form.set("scale", "1");
      form.set("dimensionsW", String(uploadSize.widthMm / 1000));
      form.set("dimensionsD", String(uploadSize.depthMm / 1000));
      form.set("dimensionsH", String(uploadSize.heightMm / 1000));
      form.set(
        "colors",
        JSON.stringify([
          {
            id: "kitchen_default",
            name: "Үндсэн өнгө",
            hex: "#C9A37A",
            priceDelta: 0,
          },
        ]),
      );
      form.set(
        "materials",
        JSON.stringify([{ id: "wood", name: "Мод", priceDelta: 0 }]),
      );
      form.set("thumbnail", uploadThumbnail ?? preview.thumbnail);

      const createResponse = await authFetch(
        "/api/models/upload",
        { method: "POST", body: form },
        owner,
      );
      const model = await createResponse.json().catch(() => null);
      if (!createResponse.ok || typeof model?.id !== "string")
        throw new Error(
          model?.error ?? "Kitchen GLB мэдээлэл хадгалж чадсангүй.",
        );

      const prepareResponse = await authFetch(
        "/api/admin/models/upload-url",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelId: model.id,
            fileName: uploadGlb.name,
            size: uploadGlb.size,
          }),
        },
        owner,
      );
      const prepared = await prepareResponse.json().catch(() => null);
      if (
        !prepareResponse.ok ||
        typeof prepared?.uploadUrl !== "string" ||
        typeof prepared?.sourcePath !== "string"
      ) {
        throw new Error(
          prepared?.error ?? "GLB upload холбоос үүсгэж чадсангүй.",
        );
      }

      const r2Response = await fetch(prepared.uploadUrl, {
        method: "PUT",
        headers: { "Content-Type": "model/gltf-binary" },
        body: uploadGlb,
      });
      if (!r2Response.ok)
        throw new Error(
          `GLB файл upload хийж чадсангүй (${r2Response.status}).`,
        );

      const completeResponse = await authFetch(
        "/api/admin/models/upload-complete",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelId: model.id,
            sourcePath: prepared.sourcePath,
            frontConfirmed: preview.frontConfirmed,
            frontProjectionMm: preview.report.frontProjectionMm,
          }),
        },
        owner,
      );
      const completed = await completeResponse.json().catch(() => null);
      if (!completeResponse.ok)
        throw new Error(
          completed?.error ?? "GLB боловсруулалтыг эхлүүлж чадсангүй.",
        );

      void clearDashboardDraft(uploadScope);
      const uploadedModelId = model.id as string;
      const uploadedModuleId = uploadPartKind ? "" : uploadModule!.id;
      const wasPart = Boolean(uploadPartKind);
      setUploadName("");
      setUploadModuleId("");
      setUploadGlb(null);
      setMeasuredSize(null);
      setUploadThumbnail(null);
      if (glbInput.current) glbInput.current.value = "";
      if (thumbnailInput.current) thumbnailInput.current.value = "";
      setUploadSuccess(
        wasPart
          ? "GLB орууллаа. Боловсруулалт дуусмагц гал тогооны санд харагдана. Суурилуулдаг хэрэгслийг «Шүүгээнд холбох» хэсгээр холбоно."
          : "GLB орууллаа. Боловсруулалт дуусмагц хийцээ сонгоод угсралтаа хадгална уу.",
      );
      await load();
      if (!wasPart) {
        setModelId(uploadedModelId);
        setModuleId(uploadedModuleId);
        setAssembly(null);
        setFrontMotion({});
        setAssemblyMode("parts");
        setWorkspace("link");
      } else if (pendingPart) {
        const candidate: KitchenModelCandidate = {
          id: uploadedModelId,
          productId: uploadedModelId,
          name: uploadName.trim(),
          partKind: uploadPartKind || null,
          widthMm: uploadSize.widthMm,
          heightMm: uploadSize.heightMm,
          depthMm: uploadSize.depthMm,
          glbReady: false,
          processingStatus: "queued",
          linked: false,
          moduleCode: null,
        };
        setAssembly((current) =>
          bindCabinetPart(
            current ?? setupAssembly,
            pendingPart.slotId,
            candidate,
          ),
        );
        setPendingPart(null);
        setWorkspace("link");
      }
    } catch (reason) {
      setUploadError(
        reason instanceof Error
          ? reason.message
          : "Kitchen GLB upload хийж чадсангүй.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (busy || draftStatus.loading) return;
    if (assemblyMode === "parts") {
      const problem = cabinetSetupProblem(setupAssembly, models);
      if (problem) {
        setError(problem);
        return;
      }
    }
    setBusy("save");
    setError(null);
    try {
      const response = await authFetch(
        "/api/admin/kitchen-modules",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            modelId,
            moduleId,
            opening,
            variantCode,
            designCode,
            doorCount,
            drawerCount,
            isDefault,
            assembly:
              assemblyMode === "parts"
                ? setupAssembly
                : assembly?.slots.length
                  ? assembly
                  : null,
            frontMotion:
              assemblyMode === "authored" && !assembly?.slots.length
                ? frontMotion
                : undefined,
            assemblyMode,
            sortOrder: 0,
          }),
        },
        owner,
      );
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(data?.error ?? "Variant хадгалж чадсангүй.");
      void clearDashboardDraft(draftScope);
      setModelId("");
      setModuleId("");
      setVariantCode("");
      setDesignCode("");
      setIsDefault(false);
      setAssembly(null);
      setFrontMotion({});
      setAssemblyMode("parts");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Variant хадгалж чадсангүй.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function setActive(model: string, active: boolean) {
    setBusy(model);
    setError(null);
    try {
      const response = await authFetch(
        "/api/admin/kitchen-modules",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId: model, active }),
        },
        owner,
      );
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(data?.error ?? "Төлөв өөрчилж чадсангүй.");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Төлөв өөрчилж чадсангүй.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function restoreModel(id: string) {
    setBusy(`delete:${id}`);
    setError(null);
    try {
      const response = await authFetch(
        `/api/models/${id}?domain=kitchen`,
        { method: "PATCH" },
        owner,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Сэргээж чадсангүй.");
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Сэргээж чадсангүй.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteModel(model: KitchenModelCandidate) {
    if (
      !window.confirm(
        `“${model.name}” kitchen GLB-г архивлах уу? Файл, variant хэвээр хадгалагдана; дараа нь сэргээж болно.`,
      )
    )
      return;
    setBusy(`delete:${model.id}`);
    setError(null);
    setUploadSuccess(null);
    try {
      const response = await authFetch(
        "/api/admin/kitchen-modules",
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId: model.id }),
        },
        owner,
      );
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(data?.error ?? "Kitchen GLB устгаж чадсангүй.");
      if (modelId === model.id) {
        setModelId("");
        setModuleId("");
      }
      setUploadSuccess(
        "Kitchen GLB архивлагдлаа. Файл, variant хэвээр хадгалагдана.",
      );
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Kitchen GLB устгаж чадсангүй.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="ak-library-header">
        <div>
          <span className="admin-eyebrow">ГАЛ ТОГООНЫ ТУСДАА САН</span>
          <h2>Гал тогооны 3D хэрэгслүүд</h2>
          <p>
            Шүүгээ, төхөөрөмж, гэрэл болон дагалдах хэрэгслээ энд удирдана. Өрөө
            төлөвлөгчийн санд орохгүй.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => void load()}>
          <RefreshCw size={15} />
          Шинэчлэх
        </button>
      </div>
      <nav className="ak-workspace-tabs" aria-label="Гал тогооны GLB удирдлага">
        {(
          [
            ["upload", "GLB нэмэх"],
            ["library", `Загварын сан (${models.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-pressed={
              workspace === id || (id === "upload" && workspace === "link")
            }
            disabled={uploading}
            onClick={() => {
              if (id !== "upload") cancelPartUpload();
              setWorkspace(id);
            }}
          >
            {label}
          </button>
        ))}
      </nav>
      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {uploadSuccess && (
        <p className="ak-success" role="status">
          <CheckCircle size={16} />
          {uploadSuccess}
        </p>
      )}
      {pendingPart && workspace === "upload" && (
        <div className="ak-setup-actions" role="status">
          <span>Угсралтад {PART_LABELS[pendingPart.kind]} нэмэх</span>
          <button
            type="button"
            className="btn-ghost"
            disabled={uploading}
            onClick={() => {
              cancelPartUpload();
              setWorkspace("link");
            }}
          >
            Угсралт руу буцах
          </button>
        </div>
      )}
      <section
        hidden={workspace !== "upload"}
        className="space-y-4 rounded-2xl border border-black/10 bg-white p-5"
      >
        <div>
          <span className="admin-eyebrow">KITCHEN GLB UPLOAD</span>
          <h2 className="mt-1 text-lg font-semibold">Гал тогооны GLB нэмэх</h2>
          <p className="text-sm text-black/55">
            Ангиллаа сонгоод GLB файлаа оруулна. Нэр, хэмжээ, module болон
            thumbnail-ийг GLB-ээс автоматаар бөглөнө.
          </p>
        </div>
        <DashboardDraftNotice
          scope={uploadScope}
          disabled={uploading}
          files={[uploadGlb, uploadThumbnail]}
        />
        <div
          className="ak-category-grid"
          role="group"
          aria-label="Гал тогооны үндсэн ангилал"
        >
          {Object.entries(KITCHEN_ASSET_GROUPS).map(([id, label]) => (
            <button
              type="button"
              key={id}
              disabled={uploading}
              aria-pressed={group === id}
              onClick={() => chooseGroup(id as KitchenAssetGroup)}
            >
              <Box size={18} />
              <strong>{label}</strong>
              <small>
                {id === "cabinets"
                  ? "Их бие, бүтэн шүүгээ"
                  : id === "parts"
                    ? "Хаалга, бариул, тавцан"
                    : "Төрлөө сонгоод GLB нэмнэ"}
              </small>
            </button>
          ))}
        </div>
        <form
          inert={uploadStatus.loading || undefined}
          onSubmit={uploadModel}
          className="grid gap-3 rounded-xl bg-black/[0.03] p-4 md:grid-cols-2 xl:grid-cols-4"
        >
          <fieldset disabled={uploading} className="contents">
            <label className="label md:col-span-2">
              GLB файл
              <input
                ref={glbInput}
                key={
                  uploadGlb
                    ? `${uploadGlb.name}:${uploadGlb.lastModified}`
                    : "empty-glb"
                }
                className="input mt-1 w-full !py-2 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1 file:text-xs"
                type="file"
                accept=".glb,model/gltf-binary"
                required={!uploadGlb}
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  setUploadGlb(file);
                  setMeasuredSize(null);
                  if (file && !uploadName.trim())
                    setUploadName(file.name.replace(/\.glb$/i, ""));
                }}
              />
              {uploadGlb ? (
                <span className="mt-1 flex items-center justify-between gap-2 text-xs">
                  <span className="truncate">
                    {uploadGlb.name} ·{" "}
                    {(uploadGlb.size / 1048576).toFixed(2)} MB
                  </span>
                  <button
                    type="button"
                    className="btn-ghost !min-h-8 !px-2 text-red-600"
                    onClick={() => {
                      if (
                        uploadName === uploadGlb.name.replace(/\.glb$/i, "")
                      )
                        setUploadName("");
                      setUploadGlb(null);
                      setMeasuredSize(null);
                      setPreview(null);
                      setUploadError(null);
                      if (glbInput.current) glbInput.current.value = "";
                    }}
                  >
                    <Trash2 size={13} />
                    Хасах
                  </button>
                </span>
              ) : (
                <small className="mt-1 block text-black/45">
                  200 MB хүртэл
                </small>
              )}
            </label>
            <label className="label md:col-span-2">
              Загварын нэр
              <input
                className="input mt-1 w-full"
                required
                maxLength={160}
                placeholder={
                  isAsset ? assetDefinition.label : "Ж: 600мм 3 шургуулгатай"
                }
                value={uploadName}
                onChange={(event) => setUploadName(event.target.value)}
              />
            </label>
            {isAsset && (
              <>
                <label className="label">
                  Хэрэгслийн төрөл
                  <select
                    className="input mt-1 w-full"
                    value={assetType}
                    onChange={(event) => {
                      const type = event.target.value as KitchenAssetType;
                      setAssetType(type);
                      setUploadPartKind(KITCHEN_ASSET_TYPES[type].partKind);
                      setInstallation(
                        KITCHEN_ASSET_TYPES[type].placement === "cabinet"
                          ? "integrated"
                          : "freestanding",
                      );
                    }}
                  >
                    {Object.entries(KITCHEN_ASSET_TYPES)
                      .filter(([, definition]) => definition.group === group)
                      .map(([id, definition]) => (
                        <option key={id} value={id}>
                          {definition.label}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="label">
                  Суурилуулах хэлбэр
                  <select
                    className="input mt-1 w-full"
                    value={installation}
                    onChange={(event) =>
                      setInstallation(
                        event.target.value as KitchenAsset["installation"],
                      )
                    }
                  >
                    <option value="freestanding">
                      Бие даасан / тусад нь байрлуулах
                    </option>
                    <option value="integrated">
                      Шүүгээнд суурилуулах / солих
                    </option>
                  </select>
                </label>
              </>
            )}
            {group === "parts" && (
              <label className="label">
                Эд ангийн төрөл
                <select
                  className="input mt-1 w-full"
                  value={uploadPartKind}
                  onChange={(event) =>
                    setUploadPartKind(
                      event.target.value as KitchenPartKind | "",
                    )
                  }
                >
                  {Object.entries(PART_LABELS).map(([kind, label]) => (
                    <option key={kind} value={kind}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!uploadPartKind && uploadGlb && measuredSize && (
              <div className="md:col-span-2 xl:col-span-4">
                {sizeMatchedModules.length > 1 ? (
                  <label className="label">
                    Тохирох module
                    <select
                      className="input mt-1 w-full"
                      required
                      value={uploadModuleId}
                      onChange={(event) =>
                        setUploadModuleId(event.target.value)
                      }
                    >
                      {sizeMatchedModules.map((module) => (
                        <option key={module.id} value={module.id}>
                          {CABINET_FAMILIES[
                            cabinetFamily(
                              module.code,
                            ) as keyof typeof CABINET_FAMILIES
                          ] ?? module.code}{" "}
                          · {module.name} · {module.widthMm}×{module.heightMm}×
                          {module.depthMm} мм
                        </option>
                      ))}
                    </select>
                  </label>
                ) : uploadModule ? (
                  <p className="ak-help">
                    <strong>Module:</strong> {uploadModule.name} ·{" "}
                    {uploadModule.widthMm}×{uploadModule.heightMm}×
                    {uploadModule.depthMm} мм
                  </p>
                ) : (
                  <div className="grid gap-2">
                    <p className="text-sm text-red-600" role="alert">
                      {Math.round(measuredSize.widthMm)}×
                      {Math.round(measuredSize.heightMm)}×
                      {Math.round(measuredSize.depthMm)} мм хэмжээтэй шүүгээний
                      module бүртгэлгүй байна. Төрлийг сонгоод энэ хэмжээгээр
                      шинэ module үүсгэнэ үү.
                    </p>
                    <div className="flex flex-wrap items-end gap-2">
                      <label className="label">
                        Module-ийн төрөл
                        <select
                          className="input mt-1"
                          value={moduleFamily}
                          onChange={(event) =>
                            setNewModuleFamily(
                              event.target.value as KitchenModuleFamily,
                            )
                          }
                        >
                          {Object.entries(KITCHEN_MODULE_FAMILIES).map(
                            ([family, spec]) => (
                              <option key={family} value={family}>
                                {spec.label} · {spec.range.h.join("–")} мм өндөр
                              </option>
                            ),
                          )}
                        </select>
                      </label>
                      <button
                        type="button"
                        className="btn-secondary"
                        disabled={creatingModule}
                        onClick={() => void createMeasuredModule()}
                      >
                        {creatingModule ? "Үүсгэж байна…" : "Module үүсгэх"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
            <details className="ak-help md:col-span-2 xl:col-span-4">
              <summary>Нэмэлт тохиргоо (сонголттой)</summary>
              <div className="grid gap-3 pt-3 md:grid-cols-2 xl:grid-cols-4">
                {uploadPartKind ? (
                  (["widthMm", "heightMm", "depthMm"] as const).map((key, i) => (
                    <label key={key} className="label">
                      {["Өргөн", "Өндөр", "Гүн"][i]} · мм
                      <input
                        type="number"
                        className="input mt-1 w-full"
                        min={1}
                        max={4000}
                        step={1}
                        required
                        value={partSize[key]}
                        onChange={(event) =>
                          setPartSize({
                            ...partSize,
                            [key]: Number(event.target.value),
                          })
                        }
                      />
                    </label>
                  ))
                ) : (
                  <label className="flex items-center gap-2 md:col-span-2">
                    <input
                      type="checkbox"
                      checked={authoredNodes}
                      onChange={(event) =>
                        setAuthoredNodes(event.target.checked)
                      }
                    />
                    Хаалга, бариул холбох нэртэй node / anchor агуулсан GLB
                  </label>
                )}
                <label className="label md:col-span-2">
                  Өөр thumbnail зураг
                  <input
                    ref={thumbnailInput}
                    key={
                      uploadThumbnail
                        ? `${uploadThumbnail.name}:${uploadThumbnail.lastModified}`
                        : "empty-thumbnail"
                    }
                    className="input mt-1 w-full !py-2 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1 file:text-xs"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(event) =>
                      setUploadThumbnail(event.target.files?.[0] ?? null)
                    }
                  />
                  <small className="mt-1 block text-black/45">
                    JPG, PNG, WebP · 10 MB хүртэл
                  </small>
                </label>
              </div>
            </details>
            <GlbUploadPreview
              onMeasure={(size) => {
                setMeasuredSize(size);
                if (uploadPartKind)
                  setPartSize({
                    widthMm: Math.max(1, Math.round(size.widthMm)),
                    heightMm: Math.max(1, Math.round(size.heightMm)),
                    depthMm: Math.max(1, Math.round(size.depthMm)),
                  });
              }}
              allowFrontProjection={!uploadPartKind}
              assetRole={
                uploadPartKind
                  ? "kitchen-part"
                  : authoredNodes
                    ? "kitchen-assembly"
                    : "furniture"
              }
              file={uploadGlb}
              expected={uploadSize}
              onChange={setPreview}
              onFix={setUploadGlb}
            />
            <button
              className="btn-primary"
              disabled={
                uploading ||
                !uploadName.trim() ||
                (!uploadPartKind && !uploadModule) ||
                !uploadGlb ||
                !preview ||
                preview.file !== uploadGlb
              }
            >
              {uploading ? (
                <LoaderCircle size={15} className="animate-spin" />
              ) : (
                <Upload size={15} />
              )}
              {uploading ? "Оруулж байна…" : "GLB нэмэх"}
            </button>
          </fieldset>
        </form>
        {uploadError && (
          <p className="admin-error" role="alert">
            {uploadError}
          </p>
        )}
      </section>
      <section
        hidden={workspace === "upload"}
        className="space-y-4 rounded-2xl border border-black/10 bg-white p-5"
      >
        {workspace === "link" && (
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="admin-eyebrow">ШҮҮГЭЭНД ХОЛБОХ</span>
              <h2 className="mt-1 text-lg font-semibold">
                Шүүгээний хийц ба солих эд анги
              </h2>
              <p className="text-sm text-black/55">
                Боловсруулалт нь дууссан GLB-г хаалга, шургуулга зэрэг
                хувилбартай нь холбоно.
              </p>
            </div>
            <button
              type="button"
              className="btn-ghost"
              onClick={() => setWorkspace("library")}
            >
              Сан руу буцах
            </button>
          </div>
        )}
        {workspace === "link" && (
          <>
            <DashboardDraftNotice scope={draftScope} disabled={Boolean(busy)} />
            <form
              inert={draftStatus.loading || undefined}
              onSubmit={save}
              className="grid gap-3 rounded-xl bg-black/[0.03] p-4 md:grid-cols-2 xl:grid-cols-4"
            >
              <label className="label">
                1. Их биеийн GLB
                <select
                  className="input mt-1 w-full"
                  required
                  value={modelId}
                  onChange={(event) => {
                    chooseCabinet(event.target.value);
                  }}
                >
                  <option value="">Сонгоно уу</option>
                  {models
                    .filter(
                      (model) =>
                        !model.partKind && !model.asset && !model.archivedAt,
                    )
                    .map((model) => (
                      <option
                        key={model.id}
                        value={model.id}
                        disabled={!model.glbReady}
                      >
                        {model.name} ·{" "}
                        {model.moduleCode ?? "module тодорхойгүй"} ·{" "}
                        {model.widthMm}×{model.heightMm}×{model.depthMm}{" "}
                        {model.linked ? "· холбоотой" : ""}
                        {!model.glbReady ? " · GLB бэлэн биш" : ""}
                      </option>
                    ))}
                </select>
              </label>
              {matchingModules.length > 1 && (
                <label className="label">
                  Module
                  <select
                    className="input mt-1 w-full"
                    required
                    value={moduleId}
                    onChange={(event) => setModuleId(event.target.value)}
                  >
                    <option value="">Сонгоно уу</option>
                    {matchingModules.map((module) => (
                      <option key={module.id} value={module.id}>
                        {module.code} · {module.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label className="label">
                Хийцийн хувилбар
                <select
                  className="input mt-1 w-full"
                  value={presetId}
                  onChange={(event) => choosePreset(event.target.value)}
                >
                  {availablePresets.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </label>
              {selectedModel && (
                <section className="ak-setup-mode md:col-span-2 xl:col-span-4">
                  <label className="label">
                    Загварын бэлтгэл
                    <select
                      className="input"
                      value={assemblyMode}
                      onChange={(event) =>
                        setAssemblyMode(
                          event.target.value as "parts" | "authored",
                        )
                      }
                    >
                      <option value="parts">
                        Их бие + тусдаа хаалга / шургуулга
                      </option>
                      <option value="authored">
                        Бүтэн угсарсан GLB / нарийвчилсан тохиргоо
                      </option>
                    </select>
                  </label>
                  <p className="ak-help">
                    Гал тогооны загвар ердийн барааны каталогт орохгүй.{" "}
                    {assemblyMode === "parts"
                      ? `${doorCount} хаалга, ${drawerCount} шургуулгын GLB холбоод угсралтаа шалгана.`
                      : "GLB дотроо хаалгатай бол давхар эд анги нэмэхгүй."}
                  </p>
                </section>
              )}
              {selectedModel && assemblyMode === "parts" && (
                <div className="md:col-span-2 xl:col-span-4">
                  <AdminKitchenCabinetSetup
                    key={modelId}
                    assembly={setupAssembly}
                    onChange={setAssembly}
                    models={models}
                    baseModel={selectedModel}
                    materials={materials}
                    onUpload={uploadSetupPart}
                    upper={upperCabinet}
                  />
                </div>
              )}
              <details className="md:col-span-2 xl:col-span-4">
                <summary>
                  Нэмэлт тохиргоо · хийцийн код, үндсэн хувилбар
                </summary>
                <div className="grid gap-3 pt-3 md:grid-cols-2 xl:grid-cols-4">
                  <label className="label">
                    Хийцийн код · автоматаар үүснэ
                    <input
                      className="input mt-1 w-full"
                      required
                      maxLength={80}
                      value={variantCode}
                      readOnly
                    />
                  </label>
                  <label className="label">
                    Хийцийн ялгах code (сонголттой)
                    <input
                      className="input mt-1 w-full"
                      value={designCode}
                      onChange={(event) =>
                        setDesignCode(event.target.value.toUpperCase())
                      }
                      placeholder="Ж: TOP144"
                      maxLength={40}
                    />
                  </label>
                  <div className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-black/55">
                    <strong className="text-black/70">Хаалга:</strong>{" "}
                    {doorCount} ·{" "}
                    <strong className="text-black/70">Шургуулга:</strong>{" "}
                    {drawerCount}
                  </div>
                  <label className="flex items-center gap-2 self-end pb-3 text-sm">
                    <input
                      type="checkbox"
                      checked={isDefault}
                      onChange={(event) => setIsDefault(event.target.checked)}
                    />
                    Module-ийн үндсэн хувилбар
                  </label>
                </div>
              </details>
              <button
                className="btn-primary self-end"
                disabled={
                  busy === "save" || !selectedModel?.glbReady || !moduleId
                }
              >
                {busy === "save" ? (
                  <LoaderCircle size={15} className="animate-spin" />
                ) : (
                  <Link2 size={15} />
                )}
                Угсралт хадгалах
              </button>
              {selectedModel && !matchingModules.length && (
                <p className="text-sm text-red-600 md:col-span-2 xl:col-span-4">
                  {selectedModel.widthMm}×{selectedModel.heightMm}×
                  {selectedModel.depthMm} мм хэмжээтэй module байхгүй. GLB
                  бүтээгдэхүүний хэмжээг шалгана уу.
                </p>
              )}
              {selectedModel &&
                assemblyMode === "authored" &&
                !assembly?.slots.length && (
                  <div className="md:col-span-2 xl:col-span-4">
                    <AdminKitchenFrontMotion
                      baseModel={selectedModel}
                      opening={opening}
                      value={frontMotion}
                      onChange={setFrontMotion}
                      materials={materials}
                    />
                  </div>
                )}
              {selectedModel && assemblyMode === "authored" && (
                <details
                  className="ak-assembly md:col-span-2 xl:col-span-4"
                  open={Boolean(assembly?.slots.length)}
                >
                  <summary>
                    Солих эд анги, гэрэл, төхөөрөмж холбох (сонголттой)
                  </summary>
                  <AdminKitchenAssemblyEditor
                    value={assembly}
                    onChange={setAssembly}
                    models={models}
                    materials={materials}
                    baseModel={selectedModel}
                  />
                </details>
              )}
            </form>
          </>
        )}
        {workspace === "library" && (
          <>
            <div className="ak-library-filters">
              <input
                className="input"
                type="search"
                aria-label="Гал тогооны GLB хайх"
                placeholder="Нэрээр хайх…"
                value={libraryQuery}
                onChange={(event) => setLibraryQuery(event.target.value)}
              />
              <select
                className="input"
                aria-label="Сангийн ангилал"
                value={libraryGroup}
                onChange={(event) => setLibraryGroup(event.target.value)}
              >
                <option value="all">Бүх ангилал</option>
                {Object.entries(KITCHEN_ASSET_GROUPS).map(([id, label]) => (
                  <option key={id} value={id}>
                    {label}
                  </option>
                ))}
              </select>
              <select
                className="input"
                aria-label="GLB төлөв"
                value={libraryStatus}
                onChange={(event) => setLibraryStatus(event.target.value)}
              >
                <option value="all">Бүх төлөв</option>
                <option value="ready">Бэлэн</option>
                <option value="processing">Боловсруулж буй</option>
                <option value="error">Алдаатай</option>
                <option value="archived">Архивласан</option>
              </select>
              <select
                className="input"
                aria-label="GLB өргөн"
                value={libraryWidth}
                onChange={(event) => setLibraryWidth(event.target.value)}
              >
                <option value="">Бүх өргөн</option>
                {[...new Set(models.map((model) => model.widthMm))]
                  .sort((a, b) => a - b)
                  .map((width) => (
                    <option key={width} value={width}>
                      {width} мм
                    </option>
                  ))}
              </select>
            </div>
            <p className="ak-help">
              {filteredModels.length} / {models.length} гал тогооны загвар
            </p>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
              {filteredModels.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-3 text-xs"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{model.name}</p>
                    <p className="text-black/50">
                      {model.asset
                        ? KITCHEN_ASSET_TYPES[model.asset.type].label
                        : model.partKind
                          ? PART_LABELS[model.partKind]
                          : (model.moduleCode ?? "Хэмжээ сонгоогүй")}{" "}
                      · {model.widthMm}×{model.heightMm}×{model.depthMm} мм
                      {model.linked ? " · variant-тай" : " · холбоогүй"}
                    </p>
                    <p>
                      {model.archivedAt
                        ? "Архивласан"
                        : model.glbReady
                          ? "GLB бэлэн"
                          : `Боловсруулалт: ${model.processingStatus}`}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn-ghost !min-h-8 !px-2 text-red-600"
                    disabled={busy === `delete:${model.id}`}
                    onClick={() =>
                      model.archivedAt
                        ? void restoreModel(model.id)
                        : void deleteModel(model)
                    }
                  >
                    {busy === `delete:${model.id}` ? (
                      <LoaderCircle size={13} className="animate-spin" />
                    ) : (
                      <Trash2 size={13} />
                    )}
                    {model.archivedAt ? "Сэргээх" : "Архивлах"}
                  </button>
                  {!model.partKind && !model.asset && !model.archivedAt && (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={!model.glbReady}
                      onClick={() => chooseCabinet(model.id)}
                    >
                      {model.linked ? "Угсралт засах" : "Угсрах"}
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!filteredModels.length && <p>Тохирох GLB олдсонгүй.</p>}
            {!models.length && (
              <p className="rounded-xl border border-dashed border-black/15 p-5 text-sm text-black/55">
                Kitchen GLB байхгүй. Дээрх хэсгээс эхний GLB-ээ шууд нэмнэ үү.
              </p>
            )}
            <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {modules
                .filter((module) => module.variants.length)
                .map((module) => (
                  <article
                    key={module.id}
                    className="rounded-xl border border-black/10 p-4"
                  >
                    <div className="flex items-center gap-2">
                      <Box size={17} />
                      <strong>{module.code}</strong>
                      <span className="text-xs text-black/45">
                        {module.widthMm}×{module.heightMm}×{module.depthMm}
                      </span>
                    </div>
                    <div className="mt-3 space-y-2">
                      {module.variants.map((variant) => (
                        <div
                          key={variant.furnitureModelId}
                          className="flex items-center justify-between gap-2 rounded-lg bg-black/[0.03] p-2 text-xs"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {variant.modelName}
                            </p>
                            <p className="text-black/50">
                              {variantLabel(variant)} · {variant.variantCode}
                              {variant.isDefault ? " · default" : ""}
                            </p>
                          </div>
                          <button
                            type="button"
                            className="btn-ghost !min-h-8 !px-2"
                            disabled={Boolean(busy)}
                            onClick={() => {
                              setWorkspace("link");
                              setModelId(variant.furnitureModelId);
                              setModuleId(module.id);
                              setOpening(variant.opening);
                              setDoorCount(variant.doorCount);
                              setDrawerCount(variant.drawerCount);
                              setPresetId(
                                VARIANT_PRESETS.find(
                                  (preset) =>
                                    preset.opening === variant.opening &&
                                    preset.doorCount === variant.doorCount &&
                                    preset.drawerCount === variant.drawerCount,
                                )?.id ?? "door-1",
                              );
                              setDesignCode(
                                typeof variant.configuration.designCode ===
                                  "string"
                                  ? variant.configuration.designCode
                                  : "",
                              );
                              setIsDefault(variant.isDefault);
                              setAssembly(
                                getKitchenGlbAssembly(variant.configuration),
                              );
                              setFrontMotion(
                                parseKitchenFrontMotion(
                                  variant.configuration.frontMotion,
                                ) ?? {},
                              );
                              setAssemblyMode(
                                variant.configuration.assemblyMode === "parts"
                                  ? "parts"
                                  : "authored",
                              );
                              document
                                .querySelector(
                                  '[aria-label="GLB эд ангийн тохиргоо"]',
                                )
                                ?.scrollIntoView({
                                  behavior: "smooth",
                                  block: "center",
                                });
                            }}
                          >
                            Эд анги засах
                          </button>
                          <button
                            type="button"
                            className="btn-ghost !min-h-8 !px-2"
                            disabled={busy === variant.furnitureModelId}
                            onClick={() =>
                              void setActive(
                                variant.furnitureModelId,
                                !variant.active,
                              )
                            }
                          >
                            <Power size={13} />
                            {variant.active ? "Унтраах" : "Идэвхжүүлэх"}
                          </button>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
            </div>
          </>
        )}
      </section>
    </>
  );
}
