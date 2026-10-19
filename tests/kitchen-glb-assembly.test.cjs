const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { loadSource } = require('./helpers/load-source.cjs');
const { parseKitchenGlbAssembly, parseKitchenPartSelections, resolveKitchenPartOption } = loadSource('src/lib/kitchenGlbAssembly.ts');
const { composeKitchenGlb, setKitchenGlbOpen } = loadSource('src/three/kitchenGlbComposition.ts');
const { snapshotKitchen } = loadSource('src/three/kitchenExport.ts');
const { createCabinet } = loadSource('src/lib/kitchenCabinets.ts');
const { createUnifiedKitchen, parseKitchen } = loadSource('src/lib/kitchenAssembly.ts');
const id = '11111111-2222-4333-8444-555555555555';
const option = { id: 'white', label: 'White door', modelId: id };
const slot = (patch = {}) => ({ id: 'door', label: 'Door', kind: 'door', anchorNode: 'door_socket', defaultOptionId: 'white', options: [option], ...patch });
const assembly = (slots = [slot()]) => parseKitchenGlbAssembly({ version: 1, slots });
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-7, `${a} != ${b}`);
test('material IDs survive persistence while arbitrary URLs remain rejected', () => {
  const config = assembly([slot({options:[{...option,materialId:'oak_front',texturePaths:{baseColor:'https://evil'}}]})]);
  assert.equal(config.slots[0].options[0].materialId,'oak_front');
  assert.equal(config.slots[0].options[0].texturePaths,undefined);
  assert.throws(() => assembly([slot({options:[{...option,materialId:'https://evil'}]})]));
});
test('part material overrides preserve UVs and isolate original geometry and child handles', () => {
  const { applyKitchenPartMaterial } = loadSource('src/three/kitchenPartMaterial.ts');
  const { door, handle } = assets();
  const mesh = door.children[1], original = mesh.material, oldMap = new THREE.Texture(); original.map = oldMap;
  const uv = mesh.geometry.getAttribute('uv');
  const dispose = applyKitchenPartMaterial(door,{baseColor:'#ff0000',roughness:.2,metalness:.8},{});
  door.add(handle);
  assert.notEqual(mesh.material,original); assert.equal(mesh.material.map,null);
  assert.equal(mesh.material.color.getHexString(),'ff0000'); assert.equal(mesh.material.metalness,.8);
  assert.equal(original.map,oldMap); assert.equal(mesh.geometry.getAttribute('uv'),uv);
  assert.equal(handle.children[0].material.color.getHexString(),'111111');
  dispose();
});
test('door and drawer motion samples intermediate poses and returns exactly closed', () => {
  const { frame, door, handle } = assets();
  const result = composeKitchenGlb(frame, assembly([slot({motion:{type:'hinge',axis:'y',amount:-90,pivotMm:[-150,0,0]}}),slot({id:'drawer',kind:'drawer',anchorNode:undefined,motion:{type:'slide',axis:'z',amount:400}})]),{},new Map([['door',door],['drawer',handle]]),[0,0,0]);
  setKitchenGlbOpen(result.motions,.5); near(result.motions[0].object.rotation.y,-Math.PI/4); near(result.motions[1].object.position.z,.2);
  setKitchenGlbOpen(result.motions,1); setKitchenGlbOpen(result.motions,.5); near(result.motions[1].object.position.z,.2);
  setKitchenGlbOpen(result.motions,0); near(result.motions[0].object.rotation.y,0); near(result.motions[0].object.position.x,-.15);
});
function assets() {
  const frame = new THREE.Group(), socket = new THREE.Object3D();
  socket.name = 'door_socket'; socket.position.set(.2, .8, .3); frame.add(socket);
  const body = new THREE.Mesh(new THREE.BoxGeometry(.6, .8, .6), new THREE.MeshStandardMaterial({ color: '#765432' }));
  frame.add(body);
  const door = new THREE.Group(), handleSocket = new THREE.Object3D();
  handleSocket.name = 'handle_socket'; handleSocket.position.set(.1, .3, .02); door.add(handleSocket);
  door.add(new THREE.Mesh(new THREE.BoxGeometry(.3, .7, .018), new THREE.MeshStandardMaterial({ color: '#ffffff' })));
  const handle = new THREE.Group(); handle.add(new THREE.Mesh(new THREE.BoxGeometry(.1, .01, .02), new THREE.MeshStandardMaterial({ color: '#111111' })));
  return { frame, door, handle };
}

test('assembly input rejects cycles, duplicate slots and forged asset URLs', () => {
  assert.throws(() => assembly([slot({ parentSlotId: 'handle' }), slot({ id: 'handle', kind: 'handle', parentSlotId: 'door' })]));
  assert.throws(() => assembly([slot(), slot()]));
  assert.throws(() => assembly([slot({ options: [{ ...option, modelId: 'invalid' }] })]));
  const result = assembly([slot({ options: [{ ...option, glbUrl: 'https://untrusted.example/file.glb' }] })]);
  assert.equal(result.slots[0].options[0].glbUrl, undefined);
  assert.throws(() => parseKitchenPartSelections({ door: [] }));
});

test('part selections survive save/restore while empty optional slots remain removed', () => {
  const design = createUnifiedKitchen();
  design.cabinets[0].partSelections = { door: 'white', handle: '' };
  assert.deepEqual(parseKitchen(JSON.parse(JSON.stringify(design))).cabinets[0].partSelections, { door: 'white', handle: '' });
  assert.equal(resolveKitchenPartOption(assembly([slot({ optional: true })]).slots[0], { door: '' }), undefined);
  assert.equal(resolveKitchenPartOption(assembly().slots[0], { door: 'deleted-option' }).id, 'white');
});

test('authored anchor placement and parent handles stay aligned during open and close', () => {
  const { frame, door, handle } = assets();
  const config = assembly([slot({ motion: { type: 'hinge', axis: 'y', amount: -90 } }), slot({ id: 'handle', kind: 'handle', parentSlotId: 'door', anchorNode: 'handle_socket' })]);
  const result = composeKitchenGlb(frame, config, {}, new Map([['door', door], ['handle', handle]]), [0, 0, 0]);
  const point = () => { result.root.updateMatrixWorld(true); return handle.getWorldPosition(new THREE.Vector3()); };
  const closed = point(); near(closed.x, .3); near(closed.y, 1.1); near(closed.z, .32);
  setKitchenGlbOpen(result.motions, true);
  const opened = point(); near(opened.x, .18); near(opened.y, 1.1); near(opened.z, .4);
  setKitchenGlbOpen(result.motions, false); point().toArray().forEach((n, i) => near(n, closed.toArray()[i]));
});

test('removing a door omits dependent handles and swaps preserve body materials', () => {
  const { frame, door } = assets(), bodyColor = frame.children[1].material.color.getHexString();
  const config = assembly([slot({ optional: true }), slot({ id: 'handle', kind: 'handle', parentSlotId: 'door', anchorNode: 'handle_socket' })]);
  const removed = composeKitchenGlb(frame, config, { door: '' }, new Map(), [0, 0, 0]);
  assert.equal(removed.root.getObjectByName('Slot-door'), undefined);
  assert.equal(removed.root.getObjectByName('Slot-handle'), undefined);
  assert.equal(frame.children[1].material.color.getHexString(), bodyColor);
  const next = assets(); next.door.children[1].material.color.set('#446633');
  const result = composeKitchenGlb(next.frame, assembly(), {}, new Map([['door', next.door]]), [0, 0, 0]);
  assert.equal(result.root.getObjectByName('Slot-door').children[0].children[0].children[0], next.door);
  assert.equal(next.frame.children[1].material.color.getHexString(), bodyColor);
  assert.notEqual(next.door.children[1].material.color.getHexString(), door.children[1].material.color.getHexString());
});

test('export retains plain Object3D socket descendants and independent GLB parts', () => {
  const { frame, door, handle } = assets();
  const config = assembly([slot(), slot({ id: 'handle', kind: 'handle', parentSlotId: 'door', anchorNode: 'handle_socket' })]);
  const result = composeKitchenGlb(frame, config, {}, new Map([['door', door], ['handle', handle]]), [0, 0, 0]);
  result.root.userData.kitchenExport = true;
  const snapshot = snapshotKitchen(result.root); let meshes = 0;
  snapshot.scene.traverse(node => { if (node.isMesh) meshes++; });
  assert.equal(meshes, 3); assert.ok(snapshot.scene.getObjectByName('handle_socket')); snapshot.dispose();
});

test('export remaps opening tracks to cloned nodes for multiple cabinets with identical slot names', () => {
  const root = new THREE.Group(); root.userData.kitchenExport = true;
  for (let i=0; i<2; i++) {
    const { frame, door } = assets();
    const result = composeKitchenGlb(frame,assembly([slot({motion:{type:'hinge',axis:'y',amount:-90}})]),{},new Map([['door',door]]),[0,0,0]);
    result.root.position.x = i;
    root.add(result.root);
  }
  const snapshot = snapshotKitchen(root);
  assert.equal(snapshot.animations.length,2);
  const targets = snapshot.animations.map(clip => THREE.PropertyBinding.parseTrackName(clip.tracks[0].name).nodeName);
  assert.equal(new Set(targets).size,2);
  const mixer = new THREE.AnimationMixer(snapshot.scene);
  for(const clip of snapshot.animations) mixer.clipAction(clip).play();
  mixer.setTime(.225);
  for(const target of targets) near(snapshot.scene.getObjectByProperty('uuid',target).rotation.y,-Math.PI/4);
  snapshot.dispose();
});

test('selected product controller renders seven actions and disables unconfigured Open', () => {
  const { KitchenSelectionPanel } = loadSource('src/features/kitchen-planner/components/KitchenSelectionPanel.tsx');
  const html = renderToStaticMarkup(React.createElement(KitchenSelectionPanel, {
    cabinet: createCabinet('base', 'test'), modules: [], onChangeSelections() {}, onReplace() {}, onPositionChange() {}, onClose() {}, onDuplicate() {}, onRemove() {}, onZoom() {}, onToggleOpen() {},
  }));
  for (const name of ["Өөрчлөх","Солих","Нээх","Ойртуулах","Байрлал","Хувилах","Хасах"]) assert.ok(html.includes(`>${name}</span>`));
  assert.match(html, /title="Энэ загвар нээх хөдөлгөөнгүй"[^>]*disabled/);
});

test('real GLB socket audit detects pruning or moving connectors', async () => {
  const { fixture } = require('./helpers/glb-fixture.cjs');
  const fs = require('node:fs/promises'), os = require('node:os'), path = require('node:path');
  const { verifyAssemblySockets } = await import('../scripts/models/assembly-sockets.mjs');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'kitchen-sockets-'));
  const source = path.join(dir, 'source.glb'), output = path.join(dir, 'output.glb');
  const glb = x => Buffer.from(fixture(json => { json.nodes[0].children = [1]; json.nodes.push({ name: 'door_socket', translation: [x, .8, .3] }); }));
  try {
    await fs.writeFile(source, glb(.2)); await fs.writeFile(output, glb(.2)); await verifyAssemblySockets(source, [output]);
    const { execFile } = require('node:child_process');
    const { promisify } = require('node:util');
    await promisify(execFile)(process.execPath, [path.resolve('node_modules/@gltf-transform/cli/bin/cli.js'), 'prune', source, output, '--keep-leaves', 'true'], { windowsHide: true });
    await verifyAssemblySockets(source, [output]);
    await fs.writeFile(output, glb(.3)); await assert.rejects(verifyAssemblySockets(source, [output]), /lost or moved/);
    await fs.writeFile(output, Buffer.from(fixture())); await assert.rejects(verifyAssemblySockets(source, [output]), /lost or moved/);
  } finally { assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep)); await fs.rm(dir, { recursive: true, force: true }); }
});

test('catalog resolves registered part URLs and disables archived part choices', async () => {
  const frameId = '22222222-2222-4333-8444-555555555555', archivedId = '33333333-2222-4333-8444-555555555555';
  const config = assembly([slot({ options: [option, { ...option, id: 'green', modelId: archivedId }] })]);
  const rows = {
    kitchen_modules: [{ id: frameId, code: 'BASE', name: 'Base', cabinet_type: 'base', width_mm: 600, height_mm: 840, depth_mm: 600, active: true }],
    kitchen_module_variants: [{ furniture_model_id: frameId, module_id: frameId, variant_code: 'BASE-WHITE', opening: 'doors', door_count: 1, drawer_count: 0, configuration: { assembly: config }, active: true }],
    furniture_models: [
      { id: frameId, product_id: frameId, name: 'Frame', category: 'kitchen-cabinet', processing_status: 'ready', glb_path: 'r2://bucket/frame.glb' },
      { id, processing_status: 'ready', glb_path: 'r2://bucket/door.glb', thumbnail_path: 'r2://bucket/door.png' },
      { id: archivedId, processing_status: 'ready', glb_path: 'r2://bucket/green.glb', archived_at: '2026-01-01' },
    ],
  };
  const db = { from(name) { return { select() { return this; }, order() { return this; }, eq() { return this; }, in() { return this; }, then(resolve, reject) { return Promise.resolve({ data: rows[name], error: null }).then(resolve, reject); } }; } };
  const { readKitchenModuleCatalog } = loadSource('src/lib/kitchenModuleCatalogServer.ts', { '@/lib/supabase/admin': { getSupabaseAdmin: () => db } });
  const modules = await readKitchenModuleCatalog({}, db);
  const options = modules[0].variants[0].configuration.assembly.slots[0].options;
  assert.equal(options[0].glbFile, 'door.glb');
  assert.equal(options[0].glbUrl, `/api/models/files/${id}/door.glb`);
  assert.equal(options[1].glbFile, null);
});

test('admin saves model references in existing variant configuration and rejects missing anchors', async () => {
  const { NextRequest } = require('next/server');
  const frameId = '22222222-2222-4333-8444-555555555555';
  let stored, anchorExists = true;
  const db = {
    from() { return { select() { return this; }, async in() { return { data: [
      { id: frameId, glb_validation: { nodeNames: anchorExists ? ['door_socket'] : [] } },
      { id, processing_status: 'ready', glb_path: 'door.glb', specifications: { type: 'kitchen-part:door' } },
    ], error: null }; } }; },
    async rpc(name, args) { stored = { name, args }; return { error: null }; },
  };
  const { POST } = loadSource('src/app/api/admin/kitchen-modules/route.ts', {
    '@/lib/supabase/admin': { getSupabaseAdmin: () => db },
    '@/lib/supabase/requireAdmin': { requireAdmin: async () => ({ userId: frameId }) },
  });
  const body = { modelId: frameId, moduleId: frameId, opening: 'doors', variantCode: 'BASE-WHITE', doorCount: 1, drawerCount: 0, assembly: assembly() };
  const request = () => new NextRequest('http://localhost/api/admin/kitchen-modules', { method: 'POST', body: JSON.stringify(body) });
  const saved = await POST(request()); assert.equal(saved.status, 201);
  assert.equal(stored.name, 'save_kitchen_module_variant');
  assert.equal(stored.args.p_payload.configuration.assembly.slots[0].options[0].modelId, id);
  assert.equal(stored.args.p_payload.configuration.assembly.slots[0].options[0].glbUrl, undefined);
  stored = undefined; anchorExists = false;
  assert.equal((await POST(request())).status, 400); assert.equal(stored, undefined);
});

test('admin rejects inactive or wrong-surface part materials before saving the variant', async () => {
  const { NextRequest } = require('next/server');
  const frameId='22222222-2222-4333-8444-555555555555';
  let materials=[], saves=0;
  const db = { from(table) { return {select(){return this;},in(){return this;},eq(){return this;},then(resolve,reject){return Promise.resolve({data:table==='material_definitions'?materials:[{id:frameId},{id,processing_status:'ready',glb_path:'door.glb',specifications:{type:'kitchen-part:door'}}],error:null}).then(resolve,reject);}};}, async rpc(){saves++;return {error:null};}};
  const { POST } = loadSource('src/app/api/admin/kitchen-modules/route.ts',{'@/lib/supabase/admin':{getSupabaseAdmin:()=>db},'@/lib/supabase/requireAdmin':{requireAdmin:async()=>({userId:frameId})}});
  const body={modelId:frameId,moduleId:frameId,opening:'doors',variantCode:'BASE-WHITE',doorCount:1,drawerCount:0,assembly:assembly([slot({anchorNode:undefined,options:[{...option,materialId:'oak'}]})])};
  const request=()=>new NextRequest('http://localhost/api/admin/kitchen-modules',{method:'POST',body:JSON.stringify(body)});
  assert.equal((await POST(request())).status,400);
  materials=[{id:'oak',surface_kind:'handle'}]; assert.equal((await POST(request())).status,400); assert.equal(saves,0);
  materials=[{id:'oak',surface_kind:'front'}]; assert.equal((await POST(request())).status,201); assert.equal(saves,1);
});
