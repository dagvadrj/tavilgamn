const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {loadSource}=require('./helpers/load-source.cjs');
const collection=require('../public/materials/b2b-f/planner-materials.json');
const manifest=require('../public/materials/b2b-f/manifest.json');
const {withKitchenSupplierMaterials}=loadSource('src/lib/kitchenSupplierMaterials.ts',{'../../public/materials/b2b-f/planner-materials.json':{default:collection}});

test('supplier materials expose actual local texture files while excluding conflicted supplier links',()=>{
  const materials=withKitchenSupplierMaterials([]);
  assert.ok(materials.length>50);
  const rejected=new Set(manifest.materials.filter(m=>m.requiresSourceReview).map(m=>m.id));
  for(const material of materials){
    assert.equal(rejected.has(material.id),false);
    assert.equal(material.baseColor,'#FFFFFF','supplier texture colours must not be tinted by a paint swatch');
    assert.ok(fs.existsSync('public'+material.texturePaths.baseColor));
    assert.ok(/^b2bf-[a-z0-9-]+$/.test(material.id));
    assert.ok(material.id.length<=64);
  }
  assert.ok(materials.some(m=>m.name.includes('H3303 ST10 Natural Hamilton Oak')));
});

test('published material definitions retain priority and default paint choices are kept',()=>{
  const first=collection.materials[0];
  const existing={...first,baseColor:'#123456',texturePaths:{baseColor:'/admin-authored.webp'}};
  const plain={id:'matte',name:'Matte',surfaceKind:'general',baseColor:'#FFFFFF',roughness:.7,metalness:0,texturePaths:{}};
  const merged=withKitchenSupplierMaterials([existing,plain]);
  assert.equal(merged.find(m=>m.id===first.id),existing);
  assert.equal(merged.find(m=>m.id==='matte'),plain);
  assert.equal(new Set(merged.map(m=>m.id)).size,merged.length);
});

test('selected supplier facade texture survives a saved kitchen round trip',()=>{
  const {createModularKitchen}=loadSource('src/lib/kitchenCabinets.ts');
  const {parseKitchen}=loadSource('src/lib/kitchenAssembly.ts');
  const material=withKitchenSupplierMaterials([]).find(m=>m.name.includes('H3303 ST10'));
  const kitchen=createModularKitchen();kitchen.cabinets[0].frontMaterialId=material.id;
  const restored=parseKitchen(JSON.parse(JSON.stringify(kitchen)));
  assert.equal(restored.cabinets[0].frontMaterialId,material.id);
  assert.equal(withKitchenSupplierMaterials([]).find(m=>m.id===restored.cabinets[0].frontMaterialId).texturePaths.baseColor,material.texturePaths.baseColor);
});
