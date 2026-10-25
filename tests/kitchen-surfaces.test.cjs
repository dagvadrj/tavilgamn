const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {loadSource}=require('./helpers/load-source.cjs');
const {createUnifiedKitchen}=loadSource('src/lib/kitchenAssembly.ts');
const {KitchenTops}=loadSource('src/three/KitchenTops.tsx',{
 react:{...React,useMemo:fn=>fn(),useEffect(){},useState:()=>[undefined,()=>{}]},
 '@/three/kitchenTextures':{createKitchenTexture:()=>null},
});
function nodes(tree){
 if(!tree||typeof tree!=='object')return [];
 if(Array.isArray(tree))return tree.flatMap(nodes);
 if(typeof tree.type==='function')return nodes(tree.type(tree.props));
 return [tree,...React.Children.toArray(tree.props?.children).flatMap(nodes)];
}
test('production kitchen surfaces include continuous tops, real appliance cutouts and splashbacks without substitute wooden plinths',()=>{
 const kitchen=createUnifiedKitchen();
 kitchen.backsplash=true;
 const all=nodes(KitchenTops({kitchen}));
 const tops=all.filter(n=>n.type==='extrudeGeometry');
 assert.ok(tops.length>0);
 assert.equal(tops.reduce((sum,n)=>sum+n.props.args[0].holes.length,0),2);
 assert.ok(!all.some(n=>n.props?.name?.startsWith('Component-plinth-')));
 assert.ok(all.some(n=>n.props?.name==='Appliance-sink-base-2'));
 assert.ok(all.some(n=>n.props?.name==='Appliance-cooktop-base-4'));
 assert.ok(all.some(n=>n.props?.name?.startsWith('backsplash:')));
});
test('uploaded sink and hob models do not get duplicate counter appliances',()=>{
 const kitchen=createUnifiedKitchen();
 const all=nodes(KitchenTops({kitchen,catalogApplianceIds:['base-2','base-4']}));
 assert.ok(!all.some(n=>n.props?.name?.startsWith('Appliance-')));
 assert.equal(all.filter(n=>n.type==='extrudeGeometry').reduce((sum,n)=>sum+n.props.args[0].holes.length,0),2);
});
