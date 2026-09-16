# Merchant stores and navigation

## Entry points

- Header store types: `/stores?type=factory`, `handmade`, `retail`.
- Categories: desktop modal / mobile drawer, furniture and room tabs. Room links use `/catalog?room=living|bedroom|dining|office` and the actual catalog categories.
- Merchant workspace: `/merchant`, available from the account page and navigation after sign-in as a merchant.
- Public store detail: `/catalog/stores/{id}`.
- Admin → Users: explicitly save the customer/merchant role. Existing admin accounts cannot be changed here.

## Data and permissions

Apply `supabase/migrations/20260916072036_merchant_stores_roles.sql` through the normal database migration process before enabling merchant features. The migration does not grant merchant access to any existing account. An admin assigns the role; the merchant creates their store, with an immutable generated ID and one owner per store.

Public store cards include only public profile fields. The owner ID is not returned by `/api/stores`. Existing curated stores remain available; their IDs are not automatically assigned to accounts. The admin product editor includes active and inactive merchant stores so existing assignments can be preserved.

Merchant APIs validate the bearer token using `getUser`, then read the current profile role. Server-only RPCs recheck authorization within the transaction. Direct client writes to merchant tables and RPC execution are denied. Editable profile fields cannot change ownership, and editable product fields cannot change platform rankings or another store's associations. Products shared across multiple stores are not merchant-editable.

Checkout snapshots each merchant's own line items under the order transaction. Historical orders are not backfilled by guessing current product ownership. Changing a product's store after checkout cannot transfer an existing order. Merchant responses include their own lines, subtotal and the delivery information needed to fulfill that order; they exclude other stores' lines and order totals. Payment and global order status remain controlled by the existing payment/admin flow. Fulfillment progresses through processing, shipped and delivered only for eligible paid orders, using expected status to detect concurrent edits.

## Verification

Focused tests: `node --test tests/navigation-categories.test.cjs tests/store-directory.test.cjs tests/merchant-ui.test.cjs tests/merchant-api.test.cjs tests/merchant-db.test.cjs`.

Run the full existing test suite and TypeScript/build checks before release. Database tests use a disposable local PGlite database and do not grant real account permissions or write production orders.
