const {test}=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const {loadSource}=require('./helpers/load-source.cjs');
const nodes=t=>!t||typeof t!=='object'?[]:[t,...React.Children.toArray(t.props?.children).flatMap(nodes)];
test('map zoom keeps the cursor anchor and room drags retain metre coordinates after zoom and pan',()=>{
  const oldWindow=global.window,oldPoint=global.DOMPoint;
  global.window={addEventListener(){},removeEventListener(){}};
  global.DOMPoint=class{constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return this;}};
  const slots=[];let cursor=0,effects=[],tree;const listeners=new Map(),moves=[];
  const svg={getScreenCTM:()=>({inverse:()=>({})}),setPointerCapture(){},releasePointerCapture(){},hasPointerCapture:()=>true,addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)};
  const react={...React,useRef:v=>{const at=cursor++;return slots[at]??(slots[at]={current:v});},useState:v=>{const at=cursor++;if(!(at in slots))slots[at]=v;return[slots[at],v=>slots[at]=typeof v==='function'?v(slots[at]):v];},useEffect:(fn,deps)=>{const at=cursor++,old=slots[at];if(!old||deps.some((v,i)=>v!==old.deps[i])){slots[at]={deps};effects.push(()=>{old?.cleanup?.();slots[at].cleanup=fn();});}}};
  const {RoomPlacementMap}=loadSource('src/components/RoomPlacementMap.tsx',{react});
  const room=(id,x)=>({id,name:id,width:4,depth:4,height:2.7,pieces:[],type:'living',position:{x,z:0}});
  const props={design:{id:'design',activeRoomId:'A',rooms:[room('A',0),room('B',4)],connections:[]},open:true,onSelect(){},onAdd(){},onMove:(id,p)=>{moves.push({id,p});return null;},onConnection(){},onNotice(){},beginEdit(){},endEdit(){}};
  const render=()=>{cursor=0;effects=[];tree=nodes(RoomPlacementMap(props));tree.find(n=>n.type==='svg').props.ref.current=svg;effects.forEach(f=>f());return tree;};
  const selected=()=>tree.find(n=>n.type==='g'&&n.props['aria-pressed']===true);
  const event=(x,y=105)=>({clientX:x,clientY:y,pointerId:1,button:0,currentTarget:svg,stopPropagation(){},preventDefault(){}});
  try{
    render();render();const before=selected().props.transform;
    // Use the actual visible controls, not internal state variables.
    const zooms=tree.find(n=>n.props.role==='group'&&n.type==='div');
    nodes(zooms).find(n=>n.type==='button').props.onClick();render();assert.notEqual(selected().props.transform,before);
    const xy=()=>selected().props.transform.match(/translate\(([-\d.]+) ([-\d.]+)\)/).slice(1).map(Number);
    const anchor=xy();listeners.get('wheel')({...event(...anchor),deltaY:-200});render();assert.ok(Math.abs(xy()[0]-anchor[0])<1e-6);
    selected().props.onPointerDown(event(...xy()));render();assert.ok(tree.some(n=>n.props.role==='toolbar'));
    const allGroups=tree.filter(n=>n.type==='g'&&n.props.role==='button');
    const second=allGroups.find(n=>!n.props['aria-pressed']);
    const bx=Number(second.props.transform.match(/translate\(([-\d.]+)/)[1]);const ax=xy()[0];const scale=(bx-ax)/4;
    const currentSvg=tree.find(n=>n.type==='svg');currentSvg.props.onPointerMove(event(ax+scale));render();tree.find(n=>n.type==='svg').props.onPointerUp(event(ax+scale));render();
    assert.equal(moves.length,1);assert.ok(Math.abs(moves[0].p.x-1)<1e-6);
    const prior=xy()[0];tree.find(n=>n.type==='svg').props.onPointerDown(event(100));render();tree.find(n=>n.type==='svg').props.onPointerMove(event(120));render();assert.ok(Math.abs(xy()[0]-prior-20)<1e-6);
  } finally {slots.forEach(s=>s?.cleanup?.());global.window=oldWindow;global.DOMPoint=oldPoint;}
});
