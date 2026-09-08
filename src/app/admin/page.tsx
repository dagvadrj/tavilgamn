"use client";
import Link from "next/link";
import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { AdminMessages } from "@/components/AdminMessages";
import { stockLabel } from "@/lib/inventory";
import { AdminAnalytics } from "@/components/AdminAnalytics";
import { Mail, Box, Users, Package, TrendingUp, Upload, Layers, Trash2, CheckCircle, Armchair, ArrowUpRight, ChevronRight, ShieldCheck, Plus, X, Search, RefreshCw } from "lucide-react";
import { OrderHistory } from "@/components/OrderHistory";
import { AdminUsers } from "@/components/AdminUsers";
import { AdminProducts } from "@/components/AdminProducts";
import { supabase } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useAuth } from "@/store/auth";
import { cn } from "@/lib/format";
import "./admin.css";

const TABS = [
  { id: "dashboard", label: "Ерөнхий тойм", short: "Тойм", icon: TrendingUp },
  { id: "furniture", label: "Бүтээгдэхүүн", short: "Тавилга", icon: Box },
  { id: "orders", label: "Захиалгууд", short: "Захиалга", icon: Package },
  { id: "users", label: "Хэрэглэгчид", short: "Хэрэглэгч", icon: Users },
  { id: "messages", label: "Ирсэн зурвас", short: "Зурвас", icon: Mail },
  { id: "models", label: "3D загварууд", short: "3D загвар", icon: Layers },
] as const;
type Tab = (typeof TABS)[number]["id"];

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const router = useRouter();
  const user = useAuth(s => s.user);
  const role = useAuth(s => s.role);
  const initialized = useAuth(s => s.initialized);
  const initializeAuth = useAuth(s => s.initialize);
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => { void initializeAuth(); }, [initializeAuth]);
  useEffect(() => {
    if (!initialized) return;
    if (!user) router.replace("/login?next=/admin");
    else if (role !== "admin") router.replace("/");
  }, [initialized, user, role, router]);

  const selectTab = (next: Tab) => {
    setTab(next);
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() => panelRef.current?.focus({ preventScroll: true }));
  };

  if (!initialized || !user || role !== "admin") return <div className="admin-gate" role="status"><ShieldCheck size={32} strokeWidth={1.4} /><p>Удирдлагын эрхийг шалгаж байна…</p></div>;
  const active = TABS.find(t => t.id === tab)!;
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Link href="/" className="admin-brand"><span><Armchair size={24} /></span>tavilga.mn</Link>
      <p className="admin-sidebar-label">ДЭЛГҮҮРИЙН УДИРДЛАГА</p>
      <nav aria-label="Удирдлагын үндсэн цэс">{TABS.map(t => <button type="button" key={t.id} aria-current={tab === t.id ? "page" : undefined} className={tab === t.id ? "active" : ""} onClick={() => selectTab(t.id)}><t.icon size={19} strokeWidth={1.7} /><span>{t.label}</span>{tab === t.id && <ChevronRight size={15} />}</button>)}</nav>
      <div className="admin-sidebar-bottom"><div className="admin-sidebar-note"><ShieldCheck size={20} /><div><strong>Нэг дороос удирдах</strong><p>Бараа, захиалга, хэрэглэгч.</p></div></div><Link href="/">Дэлгүүр рүү очих <ArrowUpRight size={16} /></Link></div>
    </aside>
    <div className="admin-workspace">
      <header className="admin-topbar"><div className="admin-breadcrumb"><span>Удирдлага</span><ChevronRight size={13} /><strong>{active.label}</strong></div><div className="admin-topbar-actions"><Link href="/" className="admin-store-link">Дэлгүүр үзэх <ArrowUpRight size={15} /></Link><Link href="/account" className="admin-profile"><span className="admin-avatar">{user.name.slice(0, 1).toUpperCase()}</span><span><strong>{user.name}</strong><small>Администратор</small></span></Link></div></header>
      <div className="admin-content" ref={panelRef} tabIndex={-1} aria-label={active.label}>
        {tab === "dashboard" && <AdminAnalytics />}
        {tab === "furniture" && <AdminProducts onAddModel={() => selectTab("models")} />}
        {tab === "orders" && <div><div className="admin-page-heading"><div><span className="admin-eyebrow">БОРЛУУЛАЛТ</span><h1>Захиалгууд</h1><p>Захиалгын мэдээлэл, төлбөрийн төлөвийг хянах.</p></div><span className="admin-heading-icon"><Package size={25} strokeWidth={1.5} /></span></div><OrderHistory admin /></div>}
        {tab === "users" && <AdminUsers />}
        {tab === "messages" && <AdminMessages key={user.id} />}
        {tab === "models" && <ModelsTab />}
      </div>
      <footer className="admin-footer"><span>© {new Date().getFullYear()} tavilga.mn</span><span>Дэлгүүрийн удирдлага</span></footer>
    </div>
    <nav className="admin-mobile-nav" aria-label="Удирдлагын доод цэс">{TABS.map(t => <button type="button" key={t.id} aria-current={tab === t.id ? "page" : undefined} className={tab === t.id ? "active" : ""} onClick={() => selectTab(t.id)}><span><t.icon size={21} strokeWidth={1.7} /></span>{t.short}</button>)}</nav>
  </div>;
}

const CATEGORY_OPTIONS = [
  { id: "sofa", name: "Буйдан" },
  { id: "bed", name: "Ор" },
  { id: "dining-table", name: "Хоолны ширээ" },
  { id: "wardrobe", name: "Хувцасны шкаф" },
  { id: "office", name: "Оффисын тавилга" },
  { id: "tv-stand", name: "Телевизийн тавиур" },
  { id: "bookshelf", name: "Номын тавиур" },
];

const MATERIAL_OPTIONS = [
  { id: "wood", name: "Бөх царс мод" },
  { id: "metal", name: "Өнгөлсөн төмөр" },
  { id: "fabric", name: "Маалинган даавуу" },
  { id: "leather", name: "Жинхэнэ арьс" },
  { id: "velvet", name: "Хилэн" },
];

type ColorEntry = { name: string; hex: string; priceDelta: string };
type MaterialEntry = { id: string; priceDelta: string };

type ModelRecord = {
  id: string;
  name: string;
  category: string;
  description: string;
  basePrice: number;
  stockQuantity?: number | null;
  glbFile: string;
  thumbnailFile: string;
  scale: number;
  dimensionsW: number;
  dimensionsD: number;
  dimensionsH: number;
  colors: string;
  materials: string;
  createdAt: string;
};

function ModelsTab() {
  const [modelQuery, setModelQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<ModelRecord | null>(null);
  const [models, setModels] = useState<ModelRecord[]>([]);
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Basic info
  const [name, setName] = useState("");
  const [category, setCategory] = useState("sofa");
  const [description, setDescription] = useState("");
  const [basePrice, setBasePrice] = useState("0");
  const [stockQuantity, setStockQuantity] = useState("0");
  const [scale, setScale] = useState("0.001");
  const [dimW, setDimW] = useState("1.0");
  const [dimD, setDimD] = useState("1.0");
  const [dimH, setDimH] = useState("1.0");

  // Files
  const [glbFile, setGlbFile] = useState<File | null>(null);
  const [thumbnail, setThumbnail] = useState<File | null>(null);
  const glbRef = useRef<HTMLInputElement>(null);
  const thumbRef = useRef<HTMLInputElement>(null);

  // Colors
  const [colors, setColors] = useState<ColorEntry[]>([
    { name: "Үндсэн өнгө", hex: "#C9A37A", priceDelta: "0" },
  ]);

  // Materials
  const [selMaterials, setSelMaterials] = useState<MaterialEntry[]>([
    { id: "wood", priceDelta: "0" },
  ]);

  const load = async () => {
    setFetching(true);
    setLoadError(null);
    try {
      const res = await fetch("/api/models");
      if (!res.ok)
        throw new Error("Загваруудын жагсаалтыг татахад алдаа гарлаа.");
      const data = await res.json();
      setModels(Array.isArray(data) ? data : []);
    } catch (err) {
      setModels([]);
      setLoadError(
        err instanceof Error
          ? err.message
          : "Загваруудын жагсаалтыг татахад алдаа гарлаа.",
      );
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const addColor = () =>
    setColors((c) => [
      ...c,
      { name: `Өнгө ${c.length + 1}`, hex: "#888888", priceDelta: "0" },
    ]);

  const removeColor = (i: number) =>
    setColors((c) => c.filter((_, idx) => idx !== i));

  const updateColor = (i: number, field: keyof ColorEntry, val: string) =>
    setColors((c) =>
      c.map((e, idx) => (idx === i ? { ...e, [field]: val } : e)),
    );

  const toggleMaterial = (id: string) =>
    setSelMaterials((m) =>
      m.find((e) => e.id === id)
        ? m.filter((e) => e.id !== id)
        : [...m, { id, priceDelta: "0" }],
    );

  const updateMatDelta = (id: string, val: string) =>
    setSelMaterials((m) =>
      m.map((e) => (e.id === id ? { ...e, priceDelta: val } : e)),
    );

  const resetForm = () => {
    setName("");
    setCategory("sofa");
    setDescription("");
    setBasePrice("0");
    setStockQuantity("0");
    setScale("0.001");
    setDimW("1.0");
    setDimD("1.0");
    setDimH("1.0");
    setGlbFile(null);
    setThumbnail(null);
    setColors([{ name: "Үндсэн өнгө", hex: "#C9A37A", priceDelta: "0" }]);
    setSelMaterials([{ id: "wood", priceDelta: "0" }]);
    [glbRef, thumbRef].forEach((ref) => {
      if (ref.current) ref.current.value = "";
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !glbFile) {
      setError("Нэр болон GLB файл заавал шаардлагатай.");
      return;
    }

    if (glbFile.size > 50 * 1024 * 1024) {
      setError("GLB файл 50 MB-аас их байж болохгүй.");
      return;
    }
    if (colors.length === 0) {
      setError("Дор хаяж нэг өнгө оруулна уу.");
      return;
    }
    if (selMaterials.length === 0) {
      setError("Дор хаяж нэг материал сонгоно уу.");
      return;
    }

    if (!stockQuantity.trim() || !Number.isSafeInteger(Number(stockQuantity)) || Number(stockQuantity) < 0 || Number(stockQuantity) > 1_000_000) { setError("Нөөцийн тоог 0–1,000,000 хооронд бүхэл тоогоор оруулна уу."); return; }
    setUploading(true);
    setError(null);
    setSuccess(false);
    try {
      const colorsJson = JSON.stringify(
        colors.map((c, i) => ({
          id: `color_${i}`,
          name: c.name,
          hex: c.hex,
          priceDelta: parseFloat(c.priceDelta) || 0,
        })),
      );
      const matsJson = JSON.stringify(
        selMaterials.map((m) => {
          const opt = MATERIAL_OPTIONS.find((o) => o.id === m.id);
          return {
            id: m.id,
            name: opt?.name ?? m.id,
            priceDelta: parseFloat(m.priceDelta) || 0,
          };
        }),
      );

      const fd = new FormData();
      fd.append("name", name.trim());
      fd.append("category", category);
      fd.append("description", description);
      fd.append("basePrice", basePrice);
      fd.append("stockQuantity", stockQuantity);
      fd.append("scale", scale);
      fd.append("dimensionsW", dimW);
      fd.append("dimensionsD", dimD);
      fd.append("dimensionsH", dimH);
      fd.append("colors", colorsJson);
      fd.append("materials", matsJson);
      fd.append("glb", glbFile);
      if (thumbnail) fd.append("thumbnail", thumbnail);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Admin хэрэглэгчээр нэвтрэх шаардлагатай.");
      }

      const res = await fetch("/api/models/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: fd,
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? "Upload алдаа");
      }
      resetForm();
      setSuccess(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Алдаа гарлаа");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error("Admin хэрэглэгчээр нэвтрэх шаардлагатай.");
      }
      const res = await fetch(`/api/models/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!res.ok) throw new Error("Устгахад алдаа гарлаа.");
      setPendingDelete(null);
      await load();
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Устгахад алдаа гарлаа.",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const catLabel = (id: string) =>
    CATEGORY_OPTIONS.find((c) => c.id === id)?.name ?? id;

  return (
    <div>
      <div className="admin-page-heading"><div><span className="admin-eyebrow">ӨРӨӨНИЙ ТӨЛӨВЛӨГЧ</span><h1>3D загварууд</h1><p>Загвараа оруулж, хэмжээ, өнгө, материалыг тохируулаарай.</p></div><span className="admin-heading-icon"><Layers size={25} strokeWidth={1.5} /></span></div>
      <div className="admin-model-layout">
      <form
        onSubmit={handleSubmit}
        className="admin-model-form space-y-6"
      >
        <h2 className="flex items-center gap-2 text-base font-semibold"><Plus size={18} />Шинэ загвар нэмэх</h2>
        <fieldset disabled={uploading} className="min-w-0 space-y-6">

        {/* — Үндсэн мэдээлэл — */}
        <section>
          <p className="label mb-3">Үндсэн мэдээлэл</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="label mb-1 block">Нэр</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Жишээ нь: Тавны буйдан"
                className="input"
                required
              />
            </div>
            <div>
              <label className="label mb-1 block">Ангилал</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input"
              >
                {CATEGORY_OPTIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <label className="block text-sm">Нөөцийн үлдэгдэл (ширхэг)<input className="input mt-2" type="number" required min="0" max="1000000" step="1" value={stockQuantity} onChange={e => setStockQuantity(e.target.value)} /></label>
            <div>
              <label className="label mb-1 block">Үндсэн үнэ (₮)</label>
              <input
                type="number"
                min="0"
                value={basePrice}
                onChange={(e) => setBasePrice(e.target.value)}
                className="input"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="label mb-1 block">Тайлбар</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="input resize-none"
                placeholder="Товч тайлбар…"
              />
            </div>
          </div>
        </section>

        {/* — Хэмжээ — */}
        <section>
          <p className="label mb-3">Хэмжээ (метрээр) болон масштаб</p>
          <div className="grid gap-4 sm:grid-cols-4">
            <div>
              <label className="label mb-1 block">Өргөн (W)</label>
              <input
                type="number"
                step="any"
                value={dimW}
                onChange={(e) => setDimW(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label mb-1 block">Гүн (D)</label>
              <input
                type="number"
                step="any"
                value={dimD}
                onChange={(e) => setDimD(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label mb-1 block">Өндөр (H)</label>
              <input
                type="number"
                step="any"
                value={dimH}
                onChange={(e) => setDimH(e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label mb-1 block">Scale</label>
              <input
                type="number"
                step="any"
                value={scale}
                onChange={(e) => setScale(e.target.value)}
                className="input"
              />
              <p className="mt-1 text-xs text-ink/40">мм→м: 0.001</p>
            </div>
          </div>
        </section>

        {/* — Өнгөнүүд — */}
        <section>
          <div className="mb-3 flex items-center justify-between">
            <p className="label">Өнгөнүүд</p>
            <button
              type="button"
              onClick={addColor}
              className="text-xs font-medium text-clay hover:underline"
            >
              + Өнгө нэмэх
            </button>
          </div>
          <div className="space-y-2">
            {colors.map((c, i) => (
              <div key={i} className="admin-color-row">
                <input
                  type="color"
                  aria-label={`Өнгө ${i + 1}`}
                  value={c.hex}
                  onChange={(e) => updateColor(i, "hex", e.target.value)}
                  className="h-9 w-12 cursor-pointer rounded-md border border-ink/10 p-0.5"
                />
                <input
                  value={c.name}
                  aria-label={`Өнгө ${i + 1} нэр`}
                  onChange={(e) => updateColor(i, "name", e.target.value)}
                  placeholder="Нэр"
                  className="input flex-1 !py-2 text-sm"
                />
                <input
                  type="number"
                  value={c.priceDelta}
                  aria-label={`Өнгө ${i + 1} нэмэлт үнэ`}
                  onChange={(e) => updateColor(i, "priceDelta", e.target.value)}
                  placeholder="±₮"
                  className="input w-20 !py-2 text-sm"
                />
                {colors.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Өнгө ${i + 1} хасах`}
                    onClick={() => removeColor(i)}
                    className="text-ink/30 hover:text-red-500"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* — Материалууд — */}
        <section>
          <p className="label mb-3">Материалууд</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {MATERIAL_OPTIONS.map((opt) => {
              const sel = selMaterials.find((m) => m.id === opt.id);
              return (
                <div
                  key={opt.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border p-3 transition",
                    sel ? "border-clay/40 bg-clay/5" : "border-ink/10",
                  )}
                >
                  <input
                    type="checkbox"
                    aria-label={opt.name}
                    checked={!!sel}
                    onChange={() => toggleMaterial(opt.id)}
                    className="accent-clay h-4 w-4 cursor-pointer"
                  />
                  <span className="flex-1 text-sm">{opt.name}</span>
                  {sel && (
                    <input
                      type="number"
                      aria-label={`${opt.name} нэмэлт үнэ`}
                      value={sel.priceDelta}
                      onChange={(e) => updateMatDelta(opt.id, e.target.value)}
                      placeholder="±₮"
                      className="input w-20 !py-1.5 text-xs"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* — Файлууд — */}
        <section>
          <p className="label mb-3">Файлууд</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label mb-1 block">GLB файл *</label>
              <input
                ref={glbRef}
                type="file"
                accept=".glb,model/gltf-binary"
                required
                onChange={(event) =>
                  setGlbFile(event.target.files?.[0] ?? null)
                }
                className="input !py-2 file:mr-3 file:rounded-md file:border-0 file:bg-cream file:px-3 file:py-1 file:text-xs"
              />
              <p className="mt-1 text-xs text-ink/40">
                Файлын дээд хэмжээ: 50 MB
              </p>
            </div>

            <div>
              <label className="label mb-1 block">
                Thumbnail зураг{" "}
                <span className="font-normal text-ink/40">
                  (каталогт харагдана)
                </span>
              </label>
              <input
                ref={thumbRef}
                type="file"
                accept="image/*"
                onChange={(event) =>
                  setThumbnail(event.target.files?.[0] ?? null)
                }
                className="input !py-2 file:mr-3 file:rounded-md file:border-0 file:bg-cream file:px-3 file:py-1 file:text-xs"
              />
            </div>
          </div>
        </section>

        {error && (
          <p role="alert" className="admin-error">
            {error}
          </p>
        )}
        {success && (
          <p role="status" className="flex items-center gap-2 rounded-lg bg-sage/10 px-4 py-2 text-sm text-sage">
            <CheckCircle className="h-4 w-4" /> Амжилттай хуулагдлаа
          </p>
        )}

        <button type="submit" disabled={uploading} className="btn-primary">
          <Upload className="h-4 w-4" />
          {uploading ? "Загварыг оруулж байна…" : "Загвар хадгалах"}
        </button>
        </fieldset>
      </form>

      {/* Models list */}
      <div className="admin-model-list">
        <div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">
          {fetching ? "Уншиж байна…" : `${models.length} загвар`}
        </h2><button type="button" className="admin-edit-button" disabled={fetching} onClick={()=>void load()} aria-label="3D загварын жагсаалт шинэчлэх"><RefreshCw size={15} /></button></div>
        <div className="admin-toolbar"><label className="admin-search"><Search size={17} /><input aria-label="3D загвар хайх" placeholder="Загварын нэрээр хайх…" value={modelQuery} onChange={e=>setModelQuery(e.target.value)} /></label></div>
        {loadError && (
          <p className="mt-3 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-600">
            {loadError}
          </p>
        )}
        {models.length === 0 && !fetching && !loadError && (
          <p className="mt-4 rounded-xl bg-ink/5 p-4 text-sm text-ink/60">
            Одоогоор загвар байхгүй байна.
          </p>
        )}
        {modelQuery && !models.some(m=>m.name.toLowerCase().includes(modelQuery.trim().toLowerCase())) && <div className="admin-empty">Тохирох загвар олдсонгүй.</div>}
        <div className="admin-model-cards mt-3 space-y-3">
          {models.filter(m=>m.name.toLowerCase().includes(modelQuery.trim().toLowerCase())).map((m) => (
            <div
              key={m.id}
              className="admin-model-card"
            >
              <div className="flex items-center gap-4 min-w-0">
                {m.thumbnailFile ? (
                  <Image
                    src={`/api/models/files/${m.id}/${m.thumbnailFile}`}
                    alt={m.name}
                    width={56}
                    height={56}
                    unoptimized
                    className="h-14 w-14 flex-shrink-0 rounded-lg object-cover bg-cream"
                  />
                ) : (
                  <div className="h-14 w-14 flex-shrink-0 rounded-lg bg-cream flex items-center justify-center">
                    <Layers className="h-5 w-5 text-ink/30" />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-medium truncate">{m.name}</p><p className="mt-1 text-xs text-[#74806b]">{stockLabel(m)}</p>
                  <p className="mt-0.5 text-xs text-ink/50">
                    {catLabel(m.category)} · {m.dimensionsW}×{m.dimensionsD}×
                    {m.dimensionsH}м ·{" "}
                    {m.basePrice > 0
                      ? `₮${m.basePrice.toLocaleString()}`
                      : "Үнэгүй"}
                  </p>
                  <p className="mt-0.5 text-xs text-ink/40">
                    {m.glbFile} · scale {m.scale}
                  </p>
                </div>
              </div>
              <button
                type="button"
                aria-label={`${m.name} устгах`}
                onClick={() => setPendingDelete(m)}
                disabled={deletingId === m.id}
                className="flex-shrink-0 flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {deletingId === m.id ? "Устгаж байна…" : "Устгах"}
              </button>
            </div>
          ))}
        </div>
      </div>
      </div>
      {pendingDelete && <div className="admin-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingId) setPendingDelete(null); }}>
        <section className="admin-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-model-title" aria-describedby="delete-model-description" onKeyDown={(event) => { if (event.key === "Escape" && !deletingId) setPendingDelete(null); }}>
          <button type="button" className="admin-dialog-close" aria-label="Хаах" disabled={!!deletingId} onClick={() => setPendingDelete(null)}><X size={18} /></button>
          <span className="admin-dialog-icon"><Trash2 size={23} /></span>
          <h2 id="delete-model-title">3D загварыг устгах уу?</h2>
          <p id="delete-model-description"><strong>{pendingDelete.name}</strong> загвар болон холбогдох файлууд устгагдана. Энэ үйлдлийг буцаах боломжгүй.</p>
          <div className="admin-dialog-actions"><button type="button" className="btn-ghost" disabled={!!deletingId} onClick={() => setPendingDelete(null)} autoFocus>Болих</button><button type="button" className="admin-danger-button" disabled={!!deletingId} onClick={() => void handleDelete(pendingDelete.id)}>{deletingId ? "Устгаж байна…" : "Тийм, устгах"}</button></div>
        </section>
      </div>}
    </div>
  );
}

