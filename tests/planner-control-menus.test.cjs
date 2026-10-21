const {test}=require('node:test');const assert=require('node:assert/strict');const React=require('react');const {loadSource}=require('./helpers/load-source.cjs');
function nodes(node){return !React.isValidElement(node)?[]:[node,...React.Children.toArray(node.props.children).flatMap(nodes)];}
test('room floating menus remain within the viewport and outside the scrolling toolbar across resizing',t=>{
 const original=global.window;t.after(()=>{global.window=original});global.window={innerWidth:320,innerHeight:568};
 let top=300,right=310;const properties=new Map(),other={open:true};
 const menu={open:true,style:{setProperty:(k,v)=>properties.set(k,parseFloat(v))},querySelector:()=>({getBoundingClientRect:()=>({right})})};
 const dock={getBoundingClientRect:()=>({top}),querySelectorAll:()=>[menu,other]};const refs=[{current:dock},{current:null},{current:menu}];
 const {RoomPlannerControls}=loadSource('src/features/room-planner/components/RoomPlannerControls.tsx',{react:{...React,useRef:()=>refs.shift(),useEffect(){},useCallback:fn=>fn}});
 const noop=()=>{};const tree=RoomPlannerControls({view:'dollhouse',onView:noop,onZoom:noop,onRoom:noop,onMaterials:noop,onHelp:noop,dimensions:false,onDimensions:noop,grid:false,onGrid:noop,snap:true,onSnap:noop,locked:false,onLock:noop,expanded:false,onExpand:noop,onRotate:noop});
 const nav=nodes(tree).find(n=>n.type==='nav');assert.ok(!nodes(nav).some(n=>n.props.className==='room-navigation-status'),'active-state actions must not be clipped by toolbar scrolling');assert.ok(nodes(tree).some(n=>n.props.className==='room-navigation-status'));
 const side=nodes(tree).find(n=>n.type==='details'&&n.props.className.includes('room-side-views'));
 side.props.onToggle({currentTarget:menu});assert.equal(other.open,false,'only one dock menu remains open');
 const left=properties.get('--room-menu-left'),height=properties.get('--room-menu-height'),bottom=properties.get('--room-menu-bottom');
 assert.ok(left>=12&&left+280<=320-12);assert.ok(height>80);assert.ok(568-bottom-height>=12,'popover fits above the toolbar without leaving the screen');
 global.window={innerWidth:844,innerHeight:390};top=240;right=830;other.open=true;side.props.onToggle({currentTarget:menu});
 assert.ok(properties.get('--room-menu-left')+280<=832);assert.ok(390-properties.get('--room-menu-bottom')-properties.get('--room-menu-height')>=12);assert.equal(other.open,false);
});

test('mobile light popup reserves the summary column across orientation changes and keeps close accessible',t=>{
 const originals={window:global.window,document:global.document,ResizeObserver:global.ResizeObserver};
 t.after(()=>Object.assign(global,originals));
 let left=334,focused=0,ended=0;const properties=new Map(),listeners=new Map(),cleanups=[];
 const summary={getBoundingClientRect:()=>({left,right:left+44}),focus:()=>focused++};
 const light={open:true,style:{setProperty:(k,v)=>properties.set(k,parseFloat(v))},querySelector:()=>summary};
 const dock={querySelectorAll:()=>[],addEventListener(){},removeEventListener(){}};
 global.window={innerWidth:390,innerHeight:900,addEventListener:(type,callback)=>listeners.set(type,callback),removeEventListener(){}};
 global.document={addEventListener(){},removeEventListener(){}};
 global.ResizeObserver=class{observe(){}disconnect(){}};
 const refs=[{current:dock},{current:light},{current:null}];
 const {RoomPlannerControls}=loadSource('src/features/room-planner/components/RoomPlannerControls.tsx',{react:{...React,useRef:()=>refs.shift(),useEffect:fn=>cleanups.push(fn()),useCallback:fn=>fn}});
 const noop=()=>{};const tree=RoomPlannerControls({view:'dollhouse',onView:noop,onZoom:noop,onRoom:noop,onMaterials:noop,onHelp:noop,dimensions:false,onDimensions:noop,grid:false,onGrid:noop,snap:false,onSnap:noop,locked:false,onLock:noop,expanded:false,onExpand:noop,onRotate:noop,endLightingEdit:()=>ended++});
 const menu=nodes(tree).find(n=>n.props.className==='room-scene-lighting');
 menu.props.onToggle({currentTarget:light});
 assert.ok(properties.get('--room-light-menu-left')>=12);
 assert.ok(properties.get('--room-light-menu-left')+properties.get('--room-light-menu-width')<=left-12,'lighting inputs must never cover the summary close toggle');
 global.window.innerWidth=844;left=636;listeners.get('resize')();
 assert.equal(properties.get('--room-light-menu-width'),320);
 assert.ok(properties.get('--room-light-menu-left')+properties.get('--room-light-menu-width')<=left-12);
 const close=nodes(tree).find(n=>n.props['aria-label']==='Гэрлийн тохиргоог хаах');
 close.props.onClick();assert.equal(light.open,false);assert.equal(focused,1);assert.equal(ended,1);
 cleanups.forEach(fn=>fn?.());
});
