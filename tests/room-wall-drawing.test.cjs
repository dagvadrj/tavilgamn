const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const {loadSource} = require('./helpers/load-source.cjs');
const drawing = loadSource('src/lib/roomWallDrawing.ts');
const builder = loadSource('src/lib/roomBuilderDraft.ts');
const {createRoomBuilderHistory, reduceRoomBuilderHistory: reduce} = loadSource('src/lib/roomBuilderHistory.ts');
const initial = () => builder.initializeRoomBuilder({width:5,depth:4,height:2.7,wallColor:'#123456',floorColor:'#C9A37A',floorMaterial:'parquet-oak'});
function elements(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(node => elements(node,predicate));
  return [...(predicate(tree) ? [tree] : []), ...elements(tree.props?.children,predicate)];
}
const content = tree => Array.isArray(tree) ? tree.map(content).join('') : typeof tree === 'object' && tree ? content(tree.props?.children) : tree ?? '';
const button = (tree, text) => elements(tree,n=>n.type==='button'&&(n.props['aria-label']===text||content(n).trim()===text))[0];

test('drawn rooms accept either winding, keep finishes and commit once with undo and redo',()=>{
  const source=initial(), before=structuredClone(source);
  source.openings=[{id:'old-opening'}];source.wallMaterials={old:{color:'#abcdef'}};
  for(const points of [[{x:10,z:8},{x:14,z:8},{x:14,z:11},{x:10,z:11}], [{x:10,z:11},{x:14,z:11},{x:14,z:8},{x:10,z:8}]]) {
    const next=drawing.roomFromWallDrawing(source,points);
    assert.equal(next.width,4);assert.equal(next.depth,3);assert.equal(builder.validateRoomBuilder(next),null);
    assert.equal(next.floorMaterial,'parquet-oak');assert.equal(next.wallColor,before.wallColor);
    assert.deepEqual(next.openings,[]);assert.deepEqual(next.wallMaterials,{});
    assert.equal(new Set(next.outline.map(p=>p.segmentId)).size,4);
    let h=createRoomBuilderHistory(before);h=reduce(h,{type:'change',draft:next});assert.equal(h.past.length,1);
    h=reduce(h,{type:'undo'});assert.deepEqual(h.draft,before);h=reduce(h,{type:'redo'});assert.deepEqual(h.draft,next);
  }
  assert.deepEqual(source.outline,before.outline);
});

test('drawing rejects crossings, reversed overlap, invalid closure and out-of-range dimensions',()=>{
  const p=[{x:0,z:0},{x:4,z:0},{x:4,z:3}];
  assert.match(drawing.wallDrawingIssue(p,{x:2,z:-1}),/огтлолц/);
  assert.match(drawing.wallDrawingIssue(p.slice(0,2),{x:-1,z:0}),/давхар/);
  assert.match(drawing.wallDrawingIssue(p.slice(0,2),{x:3,z:0}),/давхар/);
  assert.equal(drawing.wallDrawingIssue(p.slice(0,2),{x:5,z:0}),null);
  const source=initial(), before=structuredClone(source);
  for(const points of [p.slice(0,2),[{x:0,z:0},{x:4,z:3},{x:4,z:0},{x:0,z:3}], [{x:0,z:0},{x:21,z:0},{x:21,z:3},{x:0,z:3}], [{x:0,z:0},{x:NaN,z:0},{x:1,z:1}]])
    assert.throws(()=>drawing.roomFromWallDrawing(source,points));
  assert.deepEqual(source,before);
});

test('snap, exact lengths and mm/cm/m use physical metres without changing geometry',()=>{
  assert.deepEqual(drawing.snapWallPoint({x:2.26,z:1.14},{x:0,z:0},true,true),{x:2.3,z:0});
  assert.deepEqual(drawing.snapWallPoint({x:2,z:1},{x:0,z:0},false,true,350),{x:3.5,z:0});
  assert.equal(drawing.formatWallLength(2.345,'mm'),'2345 мм');
  assert.equal(drawing.formatWallLength(2.345,'cm'),'234.5 см');
  assert.equal(drawing.formatWallLength(2.345,'m'),'2.345 м');
  assert.throws(()=>drawing.snapWallPoint({x:1,z:0},{x:0,z:0},true,true,0));
  const source=initial(), ids=source.outline.map(p=>p.segmentId), next=drawing.resizeDrawnWall(source,0,6);
  assert.equal(builder.validateRoomBuilder(next),null);assert.deepEqual(next.outline.map(p=>p.segmentId),ids);
  assert.equal(drawing.wallLengthCm(next.outline[0],next.outline[1]),600);
});

function harness() {
  const states=[],refs=[],effects=[];let cursor=0,refCursor=0;
  let history=createRoomBuilderHistory(initial()), selected=0, drawingNow=false, error='';
  const svg={getScreenCTM:()=>({inverse:()=>({})}),focus(){},capture:null,setPointerCapture(id){this.capture=id;},hasPointerCapture(id){return this.capture===id;},releasePointerCapture(){this.capture=null;}};
  const {RoomWallPlan}=loadSource('src/features/room-planner/components/RoomWallPlan.tsx',{
    react:{...React,useState:initial=>{const i=cursor++;if(!(i in states))states[i]=typeof initial==='function'?initial():initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},useRef:value=>refs[refCursor++]??(refs[refCursor-1]={current:value}),useId:()=>':test:',useEffect:fn=>effects.push(fn)},
  });
  const send=action=>{history=reduce(history,action);return !history.error;};
  const props=()=>({draft:history.draft,selected,unit:'cm',onSelect:i=>{selected=i;},onChange:draft=>send({type:'change',draft}),onEditStart:()=>send({type:'begin'}),onEditEnd:cancel=>send({type:cancel?'cancel':'end'}),onDrawingChange:value=>{drawingNow=value;},onError:value=>{error=value;},onResizeWall:length=>send({type:'change',draft:drawing.resizeDrawnWall(history.draft,selected,length)}),onUndo:()=>send({type:'undo'}),onRedo:()=>send({type:'redo'}),canUndo:!!history.past.length,canRedo:!!history.future.length});
  const render=()=>{cursor=refCursor=0;const tree=RoomWallPlan(props());elements(tree,n=>n.type==='svg'&&n.props.className==='room-wall-canvas')[0].props.ref.current=svg;return tree;};
  const plan=tree=>elements(tree,n=>n.type==='svg'&&n.props.className==='room-wall-canvas')[0];
  const event=(x,z,pointerId=1)=>({button:0,pointerId,clientX:x,clientY:z,preventDefault(){},stopPropagation(){},currentTarget:svg});
  return {render,plan,event,svg,effects,get history(){return history;},get drawingNow(){return drawingNow;},get error(){return error;}};
}
function withDom(fn) {
  const before=global.DOMPoint;
  global.DOMPoint=class {constructor(x,y){this.x=x;this.y=y;}matrixTransform(){return this;}};
  try {fn();} finally {global.DOMPoint=before;}
}

test('real line tool shows live centimetres, closes atomically and can undo the completed room',()=>withDom(()=>{
  const h=harness(), original=structuredClone(h.history.draft);let tree=h.render();
  assert.ok(elements(tree,n=>n.type==='image'&&n.props.href==='/textures/room/oak-natural-v1-color.webp').length);
  button(tree,'Line').props.onClick();tree=h.render();
  h.plan(tree).props.onPointerDown(h.event(0,0));tree=h.render();
  h.plan(tree).props.onPointerMove(h.event(3,0));tree=h.render();
  assert.ok(content(tree).includes('300 см'));assert.equal(h.drawingNow,true);assert.deepEqual(h.history.draft,original);
  h.plan(tree).props.onPointerDown(h.event(3,0));tree=h.render();
  h.plan(tree).props.onPointerDown(h.event(3,2));tree=h.render();
  h.plan(tree).props.onPointerDown(h.event(0,2));tree=h.render();
  h.plan(tree).props.onPointerDown(h.event(0,0));tree=h.render();
  assert.equal(h.drawingNow,false);assert.equal(h.history.draft.width,3);assert.equal(h.history.draft.depth,2);assert.equal(h.history.past.length,1);
  button(tree,'Үйлдэл буцаах').props.onClick();assert.deepEqual(h.history.draft,original);
}));

test('Escape discards an unfinished line without touching room history; exact length and local redo work',()=>withDom(()=>{
  const h=harness(), original=structuredClone(h.history.draft);let tree=h.render();button(tree,'Line').props.onClick();tree=h.render();
  h.plan(tree).props.onPointerDown(h.event(0,0));tree=h.render();
  let input=elements(tree,n=>n.type==='input')[0];input.props.onChange({target:{value:'250'}});tree=h.render();
  input=elements(tree,n=>n.type==='input')[0];input.props.onKeyDown({key:'Enter',preventDefault(){},stopPropagation(){}});tree=h.render();
  assert.ok(content(tree).includes('250 см'));button(tree,'Үйлдэл буцаах').props.onClick();tree=h.render();button(tree,'Дахин хийх').props.onClick();tree=h.render();
  assert.ok(content(tree).includes('250 см'));
  tree.props.onKeyDown({key:'Escape',target:{tagName:'INPUT'},preventDefault(){},stopPropagation(){}});
  assert.equal(h.drawingNow,false);assert.deepEqual(h.history.draft,original);assert.equal(h.history.past.length,0);
}));

test('wall dragging moves both endpoints, ignores foreign pointers and cancels to its baseline',()=>withDom(()=>{
  const h=harness(), original=structuredClone(h.history.draft);let tree=h.render();
  const edge=elements(tree,n=>n.type==='line'&&n.props.className==='room-wall-hit')[0];edge.props.onPointerDown(h.event(0,-2));tree=h.render();
  h.plan(tree).props.onPointerMove(h.event(0,-1.5,2));assert.deepEqual(h.history.draft,original);
  h.plan(tree).props.onPointerMove(h.event(0,-1.5));tree=h.render();assert.equal(h.history.draft.outline[0].z,-1.5);assert.equal(h.history.draft.outline[1].z,-1.5);
  h.plan(tree).props.onPointerCancel(h.event(0,-1.5));assert.deepEqual(h.history.draft,original);assert.equal(h.history.past.length,0);assert.equal(h.svg.capture,null);
}));

test('dimension sidebar has only plan, mm/cm/m and exposed orientation actions',()=>{
  const calls=[];const {RoomDimensionSidebar}=loadSource('src/features/room-planner/components/RoomDimensionSidebar.tsx');
  const tree=RoomDimensionSidebar({draft:initial(),selected:0,unit:'cm',onUnit:unit=>calls.push(unit),onTransform:value=>calls.push(value)});
  assert.equal(elements(tree,n=>n.type==='input'||n.type==='select'||n.type==='details').length,0);
  assert.deepEqual(elements(tree,n=>n.type==='button'&&n.props['aria-pressed']!==undefined).map(n=>content(n)),['мм','см','м']);
  button(tree,'мм').props.onClick();button(tree,'90° эргүүлэх').props.onClick();assert.deepEqual(calls,['mm','rotate']);
  assert.doesNotMatch(content(tree),/Өргөн|Урт|Фут|нарийвчлан/);
});
