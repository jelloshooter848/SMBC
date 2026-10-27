import { afterEach, describe, expect, it, vi } from 'vitest';

/*
 * v0.4.77 item 185 (review): the browser's online side loads nostr-backup.ts through
 * onlineLoader, so a rejected import() is dropped and the next press loads again, and every
 * Save data page of the tab shares one loader.
 */

let fail = 0;
const api = { newCode: () => 'ABCDEF123456' };
vi.mock('@engine/online/nostr-backup', () => ({
  browserOnlineApi: () => {
    if (fail-- > 0) throw new Error('Failed to fetch dynamically imported module');
    return api;
  },
}));

afterEach(() => {
  fail = 0;
});

describe('browserSaveDataEnv().online.load', () => {
  it('goes through onlineLoader: one shared load, a rejected one tried again', async () => {
    const { browserSaveDataEnv } = await import('@game/scenes/save-data');
    fail = 1;
    const a = browserSaveDataEnv().online!;
    const b = browserSaveDataEnv().online!;
    expect(a.load).toBe(b.load);
    await expect(a.load()).rejects.toThrow(/dynamically imported/);
    await expect(b.load()).resolves.toBe(api);
    expect(await a.load()).toBe(await b.load());
  });
});
