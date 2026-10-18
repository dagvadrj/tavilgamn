"use client";
import { useMemo } from "react";
import { useDraftState, useDraftStatus } from "@/hooks/useDashboardDraft";
import { DashboardDraftNotice } from "./DashboardDraftNotice";
import { GitBranch, LoaderCircle, Pencil, X } from "lucide-react";
import type {
  KitchenDesignSummary,
  KitchenVersionSaveMode,
} from "@/lib/kitchenMarketplace";
import {
  KitchenListingFields,
  type KitchenListingForm as ListingForm,
} from "./KitchenListingFields";
import {
  kitchenListingSuggestions,
  kitchenListTokens,
} from "@/lib/kitchenListingSuggestions";
export type SavedKitchenSource = { id: string; name: string; design: unknown };
type SavedKitchen = SavedKitchenSource;
const splitList = kitchenListTokens;
const listingForm = (design: KitchenDesignSummary): ListingForm => ({
  title: design.title,
  shortDescription: design.shortDescription,
  description: design.description,
  style: design.style,
  pricingMode: design.pricingMode,
  priceFrom: design.priceFrom == null ? "" : String(design.priceFrom),
  priceTo: design.priceTo == null ? "" : String(design.priceTo),
  materials: design.materials?.join("\n") ?? "",
  leadTimeDays: design.leadTimeDays == null ? "" : String(design.leadTimeDays),
  warrantyMonths:
    design.warrantyMonths == null ? "" : String(design.warrantyMonths),
  installationIncluded: design.installationIncluded,
  tags: design.tags.join(", "),
  serviceAreas: design.serviceAreas.join("\n") || "Улаанбаатар",
  inclusions: (design.inclusions.length
    ? design.inclusions
    : (design.listingSuggestions?.inclusions ?? [])
  ).join("\n"),
  exclusions: (design.exclusions.length
    ? design.exclusions
    : (design.listingSuggestions?.exclusions ?? [])
  ).join("\n"),
});
export const kitchenListingPayload = (form: ListingForm) => ({
  ...form,
  priceFrom: form.pricingMode === "quote" ? null : form.priceFrom || null,
  priceTo: form.pricingMode === "from" ? form.priceTo || null : null,
  materials: splitList(form.materials),
  leadTimeDays: form.leadTimeDays || null,
  warrantyMonths: form.warrantyMonths || null,
  tags: splitList(form.tags),
  serviceAreas: splitList(form.serviceAreas),
  inclusions: splitList(form.inclusions),
  exclusions: splitList(form.exclusions),
});

export function MerchantKitchenVersionEditor({
  owner,
  design,
  sourceKitchen,
  mode,
  busy,
  onCancel,
  onSave,
}: {
  owner: string;
  design: KitchenDesignSummary;
  sourceKitchen?: SavedKitchen;
  mode: KitchenVersionSaveMode;
  busy: boolean;
  onCancel: () => void;
  onSave: (form: ListingForm) => void;
}) {
  const draftScope = `merchant:${owner}:kitchen-version:${design.versionId}:${mode}`;
  const currentSuggestions = useMemo(
    () =>
      mode !== "edit" && sourceKitchen
        ? kitchenListingSuggestions(
            sourceKitchen.design,
            sourceKitchen.name,
            design.style,
          )
        : (design.listingSuggestions ?? null),
    [mode, sourceKitchen, design.style, design.listingSuggestions],
  );
  const [form, setForm] = useDraftState(draftScope, "form", () => {
    const initial = listingForm(design);
    if (mode === "edit" || !currentSuggestions) return initial;
    for (const key of ["materials", "inclusions", "exclusions"] as const) {
      const previous = new Set(
        (design.listingSuggestions?.[key] ?? []).map((item) =>
          item.toLocaleLowerCase("mn"),
        ),
      );
      initial[key] = kitchenListTokens(
        [
          ...splitList(initial[key]).filter(
            (item) => !previous.has(item.toLocaleLowerCase("mn")),
          ),
          ...currentSuggestions[key],
        ].join("\n"),
      ).join("\n");
    }
    const included = new Set(
      splitList(initial.inclusions).map((item) => item.toLocaleLowerCase("mn")),
    );
    initial.exclusions = splitList(initial.exclusions)
      .filter((item) => !included.has(item.toLocaleLowerCase("mn")))
      .join("\n");
    return initial;
  });
  const draftStatus = useDraftStatus(draftScope);
  const field = <K extends keyof ListingForm>(name: K, value: ListingForm[K]) =>
    setForm((current) => ({ ...current, [name]: value }));
  return (
    <form
      inert={draftStatus.loading || undefined}
      className="km-listing km-version-editor"
      onSubmit={(event) => {
        event.preventDefault();
        if (!busy && !draftStatus.loading) onSave(form);
      }}
    >
      <DashboardDraftNotice scope={draftScope} disabled={busy} />
      <div className="merchant-kitchen-form-heading">
        {" "}
        <div className="km-version-heading">
          <h2>
            {mode === "edit"
              ? `v${design.versionNo} мэдээлэл засах`
              : `v${design.versionNo + 1} шинэ хувилбар`}
          </h2>
          <p>
            {mode === "edit"
              ? "Энэ ноорог хувилбарын мэдээллийг шинэчилнэ."
              : "Хадгалсан 3D төслийн хамгийн сүүлийн хувилбар болон зургийг ашиглана."}
          </p>
        </div>{" "}
        <div className="merchant-form-actions">
          <button
            type="submit"
            className="btn-primary"
            disabled={busy || draftStatus.loading}
          >
            {busy ? (
              <LoaderCircle className="animate-spin" size={15} />
            ) : mode === "edit" ? (
              <Pencil size={15} />
            ) : (
              <GitBranch size={15} />
            )}
            {mode === "edit" ? "Өөрчлөлт хадгалах" : "Шинэ хувилбар хадгалах"}
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={busy || draftStatus.loading}
            onClick={onCancel}
          >
            <X size={15} />
            Болих
          </button>
        </div>
      </div>
      <KitchenListingFields
        form={form}
        field={field}
        suggestions={currentSuggestions}
        owner={owner}
        source={
          mode !== "edit" && design.sourceKitchenId
            ? { sourceKitchenId: design.sourceKitchenId }
            : { designId: design.id, versionId: design.versionId }
        }
        disabled={busy || draftStatus.loading}
      />
    </form>
  );
}
