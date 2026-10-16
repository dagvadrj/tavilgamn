// Companion to sofa-quality-bake.py. No source asset or server writes.
import { readFile, writeFile, access } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, draco, meshopt } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import validator from 'gltf-validator';
import sharp from 'sharp';

const { values } = parseArgs({ options: {
  input:{type:'string'}, output:{type:'string'},
  'color-size':{type:'string',default:'2048'}, 'orm-size':{type:'string',default:'1024'},
  'normal-size':{type:'string',default:'2048'}, 'color-quality':{type:'string',default:'92'},
  profile:{type:'string',default:'balanced'}, codec:{type:'string',default:'draco'},
  'orm-codec':{type:'string',default:'uastc'},
  'local-ao-radius':{type:'string'},
}});
if (!values.input || !values.output) throw Error('Supply --input and --output');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const input = path.resolve(values.input), output = path.resolve(values.output);
const folder = path.dirname(output), review = path.join(folder,'delivery-review.glb');
const reserved = [output,review,...['resized-lossless.glb','gpu-textures.glb','etc1s-textures.glb','mixed-textures.glb',
  'gltf-validation.json','review-validation.json','compression-report.json'].map(name=>path.join(folder,name))];
if (reserved.includes(input)) throw Error('Input/output collision');
if (new Set(reserved).size !== reserved.length) throw Error('Output collides with an intermediate filename');
for (const target of reserved) {
  try { await access(target); throw Error(`Output already exists: ${target}`); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
}
if (!['balanced','gpu'].includes(values.profile) || !['draco','meshopt'].includes(values.codec)) throw Error('Invalid profile/codec');
if(!['uastc','etc1s'].includes(values['orm-codec']))throw Error('Invalid ORM codec');
const limits = {color:Number(values['color-size']), data:Number(values['orm-size']), normal:Number(values['normal-size'])};
if (Object.values(limits).some(n=>![512,1024,2048,4096].includes(n))) throw Error('Invalid texture limit');
const quality = Number(values['color-quality']);
if (!(quality >= 1 && quality <= 100)) throw Error('Invalid color quality');
await Promise.all([MeshoptDecoder.ready,MeshoptEncoder.ready]);
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
  'draco3d.encoder':await draco3d.createEncoderModule(),
  'draco3d.decoder':await draco3d.createDecoderModule(),
  'meshopt.encoder':MeshoptEncoder,'meshopt.decoder':MeshoptDecoder,
});
const hash = b=>crypto.createHash('sha256').update(b).digest('hex');
const inputHash = hash(await readFile(input));
const document = await io.read(input);
if(values['local-ao-radius']!==undefined) {
  const radius=Number(values['local-ao-radius']);
  if(!Number.isFinite(radius)||radius<0.005||radius>0.5)throw Error('Invalid local AO radius');
  for(const material of document.getRoot().listMaterials()) {
    if(!material.getOcclusionTexture())throw Error('Local AO marker requires an occlusion texture');
    material.setExtras({...material.getExtras(),qualityBakeOcclusion:1,qualityBakeOcclusionRadiusM:radius});
  }
}
const coreSlots = [
  ['baseColorTexture','getBaseColorTexture','color'],
  ['emissiveTexture','getEmissiveTexture','color'],
  ['normalTexture','getNormalTexture','normal'],
  ['metallicRoughnessTexture','getMetallicRoughnessTexture','data'],
  ['occlusionTexture','getOcclusionTexture','data'],
];
function textureRoles(doc) {
  const result = new Map();
  for (const material of doc.getRoot().listMaterials()) {
    for (const [slot,getter,kind] of coreSlots) {
      const texture = material[getter]();
      if (texture) {
        if (!result.has(texture)) result.set(texture,[]);
        result.get(texture).push({slot,kind});
      }
    }
  }
  return result;
}
function triangles(doc) {
  let count=0;
  for (const node of doc.getRoot().listNodes()) {
    const mesh=node.getMesh(); if (!mesh) continue;
    for(const p of mesh.listPrimitives()) {
      if(p.getMode()!==4) throw Error('Only triangle primitives are supported');
      count+=(p.getIndices()??p.getAttribute('POSITION')).getCount()/3;
    }
  }
  return count;
}
const beforeTriangles = triangles(document);
const roles = textureRoles(document), resized=[];
for (const texture of document.getRoot().listTextures()) {
  const uses=roles.get(texture);
  if(!uses?.length) throw Error(`Unknown/extension texture role: ${texture.getName()}`);
  const kinds=new Set(uses.map(r=>r.kind));
  if(kinds.has('color')&&kinds.size>1) throw Error('A texture is shared by color and non-color roles; separate it before compression');
  const limit=Math.max(...uses.map(r=>limits[r.kind]));
  const bytes=texture.getImage(), metadata=await sharp(bytes).metadata();
  const png=await sharp(bytes).resize({width:limit,height:limit,fit:'inside',withoutEnlargement:true}).png().toBuffer();
  texture.setImage(png).setMimeType('image/png');
  const after=await sharp(png).metadata();
  resized.push({name:texture.getName(),roles:uses.map(r=>r.slot),before:[metadata.width,metadata.height],after:[after.width,after.height]});
}
await document.transform(dedup(),prune());
const resizedPath=path.join(folder,'resized-lossless.glb');
await io.write(resizedPath,document);
const cli=path.join(root,'node_modules/@gltf-transform/cli/bin/cli.js');
async function run(args) {
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[cli,...args],{stdio:'inherit',shell:false,windowsHide:true});
    child.on('error',reject);
    child.on('exit',code=>code===0?resolve():reject(Error(`Texture stage failed (${code})`)));
  });
}
const gpuPath=path.join(folder,'gpu-textures.glb');
await run(['uastc',resizedPath,gpuPath,'--slots',values['orm-codec']==='etc1s'?
  (values.profile==='gpu'?'{baseColorTexture,emissiveTexture,normalTexture}':'normalTexture'):
  (values.profile==='gpu'?'*':'{normalTexture,metallicRoughnessTexture,occlusionTexture}'),
  '--level','3','--rdo','--rdo-lambda','0.5','--zstd','18','--jobs','2']);
let encodedPath=gpuPath;
if(values['orm-codec']==='etc1s') {
  encodedPath=path.join(folder,'etc1s-textures.glb');
  await run(['etc1s',gpuPath,encodedPath,'--slots','{metallicRoughnessTexture,occlusionTexture}',
    '--quality','255','--compression','2','--rdo','false','--jobs','2']);
}
if(values.profile==='balanced') {
  const inputPath=encodedPath;
  encodedPath=path.join(folder,'mixed-textures.glb');
  await run(['webp',inputPath,encodedPath,'--slots','{baseColorTexture,emissiveTexture}','--quality',String(quality)]);
}
const compressed=await io.read(encodedPath);
if(values.codec==='draco') {
  await compressed.transform(draco({method:'sequential',encodeSpeed:5,decodeSpeed:5,quantizePosition:16,quantizeNormal:12,quantizeTexcoord:16,quantizeGeneric:16}));
} else {
  await compressed.transform(meshopt({encoder:MeshoptEncoder,level:'high',quantizePosition:16,quantizeNormal:12,quantizeTexcoord:16}));
}
await io.write(output,compressed);
const finalBytes=await readFile(output);
const validation=await validator.validateBytes(new Uint8Array(finalBytes),{uri:path.basename(output)});
await writeFile(path.join(folder,'gltf-validation.json'),JSON.stringify(validation,null,2)+'\n');
if(validation.issues.numErrors) throw Error(`glTF validation failed: ${validation.issues.numErrors} errors`);
const decoded=await io.read(output);
const geometryDigest=crypto.createHash('sha256');
for(const node of decoded.getRoot().listNodes()) {
  geometryDigest.update(JSON.stringify(node.getMatrix()));
  for(const primitive of node.getMesh()?.listPrimitives()??[]) {
    for(const semantic of primitive.listSemantics().sort()) {
      const accessor=primitive.getAttribute(semantic), array=accessor.getArray();
      geometryDigest.update(JSON.stringify([semantic,accessor.getComponentType(),accessor.getNormalized(),accessor.getCount()]));
      geometryDigest.update(new Uint8Array(array.buffer,array.byteOffset,array.byteLength));
    }
    const indices=primitive.getIndices()?.getArray();
    if(indices)geometryDigest.update(new Uint8Array(indices.buffer,indices.byteOffset,indices.byteLength));
  }
}
const geometrySha256=geometryDigest.digest('hex');
const afterTriangles=triangles(decoded);
if(beforeTriangles!==afterTriangles) throw Error(`Compression changed the triangle count: ${beforeTriangles} -> ${afterTriangles}`);
const encodedTextures=[];
const require=createRequire(import.meta.url);
const BASIS=require(path.join(root,'public/decoders/basis/basis_transcoder.js'));
const basis=await BASIS({wasmBinary:await readFile(path.join(root,'public/decoders/basis/basis_transcoder.wasm'))});
basis.initializeBasis();
const finalRoles=textureRoles(decoded);
for(const texture of decoded.getRoot().listTextures()) {
  const bytes=texture.getImage(), mime=texture.getMimeType();
  let png, dimensions;
  if(mime==='image/ktx2') {
    const file=new basis.KTX2File(bytes);
    try {
      if(!file.startTranscoding()) throw Error('KTX2 review decode failed');
      const info=file.getImageLevelInfo(0,0,0);
      const rgba=new Uint8Array(file.getImageTranscodedSizeInBytes(0,0,0,13));
      if(!file.transcodeImage(rgba,0,0,0,13,0,-1,-1)) throw Error('KTX2 review transcode failed');
      dimensions=[info.width,info.height];
      png=await sharp(rgba,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
    } finally {file.close();file.delete();}
  } else {
    const meta=await sharp(bytes).metadata(); dimensions=[meta.width,meta.height];
    png=await sharp(bytes).png().toBuffer();
  }
  encodedTextures.push({name:texture.getName(),roles:finalRoles.get(texture)?.map(r=>r.slot),mime,dimensions,bytes:bytes.length});
  texture.setImage(png).setMimeType('image/png');
}
for(const extension of decoded.getRoot().listExtensionsUsed()) {
  if(['KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_texture_basisu','EXT_texture_webp'].includes(extension.extensionName)) extension.dispose();
}
await io.write(review,decoded);
const decodedValidation=await validator.validateBytes(new Uint8Array(await readFile(review)),{uri:path.basename(review)});
await writeFile(path.join(folder,'review-validation.json'),JSON.stringify(decodedValidation,null,2)+'\n');
if(decodedValidation.issues.numErrors) throw Error(`Decoded review validation failed: ${decodedValidation.issues.numErrors} errors`);
if(hash(await readFile(input))!==inputHash) throw Error('Intermediate input changed unexpectedly');
const report={profile:values.profile,geometryCodec:values.codec,ormCodec:values['orm-codec'],trianglesBefore:beforeTriangles,trianglesAfter:afterTriangles,
  deliveryBytes:finalBytes.length,deliverySha256:hash(finalBytes),geometrySha256,resized,encodedTextures,
  validation:{errors:validation.issues.numErrors,warnings:validation.issues.numWarnings,
    decodedErrors:decodedValidation.issues.numErrors,decodedWarnings:decodedValidation.issues.numWarnings,
    limitation:'Compressed extension payload coverage depends on the installed validator; decoded review is validated separately'},
  review:'Draco/Meshopt decoded and texture level0 decoded to RGBA32 PNG for Blender review; hardware-native GPU transcode and browser rendering still require verification'};
await writeFile(path.join(folder,'compression-report.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
