import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { campaignLevel } from '@game/level/campaign';
import type { LevelData } from '@game/level/schema';
import { runSim, ScriptedInput } from '@game/sim/headless';
import { World } from '@game/world/world';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { Bowser } from '@game/entities/enemies/bowser';
import { castleRemark } from '@game/story/script';
import { px } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { drops, dropSim } from './safety-floor-bot';

/*
 * World 6 as Ryu's world (0.4.29): its looks are skin only, so every hero plays each World 6
 * level in its campaign look exactly as without it. Checked with real inputs for
 * every hero: a run-and-jump bot across each level (with the Safety floor on and off) traces the
 * same frames, and the Safety floor sweep's drops into every pit end the same, the five heroes the
 * bundled sweep covers (safety-floor-sweep.test.ts) caught and out onto the ground. 6-2's water
 * area, the night harbour, is no water theme: every hero still swims there (its `swim: true`).
 * 6-4 as the demon temple keeps the fake Bowser's unmask and the castle remark.
 */

const IDS = ['6-1', '6-2-bonus', '6-2-bonus2', '6-2-water', '6-3', '6-4'];
const SWEPT = new Set(['mario', 'link', 'samus', 'simon', 'sophia']);

/** The level as the campaign plays it, and the classic level. */
const both = (id: string): [LevelData, LevelData] => [campaignLevel(getLevel(id)), getLevel(id)];

/** Hold right and run; jump in 24-frame presses every 48 frames, as a player charging ahead. */
const charge = (_: unknown, f: number): Action[] =>
  f % 48 < 24 ? ['right', 'run', 'jump'] : ['right', 'run'];

function trace(level: LevelData, hero: (typeof CHARACTERS)[number], safetyFloor: boolean) {
  const at: string[] = [];
  let swam = false;
  const r = runSim({
    level,
    character: hero,
    script: { steps: [] },
    controller: charge,
    maxFrames: 1500,
    assist: { safetyFloor, infiniteLives: true },
    until: (w, f) => {
      swam ||= w.player.inWater;
      if (f % 10 === 0) at.push(`${f}:${w.player.body.x}:${w.player.body.y}`);
      return false;
    },
  });
  expect(at.length).toBeGreaterThan(10);
  return { outcome: r.outcome, frames: r.frames, x: r.playerX, y: r.playerY, at, swam };
}

describe("World 6's looks play exactly as the classic levels, for every hero", () => {
  for (const id of IDS)
    it.each(CHARACTERS.map((c) => [c.id, c] as const))(`${id}: %s charges through the same`, (_, hero) => {
      const [camp, classic] = both(id);
      expect(camp.theme).not.toBe(classic.theme);
      for (const safety of [true, false]) {
        const t = trace(camp, hero, safety);
        expect(t).toEqual(trace(classic, hero, safety));
        // the night harbour swims for every hero, as the classic water area does
        if (id === '6-2-water') expect(t.swam, `${hero.id} swims`).toBe(true);
      }
    });

  for (const id of IDS)
    it(`${id}: every hero's drops into its pits and lava end the same; the swept heroes walk out`, () => {
      const [camp, classic] = both(id);
      const failures: string[] = [];
      for (const hero of CHARACTERS)
        for (const d of drops(classic)) {
          const tag = `${hero.id} ${id} ${d.kind}@${d.x}`;
          const run = (l: LevelData, dir: -1 | 1) =>
            dropSim(l, hero, d, { safety: true, walkOut: true, dir });
          const first = run(camp, d.dirs[0]);
          expect(first, tag).toEqual(run(classic, d.dirs[0]));
          if (!SWEPT.has(hero.id)) continue;
          const res = first.out || first.died ? first : run(camp, d.dirs[1]);
          if (res.died || !res.out) failures.push(`${tag}: ${res.died ? 'died' : 'stuck'}`);
        }
      expect(failures).toEqual([]);
    });
});

describe("6-2's night harbour: every hero drops in and swims", () => {
  it.each(CHARACTERS.map((c) => [c.id, c] as const))('%s swims in the campaign harbour', (_, hero) => {
    const r = runSim({
      level: campaignLevel(getLevel('6-2-water')),
      character: hero,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: 900,
      until: (w, f) => f > 10 && w.player.body.onGround,
    });
    expect(r.world.player.inWater, hero.id).toBe(true);
    expect(Number.isFinite(r.world.waterTop)).toBe(true);
  });
});

describe("6-4 as the demon temple: the fake Bowser's unmask and the castle remark still play", () => {
  function castle() {
    const level = campaignLevel(getLevel('6-4'));
    expect(level.theme).toBe('ng-temple');
    const sfx: string[] = [];
    const state = newGameState(MARIO);
    state.world = level.world;
    const axe = (level.entities.find((e) => e.type === 'axe') as { x: number }).x;
    const world = new World(
      level,
      {
        assets: new AssetRegistry({ default: {} }),
        audio: { ...NULL_AUDIO, sfx: (s: string) => void sfx.push(s) },
        assist: { ...DEFAULT_ASSIST, invulnerable: true },
        reduceFlashing: true,
      },
      state,
      { x: axe - 6, y: 8, mode: 'stand' },
    );
    world.storyMode = true;
    const input = new ScriptedInput({ steps: [{ frame: 0, hold: [] as Action[] }] });
    const step = (n = 1) => {
      for (let i = 0; i < n; i++) {
        input.next();
        world.update([input]);
        world.events.splice(0);
      }
    };
    const bowser = () => world.entities.find((e): e is Bowser => e instanceof Bowser && !e.fake);
    for (let i = 0; i < 10 && !bowser(); i++) step();
    return { world, step, b: bowser()!, axe, sfx };
  }

  it('reaching the axe with the fake standing: the disguise bursts, the hero says the remark', () => {
    const { world, step, b, axe, sfx } = castle();
    expect(b).toBeDefined();
    const calls: { level: string; done: () => void }[] = [];
    world.remarkHook = (level, _hero, done) => {
      calls.push({ level, done });
      return true;
    };
    const p = world.player.body;
    p.x = px(axe * 16 + 2);
    p.y = px(9 * 16) - p.h;
    p.vx = 0;
    p.vy = 0;
    world.camera.snapTo(p.x);
    step();
    expect(world.unmask?.kind).toBe('axe');
    expect(b.standing).toBe(6); // World 6's true form
    expect(sfx).toContain('poof');
    step(60);
    expect(calls.map((c) => c.level)).toEqual(['6-4']);
    expect(castleRemark('6-4', 'MARIO')).toBeTruthy();
    calls[0]?.done();
    step(60);
    expect(world.bossClear).not.toBeNull();
  });
});
