const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { spawn } = require("node:child_process");
const { mkdirSync, writeFileSync } = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const AxeBuilder = require("@axe-core/playwright").default;

const root = path.resolve(__dirname, "../..");
const output = path.join(root, ".tools/phase8-projects");
const base = "http://127.0.0.1:3001";
const healthUrl = base + "/api/health/live";
const fixturePort = 45432;
const serverPort = 3001;

assert.ok(
  process.argv.includes("--fixtures"),
  "This mutating suite runs only against isolated fixtures",
);
assert.equal(
  process.env.PHASE6_FIXTURE_BUILD,
  "1",
  "Use the documented isolated production build",
);
mkdirSync(output, { recursive: true });

function writeJson(filename, value) {
  writeFileSync(path.join(output, filename), JSON.stringify(value, null, 2));
}

function watchPageErrors(page, errors) {
  page.on("pageerror", (error) => {
    errors.push({ url: page.url(), message: error.message });
  });
}

function waitForProjectState(page, expectedState) {
  return page.waitForFunction(
    (state) =>
      document.querySelector(".planner-project-status")?.dataset.state === state,
    expectedState,
  );
}

async function auditPage(page, state, results) {
  const axe = await new AxeBuilder({ page })
    .setLegacyMode()
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();

  results.push({
    state,
    violations: axe.violations.map((violation) => ({
      id: violation.id,
      nodes: violation.nodes.map((node) => ({
        target: node.target,
        summary: node.failureSummary,
      })),
    })),
    overflow: await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth + 1,
    ),
  });
  console.log("Checked: " + state);
}

async function signIn(page, email, next = "/planner") {
  await page.goto(base + "/login?next=" + encodeURIComponent(next));
  await page.getByLabel("Имэйл").fill(email);
  await page.getByLabel("Нууц үг", { exact: true }).fill("fixture-password");
  await page.locator("main button[type=submit]").click();
  await page.waitForURL((url) => url.pathname === "/planner");
}

async function editRoomName(page, name) {
  await page
    .locator(".planner-reference-rail")
    .getByRole("button", { name: "Өрөө", exact: true })
    .click();
  await page.getByRole("textbox", { name: "Загварын нэр", exact: true }).fill(name);
}

async function saveRoom(page) {
  await page.keyboard.press("Control+s");
  await waitForProjectState(page, "saved");
}

async function verifyRoomProjectFlows({ page, context, fixture, results, errors }) {
  await signIn(page, "fixture@example.test");
  await page.locator(".room-reference").waitFor();

  await editRoomName(page, "Phase 8 room");
  await saveRoom(page);
  assert.equal(fixture.state.projects.length, 1);
  const projectId = fixture.state.projects[0].id;
  await auditPage(page, "mobile room saved", results);

  // Two tabs editing the same revision must preserve the second tab's draft.
  await page.keyboard.press("Escape");
  const secondTab = await context.newPage();
  watchPageErrors(secondTab, errors);
  await secondTab.setViewportSize({ width: 1440, height: 900 });
  await secondTab.goto(base + "/planner?project=" + projectId);
  await secondTab.locator(".room-reference").waitFor();

  await editRoomName(page, "First tab update");
  await saveRoom(page);
  await editRoomName(secondTab, "Second tab draft");
  await secondTab.keyboard.press("Control+s");
  await secondTab.locator(".planner-project-recovery").waitFor();
  assert.equal(fixture.state.projects[0].name, "First tab update");
  await auditPage(secondTab, "two-tab conflict retains draft", results);

  await secondTab
    .locator(".planner-project-recovery")
    .getByRole("button", { name: "Хуулбар болгон хадгалах", exact: true })
    .click();
  await waitForProjectState(secondTab, "saved");
  assert.equal(fixture.state.projects.length, 2);
  console.log("Checked: conflict saved as copy");

  // A committed write with a lost acknowledgement must be safe to retry.
  await page.keyboard.press("Escape");
  await editRoomName(page, "Retry safe room");
  fixture.state.commitThenFail = true;
  await page.keyboard.press("Control+s");
  await page.locator(".planner-project-recovery").waitFor();
  const versionCount = fixture.state.versions.length;
  await page
    .locator(".planner-project-recovery")
    .getByRole("button", { name: "Дахин хадгалах", exact: true })
    .click();
  await waitForProjectState(page, "saved");
  assert.equal(
    fixture.state.versions.length,
    versionCount,
    "lost acknowledgement retry does not duplicate versions",
  );
  console.log("Checked: lost acknowledgement retry");

  // Restoring history creates a new revision and keeps the project identity.
  await page
    .locator(".planner-reference-rail")
    .getByRole("button", { name: "Өрөө", exact: true })
    .click();
  await page.getByRole("button", { name: /Хувилбарын түүх/ }).click();
  await page.getByRole("button", { name: "v1 сэргээх", exact: true }).click();
  await waitForProjectState(page, "dirty");
  await saveRoom(page);
  assert.equal(fixture.state.projects[0].name, "Phase 8 room");
  await auditPage(page, "history restored as new revision", results);

  await page.keyboard.press("Escape");
  await page.reload();
  await page.locator(".room-reference").waitFor();
  assert.equal(fixture.state.projects.length, 2);
  return projectId;
}

async function verifyAccountLibrary({ page, fixture, results }) {
  await page.goto(base + "/account");
  await page.locator(".saved-room-list").waitFor();
  await page.waitForLoadState("networkidle");
  await auditPage(page, "account cloud projects and import", results);

  await page.locator(".room-local-import summary").click();
  const importButton = page.locator(".room-local-import button").first();
  if (await importButton.count()) {
    const projectCount = fixture.state.projects.length;
    await importButton.click();
    await page
      .getByRole("status")
      .filter({ hasText: "Local эх загвар хэвээр" })
      .waitFor();
    assert.equal(
      fixture.state.projects.length,
      projectCount,
      "same local identity imports once",
    );
  }

  const roomCard = page
    .locator(".saved-room-list article")
    .filter({ hasText: "Phase 8 room" })
    .first();
  page.on("dialog", (dialog) => dialog.accept());
  await roomCard.getByRole("button", { name: "Архивлах", exact: true }).click();
  await page
    .locator(".saved-room-list")
    .getByRole("button", { name: "Архив", exact: true })
    .click();

  const restoreButton = page
    .locator(".saved-room-list")
    .getByRole("button", { name: "Сэргээх", exact: true })
    .first();
  await restoreButton.click();
  await restoreButton.waitFor({ state: "hidden" });
  assert.equal(fixture.state.projects[0].archived_at, null);
  assert.ok(fixture.state.versions.length >= 4);
}

async function verifyKitchenInteractions({ page, fixture, results }) {
  await page.goto(base + "/kitchen?design=" + fixture.kitchenId);
  await page.locator(".kitchen-reference").waitFor();
  await waitForProjectState(page, "saved");
  assert.ok(
    fixture.requests.some(
      (request) =>
        request.path === "/rest/v1/kitchen_garnitures" &&
        request.query.includes("id=eq."),
    ),
    "single kitchen read is scoped",
  );

  const reviewButton = page
    .locator(".planner-reference-rail")
    .getByRole("button", { name: "2D план, тайлан", exact: true });
  await reviewButton.click();
  await page.locator(".kp-review-layer").waitFor();
  await page.keyboard.press("Escape");
  await page.locator(".kp-review-layer").waitFor({ state: "hidden" });
  assert.equal(
    await reviewButton.evaluate((element) => document.activeElement === element),
    true,
    "native modal returns focus",
  );

  await page
    .locator(".planner-reference-rail")
    .getByRole("button", { name: "Өрөөний хэмжээ", exact: true })
    .click();
  const widthInput = page.getByRole("spinbutton", { name: /^Өрөөний өргөн/ });
  await widthInput.fill("4300");
  await widthInput.press("Tab");
  await page.keyboard.press("Control+s");
  await waitForProjectState(page, "saved");
  await auditPage(page, "kitchen Ctrl+S and shared saved status", results);
  await page.screenshot({ path: path.join(output, "kitchen-saved.png") });
}

async function verifyAccountPrivacy({
  page,
  browser,
  fixture,
  projectId,
  results,
  errors,
}) {
  const otherAccount = await browser.newContext({
    viewport: { width: 390, height: 900 },
  });

  try {
    const secondPage = await otherAccount.newPage();
    watchPageErrors(secondPage, errors);
    await signIn(
      secondPage,
      "second@example.test",
      "/planner?project=" + projectId,
    );
    await secondPage
      .getByRole("alert")
      .filter({ hasText: "Загвар олдсонгүй" })
      .waitFor();
    await auditPage(secondPage, "other account project denial", results);

    assert.equal(
      await secondPage.evaluate(async (kitchenId) => {
        const authKey = Object.keys(localStorage).find(
          (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
        );
        const session = JSON.parse(localStorage.getItem(authKey));
        const response = await fetch("/api/kitchens/" + kitchenId, {
          headers: { Authorization: "Bearer " + session.access_token },
        });
        return response.status;
      }, fixture.kitchenId),
      404,
      "single kitchen detail is also owner-private",
    );
  } finally {
    await otherAccount.close();
  }

  await page.goto(base + "/planner?project=" + projectId);
  await page.locator(".room-reference").waitFor();
  await page.screenshot({ path: path.join(output, "room-saved.png") });
}

async function verifyAccountPagination({ page, fixture, results }) {
  const originalProjects = fixture.state.projects.slice();
  fixture.state.projects.push(
    ...Array.from({ length: 35 }, (_, index) => ({
      ...structuredClone(originalProjects[0]),
      id: randomUUID(),
      name: "Paged room " + index,
      updated_at: "2026-10-01T00:00:00.000Z",
    })),
  );

  try {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(base + "/account");
    await page.waitForFunction(
      () =>
        document.querySelectorAll(".saved-room-list > .grid > article").length ===
        30,
    );
    await page
      .getByRole("button", { name: "Дараагийн загварууд", exact: true })
      .click();
    await page.waitForFunction(
      (count) =>
        document.querySelectorAll(".saved-room-list > .grid > article").length ===
        count,
      originalProjects.length + 35,
    );

    assert.equal(
      await page
        .locator(".saved-room-list > .grid > article h4")
        .evaluateAll((nodes) => new Set(nodes.map((node) => node.textContent)).size),
      originalProjects.length + 35,
    );
    await auditPage(
      page,
      "desktop account keyset pagination with equal timestamps",
      results,
    );
  } finally {
    fixture.state.projects = originalProjects;
  }
}

async function profileKitchenReadApis(page, fixture) {
  const originalKitchens = fixture.state.kitchens.slice();
  fixture.state.kitchens.push(
    ...Array.from({ length: 499 }, (_, index) => ({
      ...structuredClone(originalKitchens[0]),
      id: randomUUID(),
      name: "Fixture kitchen " + index,
    })),
  );

  try {
    const reads = await page.evaluate(async (kitchenId) => {
      const authKey = Object.keys(localStorage).find(
        (key) => key.startsWith("sb-") && key.endsWith("-auth-token"),
      );
      const session = JSON.parse(localStorage.getItem(authKey));
      const measurements = [];

      for (const endpoint of ["/api/kitchens", "/api/kitchens/" + kitchenId]) {
        const response = await fetch(endpoint, {
          headers: { Authorization: "Bearer " + session.access_token },
        });
        if (!response.ok) throw new Error("Fixture profile request failed");

        const responseText = await response.text();
        const parseTimes = [];
        for (let index = 0; index < 30; index++) {
          const start = performance.now();
          JSON.parse(responseText);
          parseTimes.push(performance.now() - start);
        }
        parseTimes.sort((left, right) => left - right);

        measurements.push({
          endpoint,
          bytes: new TextEncoder().encode(responseText).length,
          parseP50Ms: parseTimes[15],
          parseP95Ms: parseTimes[28],
        });
      }
      return measurements;
    }, fixture.kitchenId);

    assert.ok(
      reads[1].bytes < reads[0].bytes / 100,
      "opening a kitchen reads one project instead of parsing the whole library",
    );
    return reads;
  } finally {
    fixture.state.kitchens = originalKitchens;
  }
}

async function verifyCanvasLifecycle({ page, context, projectId }) {
  // Repeated real WebGL canvas mounts in software Chromium.
  await page.addInitScript(() => {
    window.phase8Canvas = [];
    window.addEventListener("tavilga:canvas-performance", (event) => {
      window.phase8Canvas.push(event.detail);
    });
  });

  const lifecycle = [];
  const cdp = await context.newCDPSession(page);

  try {
    await cdp.send("Performance.enable");
    await page.goto(
      base + "/planner?project=" + projectId + "&performance=1",
    );
    const realm = await page.evaluate(
      () => (window.phase8Realm = crypto.randomUUID()),
    );

    for (let cycle = 0; cycle < 6; cycle++) {
      const scene = cycle % 2 ? "kitchen" : "room";
      if (cycle > 0) {
        await page.evaluate(() => (window.phase8Canvas = []));
        await page
          .locator(".studio-switch")
          .getByRole("link", {
            name: scene === "room" ? "Өрөө" : "Гал тогоо",
            exact: true,
          })
          .click();
      }

      await page.waitForFunction(() => window.phase8Canvas?.length >= 4);
      assert.equal(
        await page.evaluate(() => window.phase8Realm),
        realm,
        "planner switching uses client navigation without reloading",
      );

      const samples = await page.evaluate(() => window.phase8Canvas.slice(-2));
      assert.ok(
        samples.every(
          (sample) =>
            sample.scene ===
              (scene === "room" ? "room" : "modular-kitchen") &&
            sample.loop === "demand" &&
            sample.frames <= 2,
        ),
        "settled active canvas should not continuously render or receive old canvas timers",
      );

      await cdp.send("HeapProfiler.collectGarbage");
      const { metrics } = await cdp.send("Performance.getMetrics");
      lifecycle.push({
        cycle,
        scene,
        samples,
        retainedHeapMiB:
          metrics.find((metric) => metric.name === "JSHeapUsedSize").value /
          1048576,
      });
    }

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.screenshot({ path: path.join(output, "kitchen-saved.png") });
    await page
      .locator(".studio-switch")
      .getByRole("link", { name: "Өрөө", exact: true })
      .click();
    await page.locator(".room-reference canvas").waitFor();
    await waitForProjectState(page, "saved");
    await page.screenshot({ path: path.join(output, "room-saved.png") });
    return lifecycle;
  } finally {
    await cdp.detach();
  }
}

async function startFixtureServer(fixture) {
  await new Promise((resolve, reject) => {
    fixture.server.once("error", reject);
    fixture.server.listen(fixturePort, "127.0.0.1", resolve);
  });
}

async function startNextServer() {
  const server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      String(serverPort),
    ],
    {
      cwd: root,
      env: {
        ...process.env,
        NEXT_DIST_DIR: process.env.NEXT_DIST_DIR || ".next",
        APP_ENV: "staging",
        APP_URL: base,
        NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:" + fixturePort,
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "fixture-public",
        SUPABASE_SECRET_KEY: "fixture-private",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let logs = "";
  server.stdout.on("data", (chunk) => (logs += chunk));
  server.stderr.on("data", (chunk) => (logs += chunk));

  for (let attempt = 0; attempt < 120; attempt++) {
    if (server.exitCode !== null) throw new Error(logs);
    try {
      if ((await fetch(healthUrl)).ok) return server;
    } catch {
      // The server is still starting.
    }
    if (attempt === 119) throw new Error("Next did not start");
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return server;
}

async function startBrowser() {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH || undefined,
    args: ["--no-sandbox", "--enable-unsafe-swiftshader"],
  });
  const context = await browser.newContext({
    viewport: { width: 390, height: 900 },
    reducedMotion: "reduce",
  });

  context.setDefaultTimeout(20_000);
  await context.route("**/_next/image?**", (route) =>
    route.fulfill({
      path: path.join(root, "public/image.png"),
      contentType: "image/png",
    }),
  );

  return { browser, context };
}

async function writeFailureEvidence(browser, results, errors) {
  if (!browser) return;

  const failures = [];
  for (const browserContext of browser.contexts()) {
    for (const [index, page] of browserContext.pages().entries()) {
      failures.push({
        url: page.url(),
        alerts: await page
          .getByRole("alert")
          .allTextContents()
          .catch(() => []),
      });
      await page
        .screenshot({
          path: path.join(output, "failure-" + failures.length + "-" + index + ".png"),
        })
        .catch(() => {});
    }
  }

  writeJson("failure.json", { failures, results, errors });
}

async function run() {
  const fixture = require("../../tests/helpers/phase8-marketplace.cjs")
    .createPhase8Fixture();
  const results = [];
  const errors = [];
  let server;
  let browser;

  try {
    await startFixtureServer(fixture);
    server = await startNextServer();
    ({ browser } = await startBrowser());
    const context = browser.contexts()[0];
    const page = await context.newPage();
    watchPageErrors(page, errors);

    const projectId = await verifyRoomProjectFlows({
      page,
      context,
      fixture,
      results,
      errors,
    });
    await verifyAccountLibrary({ page, fixture, results });
    await verifyKitchenInteractions({ page, fixture, results });
    await verifyAccountPrivacy({
      page,
      browser,
      fixture,
      projectId,
      results,
      errors,
    });
    await verifyAccountPagination({ page, fixture, results });
    const reads = await profileKitchenReadApis(page, fixture);
    const lifecycle = await verifyCanvasLifecycle({ page, context, projectId });

    const report = {
      environment:
        "isolated production-build HTTP fixtures + software Chromium; DB permissions tested separately",
      results,
      errors,
      summary: {
        checks: results.length,
        violations: results.reduce(
          (count, result) => count + result.violations.length,
          0,
        ),
        overflows: results.filter((result) => result.overflow).length,
      },
      projects: fixture.state.projects.length,
      versions: fixture.state.versions.length,
      reads,
      lifecycle,
    };

    writeJson("report.json", report);
    console.log(JSON.stringify(report.summary));
    assert.equal(report.summary.violations, 0);
    assert.equal(report.summary.overflows, 0);
    assert.deepEqual(errors, []);
  } catch (error) {
    await writeFailureEvidence(browser, results, errors);
    throw error;
  } finally {
    if (browser) await browser.close();
    if (server) server.kill("SIGTERM");
    await new Promise((resolve) => fixture.server.close(resolve));
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
