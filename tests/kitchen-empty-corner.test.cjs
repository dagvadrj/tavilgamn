const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadSource}=require('./helpers/load-source.cjs');
const {createModularKitchen}=loadSource('src/lib/kitchenCabinets.ts');
const {parseKitchen}=loadSource('src/lib/kitchenAssembly.ts');
const {arrangeKitchenCorner}=loadSource('src/lib/kitchenCornerLayout.ts');
const {kitchenCornerGeometry}=loadSource('src/lib/kitchenCornerGeometry.ts');
const {fitCountertops,placementIssues,footprintsOverlap}=loadSource('src/lib/kitchenPlacement.ts');
const {buildKitchenBom}=loadSource('src/lib/kitchenBom.ts');

test('left and right empty corners preserve real cabinet dimensions and leave a handle clearance',()=>{
 for(const side of ['left','right']){
  const original=createModularKitchen();
  original.cabinets[0].frontMaterialId='paint_40576c';
  const before=JSON.stringify(original);
  const next=arrangeKitchenCorner(original,{side,clearanceMm:60,mainCount:2});
  assert.equal(JSON.stringify(original),before);
  assert.deepEqual(placementIssues(next).filter(i=>i.severity==='error'),[]);
  for(const cabinet of next.cabinets){
   const old=original.cabinets.find(c=>c.id===cabinet.id);
   for(const key of ['width','height','depth','variantId','frontMaterialId','carcassMaterialId']) assert.equal(cabinet[key],old[key]);
   assert.equal(cabinet.corner,false,'a rectangular model must not become a fake corner SKU');
  }
  const corner=kitchenCornerGeometry(next);
  assert.equal(corner.width,660);assert.equal(corner.depth,660);
  assert.equal(corner.panels.length,2);assert.ok(corner.panels.every(p=>p.width===60));
  const tops=fitCountertops(next);
  assert.ok(tops.some(t=>t.id==='corner-top:'+side));
  for(let i=0;i<tops.length;i++)for(let j=i+1;j<tops.length;j++)assert.equal(footprintsOverlap({...tops[i],height:30},{...tops[j],height:30}),false);
  const restored=parseKitchen(JSON.parse(JSON.stringify(next)));
  assert.deepEqual(restored.cornerPlan,next.cornerPlan);
  assert.equal(buildKitchenBom(restored,[],[]).items.filter(i=>i.id.startsWith('corner-filler-')).length,2);
 }
});

test('an impossible corner or unsupported split leaves the existing design untouched',()=>{
 const original=createModularKitchen(),before=JSON.stringify(original);
 assert.throws(()=>arrangeKitchenCorner({...original,room:{...original.room,width:1200}},{side:'left',clearanceMm:60,mainCount:2}));
 assert.throws(()=>arrangeKitchenCorner(original,{side:'left',clearanceMm:0,mainCount:2}));
 assert.throws(()=>arrangeKitchenCorner(original,{side:'right',clearanceMm:60,mainCount:4}));
 assert.equal(JSON.stringify(original),before);
});

test('moving a corner anchor away removes the filler geometry instead of leaving stray panels',()=>{
 const next=arrangeKitchenCorner(createModularKitchen(),{side:'left',clearanceMm:60,mainCount:2});
 next.cabinets.find(c=>c.id==='base-1').position.x+=100;
 assert.equal(kitchenCornerGeometry(next),undefined);
 assert.ok(!fitCountertops(next).some(t=>t.id.startsWith('corner-top:')));
});
