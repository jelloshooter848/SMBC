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

export async function decodeShare(code: string): Promise<string> {
  const kind = code[0];
  const body = fromBase64Url(code.slice(1));
  if (kind === 'z') {
    if (typeof DecompressionStream === 'undefined')
      throw new Error('this browser cannot decompress shared levels');
    return new TextDecoder().decode(await pipe(body, new DecompressionStream('deflate-raw')));
  }
  if (kind === 'r') return new TextDecoder().decode(body);
  throw new Error('unknown share code');
}
