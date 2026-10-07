import { describe, expect, it } from 'vitest';
import { PALETTE_MODES, resolvePalette } from '@engine/gfx/palette';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { PALETTES, SPRITES } from './index';
import { megamanDef, megamanPalettes } from './megaman';
import { stationDef, stationPalettes } from './station';

type Size = readonly [w: number, h: number];
const T16: Size = [16, 16];

// The frame contract Mega Man's station (campaign entrance and mini game) renders against.
const STATION_FRAMES: Record<string, Size> = {
  'pad-0': [16, 8],
  'pad-1': [16, 8],
  'beam-0': [16, 32],
  'beam-1': [16, 32],
  'beam-2': [16, 32],
  'hopper-0': T16,
  'hopper-1': T16,
  'met-0': T16,
  'met-1': T16,
  'turret-0': T16,
  'turret-1': T16,
  'drone-0': T16,
  'drone-1': T16,
  pellet: [8, 8],
  'capsule-0': T16,
  'capsule-1': T16,
  shutter: T16,
  window: [48, 32],
  console: [32, 16],
  girder: T16,
};

const rows = (name: string): readonly string[] => stationDef.frames[name] as readonly string[];
const opaque = (frame: readonly string[]) => frame.join('').replace(/\./g, '').length;

describe('station sheet', () => {
  it('validates', () => validateDef('station', stationDef));

  it('has every contract frame at its size, and nothing else', () => {
    expect(Object.keys(stationDef.frames).sort()).toEqual(Object.keys(STATION_FRAMES).sort());
    for (const [name, [w, h]] of Object.entries(STATION_FRAMES)) {
      const f = rows(name);
      expect([f[0]?.length, f.length], name).toEqual([w, h]);
      for (const r of f) expect(r.length, `${name} row width`).toBe(w);
      expect(opaque(f), `${name} is not empty`).toBeGreaterThan(0);
    }
  });

  it('is registered with its palettes, which share one index layout', () => {
    expect(SPRITES.station).toBe(stationDef);
    expect(stationDef.palette).toBe('station');
    expect(Object.keys(stationPalettes).sort()).toEqual(['station', 'station-flash']);
    expect(new Set(Object.values(stationPalettes).map((p) => p.length)).size).toBe(1);
    for (const [name, p] of Object.entries(stationPalettes)) expect(PALETTES.default[name]).toBe(p);
  });

  it('renders with every palette in every colour mode, and with the hero effects', () => {
    for (const mode of PALETTE_MODES)
      for (const name of Object.keys(stationPalettes)) {
        const pal = resolvePalette(PALETTES, name, mode);
        expect(() => rasterizeToBuffer(stationDef, pal), `${name} (${mode})`).not.toThrow();
        for (const fx of ['silhouette', 'brainwashed'])
          expect(() =>
            rasterizeToBuffer(stationDef, resolvePalette(PALETTES, `${name}~${fx}`, mode)),
          ).not.toThrow();
      }
  });

  it('the hit flash keeps the outline and pales everything else', () => {
    const base = stationPalettes.station as string[];
    const flash = stationPalettes['station-flash'] as string[];
    expect(flash[0]).toBe(base[0]);
    for (const c of flash.slice(1)) expect(['#fcfcfc', '#bcbcbc']).toContain(c);
    expect(new Set(flash.slice(1)).size).toBe(2);
  });

  it('animated pairs differ between frames', () => {
    for (const [a, b] of [
      ['pad-0', 'pad-1'],
      ['hopper-0', 'hopper-1'],
      ['turret-0', 'turret-1'],
      ['drone-0', 'drone-1'],
      ['capsule-0', 'capsule-1'],
    ] as const)
      expect(rows(a), `${a} vs ${b}`).not.toEqual(rows(b));
    const beams = ['beam-0', 'beam-1', 'beam-2'].map((n) => rows(n).join('/'));
    expect(new Set(beams).size).toBe(3);
  });

  it('floor pieces stand on their bottom row: the pad, the beams and the ground robots', () => {
    for (const name of ['pad-0', 'pad-1', 'turret-0', 'turret-1', 'hopper-0', 'hopper-1'])
      expect(rows(name).at(-1), name).toMatch(/[^.]/);
    // The streak runs the whole height; the landing frames splash out near the floor.
    expect(rows('beam-0')[0]).toMatch(/[^.]/);
    for (const name of ['beam-1', 'beam-2']) {
      const f = rows(name);
      const widest = Math.max(...f.map((r) => r.replace(/^\.+|\.+$/g, '').length));
      const low = f.slice(20).map((r) => r.replace(/^\.+|\.+$/g, '').length);
      expect(Math.max(...low), name).toBe(widest);
    }
  });

  it('the turret only shows its eye and barrel when open', () => {
    expect(rows('turret-0').join('')).not.toContain('c');
    expect(rows('turret-1').join('')).toContain('c');
    // the barrel pokes out to the left (robots face left)
    expect(rows('turret-1').some((r) => r.startsWith('0'))).toBe(true);
  });

  it('the shutter tiles vertically: its top and bottom rows meet like slats', () => {
    const f = rows('shutter');
    expect(f.every((r) => r[0] === '0' && r[15] === '0')).toBe(true);
    expect(f[15]).toMatch(/^0[01]+0$/);
    expect(f[0]).not.toBe(f[15]);
  });

  it('the window shows space and the blue Earth inside a closed frame', () => {
    const f = rows('window');
    expect(f.join('')).not.toContain('.');
    const inside = f
      .slice(5, 27)
      .map((r) => r.slice(5, 43))
      .join('');
    for (const ch of ['4', '6', 'e']) expect(inside, `has ${ch}`).toContain(ch);
  });
});

describe('Dark Mega Man palette', () => {
  const base = megamanPalettes.megaman as string[];
  const dark = megamanPalettes['megaman-dark'] as string[];

  it('uses the same index roles as megaman, so every frame of his works', () => {
    expect(dark).toHaveLength(base.length);
    expect(dark[0]).toBe('#000000');
    // the armour (1, 2) is recoloured; the eye whites (4) glow red
    for (const i of [1, 2, 4]) expect(dark[i], `index ${i}`).not.toBe(base[i]);
    const [r, g, b] = [1, 3, 5].map((k) => parseInt((dark[4] as string).slice(k, k + 2), 16)) as [
      number,
      number,
      number,
    ];
    expect(r).toBeGreaterThan(g + b);
  });

  it('renders his whole sheet in every colour mode and through the palette effects', () => {
    for (const mode of PALETTE_MODES) {
      const pal = resolvePalette(PALETTES, 'megaman-dark', mode);
      expect(pal).toHaveLength(base.length);
      expect(() => rasterizeToBuffer(megamanDef, pal), mode).not.toThrow();
      for (const fx of ['silhouette', 'brainwashed', 'rim'])
        expect(() =>
          rasterizeToBuffer(megamanDef, resolvePalette(PALETTES, `megaman-dark~${fx}`, mode)),
        ).not.toThrow();
    }
  });
});
