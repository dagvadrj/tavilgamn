const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash,randomUUID}=require('node:crypto');
const {zipSync,strToU8}=require('fflate');
const {NextRequest}=require('next/server');
const {loadSource}=require('./helpers/load-source.cjs');
const {validateContractFile,CONTRACT_FILE_LIMIT,DOCX_TYPE}=loadSource('src/lib/merchantContractFiles.ts');
const pdf=Buffer.from('%PDF-1.7\noriginal approved contract\n%%EOF');
const docx=()=>zipSync({'[Content_Types].xml':strToU8('<Types>application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml</Types>'),'word/document.xml':strToU8('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">terms</w:document>')});
const metadata={action:'save',storeId:'shop',title:'Гэрээ',platformName:'Platform LLC'};
function request(meta=metadata,bytes=pdf,name='Монгол гэрээ.pdf'){
 const form=new FormData();form.set('metadata',JSON.stringify(meta));if(bytes)form.set('file',new File([bytes],name));
 return new NextRequest('http://local/api/admin/merchant-contracts',{method:'POST',body:form});
}
function harness({rpcError=null,active=true,download=pdf}={}){
 const calls=[],uploads=[],removed=[];
 const db={rpc:async(name,args)=>{calls.push({name,args});return args.p_action==='save'||args.p_action==='publish'?{data:{versions:[],acceptances:[]},error:rpcError}:{data:{merchants:[{id:'shop',name:'Shop',active}],versions:[],acceptances:[]},error:null};},storage:{from:bucket=>({upload:async(path,bytes,options)=>{uploads.push({bucket,path,bytes,options});return{error:null};},remove:async paths=>{removed.push(...paths);return{error:null};},download:async()=>({data:new Blob([download]),error:null})})}};
 const mocks={'@/lib/supabase/requireAdmin':{requireAdmin:async()=>({userId:'verified-admin'})},'@/lib/supabase/admin':{getSupabaseAdmin:()=>db}};
 return {calls,uploads,removed,db,mocks,route:loadSource('src/app/api/admin/merchant-contracts/route.ts',mocks)};
}
test('agreement uploads validate actual PDF/DOCX content, reject renamed files, macros and oversized archives',()=>{
 assert.equal(validateContractFile(pdf,'terms.pdf').contentType,'application/pdf');
 assert.equal(validateContractFile(docx(),'terms.docx').contentType,DOCX_TYPE);
 for(const [bytes,name]of [[Buffer.from('<html>fake</html>'),'fake.pdf'],[pdf,'fake.docx'],[pdf,'terms.exe'],[new Uint8Array(0),'empty.pdf'],[new Uint8Array(CONTRACT_FILE_LIMIT+1),'big.pdf']])assert.throws(()=>validateContractFile(bytes,name));
 const macro=zipSync({'[Content_Types].xml':strToU8(DOCX_TYPE+'.main+xml'),'word/document.xml':strToU8('wordprocessingml'),'word/vbaProject.bin':new Uint8Array([1])});
 assert.throws(()=>validateContractFile(macro,'macro.docx'));
 const bomb=zipSync({'word/document.xml':new Uint8Array(5*1024*1024+1),'[Content_Types].xml':strToU8(DOCX_TYPE+'.main+xml')});assert.throws(()=>validateContractFile(bomb,'huge.docx'));
});
test('admin upload binds merchant choice and trusted actor, generates private immutable file metadata',async()=>{
 const h=harness();const response=await h.route.POST(request({...metadata,owner:'forged',file:{path:'forged'}}));assert.equal(response.status,200);
 assert.equal(h.uploads.length,1);assert.equal(h.uploads[0].bucket,'merchant-contracts');assert.equal(h.uploads[0].options.upsert,false);
 const write=h.calls.find(c=>c.args.p_action==='save').args;
 assert.equal(write.p_actor,'verified-admin');assert.equal(write.p_data.storeId,'shop');assert.equal(write.p_data.owner,undefined);
 assert.equal(write.p_data.file.sha256,createHash('sha256').update(pdf).digest('hex'));assert.equal(write.p_data.file.name,'Монгол гэрээ.pdf');assert.notEqual(write.p_data.file.path,'forged');
});
test('missing merchant, invalid content and inactive merchant cannot create files; JSON metadata cannot inject storage paths',async()=>{
 for(const [meta,bytes]of [[{...metadata,storeId:''},pdf],[metadata,Buffer.from('fake PDF')]]){const h=harness();assert.equal((await h.route.POST(request(meta,bytes))).status,400);assert.equal(h.uploads.length,0);}
 const inactive=harness({active:false});assert.equal((await inactive.route.POST(request())).status,400);assert.equal(inactive.uploads.length,0);
 const h=harness();assert.equal((await h.route.POST(new NextRequest('http://local/api/admin/merchant-contracts',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({...metadata,id:randomUUID(),revision:1,file:{path:'other-store'}})}))).status,200);
 assert.equal(h.calls[0].args.p_data.file,undefined);assert.equal(h.uploads.length,0);
});
test('only definitively rejected uploads are cleaned; ambiguous commit errors retain the original evidence',async()=>{
 const rejected=harness({rpcError:{code:'P0003'}});assert.equal((await rejected.route.POST(request())).status,409);assert.deepEqual(rejected.removed,[rejected.uploads[0].path]);
 const ambiguous=harness({rpcError:{code:'NETWORK'}});assert.equal((await ambiguous.route.POST(request())).status,503);assert.equal(ambiguous.removed.length,0);
});
test('merchant download uses only its current or accepted agreement; forged acceptance never reads storage',async()=>{
 const h=harness();const contract={id:randomUUID(),version_no:3,file_path:'contracts/private/file.pdf',file_name:'Монгол гэрээ.pdf',file_type:'application/pdf',file_size:pdf.length,file_sha256:createHash('sha256').update(pdf).digest('hex')};
 let downloads=0;h.db.storage.from=()=>({download:async path=>{downloads++;assert.equal(path,contract.file_path);return{data:new Blob([pdf]),error:null};}});
 h.db.rpc=async()=>({data:{current:contract,acceptances:[]},error:null});
 const route=loadSource('src/app/api/merchant/contracts/route.ts',{'@/lib/supabase/requireMerchant':{requireMerchant:async()=>({userId:'merchant-a'})},'@/lib/supabase/admin':{getSupabaseAdmin:()=>h.db}});
 const wrong=await route.GET(new NextRequest('http://local/api/merchant/contracts?format=file&acceptance=other-store'));assert.equal(wrong.status,404);assert.equal(downloads,0);
 const response=await route.GET(new NextRequest('http://local/api/merchant/contracts?format=file'));assert.equal(response.status,200);assert.deepEqual(Buffer.from(await response.arrayBuffer()),pdf);assert.match(response.headers.get('content-disposition'),/filename\*=UTF-8/);assert.equal(response.headers.get('x-content-type-options'),'nosniff');
});
test('a tampered storage object is not served as the approved contract',async()=>{
 const h=harness({download:Buffer.from('changed')});const {contractFileResponse}=loadSource('src/lib/merchantContractFileServer.ts',{'@/lib/supabase/admin':{getSupabaseAdmin:()=>h.db}});
 await assert.rejects(contractFileResponse({file_path:'contracts/a/b.pdf',file_name:'terms.pdf',file_type:'application/pdf',file_size:pdf.length,file_sha256:createHash('sha256').update(pdf).digest('hex')}));
});

test('download-manager handoff and empty responses never create a blank downloaded file',async()=>{
 for(const status of [204,200]) {
  const {merchantDownload}=loadSource('src/features/merchant/merchantDownload.ts',{
   '@/lib/authFetch':{authFetch:async()=>new Response(null,{status})},
   '@/store/auth':{useAuth:{getState:()=>({user:{id:'owner'}})}},
  });
  await assert.rejects(merchantDownload('/api/merchant/contracts?format=file','owner','terms.pdf'),status===204?/download manager/:/Хоосон файл/);
 }
});
