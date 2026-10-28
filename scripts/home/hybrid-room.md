# Hybrid homepage hero

The living-room proof was compared against the restored-quality production hero before extending the same renderer to the bedroom and office. The rest of the homepage and its header behavior are retained.

## Rendering and assets

- `HybridRoomDefinition` owns each 1680 × 944 backplate, fixed camera, furniture anchors, hotspot positions and phone focal point. `hybridCrop` supplies both the DOM image placement and the perspective camera view offset. Scroll changes a bounded 1–1.045 zoom and crossfades rooms. It never moves the room camera through a photographed wall.
- A single transparent WebGL canvas draws only the current room's furniture; detail mode draws only the selected item. Fixed furniture geometry is prepared once and matching materials are batched. The other rooms' fixed buffers/shaders are warmed in a small offscreen pass before interaction. Model shaders and textures are prepared on arrival.
- The environment uses one HDR/PMREM. There are no room light sources, shadow maps, wall/floor meshes or wall/floor PBR maps in the active renderer. Contact shadows use a small precomputed alpha texture.
- Furniture stays in front of the photographed architecture, so these three calibrated compositions do not require foreground occlusion masks. The definition reserves `masks` for future compositions that do.
- Rendering stops at rest and outside the viewport. The existing 20-second offscreen WebGL release remains. Pixel density is stable, capped at 1.25 and 1.8 million drawing-buffer pixels; no sudden low-quality mode is applied during movement.
- The full-resolution 2048² catalog sofa textures are preserved. Its hero derivative reduces 69,913 triangles to 45,442 and encoded size from 1,952,012 to 1,716,820 bytes. Estimated RGBA8 texture allocation including mipmaps remains 44,739,243 bytes: transfer compression does **not** reduce decoded texture memory.
- `heroModelUrl.ts` matches both model ID and immutable filename. Unrecognized/new admin-selected models use the existing catalog URL, never an unrelated derivative. Generate and register a derivative for a newly selected large model with `prepare-hybrid-model.mjs`; the catalog source is never overwritten. No API/database migration is required.
- Three composited posters preserve the room appearance while loading or without WebGL. Product links remain available. Detail close restores room/scroll/color state. Phone copy remains hidden, with compact product buttons for items outside the photo crop.

## Reproduction

Run `node scripts/home/prepare-hybrid-model.mjs SOURCE.glb public/interior/hybrid/NAME.glb` to make an error-bounded Draco/WebP derivative and a separate encoded/decoded-size report.

Run `node scripts/home/capture-hybrid-posters.cjs` against a running preview to bake the three loading/fallback posters. `HERO_URL` selects the server; the default is localhost:3001. `HERO_FIXTURE` may point to a captured **public** homepage response to isolate UI testing from provider outages. It is optional and is not part of the shipped application.

`measure-hero.cjs` compares cold/warm browser cache, rendered-frame intervals, >100 ms gaps, initial shader submission CPU time, shader submissions during focus, draw calls, geometry/texture counts, estimated GL texture allocation and resource timing. Shader CPU submission duration is not GPU shader execution time. Texture allocation is an estimate, not browser/process RAM. `check-hybrid.cjs` checks three rooms, focus/close restoration and portrait/landscape layouts; `check-hybrid-fallbacks.cjs` checks WebGL absence, model failure/delay, reduced motion and context loss/retry.

The available automated browser uses Chromium with SwiftShader. It establishes same-machine relative costs and UI behavior, **not** real phone/integrated-GPU FPS. The physical-device 30 FPS / no recurring 100 ms stall target remains to be measured on those devices. The initial production proof improved warm median rendered-frame interval from 514 ms to 100.8 ms and living-room draw calls from 51 to 9 before the later sofa derivative and furniture batching. Both versions stopped rendering at rest. Final measurements are recorded separately in `hybrid-validation.json`.

Final sequential production comparison (1366 × 768, DPR 1, no request interception): warm median rendered-frame interval **501.2 → 70.1 ms**, estimated GL texture allocation **197.2 → 124.1 MiB**, overview draw calls **51 → 9**, isolated-sofa calls **36 → 2**. Cold hero-asset transfer was **7,823,952 → 7,556,191 bytes**; warm transfer was **5,100 → 3,600 bytes**. No shader submissions occurred during the measured sofa focus transition. SwiftShader still produced seven >100 ms gaps during the final warm focus sample, so the physical-device performance target is not marked passed. Homepage first-load JS reported by Next changed from 171 to 172 kB.

Final verification passed: production build, TypeScript, focused ESLint, 27 tests, 124 CSS files; desktop/portrait/landscape browser checks; rendered color changes and close/reopen state for all nine items; WebGL absence, model error, delayed model, reduced motion, context loss/retry, and offscreen release/return including a geometry click. UI checks may use the public fixture; performance checks deliberately do not because Playwright interception disables HTTP caching.

## Generated backplates: mode, files and exact prompts

Mode: built-in image generation tool, image **edit**, opaque background. The user's supplied room JPGs were inspected and used as edit targets. The generated PNGs remain in the generated-images folder; project copies are encoded as quality-93 WebP, 1680 × 944. These are raster photographs, not SVG materials.

### Living room

Input: `AaFzVA6U9lEiYqubYFdc2g-AaFzVA6UX8lsRdpLpPCFkQ.jpg`.
Output: `public/interior/hybrid/living.webp`.
Generated source: `exec-8d87b08f-c217-4de1-92e9-8dff5fd3b7f6.png`.

> Create a clean photorealistic architectural BACKPLATE from this exact living-room reference. Preserve exact wide camera perspective, aspect ratio, room architecture, concrete wall, right window and white curtains, city view, dark walnut parquet floor, large woven rug, warm illuminated built-in bookcase, background desk, plants and hanging glass lights. REMOVE completely the foreground cream SOFA, brown lounge ARMCHAIR, and round COFFEE TABLE and every object on that table. Remove their shadows and reconstruct the empty rug and floor realistically. REMOVE ALL interface overlays, lettering, logos, buttons, navigation, glowing dots, floating product cards. This is an empty foreground prepared for compositing separate 3D furniture. Do not replace removed furniture with anything. Keep the fine natural texture, warm muted luxury lighting and realistic photographic quality. No illustration, no vector look. Output a wide image matching the reference framing.

### Bedroom

Input: `AaFzVB39eU2YwVmyd7x0Ig-AaFzVB39mlLZyA_WLsDvQw.jpg`.
Output: `public/interior/hybrid/bedroom.webp`.
Generated source: `exec-07075d47-2425-4c81-9bec-c6a3c6f12488.png`.

> Edit this exact bedroom reference into a photorealistic empty-room compositing BACKPLATE. Preserve original wide perspective/camera, concrete wall, left window, sheer curtains, city view, walnut parquet and woven rug, glass hanging pendant and warm room illumination. REMOVE the entire bed and all bedding, BOTH nightstands and their lamps, and the entire wardrobe on the far right, reconstructing a plain dark walnut wall behind the wardrobe. Keep the little recessed narrow lit shelves at upper right, but do not add furniture. Remove the removed furniture's shadows. REMOVE ALL lettering, logos, menu, buttons, icons, hotspots, product card and UI. Empty foreground floor and rug for later separate 3D furniture composition. No bed, no cabinet, no nightstands, no desk. Keep luxurious fine photographic textures, subdued warm evening light. Exact wide composition and camera of input.

### Office

Input: `AaFzVCy5oaMSyhwuP8exiw-AaFzVCy5ij4ZIrBYU_qGew - Copy.jpg`.
Output: `public/interior/hybrid/office.webp`.
Generated source: `exec-e48ce5f9-7ca1-4329-ad87-5b3decf29543.png`.

> Edit this exact home-office reference into a clean photorealistic empty-room compositing BACKPLATE. Preserve exact wide perspective and camera, textured concrete wall, tall window and curtains, green outdoor view, warm pendant glass lamp, foreground parquet floor, rug bottom right and large plant on left. REMOVE the desk with all its drawers/legs and every object on the desk; REMOVE the office chair entirely; REMOVE the entire large right-hand bookcase and its contents, reconstruct a plain dark walnut wall behind it. These three items will be added as separate interactive 3D objects. Reconstruct the empty floor and remove removed furniture's contact shadows. REMOVE ALL lettering, logo, menus, icons, buttons, glowing hotspots, price card, bottom navigation. Photographic luxury materials and subdued natural warm light; no illustration. Keep exact architecture, window placement and wide image framing.

## Visual verification

- Supplied room compositions were compared to generated backplates and actual desktop/phone screenshots. Foreground interactive furniture was removed from each backplate, avoiding doubled furniture.
- Existing header branding/navigation, homepage copy/CTA configuration and downstream sections remain. Phone hero headings are hidden.
- The same image/camera crop was mathematically checked at 320×568, 378×671, 844×390, 1366×768 and 2560×1080. Browser checks covered desktop, phone portrait and landscape; these are viewport emulations.
- Bedroom floor alignment and its phone hotspot were corrected after screenshots exposed a floating placement / overlap with the bottom controls. Office shelf placement was also corrected.
- Closeup uses the existing catalog sofa and existing preview furniture for the other unset catalog slots. Preview furniture is explicitly labelled; it is not claimed to be identical to the photographed reference furniture. Photo-quality environment lighting does not imply that the procedural preview models are photographic scans.
