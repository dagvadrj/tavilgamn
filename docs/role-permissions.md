# Role permission matrix

Updated: 2026-10-01. API checks are in lib/supabase/authorize.ts; RPCs and RLS remain
independent defenses. Roles are read from profiles, not browser UI or user_metadata.

| Action | Guest | Customer | Merchant | Admin | Enforcement |
|---|---|---|---|---|---|
| Read public catalog/store directory | Yes | Yes | Yes | Yes | public projection, active store filtering |
| Read published kitchen designs | Yes | Yes | Yes | Yes | published version/media only |
| Edit room / local kitchen draft | Local only | Own browser data | Own browser data | Own browser data | client editor, no role elevation |
| Save/read/delete account kitchen | No | Own only | Own only | Own only | requireUser + user_id predicates |
| Create kitchen quote / read own requests | No | Own only | Own only | Own only | requireUser + actor-bound RPC |
| Checkout / read/pay order | No | Own only | Own only | Own only | requireUser + order owner; server prices |
| Read/write merchant store | No | No | Own active store | No implicit merchant access | requireMerchant + RPC profile/owner locks |
| Edit merchant products / request 3D | No | No | Exclusively own store | Via admin API | merchant RPC forces ownership; platform fields protected |
| View merchant orders/quotes/analytics | No | No | Own snapshot/requests | Via admin API | actor-bound RPCs; no other store totals |
| Fulfill merchant order | No | No | Own eligible paid order | Via admin API | sequential transition + expected status |
| Draft/submit merchant kitchen listing | No | No | Own eligible factory/handmade store | Review through admin API | requireMerchant + eligible store RPC |
| Review/publish/feature kitchen listing | No | No | No | Yes | requireAdmin + transactional review RPC |
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
