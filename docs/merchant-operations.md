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
