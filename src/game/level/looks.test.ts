import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PALETTES, SPRITES } from '@content/sprites';
import { tilesDef } from '@content/sprites/tiles';
import { decorDef } from '@content/sprites/decor';
import { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { View } from '../entities/entity';
import { T, tileDef } from './tiles';
import { parseTextMap } from './textmap';
import { isTheme, isWaterTheme, themeMusic, type LevelData, type Theme } from './schema';
import { SKY, STARRY_SKIES } from '../world/tile-render';
import { decorPalette, drawDecor } from '../entities/objects/decoration';
import { enemyPalette } from '../entities/enemies/enemy';
import { applyLook, campaignLevel } from './campaign';

/**
 * The campaign looks of 0.4.12's first three restyles: 2-1 as a Zelda II field, 3-1 as a Mega
 * Man night stage, 4-2 as Metroid's Brinstar. Each look's levels: the main level and the areas
 * that would keep its look (the sky areas above 2-1 and 3-1).
 */
const LOOKS = [
  { theme: 'zelda2', music: 'zelda2-field', levels: ['world2/2-1', 'world2/2-1-sky', 'world2/2-1-sky2'] },
  { theme: 'megaman-stage', music: 'mm-stage-31', levels: ['world3/3-1', 'world3/3-1-sky'] },
  { theme: 'brinstar', music: 'brinstar', levels: ['world4/4-2'] },
] as const satisfies readonly { theme: Theme; music: string; levels: readonly string[] }[];
const THEMES: Theme[] = LOOKS.map((l) => l.theme);

const frames = tilesDef.frames;
const frame = (name: string) => frames[name] as readonly string[];
const level = (file: string): LevelData =>
  parseTextMap(readFileSync(join(import.meta.dirname, '../../content/levels', `${file}.map`), 'utf8'));
const rgb = (hex: string) =>
  [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)) as [number, number, number];
const lum = (hex: string) => rgb(hex).reduce((a, b) => a + b);
const mask = (rows: readonly string[]) => rows.map((r) => r.replace(/[^.]/g, '#'));

/** The frame names renderTiles (and a bumped block) asks for to draw a level, every animation step. */
function framesUsed(lvl: LevelData): string[] {
  const used = new Set<string>();
  for (const id of lvl.tiles) {
    if (id === T.AIR) continue;
    const def = tileDef(id);
    // a ? block, a hidden block or a brick with something in it turns into a used block
    if (def.block && (def.block.kind !== 'brick' || def.block.content !== 'none')) used.add('used');
    if (def.block?.kind === 'hidden') continue;
    if (def.block?.kind === 'question') for (const n of [0, 1, 2]) used.add(`question-${n}`);
    else if (def.block?.kind === 'brick' || id === T.TRICK) used.add('brick');
    else if (def.pickup === 'coin') for (const n of [0, 1, 2, 3]) used.add(`coin-${n}`);
    else if (id === T.WATER) for (const n of [0, 1]) used.add(`water-${n}`);
    else if (id === T.LAVA) for (const n of [0, 1]) used.add(`lava-${n}`);
    else used.add(def.name);
  }
  return [...used].sort();
}

const QUESTION = ['question-0', 'question-1', 'question-2'];
const COINS = ['coin-0', 'coin-1', 'coin-2', 'coin-3'];
const FLAG = ['flag-ball', 'flag-shaft'];
const PIPE = ['pipe-body-left', 'pipe-body-right', 'pipe-top-left', 'pipe-top-right'];
const PIPE_H = ['pipe-h-bottom-left', 'pipe-h-bottom-right', 'pipe-h-top-left', 'pipe-h-top-right'];

describe('campaign looks: 2-1 Zelda II, 3-1 Mega Man, 4-2 Brinstar', () => {
  it('knows which tiles each level draws', () => {
    expect(framesUsed(level('world2/2-1'))).toEqual(
      ['brick', 'ground', 'hard', 'used', ...QUESTION, ...FLAG, ...PIPE].sort(),
    );
    expect(framesUsed(level('world2/2-1-sky'))).toEqual(['cloud-block', 'used', ...COINS].sort());
    expect(framesUsed(level('world2/2-1-sky2'))).toEqual(['cloud-block', ...COINS].sort());
    expect(framesUsed(level('world3/3-1'))).toEqual(
      [
        'brick',
        'bridge',
        'ground',
        'hard',
        'used',
        'water-0',
        'water-1',
        ...QUESTION,
        ...FLAG,
        ...PIPE,
      ].sort(),
    );
    expect(framesUsed(level('world3/3-1-sky'))).toEqual(['cloud-block', 'used', ...COINS].sort());
    expect(framesUsed(level('world4/4-2'))).toEqual(
      ['brick', 'ground', 'hard', 'used', ...QUESTION, ...COINS, ...PIPE, ...PIPE_H].sort(),
    );
  });

  it.each(LOOKS)('$theme has a frame for every tile its levels draw', ({ theme, levels }) => {
    expect(isTheme(theme)).toBe(true);
    for (const file of levels)
      for (const name of framesUsed(level(file)))
        expect(frames[`${name}@${theme}`], `${file}: ${name}`).toBeDefined();
  });

  it.each(THEMES)('%s keeps every tile its collision shape', (theme) => {
    // solid blocks fill their cell
    for (const name of ['ground', 'hard', 'brick', 'used', 'castle-brick', 'tree-top']) {
      const f = frame(`${name}@${theme}`);
      expect([f.length, ...new Set(f.map((r) => r.length))], `${name}@${theme}`).toEqual([16, 16]);
      expect(f.join(''), `${name}@${theme}`).not.toContain('.');
    }
    // the bridge's deck spans the tile on its top rows; below it opens up; a trunk is scenery
    for (const row of frame(`bridge@${theme}`).slice(0, 4))
      expect(row, `bridge@${theme}`).toMatch(/^[^.]{16}$/);
    expect(frame(`bridge@${theme}`).join('')).toContain('.');
    expect(frame(`tree-trunk@${theme}`).join('')).toContain('.');
    // pipes keep SMB's outline exactly (rim, inset body, open ends)
    for (const name of [...PIPE, ...PIPE_H])
      expect(mask(frame(`${name}@${theme}`)), `${name}@${theme}`).toEqual(mask(frame(name)));
  });

  it.each(THEMES)('%s keeps ? blocks, coins and the flagpole readable', (theme) => {
    // SMB's own frames, in SMB's gold
    for (const name of [...QUESTION, ...COINS, ...FLAG])
      expect(frame(`${name}@${theme}`), `${name}@${theme}`).toEqual(frame(name));
    const tiles = PALETTES.default[`tiles-${theme}`] as string[];
    const smb = PALETTES.default['tiles-overworld'] as string[];
    expect(tiles).toHaveLength(12);
    expect([tiles[4], tiles[7]]).toEqual([smb[4], smb[7]]);
    // the rim of a coin or ? block (slot 1) is dark against the gold
    expect(lum(tiles[1] as string)).toBeLessThan(lum(tiles[4] as string) / 2);
    // the flagpole (slot 5) and the blocks (slot 2) stand out from the sky
    for (const i of [2, 5]) expect(tiles[i], `slot ${i}`).not.toBe(SKY[theme]);
  });

  it.each(LOOKS)('$theme is its own look: sky, palettes, music, no swimming', ({ theme, music }) => {
    expect(SKY[theme]).toMatch(/^#[0-9a-f]{6}$/);
    expect(isWaterTheme(theme)).toBe(false);
    expect(themeMusic(theme)).toBe(music);
    expect(decorPalette(theme)).toBe(`decor-${theme}`);
    expect(PALETTES.default[decorPalette(theme)]).toHaveLength(11);
    const tiles = PALETTES.default[`tiles-${theme}`];
    for (const other of ['overworld', 'underground', 'night', 'station', 'cavern', 'contra-jungle'])
      expect(tiles, other).not.toEqual(PALETTES.default[`tiles-${other}`]);
    for (const name of ['ground', 'brick', 'hard', 'used']) {
      expect(frame(`${name}@${theme}`), `${name}@${theme}`).not.toEqual(frame(name));
      for (const t of THEMES.filter((x) => x !== theme))
        expect(frame(`${name}@${theme}`), `${name}@${theme} vs ${t}`).not.toEqual(frame(`${name}@${t}`));
    }
  });

  it('2-1: a Zelda II field of leafy grass, palace bricks, grey stones and stone pipes under a periwinkle sky', () => {
    // the grass is the greens and black only; the stones are greys and black; so are the pipes
    expect(frame('ground@zelda2').join('')).toMatch(/^[056]+$/);
    expect(frame('hard@zelda2').join('')).toMatch(/^[09a]+$/);
    for (const name of [...PIPE, ...PIPE_H])
      expect(frame(`${name}@zelda2`).join(''), name).toMatch(/^[09a.]+$/);
    // the palace bricks lie in SMB's brick courses (the same mortar), magenta and pink
    const mortar = (rows: readonly string[]) => rows.map((r) => r.replace(/[^0]/g, '.'));
    expect(mortar(frame('brick@zelda2'))).toEqual(mortar(frame('brick')));
    const tiles = PALETTES.default['tiles-zelda2'] as string[];
    for (const i of [1, 2, 3]) {
      const [r, g, b] = rgb(tiles[i] as string);
      expect(r, `slot ${i} is magenta`).toBeGreaterThan(g);
      expect(b, `slot ${i} is magenta`).toBeGreaterThan(g);
    }
    for (const i of [9, 10]) {
      const [r, g, b] = rgb(tiles[i] as string);
      expect([g, b], `slot ${i} is grey`).toEqual([r, r]);
    }
    // a daylight sky, not SMB's; Link's overworld enemies keep their look
    expect(SKY.zelda2).not.toBe(SKY.overworld);
    const [r, g, b] = rgb(SKY.zelda2 as string);
    expect(b).toBeGreaterThan(Math.max(r, g));
    expect(lum(SKY.zelda2 as string)).toBeGreaterThan(0x180);
    expect(enemyPalette('zelda2')).toBe(enemyPalette('overworld'));
  });

  it('3-1: a Mega Man night stage of violet plating and orange pipes under the stars', () => {
    for (const name of ['ground', 'brick', 'used', 'castle-brick'])
      expect(frame(`${name}@megaman-stage`).join(''), name).toMatch(/^[0-38]+$/);
    // the bricks keep SMB's courses with a bolt on each; the hard blocks carry a mint light strip
    const mortar = (rows: readonly string[]) => rows.map((r) => r.replace(/[^0]/g, '.'));
    expect(mortar(frame('brick@megaman-stage'))).toEqual(mortar(frame('brick')));
    expect(frame('brick@megaman-stage').join('').replace(/[^8]/g, '')).toHaveLength(8);
    expect(frame('hard@megaman-stage').join('')).toContain('b');
    // pipes ring at their joints: the body has a dark band across
    expect(frame('pipe-body-left@megaman-stage')[7]).toMatch(/^\.\.0+$/);
    const tiles = PALETTES.default['tiles-megaman-stage'] as string[];
    const [pr, pg, pb] = rgb(tiles[5] as string);
    expect(pr).toBeGreaterThan(pg + pb); // orange pipes
    for (const i of [1, 2, 3]) {
      const [r, g, b] = rgb(tiles[i] as string);
      expect(b, `slot ${i} is violet`).toBeGreaterThan(Math.max(r, g));
    }
    expect(lum(tiles[1] as string)).toBeLessThan(lum(tiles[2] as string));
    expect(lum(tiles[2] as string)).toBeLessThan(lum(tiles[3] as string));
    // a dark navy night, with stars; 3-1's water stays blue water (not a water theme)
    const [r, g, b] = rgb(SKY['megaman-stage'] as string);
    expect(b).toBeGreaterThan(r + g);
    expect(lum(SKY['megaman-stage'] as string)).toBeLessThan(0x60);
    expect(STARRY_SKIES.has('megaman-stage')).toBe(true);
    expect(frame('water-0@megaman-stage')).toEqual(frame('water-0'));
    expect(enemyPalette('megaman-stage')).toBe(enemyPalette('night'));
  });

  it("4-2: Brinstar's blue bubble rock, shootable blocks, vent blocks and pale tubes in the dark", () => {
    expect(frame('ground@brinstar').join('')).toMatch(/^[01238]+$/);
    // the bricks are a grid of four 8x8 shootable blocks, seamed black right and below
    const brick = frame('brick@brinstar');
    for (const y of [7, 15]) expect(brick[y]).toBe('0'.repeat(16));
    for (const row of brick) expect([row[7], row[15]]).toEqual(['0', '0']);
    expect(brick.slice(0, 8).map((r) => r.slice(0, 8))).toEqual(brick.slice(8).map((r) => r.slice(8)));
    // vent blocks of grey and white; tubes of the same
    expect(frame('hard@brinstar').join('')).toMatch(/^[056]+$/);
    for (const name of [...PIPE, ...PIPE_H])
      expect(frame(`${name}@brinstar`).join(''), name).toMatch(/^[056.]+$/);
    const tiles = PALETTES.default['tiles-brinstar'] as string[];
    for (const i of [1, 2, 3]) {
      const [r, g, b] = rgb(tiles[i] as string);
      expect(b, `slot ${i} is blue`).toBeGreaterThan(r + g / 2);
    }
    for (const i of [5, 6]) {
      const [r, g, b] = rgb(tiles[i] as string);
      expect([g, b], `slot ${i} is grey`).toEqual([r, r]);
    }
    expect(SKY.brinstar).toBe('#000000');
    expect(enemyPalette('brinstar')).toBe(enemyPalette('underground'));
  });

  it('redraws clouds and trees; new scenery stands by for the maps', () => {
    for (const n of ['henge', 'mm-skyline', 'brinstar-brush', 'brinstar-column'])
      expect(decorDef.frames[n], n).toBeDefined();
    const assets = new AssetRegistry(PALETTES);
    assets.defineAll(SPRITES);
    const drawn = (theme: Theme, kind: string) => {
      const view: View = { camX: 0, frame: 0, assets, theme, reduceFlashing: true };
      const out: { sheet: string; frame: string }[] = [];
      const r = Object.assign(new NullRenderer(), {
        sprite(s: SpriteSheet, f: string): void {
          out.push({ sheet: s.id, frame: f });
        },
      });
      drawDecor(r, view, kind, 0, 128);
      return out[0];
    };
    for (const n of ['cloud-1', 'cloud-2', 'cloud-3', 'tree-big', 'tree-small'])
      expect(drawn('zelda2', n), n).toEqual({ sheet: 'decor@decor-zelda2', frame: `${n}@zelda2` });
    for (const n of ['tree-big', 'tree-small'])
      expect(drawn('megaman-stage', n)?.frame, n).toBe(`${n}@megaman-stage`);
    // the night stage keeps its clouds, dimmed by its palette; castles stay castles
    expect(drawn('megaman-stage', 'cloud-1')?.frame).toBe('cloud-1');
    expect(drawn('zelda2', 'castle-big')?.frame).toBe('castle-big');
    // Zelda II clouds have a flat, dithered underside and no outline (slot 4 white, 5 grey)
    const c = decorDef.frames['cloud-1@zelda2'] as readonly string[];
    expect(c.join('').replace(/\./g, '')).toMatch(/^[45]+$/);
    expect(c[13]?.replace(/^\.+|\.+$/g, '')).toMatch(/^(45|54)+4?5?$/);
  });

  it.each(LOOKS)(
    'a map naming the $theme look gets its theme and music in the campaign',
    ({ theme, music }) => {
      const l = parseTextMap(
        [
          'id: 9-9',
          'theme: overworld',
          'music: overworld',
          `campaignTheme: ${theme}`,
          `campaignMusic: ${music}`,
          'start: 1,12',
          '[tiles]',
          ...Array.from({ length: 13 }, () => '................'),
          '################',
          '################',
        ].join('\n'),
      );
      const out = applyLook(l);
      expect([out.theme, out.music]).toEqual([theme, music]);
      expect(campaignLevel(l, () => true).theme).toBe(theme);
    },
  );
});
