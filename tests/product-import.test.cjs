const {test}=require('node:test');
const assert=require('node:assert/strict');
const ExcelJS=require('exceljs');
const {randomUUID}=require('node:crypto');
const {NextRequest}=require('next/server');
const {loadSource}=require('./helpers/load-source.cjs');
const excel=()=>loadSource('src/lib/merchantExcel.ts');
async function workbook(rows,headers=['name','category','price','stock','width','depth','height','material']){
 const b=new ExcelJS.Workbook(),s=b.addWorksheet('Бараа');s.addRow(headers);rows.forEach(r=>s.addRow(r));return new Uint8Array(await b.xlsx.writeBuffer());
}
const row=['Sofa','sofa',100,2,214,104,86,'fabric'];
const values={name:'Sofa',category:'sofa',price:'100',stock:'2',width:'214',depth:'104',height:'86',material:'Даавуу',color:'',hex:'',image:'',description:''};

test('valid file parses every row with editable values and a missing-image warning',async()=>{
 const parsed=await excel().parseMerchantWorkbook(await workbook([row,['Chair','chair',50,1,40,40,80,'wood']]),randomUUID());
 assert.equal(parsed.valid,true);assert.equal(parsed.rows.length,2);
 assert.equal(parsed.rows[0].values.price,'100');assert.equal(parsed.rows[0].product.dimensions.w,2.14);
 assert.match(parsed.rows[0].warnings[0],/Зураг хоосон/);
});

test('blank rows are ignored and an all-blank sheet is rejected',async()=>{
 const parsed=await excel().parseMerchantWorkbook(await workbook([row,['','','','','','','',''],row.map((v,i)=>i===0?'Other':v)]),randomUUID());
 assert.deepEqual(parsed.rows.map(r=>r.row),[2,4]);
 await assert.rejects(excel().parseMerchantWorkbook(await workbook([['','','','','','','','']]),randomUUID()),/Импортлох бараа алга/);
});

test('wrong types report every field of the row at once and name the failing cells',async()=>{
 const parsed=await excel().parseMerchantWorkbook(await workbook([['','unknown','1,000','x',214,104,86,'stone']]),randomUUID());
 const [bad]=parsed.rows;
 assert.equal(parsed.valid,false);assert.equal(bad.product,undefined);
 assert.deepEqual([...bad.fields].sort(),['category','material','name','price','stock']);
 assert.ok(bad.errors.some(e=>/Үнэ тоо байх ёстой/.test(e)));
});

test('duplicate rows point back to the first occurrence',async()=>{
 const parsed=await excel().parseMerchantWorkbook(await workbook([row,row]),randomUUID());
 assert.equal(parsed.rows[0].errors.length,0);assert.match(parsed.rows[1].errors[0],/2-р мөртэй/);
});

test('oversized, wrong-MIME and too-long files are rejected before parsing',async()=>{
 const api=excel();
 assert.throws(()=>api.checkImportFile(new File([new Uint8Array(5*1024*1024+1)],'a.xlsx')),/5 MB/);
 assert.throws(()=>api.checkImportFile(new File(['x'],'a.csv',{type:'text/csv'})),/xlsx/);
 assert.throws(()=>api.checkImportFile(new File(['x'],'a.xlsx',{type:'text/html'})),/xlsx/);
 api.checkImportFile(new File(['x'],'a.xlsx',{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
 await assert.rejects(api.parseMerchantWorkbook(await workbook(Array.from({length:501},()=>row)),randomUUID()),/500/);
});

test('unknown and missing column names fail with the column named',async()=>{
 await assert.rejects(excel().parseMerchantWorkbook(await workbook([row],['name','category','price','stock','width','depth','height','material','Барааны код']),randomUUID()),/Танихгүй багана: «Барааны код»/);
 await assert.rejects(excel().parseMerchantWorkbook(await workbook([row.slice(0,7)],['name','category','price','stock','width','depth','height']),randomUUID()),/Шаардлагатай багана алга: Материал/);
});

test('edited browser rows are re-validated on the server and IDs stay stable per request',()=>{
 const api=excel(),id=randomUUID();
 const fixed=api.parseImportRows([{row:3,values:{...values,price:'1,000'}},{row:4,values:{...values,name:'Other'}}],id);
 assert.equal(fixed.rows[0].product,undefined);assert.ok(fixed.rows[1].product);
 assert.equal(api.parseImportRows([{row:4,values:{...values,name:'Other'}}],id).rows[0].product.id,fixed.rows[1].product.id);
 assert.throws(()=>api.parseImportRows([{row:2,values},{row:2,values:{...values,name:'B'}}],id),/давхардсан/);
 assert.throws(()=>api.parseImportRows([],id));
 assert.throws(()=>api.parseImportRows([{row:'2',values}],id));
});

const json=(path,body)=>new NextRequest('http://local'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});

test('merchant commit sends only re-validated rows for the verified actor and refuses rows with errors',async()=>{
 const calls=[];
 const route=loadSource('src/app/api/merchant/products/import/route.ts',{
  '@/lib/supabase/requireMerchant':{requireMerchant:async()=>({userId:'verified-merchant',error:null})},
  '@/lib/supabase/admin':{getSupabaseAdmin:()=>({rpc:async(name,args)=>{calls.push({name,args});return{data:{count:1,replayed:false},error:null};}})},
 });
 const path='/api/merchant/products/import',requestId=randomUUID();
 const form=new FormData();form.set('file',new File([await workbook([row])],'products.xlsx'));form.set('requestId',requestId);
 const preview=await route.POST(new NextRequest('http://local'+path,{method:'POST',body:form}));
 const parsed=await preview.json();assert.equal(preview.status,200);assert.equal(parsed.rows[0].product,undefined);assert.equal(calls.length,0);
 assert.equal((await route.POST(json(path,{mode:'commit',requestId,rows:[{row:2,values:{...values,price:'bad'}}]}))).status,400);
 assert.equal((await route.POST(json(path,{mode:'commit',requestId,storeId:'other-store',rows:[{row:2,values}]}))).status,400);
 assert.equal(calls.length,0);
 const validated=await (await route.POST(json(path,{mode:'validate',requestId,rows:[{row:2,values:{...values,price:'bad'}}]}))).json();
 assert.deepEqual(validated.rows[0].fields,['price']);
 assert.equal((await route.POST(json(path,{mode:'commit',requestId,rows:[{row:2,values}]}))).status,201);
 assert.equal(calls[0].args.p_actor,'verified-merchant');assert.deepEqual(calls[0].args.p_products[0].storeIds,[]);
 const errors=await route.POST(json(path,{mode:'errors',requestId,rows:[{row:2,values:{...values,price:'bad'}}]}));
 assert.equal(errors.status,200);const book=new ExcelJS.Workbook();await book.xlsx.load(await errors.arrayBuffer());
 assert.match(String(book.getWorksheet('Алдаа').getCell('C2').value),/Үнэ/);
});

test('admin import requires a real store and saves products only for it',async()=>{
 const calls=[];
 const route=loadSource('src/app/api/admin/products/import/route.ts',{
  '@/lib/supabase/requireAdmin':{requireAdmin:async()=>({userId:'admin',error:null})},
  '@/lib/storeDirectory':{readStoreDirectory:async()=>[{id:'store-a'}]},
  '@/lib/supabase/admin':{getSupabaseAdmin:()=>({rpc:async(name,args)=>{calls.push({name,args});return{error:calls.length===2?{code:'23505'}:null};}})},
 });
 const path='/api/admin/products/import',requestId=randomUUID();
 assert.equal((await route.POST(json(path,{mode:'commit',requestId,rows:[{row:2,values}]}))).status,400);
 assert.equal((await route.POST(json(path,{mode:'commit',requestId,storeId:'forged',rows:[{row:2,values}]}))).status,400);
 assert.equal(calls.length,0);
 const saved=await route.POST(json(path,{mode:'commit',requestId,storeId:'store-a',rows:[{row:2,values},{row:3,values:{...values,name:'Second'}}]}));
 assert.equal(saved.status,201);assert.deepEqual(await saved.json(),{count:2,replayed:false});
 assert.deepEqual(calls[0].args.p_data.storeIds,['store-a']);assert.equal(calls[0].args.p_create,true);
});
