# Catalog request performance — 2026-10-07

`readProducts` now stops after a partial 500-row page. The live 32-product catalog previously incurred a second database round trip just to discover an empty page. Larger catalogs retain keyset pagination, including the final empty query when the count is an exact multiple of 500.

`/api/products` keeps a single validated snapshot for 15 seconds per server worker and shares in-flight reads across concurrent requests. The homepage, related-product listings and store catalogs now use the same public snapshot. Store directories and per-store product counts have their own bounded 15-second snapshots. Development module reloads retain these worker snapshots while updating their reader functions. The TTL starts after successful completion. Expired data is not served, failed reads are not cached, and retries remain possible. HTTP responses remain `no-store`. Product-detail reads, admin APIs, transaction quotation and order creation remain uncached. Server-Timing identifies hit, miss, refresh and coalesced requests.

Client refreshes reuse their existing 30-second fresh catalog. Explicit `refresh(true)` requests use `?fresh=1` to bypass the server snapshot. Forced refreshes arriving behind an older read queue a new read; concurrent queued refreshes are combined. The duplicate refresh in the checkout quote-error handler has been removed. Admin and merchant mutations keep their existing forced-refresh calls.

Localhost observations (development server, 32 products, unchanged response content):

| Request | Full response time | Catalog handler time |
| --- | ---: | ---: |
| Before change, four sequential requests | 1007 / 507 / 369 / 356 ms | Not instrumented |
| First request after change, cache miss | 635 ms | 502 ms |
| Three cache hits after change | 40 / 29 / 35 ms | 0.0–0.1 ms |
| Forced refresh after change | 207 ms | 173 ms |

These are local observations, not production latency guarantees. A new server worker, an expired cache or an explicit refresh still waits for the database. Development compilation can add latency outside the measured catalog handler.

The reported 6.2-second development homepage request included a `compile-path` trace of 4847.3 ms. Warm development rendering also has overhead unrelated to database reads; caching does not eliminate the first compilation.

An isolated production build on local port 3001, using the real database, returned:

| Request | First request | Subsequent requests |
| --- | ---: | ---: |
| Homepage | 587 ms | 63 / 45 ms |
| Store directory | 185 ms | 29 / 30 ms |
| Products API after homepage warmed its snapshot | 14 ms | 6 / 7 ms |

The API returned 32 products and reported cache hits with 0.0–0.1 ms handler time. The homepage response contained real catalog product names. Anonymous admin/merchant shells also returned HTTP 200. The sandboxed trial process could not reach Supabase (`EACCES`) and those failed-request timings were excluded; the successful measurements used a network-enabled test process. Both temporary servers were cleaned up, preserving the user's development server on port 3000.

Validation: all 437 repository tests pass, including worker snapshot reuse across development module reloads and refresh of reader implementations. TypeScript, full-source lint and the production build pass. The separate CSS-format check reports pre-existing formatting differences in `homepage-marketplace.css` and `marketplace.css`; these stylesheets were left unchanged.
