const {test}=require('node:test');
const assert=require('node:assert/strict');
const THREE=require('three');
const {loadSource}=require('./helpers/load-source.cjs');
const {prepareKitchenTextureCoordinates,disposeKitchenTextureCoordinates}=loadSource('src/three/kitchenTextureCoordinates.ts');

function panel(texture=true) {
  const geometry=new THREE.BoxGeometry(.6,.74,.018);geometry.deleteAttribute('uv');
  const map=texture?new THREE.DataTexture(new Uint8Array(4*8*4),4,8):null;
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({map}));
  mesh.position.set(0,.47,.3);
  return mesh;
}

test('a textured GLB front without UVs receives usable coordinates without changing source geometry',()=>{
  const root=new THREE.Group(),front=panel(),original=front.geometry;root.add(front);
  root.position.set(5,2,-9);root.rotation.y=Math.PI/2;
  assert.equal(prepareKitchenTextureCoordinates(root),1);
  assert.notEqual(front.geometry,original);
  assert.equal(original.getAttribute('uv'),undefined);
  const uv=front.geometry.getAttribute('uv');
  assert.equal(uv.count,front.geometry.getAttribute('position').count);
  assert.ok([...uv.array].every(x=>Number.isFinite(x)&&x>=0&&x<=1));
  assert.ok(Math.max(...uv.array)-Math.min(...uv.array)>.1);
  assert.equal(prepareKitchenTextureCoordinates(root),0,'painting again must retain the prepared UVs');
});

test('authored UVs and untextured cabinet geometry stay untouched',()=>{
  const root=new THREE.Group(),authored=panel(),plain=panel(false);
  authored.geometry=new THREE.BoxGeometry(.6,.74,.018);
  const authoredGeometry=authored.geometry,uv=authored.geometry.getAttribute('uv'),plainGeometry=plain.geometry;
  root.add(authored,plain);
  assert.equal(prepareKitchenTextureCoordinates(root),0);
  assert.equal(authored.geometry,authoredGeometry);assert.equal(authored.geometry.getAttribute('uv'),uv);
  assert.equal(plain.geometry,plainGeometry);assert.equal(plain.geometry.getAttribute('uv'),undefined);
});

test('constant or invalid UVs are repaired and only owned geometry is disposed once',()=>{
  const root=new THREE.Group(),front=panel(),source=front.geometry;root.add(front);
  front.geometry.setAttribute('uv',new THREE.Float32BufferAttribute(new Float32Array(front.geometry.getAttribute('position').count*2),2));
  assert.equal(prepareKitchenTextureCoordinates(root),1);
  let sourceDisposed=0,generatedDisposed=0;
  source.addEventListener('dispose',()=>sourceDisposed++);
  front.geometry.addEventListener('dispose',()=>generatedDisposed++);
  disposeKitchenTextureCoordinates(root);disposeKitchenTextureCoordinates(root);
  assert.equal(generatedDisposed,1);assert.equal(sourceDisposed,0);
});

test('adjacent door panels share continuous texture coordinates at their front seam',()=>{
  const root=new THREE.Group(),left=panel(),right=panel();
  left.position.x=-.3;right.position.x=.3;root.add(left,right);
  prepareKitchenTextureCoordinates(root);
  function seam(mesh){const p=mesh.geometry.getAttribute('position'),uv=mesh.geometry.getAttribute('uv');const values=[];for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);if(Math.abs(v.x)<1e-6&&v.y>.8&&v.z>.3)values.push([uv.getX(i),uv.getY(i)]);}return values;}
  const a=seam(left),b=seam(right);assert.ok(a.length&&b.length);
  assert.ok(a.some(v=>b.some(w=>Math.abs(v[0]-w[0])<1e-6&&Math.abs(v[1]-w[1])<1e-6)));
});

test('assembly material replacement prepares missing front UVs too',()=>{
  const {applyKitchenPartMaterial}=loadSource('src/three/kitchenPartMaterial.ts');
  const root=new THREE.Group(),front=panel(false);front.name='Door';root.add(front);
  const map=new THREE.DataTexture(new Uint8Array(16),2,2);
  const release=applyKitchenPartMaterial(root,{baseColor:'#FFFFFF',roughness:.65,metalness:0},{baseColor:map},'front');
  assert.equal(front.material.map,map);assert.ok(front.geometry.getAttribute('uv'));
  release();disposeKitchenTextureCoordinates(root);
});
