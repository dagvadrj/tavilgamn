const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const id = '33333333-3333-4333-8333-333333333333';

test('all management tabs survive login and registration return handling', () => {
  const auth = loadSource('src/lib/authRedirect.ts');
  for (const [role, tabs] of Object.entries({
    merchant: ['overview','activation','wallet','products','orders','delivery','branches','staff','reviews','assistant','returns','kitchens','quotes','store','settings','profile'],
    admin: ['dashboard','merchants','furniture','orders','users','messages','models','kitchens','merchant-ops','kitchen-library','rooms','settings','profile'],
  })) for (const tab of tabs) {
    const next = `/${role}?tab=${tab}`;
    assert.equal(auth.safeAuthDestination(next), next);
    const login = auth.loginPathForDestination(next);
    assert.equal(auth.authDestination(login.slice(login.indexOf('?'))), next);
  }
});

test('kitchen projects, guest drafts, orders and account sections retain their exact return destinations', t => {
  const auth = loadSource('src/lib/authRedirect.ts');
  const previous = { window: global.window, sessionStorage: global.sessionStorage };
  const memory = new Map();
  global.sessionStorage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value), removeItem: key => memory.delete(key) };
  global.window = { location: { search: '' } };
  t.after(() => { global.window = previous.window; global.sessionStorage = previous.sessionStorage; });
  for (const next of ['/kitchen', `/kitchen?design=${id}`, `/kitchen?importGuest=1&draft=${id}`, '/kitchen?importGuest=1', `/kitchen?design=${id}&space=1`, '/kitchen?new=1', `/orders/${id}`, '/account#orders', '/account#kitchen-garniture', '/kitchens/l-e70469b8']) {
    assert.equal(auth.safeAuthDestination(next), next);
    const search = '?next=' + encodeURIComponent(next);
    assert.equal(auth.rememberAuthDestination(search), next);
    global.window.location.search = '';
    assert.equal(auth.finishAuthDestination('customer'), next);
    assert.equal(memory.size, 0);
  }
});

test('new return routes reject external, malformed, repeated and unsupported parameters', () => {
  const auth = loadSource('src/lib/authRedirect.ts');
  for (const next of [
    '//evil.test/kitchen', '/\\evil.test', '/kitchen/../admin', '/kitchen?next=https://evil.test', '/kitchen?importGuest=2', '/kitchen?importGuest=1&importGuest=1',
    '/kitchen?draft=not-a-uuid', `/kitchen?design=${id}&design=${id}`, '/kitchen?space=0', '/kitchen?new=1#other', '/kitchen?',
    '/orders/bad', `/orders/${id}/edit`, `/orders/${id}?next=evil`, '/kitchens/%2e%2e', '/kitchens/a/../b', '/kitchens/a\n',
    '/account#unknown', '/account#orders?next=evil', '/admin?tab=rooms&next=evil', '/merchant?tab=wallet&tab=staff',
  ]) assert.equal(auth.safeAuthDestination(next), null, next);
});
