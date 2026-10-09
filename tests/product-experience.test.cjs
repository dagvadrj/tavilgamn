const test = require("node:test");
const assert = require("node:assert/strict");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const THREE = require("three");
const { loadSource } = require("./helpers/load-source.cjs");
const { createAppearanceController, createProductTexture } = loadSource("src/three/productSurfaceController.ts");
const { snapshotProduct } = loadSource("src/three/productExport.ts");
const { installmentAmounts, productScaleLayout } = loadSource("src/lib/productExperience.ts");

test("animated appearance updates shared surfaces once per frame, preserves hardware and reuses geometry", () => {
  const root = new THREE.Group();
  const geometry = new THREE.BoxGeometry(2, 1, 1);
  const body = new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: .6 });
  const frame = new THREE.MeshStandardMaterial({ name: "fixed-frame", color: "#403020" });
  const first = new THREE.Mesh(geometry, body), second = new THREE.Mesh(geometry, body), hardware = new THREE.Mesh(geometry, frame);
  root.add(first, second, hardware);
  const originalFrame = frame.color.getHexString();
  const controller = createAppearanceController();
  assert.equal(controller.update(root, "#000000", "fabric", .16), true);
  assert.ok(Math.abs(body.color.r - .5) < 1e-8, "two meshes sharing a material must still have a 320 ms transition");
  assert.equal(controller.update(root, "#000000", "fabric", .16), false);
  assert.equal(body.color.getHexString(), "000000");
  assert.equal(body.roughness, .9);
  const fabricMap = body.normalMap;
  assert.ok(fabricMap instanceof THREE.DataTexture);
  controller.update(root, "#c9aa80", "wood", .32);
  assert.notEqual(body.normalMap, fabricMap);
  const woodMap = body.normalMap;
  controller.update(root, "#c9aa80", "leather", .32);
  assert.equal(body.roughness, .42);
  controller.update(root, "#c9aa80", "wood", .32);
  assert.equal(body.normalMap, woodMap);
  controller.update(root, "#c9aa80", "metal", .32);
  assert.equal(first.geometry, geometry);
  assert.equal(frame.color.getHexString(), originalFrame);
  let disposed = 0;
  fabricMap.addEventListener("dispose", () => disposed++);
  woodMap.addEventListener("dispose", () => disposed++);
  controller.dispose();
  assert.equal(disposed, 2);
  // React Strict Mode may clean up and re-run effects without remounting meshes.
  controller.update(root, "#c9aa80", "wood", .32);
  assert.ok(body.normalMap instanceof THREE.DataTexture);
  assert.notEqual(body.normalMap, woodMap);
  assert.equal(body.metalness, .02);
  controller.dispose();
});

test("reduced motion snaps instantly, late delivery meshes receive the current finish and explicit exclusions survive", () => {
  const root = new THREE.Group(), controller = createAppearanceController();
  const material = new THREE.MeshStandardMaterial();
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), material));
  assert.equal(controller.update(root, "#224466", "metal", .001, true), false);
  assert.equal(material.color.getHexString(), "224466");
  assert.equal(material.metalness, .85);
  assert.equal(material.normalMap, null);
  const delivered = new THREE.MeshStandardMaterial(), fixed = new THREE.MeshStandardMaterial();
  fixed.userData.configurable = false;
  root.add(new THREE.Mesh(new THREE.BoxGeometry(), delivered), new THREE.Mesh(new THREE.BoxGeometry(), fixed));
  controller.update(root, "#224466", "fabric", .32);
  assert.equal(delivered.color.getHexString(), "224466");
  assert.equal(material.metalness, 0, "a previously configurable metal finish can change back to fabric");
  assert.equal(fixed.color.getHexString(), "ffffff");
  controller.dispose();
});

test("generated normal maps are deterministic, distinct by finish and use linear color space", () => {
  const fabric = createProductTexture("fabric"), again = createProductTexture("fabric"), wood = createProductTexture("wood"), leather = createProductTexture("leather");
  assert.deepEqual(fabric.image.data, again.image.data);
  assert.notDeepEqual(fabric.image.data, wood.image.data);
  assert.notDeepEqual(wood.image.data, leather.image.data);
  assert.equal(fabric.colorSpace, THREE.NoColorSpace);
  assert.equal(fabric.image.width, 128);
  assert.equal(fabric.wrapS, THREE.RepeatWrapping);
  [fabric, again, wood, leather].forEach(texture => texture.dispose());
});

test("AR snapshot exports the delivery model in metres, preserves selected appearance and excludes retained preview", () => {
  const root = new THREE.Group(), asset = new THREE.Group(), delivery = new THREE.Group(), preview = new THREE.Group();
  asset.userData = { deliveryPending: true, deliveryReady: true };
  delivery.userData.productDelivery = true; delivery.visible = false; delivery.scale.set(2, 1, 3);
  preview.userData.exportExclude = true;
  const material = new THREE.MeshStandardMaterial({ color: "#c9aa80", normalMap: createProductTexture("wood") });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), material); mesh.position.y = .5; mesh.name = "delivery";
  delivery.add(mesh); preview.add(new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20)));
  asset.add(delivery, preview); root.add(asset);
  const snapshot = snapshotProduct(root);
  const copy = snapshot.scene.getObjectByName("delivery");
  assert.equal(copy.parent.visible, true);
  assert.equal(delivery.visible, false);
  assert.notEqual(copy.material, material);
  assert.notEqual(copy.material.normalMap, material.normalMap);
  assert.equal(copy.material.color.getHexString(), "c9aa80");
  assert.deepEqual(new THREE.Box3().setFromObject(snapshot.scene).getSize(new THREE.Vector3()).toArray(), [2, 1, 3]);
  let originalDisposed = false;
  material.addEventListener("dispose", () => { originalDisposed = true; });
  snapshot.dispose();
  assert.equal(originalDisposed, false);
  material.normalMap.dispose();
  asset.userData.deliveryReady = false;
  assert.throws(() => snapshotProduct(root), /Бүрэн чанартай/);
});

test("human and product use the same scale for small, tall and wide furniture", () => {
  for (const dimensions of [{ w: 2.2, d: .9, h: .8 }, { w: 1, d: .6, h: 3.2 }, { w: 5, d: 1, h: .5 }]) {
    const scale = productScaleLayout(dimensions);
    assert.ok(Math.abs(scale.product.height / scale.human.height - dimensions.h / 1.7) < 1e-12);
    assert.equal(scale.product.width, dimensions.w * scale.pxPerMetre);
    assert.ok(Math.abs(scale.product.y + scale.product.height - scale.floor) < 1e-9);
    assert.ok(Math.abs(scale.human.y + scale.human.height - scale.floor) < 1e-9);
    assert.ok(scale.product.width <= 320);
  }
});

test("four installments sum to the selected total, including rounding; invalid amounts are rejected", () => {
  assert.deepEqual(installmentAmounts(1200000), [300000, 300000, 300000, 300000]);
  assert.deepEqual(installmentAmounts(1200003), [300001, 300001, 300001, 300000]);
  assert.equal(installmentAmounts(245003 * 3).reduce((a, b) => a + b), 245003 * 3);
  for (const total of [-1, Infinity, NaN]) assert.deepEqual(installmentAmounts(total), []);
  const { ProductInstallments } = loadSource("src/components/ProductInstallments.tsx");
  const html = renderToStaticMarkup(React.createElement(ProductInstallments, { total: 1200000 }));
  assert.ok(html.includes("300,000₮ × 4"));
  assert.ok(html.includes("Жишиг тооцоо") && html.includes("хараахан холбогдоогүй"));
  assert.ok(!html.includes("сард"));
  const rounded = renderToStaticMarkup(React.createElement(ProductInstallments, { total: 1200003 }));
  assert.ok(rounded.includes("300,000₮–300,001₮ · 4 төлөлт"));
  assert.ok(!rounded.includes("300,001₮ × 4"));
});

test("PDP initial color selection feeds the same actual variant price into the four-part calculator", () => {
  const { ProductCustomizer } = loadSource("src/components/ProductCustomizer.tsx");
  const product = { id: "sofa", category: "sofa", name: "Kanso", description: "", image: "/sofa.jpg", basePrice: 1200000,
    defaultColor: "cream", colors: [{ id: "cream", name: "Cream", hex: "#eeeeee" }, { id: "oak", name: "Oak", hex: "#c9aa80", priceDelta: 40000 }],
    materials: [{ id: "fabric", name: "Даавуу", priceDelta: 0 }], dimensions: { w: 2.2, d: .9, h: .8 }, stockQuantity: 3, inStock: true, rating: 0, reviewCount: 0 };
  const html = renderToStaticMarkup(React.createElement(ProductCustomizer, { product, initialColor: "oak" }));
  assert.ok(html.includes("310,000₮ × 4"));
  assert.ok(html.includes("Хэмжээ шалгах") && html.includes("Бараа харах горим"));
  assert.ok(html.includes("AR ашиглахад барааны 3D модел шаардлагатай"));
  const requested3D = renderToStaticMarkup(React.createElement(ProductCustomizer, { product, initialView3D: true }));
  assert.ok(requested3D.includes("3D загвар хараахан бэлэн болоогүй"));
  assert.ok(!requested3D.includes("Интерактив 3D загвар") && !requested3D.includes("3D загварыг ачаалж байна"));
  assert.match(requested3D, /<button[^>]*disabled=""[^>]*title="3D загвар хараахан бэлэн болоогүй"/);
  assert.ok(!requested3D.includes("3D-ээр үзэх"), "photo-only products cannot open a generated replacement model");
});
