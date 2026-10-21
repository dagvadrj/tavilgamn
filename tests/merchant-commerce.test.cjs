const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadSource}=require('./helpers/load-source.cjs');
const ExcelJS=require('exceljs');
const {randomUUID}=require('node:crypto');
const {PDFDocument}=require('pdf-lib');
const fontkit=require('@pdf-lib/fontkit');
const {NextRequest,NextResponse}=require('next/server');
const excel=()=>loadSource('src/lib/merchantExcel.ts');
const docs=()=>({...loadSource('src/lib/merchantDocuments.ts'),...loadSource('src/lib/merchantPdf.ts',{'@pdf-lib/fontkit':{default:fontkit}})});
async function workbook(rows,headers=['name','category','price','stock','width','depth','height','material']){
 const b=new ExcelJS.Workbook(),s=b.addWorksheet('Бараа');s.addRow(headers);rows.forEach(r=>s.addRow(r));return new Uint8Array(await b.xlsx.writeBuffer());
}
const row=['Sofa','sofa',100,2,214,104,86,'fabric'];
test('Excel template round-trip, cm conversion and protected field defaults',async()=>{
 const api=excel(),parsed=await api.parseMerchantWorkbook(new Uint8Array(await api.merchantImportTemplate()),randomUUID());
 assert.equal(parsed.valid,true);assert.equal(parsed.rows.length,1);
 assert.equal(parsed.rows[0].product.dimensions.w,2.14);assert.equal(parsed.rows[0].product.rating,0);
 assert.deepEqual(parsed.rows[0].product.storeIds,[]);assert.equal(parsed.rows[0].product.model,undefined);
});
test('Excel validates every row, rejects formula/macro/oversized and malformed files without partial writes',async()=>{
 const api=excel(),parsed=await api.parseMerchantWorkbook(await workbook([row,['Bad','kitchen-cabinet',10,1,1,1,1,'wood'],['BadPrice','sofa','1,000',1,1,1,1,'wood']]),randomUUID());
 assert.equal(parsed.valid,false);assert.equal(parsed.rows.filter(r=>r.errors.length).length,2);
 const formula=await api.parseMerchantWorkbook(await workbook([[{formula:'1+1',result:2},...row.slice(1)]]),randomUUID());
 assert.equal(formula.valid,false);
 await assert.rejects(api.parseMerchantWorkbook(new Uint8Array([1,2,3]),randomUUID()));
 await assert.rejects(api.parseMerchantWorkbook(await workbook(Array.from({length:501},()=>row)),randomUUID()));
 const dup=await api.parseMerchantWorkbook(await workbook([row,row]),randomUUID());assert.equal(dup.valid,false);
 const {zipSync,strToU8}=require('fflate');
 assert.throws(()=>api.checkWorkbookArchive(zipSync({'xl/workbook.xml':strToU8('<x/>'),'xl/vbaProject.bin':new Uint8Array([1])})));
 assert.throws(()=>api.checkWorkbookArchive(zipSync({'xl/workbook.xml':new Uint8Array(26*1024*1024)})));
});
test('financial totals retain exact snapshots, exclude unpaid/cancelled, and validate dates',()=>{
 const {reportTotals,reportingPeriod}=loadSource('src/lib/merchantCommerce.ts');
 const o={paid:true,cancelled:false,gross:'9007199254740991',fee:'99',net:'9007199254740892'};
 const totals=reportTotals({orders:[o,o,{...o,paid:false},{...o,cancelled:true}]});
 assert.equal(totals.gross,'18014398509481982');assert.equal(totals.fee,'198');assert.equal(totals.paid,2);
 assert.throws(()=>reportingPeriod('2026-02-30','2026-03-01'));
 assert.deepEqual(reportingPeriod('2026-10-01','2026-10-21'),{from:'2026-10-01',to:'2026-10-21'});
});
test('product Excel exports preserve text instead of formulas and dimensions; PDFs paginate with Unicode',async()=>{
 const {merchantProductsExcel,merchantProductsPdf,merchantContractPdf}=docs();
 const data={category:'sofa',search:'',includeArchived:false,generatedAt:new Date().toISOString(),rows:[{product_id:'one',name:'=HYPERLINK("bad")',category:'sofa',base_price:123,dimensions_w:2.14,dimensions_d:1.04,dimensions_h:.86,in_stock:2,colors:[],materials:[],description:'',processing_status:'idle',archived_at:null}]};
 const b=new ExcelJS.Workbook();await b.xlsx.load(await merchantProductsExcel(data));
 assert.equal(b.worksheets[0].getCell('B2').type,ExcelJS.ValueType.String);assert.equal(b.worksheets[0].getCell('F2').value,214);
 const pdf=await PDFDocument.load(await merchantProductsPdf(data));assert.ok(pdf.getPageCount()>=1);
 const long=await PDFDocument.load(await merchantContractPdf({title:'Гэрээ',body:'Монгол гэрээний урт эх. '.repeat(1500),platform_name:'Платформ',version_no:1}));
 assert.ok(long.getPageCount()>1);
});
test('all commerce endpoints authenticate before parsing files or querying data',async()=>{
 for(const [path,methods,auth] of [['merchant/products/import',['GET','POST'],'requireMerchant'],['merchant/products/export',['GET'],'requireMerchant'],['merchant/reports',['GET'],'requireMerchant'],['merchant/contracts',['GET','POST'],'requireMerchant'],['admin/merchant-contracts',['GET','POST'],'requireAdmin']]){
  const route=loadSource('src/app/api/'+path+'/route.ts',{
   ['@/lib/supabase/'+auth]:{[auth]:async()=>({error:NextResponse.json({error:'login'},{status:401})})},
   '@/lib/supabase/admin':{getSupabaseAdmin:()=>{throw new Error('No DB before auth');}},
  });
  for(const method of methods) assert.equal((await route[method](new NextRequest('http://local/api/'+path,{method}))).status,401);
 }
});

test('preview validates actual uploaded workbook; commit binds server actor, revalidates file hash and strips injected fields',async()=>{
 const bytes=await workbook([row]);const calls=[];
 const route=loadSource('src/app/api/merchant/products/import/route.ts',{
  '@/lib/supabase/requireMerchant':{requireMerchant:async()=>({userId:'verified-merchant',error:null})},
  '@/lib/supabase/admin':{getSupabaseAdmin:()=>({rpc:async(name,args)=>{calls.push({name,args});return{data:{count:1,replayed:false},error:null};}})},
 });
 const key=randomUUID();
 const request=(mode,hash)=>{const form=new FormData();form.set('file',new File([bytes],'products.xlsx'));form.set('requestId',key);form.set('mode',mode);form.set('owner','forged');if(hash)form.set('hash',hash);return new NextRequest('http://local/api/merchant/products/import',{method:'POST',body:form});};
 const preview=await route.POST(request('preview'));assert.equal(preview.status,200);const parsed=await preview.json();assert.equal(parsed.valid,true);assert.equal(parsed.rows[0].product,undefined);assert.equal(calls.length,0);
 assert.equal((await route.POST(request('commit','forged'))).status,400);assert.equal(calls.length,0);
 assert.equal((await route.POST(request('commit',parsed.hash))).status,201);
 assert.equal(calls[0].args.p_actor,'verified-merchant');assert.deepEqual(calls[0].args.p_products[0].storeIds,[]);
});
test('product export forwards the category/search/archive filter and trusted identity only',async()=>{
 const calls=[];
 const route=loadSource('src/app/api/merchant/products/export/route.ts',{
  '@/lib/supabase/requireMerchant':{requireMerchant:async()=>({userId:'verified',error:null})},
  '@/lib/supabase/admin':{getSupabaseAdmin:()=>({rpc:async(name,args)=>{calls.push({name,args});return{data:[],error:null};}})},
 });
 // A DB rejection avoids creating an artifact here while still checks validation before query.
 assert.equal((await route.GET(new NextRequest('http://local/api/merchant/products/export?format=xlsx&category=kitchen-cabinet'))).status,400);
 assert.equal(calls.length,0);
 const denied=loadSource('src/app/api/merchant/products/export/route.ts',{
  '@/lib/supabase/requireMerchant':{requireMerchant:async()=>({userId:'verified',error:null})},
  '@/lib/supabase/admin':{getSupabaseAdmin:()=>({rpc:async(name,args)=>{calls.push({name,args});return{data:null,error:{code:'42501'}};}})},
 });
 assert.equal((await denied.GET(new NextRequest('http://local/api/merchant/products/export?format=xlsx&category=sofa&search=Blue&archived=1&owner=forged'))).status,403);
 assert.deepEqual(calls[0].args,{p_actor:'verified',p_category:'sofa',p_search:'Blue',p_archived:true});
});
