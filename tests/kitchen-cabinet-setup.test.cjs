const { test } = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadSource } = require('./helpers/load-source.cjs');
const { cabinetSetupAssembly, bindCabinetPart, cabinetSetupProblem, reuseCabinetPart } = loadSource('src/lib/kitchenCabinetSetup.ts');
const { parseKitchenGlbAssembly } = loadSource('src/lib/kitchenGlbAssembly.ts');
const { parseKitchenVariantInput } = loadSource('src/lib/kitchenModuleCatalog.ts');
const size = { widthMm: 1000, heightMm: 840, depthMm: 600 };
const model = { id: '11111111-2222-4333-8444-555555555555', name: 'Door 500', partKind: 'door', glbReady: true, widthMm: 496, heightMm: 796, depthMm: 18 };
function twoDoors() {
  let value = cabinetSetupAssembly(null, 2, 0, size);
  for (const slot of value.slots) value = bindCabinetPart(value, slot.id, model);
  return value;
}
test('two doors have separate hinges and may reuse the same GLB without changing real dimensions', () => {
  const value = twoDoors();
  assert.deepEqual(value.slots.map(s => s.id), ['door-left', 'door-right']);
  assert.deepEqual(value.slots.map(s => s.positionMm[0]), [-500, 500]);
  assert.deepEqual(value.slots.map(s => s.motion.amount), [-100, 100]);
  assert.equal(value.slots[0].options[0].sizeMm.width, 496);
  value.slots[1].scale = [-1, 1, 1];
  const restored = parseKitchenGlbAssembly(JSON.parse(JSON.stringify(value)));
  assert.deepEqual(restored.slots[1].scale, [-1, 1, 1]);
  assert.equal(cabinetSetupProblem(restored, [model]), null);
  restored.slots[1].scale = [0, 1, 1];
  assert.throws(() => parseKitchenGlbAssembly(restored));
});
test('front validation blocks missing, unready, archived or wrong-kind GLBs', () => {
  assert.ok(cabinetSetupProblem(cabinetSetupAssembly(null, 2, 0, size), [model]));
  for (const patch of [{glbReady:false}, {archivedAt:'2026-10-20'}, {partKind:'handle'}])
    assert.ok(cabinetSetupProblem(twoDoors(), [{...model, ...patch}]));
  const drawers = cabinetSetupAssembly(null, 0, 1, size);
  const drawer = {...model, partKind:'drawer'};
  assert.equal(cabinetSetupProblem(bindCabinetPart(drawers, 'drawer-1', drawer), [drawer]), null);
});
test('reducing door count keeps edits and removes orphaned handles and descendants', () => {
  const value = twoDoors(); value.slots[0].positionMm[1] = 405;
  const accessory = (id, parentSlotId) => ({...value.slots[0], id, parentSlotId, kind:'handle', optional:true});
  value.slots.push(accessory('child', 'handle-right'), accessory('handle-right', 'door-right'), accessory('handle-left', 'door-left'));
  const reduced = cabinetSetupAssembly(value, 1, 0, size);
  assert.deepEqual(reduced.slots.map(s => s.id), ['door-left', 'handle-left']);
  assert.equal(reduced.slots[0].positionMm[1], 405);
});
test('parts-mode server validation requires matching front count while authored legacy models stay valid', () => {
  const input = {modelId:model.id, moduleId:'22222222-2222-4333-8444-555555555555', opening:'doors', variantCode:'BASE-1000-DOUBLE', doorCount:2, drawerCount:0, assemblyMode:'parts', assembly:twoDoors()};
  assert.equal(parseKitchenVariantInput(input).payload.configuration.assemblyMode, 'parts');
  assert.throws(() => parseKitchenVariantInput({...input, assembly:undefined}));
  assert.throws(() => parseKitchenVariantInput({...input, doorCount:1}));
  assert.throws(() => parseKitchenVariantInput({...input, assembly:cabinetSetupAssembly(null, 2, 0, size)}));
  assert.doesNotThrow(() => parseKitchenVariantInput({...input, assemblyMode:'authored', assembly:undefined}));
});
test('guided form renders both doors and only offers matching front models', () => {
  const { AdminKitchenCabinetSetup } = loadSource('src/components/AdminKitchenCabinetSetup.tsx', {'next/dynamic':{default:()=>()=>null}});
  const html = renderToStaticMarkup(React.createElement(AdminKitchenCabinetSetup, {assembly:twoDoors(), models:[model, {...model,id:'22222222-2222-4333-8444-555555555555',name:'Hidden Handle',partKind:'handle'}],baseModel:model,materials:[],onChange(){},onUpload(){}}));
  assert.match(html, /Зүүн хаалга/); assert.match(html, /Баруун хаалга/);
  assert.equal((html.match(/Шинэ GLB оруулах/g)||[]).length, 2);
  assert.doesNotMatch(html, /Hidden Handle/);
});

test('mirrored door reuse opens both fronts outward and separate replacement resets mirroring', () => {
  const THREE = require('three');
  const { composeKitchenGlb, setKitchenGlbOpen } = loadSource('src/three/kitchenGlbComposition.ts');
  const value = reuseCabinetPart(twoDoors(), 'door-right', 'door-left', [model]);
  assert.deepEqual(value.slots[1].scale, [-1,1,1]);
  const parts = new Map(value.slots.map(slot => {
    const group = new THREE.Group(); const mesh = new THREE.Mesh(new THREE.BoxGeometry(.496,.796,.018));
    mesh.position.x=.248; group.add(mesh); return [slot.id,group];
  }));
  const result=composeKitchenGlb(new THREE.Group(),value,{},parts,[0,0,0]);
  setKitchenGlbOpen(result.motions,1); result.root.updateMatrixWorld(true);
  for(const group of parts.values()) assert.ok(group.children[0].getWorldPosition(new THREE.Vector3()).z > .3);
  const replacement=bindCabinetPart(value,'door-right',model).slots[1];
  assert.deepEqual(replacement.scale,[1,1,1]);assert.equal(replacement.motion.amount,100);
});

test('one handle choice places a handle on every front at its free edge, top for base and bottom for wall units', () => {
  const { bindAllHandles, bindFrontHandle, handleSlotId } = loadSource('src/lib/kitchenCabinetSetup.ts');
  const handle = { ...model, id: '33333333-2222-4333-8444-555555555555', name: 'Bar 160', partKind: 'handle', widthMm: 160, heightMm: 12, depthMm: 30 };
  let value = reuseCabinetPart(twoDoors(), 'door-right', 'door-left', [model]);
  const own = bindCabinetPart(value, 'door-right', model);
  for (const [assembly, rightX] of [[value, 456], [own, -456]]) {
    const base = bindAllHandles(assembly, handle, false);
    const handles = base.slots.filter(s => s.kind === 'handle');
    assert.deepEqual(handles.map(s => s.parentSlotId), ['door-left', 'door-right']);
    assert.deepEqual(handles.map(s => s.positionMm), [[456, 318, 9], [rightX, 318, 9]], 'free edge, 80 mm below the top, on the face');
    assert.equal(handles[0].options[0].modelId, handle.id);
    assert.deepEqual(bindAllHandles(assembly, handle, true).slots.find(s => s.id === handleSlotId('door-left')).positionMm, [456, -318, 9]);
    assert.equal(cabinetSetupProblem(base, [model, handle]), null);
    assert.deepEqual(bindAllHandles(base, null, false).slots.map(s => s.id), ['door-left', 'door-right']);
  }
  const drawer = { ...model, partKind: 'drawer', widthMm: 996, heightMm: 196 };
  const drawers = bindCabinetPart(cabinetSetupAssembly(null, 0, 1, size), 'drawer-1', drawer);
  assert.deepEqual(bindAllHandles(drawers, handle, false).slots[1].positionMm, [0, 0, 9], 'drawer handle is centred');
  const pending = bindFrontHandle(twoDoors(), 'door-left', undefined, false);
  assert.equal(pending.slots.find(s => s.id === 'handle-door-left').options[0].modelId, '', 'upload target exists before the GLB is ready');
  assert.deepEqual(bindCabinetPart(pending, 'handle-door-left', handle).slots.find(s => s.id === 'handle-door-left').options[0].modelId, handle.id);
});

test('changing a front re-places its handle and door-count labels follow the current layout', () => {
  const { bindAllHandles, placeFrontHandle } = loadSource('src/lib/kitchenCabinetSetup.ts');
  const handle = { ...model, id: '33333333-2222-4333-8444-555555555555', partKind: 'handle' };
  const wide = { ...model, id: '44444444-2222-4333-8444-555555555555', widthMm: 596 };
  let value = bindAllHandles(twoDoors(), handle, false);
  value = placeFrontHandle(bindCabinetPart(value, 'door-left', wide), 'door-left', false);
  assert.equal(value.slots.find(s => s.id === 'handle-door-left').positionMm[0], 556);
  const single = cabinetSetupAssembly(value, 1, 0, size);
  assert.equal(single.slots[0].label, 'Хаалга');
  assert.equal(single.slots.find(s => s.id === 'handle-door-left').label, 'Хаалга · бариул');
  const double = cabinetSetupAssembly(single, 2, 0, size);
  assert.deepEqual(double.slots.filter(s => s.kind === 'door').map(s => s.label), ['Зүүн хаалга', 'Баруун хаалга']);
  assert.equal(double.slots[0].options[0].modelId, wide.id, 'bound GLB survives the relabel');
});
