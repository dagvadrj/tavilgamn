import "server-only";
import type { KitchenCatalogModule, KitchenCatalogVariant, KitchenModelCandidate } from "./kitchenModuleCatalog";
import { getSupabaseAdmin } from "./supabase/admin";

type Db = ReturnType<typeof getSupabaseAdmin>;
const file = (path: unknown) => typeof path === "string" ? path.split("/").pop() ?? null : null;
const assetUrl = (id: string, path: unknown) => {
  const name = file(path);
  return name ? `/api/models/files/${id}/${encodeURIComponent(name)}` : null;
};

export async function readKitchenModuleCatalog(options: { admin?: boolean } = {}, db: Db = getSupabaseAdmin()) {
  let moduleQuery = db.from("kitchen_modules").select("id,code,name,cabinet_type,width_mm,height_mm,depth_mm,active")
    .order("cabinet_type").order("width_mm");
  let variantQuery = db.from("kitchen_module_variants")
    .select("furniture_model_id,module_id,variant_code,opening,door_count,drawer_count,configuration,is_default,sort_order,active")
    .order("sort_order").order("variant_code");
  if (!options.admin) { moduleQuery = moduleQuery.eq("active", true); variantQuery = variantQuery.eq("active", true); }
  const [{ data: moduleRows, error: moduleError }, { data: variantRows, error: variantError }] = await Promise.all([moduleQuery, variantQuery]);
  if (moduleError) throw moduleError;
  if (variantError) throw variantError;
  const modelIds = [...new Set((variantRows ?? []).map((row) => row.furniture_model_id as string))];
  const { data: modelRows, error: modelError } = modelIds.length
    ? await db.from("furniture_models").select("id,product_id,name,category,glb_path,thumbnail_path,processing_status").in("id", modelIds)
    : { data: [], error: null };
  if (modelError) throw modelError;
  const models = new Map((modelRows ?? []).map((row) => [row.id as string, row]));
  const variants = new Map<string, KitchenCatalogVariant[]>();
  for (const row of variantRows ?? []) {
    const model = models.get(row.furniture_model_id as string);
    if (!model || model.category !== "kitchen-cabinet" || (!options.admin && !model.glb_path)) continue;
    const value: KitchenCatalogVariant = {
      furnitureModelId: model.id as string, productId: model.product_id as string, modelName: model.name as string,
      variantCode: row.variant_code as string, opening: row.opening as KitchenCatalogVariant["opening"],
      doorCount: Number(row.door_count), drawerCount: Number(row.drawer_count),
      configuration: row.configuration as Record<string, unknown>, isDefault: Boolean(row.is_default),
      sortOrder: Number(row.sort_order), active: Boolean(row.active), glbFile: file(model.glb_path),
      glbUrl: assetUrl(model.id as string, model.glb_path), thumbnailUrl: assetUrl(model.id as string, model.thumbnail_path),
      processingStatus: String(model.processing_status ?? "idle"),
    };
    variants.set(row.module_id as string, [...(variants.get(row.module_id as string) ?? []), value]);
  }
  const modules: KitchenCatalogModule[] = (moduleRows ?? []).map((row) => ({
    id: row.id as string, code: row.code as string, name: row.name as string,
    cabinetType: row.cabinet_type as KitchenCatalogModule["cabinetType"], widthMm: Number(row.width_mm),
    heightMm: Number(row.height_mm), depthMm: Number(row.depth_mm), active: Boolean(row.active),
    variants: variants.get(row.id as string) ?? [],
  }));
  return modules;
}

export async function readKitchenModelCandidates(db: Db = getSupabaseAdmin()) {
  const [{ data: rows, error }, { data: links, error: linkError }] = await Promise.all([
    db.from("furniture_models").select("id,product_id,name,dimensions_w,dimensions_h,dimensions_d,glb_path,processing_status")
      .eq("category", "kitchen-cabinet").order("created_at", { ascending: false }).limit(500),
    db.from("kitchen_module_variants").select("furniture_model_id"),
  ]);
  if (error) throw error;
  if (linkError) throw linkError;
  const linked = new Set((links ?? []).map((row) => row.furniture_model_id as string));
  return (rows ?? []).map((row): KitchenModelCandidate => ({ id: row.id as string, productId: row.product_id as string,
    name: row.name as string, widthMm: Math.round(Number(row.dimensions_w) * 1000),
    heightMm: Math.round(Number(row.dimensions_h) * 1000), depthMm: Math.round(Number(row.dimensions_d) * 1000),
    glbReady: Boolean(row.glb_path), processingStatus: String(row.processing_status ?? "idle"), linked: linked.has(row.id as string) }));
}
