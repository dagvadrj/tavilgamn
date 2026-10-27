const test=require('node:test'),assert=require('node:assert/strict');
const {loadSource}=require('./helpers/load-source.cjs');
const {bindCanvasLifecycle}=loadSource('src/three/canvasLifecycleBinding.ts');
function harness(paused=false,initialLost=false){
 const canvas=new EventTarget(),visibility=Object.assign(new EventTarget(),{hidden:false}),loops=[],status=[];let draws=0;
 const dispose=bindCanvasLifecycle({canvas,visibility,paused,isContextLost:()=>initialLost,setLoop:m=>loops.push(m),refresh:()=>draws++,onUnavailable:s=>status.push(s)});
 return {canvas,visibility,loops,status,dispose,get draws(){return draws},emit(type){const e=new Event(type,{cancelable:true});canvas.dispatchEvent(e);return e},hide(hidden){visibility.hidden=hidden;visibility.dispatchEvent(new Event('visibilitychange'))}};
}
test('context restoration wakes a demand canvas without replacing its scene',()=>{
 const h=harness();assert.equal(h.draws,1);
 const e=h.emit('webglcontextlost');assert.ok(e.defaultPrevented);assert.equal(h.loops.at(-1),'never');assert.equal(h.status.at(-1),true);
 h.emit('webglcontextrestored');assert.equal(h.loops.at(-1),'demand');assert.equal(h.draws,2);assert.equal(h.status.at(-1),false);
 h.dispose();h.emit('webglcontextlost');assert.equal(h.status.at(-1),false);
});
test('restore while hidden does not render until returning to the tab',()=>{
 const h=harness();h.hide(true);h.emit('webglcontextlost');h.emit('webglcontextrestored');
 assert.equal(h.loops.at(-1),'never');assert.equal(h.draws,1);
 h.hide(false);assert.equal(h.loops.at(-1),'demand');assert.equal(h.draws,2);h.dispose();
});
test('paused 2D mode and an already lost context never wake accidentally',()=>{
 const h=harness(true);h.emit('webglcontextlost');h.emit('webglcontextrestored');h.hide(true);h.hide(false);
 assert.equal(h.draws,0);assert.ok(h.loops.every(m=>m==='never'));h.dispose();
 const lost=harness(false,true);assert.equal(lost.status[0],true);assert.equal(lost.draws,0);lost.dispose();
});
test('context loss cannot replace a valid room preview with blank readback pixels',()=>{
 const {captureRoomPreview}=loadSource('src/three/RoomPreviewCapture.tsx');
 const gl={getContext:()=>({isContextLost:()=>true})};
 assert.equal(captureRoomPreview(gl,null,null,2.7,[],{x:0,z:0}),null);
});
