const {test}=require('node:test');
const assert=require('node:assert/strict');
const {loadSource}=require('./helpers/load-source.cjs');
test('surface popup dismisses on outside click and Escape, while inside controls remain open',()=>{
  const oldWindow=global.window,oldDocument=global.document,listeners=new Map(),effects=[];let closed=0,ended=0,focused=0;
  global.window={innerWidth:800,innerHeight:700};
  global.document={activeElement:{focus(){focused++;}},addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n)};
  const {RoomSurfacePopover}=loadSource('src/components/RoomSurfacePopover.tsx',{react:{useRef:v=>({current:v}),useEffect:fn=>effects.push(fn)},'./RoomEnvironmentPanel':{RoomEnvironmentPanel:'surface-panel'}});
  try{
    const tree=RoomSurfacePopover({selection:{surface:'wall',wall:'north',x:790,y:690},design:{},onClose:()=>closed++,onUpdate(){},onSurfaceChange(){},beginEdit(){},endEdit:()=>ended++});
    tree.props.ref.current={contains:target=>target==='inside',querySelector:()=>({focus(){}})};
    const cleanups=effects.map(f=>f());
    assert.ok(tree.props.style.left<=448);assert.ok(tree.props.style.top<=128);
    listeners.get('pointerdown')({target:'inside'});assert.equal(closed,0);
    listeners.get('pointerdown')({target:'outside'});assert.equal(closed,1);
    listeners.get('keydown')({key:'Escape',stopPropagation(){}});assert.equal(closed,2);
    cleanups.forEach(f=>f());assert.equal(listeners.size,0);assert.equal(ended,1);assert.equal(focused,1);
  }finally{global.window=oldWindow;global.document=oldDocument;}
});
