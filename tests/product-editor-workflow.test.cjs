const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const { NextRequest } = require('next/server');
const { loadSource } = require('./helpers/load-source.cjs');

const product = extra => ({ id:'new', name:'Тавиур', category:'storage-shelf', description:'', image:'/test.jpg', images:[], basePrice:100,
  defaultColor:'oak', colors:[{id:'oak',name:'Царс',hex:'#aaaaaa',priceDelta:0}], materials:[{id:'wood',name:'Мод',priceDelta:0}],
  dimensions:{w:.4,d:1,h:1.5},stockQuantity:5,rating:0,reviewCount:0,storeIds:[],...extra });
const json = (value, status=200) => new Response(JSON.stringify(value),{status});

test('category templates show furniture-specific fields and derive accurate customer measurements', () => {
  const { CATEGORIES } = loadSource('src/lib/catalogCategories.ts');
  const { ROOM_CATALOG_GROUPS } = loadSource('src/lib/catalogNavigation.ts');
  const { specificationFields, productSpecificationRows, parseSpecifications } = loadSource('src/lib/productSpecifications.ts');
  for(const category of CATEGORIES) assert.ok(ROOM_CATALOG_GROUPS.some(group=>group.categories.includes(category.id)),category.id);
  assert.ok(specificationFields('storage-shelf').some(field=>field.key==='tiers'));
  assert.ok(!specificationFields('bed').some(field=>field.key==='tiers'));
  assert.ok(specificationFields('bed').some(field=>field.key==='mattressSize'));
  const rows = productSpecificationRows(product({specifications:{tiers:'5',loadCapacity:'50 кг',materialDetail:'Ган, MDF',mattressSize:'hidden'}}));
  assert.equal(rows.find(row=>row.label==='Өргөн').value,'40 см');
  assert.equal(rows.find(row=>row.label==='Материал').value,'Ган, MDF');
  assert.equal(rows.find(row=>row.label==='Тавиурын давхар').value,'5');
  assert.ok(!rows.some(row=>row.value==='hidden'));
  for(const bad of [[],null,{tiers:5},{unknown:'x'},{style:'x'.repeat(301)}]) assert.throws(()=>parseSpecifications(bad));
  const { parseProduct } = loadSource('src/lib/catalogValidation.ts');
  assert.deepEqual(parseProduct(product({specifications:{tiers:' 5 ',style:''}})).specifications,{tiers:'5'});
  assert.equal(parseProduct(product({})).specifications,undefined,'legacy saves omit metadata and preserve existing DB values');
});

test('one save creates a product then uploads its checked model using the returned real ID', async () => {
  const { saveProductWithModel } = loadSource('src/features/admin-products/saveProductWithModel.ts');
  const file = new File([new Uint8Array(12)],'rack.glb');
  const calls=[]; let checkpoint;
  await saveProductWithModel({product:product({specifications:{tiers:'5',mattressSize:'hidden'}}),checkpoint:null,file,preview:{file,frontConfirmed:true,report:{frontProjectionMm:0}},moduleId:'',
    assertOwner:()=>{}, onSaved:value=>checkpoint=value,onProgress:()=>{},
    request:async (url,init)=>{calls.push({url,...init,body:JSON.parse(init.body)});return json(url.endsWith('/products')?{id:'saved-real-id'}:url.endsWith('/upload-url')?{uploadUrl:'https://upload.test/file',sourcePath:'source/rack.glb',modelId:'model-id'}:{});},
    upload:async(url,init)=>{calls.push({url,...init});return new Response(null,{status:200});}});
  assert.deepEqual(checkpoint,{id:'saved-real-id',stockQuantity:5});
  assert.deepEqual(calls.map(call=>[call.url,call.method]),[['/api/admin/products','POST'],['/api/admin/models/upload-url','POST'],['https://upload.test/file','PUT'],['/api/admin/models/upload-complete','POST']]);
  assert.equal(calls[1].body.productId,'saved-real-id');
  assert.deepEqual(calls[0].body.specifications,{tiers:'5'});
  assert.equal(calls[3].body.frontConfirmed,true);
});

test('failed model upload preserves the checkpoint and a retry uses PUT with current stock CAS', async () => {
  const { saveProductWithModel } = loadSource('src/features/admin-products/saveProductWithModel.ts');
  const file=new File([new Uint8Array(12)],'rack.glb');let checkpoint=null;let fail=true;const calls=[];
  const options={product:product({}),file,preview:{file,frontConfirmed:true,report:{frontProjectionMm:0}},moduleId:'',assertOwner:()=>{},onSaved:value=>checkpoint=value,onProgress:()=>{},
    request:async(url,init)=>{calls.push({url,method:init.method,body:JSON.parse(init.body)});return json(url.endsWith('/products')?{id:'saved'}:url.endsWith('/upload-url')?{uploadUrl:'https://upload.test/file',sourcePath:'source/rack.glb',modelId:'model'}:{});},upload:async()=>new Response(null,{status:fail?503:200})};
  await assert.rejects(saveProductWithModel({...options,checkpoint}),/503/);
  assert.deepEqual(checkpoint,{id:'saved',stockQuantity:5});fail=false;
  await saveProductWithModel({...options,checkpoint,product:product({stockQuantity:7})});
  const saves=calls.filter(call=>call.url.endsWith('/products'));
  assert.deepEqual(saves.map(call=>call.method),['POST','PUT']);
  assert.equal(saves[1].body.id,'saved');assert.equal(saves[1].body.expectedStockQuantity,5);assert.equal(checkpoint.stockQuantity,7);
});

test('unconfirmed, stale or invalid models never create a product; changed ownership stops the upload', async () => {
  const { saveProductWithModel } = loadSource('src/features/admin-products/saveProductWithModel.ts');
  const file=new File([new Uint8Array(12)],'rack.glb');let requests=0;
  const options={product:product({}),checkpoint:null,file,preview:{file,frontConfirmed:true,report:{}},moduleId:'',assertOwner:()=>{},onSaved:()=>{},onProgress:()=>{},request:async()=>{requests++;return json({id:'saved'});}};
  for(const change of [{preview:null},{preview:{file,frontConfirmed:false}},{preview:{file:new File([new Uint8Array(12)],'other.glb'),frontConfirmed:true}},{file:new File([new Uint8Array(12)],'bad.obj')}]) await assert.rejects(saveProductWithModel({...options,...change}));
  assert.equal(requests,0);
  let ownershipChecks=0;
  await assert.rejects(saveProductWithModel({...options,assertOwner:()=>{if(++ownershipChecks===2)throw Error('Owner changed');}}),/Owner changed/);
  assert.equal(requests,1);
});

test('catalog fallback keeps existing promotions when only the specifications column is missing', async () => {
  const { readProduct } = loadSource('src/lib/catalogServer.ts');const base=product({});const fields=[];
  const row={id:'11111111-1111-4111-8111-111111111111',product_id:'p',name:base.name,category:base.category,description:'',base_price:100,compare_at_price:200,promotion_label:'Хямдрал',image_url:base.image,colors:base.colors,materials:base.materials,default_color:'oak',dimensions_w:.4,dimensions_d:1,dimensions_h:1.5,in_stock:5,rating:0,review_count:0};
  const db={from:()=>({select(columns){fields.push(columns);const q={is:()=>q,eq:()=>q,maybeSingle:async()=>columns.includes('specifications')?{error:{code:'42703',message:'column specifications does not exist'}}:{data:row}};return q;}})};
  const result=await readProduct('p',db);assert.equal(result.compareAtPrice,200);assert.equal(result.promotionLabel,'Хямдрал');assert.equal(fields.length,2);
});

test('admin refuses to silently discard specifications before the schema migration is applied',async()=>{
  let writes=0;
  const route=loadSource('src/app/api/admin/products/route.ts',{
    '@/lib/supabase/requireAdmin':{requireAdmin:async()=>({userId:'admin',error:null})},
    '@/lib/storeDirectory':{readStoreDirectory:async()=>[]},
    '@/lib/supabase/admin':{getSupabaseAdmin:()=>({from:()=>({select:()=>({limit:async()=>({error:{code:'42703',message:'column specifications does not exist'}})})}),rpc:async()=>{writes++;return {error:null};}})},
  });
  const response=await route.POST(new NextRequest('http://local/api/admin/products',{method:'POST',body:JSON.stringify(product({specifications:{tiers:'5'}}))}));
  assert.equal(response.status,503);assert.match((await response.json()).error,/migration/);assert.equal(writes,0);
});

test('real PostgreSQL migration saves metadata atomically, preserves stock checks and restricts RPC execution',async t=>{
  const db=new PGlite();t.after(()=>db.close());
  await db.exec(`create role anon;create role authenticated;create role service_role;
    create table furniture_models(id uuid primary key,product_id text unique,name text,category text,description text,base_price bigint,image_url text,images jsonb default '[]',glb_path text,scale float8,dimensions_w float8,dimensions_d float8,dimensions_h float8,colors jsonb,materials jsonb,default_color text,in_stock integer,rating numeric,review_count integer,badges jsonb,is_new boolean,is_best_seller boolean,store_ids jsonb,updated_at timestamptz);
    grant select,insert,update on furniture_models to service_role;`);
  const gallery=readFileSync('supabase/migrations/202609090001_product_gallery.sql','utf8');
  await db.exec(gallery.slice(gallery.indexOf('create or replace function public.save_furniture_product'),gallery.indexOf('notify pgrst')));
  await db.exec(readFileSync('supabase/migrations/20261010114233_product_specifications_categories.sql','utf8'));
  const { CATEGORIES }=loadSource('src/lib/catalogCategories.ts');
  for(const c of CATEGORIES)assert.equal((await db.query('select is_furniture_category($1) valid',[c.id])).rows[0].valid,true,c.id);
  await db.exec('set role service_role');
  const save=(data,create=true,expected=null)=>db.query('select save_furniture_product($1,$2,$3)',[JSON.stringify(data),create,expected]);
  await save(product({id:'p',specifications:{tiers:'5',assembly:'Боолттой'}}));
  assert.deepEqual((await db.query("select specifications from furniture_models where product_id='p'")).rows[0].specifications,{tiers:'5',assembly:'Боолттой'});
  await save(product({id:'p',name:'Renamed'}),false,5);
  assert.equal((await db.query("select specifications->>'tiers' tiers from furniture_models where product_id='p'")).rows[0].tiers,'5');
  await assert.rejects(save(product({id:'p',specifications:{tiers:'6'}}),false,4),error=>error.code==='P0003');
  assert.equal((await db.query("select specifications->>'tiers' tiers from furniture_models where product_id='p'")).rows[0].tiers,'5');
  for(const specs of [{tiers:5},{unknown:'bad'},[],{style:'x'.repeat(301)}])await assert.rejects(save(product({id:'bad',specifications:specs})),error=>error.code==='22023');
  assert.equal((await db.query("select count(*)::integer n from furniture_models where product_id='bad'")).rows[0].n,0);
  await save(product({id:'p',specifications:{}}),false,5);
  assert.deepEqual((await db.query("select specifications from furniture_models where product_id='p'")).rows[0].specifications,{});
  await db.exec('reset role;set role anon');
  await assert.rejects(save(product({id:'forged'})),error=>error.code==='42501');
});
