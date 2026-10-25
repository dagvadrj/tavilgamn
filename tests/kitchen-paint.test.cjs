const {test}=require('node:test');
const assert=require('node:assert/strict');
const THREE=require('three');
const React=require('react');
const {loadSource}=require('./helpers/load-source.cjs');
const {kitchenPaintMaterial,resolveKitchenPaintMaterial}=loadSource('src/lib/kitchenPaint.ts');
const {kitchenSurfaceClassifier}=loadSource('src/three/kitchenSurfaceClassification.ts');
const {applyKitchenPartMaterial}=loadSource('src/three/kitchenPartMaterial.ts');

test('custom cabinet paint survives save parsing without a database material record',()=>{
  const {createModularKitchen}=loadSource('src/lib/kitchenCabinets.ts');
  const {parseKitchen}=loadSource('src/lib/kitchenAssembly.ts');
  const kitchen=createModularKitchen();
  kitchen.cabinets[0].carcassMaterialId=kitchenPaintMaterial('#40576c').id;
  kitchen.cabinets[0].frontMaterialId=kitchenPaintMaterial('#F5F4F0').id;
  const restored=parseKitchen(JSON.parse(JSON.stringify(kitchen)));
  assert.equal(resolveKitchenPaintMaterial(restored.cabinets[0].carcassMaterialId).baseColor,'#40576C');
  assert.equal(resolveKitchenPaintMaterial(restored.cabinets[0].frontMaterialId).baseColor,'#F5F4F0');
  assert.equal(restored.cabinets[1].carcassMaterialId,undefined);
  assert.deepEqual(restored.cabinets[0].position,kitchen.cabinets[0].position);
});

test('paint accepts six-digit colors, while catalog textures keep their authored definition',()=>{
  for(const bad of ['red','#fff','40576c','#40576c00','paint_40576c']) assert.equal(kitchenPaintMaterial(bad),undefined);
  assert.equal(resolveKitchenPaintMaterial('paint_gggggg'),undefined);
  assert.equal(resolveKitchenPaintMaterial('missing'),undefined);
  const oak={id:'oak',baseColor:'#FFFFFF',texturePaths:{baseColor:'/oak.webp'}};
  assert.equal(resolveKitchenPaintMaterial('oak',{oak}),oak);
  assert.deepEqual(kitchenPaintMaterial('#40576c').texturePaths,{});
});

function cabinetMeshes(){
  const root=new THREE.Group();
  const original=new THREE.MeshStandardMaterial({color:'#eeeeee',map:new THREE.Texture(),metalness:0});
  function mesh(name,size,pos){const m=new THREE.Mesh(new THREE.BoxGeometry(...size),original);m.name=name;m.position.fromArray(pos);root.add(m);return m;}
  const body=mesh('boxnii shanaa',[1,.84,.6],[0,.42,0]);
  const front=mesh('Geom3D_Component#126',[.48,.8,.018],[-.25,.42,.31]);
  const hinge=mesh('Geom3D.003',[.03,.05,.02],[.43,.42,.28]);
  const glass=mesh('Glass panel',[.3,.4,.008],[.15,.42,.315]);
  return {root,body,front,hinge,glass,original};
}

test('unnamed front panels are separate from the box and small hardware',()=>{
  const {root,body,front,hinge,glass,original}=cabinetMeshes();
  root.rotation.y=Math.PI/2;root.position.set(12,0,-6);
  const classify=kitchenSurfaceClassifier(root);
  assert.equal(classify(body,original),'carcass');
  assert.equal(classify(front,original),'front');
  assert.equal(classify(hinge,original),null);
  assert.equal(classify(glass,original),null);
});

test('painting a box and facade preserves hardware, glass and the shared source material',()=>{
  const {root,body,front,hinge,glass,original}=cabinetMeshes();
  const disposeBody=applyKitchenPartMaterial(root,kitchenPaintMaterial('#40576C'),{},'carcass');
  const disposeFront=applyKitchenPartMaterial(root,kitchenPaintMaterial('#647967'),{},'front');
  assert.equal(body.material.color.getHexString(),'40576c');
  assert.equal(front.material.color.getHexString(),'647967');
  assert.equal(body.material.map,null);assert.equal(front.material.map,null);
  assert.equal(hinge.material,original);assert.equal(glass.material,original);
  assert.equal(original.color.getHexString(),'eeeeee');assert.ok(original.map);
  disposeFront();disposeBody();
});

test('a persisted custom paint reaches standalone and assembled cabinet renderers',()=>{
  const {createCabinet}=loadSource('src/lib/kitchenCabinets.ts');
  const {KitchenCabinetGLB}=loadSource('src/three/KitchenCabinetGLB.tsx',{react:{...React,useMemo:fn=>fn()},'./GLBFurnitureMesh':{GLBFurnitureMesh:'uploaded-model'}});
  const cabinet={...createCabinet('base','base'),carcassMaterialId:'paint_40576c',frontMaterialId:'paint_647967'};
  const variant={furnitureModelId:'base',glbFile:'base.glb',cabinetType:'base',opening:'doors',configuration:{}};
  const tree=KitchenCabinetGLB({cabinet,variant});
  const model=React.Children.toArray(tree.props.children).find(n=>n.type==='uploaded-model');
  assert.equal(model.props.carcassMaterial.baseColor,'#40576C');
  assert.equal(model.props.frontMaterial.baseColor,'#647967');
  const assembly={version:1,slots:[{id:'door',label:'Door',kind:'door',defaultOptionId:'white',options:[{id:'white',label:'White',modelId:'11111111-2222-4333-8444-555555555555'}]}]};
  const assembled=KitchenCabinetGLB({cabinet,variant:{...variant,configuration:{assembly}}});
  assert.equal(assembled.type.name,'AssemblyModel');
  assert.equal(assembled.props.carcassMaterial.baseColor,'#40576C');
  assert.equal(assembled.props.frontMaterial.baseColor,'#647967');
});
