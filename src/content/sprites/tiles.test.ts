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
  'ground@underground',
  'ground@castle',
  'brick@underground',
];

const fontGlyphs = [
  ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',
  '-',
  '.',
  '!',
  '?',
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
  mushroom: T16,
  '1up': T16,
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
  'spring-0': T16,
  'spring-1': T16,
  'spring-2': T16,
  flag: T16,
  'castle-flag': T16,
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
  });
});

describe('font sprites', () => {
  it('validates and has every glyph at 8x8', () => {
    validateDef('font', fontDef);
    for (const glyph of fontGlyphs) expectFrame(fontDef, glyph, S8);
    expect(fontPalette[1]).toBe('#fcfcfc');
    expectRenders(fontDef, { font: fontPalette });
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
    expect(Object.keys(decorPalettes).sort()).toEqual(['decor-night', 'decor-overworld', 'decor-snow']);
    expectRenders(decorDef, decorPalettes);
  });
});
