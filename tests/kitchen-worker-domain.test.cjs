const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const source = readFileSync('scripts/models/worker.mjs', 'utf8');
function worker(db) {
  const start = source.indexOf('async function claimDomainJob('), end = source.indexOf('async function downloadSource(',start);
  const context = vm.createContext({db, MODEL_TABLES:['furniture_models','kitchen_models'],modelTable:'furniture_models',nextDomain:0,Date,Error});
  vm.runInContext(source.slice(start,end),context);
  return context;
}
test('worker uses existing furniture RPC then kitchen RPC and alternates domains after a claim', async () => {
  const calls = [];
  const context = worker({async rpc(name) { calls.push(name); return {data:name.includes('kitchen') ? [{id:'kitchen'}] : [],error:null}; }});
  assert.equal((await context.claimDomainJob('processing')).id,'kitchen');
  assert.deepEqual(calls, ['claim_furniture_model_job','claim_kitchen_model_job']);
  assert.equal(context.modelTable,'kitchen_models');
  calls.length = 0;
  await context.claimDomainJob('export');
  assert.deepEqual(calls,['claim_furniture_model_export_job','claim_kitchen_model_export_job']);
});
test('bounded verification cannot claim another model and preserves job and archive CAS guards', async () => {
  const calls=[];
  const db={from(table) {let updated=false;const q={select(){return q;},eq(k,v){calls.push([table,k,v]);return q;},is(k,v){calls.push([table,k,v]);return q;},update(){updated=true;return q;},async maybeSingle(){return {data:table==='kitchen_models'?{id:'target',processing_status:'ready',processing_job_id:'processing',export_job_id:'export'}:null,error:null};}};return q;}};
  const context=worker(db);
  await context.claimDomainJob('export','target');
  assert.ok(calls.every(c=>c[1]!=='id'||c[2]==='target'));
  assert.ok(calls.some(c=>c[1]==='export_job_id'&&c[2]==='export'));
  assert.ok(calls.some(c=>c[1]==='processing_job_id'&&c[2]==='processing'));
  assert.ok(calls.some(c=>c[1]==='archived_at'&&c[2]===null));
});
