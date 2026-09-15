# Room planner: surfaces, openings and lighting

The `/planner` route keeps each room's surfaces, openings and fixtures in the existing design store. These edits participate in save/load, room switching, duplication and undo/redo. Legacy single-room saves retain their original colours. New rooms use oak parquet and a white ceiling.

## Using the planner

- **Шинэ загвар үүсгэх** and adding a room open the measured plan immediately. Existing rooms use **Өрөөний бодит хэмжээ, хэлбэр**. Drag a wall or its round handle with a mouse or touch; dimensions and floor area update live. Focus a wall and use the perpendicular arrow keys for 1 mm steps, or Shift + arrow for 10 mm. Exact width, depth, height and feature inputs remain below the plan.
- Wall drags keep the opposite wall and existing furniture, columns, opening centers and lights stationary. Features attached to a moving corner follow that corner without changing their size; full-span features stretch. Invalid geometry, opening/frame overflow and furniture/light collisions retain the last accepted room. Closing the editor completes one undo step for the whole session.
- **Материал → Шал**: choose from birch/oak/walnut parquet, two laminates, three tiles and two carpets. The material changes immediately.
- **Материал → Хана**: click a wall or its low perimeter, or choose its name. Choose paint (including a custom colour) or one of four wallpapers. Select **Зөвхөн сонгосон хананд** or **Бүх хананд** before choosing a finish.
- **Материал → Тааз**: set height between 240 and 300 cm and choose white paint or plaster.
- **Хаалга, цонх**: drag a template onto a wall, select a template then click a wall, or use its **Хананд нэмэх** button. The button finds a free position on the chosen wall. Click an existing opening to edit its dimensions and position. Dragging stays on the same wall; change the wall selector to move it to another wall.
- Door templates include single and double leaves. A single door supports left/right hinges; both templates support inward/outward swing and an animated open/close button. Double-clicking a door also toggles it.
- Window templates include fixed and sliding frames, transmissive glazing and a sill. Sill height is adjustable.
- **Гэрэл**: switch between day and evening, tune ambient and sunlight intensity, and add up to eight ceiling fixtures. Each fixture has position, intensity and colour controls.
- The 3D camera rotates through 360 degrees. Nearby exterior walls fade and allow selecting objects behind them. Their low perimeter remains selectable. The ceiling is hidden above it and in 2D; it appears below ceiling level.

## Implementation

`src/lib/roomWallEditing.ts` maps visible perimeter segments to base walls or existing inset/recess faces and sides. Column edges and ambiguous shared edges are excluded. Movement is calculated from the gesture's original shape on an integer millimetre grid. The helper returns the centered-coordinate translation for furniture and lights, which is validated and stored atomically with the room shape. `RoomWallPlan` freezes SVG coordinates during each gesture, coalesces pointer samples per animation frame, and consumes the final pointer-up position. It releases capture and queued work on cancellation/unmount.

`src/lib/roomOpenings.ts` defines templates, metre-based dimensions, stable wall IDs and normalized centre positions (0–1), validation and clockwise wall transforms. Frames reserve 6 cm of clearance. Invalid values, overlaps, wall-edge overflow and ceiling overflow are blocked. Existing insets, recesses and wall-touching columns are respected: openings can occupy available straight portions of the four original walls. Displaced inset/recess faces are not separate opening targets.

`src/three/wallCsg.ts` subtracts box volumes from closed wall meshes with `three-bvh-csg`. A change to opening position/dimensions or room height rebuilds only the affected wall geometry. Door animation and selection do not trigger CSG. Removed geometry and materials are disposed. Wall UVs use a common projection so the cut faces do not stretch wallpaper.

`src/lib/roomMaterials.ts` defines the local library. `src/three/roomMaterials.ts` generates deterministic seamless albedo, tangent normal and roughness maps. These are procedural PBR textures, not downloaded photographic scans. Albedo uses sRGB; normal and roughness use linear data. Each surface owns texture instances and repeats all three maps by surface metres divided by the material's physical repeat size. Texture resources are cleaned up on replacement/unmount.

`src/components/RoomEnvironmentPanel.tsx` provides the surface, opening and lighting controls. `src/three/RoomStructure.tsx` and `OpeningMesh.tsx` handle the architecture, camera-dependent visibility, placement and movement. Ceiling fixtures create point lights directly at their configured coordinates.

## Verification

Run `node --test tests/*.test.cjs` and `node node_modules/typescript/bin/tsc --noEmit --incremental false`. The focused suites cover geometry/placement boundaries, multi-room persistence, history isolation, and true CSG holes and rebuilds. Use the planner in a browser to verify materials, 2D/3D, camera visibility, catalog placement, opening movement, door swing, lighting, save/reload and mobile drawers.

`tests/room-wall-editing.test.cjs` covers wall/feature orientations, integer mm limits, stationary contents and opening centers, corner features, and rejected geometry. `tests/room-wall-interaction.test.cjs` exercises component pointer/keyboard callbacks, frame coalescing, cancellation, final coordinates, incremental content translation, and real-store persistence/undo.

Verified on 2026-09-13: 113 tests passed, TypeScript and ESLint passed, and the production build completed. Headless Chrome verified actual horizontal opening dragging (including one-step undo/redo), catalog drag/drop, surface controls, invalid-size rejection, door swing settings, fixtures, day/evening modes, reload persistence, responsive camera fit and mobile controls. The local preview is separate from the published website.
