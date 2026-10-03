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
type Functions = Generated["public"]["Functions"];
type AddedFunctions = {
  consume_api_rate_limit: {
    Args: {
      p_scope: string;
      p_identity: string;
      p_limit: number;
      p_window_seconds: number;
    };
    Returns: { allowed: boolean; retryAfter: number };
  };
};
type Rpc<Name extends keyof Functions> = Name extends keyof NullableArgs
  ? Omit<Functions[Name], "Args"> & {
      Args: { [Key in keyof Functions[Name]["Args"]]:
        Functions[Name]["Args"][Key] | (Key extends NullableArgs[Name] ? null : never) };
    }
  : Functions[Name];
export type Database = Omit<Generated, "public"> & {
  public: Omit<Generated["public"], "Functions"> & {
    Functions: { [Name in keyof Functions]: Rpc<Name> } & AddedFunctions;
  };
};
