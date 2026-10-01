const {test}=require('node:test');const assert=require('node:assert/strict');
const sharp=require('sharp');const {compareScreenshots}=require('../scripts/verify/kitchen-visual.cjs');
test('visual regression gate accepts identical pixels and rejects layout-sized changes and viewport drift',async()=>{
  const create=async(w,color)=>sharp({create:{width:w,height:20,channels:3,background:color}}).png().toBuffer();
  const baseline=await create(20,'white');
  assert.equal((await compareScreenshots(baseline,baseline)).changedRatio,0);
  await assert.rejects(compareScreenshots(baseline,await create(20,'black')),/Visual regression/);
  await assert.rejects(compareScreenshots(baseline,await create(21,'white')),/Viewport mismatch/);
});
