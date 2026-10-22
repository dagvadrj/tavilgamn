const {test}=require('node:test');
const assert=require('node:assert/strict');
const THREE=require('three');
const {loadSource}=require('./helpers/load-source.cjs');
const {applyRoomCutaway,cutawayRaycast}=loadSource('src/three/roomCutaway.ts');
const {roomFloorFinish}=loadSource('src/three/roomFloorFinish.ts');

test('a hidden wall loses every color contribution, preserves physical shadows and restores authored transparency',()=>{
  const root=new THREE.Group(),trim=new THREE.Group();trim.userData.cutawayDecoration=true;
  const opaque=new THREE.MeshStandardMaterial(),glass=new THREE.MeshPhysicalMaterial({transparent:true,opacity:.3,depthWrite:false});
  const wall=new THREE.Mesh(new THREE.BoxGeometry(),opaque);wall.castShadow=true;
  const pane=new THREE.Mesh(new THREE.BoxGeometry(),glass);pane.castShadow=false;
  const line=new THREE.LineSegments(new THREE.BufferGeometry(),new THREE.LineBasicMaterial({color:'#006ab5'}));
  trim.add(line);root.add(wall,pane,trim);
  applyRoomCutaway(root,.5);assert.equal(opaque.opacity,.5);assert.equal(glass.opacity,.15);
  const version=opaque.version;applyRoomCutaway(root,.25);assert.equal(opaque.version,version);
  applyRoomCutaway(root,0);
  for(const material of [opaque,glass,line.material]){assert.equal(material.opacity,0);assert.equal(material.colorWrite,false);assert.equal(material.depthWrite,false);}
  assert.equal(wall.visible,true);assert.equal(wall.castShadow,true,'invisible walls still block exterior sun');
  assert.equal(pane.castShadow,false);assert.equal(trim.visible,false);
  applyRoomCutaway(root,1);
  assert.equal(opaque.opacity,1);assert.equal(opaque.transparent,false);assert.equal(opaque.depthWrite,true);assert.equal(opaque.colorWrite,true);
  assert.equal(glass.opacity,.3);assert.equal(glass.transparent,true);assert.equal(glass.depthWrite,false);assert.equal(trim.visible,true);
});

test('hidden trim stops pointer recursion while an invisible perimeter edit target remains usable',()=>{
  const root=new THREE.Group(),trim=new THREE.Group();trim.userData.cutawayDecoration=true;trim.raycast=cutawayRaycast;
  let trimHits=0,editHits=0;
  const decorative=new THREE.Mesh();decorative.raycast=()=>{trimHits++};trim.add(decorative);
  const hit=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial({opacity:0,transparent:true,colorWrite:false,depthWrite:false}));hit.raycast=()=>{editHits++};
  root.add(trim,hit);applyRoomCutaway(root,0);
  new THREE.Raycaster().intersectObject(root,true);
  assert.equal(trimHits,0);assert.equal(editHits,1);assert.equal(hit.material.colorWrite,false);
  applyRoomCutaway(root,1);new THREE.Raycaster().intersectObject(root,true);
  assert.equal(trimHits,1);assert.equal(editHits,2);assert.equal(hit.material.opacity,0);
});

test('a selected opening disappears completely outside, keeps its shadow and returns inside',()=>{
  let frame;
  const camera=new THREE.PerspectiveCamera();
  const {OpeningMesh}=loadSource('src/three/OpeningMesh.tsx',{
    react:{...require('react'),useRef:v=>({current:v}),useState:v=>[v,()=>{}],useEffect:()=>{}},
    '@react-three/fiber':{useThree:()=>({camera,gl:{domElement:{}}}),useFrame:fn=>{frame=fn}},
  });
  const opening={id:'window',kind:'window',templateId:'window-fixed',wallId:'north',position:.5,width:1.2,height:1.2,sillHeight:.9,hinge:'left',swing:'inward',open:false};
  const props={design:{width:4,depth:4,height:2.7},opening,selected:true,view:'perspective',onDragChange(){}};
  const tree=OpeningMesh(props),root=new THREE.Group();root.position.fromArray(tree.props.position);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());mesh.castShadow=true;root.add(mesh);tree.props.ref.current=root;
  const state={camera,invalidate(){}};camera.position.set(0,1.5,-3);
  for(let i=0;i<100;i++)frame(state,1/60);
  assert.equal(mesh.material.opacity,0);assert.equal(mesh.material.colorWrite,false);assert.equal(mesh.castShadow,true);
  assert.equal(tree.props.raycast.call(root),false);
  camera.position.z=0;for(let i=0;i<100;i++)frame(state,1/60);
  assert.equal(mesh.material.opacity,1);assert.equal(mesh.material.transparent,false);assert.equal(mesh.material.colorWrite,true);
});

test('wood gets a satin reflection response while carpet and unknown finishes remain matte',()=>{
  const normal=new THREE.Texture(),scale=new THREE.Vector2(.32,.32);
  for(const id of ['parquet-oak','laminate-ash']){
    const finish=roomFloorFinish(id,{roughness:1,normalMap:normal,normalScale:scale});
    assert.equal(finish.roughness,.68);assert.equal(finish.clearcoat,.18);assert.equal(finish.clearcoatNormalMap,normal);assert.equal(finish.clearcoatNormalScale,scale);assert.equal(finish.metalness,0);
  }
  for(const id of ['carpet-sand',undefined]){
    const finish=roomFloorFinish(id,{roughness:.97,normalMap:normal});
    assert.equal(finish.roughness,.97);assert.equal(finish.clearcoat,0);assert.equal(finish.clearcoatNormalMap,null);
  }
});
