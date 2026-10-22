// Selected CC0 resources only. Run once to refresh the local, self-hosted assets.
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, textureCompress, simplify, weld } from '@gltf-transform/functions';
import { MeshoptSimplifier } from 'meshoptimizer';
const root = path.resolve('public/interior'), work = path.resolve('model-work/home-interior-cc0');
await fs.mkdir(root, { recursive: true });
await fs.mkdir(work, { recursive: true });
const manifest = [];
async function download(url, destination) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${response.status} ${url}`);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  await fs.writeFile(destination, Buffer.from(await response.arrayBuffer()));
}
async function metadata(id) {
  const response = await fetch(`https://api.polyhaven.com/files/${id}`);
  if (!response.ok) throw new Error(`Asset metadata ${id}: ${response.status}`);
  return response.json();
}
for (const id of ['potted_plant_04', 'throw_pillows_01']) {
  const data = await metadata(id), gltf = data.gltf['1k'].gltf, dir = path.join(work,id);
  await download(gltf.url,path.join(dir,'asset.gltf'));
  for (const [file, value] of Object.entries(gltf.include)) await download(value.url,path.join(dir,file));
  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const document = await io.read(path.join(dir,'asset.gltf'));
  if (id === 'throw_pillows_01') {
    // Retain the scanned cloth shape, use neutral linen, and enforce a mobile
    // geometry budget. Texture compression alone cannot reduce triangle cost.
    for (const material of document.getRoot().listMaterials()) {
      material.setBaseColorTexture(null).setBaseColorFactor([0.87,0.83,0.75,1]);
    }
    await MeshoptSimplifier.ready;
    await document.transform(weld(), simplify({simplifier:MeshoptSimplifier,ratio:0.015,error:0.01}));
  }
  await document.transform(dedup(),prune(),textureCompress({ encoder:sharp, targetFormat:'webp', resize:[1024,1024] }));
  const output = id === 'throw_pillows_01' ? 'neutral-pillows.glb' : `${id}.glb`;
  await io.write(path.join(root,output),document);
  manifest.push({file:output,source:`https://polyhaven.com/a/${id}`,license:'CC0-1.0'});
}
for (const [id, kind, output] of [
  ['plastered_wall_04','nor_gl','plaster-normal.webp'],
  ['fabric_pattern_07','nor_gl','linen-normal.webp'],
  ['fabric_pattern_07','Rough','linen-roughness.webp'],
]) {
  const data = await metadata(id), file = data[kind]['1k'].jpg;
  const response = await fetch(file.url);
  if (!response.ok) throw new Error(`Texture ${id}: ${response.status}`);
  await fs.writeFile(path.join(root,output),await sharp(Buffer.from(await response.arrayBuffer())).resize(512,512).webp({quality:90}).toBuffer());
  manifest.push({file:output,source:`https://polyhaven.com/a/${id}`,license:'CC0-1.0'});
}
const hdr = (await metadata('lebombo')).hdri['1k'].hdr;
await download(hdr.url,path.join(root,'daylight-1k.hdr'));
manifest.push({file:'daylight-1k.hdr',source:'https://polyhaven.com/a/lebombo',license:'CC0-1.0'});
await fs.writeFile(path.join(root,'sources.json'),JSON.stringify({license:'https://polyhaven.com/license',assets:manifest},null,2)+'\n');
console.log('Self-hosted interior assets ready:',manifest.map(a=>a.file).join(', '));
