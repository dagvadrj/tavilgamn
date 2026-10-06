const test = require('node:test');
const assert = require('node:assert/strict');
const { loadSource } = require('./helpers/load-source.cjs');
const { createDashboardDraftStore } = loadSource('src/lib/dashboardDraftStore.ts');
const { packDraftValue, unpackDraftValue, containsDraftFile, dashboardDraftBackend } = loadSource('src/lib/dashboardDraftStorage.ts');
const deferred = () => { let resolve; const promise = new Promise(yes => { resolve = yes; }); return { promise, resolve }; };
function storage() {
  const records = new Map(), backups = new Map();
  return {
    records, backups,
    async read(key) { return backups.get(key) ?? records.get(key); },
    backup(key, record) { if (containsDraftFile(record.value)) return false; backups.set(key, structuredClone(record)); return true; },
    async write(key, record) { records.set(key, { ...record, value: unpackDraftValue(structuredClone(packDraftValue(record.value))) }); },
    removeBackup(prefix) { for (const key of backups.keys()) if (key.startsWith(prefix)) backups.delete(key); },
    async remove(prefix) { for (const key of records.keys()) if (key.startsWith(prefix)) records.delete(key); },
  };
}

test('route/tab unmounts preserve metadata and files; a new session restores them from disk', async () => {
  const backend = storage(), drafts = createDashboardDraftStore(backend), scope = 'admin:alice:product:new';
  const title = drafts.entry(scope, 'name', () => ''), file = drafts.entry(scope, 'glb', () => null);
  await Promise.all([drafts.hydrate(title), drafts.hydrate(file)]);
  const glb = new File(['glTF\0model'], 'sofa.glb', { type: 'model/gltf-binary', lastModified: 123 });
  drafts.set(title, 'New sofa'); drafts.set(file, glb);
  assert.equal(drafts.entry(scope, 'name', () => 'default'), title);
  assert.equal(drafts.entry(scope, 'glb', () => null).value, glb);
  await drafts.flush();
  const restarted = createDashboardDraftStore(backend), restoredTitle = restarted.entry(scope, 'name', () => ''), restoredFile = restarted.entry(scope, 'glb', () => null);
  await Promise.all([restarted.hydrate(restoredTitle), restarted.hydrate(restoredFile)]);
  assert.equal(restoredTitle.value, 'New sofa');
  assert.ok(restoredFile.value instanceof File);
  assert.equal(restoredFile.value.name, 'sofa.glb');
  assert.equal(restoredFile.value.type, glb.type);
  assert.equal(restoredFile.value.lastModified, 123);
  assert.equal(await restoredFile.value.text(), await glb.text());
  const form = new FormData(); form.set('file', restoredFile.value);
  assert.equal(form.get('file').name, 'sofa.glb');
  assert.equal(restarted.status(scope).restored, true);
});

test('drafts are isolated by account, role, product and new/edit form', async () => {
  const backend = storage(), drafts = createDashboardDraftStore(backend);
  const original = drafts.entry('admin:alice:product:new', 'name', () => '');
  drafts.set(original, 'Private draft'); await drafts.flush();
  for (const scope of ['admin:bob:product:new', 'merchant:alice:product:new', 'admin:alice:product:42']) {
    const field = drafts.entry(scope, 'name', () => 'initial'); await drafts.hydrate(field);
    assert.equal(field.value, 'initial'); assert.equal(drafts.status(scope).restored, false);
  }
});

test('a delayed restore cannot overwrite a new edit or resurrect a cleared draft', async () => {
  const gate = deferred(), backend = storage(); backend.read = () => gate.promise;
  const drafts = createDashboardDraftStore(backend), field = drafts.entry('merchant:a:store', 'name', () => '');
  const loading = drafts.hydrate(field); drafts.set(field, 'Latest edit');
  gate.resolve({ value: 'Old draft', updatedAt: 1 }); await loading;
  assert.equal(field.value, 'Latest edit'); await drafts.flush();
  const gate2 = deferred(); backend.read = () => gate2.promise;
  const other = drafts.entry('merchant:a:other', 'name', () => ''), restore = drafts.hydrate(other);
  await drafts.clear('merchant:a:other'); gate2.resolve({ value: 'Submitted', updatedAt: 1 }); await restore;
  assert.equal(other.value, ''); assert.equal(drafts.status('merchant:a:other').dirty, false);
});

test('an explicit URL selection wins over a stored tab even when it matches the initial default', async () => {
  const gate = deferred(), backend = storage(); backend.read = () => gate.promise;
  const drafts = createDashboardDraftStore(backend), tab = drafts.entry('merchant:a:navigation', 'tab', () => 'overview');
  const loading = drafts.hydrate(tab); drafts.set(tab, 'overview');
  gate.resolve({ value: 'products', updatedAt: 1 }); await loading; await drafts.flush();
  assert.equal(tab.value, 'overview');
});

test('serialized/coalesced writes keep the latest value and a successful save removes files without touching another draft', async () => {
  const backend = storage(), gate = deferred(); const write = backend.write;
  let calls = 0; backend.write = async (...args) => { if (++calls === 1) await gate.promise; await write(...args); };
  const drafts = createDashboardDraftStore(backend), a = drafts.entry('admin:a:upload', 'glb', () => null), b = drafts.entry('admin:a:product:1', 'name', () => '');
  drafts.set(a, new File(['one'], 'one.glb')); await Promise.resolve();
  drafts.set(a, new File(['two'], 'two.glb')); drafts.set(a, new File(['three'], 'three.glb'));
  drafts.set(b, 'Other draft');
  const cleared = drafts.clear('admin:a:upload'); gate.resolve(); await cleared;
  assert.equal(a.value, null); assert.equal(backend.records.size, 1);
  assert.equal([...backend.records.values()][0].value, 'Other draft');
  assert.equal(drafts.atRisk(), false);
  const reload = createDashboardDraftStore(backend), next = reload.entry('admin:a:upload', 'glb', () => null); await reload.hydrate(next);
  assert.equal(next.value, null);
});

test('text has a synchronous backup and file quota errors retain the file in memory and signal risk', async () => {
  const backend = storage(); backend.write = async () => { throw Error('quota'); };
  const drafts = createDashboardDraftStore(backend), name = drafts.entry('merchant:a:new', 'name', () => '');
  drafts.set(name, 'Backup before navigation');
  assert.equal([...backend.backups.values()][0].value, name.value);
  await drafts.flush(); assert.equal(drafts.status('merchant:a:new').error, false);
  const image = drafts.entry('merchant:a:new', 'image', () => null), selected = new File(['image'], 'cover.png', { type: 'image/png' });
  drafts.set(image, selected); await drafts.flush();
  assert.equal(image.value, selected); assert.equal(drafts.status('merchant:a:new').error, true); assert.equal(drafts.atRisk(), true);
});

test('editing metadata never rewrites the binary field and failed save leaves the draft available', async () => {
  const backend = storage(), writes = [], write = backend.write;
  backend.write = (...args) => { writes.push(args[0]); return write(...args); };
  const drafts = createDashboardDraftStore(backend), scope = 'admin:a:upload', file = drafts.entry(scope, 'file', () => null), title = drafts.entry(scope, 'title', () => '');
  drafts.set(file, new File(['glTF'], 'asset.glb')); await drafts.flush();
  drafts.set(title, 'A'); await drafts.flush(); drafts.set(title, 'AB'); await drafts.flush();
  assert.equal(writes.filter(key => key.endsWith(':file')).length, 1);
  const reopened = drafts.entry(scope, 'title', () => ''); assert.equal(reopened.value, 'AB');
  assert.ok(file.value instanceof File);
});

test('reopening a successfully saved product initializes from fresh server data rather than its old baseline', async () => {
  const backend = storage(), drafts = createDashboardDraftStore(backend), scope = 'admin:a:product:1';
  const field = drafts.entry(scope, 'product', () => ({ name: 'Old', stockQuantity: 3 }));
  await drafts.hydrate(field); drafts.set(field, { name: 'New', stockQuantity: 5 });
  await drafts.clear(scope);
  const reopened = drafts.entry(scope, 'product', () => ({ name: 'New', stockQuantity: 5 }));
  assert.deepEqual(reopened.value, { name: 'New', stockQuantity: 5 });
  assert.equal(drafts.status(scope).dirty, false);
});

test('edits made after discarding a draft still survive the next navigation', async () => {
  const drafts = createDashboardDraftStore(storage()), scope = 'merchant:a:new';
  const field = drafts.entry(scope, 'title', () => '');
  drafts.set(field, 'Discard this'); await drafts.clear(scope);
  drafts.set(field, 'Keep this'); await drafts.flush();
  assert.equal(drafts.entry(scope, 'title', () => '').value, 'Keep this');
});

test('images preserve array order, names and byte content when the browser clones Files as Blobs', async () => {
  const images = [new File(['first'], 'first.jpg', { type: 'image/jpeg' }), new File(['second'], 'second.webp', { type: 'image/webp' })];
  const packed = packDraftValue(images);
  packed.forEach(record => { record.blob = new Blob([record.blob], { type: record.type }); });
  const restored = unpackDraftValue(packed);
  assert.deepEqual(restored.map(file => file.name), ['first.jpg', 'second.webp']);
  assert.deepEqual(await Promise.all(restored.map(file => file.text())), ['first', 'second']);
  assert.equal(containsDraftFile(images), true); assert.equal(containsDraftFile({ images: ['https://example.com/image'] }), false);
});

test('file backups never stringify a File into an empty object', () => {
  const values = new Map(); global.localStorage = { setItem: (k, v) => values.set(k, v), removeItem: k => values.delete(k) };
  try {
    dashboardDraftBackend.backup('file', { value: null, updatedAt: 1 });
    assert.equal(dashboardDraftBackend.backup('file', { value: new File(['test'], 'test.glb'), updatedAt: 2 }), false);
    assert.equal(values.has('file'), false);
  } finally { delete global.localStorage; }
});

test('browser backend ignores cleared files even if deletion fails, and permits new edits after a fast reload', async () => {
  const values = new Map(), disk = new Map();
  global.localStorage = {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key),
    key: index => [...values.keys()][index] ?? null, get length() { return values.size; },
  };
  const db = {
    transaction() {
      const transaction = {
        objectStore() { return {
          get(key) { const request = {}; queueMicrotask(() => { request.result = disk.get(key); request.onsuccess(); }); return request; },
          put(value, key) { disk.set(key, structuredClone(value)); queueMicrotask(() => transaction.oncomplete()); },
          delete() { queueMicrotask(() => { transaction.error = Error('disk deletion failed'); transaction.onerror(); }); },
        }; },
      }; return transaction;
    },
  };
  global.indexedDB = { open() { const request = {}; queueMicrotask(() => { request.result = db; request.onsuccess(); }); return request; } };
  global.IDBKeyRange = { bound: (lower, upper) => ({ lower, upper }) };
  try {
    const { dashboardDraftBackend: browser } = loadSource('src/lib/dashboardDraftStorage.ts');
    const prefix = 'tavilga-draft:v1:admin%3Aa%3Aupload:', key = prefix + 'glb';
    const oldWrite = browser.write(key, { value: new File(['old'], 'old.glb'), updatedAt: 90 });
    browser.removeBackup(prefix, 100);
    await oldWrite; await assert.rejects(browser.remove(prefix), /disk deletion failed/);
    assert.equal(await browser.read(key), undefined);
    await browser.write(key, { value: new File(['new'], 'new.glb'), updatedAt: 95 });
    const restored = await browser.read(key);
    assert.equal(restored.updatedAt, 101); assert.equal(restored.value.name, 'new.glb'); assert.equal(await restored.value.text(), 'new');
    const nameKey = prefix + 'name';
    browser.backup(nameKey, { value: 'New text', updatedAt: 95 });
    assert.equal((await browser.read(nameKey)).value, 'New text');
  } finally { delete global.localStorage; delete global.indexedDB; delete global.IDBKeyRange; }
});
