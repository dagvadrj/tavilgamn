const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');
const THREE = require('three');
const { NextRequest } = require('next/server');
const { loadSource } = require('./helpers/load-source.cjs');
const templates = loadSource('src/lib/roomTemplates.ts');
const { syncDesignRooms } = loadSource('src/lib/roomDesign.ts');
const { roomTemplateOutline } = loadSource('src/lib/roomPolygon.ts');
const id = 'b5e165bc-c8bd-4a53-b09e-fd9eb2e9bdaa';
const draft = () => syncDesignRooms({ id:'source', activeRoomId:'room-source', name:'Natural living', size:'80', roomType:'living', width:5, depth:4, height:2.7, outline:roomTemplateOutline('rectangle',5,4), wallColor:'#eeeeee', floorColor:'#ccbbaa', floorMaterial:'parquet-oak', openings:[], pieces:[], createdAt:1, updatedAt:2 });
const input = (design=draft()) => ({ title:'Natural living', description:'Example room', furnishing:'full', sortOrder:0, status:'draft', design, previewImage:'' });
const piece = (instanceId) => ({ instanceId, productId:'catalog-sofa', modelId:id, x:0, z:0, rotation:0, color:'#fff', material:'fabric' });

test('template classification and area are computed from all rooms rather than client labels',()=>{
 const d=draft();d.pieces=[piece('sofa')];
 const parsed=templates.readTemplateInput({...input(d),kind:'empty',area:99999});
 assert.equal(parsed.kind,'furnished');assert.equal(parsed.area,20);
 assert.equal(parsed.roomType,'living');assert.equal(templates.readTemplateInput(input()).kind,'empty');
 assert.throws(()=>templates.readTemplateInput({...input(),status:'published'}),/3D/);
 assert.equal(templates.readTemplateInput({...input(),status:'published',previewImage:'data:image/jpeg;base64,/9j/'}).status,'published');
});

test('template copies remap wall and furniture attachment references, preserve materials and never mutate source',()=>{
 const d=draft(), segment=d.outline[0].segmentId;
 d.pieces=[{...piece('wall-shelf'),attachment:{kind:'wall',roomId:d.activeRoomId,segmentId:segment,along:.5,elevation:1.2,offset:0}}, {...piece('decor'),attachment:{kind:'surface',parentInstanceId:'wall-shelf',surfaceId:'top',localPosition:[0,0,0],localQuaternion:[0,0,0,1]}}];
 d.pieces[0].placement={surfaces:['wall'],supportSurfaces:[{id:'top',width:1,depth:.3,elevation:0}]};
 const source=JSON.stringify(d),a=templates.instantiateRoomTemplate(d),b=templates.instantiateRoomTemplate(d);
 assert.notEqual(a.id,b.id);assert.notEqual(a.id,d.id);assert.notEqual(a.activeRoomId,d.activeRoomId);
 assert.equal(a.pieces[0].attachment.roomId,a.activeRoomId);
 assert.equal(a.pieces[0].attachment.segmentId,a.outline[0].segmentId);
 assert.equal(a.pieces[1].attachment.parentInstanceId,a.pieces[0].instanceId);
 assert.equal(a.pieces[1].attachment.surfaceId,'top');
 assert.equal(a.pieces[0].modelId,id);assert.equal(a.pieces[0].productId,'catalog-sofa');
 assert.deepEqual(a.pieces[0].placement,d.pieces[0].placement);
 assert.equal(a.floorMaterial,d.floorMaterial);assert.deepEqual(a.wallMaterials,d.wallMaterials);
 assert.equal(JSON.stringify(d),source);assert.equal(a.rooms[0].pieces[0].instanceId,a.pieces[0].instanceId);
});

test('invalid geometry, nonfinite values, duplicate furniture, local assets and oversized payloads are rejected',()=>{
 for(const edit of [d=>d.width=NaN,d=>d.pieces=[piece('a'),piece('a')],d=>d.pieces=[{...piece('a'),details:{name:'x',image:'blob:local',dimensions:{w:1,d:1,h:1}}}],d=>d.rooms=Array(13).fill(d.rooms[0]),d=>d.width=50]){
  const d=draft();edit(d);assert.throws(()=>templates.readTemplateDesign(d));
 }
 assert.throws(()=>templates.readTemplateInput({...input(),previewImage:'data:image/svg+xml;base64,PHN2Zz4='}));
 assert.throws(()=>templates.readTemplateInput({...input(),id,version:0}));
 assert.throws(()=>templates.readTemplateInput({...input(),title:'x'.repeat(101)}));
});

test('store import preserves the previous project and starts an independent undo history',()=>{
 const { useDesigns }=loadSource('src/store/designs.ts');
 useDesigns.getState().createNew('80','Previous','living',{width:4,depth:4,height:2.7});
 const previous=useDesigns.getState().current.id;
 useDesigns.getState().updateRoom({wallColor:'#112233'});
 useDesigns.getState().importTemplate(draft());
 const state=useDesigns.getState();
 assert.notEqual(state.current.id,previous);assert.notEqual(state.current.id,'source');
 assert.equal(state.designs.find(d=>d.id===previous).wallColor,'#112233');
 assert.equal(state.past.length,0);assert.equal(state.future.length,0);assert.equal(state.transaction,null);
});

function apiHarness(allowed=true){
 const rows=new Map();let dbReads=0;
 const db={from(){dbReads++;const filters=[],q={
  select(){return q;},eq(key,value){filters.push([key,value]);return q;},order(){return q;},limit(){return Promise.resolve({data:[...rows.values()].filter(r=>filters.every(([k,v])=>r[k]===v)),error:null});},
  update(value){q.value=value;return q;},insert(value){q.value={...value,id};q.inserting=true;return q;},
  maybeSingle(){if(q.value){const row=rows.get(id);if(!row||!filters.every(([k,v])=>row[k]===v))return Promise.resolve({data:null,error:null});rows.set(id,{...row,...q.value});return Promise.resolve({data:rows.get(id),error:null});}return Promise.resolve({data:[...rows.values()].find(r=>filters.every(([k,v])=>r[k]===v))??null,error:null});},
  single(){rows.set(id,q.value);return Promise.resolve({data:q.value,error:null});}
 };return q;}};
 const mocks={'@/lib/supabase/admin':{getSupabaseAdmin:()=>db},'@/lib/supabase/requireAdmin':{requireAdmin:async()=>allowed?{userId:'admin',error:null}:{userId:null,error:Response.json({error:'Forbidden'},{status:403})}}};
 return { rows,dbReads:()=>dbReads,admin:loadSource('src/app/api/admin/room-templates/route.ts',mocks),public:loadSource('src/app/api/room-templates/route.ts',mocks),preview:loadSource('src/app/api/room-templates/preview/route.ts',mocks),export:loadSource('src/app/api/admin/room-templates/export/route.ts',mocks) };
}
const request=(url,body)=>new NextRequest(`http://localhost${url}`,body?{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(body)}:undefined);

test('admin authorization runs before any read, save or export operation',async()=>{
 const h=apiHarness(false);
 assert.equal((await h.admin.GET(request('/api/admin/room-templates'))).status,403);
 assert.equal((await h.admin.PUT(request('/api/admin/room-templates',input()))).status,403);
 assert.equal((await h.export.POST(request('/api/admin/room-templates/export'))).status,403);
 assert.equal(h.dbReads(),0);
});

test('draft -> publish -> archive visibility and concurrent edits are enforced on the server',async()=>{
 const h=apiHarness();const base='/api/admin/room-templates';
 let response=await h.admin.PUT(request(base,input()));assert.equal(response.status,200);
 let saved=(await response.json()).template;assert.equal(saved.version,1);
 assert.equal((await (await h.public.GET(request('/api/room-templates'))).json()).templates.length,0);
 assert.equal((await h.public.GET(request(`/api/room-templates?id=${id}`))).status,404);
 assert.equal((await h.preview.GET(request(`/api/room-templates/preview?id=${id}`))).status,404);
 response=await h.admin.PUT(request(base,{...input(),id,version:1,status:'published',previewImage:'data:image/jpeg;base64,/9j/'}));assert.equal(response.status,200);
 saved=(await response.json()).template;assert.equal(saved.version,2);
 let cards=(await (await h.public.GET(request('/api/room-templates'))).json()).templates;
 assert.equal(cards.length,1);assert.equal(cards[0].id,id);assert.equal('design' in cards[0],false);
 assert.equal(cards[0].previewImage,`/api/room-templates/preview?id=${id}`);
 const image=await h.preview.GET(request(`/api/room-templates/preview?id=${id}`));assert.equal(image.status,200);assert.equal(image.headers.get('content-type'),'image/jpeg');
 assert.equal((await h.public.GET(request(`/api/room-templates?id=${id}`))).status,200);
 assert.equal((await h.admin.PUT(request(base,{...input(),id,version:1}))).status,409);
 assert.equal(h.rows.get(id).status,'published');
 assert.equal((await h.admin.PUT(request(base,{...input(),id,version:2,status:'archived'}))).status,200);
 assert.equal((await h.public.GET(request(`/api/room-templates?id=${id}`))).status,404);
 assert.equal((await h.preview.GET(request(`/api/room-templates/preview?id=${id}`))).status,404);
 assert.equal(h.rows.size,1);
});

test('invalid template payloads do not write to the database',async()=>{
 const h=apiHarness();
 assert.equal((await h.admin.PUT(request('/api/admin/room-templates',{...input(),design:{}}))).status,400);
 assert.equal(h.rows.size,0);assert.equal(h.dbReads(),0);
 assert.equal((await h.public.GET(request('/api/room-templates?id=invalid'))).status,400);
});

test('only active deliveries satisfy template furniture references, including catalog aliases',async()=>{
 const { templateAssetsAvailable }=loadSource('src/lib/roomTemplatesServer.ts');
 const d=draft();d.pieces=[piece('sofa')];const design=templates.readTemplateDesign(d);
 const model={id,product_id:'catalog-sofa',glb_path:'delivery.glb',archived_at:null};
 const db=rows=>({from(){return {select(){return this;},in(){return this;},is(){return Promise.resolve({data:rows,error:null});}};}});
 assert.equal(await templateAssetsAvailable(design,db([model])),true);
 assert.equal(await templateAssetsAvailable(design,db([])),false);
 assert.equal(await templateAssetsAvailable(design,db([{...model,glb_path:null}])),false);
 design.pieces[0].modelId='catalog-sofa';assert.equal(await templateAssetsAvailable(design,db([model])),true);
});

test('room export produces a decodable binary GLB at the original world scale',async()=>{
 const previous=global.FileReader;
 class Reader { readAsArrayBuffer(blob){blob.arrayBuffer().then(data=>{this.result=data;this.onloadend?.();});} }
 global.FileReader=Reader;
 try {
  const { GLTFExporter }=await import('three/examples/jsm/exporters/GLTFExporter.js');
  const { GLTFLoader }=await import('three/examples/jsm/loaders/GLTFLoader.js');
  const { exportRoomGlb }=loadSource('src/three/roomExport.ts',{'three/examples/jsm/exporters/GLTFExporter.js':{GLTFExporter},'three/examples/jsm/utils/WebGLTextureUtils.js':{decompress(){throw Error('no textures expected');}}});
  const scene=new THREE.Scene(),room=new THREE.Group();room.userData.roomExport=true;room.position.set(2,0,3);scene.add(room);
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(5,.08,4),new THREE.MeshStandardMaterial({color:'#aabbcc'}));room.add(mesh);
  const before=new THREE.Box3().setFromObject(room),blob=await exportRoomGlb(scene),bytes=await blob.arrayBuffer();
  assert.equal(blob.type,'model/gltf-binary');assert.equal(new DataView(bytes).getUint32(0,true),0x46546c67);
  const decoded=(await new GLTFLoader().parseAsync(bytes,'')).scene,after=new THREE.Box3().setFromObject(decoded);
  for(const key of ['min','max'])for(const axis of ['x','y','z'])assert.ok(Math.abs(before[key][axis]-after[key][axis])<1e-6);
  assert.equal(mesh.parent,room);assert.equal(mesh.material.color.getHexString(),'aabbcc');
 } finally { global.FileReader=previous; }
});

test('room GLB snapshot restores hidden cutaway walls, preserves world poses and excludes helpers without editing live resources',()=>{
 // Use one module instance so the authored material WeakMap belongs to both paths.
 const cutaway=loadSource('src/three/roomCutaway.ts');
 const snapshot=loadSource('src/three/roomExport.ts',{'./roomCutaway':cutaway}).snapshotRoomForExport;
 const scene=new THREE.Scene(),content=new THREE.Group();content.userData.roomExport=true;content.position.set(3,0,2);scene.add(content);
 const wall=new THREE.Mesh(new THREE.BoxGeometry(1,2,1),new THREE.MeshStandardMaterial({color:'white'}));wall.position.x=1;content.add(wall);cutaway.applyRoomCutaway(wall,0);
 const pick=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial({opacity:0,transparent:true,colorWrite:false}));content.add(pick);
 const placeholder=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());placeholder.userData.exportExclude=true;content.add(placeholder);
 const outside=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());scene.add(outside);
 const copy=snapshot(scene);assert.equal(copy.root.children.length,1);
 const exported=copy.root.children[0];assert.equal(exported.material.opacity,1);assert.equal(exported.material.colorWrite,true);assert.equal(exported.visible,true);
 assert.equal(exported.matrix.elements[12],4);assert.equal(exported.matrix.elements[14],2);
 assert.equal(wall.material.opacity,0);assert.equal(wall.material.colorWrite,false);assert.notEqual(exported.material,wall.material);
 let disposed=0;wall.material.addEventListener('dispose',()=>disposed++);copy.dispose();assert.equal(disposed,0);
 content.userData.deliveryPending=true;assert.throws(()=>snapshot(scene),/3D/);
});

test('database RLS exposes only published rooms and disallows browser writes, including forged admin metadata',async t=>{
 const db=new PGlite();t.after(()=>db.close());
 await db.exec('create role anon; create role authenticated; create role service_role bypassrls; create table public.profiles(id uuid primary key);');
 await db.exec(readFileSync('supabase/migrations/20261017160000_room_templates.sql','utf8'));
 await db.exec("set role service_role; insert into public.room_templates(title,kind,room_type,area,design,status,preview_image) values ('Draft','empty','living',20,'{}','draft',''), ('Public','empty','living',20,'{}','published','image'), ('Archive','empty','living',20,'{}','archived',''); reset role;");
 for(const role of ['anon','authenticated']){
  await db.exec(`set role ${role}`);
  assert.deepEqual((await db.query('select title from public.room_templates')).rows,[{title:'Public'}]);
  await assert.rejects(db.exec("update public.room_templates set title='Forged'"),/permission denied/);
  await assert.rejects(db.exec('delete from public.room_templates'),/permission denied/);
  await assert.rejects(db.exec("insert into public.room_templates(title,kind,room_type,area,design) values ('Forged','empty','living',20,'{}')"),/permission denied/);
  await db.exec('reset role');
 }
 await assert.rejects(db.exec("insert into public.room_templates(title,kind,room_type,area,design,status) values ('No image','empty','living',20,'{}','published')"),/check constraint/);
});
