const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { loadSource } = require('./helpers/load-source.cjs');
const { snapshotKitchen, kitchenExportFilename } = loadSource('src/three/kitchenExport.ts');
const server = loadSource('src/lib/skpExport.ts');
const { NextRequest } = require('next/server');

test('snapshot contains every cabinet part but excludes floor, walls and selection helpers', () => {
  const scene = new THREE.Scene(), root = new THREE.Group(); root.userData.kitchenExport = true; scene.add(root);
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(8, .1, 6)), new THREE.GridHelper());
  const cabinet = new THREE.Group(); cabinet.name = 'Cabinet'; cabinet.position.set(1, .7, 2); cabinet.rotation.y = .4; root.add(cabinet);
  const map = new THREE.DataTexture(new Uint8Array([255, 240, 230, 255]), 1, 1);
  const material = new THREE.MeshStandardMaterial({ map, color: '#ad895d' });
  for (const name of ['Back', 'Shelf', 'Door', 'Handle', 'Sink', 'Countertop']) {
    const part = new THREE.Mesh(new THREE.BoxGeometry(.6, .1, .5), material); part.name = name; cabinet.add(part);
  }
  const marker = new THREE.Mesh(new THREE.BoxGeometry(20, 20, 20)); marker.userData.exportExclude = true; marker.add(new THREE.LineSegments()); cabinet.add(marker);
  const result = snapshotKitchen(root), names = []; result.scene.traverse(node => { if (node.isMesh) names.push(node.name); });
  assert.deepEqual(names, ['Back', 'Shelf', 'Door', 'Handle', 'Sink', 'Countertop']);
  const part = result.scene.getObjectByName('Door');
  assert.notEqual(part.material, material); assert.notEqual(part.material.map, map);
  assert.notEqual(part.geometry, cabinet.getObjectByName('Door').geometry);
  assert.ok(part.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(1, .7, 2)) < 1e-9);
  let disposed = false; material.addEventListener('dispose', () => { disposed = true; }); result.dispose();
  assert.equal(disposed, false); assert.equal(marker.parent, cabinet); assert.equal(cabinet.children.length, 7);
});

test('export rejects whole scenes and empty assemblies; filenames preserve Mongolian safely', () => {
  assert.throws(() => snapshotKitchen(new THREE.Group()));
  const group = new THREE.Group(); group.userData.kitchenExport = true;
  assert.throws(() => snapshotKitchen(group));
  assert.equal(kitchenExportFilename('Миний гал тогоо', 'glb'), 'Миний гал тогоо.glb');
  assert.equal(kitchenExportFilename('../a:b', 'skp'), '-a-b.skp');
  assert.equal(kitchenExportFilename(' . ', 'glb'), 'kitchen.glb');
});

function glb(json) {
  const text = JSON.stringify(json), padded = text + ' '.repeat((4 - Buffer.byteLength(text) % 4) % 4);
  const data = Buffer.alloc(20 + Buffer.byteLength(padded));
  data.writeUInt32LE(0x46546c67); data.writeUInt32LE(2, 4); data.writeUInt32LE(data.length, 8);
  data.writeUInt32LE(Buffer.byteLength(padded), 12); data.writeUInt32LE(0x4e4f534a, 16); data.write(padded, 20); return data;
}
const marker = { nodes: [{ extras: { kitchenExport: true } }] };
test('converter input is bounded and must be a self-contained kitchen GLB', async () => {
  assert.doesNotThrow(() => server.validateKitchenGlb(glb(marker)));
  assert.throws(() => server.validateKitchenGlb(glb({})), /Kitchen/);
  assert.throws(() => server.validateKitchenGlb(glb({ ...marker, images: [{ uri: 'https://example.com/image.png' }] })), /GLB/);
  assert.throws(() => server.validateKitchenGlb(Buffer.from('invalid')));
  await assert.rejects(server.readBoundedBody(new Blob([Buffer.alloc(9)]).stream(), 8), error => error.status === 413);
  assert.equal((await server.readBoundedBody(new Blob(['test']).stream(), 8)).toString(), 'test');
});

test('SKP route never claims a download without a configured converter and rejects cross-origin requests', async () => {
  let config = null, converted = 0;
  const route = loadSource('src/app/api/kitchen/export/skp/route.ts', {
    '@/lib/skpExport': { ...server, skpConverterConfig: () => config, convertKitchenSkp: async () => { converted++; return Buffer.from('SKP fixture'); } },
  });
  assert.deepEqual(await (await route.GET()).json(), { available: false });
  const request = origin => new NextRequest('http://localhost:3105/api/kitchen/export/skp', { method: 'POST',
    headers: { host: '127.0.0.1:3105', origin, 'Content-Type': 'model/gltf-binary' }, body: glb(marker) });
  assert.equal((await route.POST(request('http://127.0.0.1:3105'))).status, 503);
  config = {};
  assert.equal((await route.POST(request('https://foreign.example'))).status, 403);
  const response = await route.POST(request('http://127.0.0.1:3105'));
  assert.equal(response.status, 200); assert.match(response.headers.get('content-disposition'), /kitchen.skp/);
  assert.equal(converted, 1);
});

test('converter rejects non-SKP responses and does not forward credentials across redirects', async () => {
  const beforeUrl = process.env.SKP_CONVERTER_URL, beforeToken = process.env.SKP_CONVERTER_TOKEN, beforeFetch = global.fetch;
  try {
    process.env.SKP_CONVERTER_URL = 'https://converter.example'; process.env.SKP_CONVERTER_TOKEN = 'test-token';
    global.fetch = async (_, options) => { assert.equal(options.redirect, 'error'); assert.equal(options.headers.Authorization, 'Bearer test-token'); return new Response('not a sketchup file'); };
    await assert.rejects(server.convertKitchenSkp(glb(marker)), error => error.status === 502);
    global.fetch = async () => new Response(Buffer.concat([Buffer.alloc(4), Buffer.from('SketchUp Model', 'utf16le'), Buffer.alloc(20)]));
    assert.ok((await server.convertKitchenSkp(glb(marker))).length > 32);
  } finally {
    if (beforeUrl === undefined) delete process.env.SKP_CONVERTER_URL; else process.env.SKP_CONVERTER_URL = beforeUrl;
    if (beforeToken === undefined) delete process.env.SKP_CONVERTER_TOKEN; else process.env.SKP_CONVERTER_TOKEN = beforeToken;
    global.fetch = beforeFetch;
  }
});
