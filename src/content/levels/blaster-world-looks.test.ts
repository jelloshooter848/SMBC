import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { tilesDef } from '@content/sprites/tiles';
import { songs } from '@content/music/songs';
import { blasterWorldSongs } from '@content/music/blaster-world';
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
import { FLOODED, SKY, STARRY_SKIES } from '@game/world/tile-render';
import { drawThemeBackdrop, hasThemeBackdrop } from '@game/world/theme-backdrop';
import type { View } from '@game/entities/entity';

/*
 * 0.4.31: World 8 is Sophia's world, in the style of an NES tank-and-dungeon game (owner notes 5,
 * 18 and 21: each world, its map page and every level in it, is themed after the hero freed there).
 * In campaign play 8-1 is the Underworld's surface forest and stone ruins (`bm-forest`, area 1),
 * 8-2 the techno castle (`bm-techno`, area 2's castle of machine panels), 8-3 the frozen ruins
 * (`bm-ice`, the ice area) and both coin rooms Jason's on-foot dungeon in side view (`bm-vault`,
 * the underground still). 8-4 and 8-4-end are Bowser's real castle and the Chapter 1 finale: they
 * stay SMB's castle, its water room SMB's water, and Sophia's underworld areas (8-4-jason, -fred,
 * -garage) their own `underworld`. Classic play keeps SMB's 8-1 to 8-4 exactly
 * (tests/sim/world8-looks.test.ts runs every hero through).
 */

const WORLD8: Readonly<Record<string, { theme: Theme; music: string; classic: Theme }>> = {
  '8-1': { theme: 'bm-forest', music: 'bm-area', classic: 'overworld' },
  '8-1-bonus': { theme: 'bm-vault', music: 'bm-dungeon', classic: 'underground' },
  '8-2': { theme: 'bm-techno', music: 'bm-techno', classic: 'overworld' },
  '8-2-bonus': { theme: 'bm-vault', music: 'bm-dungeon', classic: 'underground' },
  '8-3': { theme: 'bm-ice', music: 'bm-ice', classic: 'overworld' },
};
const IDS = Object.keys(WORLD8);
const NEW_THEMES: Theme[] = ['bm-forest', 'bm-vault', 'bm-techno', 'bm-ice'];

const frames = tilesDef.frames;
const rgb = (hex: string) =>
  [1, 3, 5].map((k) => parseInt(hex.slice(k, k + 2), 16)) as [number, number, number];
const lum = (hex: string) => rgb(hex).reduce((a, b) => a + b);
const tiles = (theme: string) => PALETTES.default[`tiles-${theme}`] as string[];

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
    else if (id === T.LAVA) for (const n of [0, 1]) used.add(`lava-${n}`);
    else if (def.pickup === 'coin') for (const n of [0, 1, 2, 3]) used.add(`coin-${n}`);
    else if (id === T.WATER) for (const n of [0, 1]) used.add(`water-${n}`);
    else used.add(def.name);
  }
  return [...used].sort();
}

const registry = () => {
  const a = new AssetRegistry(PALETTES);
  a.defineAll(SPRITES);
  return a;
};

/** Every sprite a theme's backdrop draws at camera x `camX` on frame `frame`, as `sheet frame`. */
function backdrop(theme: Theme, camX: number, frame = 0, reduceFlashing = true): string[] {
  const drawn: string[] = [];
  const r = Object.assign(new NullRenderer(), {
    sprite(s: SpriteSheet, f: string): void {
      drawn.push(`${s.id} ${f}`);
    },
  });
  const view: View = { camX, frame, assets: registry(), theme, reduceFlashing };
  drawThemeBackdrop(r, view);
  return drawn;
}


describe("World 8 as Sophia's world: Blaster Master-style looks, campaign only", () => {
  it.each(IDS)('%s names its look; campaign play shows it', (id) => {
    const { theme, music } = WORLD8[id]!;
    expect(getLevel(id).campaignLook, id).toMatchObject({ theme, music });
    const camp = campaignLevel(getLevel(id));
    expect([camp.theme, camp.music]).toEqual([theme, music]);
  });

  it.each(IDS)('%s keeps its SMB look outside the campaign', (id) => {
    const lvl = getLevel(id);
    expect(lvl.theme).toBe(WORLD8[id]!.classic);
    expect(lvl.music).not.toBe(WORLD8[id]!.music);
    expect(applyLook(lvl, { theme: () => false, music: () => false })).toBe(lvl);
  });

  it("Bowser's real castle stays SMB's (the finale); Sophia's underworld areas keep theirs", () => {
    for (const id of ['8-4', '8-4-end', '8-4-water']) {
      expect(getLevel(id).campaignLook, id).toBeUndefined();
      const camp = campaignLevel(getLevel(id));
      expect(camp.theme, id).toBe(getLevel(id).theme);
      expect(camp.music, id).toBe(getLevel(id).music);
    }
    expect(getLevel('8-4').theme).toBe('castle');
    expect(getLevel('8-4-water').theme).toBe('water');
    for (const id of ['8-4-jason', '8-4-fred', '8-4-garage']) {
      expect(getLevel(id).campaignLook, id).toBeUndefined();
      expect(getLevel(id).theme, id).toBe('underworld');
    }
  });

  it.each(IDS)('%s: every tile it draws has a frame in its look, every solid block redrawn', (id) => {
    const { theme } = WORLD8[id]!;
    const used = framesUsed(getLevel(id));
    for (const name of used)
      expect(frames[`${name}@${theme}`] ?? frames[name], `${id}: ${name}`).toBeDefined();
    for (const name of used.filter((n) =>
      /^(ground|brick|hard|used|castle-brick|wall|wall-top|bridge|chain|tree-top|tree-trunk|cloud-block|water-[01]|blaster-top|blaster-base|coral)$/.test(
        n,
      ),
    ))
      expect(frames[`${name}@${theme}`], `${id}: ${name}@${theme}`).toBeDefined();
  });

  it.each(IDS)(
    '%s: no water theme; swimming, castle, floors and enemies answer as in the classic level',
    (id) => {
      const camp = campaignLevel(getLevel(id));
      const classic = getLevel(id);
      expect(isWaterTheme(camp.theme)).toBe(false);
      expect(isSwimLevel(camp)).toBe(isSwimLevel(classic));
      expect(isCastleTheme(camp.theme)).toBe(isCastleTheme(classic.theme));
      expect(hasSolidFloors(camp.theme)).toBe(hasSolidFloors(classic.theme));
      expect(enemyPalette(camp.theme)).toBe(enemyPalette(classic.theme));
    },
  );
});

describe("8-1: the Underworld's forest and stone ruins (bm-forest)", () => {
  it("a dark sky the white HUD reads on; the Underworld's area tune", () => {
    expect(lum(SKY['bm-forest'] as string)).toBeLessThan(160);
    expect(themeMusic('bm-forest')).toBe('bm-area');
  });

  it('paints the forest and the ruins behind the level, all in its own palette', () => {
    expect(hasThemeBackdrop('bm-forest')).toBe(true);
    const drawn = backdrop('bm-forest', 400);
    for (const f of ['bmf-forest', 'bmf-ruins'])
      expect(
        drawn.some((d) => d.endsWith(` ${f}`)),
        f,
      ).toBe(true);
    for (const d of drawn) expect(d.startsWith('decor@decor-bm-forest'), d).toBe(true);
  });

  it("its trees are the Underworld's gnarled forest trees", () => {
    const sheet = registry().sheet('decor', 'decor-bm-forest');
    expect(sheet.frames.get('tree-big@bm-forest')).toMatchObject({ w: 16, h: 48 });
    expect(sheet.frames.get('tree-small@bm-forest')).toMatchObject({ w: 16, h: 32 });
  });
});

describe('8-2: the techno castle (bm-techno)', () => {
  it('its blasters are machine cannons that still read against the sky', () => {
    expect(lum(SKY['bm-techno'] as string)).toBeLessThan(160);
    const pal = tiles('bm-techno');
    for (const n of ['blaster-top', 'blaster-base']) {
      const f = frames[`${n}@bm-techno`];
      expect(f, n).toHaveLength(16);
      const colours = new Set(
        [...f!.join('')].filter((c) => c !== '.').map((c) => pal['0123456789ab'.indexOf(c)]!),
      );
      expect(
        Math.max(...[...colours].map((c) => Math.abs(lum(c) - lum(SKY['bm-techno']!)))),
        n,
      ).toBeGreaterThanOrEqual(200);
    }
  });

  it('paints the machine castle behind; nothing on it blinks, reduce flashing on or off', () => {
    expect(hasThemeBackdrop('bm-techno')).toBe(true);
    for (const rf of [true, false]) {
      const a = backdrop('bm-techno', 200, 0, rf);
      expect(a.some((d) => d.endsWith(' bmt-castle'))).toBe(true);
      for (const d of a) expect(d.startsWith('decor@decor-bm-techno'), d).toBe(true);
      for (let f = 1; f < 240; f += 7) expect(backdrop('bm-techno', 200, f, rf)).toEqual(a);
    }
  });
});

describe('8-3: the frozen ruins (bm-ice)', () => {
  it('a cold dark sky; ice peaks painted behind; its trees frozen', () => {
    expect(lum(SKY['bm-ice'] as string)).toBeLessThan(160);
    expect(hasThemeBackdrop('bm-ice')).toBe(true);
    const drawn = backdrop('bm-ice', 300);
    expect(drawn.some((d) => d.endsWith(' bmi-peaks'))).toBe(true);
    for (const d of drawn) expect(d.startsWith('decor@decor-bm-ice'), d).toBe(true);
    const sheet = registry().sheet('decor', 'decor-bm-ice');
    expect(sheet.frames.get('tree-big@bm-ice')).toMatchObject({ w: 16, h: 48 });
  });

  it("the Hammer Bros' castle walls are iced ruins, still SMB's shapes", () => {
    const shape = (rows: readonly string[]) => rows.map((r) => r.replace(/[^.]/g, '#'));
    for (const n of ['wall', 'wall-top'])
      expect(shape(frames[`${n}@bm-ice`] ?? []), n).toEqual(shape(frames[n]!));
  });
});

describe("the coin rooms: Jason's dungeon in side view (bm-vault)", () => {
  it('is the underground still: solid floors, the underground enemies, a black sky, the dungeon tune', () => {
    expect(hasSolidFloors('bm-vault')).toBe(true);
    expect(enemyPalette('bm-vault')).toBe('enemies-underground');
    expect(SKY['bm-vault']).toBe('#000000');
    expect(themeMusic('bm-vault')).toBe('bm-dungeon');
  });

  it('paints the dungeon wall behind; nothing on it blinks', () => {
    expect(hasThemeBackdrop('bm-vault')).toBe(true);
    for (const rf of [true, false]) {
      const a = backdrop('bm-vault', 0, 0, rf);
      expect(a.some((d) => d.endsWith(' bmv-wall'))).toBe(true);
      for (let f = 1; f < 240; f += 7) expect(backdrop('bm-vault', 0, f, rf)).toEqual(a);
    }
  });
});

describe('the new looks', () => {
  it.each(NEW_THEMES)('%s has a sky, its tile and decor palettes and its music', (theme) => {
    expect(SKY[theme]).toMatch(/^#[0-9a-f]{6}$/);
    expect(tiles(theme)).toHaveLength(12);
    expect(decorPalette(theme)).toBe(`decor-${theme}`);
    expect(PALETTES.default[decorPalette(theme)]).toHaveLength(11);
    expect(songs.map((s) => s.id)).toContain(themeMusic(theme));
    const smb = PALETTES.default['tiles-overworld'] as string[];
    expect([tiles(theme)[4], tiles(theme)[7], tiles(theme)[11]]).toEqual([smb[4], smb[7], smb[11]]);
  });

  it.each(NEW_THEMES)('%s keeps solid blocks solid (16x16, no clear pixel)', (theme) => {
    for (const name of ['ground', 'hard', 'brick', 'used', 'castle-brick']) {
      const f = frames[`${name}@${theme}`];
      expect(f, `${name}@${theme}`).toBeDefined();
      expect(f!.length, `${name}@${theme}`).toBe(16);
      for (const row of f!) expect(row, `${name}@${theme}`).toMatch(/^[0-9ab]{16}$/);
    }
  });

  it('every decor piece the World 8 looks place is drawn by their theme', () => {
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

  it("has two original tank-game tunes (the techno castle, the ice); the rest reuse Sophia's", () => {
    expect(blasterWorldSongs.map((s) => s.id)).toEqual(['bm-techno', 'bm-ice']);
    for (const s of blasterWorldSongs) {
      expect(songs).toContain(s);
      const c = compileSong(s);
      expect(c.loop, s.id).toBe(true);
      for (const t of Object.values(c.tracks) as Track[]) expect(t.length, s.id).toBe(c.length);
    }
    expect(NEW_THEMES.map(themeMusic)).toEqual(['bm-area', 'bm-dungeon', 'bm-techno', 'bm-ice']);
  });

  it('the forest and the ice have stars in their night skies; none is flooded', () => {
    expect(STARRY_SKIES.has('bm-forest')).toBe(true);
    expect(STARRY_SKIES.has('bm-ice')).toBe(true);
    for (const t of NEW_THEMES) expect(FLOODED[t], t).toBeUndefined();
  });
});
