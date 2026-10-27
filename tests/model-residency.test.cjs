const test = require('node:test'), assert = require('node:assert/strict');
const THREE = require('three');
const { loadSource } = require('./helpers/load-source.cjs');
const { modelResourceBytes, idleModelCacheBudget } = loadSource('src/three/modelResources.ts');
function scene(width=1024) {
  const texture=new THREE.Texture({width,height:width});
  const material=new THREE.MeshStandardMaterial({map:texture});
  const root=new THREE.Group();root.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material));
  let disposed=0;texture.addEventListener('dispose',()=>disposed++);
  return {scene:root,texture,get disposed(){return disposed},animations:[]};
}
function harness() {
  const requests=[],leases=[],timers=new Map();let timer=0;
  const original={setTimeout:global.setTimeout,clearTimeout:global.clearTimeout};
  global.setTimeout=fn=>{timers.set(++timer,fn);return timer};global.clearTimeout=id=>timers.delete(id);
  const chain=class { setDecoderPath(){return this} setTranscoderPath(){return this} setWorkerLimit(){return this} detectSupport(){return this} dispose(){} };
  class Loader {setDRACOLoader(){return this}setKTX2Loader(){return this}setMeshoptDecoder(){return this}loadAsync(url){return new Promise((resolve,reject)=>requests.push({url,resolve,reject}))}}
  let failPrepare=false;
  const api=loadSource('src/three/modelLoader.ts',{
    'three/examples/jsm/loaders/GLTFLoader.js':{GLTFLoader:Loader},
    'three/examples/jsm/loaders/DRACOLoader.js':{DRACOLoader:chain},
    'three/examples/jsm/loaders/KTX2Loader.js':{KTX2Loader:chain},
    'three/examples/jsm/libs/meshopt_decoder.module.js':{MeshoptDecoder:{}},
    'three/examples/jsm/utils/SkeletonUtils.js':{clone:s=>s.clone(true)},
    './instanceModules':{instanceRepeatedModules(){}},
    './modelTextureSampling':{configureModelTextureSampling(){}},
    './modelCutoutSampling':{configureModelCutoutSampling(){}},
    './modelDefaultMaterials':{configureModelDefaultMaterials(){if(failPrepare)throw Error('prepare failed')}},
  });
  const renderer={};
  return {requests,timers,renderer,...api,failPrepare(){failPrepare=true},acquire(url,options){const lease=api.acquireModel(renderer,url,options);lease.promise.catch(()=>{});leases.push(lease);return lease},async flush(){await new Promise(r=>setImmediate(r))},cleanup(){leases.forEach(l=>l.release());Object.assign(global,original)}};
}
test('residency counts decoded pixels separately from encoded/compressed mip payloads and shared resources',()=>{
  const a=scene(2048),one=modelResourceBytes(a.scene);
  assert.equal(one.textureBytes,Math.ceil(2048*2048*4*4/3));
  a.scene.add(a.scene.children[0].clone());
  assert.deepEqual(modelResourceBytes(a.scene),one,'shared geometry and texture counted once');
  const compressed=new THREE.CompressedTexture([{data:new Uint8Array(128),width:16,height:16},{data:new Uint8Array(32),width:8,height:8}],16,16,THREE.RGBA_S3TC_DXT5_Format);
  a.scene.children[0].material.map=compressed;
  assert.equal(modelResourceBytes(a.scene).textureBytes,160,'KTX transcode mips retain compressed residency');
  assert.equal(idleModelCacheBudget(4),32*1024*1024);assert.equal(idleModelCacheBudget(8),64*1024*1024);
});
test('shared image uploads are distinguished by their full renderer sampler key',()=>{
  const a=scene(128),one=modelResourceBytes(a.scene).textureBytes;
  const duplicate=a.scene.children[0].clone();duplicate.material=duplicate.material.clone();
  duplicate.material.map=a.texture.clone();a.scene.add(duplicate);
  assert.equal(modelResourceBytes(a.scene).textureBytes,one);
  duplicate.material.map.anisotropy=4;
  assert.equal(modelResourceBytes(a.scene).textureBytes,Math.ceil(2*128*128*4*4/3));
});

test('a large unreferenced model is evicted by bytes while active shared leases remain safe',async()=>{
  const h=harness();try{
    const a=h.acquire('large'),b=h.acquire('large');await h.flush();assert.equal(h.requests.length,1);
    const model=scene(4096);h.requests[0].resolve(model);await a.promise;
    assert.ok(h.modelCacheStats(h.renderer).activeBytes>64*1024*1024);
    a.release();assert.equal(model.disposed,0);assert.equal(h.modelCacheStats(h.renderer).entries,1);
    b.release();assert.equal(model.disposed,1);assert.equal(h.modelCacheStats(h.renderer).entries,0);
    b.release();assert.equal(model.disposed,1,'release is idempotent');
  }finally{h.cleanup()}
});
test('small recently used models remain reusable without exceeding the count limit',async()=>{
  const h=harness();try{
    for(let i=0;i<6;i++){const lease=h.acquire('model-'+i);await h.flush();h.requests.at(-1).resolve(scene(128));await lease.promise;lease.release()}
    const stats=h.modelCacheStats(h.renderer);assert.equal(stats.entries,4);assert.ok(stats.idleBytes<=stats.idleBudgetBytes);
    const recent=h.acquire('model-5');assert.equal(recent.cacheHit,true);await recent.promise;
    assert.equal(h.requests.length,6);
  }finally{h.cleanup()}
});
test('cancelled queued furniture never starts another download or decoder',async()=>{
  const h=harness();try{
    const busy=[0,1,2].map(i=>h.acquire('busy-'+i)),cancelled=h.acquire('cancelled');cancelled.release();await h.flush();
    assert.equal(h.requests.length,3);h.requests[0].resolve(scene());await busy[0].promise;
    await assert.rejects(cancelled.promise,{name:'AbortError'});assert.equal(h.requests.length,3);
    h.requests[1].resolve(scene());h.requests[2].resolve(scene());await Promise.all(busy.map(l=>l.promise));
  }finally{h.cleanup()}
});
test('in-flight completion with no consumers disposes resources instead of retaining a phantom model',async()=>{
  const h=harness();try{
    const lease=h.acquire('removed');await h.flush();lease.release();const model=scene();h.requests[0].resolve(model);
    await assert.rejects(lease.promise,{name:'AbortError'});assert.equal(model.disposed,1);assert.equal(h.modelCacheStats(h.renderer).entries,0);
    const retry=h.acquire('removed');await h.flush();assert.equal(h.requests.length,2);h.requests[1].resolve(scene());await retry.promise;
  }finally{h.cleanup()}
});
test('a new consumer can rescue a queued request before it starts',async()=>{
  const h=harness();try{
    const first=h.acquire('remount');first.release();const second=h.acquire('remount');await h.flush();
    assert.equal(h.requests.length,1);h.requests[0].resolve(scene());await second.promise;assert.equal(await first.promise,await second.promise);
  }finally{h.cleanup()}
});
test('post-decode preparation failures dispose acquired GPU resources and remain retryable',async()=>{
  const h=harness();try{
    h.failPrepare();const lease=h.acquire('bad');await h.flush();const model=scene();h.requests[0].resolve(model);
    await assert.rejects(lease.promise,/prepare failed/);assert.equal(model.disposed,1);assert.equal(h.modelCacheStats(h.renderer).entries,0);
  }finally{h.cleanup()}
});

test('releasing an old failed lease cannot retire a new renderer pool',async()=>{
  const h=harness();try{
    const old=h.acquire('failed');await h.flush();h.requests[0].reject(Error('network'));
    await assert.rejects(old.promise,/network/);await h.flush();
    const idle=[...h.timers.values()].at(-1);h.timers.clear();idle();
    const current=h.acquire('current');await h.flush();h.requests.at(-1).resolve(scene());await current.promise;
    old.release();assert.equal(h.timers.size,0,'retired lease must not schedule new cleanup');
    assert.equal(h.modelCacheStats(h.renderer).entries,1);
    assert.ok(h.modelCacheStats(h.renderer).activeBytes>0);
  }finally{h.cleanup()}
});
