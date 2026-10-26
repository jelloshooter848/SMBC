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
