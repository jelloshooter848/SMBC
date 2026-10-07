import { describe, expect, it } from 'vitest';
import { PALETTE_MODES, resolvePalette } from '@engine/gfx/palette';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { PALETTES, SPRITES } from './index';
import { cryptDef, cryptPalettes } from './crypt';
import { tilesDef } from './tiles';

type Size = readonly [w: number, h: number];
const S8: Size = [8, 8];
const T16: Size = [16, 16];

// The frame contract Simon's crypt and his mini game render against.
const CRYPT_FRAMES: Record<string, Size> = {
  'candle-0': [8, 16],
  'candle-1': [8, 16],
  'candelabra-0': [16, 32],
  'candelabra-1': [16, 32],
  'stained-glass': [32, 48],
  coffin: [32, 16],
  'wall-cracked': T16,
  'rubble-0': S8,
  'rubble-1': S8,
  'bat-0': T16,
  'bat-1': T16,
  'bat-2': T16,
  'medusa-0': T16,
  'medusa-1': T16,
  'skeleton-0': [16, 32],
  'skeleton-1': [16, 32],
  'skeleton-2': [16, 32],
  bone: S8,
  'heart-small': S8,
  'heart-big': T16,
  'dracula-cape-0': [32, 48],
  'dracula-cape-1': [32, 48],
  'dracula-head': T16,
  'dracula-fireball-0': S8,
  'dracula-fireball-1': S8,
  'dracula-beast-0': [48, 48],
  'dracula-beast-1': [48, 48],
  'dracula-beast-2': [48, 48],
  'beast-fire-0': T16,
  'beast-fire-1': T16,
  throne: [32, 32],
  'stair-r': T16,
  'stair-l': T16,
};

const rows = (name: string): readonly string[] => cryptDef.frames[name] as readonly string[];
const opaque = (frame: readonly string[]) => frame.join('').replace(/\./g, '').length;
const count = (frame: readonly string[], chars: string) =>
  [...frame.join('')].filter((c) => chars.includes(c)).length;
const quarter = (f: readonly string[], qx: number, qy: number) =>
  f.slice(qy * 8, qy * 8 + 8).map((r) => r.slice(qx * 8, qx * 8 + 8));

describe('crypt sheet', () => {
  it('validates', () => validateDef('crypt', cryptDef));

  it('has every contract frame at its size, and nothing else', () => {
    expect(Object.keys(cryptDef.frames).sort()).toEqual(Object.keys(CRYPT_FRAMES).sort());
    for (const [name, [w, h]] of Object.entries(CRYPT_FRAMES)) {
      const f = rows(name);
      expect([f[0]?.length, f.length], name).toEqual([w, h]);
      for (const r of f) expect(r.length, `${name} row width`).toBe(w);
      expect(opaque(f), `${name} is not empty`).toBeGreaterThan(0);
    }
  });

  it('is registered with its palettes, which share one index layout', () => {
    expect(SPRITES.crypt).toBe(cryptDef);
    expect(cryptDef.palette).toBe('crypt');
    expect(Object.keys(cryptPalettes).sort()).toEqual(['crypt', 'crypt-flash']);
    expect(new Set(Object.values(cryptPalettes).map((p) => p.length)).size).toBe(1);
    for (const [name, p] of Object.entries(cryptPalettes)) expect(PALETTES.default[name]).toBe(p);
  });

  it('renders with every palette in every colour mode, and with the hero effects', () => {
    for (const mode of PALETTE_MODES)
      for (const name of Object.keys(cryptPalettes)) {
        const pal = resolvePalette(PALETTES, name, mode);
        expect(() => rasterizeToBuffer(cryptDef, pal), `${name} (${mode})`).not.toThrow();
        for (const fx of ['silhouette', 'brainwashed'])
          expect(() =>
            rasterizeToBuffer(cryptDef, resolvePalette(PALETTES, `${name}~${fx}`, mode)),
          ).not.toThrow();
      }
  });

  it('the hit flash keeps the outline and pales everything else', () => {
    const base = cryptPalettes.crypt as string[];
    const flash = cryptPalettes['crypt-flash'] as string[];
    expect(flash[0]).toBe(base[0]);
    for (const c of flash.slice(1)) expect(['#fcfcfc', '#bcbcbc']).toContain(c);
  });

  it("the stone matches the crypt tiles' stone, so the cracked wall sits among them unseen", () => {
    const crypt = cryptPalettes.crypt as string[];
    const tiles = PALETTES.default['tiles-crypt'] as string[];
    expect(crypt.slice(0, 4)).toEqual(tiles.slice(0, 4));
    for (const n of ['wall-cracked', 'rubble-0', 'rubble-1', 'stair-r', 'stair-l'])
      expect(rows(n).join(''), n).toMatch(/^[.0-3]+$/);
    // the cracked wall is the masonry tile with cracks: same size, mostly the same pixels
    const wall = tilesDef.frames['castle-brick@crypt'] as readonly string[];
    const cracked = rows('wall-cracked');
    let same = 0;
    cracked.forEach((r, y) => [...r].forEach((c, x) => c === wall[y]?.[x] && same++));
    expect(same).toBeGreaterThan(200);
    expect(same).toBeLessThan(256);
    expect(count(cracked, '0')).toBeGreaterThan(count(wall, '0'));
  });

  it('animated pairs differ between frames', () => {
    for (const [a, b] of [
      ['candle-0', 'candle-1'],
      ['candelabra-0', 'candelabra-1'],
      ['bat-1', 'bat-2'],
      ['medusa-0', 'medusa-1'],
      ['skeleton-0', 'skeleton-1'],
      ['dracula-fireball-0', 'dracula-fireball-1'],
      ['beast-fire-0', 'beast-fire-1'],
      ['dracula-cape-0', 'dracula-cape-1'],
    ] as const)
      expect(rows(a), a).not.toEqual(rows(b));
    for (const n of ['dracula-beast-1', 'dracula-beast-2'])
      expect(rows(n), n).not.toEqual(rows('dracula-beast-0'));
  });

  it('standing things stand on their bottom row; the sleeping bat hangs from its top row', () => {
    for (const n of [
      'candle-0',
      'candelabra-0',
      'coffin',
      'skeleton-0',
      'skeleton-1',
      'skeleton-2',
      'dracula-cape-0',
      'dracula-cape-1',
      'dracula-beast-0',
      'dracula-beast-2',
      'throne',
      'stained-glass',
    ])
      expect(rows(n).at(-1), n).toMatch(/[^.]/);
    expect(rows('bat-0')[0]).toMatch(/[^.]/);
  });

  it("Dracula's head is the same 16x16 box at (8,0) in both phase 1 frames", () => {
    const head = rows('dracula-head');
    for (const n of ['dracula-cape-0', 'dracula-cape-1'])
      expect(
        rows(n)
          .slice(0, 16)
          .map((r) => r.slice(8, 24)),
        n,
      ).toEqual(head);
    // a pale face with red eyes
    expect(count(head, 'i')).toBeGreaterThan(10);
    expect(head.join('')).toContain('7');
  });

  it('the cape opens on its red lining; the beast is bigger than Dracula and breathes fire', () => {
    expect(count(rows('dracula-cape-1'), '78')).toBeGreaterThan(3 * count(rows('dracula-cape-0'), '78'));
    expect(opaque(rows('dracula-beast-0'))).toBeGreaterThan(opaque(rows('dracula-cape-1')));
    // the spit frame's maw glows (yellow/white) where the idle frame's is shut
    const glow = (n: string) => count(rows(n).slice(16, 36), '45');
    expect(glow('dracula-beast-2')).toBeGreaterThan(glow('dracula-beast-0') + 10);
    // the leap's feet are off the floor at the front: its bottom row is sparser than the idle's
    expect(opaque(rows('dracula-beast-1').slice(-2))).toBeLessThan(opaque(rows('dracula-beast-0').slice(-2)));
  });

  it('stairs: two steps on the diagonal, stair-r climbing right and stair-l climbing left', () => {
    const empty = (q: readonly string[]) => q.every((r) => /^\.+$/.test(r));
    const r = rows('stair-r');
    const l = rows('stair-l');
    expect(empty(quarter(r, 0, 0)) && empty(quarter(r, 1, 1))).toBe(true);
    expect(empty(quarter(r, 1, 0)) || empty(quarter(r, 0, 1))).toBe(false);
    expect(empty(quarter(l, 1, 0)) && empty(quarter(l, 0, 1))).toBe(true);
    expect(quarter(r, 0, 1)).toEqual(quarter(l, 1, 1));
    // each step is lit on its top row
    expect(quarter(r, 1, 0)[0]).toMatch(/^3+0$/);
  });

  it('the stained glass is a pointed arch of coloured glass in a stone frame on a sill', () => {
    const f = rows('stained-glass');
    const top = f.find((r) => /[^.]/.test(r)) as string;
    expect(top).toMatch(/^\.{8,}[^.]+\.{8,}$/);
    expect(f.at(-1)).toMatch(/^[^.]+$/);
    expect(count(f, 'bcdej78')).toBeGreaterThan(opaque(f) / 3);
  });

  it('hearts are crimson; the candles hold a flame over white wax', () => {
    for (const n of ['heart-small', 'heart-big'])
      expect(count(rows(n), 'j')).toBeGreaterThan(opaque(rows(n)) / 3);
    for (const n of ['candle-0', 'candle-1', 'candelabra-0']) {
      expect(rows(n).join(''), n).toMatch(/5/);
      expect(rows(n).join(''), n).toMatch(/4/);
    }
  });
});
