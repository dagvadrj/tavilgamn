# Kitchen render bridge

The same authenticated bridge also serves `POST /text` for merchant listing
titles, short descriptions and descriptions, using `@cf/google/gemma-4-26b-a4b-it`.
EmbeddingGemma 2 creates embeddings and cannot generate this copy. Next.js verifies
the merchant, store ownership and selected kitchen/version before sending bounded
BOM facts. Generated copy is shown as a proposal; applying it does not publish or
save the listing. The rate-limit binding permits five requests per merchant per
minute at each Cloudflare location. Text and images share Workers Free's daily AI
allocation; quota exhaustion returns an error with no paid fallback.

Worker uploads must retain the `RENDER_TOKEN` secret and include both `AI` and
`TEXT_LIMITER` bindings from `wrangler.jsonc`. The text route uses the same endpoint
host, shared secret and free-plan confirmation as rendering; no additional
application environment variables are needed.

The Next.js admin calls this authenticated Worker, which invokes Workers AI with
`@cf/black-forest-labs/flux-2-klein-4b`. No account-wide Cloudflare API token is
needed by the application. `RENDER_TOKEN` is a Worker secret and
`CLOUDFLARE_RENDER_TOKEN` is its server-only counterpart in Next.js.

The bridge accepts one JPEG reference, a prompt and a render job UUID at
`POST /render`. The application resizes references to at most 510 × 510 pixels;
the Worker fixes output to 1024 × 768 and ignores caller-specified models or sizes.
Generated images are converted to WebP, uploaded to Cloudinary, and attached to
the existing immutable kitchen version through the guarded render RPCs.

`GET /health` also requires the shared token and performs no inference.
Keep `RENDER_ENABLED=false` and `CLOUDFLARE_RENDER_FREE_CONFIRMED=false` until the
account is confirmed to use Workers Free. The connector may not have billing
read permissions; `default_usage_model=standard` alone does not prove the plan.
Workers Free stops inference when its shared daily free allocation is exhausted.
Workers Paid can charge for overages, so this bridge must not be presented as
guaranteed free on a Paid account. Reconfirm these flags if the account changes plan.

Next.js environment:

```dotenv
KITCHEN_RENDER_PROVIDER=cloudflare
CLOUDFLARE_RENDER_URL=https://tavilgamn-kitchen-render.<subdomain>.workers.dev/render
CLOUDFLARE_RENDER_TOKEN=<same value as the Worker secret RENDER_TOKEN>
CLOUDFLARE_RENDER_FREE_CONFIRMED=false
```

New merchant requests use the configured provider. Admin generation explicitly
selects that provider; switching a previously queued OpenAI request records its
actual provider/model after the exclusive claim and keeps the originally
requested provider/model in completion metadata. Merchant consent, daily store
quota, admin authorization and explicit approval remain required. No paid
fallback or automatic retry is used.

Cloudflare references:
- https://developers.cloudflare.com/changelog/post/2026-01-15-flux-2-klein-4b-workers-ai/
- https://developers.cloudflare.com/workers-ai/platform/pricing/

The source/config can be deployed using the connected Cloudflare plugin's Worker
upload, secret and subdomain APIs. Never include the token in source or config.

Current setup (2026-10-12): the owner confirmed Workers Free. The deployed Worker
and local server are enabled. An authenticated health request returned 200;
unauthenticated requests returned 401. A real kitchen reference generated a
1024 × 768 WebP in 8 seconds, saved locally as `.tools/cloudflare-render-preview.webp`.
No queued render job existed during the trial, so the preview was generated from
an existing kitchen gallery image without changing a marketplace version.
