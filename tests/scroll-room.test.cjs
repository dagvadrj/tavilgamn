const test=require('node:test'), assert=require('node:assert/strict');
const {loadSource}=require('./helpers/load-source.cjs');
const {scrollRoomPose,roomScrollProgress,ROOM_STEPS}=loadSource('src/features/home-motion/scrollRoomStory.ts');
test('header hides only on downward hero scroll, restores on reverse/exit/unmount',()=>{
 const React=require('react'),effects=[],refs=[];
 const {useScrollRoom}=loadSource('src/features/home-motion/useScrollRoom.ts',{react:{...React,useEffect:fn=>effects.push(fn),useRef:value=>{const ref={current:value};refs.push(ref);return ref},useState:value=>[value,()=>{}],useCallback:fn=>fn}});
 const previous=Object.fromEntries(['window','document','getComputedStyle','IntersectionObserver','ResizeObserver','requestAnimationFrame','cancelAnimationFrame'].map(k=>[k,global[k]]));
 let y=0,frame;const listeners=new Map(),attrs={};
 const header={offsetHeight:76,inert:false,dataset:{},contains:()=>false,setAttribute:(k,v)=>attrs[k]=v,removeAttribute:k=>{delete attrs[k];if(k==='data-room-hidden')delete header.dataset.roomHidden},addEventListener(){},removeEventListener(){}};
 global.window={get scrollY(){return y},innerHeight:800,addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)};
 global.document={hidden:false,activeElement:null,querySelector:()=>header,addEventListener(){},removeEventListener(){}};
 global.getComputedStyle=()=>({position:'sticky'});
 global.IntersectionObserver=class{observe(){}disconnect(){}};
 global.ResizeObserver=class{observe(){}disconnect(){}};
 global.requestAnimationFrame=fn=>{frame=fn;return 1};global.cancelAnimationFrame=()=>{};
 let cleanup;
 try {
  useScrollRoom();
  refs[0].current={style:{setProperty(){}},getBoundingClientRect:()=>({top:-y,bottom:4000-y,height:4000})};
  refs[1].current={clientHeight:800,getBoundingClientRect:()=>({top:0,bottom:800})};
  cleanup=effects[1]();frame();
  const scroll=next=>{y=next;listeners.get('scroll')();frame()};
  scroll(200);assert.equal(header.dataset.roomHidden,'true');assert.equal(header.inert,true);
  scroll(170);assert.equal(header.dataset.roomHidden,undefined);assert.equal(header.inert,false);
  scroll(500);assert.equal(header.dataset.roomHidden,'true');
  scroll(3250);assert.equal(header.dataset.roomHidden,undefined);
  scroll(400);scroll(600);assert.equal(header.dataset.roomHidden,'true');
  cleanup();cleanup=null;assert.equal(header.dataset.roomHidden,undefined);assert.equal(header.inert,false);assert.equal(attrs['data-room-tour'],undefined);
 } finally{cleanup?.();for(const[k,v]of Object.entries(previous)){if(v===undefined)delete global[k];else global[k]=v}}
});
test('camera approaches sofa, walks through real doorway, then faces bed and wardrobe',()=>{
 assert.deepEqual(ROOM_STEPS.map(p=>scrollRoomPose(p).phase),[0,1,2,3]);
 const distance=(a,b)=>Math.hypot(...a.map((v,i)=>v-b[i]));
 assert.ok(distance(scrollRoomPose(.2).eye,[-.65,.8,-1.65])<distance(scrollRoomPose(0).eye,[-.65,.8,-1.65])*.5);
 for(let p=0;p<=1;p+=.001){
  const a=scrollRoomPose(p),b=scrollRoomPose(Math.min(1,p+.001));
  assert.ok([...a.eye,...a.target,a.bedY,a.wardrobeY].every(Number.isFinite));
  assert.ok(a.eye.every((v,i)=>Math.abs(v-b.eye[i])<.09));
  assert.ok(a.target.every((v,i)=>Math.abs(v-b.target[i])<.12));
  if(Math.abs(a.eye[2]+3.5)<.2)assert.ok(a.eye[0]>1.65&&a.eye[0]<2.85);
  assert.equal(a.sofaY,.055);
 }
 assert.ok(scrollRoomPose(.58).eye[2]<-6);
 assert.deepEqual(scrollRoomPose(1).target,[3.27,1.2,-8.1]);
});
test('furniture descends only after camera enters its room and rests without time-based drift',()=>{
 assert.equal(scrollRoomPose(.5).bedVisible,false);
 assert.ok(scrollRoomPose(.58).bedY>2);
 assert.equal(scrollRoomPose(.73).bedY,.055);
 assert.equal(scrollRoomPose(.8).wardrobeVisible,false);
 assert.ok(scrollRoomPose(.86).wardrobeY>2);
 assert.equal(scrollRoomPose(1).wardrobeY,.02);
 const poses=ROOM_STEPS.map(scrollRoomPose);
 assert.deepEqual([...ROOM_STEPS].reverse().map(scrollRoomPose).reverse(),poses);
 assert.deepEqual(scrollRoomPose(10),scrollRoomPose(1));
 assert.equal(roomScrollProgress(-1200,3200,800,0),.5);
 assert.equal(roomScrollProgress(-5000,3200,800,0),1);
 assert.equal(roomScrollProgress(10,3200,800,0),0);
});
test('hero exposes accessible controls and preserves configured copy and links without WebGL',()=>{
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const {ScrollRoomHero}=loadSource('src/features/home-motion/ScrollRoomHero.tsx',{'next/dynamic':{default:()=>()=>null},'next/image':{default:({alt})=>React.createElement('span',{'aria-label':alt})},'@/components/PlannerLink':{PlannerLink:({href,children,...props})=>React.createElement('a',{href,...props},children)}});
 const hero={title:'Custom title',description:'Custom description',image:'',primaryHref:'/catalog/sofa',primaryLabel:'Custom CTA',secondaryHref:'/kitchen',secondaryLabel:'Kitchen'};
 const html=renderToStaticMarkup(React.createElement(ScrollRoomHero,{hero,loading:false}));
 for(const text of ['Custom title','Custom description','Custom CTA','/catalog/sofa','Аяллыг алгасах','Өрөөний аяллын үе шат','3D өрөөг бэлдэж байна'])assert.ok(html.includes(text),text);
});
