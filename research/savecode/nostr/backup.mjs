/*
 * Research prototype (not game code): back up a save as text on Nostr relays, found again by a
 * short code the player keeps.
 *
 * The code is 10 random Crockford Base32 characters (50 bits), shown as two groups of five
 * ('7KQ2M-X9PDA'). Typing is forgiving the way save codes already are: any case, dashes and
 * spaces ignored, O read as 0, I and L as 1.
 *
 * The code is not looked up anywhere: it IS the key. scrypt(code) gives a Nostr secret key; its
 * public key is the author to ask the relays for. So the player only ever keeps the code, and
 * uploading again with the same code replaces the backup (kind 30078 is replaceable per author
 * and 'd' tag, NIP-78 "application-specific data", which clients do not show as posts).
 *
 * The save text is encrypted to that same key (NIP-44), so a relay or anyone reading relays sees
 * an opaque blob, not a child's save. Anyone who has the code can read it, and could replace it:
 * the same as handing someone a save code today.
 *
 * Everything here runs in a browser as is; relays are reached with whatever WebSocket class the
 * caller passes (the browser's own, or `ws` in Node).
 */
import { finalizeEvent, getPublicKey, verifyEvent } from 'nostr-tools/pure';
import * as nip44 from 'nostr-tools/nip44';
import { scryptAsync } from '@noble/hashes/scrypt.js';
import { sha256 } from '@noble/hashes/sha2.js';

export const KIND = 30078;
export const D_TAG = 'smbc-remix/backup/v1';
const SALT = 'smbc-remix/backup/v1';
/** scrypt cost: 2^15 × 8 × 128 B = 32 MB, a few hundred ms per derive (measured in demo.mjs). */
export const SCRYPT = { N: 2 ** 15, r: 8, p: 1, dkLen: 32 };
export const CODE_CHARS = 10;
/** NIP-44 encrypts at most 65,535 bytes; relays often cap whole events near 64 KB. */
export const MAX_SAVE_BYTES = 40_000;

const BASE32 = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const READ_AS = { O: '0', I: '1', L: '1' };

/** A new random backup code, 'XXXXX-XXXXX'. */
export function newBackupCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(CODE_CHARS));
  const chars = [...bytes].map((b) => BASE32[b & 31]).join('');
  return `${chars.slice(0, 5)}-${chars.slice(5)}`;
}

/** Typed text → the code's 10 canonical characters, or null if it isn't one. */
export function normalizeCode(text) {
  let out = '';
  for (const ch of String(text)) {
    if (ch === '-' || /\s/.test(ch)) continue;
    const up = ch.toUpperCase();
    const c = READ_AS[up] ?? up;
    if (!BASE32.includes(c)) return null;
    out += c;
  }
  return out.length === CODE_CHARS ? out : null;
}

const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

const keyCache = new Map();
/** The code's Nostr keys (secret key bytes, public key hex); derived once per code. */
export function keysFromCode(code) {
  const c = normalizeCode(code);
  if (!c) return Promise.reject(new Error('not a backup code'));
  if (!keyCache.has(c)) keyCache.set(c, deriveKeys(c));
  return keyCache.get(c);
}
async function deriveKeys(c) {
  let sk = await scryptAsync(new TextEncoder().encode(c), new TextEncoder().encode(SALT), SCRYPT);
  // a 32-byte string is a valid secp256k1 secret key except with probability ~2^-128
  for (;;) {
    try {
      return { sk, pk: getPublicKey(sk) };
    } catch {
      sk = sha256(sk);
    }
  }
}

/** The signed, encrypted backup event for `saveText`. */
export async function makeBackupEvent(code, saveText, now = Math.floor(Date.now() / 1000)) {
  if (new TextEncoder().encode(saveText).length > MAX_SAVE_BYTES) throw new Error('save too large for one event');
  const { sk, pk } = await keysFromCode(code);
  const content = nip44.encrypt(saveText, nip44.getConversationKey(sk, pk));
  return finalizeEvent({ kind: KIND, created_at: now, tags: [['d', D_TAG]], content }, sk);
}

/** The relay filter that finds a code's backup. */
export async function backupFilter(code) {
  const { pk } = await keysFromCode(code);
  return { kinds: [KIND], authors: [pk], '#d': [D_TAG], limit: 5 };
}

/** The save text in `event`, if it is this code's backup (signature, author, kind, tag and decryption all checked); else null. */
export async function openBackupEvent(code, event) {
  const { sk, pk } = await keysFromCode(code);
  if (!event || event.pubkey !== pk || event.kind !== KIND) return null;
  if (!event.tags?.some((t) => t[0] === 'd' && t[1] === D_TAG)) return null;
  if (!verifyEvent(event)) return null;
  try {
    return nip44.decrypt(event.content, nip44.getConversationKey(sk, pk));
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ relays (NIP-01 over WebSocket)

function connect(url, WebSocketClass, timeoutMs) {
  return new Promise((resolve, reject) => {
    let ws;
    try {
      ws = new WebSocketClass(url);
    } catch (e) {
      reject(e);
      return;
    }
    const t = setTimeout(() => {
      try {
        ws.close();
      } catch {}
      reject(new Error('timeout'));
    }, timeoutMs);
    ws.onopen = () => {
      clearTimeout(t);
      resolve(ws);
    };
    ws.onerror = (e) => {
      clearTimeout(t);
      // browsers give no reason; Node's ws does (e.g. 'Unexpected server response: 403')
      reject(new Error(e?.message ? `connection failed: ${e.message}` : 'connection failed'));
    };
  });
}

/** Sends `event` to each relay; resolves with each relay's answer ({ url, ok, message }). */
export function publish(urls, event, { WebSocket: W = globalThis.WebSocket, timeoutMs = 8000 } = {}) {
  return Promise.all(
    urls.map(async (url) => {
      let ws;
      const notices = [];
      const t0 = performance.now();
      try {
        ws = await connect(url, W, timeoutMs);
        // NOTICE and AUTH frames are kept so a refusal can be explained (size limits, auth or payment required)
        const answer = await new Promise((resolve) => {
          const t = setTimeout(() => resolve({ ok: false, message: 'no OK within timeout' }), timeoutMs);
          // a relay that drops the socket (e.g. 1009, frame too big) answers with the close code
          ws.onclose = (e) => {
            clearTimeout(t);
            resolve({ ok: false, message: `socket closed ${e.code}${e.reason ? ` ${e.reason}` : ''}` });
          };
          ws.onmessage = (m) => {
            let msg;
            try {
              msg = JSON.parse(typeof m.data === 'string' ? m.data : m.data.toString());
            } catch {
              return;
            }
            if (msg[0] === 'NOTICE' || msg[0] === 'AUTH') notices.push(`${msg[0]} ${String(msg[1] ?? '').slice(0, 200)}`);
            if (msg[0] === 'OK' && msg[1] === event.id) {
              clearTimeout(t);
              resolve({ ok: msg[2] === true, message: String(msg[3] ?? '') });
            }
          };
          ws.send(JSON.stringify(['EVENT', event]));
        });
        return { url, ...answer, ms: Math.round(performance.now() - t0), ...(notices.length ? { notices } : {}) };
      } catch (e) {
        return { url, ok: false, message: e.message, ...(notices.length ? { notices } : {}) };
      } finally {
        try {
          ws?.close();
        } catch {}
      }
    }),
  );
}

/** Every event each relay returns for `filter` (until its EOSE or the timeout). */
export function query(urls, filter, { WebSocket: W = globalThis.WebSocket, timeoutMs = 8000 } = {}) {
  return Promise.all(
    urls.map(async (url) => {
      let ws;
      const notices = [];
      const t0 = performance.now();
      try {
        ws = await connect(url, W, timeoutMs);
        const events = await new Promise((resolve) => {
          const got = [];
          const sub = 'b' + Math.random().toString(36).slice(2, 10);
          const t = setTimeout(() => resolve(got), timeoutMs);
          ws.onclose = (e) => {
            notices.push(`socket closed ${e.code}`);
            clearTimeout(t);
            resolve(got);
          };
          ws.onmessage = (m) => {
            let msg;
            try {
              msg = JSON.parse(typeof m.data === 'string' ? m.data : m.data.toString());
            } catch {
              return;
            }
            if (msg[0] === 'NOTICE' || msg[0] === 'AUTH') notices.push(`${msg[0]} ${String(msg[1] ?? '').slice(0, 200)}`);
            if (msg[1] !== sub) return;
            if (msg[0] === 'EVENT' && got.length < 20) got.push(msg[2]);
            if (msg[0] === 'CLOSED') notices.push(`CLOSED ${String(msg[2] ?? '')}`);
            if (msg[0] === 'EOSE' || msg[0] === 'CLOSED') {
              clearTimeout(t);
              resolve(got);
            }
          };
          ws.send(JSON.stringify(['REQ', sub, filter]));
        });
        return { url, events, ms: Math.round(performance.now() - t0), ...(notices.length ? { notices } : {}) };
      } catch (e) {
        return { url, events: [], error: e.message, ...(notices.length ? { notices } : {}) };
      } finally {
        try {
          ws?.close();
        } catch {}
      }
    }),
  );
}

/** Backs `saveText` up under `code` on `relays`; ok when at least one relay accepted it. */
export async function backup(code, saveText, relays, opts) {
  const event = await makeBackupEvent(code, saveText, opts?.now);
  const results = await publish(relays, event, opts);
  return { ok: results.some((r) => r.ok), event, results };
}

/** The newest valid backup for `code` across `relays` ({ saveText, createdAt, from }), or null. */
export async function restore(code, relays, opts) {
  const filter = await backupFilter(code);
  const answers = await query(relays, filter, opts);
  let best = null;
  for (const { url, events } of answers)
    for (const ev of events) {
      if (best && ev.created_at <= best.createdAt) continue;
      const saveText = await openBackupEvent(code, ev);
      if (saveText !== null) best = { saveText, createdAt: ev.created_at, from: url, id: ev.id };
    }
  return { best, answers };
}
