"use client";
import { PageSkeleton } from "@/components/PageSkeleton";
import {
  useDraftState,
  useDraftStatus,
  clearDashboardDraft,
} from "@/hooks/useDashboardDraft";
import { DashboardDraftNotice } from "@/components/DashboardDraftNotice";

import Image from "next/image";
import { PlannerLink as Link } from "@/components/PlannerLink";
import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ChevronRight,
  LoaderCircle,
  Plus,
  RefreshCw,
  Store,
  Upload,
  X,
} from "lucide-react";
import { readMerchantResource } from "@/features/merchant/useMerchantResource";
import { merchantRequest as request } from "@/features/merchant/merchantApi";
import type {
  KitchenDesignSummary,
  KitchenRenderUsage,
} from "@/lib/kitchenMarketplace";
import {
  kitchenLifecycle,
  kitchenLifecycleLabel,
  kitchenPriceLabel,
} from "@/lib/kitchenMarketplace";
import {
  KitchenListingFields,
  type KitchenListingForm as ListingForm,
} from "./KitchenListingFields";
import {
  kitchenListingSuggestions,
  kitchenListTokens,
} from "@/lib/kitchenListingSuggestions";
import { kitchenGlbListingSuggestions } from "@/lib/kitchenDesignGlb";
import { kitchenGlbPlannerKitchen } from "@/lib/kitchenGlbModules";
import {
  KitchenGlbSourceField,
  type KitchenGlbUpload,
} from "./KitchenGlbSourceField";

type SavedKitchen = { id: string; name: string; design: unknown };
type LoadResult = {
  eligible: boolean;
  storeType: string | null;
  designs: KitchenDesignSummary[];
  renderUsage: KitchenRenderUsage | null;
};

const splitList = kitchenListTokens;

export function MerchantKitchenDesigns({
  owner,
  focusedDesignId = null,
}: {
  owner: string;
  focusedDesignId?: string | null;
}) {
  const draftScope = `merchant:${owner}:kitchen-create`;
  const [data, setData] = useState<LoadResult | null>(null);
  const [kitchens, setKitchens] = useState<SavedKitchen[]>([]);
  const [sourceKitchenId, setSourceKitchenId] = useDraftState(
    draftScope,
    "sourceKitchenId",
    "",
  );
  const [sourceType, setSourceType] = useDraftState<"project" | "glb">(
    draftScope,
    "sourceType",
    "project",
  );
  // The prepared upload lives only in this tab; a reload asks for the file again.
  const [glbUpload, setGlbUpload] = useState<KitchenGlbUpload | null>(null);
  const [glbLayout, setGlbLayout] = useDraftState(
    draftScope,
    "glbLayout",
    "straight",
  );
  const [glbModules, setGlbModules] = useDraftState(
    draftScope,
    "glbModules",
    "",
  );
  const [title, setTitle] = useDraftState(draftScope, "title", "");
  const [shortDescription, setShortDescription] = useDraftState(
    draftScope,
    "shortDescription",
    "",
  );
  const [description, setDescription] = useDraftState(
    draftScope,
    "description",
    "",
  );
  const [style, setStyle] = useDraftState(draftScope, "style", "modern");
  const [pricingMode, setPricingMode] = useDraftState<
    "fixed" | "from" | "quote"
  >(draftScope, "pricingMode", "quote");
  const [priceFrom, setPriceFrom] = useDraftState(draftScope, "priceFrom", "");
  const [priceTo, setPriceTo] = useDraftState(draftScope, "priceTo", "");
  const [materials, setMaterials] = useDraftState(draftScope, "materials", "");
  const [leadTimeDays, setLeadTimeDays] = useDraftState(
    draftScope,
    "leadTimeDays",
    "",
  );
  const [installationIncluded, setInstallationIncluded] = useDraftState(
    draftScope,
    "installationIncluded",
    false,
  );
  const [tags, setTags] = useDraftState(draftScope, "tags", "");
  const [serviceAreas, setServiceAreas] = useDraftState(
    draftScope,
    "serviceAreas",
    "Улаанбаатар",
  );
  const [inclusions, setInclusions] = useDraftState(
    draftScope,
    "inclusions",
    "",
  );
  const [exclusions, setExclusions] = useDraftState(
    draftScope,
    "exclusions",
    "",
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const createId = useId();
  const createForm = useRef<HTMLFormElement>(null);
  const createButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!createOpen) return;
    createForm.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    createForm.current
      ?.querySelector<HTMLElement>('.km-source-switch [aria-pressed="true"]')
      ?.focus({ preventScroll: true });
  }, [createOpen]);
  const closeCreate = () => {
    setCreateOpen(false);
    createButton.current?.focus();
  };

  const isGlb = sourceType === "glb";
  const selectedKitchen = isGlb
    ? undefined
    : kitchens.find((item) => item.id === sourceKitchenId);
  // Editing the detected modules re-derives the listing, so they are part of the key.
  const glbModuleKey =
    glbUpload?.detection.modules
      .map((item) => `${item.role}:${item.widthMm}:${item.name}`)
      .join("|") ?? "";
  const sourceKey = isGlb
    ? glbUpload
      ? `glb:${glbUpload.uploadId}:${glbModuleKey}`
      : ""
    : sourceKitchenId;
  const glbHints = useMemo(
    () =>
      glbUpload
        ? kitchenGlbListingSuggestions(
            glbUpload.info,
            glbUpload.fileName,
            style,
            glbUpload.detection,
          )
        : null,
    [glbUpload, style],
  );
  const sourceName = isGlb
    ? (glbHints?.titles[0] ?? "")
    : (selectedKitchen?.name ?? "");
  const suggestions = useMemo(
    () =>
      isGlb
        ? glbHints
        : kitchenListingSuggestions(
            selectedKitchen?.design,
            selectedKitchen?.name,
            style,
          ),
    [isGlb, glbHints, selectedKitchen?.design, selectedKitchen?.name, style],
  );
  // Layout follows each upload; the module count follows every module edit.
  const lastGlbUpload = useRef<string | null>(null);
  useEffect(() => {
    if (!glbUpload || !glbHints) return;
    if (lastGlbUpload.current !== glbUpload.uploadId) {
      lastGlbUpload.current = glbUpload.uploadId;
      setGlbLayout(glbHints.layout);
    }
    if (glbHints.cabinetCount) setGlbModules(String(glbHints.cabinetCount));
  }, [glbUpload, glbHints, setGlbLayout, setGlbModules]);
  const lastSource = useRef<{
    id: string;
    name: string;
    materials: string[];
    inclusions: string[];
    exclusions: string[];
    shortDescription: string;
    description: string;
    tags: string[];
  } | null>(null);
  const form: ListingForm = {
    title,
    shortDescription,
    description,
    style,
    pricingMode,
    priceFrom,
    priceTo,
    materials,
    leadTimeDays,
    warrantyMonths: "",
    installationIncluded,
    tags,
    serviceAreas,
    inclusions,
    exclusions,
  };
  const formField = <K extends keyof ListingForm>(
    key: K,
    value: ListingForm[K],
  ) => {
    const setters = {
      title: setTitle,
      shortDescription: setShortDescription,
      description: setDescription,
      style: setStyle,
      priceFrom: setPriceFrom,
      priceTo: setPriceTo,
      materials: setMaterials,
      leadTimeDays: setLeadTimeDays,
      tags: setTags,
      serviceAreas: setServiceAreas,
      inclusions: setInclusions,
      exclusions: setExclusions,
    };
    if (key === "pricingMode")
      setPricingMode(value as ListingForm["pricingMode"]);
    else if (key === "installationIncluded")
      setInstallationIncluded(value as boolean);
    else if (key !== "warrantyMonths")
      setters[key as keyof typeof setters](value as string);
  };
  const draftStatus = useDraftStatus(draftScope);
  useEffect(() => {
    if (
      draftStatus.loading ||
      !suggestions ||
      lastSource.current?.id === sourceKey
    )
      return;
    const previous = lastSource.current;
    const reconcile = (current: string, before: string[], next: string[]) => {
      if (!previous && current.trim()) return current;
      const beforeKeys = new Set(
        before.map((item) => item.toLocaleLowerCase("mn")),
      );
      return kitchenListTokens(
        [
          ...splitList(current).filter(
            (item) => !beforeKeys.has(item.toLocaleLowerCase("mn")),
          ),
          ...next,
        ].join("\n"),
      ).join("\n");
    };
    const nextInclusions = reconcile(
      inclusions,
      previous?.inclusions ?? [],
      suggestions.inclusions,
    );
    const includedKeys = new Set(
      splitList(nextInclusions).map((item) => item.toLocaleLowerCase("mn")),
    );
    setInclusions(nextInclusions);
    setExclusions(
      splitList(
        reconcile(
          exclusions,
          previous?.exclusions ?? [],
          suggestions.exclusions,
        ),
      )
        .filter((item) => !includedKeys.has(item.toLocaleLowerCase("mn")))
        .join("\n"),
    );
    if (!previous && !serviceAreas.trim()) setServiceAreas("Улаанбаатар");
    if (!title.trim() || (previous && title === previous.name))
      setTitle(sourceName);
    setMaterials(
      reconcile(materials, previous?.materials ?? [], suggestions.materials),
    );
    // Texts and tags are filled while empty or still the previous suggestion.
    const nextShort = suggestions.shortDescriptions[0] ?? "";
    const nextDescription = suggestions.descriptions[0] ?? "";
    if (
      !shortDescription.trim() ||
      shortDescription === previous?.shortDescription
    )
      setShortDescription(nextShort);
    if (!description.trim() || description === previous?.description)
      setDescription(nextDescription);
    setTags(reconcile(tags, previous?.tags ?? [], suggestions.tags));
    lastSource.current = {
      id: sourceKey,
      name: sourceName,
      materials: suggestions.materials,
      inclusions: suggestions.inclusions,
      exclusions: suggestions.exclusions,
      shortDescription: nextShort,
      description: nextDescription,
      tags: suggestions.tags,
    };
  }, [
    draftStatus.loading,
    suggestions,
    sourceKey,
    sourceName,
    title,
    materials,
    inclusions,
    exclusions,
    serviceAreas,
    shortDescription,
    description,
    tags,
    setInclusions,
    setExclusions,
    setTitle,
    setMaterials,
    setServiceAreas,
    setShortDescription,
    setDescription,
    setTags,
  ]);
  const load = useCallback(
    async (force = true) => {
      setError(null);
      try {
        const [marketplace, saved] = await Promise.all([
          readMerchantResource<LoadResult>(
            owner,
            "/api/merchant/kitchen-designs",
            force,
          ),
          readMerchantResource<{ kitchens: SavedKitchen[] }>(
            owner,
            "/api/kitchens",
            force,
          ),
        ]);
        setData(marketplace);
        setKitchens(saved.kitchens);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : "Мэдээллийг ачаалж чадсангүй.",
        );
      }
    },
    [owner],
  );

  useEffect(() => {
    if (!draftStatus.loading && !sourceKitchenId && kitchens[0])
      setSourceKitchenId(kitchens[0].id);
  }, [draftStatus.loading, sourceKitchenId, kitchens, setSourceKitchenId]);

  useEffect(() => {
    void load(false);
  }, [load]);

  useEffect(() => {
    if (
      !focusedDesignId ||
      !data?.designs.some((design) => design.id === focusedDesignId)
    )
      return;

    const frame = window.requestAnimationFrame(() => {
      const card = document.getElementById(
        `merchant-kitchen-${focusedDesignId}`,
      );
      card?.scrollIntoView({ behavior: "smooth", block: "center" });
      card?.focus({ preventScroll: true });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [data?.designs, focusedDesignId]);

  async function createDraft(event: React.FormEvent) {
    event.preventDefault();
    if (busy || draftStatus.loading) return;
    setBusy("create");
    setError(null);
    try {
      if (isGlb && !glbUpload)
        throw new Error("GLB файлаа оруулж, бэлэн болохыг хүлээнэ үү.");
      const created = await request<{ designId: string; versionId: string }>(
        "/api/merchant/kitchen-designs",
        owner,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(isGlb && glbUpload
              ? {
                  source: "glb",
                  modelUploadId: glbUpload.uploadId,
                  layout: glbLayout,
                  cabinetCount: glbModules || null,
                  // The confirmed modules become separate, editable planner cabinets.
                  planner: kitchenGlbPlannerKitchen(
                    glbUpload.detection.modules,
                    glbUpload.parts,
                    {
                      heightMm: glbUpload.info.heightMm,
                      layout: glbLayout as "straight",
                      backsplash: glbUpload.detection.backsplashM2 > 0,
                      countertopColor: glbUpload.detection.countertopColor,
                      countertopKind: glbUpload.detection.countertopKind,
                      appliances: glbUpload.detection.appliances,
                    },
                  ),
                }
              : { sourceKitchenId }),
            title,
            shortDescription,
            description,
            style,
            pricingMode,
            priceFrom: pricingMode === "quote" ? null : priceFrom || null,
            priceTo: pricingMode === "from" ? priceTo || null : null,
            materials: splitList(materials),
            leadTimeDays: leadTimeDays || null,
            warrantyMonths: null,
            installationIncluded,
            tags: splitList(tags),
            serviceAreas: splitList(serviceAreas),
            inclusions: splitList(inclusions),
            exclusions: splitList(exclusions),
          }),
        },
      );
      if (isGlb && glbUpload) {
        // Publication requires a primary thumbnail; the 3D capture is that picture.
        const media = new FormData();
        media.set("file", glbUpload.thumbnail);
        media.set("versionId", created.versionId);
        media.set("kind", "thumbnail");
        media.set("isPrimary", "true");
        media.set("alt", title);
        await request(
          `/api/merchant/kitchen-designs/${created.designId}/media`,
          owner,
          { method: "POST", body: media },
        ).catch(() => {
          setError(
            "Загвар хадгалагдсан ч нүүр зургийг оруулж чадсангүй. Дэлгэрэнгүй хэсгээс зураг нэмнэ үү.",
          );
        });
        // Other sides, the 3D view and the numbered BOM sheet follow the thumbnail.
        const bomSheet = await glbUpload.captureBom?.().catch(() => null);
        const extras = [
          ...glbUpload.renders.map((file) => ({ file, kind: "render" })),
          ...(bomSheet ? [{ file: bomSheet, kind: "plan" }] : []),
        ];
        for (const extra of extras) {
          const picture = new FormData();
          picture.set("file", extra.file);
          picture.set("versionId", created.versionId);
          picture.set("kind", extra.kind);
          picture.set("isPrimary", "false");
          picture.set("alt", title);
          await request(
            `/api/merchant/kitchen-designs/${created.designId}/media`,
            owner,
            { method: "POST", body: picture },
          ).catch(() => null);
        }
      }
      void clearDashboardDraft(draftScope);
      setGlbUpload(null);
      lastGlbUpload.current = null;
      setGlbModules("");
      setGlbLayout("straight");
      lastSource.current = null;
      setTitle("");
      setShortDescription("");
      setDescription("");
      setStyle("modern");
      setPricingMode("quote");
      setPriceFrom("");
      setPriceTo("");
      setMaterials("");
      setLeadTimeDays("");
      setInstallationIncluded(false);
      setTags("");
      setServiceAreas("Улаанбаатар");
      setInclusions("");
      setExclusions("");
      closeCreate();
      await load();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : "Draft үүсгэж чадсангүй.",
      );
    } finally {
      setBusy(null);
    }
  }

  if (!data && !error) return <PageSkeleton compact layout="list" />;
  return (
    <section className="space-y-5">
      <div className="merchant-page-heading">
        <div>
          <span className="merchant-eyebrow">MARKETPLACE</span>
          <h1>Гал тогооны загвар</h1>
          <p>Хадгалсан төслөө бүтээгдэхүүн болгон бэлдэж, хянуулан нийтэлнэ.</p>
        </div>
        <div className="km-list-actions">
          <button
            type="button"
            className="btn-ghost"
            disabled={!!busy}
            onClick={() => void load()}
          >
            <RefreshCw size={16} />
            Шинэчлэх
          </button>
          {data?.eligible && (
            <button
              ref={createButton}
              type="button"
              className="btn-primary"
              aria-expanded={createOpen}
              aria-controls={createId}
              disabled={!!busy}
              onClick={() => (createOpen ? closeCreate() : setCreateOpen(true))}
            >
              {createOpen ? <X size={16} /> : <Plus size={16} />}
              {createOpen ? "Форм хаах" : "Загвар нэмэх"}
            </button>
          )}
        </div>
      </div>
      {error && (
        <p className="merchant-error" role="alert">
          {error}
        </p>
      )}
      {data && !data.eligible ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
          <Store className="mb-3" /> Marketplace-д үйлдвэр эсвэл гар хийцийн
          төрлийн идэвхтэй дэлгүүр загвар нийтэлнэ. Одоогийн төрөл:{" "}
          <strong>{data.storeType ?? "дэлгүүргүй"}</strong>.
        </div>
      ) : (
        <>
          {createOpen && (
            <>
              <DashboardDraftNotice
                scope={draftScope}
                disabled={Boolean(busy)}
              />
              <form
                id={createId}
                ref={createForm}
                inert={draftStatus.loading || undefined}
                onSubmit={createDraft}
                className="km-listing"
              >
                <div className="merchant-kitchen-form-heading">
                  {" "}
                  <div className="lg:col-span-2">
                    <h2 className="font-semibold">Шинэ загвар нэмэх</h2>
                    <p className="text-sm text-black/55">
                      Хадгалсан загвараа сонгоод мэдээллээ бэлдээрэй.
                    </p>
                  </div>{" "}
                  <div className="merchant-form-actions">
                    <button
                      type="submit"
                      className="btn-primary w-fit"
                      disabled={
                        busy === "create" ||
                        (isGlb ? !glbUpload : !kitchens.length)
                      }
                    >
                      {busy === "create" ? (
                        <LoaderCircle className="animate-spin" size={16} />
                      ) : (
                        <Upload size={16} />
                      )}
                      Загвар хадгалах
                    </button>
                    <button
                      type="button"
                      className="btn-ghost"
                      disabled={!!busy}
                      onClick={closeCreate}
                    >
                      Болих
                    </button>
                  </div>
                </div>
                <div
                  className="km-source-switch"
                  role="group"
                  aria-label="Загварын эх сурвалж"
                >
                  <button
                    type="button"
                    aria-pressed={!isGlb}
                    onClick={() => setSourceType("project")}
                  >
                    <strong>Төлөвлөгчийн төсөл</strong>
                    Хадгалсан 3D төслөөсөө
                  </button>
                  <button
                    type="button"
                    aria-pressed={isGlb}
                    onClick={() => setSourceType("glb")}
                  >
                    <strong>Бэлэн GLB файл</strong>
                    Бүтэн гал тогоог нэг файлаар
                  </button>
                </div>
                {isGlb ? (
                  <KitchenGlbSourceField
                    owner={owner}
                    upload={glbUpload}
                    onUpload={setGlbUpload}
                    layout={glbLayout}
                    onLayout={setGlbLayout}
                    cabinetCount={glbModules}
                    onCabinetCount={setGlbModules}
                    disabled={!!busy}
                  />
                ) : (
                  <>
                    <label className="km-source-picker label">
                      Хадгалсан төсөл
                      <select
                        className="input mt-1 w-full"
                        required
                        value={sourceKitchenId}
                        onChange={(e) => setSourceKitchenId(e.target.value)}
                      >
                        <option value="">Сонгоно уу</option>
                        {kitchens.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    {!kitchens.length && (
                      <p className="km-create-empty">
                        Хадгалсан 3D төсөл хараахан байхгүй.{" "}
                        <Link href="/kitchen">
                          Гал тогоогоо төлөвлөх <ChevronRight size={13} />
                        </Link>
                      </p>
                    )}
                  </>
                )}
                <KitchenListingFields
                  form={form}
                  field={formField}
                  suggestions={suggestions}
                  owner={owner}
                  source={
                    !isGlb && sourceKitchenId ? { sourceKitchenId } : null
                  }
                  disabled={!!busy || draftStatus.loading}
                />
              </form>
            </>
          )}
          <div className="km-design-list">
            <div className="km-list-heading">
              <h2>Миний загварууд</h2>
              <span>{data?.designs.length ?? 0} загвар</span>
            </div>
            {data?.designs.map((design) => {
              const isFocused = focusedDesignId === design.id;
              return (
                <Link
                  id={`merchant-kitchen-${design.id}`}
                  key={design.id}
                  href={`/merchant/kitchens/${design.id}`}
                  className={`km-design-row km-design-summary ${isFocused ? "is-focused" : ""}`}
                >
                  <span className="km-design-thumbnail">
                    {design.thumbnailUrl ? (
                      <Image
                        src={design.thumbnailUrl}
                        alt=""
                        fill
                        sizes="80px"
                        className="object-cover"
                      />
                    ) : (
                      <Store size={24} />
                    )}
                  </span>
                  <span className="km-design-title">
                    <strong>{design.title}</strong>
                    <small>
                      {design.source === "glb" ? "GLB · " : ""}
                      {design.cabinetCount} модуль · {design.roomWidthMm} ×{" "}
                      {design.roomDepthMm} мм
                    </small>
                    <span>
                      v{design.versionNo} ·{" "}
                      {kitchenLifecycleLabel[kitchenLifecycle(design)]}
                    </span>
                  </span>
                  <span className="km-design-price">
                    {kitchenPriceLabel(design)}
                  </span>
                  <span className="km-design-expand">
                    Дэлгэрэнгүй <ChevronRight size={16} />
                  </span>
                </Link>
              );
            })}
            {data?.designs.length === 0 && (
              <p className="km-list-empty">
                Загвар хараахан нэмэгдээгүй. “Загвар нэмэх” товчоор хадгалсан
                төслөө оруулаарай.
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
