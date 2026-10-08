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
import { replay } from './sophia-reach';
import { file, makeGame, useStorage, type H } from './heroes-harness';

/*
 * Sophia III's level variants (Chapter 1 finishing pass): the `[variant sophia]` sections of the
 * levels Normal Sophia could not finish (docs/HEROES.md "Sophia III in the campaign levels").
 * 8-4's is ours (campaign only); the Lost Levels' are the original Crossover's own pieces for her
 * (`[variant sophia classic]`, so classic play has them too).
 */

/** Every bundled map with a Sophia variant. */
const VARIANT_LEVELS = [
  '8-4',
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

const scene = (h: H) => h.game.scenes.find((s): s is LevelScene => s instanceof LevelScene) as LevelScene;
/** The (x, y) tiles a level's Sophia variant lays, from its map (`classic`: of classic sections only). */
const laid = (l: LevelData, classic?: boolean) =>
  (l.variants ?? [])
    .filter((v) => v.hero === 'sophia' && (classic === undefined || !!v.classic === classic))
    .flatMap((v) => v.tiles.flatMap((r) => r.tiles.map((t, i) => ({ x: r.x + i, y: r.y, t }))));
const tile = (l: LevelData, x: number, y: number) => l.tiles[y * l.width + x];

useStorage();

describe('the game lays the Sophia variant', () => {
  const play = (hero: typeof MARIO, campaign: boolean, partner?: typeof MARIO, id = '8-4') => {
    const h = makeGame();
    if (campaign) {
      file();
      h.game.openFile(1);
    }
    h.game.setHero(0, hero);
    if (partner) h.game.setHero(1, partner);
    h.game.startLevel(getLevel(id), { mode: 'stand' });
    h.step();
    return scene(h).world.level;
  };

  it('in campaign play when a player is Sophia III (either one in co-op)', () => {
    const runs = laid(getLevel('8-4'));
    expect(runs.length).toBeGreaterThan(0);
    for (const level of [play(SOPHIA, true), play(MARIO, true, SOPHIA)])
      for (const r of runs) expect(tile(level, r.x, r.y)).toBe(r.t);
  });

  it('not for Mario, and not outside the campaign (8-4 has no Sophia tiles in the original)', () => {
    for (const level of [play(MARIO, true), play(SOPHIA, false)])
      for (const r of laid(getLevel('8-4')))
        expect(tile(level, r.x, r.y)).toBe(tile(getLevel('8-4'), r.x, r.y));
  });

  it('the original’s pieces (classic sections) also outside the campaign, for her only', () => {
    const runs = laid(getLevel('ll-2-4'), true);
    expect(runs.length).toBeGreaterThan(0);
    const classic = play(SOPHIA, false, undefined, 'll-2-4');
    for (const r of runs) expect(tile(classic, r.x, r.y)).toBe(r.t);
    expect(play(MARIO, false, undefined, 'll-2-4').tiles).toBe(getLevel('ll-2-4').tiles);
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

/**
 * Routes the completability search (sophia-reach.ts) found at Normal with the variants laid,
 * replayed: through each variant's spot (to `col` in the level's main area), or to the end (0).
 */
const ROUTES: [string, number, string][] = [
  [
    '8-4',
    0,
    'enter 8-4 | tank@1,6 walk-right | tank@4,8 edge-right | tank@13,12 edge-right | tank@23,12 drive-right | tank@42,12 edge-right | tank@55,12 edge-right | tank@64,9 jump-right ride1-right | tank@77,9 long-right | tank@85,9 late-left | tank@82,7 pipe | enter 8-4 | tank@126,10 long-right | tank@134,9 jump-right | tank@141,12 jump-right | tank@147,12 long-right | tank@154,9 jump-right | tank@160,8 up-right | tank@164,5 pipe | enter 8-4 | tank@206,10 jump-right | tank@212,9 jump-right | tank@219,9 long-right | tank@226,9 edge-right | tank@237,9 jump-right | tank@243,9 drive-right | tank@262,9 edge-right | tank@273,9 long-right | tank@283,9 long-right | tank@290,9 edge-right | tank@301,9 hop-right | tank@304,7 pipe | enter 8-4-water | tank@3,10 swim-3-240-right | tank@20,7 swim-3-240-right | tank@36,4 far-right | tank@57,12 edge-right | tank@67,8 drive-right | enter 8-4-end | tank@3,10 long-right | tank@12,12 edge-right | tank@26,9 drive-right | tank@43,9 jump-right',
  ],
  [
    'll-1-2',
    0,
    'enter ll-1-2 | tank@1,12 drive-right | tank@14,12 walk-left | tank@13,12 late-right | tank@16,11 jump-right | tank@22,10 jump-right | tank@27,7 edge-right | tank@37,8 run-right | tank@40,12 edge-right | tank@49,8 hop-right | tank@54,10 jump-right | tank@59,7 long-right ride1-right | tank@100,12 jump-right | tank@102,8 edge-right | tank@109,5 walk-right | tank@113,9 hop-right | tank@118,10 up-right | tank@121,7 jump-right | tank@129,12 jump-right | tank@135,12 drive-right | tank@145,12 walk-left | tank@144,12 late-right | tank@147,11 wait70-right ride1-right | tank@167,9 drive-right | enter ll-1-2-exit | tank@3,10 long-right | tank@11,10 long-right | tank@15,6 jump-right | tank@23,12 jump-right',
  ],
  [
    'll-2-4',
    0,
    'enter ll-2-4 | tank@0,6 run-right | tank@6,9 edge-right | tank@19,5 drive-right | tank@25,12 drive-right | tank@44,12 edge-right | tank@60,12 long-right | tank@67,8 edge-right | tank@75,8 drive-right | tank@90,12 jump-right | tank@92,8 edge-right | tank@103,11 up-right | tank@107,12 jump-right | tank@114,12 edge-right | tank@122,9 jump-right | tank@129,9 edge-right',
  ],
  [
    'll-3-3',
    0,
    'enter ll-3-3 | tank@1,12 edge-runup-right | tank@14,9 jump-right | tank@18,8 edge-right | tank@38,12 jump-right | tank@45,12 jump-right | tank@47,8 long-right | tank@53,4 jump-right ride1-left | tank@57,4 hop-right ride-drive16-right | tank@73,10 long-right | tank@83,12 walk-right | tank@83,12 boost0-right | tank@123,8 jump-right | tank@130,8 long-right ride1-right | tank@146,10 jump-right ride1-right | tank@159,8 hop-right | tank@164,11 jump-right | tank@170,9 jump-right | tank@174,5 long-right',
  ],
  [
    'll-3-4',
    0,
    'enter ll-3-4 | tank@0,6 edge-right | tank@11,12 edge-right | tank@25,9 run-right | tank@31,12 edge-right | tank@42,12 drive-right | tank@61,12 drive-right | tank@145,12 jump-right | tank@149,8 jump-right | tank@154,4 drive-right | tank@166,12 drive-right | tank@186,12 long-right | tank@192,8 drive-right | tank@211,8 long-right | tank@220,8 jump-right | tank@223,4 run-right | tank@227,4 edge-right | tank@235,5 edge-right | tank@250,5 edge-right | tank@258,4 drive-right | tank@277,4 run-right | tank@281,4 walk-right | tank@283,4 jump-right | tank@288,12 jump-right | tank@294,9 edge-right',
  ],
  [
    'll-4-2',
    0,
    'enter ll-4-2 | tank@1,12 edge-right | tank@18,12 jump-right | tank@22,9 jump-right | tank@29,9 edge-right | tank@39,12 edge-right | tank@51,12 boost0-right | tank@62,4 edge-right | tank@79,12 drive-right | tank@99,12 drive-right | tank@115,12 jump-right | tank@117,8 long-right | tank@126,8 edge-right | tank@140,12 drive-right | tank@159,12 edge-right | tank@174,12 pipe | enter ll-4-2-bonus | tank@1,12 drive-right | enter ll-4-2 | tank@179,10 long-right | tank@187,9 jump-right | tank@193,7 up-right | tank@196,4 jump-right',
  ],
  ['ll-4-3', 24, 'enter ll-4-3 | tank@1,12 long-right | tank@10,12 edge-right'],
  [
    'll-5-1',
    165,
    'enter ll-5-1 | tank@1,12 drive-right | tank@21,12 edge-right | tank@39,12 run-right | tank@43,12 jump-right | tank@48,12 jump-right | tank@53,12 jump-right | tank@60,12 edge-right | tank@77,12 edge-right | tank@87,8 pipe | enter ll-5-1-bonus | tank@1,12 drive-right | enter ll-5-1 | tank@115,10 long-right | tank@123,10 long-right | tank@127,6 up-right | tank@131,4 jump-right | tank@138,4 jump-right | tank@144,4 edge-right | tank@152,4 jump-right | tank@159,4 jump-right',
  ],
  [
    'll-6-3',
    0,
    'enter ll-6-3 | tank@1,12 edge-right | tank@13,9 edge-right | tank@21,11 long-right | tank@29,11 edge-right | tank@42,9 edge-right | tank@56,11 edge-right | tank@74,9 long-right | tank@82,9 drive-right | tank@90,11 edge-right | tank@100,11 drive-right | tank@120,11 edge-right | tank@130,12 long-right | tank@138,10 up-right | tank@142,8 jump-right | tank@149,11 hop-right | tank@154,11 hop-right | tank@158,9 jump-right | tank@165,11 long-right | tank@173,9 jump-right | tank@180,11 edge-right | tank@192,9 walk-left | tank@190,9 jump-right | tank@193,5 long-right | tank@201,4 jump-right | tank@208,4 jump-right',
  ],
  [
    'll-7-1',
    0,
    'enter ll-7-1 | tank@1,12 edge-right | tank@17,10 jump-right | tank@23,9 jump-right | tank@29,8 edge-right | tank@40,12 edge-right | tank@51,12 long-right | tank@55,8 walk-right | tank@57,12 drive-right | tank@71,12 walk-left | tank@70,12 late-right | tank@73,11 jump-right | tank@76,7 edge-right | tank@91,7 jump-right | tank@96,4 edge-right | tank@112,12 drive-right | tank@132,12 edge-right | tank@148,12 edge-right | tank@167,12 edge-runup-right | tank@175,8 run-right | tank@180,12 long-right | tank@188,11 walk-left | tank@187,11 jump-right | tank@189,7 up-right | tank@193,4 jump-right',
  ],
  [
    'll-8-1',
    140,
    'enter ll-8-1 | tank@1,12 drive-right | tank@19,12 jump-right | tank@21,8 long-right | tank@30,8 drive-right | tank@43,12 edge-right | tank@53,8 jump-right | tank@62,12 edge-right | tank@87,12 edge-right | tank@98,12 drive-right | tank@115,12 jump-right | tank@120,10 spring300-right',
  ],
  [
    'll-8-4',
    45,
    'enter ll-8-4 | tank@0,6 run-right | tank@4,6 run-right | tank@10,12 drive-right | tank@29,12 late-right | tank@33,11 wait30-right ride1-right',
  ],
  [
    'll-11-4',
    0,
    'enter ll-11-4 | tank@0,6 run-right | tank@6,11 jump-right | tank@12,9 edge-right | tank@20,10 jump-right | tank@24,7 edge-right | tank@42,12 jump-right | tank@45,8 jump-right | tank@50,5 long-right | tank@55,5 edge-runup-right ride40-right | tank@70,5 edge-right | tank@83,5 edge-right | tank@100,12 drive-right | tank@119,12 edge-right | tank@131,12 drive-right | tank@151,12 edge-right | tank@163,12 drive-right | tank@183,12 edge-right | tank@197,12 walk-right | tank@197,12 walk-left | tank@196,12 late-right | tank@199,11 up-right | tank@203,8 hop-right | tank@208,9 drive-right | tank@227,9 edge-right',
  ],
  [
    'll-12-1',
    0,
    'enter ll-12-1 | tank@1,12 drive-right | tank@21,12 edge-right | tank@35,10 run-right | tank@39,12 edge-right | tank@50,12 drive-right | tank@69,12 edge-right | tank@77,12 edge-right | tank@94,12 late-right | tank@97,9 pipe | enter ll-12-1-bonus | tank@1,5 drive-right | tank@8,8 drive-right | tank@19,12 drive-right | enter ll-12-1 | tank@131,10 long-right | tank@140,12 long-right | tank@149,12 jump-right | tank@156,12 drive-right | tank@175,12 edge-right | tank@184,12 long-right | tank@192,12 jump-right | tank@199,12 jump-right | tank@206,12 long-right | tank@212,9 jump-right | tank@217,7 jump-right | tank@222,12 jump-right',
  ],
  [
    'll-12-2',
    0,
    'enter ll-12-2 | tank@1,12 edge-right | tank@15,9 hop-right | tank@20,9 hop-right | tank@25,10 long-right | tank@34,11 edge-right | tank@52,12 long-right | tank@59,8 jump-right | tank@66,9 long-right | tank@75,11 jump-right | tank@82,12 edge-right | tank@95,12 jump-right | tank@98,8 long-right | tank@107,8 edge-right | tank@118,8 edge-right | tank@126,8 up-right ride150-right | tank@145,12 edge-right | tank@153,8 wait90-down-right ride40-right | tank@180,12 edge-right',
  ],
  [
    'll-13-4',
    0,
    'enter ll-13-4 | tank@0,6 drive-right | tank@9,12 jump-right | tank@16,12 drive-right | tank@31,12 walk-left | tank@30,12 late-right | tank@33,11 jump-right | tank@40,11 hop-right ride1-right | tank@48,10 jump-right ride1-right | tank@60,6 hop-right ride-drive8-right | tank@74,12 drive-right | tank@93,12 edge-right | tank@103,8 pipe | enter ll-13-4-exit | tank@3,10 long-right | tank@12,12 jump-right | tank@20,12 edge-right | tank@38,12 jump-right | tank@41,8 jump-right | tank@50,12 drive-right | tank@68,12 long-right | tank@72,8 jump-right | tank@76,4 long-right | tank@85,5 pipe | enter ll-13-4-bonus | tank@1,5 drive-right | tank@8,8 drive-right | tank@19,12 drive-right | enter ll-13-4-end | tank@3,10 long-right | tank@12,12 drive-right | tank@32,12 edge-right | tank@42,12 long-right | tank@49,9 drive-right | tank@65,12 jump-right ride1-right | tank@74,5 drive-right | tank@87,5 down | tank@88,9 drive-right | tank@107,9 jump-right',
  ],
];

describe('Normal Sophia III gets past each variant’s spot', () => {
  it.each(ROUTES)('%s (to column %i; 0: the end)', (id, col, path) => {
    const r = replay(id, 'small', path.split(' | '));
    if (col === 0) expect(r.done ? 'done' : `stuck at ${r.at}`).toBe('done');
    else {
      expect(r.stand?.area).toBe(id);
      expect(r.stand?.col).toBeGreaterThanOrEqual(col);
    }
  });

  it('ll-7-2: up the original’s hidden block to the raised pipe, the way past the loop at 128', () => {
    // From the mushroom under the pipe at 115: reveal the block at 117 (row 7), up onto it from
    // the right, onto the pipe (five tiles over the mushroom without it) and down it.
    const steps: [string, number, number][] = [
      ['goto', 1870, 0],
      ['jump', 0, 30],
      ['goto', 1890, 0],
      ['left', 22, 70],
      ['left', 32, 70],
      ['down', 150, 0],
    ];
    let i = 0;
    let t = 0;
    let air = false;
    const r = runSim({
      level: heroVariant(campaignLevel(getLevel('ll-7-2')), [SOPHIA.id], true),
      character: SOPHIA,
      script: { steps: [] },
      maxFrames: 2000,
      assist: { invulnerable: true, infiniteTime: true },
      start: { x: 117, y: 10, mode: 'stand' },
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
        if (t < 20 && i === 0) return [];
        if (s[0] === 'goto') {
          const d = s[1] - toPx(b.x);
          if (Math.abs(d) <= 1 && Math.abs(b.vx) < 400) return next();
          if (Math.abs(d) > 24) return [d > 0 ? 'right' : 'left'];
          return t % 6 === 0 ? [d > 0 ? 'right' : 'left'] : [];
        }
        if (s[0] === 'down') return t > s[1] ? next() : ['down'];
        if (!b.onGround) air = true;
        else if (air) return next();
        const a: Action[] = t < s[2] ? ['jump'] : [];
        if (s[0] !== 'jump' && t >= s[1]) a.push(s[0] as Action);
        return a;
      },
    });
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({ target: { level: 'll-7-2-bonus' } });
    expect(getLevel('ll-7-2-bonus').zones).toContainEqual(
      expect.objectContaining({ kind: 'pipe', target: expect.objectContaining({ level: 'll-7-2', x: 147 }) }),
    );
  });
});
