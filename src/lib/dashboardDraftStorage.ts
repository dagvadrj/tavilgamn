import type { DraftBackend, DraftRecord } from "./dashboardDraftStore";

let database: Promise<IDBDatabase> | undefined;
function openDatabase() {
  if (!database) {
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("tavilga-dashboard-drafts", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("fields");
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); database = undefined; };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
      request.onblocked = () => reject(new Error("Draft database blocked"));
    }).catch(error => { database = undefined; throw error; });
  }
  return database;
}
export function containsDraftFile(value: unknown): boolean {
  if (typeof Blob !== "undefined" && value instanceof Blob) return true;
  if (Array.isArray(value)) return value.some(containsDraftFile);
  return !!value && typeof value === "object" && Object.values(value).some(containsDraftFile);
}
// Store the filename explicitly: some browsers deserialize a File as a Blob.
export function packDraftValue(value: unknown): unknown {
  if (typeof File !== "undefined" && value instanceof File) {
    return { __draftFile: true, blob: value, name: value.name, type: value.type, lastModified: value.lastModified };
  }
  if (Array.isArray(value)) return value.map(packDraftValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, packDraftValue(child)]));
  return value;
}
export function unpackDraftValue(value: unknown): unknown {
  if (value && typeof value === "object" && "__draftFile" in value && "blob" in value && value.blob instanceof Blob) {
    const file = value as unknown as { blob: Blob; name: string; type: string; lastModified: number };
    return new File([file.blob], file.name, { type: file.type, lastModified: file.lastModified });
  }
  if (Array.isArray(value)) return value.map(unpackDraftValue);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, unpackDraftValue(child)]));
  return value;
}
function backupRead(key: string): DraftRecord | undefined {
  try { return JSON.parse(localStorage.getItem(key) ?? "null") ?? undefined; }
  catch { return undefined; }
}
function afterClear(key: string, record: DraftRecord): DraftRecord {
  try {
    const clearedAt = Number(localStorage.getItem(key.slice(0, key.lastIndexOf(":") + 1) + "!cleared")) || 0;
    return { ...record, updatedAt: Math.max(record.updatedAt, clearedAt + 1) };
  } catch { return record; }
}
export const dashboardDraftBackend: DraftBackend = {
  async read(key) {
    const backup = backupRead(key);
    let clearedAt = 0;
    try { clearedAt = Number(localStorage.getItem(key.slice(0, key.lastIndexOf(":") + 1) + "!cleared")) || 0; } catch { /* Use IndexedDB. */ }
    try {
      const db = await openDatabase();
      const record = await new Promise<DraftRecord | undefined>((resolve, reject) => {
        const request = db.transaction("fields", "readonly").objectStore("fields").get(key);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      const validRecord = record && record.updatedAt > clearedAt ? record : undefined;
      const validBackup = backup && backup.updatedAt > clearedAt ? backup : undefined;
      if (validBackup && (!validRecord || validBackup.updatedAt >= validRecord.updatedAt)) return validBackup;
      return validRecord ? { ...validRecord, value: unpackDraftValue(validRecord.value) } : undefined;
    } catch (error) { if (backup && backup.updatedAt > clearedAt) return backup; if (clearedAt) return undefined; throw error; }
  },
  backup(key, record) {
    try {
      if (containsDraftFile(record.value)) { localStorage.removeItem(key); return false; }
      localStorage.setItem(key, JSON.stringify(afterClear(key, record)));
      return true;
    } catch { return false; }
  },
  async write(key, record) {
    // Capture the generation before opening the database; a concurrent clear
    // must not make this older write appear newer than its deletion marker.
    const current = afterClear(key, record);
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("fields", "readwrite");
      transaction.objectStore("fields").put({ ...current, value: packDraftValue(record.value) }, key);
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
  },
  removeBackup(prefix, updatedAt) {
    try {
      for (let index = localStorage.length - 1; index >= 0; index--) {
        const key = localStorage.key(index);
        if (key?.startsWith(prefix)) localStorage.removeItem(key);
      }
      // A failed disk deletion must not resurrect a previously submitted draft.
      localStorage.setItem(prefix + "!cleared", String(updatedAt));
    } catch { /* IndexedDB removal still proceeds. */ }
  },
  async remove(prefix) {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const transaction = db.transaction("fields", "readwrite");
      transaction.objectStore("fields").delete(IDBKeyRange.bound(prefix, prefix + "\uffff"));
      transaction.oncomplete = () => resolve();
      transaction.onerror = transaction.onabort = () => reject(transaction.error);
    });
  },
};
