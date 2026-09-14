const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { fitBacksplashes, parseBacksplashSettings } = loadSource('src/lib/kitchenBacksplash.ts');
const { createUnifiedKitchen, arrangeKitchen, parseKitchen, kitchenEnvelope } = loadSource('src/lib/kitchenAssembly.ts');
const { cabinetsOverlap, cabinetCorners } = loadSource('src/lib/kitchenPlacement.ts');
const rectangle = panel => ({ ...panel, depth: panel.thickness });
test('full-run backsplash joins the entire inside L corner with no overlapping boards', () => {
  for (const layout of ['straight', 'l-left', 'l-right', 'double-side']) {
    const k = arrangeKitchen(createUnifiedKitchen(), layout), panels = fitBacksplashes(k);
    assert.equal(panels.length, layout === 'straight' ? 1 : 2);
    assert.doesNotThrow(() => parseBacksplashSettings({ mode: 'manual', panels }, k.room));
    for (const [index, panel] of panels.entries()) for (const other of panels.slice(index + 1)) assert.equal(cabinetsOverlap(rectangle(panel), rectangle(other)), false);
    if (layout.startsWith('l-')) {
      const a = cabinetCorners(rectangle(panels[0])), b = cabinetCorners(rectangle(panels[1]));
      assert.ok(a.some(p => b.some(q => Math.hypot(p.x-q.x,p.z-q.z)<.001)), 'wall panels form a continuous butt joint');
      assert.equal(Math.min(...b.map(p=>p.z)),12);
    }
  }
});
test('manual backsplash movement preserves exact sizes on save and updates overall export bounds', () => {
  const k = createUnifiedKitchen(), panels = fitBacksplashes(k);
  panels[0] = { ...panels[0], width: 999.5, height: 650, position: { x: 999.25, y: 1600, z: 1200.5, rotation: 0 } };
  const manual = { ...k, backsplashSettings: { mode: 'manual', panels } };
  const checked = parseKitchen(JSON.parse(JSON.stringify(manual)));
  assert.deepEqual(checked.backsplashSettings, manual.backsplashSettings);
  assert.equal(kitchenEnvelope(checked).h,2.25);
  assert.equal(fitBacksplashes({...checked,backsplash:false}).length,0);
  const invalid = structuredClone(manual.backsplashSettings); invalid.panels[0].position.x = 0;
  assert.throws(()=>parseBacksplashSettings(invalid,k.room));
  assert.throws(()=>parseBacksplashSettings({...manual.backsplashSettings,panels:[panels[0],{...panels[0],id:'duplicate-position'}]},k.room));
});
