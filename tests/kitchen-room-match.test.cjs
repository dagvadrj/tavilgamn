const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadSource}=require('./helpers/load-source.cjs');
const {parseKitchenBuyerRoom,matchKitchenToRoom,sortByRoomMatch}=loadSource('src/lib/kitchenRoomMatch.ts');

const project=(w,d)=>({model:null,roomWidthMm:w,roomDepthMm:d});
const glb=(w,d)=>({model:{widthMm:w,depthMm:d,heightMm:2400},roomWidthMm:9000,roomDepthMm:9000});

test('room params accept only plausible millimetre sizes',()=>{
 assert.deepEqual(parseKitchenBuyerRoom('3200','2800'),{widthMm:3200,depthMm:2800});
 for(const [w,d] of [[undefined,'2800'],['abc','2800'],['500','2800'],['3200','99999']])assert.equal(parseKitchenBuyerRoom(w,d),null);
});

test('a kitchen fits in either orientation and otherwise reports the excess',()=>{
 const room={widthMm:3000,depthMm:4000};
 assert.deepEqual(matchKitchenToRoom(project(3800,2900),room),{fits:true,overMm:0,label:'Таны өрөөнд таарна'});
 const over=matchKitchenToRoom(project(4300,3000),room);
 assert.equal(over.fits,false);assert.equal(over.overMm,300);assert.match(over.label,/300 мм илүү/);
});

test('a GLB design is measured by its own outer size, not the room it was shown in',()=>{
 assert.equal(matchKitchenToRoom(glb(2400,600),{widthMm:2500,depthMm:2000}).fits,true);
});

test('fitting designs come first, then the closest; ties keep the original order',()=>{
 const designs=[project(5000,3000),project(2000,2000),project(3500,3000),project(2500,2500)];
 const order=sortByRoomMatch(designs,{widthMm:3000,depthMm:3000}).map(item=>item.index);
 assert.deepEqual(order,[1,3,2,0]);
});
