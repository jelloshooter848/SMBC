import { describe, expect, it } from 'vitest';
import { verifyEvent } from 'nostr-tools/pure';
import {
  backUp,
  D_TAG,
  EVENT_MAX_BYTES,
  KIND,
  makeBackupEvent,
  openBackupEvent,
  RELAYS,
  restore,
} from '@engine/online/nostr-backup';
import {
  formatBackupCode,
  MIN_ACCEPTS,
  newBackupCode,
  normalizeBackupCode,
  onlineCopy,
  RELAY_COUNT,
} from '@engine/online/online-backup';
import { defaultSettings, SETTINGS_KEY } from '@engine/save/settings';
import { FakeRelays, type RelayMode } from './fake-relays';

/*
 * Item 159 (owner): BACK UP ONLINE / RESTORE FROM CODE over Nostr, every failure path first
 * (rule 33a). The code IS the key: scrypt(code) gives the Nostr key, the backup is a kind-30078
 * event (d = smbc-remix/backup/v1) encrypted to that key (NIP-44), sent to 5 built-in relays and
 * counted as made when at least 2 accept. A restore asks every relay at once and takes the first
 * VALID answer (signature, author, tag and content all checked). Relays are faked here.
 */

const CODE = '7KQ2MX9PDA';
const TEXT = JSON.stringify({ format: 'smbc-remix-backup', data: { a: 'x'.repeat(500) } });

function relays(modes: RelayMode[]): { fake: FakeRelays; opts: Parameters<typeof backUp>[2] } {
  const urls = modes.map((_, i) => `wss://relay${i}.test`);
  const fake = new FakeRelays(Object.fromEntries(urls.map((u, i) => [u, modes[i] as RelayMode])));
  return { fake, opts: { relays: urls, WebSocket: fake.WebSocket, timeoutMs: 80, graceMs: 20 } };
}

describe('the code (no crypto: the light module)', () => {
  it('a new code is 10 Crockford characters, shown as two groups of five', () => {
    for (let i = 0; i < 20; i++) {
      const c = newBackupCode();
      expect(c).toMatch(/^[0-9A-HJKMNP-TV-Z]{10}$/);
      expect(formatBackupCode(c)).toBe(`${c.slice(0, 5)}-${c.slice(5)}`);
    }
  });

  it('typing is forgiving like save codes: case, spaces, dashes; O as 0, I and L as 1', () => {
    expect(normalizeBackupCode(' 7kq2m-x9pda ')).toBe(CODE);
    expect(normalizeBackupCode('OIL23-45678')).toBe('01123' + '45678');
    expect(normalizeBackupCode('7KQ2M X9PD')).toBeNull();
    expect(normalizeBackupCode('7KQ2M-X9PDAA')).toBeNull();
    expect(normalizeBackupCode('7KQ2M-X9PD!')).toBeNull();
    expect(normalizeBackupCode('')).toBeNull();
  });

  it('5 built-in relays, backed up when 2 accept', () => {
    expect(RELAY_COUNT).toBe(5);
    expect(RELAYS).toHaveLength(5);
    expect(MIN_ACCEPTS).toBe(2);
    for (const u of RELAYS) expect(u).toMatch(/^wss:\/\//);
  });
});

describe('the online copy has no dev fields (owner default 3)', () => {
  it('dev, devUnlock, the dev toggles and assists go back to their defaults; the dev level pick goes', () => {
    const s = defaultSettings();
    s.dev = true;
    s.devUnlock = 'abc123';
    s.classicDev.yoshiMount = true;
    s.assist.invulnerable = true;
    s.audio.master = 0.9;
    const out = onlineCopy({
      [SETTINGS_KEY]: JSON.stringify(s),
      'smbc.devLast': '{"level":"1-1"}',
      'smbc.save.1': '{"v":4}',
    });
    const got = JSON.parse(out[SETTINGS_KEY] as string);
    const d = defaultSettings();
    expect(got.dev).toBe(false);
    expect(got.devUnlock).toBe('');
    expect(got.classicDev).toEqual(d.classicDev);
    expect(got.assist).toEqual(d.assist);
    expect(got.audio.master).toBe(0.9);
    expect(out['smbc.devLast']).toBeUndefined();
    expect(out['smbc.save.1']).toBe('{"v":4}');
  });

  it('settings that do not read are sent as they are (the restore checks them like a file)', () => {
    expect(onlineCopy({ [SETTINGS_KEY]: 'not json' })[SETTINGS_KEY]).toBe('not json');
    expect(onlineCopy({})).toEqual({});
  });
});

describe('the event', () => {
  it("is kind 30078 with the d tag, signed by the code's key, its content not the text", async () => {
    const ev = await makeBackupEvent(CODE, TEXT);
    expect(ev.kind).toBe(KIND);
    expect(KIND).toBe(30078);
    expect(ev.tags).toContainEqual(['d', D_TAG]);
    expect(D_TAG).toBe('smbc-remix/backup/v1');
    expect(verifyEvent(ev)).toBe(true);
    expect(ev.content).not.toContain('smbc-remix-backup');
    expect(await openBackupEvent(CODE, ev)).toBe(TEXT);
  });

  it('opens only for its own code, and not when signature, content, author, kind or tag differ', async () => {
    const ev = await makeBackupEvent(CODE, TEXT);
    expect(await openBackupEvent('7KQ2MX9PDB', ev)).toBeNull();
    expect(
      await openBackupEvent(CODE, { ...ev, sig: ev.sig.replace(/^./, (c) => (c === '0' ? '1' : '0')) }),
    ).toBeNull();
    expect(await openBackupEvent(CODE, { ...ev, content: `AAAA${ev.content.slice(4)}` })).toBeNull();
    expect(await openBackupEvent(CODE, { ...ev, kind: 1 })).toBeNull();
    expect(await openBackupEvent(CODE, { ...ev, tags: [['d', 'other']] })).toBeNull();
    expect(await openBackupEvent(CODE, null)).toBeNull();
  });

  it('too big for the strictest relay (64 KB, with margin) is refused before anything is sent', async () => {
    // Text that does not deflate: random letters.
    let seed = 1;
    const noise = Array.from({ length: 90_000 }, () =>
      String.fromCharCode(33 + ((seed = (seed * 48271) % 2147483647) % 90)),
    ).join('');
    const { fake, opts } = relays(['accept', 'accept', 'accept', 'accept', 'accept']);
    const r = await backUp(CODE, noise, opts);
    expect(r).toMatchObject({ ok: false, reason: 'too-big' });
    expect(fake.opened).toEqual([]);
    expect(EVENT_MAX_BYTES).toBeLessThanOrEqual(62_000);
  });

  it('a save that fits is well under the cap once deflated', async () => {
    const ev = await makeBackupEvent(CODE, 'x'.repeat(200_000));
    expect(JSON.stringify(ev).length).toBeLessThan(EVENT_MAX_BYTES);
  });
});

describe('BACK UP ONLINE against faked relays', () => {
  it('all 5 accept: backed up, 5 of 5', async () => {
    const { opts } = relays(['accept', 'accept', 'accept', 'accept', 'accept']);
    expect(await backUp(CODE, TEXT, opts)).toEqual({ ok: true, accepted: 5, total: 5 });
  });

  it('2 accept (one refuses, one never answers, one is down with a 503): backed up, 2 of 5', async () => {
    const { opts } = relays(['accept', 'reject', 'silent', 'down', 'accept']);
    expect(await backUp(CODE, TEXT, opts)).toEqual({ ok: true, accepted: 2, total: 5 });
  });

  it('only 1 accepts: not backed up', async () => {
    const { opts } = relays(['accept', 'reject', 'silent', 'down', 'down']);
    expect(await backUp(CODE, TEXT, opts)).toEqual({ ok: false, reason: 'servers', accepted: 1, total: 5 });
  });

  it('offline (every relay fails to connect): not backed up, 0 of 5', async () => {
    const { opts } = relays(['down', 'down', 'down', 'down', 'down']);
    expect(await backUp(CODE, TEXT, opts)).toEqual({ ok: false, reason: 'servers', accepted: 0, total: 5 });
  });

  it('a relay with a small event cap refuses it; the others take it', async () => {
    const { opts } = relays([{ cap: 500 }, 'accept', 'accept', 'accept', 'accept']);
    expect(await backUp(CODE, TEXT, opts)).toEqual({ ok: true, accepted: 4, total: 5 });
  });
});

describe('RESTORE FROM CODE against faked relays', () => {
  it('backs up, then restores the very same text with only the code (typed loosely)', async () => {
    const { opts } = relays(['accept', 'accept', 'accept', 'accept', 'accept']);
    await backUp(CODE, TEXT, opts);
    const r = await restore(normalizeBackupCode('7kq2m x9pda') as string, opts);
    expect(r).toMatchObject({ ok: true, text: TEXT });
  });

  it('a newer backup under the same code replaces the old one', async () => {
    const { opts } = relays(['accept', 'accept', 'accept', 'accept', 'accept']);
    await backUp(CODE, 'old', { ...opts, now: 1000 });
    await backUp(CODE, 'new', { ...opts, now: 2000 });
    expect(await restore(CODE, opts)).toMatchObject({ ok: true, text: 'new' });
  });

  it('a relay serving an old copy: the newest valid one that arrives in the grace time wins', async () => {
    const { fake, opts } = relays(['accept', 'accept']);
    const old = await makeBackupEvent(CODE, 'old', 1000);
    const cur = await makeBackupEvent(CODE, 'new', 2000);
    fake.seed('wss://relay0.test', old);
    fake.seed('wss://relay1.test', cur);
    expect(await restore(CODE, opts)).toMatchObject({ ok: true, text: 'new' });
  });

  it('forged signatures and tampered content are skipped; the real copy elsewhere restores', async () => {
    const { opts } = relays(['wrong-sig', 'tampered', 'accept', 'down', 'silent']);
    await backUp(CODE, TEXT, opts);
    expect(await restore(CODE, opts)).toMatchObject({ ok: true, text: TEXT, from: 'wss://relay2.test' });
  });

  it('only forged or tampered copies: no backup found', async () => {
    const { opts } = relays(['wrong-sig', 'tampered']);
    await backUp(CODE, TEXT, opts);
    expect(await restore(CODE, opts)).toEqual({ ok: false, reason: 'not-found' });
  });

  it('a mistyped code finds nothing', async () => {
    const { opts } = relays(['accept', 'accept']);
    await backUp(CODE, TEXT, opts);
    expect(await restore('7KQ2MX9PDB', opts)).toEqual({ ok: false, reason: 'not-found' });
  });

  it('offline, or every relay silent: the servers could not be reached (not "no backup")', async () => {
    expect(await restore(CODE, relays(['down', 'down', 'down']).opts)).toEqual({
      ok: false,
      reason: 'servers',
    });
    expect(await restore(CODE, relays(['silent', 'silent']).opts)).toEqual({ ok: false, reason: 'servers' });
  });

  it('one relay answering is enough to say there is no backup', async () => {
    expect(await restore(CODE, relays(['down', 'accept', 'silent']).opts)).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it('does not wait for the slowest relay once a valid copy is in (plus its short grace)', async () => {
    const { opts } = relays(['accept', 'silent', 'silent']);
    await backUp(CODE, TEXT, { ...opts, relays: [opts!.relays![0] as string] });
    const t0 = Date.now();
    expect(await restore(CODE, { ...opts, timeoutMs: 2000, graceMs: 20 })).toMatchObject({ ok: true });
    expect(Date.now() - t0).toBeLessThan(1500);
  });
});
