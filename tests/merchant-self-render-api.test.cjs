const { test } = require("node:test");
const assert = require("node:assert/strict");
const { NextRequest, NextResponse } = require("next/server");
const { loadSource } = require("./helpers/load-source.cjs");
const design = "12345678-1234-4234-8234-123456789abc",
  actor = "22345678-1234-4234-8234-123456789abc",
  media = "32345678-1234-4234-8234-123456789abc",
  job = "42345678-1234-4234-8234-123456789abc";
const body = {
  versionId: design,
  sourceMediaId: media,
  consent: true,
  direction: "Natural light",
  actor: design,
  provider: "openai",
  approveCost: false,
};
function fixture({
  configured = true,
  auth = { userId: actor },
  rpcError = null,
  generationError = null,
} = {}) {
  const calls = [];
  const config = {
    provider: "cloudflare",
    model: "@cf/black-forest-labs/flux-2-klein-4b",
  };
  const route = loadSource(
    "src/app/api/merchant/kitchen-designs/[id]/renders/route.ts",
    {
      "@/lib/supabase/requireMerchant": { requireMerchant: async () => auth },
      "@/lib/kitchenRenderConfig": {
        CLOUDFLARE_RENDER_MODEL: config.model,
        kitchenRenderConfigured: () => configured,
      },
      "@/lib/cloudinaryImageUpload": {
        cloudinaryImageUploadConfigured: () => configured,
      },
      "@/lib/supabase/admin": {
        getSupabaseAdmin: () => ({
          rpc: async (name, args) => {
            calls.push({ name, args });
            return { data: job, error: rpcError };
          },
        }),
      },
      "@/lib/generateKitchenRender": {
        generateKitchenRender: async (...args) => {
          calls.push({ name: "generate", args });
          if (generationError) throw generationError;
          return {
            id: job,
            status: "completed",
            mediaId: media,
            url: "https://res.cloudinary.com/demo/output.webp",
          };
        },
      },
    },
  );
  return {
    calls,
    config,
    post: (payload = body, id = design) =>
      route.POST(
        new NextRequest(
          `http://localhost/api/merchant/kitchen-designs/${id}/renders`,
          { method: "POST", body: JSON.stringify(payload) },
        ),
        { params: Promise.resolve({ id }) },
      ),
  };
}
test("merchant renders immediately with verified identity, exact source and fixed free Cloudflare provider", async () => {
  const { calls, config, post } = fixture();
  const response = await post();
  assert.equal(response.status, 201);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal((await response.json()).status, "completed");
  assert.equal(calls.length, 2);
  assert.equal(calls[0].name, "request_kitchen_render");
  assert.equal(calls[0].args.p_actor, actor);
  assert.equal(calls[0].args.p_source_media, media);
  assert.equal(calls[0].args.p_provider, "cloudflare");
  assert.equal(calls[0].args.p_model, config.model);
  assert.deepEqual(calls[1].args, [actor, job, config]);
});
test("configuration, consent, authentication and quota failures never invoke image generation", async () => {
  for (const [options, payload, expected] of [
    [{ configured: false }, body, 503],
    [{}, { ...body, consent: false }, 400],
    [
      {
        auth: {
          error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        },
      },
      body,
      401,
    ],
    [{ rpcError: { code: "P0019" } }, body, 429],
  ]) {
    const { post, calls } = fixture(options);
    assert.equal((await post(payload)).status, expected);
    assert.ok(calls.every((call) => call.name !== "generate"));
    assert.equal(calls.length, expected === 429 ? 1 : 0);
  }
});
test("free provider quota exhaustion returns retryable 429 without a paid fallback", async () => {
  const { post, calls } = fixture({
    generationError: new Error("CLOUDFLARE_RENDER_QUOTA"),
  });
  assert.equal((await post()).status, 429);
  assert.equal(calls.length, 2);
  assert.equal(calls[1].args[2].provider, "cloudflare");
});

test("generation failures release a claimed render and preserve verified merchant identity", async () => {
  const calls = [];
  const failure = new Error("CLOUDFLARE_RENDER_QUOTA");
  const { generateKitchenRender } = loadSource(
    "src/lib/generateKitchenRender.ts",
    {
      "@/lib/kitchenRenderConfig": {
        validKitchenRender: () => true,
        kitchenRenderConfigured: () => true,
      },
      "@/lib/supabase/admin": {
        getSupabaseAdmin: () => ({
          rpc: async (name, args) => {
            calls.push({ name, args });
            return {
              data:
                name === "claim_kitchen_render"
                  ? {
                      provider: "cloudflare",
                      model: "test",
                      inputImageUrl:
                        "https://res.cloudinary.com/demo/source.png",
                      prompt: "Preserve kitchen",
                    }
                  : null,
              error: null,
            };
          },
        }),
      },
      "@/lib/cloudflareKitchenRender": {
        limitedResponseBytes: async () => Buffer.from("source"),
        generateCloudflareKitchenRender: async () => {
          throw failure;
        },
      },
      "@/lib/cloudinaryImageUpload": {
        uploadCloudinaryImage: async () => {
          throw Error("Must not upload failed output");
        },
      },
    },
  );
  const original = global.fetch;
  try {
    global.fetch = async () =>
      new Response("source", { headers: { "content-type": "image/png" } });
    await assert.rejects(generateKitchenRender(actor, job), failure);
    assert.deepEqual(
      calls.map((c) => c.name),
      ["claim_kitchen_render", "fail_kitchen_render"],
    );
    assert.equal(calls[1].args.p_actor, actor);
    assert.equal(calls[1].args.p_job, job);
    assert.equal(calls[1].args.p_error, failure.message);
  } finally {
    global.fetch = original;
  }
});
