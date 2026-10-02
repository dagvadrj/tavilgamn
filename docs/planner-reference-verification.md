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
