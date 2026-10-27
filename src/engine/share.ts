import { shareBase } from './site';

/**
 * Encode text into a compact URL-safe string and back. Uses deflate via CompressionStream
 * when available ("z" prefix), otherwise plain base64url ("r" prefix).
 */
function toBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

type ByteTransform = ReadableWritablePair<Uint8Array, Uint8Array>;

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const src = new Blob([bytes as BlobPart]).stream().pipeThrough(stream as unknown as ByteTransform);
  return new Uint8Array(await new Response(src).arrayBuffer());
}

export async function encodeShare(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  if (typeof CompressionStream !== 'undefined') {
    try {
      return 'z' + toBase64Url(await pipe(bytes, new CompressionStream('deflate-raw')));
    } catch {
      /* fall through to the uncompressed form */
    }
  }
  return 'r' + toBase64Url(bytes);
}

/**
 * `maxBytes` (Music Lab's song links, 0.4.77; level links, 0.5.0): the most bytes the text may
 * come to; a link that inflates past it is refused ("too big") without inflating the rest. Left
 * out: no limit.
 */
export async function decodeShare(code: string, maxBytes = Infinity): Promise<string> {
  const kind = code[0];
  const body = fromBase64Url(code.slice(1));
  if (kind === 'z') {
    if (typeof DecompressionStream === 'undefined')
      throw new Error('this browser cannot decompress shared links');
    if (maxBytes === Infinity)
      return new TextDecoder().decode(await pipe(body, new DecompressionStream('deflate-raw')));
    return new TextDecoder().decode(await inflateCapped(body, maxBytes));
  }
  if (kind === 'r') {
    if (body.length > maxBytes) throw new Error('shared link too big');
    return new TextDecoder().decode(body);
  }
  throw new Error('unknown share code');
}

/**
 * The most a level link may inflate to (0.5.0): far above any real level. The largest built-in
 * level (Lost Levels 5-1) is about 19 KB of text and an editor level at its widest (1,024 tiles)
 * about 28 KB, so this is some seventy times that, and still a sliver of the browser's storage.
 */
export const MAX_LEVEL_LINK_BYTES = 2_000_000;

/** A level link's text (`#level=<code>`), capped at MAX_LEVEL_LINK_BYTES. */
export function decodeLevelShare(code: string): Promise<string> {
  return decodeShare(code, MAX_LEVEL_LINK_BYTES);
}

/** How much compressed link the decompressor is given at a time (item 257). */
const INFLATE_CHUNK = 1024;

/**
 * Inflates `body`, stopping (and throwing) once it passes `cap` bytes (as nostr-backup's
 * decodePayload). The body goes in about 1 KB at a time, the cap checked between writes (item
 * 257), so a small link that inflates hugely is stopped after a chunk or two, not handed over whole.
 */
async function inflateCapped(body: Uint8Array, cap: number): Promise<Uint8Array> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  let over = false;
  /** Called by the reader on each piece it takes: the next chunk may go in. */
  let took: (() => void) | null = null;
  void (async () => {
    for (let at = 0; at < body.length; at += INFLATE_CHUNK) {
      const taken = new Promise<void>((r) => (took = r));
      await writer.write(body.subarray(at, at + INFLATE_CHUNK) as BufferSource);
      // The reader takes (and measures) what that chunk made before the next goes in; a
      // decompressor that buffers its input, as Node's does, would otherwise take it all at once.
      // A chunk that makes nothing yet waits only a moment.
      await Promise.race([taken, new Promise((r) => setTimeout(r, 20))]);
      if (over) return;
    }
    await writer.close();
  })().catch(() => {});
  const reader = ds.readable.getReader();
  const parts: Uint8Array[] = [];
  let n = 0;
  for (;;) {
    const { done, value } = (await reader.read()) as { done: boolean; value?: Uint8Array };
    if (done) break;
    if (!value) continue;
    n += value.length;
    if (n > cap) {
      over = true;
      await reader.cancel().catch(() => {});
      throw new Error('shared link too big');
    }
    parts.push(value);
    (took as (() => void) | null)?.();
  }
  const all = new Uint8Array(n);
  let at = 0;
  for (const p of parts) {
    all.set(p, at);
    at += p.length;
  }
  return all;
}

/**
 * The level editor's share link: this page's address with `#level=<code>`, without its query or
 * hash; on the public site when the page is the downloaded copy (file://, engine/site.ts).
 */
export function levelLink(code: string, href: string): string {
  return shareLink('level', code, href);
}

/** Music Lab's share link (0.4.77, item 136): as levelLink, with `#song=<code>`. */
export function songLink(code: string, href: string): string {
  return shareLink('song', code, href);
}

/** The code of a `#song=` link's hash, or null when the hash is not one. */
export function songCode(hash: string): string | null {
  return /^#song=([A-Za-z0-9_-]+)$/.exec(hash)?.[1] ?? null;
}

/**
 * A `#song=` link's code, read once: the hash is taken off the address (history.replaceState), so
 * a reload doesn't open the song again. Null, and nothing changed, for any other hash.
 */
export function takeSongCode(win: {
  location: { hash: string; pathname: string; search: string };
  history: { replaceState(state: unknown, title: string, url: string): void };
}): string | null {
  const code = songCode(win.location.hash);
  if (code === null) return null;
  try {
    win.history.replaceState(null, '', win.location.pathname + win.location.search);
  } catch {
    /* the link opens anyway */
  }
  return code;
}

function shareLink(kind: 'level' | 'song', code: string, href: string): string {
  const url = new URL(shareBase(href));
  url.search = '';
  url.hash = `${kind}=${code}`;
  return url.toString();
}
