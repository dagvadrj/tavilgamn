const {test}=require('node:test');const assert=require('node:assert/strict');
const {loadSource}=require('./helpers/load-source.cjs');
const {quotationLineTotal,quotationTotal,parseQuotationLines}=loadSource('src/lib/kitchenQuotation.ts');
const {availableStock,quantityLimit,stockLabel}=loadSource('src/lib/inventory.ts');
const {parseDelivery}=loadSource('src/lib/orderValidation.ts');
test('made-to-order cart capacity never manufactures physical stock',()=>{
 const product={id:'sofa',stockQuantity:0,madeToOrder:true};assert.equal(availableStock(product),0);assert.equal(quantityLimit(product,[],{color:'oak',material:'wood'}),99);assert.match(stockLabel(product),/7.*14/);
 assert.equal(quantityLimit({...product,madeToOrder:false},[],{color:'oak',material:'wood'}),0);
 assert.equal(quantityLimit(product,[{id:'x',productId:'sofa',color:'oak',material:'wood',qty:98}],{color:'oak',material:'wood'}),1);
});
test('quotation rounding matches Postgres numeric for fractional lengths and rejects malformed rows',()=>{
 assert.equal(quotationLineTotal({name:'Stone',quantity:.29,unit:'m',unitPrice:50}),15);
 assert.equal(quotationTotal([{name:'Upper',quantity:2,unit:'piece',unitPrice:100},{name:'Stone',quantity:.29,unit:'m',unitPrice:50}]),215);
 for(const items of [[],[{name:'',quantity:1,unit:'m',unitPrice:1}],[{name:'Stone',quantity:.001,unit:'m',unitPrice:1}],[{name:'Stone',quantity:1,unit:'m',unitPrice:-1}]])assert.throws(()=>parseQuotationLines(items));
});
test('delivery details preserve optional access and assembly requirements without accepting malformed values',()=>{
 const old={name:'Buyer',phone:'99112233',address:'Apartment address'};assert.deepEqual(parseDelivery(old),old);
 assert.deepEqual(parseDelivery({...old,floor:7,elevator:'none',assemblyRequested:true}),{...old,floor:7,elevator:'none',assemblyRequested:true});
 for(const extra of [{floor:-1},{floor:1.5},{elevator:'yes'},{assemblyRequested:'yes'}])assert.throws(()=>parseDelivery({...old,...extra}));
});
test('product QR checks live merchant ownership and links only ready 3D products to the room planner',async()=>{
 let authorized=false,storeIds=['shop'],ready=true;const encoded=[];
 const query={select(){return this},eq(){return this},is(){return this},async maybeSingle(){return {data:{name:'Luna',store_ids:storeIds,glb_path:'source.glb',processing_status:ready?'ready':'processing'},error:null}}};
 const {GET}=loadSource('src/app/api/merchant/products/[id]/qr/route.ts',{
  qrcode:{default:{toDataURL:async url=>{encoded.push(url);return 'data:image/png;base64,qr'}}},
  '@/lib/supabase/requireMerchant':{requireMerchant:async()=>authorized?{userId:'owner',error:null}:{error:new Response(null,{status:401})}},
  '@/lib/supabase/admin':{getSupabaseAdmin:()=>({rpc:async()=>({data:'shop',error:null}),from:()=>query})},
  '@/lib/merchantGrowthServer':{storeShareOrigin:()=> 'https://tavilga.mn'}
 });
 const request=new Request('https://tavilga.mn/api/merchant/products/sofa/qr'),context={params:Promise.resolve({id:'sofa'})};
 assert.equal((await GET(request,context)).status,401);authorized=true;storeIds=['other'];assert.equal((await GET(request,context)).status,404);storeIds=['shop'];ready=false;assert.equal((await GET(request,context)).status,409);ready=true;
 const response=await GET(request,context);assert.equal(response.status,200);assert.equal((await response.json()).url,'https://tavilga.mn/planner?product=sofa&source=showroom');assert.equal(encoded.length,1);
});
