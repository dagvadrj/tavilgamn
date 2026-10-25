const test=require('node:test'), assert=require('node:assert/strict');
const {loadSource}=require('./helpers/load-source.cjs');
const {scrollRoomPose,roomScrollProgress,ROOM_STEPS}=loadSource('src/features/home-motion/scrollRoomStory.ts');
test('header hides only on downward hero scroll, restores on reverse/exit/unmount',()=>{
 const React=require('react'),effects=[],refs=[],states=[];
 const {useScrollRoom}=loadSource('src/features/home-motion/useScrollRoom.ts',{react:{...React,useEffect:fn=>effects.push(fn),useRef:value=>{const ref={current:value};refs.push(ref);return ref},useState:value=>{const state={value};states.push(state);return[value,v=>state.value=v]},useCallback:fn=>fn}});
 const previous=Object.fromEntries(['window','document','getComputedStyle','IntersectionObserver','ResizeObserver','requestAnimationFrame','cancelAnimationFrame','setTimeout','clearTimeout'].map(k=>[k,global[k]]));
 let y=0,frame,intersection,release;const listeners=new Map(),attrs={};
 const header={offsetHeight:76,inert:false,dataset:{},contains:()=>false,toggleAttribute:(k,v)=>{if(v)attrs[k]="";else delete attrs[k]},setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>{delete attrs[k];if(k==='data-room-hidden')delete header.dataset.roomHidden},addEventListener(){},removeEventListener(){}};
 global.window={get scrollY(){return y},innerHeight:800,addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)};
 global.document={hidden:false,activeElement:null,querySelector:()=>header,addEventListener(){},removeEventListener(){}};
 global.getComputedStyle=()=>({position:'sticky'});
 global.IntersectionObserver=class{constructor(fn){intersection=fn}observe(){}disconnect(){}};
 global.setTimeout=(fn,ms)=>{assert.equal(ms,20000);release=fn;return 1};global.clearTimeout=()=>{release=undefined};
 global.ResizeObserver=class{observe(){}disconnect(){}};
 global.requestAnimationFrame=fn=>{frame=fn;return 1};global.cancelAnimationFrame=()=>{};
 let cleanup;
 try {
  useScrollRoom();
  refs[0].current={style:{setProperty(){}},getBoundingClientRect:()=>({top:-y,bottom:4000-y,height:4000})};
  refs[1].current={clientHeight:800,getBoundingClientRect:()=>({top:0,bottom:800})};
  cleanup=effects[1]();frame();
  intersection([{isIntersecting:true}]);assert.equal(states[3].value,true);
  intersection([{isIntersecting:false}]);assert.equal(states[3].value,true);assert.ok(release);
  intersection([{isIntersecting:true}]);assert.equal(release,undefined);
  intersection([{isIntersecting:false}]);release();assert.equal(states[3].value,false);
  intersection([{isIntersecting:true}]);assert.equal(states[3].value,true);
  const scroll=next=>{y=next;listeners.get('scroll')();frame()};
  scroll(200);assert.equal(header.dataset.roomHidden,'true');assert.equal(header.inert,true);
  scroll(170);assert.equal(header.dataset.roomHidden,undefined);assert.equal(header.inert,false);
  scroll(500);assert.equal(header.dataset.roomHidden,'true');
  scroll(3250);assert.equal(header.dataset.roomHidden,undefined);
  scroll(400);scroll(600);assert.equal(header.dataset.roomHidden,'true');
  scroll(3924);assert.ok(release,'hero clipped by the header must release even inside the observer margin');
  cleanup();cleanup=null;assert.equal(header.dataset.roomHidden,undefined);assert.equal(header.inert,false);assert.equal(attrs['data-room-tour'],undefined);
 } finally{cleanup?.();for(const[k,v]of Object.entries(previous)){if(v===undefined)delete global[k];else global[k]=v}}
});
test('three room stages rotate continuously with reversible scroll and a living-room closeup',()=>{
 assert.deepEqual(ROOM_STEPS.map(p=>scrollRoomPose(p).phase),[0,1,2]);
 assert.ok(scrollRoomPose(.17).eye[2]<scrollRoomPose(0).eye[2]);
 for(let p=0;p<=1;p+=.001){
  const a=scrollRoomPose(p),b=scrollRoomPose(Math.min(1,p+.001));
  assert.ok([...a.eye,...a.target,...a.rotations].every(Number.isFinite));
  assert.ok(a.eye.every((v,i)=>Math.abs(v-b.eye[i])<.12));
  assert.ok(a.target.every((v,i)=>Math.abs(v-b.target[i])<.12));
  assert.ok(a.rotations.every(v=>Math.abs(v)<=.58));
  assert.ok(b.travel>=a.travel);
 }
 const poses=ROOM_STEPS.map(scrollRoomPose);
 assert.deepEqual([...ROOM_STEPS].reverse().map(scrollRoomPose).reverse(),poses);
 assert.deepEqual(scrollRoomPose(10),scrollRoomPose(1));
 assert.deepEqual(scrollRoomPose(NaN),scrollRoomPose(0));
 assert.equal(roomScrollProgress(-1200,3200,800,0),.5);
 assert.equal(roomScrollProgress(-5000,3200,800,0),1);
 assert.equal(roomScrollProgress(10,3200,800,0),0);
});
test('hero texture and geometry assets stay within a bounded local download budget',()=>{
 const fs=require('node:fs'),path=require('node:path');
 const dir=path.resolve('public/interior/premium');let bytes=0;
 for(const name of fs.readdirSync(dir))bytes+=fs.statSync(path.join(dir,name)).size;
 assert.ok(bytes<8*1024*1024);
 for(const surface of ['concrete','parquet','walnut','linen'])for(const channel of ['color','normal','roughness'])assert.ok(fs.statSync(path.join(dir,surface+'-'+channel+'.webp')).size>1000);
 for(const name of ['lounge-chair']){const b=fs.readFileSync(path.join(dir,name+'.glb'));assert.equal(b.readUInt32LE(0),0x46546c67);assert.equal(b.readUInt32LE(8),b.length);}
});
test('hero exposes accessible controls and preserves configured copy and links without WebGL',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const {ScrollRoomHero}=loadSource('src/features/home-motion/ScrollRoomHero.tsx',{'next/dynamic':{default:()=>()=>null},'next/image':{default:({alt})=>React.createElement('span',{'aria-label':alt})},'@/components/PlannerLink':{PlannerLink:({href,children,...props})=>React.createElement('a',{href,...props},children)}});
 const hero={title:'Custom title',description:'Custom description',image:'',primaryHref:'/catalog/sofa',primaryLabel:'Custom CTA',secondaryHref:'/kitchen',secondaryLabel:'Kitchen'};
 const html=renderToStaticMarkup(React.createElement(ScrollRoomHero,{hero,loading:false}));
 for(const text of ['Custom title','Custom description','Custom CTA','/catalog/sofa','Аяллыг алгасах','Өрөөний аяллын үе шат','3D өрөөг бэлдэж байна'])assert.ok(html.includes(text),text);
});

test('each furniture focus uses a closer, oblique camera inside its own room',()=>{
 const {roomFocusPose,ROOM_ITEMS,ROOM_GAP}=loadSource('src/features/home-motion/scrollRoomStory.ts');
 const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 for(const item of Object.keys(ROOM_ITEMS)){
  const i=ROOM_ITEMS[item].room,focus=roomFocusPose(item),overview=scrollRoomPose(ROOM_STEPS[i]);
  assert.ok(distance(focus.eye,focus.target)<distance(overview.eye,focus.target),item);
  assert.ok(Math.abs(focus.eye[0]-focus.target[0])>.3,item+' oblique');
  assert.ok(Math.abs(focus.eye[0]-i*ROOM_GAP)<5,item+' bounds');
  const rotated=roomFocusPose(item,.4);assert.ok(Math.abs(distance(rotated.eye,rotated.target)-distance(focus.eye,focus.target))<1e-8);
 }
});

test('room residency never retains a third room and supports reverse travel',()=>{
 const {roomStageMask}=loadSource('src/features/home-motion/roomRenderBudget.ts');
 for(let travel=0;travel<=2;travel+=.001){
  const mask=roomStageMask(travel),rooms=[0,1,2].filter(i=>mask & (1<<i));
  assert.ok(rooms.length>=1 && rooms.length<=2);
  assert.ok(rooms.includes(Math.round(travel)));
 }
 assert.deepEqual([0,.5,1,1.5,2,1.5,1,.5,0].map(roomStageMask),[1,3,2,6,4,6,2,3,1]);
 assert.equal(roomStageMask(NaN),1);
});

test('render resolution stays within the motion and idle pixel budgets on high-DPI displays',()=>{
 const {roomPixelRatio}=loadSource('src/features/home-motion/roomRenderBudget.ts');
 for(const [width,height] of [[390,844],[1680,944],[3840,2160],[7680,4320]]){
  const idle=roomPixelRatio(width,height,3,false,false),moving=roomPixelRatio(width,height,3,true,false);
  assert.ok(width*height*idle*idle<=1800001);
  assert.ok(width*height*moving*moving<=1000001);
  assert.ok(moving<=idle);
  assert.ok(roomPixelRatio(width,height,3,true,true)<=.75);
 }
 assert.equal(roomPixelRatio(390,844,1,false,false),1);
});
