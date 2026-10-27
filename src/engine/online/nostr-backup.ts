import { finalizeEvent, getPublicKey, verifyEvent, type Event } from 'nostr-tools/pure';
import * as nip44 from 'nostr-tools/nip44';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { encodeShare } from '../share';
import { MAX_BACKUP_CHARS } from '../save/backup';
import {
  MIN_ACCEPTS,
  newBackupCode,
  normalizeBackupCode,
  type BackUpResult,
  type DeleteResult,
  type OnlineApi,
  type RestoreResult,
} from './online-backup';

/*
 * Online backup over Nostr (owner item 159), loaded ONLY through import() when a Save data row is
 * used (owner item 160: these packages are the game's only runtime dependencies, pinned exactly).
 * From the research prototype (research/savecode/nostr/backup.mjs on claude/savecode-research),
 * measured against live relays there.
 *
 * - The code is the key: scrypt(code) → a Nostr secret key, whose public key is the author to ask
 *   the relays for. Nothing is looked up by the code itself.
 * - The backup is a kind-30078 event (NIP-78 application data, not shown as a post) with
 *   d = smbc-remix/backup/v1: replaceable, so backing up again with the code replaces it.
 * - Its content: the backup file's text, deflated (engine/share.ts's encodeShare), encrypted to
 *   that same key (NIP-44). Relays see an anonymous key, the time, and an opaque blob.
 * - Sent to the 5 built-in relays at once; backed up when at least 2 accept.
 * - Restore asks every relay at once (each with its own timeout) and keeps the first VALID copy
 *   (author, kind, tag, signature, decryption and inflation all checked), waiting a moment more
 *   for a newer one from another relay.
 */

/** The relays (research/savecode/nostr/README.md "Recommended defaults": all 5 took 64 KB events). */
export const RELAYS: readonly string[] = [
  'wss://relay.primal.net',
  'wss://nos.lol',
  'wss://nostr.mom',
  'wss://nostr-pub.wellorder.net',
  'wss://nostr.oxtr.dev',
];

export const KIND = 30078;
export const D_TAG = 'smbc-remix/backup/v1';
const SALT = 'smbc-remix/backup/v1';
/** scrypt cost: 2^15 × 8 × 128 B = 32 MB, about 0.2 s in Node, up to about 1 s on a phone. */
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, dkLen: 32 };
/**
 * The largest event sent: nos.lol and nostr.mom refuse events over 64 KB (65,536 bytes; M in
 * the research), so this leaves about 5 KB of margin for their counting.
 */
export const EVENT_MAX_BYTES = 60_000;
/** NIP-44 encrypts at most this many bytes. */
const NIP44_MAX = 65_535;

/** Whatever WebSocket the caller gives (the browser's; a test's fake). */
type SocketClass = new (url: string) => {
  onopen: (() => void) | null;
  onmessage: ((m: { data: unknown }) => void) | null;
  onerror: ((e: unknown) => void) | null;
  onclose: ((e: { code?: number }) => void) | null;
  send(text: string): void;
  close(): void;
};

export interface RelayOptions {
  relays?: readonly string[];
  WebSocket?: unknown;
  /** Per relay: connecting plus its answer (backup 8 s, restore 3 s by default). */
  timeoutMs?: number;
  /** After the first valid copy, how long to wait for a newer one (restore). */
  graceMs?: number;
  /** The event's time (seconds; tests). */
  now?: number;
  /** The last backup's time: this one is at least a second later (a clock behind, the same second). */
  after?: number;
}

const enc = new TextEncoder();
const keyCache = new Map<string, Promise<{ sk: Uint8Array; pk: string }>>();

/** The code's Nostr keys, derived once per code (scrypt is the slow part). */
export function keysFromCode(code: string): Promise<{ sk: Uint8Array; pk: string }> {
  const c = normalizeBackupCode(code);
  if (!c) return Promise.reject(new Error('not a backup code'));
  let k = keyCache.get(c);
  if (!k) {
    k = (async () => {
      let sk = await scryptAsync(enc.encode(c), enc.encode(SALT), SCRYPT);
      // 32 random bytes are a valid secp256k1 key except with a chance of about 2^-128.
      for (;;) {
        try {
          return { sk, pk: getPublicKey(sk) };
        } catch {
          sk = sha256(sk);
        }
      }
    })();
    keyCache.set(c, k);
    // A failed derivation (out of memory on a phone) is not kept: the next try derives again.
    const failed = k;
    failed.catch(() => {
      if (keyCache.get(c) === failed) keyCache.delete(c);
    });
  }
  return k;
}

/** Too big for one event on the strictest relay. */
export class TooBigError extends Error {
  constructor() {
    super('too big for one online backup');
  }
}

/** The signed, encrypted backup event for `text`. Throws TooBigError. */
export async function makeBackupEvent(
  code: string,
  text: string,
  now = Math.floor(Date.now() / 1000),
): Promise<Event> {
  const payload = await encodeShare(text);
  if (enc.encode(payload).length > NIP44_MAX) throw new TooBigError();
  const { sk, pk } = await keysFromCode(code);
  const content = nip44.encrypt(payload, nip44.getConversationKey(sk, pk));
  const ev = finalizeEvent({ kind: KIND, created_at: now, tags: [['d', D_TAG]], content }, sk);
  if (enc.encode(JSON.stringify(ev)).length > EVENT_MAX_BYTES) throw new TooBigError();
  return ev;
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** engine/share.ts's payload back to text, inflating at most MAX_BACKUP_CHARS × 4 bytes. */
async function decodePayload(payload: string): Promise<string | null> {
  const cap = MAX_BACKUP_CHARS * 4;
  try {
    const body = fromBase64Url(payload.slice(1));
    if (payload[0] === 'r') return new TextDecoder('utf-8', { fatal: true }).decode(body);
    if (payload[0] !== 'z' || typeof DecompressionStream === 'undefined') return null;
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    void writer
      .write(body as BufferSource)
      .then(() => writer.close())
      .catch(() => {});
    const reader = ds.readable.getReader();
    const parts: Uint8Array[] = [];
    let n = 0;
    for (;;) {
      const { done, value } = (await reader.read()) as { done: boolean; value?: Uint8Array };
      if (done) break;
      if (!value) continue;
      n += value.length;
      if (n > cap) {
        await reader.cancel().catch(() => {});
        return null;
      }
      parts.push(value);
    }
    const all = new Uint8Array(n);
    let at = 0;
    for (const p of parts) {
      all.set(p, at);
      at += p.length;
    }
    return new TextDecoder('utf-8', { fatal: true }).decode(all);
  } catch {
    return null;
  }
}

/** What one event is, every part checked: this code's backup, its empty tombstone, or neither. */
type Opened = { kind: 'backup'; text: string } | { kind: 'deleted' } | null;

async function openEvent(code: string, event: unknown): Promise<Opened> {
  const { sk, pk } = await keysFromCode(code);
  const ev = event as Event | null;
  if (!ev || typeof ev !== 'object' || ev.pubkey !== pk || ev.kind !== KIND) return null;
  if (!Array.isArray(ev.tags) || !ev.tags.some((t) => Array.isArray(t) && t[0] === 'd' && t[1] === D_TAG))
    return null;
  try {
    // A clean copy: nostr-tools remembers a verified event on the object itself (a symbol key,
    // which a spread copies), so only the event's own fields are checked.
    const { id, pubkey, created_at, kind, tags, content, sig } = ev;
    if (!verifyEvent({ id, pubkey, created_at, kind, tags, content, sig })) return null;
    // Item 168: DELETE ONLINE COPY's empty tombstone.
    if (content === '') return { kind: 'deleted' };
    const text = await decodePayload(nip44.decrypt(content, nip44.getConversationKey(sk, pk)));
    return text === null ? null : { kind: 'backup', text };
  } catch {
    return null;
  }
}

/** The backup text in `event` when it is this code's backup, every part checked; else null. */
export async function openBackupEvent(code: string, event: unknown): Promise<string | null> {
  const o = await openEvent(code, event);
  return o?.kind === 'backup' ? o.text : null;
}

/** Opens a socket, or rejects (refused, a 503, offline, or no answer within `ms`). */
function connect(W: SocketClass, url: string, ms: number): Promise<InstanceType<SocketClass>> {
  return new Promise((resolve, reject) => {
    let ws: InstanceType<SocketClass>;
    try {
      ws = new W(url);
    } catch (e) {
      reject(e instanceof Error ? e : new Error('connection failed'));
      return;
    }
    const t = setTimeout(() => {
      try {
        ws.close();
      } catch {
        /* closing anyway */
      }
      reject(new Error('timeout'));
    }, ms);
    ws.onopen = () => {
      clearTimeout(t);
      resolve(ws);
    };
    ws.onerror = () => {
      clearTimeout(t);
      reject(new Error('connection failed'));
    };
  });
}

const parse = (data: unknown): unknown[] | null => {
  try {
    const m: unknown = JSON.parse(typeof data === 'string' ? data : String(data));
    return Array.isArray(m) ? m : null;
  } catch {
    return null;
  }
};

const socketClass = (o: RelayOptions): SocketClass => (o.WebSocket ?? globalThis.WebSocket) as SocketClass;

/** One relay's answer to a backup: took it, said no (and why), or never answered. */
type RelayAnswer = { kind: 'accepted' } | { kind: 'refused'; message: string } | { kind: 'unreached' };

/** Sends `event` to one relay. */
async function publishOne(W: SocketClass, url: string, ev: Event, ms: number): Promise<RelayAnswer> {
  let ws: InstanceType<SocketClass> | undefined;
  try {
    ws = await connect(W, url, ms);
    const sock = ws;
    return await new Promise<RelayAnswer>((resolve) => {
      const t = setTimeout(() => resolve({ kind: 'unreached' }), ms);
      sock.onclose = () => {
        clearTimeout(t);
        resolve({ kind: 'unreached' });
      };
      sock.onmessage = (m) => {
        const msg = parse(m.data);
        if (msg && msg[0] === 'OK' && msg[1] === ev.id) {
          clearTimeout(t);
          resolve(
            msg[2] === true ? { kind: 'accepted' } : { kind: 'refused', message: String(msg[3] ?? '') },
          );
        }
      };
      sock.send(JSON.stringify(['EVENT', ev]));
    });
  } catch {
    return { kind: 'unreached' };
  } finally {
    try {
      ws?.close();
    } catch {
      /* gone already */
    }
  }
}

/** BACK UP ONLINE: `text` under `code` on every relay at once; backed up when MIN_ACCEPTS take it. */
export async function backUp(code: string, text: string, o: RelayOptions = {}): Promise<BackUpResult> {
  const relays = o.relays ?? RELAYS;
  const total = relays.length;
  const now = o.now ?? Math.floor(Date.now() / 1000);
  const at = o.after !== undefined ? Math.max(now, Math.floor(o.after) + 1) : now;
  let ev: Event;
  try {
    ev = await makeBackupEvent(code, text, at);
  } catch (e) {
    if (e instanceof TooBigError) return { ok: false, reason: 'too-big', accepted: 0, total };
    throw e;
  }
  const W = socketClass(o);
  const answers = await Promise.all(relays.map((u) => publishOne(W, u, ev, o.timeoutMs ?? 8000)));
  const accepted = answers.filter((a) => a.kind === 'accepted').length;
  if (accepted >= MIN_ACCEPTS) return { ok: true, accepted, total, at };
  const refusals = answers.flatMap((a) => (a.kind === 'refused' ? [a.message] : []));
  // strfry says "replaced: have newer event"; other relays say "newer" or "duplicate".
  if (accepted === 0 && refusals.some((m) => /newer|replaced|duplicate/i.test(m)))
    return { ok: false, reason: 'newer', accepted, total };
  if (accepted === 0 && refusals.length) return { ok: false, reason: 'refused', accepted, total };
  return { ok: false, reason: 'servers', accepted, total };
}

/**
 * RESTORE FROM CODE: every relay asked at once; the first valid copy is kept, and a newer one
 * arriving within `graceMs` replaces it. 'servers' when no relay answered at all (offline, all
 * down or silent); 'not-found' when at least one answered without a valid copy.
 */
export async function restore(code: string, o: RelayOptions = {}): Promise<RestoreResult> {
  const relays = o.relays ?? RELAYS;
  const ms = o.timeoutMs ?? 3000;
  const grace = o.graceMs ?? 400;
  const { pk } = await keysFromCode(code);
  const filter = { kinds: [KIND], authors: [pk], '#d': [D_TAG], limit: 5 };
  const W = socketClass(o);
  let answered = 0;
  /** The newest valid event so far: a backup (its text) or a tombstone (null text). */
  let best: { text: string | null; at: number; from: string } | null = null;
  return new Promise<RestoreResult>((resolve) => {
    let left = relays.length;
    let graceTimer: ReturnType<typeof setTimeout> | null = null;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      if (graceTimer) clearTimeout(graceTimer);
      if (best?.text != null) resolve({ ok: true, text: best.text, from: best.from, at: best.at });
      else if (best) resolve({ ok: false, reason: 'deleted' });
      else resolve({ ok: false, reason: answered > 0 ? 'not-found' : 'servers' });
    };
    const offer = async (url: string, ev: unknown) => {
      const opened = await openEvent(code, ev);
      const at = (ev as { created_at?: number }).created_at ?? 0;
      if (opened === null || done) return;
      if (!best || at > best.at)
        best = { text: opened.kind === 'backup' ? opened.text : null, at, from: url };
      graceTimer ??= setTimeout(finish, grace);
    };
    for (const url of relays) {
      void (async () => {
        let ws: InstanceType<SocketClass> | undefined;
        const checks: Promise<void>[] = [];
        try {
          ws = await connect(W, url, ms);
          const sock = ws;
          const sub = `r${Math.random().toString(36).slice(2, 10)}`;
          const eose = await new Promise<boolean>((res) => {
            const t = setTimeout(() => res(false), ms);
            sock.onclose = () => {
              clearTimeout(t);
              res(false);
            };
            sock.onmessage = (m) => {
              const msg = parse(m.data);
              if (!msg || msg[1] !== sub) return;
              if (msg[0] === 'EVENT' && checks.length < 20) checks.push(offer(url, msg[2]));
              if (msg[0] === 'EOSE' || msg[0] === 'CLOSED') {
                clearTimeout(t);
                res(msg[0] === 'EOSE');
              }
            };
            sock.send(JSON.stringify(['REQ', sub, filter]));
          });
          if (eose) answered++;
          await Promise.all(checks);
        } catch {
          /* this relay is out: the others may answer */
        } finally {
          try {
            ws?.close();
          } catch {
            /* gone already */
          }
          if (--left === 0) finish();
        }
      })();
    }
  });
}

/**
 * DELETE ONLINE COPY (owner item 168): the backup replaced, on every relay, by an empty
 * tombstone (the same kind and d tag, so it replaces it; a restore reads it as deleted), and a
 * NIP-09 deletion request (kind 5, naming the address) for relays that honour one. Counted by
 * the tombstones taken. The code stays valid: a later backup replaces the tombstone.
 */
export async function deleteOnline(code: string, o: RelayOptions = {}): Promise<DeleteResult> {
  const relays = o.relays ?? RELAYS;
  const total = relays.length;
  const now = o.now ?? Math.floor(Date.now() / 1000);
  const at = o.after !== undefined ? Math.max(now, Math.floor(o.after) + 1) : now;
  const { sk, pk } = await keysFromCode(code);
  const tomb = finalizeEvent({ kind: KIND, created_at: at, tags: [['d', D_TAG]], content: '' }, sk);
  const request = finalizeEvent(
    {
      kind: 5,
      // A second before the tombstone (still after the last backup): NIP-09 `a` deletions take
      // every version up to AND including their own time, so the tombstone itself survives.
      created_at: at - 1,
      tags: [
        ['a', `${KIND}:${pk}:${D_TAG}`],
        ['k', String(KIND)],
      ],
      content: '',
    },
    sk,
  );
  const W = socketClass(o);
  const ms = o.timeoutMs ?? 8000;
  const answers = await Promise.all(
    relays.map(async (u) => {
      const a = await publishOne(W, u, tomb, ms);
      if (a.kind !== 'unreached') await publishOne(W, u, request, ms);
      return a;
    }),
  );
  const deleted = answers.filter((a) => a.kind === 'accepted').length;
  if (deleted > 0) return { ok: true, deleted, total, at };
  const refusals = answers.flatMap((a) => (a.kind === 'refused' ? [a.message] : []));
  if (refusals.some((m) => /newer|replaced|duplicate/i.test(m)))
    return { ok: false, reason: 'newer', deleted, total };
  if (refusals.length) return { ok: false, reason: 'refused', deleted, total };
  return { ok: false, reason: 'servers', deleted, total };
}

/** The browser's: the built-in relays through its own WebSocket. */
export function browserOnlineApi(): OnlineApi {
  return {
    newCode: () => newBackupCode(),
    backUp: (code, text, after) => backUp(code, text, after !== undefined ? { after } : {}),
    restore: (code) => restore(code),
    deleteOnline: (code, after) => deleteOnline(code, after !== undefined ? { after } : {}),
  };
}
