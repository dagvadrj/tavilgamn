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
import { cabinetVariantCode } from "@/lib/cabinetCodes";
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
import {
  getKitchenGlbAssembly,
  type KitchenGlbAssembly,
  type KitchenPartKind,
} from "@/lib/kitchenGlbAssembly";
const GlbUploadPreview = dynamic(() => import("./GlbUploadPreview"), {
  ssr: false,
});
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
  const [family, setFamily] = useState("base");
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryGroup, setLibraryGroup] = useState("all");
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
  const uploadModule = modules.find((module) => module.id === uploadModuleId);
  const assetDefinition = KITCHEN_ASSET_TYPES[assetType];
  const isAsset = group !== "cabinets" && group !== "parts";
  const filteredModels = models.filter(
    (model) =>
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
      setUploadError("Загварын нэр, module болон GLB файлыг бүрэн сонгоно уу.");
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
      setUploadThumbnail(null);
      if (glbInput.current) glbInput.current.value = "";
      if (thumbnailInput.current) thumbnailInput.current.value = "";
      setUploadSuccess(
        wasPart
          ? "GLB орууллаа. Боловсруулалт дуусмагц гал тогооны санд харагдана. Суурилуулдаг хэрэгслийг «Шүүгээнд холбох» хэсгээр холбоно."
          : "GLB орууллаа. Боловсруулалт дууссаны дараа «Шүүгээнд холбох» хэсгээс хийцээ сонгоод холбоорой.",
      );
      await load();
      if (!wasPart) {
        setModelId(uploadedModelId);
        setModuleId(uploadedModuleId);
        setAssembly(null);
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
            assembly,
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
        `/api/models/${id}`,
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
            ["upload", "1. GLB нэмэх"],
            ["link", "2. Шүүгээнд холбох"],
            ["library", `3. Загварын сан (${models.length})`],
          ] as const
        ).map(([id, label]) => (
          <button
            type="button"
            key={id}
            aria-pressed={workspace === id}
            onClick={() => setWorkspace(id)}
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
      <section
        hidden={workspace !== "upload"}
        className="space-y-4 rounded-2xl border border-black/10 bg-white p-5"
      >
        <div>
          <span className="admin-eyebrow">KITCHEN GLB UPLOAD</span>
          <h2 className="mt-1 text-lg font-semibold">Гал тогооны GLB нэмэх</h2>
          <p className="text-sm text-black/55">
            Эхлээд ангиллаа сонгоод, хэмжээ болон GLB файлаа оруулна. Хэрэгсэл,
            эд ангийн хэмжээг GLB-ээс уншиж бөглөнө. Thumbnail-ийг автоматаар
            үүсгэнэ.
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
            {isAsset ? (
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
                      if (KITCHEN_ASSET_TYPES[type].placement === "cabinet")
                        setInstallation("integrated");
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
                <p className="ak-help md:col-span-2 xl:col-span-4">
                  {installation === "integrated"
                    ? "Боловсруулсны дараа «Шүүгээнд холбох → Эд ангийн тохиргоо»-оос шүүгээнд холбоно."
                    : "Боловсруулалт дуусмагц гал тогоо төлөвлөгчийн хэрэгслийн санд шууд харагдана."}
                </p>
              </>
            ) : null}
            {!uploadPartKind && (
              <label className="label">
                Шүүгээний төрөл
                <select
                  className="input mt-1 w-full"
                  value={family}
                  onChange={(event) => {
                    setFamily(event.target.value);
                    setUploadModuleId("");
                  }}
                >
                  {Object.entries(CABINET_FAMILIES).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <label className="label">
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
            {group === "parts" && (
              <label className="label">
                GLB зориулалт
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
                      {label} · солигдох эд анги
                    </option>
                  ))}
                </select>
              </label>
            )}
            {!uploadPartKind && (
              <label className="label">
                Хэмжээ (өргөн × өндөр × гүн)
                <select
                  className="input mt-1 w-full"
                  required
                  value={uploadModuleId}
                  onChange={(event) => setUploadModuleId(event.target.value)}
                >
                  <option value="">Сонгоно уу</option>
                  {modules
                    .filter(
                      (module) =>
                        module.active && cabinetFamily(module.code) === family,
                    )
                    .map((module) => (
                      <option key={module.id} value={module.id}>
                        {module.name} · {module.widthMm}×{module.heightMm}×
                        {module.depthMm} мм
                      </option>
                    ))}
                </select>
              </label>
            )}
            {uploadPartKind ? (
              <div className="grid grid-cols-3 gap-2 md:col-span-2 xl:col-span-4">
                {(["widthMm", "heightMm", "depthMm"] as const).map((key, i) => (
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
                ))}
              </div>
            ) : (
              <details className="ak-help md:col-span-2 xl:col-span-4">
                <summary>Нарийвчилсан холболт (сонголттой)</summary>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={authoredNodes}
                    onChange={(event) => setAuthoredNodes(event.target.checked)}
                  />
                  Хаалга, бариул холбох нэртэй node / anchor агуулсан GLB
                </label>
              </details>
            )}
            <label className="label">
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
                onChange={(event) =>
                  setUploadGlb(event.target.files?.[0] ?? null)
                }
              />
              <small className="mt-1 block text-black/45">200 MB хүртэл</small>
            </label>
            <label className="label">
              Нэмэлт thumbnail зураг (сонголттой)
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
            <div className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-black/55 md:col-span-2 xl:col-span-3">
              <strong className="text-black/70">Ангилал:</strong>{" "}
              {KITCHEN_ASSET_GROUPS[group]} ·{" "}
              <strong className="text-black/70">Хэмжээ:</strong>{" "}
              {uploadPartKind
                ? PART_LABELS[uploadPartKind]
                : uploadModule
                  ? `${uploadModule.widthMm}×${uploadModule.heightMm}×${uploadModule.depthMm} мм`
                  : "Module сонгоно уу"}
            </div>
            <GlbUploadPreview
              onMeasure={
                uploadPartKind
                  ? (size) =>
                      setPartSize({
                        widthMm: Math.max(1, Math.round(size.widthMm)),
                        heightMm: Math.max(1, Math.round(size.heightMm)),
                        depthMm: Math.max(1, Math.round(size.depthMm)),
                      })
                  : undefined
              }
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
        {uploadSuccess && (
          <p
            className="flex items-center gap-2 rounded-xl bg-ui-selected px-4 py-3 text-sm text-ui-accent"
            role="status"
          >
            <CheckCircle size={16} />
            {uploadSuccess}
          </p>
        )}
      </section>
      <section
        hidden={workspace === "upload"}
        className="space-y-4 rounded-2xl border border-black/10 bg-white p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="admin-eyebrow">3D CATALOG</span>
            <h2 className="mt-1 text-lg font-semibold">
              {workspace === "link"
                ? "Шүүгээний хийц ба солих эд анги"
                : "Гал тогооны загварын сан"}
            </h2>
            <p className="text-sm text-black/55">
              Дээр оруулсан, боловсруулалт нь дууссан GLB-г хаалга, шургуулга
              зэрэг хувилбартай нь холбоно.
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => void load()}
          >
            <RefreshCw size={15} />
            Шинэчлэх
          </button>
        </div>
        {error && (
          <p className="admin-error" role="alert">
            {error}
          </p>
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
                Kitchen GLB
                <select
                  className="input mt-1 w-full"
                  required
                  value={modelId}
                  onChange={(event) => {
                    setModelId(event.target.value);
                    setAssembly(null);
                  }}
                >
                  <option value="">Сонгоно уу</option>
                  {models
                    .filter((model) => !model.partKind)
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
              <label className="label">
                Variant code
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
                <strong className="text-black/70">Хаалга:</strong> {doorCount} ·{" "}
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
                GLB холбох
              </button>
              {selectedModel && !matchingModules.length && (
                <p className="text-sm text-red-600 md:col-span-2 xl:col-span-4">
                  {selectedModel.widthMm}×{selectedModel.heightMm}×
                  {selectedModel.depthMm} мм хэмжээтэй module байхгүй. GLB
                  бүтээгдэхүүний хэмжээг шалгана уу.
                </p>
              )}
              {selectedModel && (
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
            </div>
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
