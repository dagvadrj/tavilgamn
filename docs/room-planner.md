# Room planner: surfaces, openings and lighting

The `/planner` route keeps each room's surfaces, openings and fixtures in the existing design store. These edits participate in save/load, room switching, duplication and undo/redo. Legacy single-room saves retain their original colours. New rooms use oak parquet and a white ceiling.

## Using the planner

- **Материал → Шал**: choose from birch/oak/walnut parquet, two laminates, three tiles and two carpets. The material changes immediately.
- **Материал → Хана**: click a wall or its low perimeter, or choose its name. Choose paint (including a custom colour) or one of four wallpapers. Select **Зөвхөн сонгосон хананд** or **Бүх хананд** before choosing a finish.
- **Материал → Тааз**: set height between 240 and 300 cm and choose white paint or plaster.
- **Хаалга, цонх**: drag a template onto a wall, select a template then click a wall, or use its **Хананд нэмэх** button. The button finds a free position on the chosen wall. Click an existing opening to edit its dimensions and position. Dragging stays on the same wall; change the wall selector to move it to another wall.
- Door templates include single and double leaves. A single door supports left/right hinges; both templates support inward/outward swing and an animated open/close button. Double-clicking a door also toggles it.
- Window templates include fixed and sliding frames, transmissive glazing and a sill. Sill height is adjustable.
- **Гэрэл**: switch between day and evening, tune ambient and sunlight intensity, and add up to eight ceiling fixtures. Each fixture has position, intensity and colour controls.
- The 3D camera rotates through 360 degrees. Nearby exterior walls fade and allow selecting objects behind them. Their low perimeter remains selectable. The ceiling is hidden above it and in 2D; it appears below ceiling level.

## Implementation

`src/lib/roomOpenings.ts` defines templates, metre-based dimensions, stable wall IDs and normalized centre positions (0–1), validation and clockwise wall transforms. Frames reserve 6 cm of clearance. Invalid values, overlaps, wall-edge overflow and ceiling overflow are blocked. Existing insets, recesses and wall-touching columns are respected: openings can occupy available straight portions of the four original walls. Displaced inset/recess faces are not separate opening targets.

`src/three/wallCsg.ts` subtracts box volumes from closed wall meshes with `three-bvh-csg`. A change to opening position/dimensions or room height rebuilds only the affected wall geometry. Door animation and selection do not trigger CSG. Removed geometry and materials are disposed. Wall UVs use a common projection so the cut faces do not stretch wallpaper.

`src/lib/roomMaterials.ts` defines the local library. `src/three/roomMaterials.ts` generates deterministic seamless albedo, tangent normal and roughness maps. These are procedural PBR textures, not downloaded photographic scans. Albedo uses sRGB; normal and roughness use linear data. Each surface owns texture instances and repeats all three maps by surface metres divided by the material's physical repeat size. Texture resources are cleaned up on replacement/unmount.

`src/components/RoomEnvironmentPanel.tsx` provides the surface, opening and lighting controls. `src/three/RoomStructure.tsx` and `OpeningMesh.tsx` handle the architecture, camera-dependent visibility, placement and movement. Ceiling fixtures create point lights directly at their configured coordinates.

## Verification

Run `node --test tests/*.test.cjs` and `node node_modules/typescript/bin/tsc --noEmit --incremental false`. The focused suites cover geometry/placement boundaries, multi-room persistence, history isolation, and true CSG holes and rebuilds. Use the planner in a browser to verify materials, 2D/3D, camera visibility, catalog placement, opening movement, door swing, lighting, save/reload and mobile drawers.
