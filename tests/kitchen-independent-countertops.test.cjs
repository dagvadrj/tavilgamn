const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {loadSource}=require('./helpers/load-source.cjs');
const {createUnifiedKitchen,parseKitchen}=loadSource('src/lib/kitchenAssembly.ts');
const {fitCountertops}=loadSource('src/lib/kitchenPlacement.ts');
const {fitBacksplashes}=loadSource('src/lib/kitchenBacksplash.ts');
const {detachKitchenCountertops,updateKitchenCountertop}=loadSource('src/lib/kitchenCountertopLayout.ts');
const {withKitchenCountertopMaterial}=loadSource('src/lib/kitchenCountertopMaterial.ts');

test('a new kitchen has a flat worktop and keeps the painted wall without an automatic upstand',()=>{
 const kitchen=createUnifiedKitchen();
 assert.ok(fitCountertops(kitchen).length);
 assert.deepEqual(fitBacksplashes(kitchen),[]);
});

test('a detached board moves independently, preserves its cutout anchor and survives save/reload',()=>{
 const kitchen={...createUnifiedKitchen(),backsplash:true,backsplashMaterialId:'wall-tiles-white'};
 const top=fitCountertops(kitchen)[0],old=JSON.stringify(kitchen.cabinets),wall=fitBacksplashes(kitchen);
 const detached=detachKitchenCountertops(kitchen);
 const moved=updateKitchenCountertop(detached,top.id,{position:{...top.position,z:top.position.z+900}});
 assert.equal(JSON.stringify(moved.cabinets),old);
 assert.deepEqual(fitBacksplashes(moved),wall,'wall finish must not travel with the countertop');
 assert.deepEqual(fitCountertops(moved)[0].cutoutAnchor,top.position);
 const restored=parseKitchen(JSON.parse(JSON.stringify(moved)));
 assert.deepEqual(restored.countertopLayout,JSON.parse(JSON.stringify(moved.countertopLayout)));
 assert.equal(restored.backsplashMaterialId,'wall-tiles-white');
 assert.equal(fitCountertops(restored)[0].position.z,top.position.z+900);
 const automatic={...restored,countertopLayout:undefined};
 assert.equal(fitCountertops(automatic)[0].position.z,top.position.z);
});

test('manual top validation prevents outside-room, intersecting and nonfinite boards',()=>{
 const kitchen=createUnifiedKitchen(),top=fitCountertops(kitchen)[0];
 for(const patch of [{position:{...top.position,x:0}},{position:{...top.position,y:800}},{position:{...top.position,z:Infinity}},{width:-1},{thickness:99}])
  assert.throws(()=>parseKitchen(JSON.parse(JSON.stringify(updateKitchenCountertop(kitchen,top.id,patch)))));
});

test('changing a detached worktop material does not recolour independent wall tiles',()=>{
 const kitchen=detachKitchenCountertops({...createUnifiedKitchen(),backsplash:true,backsplashMaterialId:'wall-tiles-white'});
 const next=withKitchenCountertopMaterial(kitchen,'paint_40576c',{});
 assert.equal(next.backsplashMaterialId,'wall-tiles-white');
 assert.ok(fitCountertops(next).every(top=>top.materialId==='paint_40576c'));
});

test('holes travel with the detached board instead of being cut at its old world position',()=>{
 const {KitchenTops}=loadSource('src/three/KitchenTops.tsx',{
  react:{...React,useMemo:fn=>fn(),useEffect(){},useState:()=>[undefined,()=>{}]},
  '@/three/kitchenTextures':{createKitchenTexture:()=>null},
 });
 const nodes=tree=>!tree||typeof tree!=='object'?[]:Array.isArray(tree)?tree.flatMap(nodes):typeof tree.type==='function'?nodes(tree.type(tree.props)):[tree,...React.Children.toArray(tree.props?.children).flatMap(nodes)];
 const kitchen=createUnifiedKitchen(),top=fitCountertops(kitchen)[0];
 const moved=updateKitchenCountertop(kitchen,top.id,{position:{...top.position,z:top.position.z+900}});
 const holes=k=>nodes(KitchenTops({kitchen:k})).filter(n=>n.type==='extrudeGeometry').flatMap(n=>n.props.args[0].holes.map(h=>h.getPoints().map(p=>[p.x,p.y])));
 assert.deepEqual(holes(moved),holes(kitchen));
 assert.equal(holes(moved).length,2);
});
