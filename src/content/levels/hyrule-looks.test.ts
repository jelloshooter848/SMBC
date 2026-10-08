import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { PALETTES, SPRITES } from '@content/sprites';
import { tilesDef } from '@content/sprites/tiles';
import { songs } from '@content/music/songs';
import { zelda2Songs } from '@content/music/zelda2';
import { compileSong, type Track } from '@engine/audio/mml';
import { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { CHARACTERS } from '@game/characters/registry';
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
import { runSim } from '@game/sim/headless';
import { FLOODED, SKY } from '@game/world/tile-render';
import { drawThemeBackdrop, hasThemeBackdrop } from '@game/world/theme-backdrop';
import type { View } from '@game/entities/entity';

/*
 * 0.4.24: World 2 is Hyrule (Link's world, owner notes 5, 18 and 21). Every level of it takes a
 * Zelda II look in campaign play: 2-1 and its sky areas the field (0.4.12), 2-2's way in and out
 * and 2-3 the field too, 2-2 a lake (`zelda2-water`: it still swims, by its `swim: true`), 2-4 a
 * palace (`zelda2-palace`, in the castle family) and 2-1's bonus room and the Moblin's cave a
 * Hyrule cave (`zelda2-cave`). Classic play keeps SMB's 2-1 to 2-4 exactly; the Top Secret Area
 * keeps its own look.
 */

const WORLD2: Readonly<Record<string, { theme: Theme; music: string }>> = {
  '2-1-bonus': { theme: 'zelda2-cave', music: 'zelda2-cave' },
  '2-1-cave': { theme: 'zelda2-cave', music: 'zelda2-cave' },
  '2-2-intro': { theme: 'zelda2', music: 'zelda2-field' },
  '2-2': { theme: 'zelda2-water', music: 'zelda2-water' },
  '2-2-exit': { theme: 'zelda2', music: 'zelda2-field' },
  '2-3': { theme: 'zelda2', music: 'zelda2-field' },
  '2-4': { theme: 'zelda2-palace', music: 'zelda2-palace' },
};
const IDS = Object.keys(WORLD2);
const NEW_THEMES: Theme[] = ['zelda2-water', 'zelda2-palace', 'zelda2-cave'];

const frames = tilesDef.frames;
const frame = (name: string) => frames[name] as readonly string[];
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

describe('World 2 as Hyrule: every level in a Zelda II look, campaign only', () => {
  it.each(IDS)('%s names its look; campaign play shows it', (id) => {
    const { theme, music } = WORLD2[id]!;
    expect(getLevel(id).campaignLook, id).toMatchObject({ theme, music });
    const camp = campaignLevel(getLevel(id));
    expect([camp.theme, camp.music]).toEqual([theme, music]);
  });

  it.each(IDS)('%s keeps its SMB look outside the campaign', (id) => {
    const lvl = getLevel(id);
    expect(lvl.theme).not.toBe(WORLD2[id]!.theme);
    expect(lvl.music).not.toBe(WORLD2[id]!.music);
    expect(applyLook(lvl, { theme: () => false, music: () => false })).toBe(lvl);
  });

  it('the Top Secret Area keeps its own look', () => {
    const l = getLevel('2-top-secret');
    expect(l.campaignLook).toBeUndefined();
    expect(campaignLevel(l).theme).toBe('smw-secret');
  });

  it.each(IDS)('%s: every tile it draws has a frame in its look', (id) => {
    const { theme } = WORLD2[id]!;
    for (const name of framesUsed(getLevel(id)))
      expect(
        frames[`${name}@${theme}`] ?? (theme === 'zelda2' ? undefined : frames[name]),
        `${id}: ${name}`,
      ).toBeDefined();
    // the new looks redraw every solid block of theirs (none falls back to SMB's art)
    if (theme !== 'zelda2')
      for (const name of framesUsed(getLevel(id)).filter((n) =>
        /^(ground|brick|hard|used|castle-brick|bridge|chain)$/.test(n),
      ))
        expect(frames[`${name}@${theme}`], `${id}: ${name}@${theme}`).toBeDefined();
  });

  it('2-3: its bridges, lintels and standing stones are drawn by the field look', () => {
    const used = framesUsed(getLevel('2-3'));
    for (const n of ['bridge', 'tree-top', 'tree-trunk']) expect(used, n).toContain(n);
    for (const n of used) expect(frames[`${n}@zelda2`], n).toBeDefined();
  });
});

describe("2-2's lake (zelda2-water)", () => {
  const camp = () => campaignLevel(getLevel('2-2'));

  it('is no water theme (no restyle may be one); the map swims by its own `swim: true`', () => {
    expect(isWaterTheme('zelda2-water')).toBe(false);
    for (const id of ['2-2']) expect(getLevel(id).swim, id).toBe(true);
    expect(isSwimLevel(camp())).toBe(true);
    expect(isSwimLevel(getLevel('2-2'))).toBe(true);
    // the dry ways in and out never swim
    for (const id of ['2-2-intro', '2-2-exit'])
      expect(isSwimLevel(campaignLevel(getLevel(id))), id).toBe(false);
  });

  it.each(CHARACTERS.map((c) => [c.id, c] as const))('%s drops into the lake and swims', (_, hero) => {
    const r = runSim({
      level: camp(),
      character: hero,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: 900,
      until: (w, f) => f > 10 && w.player.body.onGround,
    });
    expect(r.world.player.inWater, hero.id).toBe(true);
    expect(Number.isFinite(r.world.waterTop)).toBe(true);
  });

  it("a lake under a Hyrule sky: the deep water fills from the waves down in the waves' own blue", () => {
    const tiles = PALETTES.default['tiles-zelda2-water'] as string[];
    expect(tiles).toHaveLength(12);
    // the wave tiles' body (slot 9) is the flooded water, so the surface joins the depths
    expect(FLOODED['zelda2-water']).toBe(tiles[9]);
    const [r, g, b] = rgb(tiles[9] as string);
    expect(b).toBeGreaterThan(Math.max(r, g));
    expect(lum(tiles[10] as string)).toBeGreaterThan(lum(tiles[9] as string)); // light ripples
    expect(SKY['zelda2-water']).not.toBe(FLOODED['zelda2-water']);
    // its waves are its own; SMB's coins and ? blocks read as ever
    expect(frame('water-0@zelda2-water')).toBeDefined();
    expect(frame('water-1@zelda2-water')).toBeDefined();
    expect([tiles[4], tiles[7]]).toEqual([
      (PALETTES.default['tiles-overworld'] as string[])[4],
      (PALETTES.default['tiles-overworld'] as string[])[7],
    ]);
    // the water's fish and squids keep the water level's colours
    expect(enemyPalette('zelda2-water')).toBe(enemyPalette('water'));
  });
});

describe("2-4's palace (zelda2-palace)", () => {
  it('is in the castle family: castle enemies, solid floors, no swimming', () => {
    expect(isCastleTheme('zelda2-palace')).toBe(true);
    expect(hasSolidFloors('zelda2-palace')).toBe(true);
    expect(isWaterTheme('zelda2-palace')).toBe(false);
    expect(enemyPalette('zelda2-palace')).toBe(enemyPalette('castle'));
  });

  it('paints a palace hall behind the level: stone, curtains and statues', () => {
    expect(hasThemeBackdrop('zelda2-palace')).toBe(true);
    const assets = registry();
    const drawn: string[] = [];
    const r = Object.assign(new NullRenderer(), {
      sprite(s: SpriteSheet, f: string): void {
        drawn.push(`${s.id} ${f}`);
      },
    });
    const view: View = { camX: 300, frame: 0, assets, theme: 'zelda2-palace', reduceFlashing: true };
    drawThemeBackdrop(r, view);
    expect(drawn.some((d) => d.endsWith(' z2-palace-wall'))).toBe(true);
    expect(drawn.some((d) => d.endsWith(' z2-curtain'))).toBe(true);
    for (const d of drawn) expect(d.startsWith('decor@decor-zelda2-palace'), d).toBe(true);
    // lava stays SMB's red (it reads as deadly at a glance)
    const tiles = PALETTES.default['tiles-zelda2-palace'] as string[];
    expect(tiles[11]).toBe((PALETTES.default['tiles-castle'] as string[])[11]);
  });

  it('places statues on its floors', () => {
    const decor = campaignLevel(getLevel('2-4')).decor.map((d) => d.kind);
    expect(decor).toContain('z2-statue');
  });
});

describe("the Hyrule cave (zelda2-cave): 2-1's bonus room and the Moblin's cave", () => {
  it('plays as the underground: its enemies, its solid floors', () => {
    expect(enemyPalette('zelda2-cave')).toBe(enemyPalette('underground'));
    expect(hasSolidFloors('zelda2-cave')).toBe(true);
    expect(isCastleTheme('zelda2-cave')).toBe(false);
    expect(isWaterTheme('zelda2-cave')).toBe(false);
  });
});

describe('the new looks', () => {
  it.each(NEW_THEMES)('%s has a sky, its tile and decor palettes and its music', (theme) => {
    expect(SKY[theme]).toMatch(/^#[0-9a-f]{6}$/);
    expect(PALETTES.default[`tiles-${theme}`]).toHaveLength(12);
    expect(decorPalette(theme)).toBe(`decor-${theme}`);
    expect(PALETTES.default[decorPalette(theme)]).toHaveLength(11);
    expect(themeMusic(theme)).toBe(theme);
  });

  it.each(NEW_THEMES)('%s keeps solid blocks solid (16x16, no clear pixel)', (theme) => {
    for (const name of ['ground', 'hard', 'brick', 'used', 'castle-brick']) {
      const f = frames[`${name}@${theme}`];
      if (!f) continue;
      expect(f.length, `${name}@${theme}`).toBe(16);
      for (const row of f) expect(row, `${name}@${theme}`).toMatch(/^[0-9ab]{16}$/);
    }
  });

  it('every decor piece the World 2 looks place is drawn by their theme', () => {
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

  it('has three original Hyrule tunes: lake, palace, cave', () => {
    expect(zelda2Songs.map((s) => s.id)).toEqual(['zelda2-water', 'zelda2-palace', 'zelda2-cave']);
    for (const s of zelda2Songs) {
      expect(songs).toContain(s);
      const c = compileSong(s);
      expect(c.loop, s.id).toBe(true);
      for (const t of Object.values(c.tracks) as Track[]) expect(t.length, s.id).toBe(c.length);
    }
  });
});
