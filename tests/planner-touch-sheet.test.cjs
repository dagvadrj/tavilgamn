const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');

test('sheet grip supports click, drag, cancel and collapsing before dismissal', () => {
  const expanded = [], closed = [];
  const { PlannerSheetGrip } = loadSource('src/features/planner/components/PlannerSheetGrip.tsx', {
    react: { useRef: value => ({ current: value }) },
  });
  const props = value => PlannerSheetGrip({ expanded: value, onExpand: value => expanded.push(value), onClose: () => closed.push(true) }).props;
  const event = y => ({clientY:y,pointerId:1,currentTarget:{setPointerCapture(){}}});
  let h = props(false);
  h.onClick(); assert.deepEqual(expanded, [true]); expanded.length = 0;
  h.onPointerDown(event(150)); h.onPointerUp(event(50)); h.onClick();
  assert.deepEqual(expanded, [true]); assert.equal(closed.length, 0); expanded.length = 0;
  h = props(true); h.onPointerDown(event(50)); h.onPointerUp(event(150)); h.onClick();
  assert.deepEqual(expanded, [false]); assert.equal(closed.length, 0);
  h = props(false); h.onPointerDown(event(50)); h.onPointerUp(event(150)); h.onClick();
  assert.equal(closed.length, 1);
  h.onPointerDown(event(50)); h.onPointerCancel(); h.onPointerUp(event(160)); h.onClick();
  assert.equal(closed.length, 1);
});

test('planner viewport follows the visible keyboard area and releases listeners on unmount', () => {
  const previous = global.window;
  const values = new Map(); let effect;
  const root = {style:{setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)}};
  const viewport = Object.assign(new EventTarget(), {height:844,offsetTop:0});
  global.window = Object.assign(new EventTarget(), {innerHeight:844,visualViewport:viewport});
  const {PlannerViewport} = loadSource('src/features/planner/components/PlannerViewport.tsx', {
    react:{useRef:()=>({current:{closest:()=>root}}),useEffect:fn=>{effect=fn;}},
  });
  try {
    PlannerViewport(); const cleanup=effect();
    assert.equal(values.get('--planner-visible-height'),'844px');
    viewport.height=500; viewport.dispatchEvent(new Event('resize'));
    assert.equal(values.get('--planner-visible-height'),'500px');
    assert.equal(values.get('--planner-keyboard-offset'),'344px');
    viewport.offsetTop=20;viewport.dispatchEvent(new Event('scroll'));
    assert.equal(values.get('--planner-keyboard-offset'),'324px');
    cleanup();viewport.dispatchEvent(new Event('resize'));
    assert.equal(values.size,0);
  } finally {global.window=previous;}
});
