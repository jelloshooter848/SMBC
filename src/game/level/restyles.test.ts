import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PALETTES, SPRITES } from '@content/sprites';
import { tilesDef } from '@content/sprites/tiles';
import { decorDef } from '@content/sprites/decor';
import { songs } from '@content/music/songs';
import { castlevaniaSongs } from '@content/music/castlevania';
import { ninjaSongs } from '@content/music/ninja';
import { compileSong, PPQ, type Track } from '@engine/audio/mml';
import { AssetRegistry } from '@engine/assets/registry';
import { NullRenderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import type { View } from '../entities/entity';
import { T, tileDef } from './tiles';
import { parseTextMap } from './textmap';
import { isWaterTheme, themeMusic, type Theme } from './schema';
import { SKY } from '../world/tile-render';
import { decorPalette, drawDecor } from '../entities/objects/decoration';
import { enemyPalette } from '../entities/enemies/enemy';
import { drawThemeBackdrop, hasThemeBackdrop, HALL_TOP, SKYLINE_BOTTOM } from '../world/theme-backdrop';

/*
 * The 0.4.12 restyles' art and music for 5-4 (Simon: `castlevania`) and 6-2 (Ryu: `ninja-city`).
 * The levels name their looks in their maps (campaignTheme:); here the looks themselves.
 */

const levels = join(import.meta.dirname, '../../content/levels');
const load = (path: string) => parseTextMap(readFileSync(join(levels, path), 'utf8'));
const frames = tilesDef.frames;
const frame = (name: string) => frames[name] as readonly string[];

/**
 * The frame names renderTiles asks for to draw a level, every animation step included, and
 * `used`: what a `?` block, a hidden block or a brick with something in it turns into.
 */
function framesUsed(path: string): string[] {
  const used = new Set<string>();
  for (const id of load(path).tiles) {
    if (id === T.AIR) continue;
    const def = tileDef(id);
    if (def.block && def.block.content !== 'none') used.add('used');
    if (def.block?.kind === 'hidden') continue;
    if (def.block?.kind === 'question') for (const n of [0, 1, 2]) used.add(`question-${n}`);
    else if (def.block?.kind === 'brick' || id === T.TRICK) used.add('brick');
    else if (def.pickup === 'coin') for (const n of [0, 1, 2, 3]) used.add(`coin-${n}`);
    else if (id === T.LAVA) for (const n of [0, 1]) used.add(`lava-${n}`);
    else if (id === T.WATER) for (const n of [0, 1]) used.add(`water-${n}`);
    else used.add(def.name);
  }
  return [...used].sort();
}

/** A tile frame is 16x16 in the tile palette's 12 roles (or clear). */
const validTile = (name: string) => {
  const f = frame(name);
  expect(f, name).toBeDefined();
  expect(f.length, name).toBe(16);
  for (const row of f) expect(row, name).toMatch(/^[0-9ab.]{16}$/);
};

/** Decor and backdrop frames drawn for a theme: which frames, where. */
function drawn(theme: Theme, draw: (r: NullRenderer, view: View) => void, camX = 0) {
  const assets = new AssetRegistry(PALETTES);
  assets.defineAll(SPRITES);
  const view: View = { camX, frame: 0, assets, theme, reduceFlashing: true };
  const out: { sheet: string; frame: string; x: number; y: number }[] = [];
  const r = Object.assign(new NullRenderer(), {
    sprite(s: SpriteSheet, f: string, x: number, y: number): void {
      out.push({ sheet: s.id, frame: f, x, y });
    },
  });
  draw(r, view);
  return out;
}

const bars = (c: ReturnType<typeof compileSong>) => c.length / (PPQ * 4);
const pitchClasses = (t: Track) => new Set(t.events.flatMap((e) => (e.note === null ? [] : [e.note % 12])));
const lead = (c: ReturnType<typeof compileSong>) => (c.tracks as Record<string, Track>).pulse1 as Track;

describe("5-4 as Simon's castle hall (`castlevania`)", () => {
  it('redraws every tile 5-4 uses; ? blocks, coins and lava stay SMB’s own', () => {
    const used = framesUsed('world5/5-4.map');
    expect(used).toEqual(
      [
        'brick',
        'bridge',
        'castle-brick',
        'chain',
        'coin-0',
        'coin-1',
        'coin-2',
        'coin-3',
        'hard',
        'lava-0',
        'lava-1',
        'question-0',
        'question-1',
        'question-2',
        'used',
      ].sort(),
    );
    for (const name of used) validTile(`${name}@castlevania`);
    for (const n of [...used.filter((n) => /^(question|coin|lava)-/.test(n))])
      expect(frame(`${n}@castlevania`), n).toEqual(frame(n));
    // the castle's own pieces are new art
    for (const n of ['castle-brick', 'hard', 'used', 'brick', 'bridge', 'chain', 'ground'])
      expect(frame(`${n}@castlevania`), n).not.toEqual(frame(n));
  });

  it('keeps each tile its collision shape and its read', () => {
    // solid blocks fill their cell; the bridge's deck spans its top rows and opens below
    for (const n of ['castle-brick', 'hard', 'used', 'brick', 'ground'])
      expect(frame(`${n}@castlevania`).join(''), n).not.toContain('.');
    for (const row of frame('bridge@castlevania').slice(0, 5)) expect(row).toMatch(/^[^.]{16}$/);
    expect(frame('bridge@castlevania').slice(6).join('')).toContain('.');
    // breakable bricks keep the SMB brick's mortar, so they read as bricks among the big blocks
    const mortar = (rows: readonly string[]) => rows.map((r) => r.replace(/[^0]/g, '.'));
    expect(mortar(frame('brick@castlevania'))).toEqual(mortar(frame('brick')));
    // the castle blocks are orange stone, the hard blocks, bridge and chain grey stone and iron
    expect(frame('castle-brick@castlevania').join('')).toMatch(/^[0123]+$/);
    expect(frame('hard@castlevania').join('')).toMatch(/^[089a]+$/);
    expect(frame('bridge@castlevania').join('')).toMatch(/^[089a.]+$/);
    expect(frame('chain@castlevania').join('')).toMatch(/^[089.]+$/);
    // the chain's links sit where SMB's do (the axe's end of the bridge reads the same)
    const shape = (rows: readonly string[]) => rows.map((r) => r.replace(/[^.]/g, '#'));
    expect(shape(frame('chain@castlevania'))).toEqual(shape(frame('chain')));
    const pal = PALETTES.default['tiles-castlevania'] as string[];
    const smb = PALETTES.default['tiles-castle'] as string[];
    expect(pal).toHaveLength(12);
    for (const i of [0, 4, 5, 7, 0xb]) expect(pal[i], `role ${i}`).toBe(smb[i]); // gold, green, lava
  });

  it('plays as a castle: castle enemies, no swimming, black over the hall, the hall tune', () => {
    expect(enemyPalette('castlevania')).toBe(enemyPalette('castle')); // Podoboos; Bowser's true form
    expect(isWaterTheme('castlevania')).toBe(false);
    expect(SKY.castlevania).toBe('#000000');
    expect(themeMusic('castlevania')).toBe('cv-hall');
    expect(decorPalette('castlevania')).toBe('decor-castlevania');
    expect(PALETTES.default['decor-castlevania']).toHaveLength(11);
  });

  it('paints the hall behind: a brick wall below the HUD band, columns and arched windows', () => {
    expect(hasThemeBackdrop('castlevania')).toBe(true);
    const at0 = drawn('castlevania', drawThemeBackdrop);
    const wall = at0.filter((d) => d.frame === 'cv-wall');
    expect(wall.length).toBeGreaterThanOrEqual(8 * 7);
    expect(Math.min(...wall.map((d) => d.y))).toBe(HALL_TOP);
    for (const d of at0) expect(d.sheet).toBe('decor@decor-castlevania');
    for (const f of ['cv-window', 'cv-pillar', 'cv-pillar-cap'])
      expect(
        at0.some((d) => d.frame === f && d.x > -32 && d.x < 256),
        f,
      ).toBe(true);
    // it scrolls with the level
    const at10 = drawn('castlevania', drawThemeBackdrop, 10);
    const win = (o: typeof at0) => o.filter((d) => d.frame === 'cv-window').map((d) => d.x);
    expect(win(at10)).toEqual(win(at0).map((x) => x - 10));
    // the classic castle paints nothing
    expect(drawn('castle', drawThemeBackdrop)).toEqual([]);
  });

  it('decor for the level to place: a candle on its stand, the hall pieces', () => {
    const decor = (n: string) => decorDef.frames[n] as readonly string[];
    expect([decor('cv-candle')[0]?.length, decor('cv-candle').length]).toEqual([16, 32]);
    expect(decor('cv-candle').at(-1)).toMatch(/[^.]/); // it stands on its bottom row
    for (const [n, w, h] of [
      ['cv-wall', 32, 32],
      ['cv-window', 32, 48],
      ['cv-pillar', 32, 32],
      ['cv-pillar-cap', 32, 16],
    ] as const) {
      expect([decor(n)[0]?.length, decor(n).length], n).toEqual([w, h]);
      for (const row of decor(n)) expect(row, n).toMatch(new RegExp(`^[0-9a.]{${w}}$`));
    }
    // the wall tiles: no gaps
    expect(decor('cv-wall').join('')).not.toContain('.');
  });
});

describe("6-2 as Ryu's city street (`ninja-city`)", () => {
  it('redraws every tile 6-2 and its coin heaven use; ? blocks, coins and the flagpole stay SMB’s', () => {
    const main = framesUsed('world6/6-2.map');
    expect(main).toEqual(
      [
        'brick',
        'flag-ball',
        'flag-shaft',
        'ground',
        'hard',
        'pipe-body-left',
        'pipe-body-right',
        'pipe-top-left',
        'pipe-top-right',
        'used',
      ].sort(),
    );
    const sky = framesUsed('world6/6-2-sky.map');
    expect(sky).toEqual(['cloud-block', 'coin-0', 'coin-1', 'coin-2', 'coin-3']);
    for (const name of [...main, ...sky, 'question-0', 'question-1', 'question-2'])
      validTile(`${name}@ninja-city`);
    for (const n of [
      'coin-0',
      'coin-1',
      'coin-2',
      'coin-3',
      'flag-shaft',
      'flag-ball',
      'question-0',
      'question-1',
    ])
      expect(frame(`${n}@ninja-city`), n).toEqual(frame(n));
    for (const n of ['ground', 'hard', 'used', 'brick', 'cloud-block'])
      expect(frame(`${n}@ninja-city`), n).not.toEqual(frame(n));
  });

  it('keeps each tile its shape: solid blocks fill their cell, pipes are SMB’s pipes with steel bands', () => {
    for (const n of ['ground', 'hard', 'used', 'brick'])
      expect(frame(`${n}@ninja-city`).join(''), n).not.toContain('.');
    // pipes: the same outline and the same greens, a band or a bolt of steel grey added
    const outline = (rows: readonly string[]) => rows.map((r) => r.replace(/[^.0]/g, '#'));
    for (const n of ['pipe-top-left', 'pipe-top-right', 'pipe-body-left', 'pipe-body-right']) {
      const f = frame(`${n}@ninja-city`);
      expect(outline(f), n).toEqual(outline(frame(n)));
      expect(f.join('').replace(/[^13]/g, '').length, n).toBeGreaterThan(0);
      expect(f.join('').replace(/[^56]/g, '').length, n).toBeGreaterThan(f.join('').length / 2);
    }
    // red brick in the SMB brick's courses; grey concrete and pavement
    const mortar = (rows: readonly string[]) => rows.map((r) => r.replace(/[^0]/g, '.'));
    expect(mortar(frame('brick@ninja-city'))).toEqual(mortar(frame('brick')));
    expect(frame('brick@ninja-city').join('')).toMatch(/^[09ab]+$/);
    expect(frame('hard@ninja-city').join('')).toMatch(/^[0123]+$/);
    expect(frame('ground@ninja-city').join('')).toMatch(/^[123]+$/);
    const pal = PALETTES.default['tiles-ninja-city'] as string[];
    const smb = PALETTES.default['tiles-overworld'] as string[];
    for (const i of [0, 4, 5, 6, 7]) expect(pal[i], `role ${i}`).toBe(smb[i]); // gold and green
  });

  it("plays as 6-2 always did: SMB's enemies, no swimming, a black night, the street tune", () => {
    expect(enemyPalette('ninja-city')).toBe(enemyPalette('overworld'));
    expect(isWaterTheme('ninja-city')).toBe(false);
    expect(SKY['ninja-city']).toBe('#000000');
    expect(themeMusic('ninja-city')).toBe('ng-city');
    expect(decorPalette('ninja-city')).toBe('decor-ninja-city');
    expect(PALETTES.default['decor-ninja-city']).toHaveLength(11);
  });

  it("dresses 6-2's own decor as the street: shop fronts, walls, railings, night clouds; the castle stays", () => {
    const kinds = new Set(load('world6/6-2.map').decor.map((d) => d.kind));
    expect([...kinds].sort()).toEqual([
      'bush-2',
      'bush-3',
      'cloud-1',
      'cloud-2',
      'cloud-3',
      'hill-big',
      'hill-small',
    ]);
    for (const k of [...kinds, 'bush-1']) {
      const out = drawn('ninja-city', (r, v) => drawDecor(r, v, k, 0, 192));
      expect(out[0], k).toMatchObject({ sheet: 'decor@decor-ninja-city', frame: `${k}@ninja-city` });
      // each stands on the same line as the classic piece (anchored bottom-left)
      const f = decorDef.frames[`${k}@ninja-city`] as readonly string[];
      expect(out[0]?.y, k).toBe(192 - f.length);
      expect(f.at(-1), k).toMatch(/[^.]/);
    }
    // the end castle keeps its own frame (its flag rises from it), in the street's red brick
    expect(drawn('ninja-city', (r, v) => drawDecor(r, v, 'castle-small', 0, 192))[0]?.frame).toBe(
      'castle-small',
    );
    // the classic look is untouched
    expect(drawn('overworld', (r, v) => drawDecor(r, v, 'hill-big', 0, 192))[0]?.frame).toBe('hill-big');
    const lamp = decorDef.frames['ng-lamp'] as readonly string[];
    expect([lamp[0]?.length, lamp.length]).toEqual([16, 64]);
  });

  it('paints the far city behind, standing on the street, at half the camera’s speed', () => {
    expect(hasThemeBackdrop('ninja-city')).toBe(true);
    const sky = decorDef.frames['ng-skyline'] as readonly string[];
    const at0 = drawn('ninja-city', drawThemeBackdrop);
    expect(at0.length).toBeGreaterThanOrEqual(2);
    for (const d of at0) expect(d).toMatchObject({ frame: 'ng-skyline', y: SKYLINE_BOTTOM - sky.length });
    const at40 = drawn('ninja-city', drawThemeBackdrop, 40);
    expect(at40[0]?.x).toBe((at0[0]?.x ?? 0) - 20);
    expect(drawn('overworld', drawThemeBackdrop)).toEqual([]);
  });
});

describe('the restyles’ music', () => {
  const hall = compileSong(castlevaniaSongs.find((s) => s.id === 'cv-hall')!);
  const city = compileSong(ninjaSongs.find((s) => s.id === 'ng-city')!);

  it('is registered with the game songs, and each look plays its own', () => {
    for (const id of ['cv-hall', 'ng-city']) expect(songs.map((s) => s.id)).toContain(id);
    expect(themeMusic('castlevania')).toBe('cv-hall');
    expect(themeMusic('ninja-city')).toBe('ng-city');
  });

  it('loops 16 whole bars on every channel', () => {
    for (const c of [hall, city]) {
      expect(c.loop).toBe(true);
      expect(bars(c)).toBe(16);
      for (const t of Object.values(c.tracks) as Track[]) expect(t.length).toBe(c.length);
    }
  });

  it('the hall drives in E minor turning on D-sharp; the street runs faster in G minor turning on F-sharp', () => {
    expect(hall.bpm).toBeGreaterThanOrEqual(140);
    expect(city.bpm).toBeGreaterThan(hall.bpm);
    expect(pitchClasses(lead(hall)).has(3)).toBe(true);
    expect(pitchClasses(lead(city)).has(6)).toBe(true);
    // the street's bass runs in sixteenths, the hall's pumps in eighths
    const bass = (c: typeof hall) => ((c.tracks as Record<string, Track>).triangle as Track).events;
    expect(bass(city).every((e) => e.len === PPQ / 4)).toBe(true);
    expect(bass(hall).every((e) => e.len === PPQ / 2)).toBe(true);
    // new tunes, not the mini games' stage themes
    for (const [mine, other] of [
      [hall, 'cv-stage'],
      [city, 'ng-stage'],
    ] as const) {
      const theirs = compileSong(songs.find((s) => s.id === other)!);
      expect(lead(mine).events.map((e) => e.note)).not.toEqual(lead(theirs).events.map((e) => e.note));
    }
  });
});
