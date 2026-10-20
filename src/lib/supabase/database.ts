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
type Functions = Generated["public"]["Functions"] & {
  merchant_workspace_access: { Args: { p_actor: string }; Returns: import("./database.types").Json };
  claim_merchant_membership: { Args: { p_actor: string; p_verified_email: string }; Returns: undefined };
  merchant_operations: { Args: { p_actor: string; p_action: string; p_data: import("./database.types").Json }; Returns: import("./database.types").Json };
  staff_delivery: { Args: { p_actor: string; p_action: string; p_data: import("./database.types").Json }; Returns: import("./database.types").Json };
  customer_store_feedback: { Args: { p_actor: string; p_action: string; p_data: import("./database.types").Json }; Returns: import("./database.types").Json };
  public_store_feedback: { Args: { p_store?: string; p_product?: string }; Returns: import("./database.types").Json };
  feedback_media: { Args: { p_actor: string; p_order: string; p_id: string; p_url?: string }; Returns: import("./database.types").Json };
  queue_kitchen_model_asset: Generated["public"]["Functions"]["queue_model_asset"];
  set_kitchen_model_archived: Generated["public"]["Functions"]["set_model_archived"];
  request_kitchen_model_export: Generated["public"]["Functions"]["request_furniture_model_export"];
  request_merchant_model_export: {
    Args: { p_actor: string; p_product: string };
    Returns: import("./database.types").Json;
  };
  read_merchant_growth: {
    Args: { p_actor: string };
    Returns: import("./database.types").Json;
  };
  save_merchant_growth: {
    Args: {
      p_actor: string;
      p_action: string;
      p_data: import("./database.types").Json;
    };
    Returns: import("./database.types").Json;
  };
  merchant_wallet_action: {
    Args: {
      p_actor: string;
      p_kind: string;
      p_quantity: number;
      p_request: string;
    };
    Returns: import("./database.types").Json;
  };
  admin_merchant_growth: {
    Args: {
      p_actor: string;
      p_action?: string;
      p_data?: import("./database.types").Json;
    };
    Returns: import("./database.types").Json;
  };
  merchant_growth_insights: {
    Args: { p_actor: string; p_days: number };
    Returns: import("./database.types").Json;
  };
  resolve_merchant_store_link: {
    Args: { p_key: string };
    Returns: import("./database.types").Json;
  };
  merchant_dashboard_progress: {
    Args: { p_actor: string; p_date?: string; p_page?: number };
    Returns: import("./database.types").Json;
  };
  merchant_dashboard_trends: {
    Args: { p_actor: string };
    Returns: import("./database.types").Json;
  };
  read_merchant_delivery_staff: {
    Args: { p_actor: string };
    Returns: import("./database.types").Json;
  };
  save_merchant_delivery_staff: {
    Args: {
      p_actor: string;
      p_id: string | null;
      p_expected_version: number | null;
      p_name: string;
      p_phone: string;
      p_vehicle: string;
      p_active: boolean;
    };
    Returns: import("./database.types").Json;
  };
  read_merchant_delivery_orders: {
    Args: { p_actor: string; p_stage: string; p_page?: number };
    Returns: import("./database.types").Json;
  };
  move_merchant_delivery_order: {
    Args: {
      p_actor: string;
      p_order: string;
      p_stage: string;
      p_expected_version: number;
      p_driver?: string | null;
    };
    Returns: import("./database.types").Json;
  };
};
type Rpc<Name extends keyof Functions> = Name extends keyof NullableArgs
  ? Omit<Functions[Name], "Args"> & {
      Args: {
        [Key in keyof Functions[Name]["Args"]]:
          | Functions[Name]["Args"][Key]
          | (Key extends NullableArgs[Name] ? null : never);
      };
    }
  : Functions[Name];
export type Database = Omit<Generated, "public"> & {
  public: Omit<Generated["public"], "Functions" | "Tables" | "Views"> & {
    Views: Generated["public"]["Views"] & {
      model_records: {
        Row: Generated["public"]["Tables"]["furniture_models"]["Row"];
        Relationships: [];
      };
    };
    Tables: Generated["public"]["Tables"] & {
      kitchen_models: Generated["public"]["Tables"]["furniture_models"];
      room_templates: {
        Row: RoomTemplateRow;
        Insert: Omit<
          RoomTemplateRow,
          "id" | "created_at" | "updated_at" | "version"
        > & {
          id?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: Partial<RoomTemplateRow>;
        Relationships: [];
      };
      homepage_scene_settings: {
        Row: {
          id: number;
          product_ids: string[];
          version: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          id: number;
          product_ids: string[];
          version?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          id?: number;
          product_ids?: string[];
          version?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: { [Name in keyof Functions]: Rpc<Name> };
  };
};

export type RoomTemplateRow = {
  id: string;
  title: string;
  description: string;
  kind: string;
  furnishing: string;
  room_type: string;
  area: number;
  preview_image: string;
  design: import("./database.types").Json;
  status: string;
  sort_order: number;
  version: number;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
};
