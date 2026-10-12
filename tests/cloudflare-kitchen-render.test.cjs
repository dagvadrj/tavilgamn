const { test } = require("node:test");
const assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const sharp = require("sharp");
const { loadSource } = require("./helpers/load-source.cjs");
const jobId = "32345678-1234-4234-8234-123456789abc";
const model = "@cf/black-forest-labs/flux-2-klein-4b";
const worker = import(pathToFileURL(path.resolve("workers/kitchen-render/worker.mjs")));

async function withEnvironment(values, run) {
  const previous = Object.fromEntries(Object.keys(values).map(key => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(values)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
    return await run();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key]; else process.env[key] = value;
    }
  }
}

test("Cloudflare config never silently falls back to a paid provider", async () => {
  const config = loadSource("src/lib/kitchenRenderConfig.ts");
  await withEnvironment({ KITCHEN_RENDER_PROVIDER: "cloudflare", CLOUDFLARE_RENDER_URL: "https://test.workers.dev/render", CLOUDFLARE_RENDER_TOKEN: "test", CLOUDFLARE_RENDER_FREE_CONFIRMED: "false" }, async () => {
    assert.deepEqual(config.configuredKitchenRender(), { provider: "cloudflare", model });
    assert.equal(config.kitchenRenderConfigured(config.configuredKitchenRender()), false);
    process.env.CLOUDFLARE_RENDER_FREE_CONFIRMED = "true";
    assert.equal(config.kitchenRenderConfigured(config.configuredKitchenRender()), true);
    process.env.CLOUDFLARE_RENDER_URL = "https://attacker.example/render";
    assert.equal(config.kitchenRenderConfigured(config.configuredKitchenRender()), false);
    process.env.KITCHEN_RENDER_PROVIDER = "typo";
    assert.throws(config.configuredKitchenRender, /INVALID_RENDER_PROVIDER/);
  });
});

test("Worker rejects unauthorized and disabled requests before any inference", async () => {
  const { default: handler } = await worker;
  let calls = 0;
  const env = { RENDER_TOKEN: "test-token", RENDER_ENABLED: "false", AI: { run: async () => { calls++; } } };
  const unauthorized = await handler.fetch(new Request("https://test/render", { method: "POST" }), env);
  assert.equal(unauthorized.status, 401);
  const disabled = await handler.fetch(new Request("https://test/render", { method: "POST", headers: { authorization: "Bearer test-token" } }), env);
  assert.equal(disabled.status, 503);
  const health = await handler.fetch(new Request("https://test/health", { headers: { authorization: "Bearer test-token" } }), env);
  assert.deepEqual(await health.json(), { provider: "cloudflare", model, enabled: false, configured: true, textModel: "@cf/google/gemma-4-26b-a4b-it", textConfigured: false });
  assert.equal(calls, 0);
});

test("Worker forwards one reference, fixed dimensions, and no caller model overrides", async () => {
  const { default: handler } = await worker;
  const form = new FormData();
  form.set("prompt", "Preserve this kitchen layout and add realistic lighting.");
  form.set("jobId", jobId);
  form.set("input_image_0", new Blob(["reference"], { type: "image/jpeg" }), "ref.jpg");
  form.set("model", "expensive-model");
  let calls = 0;
  const env = { RENDER_TOKEN: "token", RENDER_ENABLED: "true", AI: { run: async (name, input) => {
    calls++;
    assert.equal(name, model);
    const actual = await new Response(input.multipart.body, { headers: { "content-type": input.multipart.contentType } }).formData();
    assert.equal(actual.get("width"), "1024");
    assert.equal(actual.get("height"), "768");
    assert.equal(actual.get("model"), null);
    assert.equal(await actual.get("input_image_0").text(), "reference");
    return { image: "aW1hZ2U=" };
  } } };
  const response = await handler.fetch(new Request("https://test/render", { method: "POST", headers: { authorization: "Bearer token" }, body: form }), env);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { image: "aW1hZ2U=" });
  assert.ok(response.headers.get("x-render-request-id"));
  assert.equal(calls, 1);
});

test("Worker bounds request size and maps free quota exhaustion to 429", async () => {
  const { default: handler } = await worker;
  let calls = 0;
  const env = { RENDER_TOKEN: "token", RENDER_ENABLED: "true", AI: { run: async () => { calls++; throw new Error("3036 daily free quota exhausted"); } } };
  const oversized = await handler.fetch(new Request("https://test/render", { method: "POST", headers: { authorization: "Bearer token" }, body: "x".repeat(2 * 1024 * 1024 + 1) }), env);
  assert.equal(oversized.status, 413);
  assert.equal(calls, 0);
  const form = new FormData();
  form.set("prompt", "A realistic photograph of this exact kitchen layout.");
  form.set("jobId", jobId);
  form.set("input_image_0", new Blob(["reference"], { type: "image/jpeg" }), "ref.jpg");
  const response = await handler.fetch(new Request("https://test/render", { method: "POST", headers: { authorization: "Bearer token" }, body: form }), env);
  assert.equal(response.status, 429);
  assert.equal(calls, 1);
});

test("Server resizes the reference below 512px and converts the generated image to WebP", async () => {
  const reference = await sharp({ create: { width: 1200, height: 800, channels: 3, background: "white" } }).png().toBuffer();
  const output = await sharp({ create: { width: 1024, height: 768, channels: 3, background: "tan" } }).png().toBuffer();
  const { generateCloudflareKitchenRender } = loadSource("src/lib/cloudflareKitchenRender.ts", { sharp: { default: sharp } });
  const originalFetch = global.fetch;
  try {
    await withEnvironment({ CLOUDFLARE_RENDER_URL: "https://test.workers.dev/render", CLOUDFLARE_RENDER_TOKEN: "token", CLOUDFLARE_RENDER_FREE_CONFIRMED: "true" }, async () => {
      global.fetch = async (url, options) => {
        assert.equal(String(url), "https://test.workers.dev/render");
        assert.equal(options.headers.Authorization, "Bearer token");
        assert.equal(options.redirect, "error");
        const actual = options.body.get("input_image_0");
        const size = await sharp(Buffer.from(await actual.arrayBuffer())).metadata();
        assert.ok(size.width < 512 && size.height < 512);
        assert.equal(actual.type, "image/jpeg");
        assert.equal(options.body.get("jobId"), jobId);
        return Response.json({ image: output.toString("base64") }, { headers: { "x-render-request-id": "cf-test" } });
      };
      const generated = await generateCloudflareKitchenRender(new Blob([reference], { type: "image/png" }), "Preserve the kitchen geometry and render a photo.", jobId);
      assert.equal(generated.requestId, "cf-test");
      assert.equal(generated.image.type, "image/webp");
      const actual = await sharp(Buffer.from(await generated.image.arrayBuffer())).metadata();
      assert.equal(actual.format, "webp");
      assert.equal(actual.width, 1024);
    });
  } finally { global.fetch = originalFetch; }
});

test("Admin switches a claimed legacy job to Cloudflare and records actual provider metadata", async () => {
  const calls = [];
  const updates = [];
  const route = loadSource("src/app/api/admin/kitchen-render-jobs/[id]/generate/route.ts", {
    "@/lib/supabase/requireAdmin": { requireAdmin: async () => ({ userId: "admin" }) },
    "@/lib/supabase/admin": { getSupabaseAdmin: () => ({
      rpc: async (name, args) => { calls.push([name, args]); return { data: name === "claim_kitchen_render" ? { id: jobId, inputImageUrl: "https://res.cloudinary.com/demo/source.png", prompt: "Preserve this exact kitchen design and make it photorealistic.", provider: "openai", model: "gpt-image-2.5-sunburst" } : "media", error: null }; },
      from: table => { assert.equal(table, "kitchen_render_jobs"); const chain = { update: value => { updates.push(value); return chain; }, eq: () => chain, then: resolve => resolve({ error: null }) }; return chain; },
    }) },
    "@/lib/cloudinaryImageUpload": { cloudinaryImageUploadConfigured: () => true, uploadCloudinaryImage: async () => ({ url: "https://res.cloudinary.com/demo/result.webp", publicId: "render", width: 1024, height: 768, format: "webp", bytes: 10 }) },
    "@/lib/cloudflareKitchenRender": { limitedResponseBytes: async () => Buffer.from("source"), generateCloudflareKitchenRender: async () => ({ image: new Blob(["result"], { type: "image/webp" }), requestId: "cf-test" }) },
  });
  const originalFetch = global.fetch;
  try {
    await withEnvironment({ CLOUDFLARE_RENDER_URL: "https://test.workers.dev/render", CLOUDFLARE_RENDER_TOKEN: "token", CLOUDFLARE_RENDER_FREE_CONFIRMED: "true" }, async () => {
      global.fetch = async () => new Response("source", { headers: { "content-type": "image/png" } });
      const response = await route.POST({ json: async () => ({ approveCost: true, provider: "cloudflare" }) }, { params: Promise.resolve({ id: jobId }) });
      assert.equal(response.status, 200);
      assert.deepEqual(updates, [{ provider: "cloudflare", model }]);
      assert.deepEqual(calls.map(([name]) => name), ["claim_kitchen_render", "complete_kitchen_render"]);
      assert.equal(calls[1][1].p_metadata.provider, "cloudflare");
      assert.equal(calls[1][1].p_metadata.requestedProvider, "openai");
      assert.equal(calls[1][1].p_metadata.providerRequestId, "cf-test");
    });
  } finally { global.fetch = originalFetch; }
});

test("Missing free confirmation cannot claim a Cloudflare job", async () => {
  const route = loadSource("src/app/api/admin/kitchen-render-jobs/[id]/generate/route.ts", {
    "@/lib/supabase/requireAdmin": { requireAdmin: async () => ({ userId: "admin" }) },
    "@/lib/supabase/admin": { getSupabaseAdmin: () => { throw new Error("Must not claim a job"); } },
    "@/lib/cloudinaryImageUpload": { cloudinaryImageUploadConfigured: () => true },
  });
  await withEnvironment({ CLOUDFLARE_RENDER_FREE_CONFIRMED: "false" }, async () => {
    const response = await route.POST({ json: async () => ({ approveCost: true, provider: "cloudflare" }) }, { params: Promise.resolve({ id: jobId }) });
    assert.equal(response.status, 503);
  });
});
