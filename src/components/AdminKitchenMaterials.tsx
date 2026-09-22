"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LoaderCircle,
  Pencil,
  Plus,
  Power,
  RefreshCw,
  Save,
  X,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import {
  KITCHEN_SURFACE_KINDS,
  type AdminKitchenMaterialDefinition,
  type KitchenSurfaceKind,
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
      if (!response.ok)
        throw new Error(data?.error ?? "Материал хадгалж чадсангүй.");
      setMessage(
        editingId
          ? "Материалын өөрчлөлтийг хадгаллаа."
          : "Шинэ материал нэмлээ.",
      );
      reset();
      await load();
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
            Texture замууд (сонголттой)
          </summary>
          <p className="mt-1 text-xs text-black/45">
            HTTPS URL эсвэл /-ээр эхэлсэн дотоод зам оруулна.
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <label className="label">
              Өнгөний texture
              <input
                className="input mt-1 w-full"
                type="text"
                maxLength={2000}
                placeholder="https://…/oak-color.webp"
                value={form.baseColorTexture}
                onChange={(event) =>
                  update("baseColorTexture", event.target.value)
                }
              />
            </label>
            <label className="label">
              Normal texture
              <input
                className="input mt-1 w-full"
                type="text"
                maxLength={2000}
                placeholder="https://…/oak-normal.webp"
                value={form.normalTexture}
                onChange={(event) =>
                  update("normalTexture", event.target.value)
                }
              />
            </label>
            <label className="label">
              Roughness texture
              <input
                className="input mt-1 w-full"
                type="text"
                maxLength={2000}
                placeholder="https://…/oak-roughness.webp"
                value={form.roughnessTexture}
                onChange={(event) =>
                  update("roughnessTexture", event.target.value)
                }
              />
            </label>
            <label className="label">
              Metalness texture
              <input
                className="input mt-1 w-full"
                type="text"
                maxLength={2000}
                placeholder="https://…/metal-metalness.webp"
                value={form.metalnessTexture}
                onChange={(event) =>
                  update("metalnessTexture", event.target.value)
                }
              />
            </label>
          </div>
        </details>
        <button className="btn-primary" disabled={busy === "save"}>
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
