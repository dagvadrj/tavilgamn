const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { modelPlacement } = loadSource('src/lib/modelPlacement.ts');
const bounds={min:{x:-.3,y:0,z:-.31755},max:{x:.3,y:.84,z:.31755}};
test('physical oven keeps 635.1mm total depth and aligns 600mm carcass back',()=>{
  const fit=modelPlacement(bounds,{w:.6,h:.84,d:.6},true);
  assert.deepEqual(fit.scale,[1,1,1]);assert.ok(Math.abs(bounds.min.z+fit.position[2]+.3)<1e-12);
  assert.ok(Math.abs(bounds.max.z+fit.position[2]-.3351)<1e-12);
});
test('motion preview matches real high bounds without shifting the carcass back',()=>{
  const preview={min:{x:-.295,y:0,z:-.31},max:{x:.295,y:.83,z:.31}};
  const fit=modelPlacement(preview,{w:.6,h:.84,d:.6},true,{w:.6,h:.84,d:.6351});
  assert.ok(Math.abs((preview.min.z+fit.position[2])*fit.scale[2]+.3)<1e-12);
  assert.ok(Math.abs((preview.max.z+fit.position[2])*fit.scale[2]-.3351)<1e-12);
});
test('740mm physical cabinet does not stretch to 840mm; legacy fitting remains available',()=>{
  const short={min:{x:-.4,y:0,z:-.299},max:{x:.4,y:.74,z:.299}}, footprint={w:.8,h:.84,d:.6};
  assert.equal(modelPlacement(short,footprint,true).scale[1],1);
  assert.equal(modelPlacement(short,footprint,false).scale[1],.84/.74);
});
