export type DraftRecord = { value: unknown; updatedAt: number };
export type DraftBackend = {
  read: (key: string) => Promise<DraftRecord | undefined>;
  backup: (key: string, record: DraftRecord) => boolean;
  write: (key: string, record: DraftRecord) => Promise<void>;
  removeBackup: (prefix: string, updatedAt: number) => void;
  remove: (prefix: string) => Promise<void>;
};
type Entry = {
  scope: string; key: string; initial: unknown; value: unknown;
  loaded: boolean; loading?: Promise<void>; revision: number;
  dirty: boolean; restored: boolean; pending: boolean; error: boolean;
  reinitialize?: boolean;
  listeners: Set<() => void>;
};

// Fields are independent records: changing a title never rewrites a large GLB.
// Memory survives component unmounts; durable writes continue after navigation.
export function createDashboardDraftStore(backend: DraftBackend) {
  const entries = new Map<string, Entry>();
  const listeners = new Map<string, Set<() => void>>();
  const versions = new Map<string, number>();
  let queue = Promise.resolve();
  let timestamp = 0;
  let removals = 0;
  const prefix = (scope: string) => `tavilga-draft:v1:${encodeURIComponent(scope)}:`;
  function emit(entry: Entry) {
    versions.set(entry.scope, (versions.get(entry.scope) ?? 0) + 1);
    entry.listeners.forEach(listener => listener());
    listeners.get(entry.scope)?.forEach(listener => listener());
  }
  function entry(scope: string, field: string, initial: () => unknown) {
    const key = prefix(scope) + encodeURIComponent(field);
    if (!entries.has(key)) {
      const value = initial();
      entries.set(key, { scope, key, initial: value, value, loaded: false, revision: 0,
        dirty: false, restored: false, pending: false, error: false, listeners: new Set() });
    }
    const item = entries.get(key)!;
    if (item.reinitialize) {
      item.initial = item.value = initial();
      item.reinitialize = false;
    }
    return item;
  }
  async function hydrate(item: Entry) {
    if (item.loaded) return;
    if (item.loading) return item.loading;
    const revision = item.revision;
    item.loading = (async () => {
      try {
        const record = await backend.read(item.key);
        // A delayed disk read must never overwrite an edit or a successful save.
        if (record && item.revision === revision) {
          item.value = record.value;
          item.restored = true;
          item.dirty = true;
        }
      } catch { item.error = true; }
      item.loaded = true;
      emit(item);
    })();
    return item.loading;
  }
  function set(item: Entry, value: unknown) {
    if (Object.is(item.value, value) && item.loaded) return;
    item.value = value;
    item.reinitialize = false;
    item.revision++;
    item.dirty = true;
    item.pending = true;
    item.error = false;
    const revision = item.revision;
    timestamp = Math.max(Date.now(), timestamp + 1);
    const record = { value, updatedAt: timestamp };
    // Text has an immediate backup even if the page closes before IndexedDB commits.
    const backedUp = backend.backup(item.key, record);
    emit(item);
    queue = queue.then(async () => {
      if (revision !== item.revision) return;
      try { await backend.write(item.key, record); }
      catch { if (revision === item.revision) item.error = !backedUp; }
      if (revision === item.revision) { item.pending = false; emit(item); }
    });
  }
  function clear(scope: string, reset = true) {
    const keyPrefix = prefix(scope);
    for (const item of entries.values()) {
      if (item.scope !== scope) continue;
      item.revision++;
      if (reset) item.value = item.initial;
      else item.initial = item.value;
      // Reopening an existing product after saving uses fresh server props.
      item.reinitialize = reset;
      item.dirty = item.restored = item.error = item.pending = false;
      item.loaded = true;
      emit(item);
    }
    timestamp = Math.max(Date.now(), timestamp + 1);
    backend.removeBackup(keyPrefix, timestamp);
    removals++;
    queue = queue.then(() => backend.remove(keyPrefix)).catch(() => {
      for (const item of entries.values()) {
        if (item.scope === scope) { item.error = item.dirty = true; emit(item); }
      }
    }).finally(() => { removals--; });
    return queue;
  }
  function status(scope: string) {
    const items = [...entries.values()].filter(item => item.scope === scope);
    return {
      loading: items.some(item => !item.loaded),
      saving: items.some(item => item.pending),
      error: items.some(item => item.error),
      restored: items.some(item => item.restored),
      dirty: items.some(item => item.dirty),
    };
  }
  return {
    entry, hydrate, set, clear, status,
    subscribe: (item: Entry, listener: () => void) => {
      item.listeners.add(listener);
      void hydrate(item);
      return () => { item.listeners.delete(listener); };
    },
    subscribeScope: (scope: string, listener: () => void) => {
      if (!listeners.has(scope)) listeners.set(scope, new Set());
      listeners.get(scope)!.add(listener);
      return () => { listeners.get(scope)?.delete(listener); };
    },
    version: (scope: string) => versions.get(scope) ?? 0,
    atRisk: () => removals > 0 || [...entries.values()].some(item => item.pending || (item.dirty && item.error)),
    flush: () => queue,
  };
}
