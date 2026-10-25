const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {loadSource}=require('./helpers/load-source.cjs');
const {createCabinet,createModularKitchen}=loadSource('src/lib/kitchenCabinets.ts');
const {preferredKitchenVariant,applyKitchenCatalogVariants}=loadSource('src/lib/kitchenModuleCatalog.ts');
const {resolveElevations,findCabinetSpace,placementIssues}=loadSource('src/lib/kitchenPlacement.ts');
const {reconcileKitchenCatalog}=loadSource('src/lib/kitchenCatalogRoleCorrections.ts');
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

test('selected catalog finishes reach standalone GLBs and assembled parts',()=>{
 const {KitchenCabinetGLB}=loadSource('src/three/KitchenCabinetGLB.tsx',{react:{...React,useMemo:fn=>fn()},'./GLBFurnitureMesh':{GLBFurnitureMesh:'uploaded-model'}});
 const cabinet={...createCabinet('base','base'),frontMaterialId:'white',carcassMaterialId:'oak'};
 const materialDefinitions={white:{id:'white',baseColor:'#ffffff',roughness:.4,metalness:0,texturePaths:{}},oak:{id:'oak',baseColor:'#aa8855',roughness:.7,metalness:0,texturePaths:{}}};
 const variant={...moduleOf('base').variants[0],cabinetType:'base'};
 const tree=KitchenCabinetGLB({cabinet,variant,materialDefinitions});
 const model=React.Children.toArray(tree.props.children).find(n=>n.type==='uploaded-model');
 assert.equal(model.props.frontMaterial,materialDefinitions.white);
 assert.equal(model.props.carcassMaterial,materialDefinitions.oak);
 const assembled=KitchenCabinetGLB({cabinet,materialDefinitions,variant:{...variant,configuration:{assembly:{version:1,slots:[{id:'door',label:'Door',kind:'door',defaultOptionId:'white',options:[{id:'white',label:'White',modelId:'11111111-2222-4333-8444-555555555555',materialId:'white'}]}]}}}});
 assert.equal(assembled.type.name,'AssemblyModel');
 assert.equal(assembled.props.materialDefinitions,materialDefinitions);
});

test('an explicit catalog correction lifts the saved 800mm upper cabinet and preserves base cabinets and finishes',()=>{
 const upperId='f9dc384b-9e20-445b-9fc0-c23a561e92ef';
 const upperModule={...moduleOf('wall','doors',upperId),widthMm:800,depthMm:598};
 upperModule.variants[0].configuration={catalogRoleCorrection:{from:'base',to:'wall'}};
 const kitchen=createModularKitchen();
 const lower={...createCabinet('base','lower',1000),variantId:'015e1644-a758-4fd2-9a11-a32d9108d76e'};
 const saved={...createCabinet('base','upper',800),height:740,depth:598,variantId:upperId,frontMaterialId:'paint_40576c',carcassMaterialId:'wood',components:[{type:'worktop',model:'marble'},{type:'door-front',model:'flat'}]};
 const before={...kitchen,cabinets:[lower,saved]};
 const next=reconcileKitchenCatalog(before,[upperModule]);
 assert.equal(next.cabinets[0].type,'base');
 assert.equal(next.cabinets[0].position.y,0);
 const fixed=next.cabinets[1];
 assert.equal(fixed.type,'wall');
 assert.equal(fixed.variantId,upperId);
 assert.equal(fixed.position.y,840+kitchen.countertop.thickness+kitchen.wallClearance);
 assert.equal(fixed.autoElevation,true);
 assert.equal(fixed.frontMaterialId,saved.frontMaterialId);
 assert.equal(fixed.carcassMaterialId,saved.carcassMaterialId);
 assert.equal(fixed.position.x,saved.position.x);
 assert.equal(fixed.position.z,saved.depth/2,'the corrected wall cabinet must touch the wall exactly');
 assert.deepEqual(fixed.components,[{type:'door-front',model:'flat'}]);
 assert.equal(before.cabinets[1].type,'base');
 assert.equal(reconcileKitchenCatalog(next,[upperModule]),next,'repair is idempotent');
 const {fitCountertops}=loadSource('src/lib/kitchenPlacement.ts');
 assert.ok(fitCountertops(next).every(top=>!top.cabinetIds.includes('upper')));
 const {parseKitchen}=loadSource('src/lib/kitchenAssembly.ts');
 assert.equal(parseKitchen(JSON.parse(JSON.stringify(next))).cabinets[1].type,'wall');
});

test('an unrelated, resized, or unmarked wrong-role SKU never triggers automatic reclassification',()=>{
 const kitchen=createModularKitchen();
 const model=moduleOf('wall');
 const saved={...createCabinet('base','base'),height:740,depth:350,variantId:'wall'};
 for(const candidate of [model,{...model,widthMm:800,variants:[{...model.variants[0],configuration:{catalogRoleCorrection:{from:'base',to:'wall'}}}]}]) {
  const next=reconcileKitchenCatalog({...kitchen,cabinets:[saved]},[candidate]);
  assert.equal(next.cabinets[0].type,'base');
  assert.equal(next.cabinets[0].position.y,0);
 }
});
