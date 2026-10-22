const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { loadSource } = require('./helpers/load-source.cjs');
const layoutModule = loadSource('src/features/merchant/dashboardLayout.ts');
const { defaultMerchantLayout, parseMerchantLayout, merchantLayoutKey, moveVisibleCards } = layoutModule;
const nodes = tree => React.isValidElement(tree) ? [tree, ...React.Children.toArray(tree.props.children).flatMap(nodes)] : [];

test('dashboard layouts repair corrupt, stale, unknown and duplicate cards without losing real widgets', () => {
  for (const raw of [null, 'broken', 'null', '[]', '{}', '{"version":99}']) assert.deepEqual(parseMerchantLayout(raw), defaultMerchantLayout());
  assert.deepEqual(parseMerchantLayout(JSON.stringify({ version: 1, kpis: ['orders', 'unknown', 'orders', null], widgets: ['order-progress', 'category-chart', 'inventory-control', 'category-chart'] })), {
    version: 1, kpis: ['orders', 'revenue', 'inventory-val', 'stock-alert'], widgets: ['order-progress', 'category-chart', 'inventory-control'],
  });
  assert.deepEqual(parseMerchantLayout('{"version":1,"kpis":false,"widgets":{}}'), defaultMerchantLayout());
});

test('reordering stays within each zone and preserves cards hidden by the current overview mode', () => {
  const { kpis, widgets } = defaultMerchantLayout();
  for (const [active, over] of [['revenue', 'category-chart'], ['unknown', 'orders'], ['orders', 'orders']]) assert.equal(moveVisibleCards(kpis, kpis, active, over), kpis);
  assert.deepEqual(moveVisibleCards(kpis, ['inventory-val', 'stock-alert'], 'stock-alert', 'inventory-val'), ['revenue', 'orders', 'stock-alert', 'inventory-val']);
  assert.deepEqual(moveVisibleCards(widgets, widgets, 'order-progress', 'inventory-control'), ['order-progress', 'inventory-control', 'category-chart']);
  assert.deepEqual(widgets, ['inventory-control', 'category-chart', 'order-progress'], 'reordering never mutates stored defaults');
  assert.notEqual(merchantLayoutKey('user:one', 'store'), merchantLayoutKey('user', 'one:store'));
  assert.notEqual(merchantLayoutKey('user-a', 'store'), merchantLayoutKey('user-b', 'store'));
});

function storageHarness(t) {
  const previous = global.window, values = new Map(), writes = [];
  let denied = false, slots = [], cursor = 0, pending = [], dirty = false;
  const storage = {
    getItem(key) { if (denied) throw Error('Storage blocked'); return values.get(key) ?? null; },
    setItem(key, value) { if (denied) throw Error('Storage blocked'); writes.push(key); values.set(key, value); },
  };
  global.window = Object.assign(new EventTarget(), { localStorage: storage });
  const { useMerchantDashboardLayout } = loadSource('src/features/merchant/useMerchantDashboardLayout.ts', {
    react: { useState(initial) {
      const at = cursor++; if (!(at in slots)) slots[at] = { value: initial };
      return [slots[at].value, next => { slots[at].value = typeof next === 'function' ? next(slots[at].value) : next; dirty = true; }];
    }, useEffect(fn, deps) {
      const at = cursor++, old = slots[at];
      if (!old || deps.some((value, index) => value !== old.deps[index])) {
        slots[at] = { deps }; pending.push(() => { old?.cleanup?.(); slots[at].cleanup = fn(); });
      }
    } },
  });
  const reset = () => { slots.forEach(slot => slot.cleanup?.()); slots = []; };
  t.after(() => { reset(); if (previous === undefined) delete global.window; else global.window = previous; });
  return { values, writes, reset, block: value => { denied = value; },
    render(owner = 'owner-a', store = 'store') {
      let first;
      for (let i = 0; i < 5; i++) {
        cursor = 0; pending = []; dirty = false;
        const result = useMerchantDashboardLayout(owner, store); first ??= result;
        pending.forEach(effect => effect()); if (!dirty) return { ...result, first };
      }
      throw Error('Unstable hook');
    },
    sync(key, storageArea = storage) { window.dispatchEvent(Object.assign(new Event('storage'), { key, storageArea })); },
  };
}

test('layouts persist across refresh, reset, and remain isolated by merchant and store without writing during hydration', t => {
  const h = storageHarness(t), next = defaultMerchantLayout(); next.kpis.reverse(); next.widgets.reverse();
  let state = h.render(); assert.equal(state.first.ready, false); assert.equal(h.writes.length, 0);
  state.save(next); h.reset(); state = h.render(); assert.deepEqual(state.layout, next);
  const oldSave = state.save;
  state = h.render('owner-b'); assert.deepEqual(state.first.layout, defaultMerchantLayout()); assert.deepEqual(state.layout, defaultMerchantLayout());
  oldSave(next); assert.equal(h.render('owner-b').ready, true, 'a stale save cannot replace the new owner state');
  assert.deepEqual(h.render('owner-a', 'another-store').layout, defaultMerchantLayout());
  state = h.render(); state.reset(); h.reset(); assert.deepEqual(h.render().layout, defaultMerchantLayout());
});

test('failed storage keeps the working layout and supports retry without a false saved status', t => {
  const h = storageHarness(t); let state = h.render(); const next = defaultMerchantLayout(); next.widgets.reverse();
  h.block(true); state.save(next); state = h.render();
  assert.equal(state.status, 'error'); assert.deepEqual(state.layout, next);
  h.block(false); state.save(state.layout); h.reset(); state = h.render(); assert.deepEqual(state.layout, next);
  h.block(true); h.reset(); state = h.render(); assert.equal(state.status, 'error'); assert.equal(state.ready, true);
});

test('another tab updates only the matching storage scope; invalid JSON recovers safely', t => {
  const h = storageHarness(t); h.values.set(merchantLayoutKey('owner-a', 'store'), '{broken');
  assert.deepEqual(h.render().layout, defaultMerchantLayout()); assert.equal(h.writes.length, 0);
  const next = defaultMerchantLayout(); next.kpis.reverse();
  h.values.set(merchantLayoutKey('owner-a', 'store'), JSON.stringify(next));
  h.sync('unrelated'); assert.deepEqual(h.render().layout, defaultMerchantLayout());
  h.sync(merchantLayoutKey('owner-a', 'store'), {}); assert.deepEqual(h.render().layout, defaultMerchantLayout());
  h.sync(merchantLayoutKey('owner-a', 'store')); assert.deepEqual(h.render().layout, next);
  h.values.clear(); h.sync(null); assert.deepEqual(h.render().layout, defaultMerchantLayout());
});

test('dragging is opt-in, uses handles and keyboard sensors, cancels safely and keeps separate regions', () => {
  let layout = defaultMerchantLayout(), editing = false, active = null; const saves = [], sortableOptions = [];
  const { MerchantDashboardLayout } = loadSource('src/features/merchant/MerchantDashboardLayout.tsx', {
    react: { ...React, useId: () => 'test-context', useState: () => [active, next => { active = next; }] },
    '@dnd-kit/core': { DndContext: 'dnd', DragOverlay: 'overlay', PointerSensor: 'pointer', KeyboardSensor: 'keyboard', closestCenter() {}, useSensor: (sensor, options) => ({ sensor, options }), useSensors: (...sensors) => sensors },
    '@dnd-kit/sortable': { SortableContext: 'sortable', rectSortingStrategy() {}, sortableKeyboardCoordinates() {}, useSortable: options => { sortableOptions.push(options); return { attributes: { role: 'button', tabIndex: 0 }, listeners: { onPointerDown() {}, onKeyDown() {} }, setNodeRef() {}, setActivatorNodeRef() {}, transform: null }; } },
    './useMerchantDashboardLayout': { useMerchantDashboardLayout: () => ({ layout, ready: true, status: 'ready', save: next => { saves.push(next); layout = next; }, reset() {} }) },
  });
  const action = () => {};
  const props = { owner: 'owner', storeId: 'store', editing, onEditingChange: value => { editing = value; },
    kpis: { revenue: React.createElement('button', { onClick: action }, 'Revenue'), orders: React.createElement('article', null, 'Orders') },
    widgets: { 'inventory-control': React.createElement('article', null, 'Inventory'), 'category-chart': React.createElement('article', null, 'Categories'), 'order-progress': React.createElement('article', null, 'Progress') },
  };
  const render = () => MerchantDashboardLayout({ ...props, editing });
  const regions = () => nodes(render()).filter(node => typeof node.type === 'function' && node.type.name === 'SortableRegion');
  let region = regions()[0], context = region.type(region.props);
  context.props.onDragEnd({ active: { id: 'revenue' }, over: { id: 'orders' } }); assert.equal(saves.length, 0);
  nodes(render()).find(node => node.props['aria-pressed'] === false).props.onClick(); assert.equal(editing, true);
  region = regions()[0]; context = region.type(region.props);
  assert.equal(context.props.sensors[0].options.activationConstraint.distance, 5); assert.equal(context.props.sensors[1].sensor, 'keyboard');
  const sortableCard = nodes(context).find(node => typeof node.type === 'function' && node.type.name === 'SortableCard');
  const card = sortableCard.type(sortableCard.props);
  assert.equal(card.props.onPointerDown, undefined, 'the card itself must not intercept buttons or text selection');
  assert.ok(nodes(card).find(node => node.props.className === 'merchant-drag-handle').props.onKeyDown);
  assert.equal(nodes(card).find(node => node.props.children === 'Revenue').props.onClick, action);
  context.props.onDragStart({ active: { id: 'revenue' } }); assert.equal(active, 'revenue');
  let dragging = region.type(region.props); assert.ok(nodes(dragging).some(node => node.props.inert === true));
  dragging.props.onDragCancel(); assert.equal(active, null); assert.equal(saves.length, 0);
  context.props.onDragEnd({ active: { id: 'revenue' }, over: null }); assert.equal(saves.length, 0);
  context.props.onDragEnd({ active: { id: 'revenue' }, over: { id: 'category-chart' } }); assert.equal(saves.length, 0);
  context.props.onDragEnd({ active: { id: 'orders' }, over: { id: 'revenue' } }); assert.deepEqual(layout.kpis, ['orders', 'revenue', 'inventory-val', 'stock-alert']);
  const widgets = regions()[1]; widgets.type(widgets.props).props.onDragEnd({ active: { id: 'order-progress' }, over: { id: 'inventory-control' } });
  assert.deepEqual(layout.widgets, ['order-progress', 'inventory-control', 'category-chart']);
  assert.equal(sortableOptions[0].disabled, false);
});
