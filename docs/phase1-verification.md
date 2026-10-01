# Phase 1 verification and rollout

Date: 2026-10-01. Scope: architecture cleanup, not a new GLB quality/performance policy.

## Implementation

- Shop, planner and admin route shells are separate; public URLs are unchanged.
  Planner routes do not mount the shop Header/Footer. Mobile bottom-nav spacing is
  scoped to the shop shell. Room and kitchen workspaces use the dynamic viewport.
- Authentication bootstraps in the shared root and concurrent initialization is
  coalesced. Privileged API permissions use a verified identity and fresh DB role.
- Supabase clients use types generated from the live public schema after migration.
  Explicit nullable RPC arguments and JSON validation are documented boundaries.
- All explicit API errors use the shared string/code/status/no-store contract;
  successful response envelopes and provider callback checks remain compatible.
- merchant_stores is the only runtime store-directory source. Platform store IDs
  and product links are preserved; no fake merchant owners are created.
- Category labels, navigation, validation and TypeScript union derive from one
  manifest. SQL enforcement is a tested versioned snapshot of that manifest.
- Room UI state/panels and kitchen catalog fetching/2D panels were extracted.
  Controllers and Three.js scenes remain separate; further extraction is incremental.
- Removed unused stores.ts, PartnerMarquee.tsx and shadowed texture .tsx only after
  regression checks. Historical DB snapshots, GLBs and user data were not deleted.
- Architecture, table dictionary and permission matrix describe the current system.

## Automated verification

- Full Node test suite after the style regression fix: **265 passed, 0 failed, 0 skipped**.
- ESLint: passed with zero warnings.
- TypeScript: passed.
- Production build: passed (Next.js 15.5.26; all 30 prerendered pages generated).

Tests cover directory pagination/outages/private projections; seeded platform stores;
merchant ownership, RLS and transactional checkout; auth roles and outages; API error
contracts; room editor/camera/GLB behavior; kitchen integration and order workflows.
The default-color fallback for existing nullable DB rows is explicitly regression-tested.

## Browser and HTTP verification

### Correction: extracted panel styles

The first visual checks verified viewport height/no shop chrome but did not assert
desktop column placement. The user subsequently reported broken columns. Cause:
Tailwind content scanning did not include the new src/features directory, so the
extracted Drawer lost its responsive position/width/transform utilities.

tailwind.config.ts now scans all src source files. planner-styles.test.cjs generates
CSS using that real scan and checks the missing responsive declarations. Next.js /
React guidance informed the source-folder and component-boundary checks; a successful
build alone is not evidence of correct visual layout.

Reverified on localhost:3000: at 1920×907, columns are 250px / 1360px / 310px,
both drawers are relative-positioned, and the canvas lies between them. At 390×844,
closed drawers are hidden offscreen; catalog and settings drawers open with a 340px
maximum width and close successfully. No design or saved kitchen was changed.

The rebuilt production app on port 3100 was also checked at 1280×900: columns
are 256px / 732px / 292px, with the center canvas between both relative-positioned
drawers. 2D/3D switching works and no console error was recorded. All 265 tests,
lint, TypeScript and the new production build passed. See the complete
[deleted / moved / changed file inventory](phase1-file-changes.md).

### Original architecture checks

Verification used a temporary local production server on port 3100, not a deployment
to the public Vercel domain. Passed checks:

- Room planner: loaded the existing 8-piece draft; 2D/3D switching works. At 390×844
  and 1440×900, workspace height equals the viewport, body bottom padding is zero,
  no shop Header/Footer is mounted and no horizontal page overflow occurs.
- Kitchen: wizard and direct editor routes are shop-chrome-free. 3D canvas renders;
  the extracted 2D review panel opens and returns to 3D. Mobile and desktop main
  heights equal their viewports, with no horizontal page overflow.
- Returning from kitchen to the shop restores one Header and one Footer. Home
  catalog and the 15-store directory load from the DB; /catalog/stores/top-mebel
  still opens the existing profile and its four associated products.
- No console error was recorded during the checked browser flows.
- HTTP GET checks for admin/orders, merchant/products, orders and kitchens return
  401 + AUTH_REQUIRED + Cache-Control: private, no-store without a bearer token.
- HTTP /api/stores returns 200 with 15 active stores, the preserved top-mebel ID
  and no owner_id in the public projection.

The pre-existing dev server was restarted after a stale webpack resolution still
pointed at the removed shadow .tsx file. Its old generated cache was preserved as
.next-pre-phase1-20261001 (ignored, recoverable; not source data). Normal .next
type generation remains enabled; alternate verification/cache directories are
excluded from TypeScript to avoid compiling stale route validators.
Read-only checks confirmed /planner, /kitchen?editor=1 and / return 200 on the
restarted localhost:3000 server. Its mobile shop shell retains the 72px bottom-nav
spacing without applying that spacing to the body/planner. The dev server remains
running for review; the temporary production server on port 3100 is stopped.

Browser checks changed only ephemeral view/panel state; no design, order, product
or account was edited. These are responsive desktop-browser checks, not a real
iPhone Safari/GPU benchmark.

## Live database rollout

User-approved migration **architecture_store_directory** was applied successfully
after the automated test gates. Local source:
supabase/migrations/20261001092640_architecture_store_directory.sql.

Live read-back confirmed 15 stores in total: 13 ownerless platform stores and two
existing merchant stores. kitchen-cabinet and oven categories are accepted; an unknown
category is rejected by the category helper. Generated types were refreshed afterward.

The migration is additive/compatible with the previously deployed directory reader.
It preserves existing merchant accounts, product store_ids and admin-edited metadata.
Ownerless platform stores do not create private merchant fulfillment records.

## Boundaries / remaining release steps

- Application code has **not** been pushed or deployed to tavilgamn.vercel.app.
  Deploy the tested code before considering the public-site architecture rollout complete.
- No production login/account mutation, real purchase, payment callback settlement or
  iPhone hardware FPS benchmark was executed. Tests do not substitute for those checks.
- Large admin/merchant/controller files were not wholesale rewritten. This phase starts
  the requested incremental panel/hook separation and documents the ownership boundaries.
- Pre-existing Supabase notices (handle_new_user execution grants and disabled leaked-
  password protection) remain separate hardening work. The migration added no new notices.
- Generated types should be regenerated after future schema migrations; category changes
  require a new SQL snapshot migration rather than editing an already-applied migration.
