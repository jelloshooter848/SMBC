import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { finalizeEvent, generateSecretKey } from 'nostr-tools/pure';
import type * as Pure from 'nostr-tools/pure';
import { backUp, D_TAG, keysFromCode, KIND, makeBackupEvent, restore } from '@engine/online/nostr-backup';
import { FakeRelays, type RelayMode } from './fake-relays';

/*
 * Third review of the online backup (items 170-172): relays that send what no honest relay
 * would. Each case is a relay ignoring the filter and sending raw frames; the restore must not
 * throw, must not leave a promise rejected unhandled, and must still return the real copy that
 * another relay holds. verifyEvent is counted so the size checks can be seen to come first.
 */

const verified = vi.hoisted(() => ({ contents: [] as number[] }));
vi.mock('nostr-tools/pure', async (orig) => {
  const real = await orig<typeof Pure>();
  return {
    ...real,
    verifyEvent: (ev: { content: string }) => {
      verified.contents.push(String(ev.content).length);
      return real.verifyEvent(ev as Parameters<typeof real.verifyEvent>[0]);
    },
  };
});

const CODE = '7KQ2MX9PDAB3';
const TEXT = 'the real backup';

function relays(modes: RelayMode[]) {
  const urls = modes.map((_, i) => `wss://relay${i}.test`);
  const fake = new FakeRelays(Object.fromEntries(urls.map((u, i) => [u, modes[i] as RelayMode])));
  return { fake, urls, opts: { relays: urls, WebSocket: fake.WebSocket, timeoutMs: 120, graceMs: 30 } };
}

let unhandled: unknown[] = [];
const onUnhandled = (e: unknown) => unhandled.push(e);
beforeEach(() => {
  unhandled = [];
  verified.contents = [];
  process.on('unhandledRejection', onUnhandled);
});
afterEach(() => {
  process.off('unhandledRejection', onUnhandled);
});

/** Waits a little longer than a restore, so a late rejection would have been reported. */
const settle = () => new Promise((r) => setTimeout(r, 50));

describe('item 170: malformed events from a relay', () => {
  it('a null event, a non-object and an event missing fields: no throw, no unhandled rejection, the real copy restores', async () => {
    const { fake, urls, opts } = relays(['accept', 'accept']);
    await backUp(CODE, TEXT, { ...opts, relays: [urls[1] as string] });
    const real = await makeBackupEvent(CODE, TEXT, 5000);
    const { created_at: _drop, ...missing } = real;
    void _drop;
    fake.inject.set(urls[0] as string, (sub) => [
      JSON.stringify(['EVENT', sub, null]),
      JSON.stringify(['EVENT', sub, 42]),
      JSON.stringify(['EVENT', sub, 'an event']),
      JSON.stringify(['EVENT', sub, missing]),
      JSON.stringify(['EVENT', sub, { ...real, created_at: 'soon' }]),
      JSON.stringify(['EVENT', sub, { ...real, tags: null }]),
    ]);
    expect(await restore(CODE, opts)).toMatchObject({ ok: true, text: TEXT, from: urls[1] });
    await settle();
    expect(unhandled).toEqual([]);
  });

  it('only malformed events: no backup found, nothing unhandled', async () => {
    const { fake, urls, opts } = relays(['accept']);
    fake.inject.set(urls[0] as string, (sub) => [JSON.stringify(['EVENT', sub, null])]);
    expect(await restore(CODE, opts)).toEqual({ ok: false, reason: 'not-found' });
    await settle();
    expect(unhandled).toEqual([]);
  });
});

describe('item 171: oversized events are dropped before any hashing', () => {
  it('content over the NIP-44 limit is never verified, and a 2 MB one included; the real copy wins', async () => {
    const { fake, urls, opts } = relays(['accept', 'accept']);
    await backUp(CODE, TEXT, { ...opts, relays: [urls[1] as string] });
    const { pk } = await keysFromCode(CODE);
    const big = {
      id: '0'.repeat(64),
      pubkey: pk,
      created_at: 9_999_999,
      kind: KIND,
      tags: [['d', D_TAG]],
      content: 'A'.repeat(95_000),
      sig: '0'.repeat(128),
    };
    fake.inject.set(urls[0] as string, (sub) => [
      JSON.stringify(['EVENT', sub, big]),
      JSON.stringify(['EVENT', sub, { ...big, content: 'A'.repeat(2_000_000) }]),
    ]);
    verified.contents = [];
    expect(await restore(CODE, opts)).toMatchObject({ ok: true, text: TEXT, from: urls[1] });
    expect(verified.contents.length).toBeGreaterThan(0);
    expect(verified.contents.every((n) => n <= 90_000)).toBe(true);
  });
});

describe("item 172: another key's event is never ours", () => {
  it("another key's validly signed tombstone with our d tag (newer) is ignored: the real backup restores", async () => {
    const { fake, urls, opts } = relays(['accept', 'accept']);
    await backUp(CODE, TEXT, { ...opts, now: 1000 });
    const other = finalizeEvent(
      { kind: KIND, created_at: 9_999_999, tags: [['d', D_TAG]], content: '' },
      generateSecretKey(),
    );
    fake.inject.set(urls[0] as string, (sub) => [JSON.stringify(['EVENT', sub, other])]);
    expect(await restore(CODE, opts)).toMatchObject({ ok: true, text: TEXT, at: 1000 });
  });
});
