import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { tilesDef } from '@content/sprites/tiles';
import { songs } from '@content/music/songs';
import { megamanWorldSongs } from '@content/music/megaman-world';
import { compileSong, type Track } from '@engine/audio/mml';
import { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { applyLook, campaignLevel } from '@game/level/campaign';
import {
  hasSolidFloors,
  isCastleTheme,
  isSwimLevel,
  isWaterTheme,
  themeMusic,
  type LevelData,
  type Theme,
} from '@game/level/schema';
import { T, tileDef } from '@game/level/tiles';
import { enemyPalette } from '@game/entities/enemies/enemy';
import { decorPalette } from '@game/entities/objects/decoration';
import { ROPE_COLOUR } from '@game/entities/objects/balance-lift';
import { SKY } from '@game/world/tile-render';
import { drawThemeBackdrop, hasThemeBackdrop } from '@game/world/theme-backdrop';
import type { View } from '@game/entities/entity';

/*
 * 0.4.26: World 3 is Mega Man's world (owner notes 5, 18 and 21: each world, its map page and every
 * level in it, is themed after the hero freed there). 3-1 and its sky keep their 0.4.12 night stage
 * (`megaman-stage`) and the space station its own; the rest of World 3 takes Mega Man 2-style
 * stage looks in campaign play: 3-1's bonus room a Metal Man-style factory (`megaman-metal`, the
 * underground still), 3-2 a Wood Man-style forest (`megaman-wood`), 3-3's treetops Air Man-style
 * cloud platforms (`megaman-air`) and 3-4 Wily's fortress (`megaman-fortress`, in the castle
 * family). Classic play keeps SMB's 3-1 to 3-4 exactly.
 */

const WORLD3: Readonly<Record<string, { theme: Theme; music: string; classic: Theme }>> = {
  '3-1-bonus': { theme: 'megaman-metal', music: 'mm-station', classic: 'underground' },
  '3-2': { theme: 'megaman-wood', music: 'mm-wood', classic: 'night' },
  '3-3': { theme: 'megaman-air', music: 'mm-air', classic: 'night' },
  '3-4': { theme: 'megaman-fortress', music: 'mm-wily', classic: 'castle' },
};
const IDS = Object.keys(WORLD3);
const NEW_THEMES: Theme[] = ['megaman-metal', 'megaman-wood', 'megaman-air', 'megaman-fortress'];

const frames = tilesDef.frames;
const rgb = (hex: string) =>
  [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)) as [number, number, number];
const lum = (hex: string) => rgb(hex).reduce((a, b) => a + b);

/** The frame names renderTiles asks for to draw a level, every animation step. */
function framesUsed(lvl: LevelData): string[] {
  const used = new Set<string>();
  for (const id of lvl.tiles) {
    if (id === T.AIR) continue;
    const def = tileDef(id);
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

const registry = () => {
  const a = new AssetRegistry(PALETTES);
  a.defineAll(SPRITES);
  return a;
};

/** Every sprite a theme's backdrop draws at camera x `camX`, as `sheet frame`. */
function backdrop(theme: Theme, camX: number): string[] {
  const drawn: string[] = [];
  const r = Object.assign(new NullRenderer(), {
    sprite(s: SpriteSheet, f: string): void {
      drawn.push(`${s.id} ${f}`);
    },
  });
  const view: View = { camX, frame: 0, assets: registry(), theme, reduceFlashing: true };
  drawThemeBackdrop(r, view);
  return drawn;
}

describe("World 3 as Mega Man's world: Mega Man 2-style stage looks, campaign only", () => {
  it.each(IDS)('%s names its look; campaign play shows it', (id) => {
    const { theme, music } = WORLD3[id]!;
    expect(getLevel(id).campaignLook, id).toMatchObject({ theme, music });
    const camp = campaignLevel(getLevel(id));
    expect([camp.theme, camp.music]).toEqual([theme, music]);
  });

  it.each(IDS)('%s keeps its SMB look outside the campaign', (id) => {
    const lvl = getLevel(id);
    expect(lvl.theme).toBe(WORLD3[id]!.classic);
    expect(lvl.music).not.toBe(WORLD3[id]!.music);
    expect(applyLook(lvl, { theme: () => false, music: () => false })).toBe(lvl);
  });

  it('3-1 and its sky keep the night stage; the space station keeps its own look', () => {
    for (const id of ['3-1', '3-1-sky']) expect(campaignLevel(getLevel(id)).theme, id).toBe('megaman-stage');
    const station = getLevel('3-1-station');
    expect(station.campaignLook).toBeUndefined();
    expect(campaignLevel(station).theme).toBe('station');
  });

  it.each(IDS)('%s: every tile it draws has a frame in its look, every solid block redrawn', (id) => {
    const { theme } = WORLD3[id]!;
    const used = framesUsed(getLevel(id));
    for (const name of used)
      expect(frames[`${name}@${theme}`] ?? frames[name], `${id}: ${name}`).toBeDefined();
    for (const name of used.filter((n) =>
      /^(ground|brick|hard|used|castle-brick|bridge|chain|tree-top|tree-trunk)$/.test(n),
    ))
      expect(frames[`${name}@${theme}`], `${id}: ${name}@${theme}`).toBeDefined();
  });

  it.each(IDS)('%s plays exactly as the classic level: tiles, zones, entities, start, clock', (id) => {
    const classic = getLevel(id);
    const camp = campaignLevel(classic);
    expect(camp.tiles).toEqual(classic.tiles);
    expect(camp.entities).toEqual(classic.entities);
    expect(camp.zones).toEqual(classic.zones);
    expect([camp.start, camp.startMode, camp.time, camp.width]).toEqual([
      classic.start,
      classic.startMode,
      classic.time,
      classic.width,
    ]);
    // every rule that keys off the theme answers as for the classic level
    expect(isWaterTheme(camp.theme)).toBe(false);
    expect(isSwimLevel(camp)).toBe(isSwimLevel(classic));
    expect(isCastleTheme(camp.theme)).toBe(isCastleTheme(classic.theme));
    expect(hasSolidFloors(camp.theme)).toBe(hasSolidFloors(classic.theme));
    expect(enemyPalette(camp.theme)).toBe(enemyPalette(classic.theme));
  });
});

describe("3-1's bonus room: a Metal Man-style factory (megaman-metal)", () => {
  it('plays as the underground: its enemies, its solid floors', () => {
    expect(enemyPalette('megaman-metal')).toBe(enemyPalette('underground'));
    expect(hasSolidFloors('megaman-metal')).toBe(true);
    expect(isCastleTheme('megaman-metal')).toBe(false);
  });

  it('hangs gears on its back wall and reuses the space station’s steel pipes', () => {
    expect(campaignLevel(getLevel('3-1-bonus')).decor.map((d) => d.kind)).toContain('mm-gear');
    expect(frames['pipe-body-left@megaman-metal']).toBeDefined();
  });
});

describe('3-2: a Wood Man-style forest (megaman-wood)', () => {
  it('stands its trees as robot-forest trees and paints a forest behind the level', () => {
    const decor = registry().sheet('decor', decorPalette('megaman-wood'));
    for (const t of ['tree-big', 'tree-small']) expect(decor.frames.has(`${t}@megaman-wood`), t).toBe(true);
    expect(hasThemeBackdrop('megaman-wood')).toBe(true);
    const drawn = backdrop('megaman-wood', 500);
    expect(drawn.some((d) => d.endsWith(' mmw-trunk'))).toBe(true);
    for (const d of drawn) expect(d.startsWith('decor@decor-megaman-wood'), d).toBe(true);
  });
});

describe('3-3: Air Man-style cloud platforms (megaman-air)', () => {
  it('draws its treetops as cloud platforms on steel pylons, and its ledges stay solid', () => {
    const used = framesUsed(getLevel('3-3'));
    for (const n of ['tree-top', 'tree-trunk']) expect(used, n).toContain(n);
    const top = frames['tree-top@megaman-air']!;
    expect(top).toHaveLength(16);
    for (const row of top) expect(row).toMatch(/^[0-9ab]{16}$/);
  });

  it("its lifts' planks and the balance lifts' ropes read clearly against its sky", () => {
    const sky = SKY['megaman-air'] as string;
    const cream = (PALETTES.default.items as string[])[3] as string;
    expect(Math.abs(lum(ROPE_COLOUR) - lum(sky)), 'rope').toBeGreaterThanOrEqual(150);
    expect(Math.abs(lum(cream) - lum(sky)), 'planks').toBeGreaterThanOrEqual(150);
    // a daylight sky, as Air Man's: blue, never the classic night's black
    const [r, g, b] = rgb(sky);
    expect(b).toBeGreaterThan(Math.max(r, g));
    expect(sky).not.toBe(SKY.night);
  });
});

describe("3-4: Wily's fortress (megaman-fortress)", () => {
  it('is in the castle family: castle enemies, solid floors, no swimming', () => {
    expect(isCastleTheme('megaman-fortress')).toBe(true);
    expect(hasSolidFloors('megaman-fortress')).toBe(true);
    expect(isWaterTheme('megaman-fortress')).toBe(false);
    expect(enemyPalette('megaman-fortress')).toBe(enemyPalette('castle'));
  });

  it("paints the fortress's machinery behind the level; lava stays SMB's red", () => {
    expect(hasThemeBackdrop('megaman-fortress')).toBe(true);
    const drawn = backdrop('megaman-fortress', 300);
    expect(drawn.some((d) => d.endsWith(' mmf-wall'))).toBe(true);
    expect(drawn.some((d) => d.endsWith(' mmf-skull'))).toBe(true);
    for (const d of drawn) expect(d.startsWith('decor@decor-megaman-fortress'), d).toBe(true);
    const tiles = PALETTES.default['tiles-megaman-fortress'] as string[];
    expect(tiles[11]).toBe((PALETTES.default['tiles-castle'] as string[])[11]);
  });
});

describe('the new looks', () => {
  it.each(NEW_THEMES)('%s has a sky, its tile and decor palettes and its music', (theme) => {
    expect(SKY[theme]).toMatch(/^#[0-9a-f]{6}$/);
    expect(PALETTES.default[`tiles-${theme}`]).toHaveLength(12);
    expect(decorPalette(theme)).toBe(`decor-${theme}`);
    expect(PALETTES.default[decorPalette(theme)]).toHaveLength(11);
    expect(songs.map((s) => s.id)).toContain(themeMusic(theme));
    // SMB's gold (coins, ? blocks) reads as ever
    const tiles = PALETTES.default[`tiles-${theme}`] as string[];
    const smb = PALETTES.default['tiles-overworld'] as string[];
    expect([tiles[4], tiles[7]]).toEqual([smb[4], smb[7]]);
  });

  it.each(NEW_THEMES)('%s keeps solid blocks solid (16x16, no clear pixel)', (theme) => {
    for (const name of ['ground', 'hard', 'brick', 'used', 'castle-brick', 'tree-top']) {
      const f = frames[`${name}@${theme}`];
      if (!f) continue;
      expect(f.length, `${name}@${theme}`).toBe(16);
      for (const row of f) expect(row, `${name}@${theme}`).toMatch(/^[0-9ab]{16}$/);
    }
  });

  it('every decor piece the World 3 looks place is drawn by their theme', () => {
    const assets = registry();
    for (const id of IDS) {
      const camp = campaignLevel(getLevel(id));
      const sheet = assets.sheet('decor', decorPalette(camp.theme));
      for (const d of camp.decor)
        expect(
          sheet.frames.has(`${d.kind}@${camp.theme}`) || sheet.frames.has(d.kind),
          `${id}: ${d.kind}`,
        ).toBe(true);
    }
  });

  it("has three original Mega Man 2-style tunes (Wood Man's forest, Air Man's sky, Wily's fortress); the factory reuses the station's", () => {
    expect(megamanWorldSongs.map((s) => s.id)).toEqual(['mm-wood', 'mm-air', 'mm-wily']);
    for (const s of megamanWorldSongs) {
      expect(songs).toContain(s);
      const c = compileSong(s);
      expect(c.loop, s.id).toBe(true);
      for (const t of Object.values(c.tracks) as Track[]) expect(t.length, s.id).toBe(c.length);
    }
    expect(themeMusic('megaman-metal')).toBe('mm-station');
    expect(themeMusic('megaman-fortress')).toBe('mm-wily');
  });
});
