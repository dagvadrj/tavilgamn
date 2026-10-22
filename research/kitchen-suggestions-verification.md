# Kitchen suggestions upgrade — 2026-10-20

User requested removal of the generated yellow wooden furniture and improvement of the five-suggestion feature.

## Changes
- Removed parametric replacement cabinet rendering and extra generated wooden plinths. Compatible uploaded GLBs and existing appliance renderers remain. Unlinked cabinet positions and specifications remain editable in the 2D plan; the UI explains unavailable 3D models.
- Replaced fixed five layouts plus color fallbacks with a bounded deterministic search over layout shapes, cyclic/reversed sequences and pair swaps. Cabinet IDs, inventory, dimensions, finishes and room geometry remain intact.
- Rejects invalid placements, blocked rendered window apertures and moved appliances when locked.
- Deduplicates physical furniture arrangements independently of cabinet IDs. Does not present swaps of identical boxes as new designs.
- Measures straight appliance-centre distance, service-point distance when available, longest contiguous non-appliance prep run, approximate front-centre free space and number of moved cabinets.
- Ranks by user-selected priorities; filters dominated candidates; returns at most five actual alternatives, including the current design when relevant. No fabricated price or storage improvements.
- New comparison cards show absolute measures and differences. Optional 3D preview uses available uploaded assets and states when the full plan is only available in 2D. Native modal handles focus/Escape. Applying a suggestion uses the existing validated commit path.

## Verification
- TypeScript, ESLint and stylesheet checks pass.
- 23 targeted tests pass (suggestions, role matching, insertion, rendering and surfaces).
- Full suite: 754 pass, same 9 existing failures as prior run; no additional failures.
- Browser on existing draft: 110 distinct arrangements checked; 79 feasible; 3 nondominated proposals. Locking appliance positions leaves 1. Preview open/close, appliance lock, and application of the unchanged baseline verified. Existing draft's geometry was retained during verification.
- Screenshot: research/kitchen-smart-suggestions.png.
- Production build not rerun; previous build had external font network and .next permission blockers. Dev browser compilation verified.
