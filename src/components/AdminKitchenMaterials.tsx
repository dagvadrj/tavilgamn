"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LoaderCircle,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Save,
  Upload,
  X,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import {
  KITCHEN_SURFACE_KINDS,
  type AdminKitchenMaterialDefinition,
  type KitchenSurfaceKind,
  type KitchenTextureKind,
} from "@/lib/kitchenMaterials";

type MaterialForm = {
  id: string;
  name: string;
  surfaceKind: KitchenSurfaceKind;
  baseColor: string;
  roughness: string;
  metalness: string;
  baseColorTexture: string;
  normalTexture: string;
  roughnessTexture: string;
  metalnessTexture: string;
};
type TextureFormKey =
  | "baseColorTexture"
  | "normalTexture"
  | "roughnessTexture"
  | "metalnessTexture";

const emptyForm: MaterialForm = {
  id: "",
  name: "",
  surfaceKind: "general",
  baseColor: "#C9A37A",
  roughness: "0.65",
  metalness: "0",
  baseColorTexture: "",
  normalTexture: "",
  roughnessTexture: "",
  metalnessTexture: "",
};

const surfaceLabels: Record<KitchenSurfaceKind, string> = {
  general: "Ерөнхий",
  carcass: "Их бие",
  front: "Фасад / хаалга",
  countertop: "Тавцан",
  handle: "Бариул",
  appliance: "Цахилгаан хэрэгсэл",
};

const textureFields: Array<{
  kind: KitchenTextureKind;
  formKey: TextureFormKey;
  label: string;
  placeholder: string;
}> = [
  {
    kind: "baseColor",
    formKey: "baseColorTexture",
    label: "Өнгөний texture",
    placeholder: "oak-color.webp",
  },
  {
    kind: "normal",
    formKey: "normalTexture",
    label: "Normal texture",
    placeholder: "oak-normal.webp",
  },
  {
    kind: "roughness",
    formKey: "roughnessTexture",
    label: "Roughness texture",
    placeholder: "oak-roughness.webp",
  },
  {
    kind: "metalness",
    formKey: "metalnessTexture",
    label: "Metalness texture",
    placeholder: "metal-metalness.webp",
  },
];

function formFor(material: AdminKitchenMaterialDefinition): MaterialForm {
  return {
    id: material.id,
    name: material.name,
    surfaceKind: material.surfaceKind,
    baseColor: material.baseColor,
    roughness: String(material.roughness),
    metalness: String(material.metalness),
    baseColorTexture: material.texturePaths.baseColor ?? "",
    normalTexture: material.texturePaths.normal ?? "",
    roughnessTexture: material.texturePaths.roughness ?? "",
    metalnessTexture: material.texturePaths.metalness ?? "",
  };
}

export function AdminKitchenMaterials({ owner }: { owner: string }) {
  const [materials, setMaterials] = useState<AdminKitchenMaterialDefinition[]>(
    [],
  );
  const [form, setForm] = useState<MaterialForm>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await authFetch(
        "/api/admin/kitchen-materials",
        undefined,
        owner,
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(data?.materials))
        throw new Error(data?.error ?? "Материалуудыг ачаалж чадсангүй.");
      setMaterials(data.materials);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Материалуудыг ачаалж чадсангүй.",
      );
    }
  }, [owner]);

  useEffect(() => {
    void load();
  }, [load]);

  function reset() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function update<K extends keyof MaterialForm>(
    key: K,
    value: MaterialForm[K],
  ) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setBusy("save");
    setError(null);
    setMessage(null);
    try {
      const response = await authFetch(
        "/api/admin/kitchen-materials",
        {
          method: editingId ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: form.id,
            name: form.name,
            surfaceKind: form.surfaceKind,
            baseColor: form.baseColor,
            roughness: Number(form.roughness),
            metalness: Number(form.metalness),
            texturePaths: {
              baseColor: form.baseColorTexture,
              normal: form.normalTexture,
              roughness: form.roughnessTexture,
              metalness: form.metalnessTexture,
            },
          }),
        },
        owner,
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.material?.id !== "string")
        throw new Error(data?.error ?? "Материал хадгалж чадсангүй.");
      const saved = data.material as AdminKitchenMaterialDefinition;
      setMaterials((current) =>
        current.some((item) => item.id === saved.id)
          ? current.map((item) => (item.id === saved.id ? saved : item))
          : [...current, saved].sort((a, b) => a.name.localeCompare(b.name)),
      );
      setEditingId(saved.id);
      setForm(formFor(saved));
      setMessage(
        editingId
          ? "Материалын өөрчлөлтийг хадгаллаа."
          : "Шинэ материал нэмлээ. Одоо texture зургаа шууд оруулж болно.",
      );
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Материал хадгалж чадсангүй.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function uploadTexture(kind: KitchenTextureKind, file: File) {
    if (!editingId) {
      setError("Эхлээд материалаа хадгална уу.");
      return;
    }
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024
    ) {
      setError("Texture нь JPG, PNG эсвэл WebP, 8 MB-аас ихгүй байна.");
      return;
    }
    setBusy(`texture:${kind}`);
    setError(null);
    setMessage(null);
    try {
      const body = new FormData();
      body.set("materialId", editingId);
      body.set("kind", kind);
      body.set("file", file);
      const response = await authFetch(
        "/api/admin/kitchen-material-textures",
        { method: "POST", body },
        owner,
      );
      const data = await response.json().catch(() => null);
      if (!response.ok || typeof data?.material?.id !== "string")
        throw new Error(data?.error ?? "Texture зураг оруулж чадсангүй.");
      const saved = data.material as AdminKitchenMaterialDefinition;
      setMaterials((current) =>
        current.map((item) => (item.id === saved.id ? saved : item)),
      );
      const field = textureFields.find((item) => item.kind === kind);
      if (field) update(field.formKey, saved.texturePaths[kind] ?? "");
      setMessage(`${field?.label ?? "Texture"} амжилттай орлоо.`);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Texture зураг оруулж чадсангүй.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function setActive(material: AdminKitchenMaterialDefinition) {
    setBusy(material.id);
    setError(null);
    setMessage(null);
    try {
      const response = await authFetch(
        "/api/admin/kitchen-materials",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: material.id, active: !material.active }),
        },
        owner,
      );
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(
          data?.error ?? "Материалын төлөвийг өөрчилж чадсангүй.",
        );
      if (editingId === material.id) reset();
      setMessage(
        material.active
          ? "Материалыг идэвхгүй болголоо."
          : "Материалыг идэвхжүүллээ.",
      );
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Материалын төлөвийг өөрчилж чадсангүй.",
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="space-y-4 rounded-2xl border border-black/10 bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <span className="admin-eyebrow">KITCHEN MATERIALS</span>
          <h2 className="mt-1 text-lg font-semibold">Гал тогооны материал</h2>
          <p className="text-sm text-black/55">
            Planner болон GLB дээр ашиглах өнгө, гадаргуу, texture-ийн
            мэдээллийг удирдана.
          </p>
        </div>
        <button type="button" className="btn-ghost" onClick={() => void load()}>
          <RefreshCw size={15} />
          Шинэчлэх
        </button>
      </div>

      <form
        onSubmit={save}
        className="space-y-4 rounded-xl bg-black/[0.03] p-4"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-medium">
            {editingId ? `${form.name} засах` : "Шинэ материал нэмэх"}
          </h3>
          {editingId && (
            <button
              type="button"
              className="btn-ghost !min-h-8 !px-2"
              onClick={reset}
            >
              <X size={14} />
              Болих
            </button>
          )}
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <label className="label">
            Материалын код
            <input
              className="input mt-1 w-full"
              required
              disabled={!!editingId}
              maxLength={64}
              pattern="[a-z0-9][a-z0-9_-]{0,63}"
              placeholder="Ж: dark_oak"
              value={form.id}
              onChange={(event) =>
                update("id", event.target.value.toLowerCase())
              }
            />
            <small className="mt-1 block text-black/45">
              Англи жижиг үсэг, тоо, - эсвэл _
            </small>
          </label>
          <label className="label">
            Харагдах нэр
            <input
              className="input mt-1 w-full"
              required
              maxLength={120}
              placeholder="Ж: Хар царс"
              value={form.name}
              onChange={(event) => update("name", event.target.value)}
            />
          </label>
          <label className="label">
            Зориулалт
            <select
              className="input mt-1 w-full"
              value={form.surfaceKind}
              onChange={(event) =>
                update("surfaceKind", event.target.value as KitchenSurfaceKind)
              }
            >
              {KITCHEN_SURFACE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {surfaceLabels[kind]}
                </option>
              ))}
            </select>
          </label>
          <label className="label">
            Үндсэн өнгө
            <div className="mt-1 flex gap-2">
              <input
                aria-label="Материалын өнгө сонгох"
                className="h-11 w-14 cursor-pointer rounded-lg border border-black/10 bg-white p-1"
                type="color"
                value={form.baseColor}
                onChange={(event) =>
                  update("baseColor", event.target.value.toUpperCase())
                }
              />
              <input
                className="input min-w-0 flex-1"
                required
                pattern="#[0-9A-Fa-f]{6}"
                value={form.baseColor}
                onChange={(event) =>
                  update("baseColor", event.target.value.toUpperCase())
                }
              />
            </div>
          </label>
          <label className="label">
            Барзгар чанар
            <input
              className="input mt-1 w-full"
              type="number"
              min="0"
              max="1"
              step="0.01"
              required
              value={form.roughness}
              onChange={(event) => update("roughness", event.target.value)}
            />
            <small className="mt-1 block text-black/45">
              0 = гялгар, 1 = матт
            </small>
          </label>
          <label className="label">
            Металл чанар
            <input
              className="input mt-1 w-full"
              type="number"
              min="0"
              max="1"
              step="0.01"
              required
              value={form.metalness}
              onChange={(event) => update("metalness", event.target.value)}
            />
            <small className="mt-1 block text-black/45">
              Мод, чулуу ихэвчлэн 0
            </small>
          </label>
        </div>
        <details className="rounded-xl border border-black/10 bg-white p-3">
          <summary className="cursor-pointer text-sm font-medium">
            Texture зургууд (сонголттой)
          </summary>
          <p className="mt-1 text-xs text-black/45">
            {editingId
              ? "JPG, PNG, WebP · зураг бүр 8 MB хүртэл. URL-г гараар оруулж бас болно."
              : "Эхлээд материалаа нэмсний дараа texture upload идэвхжинэ."}
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {textureFields.map((field) => (
              <div key={field.kind}>
                <label
                  className="label"
                  htmlFor={`kitchen-${field.kind}-texture`}
                >
                  {field.label}
                </label>
                <div className="mt-1 flex gap-2">
                  <input
                    id={`kitchen-${field.kind}-texture`}
                    className="input min-w-0 flex-1"
                    type="text"
                    maxLength={2000}
                    placeholder={`https://…/${field.placeholder}`}
                    value={form[field.formKey]}
                    onChange={(event) =>
                      update(field.formKey, event.target.value)
                    }
                  />
                  <label
                    className={`btn-ghost shrink-0 ${!editingId || !!busy ? "pointer-events-none opacity-50" : "cursor-pointer"}`}
                  >
                    {busy === `texture:${field.kind}` ? (
                      <LoaderCircle size={14} className="animate-spin" />
                    ) : (
                      <Upload size={14} />
                    )}
                    Upload
                    <input
                      className="sr-only"
                      type="file"
                      aria-label={`${field.label} upload`}
                      accept="image/jpeg,image/png,image/webp"
                      disabled={!editingId || !!busy}
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.target.value = "";
                        if (file) void uploadTexture(field.kind, file);
                      }}
                    />
                  </label>
                </div>
              </div>
            ))}
          </div>
        </details>
        <button className="btn-primary" disabled={!!busy}>
          {busy === "save" ? (
            <LoaderCircle size={15} className="animate-spin" />
          ) : editingId ? (
            <Save size={15} />
          ) : (
            <Plus size={15} />
          )}
          {editingId ? "Өөрчлөлт хадгалах" : "Материал нэмэх"}
        </button>
      </form>

      {error && (
        <p className="admin-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p
          className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700"
          role="status"
        >
          {message}
        </p>
      )}

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {materials.map((material) => (
          <article
            key={material.id}
            className={`rounded-xl border p-4 ${material.active ? "border-black/10" : "border-black/5 bg-black/[0.025] opacity-65"}`}
          >
            <div className="flex items-start gap-3">
              <span
                className="h-12 w-12 shrink-0 rounded-xl border border-black/10 shadow-inner"
                style={{ backgroundColor: material.baseColor }}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{material.name}</h3>
                  {!material.active && (
                    <span className="rounded-full bg-black/5 px-2 py-0.5 text-[10px]">
                      Идэвхгүй
                    </span>
                  )}
                </div>
                <p className="truncate font-mono text-xs text-black/45">
                  {material.id}
                </p>
                <p className="mt-1 text-xs text-black/55">
                  {surfaceLabels[material.surfaceKind]} · rough{" "}
                  {material.roughness} · metal {material.metalness}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center justify-between gap-2">
              <span className="text-xs text-black/45">
                {Object.keys(material.texturePaths).length
                  ? `${Object.keys(material.texturePaths).length} texture зам`
                  : "Texture замгүй"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-ghost !min-h-8 !px-2"
                  onClick={() => {
                    setEditingId(material.id);
                    setForm(formFor(material));
                    setError(null);
                    setMessage(null);
                  }}
                >
                  <Pencil size={13} />
                  Засах
                </button>
                <button
                  type="button"
                  className="btn-ghost !min-h-8 !px-2"
                  disabled={busy === material.id}
                  onClick={() => void setActive(material)}
                >
                  {busy === material.id ? (
                    <LoaderCircle size={13} className="animate-spin" />
                  ) : (
                    <Power size={13} />
                  )}
                  {material.active ? "Унтраах" : "Идэвхжүүлэх"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!materials.length && !error && (
        <p className="rounded-xl border border-dashed border-black/15 p-5 text-sm text-black/55">
          Материалын жагсаалт хоосон байна.
        </p>
      )}
    </section>
  );
}
