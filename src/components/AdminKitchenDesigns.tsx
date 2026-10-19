"use client";

import Image from "next/image";
import Link from "next/link";
import { KitchenDesignGallery } from "./KitchenDesignGallery";
import {
  KITCHEN_LAYOUT_LABELS,
  KITCHEN_STYLE_LABELS,
} from "@/lib/kitchenListingSuggestions";
import {
  isKitchenAiMedia,
  kitchenGalleryMedia,
} from "@/lib/kitchenDesignMedia";
import "./kitchen-design-detail.css";
import "./merchant-kitchen-detail.css";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  useRef,
  useId,
} from "react";
import { useDraftState, useDraftStatus } from "@/hooks/useDashboardDraft";
import { DashboardDraftNotice } from "./DashboardDraftNotice";
import {
  ArrowLeft,
  ArrowUpRight,
  Box,
  CalendarDays,
  ChevronRight,
  Clock3,
  ImageOff,
  MapPin,
  Ruler,
  Search,
  Check,
  EyeOff,
  LoaderCircle,
  RefreshCw,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { authFetch } from "@/lib/authFetch";
import type { KitchenDesignSummary } from "@/lib/kitchenMarketplace";
import {
  kitchenLifecycle,
  kitchenLifecycleLabel,
  kitchenPriceLabel,
} from "@/lib/kitchenMarketplace";
import { AdminKitchenMaterials } from "./AdminKitchenMaterials";
import { AdminKitchenModules } from "./AdminKitchenModules";
import { KitchenReviewTimeline } from "./KitchenReviewTimeline";

type ReviewAction =
  "approved" | "changes_requested" | "rejected" | "unpublished";
type AdminAction = ReviewAction | "published" | "suspended";

export function AdminKitchenDesigns({
  owner,
  designId,
}: {
  owner: string;
  designId?: string;
}) {
  const [section, setSection] = useState<"designs" | "modules" | "materials">(
    "designs",
  );
  const [panel, setPanel] = useState<"information" | "render" | "history">(
    "information",
  );
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const requestSequence = useRef(0);
  const newestAiMedia = useRef<string | null>(null);
  const tabId = useId();
  const [designs, setDesigns] = useState<KitchenDesignSummary[]>([]);
  const [filter, setFilter] = useState("all");
  const draftScope = `admin:${owner}:kitchen-review-notes`;
  const [note, setNote] = useDraftState<Record<string, string>>(
    draftScope,
    "note",
    {},
  );
  const draftStatus = useDraftStatus(draftScope);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [renderConfig, setRenderConfig] = useState<{
    provider: "openai" | "cloudflare";
    model: string;
    ready: boolean;
  } | null>(null);
  const load = useCallback(
    async (silent = false) => {
      const sequence = ++requestSequence.current;
      if (!silent) setError(null);
      try {
        const response = await authFetch(
          `/api/admin/kitchen-designs${designId ? `?design=${encodeURIComponent(designId)}` : ""}`,
          undefined,
          owner,
        );
        const data = await response.json().catch(() => null);
        if (!response.ok || !data)
          throw new Error(data?.error ?? "Мэдээллийг ачаалж чадсангүй.");
        if (sequence !== requestSequence.current) return;
        if (designId) {
          const latestAi = kitchenGalleryMedia(
            data.designs[0]?.media ?? [],
          ).find(isKitchenAiMedia);
          if (latestAi && latestAi.id !== newestAiMedia.current)
            setActiveMediaId(latestAi.id);
          newestAiMedia.current = latestAi?.id ?? null;
        }
        setDesigns(data.designs);
        setRenderConfig(data.renderConfig ?? null);
      } catch (reason) {
        if (sequence !== requestSequence.current) return;
        if (!silent)
          setError(
            reason instanceof Error
              ? reason.message
              : "Мэдээллийг ачаалж чадсангүй.",
          );
      } finally {
        if (sequence === requestSequence.current) setLoading(false);
      }
    },
    [owner, designId],
  );
  useEffect(() => {
    void load();
    const sequence = requestSequence;
    return () => {
      sequence.current++;
    };
  }, [load]);
  const activeRender = designs.some((design) =>
    design.renderJobs.some(
      (job) => job.status === "queued" || job.status === "processing",
    ),
  );
  useEffect(() => {
    if (!activeRender || busy) return;
    const timer = window.setInterval(() => void load(true), 8000);
    return () => window.clearInterval(timer);
  }, [activeRender, busy, load]);

  const visible = useMemo(
    () =>
      designs.filter(
        (item) =>
          (filter === "all" ||
            kitchenLifecycle(item) === filter ||
            (item.publicationStatus === "published" &&
              item.publishedVersionId !== item.versionId &&
              item.reviewStatus === filter)) &&
          [item.title, item.storeName, ...item.tags]
            .join(" ")
            .toLocaleLowerCase()
            .includes(search.trim().toLocaleLowerCase()),
      ),
    [designs, filter, search],
  );

  async function review(design: KitchenDesignSummary, action: AdminAction) {
    if (busy || draftStatus.loading) return;
    setBusy(`${design.id}:${action}`);
    setError(null);
    try {
      const response = await authFetch(
        "/api/admin/kitchen-designs",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            designId: design.id,
            versionId: design.versionId,
            action,
            note: note[design.id] ?? "",
          }),
        },
        owner,
      );
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(data?.error ?? "Шийдвэрийг хадгалж чадсангүй.");
      setNote((current) => ({ ...current, [design.id]: "" }));
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Шийдвэрийг хадгалж чадсангүй.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function generateRender(jobId: string) {
    if (busy || !renderConfig?.ready) return;
    const cloudflare = renderConfig.provider === "cloudflare";
    if (
      !window.confirm(
        cloudflare
          ? "Cloudflare FLUX.2 klein 4B-аар зураг үүсгэх үү? Өдрийн үнэгүй квотоос ашиглана."
          : "Энэ хүсэлтийг зөвшөөрч төлбөртэй AI зураг үүсгэх үү? Provider-ийн төлбөр бодогдоно.",
      )
    )
      return;
    setBusy(`render:${jobId}`);
    setError(null);
    try {
      const response = await authFetch(
        `/api/admin/kitchen-render-jobs/${jobId}/generate`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            approveCost: true,
            provider: renderConfig.provider,
          }),
        },
        owner,
      );
      const data = await response.json().catch(() => null);
      if (!response.ok)
        throw new Error(data?.error ?? "AI render үүсгэж чадсангүй.");
      await load();
      setActiveMediaId(data.mediaId ?? null);
      document
        .querySelector(".mk-media")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (reason) {
      await load(true);
      setError(
        reason instanceof Error
          ? reason.message
          : "AI render үүсгэж чадсангүй.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function cancelRender(jobId: string) {
    if (busy) return;
    const reason = window.prompt("AI render хүсэлтийг цуцлах шалтгаан:");
    if (!reason?.trim()) return;
    setBusy(`render:${jobId}`);
    setError(null);
    try {
      const response = await authFetch(
        `/api/kitchen-render-jobs/${jobId}/cancel`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ note: reason }),
        },
        owner,
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Цуцалж чадсангүй.");
      await load();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Цуцалж чадсангүй.");
    } finally {
      setBusy(null);
    }
  }

  const filters = [
    "all",
    "draft",
    "submitted",
    "changes_requested",
    "approved",
    "published",
    "suspended",
    "archived",
  ] as const;
  const panels = [
    { id: "information", label: "Мэдээлэл", icon: Box },
    { id: "render", label: "AI render", icon: Sparkles },
    { id: "history", label: "Түүх", icon: Clock3 },
  ] as const;
  const design = designs[0];
  const renderLabels = {
    queued: "Хүлээгдэж байна",
    processing: "Зураг үүсгэж байна",
    completed: "Зураг бэлэн",
    failed: "Амжилтгүй",
    cancelled: "Цуцалсан",
  };
  const formatDate = (value: string) =>
    new Intl.DateTimeFormat("mn-MN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  return (
    <section
      className={designId ? "mk-detail admin-kitchen-detail" : "mk-detail"}
    >
      {designId ? (
        <nav className="mk-breadcrumb" aria-label="Буцах зам">
          <Link href="/admin?tab=kitchens">
            <ArrowLeft size={14} />
            Гал тогооны загварууд
          </Link>
          <ChevronRight size={12} />
          <span>Дэлгэрэнгүй</span>
        </nav>
      ) : (
        <div className="admin-page-heading">
          <div>
            <span className="admin-eyebrow">MARKETPLACE</span>
            <h1>Гал тогооны загварууд</h1>
            <p>
              Загвараа сонгож зураг, мэдээлэл болон нийтлэх хүсэлтийг хянаарай.
            </p>
          </div>
          <button
            type="button"
            className="btn-ghost"
            disabled={loading || !!busy}
            onClick={() => void load()}
          >
            <RefreshCw size={16} />
            Шинэчлэх
          </button>
        </div>
      )}
      {error && (
        <p className="admin-error" role="alert">
          {error}
          <button
            type="button"
            className="btn-ghost"
            disabled={!!busy}
            onClick={() => void load()}
          >
            <RefreshCw size={14} />
            Дахин ачаалах
          </button>
        </p>
      )}
      {!designId && (
        <>
          <nav className="admin-kitchen-nav" aria-label="Гал тогооны удирдлага">
            {(
              [
                { id: "designs", label: "Загварууд" },
                { id: "modules", label: "Гал тогооны GLB сан" },
                { id: "materials", label: "Материалууд" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                className={section === item.id ? "btn-primary" : "btn-ghost"}
                aria-pressed={section === item.id}
                onClick={() => setSection(item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
          {section === "modules" && <AdminKitchenModules owner={owner} />}
          {section === "materials" && <AdminKitchenMaterials owner={owner} />}
          {section === "designs" && (
            <>
              <div className="admin-kitchen-toolbar">
                <label className="admin-search">
                  <Search size={17} />
                  <input
                    type="search"
                    aria-label="Загвар, дэлгүүр, tag-аар хайх"
                    placeholder="Загвар, дэлгүүр, tag-аар хайх…"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                  />
                </label>
                <span>{visible.length} загвар</span>
              </div>
              <div
                className="admin-kitchen-filters"
                aria-label="Загварын төлөвөөр шүүх"
              >
                {filters.map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={filter === value}
                    className={filter === value ? "btn-primary" : "btn-ghost"}
                    onClick={() => setFilter(value)}
                  >
                    {value === "all" ? "Бүгд" : kitchenLifecycleLabel[value]}
                  </button>
                ))}
              </div>
              <div className="admin-kitchen-list" aria-busy={loading}>
                {loading ? (
                  <p className="admin-kitchen-list-empty" role="status">
                    <LoaderCircle size={20} className="animate-spin mx-auto" />
                    Загваруудыг ачаалж байна…
                  </p>
                ) : (
                  visible.map((item) => {
                    const preview =
                      kitchenGalleryMedia(item.media)[0]?.url ??
                      item.thumbnailUrl;
                    return (
                      <Link
                        key={item.id}
                        href={`/admin/kitchens/${item.id}`}
                        className="admin-kitchen-row"
                      >
                        <span className="admin-kitchen-row-image">
                          {preview ? (
                            <Image
                              src={preview}
                              alt={item.title}
                              fill
                              sizes="88px"
                            />
                          ) : (
                            <ImageOff size={22} />
                          )}
                        </span>
                        <span className="admin-kitchen-row-copy">
                          <strong>{item.title}</strong>
                          <small>
                            {item.storeName} · v{item.versionNo} ·{" "}
                            {item.cabinetCount} модуль
                          </small>
                          <small>
                            {item.roomWidthMm} × {item.roomDepthMm} мм
                          </small>
                        </span>
                        <span className="admin-kitchen-row-price">
                          <strong>{kitchenPriceLabel(item)}</strong>
                          <span
                            className={`mk-status is-${kitchenLifecycle(item)}`}
                          >
                            {kitchenLifecycleLabel[kitchenLifecycle(item)]}
                          </span>
                        </span>
                        <ChevronRight size={17} />
                      </Link>
                    );
                  })
                )}
                {!loading && !visible.length && (
                  <p className="admin-kitchen-list-empty">
                    {search
                      ? "Хайлттай тохирох загвар олдсонгүй."
                      : "Энэ төлөвт загвар байхгүй."}
                  </p>
                )}
              </div>
            </>
          )}
        </>
      )}
      {designId &&
        (loading ? (
          <div className="mk-loading" role="status">
            <LoaderCircle size={22} className="animate-spin" />
            Загварын мэдээллийг ачаалж байна…
          </div>
        ) : !design ? (
          <p className="admin-kitchen-list-empty">Загвар олдсонгүй.</p>
        ) : (
          <>
            <header className="mk-heading">
              <div>
                <span className="mk-eyebrow">ГАЛ ТОГООНЫ ЗАГВАР · ХЯНАЛТ</span>
                <h1>{design.title}</h1>
              </div>
              <span className={`mk-status is-${kitchenLifecycle(design)}`}>
                v{design.versionNo} ·{" "}
                {kitchenLifecycleLabel[kitchenLifecycle(design)]}
              </span>
            </header>
            <div className="mk-hero">
              <div className="mk-media">
                <KitchenDesignGallery
                  media={design.media}
                  title={design.title}
                  activeMediaId={activeMediaId}
                />
                <p className="mk-muted">Зургийг сонгож, томруулж хараарай.</p>
              </div>
              <aside className="mk-summary">
                <div className="mk-summary-tags">
                  <span>
                    {KITCHEN_STYLE_LABELS[design.style] ?? design.style}
                  </span>
                  <span>
                    {KITCHEN_LAYOUT_LABELS[design.layout] ?? design.layout}
                  </span>
                </div>
                <div className="mk-price">
                  <span>{design.storeName}</span>
                  <strong>{kitchenPriceLabel(design)}</strong>
                  <small>
                    Merchant-ийн илгээсэн v{design.versionNo} хувилбар
                  </small>
                </div>
                <dl className="mk-facts">
                  <div>
                    <dt>
                      <Ruler size={14} />
                      Өрөөний хэмжээ
                    </dt>
                    <dd>
                      {design.roomWidthMm} × {design.roomDepthMm} мм
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <Box size={14} />
                      Бүрдэл
                    </dt>
                    <dd>{design.cabinetCount} модуль</dd>
                  </div>
                  <div>
                    <dt>
                      <CalendarDays size={14} />
                      Үйлдвэрлэх хугацаа
                    </dt>
                    <dd>
                      {design.leadTimeDays
                        ? `${design.leadTimeDays} хоног`
                        : "Тохиролцоно"}
                    </dd>
                  </div>
                  <div>
                    <dt>
                      <MapPin size={14} />
                      Үйлчилгээний бүс
                    </dt>
                    <dd>{design.serviceAreas.join(", ") || "Оруулаагүй"}</dd>
                  </div>
                </dl>
                {design.shortDescription && (
                  <p className="mk-short-description">
                    {design.shortDescription}
                  </p>
                )}
                <div className="mk-main-actions" aria-busy={!!busy}>
                  <DashboardDraftNotice scope={draftScope} disabled={!!busy} />
                  {(design.reviewStatus === "submitted" ||
                    ["published", "suspended"].includes(
                      design.publicationStatus,
                    )) && (
                    <label className="admin-review-label">
                      Хяналтын тайлбар
                      <textarea
                        disabled={!!busy || draftStatus.loading}
                        className="input min-h-20 w-full"
                        aria-label={`${design.title} хяналтын тайлбар`}
                        placeholder="Засвар хүсэх, түдгэлзүүлэх үед шалтгаан заавал бичнэ"
                        maxLength={5000}
                        value={note[design.id] ?? ""}
                        onChange={(event) =>
                          setNote((current) => ({
                            ...current,
                            [design.id]: event.target.value,
                          }))
                        }
                      />
                      <small>
                        Засвар хүсэх, түдгэлзүүлэх үед шалтгаан бичнэ.
                      </small>
                    </label>
                  )}
                  {design.reviewStatus === "submitted" &&
                    !["archived", "suspended"].includes(
                      design.publicationStatus,
                    ) && (
                      <>
                        <div className="admin-review-buttons">
                          <button
                            type="button"
                            className="btn-primary"
                            disabled={!!busy || draftStatus.loading}
                            onClick={() => void review(design, "approved")}
                          >
                            <Check size={15} />
                            Зөвшөөрөх
                          </button>
                          <button
                            type="button"
                            className="btn-ghost"
                            disabled={
                              !!busy ||
                              draftStatus.loading ||
                              !note[design.id]?.trim()
                            }
                            onClick={() =>
                              void review(design, "changes_requested")
                            }
                          >
                            <RotateCcw size={15} />
                            Засвар хүсэх
                          </button>
                        </div>
                      </>
                    )}
                  {design.reviewStatus === "approved" &&
                    design.publicationStatus !== "archived" &&
                    (design.publicationStatus !== "published" ||
                      design.publishedVersionId !== design.versionId) && (
                      <button
                        type="button"
                        className="btn-primary"
                        disabled={!!busy || draftStatus.loading}
                        onClick={() => void review(design, "published")}
                      >
                        <Check size={15} />
                        {design.publicationStatus === "suspended"
                          ? "Түдгэлзүүлэлтийг цуцалж нийтлэх"
                          : "Marketplace-д нийтлэх"}
                      </button>
                    )}
                  {design.publicationStatus === "suspended" &&
                    design.publishedVersionId &&
                    design.publishedVersionId !== design.versionId && (
                      <button
                        type="button"
                        className="btn-ghost"
                        disabled={!!busy || draftStatus.loading}
                        onClick={() =>
                          void review(
                            {
                              ...design,
                              versionId: design.publishedVersionId!,
                            },
                            "published",
                          )
                        }
                      >
                        Батлагдсан өмнөх хувилбарыг буцааж нийтлэх
                      </button>
                    )}
                  {design.publicationStatus === "published" && (
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={
                        !!busy ||
                        draftStatus.loading ||
                        !note[design.id]?.trim()
                      }
                      onClick={() => void review(design, "suspended")}
                    >
                      <EyeOff size={15} />
                      Түдгэлзүүлэх
                    </button>
                  )}

                  <button
                    type="button"
                    className="mk-ai-link"
                    onClick={() => {
                      setPanel("render");
                      requestAnimationFrame(() =>
                        document
                          .getElementById(`${tabId}-panel`)
                          ?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          }),
                      );
                    }}
                  >
                    <Sparkles size={14} />
                    AI render харах
                    <ArrowUpRight size={13} />
                  </button>
                </div>
                <p className="mk-publication-note">
                  Мэдээлэл болон зургуудыг шалгасны дараа хяналтын шийдвэр
                  гаргаарай.
                </p>
              </aside>
            </div>
            <div
              className="mk-tabs"
              role="tablist"
              aria-label="Загварын дэлгэрэнгүй"
            >
              {panels.map((item, index) => (
                <button
                  id={`${tabId}-${item.id}`}
                  key={item.id}
                  role="tab"
                  type="button"
                  aria-selected={panel === item.id}
                  aria-controls={`${tabId}-panel`}
                  tabIndex={panel === item.id ? 0 : -1}
                  onClick={() => setPanel(item.id)}
                  onKeyDown={(event) => {
                    const offset =
                      event.key === "ArrowRight"
                        ? 1
                        : event.key === "ArrowLeft"
                          ? -1
                          : 0;
                    if (!offset && event.key !== "Home" && event.key !== "End")
                      return;
                    event.preventDefault();
                    const next =
                      panels[
                        event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? panels.length - 1
                            : (index + offset + panels.length) % panels.length
                      ];
                    setPanel(next.id);
                    document.getElementById(`${tabId}-${next.id}`)?.focus();
                  }}
                >
                  <item.icon size={14} />
                  {item.label}
                  {item.id === "render" && activeRender && (
                    <span className="mk-tab-dot" />
                  )}
                </button>
              ))}
            </div>
            <div
              id={`${tabId}-panel`}
              className="mk-panel"
              role="tabpanel"
              aria-labelledby={`${tabId}-${panel}`}
              tabIndex={0}
            >
              {panel === "information" && (
                <div className="mk-information">
                  <section className="mk-card">
                    <h2>Загварын тухай</h2>
                    <p className="mk-description">
                      {design.description || "Дэлгэрэнгүй тайлбар оруулаагүй."}
                    </p>
                    <dl className="mk-specs">
                      {[
                        [
                          "Материал",
                          design.materials.join(", ") || "Оруулаагүй",
                        ],
                        [
                          "Хэв маяг",
                          KITCHEN_STYLE_LABELS[design.style] ?? design.style,
                        ],
                        [
                          "Төлөвлөлт",
                          KITCHEN_LAYOUT_LABELS[design.layout] ?? design.layout,
                        ],
                        [
                          "Өрөөний хэмжээ",
                          `${design.roomWidthMm} × ${design.roomDepthMm} × ${design.maxHeightMm} мм`,
                        ],
                        [
                          "Угсралт",
                          design.installationIncluded
                            ? "Үнэд багтсан"
                            : "Үнэд багтаагүй",
                        ],
                      ].map(([label, value]) => (
                        <div key={label}>
                          <dt>{label}</dt>
                          <dd>{value}</dd>
                        </div>
                      ))}
                    </dl>
                    {design.tags.length > 0 && (
                      <div className="mk-tags">
                        {design.tags.map((tag) => (
                          <span key={tag}>#{tag}</span>
                        ))}
                      </div>
                    )}
                  </section>
                  <section className="mk-card">
                    <h2>Үнэ ба бүрдэл</h2>
                    <div className="mk-included">
                      <h3>
                        <Check size={13} />
                        Үнэд багтсан
                      </h3>
                      {design.inclusions.length ? (
                        <ul>
                          {design.inclusions.map((value) => (
                            <li key={value}>{value}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>Оруулаагүй</p>
                      )}
                    </div>
                    <div className="mk-included is-excluded">
                      <h3>Үнэд багтаагүй</h3>
                      {design.exclusions.length ? (
                        <ul>
                          {design.exclusions.map((value) => (
                            <li key={value}>{value}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>Оруулаагүй</p>
                      )}
                    </div>
                  </section>
                </div>
              )}
              {panel === "render" && (
                <div className="mk-render-layout">
                  <section className="mk-card">
                    <h2>
                      <Sparkles size={16} />
                      AI бодит render
                    </h2>
                    <p className="mk-muted">
                      Merchant загвар бүрт 3 render үүсгэх боломжтой. Бэлэн
                      зургууд gallery-д шууд харагдана.
                    </p>
                    <p className="mk-muted">
                      {renderConfig?.provider === "cloudflare"
                        ? "FLUX.2 klein 4B · Cloudflare · Өдрийн үнэгүй квот"
                        : (renderConfig?.model ?? "AI тохиргоо ачаалж байна")}
                    </p>
                    <p className="mk-muted">
                      {
                        design.renderJobs.filter(
                          (job) => job.status === "completed",
                        ).length
                      }{" "}
                      бэлэн зураг ·{" "}
                      {
                        design.renderJobs.filter((job) =>
                          ["queued", "processing"].includes(job.status),
                        ).length
                      }{" "}
                      үүсгэж байна
                    </p>
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={!!busy}
                      onClick={() => void load()}
                    >
                      <RefreshCw size={14} />
                      Төлөв шинэчлэх
                    </button>
                    {!renderConfig?.ready && (
                      <p className="mk-render-error">
                        Зураг үүсгэх тохиргоо одоогоор бэлэн биш байна.
                      </p>
                    )}
                  </section>
                  <section className="mk-card">
                    <h2>Render-ийн түүх</h2>
                    {!design.renderJobs.length ? (
                      <p className="mk-muted">Зураг хараахан үүсгээгүй.</p>
                    ) : (
                      <ol className="mk-render-jobs">
                        {design.renderJobs.map((job) => (
                          <li key={job.id}>
                            <span className={`mk-job-status is-${job.status}`}>
                              {(job.status === "queued" ||
                                job.status === "processing") && (
                                <LoaderCircle
                                  size={13}
                                  className="animate-spin"
                                />
                              )}
                              {renderLabels[job.status]}
                            </span>
                            <small>{formatDate(job.createdAt)}</small>
                            {job.inputImageUrl && (
                              <span className="mk-render-source-img">
                                <Image
                                  src={job.inputImageUrl}
                                  alt="Render-ийн эх зураг"
                                  fill
                                  sizes="88px"
                                />
                              </span>
                            )}
                            <p className="mk-muted">{job.model}</p>
                            <p className="mk-description">{job.prompt}</p>
                            {job.error && (
                              <p className="mk-render-error">{job.error}</p>
                            )}
                            {job.status === "completed" &&
                              job.outputMediaId && (
                                <button
                                  className="btn-ghost"
                                  type="button"
                                  onClick={() => {
                                    setActiveMediaId(job.outputMediaId);
                                    document
                                      .querySelector(".mk-media")
                                      ?.scrollIntoView({
                                        behavior: "smooth",
                                        block: "start",
                                      });
                                  }}
                                >
                                  Бэлэн зураг харах
                                  <ArrowUpRight size={13} />
                                </button>
                              )}
                            {job.status === "queued" && (
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  className="btn-primary"
                                  disabled={!!busy || !renderConfig?.ready}
                                  onClick={() => void generateRender(job.id)}
                                >
                                  {busy === `render:${job.id}` ? (
                                    <LoaderCircle
                                      size={14}
                                      className="animate-spin"
                                    />
                                  ) : (
                                    <Sparkles size={14} />
                                  )}
                                  {busy === `render:${job.id}`
                                    ? "Зураг үүсгэж байна…"
                                    : "Зураг үүсгэх"}
                                </button>
                                <button
                                  type="button"
                                  className="btn-ghost"
                                  disabled={!!busy}
                                  onClick={() => void cancelRender(job.id)}
                                >
                                  Цуцлах
                                </button>
                              </div>
                            )}
                          </li>
                        ))}
                      </ol>
                    )}
                  </section>
                </div>
              )}
              {panel === "history" && (
                <div className="mk-history-layout">
                  <section className="mk-card">
                    <h2>Хувилбар ба хяналтын түүх</h2>
                    <KitchenReviewTimeline design={design} defaultOpen />
                  </section>
                  <section className="mk-card">
                    <h2>Үйлдлийн бүртгэл</h2>
                    {design.audit.length ? (
                      <ol className="mk-audit">
                        {design.audit.map((event) => (
                          <li key={event.id}>
                            <span>{event.action}</span>
                            <time dateTime={event.createdAt}>
                              {formatDate(event.createdAt)}
                            </time>
                          </li>
                        ))}
                      </ol>
                    ) : (
                      <p className="mk-muted">Үйлдэл бүртгэгдээгүй.</p>
                    )}
                  </section>
                </div>
              )}
            </div>
          </>
        ))}
    </section>
  );
}
