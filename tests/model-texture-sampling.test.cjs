const {test}=require('node:test');
const assert=require('node:assert/strict');
const THREE=require('three');
const {loadSource}=require('./helpers/load-source.cjs');
const {configureModelTextureSampling}=loadSource('src/three/modelTextureSampling.ts');
const renderer=maximum=>({capabilities:{getMaxAnisotropy:()=>maximum}});

test('grazing-angle filtering respects the GPU limit and never changes texture content or transforms',()=>{
  const color=new THREE.Texture({width:2048,height:2048}),normal=new THREE.Texture();
  color.colorSpace=THREE.SRGBColorSpace;normal.colorSpace=THREE.NoColorSpace;
  color.repeat.set(2,3);color.offset.set(.1,.2);color.channel=1;
  const scene=new THREE.Group(),material=new THREE.MeshStandardMaterial({map:color,normalMap:normal});
  scene.add(new THREE.Mesh(new THREE.BoxGeometry(),material),new THREE.Mesh(new THREE.BoxGeometry(),material));
  const image=color.image,source=color.source,version=color.version;
  configureModelTextureSampling(scene,renderer(16));
  assert.equal(color.anisotropy,4);assert.equal(normal.anisotropy,4);
  assert.equal(color.version,version+1,'shared textures update once');
  configureModelTextureSampling(scene,renderer(16));assert.equal(color.version,version+1);
  assert.equal(color.image,image);assert.equal(color.source,source);
  assert.equal(color.colorSpace,THREE.SRGBColorSpace);assert.equal(normal.colorSpace,THREE.NoColorSpace);
  assert.deepEqual(color.repeat.toArray(),[2,3]);assert.deepEqual(color.offset.toArray(),[.1,.2]);assert.equal(color.channel,1);
  configureModelTextureSampling(scene,renderer(2));assert.equal(color.anisotropy,2);
  configureModelTextureSampling(scene,renderer(1));assert.equal(color.anisotropy,1);
});

test('nearest and no-mip samplers remain authored; compressed GPU textures can use anisotropy',()=>{
  const nearest=new THREE.Texture(),noMips=new THREE.Texture(),compressed=new THREE.CompressedTexture();
  nearest.magFilter=THREE.NearestFilter;noMips.minFilter=THREE.LinearFilter;
  compressed.magFilter=THREE.LinearFilter;compressed.minFilter=THREE.LinearMipmapLinearFilter;
  const scene=new THREE.Group();scene.add(new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial({map:nearest,roughnessMap:noMips,normalMap:compressed})));
  configureModelTextureSampling(scene,renderer(8));
  assert.equal(nearest.anisotropy,1);assert.equal(noMips.anisotropy,1);assert.equal(compressed.anisotropy,4);
  configureModelTextureSampling(scene,{});assert.equal(compressed.anisotropy,1);
  configureModelTextureSampling(scene,renderer(NaN));assert.equal(compressed.anisotropy,1);
});
