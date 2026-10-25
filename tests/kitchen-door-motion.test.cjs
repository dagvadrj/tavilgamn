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

test('drawer fronts slide forward and reopening is reversible without creating replacement geometry',()=>{
 const {root,left}=fixture(),geometry=left.geometry;
 const motions=prepareKitchenDoorMotion(root,'drawers');
 const z=motions[0].object.position.z;
 setKitchenGlbOpen(motions,.5);assert.ok(motions[0].object.position.z>z);
 setKitchenGlbOpen(motions,0);near(motions[0].object.position.z,z);
 assert.equal(left.geometry,geometry);
});

test('an indivisible carcass is never animated as if it were a door',()=>{
 const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(1,.84,.6),new THREE.MeshStandardMaterial()));
 assert.deepEqual(prepareKitchenDoorMotion(root,'doors'),[]);
});
