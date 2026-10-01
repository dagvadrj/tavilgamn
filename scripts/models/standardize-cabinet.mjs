import { NodeIO, getBounds } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { flatten, transformMesh, prune, metalRough } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder } from 'meshoptimizer';
import { Matrix4 } from 'three';
import { access, mkdir } from 'node:fs/promises';
import path from 'node:path';

// Explicit offline conversion. No scaling or inferred front rotation, no overwrite.
export async function standardizeCabinet(input, output) {
  if (!input || !output || path.resolve(input) === path.resolve(output)) throw new Error('Provide distinct input.glb and new output.glb');
  try { await access(output); throw new Error('Output already exists; choose a new file.'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'draco3d.decoder': await draco3d.createDecoderModule(), 'meshopt.decoder': MeshoptDecoder,
  });
  const doc = await io.read(input), root = doc.getRoot();
  if (root.listExtensionsUsed().some(extension => extension.extensionName === 'KHR_texture_basisu')) throw new Error('KTX2 delivery is audit-only; provide original PNG/JPG textured GLB for Blender processing.');
  if (root.listScenes().length !== 1 || root.listAnimations().length || root.listSkins().length || root.listMeshes().some(mesh => mesh.listPrimitives().some(p => p.listTargets().length))) throw new Error('One static scene required.');
  await doc.transform(metalRough(), flatten());
  const scene = root.getDefaultScene() ?? root.listScenes()[0];
  const bounds = getBounds(scene);
  const offset = new Matrix4().makeTranslation(-(bounds.min[0] + bounds.max[0]) / 2, -bounds.min[1], -(bounds.min[2] + bounds.max[2]) / 2);
  let meshIndex = 0;
  for (const node of scene.listChildren()) {
    const mesh = node.getMesh();
    if (!mesh) { node.dispose(); continue; }
    // Keep front/door/appliance semantic labels used by material classification.
    const semanticName = (mesh.getName() || node.getName()).normalize('NFKD').replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 100);
    const name = `${semanticName || 'mesh'}_${++meshIndex}`;
    const baked = mesh.clone().setName(name);
    const transform = offset.clone().multiply(new Matrix4().fromArray(node.getWorldMatrix()));
    transformMesh(baked, transform.toArray());
    node.setMesh(baked).setTranslation([0, 0, 0]).setRotation([0, 0, 0, 1]).setScale([1, 1, 1]).setName(name);
  }
  root.listMaterials().forEach((material, i) => {
    const semanticName = material.getName().normalize('NFKD').replace(/[^a-zA-Z0-9_.-]+/g, '_').slice(0, 100);
    material.setName(`${semanticName || 'general'}_${i + 1}`);
  });
  scene.setExtras({ ...scene.getExtras(), cabinetStandard: { version: 'cabinet-v1', unit: 'meter', up: '+Y', front: '+Z', origin: 'bottom-center', frontConfirmed: false } });
  for (const extension of root.listExtensionsUsed()) if (['KHR_draco_mesh_compression', 'EXT_meshopt_compression'].includes(extension.extensionName)) extension.dispose();
  await doc.transform(prune());
  await mkdir(path.dirname(path.resolve(output)), { recursive: true });
  await io.write(output, doc);
  return { sourceBounds: bounds, outputBounds: getBounds(scene), output };
}
if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) {
  console.log(JSON.stringify(await standardizeCabinet(process.argv[2], process.argv[3]), null, 2));
}
