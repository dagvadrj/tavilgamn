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
  save_merchant_product: "p_expected_stock";
  save_merchant_product_v2: "p_expected_stock";
  save_furniture_product: "p_expected_stock";
};
type Functions = Generated["public"]["Functions"];
type Rpc<Name extends keyof Functions> = Name extends keyof NullableArgs
  ? Omit<Functions[Name], "Args"> & {
      Args: { [Key in keyof Functions[Name]["Args"]]:
        Functions[Name]["Args"][Key] | (Key extends NullableArgs[Name] ? null : never) };
    }
  : Functions[Name];
export type Database = Omit<Generated, "public"> & {
  public: Omit<Generated["public"], "Functions"> & {
    Functions: { [Name in keyof Functions]: Rpc<Name> };
  };
};
