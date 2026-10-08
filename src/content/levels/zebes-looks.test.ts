import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { tilesDef } from '@content/sprites/tiles';
import { zebesWorldDecorFrames } from '@content/sprites/zebes-world';
import { songs } from '@content/music/songs';
import { zebesWorldSongs } from '@content/music/zebes-world';
import { compileSong, type Track } from '@engine/audio/mml';
import { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { applyLook, campaignLevel } from '@game/level/campaign';
import {
  hasSolidFloors,
  isCastleTheme,
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
 * 0.4.27: World 4 is Samus's world, Zebes (owner notes 5, 18 and 21: each world, its map page and
 * every level in it, is themed after the hero freed there). 4-2 keeps its 0.4.12 Brinstar look,
 * Samus's cavern its own rock and Larry's airship its SMB3 look; the rest of World 4 takes
 * Metroid-style looks in campaign play: 4-1 and 4-2's overworld areas Zebes's surface
 * (`crateria`), the bonus rooms Brinstar, 4-3 Norfair (`norfair`) and 4-4 Tourian, Mother Brain's
 * lair (`tourian-lair`, in the castle family). Classic play keeps SMB's 4-1 to 4-4 exactly
 * (campaign-looks.test.ts plays them; tests/sim/world4-looks.test.ts runs every hero through).
 */

const WORLD4: Readonly<Record<string, { theme: Theme; music: string; classic: Theme }>> = {
  '4-1': { theme: 'crateria', music: 'crateria', classic: 'overworld' },
  '4-1-bonus': { theme: 'brinstar', music: 'brinstar', classic: 'underground' },
  '4-2-intro': { theme: 'crateria', music: 'crateria', classic: 'overworld' },
  '4-2-exit': { theme: 'crateria', music: 'crateria', classic: 'overworld' },
  '4-2-warp': { theme: 'crateria', music: 'crateria', classic: 'overworld' },
  '4-2-bonus': { theme: 'brinstar', music: 'brinstar', classic: 'underground' },
  '4-3': { theme: 'norfair', music: 'norfair', classic: 'overworld' },
  '4-4': { theme: 'tourian-lair', music: 'tourian', classic: 'castle' },
};
const IDS = Object.keys(WORLD4);
const NEW_THEMES: Theme[] = ['crateria', 'norfair', 'tourian-lair'];

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

describe("World 4 as Samus's world: Metroid-style looks, campaign only", () => {
  it.each(IDS)('%s names its look; campaign play shows it', (id) => {
    const { theme, music } = WORLD4[id]!;
    expect(getLevel(id).campaignLook, id).toMatchObject({ theme, music });
    const camp = campaignLevel(getLevel(id));
    expect([camp.theme, camp.music]).toEqual([theme, music]);
  });

  it.each(IDS)('%s keeps its SMB look outside the campaign', (id) => {
    const lvl = getLevel(id);
    expect(lvl.theme).toBe(WORLD4[id]!.classic);
    expect(lvl.music).not.toBe(WORLD4[id]!.music);
    expect(applyLook(lvl, { theme: () => false, music: () => false })).toBe(lvl);
  });

  it("4-2 keeps Brinstar; Samus's cavern and Larry's airship keep their own looks", () => {
    expect(campaignLevel(getLevel('4-2')).theme).toBe('brinstar');
    for (const [id, theme] of [
      ['4-2-cavern', 'cavern'],
      ['4-2-airship', 'airship-deck'],
      ['4-2-larry', 'airship'],
    ] as const) {
      expect(getLevel(id).campaignLook, id).toBeUndefined();
      expect(campaignLevel(getLevel(id)).theme, id).toBe(theme);
    }
  });

  it("4-2's secret warps still go where they went: the vine pipe to Samus's cavern, the right pipe to Larry", () => {
    const gotos = (id: string) =>
      campaignLevel(getLevel(id))
        .zones.filter((z) => z.kind === 'warp')
        .map((z) => (z as { goto?: { level: string } }).goto?.level);
    expect(gotos('4-2-warp')).toEqual(['4-2-cavern']);
    expect(gotos('4-2')).toEqual(['4-2-airship']);
  });

  it.each(IDS)('%s: every tile it draws has a frame in its look, every solid block redrawn', (id) => {
    const { theme } = WORLD4[id]!;
    const used = framesUsed(getLevel(id));
    for (const name of used)
      expect(frames[`${name}@${theme}`] ?? frames[name], `${id}: ${name}`).toBeDefined();
    for (const name of used.filter((n) =>
      /^(ground|brick|hard|used|castle-brick|bridge|chain|tree-top|tree-trunk|mushroom-top|mushroom-stem)$/.test(n),
    ))
      expect(frames[`${name}@${theme}`], `${id}: ${name}@${theme}`).toBeDefined();
  });

  it.each(IDS)('%s: no water theme; castle, floors and enemies answer as in the classic level', (id) => {
    const camp = campaignLevel(getLevel(id));
    const classic = WORLD4[id]!.classic;
    expect(isWaterTheme(camp.theme)).toBe(false);
    expect(isCastleTheme(camp.theme)).toBe(isCastleTheme(classic));
    expect(hasSolidFloors(camp.theme)).toBe(hasSolidFloors(classic));
    expect(enemyPalette(camp.theme)).toBe(enemyPalette(classic));
  });
});

describe("4-1 and 4-2's overworld areas: Zebes's surface (crateria)", () => {
  it('a dusky alien sky (never SMB blue), the white HUD reading on it', () => {
    const sky = SKY.crateria as string;
    expect(sky).not.toBe(SKY.overworld);
    expect(lum(sky)).toBeLessThan(240);
  });

  it("4-2-warp's mushroom platform is an alien stalk: solid cap, open stem", () => {
    const top = frames['mushroom-top@crateria']!;
    expect(top).toHaveLength(16);
    for (const row of top) expect(row).toMatch(/^[0-9ab]{16}$/);
    expect(frames['mushroom-stem@crateria']).toHaveLength(16);
  });
});

describe('4-3: Norfair (norfair)', () => {
  it('draws bubble rock, and its mushroom platforms as bubble platforms on hot stalks', () => {
    const used = framesUsed(getLevel('4-3'));
    for (const n of ['mushroom-top', 'mushroom-stem', 'ground']) expect(used, n).toContain(n);
    const top = frames['mushroom-top@norfair']!;
    expect(top).toHaveLength(16);
    for (const row of top) expect(row).toMatch(/^[0-9ab]{16}$/);
  });

  it("its lifts' planks and the balance lifts' ropes read clearly against its sky", () => {
    const sky = SKY.norfair as string;
    const cream = (PALETTES.default.items as string[])[3] as string;
    expect(Math.abs(lum(ROPE_COLOUR) - lum(sky)), 'rope').toBeGreaterThanOrEqual(150);
    expect(Math.abs(lum(cream) - lum(sky)), 'planks').toBeGreaterThanOrEqual(150);
    // a hot, dark red sky: red over green and blue
    const [r, g, b] = rgb(sky);
    expect(r).toBeGreaterThan(Math.max(g, b));
  });

  it("the platforms' bubble caps stand out from the sky", () => {
    const tiles = PALETTES.default['tiles-norfair'] as string[];
    expect(Math.abs(lum(tiles[2]!) - lum(SKY.norfair as string))).toBeGreaterThanOrEqual(150);
  });
});

describe("4-4: Tourian, Mother Brain's lair (tourian-lair)", () => {
  it('is in the castle family: castle enemies, solid floors, no swimming', () => {
    expect(isCastleTheme('tourian-lair')).toBe(true);
    expect(hasSolidFloors('tourian-lair')).toBe(true);
    expect(isWaterTheme('tourian-lair')).toBe(false);
    expect(enemyPalette('tourian-lair')).toBe(enemyPalette('castle'));
    // ZEBES ESCAPE's own Tourian stays as it was: not a castle
    expect(isCastleTheme('tourian')).toBe(false);
  });

  it("plays Tourian's tune, mapped explicitly", () => {
    expect(themeMusic('tourian-lair')).toBe('tourian');
  });

  it("paints Tourian's machinery behind the level, never block-like; lava stays SMB's red", () => {
    expect(hasThemeBackdrop('tourian-lair')).toBe(true);
    const drawn = backdrop('tourian-lair', 300);
    expect(drawn.some((d) => d.endsWith(' zt-wall'))).toBe(true);
    expect(drawn.some((d) => d.endsWith(' zt-tube'))).toBe(true);
    for (const d of drawn) expect(d.startsWith('decor@decor-tourian-lair'), d).toBe(true);
    const tiles = PALETTES.default['tiles-tourian-lair'] as string[];
    expect(tiles[11]).toBe((PALETTES.default['tiles-castle'] as string[])[11]);
    const decor = PALETTES.default['decor-tourian-lair'] as string[];
    const panel = lum(tiles[2]!);
    const ROLES = '0123456789ab';
    for (const name of ['zt-wall', 'zt-tube'])
      for (const ch of new Set(
        (zebesWorldDecorFrames[name] as readonly string[]).join('').replace(/\./g, ''),
      ))
        expect(lum(decor[ROLES.indexOf(ch)]!), `${name} '${ch}'`).toBeLessThan(panel);
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
    for (const name of ['ground', 'hard', 'brick', 'used', 'castle-brick']) {
      const f = frames[`${name}@${theme}`];
      expect(f, `${name}@${theme}`).toBeDefined();
      expect(f!.length, `${name}@${theme}`).toBe(16);
      for (const row of f!) expect(row, `${name}@${theme}`).toMatch(/^[0-9ab]{16}$/);
    }
  });

  it('every decor piece the World 4 looks place is drawn by their theme', () => {
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

  it("has two original Metroid-style tunes (Zebes's surface, Norfair); the rest reuse Brinstar's and Tourian's", () => {
    expect(zebesWorldSongs.map((s) => s.id)).toEqual(['crateria', 'norfair']);
    for (const s of zebesWorldSongs) {
      expect(songs).toContain(s);
      const c = compileSong(s);
      expect(c.loop, s.id).toBe(true);
      for (const t of Object.values(c.tracks) as Track[]) expect(t.length, s.id).toBe(c.length);
    }
    expect(themeMusic('crateria')).toBe('crateria');
    expect(themeMusic('norfair')).toBe('norfair');
  });
});
