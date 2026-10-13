const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { loadSource } = require("./helpers/load-source.cjs");
const { kitchenGalleryMedia, kitchenRenderSources, kitchenRenderSource } = loadSource("src/lib/kitchenDesignMedia.ts");
const original = { id: "original", kind: "thumbnail", source: "system", url: "https://example.com/original.png", altText: "Original", isPrimary: true, createdAt: "2026-10-01" };
const older = { ...original, id: "older", kind: "ai_render", source: "ai", isPrimary: false, url: "https://example.com/older.webp", createdAt: "2026-10-02" };
const latest = { ...older, id: "latest", url: "https://example.com/latest.webp", createdAt: "2026-10-03" };

test("AI requests use the selected uploaded photo without replacing the primary thumbnail", () => {
  const photo = { ...original, id: "photo", kind: "photo", source: "merchant", isPrimary: false, url: "https://example.com/photo.png" };
  const media = [original, latest, photo];
  assert.deepEqual(kitchenRenderSources(media).map(item => item.id), ["original", "photo"]);
  assert.equal(kitchenRenderSource(media), original);
  assert.equal(kitchenRenderSource(media, photo.id), photo);
  assert.equal(kitchenRenderSource(media, latest.id), original);
  assert.equal(kitchenRenderSource(media, "deleted-or-foreign-id"), original);
  assert.equal(kitchenRenderSource([photo], photo.id), photo);
  assert.equal(kitchenRenderSource([latest]), null);
  assert.equal(kitchenRenderSource([]), null);
  assert.equal(original.isPrimary, true);
});

test("gallery defaults to newest AI render and retains the original planner input", () => {
  const input = [original, older, latest];
  assert.deepEqual(kitchenGalleryMedia(input).map(item => item.id), ["latest", "older", "original"]);
  assert.deepEqual(input.map(item => item.id), ["original", "older", "latest"]);
  assert.equal(input.find(item => item.kind === "thumbnail" && item.isPrimary), original);
  assert.deepEqual(kitchenGalleryMedia([original]), [original]);
  assert.deepEqual(kitchenGalleryMedia([]), []);
});

test("gallery handles missing dates and recognizes AI source on legacy media", () => {
  const undated = { ...older, createdAt: undefined };
  const legacy = { ...older, id: "legacy", kind: "render" };
  assert.equal(kitchenGalleryMedia([original, undated, latest])[0], latest);
  assert.equal(kitchenGalleryMedia([original, legacy])[0], legacy);
});

test("gallery renders AI first with selectable originals and safe empty state", () => {
  const { KitchenDesignGallery } = loadSource("src/components/KitchenDesignGallery.tsx", {
    "next/image": { default: ({ src, alt, className }) => React.createElement("img", { src, alt, className }) },
  });
  const markup = renderToStaticMarkup(React.createElement(KitchenDesignGallery, { media: [original, older, latest], title: "Kitchen" }));
  assert.match(markup, /src="https:\/\/example.com\/latest.webp" alt="Original" class="kd-gallery-image"/);
  assert.match(markup, /aria-pressed="true"/);
  assert.match(markup, /3D загвар/);
  assert.match(markup, /AI бодит дүрслэл/);
  const empty = renderToStaticMarkup(React.createElement(KitchenDesignGallery, { media: [], title: "Kitchen" }));
  assert.match(empty, /Зураг хараахан нэмэгдээгүй/);
  assert.doesNotMatch(empty, /<img/);
});

test("public detail uses only ready media from the approved published version for its cover", async () => {
  const calls = [];
  const rows = {
    kitchen_designs: { id: "design", store_id: "store", slug: "test-kitchen", publication_status: "published", published_version_id: "published-version" },
    kitchen_design_versions: { id: "published-version", design_id: "design", title: "Kitchen", review_status: "approved", materials: [], tags: [] },
    merchant_stores: { id: "store", name: "Factory", owner_id: "merchant" },
    profiles: { id: "merchant" },
    kitchen_design_media: [original, older, latest].map(item => ({ ...item, version_id: "published-version", alt_text: item.altText, is_primary: item.isPrimary, created_at: item.createdAt })),
  };
  const db = { from(table) {
    const chain = { select: () => chain, order: () => chain,
      eq: (...args) => { calls.push([table, "eq", ...args]); return chain; },
      in: (...args) => { calls.push([table, "in", ...args]); return chain; },
      maybeSingle: async () => ({ data: rows[table], error: null }),
      then: (resolve, reject) => Promise.resolve({ data: rows[table], error: null }).then(resolve, reject),
    }; return chain;
  } };
  const { readPublishedKitchenDesignBySlug } = loadSource("src/lib/kitchenMarketplaceServer.ts", { "./supabase/admin": { getSupabaseAdmin: () => db } });
  const result = await readPublishedKitchenDesignBySlug("test-kitchen", db);
  assert.equal(result.thumbnailUrl, latest.url);
  assert.equal(result.media.find(item => item.id === "original").isPrimary, true);
  assert.deepEqual(calls.find(([table, op, key]) => table === "kitchen_design_media" && op === "in" && key === "version_id"), ["kitchen_design_media", "in", "version_id", ["published-version"]]);
  assert.ok(calls.some(([table, op, key, value]) => table === "kitchen_design_media" && op === "eq" && key === "status" && value === "ready"));
  assert.ok(calls.some(([table, op, key, value]) => table === "kitchen_design_versions" && op === "eq" && key === "review_status" && value === "approved"));
  assert.deepEqual(result.renderJobs, []);
});
