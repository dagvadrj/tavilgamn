const { test } = require('node:test');
const assert = require('node:assert/strict');
const now = Date.parse('2026-10-10T12:00:00Z');
const old = new Date(now - 25 * 3600000).toISOString();
const model = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee', version = '11111111-2222-4333-8444-555555555555';
const source = extra => ({ id: 'asset', model_id: model, version_id: version, role: 'source', state: 'pending', sha256: null, validation: null,
  created_at: old, updated_at: old, storage_path: `r2://bucket/models/${model}/source/${version}.glb`, ...extra });
async function setup(assets, { referenced = false, concurrent = false, missing = false, recentObject = false, deleteFails = false } = {}) {
  const { cleanupAbandonedSources } = await import('../scripts/models/cleanup-abandoned-sources.mjs');
  const calls = [], updates = [], objects = [];
  const db = { from(table) {
    let update = null; const filters = [];
    const q = { select() { return q; }, eq(k,v) { filters.push([k,v]); calls.push([table,k,v]); return q; },
      in(k,v) { calls.push([table,k,v]); return q; }, is(k,v) { calls.push([table,k,v]); return q; },
      lt(k,v) { calls.push([table,k,v]); return q; }, order() { return q; }, gt() { return q; },
      update(value) { update = value; updates.push(value); return q; }, limit() { return q; },
      then(resolve) { const id = filters.find(f => f[0] === 'id')?.[1];
        if (update && !concurrent) Object.assign(assets.find(a => a.id === id), update);
        return Promise.resolve({ data: table === 'furniture_models' ? referenced ? [{ id: model }] : []
          : update ? concurrent ? [] : [{ id }] : assets, error: null }).then(resolve);
      },
    }; return q;
  } };
  const r2 = { async send(command) {
    objects.push(command);
    if (command.constructor.name === 'HeadObjectCommand') {
      if (missing) throw { $metadata: { httpStatusCode: 404 } };
      return { LastModified: new Date(recentObject ? now - 1000 : old) };
    }
    if (deleteFails) throw new Error('temporary delete failure');
    return {};
  } };
  return { calls, updates, objects, run: apply => cleanupAbandonedSources(db, r2, 'bucket', { now, apply }) };
}
test('dry-run reports only expired abandoned exact source keys without mutating or deleting', async () => {
  const s = await setup([source()]); const result = await s.run(false);
  assert.equal(result.candidates, 1); assert.equal(result.deleted, 0); assert.equal(s.updates.length, 0);
  assert.equal(s.objects.filter(o => o.constructor.name === 'DeleteObjectCommand').length, 0);
  assert.ok(s.calls.some(c => c[1] === 'created_at' && c[2] === new Date(now - 24 * 3600000).toISOString()));
});
test('cleanup deletes only expired never-accepted sources and retains a deleted history record', async () => {
  const data = source(); const s = await setup([data]); const result = await s.run(true);
  assert.equal(result.deleted, 1); assert.equal(data.state, 'deleted');
  assert.equal(s.objects.find(o => o.constructor.name === 'DeleteObjectCommand').input.Key, `models/${model}/source/${version}.glb`);
  assert.deepEqual(s.updates.map(u => u.state), ['retired', 'deleted']);
});
test('fresh uploads, accepted sources, delivery history, unexpected buckets and active source references are preserved', async () => {
  const s = await setup([source({ created_at: new Date(now - 1000).toISOString() }), source({ sha256: 'approved' }),
    source({ role: 'delivery' }), source({ storage_path: `r2://other/models/${model}/source/${version}.glb` })]);
  assert.equal((await s.run(true)).deleted, 0); assert.equal(s.objects.length, 0);
  const active = await setup([source()], { referenced: true }); assert.equal((await active.run(true)).deleted, 0); assert.equal(active.updates.length, 0);
});
test('a racing upload-complete prevents cleanup from deleting its object', async () => {
  const s = await setup([source()], { concurrent: true }); assert.equal((await s.run(true)).deleted, 0);
  assert.equal(s.objects.filter(o => o.constructor.name === 'DeleteObjectCommand').length, 0);
  assert.ok(s.calls.some(c => c[1] === 'updated_at' && c[2] === old));
});
test('recent objects are preserved and missing objects are reconciled without deleting', async () => {
  const fresh = await setup([source()], { recentObject: true }); assert.equal((await fresh.run(true)).deleted, 0); assert.equal(fresh.updates.length, 0);
  const missing = await setup([source()], { missing: true }); assert.equal((await missing.run(true)).deleted, 1);
  assert.equal(missing.objects.filter(o => o.constructor.name === 'DeleteObjectCommand').length, 0);
});
test('failed source deletion remains retryable and does not become a deleted ledger record', async () => {
  const data = source(); const s = await setup([data], { deleteFails: true });
  assert.equal((await s.run(true)).failed, 1); assert.equal(data.state, 'retired');
});
