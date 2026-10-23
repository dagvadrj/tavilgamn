# Merchant operations

The merchant menu includes branches/warehouses, staff access, photo review moderation, returns/complaints and FAQ assistant settings.

## Staff login

The owner adds an email, name and role under **Ажилтны эрх**. The employee signs up/signs in with that email, confirms it, and opens `/merchant` (also linked from the customer account page). The server binds the pending membership using the confirmed email from a fresh `Auth.getUser` response. No invitation email is sent. Membership does not change the account's global customer role.

| Role | Access |
| --- | --- |
| Salesperson | Read store orders, moderate/reply to reviews, resolve returns/complaints |
| Warehouse clerk | Allocate stock, advance incoming → preparing → prepared |
| Driver | Assigned deliveries only; shipped → delivered |
| Owner | All merchant operations, dispatch assignment, completion, finance |

Drivers must be linked to a delivery staff record created on the delivery board. Deactivating either the membership or delivery record blocks subsequent requests. Store ownership and the owner's merchant role are rechecked in database functions. Existing owner-only product, GraphQL and wallet routes remain owner-only. Staff use dedicated delivery routes.

## Branch stock

`furniture_models.in_stock` remains the sellable total used by checkout. Branch quantities allocate that total and cannot exceed it. Concurrent edits check both the total and previous branch quantity while locking the product. Checkout/stock reductions consume unassigned stock first and then the oldest branch allocation. Cancellation restores unassigned stock; a person must confirm its physical location. Operation events record automatic deductions and allocation changes.

Edit total inventory in the product form. Set a branch's allocations to zero before deactivating it. Only products exclusively assigned to this store can be allocated.

## Feedback and assistant

Buyers submit reviews from a delivered order, and return/complaint requests after dispatch. Image files are validated, re-encoded to WebP without source metadata, uploaded through registered intents, and checked against the buyer/order before submission. Maximum four photos per submission, five MB per source file, twenty upload intents per user/day. Only approved reviews and merchant replies are publicly readable; buyer IDs and order IDs are omitted. Review moderation also refreshes the product's rating/count.

Return outcomes record the physical/customer-service decision. They do not issue refunds, modify wallet balances or automatically restock damaged goods. Existing cancellation/refund controls remain separate. Overview risk percentages use all orders created on the selected Ulaanbaatar calendar date as the denominator, including cancelled orders; pending cases and completed physical returns are shown separately, including zero values.

The assistant is an opt-in FAQ responder on the public store page. It returns merchant-approved text, with a configured fallback for unmatched questions. No external AI provider is called or billed.

## Verification

`tests/merchant-operations-db.test.cjs` exercises the real SQL functions in PGlite: permissions, tenant isolation, allocation/reconciliation, stale versions, staff assignment/revocation, publication, returns and FAQ visibility. `tests/merchant-operations.test.cjs` checks API identity derivation, validation and the image processing path. Run with `node --test tests/merchant-operations*.test.cjs`.

Migrations: `20261020231636_merchant_operations_workspace.sql` and `20261020232614_merchant_branch_stock_guard.sql` (same versions as the applied remote migrations). All new tables have RLS and no anonymous/authenticated grants; service-only invoker functions are reached through verified server routes. Products with allocated inventory cannot change stores until the allocation is cleared; archiving releases branch availability.

## Showroom QR, production orders and quotations

- Every ready 3D product has a printable QR label in Merchant Products. It points to `/planner?product=<productId>&source=showroom`; after the visitor creates or resumes their own room, the product is placed once. Successful placements and explicit color/material changes record anonymous browser-session events. Imports, restores and failed placement attempts do not generate these events.
- The inventory card and product list expose a made-to-order switch. Physical stock remains a real count. Checkout reserves only physical units and snapshots `reservedQuantity`, `madeToOrderQuantity` and a 7–14 day production lead time. Cancellation restores only the reserved units, including mixed in-stock/production orders; legacy orders without a reservation snapshot retain their previous restoration behavior.
- Available wallet balance continues to use paid, completed fulfillment net income at the snapshotted commission rate. The overview links to the existing bank verification and idempotent withdrawal workflow and displays recent transactions. Bank transfers remain manually verified by admin.
- Checkout records optional floor, elevator type and assembly requirements. Dispatch records driver-only or driver-plus-assembler. New delivered/completed transitions require private delivery-photo evidence; historical delivered/completed records are explicitly grandfathered. Owner and assigned-driver authorization are checked again on registration. Photos are private, and owner viewing uses five-minute signed URLs. SMS/OTP delivery is deferred.
- Kitchen requests retain the existing 3D/2D preview and add itemized quotation lines, server-calculated totals, an immutable issued document and platform notifications. Merchant and customer can download the same PDF. PDF generation is lazy-loaded and embeds the OFL PT Sans font distributed in `public/fonts/pt-sans`; unsupported characters fall back to `?`, and currency is written as `төг`.
- Measurement appointments use Ulaanbaatar time, 30–120 minute slots, optimistic versions, and serialized overlap checks per store/engineer. Customers confirm or decline proposals in their kitchen-quote history.
- Products without a model expose a direct 3D modeling request using the existing admin request queue, current gallery images and physical dimensions. Gallery/measurement editing remains available before submission.
- Migration: `20261021001252_merchant_showroom_fulfillment.sql`. New commerce tables and RPCs are service-only with RLS enabled. Placement analytics report distinct browser sessions and paid orders separately; they do not claim an attributed purchase conversion.

## Merchant-specific agreement files

Admin selects a merchant before uploading a PDF or DOCX (maximum 10 MB), saves a draft, then publishes it to that store. Each store has an independent draft and current version. Published files and acceptance evidence are immutable; earlier signed text agreements remain in the accepting store's history.

Original files are kept in the private `merchant-contracts` bucket. Authenticated server routes authorize the admin selection or merchant owner before downloading, and verify the stored SHA-256 and byte length. New objects are never uploaded with upsert. A definitive rejected save can remove only that request's new object; ambiguous errors retain it. The browser does not create empty files when a download manager intercepts a request.

Migration: `20261023011252_merchant_specific_contract_files.sql`. Verification: `tests/merchant-contract-files.test.cjs`, upgraded agreement coverage in `tests/merchant-commerce-db.test.cjs`, and desktop/mobile WebKit UI workflows using actual routes and isolated PGlite data. Live checks verified the private bucket, upload/download, denied public access, RPC access and client execution restrictions without creating business agreements.
