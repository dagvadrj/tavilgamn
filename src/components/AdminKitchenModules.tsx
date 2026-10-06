"use client";
import { useDraftState, useDraftStatus, clearDashboardDraft } from "@/hooks/useDashboardDraft";
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
const GlbUploadPreview = dynamic(() => import("./GlbUploadPreview"), { ssr: false });
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
  const [modelId, setModelId] = useDraftState(draftScope, "modelId", "");
  const [moduleId, setModuleId] = useDraftState(draftScope, "moduleId", "");
  const [presetId, setPresetId] = useDraftState(draftScope, "presetId", "door-1");
  const [opening, setOpening] = useDraftState<KitchenOpening>(draftScope, "opening", "doors");
  const [variantCode, setVariantCode] = useDraftState(draftScope, "variantCode", "");
  const [designCode, setDesignCode] = useDraftState(draftScope, "designCode", "");
  const [doorCount, setDoorCount] = useDraftState(draftScope, "doorCount", 1);
  const [drawerCount, setDrawerCount] = useDraftState(draftScope, "drawerCount", 0);
  const [isDefault, setIsDefault] = useDraftState(draftScope, "isDefault", false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadName, setUploadName] = useDraftState(uploadScope, "uploadName", "");
  const [uploadModuleId, setUploadModuleId] = useDraftState(uploadScope, "uploadModuleId", "");
  const [uploadGlb, setUploadGlb] = useDraftState<File | null>(uploadScope, "uploadGlb", null);
  const [preview, setPreview] = useState<GlbPreviewResult | null>(null);
  const [uploadThumbnail, setUploadThumbnail] = useDraftState<File | null>(uploadScope, "uploadThumbnail", null);
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
  }, [matchingModules, moduleId, selectedModel, setModuleId, draftStatus.loading]);
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
    try { setVariantCode(cabinetVariantCode(selectedModule.code, preset.opening, preset.doorCount, preset.drawerCount, designCode)); }
    catch { setVariantCode(""); }
  }, [availablePresets, presetId, selectedModule, designCode, draftStatus.loading, setPresetId, setOpening, setDoorCount, setDrawerCount, setVariantCode]);

  function choosePreset(value: string) {
    const preset = availablePresets.find((item) => item.id === value);
    if (!preset) return;
    setPresetId(preset.id);
    setOpening(preset.opening);
    setDoorCount(preset.doorCount);
    setDrawerCount(preset.drawerCount);
    if (selectedModule) {
      try { setVariantCode(cabinetVariantCode(selectedModule.code, preset.opening, preset.doorCount, preset.drawerCount, designCode)); }
      catch { setVariantCode(""); }
    }
  }

  async function uploadModel(event: React.FormEvent) {
    event.preventDefault();
    if (uploading || uploadStatus.loading) return;
    setUploadError(null);
    setUploadSuccess(null);
    if (!uploadModule || !uploadGlb || !uploadName.trim()) {
      setUploadError("Загварын нэр, module болон GLB файлыг бүрэн сонгоно уу.");
      return;
    }
    if (!preview || preview.file !== uploadGlb || !preview.frontConfirmed) { setUploadError("GLB preview шалгалт болон нүүрэн талын баталгаажуулалт шаардлагатай."); return; }
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
      form.set("cabinetModuleId", uploadModule.id);
      form.set("description", `${uploadModule.code} kitchen module GLB`);
      form.set("basePrice", "0");
      form.set("stockQuantity", "0");
      form.set("scale", "1");
      form.set("dimensionsW", String(uploadModule.widthMm / 1000));
      form.set("dimensionsD", String(uploadModule.depthMm / 1000));
      form.set("dimensionsH", String(uploadModule.heightMm / 1000));
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
      const uploadedModuleId = uploadModule.id;
      setUploadName("");
      setUploadModuleId("");
      setUploadGlb(null);
      setUploadThumbnail(null);
      if (glbInput.current) glbInput.current.value = "";
      if (thumbnailInput.current) thumbnailInput.current.value = "";
      setUploadSuccess(
        "GLB upload дууслаа. Web-д зориулсан Meshopt + KTX2 хувилбарыг боловсруулж байна.",
      );
      await load();
      setModelId(uploadedModelId);
      setModuleId(uploadedModuleId);
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
    setBusy(`delete:${id}`); setError(null);
    try {
      const response = await authFetch(`/api/models/${id}`, { method: "PATCH" }, owner);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Сэргээж чадсангүй.");
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Сэргээж чадсангүй."); }
    finally { setBusy(null); }
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
      <section className="space-y-4 rounded-2xl border border-black/10 bg-white p-5">
        <div>
          <span className="admin-eyebrow">KITCHEN GLB UPLOAD</span>
          <h2 className="mt-1 text-lg font-semibold">Гал тогооны GLB нэмэх</h2>
          <p className="text-sm text-black/55">
            Ангилал нь автоматаар “Гал тогооны шүүгээ” болно. Сонгосон
            module-ийн хэмжээ GLB-ийн бодит хэмжээтэй таарах ёстой. Метр · +Y дээш · +Z нүүр · origin доод төв · applied transform.
          </p>
        </div>
        <DashboardDraftNotice scope={uploadScope} disabled={uploading} files={[uploadGlb, uploadThumbnail]} />
        <form
          inert={uploadStatus.loading || undefined}
          onSubmit={uploadModel}
          className="grid gap-3 rounded-xl bg-black/[0.03] p-4 md:grid-cols-2 xl:grid-cols-4"
        >
          <label className="label">
            Загварын нэр
            <input
              className="input mt-1 w-full"
              required
              maxLength={160}
              placeholder="Ж: 600мм 3 шургуулгатай"
              value={uploadName}
              onChange={(event) => setUploadName(event.target.value)}
            />
          </label>
          <label className="label">
            Хэмжээний module
            <select
              className="input mt-1 w-full"
              required
              value={uploadModuleId}
              onChange={(event) => setUploadModuleId(event.target.value)}
            >
              <option value="">Сонгоно уу</option>
              {modules.filter(module => module.active).map((module) => (
                <option key={module.id} value={module.id}>
                  {module.code} · {module.widthMm}×{module.heightMm}×
                  {module.depthMm} мм
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            GLB файл
            <input
              ref={glbInput}
              key={uploadGlb ? `${uploadGlb.name}:${uploadGlb.lastModified}` : "empty-glb"}
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
            Thumbnail зураг
            <input
              ref={thumbnailInput}
              key={uploadThumbnail ? `${uploadThumbnail.name}:${uploadThumbnail.lastModified}` : "empty-thumbnail"}
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
            <strong className="text-black/70">Ангилал:</strong> Гал тогооны
            шүүгээ · <strong className="text-black/70">Хэмжээ:</strong>{" "}
            {uploadModule
              ? `${uploadModule.widthMm}×${uploadModule.heightMm}×${uploadModule.depthMm} мм`
              : "Module сонгоно уу"}
          </div>
          <GlbUploadPreview allowFrontProjection file={uploadGlb} expected={{ widthMm: uploadModule?.widthMm ?? 0, heightMm: uploadModule?.heightMm ?? 0, depthMm: uploadModule?.depthMm ?? 0 }} onChange={setPreview} />
          <button
            className="btn-primary"
            disabled={
              uploading || !uploadName.trim() || !uploadModule || !uploadGlb || !preview || preview.file !== uploadGlb
            }
          >
            {uploading ? (
              <LoaderCircle size={15} className="animate-spin" />
            ) : (
              <Upload size={15} />
            )}
            {uploading ? "Оруулж байна…" : "GLB нэмэх"}
          </button>
        </form>
        {uploadError && (
          <p className="admin-error" role="alert">
            {uploadError}
          </p>
        )}
        {uploadSuccess && (
          <p
            className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
            role="status"
          >
            <CheckCircle size={16} />
            {uploadSuccess}
          </p>
        )}
      </section>
      <section className="space-y-4 rounded-2xl border border-black/10 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="admin-eyebrow">3D CATALOG</span>
            <h2 className="mt-1 text-lg font-semibold">
              Module ба GLB хувилбарууд
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
              onChange={(event) => setModelId(event.target.value)}
            >
              <option value="">Сонгоно уу</option>
              {models.map((model) => (
                <option
                  key={model.id}
                  value={model.id}
                  disabled={!model.glbReady}
                >
                  {model.name} · {model.moduleCode ?? "module тодорхойгүй"} ·{" "}
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
          <label className="label">Хийцийн ялгах code (сонголттой)
            <input className="input mt-1 w-full" value={designCode} onChange={event => setDesignCode(event.target.value.toUpperCase())} placeholder="Ж: TOP144" maxLength={40} />
          </label>
          <div className="rounded-lg border border-black/10 bg-white px-3 py-2 text-xs text-black/55">
            <strong className="text-black/70">Хаалга:</strong> {doorCount} ·{" "}
            <strong className="text-black/70">Шургуулга:</strong> {drawerCount}
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
            disabled={busy === "save" || !selectedModel?.glbReady || !moduleId}
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
        </form>
        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {models.map((model) => (
            <div
              key={model.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-black/10 bg-white p-3 text-xs"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{model.name}</p>
                <p className="text-black/50">
                  {model.moduleCode ?? "Module тодорхойгүй"} · {model.widthMm}×
                  {model.heightMm}×{model.depthMm} мм
                  {model.linked ? " · variant-тай" : " · холбоогүй"}
                </p>
              </div>
              <button
                type="button"
                className="btn-ghost !min-h-8 !px-2 text-red-600"
                disabled={busy === `delete:${model.id}`}
                onClick={() => model.archivedAt ? void restoreModel(model.id) : void deleteModel(model)}
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
      </section>
    </>
  );
}
