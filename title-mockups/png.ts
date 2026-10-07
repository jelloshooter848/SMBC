import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
export class Img {
  data: Uint8Array;
  constructor(public w: number, public h: number, bg = [40, 40, 56]) {
    this.data = new Uint8Array(w * h * 4);
    for (let i = 0; i < w * h; i++) {
      this.data[i * 4] = bg[0]!;
      this.data[i * 4 + 1] = bg[1]!;
      this.data[i * 4 + 2] = bg[2]!;
      this.data[i * 4 + 3] = 255;
    }
  }
  set(x: number, y: number, c: [number, number, number]) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const o = (y * this.w + x) * 4;
    this.data[o] = c[0];
    this.data[o + 1] = c[1];
    this.data[o + 2] = c[2];
  }
  fill(x: number, y: number, w: number, h: number, c: [number, number, number]) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c);
  }
  save(path: string) {
    const { w, h } = this;
    const T = new Int32Array(256).map((_, n) => {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      return c;
    });
    const crc = (b: Buffer) => {
      let c = -1;
      for (const x of b) c = T[(c ^ x) & 255]! ^ (c >>> 8);
      return (c ^ -1) >>> 0;
    };
    const chunk = (t: string, d: Buffer) => {
      const tb = Buffer.from(t),
        l = Buffer.alloc(4);
      l.writeUInt32BE(d.length);
      const c = Buffer.alloc(4);
      c.writeUInt32BE(crc(Buffer.concat([tb, d])));
      return Buffer.concat([l, tb, d, c]);
    };
    const raw = Buffer.alloc((w * 4 + 1) * h);
    for (let y = 0; y < h; y++) Buffer.from(this.data.buffer, y * w * 4, w * 4).copy(raw, y * (w * 4 + 1) + 1);
    const ih = Buffer.alloc(13);
    ih.writeUInt32BE(w, 0);
    ih.writeUInt32BE(h, 4);
    ih[8] = 8;
    ih[9] = 6;
    writeFileSync(
      path,
      Buffer.concat([
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
        chunk('IHDR', ih),
        chunk('IDAT', deflateSync(raw)),
        chunk('IEND', Buffer.alloc(0)),
      ]),
    );
  }
}
export const hex = (h: string): [number, number, number] => {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const ci = (ch: string) => (ch === '.' ? -1 : ch >= 'a' ? ch.charCodeAt(0) - 87 : +ch);
export function blit(
  img: Img,
  rows: readonly string[],
  pal: readonly string[],
  x0: number,
  y0: number,
  s = 1,
  flip = false,
) {
  rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x++) {
      const i = ci(r[flip ? r.length - 1 - x : x]!);
      if (i < 0) continue;
      img.fill(x0 + x * s, y0 + y * s, s, s, hex(pal[i]!));
    }
  });
}
