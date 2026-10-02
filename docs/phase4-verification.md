# Phase 4 — Kitchen marketplace verification

Date: 2026-10-02. Local implementation, database migration and the authorized
live-data core workflow verified. Vercel deployment and an optional paid AI output
remain outside this turn.

## Implemented scope

- Seven canonical lifecycle states; admin-only approval/publication/suspension,
  mandatory change/suspension reasons, immutable approved public pointer.
- Factory/handmade merchant source editor link, editable snapshot sync and version
  history. Published old versions remain public while a new version is drafted.
- Listing price range and material labels, alongside existing title, description,
  style, layout, physical dimensions, manufacturer, lead time and delivery regions.
- Thumbnail/gallery and consented AI requests; default 3/store/rolling 24h,
  one active request/version, queued cancellation and explicit admin cost approval.
- Customer clone provenance retained in the kitchen library; planner quotes save
  edited projects before capturing the request's immutable snapshot.
- Merchant read-only 3D/2D/material-list inspection of received quote snapshots;
  response flow and notifications focus exact quote/design IDs.
- Private append-only audit ledger and server-only policy; public responses do
  not expose draft history, private source IDs, jobs, notes or audit events.

## Automated evidence

`npm test`: **311 tests passed, 0 failed**. Phase 4 adds isolated PostgreSQL
compatibility tests using PGlite and route/input tests; the automated suite does
not send real quotes, change production listings or call a paid image provider.

The database scenario covers create/edit → source sync → AI consent/quota/cancel
→ submit → reasoned review → approve → publish → customer clone/edit → quote
→ merchant response → focused notification → new draft preserving public version
→ suspend/resume → archive. It checks wrong owners, revoked roles, direct client
grants, immutable snapshots, actor audit and transaction guards.

Route tests cover consent/quota errors, rejecting unapproved paid generation before
claim/provider calls, exact merchant snapshot ownership, range/material validation
and local-only notification URLs. Plan styles are imported by the shared component,
not dependent on a planner route having been visited; read-only plan snapshots
expose no editable keyboard/button targets. The test harness treats global CSS as
a bundler side effect; visual styling was separately verified in the browser.
Existing kitchen/planner/GLB/merchant tests pass.

- Lint: passed, no warnings.
- Typecheck: passed, including freshly generated live-schema types.
- Production build: passed with isolated `.next-phase4-build` output. Initial
  sandbox font-network failure was resolved by an approved network-enabled retry.

## Production database rollout

User explicitly authorized applying the additive migration after tests.
Applied `20261002063235_kitchen_marketplace_phase4.sql` to the existing Supabase
project; regenerated `database.types.ts` from the resulting live schema.
The signed-in browser check found a pre-existing invoker permission defect:
customer quote/clone RPCs attempted to SELECT `auth.users`, which service_role
cannot read. After passing the full suite, applied the follow-up
`20261002073048_kitchen_marketplace_actor_lookup.sql`. These service-only RPCs now
validate the actor's Auth-linked profile, without granting Auth table access or
changing to SECURITY DEFINER. Clone also independently checks store eligibility.
The regression scenario now executes clone/quote/read as service_role, with no
Auth SELECT grant, rather than relying on superuser fixture permissions. A live
read under service_role returned the correct empty own-quote list with Auth
SELECT still false.

Read-only post-migration checks: **4 listings, 4 versions, 2 published listings,
0 quote requests, 2 existing render jobs** preserved. The existing jobs were
already failed; they were not retried. No GLB, image, listing or account was deleted.

Audit and policy tables have RLS enabled without browser policies/grants. New
render/usage/internal RPCs are service-only, and actor/ownership checks remain in
the database. Advisors found no new warning; two intentional server-only
[RLS-without-policy informational notices](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy) were added.

Pre-existing Auth warnings remain out of scope: executable handle_new_user trigger
function grants and disabled leaked-password protection. See Supabase's
[anon function notice](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable),
[authenticated function notice](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)
and [password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection).

## Browser verification and remaining gates

Localhost public marketplace/detail rendered with the expected published data,
materials fallback and quote form. Admin session rendered all seven filters and
the existing four designs with appropriate review/suspend actions. No real listing
was approved, published, suspended or archived during this read-only check.
Signed-in Nqc merchant rendered listing/source links, version history, range and
material inputs, and the AI consent/allowance panel. The AI request button was
verified disabled without consent. Existing credit-exhausted jobs were not retried.

The user then explicitly authorized a separate temporary listing, publication,
clone, a test quote to their Nqc store with test@example.com / 00000000 and final
archival. No real listing or real contact information was changed.

### Authorized live-data scenario

- Browser merchant create/submit: `Phase 4 тест 2026-10-02`, 9 cabinets,
  1,000,000–1,200,000 MNT, Царс/MDF, 5 days.
- Admin approval/publication: existing role-checked admin RPCs through Supabase
  connector for **only** this verified new listing. This was not an admin-browser
  mutation and did not grant or change anyone's role.
- Browser consumer flow: clone to the signed-in account, change room width
  4000 → 4200 mm, rename and save; revision 2 confirmed in the live database.
  The merchant account also acted as consumer; a distinct customer-role account
  was covered by the isolated database test, not a second live login.
- Browser quote submit: planner autosave first, test contacts only; immutable
  project snapshot contains 4200 × 3000 × 2600 mm, not the 4000 mm public source.
- Browser merchant inspection: real 3D, measured 2D and BOM loaded. The initial
  missing-style black 2D background was fixed; computed fill rgb(239,237,229),
  280px plan height and zero interactive plan buttons verified.
- Browser merchant response: 1,100,000 MNT with explicit non-binding test note.
  Clicking the generated response notification reached the exact account quote
  and displayed that price and note. No email was sent via the mailto link.
- Browser archival: only the temporary listing archived after the workflow.
  Clone project and quoted request are retained as evidence, not purged.

Test listing: `32b8c4eb-298d-45d5-952c-55df19d51168`.
Clone: `8c2f2536-625f-41b7-8f15-1e13d2400bf2`.
Quote: `502c35e0-7259-4863-8435-e0edec1fe103`.
See [3D/2D snapshot screenshot](phase4-marketplace.png).
Final live checks: test listing archived, the original **2 published listings**
still public, render job count unchanged at **2**, and the test audit contains
creation, submission, approval, publication, clone, quote, response and archival.
See [archive screenshot](phase4-archive.png). The test clone/quote remain private.

### Release gates

1. Deploy the verified code to Vercel and smoke-test the live site. Schema is live,
   application code is local. Older production AI request calls lacking consent
   are intentionally rejected until the matching application update is deployed.
2. Optionally run one explicitly authorized paid AI render with provider credits;
   existing jobs show credit exhaustion. No paid output was generated in this turn.

Other concurrent planner-panel edits and the two pre-existing root JSON deletions
were preserved and are not Phase 4 cleanup.
