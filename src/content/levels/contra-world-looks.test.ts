import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { tilesDef } from '@content/sprites/tiles';
import { songs } from '@content/music/songs';
import { contraWorldSongs } from '@content/music/contra-world';
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
 * 0.4.30: World 7 is Bill's world, in the style of an NES jungle run-and-gun (owner notes 5, 18
 * and 21: each world, its map page and every level in it, is themed after the hero freed there).
 * 7-3 keeps its 0.4.9 Contra jungle (`contra-jungle`), its camp and the waterfall climb their own
 * looks and the bridge blast its drop into the camp; the rest of World 7 takes Contra-style looks
 * in campaign play: 7-1 the snowfield before the enemy base (`contra-snow`), its bonus room the
 * base's inner corridors (`contra-base`, the underground still), 7-2's way in and way out the
 * jungle shore (`contra-shore`), its water area the jungle river (`contra-river`, no water theme:
 * it swims by `swim: true`) and 7-4 Red Falcon's alien lair (`contra-lair`, in the castle family).
 * Classic play keeps SMB's 7-1 to 7-4 exactly (tests/sim/world7-looks.test.ts runs every hero
 * through).
 */

const WORLD7: Readonly<Record<string, { theme: Theme; music: string; classic: Theme }>> = {
  '7-1': { theme: 'contra-snow', music: 'contra-snow', classic: 'overworld' },
  '7-1-bonus': { theme: 'contra-base', music: 'contra-stage', classic: 'underground' },
  '7-2-intro': { theme: 'contra-shore', music: 'contra-jungle', classic: 'overworld' },
  '7-2': { theme: 'contra-river', music: 'contra-river', classic: 'water' },
  '7-2-exit': { theme: 'contra-shore', music: 'contra-jungle', classic: 'overworld' },
  '7-4': { theme: 'contra-lair', music: 'contra-lair', classic: 'castle' },
};
const IDS = Object.keys(WORLD7);
const NEW_THEMES: Theme[] = ['contra-snow', 'contra-base', 'contra-shore', 'contra-river', 'contra-lair'];

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

describe("World 7 as Bill's world: Contra-style looks, campaign only", () => {
  it.each(IDS)('%s names its look; campaign play shows it', (id) => {
    const { theme, music } = WORLD7[id]!;
    expect(getLevel(id).campaignLook, id).toMatchObject({ theme, music });
    const camp = campaignLevel(getLevel(id));
    expect([camp.theme, camp.music]).toEqual([theme, music]);
  });

  it.each(IDS)('%s keeps its SMB look outside the campaign', (id) => {
    const lvl = getLevel(id);
    expect(lvl.theme).toBe(WORLD7[id]!.classic);
    expect(lvl.music).not.toBe(WORLD7[id]!.music);
    expect(applyLook(lvl, { theme: () => false, music: () => false })).toBe(lvl);
  });

  it("7-3 keeps its jungle, Bill's camp and the waterfall climb theirs, the bridge blast its drop", () => {
    const camp = campaignLevel(getLevel('7-3'));
    expect([camp.theme, camp.music]).toEqual(['contra-jungle', 'contra-jungle']);
    expect(getLevel('7-3-camp').campaignLook).toBeUndefined();
    expect(getLevel('7-3-camp').theme).toBe('contra-jungle');
    expect(getLevel('7-3-falls').campaignLook).toBeUndefined();
    expect(getLevel('7-3-falls').theme).toBe('contra-falls');
    expect(camp.entities.some((e) => e.type === 'bridge-blast')).toBe(true);
    expect(camp.zones.find((z) => z.kind === 'pit')).toMatchObject({ target: { level: '7-3-camp' } });
  });

  it.each(IDS)('%s: every tile it draws has a frame in its look, every solid block redrawn', (id) => {
    const { theme } = WORLD7[id]!;
    const used = framesUsed(getLevel(id));
    for (const name of used)
      expect(frames[`${name}@${theme}`] ?? frames[name], `${id}: ${name}`).toBeDefined();
    for (const name of used.filter((n) =>
      /^(ground|brick|hard|used|castle-brick|bridge|chain|tree-top|tree-trunk|cloud-block|water-[01]|blaster-top|blaster-base|coral)$/.test(
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

describe('7-1: the snowfield before the enemy base (contra-snow)', () => {
  it('a dark winter sky the white HUD reads on; its blasters are pillbox cannons that still read', () => {
    expect(lum(SKY['contra-snow'] as string)).toBeLessThan(160);
    const pal = tiles('contra-snow');
    for (const n of ['blaster-top', 'blaster-base']) {
      const f = frames[`${n}@contra-snow`];
      expect(f, n).toHaveLength(16);
      // the cannon's barrel and badge stand out against the sky
      const colours = new Set(
        [...f!.join('')].filter((c) => c !== '.').map((c) => pal['0123456789ab'.indexOf(c)]!),
      );
      expect(
        Math.max(...[...colours].map((c) => Math.abs(lum(c) - lum(SKY['contra-snow']!)))),
        n,
      ).toBeGreaterThanOrEqual(200);
    }
  });

  it('paints far snowy peaks and the enemy base behind the level, all in its own palette', () => {
    expect(hasThemeBackdrop('contra-snow')).toBe(true);
    const drawn = backdrop('contra-snow', 400);
    for (const f of ['cs-peaks', 'cs-base'])
      expect(
        drawn.some((d) => d.endsWith(` ${f}`)),
        f,
      ).toBe(true);
    for (const d of drawn) expect(d.startsWith('decor@decor-contra-snow'), d).toBe(true);
  });

  it('its trees are snowy pines and its bushes snow-laden firs', () => {
    const sheet = registry().sheet('decor', 'decor-contra-snow');
    expect(sheet.frames.get('tree-big@contra-snow')).toMatchObject({ w: 16, h: 48 });
    expect(sheet.frames.get('tree-small@contra-snow')).toMatchObject({ w: 16, h: 32 });
  });
});

describe("7-1's bonus room: the base's inner corridors (contra-base)", () => {
  it('is the underground still: solid floors, the underground enemies, a black sky', () => {
    expect(hasSolidFloors('contra-base')).toBe(true);
    expect(enemyPalette('contra-base')).toBe('enemies-underground');
    expect(SKY['contra-base']).toBe('#000000');
  });

  it('paints the corridor wall behind; nothing on it blinks, reduce flashing on or off', () => {
    expect(hasThemeBackdrop('contra-base')).toBe(true);
    for (const rf of [true, false]) {
      const a = backdrop('contra-base', 0, 0, rf);
      expect(a.some((d) => d.endsWith(' cb-wall'))).toBe(true);
      for (let f = 1; f < 240; f += 7) expect(backdrop('contra-base', 0, f, rf)).toEqual(a);
    }
  });
});

describe("7-2's way in and way out: the jungle shore (contra-shore)", () => {
  it('plays the jungle tune and paints the jungle and the sea behind', () => {
    expect(themeMusic('contra-shore')).toBe('contra-jungle');
    expect(lum(SKY['contra-shore'] as string)).toBeLessThan(160);
    const drawn = backdrop('contra-shore', 100);
    expect(drawn.some((d) => d.endsWith(' csh-jungle'))).toBe(true);
    for (const d of drawn) expect(d.startsWith('decor@decor-contra-shore'), d).toBe(true);
  });
});

describe("7-2's water area: the jungle river (contra-river)", () => {
  it('is no water theme (no restyle may be one); 7-2 swims by its own `swim: true`', () => {
    expect(isWaterTheme('contra-river')).toBe(false);
    expect(getLevel('7-2').swim).toBe(true);
    expect(isSwimLevel(campaignLevel(getLevel('7-2')))).toBe(true);
    expect(isSwimLevel(getLevel('7-2'))).toBe(true);
    for (const id of ['7-2-intro', '7-2-exit', '7-1'])
      expect(isSwimLevel(campaignLevel(getLevel(id))), id).toBe(false);
  });

  it("green river water: the deep fills from the waves down in the waves' own colour", () => {
    const pal = tiles('contra-river');
    expect(FLOODED['contra-river']).toBe(pal[9]);
    expect(lum(pal[10]!)).toBeGreaterThan(lum(pal[9]!));
    expect(SKY['contra-river']).not.toBe(FLOODED['contra-river']);
    expect(frames['water-0@contra-river']).toBeDefined();
    expect(frames['water-1@contra-river']).toBeDefined();
    expect(enemyPalette('contra-river')).toBe(enemyPalette('water'));
  });
});

describe("7-4: Red Falcon's alien lair (contra-lair)", () => {
  it('is in the castle family: castle enemies, solid floors, no swimming', () => {
    expect(isCastleTheme('contra-lair')).toBe(true);
    expect(hasSolidFloors('contra-lair')).toBe(true);
    expect(isWaterTheme('contra-lair')).toBe(false);
    expect(enemyPalette('contra-lair')).toBe(enemyPalette('castle'));
    // Bill's mini game's lair is not a castle (its own rules)
    expect(isCastleTheme('alien-lair')).toBe(false);
  });

  it("plays Red Falcon's lair tune, mapped explicitly", () => {
    expect(themeMusic('contra-lair')).toBe('contra-lair');
  });

  it('paints organic walls and the heart behind, dimmer than its blocks, still with reduce flashing; lava stays SMB red', () => {
    expect(hasThemeBackdrop('contra-lair')).toBe(true);
    const drawn = backdrop('contra-lair', 300);
    expect(drawn.some((d) => d.endsWith(' cl-wall'))).toBe(true);
    expect(drawn.some((d) => d.endsWith(' cl-heart'))).toBe(true);
    for (const d of drawn) expect(d.startsWith('decor@decor-contra-lair'), d).toBe(true);
    for (let f = 1; f < 240; f += 7) expect(backdrop('contra-lair', 300, f, true)).toEqual(drawn);
    const pal = tiles('contra-lair');
    expect(pal[11]).toBe((PALETTES.default['tiles-castle'] as string[])[11]);
    const decor = PALETTES.default['decor-contra-lair'] as string[];
    const block = lum(pal[2]!);
    for (const n of [1, 2, 3]) expect(lum(decor[n]!), `decor ${n}`).toBeLessThan(block);
  });
});

describe('the new looks', () => {
  it.each(NEW_THEMES)('%s has a sky, its tile and decor palettes and its music', (theme) => {
    expect(SKY[theme]).toMatch(/^#[0-9a-f]{6}$/);
    expect(tiles(theme)).toHaveLength(12);
    expect(decorPalette(theme)).toBe(`decor-${theme}`);
    expect(PALETTES.default[decorPalette(theme)]).toHaveLength(11);
    expect(songs.map((s) => s.id)).toContain(themeMusic(theme));
    // SMB's gold (coins, ? blocks) and lava read as ever
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

  it('every decor piece the World 7 looks place is drawn by their theme', () => {
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

  it("has two original run-and-gun tunes (the snowfield, the river); the rest reuse Bill's", () => {
    expect(contraWorldSongs.map((s) => s.id)).toEqual(['contra-snow', 'contra-river']);
    for (const s of contraWorldSongs) {
      expect(songs).toContain(s);
      const c = compileSong(s);
      expect(c.loop, s.id).toBe(true);
      for (const t of Object.values(c.tracks) as Track[]) expect(t.length, s.id).toBe(c.length);
    }
    expect(NEW_THEMES.map(themeMusic)).toEqual([
      'contra-snow',
      'contra-stage',
      'contra-jungle',
      'contra-river',
      'contra-lair',
    ]);
  });

  it('the snowfield and the jungle shore have stars in their night skies, as the jungle does', () => {
    expect(STARRY_SKIES.has('contra-snow')).toBe(true);
    expect(STARRY_SKIES.has('contra-shore')).toBe(true);
    expect(STARRY_SKIES.has('contra-jungle')).toBe(true);
  });
});
