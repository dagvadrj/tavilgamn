const {test}=require('node:test');
const assert=require('node:assert/strict');
const THREE=require('three');
const {computeMeshVolume}=require('three-bvh-csg');
const {loadSource}=require('./helpers/load-source.cjs');
const {getRoomGeometry}=loadSource('src/lib/roomGeometry.ts');
const {wallMiterEnds,ROOM_WALL_THICKNESS}=loadSource('src/lib/roomRendering.ts');
const {createWallGeometry}=loadSource('src/three/wallCsg.ts');

test('20 cm wall corners meet outside the measured floor and keep common wallpaper UVs',()=>{
  const room={width:4,depth:4,height:2.7},segments=getRoomGeometry(room).segments;
  assert.equal(ROOM_WALL_THICKNESS,.2);
  for (const s of segments) {
    const ends=wallMiterEnds(room,s,segments);
    assert.deepEqual(ends,{start:.2,end:.2});
    const geometry=createWallGeometry(s.length,room.height,.2,[],ends);
    try {
      assert.ok(Math.abs(computeMeshVolume(geometry)-4.2*.2*2.7)<.00001);
      assert.ok(Math.abs(geometry.boundingBox.min.x+2.2)<.00001);
      const positions=geometry.getAttribute('position'),uv=geometry.getAttribute('uv');
      for(let i=0;i<positions.count;i++) {
        assert.ok(Math.abs(uv.getX(i)-(positions.getX(i)/4+.5))<.00001);
        assert.ok(Math.abs(uv.getY(i)-(positions.getY(i)/2.7+.5))<.00001);
      }
    }finally{geometry.dispose();}
  }
});
test('joined corners have no extra caps and a full-width opening removes thick miter geometry',()=>{
  const room={width:4,depth:4,height:2.7},segments=getRoomGeometry(room).segments;
  const shared=[{wallId:'east',from:0,to:4,height:2.75,sillHeight:0}];
  const east=segments.find(s=>s.nx===-1);
  assert.deepEqual(wallMiterEnds(room,east,segments,shared),{start:0,end:0});
  const geometry=createWallGeometry(4,2.7,.2,[{x:0,width:4.404,height:2.75,sillHeight:0}],{start:.2,end:.2});
  try{assert.equal(geometry.getAttribute('position').count,0);}finally{geometry.dispose();}
});
test('photo floor maps share image downloads but own their UV transforms and colour spaces',async()=>{
  const original=THREE.TextureLoader.prototype.loadAsync;let count=0;
  THREE.TextureLoader.prototype.loadAsync=async()=>{count++;return new THREE.Texture({width:8,height:8});};
  try {
    const {loadRoomAssetTextures}=loadSource('src/three/roomTextureAssets.ts');
    const paths={color:'/floor-color',normal:'/floor-normal',roughness:'/floor-roughness'};
    const [a,b]=await Promise.all([loadRoomAssetTextures(paths,4),loadRoomAssetTextures(paths,4)]);
    assert.equal(count,3);assert.notEqual(a.map,b.map);assert.equal(a.map.source,b.map.source);
    assert.equal(a.map.colorSpace,THREE.SRGBColorSpace);assert.equal(a.normalMap.colorSpace,THREE.NoColorSpace);assert.equal(a.roughnessMap.colorSpace,THREE.NoColorSpace);
    a.map.repeat.set(3,4);assert.equal(b.map.repeat.x,1);
    a.map.dispose();assert.equal(b.map.source.data.width,8);
    for(const t of [a.normalMap,a.roughnessMap,b.map,b.normalMap,b.roughnessMap])t.dispose();
  }finally{THREE.TextureLoader.prototype.loadAsync=original;}
});
