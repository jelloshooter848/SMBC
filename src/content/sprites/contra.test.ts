import { describe, expect, it } from 'vitest';
import { PALETTE_MODES, resolvePalette } from '@engine/gfx/palette';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { PALETTES, SPRITES } from './index';
import { contraDef, contraPalettes } from './contra';
import { billDef, billPalettes } from './bill';
import { tilePalettes, tilesDef } from './tiles';

type Size = readonly [w: number, h: number];
const T16: Size = [16, 16];
const TALL: Size = [16, 32];
const BIG: Size = [32, 32];
const BADGE: Size = [24, 16];

// The frame contract Bill's exploding bridge and his mini game render against.
const CONTRA_FRAMES: Record<string, Size> = {
  'blast-bridge-0': T16,
  'blast-bridge-1': T16,
  'boom-0': BIG,
  'boom-1': BIG,
  'boom-2': BIG,
  'boom-3': BIG,
  'soldier-run-0': TALL,
  'soldier-run-1': TALL,
  'soldier-run-2': TALL,
  'soldier-jump': TALL,
  'rifleman-0': TALL,
  'rifleman-1': TALL,
  'rifleman-bush': TALL,
  ...Object.fromEntries(Array.from({ length: 12 }, (_, k) => [`wall-gun-${k}`, BIG])),
  'popup-cannon-0': BIG,
  'popup-cannon-1': BIG,
  'popup-cannon-2': BIG,
  'pillbox-0': BIG,
  'pillbox-1': BIG,
  'pillbox-2': BIG,
  'capsule-0': BADGE,
  'capsule-1': BADGE,
  'falcon-M': BADGE,
  'falcon-S': BADGE,
  'falcon-L': BADGE,
  'falcon-F': BADGE,
  'falcon-R': BADGE,
  'falcon-B': BADGE,
  'bullet-small': [4, 4],
  'bullet-big': [6, 6],
  'spread-ball': [8, 8],
  laser: [16, 4],
  'fire-ring': [8, 8],
  'enemy-bullet': [4, 4],
  'defense-wall': BIG,
  'defense-wall-top': BIG,
  'defense-wall-door': [32, 64],
  'defense-wall-broken': BIG,
  'defense-wall-tower': [24, 40],
  'wall-cannon-0': [32, 16],
  'wall-cannon-1': [32, 16],
  'core-0': BIG,
  'core-1': BIG,
  'core-2': BIG,
  'falcon-heart-0': [64, 64],
  'falcon-heart-1': [64, 64],
  'falcon-heart-2': [64, 64],
  'larva-0': T16,
  'larva-1': T16,
  'pod-0': BIG,
  'pod-1': BIG,
  'bill-death-0': BIG,
  'bill-death-1': BIG,
  'bill-death-2': BIG,
  'bill-death-3': BIG,
  medal: [8, 16],
  'card-island': [96, 64],
  'card-route': [4, 4],
};

const rows = (name: string): readonly string[] => contraDef.frames[name] as readonly string[];
const opaque = (frame: readonly string[]) => frame.join('').replace(/\./g, '').length;
const count = (frame: readonly string[], chars: string) =>
  [...frame.join('')].filter((c) => chars.includes(c)).length;
/** Centre of mass of the pixels drawn in `chars`. */
const centroid = (frame: readonly string[], chars: string): [number, number] => {
  let sx = 0;
  let sy = 0;
  let n = 0;
  frame.forEach((r, y) =>
    [...r].forEach((c, x) => {
      if (!chars.includes(c)) return;
      sx += x + 0.5;
      sy += y + 0.5;
      n++;
    }),
  );
  return [sx / n, sy / n];
};
const bottomRow = (frame: readonly string[]) => {
  for (let y = frame.length - 1; y >= 0; y--) if (/[^.]/.test(frame[y] as string)) return y;
  return -1;
};

describe('contra sheet', () => {
  it('validates', () => validateDef('contra', contraDef));

  it('has every contract frame at its size, and nothing else', () => {
    expect(Object.keys(contraDef.frames).sort()).toEqual(Object.keys(CONTRA_FRAMES).sort());
    for (const [name, [w, h]] of Object.entries(CONTRA_FRAMES)) {
      const f = rows(name);
      expect([f[0]?.length, f.length], name).toEqual([w, h]);
      for (const r of f) expect(r.length, `${name} row width`).toBe(w);
      expect(opaque(f), `${name} is not empty`).toBeGreaterThan(0);
    }
  });

  it('is registered with its palettes, which share one index layout', () => {
    expect(SPRITES.contra).toBe(contraDef);
    expect(contraDef.palette).toBe('contra');
    expect(Object.keys(contraPalettes).sort()).toEqual(['alien', 'contra', 'contra-flash']);
    expect(new Set(Object.values(contraPalettes).map((p) => p.length)).size).toBe(1);
    for (const [name, p] of Object.entries(contraPalettes)) expect(PALETTES.default[name]).toBe(p);
  });

  it('renders with every palette in every colour mode, and with the hero effects', () => {
    for (const mode of PALETTE_MODES)
      for (const name of Object.keys(contraPalettes)) {
        const pal = resolvePalette(PALETTES, name, mode);
        expect(() => rasterizeToBuffer(contraDef, pal), `${name} (${mode})`).not.toThrow();
        for (const fx of ['silhouette', 'brainwashed'])
          expect(() =>
            rasterizeToBuffer(contraDef, resolvePalette(PALETTES, `${name}~${fx}`, mode)),
          ).not.toThrow();
      }
  });

  it('the hit flash keeps the outline and pales the rest; the lair light turns green to flesh', () => {
    const base = contraPalettes.contra as string[];
    const flash = contraPalettes['contra-flash'] as string[];
    expect(flash[0]).toBe(base[0]);
    for (const c of flash.slice(1)) expect(['#fcfcfc', '#bcbcbc']).toContain(c);
    const alien = contraPalettes.alien as string[];
    expect(alien[0]).toBe(base[0]);
    const red = (hex: string) => parseInt(hex.slice(1, 3), 16) > parseInt(hex.slice(3, 5), 16);
    for (const i of [12, 13, 14]) {
      expect(red(base[i] as string), `contra ${i} is green`).toBe(false);
      expect(red(alien[i] as string), `alien ${i} is flesh`).toBe(true);
    }
  });

  it("draws Bill's death flip in his own colours", () => {
    // indices 0-5 are the bill palette, so his frames keep their colours here
    expect((contraPalettes.contra as string[]).slice(0, 6)).toEqual(billPalettes.bill);
    for (const n of [0, 1, 2, 3]) expect(rows(`bill-death-${n}`).join(''), `${n}`).toMatch(/^[0-5.]+$/);
    // thrown back (his hurt pose), over, upside down, then flat on his back on the floor
    expect(rows('bill-death-0').map((r) => r.slice(8, 24))).toEqual(billDef.frames.hurt);
    const flat = rows('bill-death-3');
    expect(bottomRow(flat)).toBe(31);
    expect(flat.slice(0, 16).join('')).toMatch(/^\.+$/);
    const skin = (f: readonly string[]) => centroid(f, '1');
    expect(skin(rows('bill-death-2'))[1]).toBeGreaterThan(16); // head down
    expect(skin(rows('bill-death-0'))[1]).toBeLessThan(16); // head up
  });

  it("the blast bridge is the jungle's girder in the same colours, with a lamp that blinks", () => {
    const girder = tilesDef.frames['bridge@contra-jungle'] as readonly string[];
    const tiles = tilePalettes['tiles-contra-jungle'] as string[];
    const contra = contraPalettes.contra as string[];
    const colour = (pal: string[], c: string) => (c === '.' ? '.' : pal[parseInt(c, 36)]);
    for (const n of [0, 1]) {
      const f = rows(`blast-bridge-${n}`);
      let lamp = 0;
      f.forEach((r, y) =>
        [...r].forEach((c, x) => {
          const want = colour(tiles, girder[y]?.[x] as string);
          if (colour(contra, c) !== want) lamp++;
        }),
      );
      expect(lamp, `blast-bridge-${n} differs only by its lamp`).toBeGreaterThan(4);
      expect(lamp).toBeLessThan(24);
      // the deck is untouched, so the marked segment stands like any other
      expect(f.slice(0, 5)).toEqual(rows('blast-bridge-0').slice(0, 5));
    }
    expect(count(rows('blast-bridge-0'), '4')).toBeGreaterThan(count(rows('blast-bridge-1'), '4'));
  });

  it('explodes: a flash, a growing fireball, a billow, then smoke', () => {
    const fire = (n: number) => count(rows(`boom-${n}`), '69ab4');
    expect(opaque(rows('boom-1'))).toBeGreaterThan(opaque(rows('boom-0')));
    expect(fire(2)).toBeGreaterThan(fire(3));
    expect(count(rows('boom-3'), '578')).toBeGreaterThan(count(rows('boom-3'), '4'));
    expect(count(rows('boom-0'), '6')).toBeGreaterThan(0);
  });

  it('the wall gun turns twelve steps clockwise from left', () => {
    // the barrel's lit core beyond the turret (the plate's four rivets cancel out)
    const barrel = (k: number) => {
      const f = rows(`wall-gun-${k}`).map((r, y) =>
        [...r].map((c, x) => (Math.hypot(x + 0.5 - 16, y + 0.5 - 16) > 10 ? c : '.')).join(''),
      );
      const [x, y] = centroid(f, '5');
      return Math.atan2(y - 16, x - 16);
    };
    // left, up, right, down
    const dir = (k: number) => {
      const a = barrel(k);
      return [Math.round(Math.cos(a)), Math.round(Math.sin(a))];
    };
    expect(dir(0)).toEqual([-1, 0]);
    expect(dir(3)).toEqual([0, -1]);
    expect(dir(6)).toEqual([1, 0]);
    expect(dir(9)).toEqual([0, 1]);
    // every step a different frame
    expect(new Set(Array.from({ length: 12 }, (_, k) => rows(`wall-gun-${k}`).join(''))).size).toBe(12);
  });

  it('stands its walkers, cannons and pillboxes on their bottom rows; soldiers face left', () => {
    for (const n of [
      'soldier-run-0',
      'soldier-run-1',
      'soldier-run-2',
      'rifleman-0',
      'rifleman-1',
      'rifleman-bush',
    ])
      expect(bottomRow(rows(n)), n).toBe(31);
    for (const n of [
      'popup-cannon-0',
      'popup-cannon-1',
      'popup-cannon-2',
      'pillbox-0',
      'pillbox-1',
      'pillbox-2',
    ])
      expect(bottomRow(rows(n)), n).toBe(31);
    // the glowing eyes are on the left of the face; the rifle reaches further left than the body
    const [eyeX] = centroid(rows('soldier-run-0').slice(0, 16), '4');
    expect(eyeX).toBeLessThan(8);
    const [gunX] = centroid(rows('rifleman-0'), '57');
    expect(gunX).toBeLessThan(8);
    // the pop-up cannon rises out of its hatch; the pillbox opens on its sensor
    expect(opaque(rows('popup-cannon-1'))).toBeGreaterThan(opaque(rows('popup-cannon-0')));
    expect(opaque(rows('popup-cannon-2'))).toBeGreaterThan(opaque(rows('popup-cannon-1')));
    expect(count(rows('pillbox-0'), '4i')).toBe(0);
    expect(count(rows('pillbox-2'), '4i')).toBeGreaterThan(count(rows('pillbox-1'), '4i'));
  });

  it('every falcon is the same eagle with its own letter', () => {
    const letters = ['M', 'S', 'L', 'F', 'R', 'B'];
    const eagle = (l: string) => rows(`falcon-${l}`).map((r) => r.replace(/4/g, '6'));
    for (const l of letters) expect(eagle(l), l).toEqual(eagle('M'));
    expect(new Set(letters.map((l) => rows(`falcon-${l}`).join(''))).size).toBe(6);
    // the capsule flaps: same pod, fins up then down
    expect(rows('capsule-0').slice(4, 12)).toEqual(rows('capsule-1').slice(4, 12));
    expect(rows('capsule-0')).not.toEqual(rows('capsule-1'));
  });

  it('the core glows brighter frame by frame; the heart beats; the pod opens', () => {
    const hot = (n: string) => count(rows(n), '6a9');
    expect(hot('core-1')).toBeGreaterThan(hot('core-0'));
    expect(hot('core-2')).toBeGreaterThan(hot('core-1'));
    expect(opaque(rows('falcon-heart-1'))).toBeGreaterThan(opaque(rows('falcon-heart-0')));
    expect(opaque(rows('falcon-heart-2'))).toBeGreaterThan(opaque(rows('falcon-heart-1')));
    expect(count(rows('pod-1'), 'de6')).toBeGreaterThan(count(rows('pod-0'), 'de6'));
  });
});
