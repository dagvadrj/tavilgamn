const test=require('node:test');
const assert=require('node:assert/strict');
const React=require('react');
const THREE=require('three');
const {loadSource}=require('./helpers/load-source.cjs');
const attachment=loadSource('src/lib/furnitureAttachment.ts');
const {roomTemplateOutline}=loadSource('src/lib/roomPolygon.ts');
const {getRoomGeometry}=loadSource('src/lib/roomGeometry.ts');
const {furnitureDragPlane}=loadSource('src/three/furnitureDragPlane.ts');
const {isPlacementValid}=loadSource('src/three/collision.ts');
const room={width:5,depth:4,height:2.7,outline:roomTemplateOutline('rectangle',5,4)};
const shelf={instanceId:'shelf',productId:'unknown',x:0,z:0,rotation:0,placement:{surfaces:['wall'],defaultElevation:1.4},details:{name:'Shelf',dimensions:{w:.8,d:.3,h:.3}}};
const wall=getRoomGeometry(room).segments[0],wallId=attachment.furnitureWallId(wall);
const mount=()=>attachment.wallAttachedPiece(shelf,room,'r',wallId,2.5,1.4);
const nodes=t=>!t||typeof t!=='object'?[]:Array.isArray(t)?t.flatMap(nodes):[t,...nodes(t.props?.children)];
const text=t=>typeof t==='string'?t:Array.isArray(t)?t.map(text).join(''):t&&typeof t==='object'?text(t.props?.children):'';

test('top and perspective drag planes retain the wall anchor but allow the intended axes',()=>{
  const piece=mount(),top=furnitureDragPlane(piece,room,true),side=furnitureDragPlane(piece,room,false);
  const point=new THREE.Vector3();
  const ray=new THREE.Ray(new THREE.Vector3(piece.x+.4,10,piece.z+.1),new THREE.Vector3(0,-1,0));
  assert.ok(ray.intersectPlane(top,point));assert.ok(Math.abs(point.y-piece.elevation)<1e-8);
  assert.equal(ray.intersectPlane(side,new THREE.Vector3()),null,'top ray is parallel to the wall plane');
  const frontRay=new THREE.Ray(new THREE.Vector3(piece.x+.4,2,3),new THREE.Vector3(0,0,-1));
  assert.ok(frontRay.intersectPlane(side,point));assert.equal(point.y,2);
  assert.equal(furnitureDragPlane({...piece,attachment:{...piece.attachment,segmentId:'missing'}},room,false),null);
});

test('wall duplication retains mounted height and permissions and finds a non-overlapping position',()=>{
  const original={...mount(),placement:{surfaces:['floor','wall'],defaultElevation:.8}};
  const copy=attachment.duplicateFurniturePlacement(original,'copy',[original],room,'r');
  assert.ok(copy);assert.equal(copy.attachment.kind,'wall');assert.equal(copy.elevation,1.4);
  assert.deepEqual(copy.placement,original.placement);assert.ok(isPlacementValid(copy,[original],room));
  assert.notDeepEqual([copy.x,copy.z],[original.x,original.z]);
  assert.throws(()=>attachment.resolveFurnitureAttachments([{...shelf,attachment:undefined}],room,'r'),/зөвшөөрсөн/);
  for(const bad of [NaN,Infinity])assert.throws(()=>attachment.wallAttachedPiece(shelf,room,'r',wallId,bad,1),/тоо/);
});

test('attachment controls expose only authored surfaces and preserve metadata when changing walls',()=>{
  const react={...React,useState:v=>[v,()=>{}]};let changed;
  const {FurnitureAttachmentControls}=loadSource('src/features/room-planner/components/FurnitureAttachmentControls.tsx',{react,'./PlannerPanels':{NumberControl:'number-control'}});
  const render=piece=>FurnitureAttachmentControls({piece,pieces:[piece],room,roomId:'r',onChange:next=>{changed=next;return null;}});
  const tree=render(mount()),buttons=nodes(tree).filter(n=>n.type==='button');
  assert.ok(buttons.some(n=>text(n)==='Хананд бэхлэх'));assert.ok(!buttons.some(n=>text(n)==='Шалан дээр'));
  assert.ok(!text(tree).includes('Дээд талыг тулгуур'));
  const select=nodes(tree).find(n=>n.type==='select');select.props.onChange({target:{value:attachment.furnitureWallId(getRoomGeometry(room).segments[1])}});
  assert.equal(changed.elevation,1.4);assert.deepEqual(changed.placement,shelf.placement);
  const floor=render({...shelf,placement:undefined});assert.ok(!nodes(floor).some(n=>n.type==='button'&&text(n)==='Хананд бэхлэх'));
});

test('admin can author wall-only mounting and cannot remove its last allowed surface',()=>{
  const {ProductPlacementFields}=loadSource('src/features/admin-products/ProductPlacementFields.tsx');
  let value;const render=()=>ProductPlacementFields({value,onChange:next=>{value=next;}});
  let boxes=nodes(render()).filter(n=>n.type==='input'&&n.props.type==='checkbox');assert.equal(boxes[0].props.disabled,true);
  boxes[1].props.onChange({target:{checked:true}});boxes=nodes(render()).filter(n=>n.type==='input'&&n.props.type==='checkbox');boxes[0].props.onChange({target:{checked:false}});
  assert.deepEqual(value.surfaces,['wall']);boxes=nodes(render()).filter(n=>n.type==='input'&&n.props.type==='checkbox');assert.equal(boxes[1].props.disabled,true);
  const height=nodes(render()).find(n=>n.type==='input'&&n.props.type==='number');height.props.onChange({target:{value:'165'}});assert.equal(value.defaultElevation,1.65);
});

function hooks(){const slots=[];let cursor=0,pending=[];return {react:{...React,useState:init=>{const at=cursor++;if(!slots[at])slots[at]={value:typeof init==='function'?init():init};return[slots[at].value,v=>{slots[at].value=typeof v==='function'?v(slots[at].value):v;}];},useRef:v=>{const at=cursor++;return slots[at]??(slots[at]={current:v});},useEffect:(fn,deps)=>{const at=cursor++,old=slots[at];if(!old||deps.some((v,i)=>!Object.is(v,old.deps[i]))){slots[at]={deps};pending.push(()=>{old?.cleanup?.();slots[at].cleanup=fn();});}},useMemo:fn=>fn()},render(fn){cursor=0;pending=[];const result=fn();pending.forEach(f=>f());return result;},dispose(){slots.forEach(s=>s.cleanup?.());}};}

test('touch selection waits for click so an opening inspector cannot retarget the same tap',()=>{
 const previousWindow=global.window;global.window=new EventTarget();
 try{for(const pointerType of ['touch','mouse']){
  const h=hooks(),canvas=new EventTarget(),selected=[];
  canvas.getBoundingClientRect=()=>({left:0,top:0,width:100,height:100});
  const raycaster={ray:new THREE.Ray(new THREE.Vector3(0,10,-1.8),new THREE.Vector3(0,-1,0)),setFromCamera(){}};
  const {DraggablePiece}=loadSource('src/three/RoomCanvas.tsx',{react:h.react,'@react-three/fiber':{Canvas:'canvas',useThree:()=>({camera:new THREE.PerspectiveCamera(),raycaster,gl:{domElement:canvas}})},'@react-three/drei':new Proxy({},{get:(_,key)=>key==='useCursor'?()=>{}:String(key)}),'@/store/catalog':{getProduct:()=>undefined},'@/lib/modelRegistry':{getDbModel:()=>undefined},'./GLBFurnitureMesh':{GLBFurnitureMesh:'glb'},'./InteriorModel':{InteriorModel:'interior'}});
  const props={piece:mount(),allPieces:[],roomDims:room,selected:false,onSelect:id=>selected.push(id),onMove(){},onDragChange(){},snapEnabled:false,gridEnabled:false,measureMode:false,plan:true,kitchenMaterials:{}};
  try{
   const tree=h.render(()=>DraggablePiece(props));
   tree.props.onPointerDown({pointerType,button:0,pointerId:1,clientX:50,clientY:50,stopPropagation(){},target:{setPointerCapture(){}}});
   assert.equal(selected.length,pointerType==='touch'?0:1);
   tree.props.onClick({stopPropagation(){}});
   assert.equal(selected.at(-1),'shelf');
  }finally{h.dispose()}
 }}finally{global.window=previousWindow}
});

test('rendered wall furniture uses its height; Escape rolls a drag back and foreign pointers cannot move it',()=>{
  const previousWindow=global.window,events=new EventTarget();global.window=events;
  const h=hooks(),canvas=new EventTarget();canvas.getBoundingClientRect=()=>({left:0,top:0,width:100,height:100});
  const camera=new THREE.PerspectiveCamera(),raycaster={ray:new THREE.Ray(),setFromCamera(point){this.ray.set(new THREE.Vector3(point.x,10,-1.8),new THREE.Vector3(0,-1,0));}};
  let piece=mount(),starts=0;const changes=[];
  const {DraggablePiece}=loadSource('src/three/RoomCanvas.tsx',{react:h.react,'@react-three/fiber':{Canvas:'canvas',useThree:()=>({camera,raycaster,gl:{domElement:canvas}})},'@react-three/drei':new Proxy({},{get:(_,key)=>key==='useCursor'?()=>{}:String(key)}),'@/store/catalog':{getProduct:()=>undefined},'@/lib/modelRegistry':{getDbModel:()=>undefined},'./GLBFurnitureMesh':{GLBFurnitureMesh:'glb'},'./InteriorModel':{InteriorModel:'interior'}});
  const props={allPieces:[],roomDims:room,selected:true,onSelect(){},onMove(id,x,z,pose){piece={...piece,x,z,...pose};changes.push(piece);},onDragChange(){},onEditStart(){starts++;},onEditEnd(){},snapEnabled:false,gridEnabled:false,measureMode:false,plan:true,kitchenMaterials:{}};
  const render=()=>h.render(()=>DraggablePiece({...props,piece}));
  const pointer=(pointerId,x=50)=>({button:0,pointerId,clientX:x,clientY:50,stopPropagation(){},target:{setPointerCapture(){},releasePointerCapture(){}}});
  try {
    let tree=render();assert.equal(tree.props.position[1],1.4);const before=structuredClone(piece);
    tree.props.onPointerDown(pointer(1));tree=render();assert.equal(starts,1);
    tree.props.onPointerMove(pointer(2,75));assert.equal(changes.length,0);
    tree.props.onPointerMove(pointer(1,75));tree=render();assert.ok(changes.length>0);assert.equal(piece.elevation,1.4);
    const escape=new Event('keydown',{cancelable:true});Object.defineProperty(escape,'key',{value:'Escape'});events.dispatchEvent(escape);render();assert.deepEqual(piece,before);
  }finally{h.dispose();global.window=previousWindow;}
});

test('hand tool lets presses on furniture reach camera controls without selecting, moving or starting history',()=>{
  const h=hooks(),canvas=new EventTarget(),controls={enabled:true};
  const {DraggablePiece}=loadSource('src/three/RoomCanvas.tsx',{react:h.react,'@react-three/fiber':{Canvas:'canvas',useThree:()=>({camera:new THREE.PerspectiveCamera(),raycaster:{},gl:{domElement:canvas},controls})},'@react-three/drei':new Proxy({},{get:(_,key)=>key==='useCursor'?()=>{}:String(key)}),'@/store/catalog':{getProduct:()=>undefined},'@/lib/modelRegistry':{getDbModel:()=>undefined},'./GLBFurnitureMesh':{GLBFurnitureMesh:'glb'},'./InteriorModel':{InteriorModel:'interior'}});
  const fail=()=>assert.fail('hand mode must not edit furniture or intercept the camera press');
  try {
    const tree=h.render(()=>DraggablePiece({navigationOnly:true,piece:{instanceId:'box',productId:'unknown',x:0,z:0,rotation:0,details:{name:'Box',dimensions:{w:1,d:.6,h:.8}}},allPieces:[],roomDims:room,selected:false,onSelect:fail,onMove:fail,onDragChange:fail,onEditStart:fail,snapEnabled:false,gridEnabled:false,measureMode:false,kitchenMaterials:{}}));
    const event={button:0,pointerId:1,stopPropagation:fail,target:{setPointerCapture:fail}};
    tree.props.onPointerOver(event);tree.props.onPointerDown(event);tree.props.onPointerMove(event);tree.props.onClick(event);
    assert.equal(controls.enabled,true);
  }finally{h.dispose();}
});

test('dragging past a wall slides along it, holds orbit controls synchronously and never shows a red overlay',()=>{
  const previousWindow=global.window,events=new EventTarget();global.window=events;
  const h=hooks(),canvas=new EventTarget();canvas.getBoundingClientRect=()=>({left:0,top:0,width:100,height:100});
  const camera=new THREE.PerspectiveCamera(),controls={enabled:true};
  // Top-view ray: screen x/y map to world x/z with 0.1 m per pixel around the centre.
  const raycaster={ray:new THREE.Ray(),setFromCamera(point){this.ray.set(new THREE.Vector3(point.x*5,10,-point.y*5),new THREE.Vector3(0,-1,0));}};
  const {DraggablePiece}=loadSource('src/three/RoomCanvas.tsx',{react:h.react,'@react-three/fiber':{Canvas:'canvas',useThree:()=>({camera,raycaster,gl:{domElement:canvas},controls})},'@react-three/drei':new Proxy({},{get:(_,key)=>key==='useCursor'?()=>{}:String(key)}),'@/store/catalog':{getProduct:()=>undefined},'@/lib/modelRegistry':{getDbModel:()=>undefined},'./GLBFurnitureMesh':{GLBFurnitureMesh:'glb'},'./InteriorModel':{InteriorModel:'interior'}});
  let piece={instanceId:'box',productId:'unknown',x:0,z:0,rotation:0,details:{name:'Box',dimensions:{w:1,d:.6,h:.8}}};
  const props={allPieces:[],roomDims:room,selected:true,onSelect(){},onMove(id,x,z,pose){piece={...piece,x,z,...pose};},onDragChange(){},snapEnabled:false,gridEnabled:false,measureMode:false,plan:true,kitchenMaterials:{}};
  const render=()=>h.render(()=>DraggablePiece({...props,piece}));
  const pointer=(x,y=50)=>({button:0,pointerId:1,clientX:x,clientY:y,stopPropagation(){},target:{setPointerCapture(){},releasePointerCapture(){}}});
  const {minX,maxX}=getRoomGeometry(room).bounds;
  try{
    let tree=render();tree.props.onPointerDown(pointer(50));
    assert.equal(controls.enabled,false,'the press disables orbit before native controls see it');
    tree=render();
    for(const [x,y] of [[95,50],[99,40],[99,60],[5,55]]){tree.props.onPointerMove(pointer(x,y));tree=render();}
    assert.ok(Math.abs(piece.x-(minX+.5))<2e-3,'cursor beyond the left wall leaves the piece at the wall contact');
    assert.ok(Math.abs(piece.z-.5)<2e-3,'motion along the wall continues while blocked');
    assert.ok(isPlacementValid(piece,[],room));
    assert.equal(JSON.stringify(tree).includes('E53935'),false,'no red invalid overlay is rendered');
    tree.props.onPointerMove(pointer(98,50));tree=render();
    assert.ok(Math.abs(piece.x-(maxX-.5))<2e-3);
    const up=new Event('pointerup');Object.defineProperty(up,'pointerId',{value:1});events.dispatchEvent(up);render();
    assert.equal(controls.enabled,true,'released drags restore the controls');
    assert.ok(Math.abs(piece.x-(maxX-.5))<2e-3,'release keeps the last valid position');
  }finally{h.dispose();global.window=previousWindow;}
});

test('wall-mounted furniture dragged beyond the wall end stays attached at its height',()=>{
  const previousWindow=global.window,events=new EventTarget();global.window=events;
  const h=hooks(),canvas=new EventTarget();canvas.getBoundingClientRect=()=>({left:0,top:0,width:100,height:100});
  const camera=new THREE.PerspectiveCamera(),raycaster={ray:new THREE.Ray(),setFromCamera(point){this.ray.set(new THREE.Vector3(point.x*5,10,-1.8),new THREE.Vector3(0,-1,0));}};
  const {DraggablePiece}=loadSource('src/three/RoomCanvas.tsx',{react:h.react,'@react-three/fiber':{Canvas:'canvas',useThree:()=>({camera,raycaster,gl:{domElement:canvas}})},'@react-three/drei':new Proxy({},{get:(_,key)=>key==='useCursor'?()=>{}:String(key)}),'@/store/catalog':{getProduct:()=>undefined},'@/lib/modelRegistry':{getDbModel:()=>undefined},'./GLBFurnitureMesh':{GLBFurnitureMesh:'glb'},'./InteriorModel':{InteriorModel:'interior'}});
  let piece=mount();
  const props={allPieces:[],roomDims:room,selected:true,onSelect(){},onMove(id,x,z,pose){piece={...piece,x,z,...pose};},onDragChange(){},snapEnabled:false,gridEnabled:false,measureMode:false,plan:true,kitchenMaterials:{}};
  const render=()=>h.render(()=>DraggablePiece({...props,piece}));
  const pointer=x=>({button:0,pointerId:1,clientX:x,clientY:50,stopPropagation(){},target:{setPointerCapture(){},releasePointerCapture(){}}});
  try{
    let tree=render();tree.props.onPointerDown(pointer(50));tree=render();
    for(const x of [80,140,400]){tree.props.onPointerMove(pointer(x));tree=render();}
    assert.equal(piece.attachment.kind,'wall');assert.equal(piece.attachment.segmentId,wallId);
    assert.equal(piece.elevation,1.4);
    const {along}=piece.attachment;
    assert.ok(Math.abs(along-.41)<1e-6||Math.abs(along-(wall.length-.41))<1e-6,'clamped to the wall end margin');
    tree.props.onPointerMove(pointer(-300));render();
    assert.equal(piece.attachment.kind,'wall');
    assert.ok(Math.abs(piece.attachment.along-along)>1,'the opposite end is reachable');
  }finally{h.dispose();global.window=previousWindow;}
});
