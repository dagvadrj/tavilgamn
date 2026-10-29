const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { loadSource } = require("../../tests/helpers/load-source.cjs");
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  ({ chromium } = require(
    path.join(
      require("node:os").homedir(),
      ".cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
    ),
  ));
}
const { createModularKitchen } = loadSource("src/lib/kitchenCabinets.ts");
const { parseKitchen } = loadSource("src/lib/kitchenAssembly.ts");
const url = process.env.KITCHEN_QA_URL || "http://127.0.0.1:3017";
const output = path.resolve("docs/qa/kitchen-planning-features");
const draftKey = "tavilga-kitchen-draft-guest";
async function saved(page, check) {
  await page.waitForFunction(
    ({ key, source }) => {
      const data = JSON.parse(localStorage.getItem(key) || "{}").design;
      return data && (0, eval)(`(${source})`)(data);
    },
    { key: draftKey, source: check.toString() },
    { timeout: 20000 },
  );
  return page.evaluate(
    (key) => JSON.parse(localStorage.getItem(key)).design,
    draftKey,
  );
}
(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    channel: "chrome",
    headless: true,
    args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
  });
  const errors = [];
  try {
    const context = await browser.newContext({
      viewport: { width: 1440, height: 1000 },
    });
    const page = await context.newPage();
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/kitchen-modules", (r) =>
      r.fulfill({ json: { modules: [], assets: [], materials: [] } }),
    );
    await page.route("**/api/products*", (r) =>
      r.fulfill({ json: { products: [] } }),
    );
    await page.route("**/api/models", (r) =>
      r.fulfill({ json: { models: [] } }),
    );
    const kitchen = createModularKitchen();
    kitchen.room = { width: 5000, depth: 4000, height: 2600 };
    await page.addInitScript(
      ({ kitchen, draftKey }) => {
        if (!localStorage.getItem(draftKey))
          localStorage.setItem(
            draftKey,
            JSON.stringify({
              design: kitchen,
              name: "Булан, гэрэл, арал",
              flowStage: "design",
            }),
          );
        localStorage.setItem("tavilga:planner-tour:kitchen:v1", "done");
      },
      { kitchen, draftKey },
    );
    await page.goto(`${url}/kitchen`, {
      waitUntil: "domcontentloaded",
      timeout: 90000,
    });
    const tool = (name) => page.getByRole("button", { name, exact: true });
    await tool("Булан").click({ timeout: 90000 });
    await page.locator("canvas").waitFor({ timeout: 90000 });
    await page
      .getByRole("button", { name: "Баруун булан ┐", exact: true })
      .click();
    await page.screenshot({ path: path.join(output, "corner-desktop.png") });
    await tool("Энэ буланг байрлуулах").click();
    await saved(page, (k) => k.cornerPlan?.side === "right");
    await tool("Шугаман гэрэл").click();
    await page.getByLabel("Дээд шүүгээний доорх гэрэл").check();
    await page.getByLabel("Доод шүүгээний хөлийн гэрэл").check();
    await page.getByLabel("Гэрлийн өнгө").selectOption("neutral");
    await saved(
      page,
      (k) =>
        k.lineLighting?.underCabinet &&
        k.lineLighting?.plinth &&
        k.lineLighting?.tone === "neutral",
    );
    await page.screenshot({ path: path.join(output, "lighting-desktop.png") });
    await tool("Тек / Арал").click();
    await tool("Арал нэмэх").click();
    await saved(page, (k) =>
      k.extras?.some((e) => e.planningFurniture === "island"),
    );
    await tool("Буцаах").click();
    await saved(page, (k) => !k.extras?.length);
    await tool("Дахин хийх").click();
    await saved(page, (k) =>
      k.extras?.some((e) => e.planningFurniture === "island"),
    );
    await tool("Тек / Арал").click();
    await tool("Тек · суух зайтай").click();
    await tool("Тек нэмэх").click();
    const final = await saved(page, (k) => k.extras?.length === 2);
    parseKitchen(final);
    await page.screenshot({
      path: path.join(output, "island-bar-desktop.png"),
    });
    await page.reload({ waitUntil: "domcontentloaded" });
    await tool("Шугаман гэрэл").click();
    assert.equal(
      await page.getByLabel("Дээд шүүгээний доорх гэрэл").isChecked(),
      true,
    );
    assert.equal(await page.getByLabel("Гэрлийн өнгө").inputValue(), "neutral");
    await page.setViewportSize({ width: 390, height: 844 });
    await tool("Тек / Арал").click();
    await page
      .getByRole("button", { name: "Дэлгэрүүлэх", exact: false })
      .click();
    await page.screenshot({ path: path.join(output, "island-mobile.png") });
    assert.ok(await tool("Арал нэмэх").isVisible());
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      ),
      false,
      "mobile page does not overflow horizontally",
    );
    assert.deepEqual(errors, []);
    fs.writeFileSync(
      path.join(output, "result.json"),
      JSON.stringify(
        {
          desktop: [1440, 1000],
          mobile: [390, 844],
          corner: final.cornerPlan,
          lighting: final.lineLighting,
          furniture: final.extras.map((e) => ({
            kind: e.planningFurniture,
            position: e.position,
            width: e.width,
            depth: e.depth,
            height: e.height,
          })),
          errors,
        },
        null,
        2,
      ),
    );
    console.log(
      "Verified corner preview/apply, lighting, island/bar insertion, undo/redo, reload, and mobile controls.",
    );
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
