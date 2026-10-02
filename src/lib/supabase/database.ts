import type { Database as Generated } from "./database.types";

// The generator cannot represent SQL NULL in function arguments. These named
// arguments intentionally accept NULL in the SQL bodies. Do not widen every RPC.
type NullableArgs = {
  save_kitchen_project: "p_expected_revision";
  review_kitchen_design: "p_version";
  create_kitchen_quote_request: "p_project";
  admin_update_merchant_settings: "p_featured_rank";
  update_merchant_kitchen_quote: "p_price";
  read_merchant_products: "p_after";
  read_merchant_products_v2: "p_after";
  resolve_order_cancellation: "p_reference" | "p_amount";
  save_merchant_product: "p_expected_stock";
  save_merchant_product_v2: "p_expected_stock";
  save_furniture_product: "p_expected_stock";
};
// Temporary schema contracts allow verification before deploying the additive
// Phase 5 migrations. Regenerated live types replace these after deployment.
type PendingFunctions = {
  read_merchant_products_v2: { Args: { p_actor: string; p_after?: string | null; p_include_archived?: boolean }; Returns: Generated["public"]["Tables"]["furniture_models"]["Row"][] };
  set_merchant_product_archived: { Args: { p_actor: string; p_product: string; p_archived: boolean }; Returns: undefined };
  claim_order_payment: { Args: { p_actor: string; p_order: string; p_method: string; p_callback_token: string }; Returns: import("./database.types").Json };
  request_order_cancellation: { Args: { p_actor: string; p_order: string; p_reason: string }; Returns: import("./database.types").Json };
  resolve_order_cancellation: { Args: { p_actor: string; p_order: string; p_action: string; p_note: string; p_reference?: string | null; p_amount?: number | null }; Returns: import("./database.types").Json };
  update_platform_order: { Args: { p_actor: string; p_order: string; p_status: string; p_expected_status: string }; Returns: undefined };
};
type MediaRow = { id: string; owner_id: string; public_id: string; url: string | null; state: string; created_at: string; retired_at: string | null };
type PendingTables = {
  order_cancellations: {
    Row: { order_id: string; status: string };
    Insert: { order_id: string; status?: string };
    Update: { status?: string };
    Relationships: [];
  };
  orders: Omit<Generated["public"]["Tables"]["orders"], "Row" | "Insert" | "Update"> & {
    Row: Generated["public"]["Tables"]["orders"]["Row"] & { platform_fulfillment_status: string | null };
    Insert: Generated["public"]["Tables"]["orders"]["Insert"] & { platform_fulfillment_status?: string | null };
    Update: Generated["public"]["Tables"]["orders"]["Update"] & { platform_fulfillment_status?: string | null };
  };
  product_media_assets: { Row: MediaRow; Insert: Pick<MediaRow, "owner_id" | "public_id"> & Partial<MediaRow>; Update: Partial<MediaRow>; Relationships: [] };
};
type Functions = Generated["public"]["Functions"] & PendingFunctions;
type Rpc<Name extends keyof Functions> = Name extends keyof NullableArgs
  ? Omit<Functions[Name], "Args"> & {
      Args: { [Key in keyof Functions[Name]["Args"]]:
        Functions[Name]["Args"][Key] | (Key extends NullableArgs[Name] ? null : never) };
    }
  : Functions[Name];
export type Database = Omit<Generated, "public"> & {
  public: Omit<Generated["public"], "Functions" | "Tables"> & {
    Tables: Generated["public"]["Tables"] & PendingTables;
    Functions: { [Name in keyof Functions]: Rpc<Name> };
  };
};
