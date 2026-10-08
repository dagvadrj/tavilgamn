# Planner UI and map controls

2026-10-07 — restore discoverable standard kitchen choices.

- Standard cabinets and appliances are visible at the beginning of the kitchen
  add inspector, before the remote model library, rather than inside collapsed
  "create by size" details. All previous cabinet, oven, hood and refrigerator
  choices remain; hob and sink cabinets can also be added directly.
- Offered widths respect the appliance minimums. Placement, undo/history and
  saved component data continue through the existing kitchen commit path.
- The room furniture catalog exposes a named kitchen-planner link; kitchen
  rooms also have a "plan garniture" action on the canvas toolbar.
- Validation: 23 relevant tests, TypeScript, lint and stylesheet checks passed.
  Production compilation succeeded, but the remaining build phases stalled;
  the build was interrupted and the local dev server restarted.
  Native browser interaction verification remains incomplete: the automation
  session reported an active application change when navigating to `/kitchen`.

2026-10-07 — room planner entry and size selection.

- Entering `/planner` first shows six room types. Choosing a type opens four
  example floor areas, with width/depth displayed and a recommended default.
- A custom option accepts width, depth and ceiling height in centimetres, with
  validation and a live floor-plan preview. The completed dimensions create the
  design atomically, including its room snapshot and persisted draft.
- Users can resume their previous draft. Creating another room preserves the
  earlier design in the saved-project list.
- Validation: 22 relevant tests, lint, TypeScript, stylesheet checks and an
  isolated production build passed; local `/planner` responds with HTTP 200.
  Browser interaction verification remains incomplete because native browser
  automation repeatedly reported that the active application had changed.

2026-10-07 — room planner simplified around the supplied IKEA reference.

- The room canvas occupies the full width until an inspector is opened. Catalog,
  room settings and project summary are mutually exclusive and dismissible on
  desktop as well as mobile.
- One bottom dock exposes dollhouse, top and front views, materials, dimensions
  and room editing. Advanced camera/grid options live in a dismissible menu.
- Room width, depth and height can be entered directly in centimetres. Existing
  opening, furniture, wall-feature and lighting validation still applies;
  complex geometry remains available in the original editor.
- The furniture catalog starts with all available furniture, supports search and
  categories, and avoids GLB filenames in the room UI. Selecting furniture keeps
  the canvas open and exposes named rotate/copy/move/delete actions.
- A three-step introduction, project-name field, save/image actions and a price
  summary with the existing stock-checked cart action complete the workflow.
- Validation: 441 tests passed; lint, TypeScript, stylesheet checks and isolated
  production build passed. Initial desktop layout and catalog opening were
  inspected through native browser UI. Full drag/camera and mobile browser QA
  could not be completed because the native browser automation session repeatedly
  changed windows and finally closed its pipe. No claim of full interaction or
  mobile visual verification is made for this update.

2026-10-02 — local `/planner` and `/kitchen` UI refresh. No deployment, database
change, project deletion or asset changes in this update.

## Changes

- Shared camera dock: zoom in/out, fit room, top/front presets, 45° left/right
  rotation and ground-plane pan in four directions.
- Room planner: navigation/lock/expand moved to the map; editing tools grouped
  in a menu; save/image actions separated; quieter room/budget cards; saved
  kitchen library collapsed by default instead of dominating the catalog.
- Kitchen planner: consistent rounded toolbar, compact icon/text view actions,
  separate hints/status, camera dock beside the canvas. The dock moves clear of
  the desktop inspector and hides behind the mobile inspector workflow.
- Accessible button names retained when responsive labels hide; camera menu
  closes on outside pointer press or Escape. No additional UI dependency.
- Tiny kitchen screens use a two-row toolbar so the exit button is not clipped.
- Follow-up studio redesign: shared dark-green project bar, pale-green primary
  save action, framed desktop canvas/sidebars, two-column category selectors,
  quieter product cards and a styled Dining/Extras search panel. Room image/save
  actions now live in the persistent header rather than over the 3D canvas.
  Kitchen uses the same project-bar colors, project naming and inspector style.
  Decorative blur was removed from the kitchen inspector; no new dependency,
  rendering loop, database field or asset was introduced for this redesign.
- Blender-style mouse input on both scenes: middle-button drag orbits, Shift +
  middle pans, Ctrl/Cmd + middle dollies, and the rolling wheel still zooms.
  In room 2D, plain/Shift-middle pan instead of rotating. Left click/drag belongs
  to selection and furniture movement; touch gestures are preserved.

## Safety and rendering

`plannerCamera.ts` transforms the camera and controls target only. No design,
furniture, material, revision or save-history data is changed by a command.
Distance limits are respected; 2D room rotation is disabled. Room top/front
commands also select the matching 2D/3D mode. Kitchen top view stays in its 3D
scene; its existing 2D review remains separate.

The R3F navigation bridge applies a command once after the camera/control swap
settles, cancels stale frames and invalidates the demand-rendered scene. Camera
commands are not replayed when a layout remounts a scene. No continuous React
state updates were introduced for orbit/mouse movement.

## Verification

- Full suite: **303 passed**, no failed/skipped tests, including ten new camera
  tests (zoom reversibility/limits, pan invariants, rotation, narrow-view fit,
  top/front axes, finite zero-offset handling and immutable input dimensions).
  Five input tests exercise the actual installed OrbitControls/MapControls with
  a simulated event surface: middle rotate, left-drag isolation, Shift-pan,
  Ctrl-dolly/wheel zoom, 2D pan and preserved touch/cleanup behavior.
- Lint, TypeScript and isolated production build passed.
- Real browser checks: room zoom visibly changes the scene; top selects 2D;
  front returns to 3D; pan, rotate, fit and lock/unlock work. Lock disables the
  camera dock. Kitchen zoom/top/front/pan/rotate work; cabinet count and undo
  state stay unchanged. Escape closes its camera menu.
- Responsive screenshots checked at desktop 1440×900 and phone 390×844.
  Both planners additionally checked at 320×700. Kitchen toolbar scroll width
  equals 320, including a visible exit button. Room header/view controls and
  camera dock fit; its catalog/settings drawers open and close at 390px, and
  changing a category updates the visible list and pressed state.
- Screenshots: `room-planner-ui.png`, `kitchen-planner-ui.png`.

This is local browser verification, not an iPhone GPU/FPS benchmark. Existing
catalog entries with broken/missing image assets were not repaired in this UI
task. Existing project data was not saved/overwritten during camera checks.
The browser automation API did not expose a held-middle-button drag gesture;
that gesture was verified with real controls in unit tests, not claimed as a
physical mouse/browser drag E2E.
