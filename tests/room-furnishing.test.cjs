const { test } = require('node:test');
const assert = require('node:assert/strict');
const THREE = require('three');
const { loadSource } = require('./helpers/load-source.cjs');
const custom = (id,w=1,d=.6,h=.8) => ({instanceId:id,productId:id,x:0,z:0,rotation:0,color:'#abc123',material:'wood',details:{name:id,dimensions:{w,d,h}}});

test('empty, preset and user furniture respect physical size and report pieces that cannot fit', () => {
  const { furnishRoom }=loadSource('src/lib/roomFurnishing.ts');
  const { isPlacementValid }=loadSource('src/three/collision.ts');
  const room={width:5,depth:4,height:2.7};
  const products=['sofa','coffee-table','tv-stand'].map((category,i)=>({id:category,name:category,category,inStock:true,model:{file:'x.glb'},defaultColor:'#abc123',materials:[{id:'wood'}],dimensions:{w:1.1,d:.6,h:.8}}));
  assert.equal(furnishRoom(room,'living',{furnishing:'empty'},products,[]).pieces.length,0);
  const preset=furnishRoom(room,'living',{furnishing:'preset'},products,[]);
  assert.equal(preset.pieces.length,3);
  preset.pieces.forEach(piece=>assert.equal(isPlacementValid(piece,preset.pieces,room),true));
  const library=[{id:'desk',name:'Desk',piece:custom('desk'),dimensions:{w:1,d:.6,h:.8},quantity:2},{id:'huge',name:'Too large',piece:custom('huge',9,9),dimensions:{w:9,d:9,h:.8},quantity:1}];
  const result=furnishRoom(room,'office',{furnishing:'mine',furnitureIds:['desk','huge']},products,library);
  assert.equal(result.pieces.length,2);assert.deepEqual(result.skipped,['Too large']);
  assert.equal(new Set(result.pieces.map(p=>p.instanceId)).size,2);
  assert.ok(result.pieces.every(p=>p.details.dimensions.w===1 && p.details.dimensions.d===.6));
  result.pieces.forEach(piece=>assert.equal(isPlacementValid(piece,result.pieces,room),true));
});

test('profile furniture is retained per owner, preserves quantities and keeps room copies independent', () => {
  const oldWindow=global.window,oldStorage=global.localStorage,records=new Map();
  global.localStorage={getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)};global.window={localStorage:global.localStorage};
  try {
    const { useDesigns:store,setDesignOwner }=loadSource('src/store/designs.ts');
    store.getState().createNew('40','Plan','living',{width:4,depth:4,height:2.7});
    const piece=custom('own-desk');store.getState().rememberFurniture(piece,3);store.getState().rememberFurniture(piece);
    assert.equal(store.getState().furniture.length,1);assert.equal(store.getState().furniture[0].quantity,3);
    store.getState().updatePieces([piece]);const main=store.getState().current.activeRoomId;
    store.getState().duplicateRoom(main);let design=store.getState().current;
    assert.equal(design.rooms.length,2);assert.notEqual(design.pieces[0].instanceId,piece.instanceId);
    design.pieces[0].details.dimensions.w=2;assert.equal(design.rooms.find(r=>r.id===main).pieces[0].details.dimensions.w,1);
    const copied=design.activeRoomId;assert.equal(store.getState().removeRoom(copied),null);assert.equal(store.getState().current.rooms.length,1);
    store.getState().undo();assert.equal(store.getState().current.rooms.length,2);
    store.getState().redo();assert.equal(store.getState().current.rooms.length,1);
    assert.ok(store.getState().removeRoom(main));
    const id=store.getState().current.id,before=store.getState().past.length;
    store.getState().savePreview(id,'data:image/jpeg;base64,abc');assert.equal(store.getState().past.length,before);
    store.getState().savePreview('wrong','data:image/jpeg;base64,wrong');assert.equal(store.getState().current.previewImage,'data:image/jpeg;base64,abc');
    setDesignOwner('other');assert.equal(store.getState().furniture.length,0);
    setDesignOwner(null);assert.equal(store.getState().furniture[0].name,'own-desk');assert.equal(store.getState().furniture[0].quantity,3);
    assert.equal(store.getState().current.previewImage,'data:image/jpeg;base64,abc');
  } finally {global.window=oldWindow;global.localStorage=oldStorage;}
});

test('preview uses a separate fitted camera and restores renderer, walls and ceilings even on failure', () => {
  const { captureRoomPreview }=loadSource('src/three/RoomPreviewCapture.tsx');
  const oldDocument=global.document;
  const ctx={createImageData:(w,h)=>({data:new Uint8ClampedArray(w*h*4)}),putImageData(){},beginPath(){},roundRect(){},fill(){},fillText(){}};
  global.document={createElement:()=>({getContext:()=>ctx,toDataURL:()=> 'data:image/jpeg;base64,preview'})};
  const scene=new THREE.Scene();scene.background=new THREE.Color('#ffffff');
  const wall=new THREE.Mesh(new THREE.BoxGeometry(4,2.7,.2),new THREE.MeshStandardMaterial({opacity:.3,transparent:true,depthWrite:false}));wall.userData.previewWall={nx:0,nz:1};scene.add(wall);
  const roof=new THREE.Mesh(new THREE.BoxGeometry(4,.1,4),new THREE.MeshBasicMaterial());roof.userData.previewRoof=true;scene.add(roof);
  const liveCamera=new THREE.PerspectiveCamera();liveCamera.position.set(1,1.6,1);const original=liveCamera.matrixWorld.clone();
  let renderCamera,fail=false;const previous={name:'old-target'},viewport=new THREE.Vector4(1,2,300,200),scissor=viewport.clone();let currentTarget=previous,scissorTest=true;
  const gl={getRenderTarget:()=>currentTarget,setRenderTarget:t=>currentTarget=t,getViewport:v=>v.copy(viewport),setViewport:v=>assert.deepEqual(v.toArray(),viewport.toArray()),getScissor:v=>v.copy(scissor),setScissor:v=>assert.deepEqual(v.toArray(),scissor.toArray()),getScissorTest:()=>scissorTest,setScissorTest:v=>scissorTest=v,clear(){},render(s,c){renderCamera=c;assert.equal(roof.visible,false);if(fail)throw new Error('context lost');},readRenderTargetPixels(){}};
  try {
    assert.equal(captureRoomPreview(gl,scene,{minX:-2,maxX:12,minZ:-2,maxZ:3},2.7,[],{x:0,z:0}),'data:image/jpeg;base64,preview');
    assert.notEqual(renderCamera,liveCamera);
    let extent=0;
    for(const x of [-2,12])for(const y of [0,2.7])for(const z of [-2,3]) {
      const p=new THREE.Vector3(x,y,z).project(renderCamera);
      assert.ok(Math.abs(p.x)<=.90001 && Math.abs(p.y)<=.90001,'all room bounds fit with a margin');
      extent=Math.max(extent,Math.abs(p.x),Math.abs(p.y));
    }
    assert.ok(extent>.89,'the overview fills the available preview');
    assert.deepEqual(liveCamera.matrixWorld.elements,original.elements);assert.equal(currentTarget,previous);assert.equal(scissorTest,true);assert.equal(roof.visible,true);
    assert.equal(wall.material.opacity,.3);assert.equal(wall.material.transparent,true);assert.equal(wall.material.depthWrite,false);
    fail=true;assert.throws(()=>captureRoomPreview(gl,scene,{minX:-2,maxX:2,minZ:-2,maxZ:2},2.7,[],{x:0,z:0}),/context lost/);
    assert.equal(currentTarget,previous);assert.equal(roof.visible,true);assert.equal(wall.material.opacity,.3);assert.equal(scene.background.getHexString(),'ffffff');
  } finally {global.document=oldDocument;}
});
