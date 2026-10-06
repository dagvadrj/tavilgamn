# Planner reference layout verification

Date: 2026-10-02. Reference: user-provided `kitchenpla.jpg`.

## Implemented

- Both `/planner` and `/kitchen` use a shared narrow icon rail, large canvas, white top bar, and a single right inspector.
- Kitchen opens directly in the editor without the suggestion wizard. Existing design/draft query handling is retained.
- Room catalog is in the right inspector, with canonical category selection and two-column cards. Material, opening, lighting and room controls are reachable through the rail.
- Kitchen inspectors separate cabinet/appliance catalog, room size/layout, materials, extras, and selected-cabinet controls. Layout selection remains reachable on mobile.
- Responsive drawers replace the docked inspector below 960px. Existing scene, model loading, history and save/export logic are retained.

## Verification

- Full automated suite: 352 tests, all passing.
- Full ESLint: passed, zero warnings. TypeScript: passed through the production build and standalone typecheck.
- Isolated production build: passed (`.next-planner-reference-build`), leaving the existing localhost server running.
- Browser: room desktop 1440×960; kitchen desktop 1280×720; kitchen tablet 980×760; both mobile 390×844.
- Room: catalog search, add a sofa, open its contextual controls, undo, 2D/3D toggle, material drawer and Escape close verified.
- Kitchen: direct entry, catalog navigation, add/select/undo cabinet, material controls, camera fit, room/layout inspector, 2D/report and contextual selection verified.
- Canvas dimensions are nonzero, right inspector is bounded, and tablet/mobile have no horizontal page overflow.
- Test furniture/cabinet additions were undone. No saved projects, products, orders or files were deleted, and no paid actions ran for this UI verification.

## Scope

Verified on localhost only; these UI changes have not been deployed to Vercel. Save/payment/backend workflows are not claimed as newly end-to-end verified by this layout task. The legacy suggestion component remains in source but is no longer routed to.

Screenshots: `room-planner-reference.png`, `kitchen-planner-reference.png`.

## UI consistency update — 2026-10-07

The storefront directories and both planners now use shared neutral surface/border tokens, dark primary actions, blue selections and rounded controls. Store and kitchen directories share a heading, breadcrumb, planner action, filter pills and three/two/one-column cards with the same image proportions.

After the card follow-up, both directories render the same `DirectoryCard` component: an inset photo, top type badge, bounded title/description, metadata tags, factual product-count or kitchen-price summary, and full-width dark action. Store totals count non-archived catalog entries assigned to that store, including entries temporarily out of stock; each entry counts once per store, irrespective of stock quantity. Counts use a paginated, narrow database projection in parallel with the store directory. Store cards link to the existing store catalog; kitchen cards link to the existing design detail. No inventory counts or prices are invented for stores.

Both editors have a visible labeled tool rail on desktop and a horizontally scrollable labeled bottom rail below 960px. Shared `PlannerWorkflow` buttons open room dimensions, the catalog or materials directly; these are navigation shortcuts, not a wizard or assertions that a step has been completed. Both headers share `PlannerSwitcher`. Kitchen tools retain visible move/orbit/2D labels, and project dimensions/cabinet counts stay visible in the scene caption. Inspectors use the same mobile backdrop, Escape dismissal, Tab focus containment and focus restoration, including cleanup when resizing to desktop. Existing camera, scene, draft, undo and save behavior remains in place.

The header search uses the cached catalog only after a nonempty query is opened. It shows six product cards with actual images, default-variant prices and stock labels, plus a link to all results. Keyboard arrows move selection and scroll it into view; Enter opens the selected product, while the search button opens the full catalog query. Escape, outside click, blur and route changes dismiss the popover. Empty/error/loading states and retry are explicit. English/Mongolian/Latin category queries use the same matcher in header, catalog results and room-planner catalog.

Validation: 408 repository tests pass, including search navigation/loading/ranking, mobile-inspector focus/resize and store-count pagination/deduplication/rendering tests. TypeScript, targeted ESLint and changed CSS syntax/selector/AST checks pass. The production build passes. The active localhost:3000 server returns HTTP 200 and the latest CSS for all four routes; both directory pages serve the unified cards. All 15 store-card totals match the actual catalog API assignments. Planner HTTP checks cover the initial client-loading shells, not WebGL interaction. No browser surface is exposed in this session, so the screenshots and browser checks above belong to the earlier layout; they do not verify this update. These changes have not been deployed.

## Sidebar and GLB library follow-up — 2026-10-07

Kitchen Add now opens a searchable two-column library of active, available GLB variants from `/api/kitchen-modules`, with actual thumbnails, names, authored dimensions and file names. Specifications without files are excluded. The live catalog currently contains three usable cabinet GLBs; all three assets have valid GLB headers and their thumbnails return HTTP 200. Choosing a card creates a cabinet with the exact module dimensions, opening and model ID, finds a legal space, then uses the existing commit/history/save pipeline. Tall models keep their authored height; models are not stretched to the ceiling. The optional procedural cabinet builder is collapsed beneath the real-model library. Library loading, failure/retry and empty states are explicit.

Room Add defaults to all-category GLB cards using the same `PlannerModelCard`; other furniture is a separate choice. Room settings are divided into Room, Furniture and Saved designs, so project naming, local GLB preview and saved designs no longer crowd the room-size form. Selecting a canvas object opens its furniture settings. Kitchen material scope is a set of labeled buttons; material swatches are larger and grouped by door and body. The room budget bar is a compact summary with an Add action while empty and its existing cart action after placement.

Validation: all 413 tests pass, including authored-height/model-ID retention across placement and JSON reload, collision-free second placement, rejection of unusable entries, real-GLB-only library rendering and visible failure recovery. TypeScript, targeted ESLint, the production build and sidebar CSS syntax/selectors/formatting pass. The full CSS check reports only the existing formatting differences in homepage-marketplace.css and marketplace.css. Localhost planner routes return HTTP 200. Browser/WebGL interaction cannot be checked because no browser surface is available; these results do not constitute a visual or save end-to-end check. No deployment was performed.

## Model covering and dimension dialog follow-up — 2026-10-07

Complete kitchen GLBs no longer receive generated countertops, plinths, automatic backsplash panels or duplicate counter appliances. `kitchenForGeneratedParts` excludes only cabinets whose GLB is actually being rendered; procedural fallback cabinets still receive their fittings. Mixed rows generate separate fitting runs on either side of a GLB. Manually authored wall panels remain explicit independent objects. Stored cabinets and the source GLB are unchanged. The editor's scene export/capture uses the same visible geometry.

The room dimension dialog now separates the plan and settings into desktop columns and stacks them on mobile. Size, wall features and columns have separate navigation buttons; the Done action stays in a sticky footer with validation feedback. The native dialog, live dimension updates, wall dragging, millimetre keyboard controls and undo session are retained. Custom validation covers hidden sections so inactive required fields do not block submission without visible feedback. The dialog plan, grips, inputs, actions and remaining sidebar surface/opening/lighting controls use the same neutral surfaces and blue selections as the shared UI. Material and paint sample colours remain actual material values.

Validation: all 417 repository tests pass, including the 23 relevant kitchen geometry/export tests and 31 wall editing/interaction/inspector tests. TypeScript, targeted lint and the production build pass. Updated CSS passes syntax, selector and formatting-equivalence checks; localhost `/planner` returns HTTP 200. Browser interaction/appearance remains unverified because no browser surface is available.
