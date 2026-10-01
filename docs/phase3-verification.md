# Phase 3 — Kitchen Planner MVP verification

Checked: 2026-10-02, local application at `http://localhost:3000`.

## Result and rollout

The local MVP supports wizard → edit → save with a 3D thumbnail → reopen →
restore an earlier version → save it as a new revision → image/BOM/report export.
The additive version migration was applied to the existing Supabase project only
after the database and API tests passed, as approved by the owner. No old models,
projects or assets were deleted. Application changes have **not** been deployed
to the public Vercel site; its existing code is compatible with this migration.

| Requirement | Implementation / evidence |
| --- | --- |
| Wizard: oven, hood, fridge, I/L/U/double-side | Existing wizard extended with U; all 72 preference combinations round-trip and pass placement validation. New wizard drafts use isolated UUID keys instead of overwriting an existing draft. |
| Room, fullscreen workspace and top bar | Existing four-wall/floor scene and room controls retained; accessible top-bar actions and Save contrast corrected. |
| Cabinet and appliance catalog / contextual replace | Existing canonical module/variant catalog and contextual component controls retained; regression tests cover appliance fit, replacements and physical dimensions. |
| Dining / extras | Published product catalog provides dining-table, office, bookshelf, TV-stand and sofa extras. Placement, rotated collision checks, selection, move, rotation, duplicate and delete persist in the design. |
| Snap and collision | Existing cabinet/wall snap reused for extras; room bounds and overlap validated before commits. |
| Undo / redo | Bounded 50-step immutable history; one drag is one action; keyboard shortcuts ignore text inputs; a new edit clears redo. Name edits are not design-history entries. |
| Materials | Existing front, carcass, handle, countertop, plinth and backsplash controls retained. Procedural extras allow catalog material/color changes; imported GLBs retain their authored appearance and say so. |
| Save / load / versions | Atomic optimistic save with conflict response; owner-only history and restore-as-new-version; thumbnails bind to a revision and never replace another revision's image. |
| 2D plan and dimensions | Cabinet/extras plan with room width/depth dimension labels; displayed rounded millimetres. |
| BOM and price | Product-linked cabinet assemblies and extras use current published catalog prices. Included parts are not charged twice. Unpriced surfaces/components are explicitly reported. CSV and escaped printable HTML include the material/dimension list. |
| Image / GLB / SKP / PDF | WebP image and actual embedded GLB downloads verified. SKP disabled when its external converter is unavailable. PDF uses browser print / Save as PDF; see limitations below. |

## Automated gates

- `npm test`: **293 passed, 0 failed, 0 skipped**.
- `npm run lint`: passed with zero warnings.
- `npm run typecheck`: passed.
- Production build: passed with isolated `NEXT_DIST_DIR=.next-phase3-build`.
- Visual regression: the 1280×720 2D review screenshot after reload matched the
  baseline with `changedRatio: 0`. The comparator also has tests that reject
  changed pixels and mismatched viewport dimensions.

New tests include history behavior, safe product snapshots, rotated placement,
all wizard choices, BOM arithmetic, HTML escaping / CSV formula prevention,
owner-isolated immutable database versions, compare-and-save races, legacy
writers, thumbnail-only updates and anonymous access denial.

## Desktop end-to-end evidence

Using the existing signed-in account, a clearly named test project was created
from the wizard, edited with a dining table, saved with its 3D cover, reopened
from the account's project library and restored from history. Each restore was
saved as a new revision rather than rewriting an old revision.

- Test project: `d640ff43-04b4-4b0b-a6b6-64d54b664648`, **Phase 3 MVP шалгалт**.
- Verified final state: revision 5, five historical versions, 11 cabinets,
  one extra, and a saved thumbnail.
- Checked the real API/database records against the browser state.
- Existing user drafts, including the Phase 2 draft, were not overwritten.
- No fresh account/sign-up E2E was performed; authenticated flow and anonymous
  API denial were checked separately.
- Desktop top-bar actions fit within 1280px (`actions.right=1264`,
  `toolbar.scrollWidth=1280`); stage navigation collapses before overflowing.

Actual browser downloads were inspected:

| Download | Evidence |
| --- | --- |
| BOM CSV | 9,400 bytes, UTF-8 BOM and material/dimension rows |
| Report HTML | 51,927 bytes, embedded 3D image, 2D plan and BOM |
| GLB | 640,376 bytes; valid GLB length/header; 163 meshes, 159 materials; extra present; no external texture URI |
| WebP image | 29,692 bytes, 1280×623; room, cabinetry and dining table visible |

The native Print dialog initially blocked the last browser re-run. After the user
closed it, the wizard → U template → isolated draft scenario passed again, and
cabinet duplicate → undo → redo → undo visibly changed the count 11 → 12 → 11 →
12 → 11. No extra duplicate was saved to the test project. A native PDF file was
**not** produced or inspected by automation; invoking the dialog is not a
completed PDF-download test.

## Database behavior and safety

Migration: `supabase/migrations/20261001164907_kitchen_project_versions.sql`.

- Backfilled the 13 existing projects with 13 revision-1 snapshots.
- Added database-controlled `revision` and private owner-scoped version records.
- Authenticated users can read only their own history; snapshots have no direct
  client write grant. Anonymous users have no access.
- Server-only atomic save RPC checks expected revision while holding a lock.
- Existing writers also create snapshots through triggers.
- Thumbnail-only writes do not increment the design revision; stale thumbnail
  uploads are rejected instead of replacing the newer cover.
- No destructive schema changes or historical-project cleanup were applied.

Pre-existing Supabase advisor findings remain outside this phase: leaked-password
protection is disabled; `handle_new_user` has public execution grants; some
server-only tables have RLS without policies; and unrelated message/payment
indexes were flagged. They were not silently changed as part of planner work.
See [password protection](https://supabase.com/docs/guides/auth/password-security)
and [function security](https://supabase.com/docs/guides/database/functions).

## Deliberate MVP limits / acceptance caveats

1. **U is a three-wall arrangement template**, not an automatically joined
   manufacturing-ready run with two continuous corner cabinets. Corners can be
   added/replaced and positioned in the editor; automatic corner completion is
   a subsequent enhancement.
2. **Prices are preliminary.** Missing catalog prices/material rates are marked
   unpriced, not zero. Installation, delivery and non-default material surcharges
   are excluded. The report is a design BOM, not a manufacturing cut list or
   final commercial quotation.
3. **PDF:** printable HTML plus the normal browser's Save as PDF is the chosen MVP
   route. Native OS print dialog/output needs a manual check; there is no direct
   server PDF endpoint.
4. **SKP:** direct `.skp` requires a separately configured SketchUp SDK converter.
   It remains disabled here. GLB export is available; import it into a compatible
   SketchUp workflow and save as SKP there.
5. **Visual scope:** desktop 1280×720 deterministic 2D review/reload comparison;
   not a broad device/GPU screenshot matrix or a new iPhone performance benchmark.
6. Capture refuses pending model delivery/preview placeholders; a save can still
   preserve the design without a cover when a clean capture is unavailable.

## Repeatable verification

`scripts/verify/kitchen-mvp-cua.mjs` contains UI-only scenarios accepting the
documented Codex CUA Tab handle. It does not read browser auth/storage or bypass
the UI. Import it in CUA and use an existing authorized signed-in tab:

```js
await scenarios.verifyWizard(tab, { name: 'Phase 3 MVP E2E' });
// Add an extra and save through the UI; wait for the visible save result.
await scenarios.verifyHistoryRestore(tab, { current: 2, restore: 1 });
// A later CUA call confirms asynchronous save completion.
await scenarios.verifySaved(tab, { revision: 3 });
await scenarios.openLibrary(tab);
await scenarios.verifyReopen(tab, { name: 'Phase 3 MVP E2E' });
await scenarios.verifyOpened(tab, { name: 'Phase 3 MVP E2E' });
await scenarios.verifyReview(tab, { extraName: 'the selected catalog product' });
```

For visual checks, capture PNGs through CUA at the same 1280×720 viewport and
review state, then compare the already captured files:

```text
npm run test:visual -- docs/phase3-review.png .tools/phase3-review-reload.png
```

Pixel tolerance is 24 per RGB channel, with at most 0.5% changed pixels; viewport
differences fail immediately. Keep the baseline unchanged during comparisons.
Review a genuinely intended UI change before replacing its baseline. Reset any
temporary browser viewport override after testing.

Next rollout step: deploy the tested application changes to Vercel, then repeat
the save/reopen/image/report flow on the public site. Deployment is not included
in the completed local verification above.
