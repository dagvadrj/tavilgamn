# Cabinet GLB standard — cabinet-v1

Owner: admin cabinet catalog. Effective: 2026-10-01. The source of truth for module/variant is kitchen_modules / kitchen_module_variants, not a filename.

## Authoring contract

- GLB 2.0; metres; +Y up; front faces +Z. This follows the [glTF coordinate convention](https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html#coordinate-system-and-units).
- Static triangle meshes only: no animation, skin, morph targets or sparse positions. One asset, embedded mesh/material/texture data; no external or data-URI dependencies.
- Origin is bottom-centre of the complete exported geometry. Tolerance 2 mm. Bake every scene-node translation, rotation and scale into vertices; local node transforms must be identity.
- Maximum upload 200 MiB. Geometry processing additionally enforces the configured triangle budget. Delivery preserves authored density; motion-preview may simplify it.
- Mesh/material names are unique ASCII, 1–128 characters: letters, digits, underscore, dot, hyphen; begin with a letter/digit. Use descriptive labels such as carcass, front, door, drawer, handle, appliance. Naming issues are warnings; front orientation remains a human check. Surface labels influence planner material overrides.
- File name: canonical variant code plus .glb. File name is a label, not permission to infer a module or overwrite dimensions.

Upload sources use embedded PNG/JPG textures and uncompressed or Draco geometry. Do not re-upload Meshopt/KTX2 delivery files: the installed Blender 5.0 worker cannot import KHR_texture_basisu. Those remain supported by the web renderer as delivery assets; the upload validator rejects them with an actionable error.

Blender: set real size, inspect axes, apply/bake transforms, place geometry at bottom-centre, embed textures and export GLB. A conventional Blender Z-up scene exports to glTF Y-up. Inspect the exported GLB, not only the .blend scene.

## Physical size versus module footprint

Width, height and carcass depth must match the selected module within 5 mm. A 740 mm cabinet body is not stretched to 840 mm and missing legs are not invented. Its code includes actual dimensions, e.g. BASE-800-H740-D598.

Front handles can extend beyond the carcass. Admin explicitly enters the +Z projection (0–100 mm) and confirms orientation/carcass depth in preview. Validator compares total depth to carcass depth + projection. This is not a waiver for an incorrect body size. The decoded physical bounds are retained; the planner aligns the back face with the nominal module back and does not squeeze the handles into the body footprint. Cabinet collision/worktop layout continues to use the module footprint, not the handle envelope.

Automatic size/origin checks cannot recognize a door's semantic front or distinguish a handle from an oversized carcass. Those are deliberate human confirmations. Compressed accessor metadata is preliminary; browser and worker check decoded geometry before accepting/publishing it.

## Canonical identifiers

| Entity | Source | Rule/example |
|---|---|---|
| Category | catalogCategories.ts, matching SQL constraint | kitchen-cabinet |
| Module | kitchen_modules.code | BASE-1000 vs CORNER-BASE-1000; nonstandard BASE-800-H740-D598 |
| Variant | kitchen_module_variants.variant_code | BASE-700-2-DRAWERS; BASE-600-OVEN |
| Design suffix | variant configuration.designCode | optional TOP144; BASE-800-H740-D598-2-DOORS-TOP144 |
| Product colour/material | validated option ID | lowercase ASCII IDs such as oak, wood; label is separate |
| Planner surface material | existing kitchen material catalog | retain its canonical ID; do not derive from display label |

Standard dimensions: base/corner 840h×600d; wall 720h×350d; tall 2600h×600d. Width is encoded in every module. Nonstandard modules encode H and D explicitly. Same opening with different construction needs a design suffix; duplicate (module_id, variant_code) remains forbidden. A model bound to BASE cannot later be reassigned to CORNER solely because its dimensions fit.

## Upload and lifecycle

1. Select canonical module and original GLB. Preview reads real geometry without recentering/rescaling, checks origin/transforms/size, creates a PNG thumbnail, and requires a front/up confirmation.
2. Create model metadata/thumbnail. Register actor-owned pending source intent in model_assets before returning a presigned R2 PUT URL.
3. Completion reads R2 HEAD and conditional GET, verifies registered byte count, inspects GLB and records SHA-256 plus validation. One transactional RPC accepts the source and queues its version.
4. Worker verifies the source checksum, decodes geometry in Blender, rechecks dimensions/origin, produces Meshopt/KTX2 delivery + motion-preview. Derived assets have ledger rows before R2 PUT and unique immutable job/version paths.
5. Compare-and-swap publishes current paths only for the current job. Replaced derived assets are retired, not immediately deleted. Source is removed after successful processing according to the existing no-source-retention policy; ledger records deletion. No .blend source is kept by this workflow.
6. Link the ready model to the variant. SQL independently enforces canonical code, module binding and dimensions.

Multiple assets/versions are required: source, delivery, preview, optional standard export and thumbnail have different roles and lifetimes. model_assets is the private asset/version ledger; furniture_models current path columns are its compatibility/current-serving pointers. GET /api/admin/model-assets?modelId=UUID exposes history to verified admins only. This phase does not add version rollback or automatic garbage collection.

Archive is reversible: hide from public catalog/new selection and reject new processing, preserve model/variant/assets, cancel in-flight job identity. Restore re-enables selection; a cancelled/failed model may still need reprocessing. Hard model delete is rejected in SQL. Existing designs/assets are not physically purged.

Abandoned/failed PUTs remain tracked pending; failed derived outputs are cleaned up when possible. Ledger insertion failure prevents exposing a source URL or starting an output PUT. A lost R2 response may leave a pending object, but not an untracked one. Operators must reconcile stale pending rows against R2 before cleanup; do not delete retired files based only on age because historical designs may reference them.

## Deployment

Apply the two Phase 2 migrations first, regenerate Supabase types, then deploy web code and restart the model worker with the same code. The old upload completion does not perform the new checks: cutover is complete only when both web and worker use this revision. New schema is additive; existing GLB paths are preserved. No deployment is implicit in a local implementation.
