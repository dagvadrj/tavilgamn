const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { loadSource } = require('./helpers/load-source.cjs');
test('water and power drag to walls, flush final touch position, and cancel without saving', () => {
  for (const kind of ['water', 'power']) {
    const { KitchenRoomDraft } = loadSource('src/features/kitchen-planner/components/KitchenRoomDraft.tsx', {
      react: { ...React, useRef: value => ({ current: value }), useState: value => [value, () => {}] },
    });
    const commits = [];
    const room = { width: 4000, depth: 3000, height: 2600, items: [{ id: kind, kind, wall: 'back', x: 1000, z: 0, width: 100, depth: 100 }] };
    const tree = KitchenRoomDraft({ room, wall: null, selectedItem: null, disabled: false, onWall() {}, onItem() {}, onClear() {}, onRoomChange: next => commits.push(next) });
    function nodes(node) { return !React.isValidElement(node) ? [] : [node, ...React.Children.toArray(node.props.children).flatMap(nodes)]; }
    const marker = nodes(tree).find(n => n.props.onPointerDown);
    let captured = false;
    const svg = { getScreenCTM: () => ({ inverse: () => ({}) }), createSVGPoint: () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x, y: this.y }; } }), setPointerCapture() { captured = true; }, hasPointerCapture: () => captured, releasePointerCapture() { captured = false; } };
    const event = { button: 0, pointerId: 7, pointerType: 'touch', clientX: 1000, clientY: 280, currentTarget: { ownerSVGElement: svg }, stopPropagation() {}, preventDefault() {} };
    marker.props.onPointerDown(event);
    const move = { ...event, currentTarget: svg, clientX: 3900, clientY: 1800 };
    tree.props.onPointerMove(move);
    assert.equal(commits.length, 0);
    tree.props.onPointerUp({ ...move, clientY: 2000 });
    assert.equal(commits.length, 1);
    assert.deepEqual(commits[0].items[0], { ...room.items[0], wall: 'right', x: 4000, z: 1720 });
    assert.equal(captured, false);
    marker.props.onPointerDown(event);
    tree.props.onPointerCancel(move);
    assert.equal(commits.length, 1);
  }
});
