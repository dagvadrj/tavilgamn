/** Offline hero derivative. Never writes the catalog source. */
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, weld, simplify, prune, draco, textureCompress } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptSimplifier } from 'meshoptimizer';
import draco3d from 'draco3dgltf';
const [source, destination] = process.argv.slice(2);
if (!source || !destination || path.resolve(source) === path.resolve(destination)) throw new Error('Usage: node scripts/home/prepare-hybrid-model.mjs SOURCE.glb public/interior/hybrid/NAME.glb');
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder, 'draco3d.decoder': await draco3d.createDecoderModule(), 'draco3d.encoder': await draco3d.createEncoderModule() });
const doc = await io.read(source);
const stats = () => ({ triangles: doc.getRoot().listMeshes().reduce((s,m) => s + m.listPrimitives().reduce((n,p) => n + (p.getIndices()?.getCount() || 0)/3, 0), 0), textures: doc.getRoot().listTextures().map(t => ({ size: t.getSize(), encodedBytes: t.getImage()?.byteLength || 0, rgba8WithMipsBytes: (t.getSize()?.[0] || 0) * (t.getSize()?.[1] || 0) * 4 * 4/3 })) });
const before = stats();
// Keep the full authored texture resolution and silhouette; geometry reduction is error bounded.
doc.getRoot().listExtensionsUsed().filter(e => /meshopt|draco/.test(e.extensionName)).forEach(e => e.dispose());
await doc.transform(dedup(), weld(), simplify({ simplifier: MeshoptSimplifier, ratio: .65, error: .00015 }), prune(), textureCompress({ encoder: sharp, targetFormat: 'webp', quality: 93 }), draco({ method: 'edgebreaker', encodeSpeed: 5, decodeSpeed: 5 }));
await fs.mkdir(path.dirname(destination), {recursive:true});
await io.write(destination, doc);
const input = await fs.readFile(source), output = await fs.readFile(destination);
const report = { sourceSha256: crypto.createHash('sha256').update(input).digest('hex'), sourceBytes: input.length, derivativeBytes: output.length, before, after: stats(), textureMemoryNote: 'Estimated uncompressed RGBA8 texture allocation including mip chain; not browser process RAM.' };
await fs.writeFile(destination + '.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
