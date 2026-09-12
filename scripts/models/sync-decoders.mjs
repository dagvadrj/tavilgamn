import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const threeRoot = path.resolve(path.dirname(require.resolve('three')), '..');
for (const [source, destination, files] of [
  ['examples/jsm/libs/draco/gltf', 'public/decoders/draco', ['draco_decoder.js', 'draco_wasm_wrapper.js', 'draco_decoder.wasm']],
  ['examples/jsm/libs/basis', 'public/decoders/basis', ['basis_transcoder.js', 'basis_transcoder.wasm']],
]) {
  await mkdir(destination, { recursive: true });
  for (const file of files) await copyFile(path.join(threeRoot, source, file), path.join(destination, file));
}
console.log('Matching Three.js Draco/Basis decoders copied to public/decoders.');
