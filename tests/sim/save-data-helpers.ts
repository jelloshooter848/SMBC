/*
 * Test stand-ins for SAVE DATA (Options > Save data): a localStorage with every Storage method,
 * that can run out of room or refuse reads and writes on cue, and a reader for the store-only zip
 * files the game writes (signatures, sizes and CRC-32 all checked, as an unzip tool would).
 */

export class FakeStorage {
  readonly map = new Map<string, string>();
  /** Characters (keys plus values) the storage holds at most; past it setItem throws. */
  quota = Infinity;
  /** Every read throws (a browser with storage blocked). */
  throwOnRead = false;
  /** Every write throws (not a quota error: storage disabled). */
  throwOnWrite = false;
  /** Writes allowed before the next one throws a quota error, once (null: no limit). */
  writesLeft: number | null = null;
  /** Runs after each successful setItem (a second tab writing at that moment). */
  afterSet: ((key: string) => void) | null = null;

  get length(): number {
    if (this.throwOnRead) throw new Error('SecurityError: storage blocked');
    return this.map.size;
  }
  key(i: number): string | null {
    if (this.throwOnRead) throw new Error('SecurityError: storage blocked');
    return [...this.map.keys()][i] ?? null;
  }
  getItem(k: string): string | null {
    if (this.throwOnRead) throw new Error('SecurityError: storage blocked');
    return this.map.get(k) ?? null;
  }
  setItem(k: string, v: string): void {
    if (this.throwOnWrite) throw new Error('SecurityError: storage blocked');
    if (this.writesLeft !== null) {
      if (this.writesLeft <= 0) {
        this.writesLeft = null;
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      }
      this.writesLeft--;
    }
    const used = this.used() - (this.map.has(k) ? k.length + (this.map.get(k) as string).length : 0);
    if (used + k.length + String(v).length > this.quota)
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    this.map.set(k, String(v));
    this.afterSet?.(k);
  }
  removeItem(k: string): void {
    if (this.throwOnWrite) throw new Error('SecurityError: storage blocked');
    this.map.delete(k);
  }
  clear(): void {
    this.map.clear();
  }
  used(): number {
    let n = 0;
    for (const [k, v] of this.map) n += k.length + v.length;
    return n;
  }
  /** The contents as a plain object, sorted by key (for exact comparisons). */
  snapshot(filter: (k: string) => boolean = () => true): Record<string, string> {
    const out: Record<string, string> = {};
    for (const k of [...this.map.keys()].sort()) if (filter(k)) out[k] = this.map.get(k) as string;
    return out;
  }
}

/** Puts `s` in place as the page's localStorage. */
export function installStorage(s: FakeStorage): FakeStorage {
  (globalThis as { localStorage?: unknown }).localStorage = s;
  return s;
}

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

/** An independent CRC-32 (the test's own, so the writer's is checked against another). */
export function refCrc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of data) c = (CRC_TABLE[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

export interface ZipRead {
  path: string;
  data: Uint8Array;
  method: number;
  utf8: boolean;
}

/**
 * Reads a zip through its central directory, as unzip tools do, checking each local header
 * against it and each entry's CRC-32. Throws on anything malformed.
 */
export function readZip(bytes: Uint8Array): ZipRead[] {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--)
    if (v.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  if (eocd < 0) throw new Error('no end of central directory');
  const count = v.getUint16(eocd + 10, true);
  if (v.getUint16(eocd + 8, true) !== count) throw new Error('entry counts disagree');
  const cdSize = v.getUint32(eocd + 12, true);
  let p = v.getUint32(eocd + 16, true);
  if (p + cdSize !== eocd) throw new Error('central directory size is wrong');
  const dec = new TextDecoder('utf-8', { fatal: true });
  const out: ZipRead[] = [];
  for (let i = 0; i < count; i++) {
    if (v.getUint32(p, true) !== 0x02014b50) throw new Error(`bad central header ${i}`);
    const flags = v.getUint16(p + 8, true);
    const method = v.getUint16(p + 10, true);
    const crc = v.getUint32(p + 16, true);
    const csize = v.getUint32(p + 20, true);
    const usize = v.getUint32(p + 24, true);
    const nlen = v.getUint16(p + 28, true);
    const xlen = v.getUint16(p + 30, true);
    const clen = v.getUint16(p + 32, true);
    const local = v.getUint32(p + 42, true);
    const path = dec.decode(bytes.subarray(p + 46, p + 46 + nlen));
    p += 46 + nlen + xlen + clen;
    if (v.getUint32(local, true) !== 0x04034b50) throw new Error(`bad local header for ${path}`);
    const lnlen = v.getUint16(local + 26, true);
    const lxlen = v.getUint16(local + 28, true);
    const lpath = dec.decode(bytes.subarray(local + 30, local + 30 + lnlen));
    if (lpath !== path) throw new Error(`local name ${lpath} is not ${path}`);
    if (v.getUint32(local + 14, true) !== crc) throw new Error(`local crc of ${path} differs`);
    if (method !== 0) throw new Error(`${path} is compressed (method ${method})`);
    if (csize !== usize) throw new Error(`${path}: stored sizes differ`);
    const start = local + 30 + lnlen + lxlen;
    const data = bytes.slice(start, start + usize);
    if (refCrc32(data) !== crc) throw new Error(`${path}: CRC-32 mismatch`);
    out.push({ path, data, method, utf8: (flags & 0x0800) !== 0 });
  }
  return out;
}

/**
 * The files of an unzipped pack as the folder picker hands them to Import pack: each File
 * carries `webkitRelativePath` "<folder>/<path>".
 */
export function asPickedFolder(folder: string, entries: { path: string; data: Uint8Array }[]): File[] {
  return entries.map((e) => {
    const f = new File([e.data], e.path.split('/').pop() as string);
    Object.defineProperty(f, 'webkitRelativePath', { value: `${folder}/${e.path}` });
    return f;
  });
}

export const bytesOf = async (b: Blob): Promise<number[]> => [...new Uint8Array(await b.arrayBuffer())];
export const text = (b: Uint8Array): string => new TextDecoder().decode(b);
