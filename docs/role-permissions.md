# Role permission matrix

Updated: 2026-10-02 (Phase 4). API checks are in lib/supabase/authorize.ts; RPCs and RLS remain
independent defenses. Roles are read from profiles, not browser UI or user_metadata.

| Action | Guest | Customer | Merchant | Admin | Enforcement |
|---|---|---|---|---|---|
| Read public catalog/store directory | Yes | Yes | Yes | Yes | public projection, active store filtering |
| Read published kitchen designs | Yes | Yes | Yes | Yes | published version/media only |
| Edit room / local kitchen draft | Local only | Own browser data | Own browser data | Own browser data | client editor, no role elevation |
| Save/read/delete account kitchen | No | Own only | Own only | Own only | requireUser + user_id predicates |
| Read/restore editor project versions | No | Own only | Own only | Own only | owner-filtered API + SELECT RLS; restore saves a new revision through service-only CAS RPC |
| Create kitchen quote / read own requests | No | Own only | Own only | Own only | requireUser + actor-bound RPC |
| Checkout / read/pay order | No | Own only | Own only | Own only | requireUser + order owner; server prices |
| Read/write merchant store | No | No | Own active store | No implicit merchant access | requireMerchant + RPC profile/owner locks |
| Edit merchant products / request 3D | No | No | Exclusively own store | Via admin API | merchant RPC forces ownership; platform fields protected |
| View merchant orders/quotes/analytics | No | No | Own snapshot/requests | Via admin API | actor-bound RPCs; no other store totals |
| Fulfill merchant order | No | No | Own eligible paid order | Via admin API | sequential transition + expected status |
| Draft/submit merchant kitchen listing | No | No | Own eligible factory/handmade store | Review through admin API | requireMerchant + eligible store RPC |
| Sync editor geometry into marketplace draft | No | No | Own editable version and source project | No implicit merchant access | actor-bound snapshot RPC; submitted/archived/suspended blocked |
| Review/publish/feature kitchen listing | No | No | No | Yes | requireAdmin + transactional review RPC |
| Suspend/resume kitchen listing | No | No | No | Yes | locked admin RPC; reasons required for suspension |
| Archive kitchen listing | No | No | Own eligible store | Yes | actor-bound RPC; archived listings not restored |
| Read private marketplace audit | No | No | Own eligible store listings | All through admin API | private server projection; append-only ledger, browser grants revoked |
| Request AI render/read allowance | No | No | Own editable version; explicit consent and store quota | No implicit merchant request access | service-only actor RPC + store advisory lock |
| Cancel queued AI render | No | No | Own request only | Yes | role/owner/status check; allowance not refunded |
| Run paid AI generation | No | No | No | Explicit cost approval | requireAdmin + approveCost + transactional claim; provider credentials server-only |
| Inspect quote project in 3D/2D/BOM | No | No | Own eligible store request only | No implicit merchant access | exact quote/store/owner predicate; immutable read-only snapshot |
| Change customer/merchant role | No | No | No | Yes, with restrictions | no self-change; existing admin protected |
| Admin catalog/model/material management | No | No | No | Yes | requireAdmin + input validation |
| Upload/replace GLB, archive/restore model, read asset history | No | No | No | Yes | requireAdmin + actor-bound RPCs; model_assets client grants revoked |
| Admin orders/payment reconciliation/inbox | No | No | No | Yes | requireAdmin; callback/provider checks separate |
| Claim platform store (owner_id NULL) | No | No | No | No ownership-assignment UI | no seed account; merchant RPC ignores supplied store ID/owner |
| Direct write to merchant/private payment tables | No | No | No | No through public client | grants revoked; server-only secret/RPCs |

service_role is an infrastructure credential, not an end-user role. It stays
server-only and may bypass RLS; therefore API checks and RPC actor/ownership
validation are both necessary.

Platform store orders continue through the existing platform order flow; no
merchant_order_fulfillments row is fabricated for an ownerless directory store.

Provider callbacks are not user bearer-auth routes. They retain their dedicated
signed/token verification and settlement/idempotency logic.

## Known pre-existing security notices

Supabase advisors reported leaked-password protection disabled and public execution
grants on the handle_new_user trigger function. These were not changed by the
store-directory migration. Treat them as separate Auth hardening work; do not
change the trigger to invoker rights without verifying signup provisioning.

RLS-without-policy INFO notices on server-only contact/payment/fulfillment/archive
tables reflect intentional denial of direct client access, not permission grants.
The same intentional denial applies to Phase 4 audit and render-policy tables.
