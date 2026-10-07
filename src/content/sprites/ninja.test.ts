import { describe, expect, it } from 'vitest';
import { PALETTE_MODES, resolvePalette } from '@engine/gfx/palette';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { PALETTES, SPRITES } from './index';
import { ninjaDef, ninjaPalettes } from './ninja';
import { ryuDef } from './ryu';
import { tilesDef } from './tiles';

type Size = readonly [w: number, h: number];
const S8: Size = [8, 8];
const T16: Size = [16, 16];
const TALL: Size = [16, 32];
const CUT: Size = [32, 32];

// The frame contract Ryu's hideout, the trick wall and his mini game render against.
const NINJA_FRAMES: Record<string, Size> = {
  'trick-wall-0': T16,
  'trick-wall-1': T16,
  'trick-wall-2': T16,
  'trick-wall-3': T16,
  'trick-wall-back': T16,
  'trick-wall-cracked': T16,
  'shuriken-mark': S8,
  'lantern-0': T16,
  'lantern-1': T16,
  'moon-window': [48, 48],
  shoji: [32, 32],
  'item-ninpo': S8,
  'knife-thrower-0': TALL,
  'knife-thrower-1': TALL,
  'knife-thrower-2': TALL,
  knife: S8,
  'dog-0': T16,
  'dog-1': T16,
  'hawk-0': T16,
  'hawk-1': T16,
  'masked-ninja-0': TALL,
  'masked-ninja-1': TALL,
  'masked-ninja-2': TALL,
  'masked-ninja-3': TALL,
  'masked-ninja-hurt': TALL,
  afterimage: TALL,
  'ninja-star': S8,
  'ninja-star-1': S8,
  'cut-moon': [64, 64],
  'cut-field': [256, 48],
  'cut-ryu-0': CUT,
  'cut-ryu-1': CUT,
  'cut-masked-0': CUT,
  'cut-masked-1': CUT,
  'cut-clash': CUT,
};

const rows = (name: string): readonly string[] => ninjaDef.frames[name] as readonly string[];
const opaque = (frame: readonly string[]) => frame.join('').replace(/\./g, '').length;
const count = (frame: readonly string[], chars: string) =>
  [...frame.join('')].filter((c) => chars.includes(c)).length;
const sameCount = (a: readonly string[], b: readonly string[]) => {
  let same = 0;
  a.forEach((r, y) => [...r].forEach((c, x) => c === b[y]?.[x] && same++));
  return same;
};

describe('ninja sheet', () => {
  it('validates', () => validateDef('ninja', ninjaDef));

  it('has every contract frame at its size, and nothing else', () => {
    expect(Object.keys(ninjaDef.frames).sort()).toEqual(Object.keys(NINJA_FRAMES).sort());
    for (const [name, [w, h]] of Object.entries(NINJA_FRAMES)) {
      const f = rows(name);
      expect([f[0]?.length, f.length], name).toEqual([w, h]);
      for (const r of f) expect(r.length, `${name} row width`).toBe(w);
      expect(opaque(f), `${name} is not empty`).toBeGreaterThan(0);
    }
  });

  it('is registered with its palettes, which share one index layout', () => {
    expect(SPRITES.ninja).toBe(ninjaDef);
    expect(ninjaDef.palette).toBe('ninja');
    expect(Object.keys(ninjaPalettes).sort()).toEqual(['ninja', 'ninja-flash', 'ninja-ghost']);
    expect(new Set(Object.values(ninjaPalettes).map((p) => p.length)).size).toBe(1);
    for (const [name, p] of Object.entries(ninjaPalettes)) expect(PALETTES.default[name]).toBe(p);
  });

  it('renders with every palette in every colour mode, and with the hero effects', () => {
    for (const mode of PALETTE_MODES)
      for (const name of Object.keys(ninjaPalettes)) {
        const pal = resolvePalette(PALETTES, name, mode);
        expect(() => rasterizeToBuffer(ninjaDef, pal), `${name} (${mode})`).not.toThrow();
        for (const fx of ['silhouette', 'brainwashed'])
          expect(() =>
            rasterizeToBuffer(ninjaDef, resolvePalette(PALETTES, `${name}~${fx}`, mode)),
          ).not.toThrow();
      }
  });

  it('the hit flash keeps the outline and pales everything else; the ghost is all violet', () => {
    const base = ninjaPalettes.ninja as string[];
    const flash = ninjaPalettes['ninja-flash'] as string[];
    expect(flash[0]).toBe(base[0]);
    for (const c of flash.slice(1)) expect(['#fcfcfc', '#bcbcbc']).toContain(c);
    const ghost = ninjaPalettes['ninja-ghost'] as string[];
    expect(new Set(ghost).size).toBeLessThanOrEqual(3);
    expect(ghost).not.toContain(base[0]);
  });

  it("the trick wall's front is the underground brick, so the panel sits in the bonus room wall unseen", () => {
    const ninja = ninjaPalettes.ninja as string[];
    const tiles = PALETTES.default['tiles-underground'] as string[];
    expect(ninja.slice(0, 4)).toEqual(tiles.slice(0, 4));
    expect(rows('trick-wall-0')).toEqual(tilesDef.frames['brick@underground']);
    // the marked tile only adds a faint crack in the brick's own shadow colour
    const cracked = rows('trick-wall-cracked');
    expect(cracked.join('')).toMatch(/^[0-3]+$/);
    const same = sameCount(cracked, rows('trick-wall-0'));
    expect(same).toBeGreaterThan(240);
    expect(same).toBeLessThan(256);
    // the shuriken is steel, mostly clear so the brick shows round it
    expect(count(rows('shuriken-mark'), 'ef')).toBeGreaterThan(8);
    expect(opaque(rows('shuriken-mark'))).toBeLessThan(32);
  });

  it('the spin narrows the brick to an edge and opens on the wooden back; every frame tiles down', () => {
    const wood = (n: string) => count(rows(n), '567');
    const brick = (n: string) => count(rows(n), '123');
    expect(brick('trick-wall-1')).toBeLessThan(brick('trick-wall-0'));
    expect(brick('trick-wall-1')).toBeGreaterThan(100);
    expect(wood('trick-wall-2')).toBeLessThan(80);
    expect(brick('trick-wall-2')).toBe(0);
    expect(wood('trick-wall-3')).toBeGreaterThan(wood('trick-wall-2'));
    expect(wood('trick-wall-back')).toBeGreaterThan(wood('trick-wall-3'));
    // the hole behind the turning panel is black and the frames fill their tile
    for (const n of ['trick-wall-1', 'trick-wall-2', 'trick-wall-3', 'trick-wall-back']) {
      expect(opaque(rows(n)), n).toBe(256);
      const f = rows(n);
      // stacked panels: the top row continues the bottom row's pattern (same columns of edge/hole)
      expect(
        [...(f[0] as string)].map((c) => c === '0'),
        n,
      ).toEqual([...(f[15] as string)].map((c) => c === '0'));
    }
  });

  it('animated pairs differ between frames', () => {
    for (const [a, b] of [
      ['lantern-0', 'lantern-1'],
      ['dog-0', 'dog-1'],
      ['hawk-0', 'hawk-1'],
      ['knife-thrower-0', 'knife-thrower-1'],
      ['knife-thrower-1', 'knife-thrower-2'],
      ['masked-ninja-0', 'masked-ninja-1'],
      ['masked-ninja-0', 'masked-ninja-2'],
      ['masked-ninja-0', 'masked-ninja-3'],
      ['masked-ninja-0', 'masked-ninja-hurt'],
      ['ninja-star', 'ninja-star-1'],
      ['cut-ryu-0', 'cut-ryu-1'],
      ['cut-masked-0', 'cut-masked-1'],
    ] as const)
      expect(rows(a), a).not.toEqual(rows(b));
  });

  it('standing things stand on their bottom row; lanterns hang from their top row', () => {
    for (const n of [
      'knife-thrower-0',
      'knife-thrower-1',
      'knife-thrower-2',
      'dog-0',
      'dog-1',
      'masked-ninja-0',
      'masked-ninja-1',
      'masked-ninja-3',
      'masked-ninja-hurt',
      'item-ninpo',
      'moon-window',
      'shoji',
      'cut-field',
    ])
      expect(rows(n).at(-1), n).toMatch(/[^.]/);
    for (const n of ['lantern-0', 'lantern-1']) expect(rows(n)[0], n).toMatch(/^\.+0+\.+$/);
    // the leap is airborne
    expect(rows('masked-ninja-2').at(-1)).toMatch(/^\.+$/);
  });

  it('the Masked Ninja is his own design: a crimson horned mask, white mane, dark garb, not Ryu', () => {
    for (const n of ['masked-ninja-0', 'masked-ninja-1', 'masked-ninja-2', 'masked-ninja-3']) {
      const f = rows(n);
      expect(count(f, 'g'), `${n} mask`).toBeGreaterThan(30);
      expect(count(f, 'd'), `${n} garb`).toBeGreaterThan(50);
      expect(count(f, '4'), `${n} mane and fangs`).toBeGreaterThan(10);
      expect(count(f, 'b'), `${n} eyes`).toBeGreaterThan(3);
    }
    // horns rise above the head on the top rows
    expect(count(rows('masked-ninja-0').slice(3, 6), 'f')).toBeGreaterThan(3);
    // not Ryu's pixels
    const ryu = ryuDef.frames.idle as readonly string[];
    expect(sameCount(rows('masked-ninja-0'), ryu)).toBeLessThan(400);
    // the slash bares steel ahead of him (the left, his facing side)
    const front = rows('masked-ninja-3').map((r) => r.slice(0, 5));
    expect(count(front, 'f4')).toBeGreaterThan(
      count(
        rows('masked-ninja-0').map((r) => r.slice(0, 5)),
        'f4',
      ),
    );
  });

  it("the afterimage is the run frame's every other row", () => {
    const run = rows('masked-ninja-1');
    rows('afterimage').forEach((r, y) => expect(r, `row ${y}`).toBe(y % 2 ? '.'.repeat(16) : run[y]));
  });

  it('creatures face left: heads and beaks on the left half', () => {
    const left = (n: string, chars: string) =>
      count(
        rows(n).map((r) => r.slice(0, 8)),
        chars,
      );
    const right = (n: string, chars: string) =>
      count(
        rows(n).map((r) => r.slice(8)),
        chars,
      );
    for (const n of ['hawk-0', 'hawk-1']) expect(left(n, 'b'), n).toBeGreaterThan(right(n, 'b'));
    for (const n of ['dog-0', 'dog-1']) expect(left(n, '9'), n).toBeGreaterThan(right(n, '9'));
    expect(left('knife-thrower-2', 'i')).toBeGreaterThan(left('knife-thrower-0', 'i'));
    // the knife flies point first to the left
    expect(rows('knife').join('')).toMatch(/04f/);
  });

  it('the lanterns glow; the moon window holds the moon; the shoji is paper in a wooden frame', () => {
    for (const n of ['lantern-0', 'lantern-1']) {
      expect(count(rows(n), '9'), n).toBeGreaterThan(30);
      expect(count(rows(n), 'bc'), n).toBeGreaterThan(4);
    }
    const win = rows('moon-window');
    expect(count(win, 'c')).toBeGreaterThan(120);
    expect(count(win, '567')).toBeGreaterThan(300);
    expect(win[0]).toMatch(/^\.+0+\.+$/);
    const shoji = rows('shoji');
    expect(count(shoji, '8')).toBeGreaterThan(count(shoji, '567'));
    expect(shoji[0]).toMatch(/^0+$/);
  });

  it('the cutscene: a full moon, a field that tiles, silhouettes facing each other, a bright clash', () => {
    const moon = rows('cut-moon');
    expect(count(moon, 'c')).toBeGreaterThan(2000);
    expect(opaque([moon[31] as string])).toBeGreaterThanOrEqual(62);
    const field = rows('cut-field');
    expect(field.at(-1)).toMatch(/^0+$/);
    // the strip's ends join: neighbouring columns across the seam differ by a few rows at most
    const height = (x: number) => field.findIndex((r) => r[x] !== '.');
    expect(Math.abs(height(0) - height(255))).toBeLessThan(12);
    // silhouettes are mostly black with a rim; Ryu blue, the Masked Ninja crimson with gold eyes
    for (const n of ['cut-ryu-0', 'cut-ryu-1', 'cut-masked-0', 'cut-masked-1'])
      expect(count(rows(n), '0'), n).toBeGreaterThan(opaque(rows(n)) / 2);
    for (const n of ['cut-ryu-0', 'cut-ryu-1']) expect(count(rows(n), 'k'), n).toBeGreaterThan(10);
    for (const n of ['cut-masked-0', 'cut-masked-1']) {
      expect(count(rows(n), 'g'), n).toBeGreaterThan(10);
      expect(count(rows(n), 'b'), n).toBe(2);
    }
    // Ryu's head is on his right (he faces right); the Masked Ninja's on his left
    const headX = (n: string) => {
      const f = rows(n).slice(0, 10);
      const xs = f.flatMap((r) => [...r].flatMap((c, x) => (c === '0' ? [x] : [])));
      return xs.reduce((a, b) => a + b, 0) / xs.length;
    };
    expect(headX('cut-ryu-0')).toBeGreaterThan(14);
    expect(headX('cut-masked-1')).toBeLessThan(headX('cut-ryu-1') + 8);
    const clash = rows('cut-clash');
    expect(clash[15]?.[15]).toBe('4');
    expect(count(clash, '4c')).toBeGreaterThan(count(clash, '9'));
  });
});
