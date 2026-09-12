const { test } = require('node:test');
const assert = require('node:assert/strict');
const { NextRequest, NextResponse } = require('next/server');
const { loadSource } = require('./helpers/load-source.cjs');
const { createUnifiedKitchen } = loadSource('src/lib/kitchenAssembly.ts');
const id = '12345678-1234-1234-1234-123456789abc';
const row = (name = 'Гарнитур') => ({ id, name, design: createUnifiedKitchen(), created_at: '2026-09-13T00:00:00Z', updated_at: '2026-09-13T00:00:00Z' });
function api(owner, error = null) {
  const calls = []; let value = row();
  const db = { from(table) {
    assert.equal(table, 'kitchen_garnitures');
    const chain = {
      select() { return chain; }, eq(...args) { calls.push(['eq', ...args]); return chain; }, order() { return chain; },
      limit: async () => ({ data: [value], error }),
      upsert(data, options) { calls.push(['upsert', data, options]); value = { ...value, ...data }; return chain; },
      single: async () => ({ data: value, error }), delete() { calls.push(['delete']); return chain; },
      then(resolve) { return Promise.resolve({ error }).then(resolve); },
    }; return chain;
  } };
  return { calls, route: loadSource('src/app/api/kitchens/route.ts', {
    '@/lib/supabase/requireUser': { requireUser: async () => owner ? { userId: owner } : { error: NextResponse.json({}, { status: 401 }) } },
    '@/lib/supabase/admin': { getSupabaseAdmin: () => db },
  }) };
}
const put = body => new NextRequest('http://localhost/api/kitchens', { method: 'PUT', body: JSON.stringify(body) });
test('kitchen API authenticates reads, writes and deletion before accessing database', async () => {
  const { route, calls } = api(null);
  assert.equal((await route.GET(new NextRequest('http://localhost/api/kitchens'))).status, 401);
  assert.equal((await route.PUT(put({})) ).status, 401);
  assert.equal((await route.DELETE(new NextRequest(`http://localhost/api/kitchens?id=${id}`,{method:'DELETE'}))).status,401);
  assert.deepEqual(calls, []);
});
test('save roundtrip preserves poses and materials and ignores caller-supplied ownership', async () => {
  const { route, calls } = api('verified-owner'), design = createUnifiedKitchen();
  design.cabinets[0].color = '#aabbcc'; design.cabinets[0].handleStyle = 'knob';
  const response = await route.PUT(put({ id, name: ' Гал тогоо ', design, user_id: 'victim' }));
  assert.equal(response.status, 200); assert.equal(response.headers.get('Cache-Control'), 'no-store');
  assert.deepEqual((await response.json()).kitchen.design, design);
  assert.equal(calls[0][1].user_id, 'verified-owner'); assert.equal(calls[0][1].name, 'Гал тогоо');
  assert.deepEqual(calls[0][2], { onConflict: 'user_id,id' });
  await route.GET(new NextRequest('http://localhost/api/kitchens?user_id=victim'));
  assert.deepEqual(calls.at(-1), ['eq','user_id','verified-owner']);
  await route.DELETE(new NextRequest(`http://localhost/api/kitchens?id=${id}`,{method:'DELETE'}));
  assert.deepEqual(calls.slice(-2), [['eq','user_id','verified-owner'],['eq','id',id]]);
});
test('invalid kitchen and oversized body never write; database failure never reports success', async () => {
  const { route, calls } = api('owner');
  for (const body of [null, {}, { id, name:'', design:createUnifiedKitchen() }, { id, name:'x', design:{version:2} }]) assert.equal((await route.PUT(put(body))).status,400);
  assert.equal((await route.PUT(put({ value:'x'.repeat(250000) }))).status,413); assert.deepEqual(calls,[]);
  const failed = await api('owner', { message:'private SQL error' }).route.PUT(put({ id,name:'x',design:createUnifiedKitchen() }));
  assert.equal(failed.status,503); assert.doesNotMatch(await failed.text(), /private SQL/);
});
const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
function store() {
  let sessionOwner = 'a';
  const state = loadSource('src/store/kitchens.ts', { '@/lib/supabase/client': { supabase: { auth: {
    getSession: async () => ({ data: { session: { user: { id:sessionOwner }, access_token: 'fixture' } } }),
  } } } });
  state.setKitchenOwner('a');
  return { ...state, changeOwner: owner => { sessionOwner = owner; state.setKitchenOwner(owner); } };
}
test('account switch discards previous owner pending list and save responses', async t => {
  const previous = global.fetch; t.after(() => { global.fetch = previous; });
  const s = store(), read = deferred(), write = deferred();
  global.fetch = async (_, init) => ({ ok:true, json: () => init.method === 'PUT' ? write.promise : read.promise });
  const refresh = s.useKitchens.getState().refresh(), save = s.useKitchens.getState().save(id,'x',createUnifiedKitchen());
  await new Promise(resolve => setImmediate(resolve)); s.changeOwner('b');
  read.resolve({ kitchens:[row()] }); write.resolve({ kitchen:row() });
  await refresh; assert.equal(await save,null); assert.deepEqual(s.useKitchens.getState().items,[]);
  assert.equal(s.useKitchens.getState().owner,'b');
});
test('late refresh cannot replace a saved version or resurrect a deleted kitchen', async t => {
  const previous = global.fetch; t.after(() => { global.fetch = previous; });
  const s = store(), pending = deferred();
  global.fetch = async (_,init) => ({ok:true,json:async () => init.method === 'PUT' ? {kitchen:row('New')} : init.method === 'DELETE' ? {ok:true} : pending.promise});
  const refresh = s.useKitchens.getState().refresh(); await new Promise(resolve=>setImmediate(resolve));
  assert.ok(await s.useKitchens.getState().save(id,'New',createUnifiedKitchen()));
  pending.resolve({kitchens:[row('Old')]}); await refresh;
  assert.equal(s.useKitchens.getState().items[0].name,'New');
  const pendingDelete = deferred(); global.fetch = async (_,init) => ({ok:true,json:async () => init.method === 'DELETE' ? {ok:true} : pendingDelete.promise});
  const refresh2 = s.useKitchens.getState().refresh(); await new Promise(resolve=>setImmediate(resolve));
  assert.equal(await s.useKitchens.getState().remove(id),true); pendingDelete.resolve({kitchens:[row('Old')]}); await refresh2;
  assert.deepEqual(s.useKitchens.getState().items,[]);
});
