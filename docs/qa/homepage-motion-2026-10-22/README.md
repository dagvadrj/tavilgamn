# Homepage motion verification — 2026-10-22

## Delivered

- Replaced the homepage room fly-through with a blue/white product-led hero, actual catalog GLB, feature bento, public counts, Room/Kitchen tutorial, and active stores. Header retained.
- Shared real-model tutorial preview replaces the schematic SVG furniture. Presentation changes do not write planner design data or modify downloadable models.
- Analytic critically damped mesh movement preserves velocity when a user changes steps. Cursor motion uses a continuous 620 ms ease. Autoplay is finite; manual selection pauses it; replay starts at step one.
- Posters display before on-screen-only model loading. Hero poster has image priority. GLB materials retain authored texture maps; protected legs, handles and metal are excluded from demo tinting. Existing compression codecs retained.
- Off-screen/background animation stops, settled meshes stop requesting frames, reduced-motion resolves poses immediately. Shared pill button tokens; primary homepage actions are 52 px high.
- Admin hero title, description, poster and CTA destinations are editable. The nullable hero JSON migration was applied and checked on the connected database. Public figures include active/published catalog data, with missing/error distinct from zero; no merchant revenue is exposed.
- Merchant chart/KPI motion follows the same visibility/reduced-motion policy.

## Verification

- Production build, including lint and TypeScript validation: passed. Standalone lint passed. Styles check: 117 CSS files passed.
- Focused motion/homepage/data/dashboard tests: 27 passed.
- Full suite: 1,061 tests, 1,052 passed, 9 failed. The same 9 failures reproduce on the original HEAD source. They concern furniture overlap/room ownership (5), catalog asset validation (1), kitchen material validation (2), and the existing floating-menu contract (1). See `baseline-tests.log` and `full-tests.log`. These are not represented as passing or repaired by this homepage change.
- Browser: production Chrome, native desktop (1,521 CSS px content width), phone override 390×844 (375 CSS px content), tablet override 820×1180 (805 CSS px content). No horizontal document overflow at those sizes. Phone hero primary buttons: 165.5×52 px each.
- Hero replay/manual steps, Room/Kitchen tab keyboard switching, tutorial replay/manual steps and real Kitchen destination passed. Actual Kitchen help opens the real GLB preview, advances, closes, restores focus to “Ашиглах заавар”, and reopens at step one. The observed 4,000×3,000 mm room dimensions remained unchanged.
- Above the fold only the hero canvas mounted; below-fold models had not mounted. The real sofa asset returned GLB magic bytes and HTTP 200 (1,952,012 bytes). Missing-model/error handling and CMS validation are covered by focused tests; admin save UI was not exercised through an authenticated browser.

## Performance evidence and limits

- Build output homepage initial JS: original 124 KB → final 161 KB. LazyMotion reduced an intermediate 172 KB result. This feature adds JS; it is not an overall load-speed improvement claim.
- `final-production-motion-metrics.json`: three settled Kitchen model transitions at DPR 1, p95 20.3 / 20.0 / 24.7 ms; worst 20.8 / 20.1 / 25.0 ms; 9 draw calls, 136 triangles. No long tasks were recorded in this particular final sample. These are demand-rendered transition samples, not sustained device FPS.
- Earlier dev and production runs captured isolated ~999 / ~1,004 ms frame gaps (retained in the earlier JSON files). Their cause was not established; the final clean sample does not prove the intermittent problem is eliminated. The opt-in `?performance=1` diagnostics now include buffered main-thread long tasks to assist reproduction.
- No comparable pre-change browser LCP/CLS/INP or frame trace was collected. Local HTTP times and build JS sizes are not Core Web Vitals. Physical Android, iPhone and iPad interaction/FPS remain unverified; viewport checks do not substitute for real-device tests.
- Production build was checked locally; no deployment was requested or performed.

## Screenshots and file map

- `homepage-desktop.png`, `homepage-mobile.png`, `homepage-tablet.png`, `tour-mobile.png`.
- Homepage: `src/features/home-motion/`; shared real GLB previews: `src/features/motion/`; easing: `src/lib/demoMotion.ts`.
- Planner tutorial: `src/features/planner/components/PlannerTourPreview.tsx`; admin homepage settings: `src/features/home-interior/AdminHomepageSettings.tsx`.
- Public statistics: `src/lib/homepagePresentation.ts`, `src/lib/homepageStatisticsServer.ts`; public preview endpoint: `src/app/api/marketing-model/route.ts`.
