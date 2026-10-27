import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { px, vel } from '@engine/math/units';
import { parseTextMap } from '@game/level/textmap';
import { runSim, ScriptedInput, type InputScript } from '@game/sim/headless';
import { CHARACTERS, CLASSIC_CHARACTERS, CLASSIC_EXTRAS } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { World } from '@game/world/world';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { DEFAULT_ASSIST, newGameState, type GameContext, type Rules } from '@game/context';
import { MARIO } from '@game/characters/mario';
import { Spring } from '@game/entities/objects/spring';
import { ridingOf } from '@game/characters/classic/yoshi-mount';
import { flatLevel } from './classic-plumber-harness';

// Items 193/194: the flagpole's invisible barrier, in every ruleset. A hero above the ball cannot
// pass the shaft's x moving right; it falls into the shaft, and only touching the shaft clears.

const l11 = parseTextMap(
  readFileSync(join(import.meta.dirname, '../../src/content/levels/world1/1-1.map'), 'utf8'),
  '1-1',
);

function world(def: CharacterDef, rules: Rules): World {
  return runSim({ level: l11, character: def, script: { steps: [] }, maxFrames: 0, rules }).world;
}

/** Put the hero at (xPx, bottom yPx) with the given vertical speed, airborne. */
function place(w: World, xPx: number, bottomPx: number, vy: number): void {
  const b = w.player.body;
  b.x = px(xPx);
  b.y = px(bottomPx) - b.h;
  b.prevBottom = b.y + b.h;
  b.vx = 0;
  b.vy = vy;
  b.onGround = false;
  // The screen with it (a ship is held inside the camera, VV-M11).
  w.camera.x = Math.max(0, b.x - px(96));
}

/** Run `frames` frames of `script`; calls `each` after every frame until the clear starts. */
function run(w: World, script: InputScript, frames: number, each: (w: World) => void): void {
  const input = new ScriptedInput(script);
  for (let i = 0; i < frames; i++) {
    input.next();
    w.update([input]);
    if (w.clearPhase !== null) return;
    each(w);
  }
}

/** Right, run and jump held, with attack and special tapped: every move the hero has. */
function mash(frames: number): InputScript {
  const steps: InputScript['steps'] = [];
  for (let f = 0; f < frames; f += 8) {
    steps.push({ frame: f, hold: ['right', 'run', 'jump'] });
    steps.push({ frame: f + 2, hold: ['right', 'run', 'jump', 'attack'] });
    steps.push({ frame: f + 4, hold: ['right', 'run', 'special'] });
    steps.push({ frame: f + 6, hold: ['right', 'run', 'up'] });
  }
  // Then down toward the shaft (a hero that flies, Vic Viper, does not fall by itself).
  steps.push({ frame: frames, hold: ['right', 'down'] });
  return { steps };
}

const heroes: [string, CharacterDef, Rules][] = [
  ...CHARACTERS.map((d): [string, CharacterDef, Rules] => [`Campaign ${d.id}`, d, 'campaign']),
  ...Object.values(CLASSIC_CHARACTERS).map((d): [string, CharacterDef, Rules] => [
    `Classic ${d!.id}`,
    d!,
    'classic',
  ]),
  ...CLASSIC_EXTRAS.map((d): [string, CharacterDef, Rules] => [`Classic extra ${d.id}`, d, 'classic']),
];

/** Fails if the hero is ever right of the wall (1 px into the shaft) while its feet are above the ball's top. */
function holdsBarrier(w: World): void {
  const pole = w.flagpole!;
  const b = w.player.body;
  if (b.y + b.h <= pole.body.y) expect(b.x + b.w).toBeLessThanOrEqual(pole.body.x + px(1));
}

describe('the flagpole barrier (items 193/194)', () => {
  it.each(heroes)(
    '%s: a very high jump toward the pole cannot pass its x above the ball',
    (_n, def, rules) => {
      const w = world(def, rules);
      const pole = w.flagpole!;
      // Far above the screen top, rising fast, a few tiles left of the pole.
      place(w, pole.body.x / 256 - 48, pole.topY - 120, -vel(6));
      // Already running right (Simon's and Arthur's jumps keep their take-off speed).
      w.player.body.vx = vel(1.5);
      let pinned = 0;
      run(w, mash(200), 600, (ww) => {
        holdsBarrier(ww);
        const b = ww.player.body;
        if (b.y + b.h <= pole.body.y && b.x + b.w >= pole.body.x) pinned++;
      });
      // It reached the barrier above the ball (a ship is held below the HUD rows, VV-M11, so it
      // never gets that high).
      if (def.id !== 'vicviper') expect(pinned).toBeGreaterThan(0);
      // It fell into the shaft: touching it started the clear, grabbed by this hero.
      expect(w.clearPhase).not.toBeNull();
      expect(w.flagGrabbedBy).toBe(w.player);
    },
  );

  it('blocks just left of the shaft and zeroes rightward speed, and the hero falls', () => {
    const w = world(CHARACTERS[0]!, 'campaign');
    const pole = w.flagpole!;
    place(w, pole.body.x / 256 - 20, pole.topY - 40, 0);
    w.player.body.vx = vel(3);
    let pinned = false;
    run(w, { steps: [{ frame: 0, hold: ['right', 'run'] }] }, 120, (ww) => {
      const b = ww.player.body;
      // Put back against it (the frame he reaches it by his own move is not a block yet).
      if (b.x + b.w === pole.body.x + px(1) && b.y + b.h <= pole.body.y && b.vx === 0) pinned = true;
    });
    expect(pinned).toBe(true);
    expect(w.clearPhase).toBe('slide');
  });

  it('a fall onto the top of the shaft still scores the top grab', () => {
    const w = world(CHARACTERS[0]!, 'campaign');
    const pole = w.flagpole!;
    place(w, pole.body.x / 256 - 20, pole.topY - 60, 0);
    const before = w.state.score;
    run(w, { steps: [{ frame: 0, hold: ['right', 'run'] }] }, 120, () => undefined);
    expect(w.clearPhase).toBe('slide');
    expect(w.state.score - before).toBe(5000);
  });

  it.each(['campaign', 'classic'] as const)(
    '%s: never blocks a hero coming back from the right above the ball',
    (rules) => {
      const w = world(CHARACTERS[0]!, rules);
      const pole = w.flagpole!;
      place(w, pole.body.x / 256 + 24, pole.topY - 200, -vel(4));
      let crossed = false;
      run(w, { steps: [{ frame: 0, hold: ['left', 'run'] }] }, 60, (ww) => {
        const b = ww.player.body;
        if (b.x + b.w < pole.body.x && b.y + b.h <= pole.body.y) crossed = true;
      });
      expect(crossed).toBe(true);
    },
  );

  it('blocks only the hero: an enemy shell or projectile over the ball is not stopped', () => {
    // The barrier is in World.poleBarrier, which only ever moves players; a spot check that the
    // world's enemies and projectiles do not go through it.
    const src = readFileSync(join(import.meta.dirname, '../../src/game/world/world.ts'), 'utf8');
    const body = src.slice(src.indexOf('private poleBarrier('), src.indexOf('private startClear('));
    expect(body).toContain('p: Player');
    expect(body).not.toMatch(/Enemy|Projectile|camera/);
  });

  /** A flat level with a pole at column 40 (ball row 2) and, optionally, a second at 60. */
  const poleLevel = (second = false) => {
    const rows: Record<number, string> = {};
    const put = (y: number, x: number, c: string) => {
      const r = (rows[y] ?? '').padEnd(80, '.');
      rows[y] = r.slice(0, x) + c + r.slice(x + 1);
    };
    for (const x of second ? [40, 60] : [40]) {
      put(2, x, 'o');
      for (let y = 3; y < 13; y++) put(y, x, '!');
    }
    return flatLevel(rows, 80);
  };

  it('a spring launch toward the pole is blocked like a jump', () => {
    const w = runSim({ level: poleLevel(), character: MARIO, script: { steps: [] }, maxFrames: 0 }).world;
    w.spawn(new Spring(36, 12));
    const pole = w.flagpole!;
    place(w, 36 * 16, 12 * 16 - 32, 0);
    const steps: InputScript['steps'] = [];
    for (let f = 0; f < 400; f += 6) {
      steps.push({ frame: f, hold: ['right', 'jump'] });
      steps.push({ frame: f + 3, hold: ['right'] });
    }
    let pinned = 0;
    run(w, { steps }, 400, (ww) => {
      holdsBarrier(ww);
      const b = ww.player.body;
      if (b.y + b.h <= pole.body.y && b.x + b.w >= pole.body.x) pinned++;
    });
    expect(pinned).toBeGreaterThan(0);
    expect(w.clearPhase).not.toBeNull();
  });

  it('a hero riding the Classic Yoshi mount is blocked too, and the pair clears at the shaft', () => {
    const ctx: GameContext = {
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: true,
      rules: 'classic',
      classicYoshi: 'ride',
    };
    const w = new World(poleLevel(), ctx, { ...newGameState(MARIO, null, 'classic'), kit: {} }, { seed: 1 });
    expect(ridingOf(w.player)).not.toBeNull();
    place(w, 30 * 16, 32 - 100, -vel(5));
    w.player.body.vx = vel(1.5);
    let pinned = 0;
    run(w, mash(150), 500, (ww) => {
      holdsBarrier(ww);
      const b = ww.player.body;
      if (b.y + b.h <= px(32) && b.x + b.w === ww.flagpole!.body.x + px(1)) pinned++;
    });
    expect(pinned).toBeGreaterThan(0);
    expect(w.clearPhase).not.toBeNull();
  });

  it('a level with two poles has a barrier at each', () => {
    const w = runSim({ level: poleLevel(true), character: MARIO, script: { steps: [] }, maxFrames: 0 }).world;
    // Past the first pole, high, running at the second.
    place(w, 50 * 16, 32 - 80, -vel(4));
    w.player.body.vx = vel(1.5);
    let maxRight = 0;
    run(w, mash(150), 500, (ww) => {
      const b = ww.player.body;
      if (b.y + b.h <= px(32)) maxRight = Math.max(maxRight, b.x + b.w);
    });
    expect(maxRight).toBeLessThanOrEqual(px(60 * 16 + 8));
    expect(w.clearPhase).not.toBeNull();
  });
});
