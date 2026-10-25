const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const THREE=require('three');
const {loadSource}=require('./helpers/load-source.cjs');
const {createUnifiedKitchen,parseKitchen}=loadSource('src/lib/kitchenAssembly.ts');
const {fitCountertops}=loadSource('src/lib/kitchenPlacement.ts');
const {withKitchenCountertopMaterial}=loadSource('src/lib/kitchenCountertopMaterial.ts');
const {kitchenMaterialGroup}=loadSource('src/lib/kitchenMaterialGroups.ts');
const collection=require('../public/materials/b2b-f/planner-materials.json');
const definitions=Object.fromEntries(collection.materials.map(m=>[m.id,m]));
const oak=collection.materials.find(m=>m.name.includes('H3303 ST10'));
const stone=collection.materials.find(m=>m.name.includes('F205 ST9'));

test('supplier decor groups distinguish wood, stone, solid colour and metal/textile',()=>{
 assert.equal(kitchenMaterialGroup(oak),'wood');
 assert.equal(kitchenMaterialGroup(stone),'stone');
 for(const code of ['U665 ST9','U727 ST9']) assert.equal(kitchenMaterialGroup(collection.materials.find(m=>m.name.includes(code))),'color');
 for(const code of ['F416 ST10','F500 ST20']) assert.equal(kitchenMaterialGroup(collection.materials.find(m=>m.name.includes(code))),'other');
});

test('changing all worktops preserves cabinet finishes, dimensions, holes and persisted material',()=>{
 const before=createUnifiedKitchen();
 before.cabinets[0].frontMaterialId='paint_40576c';
 before.cabinets[0].carcassMaterialId='paint_647967';
 before.cabinets[0].components=[{type:'worktop',model:'walnut',finish:'walnut',color:'#000000'}];
 const original=JSON.stringify(before);
 for(const material of [stone,oak]) {
  const next=withKitchenCountertopMaterial(before,material.id,definitions);
  const restored=parseKitchen(JSON.parse(JSON.stringify(next)));
  assert.equal(restored.countertop.materialId,material.id);
  assert.equal(restored.countertop.material,material===oak?'wood':'granite');
  assert.equal(restored.countertop.color,undefined);
  assert.equal(restored.cabinets[0].frontMaterialId,'paint_40576c');
  assert.equal(restored.cabinets[0].carcassMaterialId,'paint_647967');
  for(let i=0;i<before.cabinets.length;i++) {
   assert.deepEqual(restored.cabinets[i].position,before.cabinets[i].position);
   assert.equal(restored.cabinets[i].width,before.cabinets[i].width);
   assert.equal(restored.cabinets[i].opening,before.cabinets[i].opening);
  }
  assert.ok(fitCountertops(next).every(t=>t.materialId===material.id&&t.color===undefined));
 }
 assert.equal(JSON.stringify(before),original,'the original design must remain undoable');
});

test('custom worktop paint survives reload and rejects missing or incompatible materials',()=>{
 const kitchen=createUnifiedKitchen();
 const next=withKitchenCountertopMaterial(kitchen,'paint_123456',definitions);
 assert.equal(parseKitchen(JSON.parse(JSON.stringify(next))).countertop.materialId,'paint_123456');
 assert.equal(next.countertop.material,'laminate');
 assert.equal(next.countertop.finish,'matte');
 assert.throws(()=>withKitchenCountertopMaterial(kitchen,'missing',definitions));
 assert.throws(()=>withKitchenCountertopMaterial(kitchen,'front-only',{'front-only':{...oak,id:'front-only',surfaceKind:'front'}}));
});

function nodes(tree){
 if(!tree||typeof tree!=='object')return [];
 if(Array.isArray(tree))return tree.flatMap(nodes);
 if(typeof tree.type==='function')return nodes(tree.type(tree.props));
 return [tree,...React.Children.toArray(tree.props?.children).flatMap(nodes)];
}

test('real worktop renderer binds supplier maps, keeps cutouts and selects a separate top group',()=>{
 const diffuse=new THREE.Texture(),normal=new THREE.Texture();
 const paths=stone.texturePaths;
 const {KitchenTops}=loadSource('src/three/KitchenTops.tsx',{
  react:{...React,useMemo:fn=>fn(),useEffect(){},useState:()=>[{key:JSON.stringify(paths),textures:{baseColor:diffuse,normal}},()=>{}]},
 });
 const kitchen=withKitchenCountertopMaterial(createUnifiedKitchen(),stone.id,definitions);
 kitchen.backsplash=true;
 kitchen.backsplashMaterialId=stone.id;
 let selected;
 const all=nodes(KitchenTops({kitchen,materialDefinitions:definitions,onSelectCountertop:top=>{selected=top.id;}}));
 const groups=all.filter(n=>n.type==='group'&&n.props.name?.startsWith('top:'));
 assert.ok(groups.length);
 for(const group of groups){
  const mesh=React.Children.only(group.props.children);
  const material=React.Children.toArray(mesh.props.children).find(n=>n.type==='meshStandardMaterial');
  assert.equal(material.props.map,diffuse);
  assert.equal(material.props.normalMap,normal);
  assert.equal(material.props.color,'#FFFFFF');
  mesh.props.onClick({delta:10,stopPropagation(){}});
  assert.equal(selected,undefined,'camera dragging must not select the worktop');
  mesh.props.onClick({delta:0,stopPropagation(){}});
  assert.equal(selected,group.props.name);
  selected=undefined;
 }
 assert.equal(all.filter(n=>n.type==='extrudeGeometry').reduce((sum,n)=>sum+n.props.args[0].holes.length,0),2);
 assert.ok(all.some(n=>n.props?.name?.startsWith('backsplash:')&&nodes(n).some(child=>child.type==='meshStandardMaterial'&&child.props.map===diffuse)));
});
