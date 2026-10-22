const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { loadSource } = require('./helpers/load-source.cjs');
const { createCabinet } = loadSource('src/lib/kitchenCabinets.ts');
const { KitchenCabinetGLB } = loadSource('src/three/KitchenCabinetGLB.tsx', {
  react: { ...React, useMemo: fn => fn() },
  './GLBFurnitureMesh': { GLBFurnitureMesh: 'uploaded-model' },
});

test('unlinked cabinets do not generate substitute wooden furniture', () => {
  for (const type of ['base', 'wall', 'tall']) {
    const cabinet = createCabinet(type, type, 800);
    const result = KitchenCabinetGLB({ cabinet, open: true });
    assert.equal(result.type.name, 'MissingKitchenModel');
    assert.equal(result.type(result.props).props.userData.deliveryReady,false);
    assert.equal(result.props.cabinet, cabinet);
  }
});

test('linked cabinets continue using their uploaded model at planned dimensions', () => {
  const cabinet = createCabinet('base', 'linked', 800);
  const variant = { furnitureModelId: 'model', glbFile: 'cabinet.glb', configuration: {} };
  const tree = KitchenCabinetGLB({ cabinet, variant });
  const result = React.Children.toArray(tree.props.children).find(child => child.type === "uploaded-model");
  assert.equal(result.type, 'uploaded-model');
  assert.equal(result.props.glbFile, 'cabinet.glb');
  assert.equal(result.props.w, cabinet.width / 1000);
  assert.equal(result.props.h, cabinet.height / 1000);
  assert.equal(result.props.d, cabinet.depth / 1000);
});

const { applyKitchenCatalogVariants } = loadSource('src/lib/kitchenModuleCatalog.ts');
const { createUnifiedKitchen } = loadSource('src/lib/kitchenAssembly.ts');
test('initial layout never assigns a different-sized catalog SKU to planned boxes', () => {
  const modules = [
    { id: 'doors', cabinetType: 'base', active: true, widthMm: 800, heightMm: 740, depthMm: 598,
      variants: [{ furnitureModelId: 'box', opening: 'doors', active: true, isDefault: true, glbFile: 'box.glb', configuration: {} }] },
    { id: 'oven', cabinetType: 'base', active: true, widthMm: 600, heightMm: 840, depthMm: 600,
      variants: [{ furnitureModelId: 'oven', opening: 'hob', active: true, glbFile: 'oven.glb', configuration: {} }] },
  ];
  const original = createUnifiedKitchen();
  const result = applyKitchenCatalogVariants(original, modules);
  result.cabinets.forEach((cabinet, index) => {
    assert.deepEqual(cabinet.position, original.cabinets[index].position);
    for (const field of ['width', 'height', 'depth', 'opening']) assert.equal(cabinet[field], original.cabinets[index][field]);
    if (cabinet.opening === 'refrigerator') assert.equal(cabinet.variantId, undefined);
    else assert.equal(cabinet.variantId, undefined, 'unavailable dimensions and roles remain unassigned');
  });
  assert.equal(applyKitchenCatalogVariants(result, modules), result, 'resolved IDs survive reload');
});
test('different catalog dimensions are rejected at render time, including stale explicit selections', () => {
  const cabinet = createCabinet('base', 'fit', 600);
  const variant = { furnitureModelId: 'model', glbFile: 'box.glb', physicalSize: true, configuration: {}, nominalSizeMm: { width: 800, height: 740, depth: 598 } };
  const tree = KitchenCabinetGLB({ cabinet, variant });
  assert.equal(tree.type.name, 'MissingKitchenModel');
  const exact = KitchenCabinetGLB({ cabinet, variant: {...variant, nominalSizeMm: {width:600,height:840,depth:600}} });
  const model = React.Children.toArray(exact.props.children).find(child => child.type === 'uploaded-model');
  assert.equal(model.props.preservePhysicalSize, true);
});
