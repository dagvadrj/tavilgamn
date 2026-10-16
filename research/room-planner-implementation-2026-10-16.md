# Room planner architecture implementation

Implemented from the supplied IKEA UK research on 2026-10-16. The existing kitchen seven-step workflow is retained.

## Implemented

- `roomCatalogPolicy.ts`: shared room eligibility, ordered categories, counts, explicit all-room scope and text search for photo/model branches. Authored `roomTypes` can override category defaults. Bedroom includes nightstands and dressers. Suggestions reuse the category policy while remaining separate from eligibility.
- `RoomBuilder.tsx` / `roomBuilderDraft.ts`: independent four-stage draft; six polygon templates; floor-plan/ceiling modes; cm and feet/inches; rotate/reflect; point insertion/removal/dragging; numeric dimensions; segment-bound openings; wall/floor preview. Cancel retains the original; final edit commits through the existing transaction. New rooms are initialized atomically. The same builder is available for additional rooms.
- `roomPolygon.ts`: stable vertex/edge IDs, self-intersection/minimum-edge validation and actual diagonal geometry. The room mesh, 2D path, persistence and footprint collision consume the polygon. Connected room footprints use polygon union coverage rather than diagonal bounding rectangles.
- `cameraTransition.ts` / `CameraTransitionController.tsx`: elapsed-time cubic easing of position, target, up and FOV; focus-centred paths; repeated-request replacement; input interruption; reduced motion; room-origin translation. No design-history writes. Interior viewpoint travel validates the route before animation and stops on user input.
- `furnitureAttachment.ts`: deterministic initial placement; rear-face wall anchors; along-wall/elevation dragging in 3D, along-wall placement in 2D; endpoint/ceiling/opening validation; explicit local support-surface relations; parent movement; cycle/edge checks; vertical collision intervals; attachment-aware save/undo/room duplication.
- `FurnitureAttachmentControls.tsx`: explicit floor/wall/support selection and authoring a top support surface. Mounting is not inferred from product names.

## Metadata contract

Products/models may provide `placement` and `roomTypes`. The existing product specifications also support JSON strings under `plannerPlacement` and `plannerRoomTypes`, so no database migration is required. Unknown placement metadata defaults to floor. Example:

```json
{
  "plannerRoomTypes": "[\"living\",\"bedroom\"]",
  "plannerPlacement": "{\"surfaces\":[\"wall\"],\"defaultElevation\":1.4,\"gap\":0.01}"
}
```

Support surfaces declare an ID, width/depth and local elevation in metres. Support-local quaternions currently accept upright yaw rotation; tilted furniture is rejected. Wall geometry that removes an attached segment is rejected rather than silently rebinding it. Attached groups keep their owning room across open seams.

The initial-placement solver runs locally. No optional remote placement service or new AI provider was introduced. Existing progressive model loading remains in use.

## Verification

- Lint and TypeScript checks passed during implementation.
- Full suite: 678 tests, 672 passed. The six failures are the same API-response, dashboard, kitchen-marketplace/render and product-quick-view contracts already failing before this work.
- New architecture tests cover catalog scoping, all six template counts, diagonals, opening identity, invalid geometry, polygon-union coverage, wall anchors/openings, vertical separation, support-parent transforms, cycles, camera interruption/replacement/reduced motion, undo, persistence and room duplication.
- Chrome: bedroom → cut-corner template → dimensions → door → walnut floor → planner; reload retained the polygon/opening. Cancel after changing to U shape retained the original 13.14 m² room. Builder modal also checked at 390 × 844.
- The live catalog API failed to load in this local environment. Its error/retry state was verified; stock/catalog behavior is covered by fixture-backed tests.
- Production build was attempted in an isolated `.next-room-upgrade-build` directory. It was blocked by network-denied Google Fonts downloads for the existing Inter/Fraunces/Manrope imports.
