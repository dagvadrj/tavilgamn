const { test } = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { NextRequest } = require("next/server");
const { loadSource } = require("./helpers/load-source.cjs");
const { pathToFileURL } = require("node:url");
const path = require("node:path");
const listing = loadSource("src/lib/kitchenListingSuggestions.ts");
const { createUnifiedKitchen } = loadSource("src/lib/kitchenAssembly.ts");
const { createRefrigerator } = loadSource("src/lib/kitchenCabinets.ts");
const id = "12345678-1234-4234-8234-123456789abc";
const actor = "22345678-1234-4234-8234-123456789abc";

test("BOM defaults use the selected snapshot and split physical appliances without double counting", () => {
  const kitchen = createUnifiedKitchen();
  const baseline = listing.kitchenListingSuggestions(
    kitchen,
    "Oak kitchen",
    "modern",
  );
  assert.ok(baseline.inclusions.some((x) => x.includes("шүүгээ")));
  assert.ok(baseline.inclusions.some((x) => x.includes("Тавцан")));
  assert.equal(baseline.widthMm, kitchen.room.width);
  const fridge = createRefrigerator("fridge");
  fridge.position.x = 3500;
  fridge.position.z = 2000;
  kitchen.cabinets.push(fridge);
  const next = listing.kitchenListingSuggestions(kitchen, "Oak kitchen");
  assert.ok(next);
  assert.equal(
    next.exclusions.find((x) => x.startsWith("Хөргөгч")),
    "Хөргөгч · 1 ш",
  );
  assert.ok(!next.inclusions.some((x) => x.includes("Хөргөгч")));
  assert.equal(listing.kitchenListingSuggestions({ bad: true }), null);
  assert.equal(
    listing.kitchenListingSuggestions(kitchen).cabinetCount,
    baseline.cabinetCount,
  );
});

test("tags normalize custom text, duplicates and hashes and work in real kitchen search", () => {
  assert.deepEqual(listing.kitchenListTokens(" #Царс, царс\nМОДЕРН, модерн"), [
    "Царс",
    "МОДЕРН",
  ]);
  const design = {
    title: "Загвар",
    shortDescription: "",
    description: "",
    tags: ["өөрийн-tag"],
    materials: ["Царс"],
    storeName: "Factory",
    style: "modern",
    layout: "l-right",
  };
  assert.equal(
    listing.kitchenDesignMatchesSearch(design, " #ӨӨРИЙН-tag "),
    true,
  );
  assert.equal(listing.kitchenDesignMatchesSearch(design, "модерн царс"), true);
  assert.equal(listing.kitchenDesignMatchesSearch(design, "unknown"), false);
});

test("shared listing fields have AI proposals, removable chips, suggestions and no warranty input", () => {
  const { KitchenListingFields } = loadSource(
    "src/components/KitchenListingFields.tsx",
    {
      "@/lib/authFetch": {
        authFetch: async () => {
          throw Error("SSR must not generate");
        },
      },
    },
  );
  const form = {
    title: "Kitchen",
    shortDescription: "",
    description: "",
    style: "modern",
    pricingMode: "quote",
    priceFrom: "",
    priceTo: "",
    materials: "Царс",
    leadTimeDays: "",
    warrantyMonths: "",
    installationIncluded: false,
    tags: "custom-tag",
    serviceAreas: "Улаанбаатар",
    inclusions: "",
    exclusions: "",
  };
  const markup = renderToStaticMarkup(
    React.createElement(KitchenListingFields, {
      form,
      field: () => {},
      suggestions: listing.kitchenListingSuggestions(
        createUnifiedKitchen(),
        "Kitchen",
      ),
      owner: actor,
      source: { sourceKitchenId: id },
    }),
  );
  assert.equal((markup.match(/AI-аар үүсгэх/g) || []).length, 3);
  assert.match(markup, /custom-tag хасах/);
  assert.match(markup, /Улаанбаатар хасах/);
  assert.match(markup, /Enter/);
  assert.doesNotMatch(markup, /Баталгаа \(сар\)|warranty.*input/);
  assert.doesNotMatch(markup, />Үнэ \(₮\)/);
});

test("text Worker uses Google Gemma with bounded output and merchant rate limit", async () => {
  const { default: worker } = await import(
    pathToFileURL(path.resolve("workers/kitchen-render/worker.mjs"))
  );
  const calls = [];
  const keys = [];
  const env = {
    RENDER_TOKEN: "secret",
    RENDER_ENABLED: "true",
    TEXT_LIMITER: {
      limit: async ({ key }) => {
        keys.push(key);
        return { success: true };
      },
    },
    AI: {
      run: async (model, input) => {
        calls.push({ model, input });
        return {
          choices: [
            {
              message: {
                content:
                  "Kitchen\n\nМодерн гал тогоо. Өрөөний хэмжээнд тохируулна. Илүү урт тайлбар.",
              },
            },
          ],
        };
      },
    },
  };
  const request = (body, token = "secret") =>
    new Request("https://test/text", {
      method: "POST",
      headers: { authorization: "Bearer " + token },
      body: JSON.stringify(body),
    });
  const body = {
    actor,
    field: "shortDescription",
    facts: { title: "Kitchen" },
    model: "paid-other-model",
  };
  const result = await worker.fetch(request(body), env);
  assert.equal(result.status, 200);
  const output = await result.json();
  assert.equal(output.model, "@cf/google/gemma-4-26b-a4b-it");
  assert.equal(output.text, "Модерн гал тогоо. Өрөөний хэмжээнд тохируулна.");
  assert.deepEqual(keys, ["merchant:" + actor]);
  assert.equal(calls[0].input.max_completion_tokens, 240);
  assert.equal(calls[0].input.chat_template_kwargs.enable_thinking, false);
  assert.equal((await worker.fetch(request(body, "wrong"), env)).status, 401);
  assert.equal(
    (await worker.fetch(request({ ...body, field: "warrantyMonths" }), env))
      .status,
    400,
  );
  env.TEXT_LIMITER.limit = async () => ({ success: false });
  assert.equal((await worker.fetch(request(body), env)).status, 429);
  assert.equal(calls.length, 1);
});

function textRoute({ owned = true, eligible = true } = {}) {
  const calls = [];
  let generated = 0;
  const db = {
    from(table) {
      const chain = {
        select: () => chain,
        eq: (...args) => {
          calls.push([table, ...args]);
          return chain;
        },
        in: () => chain,
        maybeSingle: async () => ({
          data:
            table === "merchant_stores"
              ? eligible
                ? { id: "store" }
                : null
              : table === "kitchen_garnitures"
                ? owned
                  ? { name: "Saved", design: createUnifiedKitchen() }
                  : null
                : null,
          error: null,
        }),
      };
      return chain;
    },
  };
  const route = loadSource(
    "src/app/api/merchant/kitchen-designs/suggest/route.ts",
    {
      "@/lib/supabase/requireMerchant": {
        requireMerchant: async () => ({ userId: actor }),
      },
      "@/lib/supabase/admin": { getSupabaseAdmin: () => db },
      "@/lib/cloudflareKitchenText": {
        KITCHEN_TEXT_FIELDS: ["title", "shortDescription", "description"],
        kitchenTextConfigured: () => true,
        generateKitchenListingText: async (verifiedActor, field, facts) => {
          assert.equal(verifiedActor, actor);
          assert.equal(facts.widthMm, 4000);
          generated++;
          return { text: "Модерн гал тогоо", model: "Gemma" };
        },
      },
    },
  );
  return { route, calls, generated: () => generated };
}
const request = (body) =>
  new NextRequest("http://localhost/api/merchant/kitchen-designs/suggest", {
    method: "POST",
    body: JSON.stringify(body),
  });
test("text API scopes the selected project to the verified merchant and does not publish", async () => {
  const { route, calls, generated } = textRoute();
  const result = await route.POST(
    request({
      sourceKitchenId: id,
      field: "shortDescription",
      actor: "forged",
      title: "Kitchen",
      materials: ["Царс"],
    }),
  );
  assert.equal(result.status, 200);
  assert.equal(generated(), 1);
  assert.ok(
    calls.some(
      ([table, key, value]) =>
        table === "kitchen_garnitures" && key === "user_id" && value === actor,
    ),
  );
  assert.equal(result.headers.get("Cache-Control"), "private, no-store");
});
test("text API rejects nonowned projects, ineligible stores and malformed fields before inference", async () => {
  for (const opts of [{ owned: false }, { eligible: false }]) {
    const check = textRoute(opts);
    assert.equal(
      (await check.route.POST(request({ sourceKitchenId: id, field: "title" })))
        .status,
      opts.owned === false ? 404 : 403,
    );
    assert.equal(check.generated(), 0);
  }
  const invalid = textRoute();
  assert.equal(
    (
      await invalid.route.POST(
        request({ sourceKitchenId: id, field: "warrantyMonths" }),
      )
    ).status,
    400,
  );
  assert.equal(invalid.calls.length, 0);
  assert.equal(
    (
      await invalid.route.POST(
        request({
          sourceKitchenId: id,
          field: "title",
          title: "a".repeat(17000),
        }),
      )
    ).status,
    400,
  );
  assert.equal(invalid.calls.length, 0);
});
test("public tag search returns only public search fields", async () => {
  const source = {
    id: "design",
    slug: "my-kitchen",
    title: "Kitchen",
    storeName: "Factory",
    thumbnailUrl: null,
    tags: ["custom-tag"],
    materials: [],
    shortDescription: "",
    description: "",
    style: "modern",
    layout: "straight",
    sourceKitchenId: "private-id",
    renderJobs: ["private-prompt"],
  };
  const route = loadSource("src/app/api/kitchen-designs/search/route.ts", {
    "@/lib/kitchenMarketplaceServer": {
      readPublishedKitchenDesigns: async () => [source],
    },
  });
  const result = await route.GET(
    new NextRequest("http://localhost/api/kitchen-designs/search?q=custom-tag"),
  );
  const json = await result.json();
  assert.equal(json.total, 1);
  assert.deepEqual(Object.keys(json.designs[0]).sort(), [
    "id",
    "slug",
    "storeName",
    "tags",
    "thumbnailUrl",
    "title",
  ]);
  assert.equal(
    (
      await route.GET(
        new NextRequest(
          "http://localhost/api/kitchen-designs/search?q=" + "a".repeat(121),
        ),
      )
    ).status,
    400,
  );
});
