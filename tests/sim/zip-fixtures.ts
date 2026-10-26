import { deflateRawSync } from 'node:zlib';
import { refCrc32 } from './save-data-helpers';

/*
 * Hand-built zip files for the zip reader's tests (item 141): what other tools write (deflated
 * entries, folders, a top-level folder, macOS's __MACOSX extras) and what a broken or hostile
 * file holds (a wrong CRC, a lying size, ../ paths, encryption, zip64 markers). Each field can be
 * overridden, so a test can say exactly what is wrong with its file.
 */

export interface FixtureEntry {
  name: string;
  data?: Uint8Array | string;
  /** 0 stored, 8 deflate (default: stored). */
  method?: number;
  /** General purpose flags (default 0x0800, UTF-8 names). */
  flags?: number;
  crc?: number;
  /** The uncompressed size written in the headers (default: the real one). */
  usize?: number;
  /** The compressed bytes to store instead of the real ones. */
  raw?: Uint8Array;
  /** The local header offset the directory gives (default: where the entry really is). */
  localAt?: number;
  /** The name's bytes as stored (a CP437 name), instead of `name` in UTF-8. */
  nameBytes?: Uint8Array;
}

const enc = (d: Uint8Array | string | undefined) =>
  typeof d === 'string' ? new TextEncoder().encode(d) : (d ?? new Uint8Array(0));

/** A zip of `entries` (local headers, data, central directory, end record). */
export function buildZip(
  entries: FixtureEntry[],
  opts: { eocdCount?: number; zip64?: boolean; comment?: string } = {},
): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    const data = enc(e.data);
    const method = e.method ?? 0;
    const body = e.raw ?? (method === 8 ? new Uint8Array(deflateRawSync(data)) : data);
    const name = e.nameBytes ?? new TextEncoder().encode(e.name);
    const crc = e.crc ?? refCrc32(data);
    const usize = e.usize ?? data.length;
    const flags = e.flags ?? 0x0800;
    const local = new Uint8Array(30 + name.length);
    const lv = new DataView(local.buffer);
    lv.setUint32(0, 0x04034b50, true);
    lv.setUint16(4, 20, true);
    lv.setUint16(6, flags, true);
    lv.setUint16(8, method, true);
    lv.setUint32(14, crc, true);
    lv.setUint32(18, opts.zip64 ? 0xffffffff : body.length, true);
    lv.setUint32(22, opts.zip64 ? 0xffffffff : usize, true);
    lv.setUint16(26, name.length, true);
    local.set(name, 30);
    const c = new Uint8Array(46 + name.length);
    const cv = new DataView(c.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, flags, true);
    cv.setUint16(10, method, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, opts.zip64 ? 0xffffffff : body.length, true);
    cv.setUint32(24, opts.zip64 ? 0xffffffff : usize, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, e.localAt ?? offset, true);
    c.set(name, 46);
    parts.push(local, body);
    central.push(c);
    offset += local.length + body.length;
  }
  const cdSize = central.reduce((n, c) => n + c.length, 0);
  const comment = new TextEncoder().encode(opts.comment ?? '');
  const end = new Uint8Array(22 + comment.length);
  const ev = new DataView(end.buffer);
  ev.setUint16(20, comment.length, true);
  end.set(comment, 22);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, opts.eocdCount ?? entries.length, true);
  ev.setUint16(10, opts.eocdCount ?? entries.length, true);
  ev.setUint32(12, cdSize, true);
  ev.setUint32(16, offset, true);
  const all = [...parts, ...central, end];
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of all) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}
