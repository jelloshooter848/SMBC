import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { tilesDef } from '@content/sprites/tiles';
import { songs } from '@content/music/songs';
import { transylvaniaSongs } from '@content/music/transylvania';
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
 * 0.4.28: World 5 is Simon's world, Transylvania (owner notes 5, 18 and 21: each world, its map
 * page and every level in it, is themed after the hero freed there). 5-4 keeps its 0.4.12 castle
 * hall (`castlevania`, `cv-hall`) and Simon's dungeon and crypt their own `crypt`; the rest of
 * World 5 takes Castlevania-style looks in campaign play: 5-1 the castle's courtyard gate
 * (`cv-gate`), its bonus room the catacombs (`cv-catacomb`), 5-2 Simon's Quest-style town streets
 * (`cv-town`), its coin heaven a stormy night over the castle (`cv-storm`), its water area the
 * underground lake (`cv-lake`, no water theme: it swims by `swim: true`) and 5-3 the clock tower
 * (`cv-clock`). Classic play keeps SMB's 5-1 to 5-4 exactly (campaign-looks.test.ts plays them;
 * tests/sim/world5-looks.test.ts runs every hero through).
 */

const WORLD5: Readonly<Record<string, { theme: Theme; music: string; classic: Theme }>> = {
  '5-1': { theme: 'cv-gate', music: 'cv-hall', classic: 'overworld' },
  '5-1-bonus': { theme: 'cv-catacomb', music: 'crypt', classic: 'underground' },
  '5-2': { theme: 'cv-town', music: 'cv-town', classic: 'overworld' },
  '5-2-sky': { theme: 'cv-storm', music: 'cv-town', classic: 'overworld' },
  '5-2-water': { theme: 'cv-lake', music: 'cv-lake', classic: 'water' },
  '5-3': { theme: 'cv-clock', music: 'cv-stage', classic: 'overworld' },
};
const IDS = Object.keys(WORLD5);
const NEW_THEMES: Theme[] = ['cv-gate', 'cv-catacomb', 'cv-town', 'cv-storm', 'cv-lake', 'cv-clock'];

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

describe("World 5 as Simon's world: Castlevania-style looks, campaign only", () => {
  it.each(IDS)('%s names its look; campaign play shows it', (id) => {
    const { theme, music } = WORLD5[id]!;
    expect(getLevel(id).campaignLook, id).toMatchObject({ theme, music });
    const camp = campaignLevel(getLevel(id));
    expect([camp.theme, camp.music]).toEqual([theme, music]);
  });

  it.each(IDS)('%s keeps its SMB look outside the campaign', (id) => {
    const lvl = getLevel(id);
    expect(lvl.theme).toBe(WORLD5[id]!.classic);
    expect(lvl.music).not.toBe(WORLD5[id]!.music);
    expect(applyLook(lvl, { theme: () => false, music: () => false })).toBe(lvl);
  });

  it("5-4 keeps its castle hall; Simon's dungeon and crypt keep their own looks", () => {
    expect([campaignLevel(getLevel('5-4')).theme, campaignLevel(getLevel('5-4')).music]).toEqual([
      'castlevania',
      'cv-hall',
    ]);
    for (const id of ['5-4-dungeon', '5-4-crypt']) {
      expect(getLevel(id).campaignLook, id).toBeUndefined();
      expect(campaignLevel(getLevel(id)).theme, id).toBe('crypt');
    }
    // the lift's descent into the dungeon still wakes in the campaign
    const descent = campaignLevel(getLevel('5-4')).zones.find((z) => z.kind === 'descent');
    expect(descent).toMatchObject({ target: { level: '5-4-dungeon' } });
    expect((descent as { campaign?: boolean }).campaign).toBeUndefined();
  });

  it.each(IDS)('%s: every tile it draws has a frame in its look, every solid block redrawn', (id) => {
    const { theme } = WORLD5[id]!;
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

  it.each(IDS)('%s: no water theme; swimming, castle, floors and enemies answer as in the classic level', (id) => {
    const camp = campaignLevel(getLevel(id));
    const classic = getLevel(id);
    expect(isWaterTheme(camp.theme)).toBe(false);
    expect(isSwimLevel(camp)).toBe(isSwimLevel(classic));
    expect(isCastleTheme(camp.theme)).toBe(isCastleTheme(classic.theme));
    expect(hasSolidFloors(camp.theme)).toBe(hasSolidFloors(classic.theme));
    expect(enemyPalette(camp.theme)).toBe(enemyPalette(classic.theme));
  });
});

describe("5-1: the castle's courtyard gate (cv-gate)", () => {
  it('a starry night sky (never SMB blue) the white HUD reads on', () => {
    expect(SKY['cv-gate']).not.toBe(SKY.overworld);
    expect(lum(SKY['cv-gate'] as string)).toBeLessThan(120);
    expect(STARRY_SKIES.has('cv-gate')).toBe(true);
  });

  it("paints the castle gate's wall and Dracula's castle behind the level, dim, never block-like", () => {
    expect(hasThemeBackdrop('cv-gate')).toBe(true);
    const drawn = backdrop('cv-gate', 400);
    expect(drawn.some((d) => d.endsWith(' cvg-castle'))).toBe(true);
    expect(drawn.some((d) => d.endsWith(' cvg-wall'))).toBe(true);
    for (const d of drawn) expect(d.startsWith('decor@decor-cv-gate'), d).toBe(true);
  });

  it("its trees are statues and torch braziers; its Bullet Bill blasters are black iron that reads on the night", () => {
    const assets = registry();
    const sheet = assets.sheet('decor', 'decor-cv-gate');
    expect(sheet.frames.get('tree-big@cv-gate')).toMatchObject({ w: 16, h: 48 });
    expect(sheet.frames.get('tree-small@cv-gate')).toMatchObject({ w: 16, h: 32 });
    const pal = tiles('cv-gate');
    const ROLES = '0123456789ab';
    const sky = lum(SKY['cv-gate'] as string);
    for (const f of ['blaster-top@cv-gate', 'blaster-base@cv-gate']) {
      const used = new Set((frames[f] as readonly string[]).join('').replace(/[.0]/g, ''));
      // at least two of its colours stand well out from the night
      expect([...used].filter((c) => lum(pal[ROLES.indexOf(c)]!) - sky >= 150).length, f).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("5-2: Simon's Quest-style town streets (cv-town) and its stormy coin heaven (cv-storm)", () => {
  it('paints the town rooftops behind 5-2; the storm paints the castle far off and lightning, never with reduce flashing', () => {
    expect(backdrop('cv-town', 300).some((d) => d.endsWith(' cvt-roofs'))).toBe(true);
    const calm = Array.from({ length: 600 }, (_, f) => backdrop('cv-storm', 100, f, true)).flat();
    expect(calm.some((d) => d.endsWith(' cvs-castle'))).toBe(true);
    expect(calm.some((d) => d.includes('cvs-bolt'))).toBe(false);
    const wild = Array.from({ length: 600 }, (_, f) => backdrop('cv-storm', 100, f, false)).flat();
    expect(wild.some((d) => d.includes('cvs-bolt'))).toBe(true);
  });

  it('the coin heaven shares the town family: the same blocks, its own storm clouds to stand on', () => {
    expect(tiles('cv-storm')).toEqual(tiles('cv-town'));
    expect(frames['cloud-block@cv-storm']).toHaveLength(16);
    // the clouds' fill stands out from the storm sky
    const cloud = new Set((frames['cloud-block@cv-storm'] as readonly string[]).join('').replace(/[.0]/g, ''));
    const brightest = Math.max(...[...cloud].map((c) => lum(tiles('cv-storm')['0123456789ab'.indexOf(c)]!)));
    expect(brightest - lum(SKY['cv-storm'] as string)).toBeGreaterThanOrEqual(200);
  });
});

describe("5-2's water area: the underground lake (cv-lake)", () => {
  it('is no water theme (no restyle may be one); 5-2-water swims by its own `swim: true`', () => {
    expect(isWaterTheme('cv-lake')).toBe(false);
    expect(getLevel('5-2-water').swim).toBe(true);
    expect(isSwimLevel(campaignLevel(getLevel('5-2-water')))).toBe(true);
    expect(isSwimLevel(getLevel('5-2-water'))).toBe(true);
    for (const id of ['5-2', '5-2-sky']) expect(isSwimLevel(campaignLevel(getLevel(id))), id).toBe(false);
  });

  it("murky green water: the deep fills from the waves down in the waves' own colour", () => {
    const pal = tiles('cv-lake');
    expect(FLOODED['cv-lake']).toBe(pal[9]);
    const [r, g, b] = rgb(pal[9]!);
    expect(g).toBeGreaterThan(Math.max(r, b));
    expect(lum(pal[10]!)).toBeGreaterThan(lum(pal[9]!));
    expect(SKY['cv-lake']).not.toBe(FLOODED['cv-lake']);
    expect(frames['water-0@cv-lake']).toBeDefined();
    expect(frames['water-1@cv-lake']).toBeDefined();
    // the water's fish and squids keep the water level's colours
    expect(enemyPalette('cv-lake')).toBe(enemyPalette('water'));
  });
});

describe('5-3: the clock tower (cv-clock)', () => {
  it("its treetops are wooden beams on the tower's timbers; the lifts' cream planks read on its night", () => {
    const cream = (PALETTES.default.items as string[])[3] as string;
    expect(Math.abs(lum(cream) - lum(SKY['cv-clock'] as string))).toBeGreaterThanOrEqual(150);
    for (const n of ['tree-top', 'tree-trunk']) expect(frames[`${n}@cv-clock`], n).toHaveLength(16);
    for (const row of frames['tree-top@cv-clock']!) expect(row).toMatch(/^[0-9ab]{16}$/);
  });

  it('paints the clock tower behind the level: its clock face and gears', () => {
    const drawn = backdrop('cv-clock', 500);
    expect(drawn.some((d) => d.endsWith(' cvc-clock'))).toBe(true);
    expect(drawn.some((d) => d.endsWith(' cvc-gear'))).toBe(true);
    for (const d of drawn) expect(d.startsWith('decor@decor-cv-clock'), d).toBe(true);
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

  it('every decor piece the World 5 looks place is drawn by their theme', () => {
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

  it("has two original Castlevania-style tunes (the town, the lake); the rest reuse Simon's", () => {
    expect(transylvaniaSongs.map((s) => s.id)).toEqual(['cv-town', 'cv-lake']);
    for (const s of transylvaniaSongs) {
      expect(songs).toContain(s);
      const c = compileSong(s);
      expect(c.loop, s.id).toBe(true);
      for (const t of Object.values(c.tracks) as Track[]) expect(t.length, s.id).toBe(c.length);
    }
    expect(NEW_THEMES.map(themeMusic)).toEqual(['cv-hall', 'crypt', 'cv-town', 'cv-town', 'cv-lake', 'cv-stage']);
  });
});
