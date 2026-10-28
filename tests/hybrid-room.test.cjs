const test = require('node:test'), assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { HYBRID_ROOMS, hybridCrop, hybridZoom } = loadSource('src/features/home-motion/hybridRooms.ts');
const THREE = require('three');
test('photo and perspective model use exactly the same cover crop on phone, rotation and desktop', () => {
  for (const room of HYBRID_ROOMS) for (const [w,h] of [[320,568],[378,671],[844,390],[1366,768],[2560,1080]]) {
    const crop = hybridCrop(w,h,room);
    assert.ok(crop.x >= 0 && crop.y >= 0);
    assert.ok(crop.x + crop.width <= room.frame[0] + 1e-8);
    assert.ok(Math.abs(crop.width/crop.height - w/h) < 1e-8);
    const camera = new THREE.PerspectiveCamera(room.camera.fov,room.frame[0]/room.frame[1],.1,70);
    camera.position.fromArray(room.camera.eye); camera.lookAt(new THREE.Vector3(...room.camera.target)); camera.updateMatrixWorld();
    for (const f of room.furniture) {
      const point = new THREE.Vector3(...f.position), full = point.clone().project(camera);
      camera.setViewOffset(crop.fullWidth,crop.fullHeight,crop.x,crop.y,crop.width,crop.height);
      const cropped = point.clone().project(camera);
      assert.ok(Math.abs((cropped.x+1)/2*w - ((full.x+1)/2*room.frame[0]-crop.x)*crop.scale) < 1e-6);
      assert.ok(Math.abs((1-cropped.y)/2*h - ((1-full.y)/2*room.frame[1]-crop.y)*crop.scale) < 1e-6);
      camera.clearViewOffset();
    }
  }
});
test('room zoom is bounded, deterministic and reversible', () => {
  for (let phase=0;phase<3;phase++) for(let i=0;i<=1000;i++) {
    const z=hybridZoom(i/1000,phase); assert.ok(z>=1&&z<=1.045);
    assert.equal(z,hybridZoom(i/1000,phase));
  }
});
test('hero derivatives never substitute a different admin-selected model', () => {
  const {heroModelUrl}=loadSource('src/features/home-motion/heroModelUrl.ts');
  assert.equal(heroModelUrl(),undefined);
  assert.equal(heroModelUrl({model:{id:'62e41d60-85fe-4a7b-be7b-9bb184796bad',file:'model-05e38299-7a01-4664-8f7d-6f511e5341f6.glb'}}),'/interior/hybrid/sofa.glb');
  assert.equal(heroModelUrl({model:{id:'62e41d60-85fe-4a7b-be7b-9bb184796bad',file:'replacement.glb'}}),'/api/models/files/62e41d60-85fe-4a7b-be7b-9bb184796bad/replacement.glb');
});
