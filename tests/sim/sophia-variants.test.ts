import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { SOPHIA } from '@game/characters/sophia';
import { MARIO } from '@game/characters/mario';
import { LevelScene } from '@game/scenes/level';
import { campaignLevel } from '@game/level/campaign';
import { heroVariant } from '@game/level/variants';
import { runSim } from '@game/sim/headless';
import { Enemy } from '@game/entities/enemies/enemy';
import { toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import type { LevelData } from '@game/level/schema';
import { DEFAULT_LEGEND } from '@game/level/tiles';
import { replay } from './sophia-reach';
import { file, makeGame, useStorage, type H } from './heroes-harness';

/*
 * Sophia III's level variants (Chapter 1 finishing pass): the `[variant sophia]` sections of the
 * levels Normal Sophia could not finish (docs/HEROES.md "Sophia III in the campaign levels"). They
 * are the original Crossover's own pieces for her (`[variant sophia classic]`, so classic play has
 * them too). SMB 8-4 has none (owner decision): its hidden coin block is her way up, as in the
 * original. Since 0.4.33 the SMB levels have the original's pieces for her too, and every area
 * with a flagpole the original's step-fall lift by it.
 */

/** Every bundled map with a Sophia variant. */
const VARIANT_LEVELS = [
  'll-1-2',
  'll-1-2-warp',
  'll-1-2-under',
  'll-2-2',
  'll-2-4',
  'll-3-3',
  'll-3-4',
  'll-4-1',
  'll-4-2',
  'll-4-3',
  'll-5-1',
  'll-6-1',
  'll-6-3',
  'll-7-1',
  'll-7-2',
  'll-7-3',
  'll-8-1',
  'll-8-2',
  'll-8-3',
  'll-8-4',
  'll-8-4-end2',
  'll-8-4-end3',
  'll-11-3',
  'll-11-4',
  'll-12-1',
  'll-12-2',
  'll-12-3',
  'll-13-4',
  'll-13-4-exit',
];

/**
 * The SMB levels with the original's own pieces for her (0.4.33): `[map, x, y, tile char]` of
 * one cell each piece sets ('.' opens one), checked laid for her and not for Mario.
 */
const SMB_PIECES: [string, number, number, string][] = [
  ['2-3', 111, 13, 'T'],
  ['3-3', 33, 13, 'T'],
  ['3-4', 87, 14, '%'],
  ['4-2', 184, 12, '='],
  ['4-3', 31, 14, 'i'],
  ['4-4', 161, 10, '.'],
  ['6-2', 123, 14, '#'],
  ['7-1', 29, 6, '='],
  ['7-3', 112, 14, 't'],
  ['8-1', 314, 14, '#'],
  ['8-2', 149, 13, '#'],
  ['8-4-end', 21, 13, '%'],
];

/**
 * The original's step-fall lift by the flagpole (a `StepFall` platform shown to heroes who jump
 * short, `charHorz`: one tile wide, five columns left of the pole), `map x y`, in every SMB and
 * Lost Levels area the original has one at Normal (0.4.33).
 */
const FLAG_LIFTS = [
  '1-1 193 4',
  '1-2-exit 17 4',
  '1-3 147 4',
  '2-1 195 4',
  '2-2-exit 17 4',
  '2-3 220 4',
  '3-1 195 4',
  '3-2 204 4',
  '3-3 146 4',
  '4-1 220 4',
  '4-2-exit 17 4',
  '4-3 142 4',
  '5-1 194 4',
  '5-2 195 4',
  '5-3 147 4',
  '6-1 181 4',
  '6-2 211 4',
  '6-3 162 4',
  '7-1 174 5',
  '7-2-exit 17 4',
  '7-3 220 4',
  '8-1 371 4',
  '8-2 211 4',
  '8-3 209 4',
  'll-1-1 183 4',
  'll-1-2-exit 23 4',
  'll-1-3 164 4',
  'll-10-2-exit 23 4',
  'll-11-1 194 4',
  'll-11-2-exit 23 4',
  'll-11-3 195 4',
  'll-12-1 224 4',
  'll-12-2 188 4',
  'll-12-3 310 4',
  'll-13-1 194 4',
  'll-13-2 173 4',
  'll-13-3 212 4',
  'll-2-1 227 4',
  'll-2-2 257 4',
  'll-2-3 172 4',
  'll-3-1 181 4',
  'll-3-2-exit 23 4',
  'll-3-3 181 4',
  'll-4-1 194 4',
  'll-4-2 201 4',
  'll-4-3 180 4',
  'll-5-1 357 4',
  'll-5-2-exit 23 4',
  'll-5-3 248 4',
  'll-6-1 239 4',
  'll-6-2-exit 23 4',
  'll-6-3 212 4',
  'll-7-1 197 4',
  'll-7-2 253 4',
  'll-7-3 310 4',
  'll-8-1 210 4',
  'll-8-2-warp 22 4',
  'll-8-3 209 4',
  'll-9-3 209 5',
]
  .map((s) => s.split(' '))
  .map(([id, x, y]) => [id as string, Number(x), Number(y)] as const);

const SMB_VARIANT_LEVELS = [
  ...new Set([
    ...SMB_PIECES.map(([id]) => id),
    ...FLAG_LIFTS.map(([id]) => id).filter((id) => !id.startsWith('ll-')),
  ]),
];
const LL_LIFT_ONLY = FLAG_LIFTS.map(([id]) => id).filter(
  (id) => id.startsWith('ll-') && !VARIANT_LEVELS.includes(id),
);
VARIANT_LEVELS.push(...SMB_VARIANT_LEVELS, ...LL_LIFT_ONLY);

const scene = (h: H) => h.game.scenes.find((s): s is LevelScene => s instanceof LevelScene) as LevelScene;
/** The (x, y) tiles a level's Sophia variant lays, from its map (`classic`: of classic sections only). */
const laid = (l: LevelData, classic?: boolean) =>
  (l.variants ?? [])
    .filter((v) => v.hero === 'sophia' && (classic === undefined || !!v.classic === classic))
    .flatMap((v) => v.tiles.flatMap((r) => r.tiles.map((t, i) => ({ x: r.x + i, y: r.y, t }))));
const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];

useStorage();

describe('the game lays the Sophia variant', () => {
  const play = (hero: typeof MARIO, campaign: boolean, partner?: typeof MARIO, id = 'll-2-4') => {
    // Dev mode with the file's Chapter 2 gate open: the campaign may enter the Lost Kingdom.
    const h = makeGame({ dev: true });
    if (campaign) {
      file({ devGateOpen: true });
      h.game.openFile(1);
    }
    h.game.setHero(0, hero);
    if (partner) h.game.setHero(1, partner);
    h.game.startLevel(getLevel(id), { mode: 'stand' });
    h.step();
    return scene(h).world.level;
  };
  const runs = laid(getLevel('ll-2-4'), true);

  it('when a player is Sophia III (either one in co-op), in campaign play and in classic', () => {
    expect(runs.length).toBeGreaterThan(0);
    for (const level of [play(SOPHIA, true), play(MARIO, true, SOPHIA), play(SOPHIA, false)])
      for (const r of runs) expect(tile(level, r.x, r.y)).toBe(r.t);
  });

  it('not for Mario alone, in campaign play or classic', () => {
    for (const level of [play(MARIO, true), play(MARIO, false)])
      for (const r of runs) expect(tile(level, r.x, r.y)).toBe(tile(getLevel('ll-2-4'), r.x, r.y));
    expect(play(MARIO, false).tiles).toBe(getLevel('ll-2-4').tiles);
  });

  it('8-4 has no variant: the level as it is, for her too', () => {
    expect(getLevel('8-4').variants).toBeUndefined();
    expect(play(SOPHIA, true, undefined, '8-4').tiles).toEqual(campaignLevel(getLevel('8-4')).tiles);
  });
});

describe.each(VARIANT_LEVELS)('%s: the Sophia variant', (id) => {
  it('is absent for Mario, in the campaign and out of it', () => {
    const camp = campaignLevel(getLevel(id));
    expect(heroVariant(camp, [MARIO.id], true)).toBe(camp);
    expect(heroVariant(getLevel(id), [MARIO.id], false)).toBe(getLevel(id));
  });

  it('is laid for Sophia; our own (campaign-only) tiles only fill open air', () => {
    const level = getLevel(id);
    expect(level.variants?.some((v) => v.hero === 'sophia')).toBe(true);
    const v = heroVariant(campaignLevel(level), [SOPHIA.id], true);
    expect(v).not.toBe(campaignLevel(level));
    for (const r of laid(level, false)) expect(tile(level, r.x, r.y), `${id} ${r.x},${r.y}`).toBe(0);
    for (const r of laid(level)) expect(tile(v, r.x, r.y)).toBe(r.t);
  });
});

describe('the original’s SMB pieces for her (0.4.33)', () => {
  // Our maps' legend (none of these maps overrides these characters): a character to its tile id.
  const tileOf = (ch: string) => (ch === '.' ? 0 : (DEFAULT_LEGEND[ch] as number));
  it.each(SMB_PIECES)(
    '%s: the piece at %i,%i is laid for her, in classic play too, not for Mario',
    (id, x, y, ch) => {
      const level = getLevel(id);
      const want = tileOf(ch);
      expect(typeof want).toBe('number');
      expect(level.variants?.some((v) => v.hero === 'sophia' && v.classic)).toBe(true);
      expect(tile(level, x, y)).not.toBe(want);
      expect(tile(heroVariant(level, [SOPHIA.id], false), x, y)).toBe(want);
      expect(tile(heroVariant(campaignLevel(level), [SOPHIA.id], true), x, y)).toBe(want);
      expect(tile(heroVariant(level, [MARIO.id], false), x, y)).not.toBe(want);
    },
  );
});

describe('the flagpole’s step-fall lift for her (0.4.33)', () => {
  const lift = (l: LevelData, x: number, y: number) =>
    l.entities.some((e) => e.type === 'lift-fall' && e.x === x && e.y === y && e.props?.len === 2);
  it.each(FLAG_LIFTS)('%s: the lift at %i,%i for her, in classic play too, not for Mario', (id, x, y) => {
    const level = getLevel(id);
    expect(lift(level, x, y)).toBe(false);
    expect(lift(heroVariant(level, [SOPHIA.id], false), x, y)).toBe(true);
    expect(lift(heroVariant(campaignLevel(level), [SOPHIA.id], true), x, y)).toBe(true);
    expect(lift(heroVariant(level, [MARIO.id], false), x, y)).toBe(false);
  });
});

/**
 * Routes the completability search (sophia-reach.ts) found at Normal with the variants laid,
 * replayed through each variant's spot: [map, area, column (0: to the level's end), route, start
 * (when the route starts past a stretch only a scripted sim gets through)].
 */
const ROUTES: [string, string, number, string, [number, number]?][] = [
  [
    'll-1-2',
    'll-1-2',
    0,
    'enter ll-1-2 | tank@1,12 drive-right | tank@14,12 walk-left | tank@13,12 late-right | tank@16,11 jump-right | tank@22,10 jump-right | tank@27,7 edge-right | tank@37,8 run-right | tank@40,12 edge-right | tank@49,8 hop-right | tank@54,10 jump-right | tank@59,7 long-right ride1-right | tank@100,12 jump-right | tank@102,8 edge-right | tank@109,5 walk-right | tank@113,9 hop-right | tank@118,10 up-right | tank@121,7 jump-right | tank@129,12 jump-right | tank@135,12 drive-right | tank@145,12 walk-left | tank@144,12 late-right | tank@147,11 wait70-right ride1-right | tank@167,9 drive-right | enter ll-1-2-exit | tank@3,10 long-right | tank@11,10 long-right | tank@15,6 jump-right | tank@23,12 jump-right',
  ],
  [
    'll-2-4',
    'll-2-4',
    0,
    'enter ll-2-4 | tank@0,6 run-right | tank@6,9 edge-right | tank@19,5 drive-right | tank@25,12 drive-right | tank@44,12 edge-right | tank@60,12 long-right | tank@67,8 edge-right | tank@75,8 drive-right | tank@90,12 jump-right | tank@92,8 edge-right | tank@103,11 up-right | tank@107,12 jump-right | tank@114,12 edge-right | tank@122,9 jump-right | tank@129,9 edge-right',
  ],
  [
    'll-3-3',
    'll-3-3',
    0,
    'enter ll-3-3 | tank@1,12 edge-runup-right | tank@14,9 jump-right | tank@18,8 edge-right | tank@38,12 jump-right | tank@45,12 jump-right | tank@47,8 long-right | tank@53,4 jump-right ride1-left | tank@57,4 hop-right ride-drive16-right | tank@73,10 long-right | tank@83,12 walk-right | tank@83,12 boost0-right | tank@123,8 jump-right | tank@130,8 long-right ride1-right | tank@146,10 jump-right ride1-right | tank@159,8 hop-right | tank@164,11 jump-right | tank@170,9 jump-right | tank@174,5 long-right',
  ],
  [
    'll-3-4',
    'll-3-4',
    0,
    'enter ll-3-4 | tank@0,6 edge-right | tank@11,12 edge-right | tank@25,9 run-right | tank@31,12 edge-right | tank@42,12 drive-right | tank@61,12 drive-right | tank@145,12 jump-right | tank@149,8 jump-right | tank@154,4 drive-right | tank@166,12 drive-right | tank@186,12 long-right | tank@192,8 drive-right | tank@211,8 long-right | tank@220,8 jump-right | tank@223,4 run-right | tank@227,4 edge-right | tank@235,5 edge-right | tank@250,5 edge-right | tank@258,4 drive-right | tank@277,4 run-right | tank@281,4 walk-right | tank@283,4 jump-right | tank@288,12 jump-right | tank@294,9 edge-right',
  ],
  [
    'll-4-1',
    'll-4-1',
    0,
    'enter ll-4-1 | tank@162,10 long-right | tank@171,9 long-right | tank@180,12 long-right | tank@184,8 jump-right | tank@188,4 long-right',
    [163, 10],
  ],
  [
    'll-4-2',
    'll-4-2',
    0,
    'enter ll-4-2 | tank@1,12 edge-right | tank@18,12 jump-right | tank@22,9 jump-right | tank@29,9 edge-right | tank@39,12 edge-right | tank@51,12 boost0-right | tank@62,4 edge-right | tank@79,12 drive-right | tank@99,12 drive-right | tank@115,12 jump-right | tank@117,8 long-right | tank@126,8 edge-right | tank@140,12 drive-right | tank@159,12 edge-right | tank@174,12 pipe | enter ll-4-2-bonus | tank@1,12 drive-right | enter ll-4-2 | tank@179,10 long-right | tank@187,9 jump-right | tank@193,7 up-right | tank@196,4 jump-right',
  ],
  ['ll-4-3', 'll-4-3', 24, 'enter ll-4-3 | tank@1,12 long-right | tank@10,12 edge-right'],
  [
    'll-5-1',
    'll-5-1',
    165,
    'enter ll-5-1 | tank@1,12 drive-right | tank@21,12 edge-right | tank@39,12 run-right | tank@43,12 jump-right | tank@48,12 jump-right | tank@53,12 jump-right | tank@60,12 edge-right | tank@77,12 edge-right | tank@87,8 pipe | enter ll-5-1-bonus | tank@1,12 drive-right | enter ll-5-1 | tank@115,10 long-right | tank@123,10 long-right | tank@127,6 up-right | tank@131,4 jump-right | tank@138,4 jump-right | tank@144,4 edge-right | tank@152,4 jump-right | tank@159,4 jump-right',
  ],
  [
    'll-6-1',
    'll-6-1',
    0,
    'enter ll-6-1 | tank@85,12 late-right | tank@89,11 jump-right | tank@96,11 run-right | tank@100,12 drive-right | tank@120,12 drive-right | tank@139,12 edge-right | tank@148,10 long-right | tank@152,6 up-right | tank@157,6 jump-right ride1-right | tank@177,8 long-right | tank@187,12 edge-right ride150-right | tank@214,12 edge-right | tank@227,10 long-right | tank@231,6 jump-right | tank@239,12 jump-right',
    [86, 12],
  ],
  [
    'll-6-3',
    'll-6-3',
    0,
    'enter ll-6-3 | tank@1,12 edge-right | tank@13,9 edge-right | tank@21,11 long-right | tank@29,11 edge-right | tank@42,9 edge-right | tank@56,11 edge-right | tank@74,9 long-right | tank@82,9 drive-right | tank@90,11 edge-right | tank@100,11 drive-right | tank@120,11 edge-right | tank@130,12 long-right | tank@138,10 up-right | tank@142,8 jump-right | tank@149,11 hop-right | tank@154,11 hop-right | tank@158,9 jump-right | tank@165,11 long-right | tank@173,9 jump-right | tank@180,11 edge-right | tank@192,9 walk-left | tank@190,9 jump-right | tank@193,5 long-right | tank@201,4 jump-right | tank@208,4 jump-right',
  ],
  [
    'll-7-1',
    'll-7-1',
    0,
    'enter ll-7-1 | tank@1,12 edge-right | tank@17,10 jump-right | tank@23,9 jump-right | tank@29,8 edge-right | tank@40,12 edge-right | tank@51,12 long-right | tank@55,8 walk-right | tank@57,12 drive-right | tank@71,12 walk-left | tank@70,12 late-right | tank@73,11 jump-right | tank@76,7 edge-right | tank@91,7 jump-right | tank@96,4 edge-right | tank@112,12 drive-right | tank@132,12 edge-right | tank@148,12 edge-right | tank@167,12 edge-runup-right | tank@175,8 run-right | tank@180,12 long-right | tank@188,11 walk-left | tank@187,11 jump-right | tank@189,7 up-right | tank@193,4 jump-right',
  ],
  [
    'll-8-1',
    'll-8-1',
    140,
    'enter ll-8-1 | tank@1,12 drive-right | tank@19,12 jump-right | tank@21,8 long-right | tank@30,8 drive-right | tank@43,12 edge-right | tank@53,8 jump-right | tank@62,12 edge-right | tank@87,12 edge-right | tank@98,12 drive-right | tank@115,12 jump-right | tank@120,10 spring300-right',
  ],
  [
    'll-8-2',
    'll-8-2',
    120,
    'enter ll-8-2 | tank@1,12 drive-right | tank@21,12 edge-runup-right ride1-right | tank@41,12 drive-right | tank@61,12 drive-right | tank@80,12 jump-right | tank@87,12 drive-right | tank@99,12 drive-left | tank@94,12 run-right | tank@98,12 boost0-right | tank@111,11 jump-right | tank@118,12 jump-right',
  ],
  [
    'll-8-4',
    'll-8-4',
    45,
    'enter ll-8-4 | tank@0,6 run-right | tank@4,6 run-right | tank@10,12 drive-right | tank@29,12 late-right | tank@33,11 wait30-right ride1-right',
  ],
  [
    'll-8-4-end2',
    'll-8-4-end3',
    3,
    'enter ll-8-4-end2 | tank@3,10 hop-right ride-drive8-right | tank@14,8 edge-right | tank@26,12 edge-right ride-drive28-right | tank@111,12 long-right | tank@118,9 drive-right | tank@127,12 drive-right | tank@147,12 drive-right | tank@166,12 drive-right | tank@186,12 run-right | tank@190,12 long-right ride1-right | tank@201,9 drive-right | enter ll-8-4-end3',
  ],
  [
    'll-11-3',
    'll-11-3',
    22,
    'enter ll-11-3 | tank@1,12 edge-runup-right | tank@14,10 jump-right | tank@19,8 long-right ride1-left',
  ],
  [
    'll-11-4',
    'll-11-4',
    0,
    'enter ll-11-4 | tank@0,6 run-right | tank@6,11 jump-right | tank@12,9 edge-right | tank@20,10 jump-right | tank@24,7 edge-right | tank@42,12 jump-right | tank@45,8 jump-right | tank@50,5 long-right | tank@55,5 edge-runup-right ride40-right | tank@70,5 edge-right | tank@83,5 edge-right | tank@100,12 drive-right | tank@119,12 edge-right | tank@131,12 drive-right | tank@151,12 edge-right | tank@163,12 drive-right | tank@183,12 edge-right | tank@197,12 walk-right | tank@197,12 walk-left | tank@196,12 late-right | tank@199,11 up-right | tank@203,8 hop-right | tank@208,9 drive-right | tank@227,9 edge-right',
  ],
  [
    'll-12-1',
    'll-12-1',
    0,
    'enter ll-12-1 | tank@1,12 drive-right | tank@21,12 edge-right | tank@35,10 run-right | tank@39,12 edge-right | tank@50,12 drive-right | tank@69,12 edge-right | tank@77,12 edge-right | tank@94,12 late-right | tank@97,9 pipe | enter ll-12-1-bonus | tank@1,5 drive-right | tank@8,8 drive-right | tank@19,12 drive-right | enter ll-12-1 | tank@131,10 long-right | tank@140,12 long-right | tank@149,12 jump-right | tank@156,12 drive-right | tank@175,12 edge-right | tank@184,12 long-right | tank@192,12 jump-right | tank@199,12 jump-right | tank@206,12 long-right | tank@212,9 jump-right | tank@217,7 jump-right | tank@222,12 jump-right',
  ],
  [
    'll-12-2',
    'll-12-2',
    0,
    'enter ll-12-2 | tank@1,12 edge-right | tank@15,9 hop-right | tank@20,9 hop-right | tank@25,10 long-right | tank@34,11 edge-right | tank@52,12 long-right | tank@59,8 jump-right | tank@66,9 long-right | tank@75,11 jump-right | tank@82,12 edge-right | tank@95,12 jump-right | tank@98,8 long-right | tank@107,8 edge-right | tank@118,8 edge-right | tank@126,8 up-right ride150-right | tank@145,12 edge-right | tank@153,8 wait90-down-right ride40-right | tank@180,12 edge-right',
  ],
  [
    'll-13-4',
    'll-13-4',
    0,
    'enter ll-13-4 | tank@0,6 drive-right | tank@9,12 jump-right | tank@16,12 drive-right | tank@31,12 walk-left | tank@30,12 late-right | tank@33,11 jump-right | tank@40,11 hop-right ride1-right | tank@48,10 jump-right ride1-right | tank@60,6 hop-right ride-drive8-right | tank@74,12 drive-right | tank@93,12 edge-right | tank@103,8 pipe | enter ll-13-4-exit | tank@3,10 long-right | tank@12,12 jump-right | tank@20,12 edge-right | tank@38,12 jump-right | tank@41,8 jump-right | tank@50,12 drive-right | tank@68,12 long-right | tank@72,8 jump-right | tank@76,4 long-right | tank@85,5 pipe | enter ll-13-4-bonus | tank@1,5 drive-right | tank@8,8 drive-right | tank@19,12 drive-right | enter ll-13-4-end | tank@3,10 long-right | tank@12,12 drive-right | tank@32,12 edge-right | tank@42,12 long-right | tank@49,9 drive-right | tank@65,12 jump-right ride1-right | tank@74,5 drive-right | tank@87,5 down | tank@88,9 drive-right | tank@107,9 jump-right',
  ],
];

/**
 * A scripted run: `goto` x (px: drive there and stop), `jump` straight up, `right` / `left` (a
 * jump held `j` frames, steering from frame `s`; each ends on landing or on a vine), `down` and
 * `up` held for `n` frames, `wait` `n` frames.
 */
type Step = ['goto', number] | ['jump' | 'right' | 'left', number, number] | ['down' | 'up' | 'wait', number];

function scripted(id: string, x: number, y: number, steps: Step[]) {
  let i = 0;
  let t = 0;
  let air = false;
  return runSim({
    level: heroVariant(campaignLevel(getLevel(id)), [SOPHIA.id], true),
    character: SOPHIA,
    script: { steps: [] },
    maxFrames: 3000,
    assist: { invulnerable: true, infiniteTime: true },
    start: { x, y, mode: 'stand' },
    until: (w) => w.player.dead || i >= steps.length,
    controller: (w) => {
      for (const e of w.entities) if (e instanceof Enemy) e.alive = false;
      const b = w.player.body;
      const s = steps[i];
      if (!s) return [];
      t++;
      const next = (): Action[] => {
        i++;
        t = 0;
        air = false;
        return [];
      };
      if (i === 0 && t < 20) return [];
      switch (s[0]) {
        case 'goto': {
          const d = s[1] - toPx(b.x);
          if (Math.abs(d) <= 1 && Math.abs(b.vx) < 400) return next();
          if (Math.abs(d) > 24) return [d > 0 ? 'right' : 'left'];
          return t % 6 === 0 ? [d > 0 ? 'right' : 'left'] : [];
        }
        case 'wait':
          return t > s[1] ? next() : [];
        case 'down':
        case 'up':
          return t > s[1] ? next() : [s[0]];
        default: {
          if (w.player.vine) return next();
          if (!b.onGround) air = true;
          else if (air) return next();
          const a: Action[] = t < s[2] ? ['jump'] : [];
          if (s[0] !== 'jump' && t >= s[1]) a.push(s[0]);
          return a;
        }
      }
    },
  });
}

describe('Normal Sophia III gets past each variant’s spot', () => {
  it.each(ROUTES)('%s (in %s to column %i; 0: the end)', (id, area, col, path, from) => {
    const start = from ? { x: from[0], y: from[1], mode: 'stand' as const } : undefined;
    const r = replay(id, 'small', path.split(' | '), undefined, start);
    if (col === 0) expect(r.done ? 'done' : `stuck at ${r.at}`).toBe('done');
    else {
      expect(r.stand?.area).toBe(area);
      expect(r.stand?.col).toBeGreaterThanOrEqual(col);
    }
  });

  it('ll-7-2: up the original’s hidden block to the raised pipe, the way past the loop at 128', () => {
    // From the mushroom under the pipe at 115: reveal the block at 117 (row 7), up onto it from
    // the right, onto the pipe (five tiles over the mushroom without it) and down it.
    const r = scripted('ll-7-2', 117, 10, [
      ['goto', 1870],
      ['jump', 0, 30],
      ['goto', 1890],
      ['left', 22, 70],
      ['left', 32, 70],
      ['down', 150],
    ]);
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({ target: { level: 'll-7-2-bonus' } });
    expect(getLevel('ll-7-2-bonus').zones).toContainEqual(
      expect.objectContaining({ kind: 'pipe', target: expect.objectContaining({ level: 'll-7-2', x: 147 }) }),
    );
  });

  it('8-4 (no variant): up the hidden coin block at 161 onto the hanging pipe at 163 and down it', () => {
    // As in the original: reveal the block (row 9) from the floor, jump onto it, onto the pipe's
    // top seven tiles over the floor (Mario gets there off the Paratroopas), and down the pipe.
    const plan: [Action[], number][] = [
      [[], 20],
      [['jump'], 30],
      [[], 40],
      [['left'], 30],
      [[], 30],
      [['right', 'jump'], 8],
      [['jump'], 52],
      [[], 30],
      [['right', 'jump'], 8],
      [['jump'], 52],
      [[], 30],
    ];
    const ends = plan.reduce<number[]>((a, [, n]) => [...a, (a.at(-1) ?? 0) + n], []);
    let onPipe = false;
    const r = runSim({
      level: campaignLevel(getLevel('8-4')),
      character: SOPHIA,
      script: { steps: [] },
      maxFrames: 900,
      assist: { invulnerable: true, infiniteTime: true },
      start: { x: 161, y: 12, mode: 'stand' },
      controller: (w, f) => {
        for (const e of w.entities) if (e instanceof Enemy) e.alive = false;
        const b = w.player.body;
        if (b.onGround && toPx(b.y + b.h) === 96 && toPx(b.x) > 2590) onPipe = true;
        const k = ends.findIndex((e) => f < e);
        if (k >= 0) return (plan[k] as [Action[], number])[0];
        // Over the pipe's mouth (its middle at 164 * 16), then down.
        const d = 2614 - toPx(b.x);
        if (Math.abs(d) > 1 || Math.abs(b.vx) >= 400) return f % 6 === 0 ? [d > 0 ? 'right' : 'left'] : [];
        return ['down'];
      },
    });
    expect(onPipe).toBe(true);
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({ target: { level: '8-4', x: 206 } });
  });

  it('ll-2-2: the hidden blocks of the crossing at 185 (the original’s 186 a row lower)', () => {
    // Reveal 186 (row 9) from the floor, up onto it, reveal 185 (row 5), up onto it from the
    // right, then over the gap onto the pipe's blocks and down past it to the far side.
    const r = scripted('ll-2-2', 184, 12, [
      ['goto', 2974],
      ['jump', 0, 30],
      ['goto', 2990],
      ['left', 22, 70],
      ['right', 0, 70],
      ['wait', 30],
      ['left', 22, 70],
      ['wait', 20],
      ['right', 0, 70],
      ['wait', 20],
      ['right', 0, 70],
    ]);
    expect(r.world.player.dead).toBe(false);
    expect(toPx(r.world.player.body.x) >> 4).toBeGreaterThanOrEqual(198);
  });
});
