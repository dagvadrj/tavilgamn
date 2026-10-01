# Architecture — Phase 1

Updated: 2026-10-01. This document describes the current implementation, not a future redesign.

## Route shells

```mermaid
flowchart TD
  Root["app/layout: fonts, auth bootstrap, skip link, diagnostics"] --> Shop["(shop)/layout: Header + main + Footer"]
  Root --> Planner["(planner)/layout: fullscreen main"]
  Root --> Admin["(admin)/layout: admin main"]
  Shop --> Catalog["catalog, product, stores, account, merchant, checkout"]
  Planner --> Room["/planner → RoomPlanner controller"]
  Planner --> Kitchen["/kitchen → KitchenPlanner → ModularKitchenPlanner controller"]
  Room --> RoomUI["features/room-planner: UI hook + panels"]
  Kitchen --> KitchenUI["features/kitchen-planner: catalog hook + panels"]
  Room --> Scenes["three/: dynamically loaded scenes + model delivery"]
  Kitchen --> Scenes
  Catalog --> API["app/api + lib/server services"]
  Kitchen --> API
  API --> Guard["supabase/authorize: verified user + fresh profiles.role"]
  Guard --> DB["Typed Supabase server client → tables/RPCs"]
  API --> Errors["api/errors: error string + code + HTTP status; private,no-store"]
```

Parenthesized route groups do not change URLs. Root layout contains no store chrome.
Neither planner route mounts the store Header/Footer. Admin has its own shell.
The shop's merchant workspace deliberately retains shop navigation.

## Feature dependency map

| Feature / routes | Controller, panel, service | API | Authoritative tables | Client store |
|---|---|---|---|---|
| Catalog / product | CatalogView, ProductCustomizer; catalogServer/catalogValidation | products, models | furniture_models | catalog (cache/derived view) |
| Store directory / home | storeDirectory; FeaturedMerchants | stores, stores/featured | merchant_stores | none |
| Account / login / register | account route; authFetch/authErrors | protected routes use requireUser | auth.users, profiles | auth |
| Room planner | components/RoomPlanner; features/room-planner/hooks and components | products, models, kitchens | furniture_models; kitchen_garnitures for imported kitchens | designs, catalog |
| Kitchen editor | KitchenPlanner/ModularKitchenPlanner; features/kitchen-planner; kitchenAssembly/Placement | kitchen-modules, kitchens, kitchens/[id]/thumbnail | kitchen_modules, kitchen_module_variants, material_definitions, kitchen_garnitures | kitchens |
| Kitchen marketplace | (shop)/kitchens routes; kitchenMarketplaceServer and validation | kitchen-designs, merchant/kitchen-designs/*, admin/kitchen-designs | kitchen_designs, kitchen_design_versions, kitchen_design_media, kitchen_design_reviews, kitchen_render_jobs | editor projects remain in kitchens |
| Kitchen quotation | kitchenQuotes validation; merchant/customer panels | kitchen-designs/[id]/quotes, kitchen-quotes, merchant/kitchen-quotes | kitchen_quote_requests | none |
| Merchant workspace | MerchantDashboard; merchantServer/Validation | merchant/store, products, orders, analytics, notifications | merchant_stores, furniture_models, merchant_order_fulfillments, user_notifications | auth |
| Admin | admin route; AdminProducts/KitchenModules/Merchants panels | admin/* | profiles and feature tables above | auth |
| Checkout / payment | orderService/orderValidation; payments/providers and settlement | orders/*, payments/* | orders, order_payments, merchant_order_fulfillments | cart (selection only) |
| Wishlist | wishlist route / product controls | products | furniture_models | wishlist (IDs only) |
| Contact | contact/siteContact | contact, admin/messages | contact_messages | none |
| GLB processing/export | modelAssets/r2Models/modelPrefetch; scripts/models worker | models/*, admin/models/*, kitchen/export/skp | furniture_models; configured R2/Supabase storage | catalog + decoded cache |

API names above are under /api. Feature business rules belong in lib/; route handlers
verify identity, validate input and call those services or transactional RPCs.
Scene code belongs in three/, not API handlers. Panels own presentation; hooks own
ephemeral UI or cancellable fetching. Existing large controller entry files stay in
components/ for compatibility; further panel extraction is incremental, not a
requirement that every legacy component be rewritten in one release.

## Single-source rules

- Product metadata, stock and price: furniture_models. catalog/modelRegistry are
  read caches and derived adapters, never competing editable catalogs.
- Store metadata: merchant_stores. Static stores.ts and runtime fallback removed.
  owner_id NULL denotes a platform directory store, not a merchant account.
  Existing IDs and furniture_models.store_ids are preserved by migration.
  Product membership is derived from store_ids; Store.productIds was removed.
- Furniture category IDs, names and images: lib/catalogCategories.ts. Category
  type, labels, navigation and validation derive from this manifest. SQL category
  enforcement is a generated migration snapshot tested against the manifest,
  not an independently edited catalog. A category change requires a new migration.
- Persisted room designs: store/designs per-user browser storage. Kitchen account
  projects: kitchen_garnitures via store/kitchens. Local kitchen drafts are recovery
  data, not another public catalog.
- Immutable orders, published design versions, quotation snapshots and room
  imports intentionally retain historical copies. They must not be updated when
  a current product, store or saved kitchen changes.
- products_legacy_backup is an archival database table, not queried by app routes.
  It was not deleted as part of source-file cleanup.

## Types and API contract

database.types.ts is generated from the real public schema through Supabase MCP.
Both browser and server clients use createClient<Database>. database.ts overrides
only explicitly named RPC arguments that SQL accepts as NULL but the generator
represents as non-null. Domain objects are validated and serialized with toJson;
RPC JSON arrays/objects are narrowed at their boundary.

All API error responses preserve the existing UI-compatible string:
```json
{"error":"Нэвтрэх шаардлагатай.","code":"AUTH_REQUIRED"}
```

HTTP status remains the source of transport semantics. Errors use private,no-store
and preserve operational headers such as Retry-After. Successful responses retain
their feature-specific envelopes, including model status payloads whose error
field may legitimately be NULL.

requireUser, requireAdmin and requireMerchant delegate to one authorize helper.
All verify getUser(token); privileged roles come from a fresh profiles row.
They never authorize from user_metadata. RPCs independently recheck actors,
ownership and transactional state. Admin is not implicitly a merchant.
See [role permissions](role-permissions.md) and [data dictionary](data-dictionary.md).

## Migration, verification and cleanup

Migration: 20261001092640_architecture_store_directory.sql. Apply before deploying
the DB-only directory code. It seeds 13 existing platform stores without replacing
existing IDs, grants no accounts a role, and excludes platform stores from private
merchant fulfillment snapshots. Reapplying preserves admin edits.

Regression gates: architecture.test.cjs, store-directory.test.cjs, merchant-db.test.cjs,
merchant-api.test.cjs, existing planner/camera/GLB tests; then lint/typecheck/build
and browser checks across shop → planner → kitchen → shop.

Removed unused source: stores.ts, PartnerMarquee.tsx and the shadowed
kitchenMaterialTextures.tsx. The active texture pool is kitchenMaterialTextures.ts.
No historical database snapshots, GLBs, user accounts or orders are deleted.
See [verification record](phase1-verification.md) for checked scope and rollout status.
