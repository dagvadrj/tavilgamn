# IKEA Room Builder vs RoomPlanner — 2026-10-15

## Scope and evidence

Requested target: https://www.ikea.com/us/en/home-design/room-builder

Live REA MCP capture reached dimensions (step 2). Evidence: `ev_012342527f41e5397332680321df752444284fb00a73da4bc8f074a608e7167e`. Cookie acceptance and Next completed. The rendered interface exposes wall-drag instructions, floor-plan/ceiling-height modes, cm/ft-in units, flip horizontal/vertical, and rotate 90 degrees. DOM contains interactive wall overlays and measurement labels. This establishes the UI, not a successful resize.

Existing local REA captures in `ikea-dimensions-evidence.json` and `ikea-step-three-evidence.json` document the dimensions and doors/windows steps. The earlier review explicitly says dragging, numeric edits and placement were not exercised. Those are historical evidence, not fresh successful interaction tests.

Further live calls attempting measurement selection and step-three navigation did not return in the investigation window; orchestration was terminated. Their actions/results are unconfirmed. Do not infer that the site itself failed. No successful end-to-end resizing or opening-placement claim is made.

RoomPlanner comparison is source inspection, not a live usability test. Application code was not changed.

## Existing RoomPlanner capabilities

- `RoomWallPlan.tsx`: wall dragging, visible grips, keyboard-focusable handles and geometry feedback.
- `RoomGeometryEditor.tsx`: width/depth/height numeric editing in millimetres, wall features and columns.
- `RoomGeometryModal.tsx`: focused geometry editing, one session grouped into one undo step.
- `RoomPlannerStart.tsx`: two-step start flow; initial door/window switches.
- `RoomEnvironmentPanel.tsx`: opening wall, width, height, percentage position, read-only corner-to-centre distance, door hinge/swing, window sill height.
- `RoomPlanner.tsx` and `roomOpenings.ts`: opening validation and available-position search when adding without a supplied position.

## Prioritized proposals

1. P1: Connect setup as shape → dimensions → doors/windows → furnishing. Preserve back navigation and state. Reuse existing components and validation; do not duplicate planner state. Measure completion rate and setup time before/after.
2. P1: Make the selected wall's measurement directly editable beside the wall, backed by existing numeric controls. Keep height in the same workspace. Show current selection and invalid-change feedback next to it. This is a proposed design; live IKEA numeric editing was not verified.
3. P1: Add editable corner-to-opening-edge distances in cm alongside the current percentage slider. Clearly distinguish edge from centre. Preserve absolute distance from the selected anchor when resizing walls, or explain/review any repositioning.
4. P1: Put compact opening properties near the selected opening: width, height, wall, distance, remove; expose door hinge/swing and window sill height contextually. Retain the existing full inspector for advanced editing.
5. P2: Preview door/window placement before committing; indicate wall snapping and invalid placement, with a specific explanation. Existing validation should remain the authority.
6. P2: Offer a consistent cm/mm preference across geometry and opening editors. IKEA additionally exposes ft/in, but imperial units need not precede local workflow improvements.
7. P2: Consider rotate/flip for asymmetric room shapes only after defining how furniture, openings, wall IDs and connections transform together.

Recommended first slice: proposals 2–4, followed by the guided setup flow. Existing geometry and opening capabilities provide the foundation; discoverability and precise placement are the main opportunities identified from source.

## Remaining verification

- IKEA: resize wall, edit height, add/move/resize/remove both a door and a window, verify resulting values and back-navigation persistence.
- RoomPlanner: run the same scenarios in the live app before claiming relative ease, click counts, latency or correctness.
