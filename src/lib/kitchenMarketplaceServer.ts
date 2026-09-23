import "server-only";
import type { KitchenDesignSummary, KitchenRenderJobSummary, KitchenReviewHistoryItem, KitchenVersionHistoryItem } from "./kitchenMarketplace";
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
  installation_included: boolean; warranty_months: number | null; service_areas: string[]; inclusions: string[];
  exclusions: string[]; cabinet_count: number; min_room_width_mm: number;
  min_room_depth_mm: number; max_height_mm: number;
  created_at: string; submitted_at: string | null; approved_at: string | null;
};

async function summaries(db: Db, designs: DesignRow[], versions: VersionRow[], storeNames: Map<string, string>, includePrivateHistory = false) {
  if (!designs.length) return [];
  const chosen = new Map<string, VersionRow>();
  for (const version of versions) if (!chosen.has(version.design_id)) chosen.set(version.design_id, version);
  const ids = [...chosen.values()].map((version) => version.id);
  const [{ data: media, error }, { data: jobs, error: jobsError }, { data: reviews, error: reviewsError }] = await Promise.all([
    ids.length
      ? db.from("kitchen_design_media").select("id,version_id,kind,source,url,alt_text,is_primary,sort_order").in("version_id", ids).eq("status", "ready").order("sort_order", { ascending: true })
      : Promise.resolve({ data: [], error: null }),
    includePrivateHistory && ids.length
      ? db.from("kitchen_render_jobs").select("id,version_id,status,input_image_url,prompt_snapshot,provider,model,output_media_id,error,created_at,started_at,finished_at").in("version_id", ids).order("created_at", { ascending: false }).limit(2000)
      : Promise.resolve({ data: [], error: null }),
    includePrivateHistory
      ? db.from("kitchen_design_reviews").select("id,design_id,version_id,action,note,created_at").in("design_id", designs.map((design) => design.id)).order("created_at", { ascending: false }).limit(5000)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (error) throw error;
  if (jobsError) throw jobsError;
  if (reviewsError) throw reviewsError;
  const mediaByVersion = new Map<string, KitchenDesignSummary["media"]>();
  for (const item of media ?? []) {
    const versionId = item.version_id as string;
    const collection = mediaByVersion.get(versionId) ?? [];
    collection.push({ id: item.id as string, kind: item.kind as KitchenDesignSummary["media"][number]["kind"],
      source: item.source as KitchenDesignSummary["media"][number]["source"], url: item.url as string,
      altText: item.alt_text as string, isPrimary: Boolean(item.is_primary) });
    mediaByVersion.set(versionId, collection);
  }
  const jobsByVersion = new Map<string, KitchenRenderJobSummary[]>();
  for (const item of jobs ?? []) {
    const versionId = item.version_id as string;
    const collection = jobsByVersion.get(versionId) ?? [];
    collection.push({ id: item.id as string, status: item.status as KitchenRenderJobSummary["status"],
      inputImageUrl: item.input_image_url as string | null, prompt: item.prompt_snapshot as string,
      provider: item.provider as string | null, model: item.model as string | null,
      outputMediaId: item.output_media_id as string | null, error: item.error as string | null,
      createdAt: item.created_at as string, startedAt: item.started_at as string | null,
      finishedAt: item.finished_at as string | null });
    jobsByVersion.set(versionId, collection);
  }
  const versionsByDesign = new Map<string, KitchenVersionHistoryItem[]>();
  const publishedByDesign = new Map(designs.map((design) => [design.id, design.published_version_id]));
  if (includePrivateHistory) for (const item of versions) {
    const collection = versionsByDesign.get(item.design_id) ?? [];
    collection.push({ id: item.id, versionNo: item.version_no, reviewStatus: item.review_status,
      title: item.title, isPublished: publishedByDesign.get(item.design_id) === item.id,
      createdAt: item.created_at, submittedAt: item.submitted_at, approvedAt: item.approved_at });
    versionsByDesign.set(item.design_id, collection);
  }
  const reviewsByDesign = new Map<string, KitchenReviewHistoryItem[]>();
  for (const item of reviews ?? []) {
    const designId = item.design_id as string;
    const collection = reviewsByDesign.get(designId) ?? [];
    collection.push({ id: item.id as string, versionId: item.version_id as string | null,
      action: item.action as KitchenReviewHistoryItem["action"], note: item.note as string,
      createdAt: item.created_at as string });
    reviewsByDesign.set(designId, collection);
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
      warrantyMonths: version.warranty_months,
      serviceAreas: Array.isArray(version.service_areas) ? version.service_areas : [],
      inclusions: Array.isArray(version.inclusions) ? version.inclusions : [],
      exclusions: Array.isArray(version.exclusions) ? version.exclusions : [],
      cabinetCount: version.cabinet_count,
      roomWidthMm: version.min_room_width_mm, roomDepthMm: version.min_room_depth_mm,
      maxHeightMm: version.max_height_mm,
      thumbnailUrl: mediaByVersion.get(version.id)?.find((item) => item.kind === "thumbnail" && item.isPrimary)?.url ?? null,
      media: mediaByVersion.get(version.id) ?? [], renderJobs: jobsByVersion.get(version.id) ?? [],
      versions: versionsByDesign.get(design.id) ?? [], reviews: reviewsByDesign.get(design.id) ?? [], updatedAt: design.updated_at,
    }];
  });
}

const VERSION_FIELDS = "id,design_id,version_no,review_status,title,short_description,description,style,layout,tags,pricing_mode,price_from,lead_time_days,installation_included,warranty_months,service_areas,inclusions,exclusions,cabinet_count,min_room_width_mm,min_room_depth_mm,max_height_mm,created_at,submitted_at,approved_at";

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
  return { eligible, storeType: store.store_type as string, designs: await summaries(db, designs, (versionRows ?? []) as VersionRow[], new Map([[store.id, store.name]]), true) };
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
  return summaries(db, designs, (versionRows ?? []) as VersionRow[], new Map((stores ?? []).map((store) => [store.id as string, store.name as string])), true);
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

export async function readPublishedKitchenDesignBySlug(slug: string, db = getSupabaseAdmin()) {
  if (!/^[a-z0-9][a-z0-9-]{1,99}$/.test(slug)) return null;
  const { data: designRow, error: designError } = await db.from("kitchen_designs")
    .select("id,store_id,slug,publication_status,published_version_id,updated_at")
    .eq("slug", slug).eq("publication_status", "published").maybeSingle();
  if (designError) throw designError;
  if (!designRow?.published_version_id) return null;
  const [{ data: versionRow, error: versionError }, { data: store, error: storeError }] = await Promise.all([
    db.from("kitchen_design_versions").select(VERSION_FIELDS).eq("id", designRow.published_version_id).maybeSingle(),
    db.from("merchant_stores").select("id,name").eq("id", designRow.store_id).maybeSingle(),
  ]);
  if (versionError) throw versionError;
  if (storeError) throw storeError;
  if (!versionRow || !store) return null;
  return (await summaries(db, [designRow as DesignRow], [versionRow as VersionRow], new Map([[store.id as string, store.name as string]])))[0] ?? null;
}
