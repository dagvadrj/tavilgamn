"use client";

import { PlannerLink as Link } from "@/components/PlannerLink";
import Image from "next/image";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Box,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  GitBranch,
  ImagePlus,
  LoaderCircle,
  MapPin,
  Pencil,
  RefreshCw,
  Ruler,
  Send,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { merchantRequest } from "@/features/merchant/merchantApi";
import { clearDashboardDraft, useDraftState } from "@/hooks/useDashboardDraft";
import {
  kitchenLifecycle,
  kitchenLifecycleLabel,
  kitchenPriceLabel,
  type KitchenDesignSummary,
  type KitchenRenderUsage,
  type KitchenVersionSaveMode,
} from "@/lib/kitchenMarketplace";
import {
  kitchenGalleryMedia,
  kitchenMediaLabel,
  kitchenRenderSource,
  kitchenRenderSources,
  type KitchenDesignMedia,
} from "@/lib/kitchenDesignMedia";
import {
  KITCHEN_LAYOUT_LABELS,
  KITCHEN_STYLE_LABELS,
} from "@/lib/kitchenListingSuggestions";
import { KitchenDesignGallery } from "./KitchenDesignGallery";
import {
  MerchantKitchenVersionEditor,
  kitchenListingPayload,
  type SavedKitchenSource,
} from "./MerchantKitchenVersionEditor";
import type { KitchenListingForm } from "./KitchenListingFields";
import "./kitchen-design-detail.css";
import "./merchant-kitchen-detail.css";

type DetailData = {
  design: KitchenDesignSummary;
  renderUsage: KitchenRenderUsage | null;
};
type DetailTab = "information" | "render" | "history";
const tabs: { id: DetailTab; label: string }[] = [
  { id: "information", label: "Мэдээлэл" },
  { id: "render", label: "AI render" },
  { id: "history", label: "Түүх" },
];
const date = (value: string) =>
  new Intl.DateTimeFormat("mn-MN", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
const reviewLabels = {
  approved: "Зөвшөөрсөн",
  changes_requested: "Засвар хүссэн",
  rejected: "Татгалзсан",
  unpublished: "Нийтлэл буулгасан",
};
const renderLabels = {
  queued: "Эхлэхэд бэлдэж байна",
  processing: "Зураг үүсгэж байна",
  completed: "Зураг бэлэн",
  failed: "Зураг үүссэнгүй",
  cancelled: "Цуцалсан",
};
const auditLabels: Record<string, string> = {
  design_created: "Загвар үүсгэсэн",
  version_created: "Хувилбар үүсгэсэн",
  version_edited: "Мэдээлэл зассан",
  submitted: "Хяналтад илгээсэн",
  approved: "Зөвшөөрсөн",
  changes_requested: "Засвар хүссэн",
  rejected: "Татгалзсан",
  published: "Нийтэлсэн",
  suspended: "Түдгэлзүүлсэн",
  archived: "Архивласан",
  media_insert: "Зураг нэмсэн",
  media_update: "Зураг шинэчилсэн",
  media_removed: "Зураг устгасан",
  render_queued: "AI render хүссэн",
  render_processing: "AI зураг үүсгэж эхэлсэн",
  render_completed: "AI зураг бэлэн болсон",
  render_failed: "AI зураг үүссэнгүй",
  render_cancelled: "AI хүсэлт цуцалсан",
  review_approved: "Хяналтаар зөвшөөрсөн",
  review_changes_requested: "Засвар хүссэн",
  review_rejected: "Хяналтаар татгалзсан",
  create: "Загвар үүсгэсэн",
  created: "Загвар үүсгэсэн",
  update: "Мэдээлэл шинэчилсэн",
  edit: "Мэдээлэл зассан",
  submit: "Хяналтад илгээсэн",
  approve: "Зөвшөөрсөн",
  publish: "Нийтэлсэн",
  archive: "Архивласан",
  add_media: "Зураг нэмсэн",
  request_render: "AI render хүссэн",
  complete_render: "AI render дууссан",
};

export function MerchantKitchenDesignDetail({
  owner,
  designId,
}: {
  owner: string;
  designId: string;
}) {
  const [data, setData] = useState<DetailData | null>(null);
  const [sources, setSources] = useState<SavedKitchenSource[]>([]);
  const sourcesCache = useRef<SavedKitchenSource[] | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("information");
  const [editing, setEditing] = useState<KitchenVersionSaveMode | null>(null);
  const [activeMediaId, setActiveMediaId] = useState<string | null>(null);
  const [preview, setPreview] = useState<KitchenDesignMedia | null>(null);
  const previewUrl = useRef<string | null>(null);
  const lastMedia = useRef<Set<string> | null>(null);
  const loadSequence = useRef(0);
  const thumbnailInput = useRef<HTMLInputElement>(null);
  const renderInput = useRef<HTMLInputElement>(null);
  const sourceInput = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const tabId = useId();
  const [direction, setDirection] = useDraftState(
    `merchant:${owner}:kitchen-detail:${designId}`,
    "renderDirection",
    "",
  );
  const [consent, setConsent] = useState(false);
  const [sourceMediaId, setSourceMediaId] = useDraftState<string | null>(
    `merchant:${owner}:kitchen-detail:${designId}`,
    "renderSourceMediaId",
    null,
  );
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [removingMedia, setRemovingMedia] = useState<KitchenDesignMedia | null>(
    null,
  );
  const removeDialog = useRef<HTMLDialogElement>(null);
  const removeTrigger = useRef<HTMLElement | null>(null);
  const archiveDialog = useRef<HTMLDialogElement>(null);
  const archiveButton = useRef<HTMLButtonElement>(null);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      const sequence = ++loadSequence.current;
      try {
        const [next, saved] = await Promise.all([
          merchantRequest<DetailData>(
            `/api/merchant/kitchen-designs/${designId}`,
            owner,
            { signal, cache: "no-store" },
          ),
          sourcesCache.current
            ? Promise.resolve({ kitchens: sourcesCache.current })
            : merchantRequest<{ kitchens: SavedKitchenSource[] }>(
                "/api/kitchens",
                owner,
                { signal },
              ).catch(() => ({ kitchens: [] })),
        ]);
        if (signal?.aborted || sequence !== loadSequence.current) return;
        const previousMedia = lastMedia.current;
        const added =
          previousMedia &&
          kitchenGalleryMedia(next.design.media).find(
            (item) => !previousMedia.has(item.id),
          );
        if (added) setActiveMediaId(added.id);
        lastMedia.current = new Set(next.design.media.map((item) => item.id));
        sourcesCache.current = saved.kitchens;
        setSources(saved.kitchens);
        setData(next);
      } catch (reason) {
        if (!signal?.aborted && sequence === loadSequence.current)
          setError(
            reason instanceof Error
              ? reason.message
              : "Загварыг ачаалж чадсангүй.",
          );
      }
    },
    [designId, owner],
  );

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => {
      controller.abort();
    };
  }, [load]);
  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );
  const hasPendingRender = data?.design.renderJobs.some(
    (job) => job.status === "queued" || job.status === "processing",
  );
  useEffect(() => {
    if (!hasPendingRender || busy) return;
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load(controller.signal);
    }, 8000);
    return () => {
      window.clearInterval(timer);
      controller.abort();
    };
  }, [hasPendingRender, busy, load]);
  useEffect(() => {
    if (archiveOpen) archiveDialog.current?.showModal();
  }, [archiveOpen]);
  useEffect(() => {
    if (removingMedia) removeDialog.current?.showModal();
  }, [removingMedia]);

  const design = data?.design;
  const aiSources = kitchenRenderSources(design?.media ?? []);
  const aiSource = kitchenRenderSource(design?.media ?? [], sourceMediaId);
  useEffect(() => {
    setConsent(false);
  }, [aiSource?.id, aiSource?.url, design?.versionId]);
  const sourcePreview = preview?.kind === "photo" ? preview : aiSource;
  const editable =
    !!design && !["archived", "suspended"].includes(design.publicationStatus);
  const openDraft =
    editable &&
    ["draft", "changes_requested"].includes(design?.reviewStatus ?? "");
  const sourceKitchen = sources.find(
    (item) => item.id === design?.sourceKitchenId,
  );
  const chooseTab = (next: DetailTab) => {
    setTab(next);
    setEditing(null);
  };
  const openEditor = (mode: KitchenVersionSaveMode) => {
    setTab("information");
    setEditing(mode);
    setError("");
    setNotice("");
    window.requestAnimationFrame(() => {
      panel.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      panel.current
        ?.querySelector<HTMLInputElement>("input")
        ?.focus({ preventScroll: true });
    });
  };

  async function uploadMedia(
    file: File | null,
    kind: "thumbnail" | "render" | "photo",
  ) {
    if (!file || !design || busy || !openDraft) return;
    if (
      !["image/jpeg", "image/png", "image/webp"].includes(file.type) ||
      file.size > 8 * 1024 * 1024 ||
      !file.size
    ) {
      setError("8 MB-аас ихгүй JPG, PNG эсвэл WebP зураг сонгоно уу.");
      return;
    }
    ++loadSequence.current;
    setBusy("upload");
    setError("");
    setNotice("");
    if (kind === "photo" || kind === "thumbnail") setConsent(false);
    const url = URL.createObjectURL(file);
    previewUrl.current = url;
    const temporary: KitchenDesignMedia = {
      id: `upload-${crypto.randomUUID()}`,
      url,
      kind,
      source: "merchant",
      altText: design.title,
      isPrimary: kind === "thumbnail",
      createdAt: new Date().toISOString(),
    };
    setPreview(temporary);
    setActiveMediaId(temporary.id);
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("versionId", design.versionId);
      form.set("kind", kind);
      form.set("isPrimary", String(kind === "thumbnail"));
      form.set("alt", design.title);
      const saved = await merchantRequest<{ id: string; url: string }>(
        `/api/merchant/kitchen-designs/${design.id}/media`,
        owner,
        { method: "POST", body: form },
      );
      const media: KitchenDesignMedia = {
        ...temporary,
        id: saved.id,
        url: saved.url,
      };
      setData((current) =>
        current
          ? {
              ...current,
              design: {
                ...current.design,
                media: [
                  ...current.design.media
                    .filter((item) => item.id !== media.id)
                    .map((item) =>
                      media.isPrimary ? { ...item, isPrimary: false } : item,
                    ),
                  media,
                ],
                thumbnailUrl: media.isPrimary
                  ? media.url
                  : current.design.thumbnailUrl,
              },
            }
          : current,
      );
      setPreview(null);
      setActiveMediaId(media.id);
      if (kind === "photo") setSourceMediaId(media.id);
      setNotice(
        kind === "photo"
          ? "AI render-ийн эх зураг нэмэгдлээ."
          : kind === "thumbnail"
            ? "Үндсэн зураг шинэчлэгдлээ."
            : "Render зураг gallery-д нэмэгдлээ.",
      );
      await load();
    } catch (reason) {
      setPreview(null);
      setActiveMediaId(null);
      setError(
        reason instanceof Error ? reason.message : "Зургийг хадгалж чадсангүй.",
      );
    } finally {
      URL.revokeObjectURL(url);
      previewUrl.current = null;
      setBusy(null);
    }
  }

  async function command(action: "submit" | "archive") {
    if (!design || busy) return;
    setBusy(action);
    setError("");
    setNotice("");
    try {
      await merchantRequest(
        `/api/merchant/kitchen-designs/${design.id}`,
        owner,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, versionId: design.versionId }),
        },
      );
      if (action === "archive") {
        archiveDialog.current?.close();
        setArchiveOpen(false);
      }
      setNotice(
        action === "submit"
          ? "Загварыг хяналтад илгээлээ."
          : "Загварыг архивлалаа.",
      );
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Үйлдэл амжилтгүй боллоо.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function removeMedia() {
    if (!design || !removingMedia || busy || !openDraft) return;
    const removed = removingMedia;
    setBusy("remove");
    setError("");
    setNotice("");
    ++loadSequence.current;
    try {
      const result = await merchantRequest<{
        replacementMediaId: string | null;
      }>(
        `/api/merchant/kitchen-designs/${design.id}/media/${removed.id}?versionId=${design.versionId}`,
        owner,
        { method: "DELETE" },
      );
      setData((current) => {
        if (!current) return current;
        const media = current.design.media
          .filter((item) => item.id !== removed.id)
          .map((item) =>
            item.id === result.replacementMediaId
              ? { ...item, isPrimary: true }
              : item,
          );
        return {
          ...current,
          design: {
            ...current.design,
            media,
            thumbnailUrl: kitchenGalleryMedia(media)[0]?.url ?? null,
          },
        };
      });
      setActiveMediaId((current) => (current === removed.id ? null : current));
      removeDialog.current?.close();
      setRemovingMedia(null);
      setNotice("Зураг gallery-ээс устгагдлаа.");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Зургийг устгаж чадсангүй.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function saveVersion(form: KitchenListingForm) {
    if (!design || !editing || busy) return;
    const mode = editing;
    setBusy("save");
    setError("");
    setNotice("");
    try {
      await merchantRequest(
        `/api/merchant/kitchen-designs/${design.id}`,
        owner,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            versionId: design.versionId,
            mode,
            ...kitchenListingPayload(form),
          }),
        },
      );
      void clearDashboardDraft(
        `merchant:${owner}:kitchen-version:${design.versionId}:${mode}`,
      );
      setEditing(null);
      setNotice("Загварын мэдээлэл хадгалагдлаа.");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "Мэдээллийг хадгалж чадсангүй.",
      );
    } finally {
      setBusy(null);
    }
  }

  async function requestRender() {
    if (!design || !aiSource || !consent || busy || !openDraft) return;
    setBusy("render");
    setError("");
    setNotice("");
    try {
      const result = await merchantRequest<{ mediaId: string }>(
        `/api/merchant/kitchen-designs/${design.id}/renders`,
        owner,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            versionId: design.versionId,
            sourceMediaId: aiSource.id,
            direction,
            consent: true,
          }),
        },
      );
      setDirection("");
      setConsent(false);
      setNotice("AI зураг бэлэн болж gallery-д нэмэгдлээ.");
      await load();
      setActiveMediaId(result.mediaId);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "AI зураг үүсгэж чадсангүй. Дахин оролдоно уу.",
      );
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function cancelRender(jobId: string) {
    if (busy) return;
    setBusy("cancel");
    setError("");
    setNotice("");
    try {
      await merchantRequest(`/api/kitchen-render-jobs/${jobId}/cancel`, owner, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: "Merchant хүсэлтээ цуцалсан" }),
      });
      setNotice("Render цуцлагдлаа.");
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Хүсэлт цуцалж чадсангүй.",
      );
    } finally {
      setBusy(null);
    }
  }

  const feedback = design?.reviews.find(
    (item) =>
      item.versionId === design.versionId &&
      ["changes_requested", "rejected"].includes(item.action),
  );
  const renderSource = design?.media.some(
    (item) => item.kind === "thumbnail" && item.isPrimary,
  );
  return (
    <section className="mk-detail">
      <nav className="mk-breadcrumb" aria-label="Буцах зам">
        <Link href="/merchant?tab=kitchens">
          <ArrowLeft size={15} />
          Гал тогооны загвар
        </Link>
        <ChevronRight size={13} />
        <span>Дэлгэрэнгүй</span>
      </nav>
      {error && (
        <p className="mk-message is-error" role="alert">
          {error}
          <button
            type="button"
            aria-label="Алдааны мэдэгдэл хаах"
            onClick={() => setError("")}
          >
            <X size={15} />
          </button>
        </p>
      )}
      {notice && (
        <p className="mk-message" role="status">
          <Check size={15} />
          {notice}
        </p>
      )}
      {!design ? (
        <div className="mk-loading">
          {error ? (
            <button
              className="btn-ghost"
              onClick={() => {
                setError("");
                void load();
              }}
            >
              <RefreshCw size={15} />
              Дахин оролдох
            </button>
          ) : (
            <>
              <LoaderCircle size={20} className="animate-spin" />
              Загварыг ачаалж байна…
            </>
          )}
        </div>
      ) : (
        <>
          <header className="mk-heading">
            <div>
              <span className="mk-eyebrow">ГАЛ ТОГООНЫ ЗАГВАР</span>
              <h1>{design.title}</h1>
            </div>
            <span className={`mk-status is-${kitchenLifecycle(design)}`}>
              <span />v{design.versionNo} ·{" "}
              {kitchenLifecycleLabel[kitchenLifecycle(design)]}
            </span>
          </header>
          <div className="mk-hero">
            <div className="mk-media">
              <KitchenDesignGallery
                media={preview ? [...design.media, preview] : design.media}
                title={design.title}
                activeMediaId={activeMediaId}
                pendingMediaId={preview?.id}
                onRemove={
                  openDraft
                    ? (item) => {
                        removeTrigger.current =
                          document.activeElement as HTMLElement;
                        setError("");
                        setRemovingMedia(item);
                      }
                    : undefined
                }
                removeDisabled={(item) =>
                  !!busy ||
                  !!design.renderJobs.some(
                    (job) =>
                      ["queued", "processing"].includes(job.status) &&
                      job.inputImageUrl === item.url,
                  )
                }
              />
              {openDraft && (
                <div className="mk-upload-bar">
                  <div>
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={!!busy}
                      onClick={() => thumbnailInput.current?.click()}
                    >
                      <Upload size={15} />
                      {renderSource ? "Thumbnail солих" : "Thumbnail нэмэх"}
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={!!busy}
                      onClick={() => renderInput.current?.click()}
                    >
                      <ImagePlus size={15} />
                      Render жишээ нэмэх
                    </button>
                  </div>
                  <small>
                    {busy === "upload"
                      ? "Зураг хадгалж байна…"
                      : "JPG, PNG, WebP · 8 MB хүртэл"}
                  </small>
                  <input
                    ref={thumbnailInput}
                    hidden
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={!!busy}
                    aria-label="Үндсэн зураг сонгох"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      event.target.value = "";
                      void uploadMedia(file, "thumbnail");
                    }}
                  />
                  <input
                    ref={renderInput}
                    hidden
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={!!busy}
                    aria-label="Render зураг сонгох"
                    onChange={(event) => {
                      const file = event.target.files?.[0] ?? null;
                      event.target.value = "";
                      void uploadMedia(file, "render");
                    }}
                  />
                </div>
              )}
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
                <small>
                  {design.pricingMode === "from" ? "Эхлэх үнэ" : "Үнэ"}
                </small>
                <strong>{kitchenPriceLabel(design)}</strong>
                <p>
                  {design.pricingMode === "quote"
                    ? "Өөрийн хэмжээ, материалаар үнийн санал гаргана."
                    : "Хэмжээ, материалын сонголтоос хамаарна."}
                </p>
              </div>
              <dl className="mk-facts">
                <div>
                  <dt>
                    <Ruler size={15} />
                    Өрөөний хэмжээ
                  </dt>
                  <dd>
                    {design.roomWidthMm} × {design.roomDepthMm} мм
                  </dd>
                </div>
                <div>
                  <dt>
                    <Box size={15} />
                    Бүрдэл
                  </dt>
                  <dd>{design.cabinetCount} модуль</dd>
                </div>
                <div>
                  <dt>
                    <CalendarDays size={15} />
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
                    <MapPin size={15} />
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
              {feedback && (
                <div className="mk-feedback">
                  <strong>Засварын тайлбар</strong>
                  <p>{feedback.note || "Хяналтын түүхийг шалгана уу."}</p>
                </div>
              )}
              <div className="mk-main-actions">
                {openDraft && (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!!busy || !!hasPendingRender || !renderSource}
                    onClick={() => void command("submit")}
                  >
                    <Send size={16} />
                    {busy === "submit" ? "Илгээж байна…" : "Хяналтад илгээх"}
                  </button>
                )}
                {openDraft && (
                  <button
                    type="button"
                    className="btn-ghost"
                    disabled={!!busy}
                    onClick={() => openEditor("edit")}
                  >
                    <Pencil size={15} />
                    Мэдээлэл засах
                  </button>
                )}
                {editable && !openDraft && sourceKitchen && (
                  <button
                    type="button"
                    className="btn-primary"
                    disabled={!!busy}
                    onClick={() => openEditor("new_version")}
                  >
                    <GitBranch size={15} />
                    Шинэ хувилбар үүсгэх
                  </button>
                )}
                {openDraft && (
                  <button
                    type="button"
                    className="mk-ai-link"
                    onClick={() => {
                      chooseTab("render");
                      window.requestAnimationFrame(() =>
                        panel.current?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        }),
                      );
                    }}
                  >
                    <Sparkles size={15} />
                    AI бодит render
                    <ArrowUpRight size={14} />
                  </button>
                )}
                {design.publicationStatus === "published" && (
                  <Link
                    className="mk-public-link"
                    href={`/kitchens/${design.slug}`}
                  >
                    Marketplace дээр харах
                    <ArrowUpRight size={14} />
                  </Link>
                )}
              </div>
              <p className="mk-publication-note">
                {hasPendingRender
                  ? "AI render дуусах эсвэл хүсэлт цуцлагдсаны дараа хяналтад илгээнэ."
                  : design.publicationStatus === "archived"
                    ? "Архивласан загвар засагдахгүй."
                    : design.publicationStatus === "suspended"
                      ? "Загварыг түр түдгэлзүүлсэн. Хяналтын тайлбарыг харна уу."
                      : design.reviewStatus === "approved" &&
                          design.publishedVersionId !== design.versionId
                        ? "Admin-аас нийтлэхийг хүлээж байна."
                        : design.reviewStatus === "submitted"
                          ? "Загварыг хяналтад илгээсэн байна."
                          : openDraft && !renderSource
                            ? "Хяналтад илгээхийн өмнө үндсэн зураг оруулаарай."
                            : design.publicationStatus === "published"
                              ? design.publishedVersionId === design.versionId
                                ? "Энэ хувилбар Marketplace дээр нийтлэгдсэн."
                                : "Өмнөх зөвшөөрөгдсөн хувилбар нийтэд хэвээр байна."
                              : "Зөвшөөрөгдсөний дараа Marketplace дээр нийтлэгдэнэ."}
              </p>
            </aside>
          </div>
          <div
            className="mk-tabs"
            role="tablist"
            aria-label="Загварын дэлгэрэнгүй"
          >
            {tabs.map((item, index) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                id={`${tabId}-${item.id}`}
                aria-controls={`${tabId}-panel`}
                aria-selected={tab === item.id}
                tabIndex={tab === item.id ? 0 : -1}
                onClick={() => chooseTab(item.id)}
                onKeyDown={(event) => {
                  if (
                    !["ArrowLeft", "ArrowRight", "Home", "End"].includes(
                      event.key,
                    )
                  )
                    return;
                  event.preventDefault();
                  const next =
                    event.key === "Home"
                      ? 0
                      : event.key === "End"
                        ? tabs.length - 1
                        : (index +
                            (event.key === "ArrowRight" ? 1 : -1) +
                            tabs.length) %
                          tabs.length;
                  chooseTab(tabs[next].id);
                  document.getElementById(`${tabId}-${tabs[next].id}`)?.focus();
                }}
              >
                {item.id === "render" ? (
                  <Sparkles size={15} />
                ) : item.id === "history" ? (
                  <Clock3 size={15} />
                ) : (
                  <Box size={15} />
                )}{" "}
                {item.label}
                {item.id === "render" && hasPendingRender && (
                  <span className="mk-tab-dot" />
                )}
              </button>
            ))}
          </div>
          <div
            ref={panel}
            className="mk-panel"
            id={`${tabId}-panel`}
            role="tabpanel"
            aria-labelledby={`${tabId}-${tab}`}
          >
            {tab === "information" &&
              (editing ? (
                <MerchantKitchenVersionEditor
                  key={`${design.versionId}:${editing}`}
                  owner={owner}
                  design={design}
                  sourceKitchen={sourceKitchen}
                  mode={editing}
                  busy={busy === "save"}
                  onCancel={() => setEditing(null)}
                  onSave={(form) => void saveVersion(form)}
                />
              ) : (
                <div className="mk-information">
                  <section className="mk-card">
                    <h2>Загварын тухай</h2>
                    <p className="mk-description">
                      {design.description ||
                        design.shortDescription ||
                        "Тайлбар хараахан оруулаагүй."}
                    </p>
                    <dl className="mk-specs">
                      <div>
                        <dt>Материал</dt>
                        <dd>{design.materials.join(", ") || "Оруулаагүй"}</dd>
                      </div>
                      <div>
                        <dt>Хэв маяг</dt>
                        <dd>
                          {KITCHEN_STYLE_LABELS[design.style] ?? design.style}
                        </dd>
                      </div>
                      <div>
                        <dt>Төлөвлөлт</dt>
                        <dd>
                          {KITCHEN_LAYOUT_LABELS[design.layout] ??
                            design.layout}
                        </dd>
                      </div>
                      <div>
                        <dt>Угсралт</dt>
                        <dd>
                          {design.installationIncluded
                            ? "Үнэд багтсан"
                            : "Тусад нь тооцно"}
                        </dd>
                      </div>
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
                        <Check size={14} />
                        Үнэд багтсан
                      </h3>
                      {design.inclusions.length ? (
                        <ul>
                          {design.inclusions.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>Бүрдлийн жагсаалтаа нэмээрэй.</p>
                      )}
                    </div>
                    <div className="mk-included is-excluded">
                      <h3>Үнэд багтаагүй</h3>
                      {design.exclusions.length ? (
                        <ul>
                          {design.exclusions.map((item) => (
                            <li key={item}>{item}</li>
                          ))}
                        </ul>
                      ) : (
                        <p>Тусад нь тооцох зүйл оруулаагүй.</p>
                      )}
                    </div>
                  </section>
                </div>
              ))}
            {tab === "render" && (
              <div className="mk-render-layout">
                <section className="mk-card">
                  <h2>
                    <Sparkles size={17} />
                    AI бодит render
                  </h2>
                  <p className="mk-muted">
                    Сонгосон зурагт тулгуурлан гэрэл, материалын дүрслэлийг
                    сайжруулна.
                  </p>
                  {openDraft ? (
                    <form
                      className="mk-render-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        void requestRender();
                      }}
                    >
                      <div
                        className="mk-render-source"
                        aria-busy={preview?.kind === "photo"}
                      >
                        <div className="mk-source-heading">
                          <span>Эх зураг</span>
                          <button
                            type="button"
                            className="btn-ghost"
                            disabled={!!busy || !!hasPendingRender}
                            onClick={() => sourceInput.current?.click()}
                          >
                            <Upload size={14} /> Зураг оруулах
                          </button>
                        </div>
                        {sourcePreview ? (
                          <div className="mk-source-preview">
                            <span className="mk-source-image">
                              <Image
                                src={sourcePreview.url}
                                alt="AI render-ийн сонгосон эх зураг"
                                fill
                                sizes="88px"
                                unoptimized={sourcePreview.url.startsWith(
                                  "blob:",
                                )}
                              />
                            </span>
                            <div>
                              <strong>
                                {preview?.kind === "photo" ? (
                                  <>
                                    <LoaderCircle
                                      size={13}
                                      className="animate-spin"
                                    />{" "}
                                    Оруулж байна…
                                  </>
                                ) : (
                                  "AI энэ зургийг ашиглана"
                                )}
                              </strong>
                              <small>
                                {kitchenMediaLabel(sourcePreview)} · JPG, PNG,
                                WebP · 8 MB хүртэл
                              </small>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="mk-source-empty"
                            disabled={!!busy || !!hasPendingRender}
                            onClick={() => sourceInput.current?.click()}
                          >
                            <ImagePlus size={22} />
                            <span>
                              Эх зураг сонгоно уу
                              <small>JPG, PNG, WebP · 8 MB хүртэл</small>
                            </span>
                          </button>
                        )}
                        {aiSources.length > 1 && (
                          <div
                            className="mk-source-options"
                            aria-label="Gallery-ээс render-ийн эх зураг сонгох"
                          >
                            {aiSources.map((item, index) => (
                              <button
                                type="button"
                                key={item.id}
                                aria-label={`${kitchenMediaLabel(item)} ${index + 1} — эх зураг сонгох`}
                                title={kitchenMediaLabel(item)}
                                aria-pressed={item.id === aiSource?.id}
                                disabled={!!busy || !!hasPendingRender}
                                onClick={() => {
                                  setSourceMediaId(item.id);
                                  setConsent(false);
                                }}
                              >
                                <Image
                                  src={item.url}
                                  alt=""
                                  fill
                                  sizes="60px"
                                />
                                {item.id === aiSource?.id && (
                                  <span>
                                    <Check size={11} />
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                        <input
                          ref={sourceInput}
                          hidden
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          aria-label="AI render-ийн эх зураг сонгох"
                          disabled={!!busy || !!hasPendingRender}
                          onChange={(event) => {
                            const file = event.target.files?.[0] ?? null;
                            event.target.value = "";
                            void uploadMedia(file, "photo");
                          }}
                        />
                      </div>
                      <label htmlFor={`${tabId}-direction`}>
                        Зургийн чиглэл <span>заавал биш</span>
                      </label>
                      <textarea
                        id={`${tabId}-direction`}
                        className="input"
                        rows={3}
                        maxLength={1000}
                        value={direction}
                        disabled={!!busy || !!hasPendingRender}
                        onChange={(event) => setDirection(event.target.value)}
                        placeholder="Жишээ: байгалийн гэрэл, царсан шал, минимал орчин"
                      />
                      <div className="mk-render-suggestions">
                        {[
                          "Байгалийн гэрэл, минимал орчин",
                          "Дулаан оройн гэрэл, царсан шал",
                        ].map((text) => (
                          <button
                            type="button"
                            key={text}
                            disabled={!!busy || !!hasPendingRender}
                            onClick={() => setDirection(text)}
                          >
                            {text}
                          </button>
                        ))}
                      </div>
                      <label className="mk-consent">
                        <input
                          type="checkbox"
                          checked={consent}
                          disabled={!!busy || !!hasPendingRender}
                          onChange={(event) => setConsent(event.target.checked)}
                        />
                        <span>
                          Энэ зургийг ашиглах эрхтэй бөгөөд AI үйлчилгээнд
                          илгээхийг зөвшөөрч байна.
                        </span>
                      </label>
                      <button
                        className="btn-primary"
                        disabled={
                          !!busy ||
                          !!hasPendingRender ||
                          !consent ||
                          !aiSource ||
                          !data?.renderUsage?.enabled ||
                          data.renderUsage.used >= data.renderUsage.limit
                        }
                      >
                        {busy === "render" ? (
                          <LoaderCircle size={15} className="animate-spin" />
                        ) : (
                          <Sparkles size={15} />
                        )}
                        {busy === "render"
                          ? "Зураг үүсгэж байна…"
                          : data.renderUsage &&
                              data.renderUsage.used >= data.renderUsage.limit
                            ? "3 render ашигласан"
                            : "AI render хийх"}
                      </button>
                      <small>
                        Нэг загварт 3 render. Алдаатай оролдлого тооцогдохгүй.
                      </small>
                    </form>
                  ) : (
                    <p className="mk-muted">
                      AI render хийхийн тулд засах боломжтой ноорог хувилбар
                      шаардлагатай.
                    </p>
                  )}
                </section>
                <section className="mk-card">
                  <div className="mk-card-heading">
                    <h2>Render түүх</h2>
                    <span>
                      {data?.renderUsage?.used ?? 0}/
                      {data?.renderUsage?.limit ?? 3} render
                    </span>
                  </div>
                  {!design.renderJobs.length ? (
                    <div className="mk-empty">
                      <ImagePlus size={25} />
                      <p>Render хараахан хийгээгүй</p>
                    </div>
                  ) : (
                    <ol className="mk-render-jobs">
                      {design.renderJobs.map((job) => (
                        <li key={job.id}>
                          <div>
                            <span className={`mk-job-status is-${job.status}`}>
                              {job.status === "processing" ? (
                                <LoaderCircle
                                  size={13}
                                  className="animate-spin"
                                />
                              ) : job.status === "completed" ? (
                                <Check size={13} />
                              ) : (
                                <Clock3 size={13} />
                              )}{" "}
                              {renderLabels[job.status]}
                            </span>
                            <time dateTime={job.createdAt}>
                              {date(job.createdAt)}
                            </time>
                          </div>
                          {job.error && (
                            <p className="mk-render-error">{job.error}</p>
                          )}
                          {job.outputMediaId &&
                            design.media.some(
                              (item) => item.id === job.outputMediaId,
                            ) && (
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveMediaId(job.outputMediaId);
                                  window.scrollTo({
                                    top: 0,
                                    behavior: "smooth",
                                  });
                                }}
                              >
                                Gallery-д харах
                                <ArrowUpRight size={13} />
                              </button>
                            )}
                          {job.status === "queued" && (
                            <button
                              type="button"
                              disabled={!!busy}
                              onClick={() => void cancelRender(job.id)}
                            >
                              Хүсэлт цуцлах
                            </button>
                          )}
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </div>
            )}
            {tab === "history" && (
              <div className="mk-history-layout">
                <section className="mk-card">
                  <h2>Хувилбар ба хяналт</h2>
                  <ol className="mk-timeline">
                    {design.versions.map((version) => (
                      <li key={version.id}>
                        <div>
                          <strong>
                            v{version.versionNo} · {version.title}
                          </strong>
                          <small>
                            {
                              kitchenLifecycleLabel[
                                kitchenLifecycle({
                                  publicationStatus: version.isPublished
                                    ? "published"
                                    : "draft",
                                  reviewStatus: version.reviewStatus,
                                })
                              ]
                            }
                          </small>
                          <time dateTime={version.createdAt}>
                            {date(version.createdAt)}
                          </time>
                        </div>
                      </li>
                    ))}
                    {design.reviews.map((review) => (
                      <li key={review.id}>
                        <div>
                          <strong>{reviewLabels[review.action]}</strong>
                          {review.note && <p>{review.note}</p>}
                          <time dateTime={review.createdAt}>
                            {date(review.createdAt)}
                          </time>
                        </div>
                      </li>
                    ))}
                  </ol>
                  {!design.versions.length && !design.reviews.length && (
                    <p className="mk-muted">Хяналтын түүх хараахан байхгүй.</p>
                  )}
                </section>
                <section className="mk-card">
                  <h2>Үйлдлийн бүртгэл</h2>
                  {design.audit.length ? (
                    <ol className="mk-audit">
                      {design.audit.map((event) => (
                        <li key={event.id}>
                          <span>
                            {auditLabels[event.action] ?? event.action}
                          </span>
                          <time dateTime={event.createdAt}>
                            {date(event.createdAt)}
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
          <footer className="mk-footer-actions">
            <div>
              {editable && design.sourceKitchenId && (
                <Link
                  className="btn-ghost"
                  href={`/kitchen?design=${design.sourceKitchenId}`}
                >
                  <Box size={15} />
                  3D editor нээх
                </Link>
              )}
              {openDraft && sourceKitchen && (
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={!!busy}
                  onClick={() => openEditor("sync_project")}
                >
                  <RefreshCw size={15} />
                  Хадгалсан 3D загвараас шинэчлэх
                </button>
              )}
            </div>
            {design.publicationStatus !== "archived" && (
              <button
                ref={archiveButton}
                type="button"
                className="mk-archive-button"
                disabled={!!busy}
                onClick={() => setArchiveOpen(true)}
              >
                <Trash2 size={14} />
                Архивлах
              </button>
            )}
          </footer>
          <dialog
            ref={archiveDialog}
            className="mk-confirm-dialog"
            aria-labelledby={`${tabId}-archive-title`}
            onClose={() => {
              setArchiveOpen(false);
              archiveButton.current?.focus();
            }}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void command("archive");
              }}
            >
              <h2 id={`${tabId}-archive-title`}>Загвар архивлах уу?</h2>
              <p>
                Загвар Marketplace дээр харагдахаа больж, засах боломжгүй болно.
              </p>
              <div>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={!!busy}
                  onClick={() => archiveDialog.current?.close()}
                >
                  Болих
                </button>
                <button className="btn-primary" disabled={!!busy}>
                  Архивлах
                </button>
              </div>
            </form>
          </dialog>
          <dialog
            ref={removeDialog}
            className="mk-confirm-dialog"
            aria-labelledby={`${tabId}-remove-title`}
            onClose={() => {
              setRemovingMedia(null);
              if (removeTrigger.current?.isConnected)
                removeTrigger.current.focus();
              else
                document
                  .querySelector<HTMLButtonElement>(
                    ".mk-media .kd-gallery-expand",
                  )
                  ?.focus();
            }}
          >
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void removeMedia();
              }}
            >
              <h2 id={`${tabId}-remove-title`}>Энэ зургийг устгах уу?</h2>
              {removingMedia && (
                <div className="mk-confirm-preview">
                  <Image
                    src={removingMedia.url}
                    alt="Устгах зураг"
                    fill
                    sizes="380px"
                  />
                </div>
              )}
              <p>
                Зураг энэ хувилбарын gallery-д харагдахаа болино.
                {removingMedia?.isPrimary &&
                  " Үндсэн зураггүй болбол хяналтад илгээхийн өмнө шинэ зураг оруулаарай."}
              </p>
              {error && (
                <p className="mk-render-error" role="alert">
                  {error}
                </p>
              )}
              <div>
                <button
                  type="button"
                  className="btn-ghost"
                  disabled={!!busy}
                  onClick={() => removeDialog.current?.close()}
                >
                  Болих
                </button>
                <button className="btn-primary" disabled={!!busy}>
                  {busy === "remove" ? "Устгаж байна…" : "Зураг устгах"}
                </button>
              </div>
            </form>
          </dialog>
        </>
      )}
    </section>
  );
}
