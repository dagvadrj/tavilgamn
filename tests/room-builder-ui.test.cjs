const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { loadSource } = require('./helpers/load-source.cjs');

function elements(tree, predicate) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(node => elements(node,predicate));
  return [...(predicate(tree) ? [tree] : []), ...elements(tree.props?.children,predicate)];
}
const content = tree => typeof tree === 'boolean' ? '' : Array.isArray(tree) ? tree.map(content).join('') : typeof tree === 'object' && tree ? content(tree.props?.children) : tree ?? '';
function harness(extra = {}) {
  const states=[],refs=[];let cursor=0,refCursor=0;
  const calls=[], props={initial:{width:5,depth:4,height:2.7,wallColor:'#123456'},onCancel:()=>calls.push('cancel'),onComplete:draft=>{calls.push(draft);return null;},...extra};
  const Canvas = () => null, OpeningEditor = () => null;
  const WallPlan = () => null, DimensionSidebar = () => null;
  const { RoomBuilder } = loadSource('src/features/room-planner/components/RoomBuilder.tsx',{
    react:{...React,useState:initial=>{const i=cursor++;if(!(i in states)) states[i]=typeof initial==='function'?initial():initial;return[states[i],value=>{states[i]=typeof value==='function'?value(states[i]):value;}];},useRef:value=>refs[refCursor++]??(refs[refCursor-1]={current:value}),useEffect(){},useMemo:fn=>fn(),useCallback:fn=>fn},
    'next/dynamic':{default:()=>Canvas},
    './OpeningQuickEditor':{OpeningQuickEditor:OpeningEditor},
    './RoomWallPlan':{RoomWallPlan:WallPlan},
    './RoomDimensionSidebar':{RoomDimensionSidebar:DimensionSidebar},
  });
  const render=()=>{cursor=0;refCursor=0;return RoomBuilder(props);};
  return {render,calls,Canvas,OpeningEditor,WallPlan,DimensionSidebar};
}
const buttons=tree=>elements(tree,node=>node.type==='button');
const next=tree=>buttons(tree).find(node=>node.props.className==='room-builder-next');
const byText=(tree,text)=>buttons(tree).find(node=>content(node).trim()===text);

test('wizard exposes one heading, six choices and sequential steps; back retains selection',()=>{
  const h=harness();let tree=h.render();
  assert.equal(elements(tree,n=>n.type==='h2').length,1);
  const choices=elements(tree,n=>n.props?.className==='room-builder-templates')[0];
  assert.equal(buttons(choices).length,6);
  const steps=elements(tree,n=>n.props?.className==='room-builder-steps')[0];
  assert.deepEqual(buttons(steps).map(b=>b.props.disabled),[false,true,true,true]);
  byText(tree,'U хэлбэр').props.onClick();tree=h.render();
  assert.equal(byText(tree,'U хэлбэр').props['aria-pressed'],true);
  next(tree).props.onClick();tree=h.render();
  assert.ok(content(elements(tree,n=>n.type==='h2')[0]).includes('хэмжээгээ'));
  assert.equal(elements(tree,n=>n.type==='details').length,0);
  assert.equal(elements(tree,n=>n.type==='input'||n.type==='select').length,0);
  assert.equal(elements(tree,n=>n.type===h.DimensionSidebar).length,1);
  assert.equal(elements(tree,n=>n.type===h.WallPlan).length,1);
  byText(tree,'Буцах').props.onClick();tree=h.render();
  assert.equal(byText(tree,'U хэлбэр').props['aria-pressed'],true);
  assert.equal(h.calls.length,0);
});

test('UI survives undo from the last wall of U shape and keeps the selected wall in range',()=>{
  const h=harness();let tree=h.render();byText(tree,'U хэлбэр').props.onClick();tree=h.render();next(tree).props.onClick();tree=h.render();
  const wall=elements(tree,n=>n.type===h.WallPlan)[0];
  wall.props.onSelect(7);tree=h.render();
  elements(tree,n=>n.type===h.WallPlan)[0].props.onUndo();tree=h.render();
  const after=elements(tree,n=>n.type===h.WallPlan)[0];
  assert.equal(after.props.selected,3);
  assert.equal(after.props.draft.outline.length,4);
});

test('finish reads the latest color even before rerender and an apply error permits retry',()=>{
  let attempts=0;const submitted=[];
  const h=harness({onComplete:draft=>{submitted.push(draft);return ++attempts===1?'Тавилгын байрлалыг шалгана уу.':null;}});
  let tree=h.render();for(let i=0;i<3;i++){next(tree).props.onClick();tree=h.render();}
  const finish=next(tree), color=elements(tree,n=>n.type==='input'&&n.props.type==='color')[0];
  color.props.onFocus();color.props.onChange({target:{value:'#445566'}});
  finish.props.onClick();tree=h.render();
  assert.equal(submitted[0].wallColor,'#445566');
  assert.ok(elements(tree,n=>n.props?.role==='alert').some(n=>content(n).includes('Тавилгын')));
  next(tree).props.onClick();
  assert.equal(attempts,2);assert.equal(submitted[1].wallColor,'#445566');
});

test('opening choices expose only the selected kind and one editor; a canvas drag undoes once',()=>{
  const h=harness();let tree=h.render();for(let i=0;i<2;i++){next(tree).props.onClick();tree=h.render();}
  byText(tree,'Цонх').props.onClick();tree=h.render();
  const choices=elements(tree,n=>n.props?.className==='room-builder-opening-choices')[0];
  assert.ok(buttons(choices).every(n=>content(n).includes('цонх')||content(n).includes('Цонх')));
  buttons(choices)[0].props.onClick();tree=h.render();
  assert.equal(elements(tree,n=>n.type===h.OpeningEditor).length,1);
  const canvas=elements(tree,n=>n.type===h.Canvas)[0], opening=canvas.props.design.openings[0];
  canvas.props.onEditStart();
  canvas.props.onUpdateOpening({...opening,position:.4});
  canvas.props.onUpdateOpening({...opening,position:.45});
  canvas.props.onEditEnd();tree=h.render();
  buttons(tree).find(n=>n.props['aria-label']==='Үйлдэл буцаах').props.onClick();tree=h.render();
  assert.equal(elements(tree,n=>n.type===h.Canvas)[0].props.design.openings[0].position,opening.position);
});

test('cancel never submits the local draft',()=>{
  const h=harness();let tree=h.render();byText(tree,'L хэлбэр').props.onClick();tree=h.render();
  buttons(tree).find(n=>n.props['aria-label']==='Өрөө байгуулахыг болих').props.onClick();
  assert.deepEqual(h.calls,['cancel']);
});
