import { describe, expect, it } from 'vitest';
import { rasterizeToBuffer, validateDef, type SpriteDef } from '@engine/gfx/pixelart';
import { decorDef, decorPalettes } from './decor';
import { fontDef, fontPalette } from './font';
import { itemPalettes, itemsDef } from './items';
import { tilePalettes, tilesDef } from './tiles';

type Size = readonly [w: number, h: number];
const T16: Size = [16, 16];
const S8: Size = [8, 8];

const tileFrames = [
  'ground',
  'brick',
  'question-0',
  'question-1',
  'question-2',
  'used',
  'hard',
  'pipe-top-left',
  'pipe-top-right',
  'pipe-bottom-left',
  'pipe-bottom-right',
  'pipe-body-left',
  'pipe-body-right',
  'pipe-h-top-left',
  'pipe-h-top-right',
  'pipe-h-bottom-left',
  'pipe-h-bottom-right',
  'coin-0',
  'coin-1',
  'coin-2',
  'coin-3',
  'flag-shaft',
  'flag-ball',
  'tree-top',
  'tree-trunk',
  'mushroom-top',
  'mushroom-stem',
  'lava-0',
  'lava-1',
  'bridge',
  'chain',
  'castle-brick',
  'water-0',
  'water-1',
  'cloud-block',
  'blaster-top',
  'blaster-base',
  'wall',
  'wall-top',
  'ground@underground',
  'ground@castle',
  'brick@underground',
  'tree-top@mushroom',
  'tree-trunk@mushroom',
  'tree-top@clouds',
  'tree-trunk@clouds',
  'ground@clouds',
  'tree-top@clouds-overworld',
  'tree-trunk@clouds-overworld',
  'tree-top@mushroom-red',
  'tree-trunk@mushroom-red',
  'ground@castle-water',
];

const fontGlyphs = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  '-',
  '.',
  '!',
  '?',
  '%',
  ':',
  ',',
  "'",
  '×',
  '©',
  '>',
  '$',
  'h',
  'f',
  'e',
];

const itemFrames: Record<string, Size> = {
  'map-node-open': T16,
  'map-node-cleared': T16,
  'map-node-start': T16,
  'map-node-bonus': T16,
  'map-node-secret': T16,
  'map-node-secret-cleared': T16,
  'map-castle': T16,
  'map-castle-cleared': T16,
  'map-warp': T16,
  'map-warp-locked': T16,
  'map-path-dot': S8,
  mushroom: T16,
  '1up': T16,
  'poison-mushroom': T16,
  clock: T16,
  'flower-0': T16,
  'flower-1': T16,
  'star-0': T16,
  'star-1': T16,
  'star-2': T16,
  'star-3': T16,
  'coin-0': T16,
  'coin-1': T16,
  'coin-2': T16,
  'coin-3': T16,
  'axe-0': T16,
  'axe-1': T16,
  'axe-2': T16,
  'brick-piece': S8,
  'fireball-0': S8,
  'fireball-1': S8,
  'fireball-2': S8,
  'fireball-3': S8,
  firebar: S8,
  'buster-0': S8,
  'buster-1': S8,
  'sword-beam': S8,
  'bowser-flame-0': [24, 8],
  'bowser-flame-1': [24, 8],
  platform: [16, 8],
  plank: S8,
  'spring-0': [16, 32],
  princess: [16, 24],
  toad: [16, 24],
  'spring-1': [16, 32],
  'spring-2': [16, 32],
  'spring-green-0': [16, 32],
  'spring-green-1': [16, 32],
  'spring-green-2': [16, 32],
  'vine-top': T16,
  'vine-mid': T16,
  pulley: T16,
  flag: T16,
  'castle-flag': T16,
  'firework-0': T16,
  'firework-1': T16,
  'firework-2': T16,
  'bomb-0': T16,
  'bomb-1': T16,
  'explosion-0': [32, 32],
  'explosion-1': [32, 32],
  'explosion-2': [32, 32],
  'boomerang-0': S8,
  'boomerang-1': S8,
  'boomerang-2': S8,
  'boomerang-3': S8,
  'magic-jar-small': S8,
  'magic-jar-large': T16,
  'heart-small': S8,
  'icon-boomerang': S8,
  'icon-bomb': S8,
  'icon-jump': S8,
  'icon-shield': S8,
  'icon-fire': S8,
  'saw-disc-0': T16,
  'saw-disc-1': T16,
  leaf: T16,
  'flame-wave-0': T16,
  'flame-wave-1': T16,
  knuckle: T16,
  'bolt-0': [24, 8],
  'bolt-1': [24, 8],
  'rush-coil-0': T16,
  'rush-coil-1': T16,
  'pellet-small': S8,
  'pellet-large': T16,
  'weapon-pellet-small': S8,
  'weapon-pellet-large': T16,
  'e-tank': T16,
  'icon-buster': S8,
  'icon-saw': S8,
  'icon-leaf': S8,
  'icon-flame': S8,
  'icon-knuckle': S8,
  'icon-bolt': S8,
  'icon-rush': S8,
  'beam-0': S8,
  'beam-1': S8,
  'ice-beam-0': S8,
  'ice-beam-1': S8,
  'wave-beam-0': S8,
  'wave-beam-1': S8,
  missile: [16, 8],
  'morph-bomb-0': S8,
  'morph-bomb-1': S8,
  'energy-orb-small': S8,
  'energy-orb-large': T16,
  'missile-pack': T16,
  'icon-beam': S8,
  'icon-missile': S8,
  dagger: [16, 8],
  'hand-axe-0': T16,
  'hand-axe-1': T16,
  'hand-axe-2': T16,
  'hand-axe-3': T16,
  'holy-water': S8,
  'holy-fire-0': T16,
  'holy-fire-1': T16,
  'cross-0': T16,
  'cross-1': T16,
  'cross-2': T16,
  'cross-3': T16,
  stopwatch: S8,
  'heart-large': T16,
  'icon-dagger': S8,
  'icon-axe': S8,
  'icon-holy-water': S8,
  'icon-cross': S8,
  'icon-watch': S8,
  'throwing-star-0': S8,
  'throwing-star-1': S8,
  'windmill-0': T16,
  'windmill-1': T16,
  'windmill-2': T16,
  'windmill-3': T16,
  'fire-wheel-0': T16,
  'fire-wheel-1': T16,
  'ninpo-small': S8,
  'ninpo-large': T16,
  'icon-star': S8,
  'icon-windmill': S8,
  'icon-fire-wheel': S8,
  'icon-slash': S8,
  'rifle-shot': S8,
  'mg-shot': S8,
  'spread-shot-0': S8,
  'spread-shot-1': S8,
  'laser-beam': [24, 8],
  'flame-shot-0': T16,
  'flame-shot-1': T16,
  capsule: T16,
  'icon-rifle': S8,
  'icon-mg': S8,
  'icon-spread': S8,
  'icon-laser': S8,
  'icon-flame-gun': S8,
};

const decorFrames: Record<string, Size> = {
  'hill-big': [80, 48],
  'hill-small': [48, 32],
  'bush-1': [32, 16],
  'bush-2': [48, 16],
  'bush-3': [64, 16],
  'cloud-1': [32, 24],
  'cloud-2': [48, 24],
  'cloud-3': [64, 24],
  'tree-big': [16, 48],
  'tree-small': [16, 32],
  fence: T16,
  'castle-small': [80, 80],
  'castle-big': [144, 176],
};

function expectFrame(def: SpriteDef, name: string, [w, h]: Size): void {
  const rows = def.frames[name];
  expect(rows, `missing frame ${name}`).toBeDefined();
  const frame = rows as readonly string[];
  expect(frame.length, `${name} height`).toBe(h);
  for (const row of frame) expect(row.length, `${name} width`).toBe(w);
}

function expectRenders(def: SpriteDef, palettes: Record<string, readonly string[]>): void {
  for (const [name, palette] of Object.entries(palettes)) {
    expect(() => rasterizeToBuffer(def, palette), `render with ${name}`).not.toThrow();
  }
}

describe('tile sprites', () => {
  it('validates', () => validateDef('tiles', tilesDef));

  it('has every tile frame at 16x16', () => {
    for (const name of tileFrames) expectFrame(tilesDef, name, T16);
  });

  it('themes share one palette layout', () => {
    const lengths = new Set(Object.values(tilePalettes).map((p) => p.length));
    expect(lengths.size).toBe(1);
    expect(Object.keys(tilePalettes).sort()).toEqual(
      [
        'tiles-castle',
        'tiles-night',
        'tiles-overworld',
        'tiles-snow',
        'tiles-underground',
        'tiles-water',
        'tiles-mushroom',
        'tiles-clouds',
        'tiles-overworld-water',
        'tiles-water-gray',
      ].sort(),
    );
    expect(tilePalettes[tilesDef.palette]).toBeDefined();
    expectRenders(tilesDef, tilePalettes);
  });

  it('pipe rims and bodies line up when tiled', () => {
    const edge = (name: string, col: number): string =>
      (tilesDef.frames[name] as readonly string[]).map((r) => r[col]).join('');
    // the rim outline spans both tiles; the body is inset 2px with its own outline
    expect(edge('pipe-top-left', 0)).toMatch(/^0+$/);
    expect(edge('pipe-top-right', 15)).toMatch(/^0+$/);
    expect(edge('pipe-body-left', 2)).toMatch(/^0+$/);
    expect(edge('pipe-body-right', 13)).toMatch(/^0+$/);
    expect(edge('pipe-body-left', 0) + edge('pipe-body-right', 15)).toMatch(/^\.+$/);
    // a pipe hanging from the ceiling ends in the same rim upside down
    const rows = (name: string): readonly string[] => tilesDef.frames[name] as readonly string[];
    expect(rows('pipe-bottom-left')).toEqual([...rows('pipe-top-left')].reverse());
    expect(rows('pipe-bottom-right')).toEqual([...rows('pipe-top-right')].reverse());
  });
});

describe('font sprites', () => {
  it('validates and has every glyph at 8x8', () => {
    validateDef('font', fontDef);
    for (const glyph of fontGlyphs) expectFrame(fontDef, glyph, S8);
    expect(fontPalette[1]).toBe('#fcfcfc');
    expectRenders(fontDef, { font: fontPalette });
  });

  it('draws % as two dots and a slash in the 7x7 cell, in 2px strokes', () => {
    const rows = fontDef.frames['%'] as readonly string[];
    expect(rows[7]).toBe('........');
    for (const line of rows) expect(line[7]).toBe('.');
    // a dot top left, a dot bottom right, the slash rising to the right between them
    expect(rows[0]?.slice(0, 2)).toBe('11');
    expect(rows[1]?.slice(0, 2)).toBe('11');
    expect(rows[5]?.slice(5, 7)).toBe('11');
    expect(rows[6]?.slice(5, 7)).toBe('11');
    expect(rows[0]?.[6]).toBe('1');
    expect(rows[5]?.[0]).toBe('1');
    expect(rows.slice(0, 7).every((l) => /^[.1]{8}$/.test(l))).toBe(true);
    expect(Object.entries(fontDef.frames).filter(([, r]) => r.join() === rows.join())).toHaveLength(1);
  });
});

describe('item sprites', () => {
  it('validates and has every item frame at its size', () => {
    validateDef('items', itemsDef);
    for (const [name, size] of Object.entries(itemFrames)) expectFrame(itemsDef, name, size);
    expect(itemPalettes[itemsDef.palette]).toBeDefined();
    expectRenders(itemsDef, itemPalettes);
  });
});

describe('decor sprites', () => {
  it('validates and has every decor frame at its size', () => {
    validateDef('decor', decorDef);
    for (const [name, size] of Object.entries(decorFrames)) expectFrame(decorDef, name, size);
    const lengths = new Set(Object.values(decorPalettes).map((p) => p.length));
    expect(lengths.size).toBe(1);
    expect(Object.keys(decorPalettes).sort()).toEqual(
      [
        'decor-night',
        'decor-overworld',
        'decor-snow',
        'decor-mushroom',
        'decor-mushroom-red',
        'decor-gray',
      ].sort(),
    );
    expectRenders(decorDef, decorPalettes);
  });
});
