/** Minimal IndexedDB store for asset packs: { name, manifest, files: Record<path, Blob> }. */
export interface StoredPack {
  name: string;
  manifest: unknown;
  files: Record<string, Blob>;
  addedAt: number;
}

const DB = 'smbc';
const STORE = 'packs';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB unavailable'));
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'name' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/**
 * One request in its own transaction. It settles when the transaction does: a write counts only
 * once it has committed (#219 review: a quota error can abort the transaction at commit, after
 * the request itself succeeded, and then nothing was written).
 */
function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(STORE, mode);
        const req = fn(t.objectStore(STORE));
        let result: T;
        req.onsuccess = () => {
          result = req.result;
        };
        // A failed request aborts its transaction; the abort reports it.
        t.oncomplete = () => resolve(result);
        t.onabort = () => reject(t.error ?? req.error ?? new Error('IndexedDB transaction aborted'));
        t.onerror = () => reject(t.error ?? req.error ?? new Error('IndexedDB transaction failed'));
      }),
  );
}

export const packStore = {
  async list(): Promise<StoredPack[]> {
    try {
      return (await tx<StoredPack[]>('readonly', (s) => s.getAll())) ?? [];
    } catch {
      return [];
    }
  },
  async get(name: string): Promise<StoredPack | undefined> {
    try {
      return await tx<StoredPack | undefined>('readonly', (s) => s.get(name));
    } catch {
      return undefined;
    }
  },
  async put(pack: StoredPack): Promise<void> {
    await tx('readwrite', (s) => s.put(pack));
  },
  async remove(name: string): Promise<void> {
    await tx('readwrite', (s) => s.delete(name));
  },
  /** Every pack goes, in one transaction (RESET GAME): all of them or, on a failure, none. */
  async clear(): Promise<void> {
    await tx('readwrite', (s) => s.clear());
  },
};
