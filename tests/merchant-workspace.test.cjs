const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { loadSource } = require('./helpers/load-source.cjs');
const nodes = tree => React.isValidElement(tree) ? [tree, ...React.Children.toArray(tree.props.children).flatMap(nodes)] : [];

function formHarness() {
  let slots = [], cursor = 0, loading = false;
  const calls = [], clears = [];
  const react = { ...React, useEffect() {}, useState(initial) {
    const i = cursor++;
    if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial;
    return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }];
  } };
  const mocks = {
    react,
    '@/hooks/useDashboardDraft': { useDraftState: (_scope, _field, initial) => react.useState(initial), useDraftStatus: () => ({ loading }), clearDashboardDraft: async (...args) => { clears.push(args); } },
    '@/features/merchant/merchantApi': { isOwner: () => true, merchantRequest: async (...args) => { calls.push(args); return { store: { id: 'store' } }; } },
  };
  return { mocks, calls, clears, setLoading(v) { loading = v; }, render(fn) { cursor = 0; return fn(); } };
}

test('grouped product form preserves controlled dimensions, stock version and save/cancel behavior', async () => {
  const h = formHarness();
  const { blankProduct } = loadSource('src/features/merchant/merchantApi.ts');
  const product = { ...blankProduct(), id: '11111111-1111-4111-8111-111111111111', name: 'Luna', image: 'https://images.unsplash.com/photo-1', stockQuantity: 8 };
  const { MerchantProductEditor } = loadSource('src/features/merchant/MerchantProductEditor.tsx', h.mocks);
  let saved = 0, closed = 0;
  const render = () => h.render(() => MerchantProductEditor({ owner: 'owner', product, create: false, close() { closed++; }, onSave() { saved++; } }));
  let tree = render();
  const label = text => nodes(tree).find(n => n.type === 'label' && React.Children.toArray(n.props.children).some(c => typeof c === 'string' && c.includes(text)));
  nodes(label('Өргөн')).find(n => n.type === 'input').props.onChange({ target: { valueAsNumber: 2150 } });
  nodes(label('Нөөцийн үлдэгдэл')).find(n => n.type === 'input').props.onChange({ target: { valueAsNumber: 12 } });
  tree = render();
  await tree.props.onSubmit({ preventDefault() {} });
  assert.equal(h.calls.length, 1);
  const payload = JSON.parse(h.calls[0][2].body);
  assert.equal(h.calls[0][1], 'owner');
  assert.equal(h.calls[0][2].method, 'PUT');
  assert.equal(payload.dimensions.w, 2.15);
  assert.equal(payload.stockQuantity, 12);
  assert.equal(payload.expectedStockQuantity, 8);
  assert.equal(saved, 1);
  nodes(tree).find(n => n.type === 'button' && n.props.children === 'Болих').props.onClick();
  assert.equal(closed, 1);
  assert.equal(h.calls.length, 1, 'Cancel must not submit a product');
});

test('sticky form action stays disabled while a restored draft is loading and submit does not write', async () => {
  const h = formHarness(); h.setLoading(true);
  const { StoreProfile } = loadSource('src/features/merchant/StoreProfile.tsx', h.mocks);
  const tree = h.render(() => StoreProfile({ owner: 'owner', store: null, onSave() { throw Error('Unexpected save'); } }));
  const buttons = nodes(tree).filter(n => n.type === 'button');
  assert.equal(buttons.length, 2);
  assert.ok(buttons.every(n => n.props.disabled));
  await tree.props.onSubmit({ preventDefault() {} });
  assert.equal(h.calls.length, 0);
});

test('store cancel clears its own draft without a server write; grouped categories still validate', async () => {
  const h = formHarness();
  const { StoreProfile } = loadSource('src/features/merchant/StoreProfile.tsx', h.mocks);
  const render = () => h.render(() => StoreProfile({ owner: 'owner', store: null, onSave() {} }));
  let tree = render();
  nodes(tree).find(n => n.type === 'button' && n.props.children === 'Болих').props.onClick();
  assert.deepEqual(h.clears, [['merchant:owner:store']]);
  await tree.props.onSubmit({ preventDefault() {} });
  assert.equal(h.calls.length, 0);
  tree = render();
  assert.match(nodes(tree).find(n => n.props.role === 'alert').props.children, /ангилал/);
});
