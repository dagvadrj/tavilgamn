const fs = require('fs');
const path = require('path');

const inputPath = process.argv[2];
const outputPath = process.argv[3];
const fullGltfPath = process.argv[4];

if (!inputPath || !outputPath) {
  console.error('Usage: node convert-glb-to-objects.js <input.glb> <output.json>');
  process.exit(1);
}

const data = fs.readFileSync(inputPath);
if (data.length < 20 || data.toString('ascii', 0, 4) !== 'glTF') {
  throw new Error('The input is not a valid GLB file.');
}

const version = data.readUInt32LE(4);
const declaredLength = data.readUInt32LE(8);
if (version !== 2 || declaredLength !== data.length) {
  throw new Error(`Unsupported or damaged GLB (version=${version}, length=${declaredLength}).`);
}

let offset = 12;
let gltf;
let binaryChunk;
while (offset + 8 <= data.length) {
  const chunkLength = data.readUInt32LE(offset);
  const chunkType = data.readUInt32LE(offset + 4);
  const chunkStart = offset + 8;
  const chunkEnd = chunkStart + chunkLength;
  if (chunkEnd > data.length) throw new Error('Damaged GLB chunk length.');
  if (chunkType === 0x4e4f534a) {
    gltf = JSON.parse(data.toString('utf8', chunkStart, chunkEnd).replace(/\u0000+$/g, '').trimEnd());
  } else if (chunkType === 0x004e4942) {
    binaryChunk = data.subarray(chunkStart, chunkEnd);
  }
  offset = chunkEnd;
}

if (!gltf) throw new Error('No JSON chunk was found in the GLB file.');

const nodes = gltf.nodes || [];
const meshes = gltf.meshes || [];
const materials = gltf.materials || [];
const cameras = gltf.cameras || [];

function materialInfo(index) {
  if (index === undefined) return null;
  const material = materials[index] || {};
  return {
    index,
    name: material.name || `Material_${index}`,
    baseColorFactor: material.pbrMetallicRoughness?.baseColorFactor || null,
    metallicFactor: material.pbrMetallicRoughness?.metallicFactor ?? null,
    roughnessFactor: material.pbrMetallicRoughness?.roughnessFactor ?? null,
    alphaMode: material.alphaMode || 'OPAQUE',
    doubleSided: material.doubleSided || false,
  };
}

function meshInfo(index) {
  if (index === undefined) return null;
  const mesh = meshes[index] || {};
  return {
    index,
    name: mesh.name || `Mesh_${index}`,
    primitives: (mesh.primitives || []).map((primitive, primitiveIndex) => ({
      index: primitiveIndex,
      mode: primitive.mode ?? 4,
      vertexCount: primitive.attributes?.POSITION !== undefined
        ? (gltf.accessors?.[primitive.attributes.POSITION]?.count ?? null)
        : null,
      indexCount: primitive.indices !== undefined
        ? (gltf.accessors?.[primitive.indices]?.count ?? null)
        : null,
      attributes: primitive.attributes || {},
      material: materialInfo(primitive.material),
    })),
  };
}

function nodeInfo(index, ancestry = new Set()) {
  const node = nodes[index] || {};
  if (ancestry.has(index)) {
    return { index, name: node.name || `Node_${index}`, circularReference: true };
  }
  const nextAncestry = new Set(ancestry);
  nextAncestry.add(index);
  const result = {
    index,
    name: node.name || `Node_${index}`,
    translation: node.translation || [0, 0, 0],
    rotation: node.rotation || [0, 0, 0, 1],
    scale: node.scale || [1, 1, 1],
    matrix: node.matrix || null,
    mesh: meshInfo(node.mesh),
    camera: node.camera === undefined ? null : {
      index: node.camera,
      name: cameras[node.camera]?.name || `Camera_${node.camera}`,
      type: cameras[node.camera]?.type || null,
    },
    extras: node.extras || null,
    children: (node.children || []).map((childIndex) => nodeInfo(childIndex, nextAncestry)),
  };
  return result;
}

const scenes = (gltf.scenes || []).map((scene, sceneIndex) => ({
  index: sceneIndex,
  name: scene.name || `Scene_${sceneIndex}`,
  objects: (scene.nodes || []).map((nodeIndex) => nodeInfo(nodeIndex)),
}));

const output = {
  source: path.basename(inputPath),
  format: 'GLB/glTF 2.0 object hierarchy',
  defaultScene: gltf.scene ?? 0,
  counts: {
    scenes: scenes.length,
    nodes: nodes.length,
    meshes: meshes.length,
    materials: materials.length,
    textures: gltf.textures?.length || 0,
    images: gltf.images?.length || 0,
    animations: gltf.animations?.length || 0,
  },
  scenes,
};

fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
if (fullGltfPath) {
  const fullGltf = JSON.parse(JSON.stringify(gltf));
  if (binaryChunk && fullGltf.buffers?.[0]) {
    fullGltf.buffers[0].uri = `data:application/octet-stream;base64,${binaryChunk.toString('base64')}`;
  }
  fs.writeFileSync(fullGltfPath, `${JSON.stringify(fullGltf, null, 2)}\n`, 'utf8');
}
console.log(JSON.stringify(output.counts));
