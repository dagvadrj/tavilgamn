# IKEA Kreativ review for RoomPlanner

Date: 2026-10-15

REA 6.5.0 was configured for Codex. Its setup diagnostic reported healthy. The current chat has not reconnected to the MCP server; observations below used the REA CLI with a temporary headless Edge browser, which REA terminated after each scenario.

## Observed behavior

Source: https://www.ikea.com/us/en/home-design/

- Entry choices separate trying an existing room, building a custom room, and visualizing products in a scanned home.
- Empty and furnished room templates are available; furnished templates have room-type filters.
- Existing designs can be opened using a design code.

Source: https://www.ikea.com/us/en/home-design/room-builder

- Step 1 of 4: choose rectangular, L, cut, T, U, or beveled shape.
- Step 2 of 4: instructions explain dragging walls to resize and switching to ceiling height. Controls include cm versus ft/in, horizontal/vertical flip, and 90-degree rotation.
- Step 3 of 4: configure doors and windows. Instructions describe selecting, moving, and resizing them. Door/window style buttons, Remove, door size, and Customize controls are present.

## Recommendations for this repository

These are proposed improvements, not claims about IKEA internals.

1. Guide room setup through shape, dimensions, openings, and furnishing, with Back/Next and a visible progress indicator.
2. Make wall dimensions editable on the floor plan, and expose ceiling height beside the plan controls.
3. Give selected doors/windows a compact contextual editor for size, wall position, and removal.
4. Keep the main canvas prominent; show catalog and properties when relevant to the current action.
5. Make empty-room and furnished-template entry choices visually distinct.

RoomPlanner.tsx already delegates setup to RoomPlannerStart and geometry to RoomGeometryModal, and already has opening selection, catalog filtering, camera controls, undo/redo, and saved designs. Extend those existing components rather than implementing duplicate state in the main component.

## Evidence and limits

- ikea-evidence.json: landing page DOM/accessibility capture.
- ikea-room-builder-evidence.json: first builder step.
- ikea-dimensions-evidence.json: accepted cookie banner and advanced to dimensions.
- ikea-step-three-evidence.json: advanced to door/window configuration.
- ikea-scenario.json: most recent reproducible scenario.

REA observed the rendered interface and performed the declared navigation/clicks. Dragging, dimension edits, fourth step, furniture placement, saving, and 2D/3D behavior were not exercised. No conclusion about IKEA's private source, backend, collision algorithm, or model licensing follows from these captures. Application source was not changed in this investigation.
