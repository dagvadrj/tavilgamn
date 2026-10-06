const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");

// Browser-only GPU readback is mocked; the actual Three.js GLTFExporter writes the GLB.
class Reader {
  readAsArrayBuffer(blob) { blob.arrayBuffer().then(data => { this.result = data; this.onloadend?.(); }); }
}
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
class Canvas {
  constructor(width, height) { this.width = width; this.height = height; this.flips = 0; }
  getContext() { return { drawImage() {}, translate() {}, scale: () => this.flips++ }; }
  convertToBlob() { return Promise.resolve(new Blob([png], { type: "image/png" })); }
}

async function harness(run) {
  const THREE = await import("three");
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  const previous = { FileReader: global.FileReader, OffscreenCanvas: global.OffscreenCanvas };
  global.FileReader = Reader;
  global.OffscreenCanvas = Canvas;
  const contexts = [], decoded = [], clonedTextures = [];
  class Renderer {
    constructor() { contexts.push(this); }
    dispose() { this.disposed = true; }
    forceContextLoss() { this.lost = true; }
  }
  const { exportProductForAR } = loadSource("src/three/productExport.ts", {
    three: { ...THREE, WebGLRenderer: Renderer },
    "three/examples/jsm/exporters/GLTFExporter.js": { GLTFExporter },
    "three/examples/jsm/utils/WebGLTextureUtils.js": {
      decompress(texture, limit, renderer) {
        const cloned = { texture, disposed: false };
        texture.addEventListener("dispose", () => { cloned.disposed = true; });
        clonedTextures.push(cloned);
        if (texture.name === "broken") throw new Error("GPU readback failed");
        assert.ok(texture instanceof THREE.CompressedTexture);
        const readable = new THREE.CanvasTexture(new Canvas(1, 1));
        const record = { texture, readable, limit, renderer, disposed: false };
        readable.addEventListener("dispose", () => { record.disposed = true; });
        decoded.push(record);
        return readable;
      },
    },
  });
  try { await run({ THREE, exportProductForAR, contexts, decoded, clonedTextures }); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete global[key]; else global[key] = value;
    }
  }
}

function fixture(THREE, compressed = true) {
  const root = new THREE.Group(), geometry = new THREE.BoxGeometry(2, 1, 3);
  const texture = compressed ? new THREE.CompressedTexture([{ data: new Uint8Array(8), width: 4, height: 4 }], 4, 4) : null;
  if (texture) { texture.flipY = false; texture.repeat.set(2, 3); texture.offset.set(.1, .2); }
  const material = new THREE.MeshStandardMaterial({ color: "#224466", map: texture, emissiveMap: texture });
  root.add(new THREE.Mesh(geometry, material));
  return { root, texture, material, geometry, dispose() { texture?.dispose(); material.dispose(); geometry.dispose(); } };
}

test("real AR GLB export decodes compressed textures once, embeds PNG and preserves the selected appearance", async () => {
  await harness(async ({ THREE, exportProductForAR, contexts, decoded, clonedTextures }) => {
    const item = fixture(THREE);
    let originalDisposed = false;
    item.texture.addEventListener("dispose", () => { originalDisposed = true; });
    try {
      const blob = await exportProductForAR(item.root), binary = await blob.arrayBuffer(), view = new DataView(binary);
      assert.equal(blob.type, "model/gltf-binary");
      assert.equal(view.getUint32(0, true), 0x46546c67);
      const json = JSON.parse(Buffer.from(binary, 20, view.getUint32(12, true)).toString());
      assert.equal(json.images[0].mimeType, "image/png");
      const image = json.bufferViews[json.images[0].bufferView];
      const binaryStart = 20 + view.getUint32(12, true) + 8;
      assert.deepEqual(Buffer.from(binary, binaryStart + image.byteOffset, image.byteLength), png);
      assert.deepEqual(json.materials[0].pbrMetallicRoughness.baseColorFactor, [...item.material.color.toArray(), 1]);
      assert.deepEqual(json.materials[0].pbrMetallicRoughness.baseColorTexture.extensions.KHR_texture_transform.scale, [2, 3]);
      assert.equal(decoded.length, 1, "shared maps must reuse the same decoded texture");
      assert.equal(decoded[0].limit, 2048);
      assert.equal(decoded[0].readable.flipY, false);
      assert.equal(decoded[0].disposed, true);
      assert.ok(clonedTextures.every(record => record.disposed));
      assert.equal(contexts.length, 1);
      assert.equal(contexts[0].disposed, true);
      assert.equal(contexts[0].lost, true);
      assert.equal(originalDisposed, false);
      assert.equal(item.material.map, item.texture);
    } finally { item.dispose(); }
  });
});

test("AR export failure releases decoded textures, its GPU context and snapshot without touching the displayed model", async () => {
  await harness(async ({ THREE, exportProductForAR, contexts, decoded, clonedTextures }) => {
    const item = fixture(THREE), broken = item.texture.clone();
    broken.name = "broken"; item.material.emissiveMap = broken;
    let originalDisposed = false, snapshotDisposed = false;
    item.geometry.addEventListener("dispose", () => { originalDisposed = true; });
    const clone = item.geometry.clone.bind(item.geometry);
    item.geometry.clone = () => { const copy = clone(); copy.addEventListener("dispose", () => { snapshotDisposed = true; }); return copy; };
    try {
      await assert.rejects(exportProductForAR(item.root), /GPU readback failed/);
      assert.equal(decoded.length, 1);
      assert.ok(decoded.every(record => record.disposed));
      assert.ok(clonedTextures.every(record => record.disposed));
      assert.equal(contexts[0].disposed, true);
      assert.equal(contexts[0].lost, true);
      assert.equal(snapshotDisposed, true);
      assert.equal(originalDisposed, false);
    } finally { broken.dispose(); item.dispose(); }
  });
});

test("untextured AR products export without creating another WebGL context", async () => {
  await harness(async ({ THREE, exportProductForAR, contexts, decoded }) => {
    const item = fixture(THREE, false);
    try {
      assert.ok((await exportProductForAR(item.root)).size > 0);
      assert.equal(contexts.length, 0);
      assert.equal(decoded.length, 0);
    } finally { item.dispose(); }
  });
});
