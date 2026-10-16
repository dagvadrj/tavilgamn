const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { loadSource } = require('./helpers/load-source.cjs');
const { createUnifiedKitchen } = loadSource('src/lib/kitchenAssembly.ts');
function nodes(node) { return !React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(nodes)]; }
test('room canvas starts without a sidebar, opens settings on demand, and pans without editing', () => {
  const state = [], refs = []; let cursor = 0, refCursor = 0, commits = 0;
  const { KitchenSpaceEditor } = loadSource('src/features/kitchen-planner/components/KitchenSpaceEditor.tsx', {
    react: { ...React, useEffect() {}, useState(initial) { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; }, useRef(initial) { return refs[refCursor++] ?? (refs[refCursor - 1] = { current: initial }); } },
  });
  const kitchen = createUnifiedKitchen();
  const render = () => { cursor = 0; refCursor = 0; return nodes(KitchenSpaceEditor({ kitchen, disabled: false, onChange() { commits++; return true; }, onClose() {}, onReview() {}, onSelectCabinet() {} })); };
  let tree = render();
  assert.equal(tree.find(n => n.props.id === 'kroom-settings').props.hidden, true);
  tree.find(n => n.props['aria-controls'] === 'kroom-settings').props.onClick();
  tree = render();
  assert.equal(tree.find(n => n.props.id === 'kroom-settings').props.hidden, false);
  tree.find(n => n.props.className === 'kroom-drawer-heading').props.children[1].props.onClick();
  tree = render();
  assert.equal(tree.find(n => n.props.id === 'kroom-settings').props.hidden, true);
  const controls = tree.find(n => n.props.className === 'kroom-view-controls');
  React.Children.toArray(controls.props.children)[1].props.onClick();
  tree = render();
  const canvas = tree.find(n => n.props.className === 'kroom-plan-card is-panning');
  let captured = false;
  const target = { scrollLeft: 300, scrollTop: 200, setPointerCapture() { captured = true; }, hasPointerCapture: () => captured, releasePointerCapture() { captured = false; } };
  const event = { button: 0, pointerId: 1, clientX: 100, clientY: 100, currentTarget: target, stopPropagation() {}, preventDefault() {} };
  canvas.props.onPointerDownCapture(event);
  canvas.props.onPointerMove({ ...event, clientX: 150, clientY: 120 });
  assert.equal(target.scrollLeft, 250); assert.equal(target.scrollTop, 180);
  canvas.props.onPointerUp(event);
  assert.equal(captured, false); assert.equal(commits, 0);
});
