"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Box,
  CheckCircle,
  Link2,
  LoaderCircle,
  Power,
  RefreshCw,
  Upload,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import {
  KITCHEN_OPENINGS,
  type KitchenCatalogModule,
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

export function AdminKitchenModules({ owner }: { owner: string }) {
  const [modules, setModules] = useState<KitchenCatalogModule[]>([]);
  const [models, setModels] = useState<KitchenModelCandidate[]>([]);
  const [modelId, setModelId] = useState("");
  const [moduleId, setModuleId] = useState("");
  const [opening, setOpening] = useState<KitchenOpening>("doors");
  const [variantCode, setVariantCode] = useState("");
  const [doorCount, setDoorCount] = useState(1);
  const [drawerCount, setDrawerCount] = useState(0);
  const [isDefault, setIsDefault] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadModuleId, setUploadModuleId] = useState("");
  const [uploadGlb, setUploadGlb] = useState<File | null>(null);
  const [uploadThumbnail, setUploadThumbnail] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
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
              Math.abs(module.widthMm - selectedModel.widthMm) <= 10 &&
              Math.abs(module.heightMm - selectedModel.heightMm) <= 10 &&
              Math.abs(module.depthMm - selectedModel.depthMm) <= 10,
          )
        : modules,
    [modules, selectedModel],
  );
  const selectedModule = modules.find((module) => module.id === moduleId);
  const uploadModule = modules.find((module) => module.id === uploadModuleId);

  useEffect(() => {
    if (
      selectedModel &&
      !matchingModules.some((module) => module.id === moduleId)
    )
      setModuleId(matchingModules[0]?.id ?? "");
  }, [matchingModules, moduleId, selectedModel]);
  useEffect(() => {
    if (selectedModule)
      setVariantCode(`${selectedModule.code}-${opening}`.toUpperCase());
    setDrawerCount(opening === "drawers" ? 3 : 0);
    setDoorCount(
      opening === "open"
        ? 0
        : selectedModule && selectedModule.widthMm >= 600
          ? 2
          : 1,
    );
  }, [opening, selectedModule]);

  async function uploadModel(event: React.FormEvent) {
    event.preventDefault();
    setUploadError(null);
    setUploadSuccess(null);
    if (!uploadModule || !uploadGlb || !uploadName.trim()) {
      setUploadError("Загварын нэр, module болон GLB файлыг бүрэн сонгоно уу.");
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
      if (uploadThumbnail) form.set("thumbnail", uploadThumbnail);

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
          }),
        },
        owner,
      );
      const completed = await completeResponse.json().catch(() => null);
      if (!completeResponse.ok)
        throw new Error(
          completed?.error ?? "GLB боловсруулалтыг эхлүүлж чадсангүй.",
        );

      setUploadName("");
      setUploadModuleId("");
      setUploadGlb(null);
      setUploadThumbnail(null);
      if (glbInput.current) glbInput.current.value = "";
      if (thumbnailInput.current) thumbnailInput.current.value = "";
      setUploadSuccess(
        "GLB бэлэн боллоо. LOD үүсгэхгүйгээр эх файлаар нь шууд ашиглана.",
      );
      await load();
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
      setModelId("");
      setModuleId("");
      setVariantCode("");
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

  return (
    <>
      <section className="space-y-4 rounded-2xl border border-black/10 bg-white p-5">
        <div>
          <span className="admin-eyebrow">KITCHEN GLB UPLOAD</span>
          <h2 className="mt-1 text-lg font-semibold">Гал тогооны GLB нэмэх</h2>
          <p className="text-sm text-black/55">
            Ангилал нь автоматаар “Гал тогооны шүүгээ” болно. Сонгосон
            module-ийн хэмжээ загварт оноогдоно.
          </p>
        </div>
        <form
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
              {modules.map((module) => (
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
              className="input mt-1 w-full !py-2 file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-1 file:text-xs"
              type="file"
              accept=".glb,model/gltf-binary"
              required
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
          <button
            className="btn-primary"
            disabled={
              uploading || !uploadName.trim() || !uploadModule || !uploadGlb
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
        <form
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
                  {model.name} · {model.widthMm}×{model.heightMm}×
                  {model.depthMm} {model.linked ? "· холбоотой" : ""}
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
            Хувилбар
            <select
              className="input mt-1 w-full"
              value={opening}
              onChange={(event) =>
                setOpening(event.target.value as KitchenOpening)
              }
            >
              {KITCHEN_OPENINGS.map((value) => (
                <option key={value} value={value}>
                  {openingLabel[value]}
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
              onChange={(event) =>
                setVariantCode(event.target.value.toUpperCase())
              }
            />
          </label>
          <label className="label">
            Хаалга
            <input
              className="input mt-1 w-full"
              type="number"
              min="0"
              max="2"
              value={doorCount}
              onChange={(event) => setDoorCount(Number(event.target.value))}
            />
          </label>
          <label className="label">
            Шургуулга
            <input
              className="input mt-1 w-full"
              type="number"
              min="0"
              max="4"
              value={drawerCount}
              onChange={(event) => setDrawerCount(Number(event.target.value))}
            />
          </label>
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
                          {openingLabel[variant.opening]} ·{" "}
                          {variant.variantCode}
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
