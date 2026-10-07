import { describe, expect, it } from 'vitest';
import { PALETTE_MODES, resolvePalette } from '@engine/gfx/palette';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { PALETTES, SPRITES } from './index';
import { zebesDef, zebesPalettes } from './zebes';

type Size = readonly [w: number, h: number];
const T16: Size = [16, 16];

// The frame contract Samus's cavern below 4-2 and ZEBES ESCAPE render against.
const ZEBES_FRAMES: Record<string, Size> = {
  'chozo-0': [32, 32],
  'chozo-1': [32, 32],
  ship: [64, 32],
  'bubble-door': [16, 48],
  'zoomer-0': T16,
  'zoomer-1': T16,
  'ripper-0': T16,
  'ripper-1': T16,
  'skree-0': T16,
  'skree-1': T16,
  'alarm-0': T16,
  'alarm-1': T16,
};

const rows = (name: string): readonly string[] => zebesDef.frames[name] as readonly string[];
const opaque = (frame: readonly string[]) => frame.join('').replace(/\./g, '').length;
const count = (frame: readonly string[], chars: string) =>
  [...frame.join('')].filter((c) => chars.includes(c)).length;
/** The indices of `zebes` that are a bright light (white, orange, yellow, pale yellow). */
const LIGHT = '4bcd';

describe('zebes sheet', () => {
  it('validates', () => validateDef('zebes', zebesDef));

  it('has every contract frame at its size, and nothing else', () => {
    expect(Object.keys(zebesDef.frames).sort()).toEqual(Object.keys(ZEBES_FRAMES).sort());
    for (const [name, [w, h]] of Object.entries(ZEBES_FRAMES)) {
      const f = rows(name);
      expect([f[0]?.length, f.length], name).toEqual([w, h]);
      for (const r of f) expect(r.length, `${name} row width`).toBe(w);
      expect(opaque(f), `${name} is not empty`).toBeGreaterThan(0);
    }
  });

  it('is registered with its palettes, which share one index layout', () => {
    expect(SPRITES.zebes).toBe(zebesDef);
    expect(zebesDef.palette).toBe('zebes');
    expect(Object.keys(zebesPalettes).sort()).toEqual(['zebes', 'zebes-flash']);
    expect(new Set(Object.values(zebesPalettes).map((p) => p.length)).size).toBe(1);
    for (const [name, p] of Object.entries(zebesPalettes)) expect(PALETTES.default[name]).toBe(p);
  });

  it('renders with every palette in every colour mode, and with the hero effects', () => {
    for (const mode of PALETTE_MODES)
      for (const name of Object.keys(zebesPalettes)) {
        const pal = resolvePalette(PALETTES, name, mode);
        expect(() => rasterizeToBuffer(zebesDef, pal), `${name} (${mode})`).not.toThrow();
        for (const fx of ['silhouette', 'brainwashed'])
          expect(() =>
            rasterizeToBuffer(zebesDef, resolvePalette(PALETTES, `${name}~${fx}`, mode)),
          ).not.toThrow();
      }
  });

  it('the hit flash keeps the outline and pales everything else', () => {
    const base = zebesPalettes.zebes as string[];
    const flash = zebesPalettes['zebes-flash'] as string[];
    expect(flash[0]).toBe(base[0]);
    for (const c of flash.slice(1)) expect(['#fcfcfc', '#bcbcbc']).toContain(c);
  });

  it('animated pairs differ between frames', () => {
    for (const n of ['chozo', 'zoomer', 'ripper', 'skree', 'alarm'])
      expect(rows(`${n}-0`), n).not.toEqual(rows(`${n}-1`));
  });

  it("the statue's two frames differ only in the orb's glow, which is brighter in frame 1", () => {
    const [a, b] = [rows('chozo-0'), rows('chozo-1')];
    const changed: [number, number][] = [];
    a.forEach((r, y) => [...r].forEach((c, x) => c !== b[y]?.[x] && changed.push([x, y])));
    expect(changed.length).toBeGreaterThan(0);
    // all changes sit in one small patch (the orb and its halo), not the statue
    const xs = changed.map(([x]) => x);
    const ys = changed.map(([, y]) => y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(14);
    expect(Math.max(...ys) - Math.min(...ys)).toBeLessThan(14);
    expect(count(b, LIGHT)).toBeGreaterThan(count(a, LIGHT));
  });

  it('floor pieces stand on their bottom row; the skree hangs from its top row', () => {
    for (const name of ['chozo-0', 'chozo-1', 'ship', 'zoomer-0', 'zoomer-1'])
      expect(rows(name).at(-1), name).toMatch(/[^.]/);
    expect(rows('skree-0')[0]).toMatch(/[^.]/);
  });

  it('the bubble door fills its three tiles top to bottom and mirrors left to right', () => {
    const f = rows('bubble-door');
    expect(f[0]).toMatch(/[^.]/);
    expect(f.at(-1)).toMatch(/[^.]/);
    // a blue bubble (indices 5-8)
    expect(count(f, '5678')).toBeGreaterThan(opaque(f) / 2);
    for (const r of f) expect(r, 'symmetric').toBe([...r].reverse().join(''));
  });

  it('the alarm is a dim lamp in frame 0 and lit red in frame 1', () => {
    expect(count(rows('alarm-1'), 'abcd4')).toBeGreaterThan(count(rows('alarm-0'), 'abcd4'));
    expect(rows('alarm-1').join('')).toContain('a');
  });

  it('the ship is wide and grounded: landing gear on the bottom row, a canopy of glass', () => {
    const f = rows('ship');
    const feet = (f.at(-1) as string).replace(/\.+/g, ' ').trim().split(' ');
    expect(feet.length).toBeGreaterThanOrEqual(2);
    expect(f.join('')).toContain('e');
  });
});
