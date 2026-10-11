# Product details, GLB history and source cleanup

Verified on 2026-10-10, Asia/Ulaanbaatar, in `ProjectN2`.

## Product details

Admin and merchant product lists now have a **Дэлгэрэнгүй** button after **Засах**. The shared view shows description, prices, stock, dimensions, colors, materials, category specifications, delivery/promotion information, and creation/update dates.

GLB assets are grouped by their immutable `version_id`, with the original upload date shown as `YYYY.MM.DD HH:mm` in UTC+8. The preferred viewing asset is that version's compressed preview, followed by delivery GLB, followed by an existing original source. The viewer preserves the model's geometry and materials. Previous successful versions remain available after replacements. Abandoned uploads remain visible as history entries after cleanup, with preview disabled once the file is deleted.

History is read in batches of 500 so it is not truncated at the previous admin asset endpoint's limit of 200. Private source previews require a verified admin or the active merchant owner of the product's single store, matching the merchant product RPC's ownership scope. Asset queries bind the asset ID to the authorized product's model. The response streams bytes with `private, no-store` and `Vary: Authorization`; it does not return storage paths or signed URLs. Public model routes continue excluding original sources and pending/deleted assets.

## Cloudflare R2 findings and cleanup

The three sources in the supplied screenshot were registered upload intents in `pending` state with no completed validation. The worker previously cleaned only sources attached to ready published models, leaving abandoned intents outside its sweep. The existing ledger alone does not identify whether completion was canceled, failed validation, or failed due to a network error.

The user selected a 24-hour retention period for incomplete uploads. A cleanup module is now called by the worker every minute. It only considers never-accepted source intents older than 24 hours, with no checksum or validation, no live source reference, and an exact bucket/model/version source key. An R2 HEAD check also preserves any object written within the last 24 hours.

An optimistic conditional update claims an intent as `retired` before object deletion; `queue_model_asset` rejects retired sources. If concurrent completion wins, cleanup does not delete the object. Failures remain retryable. The ledger becomes `deleted` only after successful object removal or confirmation that the object is absent. Successful delivery/preview assets are never purged.

Live cleanup removed **4 actual R2 objects**. A second dry-run returned **0 candidates**, and the database returned **0 expired pending sources**. The three screenshot sources were younger than 24 hours and were preserved. Their model has **2 successful published GLB versions** and **3 incomplete uploads**.

Manual inspection command:

```powershell
npm run models:cleanup-sources
```

Manual application command (the local npm wrapper dropped forwarded arguments, so use Node directly):

```powershell
node --env-file=.env.local scripts/models/cleanup-sources.mjs --apply
```

## Supabase migration

The connected Supabase project was verified as `gpdpaexkmuhxzknguicp` / `tavilgamn`. The pending `product_specifications_categories` SQL was applied once after inspecting migration history, missing columns, predecessor functions, and existing category values. No historical `db push` was run.

The local migration filename was reconciled to the server's recorded version, `20261010114233_product_specifications_categories.sql` (original CLI draft version `20261010110544`), so a later push does not attempt to apply this same change again.

Verified live: `specifications` is JSONB, NOT NULL, default `{}`; storage-shelf and office-chair are accepted; unknown categories are rejected; save RPC execute grants are false/false/true for anon/authenticated/service_role. Database TypeScript types were regenerated from the live schema.

A live transaction under `service_role` checked create, update, legacy saves preserving specifications, stock CAS conflicts, and invalid JSON rejection, then rolled back. The leftover fixture count was **0**.

The existing local GLB worker was restarted with the updated code after verifying that model and export queued/processing counts were all zero, activating its periodic source sweep.

## Verification

- Full regression suite: **550 tests passed**, zero failures.
- Focused final ownership/history/cleanup checks: **11 tests passed**.
- ESLint, TypeScript and stylesheet checks passed; 55 CSS files checked.
- Isolated production build passed, including both new details routes.
- Admin and merchant browser checks at 1440px and 390px passed: information, four history states, selecting three previews, returning to the list, and no horizontal overflow or browser exceptions. Browser identity, API data and GLBs were fixtures; no browser writes touched live data.
- Separate read-only integration used the real database and real R2: five history entries, two valid preview GLBs (1,897,968 and 1,812,344 bytes), three pending sources. Both unauthenticated HTTP details endpoints returned 401. No integration fixture writes were made.
- Live `/api/products?fresh=1`: HTTP 200, 33 products. Live specifications read: HTTP 200. Product page: HTTP 200 with specification table.
- The existing local development server on port 3000 picked up the new API routes.

## Existing advisor findings

No advisor finding concerns the new specification functions. Private tables, including `model_assets`, intentionally have RLS enabled with no public policies and are accessed through server authorization.

Existing warnings remain for public execution grants on the `handle_new_user` SECURITY DEFINER trigger function ([anon remediation](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable), [authenticated remediation](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable)) and [disabled leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Performance advisories reported two existing [unindexed foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) on `messages.sender_id` and `order_payments.verified_by`, plus unused-index information. These unrelated settings and schema objects were left unchanged.
