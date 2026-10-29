const {test}=require('node:test');
const assert=require('node:assert/strict');
const THREE=require('three');
const {loadSource}=require('./helpers/load-source.cjs');
const {prepareKitchenDoorMotion}=loadSource('src/three/kitchenDoorMotion.ts');
const {setKitchenGlbOpen}=loadSource('src/three/kitchenGlbComposition.ts');
function fixture(){
 const root=new THREE.Group(),material=new THREE.MeshStandardMaterial();
 const add=(name,size,at)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.name=name;mesh.position.fromArray(at);root.add(mesh);return mesh;};
 const body=add('carcass',[1,.84,.58],[0,.42,0]);
 const left=add('door-left',[.396,.73,.018],[-.3,.475,.299]);
 const right=add('door-right',[.596,.73,.018],[.2,.475,.299]);
 const handle=add('handle-left',[.014,.12,.028],[-.12,.5,.325]);
 const leg=add('foot',[.04,.08,.04],[-.4,.04,.2]);
 return {root,body,left,right,handle,leg};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);

test('existing fronts hinge on their outside edges, handles follow, body and feet stay fixed',()=>{
 const {root,body,left,right,handle,leg}=fixture();
 root.rotation.y=.4;root.position.set(2,0,1);root.updateMatrixWorld(true);
 const closed=new THREE.Box3().setFromObject(root),bodyMatrix=body.matrixWorld.clone(),legMatrix=leg.matrixWorld.clone();
 const motions=prepareKitchenDoorMotion(root,'doors');
 assert.equal(motions.length,2);assert.equal(left.parent,handle.parent);
 assert.equal(body.parent,root);assert.equal(leg.parent,root);
 near(motions[0].object.position.x,-.498);near(motions[1].object.position.x,.498);
 const prepared=new THREE.Box3().setFromObject(root);for(const key of ['min','max'])for(const axis of ['x','y','z'])near(prepared[key][axis],closed[key][axis]);
 setKitchenGlbOpen(motions,1);root.updateMatrixWorld(true);
 assert.equal(motions[0].motion.amount,-90);assert.equal(motions[1].motion.amount,90);
 assert.deepEqual(body.matrixWorld.elements,bodyMatrix.elements);assert.deepEqual(leg.matrixWorld.elements,legMatrix.elements);
 assert.ok(Math.abs(left.parent.rotation.y)>1.5);
 setKitchenGlbOpen(motions,0);root.updateMatrixWorld(true);
 const restored=new THREE.Box3().setFromObject(root);for(const key of ['min','max'])for(const axis of ['x','y','z'])near(restored[key][axis],closed[key][axis]);
});

function box(root,name,size,at){const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial());mesh.name=name;mesh.position.fromArray(at);root.add(mesh);return mesh;}

test('drawer fronts slide forward and reopening is reversible without creating replacement geometry',()=>{
 const root=new THREE.Group();
 box(root,'carcass',[.6,.84,.58],[0,.42,0]);
 const left=box(root,'front-a',[.596,.26,.018],[0,.7,.299]);
 box(root,'front-b',[.596,.26,.018],[0,.42,.299]);
 const geometry=left.geometry;
 const motions=prepareKitchenDoorMotion(root,'drawers');
 assert.ok(motions.every(item=>item.kind==='drawer'));
 const z=motions[0].object.position.z;
 setKitchenGlbOpen(motions,.5);assert.ok(motions[0].object.position.z>z);
 setKitchenGlbOpen(motions,0);near(motions[0].object.position.z,z);
 assert.equal(left.geometry,geometry);
});

test('an indivisible carcass is never animated as if it were a door',()=>{
 const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(1,.84,.6),new THREE.MeshStandardMaterial()));
 assert.deepEqual(prepareKitchenDoorMotion(root,'doors'),[]);
});

test('a mixed cabinet keeps its tall front a door and its low front a drawer',()=>{
 const root=new THREE.Group();
 box(root,'carcass',[.6,.84,.58],[0,.42,0]);
 box(root,'Plane.010',[.596,.18,.018],[0,.74,.299]);
 box(root,'Plane.011',[.596,.6,.018],[0,.33,.299]);
 const motions=prepareKitchenDoorMotion(root,'drawers');
 assert.deepEqual(motions.map(item=>item.kind),['drawer','door']);
});

test('an unnamed handle near the left edge puts a single door hinge on the right',()=>{
 const root=new THREE.Group();
 box(root,'carcass',[.6,.84,.58],[0,.42,0]);
 const door=box(root,'Plane.001',[.596,.8,.018],[0,.42,.299]);
 const handle=box(root,'Cylinder.003',[.012,.15,.03],[-.25,.6,.323]);
 const [front]=prepareKitchenDoorMotion(root,'doors');
 assert.equal(front.handles,1);assert.equal(handle.parent,door.parent);
 assert.equal(front.hinge,'right');assert.equal(front.motion.amount,90);
 near(front.object.position.x,.298);
});

test('admin overrides replace the detected kind and hinge side by mesh key',()=>{
 const make=()=>{const root=new THREE.Group();box(root,'carcass',[.6,.84,.58],[0,.42,0]);box(root,'door',[.596,.8,.018],[0,.42,.299]);return root;};
 const [detected]=prepareKitchenDoorMotion(make(),'doors');
 assert.equal(detected.hinge,'left');
 const [right]=prepareKitchenDoorMotion(make(),'doors',{[detected.key]:{kind:'door',hinge:'right'}});
 assert.equal(right.hinge,'right');assert.ok(right.corrected);
 const [fixed]=prepareKitchenDoorMotion(make(),'doors',{[detected.key]:{kind:'fixed'}});
 setKitchenGlbOpen([fixed],1);near(fixed.object.position.z,fixed.closedPosition[2]);assert.equal(fixed.object.rotation.y,0);
});
