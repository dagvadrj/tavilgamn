const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {loadSource}=require('./helpers/load-source.cjs');
const {createUnifiedKitchen,parseKitchen}=loadSource('src/lib/kitchenAssembly.ts');
const {createKitchenFromSelection}=loadSource('src/lib/kitchenSelectionDesign.ts');
const {kitchenPreferences}=loadSource('src/lib/kitchenFlow.ts');
const {placementIssues}=loadSource('src/lib/kitchenPlacement.ts');
function box(type,width,height,depth,n,opening='doors',doors=2,drawers=0){
 const id=`40000000-1025-4026-8000-${String(n).padStart(12,'0')}`;
 return {id,code:`${type}-${width}`,name:'Catalog box',cabinetType:type,widthMm:width,heightMm:height,depthMm:depth,active:true,
 variants:[{furnitureModelId:id,productId:`p${n}`,modelName:'Catalog box',variantCode:`BOX-${n}`,opening,doorCount:doors,drawerCount:drawers,configuration:{},isDefault:true,sortOrder:0,active:true,glbFile:'box.glb',processingStatus:'ready'}]};
}
const modules=[box('base',600,840,598,1,'drawers',1,1),box('base',1000,840,600,2),box('wall',800,740,598,3)];
for(const [width,depth]of[[4000,3000],[3000,2000]])test(`all 72 complete selections produce their selected design in ${width}x${depth}`,()=>{
 const old=createUnifiedKitchen();old.room={width,depth,height:2700};old.countertop.material='granite';
 const before=JSON.stringify(old);
 for(const oven of ['under-worktop','high-cabinet'])for(const hood of ['integrated','wall','none'])for(const refrigerator of ['integrated','freestanding','none'])for(const layout of ['straight','l-right','u','double-side']){
  const answers={oven,hood,refrigerator,layout};
  const next=createKitchenFromSelection(old,answers,modules);
  assert.deepEqual(kitchenPreferences(next),answers,JSON.stringify(answers));
  assert.deepEqual(next.room,old.room);assert.deepEqual(next.countertop,old.countertop);
  assert.deepEqual(placementIssues(next).filter(i=>i.severity==='error'),[]);
  const restored=parseKitchen(JSON.parse(JSON.stringify(next)));assert.deepEqual(kitchenPreferences(restored),answers);
  const cooker=next.cabinets.find(c=>c.type==='base'&&['hob','oven'].includes(c.opening));
  const hoodBox=next.cabinets.find(c=>c.opening==='hood');
  if(hoodBox){assert.equal(hoodBox.position.rotation,cooker.position.rotation);assert.equal(hoodBox.hoodMount,hood==='integrated'?'under-cabinet':'wall');}
  if(hood==='integrated'){assert.ok(hoodBox.variantId);assert.equal(hoodBox.catalogAdaptation,'hood');}
  if(hood==='wall')assert.equal(hoodBox.catalogHousing,'wall-hood');
  const fridge=next.cabinets.find(c=>c.opening==='refrigerator');
  if(refrigerator==='integrated'){assert.equal(fridge.catalogHousing,'fridge-integrated');assert.equal(fridge.applianceProductId,undefined,'never disguise a freestanding product as integrated');}
  if(refrigerator==='freestanding'){assert.ok(fridge.applianceProductId);assert.equal(fridge.catalogHousing,undefined);}
  if(oven==='high-cabinet')assert.equal(next.cabinets.find(c=>c.opening==='oven').catalogHousing,'oven-tower');
 }
 assert.equal(JSON.stringify(old),before,'explicit generation retains the old project for undo');
});

const nodes=node=>!React.isValidElement(node)?[]:[node,...React.Children.toArray(node.props.children).flatMap(nodes)];
test('the final wizard action sends the current four answers directly to the parent, including a last-step layout change',()=>{
 const answers={oven:'high-cabinet',hood:'none',refrigerator:'freestanding',layout:'u'};
 let at=0,received,visits=[];
 const hooks={...React,useEffect(){},useRef:v=>({current:v}),useMemo:fn=>fn(),useState:initial=>[[4,'',answers][at++],()=>{}]};
 const {KitchenSuggestionWizard}=loadSource('src/components/KitchenSuggestionWizard.tsx',{react:hooks,'next/navigation':{useRouter:()=>({push:href=>visits.push(href)})},'@/store/auth':{useAuth:()=>null},'@/lib/plannerNavigation':{startPlannerNavigation(){}}});
 const tree=KitchenSuggestionWizard({initialPreferences:answers,onComplete:value=>{received=value;return true;}});
 const finish=nodes(tree).find(n=>n.type==='button'&&React.Children.toArray(n.props.children).includes('Гал тогооны загвар үүсгэх'));
 assert.ok(finish);finish.props.onClick();assert.deepEqual(received,answers);assert.deepEqual(visits,[]);
});

test('housing and appliance rendering distinguish concealed hood, exposed hood, integrated fridge and raised oven',()=>{
 const hooks={...React,useMemo:fn=>fn()};const CabinetBody=()=>null,GLBFurnitureMesh=()=>null;
 const {KitchenCabinetGLB}=loadSource('src/three/KitchenCabinetGLB.tsx',{react:hooks,'./KitchenCabinetBody':{CabinetBody},'./GLBFurnitureMesh':{GLBFurnitureMesh}});
 const design=createKitchenFromSelection(createUnifiedKitchen(),{oven:'high-cabinet',hood:'integrated',refrigerator:'integrated',layout:'l-right'},modules);
 const oven=design.cabinets.find(c=>c.opening==='oven'),fridge=design.cabinets.find(c=>c.opening==='refrigerator'),hood=design.cabinets.find(c=>c.opening==='hood');
 const tower=KitchenCabinetGLB({cabinet:oven});assert.equal(tower.type,CabinetBody);assert.equal(tower.props.catalogAppliances,true);
 const concealed=KitchenCabinetGLB({cabinet:fridge});assert.equal(concealed.type,CabinetBody);assert.equal(concealed.props.cabinet.opening,'doors');
 const {KitchenCatalogAppliance}=loadSource('src/three/KitchenCatalogAppliance.tsx',{'./GLBFurnitureMesh':{GLBFurnitureMesh}});
 const hoodTree=nodes(KitchenCatalogAppliance({cabinet:hood}));assert.ok(hoodTree.some(n=>n.type==='group'&&n.props.position?.[1]===-.085));
 const ovenTree=nodes(KitchenCatalogAppliance({cabinet:oven}));assert.ok(ovenTree.some(n=>n.type==='group'&&n.props.position?.[1]===.905));
 const exposed=createKitchenFromSelection(createUnifiedKitchen(),{oven:'under-worktop',hood:'wall',refrigerator:'none',layout:'straight'},modules).cabinets.find(c=>c.opening==='hood');
 assert.ok(nodes(KitchenCatalogAppliance({cabinet:exposed})).some(n=>n.type==='boxGeometry'&&n.props.args[1]>.5));
});

test('standalone wizard completion persists the selected answers and opens the generated design directly',()=>{
 const answers={oven:'under-worktop',hood:'wall',refrigerator:'none',layout:'straight'};
 let at=0;const routes=[],saved=new Map(),previous=global.localStorage;
 global.localStorage={setItem:(k,v)=>saved.set(k,v)};
 const hooks={...React,useEffect(){},useRef:v=>({current:v}),useMemo:fn=>fn(),useState:initial=>[[4,'',answers][at++],()=>{}]};
 const {KitchenSuggestionWizard}=loadSource('src/components/KitchenSuggestionWizard.tsx',{react:hooks,'next/navigation':{useRouter:()=>({push:href=>routes.push(href)})},'@/store/auth':{useAuth:()=>null},'@/lib/plannerNavigation':{startPlannerNavigation(){}}});
 try{
  const tree=KitchenSuggestionWizard({initialPreferences:answers});
  nodes(tree).find(n=>n.type==='button'&&React.Children.toArray(n.props.children).includes('Гал тогооны загвар үүсгэх')).props.onClick();
  assert.equal(routes.length,1);assert.ok(!routes[0].includes('space=1'));
  const payload=JSON.parse([...saved.values()][0]);assert.equal(payload.flowStage,'design');assert.deepEqual(payload.preferences,answers);
  assert.deepEqual(kitchenPreferences(payload.design),answers);
 }finally{global.localStorage=previous;}
});
