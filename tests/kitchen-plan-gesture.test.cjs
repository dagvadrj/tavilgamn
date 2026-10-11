const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const {loadSource} = require('./helpers/load-source.cjs');

test('2D gestures coalesce pointer samples, retain the initial SVG transform, flush the final drop and cancel cleanly', t => {
  const before = {window:global.window,requestAnimationFrame:global.requestAnimationFrame,cancelAnimationFrame:global.cancelAnimationFrame};
  t.after(()=>Object.assign(global,before));
  const frames=new Map(),listeners=new Map();let frameId=0,cleanup;
  global.window={addEventListener:(name,cb)=>listeners.set(name,cb),removeEventListener:name=>listeners.delete(name)};
  global.requestAnimationFrame=cb=>{frames.set(++frameId,cb);return frameId;};
  global.cancelAnimationFrame=id=>frames.delete(id);
  const {KitchenPlanWorkspace}=loadSource('src/features/kitchen-planner/components/KitchenPlanWorkspace.tsx',{
    react:{...React,useRef:v=>({current:v}),useState:v=>[v,()=>{}],useEffect:cb=>{cleanup=cb();}},
  });
  const moves=[],ends=[],cancels=[],starts=[];
  const pose={x:300,z:300,y:0,rotation:0};
  const tree=KitchenPlanWorkspace({kitchen:{room:{width:4000,depth:3000,height:2600},cabinets:[{id:'cabinet',position:pose}],extras:[]},selectedId:null,disabled:false,
    onSelect(){},onStart:id=>starts.push(id),onMove:(id,p)=>moves.push({id,pose:p}),onEnd:()=>ends.push(true),onCancel:()=>cancels.push(true),onRotate(){},onDuplicate(){},onDelete(){}});
  const nodes=node=>!React.isValidElement(node)?[]:[node,...React.Children.toArray(node.props.children).flatMap(nodes)];
  const sheet=nodes(tree).find(n=>n.props.className==='kitchen-plan-sheet');
  let scale=2,captured=false;
  const svg={getScreenCTM:()=>({inverse:()=>({scale})}),createSVGPoint:()=>({x:0,y:0,matrixTransform(matrix){return{x:this.x*matrix.scale,y:this.y*matrix.scale};}})};
  const target={querySelector:()=>svg,setPointerCapture(){captured=true;},hasPointerCapture:()=>captured,releasePointerCapture(){captured=false;}};
  const event={button:0,pointerId:1,clientX:100,clientY:100,currentTarget:target,target:{closest:()=>({getAttribute:()=> 'cabinet'})},preventDefault(){}};
  sheet.props.onPointerDown(event);
  assert.deepEqual(starts,['cabinet']);
  sheet.props.onPointerMove({...event,clientX:110,clientY:120});
  sheet.props.onPointerMove({...event,clientX:120,clientY:130});
  assert.equal(frames.size,1);assert.equal(moves.length,0);
  scale=10;
  const [id,apply]=[...frames.entries()][0];frames.delete(id);apply();
  assert.deepEqual(moves[0],{id:'cabinet',pose:{...pose,x:340,z:360}});
  sheet.props.onPointerMove({...event,clientX:140,clientY:150});
  sheet.props.onPointerUp({...event,clientX:150,clientY:160});
  assert.equal(frames.size,0);
  assert.deepEqual(moves[1],{id:'cabinet',pose:{...pose,x:400,z:420}});
  assert.equal(ends.length,1);assert.equal(captured,false);
  sheet.props.onLostPointerCapture(event);assert.equal(cancels.length,0);
  sheet.props.onPointerDown(event);sheet.props.onPointerMove({...event,clientX:180});
  sheet.props.onPointerCancel(event);
  assert.equal(frames.size,0);assert.equal(cancels.length,1);assert.equal(moves.length,2);
  sheet.props.onPointerDown(event);listeners.get('blur')();
  assert.equal(cancels.length,2);cleanup();assert.equal(cancels.length,2);
});
