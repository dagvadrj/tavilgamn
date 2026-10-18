const test=require('node:test');
const assert=require('node:assert/strict');
const THREE=require('three');
const React=require('react');
const {loadSource}=require('./helpers/load-source.cjs');
const {paintReflectionKey,paintRoomRadiance,paintReflectionPixels}=loadSource('src/three/roomPaintReflection.ts');
const base={id:'r',width:5,depth:4,height:2.7,wallColor:'#2b2b2b',floorColor:'#b58c64',wallMaterials:{north:{mode:'color',color:'#804020'},east:{mode:'color',color:'#dddddd'}},lighting:{mode:'day',timeOfDay:12},openings:[]};

test('paint room environment reflects surrounding wall colours, the floor, and real window direction',()=>{
  const radiance=paintRoomRadiance(base),north=radiance(0,0,-1),east=radiance(1,0,0);
  assert.ok(north.r>north.g*2);assert.ok(Math.abs(east.r-east.g)<1e-8);assert.ok(east.r>north.r);
  assert.ok(radiance(0,-1,0).r>radiance(0,-1,0).b);
  const window={id:'w',kind:'window',wallId:'north',position:.5,width:1.5,height:1.5,sillHeight:.7};
  const lit=paintRoomRadiance({...base,openings:[window]})(0,0,-1);
  assert.ok(lit.b>lit.r);assert.ok(lit.r>north.r*3);
  const night=paintRoomRadiance({...base,lighting:{mode:'evening',timeOfDay:22}})(1,0,0);
  assert.ok(night.r<east.r);
});

test('furniture movement and selection cannot rebuild paint environments; surface and daylight changes can',()=>{
  const key=paintReflectionKey(base);
  assert.equal(paintReflectionKey({...base,pieces:[{x:2,z:1}],selected:'x'}),key);
  assert.notEqual(paintReflectionKey({...base,wallColor:'#ffffff'}),key);
  assert.notEqual(paintReflectionKey({...base,lighting:{...base.lighting,timeOfDay:21}}),key);
  assert.notEqual(paintReflectionKey({...base,width:7}),key);
  const pixels=paintReflectionPixels(base);
  assert.equal(pixels.width,256);assert.equal(pixels.height,128);assert.equal(pixels.data.byteLength,512*1024);
  for(let i=0;i<pixels.data.length;i++) assert.ok(Number.isFinite(pixels.data[i])&&pixels.data[i]>=0);
});

test('eggshell paint has real micro normals, bounded roughness, physical UV scale, and owned texture cleanup',()=>{
  let state=null,effects=[],cursor=0;const deps=[],cleanups=[];
  const {useRoomMaterial}=loadSource('src/three/roomMaterials.ts',{
    react:{...React,useState:()=>[state,value=>{state=value;}],useEffect:(fn,next)=>{const index=cursor++;if(!deps[index]||next.some((value,i)=>value!==deps[index][i])){cleanups[index]?.();deps[index]=next;effects.push(()=>{cleanups[index]=fn();});}}},
    '@react-three/fiber':{useThree:fn=>fn({gl:renderer,invalidate})},
  });
  const renderer={capabilities:{getMaxAnisotropy:()=>8}},invalidate=()=>{};
  const render=(w,h)=>{cursor=0;const material=useRoomMaterial('wall-paint',w,h,'#2b2b2b');const work=effects;effects=[];work.forEach(fn=>fn());return material;};
  render(4,2.7);const material=render(4,2.7);
  assert.equal(material.metalness,0);assert.equal(material.color,'#2b2b2b');
  assert.equal(material.normalScale.x,.12);assert.equal(material.normalScale.y,.12);
  const rough=material.roughnessMap.image.data,normal=material.normalMap.image.data;
  let min=255,max=0,tilted=0;
  for(let i=0;i<rough.length;i+=4){min=Math.min(min,rough[i]);max=Math.max(max,rough[i]);if(Math.abs(normal[i]-128)>1||Math.abs(normal[i+1]-128)>1)tilted++;}
  assert.ok(min/255>=.75&&max/255<=.85);assert.ok(max>min);assert.ok(tilted>1000);
  const original=material.normalMap.repeat.x;render(8,2.7);assert.equal(material.normalMap.repeat.x,original*2);
  assert.equal(material.normalMap.colorSpace,THREE.NoColorSpace);assert.equal(material.map.colorSpace,THREE.SRGBColorSpace);
  let disposed=0;for(const texture of [material.map,material.normalMap,material.roughnessMap])texture.addEventListener('dispose',()=>disposed++);
  cleanups.forEach(fn=>fn?.());assert.equal(disposed,3);
});

test('paint PMREM restores transparent-clear state on success or failure and disposes owned GPU resources',t=>{
  const oldSet=global.setTimeout,oldClear=global.clearTimeout;
  t.after(()=>{global.setTimeout=oldSet;global.clearTimeout=oldClear;});
  for(const fail of [false,true]) {
    let timer,cleanup,sourceDisposed=0,generatorDisposed=0,targetDisposed=0,published=null;
    global.setTimeout=fn=>{timer=fn;return 1;};global.clearTimeout=()=>{};
    const originalTarget={id:'main'},originalColor=new THREE.Color('#abcdef');
    const gl={autoClear:true,xr:{enabled:true},target:originalTarget,face:2,level:1,color:originalColor.clone(),alpha:.4,
      getRenderTarget(){return this.target;},getActiveCubeFace(){return this.face;},getActiveMipmapLevel(){return this.level;},
      getClearAlpha(){return this.alpha;},getClearColor(target){return target.copy(this.color);},
      setRenderTarget(target,face,level){this.target=target;this.face=face;this.level=level;},
      setClearColor(color,alpha){this.color.copy(color);this.alpha=alpha;}};
    const {useRoomPaintEnvironment}=loadSource('src/three/useRoomPaintEnvironment.ts',{
      react:{...React,useState:()=>[null,value=>{published=value;}],useEffect:fn=>{cleanup=fn();}},
      '@react-three/fiber':{useThree:fn=>fn({gl,invalidate(){}})},
      three:{...THREE,DataTexture:class extends THREE.DataTexture{dispose(){sourceDisposed++;super.dispose();}},PMREMGenerator:class{
        fromEquirectangular(){gl.autoClear=false;gl.xr.enabled=false;gl.setRenderTarget({},0,0);gl.setClearColor(new THREE.Color('#000000'),0);if(fail)throw Error('Unsupported');return {texture:{},dispose(){targetDisposed++;}};}
        dispose(){generatorDisposed++;}
      }},
    });
    assert.equal(useRoomPaintEnvironment(base),null);timer();
    assert.equal(gl.autoClear,true);assert.equal(gl.xr.enabled,true);assert.equal(gl.target,originalTarget);
    assert.equal(gl.face,2);assert.equal(gl.level,1);assert.equal(gl.alpha,.4);assert.ok(gl.color.equals(originalColor));
    assert.equal(sourceDisposed,1);assert.equal(generatorDisposed,1);assert.equal(!!published,!fail);
    cleanup();assert.equal(targetDisposed,fail?0:1);
  }
});
