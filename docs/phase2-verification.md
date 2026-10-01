# Phase 2 verification — 2026-10-01

## Result and rollout boundary

Local implementation and its real admin → upload → worker → catalog → kitchen planner flow are verified. Both additive migrations have been applied to the authorized live Supabase project `gpdpaexkmuhxzknguicp`; generated TypeScript types match that schema. Vercel web deployment and persistent worker cutover have **not** been performed. Production cutover requires deploying this web revision and restarting the worker with the same revision. The old public site does not acquire the new upload checks simply from the database migration.

## Implemented contract

- Metres, +Y up, +Z front, bottom-centre origin, applied local transforms; static embedded geometry/material/texture sources.
- Admin previews actual decoded geometry, requires semantic front/up confirmation and creates a PNG thumbnail. Size, origin, transform, file limits and supported source format are independently checked before processing. Semantic front and handle-vs-carcass distinction require human confirmation, not a guessed automatic axis rotation.
- Upload intents belong to the admin actor. Completion checks bytes, conditional object reads and checksum. Worker checks decoded dimensions/origin again before publishing immutable versioned assets.
- Canonical module/variant codes distinguish ordinary BASE and CORNER-BASE. Optional design suffix distinguishes two otherwise identical opening configurations.
- Private `model_assets` ledger tracks source, delivery, preview, standard export and thumbnail roles/versions. Pending objects are registered before PUT. Replaced derivatives remain tracked as retired; stale pending rows need operator reconciliation, not blind garbage collection.
- Archive hides new selection, preserves existing assets and variant linkage, and can be restored. Hard database model deletion is denied. Existing immutable delivery URLs can still be served for historical designs; private sources/exports and pending/deleted objects are not exposed by public history lookup.
- Validated kitchen models retain decoded physical size. Handle projection aligns the model's back with the nominal carcass back rather than shrinking the entire model. 740 mm legless bodies remain 740 mm; default base preset remains 840 mm. JSON schema, runtime validation and saved-design parsing agree.
- Approved raster thumbnails return a body, not an external redirect, so the local Next image optimizer works.

Full rules and deployment ordering: [GLB and cabinet standard](glb-cabinet-standard.md).

## Supplied files and geometry audit

Original files in the user's Documents directory were neither edited nor overwritten. New standardized copies are in `model-work/phase2-standard-final/`:

| Copy | Finding and corrected preparation | Decoded delivery size, mm |
|---|---|---|
| BASE-700-2-DRAWERS.glb | Original was 700×840×598, but bottom Y was −100 mm and local transforms were unapplied. Bake transforms and relocate bottom to 0; do not change physical dimensions. | 700 × 840 × 598.015 |
| BASE-800-H740-D598-2-DOORS.glb | Actual 740 mm body, not 840 mm. Bake transforms and preserve 800×740×598. | 799.989 × 740.032 × 597.993 |
| BASE-800-H740-D598-2-DOORS-TOP144.glb | Separate TOP144 construction suffix; preserve the same physical module size. | 799.989 × 740.032 × 598.017 |

Blender → compressed delivery/preview pipeline output is `model-work/phase2-pipeline-verified/`. All six outputs were decoded again: dimensions within 5 mm, bottom-centre origin within 2 mm, and delivery triangle counts unchanged (10,372 / 136 / 148). Meshopt/KTX2 is a delivery format; admin source uploads do not accept already-processed Meshopt/KTX2 assets that the installed Blender importer cannot read.

Existing `BASE60x60 oven` delivery was read without overwriting it: actual 599.989×840.009×635.136 mm. User confirmed the extra 35.136 mm is the handle. Carcass module remains 600×840×600; a scoped legacy decoded-bounds audit was recorded so the new renderer preserves that envelope. This audit does not claim the original authoring transforms/front were newly validated. Its existing HOB classification was not silently changed to OVEN, since an assembly may include both cooktop and oven; review that product configuration separately if needed.

The existing 1000 mm normal BASE model retains its BASE-1000 binding. No CORNER-BASE GLB was invented from it; the new database binding guard rejects reassignment between those module identities.

## Real end-to-end evidence

Admin signed in through the normal browser UI. The standardized two-door BASE800 was added through the kitchen upload form, with module selection, preview/front confirmation and automatic thumbnail:

- New model: `f9dc384b-9e20-445b-9fc0-c23a561e92ef`, name `800мм 740 өндөртэй 2 хаалгатай`.
- Module: `BASE-800-H740-D598`; variant: `BASE-800-H740-D598-2-DOORS`.
- Upload metadata/prepare/completion responses: 201 / 200 / 200.
- Worker executed in bounded one-model verification mode; job `096a66ff-a812-436f-96b5-f30e9643f034` completed as `ready`.
- Delivery and preview: 11,036 bytes each, ledger state available. Auto-thumbnail available. Temporary uploaded source (13,364 bytes) deleted after successful publication; the user's original local file remains untouched.
- Real kitchen editor selected this model and retained 800×740×598 mm after reload. 3D rendering was visually confirmed and the delivery endpoint returned 200. The misleading canvas fallback text in an accessibility snapshot was not an actual rendering failure.
- All three catalog thumbnails were observed loaded with natural width 92. The optimized new thumbnail endpoint independently returned 200 `image/png`.
- The archive confirmation could not initially be controlled automatically. Later read-only verification found the new model archived, with all assets retained. It was restored through the normal admin UI. Final live state: `archived_at = NULL`, `processing_status = ready`, dimensions 0.8×0.74×0.598 m, three available assets. No second archive attempt was needed.
- Only this new model was involved; existing models/GLB objects were not replaced or archived for the test. The new model currently has no price or stock assigned; this is a catalog/geometry verification, not a stocked sellable product setup.

Planner proof: [740 mm model in the real editor](phase2-planner.jpg). Upload preview proof: [standardized GLB preview](phase2-glb-preview.jpg).

## Verification

- Complete automated suite: **283 passed, 0 failed, 0 skipped**.
- ESLint: passed, zero warnings.
- TypeScript: passed.
- Production build with separate `.next-phase2` output: passed after the final thumbnail fix.
- Worker syntax and decoded delivery/preview geometry checks: passed.
- Database migration integration tests exercise archive/restore, blocked hard deletion, actor-owned intents, canonical codes, BASE/CORNER isolation, asset lifecycle/history, role restrictions and archived inventory reservation.
- Existing Supabase advisor warnings about legacy profile signup execution privileges and leaked-password protection were not changed by this phase. The private ledger deliberately has RLS without client policies/grants.

## Intentionally not included

No Vercel deployment, permanent background worker restart, version rollback UI, automatic retired-object deletion or guessed leg addition/orientation. The prepared BASE700 and TOP144 copies have passed the local pipeline, but only the two-door BASE800 was newly uploaded and linked in the live catalog during this test.
