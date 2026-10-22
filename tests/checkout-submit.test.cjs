const test = require('node:test');
const assert = require('node:assert/strict');
const React = require('react');
const { loadSource } = require('./helpers/load-source.cjs');

function hooks() {
  let slots = [], cursor = 0, pending = [], dirty = false;
  return {
    react: {
      ...React,
      useState(initial) {
        const at = cursor++;
        if (!slots[at]) slots[at] = { value: typeof initial === 'function' ? initial() : initial };
        return [slots[at].value, value => { slots[at].value = typeof value === 'function' ? value(slots[at].value) : value; dirty = true; }];
      },
      useRef(initial) { const at = cursor++; return slots[at] ??= { current: initial }; },
      useEffect(fn, deps) {
        const at = cursor++, old = slots[at];
        if (!old || deps.some((value, index) => !Object.is(value, old.deps[index]))) {
          slots[at] = { deps };
          pending.push(() => { old?.cleanup?.(); slots[at].cleanup = fn(); });
        }
      },
    },
    render(fn) {
      for (let i = 0; i < 8; i++) {
        cursor = 0; pending = []; dirty = false;
        const result = fn(); pending.forEach(effect => effect());
        if (!dirty) return result;
      }
      throw Error('Unstable component');
    },
    reset() { slots.forEach(slot => slot.cleanup?.()); slots = []; },
  };
}
function nodes(tree) {
  return tree && typeof tree === 'object' ? [tree, ...React.Children.toArray(tree.props?.children).flatMap(nodes)] : [];
}
function checkout(t) {
  const runtime = hooks(), requests = [], pushes = [];
  let auth = { initialized: true, user: { id: 'user-a' } };
  let cart = { items: [{ id: 'line', productId: 'chair', color: 'oak', material: 'wood', qty: 1 }] };
  let quote = { items: [], subtotal: 100, shipping: 0, total: 100 }, quoteLoading = false, retries = 0;
  const storage = new Map(), previous = global.sessionStorage;
  global.sessionStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) };
  t.after(() => { runtime.reset(); if (previous === undefined) delete global.sessionStorage; else global.sessionStorage = previous; });
  const useAuth = Object.assign(select => select(auth), { getState: () => auth });
  const useCart = Object.assign(select => select(cart), { setState: update => { cart = { ...cart, ...update(cart) }; } });
  const Page = loadSource('src/app/(shop)/checkout/page.tsx', {
    react: runtime.react,
    'next/navigation': { useRouter: () => ({ push: path => pushes.push(path) }) },
    'next/link': { default: 'a' },
    '@/store/auth': { useAuth }, '@/store/cart': { useCart },
    '@/store/catalog': { useCatalogStore: { getState: () => ({ refresh: async () => {} }) } },
    '@/lib/authFetch': { authFetch: (url, options, owner) => new Promise((resolve, reject) => requests.push({ url, body: JSON.parse(options.body), owner, resolve, reject })) },
    '@/components/useCheckoutQuote': { useCheckoutQuote: () => ({ quote, loading: quoteLoading, error: null,
      acceptPriceChange: value => { quote = value; }, retryQuote: () => { retries++; quote = null; quoteLoading = true; } }) },
  }).default;
  let key, tree;
  const render = () => {
    const root = Page();
    if (root.key !== key) { runtime.reset(); key = root.key; }
    tree = runtime.render(() => typeof root.type === 'function' ? root.type(root.props) : root);
    return tree;
  };
  const submit = () => nodes(render()).find(node => node.type === 'form').props.onSubmit({ preventDefault() {} });
  const fill = () => {
    for (const [autoComplete, value] of [['name', 'Test Buyer'], ['tel', '99112233'], ['street-address', 'Test address building 1']]) {
      nodes(render()).find(node => node.props?.autoComplete === autoComplete).props.onChange({ target: { value } });
    }
    render();
  };
  return { render, fill, submit, requests, pushes, storage, nodes: () => nodes(render()),
    remount: () => { runtime.reset(); key = undefined; },
    switchOwner: id => { auth = { ...auth, user: { id } }; },
    setQuote: value => { quote = value; quoteLoading = !value; },
    addQuantity: qty => { cart.items = [{ ...cart.items[0], qty }]; },
    get cart() { return cart; }, get retries() { return retries; },
  };
}
const response = (request, data, status = 200) => request.resolve(new Response(JSON.stringify(data), { status }));

test('checkout blocks missing quotes and duplicate clicks; success removes only submitted quantities', async t => {
  const h = checkout(t); h.fill(); h.setQuote(null); await h.submit(); assert.equal(h.requests.length, 0);
  h.setQuote({ items: [], subtotal: 100, shipping: 0, total: 100 });
  const pending = h.submit(); await h.submit();
  assert.equal(h.requests.length, 1); assert.equal(h.requests[0].body.expectedTotal, 100);
  h.addQuantity(3); response(h.requests[0], { id: 'order-1' }, 201); await pending;
  assert.equal(h.cart.items[0].qty, 2); assert.deepEqual(h.pushes, ['/orders/order-1']);
  assert.equal(h.storage.size, 0);
});

test('uncertain network failures reuse the same order key, including after a page remount', async t => {
  const h = checkout(t); h.fill(); const pending = h.submit();
  h.requests[0].reject(new Error('Connection lost')); await pending;
  const first = h.requests[0].body;
  h.remount(); h.setQuote({ items: [], subtotal: 125, shipping: 0, total: 125 }); h.fill(); const retry = h.submit();
  assert.deepEqual(h.requests[1].body, first);
  response(h.requests[1], { id: 'existing-order' }); await retry;
  assert.deepEqual(h.pushes, ['/orders/existing-order']); assert.equal(h.cart.items.length, 0);
});

test('a changed price needs a separate confirmation click and submits the newly shown total', async t => {
  const h = checkout(t); h.fill(); const pending = h.submit();
  response(h.requests[0], { code: 'PRICE_CHANGED', quote: { items: [], subtotal: 125, shipping: 0, total: 125 } }, 409);
  await pending;
  assert.equal(h.requests.length, 1); assert.equal(h.cart.items.length, 1); assert.deepEqual(h.pushes, []);
  assert.ok(h.nodes().some(node => node.props?.children === 'Шинэ дүнгээр баталгаажуулах'));
  const confirmation = h.submit();
  assert.equal(h.requests[1].body.expectedTotal, 125);
  assert.notEqual(h.requests[1].body.idempotencyKey, h.requests[0].body.idempotencyKey);
  response(h.requests[1], { id: 'confirmed' }, 201); await confirmation;
  assert.deepEqual(h.pushes, ['/orders/confirmed']);
});

test('account changes clear delivery and pending UI; late results cannot affect the new account', async t => {
  const h = checkout(t); h.fill(); const pending = h.submit();
  h.switchOwner('user-b');
  assert.equal(h.nodes().find(node => node.props?.autoComplete === 'name').props.value, '');
  assert.equal(h.nodes().find(node => node.type === 'fieldset').props.disabled, false);
  response(h.requests[0], { id: 'old-account-order' }, 201); await pending;
  assert.equal(h.cart.items.length, 1); assert.deepEqual(h.pushes, []);
  h.fill(); const next = h.submit(); assert.equal(h.requests[1].owner, 'user-b');
  assert.notEqual(h.requests[1].body.idempotencyKey, h.requests[0].body.idempotencyKey);
  response(h.requests[1], { id: 'new-account-order' }); await next;
});

test('a stock rejection refreshes the quote and prevents another submit until checking completes', async t => {
  const h = checkout(t); h.fill(); const pending = h.submit();
  response(h.requests[0], { error: 'Only 0 items remain' }, 409); await pending;
  assert.equal(h.retries, 1); await h.submit(); assert.equal(h.requests.length, 1);
  assert.equal(h.cart.items.length, 1); assert.deepEqual(h.pushes, []);
});

test('a delayed rejection for the old cart does not invalidate the newly edited cart', async t => {
  const h = checkout(t); h.fill(); const pending = h.submit();
  h.addQuantity(2); h.render();
  response(h.requests[0], { error: 'Old cart no longer fits stock' }, 409); await pending;
  assert.equal(h.retries, 0);
  assert.ok(!h.nodes().some(node => node.props?.children === 'Old cart no longer fits stock'));
  assert.equal(h.cart.items[0].qty, 2);
});

test('a pending request survives remount without consuming cart quantities twice', async t => {
  const h = checkout(t); h.fill(); const pending = h.submit();
  h.remount(); h.fill();
  response(h.requests[0], { id: 'recovered-order' }, 201); await pending;
  assert.equal(h.cart.items[0].qty, 1); assert.deepEqual(h.pushes, []);
  const recovery = h.submit();
  assert.equal(h.requests[1].body.idempotencyKey, h.requests[0].body.idempotencyKey);
  h.addQuantity(3); response(h.requests[1], { id: 'recovered-order' }); await recovery;
  assert.equal(h.cart.items[0].qty, 2); assert.deepEqual(h.pushes, ['/orders/recovered-order']);
});

