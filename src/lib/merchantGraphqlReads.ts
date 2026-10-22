import "server-only";
import { GraphQLError } from "graphql";
import { getSupabaseAdmin } from "./supabase/admin";
import { productFromRow, type FurnitureRow } from "./catalogServer";
import { productModelVersions, type HistoryAsset } from "./productModelHistory";
import {
  readMerchantKitchenDesigns,
  readMerchantKitchenDesignById,
} from "./kitchenMarketplaceServer";
import { parseKitchen } from "./kitchenAssembly";

type Db = ReturnType<typeof getSupabaseAdmin>;
export const merchantReadFailure = (message: string, code = "NOT_FOUND") =>
  new GraphQLError(message, { extensions: { code } });

export function createMerchantReadServices(db: Db) {
  return {
    async products(actor: string, after: string | null, archived: boolean) {
      const { data, error } = await db.rpc("read_merchant_products_v2", {
        p_actor: actor,
        p_after: after,
        p_include_archived: archived,
      });
      if (error) throw error;
      const rows = (data ?? []) as (FurnitureRow & {
        model_requested?: boolean;
        archived_at?: string | null;
      })[];
      return {
        products: rows.map((row) => ({
          ...productFromRow(row),
          modelRequested: Boolean(row.model_requested),
          archivedAt: row.archived_at ?? null,
        })),
        nextCursor: rows.length === 500 ? rows[rows.length - 1].id : null,
      };
    },
    async productDetails(actor: string, id: string) {
      const { data: model, error } = await db
        .from("furniture_models")
        .select("*")
        .eq("product_id", id)
        .maybeSingle();
      if (error) throw error;
      if (
        !model ||
        !Array.isArray(model.store_ids) ||
        model.store_ids.length !== 1 ||
        typeof model.store_ids[0] !== "string"
      )
        throw merchantReadFailure("Бүтээгдэхүүн олдсонгүй.");
      const { data: stores, error: ownerError } = await db
        .from("merchant_stores")
        .select("id")
        .eq("id", model.store_ids[0])
        .eq("owner_id", actor)
        .eq("active", true)
        .limit(1);
      if (ownerError) throw ownerError;
      if (!stores?.length) throw merchantReadFailure("Бүтээгдэхүүн олдсонгүй.");
      // Asset paths and signed download URLs never enter the GraphQL response.
      const assets: HistoryAsset[] = [];
      for (let offset = 0; ; offset += 500) {
        const result = await db
          .from("model_assets")
          .select("id,version_id,role,state,byte_size,original_name,created_at")
          .eq("model_id", model.id)
          .order("created_at", { ascending: false })
          .order("id")
          .range(offset, offset + 499);
        if (result.error) throw result.error;
        assets.push(...(result.data ?? []));
        if (!result.data || result.data.length < 500) break;
      }
      const current = model.glb_path
        ? await db
            .from("model_assets")
            .select("version_id")
            .eq("model_id", model.id)
            .eq("storage_path", model.glb_path)
            .maybeSingle()
        : { data: null, error: null };
      if (current.error) throw current.error;
      return {
        product: productFromRow(model),
        createdAt: model.created_at,
        updatedAt: model.updated_at,
        processingStatus: model.processing_status,
        processingError: model.processing_error,
        archivedAt: model.archived_at,
        versions: productModelVersions(
          assets,
          current.data?.version_id ?? null,
        ),
      };
    },
    kitchenDesigns: (actor: string) =>
      readMerchantKitchenDesigns(actor, db, undefined, false),
    async kitchenDesign(actor: string, id: string) {
      const result = await readMerchantKitchenDesignById(actor, id, db);
      if (!result.eligible)
        throw merchantReadFailure(
          "Идэвхтэй үйлдвэрлэгчийн дэлгүүр шаардлагатай.",
          "FORBIDDEN",
        );
      if (!result.design) throw merchantReadFailure("Загвар олдсонгүй.");
      return result;
    },
    async quoteProject(actor: string, id: string) {
      const store = await db
        .from("merchant_stores")
        .select("id")
        .eq("owner_id", actor)
        .eq("active", true)
        .in("store_type", ["factory", "handmade"])
        .maybeSingle();
      if (store.error) throw store.error;
      if (!store.data)
        throw merchantReadFailure(
          "Идэвхтэй үйлдвэрлэгчийн дэлгүүр шаардлагатай.",
          "FORBIDDEN",
        );
      const result = await db
        .from("kitchen_quote_requests")
        .select("project_name,project_snapshot")
        .eq("id", id)
        .eq("merchant_owner_id", actor)
        .eq("store_id", store.data.id)
        .maybeSingle();
      if (result.error) throw result.error;
      if (!result.data) throw merchantReadFailure("Үнийн хүсэлт олдсонгүй.");
      return {
        name: result.data.project_name,
        design: parseKitchen(result.data.project_snapshot),
      };
    },
  };
}
export type MerchantReadServices = ReturnType<
  typeof createMerchantReadServices
>;
