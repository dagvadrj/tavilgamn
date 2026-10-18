"use client";
import {
  useDraftState,
  useDraftStatus,
  clearDashboardDraft,
} from "@/hooks/useDashboardDraft";
import { DashboardDraftNotice } from "@/components/DashboardDraftNotice";

import Image from "next/image";
import Link from "next/link";
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
import { authFetch } from "@/lib/authFetch";
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

type SavedKitchen = { id: string; name: string; design: unknown };
type LoadResult = {
  eligible: boolean;
  storeType: string | null;
  designs: KitchenDesignSummary[];
  renderUsage: KitchenRenderUsage | null;
};

const splitList = kitchenListTokens;

async function request<T>(
  path: string,
  owner: string,
  init?: RequestInit,
): Promise<T> {
  const response = await authFetch(path, init, owner);
  const data = await response.json().catch(() => null);
  if (!response.ok || !data)
    throw new Error(data?.error ?? "Мэдээллийг ачаалж чадсангүй.");
  return data as T;
}

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
    createForm.current?.querySelector("select")?.focus({ preventScroll: true });
  }, [createOpen]);
  const closeCreate = () => {
    setCreateOpen(false);
    createButton.current?.focus();
  };

  const selectedKitchen = kitchens.find((item) => item.id === sourceKitchenId);
  const suggestions = useMemo(
    () =>
      kitchenListingSuggestions(
        selectedKitchen?.design,
        selectedKitchen?.name,
        style,
      ),
    [selectedKitchen?.design, selectedKitchen?.name, style],
  );
  const lastSource = useRef<{
    id: string;
    name: string;
    materials: string[];
    inclusions: string[];
    exclusions: string[];
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
      lastSource.current?.id === sourceKitchenId
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
      setTitle(selectedKitchen?.name ?? "");
    setMaterials(
      reconcile(materials, previous?.materials ?? [], suggestions.materials),
    );
    lastSource.current = {
      id: sourceKitchenId,
      name: selectedKitchen?.name ?? "",
      materials: suggestions.materials,
      inclusions: suggestions.inclusions,
      exclusions: suggestions.exclusions,
    };
  }, [
    draftStatus.loading,
    suggestions,
    sourceKitchenId,
    title,
    materials,
    inclusions,
    exclusions,
    serviceAreas,
    selectedKitchen?.name,
    setInclusions,
    setExclusions,
    setTitle,
    setMaterials,
    setServiceAreas,
  ]);
  const load = useCallback(async () => {
    setError(null);
    try {
      const [marketplace, saved] = await Promise.all([
        request<LoadResult>("/api/merchant/kitchen-designs", owner),
        request<{ kitchens: SavedKitchen[] }>("/api/kitchens", owner),
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
  }, [owner]);

  useEffect(() => {
    if (!draftStatus.loading && !sourceKitchenId && kitchens[0])
      setSourceKitchenId(kitchens[0].id);
  }, [draftStatus.loading, sourceKitchenId, kitchens, setSourceKitchenId]);

  useEffect(() => {
    void load();
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
      await request("/api/merchant/kitchen-designs", owner, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sourceKitchenId,
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
      });
      void clearDashboardDraft(draftScope);
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

  if (!data && !error)
    return <div className="merchant-load-state">Загваруудыг ачаалж байна…</div>;
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
                      disabled={busy === "create" || !kitchens.length}
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
                <KitchenListingFields
                  form={form}
                  field={formField}
                  suggestions={suggestions}
                  owner={owner}
                  source={sourceKitchenId ? { sourceKitchenId } : null}
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
