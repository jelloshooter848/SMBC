import { describe, expect, it } from 'vitest';
import { PALETTE_MODES, resolvePalette } from '@engine/gfx/palette';
import { rasterizeToBuffer, validateDef, type SpriteDef } from '@engine/gfx/pixelart';
import {
  dungeonDef,
  dungeonEnemiesDef,
  dungeonEnemiesPalettes,
  dungeonPalettes,
  linkTdDef,
  linkTdPalettes,
} from './dungeon';
import { PALETTES, SPRITES } from './index';

type Size = readonly [w: number, h: number];
const T16: Size = [16, 16];
const S8: Size = [8, 8];
const V8: Size = [8, 16];

// The frame contract Link's top-down dungeon renders against (names and sizes).
const DUNGEON_FRAMES: Record<string, Size> = {
  floor: T16,
  'floor-alt': T16,
  wall: T16,
  'wall-top': T16,
  'wall-corner': T16,
  'door-open': T16,
  'door-locked': T16,
  'door-shut': T16,
  block: T16,
  statue: T16,
  stairs: T16,
  'switch-up': T16,
  'switch-down': T16,
  'torch-0': T16,
  'torch-1': T16,
  'torch-off': T16,
  chest: T16,
  'exit-0': T16,
  'exit-1': T16,
  water: T16,
  key: V8,
  heart: S8,
  'heart-half': S8,
  'heart-empty': S8,
  'heart-pickup': S8,
  'sword-icon': V8,
};

const LINK_TD_FRAMES: Record<string, Size> = {
  'down-0': T16,
  'down-1': T16,
  'up-0': T16,
  'up-1': T16,
  'side-0': T16,
  'side-1': T16,
  'attack-down': T16,
  'attack-up': T16,
  'attack-side': T16,
  'sword-v': V8,
  'sword-h': [16, 8],
};

const ENEMY_FRAMES: Record<string, Size> = {
  'bat-0': T16,
  'bat-1': T16,
  'knight-down-0': T16,
  'knight-down-1': T16,
  'knight-up-0': T16,
  'knight-up-1': T16,
  'knight-side-0': T16,
  'knight-side-1': T16,
  'spitter-down-0': T16,
  'spitter-down-1': T16,
  'spitter-side-0': T16,
  'spitter-side-1': T16,
  rock: S8,
  'keeper-0': [32, 32],
  'keeper-1': [32, 32],
  'keeper-hit': [32, 32],
  'spell-0': S8,
  'spell-1': S8,
  'poof-0': T16,
  'poof-1': T16,
  'poof-2': T16,
};

const SHEETS: [
  id: string,
  def: SpriteDef,
  frames: Record<string, Size>,
  palettes: Record<string, string[]>,
][] = [
  ['dungeon', dungeonDef, DUNGEON_FRAMES, dungeonPalettes],
  ['link-td', linkTdDef, LINK_TD_FRAMES, linkTdPalettes],
  ['dungeon-enemies', dungeonEnemiesDef, ENEMY_FRAMES, dungeonEnemiesPalettes],
];

const rows = (def: SpriteDef, name: string): readonly string[] => def.frames[name] as readonly string[];
const opaque = (frame: readonly string[]) => frame.join('').replace(/\./g, '').length;

describe.each(SHEETS)('%s sheet', (id, def, frames, palettes) => {
  it('validates', () => validateDef(id, def));

  it('has every contract frame at its size, and nothing else', () => {
    expect(Object.keys(def.frames).sort()).toEqual(Object.keys(frames).sort());
    for (const [name, [w, h]] of Object.entries(frames)) {
      const f = rows(def, name);
      expect([f[0]?.length, f.length], name).toEqual([w, h]);
      expect(opaque(f), `${name} is not empty`).toBeGreaterThan(0);
    }
  });

  it('is registered with its palettes, which share one index layout', () => {
    expect(SPRITES[id]).toBe(def);
    expect(palettes[def.palette]).toBeDefined();
    expect(new Set(Object.values(palettes).map((p) => p.length)).size).toBe(1);
    for (const [name, p] of Object.entries(palettes)) expect(PALETTES.default[name]).toBe(p);
  });

  it('renders with every palette in every colour mode, and with the hero effects', () => {
    for (const mode of PALETTE_MODES)
      for (const name of Object.keys(palettes)) {
        const pal = resolvePalette(PALETTES, name, mode);
        expect(() => rasterizeToBuffer(def, pal), `${name} (${mode})`).not.toThrow();
        for (const fx of ['silhouette', 'brainwashed'])
          expect(() => rasterizeToBuffer(def, resolvePalette(PALETTES, `${name}~${fx}`, mode))).not.toThrow();
      }
  });
});

describe('dungeon tiles', () => {
  it('ships the boss-room variant with the same layout', () => {
    expect(Object.keys(dungeonPalettes).sort()).toEqual(['dungeon', 'dungeon-dark']);
  });

  it('wall tiles fill the whole cell; floor objects are opaque tiles', () => {
    for (const name of [
      'floor',
      'floor-alt',
      'wall',
      'wall-top',
      'wall-corner',
      'door-open',
      'door-locked',
      'door-shut',
      'block',
      'statue',
      'stairs',
      'switch-up',
      'switch-down',
      'torch-0',
      'torch-1',
      'torch-off',
      'chest',
      'exit-0',
      'exit-1',
      'water',
    ])
      expect(rows(dungeonDef, name).join(''), name).not.toContain('.');
  });

  it('doors are drawn for the north wall: brick on top, the opening reaching the floor below', () => {
    const wallTop = rows(dungeonDef, 'wall-top');
    for (const door of ['door-open', 'door-locked', 'door-shut', 'exit-0', 'exit-1']) {
      const f = rows(dungeonDef, door);
      expect(f[0], door).toBe(wallTop[0]);
      expect(f[15]?.slice(0, 2), door).toBe(wallTop[15]?.slice(0, 2));
      expect(f[15]?.slice(4, 12), door).not.toBe(wallTop[15]?.slice(4, 12));
    }
    // open is a dark way through; locked and shut close the same arch
    expect(rows(dungeonDef, 'door-open')[15]?.slice(4, 12)).toBe('00000000');
    expect(rows(dungeonDef, 'door-locked').join('')).toContain('d');
    expect(rows(dungeonDef, 'door-shut')).not.toEqual(rows(dungeonDef, 'door-open'));
  });

  it('animated pairs differ between frames', () => {
    for (const [a, b] of [
      ['torch-0', 'torch-1'],
      ['exit-0', 'exit-1'],
      ['switch-up', 'switch-down'],
    ] as const)
      expect(rows(dungeonDef, a), `${a} vs ${b}`).not.toEqual(rows(dungeonDef, b));
  });
});

describe('overhead Link', () => {
  it('walk cycles have two distinct frames each', () => {
    for (const dir of ['down', 'up', 'side'])
      expect(rows(linkTdDef, `${dir}-0`), dir).not.toEqual(rows(linkTdDef, `${dir}-1`));
  });

  it('the horizontal blade is the vertical one turned to point right', () => {
    const v = rows(linkTdDef, 'sword-v');
    const h = rows(linkTdDef, 'sword-h');
    for (let y = 0; y < 8; y++) for (let x = 0; x < 16; x++) expect(h[y]?.[x]).toBe(v[15 - x]?.[y]);
  });

  it('hurt palettes: two flashing tints plus a steady one for reduce flashing', () => {
    const base = linkTdPalettes['link-td'] as string[];
    const names = ['link-td-hurt-0', 'link-td-hurt-1', 'link-td-hurt-calm'];
    for (const n of names) {
      const p = linkTdPalettes[n] as string[];
      expect(p, n).toHaveLength(base.length);
      expect(p[0], `${n} keeps the outline`).toBe(base[0]);
      expect(p[1], `${n} recolours the tunic`).not.toBe(base[1]);
    }
    const [h0, h1, calm] = names.map((n) => linkTdPalettes[n] as string[]);
    expect(h0).not.toEqual(h1);
    expect(calm).not.toEqual(h0);
    expect(calm).not.toEqual(h1);
  });
});

describe('dungeon monsters', () => {
  it('two-frame animations differ', () => {
    for (const [a, b] of [
      ['bat-0', 'bat-1'],
      ['knight-down-0', 'knight-down-1'],
      ['knight-up-0', 'knight-up-1'],
      ['knight-side-0', 'knight-side-1'],
      ['spitter-down-0', 'spitter-down-1'],
      ['spitter-side-0', 'spitter-side-1'],
      ['keeper-0', 'keeper-1'],
      ['spell-0', 'spell-1'],
    ] as const)
      expect(rows(dungeonEnemiesDef, a), `${a} vs ${b}`).not.toEqual(rows(dungeonEnemiesDef, b));
  });

  it("the keeper's hit frame keeps its shape and changes its colours", () => {
    const k = rows(dungeonEnemiesDef, 'keeper-0');
    const hit = rows(dungeonEnemiesDef, 'keeper-hit');
    expect(hit.map((r) => r.replace(/[^.]/g, '#'))).toEqual(k.map((r) => r.replace(/[^.]/g, '#')));
    expect(hit).not.toEqual(k);
  });

  it('the poof grows then scatters', () => {
    const [a, b, c] = ['poof-0', 'poof-1', 'poof-2'].map((n) => opaque(rows(dungeonEnemiesDef, n)));
    expect(b).toBeGreaterThan(a as number);
    expect(c).toBeLessThan(b as number);
  });
});
