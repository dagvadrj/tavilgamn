const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadSource}=require('./helpers/load-source.cjs');
const {PCMALL_APPLIANCES,PCMALL_PRODUCTS,pcmallAppliance,PCMALL_MODEL_VERSION}=loadSource('src/lib/pcmallAppliances.ts');
const {extraFromProduct,findExtraSpace,parseKitchenExtras}=loadSource('src/lib/kitchenExtras.ts');
const {createModularKitchen}=loadSource('src/lib/kitchenCabinets.ts');
const {parseKitchen}=loadSource('src/lib/kitchenAssembly.ts');
const {placementIssues}=loadSource('src/lib/kitchenPlacement.ts');

test('the actual appliance inspector exposes seven PC Mall additions with source links even without remote catalog products',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const {ExtrasPanel}=loadSource('src/features/kitchen-planner/components/ExtrasPanel.tsx',{'next/image':{default:'img'}});
 const markup=renderToStaticMarkup(React.createElement(ExtrasPanel,{initialTab:'appliances',products:[],room:{width:4000,depth:3000,height:2600},disabled:false,error:null,loading:false,onAdd(){},onChange(){},onDelete(){},onDuplicate(){}}));
 for(const item of PCMALL_APPLIANCES){
  assert.ok(markup.includes(`${item.model} нэмэх`),item.model);
  assert.ok(markup.includes(`https://pc-mall.mn/products/${item.sourceId}`));
 }
 assert.equal((markup.match(/Зурагт нэмэх/g)||[]).length,7);
 assert.ok(!markup.includes('Энэ төрөлд 3D загвартай бүтээгдэхүүн олдсонгүй'));
});

test('supplier search filters the same catalog that the appliance inspector displays',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const {PcmallApplianceLibrary}=loadSource('src/features/kitchen-planner/components/PcmallApplianceLibrary.tsx',{'next/image':{default:'img'}});
 const markup=renderToStaticMarkup(React.createElement(PcmallApplianceLibrary,{query:'F4X7',disabled:false,onAdd(){}}));
 assert.ok(markup.includes('F4X7ES5W нэмэх'));
 assert.ok(!markup.includes('BOEI697688 нэмэх'));
 assert.equal((markup.match(/Зурагт нэмэх/g)||[]).length,1);
});

test('all seven supplier GLBs have the verified outer dimensions and declare their illustration provenance',async()=>{
 const THREE=await import('three');
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
 assert.equal(PCMALL_PRODUCTS.length,7);assert.equal(new Set(PCMALL_APPLIANCES.map(a=>a.type)).size,7);
 for(const item of PCMALL_APPLIANCES){
  const bytes=fs.readFileSync(`public/models/pcmall/${PCMALL_MODEL_VERSION}/${item.type}.glb`);
  const gltf=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const bounds=new THREE.Box3().setFromObject(gltf.scene),size=bounds.getSize(new THREE.Vector3());
  for(const [actual,expected] of [[size.x,item.width/1000],[size.y,item.height/1000],[size.z,item.depth/1000],[bounds.min.y,0]])assert.ok(Math.abs(actual-expected)<1e-6,`${item.type}: ${actual} != ${expected}`);
  assert.ok(gltf.scene.children.some(node=>node.userData.manufacturerCad===false));
  const image=fs.readFileSync(`public/models/pcmall/${item.imageFile}`);assert.ok(image.length>1000);
  assert.ok(PCMALL_PRODUCTS.find(p=>p.model.id===item.id).specifications.sourceUrl.startsWith('https://pc-mall.mn/products/'));
 }
});

test('quality GLBs preserve smooth bevel normals, real oven depth and transparent glazing without face photographs',async()=>{
 const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
 for(const type of ['oven','washing-machine','microwave','cooktop']){
  const bytes=fs.readFileSync(`public/models/pcmall/${PCMALL_MODEL_VERSION}/${type}.glb`);
  const {scene}=await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  const meshes=[];scene.traverse(node=>{if(node.isMesh)meshes.push(node)});
  assert.ok(meshes.length<=24,'material batching keeps the detail affordable');
  let smoothlyShadedTriangles=0;
  for(const mesh of meshes){
   const p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,index=mesh.geometry.index;
   assert.ok(!mesh.material.map,'no product photograph may substitute for 3D front geometry');
   for(let i=0;i<n.count;i++)assert.ok(Math.abs(Math.hypot(n.getX(i),n.getY(i),n.getZ(i))-1)<.002,'normals must remain unit length');
   for(let i=0;i<(index?.count??p.count);i+=3){
    const a=index?index.getX(i):i,b=index?index.getX(i+1):i+1;
    if(Math.abs(n.getX(a)-n.getX(b))+Math.abs(n.getY(a)-n.getY(b))+Math.abs(n.getZ(a)-n.getZ(b))>.005)smoothlyShadedTriangles++;
   }
  }
  assert.ok(smoothlyShadedTriangles>40,'bevels and curved parts must interpolate normals rather than facet every triangle');
  if(type!=='cooktop'){
   const glazing=meshes.filter(m=>m.userData.applianceGlass);
   assert.ok(glazing.length>0);assert.ok(glazing.every(m=>m.material.transparent&&m.material.opacity<.4));
  }
  if(type==='oven'){
   const rack=meshes.find(m=>m.userData.appliancePart==='Oven wire rack');assert.ok(rack);
   rack.geometry.computeBoundingBox();assert.ok(rack.geometry.boundingBox.max.z-rack.geometry.boundingBox.min.z>.3,'rack has physical depth behind the glass');
   assert.ok(meshes.some(m=>m.userData.appliancePart==='Oven convection fan'));
   assert.ok(meshes.some(m=>m.userData.appliancePart==='Oven baking trays'));
  }
 }
});

test('seven imports occupy valid separate volumes and survive saved kitchen parsing',()=>{
 let kitchen=createModularKitchen();
 for(const product of PCMALL_PRODUCTS){
  const placed=findExtraSpace(kitchen,extraFromProduct(product,`import-${product.model.id}`));
  assert.ok(placed,`no placement for ${product.name}`);
  kitchen={...kitchen,extras:[...(kitchen.extras??[]),placed]};
 }
 assert.deepEqual(placementIssues(kitchen).filter(i=>i.severity==='error'),[]);
 const restored=parseKitchen(JSON.parse(JSON.stringify(kitchen)));
 assert.equal(restored.extras.length,7);
 for(const extra of restored.extras)assert.ok(pcmallAppliance(extra.productId,extra.model));
 const washer=restored.extras.find(e=>e.asset.type==='washing-machine');assert.equal(washer.height,850);assert.equal(washer.position.y,0);
 const hood=restored.extras.find(e=>e.asset.type==='hood');assert.equal(hood.position.y,1450);
});

test('a forged integrated model cannot bypass component restrictions and countertop imports need an actual top',()=>{
 const kitchen=createModularKitchen(),oven=extraFromProduct(PCMALL_PRODUCTS.find(p=>p.model.file==='oven.glb'),'oven');
 assert.equal(pcmallAppliance(oven.productId,{...oven.model,file:'../oven.glb'}),undefined);
 assert.throws(()=>parseKitchenExtras([{...oven,model:{...oven.model,id:'20000000-1024-4026-8000-000000000001'}}],new Set(),kitchen.room));
 const microwave=extraFromProduct(PCMALL_PRODUCTS.find(p=>p.model.file==='microwave.glb'),'micro');
 assert.equal(findExtraSpace({...kitchen,cabinets:[]},microwave),null);
 const top={id:'detached',width:1400,depth:600,thickness:30,material:'laminate',cabinetIds:[],position:{x:2500,z:1800,y:1000,rotation:Math.PI/2}};
 const moved=findExtraSpace({...kitchen,countertopLayout:{mode:'manual',panels:[top]}},microwave);
 assert.ok(moved);assert.equal(moved.position.y,1030);assert.equal(moved.position.rotation,Math.PI/2);
 assert.equal(moved.position.x,2500);assert.equal(moved.position.z,1800);
});
