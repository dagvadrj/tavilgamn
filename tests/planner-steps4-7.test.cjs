const test=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {renderToStaticMarkup}=require('react-dom/server');
const {loadSource}=require('./helpers/load-source.cjs');
const {createUnifiedKitchen}=loadSource('src/lib/kitchenAssembly.ts');
const {createCabinet}=loadSource('src/lib/kitchenCabinets.ts');
const {roomSaveStatus,roomContentKey}=loadSource('src/lib/roomSaveStatus.ts');
const {kitchenSaveStatus}=loadSource('src/lib/kitchenSaveStatus.ts');
const rooms=loadSource('src/lib/roomDesign.ts');
const {activeRoomPlacementContext}=loadSource('src/three/roomPlacement.ts');
const {isInsideRoom}=loadSource('src/three/collision.ts');
const fixture=()=>({...createUnifiedKitchen(),cabinets:[createCabinet('base','cabinet')],extras:[]});
const saved=()=>({id:'11111111-2222-4333-8444-555555555555',name:'My kitchen',design:fixture(),thumbnailUrl:null,createdAt:'2026-10-18',updatedAt:'2026-10-18',revision:1});
const nodes=node=>!React.isValidElement(node)?[]:[node,...React.Children.toArray(node.props.children).flatMap(nodes)];
function localStorageFor(t) {
  const oldStorage=global.localStorage,oldWindow=global.window,items=new Map();
  const storage={getItem:key=>items.get(key)??null,setItem:(key,value)=>items.set(key,value),removeItem:key=>items.delete(key)};
  global.localStorage=storage;global.window={localStorage:storage};
  t.after(()=>{global.localStorage=oldStorage;global.window=oldWindow;});
}

test('saved kitchen cards explain fit before placement and preserve the edit link for blocked items',()=>{
  const item=saved(),user={id:'owner'};
  const {SavedKitchenList}=loadSource('src/components/SavedKitchenList.tsx',{
    'next/link':{default:'a'},'next/image':{default:'img'},
    '@/store/auth':{useAuth:select=>select({initialized:true,user})},
    '@/store/kitchens':{useKitchens:()=>({owner:'owner',items:[item],loaded:true,loading:false,error:'',refresh(){},remove(){}})},
  });
  const blocked=renderToStaticMarkup(React.createElement(SavedKitchenList,{onPlace(){},placement:{room:{width:.5,depth:.5,height:2.7,allowFurnitureOverlap:true},pieces:[]}}));
  assert.match(blocked,/Тохируулах шаардлагатай/);assert.match(blocked,/disabled=""/);assert.match(blocked,/aria-describedby="kitchen-fit-/);
  assert.ok(blocked.includes(`/kitchen?design=${item.id}`));
  const fitting=renderToStaticMarkup(React.createElement(SavedKitchenList,{onPlace(){},placement:{room:{width:5,depth:4,height:2.7,allowFurnitureOverlap:true},pieces:[]}}));
  assert.match(fitting,/Өрөөнд багтана/);assert.doesNotMatch(fitting,/disabled=""/);
});

test('kitchen library return path survives login, and stale owner data never appears as an empty current library',()=>{
  let state={initialized:true,user:null},owner='other';
  const {SavedKitchenList}=loadSource('src/components/SavedKitchenList.tsx',{
    'next/link':{default:'a'},'next/image':{default:'img'},
    '@/store/auth':{useAuth:select=>select(state)},
    '@/store/kitchens':{useKitchens:()=>({owner,items:[saved()],loaded:true,loading:false,error:'',refresh(){},remove(){}})},
  });
  const render=()=>renderToStaticMarkup(React.createElement(SavedKitchenList,{onPlace(){}}));
  assert.ok(render().includes('/login?next=%2Fplanner%3Flibrary%3Dmine'));
  state={initialized:true,user:{id:'owner'}};
  const pending=render();assert.match(pending,/санг бэлдэж байна/);assert.doesNotMatch(pending,/My kitchen|Хадгалсан гарнитур алга/);
  owner='owner';assert.match(render(),/My kitchen/);
});

test('kitchen placement validates the latest active room, commits once, and failures leave history untouched',t=>{
  localStorageFor(t);
  const {useDesigns:store}=loadSource('src/store/designs.ts');
  store.getState().createNew('40','Room','living',{width:5,depth:4,height:2.7});
  const item=saved(),first=store.getState().placeKitchen(item);
  assert.ok(first.piece);assert.equal(first.error,null);assert.equal(store.getState().past.length,1);
  store.getState().undo();assert.equal(store.getState().current.pieces.length,0);
  store.getState().redo();assert.equal(store.getState().current.pieces.length,1);
  const tall={...item,design:{...item.design,cabinets:item.design.cabinets.map(c=>({...c,height:4000}))}};
  const before=store.getState().current,count=store.getState().past.length;
  const failure=store.getState().placeKitchen(tall);
  assert.equal(failure.piece,null);assert.match(failure.error,/тааз/);
  assert.equal(store.getState().current,before);assert.equal(store.getState().past.length,count);
  store.getState().beginEdit();assert.equal(store.getState().placeKitchen(item).piece,null);store.getState().endEdit();
});

test('new kitchen placement cannot spill into an open neighbour when the active room is too small',t=>{
  localStorageFor(t);
  const {useDesigns:store}=loadSource('src/store/designs.ts');
  store.getState().createNew('40','Room','living',{width:3,depth:3,height:2.7});
  const a=store.getState().current.activeRoomId;
  store.getState().addRoom('living');const b=store.getState().current.activeRoomId;
  store.getState().moveRoom(b,{x:3,z:0},false);
  for(const connection of store.getState().current.connections)store.getState().updateConnection(connection.id,{kind:'open'});
  store.getState().selectRoom(a);
  const context=activeRoomPlacementContext(store.getState().current);
  assert.equal(context.room.placementGeometry,undefined);
  const result=store.getState().placeKitchen(saved());assert.ok(result.piece);assert.equal(isInsideRoom(result.piece,context.room),true);
  const long=saved();long.design.cabinets=[0,1,2,3,4,5].map(i=>({...createCabinet('base',`long-${i}`),position:{x:i*600,z:0,rotation:0}}));
  const blocked=store.getState().placeKitchen(long);assert.equal(blocked.piece,null);
});

test('room storage distinguishes actual local draft, saved version, edits, and storage failures without marking room selection dirty',()=>{
  const a=rooms.newDesignRoom('living',[]),b=rooms.newDesignRoom('bedroom',[a]);
  const base=rooms.syncDesignRooms({...a,id:'project',size:'40',name:'Plan',createdAt:1,updatedAt:1,rooms:[a,b],activeRoomId:a.id});
  assert.equal(roomSaveStatus(base,undefined,undefined).kind,'checking');
  assert.equal(roomSaveStatus(base,undefined,false).kind,'error');
  assert.equal(roomSaveStatus(base,undefined,true).kind,'draft');
  assert.equal(roomSaveStatus(base,structuredClone(base),true).kind,'saved');
  const selected=rooms.activateDesignRoom(base,b.id);
  assert.equal(roomContentKey(selected),roomContentKey(base));
  assert.equal(roomSaveStatus(selected,base,true).kind,'saved');
  assert.equal(roomSaveStatus({...selected,name:'Renamed'},base,true).kind,'modified');
  assert.equal(roomContentKey({...base,previewImage:'data:image/png;base64,test',updatedAt:99}),roomContentKey(base));
});

test('kitchen save status never confuses a local draft, failed save, changed name or restored version with account persistence',()=>{
  const item=saved(),props={name:item.name,design:item.design,saved:item,signedIn:true,saving:false,localSaved:true,loading:false};
  assert.equal(kitchenSaveStatus(props).kind,'saved');
  assert.equal(kitchenSaveStatus({...props,name:'  My kitchen  '}).kind,'saved');
  assert.equal(kitchenSaveStatus({...props,name:'Renamed'}).kind,'modified');
  assert.equal(kitchenSaveStatus({...props,saveError:'Network failed'}).kind,'error');
  assert.equal(kitchenSaveStatus({...props,saving:true}).kind,'saving');
  assert.equal(kitchenSaveStatus({...props,saved:undefined,signedIn:false}).kind,'local');
  assert.equal(kitchenSaveStatus({...props,saved:undefined,loading:true}).kind,'loading');
  assert.equal(kitchenSaveStatus({...props,saved:undefined,localSaved:false}).kind,'error');
  const changed=structuredClone(item.design);changed.cabinets[0].color='#334455';
  assert.equal(kitchenSaveStatus({...props,design:changed}).kind,'modified');
  assert.equal(kitchenSaveStatus({...props,localSaved:false}).kind,'saved','a failed thumbnail/local draft does not undo a confirmed account save');
});

test('project name editor focuses input, cancels with Escape, and commits Enter without submitting or changing steps',t=>{
  const oldDocument=global.document,listeners=new Map();
  global.document={addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
  t.after(()=>{global.document=oldDocument;});
  let name='Original',cursor=0,focus=0,select=0,summaryFocus=0,cleanup;
  const refs=[];
  const {KitchenProjectName}=loadSource('src/features/kitchen-planner/components/KitchenProjectName.tsx',{
    react:{...React,useRef:value=>refs[cursor++]??(refs[cursor-1]={current:value}),useEffect:fn=>{if(!cleanup)cleanup=fn();}},
  });
  const render=()=>{cursor=0;return KitchenProjectName({name,onName:value=>{name=value;},busy:false});};
  let tree=render();
  const menu={open:true,contains:()=>true,querySelector:()=>({focus:()=>summaryFocus++})};
  tree.props.ref.current=menu;nodes(tree).find(n=>n.type==='input').props.ref.current={focus:()=>focus++,select:()=>select++};
  tree.props.onToggle({currentTarget:menu});assert.equal(focus,1);assert.equal(select,1);
  nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:'Changed'}});tree=render();
  listeners.get('keydown')({key:'Escape',preventDefault(){},stopPropagation(){}});
  assert.equal(name,'Original');assert.equal(menu.open,false);assert.equal(summaryFocus,1);
  menu.open=true;tree=render();tree.props.onToggle({currentTarget:menu});
  nodes(tree).find(n=>n.type==='input').props.onChange({target:{value:'  Final  '}});tree=render();
  let prevented=false;nodes(tree).find(n=>n.type==='input').props.onKeyDown({key:'Enter',preventDefault(){prevented=true;}});
  assert.equal(name,'Final');assert.equal(menu.open,false);assert.equal(prevented,true);cleanup();
});

test('room save indicator checks actual browser storage, rejects stale data and reports storage denial',t=>{
  const oldWindow=global.window,timers=new Map(),listeners=new Map();let nextTimer=0,denied=false;
  const a=rooms.newDesignRoom('living',[]);
  const draft=rooms.syncDesignRooms({...a,id:'project',name:'Draft',size:'40',createdAt:1,updatedAt:1,rooms:[a],activeRoomId:a.id});
  const items=new Map([['owner',JSON.stringify({state:{current:draft}})]]);
  global.window={localStorage:{getItem:key=>{if(denied)throw Error('Denied');return items.get(key)??null;}},
    setTimeout:fn=>{const id=++nextTimer;timers.set(id,fn);return id;},clearTimeout:id=>timers.delete(id),
    addEventListener:(type,fn)=>listeners.set(type,fn),removeEventListener:type=>listeners.delete(type)};
  t.after(()=>{global.window=oldWindow;});
  const slots=[];let cursor=0,effects=[],dirty=false;
  const react={...React,useMemo:fn=>fn(),useState:initial=>{const at=cursor++;if(!slots[at]){slots[at]={value:initial};slots[at].set=value=>{slots[at].value=value;dirty=true;};}return [slots[at].value,slots[at].set];},
    useEffect:(fn,deps)=>{const at=cursor++,old=slots[at];if(!old||deps.some((v,i)=>!Object.is(v,old.deps[i]))){slots[at]={deps};effects.push(()=>{old?.cleanup?.();slots[at].cleanup=fn();});}}};
  const {useRoomSaveStatus}=loadSource('src/features/room-planner/hooks/useRoomSaveStatus.ts',{react});
  const render=(current=draft,namespace='owner')=>{let value;for(let i=0;i<5;i++){cursor=0;effects=[];dirty=false;value=useRoomSaveStatus(current,[],namespace);effects.forEach(fn=>fn());if(!dirty)return value;}throw Error('Unstable');};
  const flush=()=>{const callbacks=[...timers.values()];timers.clear();callbacks.forEach(fn=>fn());};
  assert.equal(render().kind,'checking');flush();assert.equal(render().kind,'draft');
  const changed={...draft,name:'Changed'};assert.equal(render(changed).kind,'checking');flush();assert.equal(render(changed).kind,'error');
  items.set('owner',JSON.stringify({state:{current:changed}}));listeners.get('storage')({key:'owner'});assert.equal(render(changed).kind,'draft');
  assert.equal(render(changed,'new-owner').kind,'checking');flush();assert.equal(render(changed,'new-owner').kind,'error');
  denied=true;listeners.get('storage')({key:'new-owner'});assert.equal(render(changed,'new-owner').kind,'error');
  slots.forEach(slot=>slot.cleanup?.());
});
