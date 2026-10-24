const test = require('node:test');
const assert = require('node:assert/strict');
const {loadSource} = require('./helpers/load-source.cjs');
const {DEFAULT_HOMEPAGE_HERO} = loadSource('src/lib/homepagePresentation.ts');
const {defaultHomepageSettings} = loadSource('src/lib/homepageSettings.ts');
test('homepage featured edits validate public models and retain concurrency protection', async () => {
 const current={...defaultHomepageSettings(),version:4};let valid=true,row;const checked=[];
 const selected='11111111-1111-4111-8111-111111111111';
 const {PUT}=loadSource('src/app/api/admin/homepage/route.ts',{
  '@/lib/supabase/requireAdmin':{requireAdmin:async()=>({userId:'admin'})},
  '@/lib/homepageSettingsServer':{readHomepageSettings:async()=>current},
  '@/lib/catalogServer':{readProduct:async(id)=>{checked.push(id);return valid?{category:'sofa',model:{id:'model'}}:null;}},
  '@/lib/supabase/admin':{getSupabaseAdmin:()=>({from:()=>({update(value){row=value;return this},eq(){return this},select(){return this},maybeSingle:async()=>({data:{version:5}})})})},
 });
 const request=()=>new Request('http://localhost/api/admin/homepage',{method:'PUT',body:JSON.stringify({...current,hero:DEFAULT_HOMEPAGE_HERO,productIds:[selected,current.productIds[1]],updateFeatured:true})});
 valid=false;assert.equal((await PUT(request())).status,422);assert.equal(row,undefined);
 valid=true;assert.equal((await PUT(request())).status,200);assert.deepEqual(row.product_ids,[selected,current.productIds[1]]);assert.deepEqual(checked,[selected,selected]);assert.equal(row.version,5);
});
