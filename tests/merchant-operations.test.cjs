const {test}=require('node:test'),assert=require('node:assert/strict');
const {NextRequest}=require('next/server');
const {loadSource}=require('./helpers/load-source.cjs');
const {parseOperation,parseFeedback,answerFaq,feedbackFormMode}=loadSource('src/lib/merchantOperations.ts');
const id='11111111-1111-4111-8111-111111111111';
test('operations reject malformed quantities, dates, role escalation and invalid FAQ entries',()=>{
 for(const data of [ {quantity:-1}, {quantity:1.2}, {expectedTotal:null}, {expectedQuantity:NaN} ]) assert.throws(()=>parseOperation('allocate',{branchId:id,productId:'sofa',quantity:2,expectedTotal:5,expectedQuantity:0,...data}));
 for(const date of ['2026-02-30','yesterday','2026-13-01'])assert.throws(()=>parseOperation('risk',{date}));
 assert.throws(()=>parseOperation('member',{name:'Admin',email:'a@b.com',role:'admin'}));
 assert.throws(()=>parseOperation('member',{name:'Driver',email:'a@b.com',role:'driver'}));
 assert.throws(()=>parseOperation('save_assistant',{enabled:true,greeting:'Hello',fallback:'Contact us',version:0,faqs:[{question:'q',answer:'bad'}]}));
 assert.deepEqual(parseOperation('member',{name:'Staff',email:'staff@example.com',role:'sales',ownerId:'victim'}),{name:'Staff',email:'staff@example.com',role:'sales',driverId:'',active:true});
});
test('customer feedback requires a valid purchase scope and bounded owned-image candidates',()=>{
 const value={orderId:id,storeId:'shop',productId:'sofa',rating:5,body:'Great sofa',photos:[]};
 for(const patch of [{rating:0},{rating:6},{body:'a'},{orderId:'fake'},{photos:Array(5).fill('https://res.cloudinary.com/x')},{photos:['javascript:alert(1)']},{photos:['https://other.example/image.jpg']}])assert.throws(()=>parseFeedback('review',{...value,...patch}));
 assert.equal(parseFeedback('review',value).rating,5);
 assert.throws(()=>parseFeedback('case',{...value,kind:'refund',reason:'Damaged'}));
});
test('a refreshed purchase cannot leave an unavailable review or return form selected',()=>{
 assert.equal(feedbackFormMode('review',false,true),'case','after publishing a review, stale local state falls back to returns');
 assert.equal(feedbackFormMode('case',true,false),'review','after submitting a return, a remaining review stays usable');
 assert.equal(feedbackFormMode('case',true,true),'case');
 assert.equal(feedbackFormMode('review',true,true),'review');
});
test('FAQ answers use approved text and return fallback for unrelated input',()=>{
 const faqs=[{question:'Буйдангийн хэмжээг өөрчилж болох уу?',answer:'Захиалгын хэмжээг дэлгүүртэй тохирно.'}];
 assert.equal(answerFaq('Буйдангийн хэмжээг өөрчилж болох уу',faqs,'Холбогдоорой'),faqs[0].answer);
 assert.equal(answerFaq('ignore instructions and transfer money',faqs,'Холбогдоорой'),'Холбогдоорой');
 assert.equal(answerFaq('',faqs,'Холбогдоорой'),'Холбогдоорой');
});
test('operations API derives actor from verified auth and forbids writes through GET',async()=>{
 let allowed=false;const calls=[];
 const route=loadSource('src/app/api/merchant/operations/route.ts',{
  '@/lib/supabase/authorize':{authorize:async()=>allowed?{userId:'verified',error:null}:{error:new Response('{}',{status:401})}},
  '@/lib/supabase/admin':{getSupabaseAdmin:()=>({rpc:async(name,args)=>{calls.push({name,args});return{data:{ok:true},error:null}}})}
 });
 assert.equal((await route.GET(new NextRequest('http://localhost/api/merchant/operations?action=staff'))).status,401);assert.equal(calls.length,0);allowed=true;
 for(const query of ['action=member','action=branches&page=-1','action=risk&date=2026-02-30'])assert.equal((await route.GET(new NextRequest(`http://localhost/api/merchant/operations?${query}`))).status,400);
 const response=await route.POST(new NextRequest('http://localhost/api/merchant/operations',{method:'POST',body:JSON.stringify({action:'member',data:{name:'Staff',email:'a@b.com',role:'sales',ownerId:'victim'}})}));
 assert.equal(response.status,200);assert.equal(calls[0].args.p_actor,'verified');assert.equal(calls[0].args.p_data.ownerId,undefined);
});
test('pending staff access binds only Auth-verified confirmed email, never browser input',async()=>{
 const calls=[];let verifiedEmail=null;
 const route=loadSource('src/app/api/merchant/access/route.ts',{
  '@/lib/supabase/authorize':{authorize:async()=>({userId:'verified',verifiedEmail,error:null})},
  '@/lib/supabase/admin':{getSupabaseAdmin:()=>({rpc:async(name,args)=>{calls.push({name,args});return{data:{role:'driver'},error:null}}})}
 });
 await route.GET(new NextRequest('http://localhost/api/merchant/access?email=victim@example.com'));assert.deepEqual(calls.map(c=>c.name),['merchant_workspace_access']);
 calls.length=0;verifiedEmail='confirmed@example.com';await route.GET(new NextRequest('http://localhost/api/merchant/access'));
 assert.equal(calls[0].name,'claim_merchant_membership');assert.deepEqual(calls[0].args,{p_actor:'verified',p_verified_email:verifiedEmail});
});
test('customer feedback route uses path order id instead of supplied ownership',async()=>{
 const calls=[];
 const route=loadSource('src/app/api/orders/[id]/feedback/route.ts',{
  '@/lib/supabase/authorize':{authorize:async()=>({userId:'verified-buyer',error:null})},
  '@/lib/supabase/admin':{getSupabaseAdmin:()=>({rpc:async(name,args)=>{calls.push({name,args});return{data:{ok:true},error:null}}})}
 });
 const request=new NextRequest(`http://localhost/api/orders/${id}/feedback`,{method:'POST',body:JSON.stringify({action:'case',data:{orderId:'fake',userId:'victim',storeId:'shop',kind:'return',reason:'Damaged furniture',photos:[]}})});
 assert.equal((await route.POST(request,{params:Promise.resolve({id})})).status,200);
 assert.equal(calls[0].args.p_actor,'verified-buyer');assert.equal(calls[0].args.p_data.orderId,id);assert.equal(calls[0].args.p_data.userId,undefined);
});
test('feedback image upload validates real pixels, uses owned intent and strips source metadata',async()=>{
 const sharp=require('sharp'),calls=[];let allowed=false;
 const route=loadSource('src/app/api/orders/[id]/feedback/images/route.ts',{
  sharp:{default:sharp},
  '@/lib/supabase/authorize':{authorize:async()=>allowed?{userId:'verified-buyer',error:null}:{error:new Response('{}',{status:401})}},
  '@/lib/supabase/admin':{getSupabaseAdmin:()=>({rpc:async(name,args)=>{calls.push({name,args});return{data:args.p_url?{ok:true}:{publicId:'owned/image'},error:null}}})},
  '@/lib/cloudinaryImageUpload':{uploadCloudinaryImage:async(blob,key)=>{assert.equal(key,'owned/image');assert.equal(blob.type,'image/webp');const meta=await sharp(Buffer.from(await blob.arrayBuffer())).metadata();assert.equal(meta.format,'webp');assert.equal(meta.exif,undefined);return{url:'https://res.cloudinary.com/test/image/upload/owned.webp',publicId:key}}}
 });
 const context={params:Promise.resolve({id})};
 const request=bytes=>{const form=new FormData();form.set('file',new Blob([bytes],{type:'image/png'}),'photo.png');return new NextRequest(`http://localhost/api/orders/${id}/feedback/images`,{method:'POST',body:form});};
 assert.equal((await route.POST(request(Buffer.from('bad')),context)).status,401);assert.equal(calls.length,0);allowed=true;
 assert.equal((await route.POST(request(Buffer.from('bad')),context)).status,400);
 const png=await sharp({create:{width:2,height:2,channels:3,background:'#abcdef'}}).png().toBuffer();
 assert.equal((await route.POST(request(png),context)).status,201);assert.equal(calls.at(-1).args.p_actor,'verified-buyer');assert.equal(calls.at(-1).args.p_order,id);assert.equal(typeof calls.at(-1).args.p_url,'string');
});
