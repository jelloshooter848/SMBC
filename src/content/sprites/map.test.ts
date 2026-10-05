import { describe, expect, it } from 'vitest';
import { rasterizeToBuffer, validateDef } from '@engine/gfx/pixelart';
import { mapDef, mapPalettes, SHORES, WATER_FRAMES } from './map';
import { PALETTES, SPRITES } from './index';

type Size = readonly [w: number, h: number];
const T16: Size = [16, 16];

const THEMES = ['grass', 'sea', 'night', 'mushroom', 'sky', 'snow', 'coast', 'bowser'];

const tileFrames = [
  'ground',
  'tuft',
  'flowers-0',
  'flowers-1',
  'sand',
  'drift',
  'cliff',
  'tree',
  'palm',
  'hill',
  'hill-snow',
  'mountain',
  'rock',
  'ridge',
  'ridge-snow',
  'cap-left',
  'cap-mid',
  'cap-right',
  'stem',
  'treetop-left',
  'treetop-mid',
  'treetop-right',
  'trunk',
  'wall',
  'battlement',
  'gate',
  'pipe',
  'blaster',
  'moon',
  'cloud',
  ...[0, 1, 2, 3].flatMap((i) => [`star-${i}`, `lava-${i}`]),
  ...Array.from({ length: WATER_FRAMES }, (_, f) => [
    `water-${f}`,
    `surf-${f}`,
    `cliff-sea-${f}`,
    `bridge-h-${f}`,
    `bridge-v-${f}`,
    ...Object.keys(SHORES).map((k) => `shore-${k}-${f}`),
    ...['w', 'e', 'n', 's'].map((k) => `landing-${k}-${f}`),
  ]).flat(),
];

const actorFrames: Record<string, Size> = {
  'flag-0': T16,
  'flag-1': T16,
  'flag-2': T16,
  'twinkle-0': [8, 8],
  'twinkle-1': [8, 8],
  'twinkle-2': [8, 8],
  'twinkle-3': [8, 8],
  'smoke-0': [8, 8],
  'smoke-1': [8, 8],
  'smoke-2': [8, 8],
  bubble: [8, 8],
  'splash-0': [16, 8],
  'splash-1': [16, 8],
};

function expectFrame(name: string, [w, h]: Size): void {
  const rows = mapDef.frames[name];
  expect(rows, `missing frame ${name}`).toBeDefined();
  expect(rows?.length, `${name} height`).toBe(h);
  for (const row of rows ?? []) expect(row.length, `${name} width`).toBe(w);
}

describe('map sprites', () => {
  it('validates', () => validateDef('map', mapDef));

  it('has every map tile at 16x16 and every actor frame at its size', () => {
    for (const name of tileFrames) expectFrame(name, T16);
    for (const [name, size] of Object.entries(actorFrames)) expectFrame(name, size);
    expect(Object.keys(mapDef.frames).sort()).toEqual([...tileFrames, ...Object.keys(actorFrames)].sort());
  });

  it('has one palette per theme, all with the same roles', () => {
    expect(Object.keys(mapPalettes).sort()).toEqual(THEMES.map((t) => `map-${t}`).sort());
    const lengths = new Set(Object.values(mapPalettes).map((p) => p.length));
    expect([...lengths]).toEqual([28]);
    for (const p of Object.values(mapPalettes)) for (const c of p) expect(c).toMatch(/^#[0-9a-f]{6}$/);
    expect(mapPalettes[mapDef.palette]).toBeDefined();
  });

  it('renders with every theme palette', () => {
    for (const [name, palette] of Object.entries(mapPalettes))
      expect(() => rasterizeToBuffer(mapDef, palette), name).not.toThrow();
  });

  it('is registered with its palettes', () => {
    expect(SPRITES['map']).toBe(mapDef);
    for (const t of THEMES) expect(PALETTES.default[`map-${t}`]).toBeDefined();
    expect(PALETTES.highContrast?.['map-bowser']).toBeDefined();
  });

  it('water rows tile seamlessly and loop over the water frames', () => {
    const w0 = mapDef.frames['water-0'] as readonly string[];
    // Every row has an 8 px period, so the drift loops after WATER_FRAMES steps.
    for (const row of w0) expect(row.slice(0, 8)).toBe(row.slice(8));
    expect(WATER_FRAMES).toBe(8);
  });

  it('shores join their neighbours: water strips line up across tile seams', () => {
    const water = (name: string, x: number, y: number): boolean => {
      const c = (mapDef.frames[name] as readonly string[])[y]?.[x] as string;
      return '6789'.includes(c);
    };
    // A north shore continues into the next north shore and into the NE/NW corners.
    for (let y = 0; y < 16; y++) {
      expect(water('shore-n-0', 15, y), `n|n row ${y}`).toBe(water('shore-n-0', 0, y));
      expect(water('shore-n-0', 15, y), `n|ne row ${y}`).toBe(water('shore-ne-0', 0, y));
      expect(water('shore-w-0', y, 15), `w over w col ${y}`).toBe(water('shore-w-0', y, 0));
      expect(water('shore-in-nw-0', 0, y), `n|in-nw row ${y}`).toBe(water('shore-n-0', 15, y));
    }
  });
});
