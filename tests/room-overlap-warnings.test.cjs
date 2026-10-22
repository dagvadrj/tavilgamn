const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const mocks = { '@/store/catalog': { getProduct: () => undefined } };
const collision = loadSource('src/three/collision.ts', mocks);
const { roomPlacementContext } = loadSource('src/three/roomPlacement.ts', mocks);
const { roomPlacementWarnings } = loadSource('src/lib/roomPlacementWarnings.ts', mocks);
const { syncDesignRooms } = loadSource('src/lib/roomDesign.ts');
const { roomTemplateOutline } = loadSource('src/lib/roomPolygon.ts');
const piece = (id, x = 0, z = 0, w = 1, d = 1, h = 1) => ({ instanceId:id, productId:id, x,z,rotation:0,color:'#fff',material:'wood',details:{name:id,dimensions:{w,d,h}} });
const room = (id, pieces = [], x = 0) => ({id,name:id,type:'living',width:5,depth:4,height:2.7,position:{x,z:0},pieces,wallColor:'#fff',floorColor:'#ccc'});
const design = rooms => syncDesignRooms({id:'design',name:'Test',size:'40',createdAt:1,updatedAt:1,...rooms[0],id:'design',rooms,activeRoomId:rooms[0].id,connections:[]});

test('overlap is permitted only by the room planner policy; walls, columns and ceilings stay hard limits', () => {
  const a=piece('a'), b=piece('b',.2), ctx=roomPlacementContext(design([room('r',[a,b])]));
  assert.equal(collision.isPlacementValid(b,[a],ctx.room),true);
  assert.equal(collision.isPlacementValid(b,[a],{...ctx.room,allowFurnitureOverlap:false}),false);
  assert.equal(collision.isPlacementValid({...b,x:2.3},[a],ctx.room),false);
  assert.equal(collision.isPlacementValid({...b,elevation:2},[a],ctx.room),false);
  const column=roomPlacementContext(design([{...room('r'),columns:[{id:'column',x:2.3,z:1.8,width:.4,depth:.4}]}]));
  assert.equal(collision.isPlacementValid(a,[],column.room),false);
  const concave={width:5,depth:4,height:2.7,outline:roomTemplateOutline('u',5,4),allowFurnitureOverlap:true};
  assert.equal(collision.isPlacementValid({...a,z:1.8},[b],concave),false);
});

test('rotated footprints warn once, edge contact and separate heights do not warn', () => {
  const a=piece('a'),b={...piece('b',.5),rotation:Math.PI/4};
  assert.equal(roomPlacementWarnings(design([room('r',[a,b])])).length,1);
  assert.equal(roomPlacementWarnings(design([room('r',[a,piece('edge',1)])])).length,0);
  assert.equal(roomPlacementWarnings(design([room('r',[a,{...piece('top'),elevation:1}])])).length,0);
  assert.equal(roomPlacementWarnings(design([room('r',[a,{...piece('near'),elevation:.9}])])).length,1);
});

test('warnings use world coordinates and the latest active-room pieces', () => {
  const initial=design([room('left',[piece('a',2)]),room('right',[piece('b',-2)],4)]);
  const warnings=roomPlacementWarnings(initial);
  assert.equal(warnings.length,1);
  assert.deepEqual(warnings[0].items.map(item=>item.roomId),['left','right']);
  assert.equal(roomPlacementWarnings({...initial,pieces:[piece('a',0)]}).length,0);
  assert.equal(roomPlacementWarnings({...initial,pieces:[]}).length,0);
});

test('new furniture first uses empty space, then overlaps if only occupied interior remains', () => {
  const shape={width:2,depth:2,height:2.7,allowFurnitureOverlap:true};
  const added=piece('new',0,0,.5,.5), existing=piece('existing',0,0,.5,.5);
  const free=collision.findFreePlacement(added,[existing],shape);
  assert.ok(free);assert.equal(collision.furnitureOverlaps(free,existing),false);
  const full=piece('full',0,0,2,2);
  const overlap=collision.findFreePlacement(added,[full],shape);
  assert.ok(overlap);assert.equal(collision.furnitureOverlaps(overlap,full),true);
  assert.equal(collision.findFreePlacement(piece('too-big',0,0,3,3),[full],shape),null);
});

test('store commits overlap, rejects out-of-room moves atomically, and undo/redo updates warnings', () => {
  const {useDesigns:store}=loadSource('src/store/designs.ts',mocks);
  store.setState({current:design([room('r',[piece('a',-1),piece('b',1)])]),past:[],future:[],transaction:null});
  store.getState().updatePieces([piece('a'),piece('b',.2)]);
  assert.equal(roomPlacementWarnings(store.getState().current).length,1);
  const accepted=store.getState().current,history=store.getState().past.length;
  store.getState().updatePieces([piece('a'),piece('b',20)]);
  assert.equal(store.getState().current,accepted);assert.equal(store.getState().past.length,history);
  store.getState().undo();assert.equal(roomPlacementWarnings(store.getState().current).length,0);
  store.getState().redo();assert.equal(roomPlacementWarnings(store.getState().current).length,1);
  store.getState().updatePieces([piece('a')]);assert.equal(roomPlacementWarnings(store.getState().current).length,0);
});

test('warning popup opens from question button, focuses furniture and preserves the help action', () => {
  const React=require('react');
  let open=false,selected=null,help=0;
  const {RoomPlacementHelp}=loadSource('src/features/room-planner/components/RoomPlacementHelp.tsx',{
    react:{...React,useState:()=>[open,v=>{open=typeof v==='function'?v(open):v;}],useRef:()=>({current:null}),useId:()=> 'warnings',useEffect:()=>{}},
  });
  const walk=node=>!node||typeof node!=='object'?[]:[node,...React.Children.toArray(node.props?.children).flatMap(walk)];
  const warnings=roomPlacementWarnings(design([room('r',[piece('a'),piece('b')])]));
  const render=()=>RoomPlacementHelp({warnings,onSelect:item=>{selected=item;},onHelp:()=>{help++;}});
  let tree=walk(render()),trigger=tree.find(n=>n.props?.['aria-haspopup']==='dialog');
  assert.equal(trigger.props['aria-expanded'],false);assert.equal(tree.some(n=>n.props?.role==='dialog'),false);
  trigger.props.onClick();tree=walk(render());assert.equal(tree.some(n=>n.props?.role==='dialog'),true);
  tree.find(n=>n.type==='li').props.children[1][0].props.onClick();
  assert.equal(selected.id,'a');assert.equal(open,false);
  open=true;tree=walk(render());tree.find(n=>n.props?.className==='room-placement-guide').props.onClick();
  assert.equal(help,1);assert.equal(open,false);
});
