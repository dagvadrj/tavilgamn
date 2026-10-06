# Merchant and administrator drafts

Unsaved editable information is scoped by role, authenticated user ID and form/item ID. Customer forms do not use this storage. Returning to the dashboard restores the last section and the product editor that was open. New-product drafts and existing-product drafts have separate keys.

Covered forms: merchant store/profile, product metadata and selected images, kitchen listing creation/version edits and quote replies; administrator products (including replacement GLBs), model uploads, kitchen module uploads/variant definitions, material metadata, merchant settings and kitchen review notes.

Each field has its own IndexedDB record. File records include byte content, filename, MIME type and modification time; changing a title does not rewrite a large GLB. Text also receives a synchronous localStorage backup. In-memory records preserve immediate tab/route navigation while disk writes finish. Forms wait for hydration before submitting; late disk reads cannot overwrite newer edits. File inputs cannot be populated by JavaScript, so the notice lists restored filenames and validation uses the restored File state. GLB preview and front confirmation are recomputed from the file.

Successful server saves remove the corresponding draft. Failed requests retain it. The user can explicitly discard a draft; deletion is ordered after in-flight writes, with a local deletion marker preventing stale records from reappearing. Pending disk writes or storage failures activate the browser's page-close warning. A quota failure retains the file in memory and displays an error instead of claiming it was saved. Storage is local to this browser/origin; deleting browser site data removes drafts. Immediate server uploads (for example marketplace render images/texture uploads) still use their existing API flow.

## Verification

`tests/dashboard-drafts.test.cjs` exercises navigation/restart restoration, file bytes and uploadability, account/role/item separation, delayed hydration, queued writes and clearing, quota failures, refreshed product defaults, editing after discard, URL overrides, and deletion failures in the browser storage adapter.

Manual browser check: sign in as a merchant or admin, edit a product and select files, navigate to another section/route, return, then reload. Verify the fields and selected filenames return; GLB previews require front confirmation again. Save successfully and reopen to verify the submitted draft has cleared. Sign in with a different account and verify the previous account's draft is absent. Browser interaction was not automated in this session; storage behavior and API action regressions were verified by tests and a production build.

All 437 repository tests, full-source lint, TypeScript validation and the production build passed. Public production HTTP checks also confirmed the anonymous admin/merchant shells load successfully.
