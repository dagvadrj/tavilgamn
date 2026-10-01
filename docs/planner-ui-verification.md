# Planner UI and map controls

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
  Kitchen additionally checked at 320×700: toolbar scroll width equals 320,
  including a visible exit button. Room 320px treatment has compact 2D/3D
  labels; its directly observed phone viewport was 390px.
- Screenshots: `room-planner-ui.png`, `kitchen-planner-ui.png`.

This is local browser verification, not an iPhone GPU/FPS benchmark. Existing
catalog entries with broken/missing image assets were not repaired in this UI
task. Existing project data was not saved/overwritten during camera checks.
The browser automation API did not expose a held-middle-button drag gesture;
that gesture was verified with real controls in unit tests, not claimed as a
physical mouse/browser drag E2E.
