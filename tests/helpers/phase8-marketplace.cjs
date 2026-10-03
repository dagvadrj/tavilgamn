// Isolated browser transport fixture, never an authorization/SQL substitute.
const {createFixtureServer}=require('./phase6-marketplace.cjs');
const {loadSource}=require('./load-source.cjs');
const {randomUUID}=require('node:crypto');
const userId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',secondId='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const clone=value=>JSON.parse(JSON.stringify(value));
function user(id=userId){return {id,aud:'authenticated',role:'authenticated',email:id===userId?'fixture@example.test':'second@example.test',
  user_metadata:{name:id===userId?'Тест хэрэглэгч':'Хоёр дахь хэрэглэгч'},app_metadata:{provider:'email',providers:['email']},created_at:'2026-10-03T00:00:00Z'};}
function token(id){const encode=v=>Buffer.from(JSON.stringify(v)).toString('base64url');return `${encode({alg:'HS256',typ:'JWT'})}.${encode({sub:id,aud:'authenticated',role:'authenticated',exp:Math.floor(Date.now()/1000)+3600})}.fixture`;}
function identity(req){try{return JSON.parse(Buffer.from(req.headers.authorization.split('.')[1],'base64url').toString()).sub;}catch{return userId;}}
function filter(req,url,rows){
  let output=clone(rows);
  const cursor=url.searchParams.get('or');
  if(cursor){
    const match=cursor.match(/^\(updated_at\.lt\.([^,]+),and\(updated_at\.eq\.([^,]+),id\.lt\.([0-9a-f-]+)\)\)$/);
    if(!match)throw new Error('Unsupported fixture cursor');
    output=output.filter(r=>r.updated_at<match[1]||(r.updated_at===match[2]&&r.id<match[3]));
  }
  for(const [key,v] of url.searchParams){
    if(v.startsWith('eq.'))output=output.filter(r=>String(r[key])===v.slice(3));
    else if(v.startsWith('lt.'))output=output.filter(r=>r[key]<(/^[0-9]+$/.test(v.slice(3))?Number(v.slice(3)):v.slice(3)));
    else if(v==='is.null')output=output.filter(r=>r[key]==null);
    else if(v==='not.is.null')output=output.filter(r=>r[key]!=null);
  }
  for(const ordering of (url.searchParams.get('order')??'').split(',').reverse()){
    const [key,direction]=ordering.split('.');if(key)output.sort((a,b)=>(a[key]>b[key]?1:a[key]<b[key]?-1:0)*(direction==='desc'?-1:1));
  }
  const limit=Number(url.searchParams.get('limit'));if(limit>0)output=output.slice(0,limit);
  const select=url.searchParams.get('select');if(select&&select!=='*')output=output.map(r=>Object.fromEntries(select.split(',').map(k=>[k,r[k]])));
  return req.headers.accept?.includes('vnd.pgrst.object')?output[0]??null:output;
}
function createPhase8Fixture(){
  const state={projects:[],versions:[],kitchens:[],kitchenVersions:[],failRoomSave:0,commitThenFail:false};
  const problem=(code,status=409)=>({status,body:{code,message:'Fixture failure'}});
  const now=()=>new Date().toISOString();
  const fixture=createFixtureServer({handle:async(req,url,raw)=>{
    const body=raw?JSON.parse(raw):{};
    if(url.pathname==='/auth/v1/token'){const id=body.email?.startsWith('second')?secondId:userId;return {body:{access_token:token(id),refresh_token:'fixture-refresh',token_type:'bearer',expires_in:3600,user:user(id)}};}
    if(url.pathname==='/auth/v1/user')return {body:user(identity(req))};
    if(url.pathname==='/rest/v1/profiles')return {body:[{id:identity(req),role:'customer'}]};
    if(url.pathname==='/rest/v1/room_projects')return {body:filter(req,url,state.projects)};
    if(url.pathname==='/rest/v1/room_project_versions')return {body:filter(req,url,state.versions)};
    if(url.pathname==='/rest/v1/kitchen_garnitures')return {body:filter(req,url,state.kitchens)};
    if(url.pathname==='/rest/v1/kitchen_garniture_versions')return {body:filter(req,url,state.kitchenVersions)};
    if(url.pathname==='/rest/v1/rpc/save_room_project'){
      if(state.failRoomSave){const status=state.failRoomSave;state.failRoomSave=0;return problem(status===409?'40001':'XX000',status);}
      const previous=state.versions.find(v=>v.user_id===body.p_actor&&v.operation_id===body.p_operation);
      let current=state.projects.find(p=>p.user_id===body.p_actor&&p.id===body.p_id);
      if(previous)return {body:{project:{...current,document:previous.document,revision:previous.revision,name:previous.name},alreadyImported:false}};
      if(body.p_expected_revision===0&&body.p_import_key){const imported=state.projects.find(p=>p.user_id===body.p_actor&&p.import_key===body.p_import_key);if(imported)return {body:{project:imported,alreadyImported:true}};}
      if((current?.revision??0)!==body.p_expected_revision)return problem('40001');
      if(current?.archived_at)return problem('55000');
      const signature=document=>JSON.stringify({...document,design:{...document.design,updatedAt:0}});
      if(current&&current.name===body.p_name&&signature(current.document)===signature(body.p_document)&&!body.p_force_version)return {body:{project:current,alreadyImported:false}};
      if(!current){current={user_id:body.p_actor,id:body.p_id,revision:0,created_at:now(),archived_at:null,import_key:body.p_import_key};state.projects.push(current);}
      current.name=body.p_name;current.document=clone(body.p_document);current.revision++;current.updated_at=now();
      current.room_count=body.p_document.design.rooms.length;current.piece_count=body.p_document.design.rooms.reduce((n,r)=>n+r.pieces.length,0);
      state.versions.push({user_id:body.p_actor,project_id:body.p_id,revision:current.revision,name:current.name,document:clone(current.document),operation_id:body.p_operation,created_at:now()});
      if(state.commitThenFail){state.commitThenFail=false;return problem('XX000',503);}
      return {body:{project:current,alreadyImported:false}};
    }
    if(url.pathname==='/rest/v1/rpc/archive_room_project'){
      const p=state.projects.find(p=>p.id===body.p_id&&p.user_id===body.p_actor);if(!p)return problem('P0002',404);
      if(p.revision!==body.p_expected_revision)return problem('40001');p.archived_at=body.p_archived?now():null;p.updated_at=now();return {body:p};
    }
    if(url.pathname==='/rest/v1/rpc/save_kitchen_project'){
      let p=state.kitchens.find(p=>p.user_id===body.p_actor&&p.id===body.p_id);
      if((p?.revision??0)!==body.p_expected_revision)return problem('40001');
      if(!p){p={user_id:body.p_actor,id:body.p_id,revision:0,created_at:now(),thumbnail_url:null};state.kitchens.push(p);}
      p.revision++;p.name=body.p_name;p.design=clone(body.p_design);p.updated_at=now();
      state.kitchenVersions.push({user_id:p.user_id,kitchen_id:p.id,revision:p.revision,name:p.name,design:clone(p.design),created_at:now(),thumbnail_url:null});return {body:p};
    }
  }});
  const kitchenId=randomUUID(),design=loadSource('src/lib/kitchenAssembly.ts').createUnifiedKitchen();
  state.kitchens.push({id:kitchenId,user_id:userId,name:'Cloud гал тогоо',design,revision:1,created_at:now(),updated_at:now(),thumbnail_url:null});
  state.kitchenVersions.push({user_id:userId,kitchen_id:kitchenId,revision:1,name:'Cloud гал тогоо',design:clone(design),created_at:now(),thumbnail_url:null});
  return {...fixture,state,kitchenId,userId,secondId};
}
module.exports={createPhase8Fixture};
