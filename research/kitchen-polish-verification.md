# Kitchen cabinet roles and studio polish — 2026-10-20

## Scope
Fix cabinet role confusion and improve the editable kitchen scene before revisiting the five-suggestion feature. No recommendation or model-training changes.

## Findings and changes
- Automatic asset selection previously treated cabinet type as a scoring penalty, and could fall back across floor/wall roles and opening types. Matching now requires the same role and opening, limits automatic shape distortion, and rejects saved lower-corner assets for upper corners.
- Renderer validates role metadata again, including stored model IDs. Unavailable compatible models use the existing authored CabinetBody panels and material definitions instead of disappearing or borrowing an unrelated GLB.
- Legacy wall elevations at floor level are repaired by resolveElevations; manual positive elevations remain unchanged.
- Restored shared fitted worktops with sink/hob cutouts, plinths, splashbacks and counter appliances in the editor and room assembly preview. Uploaded sink/hob assets suppress duplicate counter appliances.
- Camera uses damping and lower interaction speeds, retains the pose when the inspector resizes the viewport, and reduces render resolution during camera motion. Soft shadows, warm key/cool fill lighting, neutral background and scoped UI refinements improve the scene.
- Catalog cards label mounting roles; standard geometry is explained without falsely reporting missing visible cabinets.

## Validation
- TypeScript and ESLint pass.
- CSS syntax/selectors/formatting check passes (91 files).
- 34 targeted tests pass, including new role, legacy elevation, production surface and duplicate-appliance regressions.
- Full suite: 749 pass, 9 fail. The same 9 failures were present in the previous full-suite run (API error contract, admin/merchant architecture, marketplace listing/AI render, public page GET, product quick-view/navigation, 2D drag cancellation).
- Browser: existing kitchen draft loads, 3D renders, upper cabinets stay above worktops, lower cabinets sit on floor, sink/cooktop/worktop/splashback render together. Front view verified.
- Screenshot: research/kitchen-polish-front.png.
- Production build not rerun; the previous attempt was blocked by unavailable Google Fonts network access and .next write permissions. Browser dev compilation succeeded.
