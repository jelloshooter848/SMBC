import { vi } from 'vitest';

/*
 * A small IndexedDB stand-in for the asset pack store (engine/assets/idb.ts): one database, one
 * object store keyed by `name`, and transactions that stage their writes and commit them only
 * when they complete. `abortAfter(op)` makes a transaction abort at commit AFTER its request
 * succeeded, as a quota error can in a real browser (#219 review), so nothing it wrote lands.
 */

export type FakeOp = 'put' | 'get' | 'getAll' | 'delete' | 'clear';

export interface FakeIdb {
  /** What is committed, by pack name. */
  data: Map<string, { name: string }>;
  /** Whether a transaction running `op` aborts at commit (after its request's success). */
  abortAfter: (op: FakeOp) => boolean;
}

const later = (fn: () => void) => setTimeout(fn, 0);

export function installFakeIdb(): FakeIdb {
  const idb: FakeIdb = { data: new Map(), abortAfter: () => false };
  const db = {
    createObjectStore: () => ({}),
    transaction: () => {
      const staged = new Map(idb.data);
      const t: Record<string, unknown> & {
        error: DOMException | null;
        oncomplete?: () => void;
        onabort?: () => void;
        onerror?: () => void;
      } = { error: null };
      let op: FakeOp = 'get';
      const request = (o: FakeOp, run: () => unknown) => {
        op = o;
        const req: { result?: unknown; error: null; onsuccess?: () => void; onerror?: () => void } = {
          error: null,
        };
        later(() => {
          req.result = run();
          req.onsuccess?.();
          later(() => {
            if (idb.abortAfter(op)) {
              t.error = new DOMException('The quota has been exceeded.', 'QuotaExceededError');
              t.onabort?.();
            } else {
              idb.data = staged;
              t.oncomplete?.();
            }
          });
        });
        return req;
      };
      t.objectStore = () => ({
        put: (v: { name: string }) => request('put', () => void staged.set(v.name, v)),
        get: (k: string) => request('get', () => staged.get(k)),
        getAll: () => request('getAll', () => [...staged.values()]),
        delete: (k: string) => request('delete', () => void staged.delete(k)),
        clear: () => request('clear', () => void staged.clear()),
      });
      return t;
    },
  };
  vi.stubGlobal('indexedDB', {
    open: () => {
      const req: { result?: unknown; onupgradeneeded?: () => void; onsuccess?: () => void } = {};
      later(() => {
        req.result = db;
        req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    },
  });
  return idb;
}
