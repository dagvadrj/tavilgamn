# Data dictionary

Schema source: generated `src/lib/supabase/database.types.ts`, refreshed from project gpdpaexkmuhxzknguicp on 2026-10-02 after the Phase 4 migration. Field lists below are derived documentation, not editable schema definitions. Change schema through migrations, regenerate types, then refresh this dictionary.

## Storage and interpretation

- Canonical store/product data: merchant_stores/furniture_models. Category metadata is the code manifest catalogCategories.ts; SQL only enforces valid keys.
- `Json` means a JSONB wire boundary. Services validate domain structure; it is not an unchecked domain TypeScript interface.
- Nullable fields include `| null`; generated Insert/Update/default/relationship/RPC contracts remain in database.types.ts.
- Prices use MNT; room/furniture dimensions in furniture_models are metres, kitchen module/version dimensions marked `_mm` are millimetres. Stock is integer or NULL for unavailable/unknown per inventory rules.
- Order, commission, quotation and published-version copies are deliberate immutable historical snapshots, not independently editable masters.
- Auth users/sessions and storage.objects belong to Supabase-managed schemas. Browser drafts, designs, cart and wishlist are per-user local recovery/selections, not server-authoritative pricing or permissions.
- Foreign keys are listed in the generated Relationships contract. Semantic product membership uses furniture_models.store_ids; there is no independent Store.productIds list.

## Public schema tables

### model_assets

Private server-only asset/version ledger. FK model_id → furniture_models; created_by → profiles. Unique storage_path. Client SELECT/CRUD grants are revoked; RLS denies direct public access. The controlled file API serves only current or unambiguously matching available/retired delivery, preview and thumbnail filenames; it never exposes sources/private exports.

| Column | Generated row type / meaning |
|---|---|
| id, model_id, version_id | string UUID |
| role | string: source, delivery, preview, standard, thumbnail |
| storage_path | string, unique immutable object locator |
| original_name | string or null, informational upload label |
| byte_size | number or null, 12–209715200 when known |
| sha256 | string or null, source integrity checksum |
| state | string: pending, available, retired, deleted |
| validation | Json or null |
| created_by | string UUID or null for pre-existing/worker assets |
| created_at, updated_at | string timestamp |

RPCs queue_model_asset(actor, model, path, checksum, validation) and set_model_archived(actor, model, archived) are service-only entry points with independent admin/profile checks and transactional locks.

### contact_messages

Private contact inbox; contact API → admin/messages.

| Column | Generated row type |
|---|---|
| `created_at` | `string` |
| `email` | `string` |
| `id` | `string` |
| `message` | `string` |
| `name` | `string` |

### conversations

Reserved messaging infrastructure; no current application API owner. Not a second store/catalog.

| Column | Generated row type |
|---|---|
| `customer_id` | `string` |
| `id` | `string` |
| `merchant_id` | `string` |
| `updated_at` | `string` |

### furniture_models

Canonical product, inventory, model delivery and processing/export state; catalog/admin/merchant and model worker.

Phase 2 fields: archived_at / archived_by (nullable timestamp/actor FK), cabinet_module_id (nullable kitchen_modules FK), glb_validation (nullable JSON validation report, physical dimensions, optional frontProjectionMm). An audited legacy report may explicitly be dimensions-only; it must not claim a complete new-source authoring validation.

| Column | Generated row type |
|---|---|
| `badges` | `Json` |
| `base_price` | `number` |
| `category` | `string` |
| `colors` | `Json` |
| `created_at` | `string` |
| `default_color` | `string | null` |
| `description` | `string` |
| `dimensions_d` | `number` |
| `dimensions_h` | `number` |
| `dimensions_w` | `number` |
| `export_error` | `string | null` |
| `export_job_id` | `string | null` |
| `export_requested_at` | `string | null` |
| `export_status` | `string` |
| `export_updated_at` | `string | null` |
| `glb_path` | `string | null` |
| `id` | `string` |
| `image_url` | `string | null` |
| `images` | `Json` |
| `in_stock` | `number | null` |
| `is_best_seller` | `boolean` |
| `is_new` | `boolean` |
| `materials` | `Json` |
| `model_requested` | `boolean` |
| `model_requested_at` | `string | null` |
| `model_requested_by_store_id` | `string | null` |
| `name` | `string` |
| `preview_glb_path` | `string | null` |
| `processing_error` | `string | null` |
| `processing_job_id` | `string | null` |
| `processing_requested_at` | `string | null` |
| `processing_status` | `string` |
| `processing_updated_at` | `string | null` |
| `product_id` | `string` |
| `rating` | `number` |
| `review_count` | `number` |
| `scale` | `number` |
| `source_glb_path` | `string | null` |
| `standard_glb_path` | `string | null` |
| `store_ids` | `Json` |
| `thumbnail_path` | `string | null` |
| `updated_at` | `string` |

### kitchen_design_media

Version-owned published/merchant images and renders; media and render APIs.

| Column | Generated row type |
|---|---|
| `alt_text` | `string` |
| `created_at` | `string` |
| `height` | `number | null` |
| `id` | `string` |
| `is_primary` | `boolean` |
| `kind` | `string` |
| `metadata` | `Json` |
| `sort_order` | `number` |
| `source` | `string` |
| `status` | `string` |
| `updated_at` | `string` |
| `url` | `string` |
| `version_id` | `string` |
| `width` | `number | null` |

### kitchen_design_reviews

Private moderation audit records; admin review RPC.

| Column | Generated row type |
|---|---|
| `action` | `string` |
| `created_at` | `string` |
| `design_id` | `string` |
| `id` | `string` |
| `note` | `string` |
| `reviewer_id` | `string` |
| `version_id` | `string | null` |

### kitchen_design_versions

Immutable/pending marketplace versions with saved geometry, marketing fields and price snapshots.

| Column | Generated row type |
|---|---|
| `approved_at` | `string | null` |
| `base_count` | `number` |
| `cabinet_count` | `number` |
| `calculated_at` | `string | null` |
| `calculated_price` | `number | null` |
| `component_product_ids` | `Json` |
| `created_at` | `string` |
| `created_by` | `string` |
| `currency` | `string` |
| `description` | `string` |
| `design` | `Json` |
| `design_id` | `string` |
| `exclusions` | `Json` |
| `id` | `string` |
| `inclusions` | `Json` |
| `installation_included` | `boolean` |
| `layout` | `string` |
| `lead_time_days` | `number | null` |
| `max_height_mm` | `number` |
| `min_room_depth_mm` | `number` |
| `min_room_width_mm` | `number` |
| `price_from` | `number | null` |
| `price_to` | `number | null`; optional upper bound, only for `from` mode and at least `price_from` |
| `materials` | `Json`; validated array of at most 50 material labels |
| `pricing_mode` | `string` |
| `review_status` | `string` |
| `service_areas` | `Json` |
| `short_description` | `string` |
| `style` | `string` |
| `submitted_at` | `string | null` |
| `tags` | `Json` |
| `tall_count` | `number` |
| `title` | `string` |
| `updated_at` | `string` |
| `version_no` | `number` |
| `wall_count` | `number` |
| `warranty_months` | `number | null` |

### kitchen_designs

Marketplace identity, store owner, slug and pointer to published version.

| Column | Generated row type |
|---|---|
| `created_at` | `string` |
| `created_by` | `string` |
| `featured` | `boolean` |
| `featured_rank` | `number | null` |
| `id` | `string` |
| `publication_status` | `string` |
| `published_at` | `string | null` |
| `published_version_id` | `string | null` |
| `slug` | `string` |
| `source_garniture_id` | `string | null` |
| `store_id` | `string` |
| `updated_at` | `string` |

### kitchen_garnitures

User-owned editable kitchen projects; kitchens API and kitchen library store. `revision` is database-managed; save_kitchen_project performs an atomic expected-revision check. Changes to name/design create a new snapshot; thumbnail-only updates do not.

| Column | Generated row type |
|---|---|
| `created_at` | `string` |
| `design` | `Json` |
| `id` | `string` |
| `name` | `string` |
| `source_marketplace_design_id` | `string | null` |
| `source_marketplace_version_id` | `string | null` |
| `thumbnail_url` | `string | null` |
| `updated_at` | `string` |
| `user_id` | `string` |
| `revision` | `number` |

### kitchen_garniture_versions

Owner-private editor snapshots, separate from published marketplace versions. Primary key `(user_id,kitchen_id,revision)`; compound foreign key cascades only with explicit project deletion. Owner can read; only the non-exposed snapshot trigger writes version content. Restoring creates a normal new save, never rewrites history.

| Column | Generated row type |
|---|---|
| `user_id` | `string` |
| `kitchen_id` | `string` |
| `revision` | `number` |
| `name` | `string` |
| `design` | `Json` |
| `thumbnail_url` | `string | null` |
| `created_at` | `string` |

Editor JSON version 1 optionally contains `extras`: validated product snapshots with mm dimensions, floor poses, category/material/color and safe model filenames. Server pricing is not stored in the client design; BOM reads current public catalog prices and explicitly flags unknown rates.

### kitchen_module_variants

GLB furniture-model linkage and selectable modular cabinet configuration.

| Column | Generated row type |
|---|---|
| `active` | `boolean` |
| `configuration` | `Json` |
| `created_at` | `string` |
| `door_count` | `number` |
| `drawer_count` | `number` |
| `furniture_model_id` | `string` |
| `is_default` | `boolean` |
| `module_id` | `string` |
| `opening` | `string` |
| `sort_order` | `number` |
| `updated_at` | `string` |
| `variant_code` | `string` |

### kitchen_modules

Canonical modular kitchen catalog dimensions and type; kitchen-modules/admin.

| Column | Generated row type |
|---|---|
| `active` | `boolean` |
| `cabinet_type` | `string` |
| `code` | `string` |
| `created_at` | `string` |
| `depth_mm` | `number` |
| `height_mm` | `number` |
| `id` | `string` |
| `name` | `string` |
| `updated_at` | `string` |
| `width_mm` | `number` |

### kitchen_quote_requests

Customer-to-store quotation requests with status, contact and immutable source snapshots.

| Column | Generated row type |
|---|---|
| `contact_email` | `string` |
| `contact_name` | `string` |
| `contact_phone` | `string` |
| `created_at` | `string` |
| `customer_id` | `string` |
| `customer_message` | `string` |
| `design_id` | `string` |
| `id` | `string` |
| `idempotency_key` | `string` |
| `merchant_note` | `string` |
| `merchant_owner_id` | `string` |
| `project_id` | `string | null` |
| `project_name` | `string` |
| `project_snapshot` | `Json` |
| `quoted_price` | `number | null` |
| `responded_at` | `string | null` |
| `room_details` | `Json` |
| `status` | `string` |
| `store_id` | `string` |
| `updated_at` | `string` |
| `version_id` | `string` |

### kitchen_render_jobs

Persisted AI-render lifecycle and output linkage; merchant requests/admin generation.
New requests require explicit consent. Metadata preserves consent version/time
when provider results are merged. All request outcomes count toward the rolling
store allowance. Cancellation is permitted only while queued; claim/complete
remain service-only actor-verified operations.

| Column | Generated row type |
|---|---|
| `created_at` | `string` |
| `error` | `string | null` |
| `finished_at` | `string | null` |
| `id` | `string` |
| `input_image_url` | `string | null` |
| `metadata` | `Json` |
| `model` | `string | null` |
| `output_media_id` | `string | null` |
| `prompt_snapshot` | `string` |
| `provider` | `string | null` |
| `requested_by` | `string` |
| `started_at` | `string | null` |
| `status` | `string` |
| `version_id` | `string` |

### kitchen_marketplace_audit

Append-only, private marketplace event ledger. Design FK restricts deletion.
Browser grants are revoked and RLS has no public policy. Owner/admin API summaries
include events; public listings never do. Trigger-generated metadata intentionally
excludes customer contacts and AI prompts. No retrospective audit history is
fabricated for actions before this migration.

| Column | Generated row type / meaning |
|---|---|
| `id`, `design_id`, `entity_id` | `string`; UUID event, listing and affected entity |
| `actor_id` | `string | null`; verified actor, null for infrastructure-originated events |
| `action`, `entity_type` | `string`; lifecycle/content/media/render/quote/clone action |
| `metadata` | `Json`; minimal status/pointer metadata |
| `created_at` | `string`; timestamp |

### kitchen_render_policy

Private singleton policy, not directly editable by browser clients. Initial
allowance is 3 requests per store in a rolling 24h window. This is a conservative
MVP default, not a user-approved billing commitment. Read allowance through the
actor-bound usage RPC; no policy-management UI was added in Phase 4.

| Column | Generated row type / meaning |
|---|---|
| `id` | `boolean`; constrained to true for singleton |
| `enabled` | `boolean`; request availability |
| `requests_per_24h` | `number`; integer 0–100 |

### material_definitions

Canonical material/color/texture definitions; kitchen modules/admin texture APIs.

| Column | Generated row type |
|---|---|
| `active` | `boolean` |
| `base_color` | `string` |
| `created_at` | `string` |
| `id` | `string` |
| `metalness` | `number` |
| `name` | `string` |
| `roughness` | `number` |
| `surface_kind` | `string` |
| `texture_paths` | `Json` |
| `updated_at` | `string` |

### merchant_order_fulfillments

Immutable per-merchant order ownership/line/commission snapshot, mutable fulfillment status.

| Column | Generated row type |
|---|---|
| `commission_bps` | `number` |
| `created_at` | `string` |
| `items` | `Json` |
| `merchant_net` | `number | null` |
| `order_id` | `string` |
| `owner_id` | `string` |
| `platform_fee` | `number | null` |
| `status` | `string` |
| `store_id` | `string` |
| `subtotal` | `number` |
| `updated_at` | `string` |

### merchant_stores

Canonical merchant and platform directory profiles. NULL owner_id is platform-managed, never a grant.

| Column | Generated row type |
|---|---|
| `active` | `boolean` |
| `address` | `string` |
| `categories` | `Json` |
| `city` | `string` |
| `commission_bps` | `number` |
| `created_at` | `string` |
| `description` | `string` |
| `district` | `string` |
| `featured_at` | `string | null` |
| `featured_rank` | `number | null` |
| `id` | `string` |
| `image` | `string` |
| `is_featured` | `boolean` |
| `name` | `string` |
| `owner_id` | `string | null` |
| `phone` | `string` |
| `store_type` | `string` |
| `updated_at` | `string` |

### messages

Reserved messaging infrastructure; no current application API owner.

| Column | Generated row type |
|---|---|
| `conversation_id` | `string` |
| `created_at` | `string` |
| `id` | `string` |
| `sender_id` | `string` |
| `sender_type` | `string` |
| `text` | `string` |

### order_payments

Private provider invoice, callback token, settlement state and payment instructions.

| Column | Generated row type |
|---|---|
| `callback_token` | `string` |
| `created_at` | `string` |
| `instructions` | `Json | null` |
| `invoice_id` | `string | null` |
| `method` | `string` |
| `order_id` | `string` |
| `paid_at` | `string | null` |
| `provider_reference` | `string | null` |
| `state` | `string` |
| `verified_by` | `string | null` |

### orders

Server-priced customer order with immutable line and delivery snapshots.

| Column | Generated row type |
|---|---|
| `created_at` | `string` |
| `currency` | `string` |
| `delivery` | `Json` |
| `id` | `string` |
| `idempotency_key` | `string` |
| `items` | `Json` |
| `request_hash` | `string` |
| `shipping` | `number` |
| `status` | `string` |
| `stock_reserved` | `boolean` |
| `subtotal` | `number` |
| `total` | `number` |
| `user_id` | `string` |

### products_legacy_backup

Archived pre-catalog-migration data. No runtime queries; intentionally not deleted.

| Column | Generated row type |
|---|---|
| `created_at` | `string` |
| `data` | `Json` |
| `id` | `string` |
| `updated_at` | `string` |

### profiles

Fresh end-user role and profile; auth identity lives in auth.users.

| Column | Generated row type |
|---|---|
| `created_at` | `string` |
| `full_name` | `string` |
| `id` | `string` |
| `role` | `string` |

### user_notifications

User-owned persisted notification records; kitchen review/merchant notification flow.

| Column | Generated row type |
|---|---|
| `body` | `string` |
| `created_at` | `string` |
| `entity_id` | `string | null` |
| `href` | `string` |
| `id` | `string` |
| `kind` | `string` |
| `metadata` | `Json` |
| `read_at` | `string | null` |
| `source_key` | `string` |
| `title` | `string` |
| `user_id` | `string` |

## Mutation boundaries

End-user clients never receive the server secret. Direct client grants are read-limited by projections and RLS. Writes go through authenticated API routes and server-only RPCs; provider callbacks verify their own tokens/signatures. See [role matrix](role-permissions.md).

`owner_id` NULL platform stores are public directory records only. They do not produce a private merchant fulfillment or create an account. Merchant ownership is bound to authenticated actor IDs, and supplied owner/store IDs are ignored by store creation RPCs.
