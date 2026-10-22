const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {loadSource}=require('./helpers/load-source.cjs');
const {createCabinet,createModularKitchen}=loadSource('src/lib/kitchenCabinets.ts');
const {preferredKitchenVariant,applyKitchenCatalogVariants}=loadSource('src/lib/kitchenModuleCatalog.ts');
const {resolveElevations,findCabinetSpace,placementIssues}=loadSource('src/lib/kitchenPlacement.ts');
function moduleOf(type,opening='doors',id=type){return {id,cabinetType:type,active:true,widthMm:600,heightMm:type==='tall'?2100:type==='wall'?740:840,depthMm:type==='wall'?350:600,variants:[{furnitureModelId:id,opening,active:true,glbFile:id+'.glb',isDefault:true,sortOrder:0,configuration:{}}]};}
test('upper and lower model roles remain distinct even when an incorrect explicit ID was saved',()=>{
 const wall=moduleOf('wall'),base=moduleOf('base');
 for(const type of ['base','wall']){
  const cabinet={...createCabinet(type,type),variantId:type==='base'?'wall':'base'};
  assert.equal(preferredKitchenVariant([wall,base],cabinet).furnitureModelId,type);
  assert.equal(applyKitchenCatalogVariants({cabinets:[cabinet]},[wall,base]).cabinets[0].variantId,type);
 }
 assert.equal(preferredKitchenVariant([wall],createCabinet('base','base')),undefined);
 assert.equal(preferredKitchenVariant([base],createCabinet('wall','wall')),undefined);
});
test('drawers, sink, cooker, corner and tall cabinets never borrow an unrelated box',()=>{
 const doors=moduleOf('base');
 for(const opening of ['drawers','sink','oven','hob','hood']) assert.equal(preferredKitchenVariant([doors],{...createCabinet('base',opening),opening}),undefined);
 assert.equal(preferredKitchenVariant([doors],{...createCabinet('base','corner'),corner:true}),undefined);
 assert.equal(preferredKitchenVariant([doors],createCabinet('tall','tall')),undefined);
 const skinny={...doors,heightMm:400,depthMm:300};
 assert.equal(preferredKitchenVariant([skinny],createCabinet('base','base')),undefined);
});
test('wall cabinets stored on the floor are repaired without overwriting manual heights',()=>{
 const kitchen=createModularKitchen();
 const upper={...createCabinet('wall','upper'),autoElevation:false,position:{x:300,z:175,y:0,rotation:0}};
 const fixed=resolveElevations({...kitchen,cabinets:[upper]});
 assert.equal(fixed.cabinets[0].position.y,840+kitchen.countertop.thickness+kitchen.wallClearance);
 const manual={...upper,position:{...upper.position,y:1550}};
 assert.equal(resolveElevations({...kitchen,cabinets:[manual]}).cabinets[0].position.y,1550);
 const floor=createCabinet('base','floor');
 const next=findCabinetSpace({...kitchen,cabinets:[floor]},upper);
 assert.ok(next);assert.ok(next.cabinets.find(c=>c.id==='upper').position.y>1000);
 assert.ok(!placementIssues(next).some(i=>i.severity==='error'));
});
test('rendering rejects a stale wrong-role asset and preserves a correctly typed wall asset',()=>{
 const {KitchenCabinetGLB}=loadSource('src/three/KitchenCabinetGLB.tsx',{react:{...React,useMemo:fn=>fn()},'./GLBFurnitureMesh':{GLBFurnitureMesh:'uploaded-model'}});
 const cabinet=createCabinet('base','base'),variant={...moduleOf('wall').variants[0],cabinetType:'wall'};
 assert.equal(KitchenCabinetGLB({cabinet,variant}).type.name,'MissingKitchenModel');
 const tree=KitchenCabinetGLB({cabinet:createCabinet('wall','upper'),variant});
 assert.ok(React.Children.toArray(tree.props.children).some(n=>n.type==='uploaded-model'));
});

test('upper corners never inherit a saved lower corner GLB',()=>{
 const lower={...moduleOf('base'),cabinetType:'corner',widthMm:1000,variants:[{...moduleOf('base').variants[0],furnitureModelId:'lower-corner'}]};
 const upper={...createCabinet('wall','upper',800),corner:true,variantId:'lower-corner'};
 assert.equal(preferredKitchenVariant([lower],upper),undefined);
 assert.equal(applyKitchenCatalogVariants({cabinets:[upper]},[lower]).cabinets[0].variantId,undefined);
});
