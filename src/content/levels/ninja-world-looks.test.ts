import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { tilesDef } from '@content/sprites/tiles';
import { songs } from '@content/music/songs';
import { ninjaWorldSongs } from '@content/music/ninja-world';
import { ROPE_COLOUR } from '@game/entities/objects/balance-lift';
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
 * 0.4.29: World 6 is Ryu's world, in the style of the NES ninja games (owner notes 5, 18 and 21:
 * each world, its map page and every level in it, is themed after the hero freed there). 6-2 and
 * its coin heaven keep their 0.4.12 night city (`ninja-city`, `ng-city`) and Ryu's dojo its own
 * `dojo`; the rest of World 6 takes ninja-game looks in campaign play: 6-1 a moonlit bamboo field
 * (`ng-field`), 6-2's coin rooms the city's sewers (`ng-sewer`, the underground still), its water
 * area a night harbour (`ng-harbor`, no water theme: it swims by `swim: true`), 6-3 a snowy
 * mountain pass (`ng-pass`) and 6-4 the demon temple, Jaquio's lair (`ng-temple`, in the castle
 * family). Classic play keeps SMB's 6-1 to 6-4 exactly (campaign-looks.test.ts plays them;
 * tests/sim/world6-looks.test.ts runs every hero through).
 */

const WORLD6: Readonly<Record<string, { theme: Theme; music: string; classic: Theme }>> = {
  '6-1': { theme: 'ng-field', music: 'ng-stage', classic: 'night' },
  '6-2-bonus': { theme: 'ng-sewer', music: 'ng-sewer', classic: 'underground' },
  '6-2-bonus2': { theme: 'ng-sewer', music: 'ng-sewer', classic: 'underground' },
  '6-2-water': { theme: 'ng-harbor', music: 'ng-harbor', classic: 'water' },
  '6-3': { theme: 'ng-pass', music: 'ng-pass', classic: 'snow' },
  '6-4': { theme: 'ng-temple', music: 'ng-boss', classic: 'castle' },
};
const IDS = Object.keys(WORLD6);
const NEW_THEMES: Theme[] = ['ng-field', 'ng-sewer', 'ng-harbor', 'ng-pass', 'ng-temple'];

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

describe("World 6 as Ryu's world: ninja-game looks, campaign only", () => {
  it.each(IDS)('%s names its look; campaign play shows it', (id) => {
    const { theme, music } = WORLD6[id]!;
    expect(getLevel(id).campaignLook, id).toMatchObject({ theme, music });
    const camp = campaignLevel(getLevel(id));
    expect([camp.theme, camp.music]).toEqual([theme, music]);
  });

  it.each(IDS)('%s keeps its SMB look outside the campaign', (id) => {
    const lvl = getLevel(id);
    expect(lvl.theme).toBe(WORLD6[id]!.classic);
    expect(lvl.music).not.toBe(WORLD6[id]!.music);
    expect(applyLook(lvl, { theme: () => false, music: () => false })).toBe(lvl);
  });

  it("6-2 and its coin heaven keep the night city; Ryu's dojo keeps its own look and its way in", () => {
    for (const id of ['6-2', '6-2-sky']) {
      const camp = campaignLevel(getLevel(id));
      expect([camp.theme, camp.music], id).toEqual(['ninja-city', 'ng-city']);
    }
    expect(getLevel('6-2-dojo').campaignLook).toBeUndefined();
    expect(campaignLevel(getLevel('6-2-dojo')).theme).toBe('dojo');
    // the trick wall into the dojo still wakes in the campaign
    expect(campaignLevel(getLevel('6-2')).zones.some((z) => z.kind === 'trick')).toBe(true);
  });

  it.each(IDS)('%s: every tile it draws has a frame in its look, every solid block redrawn', (id) => {
    const { theme } = WORLD6[id]!;
    const used = framesUsed(getLevel(id));
    for (const name of used)
      expect(frames[`${name}@${theme}`] ?? frames[name], `${id}: ${name}`).toBeDefined();
    for (const name of used.filter((n) =>
      /^(ground|brick|hard|used|castle-brick|bridge|chain|tree-top|tree-trunk|cloud-block|water-[01]|blaster-top|blaster-base)$/.test(
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

describe('6-1: a moonlit bamboo field (ng-field)', () => {
  it('a starry night sky the white HUD reads on', () => {
    expect(lum(SKY['ng-field'] as string)).toBeLessThan(120);
    expect(STARRY_SKIES.has('ng-field')).toBe(true);
  });

  it('paints the full moon, far peaks and a bamboo grove behind the level, all in its own palette', () => {
    expect(hasThemeBackdrop('ng-field')).toBe(true);
    const drawn = backdrop('ng-field', 400);
    for (const f of ['ng-moon', 'ngf-peaks', 'ngf-bamboo'])
      expect(drawn.some((d) => d.endsWith(` ${f}`)), f).toBe(true);
    for (const d of drawn) expect(d.startsWith('decor@decor-ng-field'), d).toBe(true);
  });

  it('its trees are bamboo clumps and stone lanterns', () => {
    const sheet = registry().sheet('decor', 'decor-ng-field');
    expect(sheet.frames.get('tree-big@ng-field')).toMatchObject({ w: 16, h: 48 });
    expect(sheet.frames.get('tree-small@ng-field')).toMatchObject({ w: 16, h: 32 });
  });
});

describe("6-2's coin rooms: the city's sewers (ng-sewer)", () => {
  it('is the underground still: solid floors, the underground enemies, a black sky', () => {
    expect(hasSolidFloors('ng-sewer')).toBe(true);
    expect(enemyPalette('ng-sewer')).toBe('enemies-underground');
    expect(SKY['ng-sewer']).toBe('#000000');
  });
});

describe("6-2's water area: a night harbour (ng-harbor)", () => {
  it('is no water theme (no restyle may be one); 6-2-water swims by its own `swim: true`', () => {
    expect(isWaterTheme('ng-harbor')).toBe(false);
    expect(getLevel('6-2-water').swim).toBe(true);
    expect(isSwimLevel(campaignLevel(getLevel('6-2-water')))).toBe(true);
    expect(isSwimLevel(getLevel('6-2-water'))).toBe(true);
    for (const id of ['6-2', '6-2-sky', '6-2-bonus'])
      expect(isSwimLevel(campaignLevel(getLevel(id))), id).toBe(false);
  });

  it("dark harbour water: the deep fills from the waves down in the waves' own colour", () => {
    const pal = tiles('ng-harbor');
    expect(FLOODED['ng-harbor']).toBe(pal[9]);
    const [r, g, b] = rgb(pal[9]!);
    expect(b).toBeGreaterThan(Math.max(r, g));
    expect(lum(pal[10]!)).toBeGreaterThan(lum(pal[9]!));
    expect(SKY['ng-harbor']).not.toBe(FLOODED['ng-harbor']);
    expect(frames['water-0@ng-harbor']).toBeDefined();
    expect(frames['water-1@ng-harbor']).toBeDefined();
    expect(enemyPalette('ng-harbor')).toBe(enemyPalette('water'));
  });
});

describe('6-3: a snowy mountain pass (ng-pass)', () => {
  it("its lifts' planks and the balance lifts' ropes read clearly against its night", () => {
    const sky = SKY['ng-pass'] as string;
    const cream = (PALETTES.default.items as string[])[3] as string;
    expect(Math.abs(lum(ROPE_COLOUR) - lum(sky)), 'rope').toBeGreaterThanOrEqual(150);
    expect(Math.abs(lum(cream) - lum(sky)), 'planks').toBeGreaterThanOrEqual(150);
    expect(STARRY_SKIES.has('ng-pass')).toBe(true);
  });

  it('its treetops are snow-capped rock ledges on frozen cliffs, solid all through', () => {
    for (const n of ['tree-top', 'tree-trunk']) expect(frames[`${n}@ng-pass`], n).toHaveLength(16);
    for (const row of frames['tree-top@ng-pass']!) expect(row).toMatch(/^[0-9ab]{16}$/);
    // the ledges' snow is the brightest thing on them
    const pal = tiles('ng-pass');
    const top = frames['tree-top@ng-pass']![1]!;
    expect(lum(pal['0123456789ab'.indexOf(top[8]!)]!)).toBeGreaterThanOrEqual(600);
  });

  it('paints snowy peaks behind the level under the moon', () => {
    const drawn = backdrop('ng-pass', 300);
    expect(drawn.some((d) => d.endsWith(' ngp-peaks'))).toBe(true);
    expect(drawn.some((d) => d.endsWith(' ng-moon'))).toBe(true);
    for (const d of drawn) expect(d.startsWith('decor@decor-ng-pass'), d).toBe(true);
  });
});

describe("6-4: the demon temple, Jaquio's lair (ng-temple)", () => {
  it('is in the castle family: castle enemies, solid floors, no swimming', () => {
    expect(isCastleTheme('ng-temple')).toBe(true);
    expect(hasSolidFloors('ng-temple')).toBe(true);
    expect(isWaterTheme('ng-temple')).toBe(false);
    expect(enemyPalette('ng-temple')).toBe(enemyPalette('castle'));
  });

  it("plays the Masked Ninja's tune, mapped explicitly", () => {
    expect(themeMusic('ng-temple')).toBe('ng-boss');
  });

  it("paints the temple's carved wall and demon pillars behind, dimmer than its blocks; lava stays SMB's red", () => {
    expect(hasThemeBackdrop('ng-temple')).toBe(true);
    const drawn = backdrop('ng-temple', 300);
    expect(drawn.some((d) => d.endsWith(' ngt-wall'))).toBe(true);
    expect(drawn.some((d) => d.endsWith(' ngt-pillar'))).toBe(true);
    for (const d of drawn) expect(d.startsWith('decor@decor-ng-temple'), d).toBe(true);
    const pal = tiles('ng-temple');
    expect(pal[11]).toBe((PALETTES.default['tiles-castle'] as string[])[11]);
    const decor = PALETTES.default['decor-ng-temple'] as string[];
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

  it('every decor piece the World 6 looks place is drawn by their theme', () => {
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

  it("has three original ninja-game tunes (the sewers, the harbour, the pass); the rest reuse Ryu's", () => {
    expect(ninjaWorldSongs.map((s) => s.id)).toEqual(['ng-sewer', 'ng-harbor', 'ng-pass']);
    for (const s of ninjaWorldSongs) {
      expect(songs).toContain(s);
      const c = compileSong(s);
      expect(c.loop, s.id).toBe(true);
      for (const t of Object.values(c.tracks) as Track[]) expect(t.length, s.id).toBe(c.length);
    }
    expect(NEW_THEMES.map(themeMusic)).toEqual(['ng-stage', 'ng-sewer', 'ng-harbor', 'ng-pass', 'ng-boss']);
  });
});
