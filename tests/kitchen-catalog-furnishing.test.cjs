const {test}=require('node:test');
const assert=require('node:assert/strict');
const THREE=require('three');
const {loadSource}=require('./helpers/load-source.cjs');
const {furnishKitchenFromCatalog}=loadSource('src/lib/kitchenCatalogFurnishing.ts');
const {createSuggestedKitchen}=loadSource('src/lib/kitchenSuggestions.ts');
const {parseKitchen}=loadSource('src/lib/kitchenAssembly.ts');
const {placementIssues}=loadSource('src/lib/kitchenPlacement.ts');
const {kitchenVariantFits,kitchenVariantFromModule}=loadSource('src/lib/kitchenModuleCatalog.ts');
const {buildKitchenBom}=loadSource('src/lib/kitchenBom.ts');
function moduleAt(type,width,height,depth,index,opening='doors',doorCount=2,drawerCount=0){
 const id=`30000000-1025-4026-8000-${String(index).padStart(12,'0')}`;
 return {id,code:`${type}-${width}`,name:`Box ${width}`,active:true,cabinetType:type,widthMm:width,heightMm:height,depthMm:depth,
  variants:[{furnitureModelId:id,productId:`product-${index}`,modelName:`Box ${width}`,opening,doorCount,drawerCount,configuration:{},isDefault:true,sortOrder:0,active:true,glbFile:'box.glb',processingStatus:'ready'}]};
}
const modules=[moduleAt('base',600,840,598,1,'drawers',1,1),moduleAt('base',1000,840,600,2),moduleAt('wall',800,740,598,3)];
const make=layout=>createSuggestedKitchen({oven:'under-worktop',hood:'wall',refrigerator:'freestanding',layout});

for(const layout of ['straight','l-right','l-left'])test(`catalog conversion preserves ${layout} runs and fits actual assets without stretching`,()=>{
 const source=make(layout),before=JSON.stringify(source),result=furnishKitchenFromCatalog(source,modules);
 assert.ok(result.design,result.error);assert.equal(JSON.stringify(source),before,'input remains available for undo');
 assert.equal(result.design.layout,source.layout);assert.deepEqual(result.design.room,source.room);
 assert.deepEqual(placementIssues(result.design).filter(i=>i.severity==='error'),[]);
 for(const c of result.design.cabinets){
  const old=source.cabinets.find(old=>old.id===c.id);assert.equal(c.position.rotation,old.position.rotation);
  if(!['hood','refrigerator'].includes(c.opening)){
   const m=modules.find(m=>m.variants.some(v=>v.furnitureModelId===c.variantId));assert.ok(m);
   assert.ok(kitchenVariantFits(kitchenVariantFromModule(m,m.variants[0]),c));
   assert.deepEqual([c.width,c.height,c.depth],[m.widthMm,m.heightMm,m.depthMm]);
  }
 }
 const cooker=result.design.cabinets.find(c=>c.opening==='oven'),hood=result.design.cabinets.find(c=>c.opening==='hood');
 const {cooktopGeometry}=loadSource('src/lib/plitka.ts');const cutout=cooktopGeometry(cooker);
 assert.ok(cutout.cutoutWidth>592*.94&&cutout.cutoutDepth>522*.94,'countertop clears the actual catalog housing');
 const right={x:Math.cos(cooker.position.rotation),z:-Math.sin(cooker.position.rotation)};
 assert.ok(Math.abs((hood.position.x-cooker.position.x)*right.x+(hood.position.z-cooker.position.z)*right.z)<.001);
 const restored=parseKitchen(JSON.parse(JSON.stringify(result.design)));
 assert.equal(restored.cabinets.find(c=>c.id===cooker.id).catalogAdaptation,'oven');
 const again=furnishKitchenFromCatalog(restored,modules);assert.equal(again.changed,0);assert.equal(again.design,restored);
 const bom=buildKitchenBom(restored,modules,[]);
 for(const type of ['oven','cooktop'])assert.equal(bom.items.filter(row=>row.id===`${cooker.id}/equipment/${type}`).length,1);
 assert.equal(bom.items.find(row=>row.id===`${cooker.id}/equipment/oven`).included,false);
});

test('catalog adaptation cannot disguise a wrong cabinet role or an unknown appliance',()=>{
 const result=furnishKitchenFromCatalog(make('straight'),modules).design;
 const wall=result.cabinets.find(c=>c.type==='wall'&&c.opening!=='hood');
 assert.throws(()=>parseKitchen({...result,cabinets:result.cabinets.map(c=>c.id===wall.id?{...c,catalogAdaptation:'sink',opening:'sink'}:c)}));
 const hood=result.cabinets.find(c=>c.opening==='hood');
 assert.throws(()=>parseKitchen({...result,cabinets:result.cabinets.map(c=>c.id===hood.id?{...c,applianceProductId:'unknown-model'}:c)}));
 const empty=furnishKitchenFromCatalog(make('straight'),[]);assert.ok(empty.error);assert.equal(empty.design,undefined);
 const fridge=result.cabinets.find(c=>c.opening==='refrigerator');
 assert.throws(()=>parseKitchen({...result,cabinets:result.cabinets.map(c=>c.id===fridge.id?{...c,width:c.width+10}:c)}));
 const {withOpening}=loadSource('src/lib/kitchenComponents.ts');
 const sink=result.cabinets.find(c=>c.opening==='sink');
 const ordinary=withOpening(sink,'doors');assert.equal(ordinary.catalogAdaptation,undefined);assert.equal(ordinary.variantId,undefined);
});

test('appliance carcass uses the authored sides and base and only hides separate obstructing panels',()=>{
 const {prepareKitchenApplianceCarcass}=loadSource('src/three/kitchenApplianceCarcass.ts');
 function cabinet(){const root=new THREE.Group();for(const [name,size,at]of[
  ['side',[.016,.74,.58],[.292,.47,-.009]],['base',[.568,.016,.52],[0,.108,.02]],
  ['back',[.578,.74,.003],[0,.47,-.242]],['door',[.596,.588,.018],[0,.396,.29]],
  ['upper-drawer',[.596,.144,.018],[0,.766,.29]],['shelf',[.568,.016,.5],[0,.391,.009]]]){
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),new THREE.MeshStandardMaterial());mesh.name=name;mesh.position.set(...at);root.add(mesh);
  }return root;}
 const oven=cabinet(),original=oven.getObjectByName('side').geometry.attributes.position.array.slice();
 prepareKitchenApplianceCarcass(oven,'oven');assert.equal(oven.getObjectByName('side').visible,true);assert.equal(oven.getObjectByName('base').visible,true);
 for(const name of ['door','upper-drawer','shelf','back'])assert.equal(oven.getObjectByName(name).visible,false,name);
 assert.deepEqual(oven.getObjectByName('side').geometry.attributes.position.array,original);
 const sink=cabinet();prepareKitchenApplianceCarcass(sink,'sink');assert.equal(sink.getObjectByName('upper-drawer').visible,false);assert.equal(sink.getObjectByName('door').visible,true);
});

test('explicit alignment repairs a previously moved hood without changing the cooking box or dropping catalog SKUs',()=>{
 const design=furnishKitchenFromCatalog(make('l-right'),modules).design;
 const oven=design.cabinets.find(c=>c.opening==='oven'),hood=design.cabinets.find(c=>c.opening==='hood');
 hood.position={...hood.position,x:235,z:1089,rotation:Math.PI/2};
 const before=JSON.parse(JSON.stringify(oven));
 const result=furnishKitchenFromCatalog(design,modules,{alignEquipment:true});
 assert.ok(result.design,result.error);assert.deepEqual(result.design.cabinets.find(c=>c.id===oven.id),before);
 const aligned=result.design.cabinets.find(c=>c.id===hood.id);assert.equal(aligned.position.rotation,oven.position.rotation);assert.equal(aligned.position.x,oven.position.x);
 assert.equal(result.omitted,0);assert.equal(result.design.cabinets.length,design.cabinets.length);
 const {wallCabinetClearance}=loadSource('src/lib/kitchenPlacement.ts');
 const upper={...modules[2],id:'above-hood',type:'wall',width:800,height:740,depth:598,position:{...aligned.position,y:aligned.position.y+aligned.height+2}};
 assert.equal(wallCabinetClearance(upper,{...result.design,cabinets:[...result.design.cabinets,upper]}),null);
});
