export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      commerce_order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          details: Json
          event: string
          id: string
          order_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          event: string
          id?: string
          order_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          details?: Json
          event?: string
          id?: string
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "commerce_order_events_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commerce_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
        }
        Relationships: []
      }
      conversations: {
        Row: {
          customer_id: string
          id: string
          merchant_id: string
          updated_at: string
        }
        Insert: {
          customer_id: string
          id?: string
          merchant_id: string
          updated_at?: string
        }
        Update: {
          customer_id?: string
          id?: string
          merchant_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      furniture_models: {
        Row: {
          archived_at: string | null
          archived_by: string | null
          badges: Json
          base_price: number
          cabinet_module_id: string | null
          category: string
          colors: Json
          compare_at_price: number | null
          created_at: string
          default_color: string | null
          delivery_terms: string | null
          description: string
          dimensions_d: number
          dimensions_h: number
          dimensions_w: number
          export_error: string | null
          export_job_id: string | null
          export_requested_at: string | null
          export_status: string
          export_updated_at: string | null
          glb_path: string | null
          glb_validation: Json | null
          id: string
          image_url: string | null
          images: Json
          in_stock: number | null
          is_best_seller: boolean
          is_new: boolean
          materials: Json
          model_requested: boolean
          model_requested_at: string | null
          model_requested_by_store_id: string | null
          name: string
          preview_glb_path: string | null
          processing_error: string | null
          processing_job_id: string | null
          processing_requested_at: string | null
          processing_status: string
          processing_updated_at: string | null
          product_id: string
          promotion_ends_at: string | null
          promotion_label: string | null
          rating: number
          review_count: number
          scale: number
          source_glb_path: string | null
          standard_glb_path: string | null
          store_ids: Json
          thumbnail_path: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          archived_by?: string | null
          badges?: Json
          base_price?: number
          cabinet_module_id?: string | null
          category?: string
          colors?: Json
          compare_at_price?: number | null
          created_at?: string
          default_color?: string | null
          delivery_terms?: string | null
          description?: string
          dimensions_d?: number
          dimensions_h?: number
          dimensions_w?: number
          export_error?: string | null
          export_job_id?: string | null
          export_requested_at?: string | null
          export_status?: string
          export_updated_at?: string | null
          glb_path?: string | null
          glb_validation?: Json | null
          id?: string
          image_url?: string | null
          images?: Json
          in_stock?: number | null
          is_best_seller?: boolean
          is_new?: boolean
          materials?: Json
          model_requested?: boolean
          model_requested_at?: string | null
          model_requested_by_store_id?: string | null
          name: string
          preview_glb_path?: string | null
          processing_error?: string | null
          processing_job_id?: string | null
          processing_requested_at?: string | null
          processing_status?: string
          processing_updated_at?: string | null
          product_id: string
          promotion_ends_at?: string | null
          promotion_label?: string | null
          rating?: number
          review_count?: number
          scale?: number
          source_glb_path?: string | null
          standard_glb_path?: string | null
          store_ids?: Json
          thumbnail_path?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          archived_by?: string | null
          badges?: Json
          base_price?: number
          cabinet_module_id?: string | null
          category?: string
          colors?: Json
          compare_at_price?: number | null
          created_at?: string
          default_color?: string | null
          delivery_terms?: string | null
          description?: string
          dimensions_d?: number
          dimensions_h?: number
          dimensions_w?: number
          export_error?: string | null
          export_job_id?: string | null
          export_requested_at?: string | null
          export_status?: string
          export_updated_at?: string | null
          glb_path?: string | null
          glb_validation?: Json | null
          id?: string
          image_url?: string | null
          images?: Json
          in_stock?: number | null
          is_best_seller?: boolean
          is_new?: boolean
          materials?: Json
          model_requested?: boolean
          model_requested_at?: string | null
          model_requested_by_store_id?: string | null
          name?: string
          preview_glb_path?: string | null
          processing_error?: string | null
          processing_job_id?: string | null
          processing_requested_at?: string | null
          processing_status?: string
          processing_updated_at?: string | null
          product_id?: string
          promotion_ends_at?: string | null
          promotion_label?: string | null
          rating?: number
          review_count?: number
          scale?: number
          source_glb_path?: string | null
          standard_glb_path?: string | null
          store_ids?: Json
          thumbnail_path?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "furniture_models_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "furniture_models_cabinet_module_id_fkey"
            columns: ["cabinet_module_id"]
            isOneToOne: false
            referencedRelation: "kitchen_modules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "furniture_models_model_requested_by_store_id_fkey"
            columns: ["model_requested_by_store_id"]
            isOneToOne: false
            referencedRelation: "merchant_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_design_media: {
        Row: {
          alt_text: string
          created_at: string
          height: number | null
          id: string
          is_primary: boolean
          kind: string
          metadata: Json
          sort_order: number
          source: string
          status: string
          updated_at: string
          url: string
          version_id: string
          width: number | null
        }
        Insert: {
          alt_text?: string
          created_at?: string
          height?: number | null
          id?: string
          is_primary?: boolean
          kind: string
          metadata?: Json
          sort_order?: number
          source: string
          status?: string
          updated_at?: string
          url: string
          version_id: string
          width?: number | null
        }
        Update: {
          alt_text?: string
          created_at?: string
          height?: number | null
          id?: string
          is_primary?: boolean
          kind?: string
          metadata?: Json
          sort_order?: number
          source?: string
          status?: string
          updated_at?: string
          url?: string
          version_id?: string
          width?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_design_media_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "kitchen_design_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_design_reviews: {
        Row: {
          action: string
          created_at: string
          design_id: string
          id: string
          note: string
          reviewer_id: string
          version_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          design_id: string
          id?: string
          note?: string
          reviewer_id: string
          version_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          design_id?: string
          id?: string
          note?: string
          reviewer_id?: string
          version_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_design_reviews_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "kitchen_designs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_design_reviews_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "kitchen_design_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_design_versions: {
        Row: {
          approved_at: string | null
          base_count: number
          cabinet_count: number
          calculated_at: string | null
          calculated_price: number | null
          component_product_ids: Json
          created_at: string
          created_by: string
          currency: string
          description: string
          design: Json
          design_id: string
          exclusions: Json
          id: string
          inclusions: Json
          installation_included: boolean
          layout: string
          lead_time_days: number | null
          materials: Json
          max_height_mm: number
          min_room_depth_mm: number
          min_room_width_mm: number
          price_from: number | null
          price_to: number | null
          pricing_mode: string
          review_status: string
          service_areas: Json
          short_description: string
          style: string
          submitted_at: string | null
          tags: Json
          tall_count: number
          title: string
          updated_at: string
          version_no: number
          wall_count: number
          warranty_months: number | null
        }
        Insert: {
          approved_at?: string | null
          base_count?: number
          cabinet_count: number
          calculated_at?: string | null
          calculated_price?: number | null
          component_product_ids?: Json
          created_at?: string
          created_by: string
          currency?: string
          description?: string
          design: Json
          design_id: string
          exclusions?: Json
          id?: string
          inclusions?: Json
          installation_included?: boolean
          layout: string
          lead_time_days?: number | null
          materials?: Json
          max_height_mm: number
          min_room_depth_mm: number
          min_room_width_mm: number
          price_from?: number | null
          price_to?: number | null
          pricing_mode?: string
          review_status?: string
          service_areas?: Json
          short_description?: string
          style?: string
          submitted_at?: string | null
          tags?: Json
          tall_count?: number
          title: string
          updated_at?: string
          version_no: number
          wall_count?: number
          warranty_months?: number | null
        }
        Update: {
          approved_at?: string | null
          base_count?: number
          cabinet_count?: number
          calculated_at?: string | null
          calculated_price?: number | null
          component_product_ids?: Json
          created_at?: string
          created_by?: string
          currency?: string
          description?: string
          design?: Json
          design_id?: string
          exclusions?: Json
          id?: string
          inclusions?: Json
          installation_included?: boolean
          layout?: string
          lead_time_days?: number | null
          materials?: Json
          max_height_mm?: number
          min_room_depth_mm?: number
          min_room_width_mm?: number
          price_from?: number | null
          price_to?: number | null
          pricing_mode?: string
          review_status?: string
          service_areas?: Json
          short_description?: string
          style?: string
          submitted_at?: string | null
          tags?: Json
          tall_count?: number
          title?: string
          updated_at?: string
          version_no?: number
          wall_count?: number
          warranty_months?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_design_versions_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "kitchen_designs"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_designs: {
        Row: {
          created_at: string
          created_by: string
          featured: boolean
          featured_rank: number | null
          id: string
          publication_status: string
          published_at: string | null
          published_version_id: string | null
          slug: string
          source_garniture_id: string | null
          store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          featured?: boolean
          featured_rank?: number | null
          id?: string
          publication_status?: string
          published_at?: string | null
          published_version_id?: string | null
          slug: string
          source_garniture_id?: string | null
          store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          featured?: boolean
          featured_rank?: number | null
          id?: string
          publication_status?: string
          published_at?: string | null
          published_version_id?: string | null
          slug?: string
          source_garniture_id?: string | null
          store_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_designs_published_version_fkey"
            columns: ["id", "published_version_id"]
            isOneToOne: false
            referencedRelation: "kitchen_design_versions"
            referencedColumns: ["design_id", "id"]
          },
          {
            foreignKeyName: "kitchen_designs_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "merchant_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_garniture_versions: {
        Row: {
          created_at: string
          design: Json
          kitchen_id: string
          name: string
          revision: number
          thumbnail_url: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          design: Json
          kitchen_id: string
          name: string
          revision: number
          thumbnail_url?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          design?: Json
          kitchen_id?: string
          name?: string
          revision?: number
          thumbnail_url?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_garniture_versions_user_id_kitchen_id_fkey"
            columns: ["user_id", "kitchen_id"]
            isOneToOne: false
            referencedRelation: "kitchen_garnitures"
            referencedColumns: ["user_id", "id"]
          },
        ]
      }
      kitchen_garnitures: {
        Row: {
          created_at: string
          design: Json
          id: string
          name: string
          revision: number
          source_marketplace_design_id: string | null
          source_marketplace_version_id: string | null
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          design: Json
          id: string
          name: string
          revision?: number
          source_marketplace_design_id?: string | null
          source_marketplace_version_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          design?: Json
          id?: string
          name?: string
          revision?: number
          source_marketplace_design_id?: string | null
          source_marketplace_version_id?: string | null
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_garnitures_marketplace_source_fkey"
            columns: [
              "source_marketplace_design_id",
              "source_marketplace_version_id",
            ]
            isOneToOne: false
            referencedRelation: "kitchen_design_versions"
            referencedColumns: ["design_id", "id"]
          },
        ]
      }
      kitchen_marketplace_audit: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          design_id: string
          entity_id: string
          entity_type: string
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          design_id: string
          entity_id: string
          entity_type: string
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          design_id?: string
          entity_id?: string
          entity_type?: string
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_marketplace_audit_design_id_fkey"
            columns: ["design_id"]
            isOneToOne: false
            referencedRelation: "kitchen_designs"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_module_variants: {
        Row: {
          active: boolean
          configuration: Json
          created_at: string
          door_count: number
          drawer_count: number
          furniture_model_id: string
          is_default: boolean
          module_id: string
          opening: string
          sort_order: number
          updated_at: string
          variant_code: string
        }
        Insert: {
          active?: boolean
          configuration?: Json
          created_at?: string
          door_count?: number
          drawer_count?: number
          furniture_model_id: string
          is_default?: boolean
          module_id: string
          opening: string
          sort_order?: number
          updated_at?: string
          variant_code: string
        }
        Update: {
          active?: boolean
          configuration?: Json
          created_at?: string
          door_count?: number
          drawer_count?: number
          furniture_model_id?: string
          is_default?: boolean
          module_id?: string
          opening?: string
          sort_order?: number
          updated_at?: string
          variant_code?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_module_variants_furniture_model_id_fkey"
            columns: ["furniture_model_id"]
            isOneToOne: true
            referencedRelation: "furniture_models"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_module_variants_module_id_fkey"
            columns: ["module_id"]
            isOneToOne: false
            referencedRelation: "kitchen_modules"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_modules: {
        Row: {
          active: boolean
          cabinet_type: string
          code: string
          created_at: string
          depth_mm: number
          height_mm: number
          id: string
          name: string
          updated_at: string
          width_mm: number
        }
        Insert: {
          active?: boolean
          cabinet_type: string
          code: string
          created_at?: string
          depth_mm: number
          height_mm: number
          id?: string
          name: string
          updated_at?: string
          width_mm: number
        }
        Update: {
          active?: boolean
          cabinet_type?: string
          code?: string
          created_at?: string
          depth_mm?: number
          height_mm?: number
          id?: string
          name?: string
          updated_at?: string
          width_mm?: number
        }
        Relationships: []
      }
      kitchen_quote_requests: {
        Row: {
          contact_email: string
          contact_name: string
          contact_phone: string
          created_at: string
          customer_id: string
          customer_message: string
          design_id: string
          id: string
          idempotency_key: string
          merchant_note: string
          merchant_owner_id: string
          project_id: string | null
          project_name: string
          project_snapshot: Json
          quoted_price: number | null
          responded_at: string | null
          room_details: Json
          status: string
          store_id: string
          updated_at: string
          version_id: string
        }
        Insert: {
          contact_email: string
          contact_name: string
          contact_phone: string
          created_at?: string
          customer_id: string
          customer_message?: string
          design_id: string
          id?: string
          idempotency_key: string
          merchant_note?: string
          merchant_owner_id: string
          project_id?: string | null
          project_name: string
          project_snapshot: Json
          quoted_price?: number | null
          responded_at?: string | null
          room_details?: Json
          status?: string
          store_id: string
          updated_at?: string
          version_id: string
        }
        Update: {
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          created_at?: string
          customer_id?: string
          customer_message?: string
          design_id?: string
          id?: string
          idempotency_key?: string
          merchant_note?: string
          merchant_owner_id?: string
          project_id?: string | null
          project_name?: string
          project_snapshot?: Json
          quoted_price?: number | null
          responded_at?: string | null
          room_details?: Json
          status?: string
          store_id?: string
          updated_at?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_quote_requests_customer_id_project_id_fkey"
            columns: ["customer_id", "project_id"]
            isOneToOne: false
            referencedRelation: "kitchen_garnitures"
            referencedColumns: ["user_id", "id"]
          },
          {
            foreignKeyName: "kitchen_quote_requests_design_id_version_id_fkey"
            columns: ["design_id", "version_id"]
            isOneToOne: false
            referencedRelation: "kitchen_design_versions"
            referencedColumns: ["design_id", "id"]
          },
          {
            foreignKeyName: "kitchen_quote_requests_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "merchant_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_render_jobs: {
        Row: {
          created_at: string
          error: string | null
          finished_at: string | null
          id: string
          input_image_url: string | null
          metadata: Json
          model: string | null
          output_media_id: string | null
          prompt_snapshot: string
          provider: string | null
          requested_by: string
          started_at: string | null
          status: string
          version_id: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input_image_url?: string | null
          metadata?: Json
          model?: string | null
          output_media_id?: string | null
          prompt_snapshot?: string
          provider?: string | null
          requested_by: string
          started_at?: string | null
          status?: string
          version_id: string
        }
        Update: {
          created_at?: string
          error?: string | null
          finished_at?: string | null
          id?: string
          input_image_url?: string | null
          metadata?: Json
          model?: string | null
          output_media_id?: string | null
          prompt_snapshot?: string
          provider?: string | null
          requested_by?: string
          started_at?: string | null
          status?: string
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "kitchen_render_jobs_output_media_id_fkey"
            columns: ["output_media_id"]
            isOneToOne: false
            referencedRelation: "kitchen_design_media"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "kitchen_render_jobs_version_id_fkey"
            columns: ["version_id"]
            isOneToOne: false
            referencedRelation: "kitchen_design_versions"
            referencedColumns: ["id"]
          },
        ]
      }
      kitchen_render_policy: {
        Row: {
          enabled: boolean
          id: boolean
          requests_per_24h: number
        }
        Insert: {
          enabled?: boolean
          id?: boolean
          requests_per_24h?: number
        }
        Update: {
          enabled?: boolean
          id?: boolean
          requests_per_24h?: number
        }
        Relationships: []
      }
      material_definitions: {
        Row: {
          active: boolean
          base_color: string
          created_at: string
          id: string
          metalness: number
          name: string
          roughness: number
          surface_kind: string
          texture_paths: Json
          updated_at: string
        }
        Insert: {
          active?: boolean
          base_color: string
          created_at?: string
          id: string
          metalness?: number
          name: string
          roughness: number
          surface_kind: string
          texture_paths?: Json
          updated_at?: string
        }
        Update: {
          active?: boolean
          base_color?: string
          created_at?: string
          id?: string
          metalness?: number
          name?: string
          roughness?: number
          surface_kind?: string
          texture_paths?: Json
          updated_at?: string
        }
        Relationships: []
      }
      merchant_order_fulfillments: {
        Row: {
          commission_bps: number
          created_at: string
          items: Json
          merchant_net: number | null
          order_id: string
          owner_id: string
          platform_fee: number | null
          status: string
          store_id: string
          subtotal: number
          updated_at: string
        }
        Insert: {
          commission_bps?: number
          created_at?: string
          items: Json
          merchant_net?: number | null
          order_id: string
          owner_id: string
          platform_fee?: number | null
          status?: string
          store_id: string
          subtotal: number
          updated_at?: string
        }
        Update: {
          commission_bps?: number
          created_at?: string
          items?: Json
          merchant_net?: number | null
          order_id?: string
          owner_id?: string
          platform_fee?: number | null
          status?: string
          store_id?: string
          subtotal?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "merchant_order_fulfillments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "merchant_order_fulfillments_store_id_fkey"
            columns: ["store_id"]
            isOneToOne: false
            referencedRelation: "merchant_stores"
            referencedColumns: ["id"]
          },
        ]
      }
      merchant_stores: {
        Row: {
          active: boolean
          address: string
          categories: Json
          city: string
          commission_bps: number
          created_at: string
          description: string
          district: string
          featured_at: string | null
          featured_rank: number | null
          id: string
          image: string
          is_featured: boolean
          name: string
          owner_id: string | null
          phone: string
          store_type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          address: string
          categories?: Json
          city: string
          commission_bps?: number
          created_at?: string
          description?: string
          district?: string
          featured_at?: string | null
          featured_rank?: number | null
          id?: string
          image?: string
          is_featured?: boolean
          name: string
          owner_id?: string | null
          phone: string
          store_type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string
          categories?: Json
          city?: string
          commission_bps?: number
          created_at?: string
          description?: string
          district?: string
          featured_at?: string | null
          featured_rank?: number | null
          id?: string
          image?: string
          is_featured?: boolean
          name?: string
          owner_id?: string | null
          phone?: string
          store_type?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
          sender_type: string
          text: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
          sender_type: string
          text: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_type?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      model_assets: {
        Row: {
          byte_size: number | null
          created_at: string
          created_by: string | null
          id: string
          model_id: string
          original_name: string | null
          role: string
          sha256: string | null
          state: string
          storage_path: string
          updated_at: string
          validation: Json | null
          version_id: string
        }
        Insert: {
          byte_size?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          model_id: string
          original_name?: string | null
          role: string
          sha256?: string | null
          state?: string
          storage_path: string
          updated_at?: string
          validation?: Json | null
          version_id?: string
        }
        Update: {
          byte_size?: number | null
          created_at?: string
          created_by?: string | null
          id?: string
          model_id?: string
          original_name?: string | null
          role?: string
          sha256?: string | null
          state?: string
          storage_path?: string
          updated_at?: string
          validation?: Json | null
          version_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "model_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "model_assets_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "furniture_models"
            referencedColumns: ["id"]
          },
        ]
      }
      order_cancellations: {
        Row: {
          order_id: string
          reason: string
          refund_amount: number | null
          refund_method: string | null
          refund_reference: string | null
          refunded_at: string | null
          requested_at: string
          requested_by: string
          review_note: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
        }
        Insert: {
          order_id: string
          reason: string
          refund_amount?: number | null
          refund_method?: string | null
          refund_reference?: string | null
          refunded_at?: string | null
          requested_at?: string
          requested_by: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Update: {
          order_id?: string
          reason?: string
          refund_amount?: number | null
          refund_method?: string | null
          refund_reference?: string | null
          refunded_at?: string | null
          requested_at?: string
          requested_by?: string
          review_note?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_cancellations_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_cancellations_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "order_cancellations_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      order_payments: {
        Row: {
          callback_token: string
          created_at: string
          instructions: Json | null
          invoice_id: string | null
          method: string
          order_id: string
          paid_at: string | null
          provider_reference: string | null
          requires_review: boolean
          state: string
          verified_by: string | null
        }
        Insert: {
          callback_token: string
          created_at?: string
          instructions?: Json | null
          invoice_id?: string | null
          method: string
          order_id: string
          paid_at?: string | null
          provider_reference?: string | null
          requires_review?: boolean
          state?: string
          verified_by?: string | null
        }
        Update: {
          callback_token?: string
          created_at?: string
          instructions?: Json | null
          invoice_id?: string | null
          method?: string
          order_id?: string
          paid_at?: string | null
          provider_reference?: string | null
          requires_review?: boolean
          state?: string
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string
          currency: string
          delivery: Json
          id: string
          idempotency_key: string
          items: Json
          platform_fulfillment_status: string | null
          request_hash: string
          shipping: number
          status: string
          stock_reserved: boolean
          subtotal: number
          total: number
          user_id: string
        }
        Insert: {
          created_at?: string
          currency?: string
          delivery: Json
          id?: string
          idempotency_key: string
          items: Json
          platform_fulfillment_status?: string | null
          request_hash: string
          shipping: number
          status?: string
          stock_reserved?: boolean
          subtotal: number
          total: number
          user_id: string
        }
        Update: {
          created_at?: string
          currency?: string
          delivery?: Json
          id?: string
          idempotency_key?: string
          items?: Json
          platform_fulfillment_status?: string | null
          request_hash?: string
          shipping?: number
          status?: string
          stock_reserved?: boolean
          subtotal?: number
          total?: number
          user_id?: string
        }
        Relationships: []
      }
      product_media_assets: {
        Row: {
          created_at: string
          id: string
          owner_id: string
          public_id: string
          retired_at: string | null
          state: string
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          owner_id: string
          public_id: string
          retired_at?: string | null
          state?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          owner_id?: string
          public_id?: string
          retired_at?: string | null
          state?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_media_assets_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      product_media_refs: {
        Row: {
          asset_id: string
          model_id: string
        }
        Insert: {
          asset_id: string
          model_id: string
        }
        Update: {
          asset_id?: string
          model_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "product_media_refs_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "product_media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_media_refs_model_id_fkey"
            columns: ["model_id"]
            isOneToOne: false
            referencedRelation: "furniture_models"
            referencedColumns: ["id"]
          },
        ]
      }
      products_legacy_backup: {
        Row: {
          created_at: string
          data: Json
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data: Json
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data?: Json
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          full_name: string
          id: string
          role: string
        }
        Insert: {
          created_at?: string
          full_name?: string
          id: string
          role?: string
        }
        Update: {
          created_at?: string
          full_name?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      user_notifications: {
        Row: {
          body: string
          created_at: string
          entity_id: string | null
          href: string
          id: string
          kind: string
          metadata: Json
          read_at: string | null
          source_key: string
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          entity_id?: string | null
          href: string
          id?: string
          kind: string
          metadata?: Json
          read_at?: string | null
          source_key: string
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          entity_id?: string | null
          href?: string
          id?: string
          kind?: string
          metadata?: Json
          read_at?: string | null
          source_key?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_kitchen_design_media: {
        Args: {
          p_actor: string
          p_alt: string
          p_design: string
          p_height: number
          p_kind: string
          p_metadata: Json
          p_primary: boolean
          p_url: string
          p_version: string
          p_width: number
        }
        Returns: string
      }
      admin_3d_model_requests: { Args: { p_actor: string }; Returns: Json }
      admin_complete_furniture_model_upload: {
        Args: { p_actor: string; p_model: string; p_source_path: string }
        Returns: Json
      }
      admin_marketplace_analytics: { Args: { p_actor: string }; Returns: Json }
      admin_merchant_overview: { Args: { p_actor: string }; Returns: Json }
      admin_order_analytics: { Args: never; Returns: Json }
      admin_update_merchant_settings: {
        Args: {
          p_active: boolean
          p_actor: string
          p_commission_bps: number
          p_featured_rank: number
          p_is_featured: boolean
          p_store_id: string
        }
        Returns: Json
      }
      archive_kitchen_design: {
        Args: { p_actor: string; p_design: string }
        Returns: undefined
      }
      cancel_kitchen_render: {
        Args: { p_actor: string; p_job: string; p_note: string }
        Returns: undefined
      }
      claim_furniture_model_export_job: {
        Args: never
        Returns: {
          archived_at: string | null
          archived_by: string | null
          badges: Json
          base_price: number
          cabinet_module_id: string | null
          category: string
          colors: Json
          compare_at_price: number | null
          created_at: string
          default_color: string | null
          delivery_terms: string | null
          description: string
          dimensions_d: number
          dimensions_h: number
          dimensions_w: number
          export_error: string | null
          export_job_id: string | null
          export_requested_at: string | null
          export_status: string
          export_updated_at: string | null
          glb_path: string | null
          glb_validation: Json | null
          id: string
          image_url: string | null
          images: Json
          in_stock: number | null
          is_best_seller: boolean
          is_new: boolean
          materials: Json
          model_requested: boolean
          model_requested_at: string | null
          model_requested_by_store_id: string | null
          name: string
          preview_glb_path: string | null
          processing_error: string | null
          processing_job_id: string | null
          processing_requested_at: string | null
          processing_status: string
          processing_updated_at: string | null
          product_id: string
          promotion_ends_at: string | null
          promotion_label: string | null
          rating: number
          review_count: number
          scale: number
          source_glb_path: string | null
          standard_glb_path: string | null
          store_ids: Json
          thumbnail_path: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "furniture_models"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_furniture_model_job: {
        Args: never
        Returns: {
          archived_at: string | null
          archived_by: string | null
          badges: Json
          base_price: number
          cabinet_module_id: string | null
          category: string
          colors: Json
          compare_at_price: number | null
          created_at: string
          default_color: string | null
          delivery_terms: string | null
          description: string
          dimensions_d: number
          dimensions_h: number
          dimensions_w: number
          export_error: string | null
          export_job_id: string | null
          export_requested_at: string | null
          export_status: string
          export_updated_at: string | null
          glb_path: string | null
          glb_validation: Json | null
          id: string
          image_url: string | null
          images: Json
          in_stock: number | null
          is_best_seller: boolean
          is_new: boolean
          materials: Json
          model_requested: boolean
          model_requested_at: string | null
          model_requested_by_store_id: string | null
          name: string
          preview_glb_path: string | null
          processing_error: string | null
          processing_job_id: string | null
          processing_requested_at: string | null
          processing_status: string
          processing_updated_at: string | null
          product_id: string
          promotion_ends_at: string | null
          promotion_label: string | null
          rating: number
          review_count: number
          scale: number
          source_glb_path: string | null
          standard_glb_path: string | null
          store_ids: Json
          thumbnail_path: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "furniture_models"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_kitchen_render: {
        Args: { p_actor: string; p_job: string }
        Returns: Json
      }
      claim_order_payment: {
        Args: {
          p_actor: string
          p_callback_token: string
          p_method: string
          p_order: string
        }
        Returns: Json
      }
      clone_published_kitchen_design: {
        Args: { p_actor: string; p_design: string; p_project: string }
        Returns: Json
      }
      complete_kitchen_render: {
        Args: {
          p_actor: string
          p_alt: string
          p_height: number
          p_job: string
          p_metadata: Json
          p_url: string
          p_width: number
        }
        Returns: string
      }
      confirm_order_payment: {
        Args: {
          p_amount: number
          p_method: string
          p_order_id: string
          p_reference: string
          p_verified_by?: string
        }
        Returns: undefined
      }
      create_kitchen_marketplace_design: {
        Args: {
          p_actor: string
          p_payload: Json
          p_slug: string
          p_source_id: string
        }
        Returns: Json
      }
      create_kitchen_quote_request: {
        Args: {
          p_actor: string
          p_contact: Json
          p_design: string
          p_idempotency: string
          p_message: string
          p_project: string
          p_room: Json
        }
        Returns: Json
      }
      fail_kitchen_render: {
        Args: {
          p_actor: string
          p_error: string
          p_job: string
          p_metadata?: Json
        }
        Returns: undefined
      }
      is_furniture_category: { Args: { value: string }; Returns: boolean }
      merchant_dashboard_analytics: { Args: { p_actor: string }; Returns: Json }
      migrate_model_glb_r2: {
        Args: { p_expected: string; p_id: string; p_new: string }
        Returns: boolean
      }
      publish_kitchen_design: {
        Args: { p_actor: string; p_design: string; p_version: string }
        Returns: undefined
      }
      queue_model_asset: {
        Args: {
          p_actor: string
          p_model: string
          p_path: string
          p_sha256: string
          p_validation: Json
        }
        Returns: string
      }
      read_customer_kitchen_quotes: {
        Args: { p_actor: string; p_focus?: string; p_page?: number }
        Returns: Json
      }
      read_featured_merchants: { Args: { p_limit?: number }; Returns: Json }
      read_kitchen_render_usage: { Args: { p_actor: string }; Returns: Json }
      read_merchant_kitchen_quotes: {
        Args: { p_actor: string; p_focus?: string; p_page?: number }
        Returns: Json
      }
      read_merchant_orders: {
        Args: { p_actor: string; p_page?: number }
        Returns: Json
      }
      read_merchant_products: {
        Args: { p_actor: string; p_after?: string }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          badges: Json
          base_price: number
          cabinet_module_id: string | null
          category: string
          colors: Json
          compare_at_price: number | null
          created_at: string
          default_color: string | null
          delivery_terms: string | null
          description: string
          dimensions_d: number
          dimensions_h: number
          dimensions_w: number
          export_error: string | null
          export_job_id: string | null
          export_requested_at: string | null
          export_status: string
          export_updated_at: string | null
          glb_path: string | null
          glb_validation: Json | null
          id: string
          image_url: string | null
          images: Json
          in_stock: number | null
          is_best_seller: boolean
          is_new: boolean
          materials: Json
          model_requested: boolean
          model_requested_at: string | null
          model_requested_by_store_id: string | null
          name: string
          preview_glb_path: string | null
          processing_error: string | null
          processing_job_id: string | null
          processing_requested_at: string | null
          processing_status: string
          processing_updated_at: string | null
          product_id: string
          promotion_ends_at: string | null
          promotion_label: string | null
          rating: number
          review_count: number
          scale: number
          source_glb_path: string | null
          standard_glb_path: string | null
          store_ids: Json
          thumbnail_path: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "furniture_models"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      read_merchant_products_v2: {
        Args: {
          p_actor: string
          p_after?: string
          p_include_archived?: boolean
        }
        Returns: {
          archived_at: string | null
          archived_by: string | null
          badges: Json
          base_price: number
          cabinet_module_id: string | null
          category: string
          colors: Json
          compare_at_price: number | null
          created_at: string
          default_color: string | null
          delivery_terms: string | null
          description: string
          dimensions_d: number
          dimensions_h: number
          dimensions_w: number
          export_error: string | null
          export_job_id: string | null
          export_requested_at: string | null
          export_status: string
          export_updated_at: string | null
          glb_path: string | null
          glb_validation: Json | null
          id: string
          image_url: string | null
          images: Json
          in_stock: number | null
          is_best_seller: boolean
          is_new: boolean
          materials: Json
          model_requested: boolean
          model_requested_at: string | null
          model_requested_by_store_id: string | null
          name: string
          preview_glb_path: string | null
          processing_error: string | null
          processing_job_id: string | null
          processing_requested_at: string | null
          processing_status: string
          processing_updated_at: string | null
          product_id: string
          promotion_ends_at: string | null
          promotion_label: string | null
          rating: number
          review_count: number
          scale: number
          source_glb_path: string | null
          standard_glb_path: string | null
          store_ids: Json
          thumbnail_path: string | null
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "furniture_models"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      read_merchant_store: { Args: { p_actor: string }; Returns: Json }
      replace_furniture_glb: {
        Args: { p_expected_file: string; p_id: string; p_new: string }
        Returns: boolean
      }
      replace_model_glb: {
        Args: { p_expected_file: string; p_id: string; p_new: string }
        Returns: boolean
      }
      request_furniture_model_export: {
        Args: { p_actor: string; p_model: string }
        Returns: Json
      }
      request_kitchen_render: {
        Args: {
          p_actor: string
          p_consent?: boolean
          p_design: string
          p_model: string
          p_prompt: string
          p_provider: string
          p_source_media: string
          p_version: string
        }
        Returns: string
      }
      request_order_cancellation: {
        Args: { p_actor: string; p_order: string; p_reason: string }
        Returns: Json
      }
      resolve_order_cancellation: {
        Args: {
          p_action: string
          p_actor: string
          p_amount?: number
          p_note: string
          p_order: string
          p_reference?: string
        }
        Returns: Json
      }
      review_kitchen_design: {
        Args: {
          p_action: string
          p_actor: string
          p_design: string
          p_note?: string
          p_version: string
        }
        Returns: undefined
      }
      save_catalog_product: {
        Args: { p_create: boolean; p_data: Json }
        Returns: undefined
      }
      save_furniture_product: {
        Args: { p_create: boolean; p_data: Json; p_expected_stock?: number }
        Returns: undefined
      }
      save_furniture_product_pre_phase5: {
        Args: { p_create: boolean; p_data: Json; p_expected_stock?: number }
        Returns: undefined
      }
      save_kitchen_marketplace_version: {
        Args: {
          p_actor: string
          p_design: string
          p_mode: string
          p_payload: Json
          p_version: string
        }
        Returns: Json
      }
      save_kitchen_module_variant: {
        Args: {
          p_actor: string
          p_model: string
          p_module: string
          p_payload: Json
        }
        Returns: undefined
      }
      save_kitchen_project: {
        Args: {
          p_actor: string
          p_design: Json
          p_expected_revision?: number
          p_id: string
          p_name: string
        }
        Returns: Json
      }
      save_merchant_product: {
        Args: {
          p_actor: string
          p_create: boolean
          p_data: Json
          p_expected_stock?: number
        }
        Returns: undefined
      }
      save_merchant_product_pre_phase5: {
        Args: {
          p_actor: string
          p_create: boolean
          p_data: Json
          p_expected_stock?: number
          p_model_requested?: boolean
        }
        Returns: undefined
      }
      save_merchant_product_v2: {
        Args: {
          p_actor: string
          p_create: boolean
          p_data: Json
          p_expected_stock?: number
          p_model_requested?: boolean
        }
        Returns: undefined
      }
      save_merchant_store: {
        Args: { p_actor: string; p_data: Json }
        Returns: Json
      }
      set_kitchen_module_variant_active: {
        Args: { p_active: boolean; p_actor: string; p_model: string }
        Returns: undefined
      }
      set_merchant_product_archived: {
        Args: { p_actor: string; p_archived: boolean; p_product: string }
        Returns: undefined
      }
      set_merchant_role: {
        Args: { p_actor: string; p_role: string; p_target: string }
        Returns: undefined
      }
      set_model_archived: {
        Args: { p_actor: string; p_archived: boolean; p_model: string }
        Returns: undefined
      }
      set_product_glb: {
        Args: {
          p_expected: Json
          p_model_id: string
          p_new: string
          p_product_id: string
        }
        Returns: Json
      }
      submit_contact_message: {
        Args: { p_email: string; p_message: string; p_name: string }
        Returns: string
      }
      submit_kitchen_design: {
        Args: { p_actor: string; p_design: string; p_version: string }
        Returns: undefined
      }
      sync_order_fulfillment_status: {
        Args: { p_order: string }
        Returns: undefined
      }
      update_merchant_kitchen_quote: {
        Args: {
          p_actor: string
          p_expected_status: string
          p_note: string
          p_price: number
          p_quote: string
          p_status: string
        }
        Returns: undefined
      }
      update_merchant_order: {
        Args: {
          p_actor: string
          p_expected_status: string
          p_order: string
          p_status: string
        }
        Returns: undefined
      }
      update_platform_order: {
        Args: {
          p_actor: string
          p_expected_status: string
          p_order: string
          p_status: string
        }
        Returns: undefined
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

