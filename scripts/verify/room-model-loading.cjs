/* Local browser regression: uses an isolated guest context and synthetic GLBs. */
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const THREE = require("three");
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require(
    process.env.PLAYWRIGHT_MODULE ||
      "C:/Users/HiTech/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright",
  );
}

async function sofaGlb() {
  const { GLTFExporter } =
    await import("three/examples/jsm/exporters/GLTFExporter.js");
  global.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((result) => {
        this.result = result;
        this.onloadend?.();
      });
    }
  };
  const root = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color: "#bba48d",
    roughness: 0.85,
  });
  for (const [w, h, d, x, y, z] of [
    [1.8, 0.3, 0.85, 0, 0.3, 0],
    [1.8, 0.5, 0.16, 0, 0.6, -0.35],
    [0.15, 0.55, 0.85, -0.825, 0.4, 0],
    [0.15, 0.55, 0.85, 0.825, 0.4, 0],
  ]) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
    mesh.position.set(x, y, z);
    root.add(mesh);
  }
  return Buffer.from(
    await new GLTFExporter().parseAsync(root, { binary: true }),
  );
}

// Find the R3F context through React's browser tree; no production debug API.
function inspectScene() {
  const canvas = document.querySelector("canvas");
  if (!canvas) return null;
  const key = Object.keys(canvas).find((key) =>
    key.startsWith("__reactFiber$"),
  );
  let fiber = canvas[key];
  if (!fiber) return null;
  while (fiber.return) fiber = fiber.return;
  const queue = [
      fiber,
      ...(window.__roomTestRoots || []).map((root) => root.current),
    ],
    visited = new Set();
  for (let i = 0; i < queue.length && i < 20000; i++) {
    const node = queue[i];
    if (!node || visited.has(node)) continue;
    visited.add(node);
    const candidate = node.memoizedProps?.value;
    if (typeof candidate?.getState === "function") {
      const state = candidate.getState();
      if (state.scene && state.camera && state.gl) {
        window.__roomLoadingTestStore = candidate;
        break;
      }
    }
    queue.push(node.child, node.sibling);
  }
  const state = window.__roomLoadingTestStore?.getState();
  if (!state) return { found: false };
  const placeholders = [],
    deliveries = [];
  state.scene.traverse((object) => {
    if (object.userData.deliveryPlaceholder)
      placeholders.push({
        size: [
          object.geometry.parameters.width,
          object.geometry.parameters.height,
          object.geometry.parameters.depth,
        ],
        position: object.position.toArray(),
      });
    if (Object.hasOwn(object.userData, "deliveryPending"))
      deliveries.push({ ...object.userData });
  });
  return {
    found: true,
    placeholders,
    deliveries,
    camera: state.camera.position.toArray(),
    quaternion: state.camera.quaternion.toArray(),
    target: state.controls?.target.toArray(),
  };
}

async function main() {
  const mobile = process.argv.includes("--mobile");
  const label = mobile ? "mobile" : "desktop";
  const glb = await sofaGlb();
  const output = path.resolve(".tools/ikea-loading-browser");
  await fs.mkdir(output, { recursive: true });
  const browser = await playwright.chromium.launch({
    headless: true,
    ...(process.env.CHROME_PATH
      ? { executablePath: process.env.CHROME_PATH }
      : {
          executablePath:
            "C:/Program Files/Google/Chrome/Application/chrome.exe",
        }),
    args: ["--enable-unsafe-swiftshader"],
  });
  let page;
  try {
    page = await browser.newPage({
      viewport: mobile
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      localStorage.setItem("tavilga:planner-tour:room:v1", "done");
      window.__roomTestRoots = [];
      window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
        supportsFiber: true,
        renderers: new Map(),
        inject(renderer) {
          const id = this.renderers.size + 1;
          this.renderers.set(id, renderer);
          return id;
        },
        onCommitFiberRoot(_id, root) {
          if (!window.__roomTestRoots.includes(root))
            window.__roomTestRoots.push(root);
        },
        onCommitFiberUnmount() {},
        onPostCommitFiberRoot() {},
      };
    });
    const fixture = {
      id: "loading-sofa",
      name: "Тест буйдан",
      category: "sofa",
      description: "Local browser test",
      image: "/test-sofa.svg",
      basePrice: 1000000,
      colors: [{ id: "oak", name: "Oak", hex: "#bba48d", priceDelta: 0 }],
      materials: [{ id: "fabric", name: "Fabric", priceDelta: 0 }],
      defaultColor: "oak",
      dimensions: { w: 1.8, h: 0.85, d: 0.85 },
      stockQuantity: 10,
      rating: 5,
      reviewCount: 0,
      model: { id: "loading-sofa", file: "sofa.glb" },
    };
    await page.route("**/api/products*", (route) =>
      route.fulfill({ json: { products: [fixture] } }),
    );
    await page.route("**/test-sofa.svg*", (route) =>
      route.fulfill({
        contentType: "image/svg+xml",
        body: '<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect x="30" y="70" width="240" height="90" rx="20" fill="#bba48d"/></svg>',
      }),
    );
    await page.route("**/api/kitchen-modules*", (route) =>
      route.fulfill({ json: { modules: [], materials: [] } }),
    );
    let releaseDownload,
      requested = 0;
    const blocked = new Promise((resolve) => {
      releaseDownload = resolve;
    });
    await page.route(
      "**/api/models/files/loading-sofa/*.glb",
      async (route) => {
        requested++;
        await blocked;
        await route.fulfill({ contentType: "model/gltf-binary", body: glb });
      },
    );
    await page.goto(
      process.env.PLANNER_URL || "http://127.0.0.1:3010/planner",
      { waitUntil: "domcontentloaded", timeout: 120000 },
    );
    console.log("Planner route opened");
    await page.screenshot({ path: path.join(output, `${label}-entry.png`) });
    await page
      .getByRole("button", { name: /Зочны өрөө/ })
      .first()
      .click({ timeout: 120000 });
    await page
      .getByRole("button", { name: "3D өрөөгөө нээх", exact: true })
      .click();
    console.log("Room created");
    await page.waitForSelector("canvas", { timeout: 120000 });
    await page.waitForFunction(
      () => document.querySelector("canvas")?.width > 0,
    );
    await page.waitForFunction(() =>
      JSON.parse(
        localStorage.getItem("casa-designs-guest"),
      )?.state.current?.previewImage?.startsWith("data:image/"),
    );
    const originalPreview = await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("casa-designs-guest")).state.current
          .previewImage,
    );
    await page
      .getByRole("button", { name: "Тавилга нэмэх", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Тест буйдан — өрөөнд нэмэх", exact: true })
      .click();
    console.log("Furniture added with download held");
    await page.getByText("Тавилга ачаалж байна…", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Эргүүлэх", exact: true }).click();
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("casa-designs-guest")).state.current
            .pieces[0].rotation,
      ),
      Math.PI / 2,
    );
    // Hold longer than the thumbnail debounce: loading geometry must not replace it.
    await page.waitForTimeout(1500);
    assert.equal(
      await page.evaluate(
        () =>
          JSON.parse(localStorage.getItem("casa-designs-guest")).state.current
            .previewImage,
      ),
      originalPreview,
    );
    await page.waitForFunction(() => {
      const canvas = document.querySelector("canvas");
      return canvas && canvas.getBoundingClientRect().width > 300;
    });
    let pending = await page.evaluate(inspectScene);
    assert.equal(pending?.found, true, JSON.stringify(pending));
    assert.equal(pending.placeholders.length, 1);
    assert.deepEqual(pending.placeholders[0].size, [1.8, 0.85, 0.85]);
    assert.equal(pending.deliveries[0].deliveryPending, true);
    await page.screenshot({ path: path.join(output, `${label}-pending.png`) });
    releaseDownload();
    await page
      .getByText("Тавилга ачаалж байна…", { exact: true })
      .waitFor({ state: "hidden", timeout: 60000 });
    const loaded = await page.evaluate(inspectScene);
    assert.equal(loaded.placeholders.length, 0);
    assert.equal(loaded.deliveries[0].deliveryReady, true);
    assert.deepEqual(
      loaded.camera,
      pending.camera,
      "adding the model must preserve camera position",
    );
    assert.deepEqual(
      loaded.quaternion,
      pending.quaternion,
      "adding the model must preserve camera rotation",
    );
    assert.deepEqual(
      loaded.target,
      pending.target,
      "adding the model must preserve orbit target",
    );
    assert.ok(requested >= 1);
    await page.waitForFunction(
      (before) =>
        JSON.parse(localStorage.getItem("casa-designs-guest")).state.current
          .previewImage !== before,
      originalPreview,
    );
    await page.screenshot({ path: path.join(output, `${label}-ready.png`) });
    assert.deepEqual(errors, []);
    await fs.writeFile(
      path.join(output, `${label}-result.json`),
      JSON.stringify(
        { passed: true, requested, pending, loaded, errors },
        null,
        2,
      ),
    );
    console.log(
      `PASS (${label}): measured placeholder → rendered GLB; unchanged camera/target; no page errors.`,
    );
  } catch (error) {
    if (page) {
      await page
        .screenshot({ path: path.join(output, "failure.png") })
        .catch(() => {});
      await fs.writeFile(
        path.join(output, "failure.txt"),
        await page
          .locator("body")
          .innerText()
          .catch(() => ""),
      );
    }
    throw error;
  } finally {
    await browser.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
