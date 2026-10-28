const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSource } = require("./helpers/load-source.cjs");

// Exercise the real GLB writer; only the browser canvas and GPU readback are mocked.
class Reader {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then(data => { this.result = data; this.onloadend?.(); });
  }
}
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
class Canvas {
  constructor(width, height) { this.width = width; this.height = height; }
  getContext() { return { drawImage() {}, translate() {}, scale() {} }; }
  convertToBlob() { return Promise.resolve(new Blob([png], { type: "image/png" })); }
}

async function harness(run) {
  const THREE = await import("three");
  const { GLTFExporter } = await import("three/examples/jsm/exporters/GLTFExporter.js");
  const previous = { FileReader: global.FileReader, OffscreenCanvas: global.OffscreenCanvas };
  global.FileReader = Reader;
  global.OffscreenCanvas = Canvas;
  const contexts = [], decoded = [], snapshotTextures = [];
  class Renderer {
    constructor() { contexts.push(this); }
    dispose() { this.disposed = true; }
    forceContextLoss() { this.lost = true; }
  }
  const { encodeKitchenGlb } = loadSource("src/three/kitchenExport.ts", {
    three: { ...THREE, WebGLRenderer: Renderer },
    "three/examples/jsm/exporters/GLTFExporter.js": { GLTFExporter },
    "three/examples/jsm/utils/WebGLTextureUtils.js": {
      decompress(texture, limit, renderer) {
        const record = { texture, disposed: false };
        texture.addEventListener("dispose", () => { record.disposed = true; });
        snapshotTextures.push(record);
        assert.ok(texture instanceof THREE.CompressedTexture);
        if (texture.name === "broken") throw new Error("GPU readback failed");
        const readable = new THREE.CanvasTexture(new Canvas(1, 1));
        const result = { texture, readable, limit, renderer, disposed: false };
        readable.addEventListener("dispose", () => { result.disposed = true; });
        decoded.push(result);
        return readable;
      },
    },
  });
  try { await run({ THREE, encodeKitchenGlb, contexts, decoded, snapshotTextures }); }
  finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete global[key]; else global[key] = value;
    }
  }
}

function fixture(THREE, compressed = true) {
  const root = new THREE.Group(), geometry = new THREE.BoxGeometry(.8, .74, .598);
  root.userData.kitchenExport = true;
  const texture = compressed
    ? new THREE.CompressedTexture([{ data: new Uint8Array(8), width: 4, height: 4 }], 4, 4)
    : null;
  if (texture) {
    texture.name = "wood-facade";
    texture.flipY = false;
    texture.channel = 1;
    texture.repeat.set(2, 3);
    texture.offset.set(.1, .2);
    texture.center.set(.5, .25);
    texture.rotation = .3;
    texture.matrixAutoUpdate = false;
    texture.updateMatrix();
    texture.userData = { mimeType: "image/ktx2", surface: "wood" };
  }
  geometry.setAttribute("uv1", geometry.attributes.uv.clone());
  const material = new THREE.MeshStandardMaterial({ color: "#99764d", map: texture, emissiveMap: texture });
  root.add(new THREE.Mesh(geometry, material));
  return { root, texture, material, geometry, dispose() { texture?.dispose(); material.dispose(); geometry.dispose(); } };
}

function readGlb(binary) {
  assert.ok(binary instanceof ArrayBuffer);
  const view = new DataView(binary);
  assert.equal(view.getUint32(0, true), 0x46546c67);
  const jsonLength = view.getUint32(12, true);
  const json = JSON.parse(Buffer.from(binary, 20, jsonLength).toString());
  return { json, imageBytes(image) {
    const buffer = json.bufferViews[image.bufferView];
    return Buffer.from(binary, 20 + jsonLength + 8 + buffer.byteOffset, buffer.byteLength);
  } };
}

test("kitchen GLB embeds compressed wood textures and preserves material, UV mapping and displayed resources", async () => {
  await harness(async ({ THREE, encodeKitchenGlb, contexts, decoded, snapshotTextures }) => {
    const item = fixture(THREE), originalDisposed = [];
    for (const resource of [item.texture, item.material, item.geometry])
      resource.addEventListener("dispose", () => { originalDisposed.push(resource); });
    try {
      const { json, imageBytes } = readGlb(await encodeKitchenGlb(item.root));
      assert.equal(json.images.length, 1);
      assert.equal(json.images[0].mimeType, "image/png");
      assert.deepEqual(imageBytes(json.images[0]), png);
      assert.deepEqual(json.materials[0].pbrMetallicRoughness.baseColorFactor, [...item.material.color.toArray(), 1]);
      const mapping = json.materials[0].pbrMetallicRoughness.baseColorTexture;
      assert.equal(mapping.texCoord, 1);
      assert.deepEqual(mapping.extensions.KHR_texture_transform.scale, [2, 3]);
      assert.deepEqual(mapping.extensions.KHR_texture_transform.offset, [.1, .2]);
      assert.equal(mapping.extensions.KHR_texture_transform.rotation, .3);
      assert.equal(decoded.length, 1, "shared color/emissive maps must reuse GPU readback");
      const converted = decoded[0];
      assert.equal(converted.limit, 2048);
      assert.equal(converted.renderer, contexts[0]);
      assert.equal(converted.readable.flipY, true, "keep GPU readback orientation instead of compressed flipY=false");
      assert.equal(converted.readable.channel, item.texture.channel);
      assert.deepEqual(converted.readable.offset.toArray(), item.texture.offset.toArray());
      assert.deepEqual(converted.readable.repeat.toArray(), item.texture.repeat.toArray());
      assert.deepEqual(converted.readable.center.toArray(), item.texture.center.toArray());
      assert.equal(converted.readable.rotation, item.texture.rotation);
      assert.deepEqual(converted.readable.matrix.elements, item.texture.matrix.elements);
      assert.equal(converted.readable.matrixAutoUpdate, false);
      assert.deepEqual(converted.readable.userData, { ...item.texture.userData, mimeType: "image/png" });
      assert.equal(converted.disposed, true);
      assert.ok(snapshotTextures.every(record => record.disposed));
      assert.equal(contexts.length, 1);
      assert.equal(contexts[0].disposed, true);
      assert.equal(contexts[0].lost, true);
      assert.deepEqual(originalDisposed, []);
      assert.equal(item.material.map, item.texture);
      assert.equal(item.material.emissiveMap, item.texture);
      assert.equal(item.texture.flipY, false);
      assert.deepEqual(item.texture.userData, { mimeType: "image/ktx2", surface: "wood" });
    } finally { item.dispose(); }
  });
});

test("kitchen GLB failure releases its temporary textures, GPU context and geometry while preserving the editor scene", async () => {
  await harness(async ({ THREE, encodeKitchenGlb, contexts, decoded, snapshotTextures }) => {
    const item = fixture(THREE), broken = item.texture.clone();
    broken.name = "broken";
    item.material.emissiveMap = broken;
    let sourceDisposed = false, snapshotDisposed = false;
    item.geometry.addEventListener("dispose", () => { sourceDisposed = true; });
    const clone = item.geometry.clone.bind(item.geometry);
    item.geometry.clone = () => {
      const copy = clone();
      copy.addEventListener("dispose", () => { snapshotDisposed = true; });
      return copy;
    };
    try {
      await assert.rejects(encodeKitchenGlb(item.root), /GPU readback failed/);
      assert.equal(decoded.length, 1);
      assert.ok(decoded.every(record => record.disposed));
      assert.ok(snapshotTextures.every(record => record.disposed));
      assert.equal(contexts.length, 1);
      assert.equal(contexts[0].disposed, true);
      assert.equal(contexts[0].lost, true);
      assert.equal(snapshotDisposed, true);
      assert.equal(sourceDisposed, false);
      assert.equal(item.root.children[0].geometry, item.geometry);
      assert.equal(item.material.map, item.texture);
      assert.equal(item.material.emissiveMap, broken);
    } finally { broken.dispose(); item.dispose(); }
  });
});

test("untextured kitchen GLB needs no extra WebGL context", async () => {
  await harness(async ({ THREE, encodeKitchenGlb, contexts, decoded }) => {
    const item = fixture(THREE, false);
    try {
      const { json } = readGlb(await encodeKitchenGlb(item.root));
      assert.equal(json.meshes.length, 1);
      assert.equal(json.images, undefined);
      assert.equal(contexts.length, 0);
      assert.equal(decoded.length, 0);
    } finally { item.dispose(); }
  });
});
