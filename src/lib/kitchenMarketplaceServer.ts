import "server-only";
import type { KitchenDesignSummary } from "./kitchenMarketplace";
import { getSupabaseAdmin } from "./supabase/admin";

type Db = ReturnType<typeof getSupabaseAdmin>;
type DesignRow = {
  id: string; store_id: string; slug: string; publication_status: KitchenDesignSummary["publicationStatus"];
  published_version_id: string | null; updated_at: string;
};
type VersionRow = {
  id: string; design_id: string; version_no: number; review_status: KitchenDesignSummary["reviewStatus"];
  title: string; short_description: string; description: string; style: string; layout: string; tags: string[];
  pricing_mode: KitchenDesignSummary["pricingMode"]; price_from: number | string | null; lead_time_days: number | null;
  installation_included: boolean; warranty_months: number | null; cabinet_count: number; min_room_width_mm: number;
  min_room_depth_mm: number; max_height_mm: number;
};

async function summaries(db: Db, designs: DesignRow[], versions: VersionRow[], storeNames: Map<string, string>) {
  if (!designs.length) return [];
  const chosen = new Map<string, VersionRow>();
  for (const version of versions) if (!chosen.has(version.design_id)) chosen.set(version.design_id, version);
  const ids = [...chosen.values()].map((version) => version.id);
  const { data: media, error } = ids.length
    ? await db.from("kitchen_design_media").select("id,version_id,kind,source,url,alt_text,is_primary,sort_order").in("version_id", ids).eq("status", "ready").order("sort_order", { ascending: true })
    : { data: [], error: null };
  if (error) throw error;
  const mediaByVersion = new Map<string, KitchenDesignSummary["media"]>();
  for (const item of media ?? []) {
    const versionId = item.version_id as string;
    const collection = mediaByVersion.get(versionId) ?? [];
    collection.push({ id: item.id as string, kind: item.kind as KitchenDesignSummary["media"][number]["kind"],
      source: item.source as KitchenDesignSummary["media"][number]["source"], url: item.url as string,
      altText: item.alt_text as string, isPrimary: Boolean(item.is_primary) });
    mediaByVersion.set(versionId, collection);
  }
  return designs.flatMap((design): KitchenDesignSummary[] => {
    const version = chosen.get(design.id);
    if (!version) return [];
    return [{
      id: design.id, storeId: design.store_id, storeName: storeNames.get(design.store_id) ?? "",
      slug: design.slug, publicationStatus: design.publication_status, publishedVersionId: design.published_version_id,
      versionId: version.id, versionNo: version.version_no, reviewStatus: version.review_status,
      title: version.title, shortDescription: version.short_description, description: version.description,
      style: version.style, layout: version.layout, tags: Array.isArray(version.tags) ? version.tags : [],
      pricingMode: version.pricing_mode, priceFrom: version.price_from == null ? null : Number(version.price_from),
      leadTimeDays: version.lead_time_days, installationIncluded: version.installation_included,
      warrantyMonths: version.warranty_months, cabinetCount: version.cabinet_count,
      roomWidthMm: version.min_room_width_mm, roomDepthMm: version.min_room_depth_mm,
      maxHeightMm: version.max_height_mm,
      thumbnailUrl: mediaByVersion.get(version.id)?.find((item) => item.kind === "thumbnail" && item.isPrimary)?.url ?? null,
      media: mediaByVersion.get(version.id) ?? [], updatedAt: design.updated_at,
    }];
  });
}

const VERSION_FIELDS = "id,design_id,version_no,review_status,title,short_description,description,style,layout,tags,pricing_mode,price_from,lead_time_days,installation_included,warranty_months,cabinet_count,min_room_width_mm,min_room_depth_mm,max_height_mm";

export async function readMerchantKitchenDesigns(actor: string, db = getSupabaseAdmin()) {
  const { data: store, error: storeError } = await db.from("merchant_stores").select("id,name,store_type,active").eq("owner_id", actor).maybeSingle();
  if (storeError) throw storeError;
  if (!store) return { eligible: false, storeType: null, designs: [] as KitchenDesignSummary[] };
  const eligible = store.active && ["factory", "handmade"].includes(store.store_type);
  const { data: designRows, error: designError } = await db.from("kitchen_designs")
    .select("id,store_id,slug,publication_status,published_version_id,updated_at")
    .eq("store_id", store.id).order("updated_at", { ascending: false }).limit(500);
  if (designError) throw designError;
  const designs = (designRows ?? []) as DesignRow[];
  const ids = designs.map((item) => item.id);
  const { data: versionRows, error: versionError } = ids.length
    ? await db.from("kitchen_design_versions").select(VERSION_FIELDS).in("design_id", ids).order("version_no", { ascending: false })
    : { data: [], error: null };
  if (versionError) throw versionError;
  return { eligible, storeType: store.store_type as string, designs: await summaries(db, designs, (versionRows ?? []) as VersionRow[], new Map([[store.id, store.name]])) };
}

export async function readAdminKitchenDesigns(db = getSupabaseAdmin()) {
  const { data: designRows, error: designError } = await db.from("kitchen_designs")
    .select("id,store_id,slug,publication_status,published_version_id,updated_at")
    .order("updated_at", { ascending: false }).limit(1000);
  if (designError) throw designError;
  const designs = (designRows ?? []) as DesignRow[];
  const ids = designs.map((item) => item.id);
  const storeIds = [...new Set(designs.map((item) => item.store_id))];
  const [{ data: versionRows, error: versionError }, { data: stores, error: storeError }] = await Promise.all([
    ids.length ? db.from("kitchen_design_versions").select(VERSION_FIELDS).in("design_id", ids).order("version_no", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    storeIds.length ? db.from("merchant_stores").select("id,name").in("id", storeIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (versionError) throw versionError;
  if (storeError) throw storeError;
  return summaries(db, designs, (versionRows ?? []) as VersionRow[], new Map((stores ?? []).map((store) => [store.id as string, store.name as string])));
}

export async function readPublishedKitchenDesigns(db = getSupabaseAdmin()) {
  const { data: designRows, error: designError } = await db.from("kitchen_designs")
    .select("id,store_id,slug,publication_status,published_version_id,updated_at")
    .eq("publication_status", "published").order("featured", { ascending: false }).order("published_at", { ascending: false }).limit(200);
  if (designError) throw designError;
  const designs = (designRows ?? []) as DesignRow[];
  const versionIds = designs.map((item) => item.published_version_id).filter((id): id is string => !!id);
  const storeIds = [...new Set(designs.map((item) => item.store_id))];
  const [{ data: versionRows, error: versionError }, { data: stores, error: storeError }] = await Promise.all([
    versionIds.length ? db.from("kitchen_design_versions").select(VERSION_FIELDS).in("id", versionIds) : Promise.resolve({ data: [], error: null }),
    storeIds.length ? db.from("merchant_stores").select("id,name").in("id", storeIds) : Promise.resolve({ data: [], error: null }),
  ]);
  if (versionError) throw versionError;
  if (storeError) throw storeError;
  return summaries(db, designs, (versionRows ?? []) as VersionRow[], new Map((stores ?? []).map((store) => [store.id as string, store.name as string])));
}
