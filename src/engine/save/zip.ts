/*
 * A small store-only zip writer (no compression, no runtime dependencies): the asset packs a
 * backup exports (`<name>.zip`) and the pack template are written with it. Every entry is
 * stored as is with its CRC-32 and a UTF-8 name; no zip64, so at most 65,535 entries and 4 GiB.
 */

let table: Uint32Array | null = null;

/** The CRC-32 (IEEE 802.3, as zip uses) of `data`. */
export function crc32(data: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c >>> 0;
    }
  }
  const t = table;
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = (t[(c ^ (data[i] as number)) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipEntry {
  /** The path inside the zip: relative, `/` between folders, no `..`. */
  path: string;
  data: Uint8Array | string;
}

/** Whether `path` is safe to unzip anywhere: relative, forward slashes, no empty or parent part. */
export function safeZipPath(path: string): boolean {
  if (!path || path.includes('\\') || path.startsWith('/') || /^[A-Za-z]:/.test(path)) return false;
  return path.split('/').every((p) => p !== '' && p !== '.' && p !== '..');
}

/** MS-DOS time and date, as zip headers keep them (local time, two-second steps). */
function dosTime(d: Date): { time: number; date: number } {
  const y = Math.max(1980, Math.min(2107, d.getFullYear()));
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1),
    date: ((y - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** A zip of `entries`, in their order, each stored (method 0) and stamped `when`. */
export function makeZip(entries: readonly ZipEntry[], when: Date = new Date()): Uint8Array {
  if (entries.length > 0xffff) throw new Error('too many files for a zip');
  const enc = new TextEncoder();
  const seen = new Set<string>();
  const { time, date } = dosTime(when);
  const parts: { name: Uint8Array; data: Uint8Array; crc: number; offset: number }[] = [];
  let offset = 0;
  for (const e of entries) {
    if (!safeZipPath(e.path)) throw new Error(`unsafe zip path "${e.path}"`);
    if (seen.has(e.path)) throw new Error(`"${e.path}" is in the zip twice`);
    seen.add(e.path);
    const name = enc.encode(e.path);
    const data = typeof e.data === 'string' ? enc.encode(e.data) : e.data;
    parts.push({ name, data, crc: crc32(data), offset });
    offset += 30 + name.length + data.length;
    if (offset > 0xffffffff) throw new Error('zip too big');
  }
  const cdSize = parts.reduce((n, p) => n + 46 + p.name.length, 0);
  const out = new Uint8Array(offset + cdSize + 22);
  const v = new DataView(out.buffer);
  const header = (at: number, p: (typeof parts)[number], central: boolean): number => {
    let o = at;
    v.setUint32(o, central ? 0x02014b50 : 0x04034b50, true);
    o += 4;
    if (central) {
      v.setUint16(o, 20, true); // made by: version 2.0
      o += 2;
    }
    v.setUint16(o, 20, true); // version needed
    v.setUint16(o + 2, 0x0800, true); // UTF-8 names
    v.setUint16(o + 4, 0, true); // stored
    v.setUint16(o + 6, time, true);
    v.setUint16(o + 8, date, true);
    v.setUint32(o + 10, p.crc, true);
    v.setUint32(o + 14, p.data.length, true);
    v.setUint32(o + 18, p.data.length, true);
    v.setUint16(o + 22, p.name.length, true);
    v.setUint16(o + 24, 0, true); // extra
    o += 26;
    if (central) {
      // comment, disk, internal and external attributes, local header offset
      v.setUint16(o, 0, true);
      v.setUint16(o + 2, 0, true);
      v.setUint16(o + 4, 0, true);
      v.setUint32(o + 6, 0, true);
      v.setUint32(o + 10, p.offset, true);
      o += 14;
    }
    out.set(p.name, o);
    return o + p.name.length;
  };
  for (const p of parts) out.set(p.data, header(p.offset, p, false));
  let o = offset;
  for (const p of parts) o = header(o, p, true);
  v.setUint32(o, 0x06054b50, true);
  v.setUint16(o + 4, 0, true);
  v.setUint16(o + 6, 0, true);
  v.setUint16(o + 8, parts.length, true);
  v.setUint16(o + 10, parts.length, true);
  v.setUint32(o + 12, cdSize, true);
  v.setUint32(o + 16, offset, true);
  v.setUint16(o + 20, 0, true);
  return out;
}

/*
 * The reader (item 141: Import pack (.zip) on every device). It reads what zip tools write:
 * stored entries, and deflated ones through the browser's DecompressionStream('deflate-raw')
 * (no dependencies). It is strict: ../ and absolute paths are refused (a backslash counts as a
 * folder, as old PowerShell zips write them), the entry count and the unpacked size are capped
 * (zip bombs), the latter both as declared and as actually inflated, and each entry's CRC is
 * checked when it is read. Folder entries and macOS's extras (__MACOSX/, .DS_Store) are skipped.
 * The directory is read whole first; an entry's data is inflated only by its read(), so a pack
 * import inflates only its manifest and the files the manifest names (a phone's memory).
 */

/** Why a zip was not read. */
export type ZipErrorCode =
  | 'not-zip'
  | 'damaged'
  | 'crc'
  | 'unsafe-path'
  | 'too-many'
  | 'too-big'
  | 'unsupported'
  | 'method'
  | 'no-deflate';

export class ZipError extends Error {
  constructor(
    readonly code: ZipErrorCode,
    message: string = code,
  ) {
    super(message);
    this.name = 'ZipError';
  }
}

/** At most this many entries (a template holds about two per sprite sheet). */
export const ZIP_MAX_ENTRIES = 4096;
/** At most this many bytes unpacked, in all. */
export const ZIP_MAX_TOTAL = 128 * 1024 * 1024;

export interface ZipLimits {
  maxEntries?: number;
  maxTotal?: number;
}

export interface UnzippedEntry {
  path: string;
  /** Its unpacked size, as the directory gives it. */
  size: number;
  /** Its bytes, inflated and checked now (throws ZipError). A stored entry is a view, not a copy. */
  read(): Promise<Uint8Array>;
}

/** A path zip tools add that is never the pack's own file. */
const junk = (path: string): boolean => path.startsWith('__MACOSX/') || path.split('/').pop() === '.DS_Store';

/** Code page 437's upper half: what a name means without the UTF-8 flag (Windows' own zips). */
const CP437_HIGH =
  'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';

function cp437(b: Uint8Array): string {
  let out = '';
  for (const c of b) out += c < 0x80 ? String.fromCharCode(c) : (CP437_HIGH[c - 0x80] as string);
  return out;
}

/** Inflates raw deflate `data` to exactly `size` bytes; more than `size` is a lying header. */
async function inflate(data: Uint8Array, size: number): Promise<Uint8Array> {
  const DS = (globalThis as { DecompressionStream?: new (f: string) => TransformStream }).DecompressionStream;
  let ds: TransformStream;
  try {
    if (typeof DS !== 'function') throw new Error('none');
    ds = new DS('deflate-raw');
  } catch {
    throw new ZipError('no-deflate');
  }
  const out = new Uint8Array(size);
  let at = 0;
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  const fed = writer.write(data as BufferSource).then(() => writer.close());
  fed.catch(() => {});
  try {
    for (;;) {
      const { done, value } = (await reader.read()) as { done: boolean; value?: Uint8Array };
      if (done) break;
      if (!value) continue;
      if (at + value.length > size) {
        await reader.cancel().catch(() => {});
        throw new ZipError('damaged', 'an entry inflates past its size');
      }
      out.set(value, at);
      at += value.length;
    }
    await fed;
  } catch (e) {
    if (e instanceof ZipError) throw e;
    throw new ZipError('damaged', 'an entry does not inflate');
  }
  if (at !== size) throw new ZipError('damaged', 'an entry inflates short');
  return out;
}

/** The end record: the one whose comment runs exactly to the end of the file. */
function findEnd(bytes: Uint8Array, v: DataView): number {
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 22 - 0xffff); i--)
    if (v.getUint32(i, true) === 0x06054b50 && i + 22 + v.getUint16(i + 20, true) === bytes.length) return i;
  return -1;
}

/**
 * The files in zip `bytes`: the directory checked whole now (paths, caps, kinds), each file's
 * data only when read. Throws ZipError.
 */
export async function unzip(bytes: Uint8Array, limits: ZipLimits = {}): Promise<UnzippedEntry[]> {
  const maxEntries = limits.maxEntries ?? ZIP_MAX_ENTRIES;
  const maxTotal = limits.maxTotal ?? ZIP_MAX_TOTAL;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEnd(bytes, v);
  if (eocd < 0) throw new ZipError('not-zip');
  if (v.getUint16(eocd + 4, true) !== 0 || v.getUint16(eocd + 6, true) !== 0)
    throw new ZipError('unsupported', 'a zip split over several files');
  const count = v.getUint16(eocd + 10, true);
  const cdSize = v.getUint32(eocd + 12, true);
  const cdAt = v.getUint32(eocd + 16, true);
  if (count === 0xffff || cdSize === 0xffffffff || cdAt === 0xffffffff)
    throw new ZipError('unsupported', 'zip64');
  if (count > maxEntries) throw new ZipError('too-many');
  if (cdAt + cdSize > eocd) throw new ZipError('damaged', 'the directory is out of place');
  const utf8 = new TextDecoder('utf-8');
  const seen = new Set<string>();
  const out: UnzippedEntry[] = [];
  /** Each entry's bytes, header to data end: two that overlap are a zip bomb's trick. */
  const spans: [number, number][] = [];
  let total = 0;
  let p = cdAt;
  for (let i = 0; i < count; i++) {
    if (p + 46 > eocd || v.getUint32(p, true) !== 0x02014b50)
      throw new ZipError('damaged', 'a directory entry');
    const flags = v.getUint16(p + 8, true);
    const method = v.getUint16(p + 10, true);
    const crc = v.getUint32(p + 16, true);
    const csize = v.getUint32(p + 20, true);
    const usize = v.getUint32(p + 24, true);
    const nlen = v.getUint16(p + 28, true);
    const xlen = v.getUint16(p + 30, true);
    const clen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    if (p + 46 + nlen > eocd) throw new ZipError('damaged', 'a directory entry');
    const nameBytes = bytes.subarray(p + 46, p + 46 + nlen);
    // Bit 11: a UTF-8 name; without it, code page 437. A backslash is a folder (old PowerShell).
    const path = (flags & 0x0800 ? utf8.decode(nameBytes) : cp437(nameBytes)).replace(/\\/g, '/');
    p += 46 + nlen + xlen + clen;
    if (flags & 0x0001) throw new ZipError('unsupported', 'an encrypted entry');
    if (csize === 0xffffffff || usize === 0xffffffff || local === 0xffffffff)
      throw new ZipError('unsupported', 'zip64');
    if (path.endsWith('/') && usize === 0) continue;
    if (!safeZipPath(path)) throw new ZipError('unsafe-path', `unsafe path "${path}"`);
    if (junk(path)) continue;
    if (method !== 0 && method !== 8) throw new ZipError('method', `compression method ${method}`);
    if (method === 0 && csize !== usize) throw new ZipError('damaged', "a stored file's sizes differ");
    if (seen.has(path)) throw new ZipError('damaged', `"${path}" is in the zip twice`);
    seen.add(path);
    total += usize;
    if (total > maxTotal) throw new ZipError('too-big');
    if (local + 30 > cdAt || v.getUint32(local, true) !== 0x04034b50)
      throw new ZipError('damaged', 'a file header');
    const start = local + 30 + v.getUint16(local + 26, true) + v.getUint16(local + 28, true);
    if (start + csize > cdAt) throw new ZipError('damaged', 'a file runs past the directory');
    spans.push([local, start + csize]);
    out.push({
      path,
      size: usize,
      async read() {
        const raw = bytes.subarray(start, start + csize);
        const data = method === 0 ? raw : await inflate(raw, usize);
        if (crc32(data) !== crc) throw new ZipError('crc', `"${path}" is damaged`);
        return data;
      },
    });
  }
  spans.sort((x, y) => x[0] - y[0]);
  for (let i = 1; i < spans.length; i++)
    if ((spans[i] as [number, number])[0] < (spans[i - 1] as [number, number])[1])
      throw new ZipError('damaged', 'two entries share their bytes');
  return out;
}
