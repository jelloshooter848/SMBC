import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { dpadDirs, type DpadDirs } from '@engine/input/touch-logic';
import { toPx } from '@engine/math/units';
import type { Scene } from '@engine/scene';
import { defaultSettings } from '@engine/save/settings';
import { LUIGI } from '@game/characters/luigi';
import { MARIO } from '@game/characters/mario';
import type { CharacterDef } from '@game/characters/character';
import { runSim } from '@game/sim/headless';
import { getLevel } from '@content/levels';
import { LUIGI_COAST_PX, LUIGI_SLIDE_PX, MoveStats } from '@game/tutorial/lessons';
import { PracticeRoomScene, practiceRoom } from '@game/tutorial/room';
import { makeGame, useStorage } from './heroes-harness';

useStorage();

/*
 * Luigi's training lesson 2/3 ("slippery stop"), played the way a player does: from the room's
 * start, run right and let go somewhere between the dummy and the gap. The room is one screen:
 * from a real run Luigi glides 100+ px, more floor than there is before the gap, so the old
 * check (a finished glide of LUIGI_COAST_PX) only passed when he was let go inside a ~15 px
 * window (just past walking speed); now a glide the gap cuts short counts by where it was going.
 */

/** The room on Luigi's lesson 2, as the training flow opens it. */
function lesson2() {
  const h = makeGame();
  h.game.deps.settings = defaultSettings();
  const below: Scene = { update() {}, render() {} };
  h.game.scenes.push(below);
  const scene = new PracticeRoomScene(h.game, LUIGI, { onEnd: () => undefined });
  h.game.scenes.push(scene);
  h.step();
  scene.startLesson(1);
  expect(scene.lesson?.id).toBe('slippery-stop');
  return { h, scene };
}

/** The touch d-pad's actions for a thumb `r` × radius out to the right (touch.ts maps dirs to actions). */
function thumbRight(r: number): Action[] {
  const d: DpadDirs = dpadDirs(r * 60, 0, 60);
  return (['left', 'right', 'up', 'down', 'run'] as const).filter((a) => d[a]);
}

type Style = 'keys' | 'touch-lift' | 'touch-slide-back';

/**
 * One attempt: hold run to the right from the start until the hero's centre reaches `letGo` px,
 * then let go (keys: both released; touch: the thumb lifts, or slides back to the centre over a
 * few frames first). Returns whether lesson 2 ticked within the attempt (before any fall).
 */
function attempt(style: Style, letGo: number): { passed: boolean; fell: boolean } {
  const { h, scene } = lesson2();
  const start = toPx(scene.player.centerX);
  let phase: 'run' | 'slide-back' | 'off' = 'run';
  let back = 0;
  let fell = false;
  for (let i = 0; i < 240 && scene.phase === 'lesson'; i++) {
    const p = scene.player;
    if (phase === 'run' && toPx(p.centerX) >= letGo)
      phase = style === 'touch-slide-back' ? 'slide-back' : 'off';
    let act: Action[] = [];
    if (phase === 'run') act = style === 'keys' ? ['right', 'attack'] : thumbRight(0.95);
    else if (phase === 'slide-back') {
      // The thumb drags back through the walking band (r 0.7 → 0.3) before it lifts.
      act = thumbRight(0.7 - back * 0.08);
      if (++back >= 6) phase = 'off';
    }
    h.step(act);
    if (toPx(scene.player.centerX) < start - 8) fell = true; // put back at the start
  }
  return { passed: scene.ticked.includes('slippery-stop'), fell };
}

describe("Luigi's slippery stop (training 2/3) passes on the first honest attempt", () => {
  it('the touch d-pad: a far push holds right and run, a middling one walks', () => {
    expect(thumbRight(0.95)).toEqual(['right', 'run']);
    expect(thumbRight(0.5)).toEqual(['right']);
  });

  // Letting go anywhere from the dummy to just before the gap (176 px): the honest attempts.
  const spots = [120, 130, 140, 150, 160];
  it.each(['keys', 'touch-lift', 'touch-slide-back'] as const)('%s', (style) => {
    for (const x of spots) {
      if (style === 'touch-slide-back' && x > 145) continue; // the drag back walks him into the gap
      const r = attempt(style, x);
      expect(r.passed, `${style}, let go at ${x}`).toBe(true);
      expect(r.fell, `${style}, let go at ${x}`).toBe(false);
    }
  });

  it('letting go for a single frame mid-run does not count (GLIDE_SEEN_PX: the slide must be seen)', () => {
    const { h, scene } = lesson2();
    let blinked = false;
    let fast = 0;
    for (let i = 0; i < 240 && scene.phase === 'lesson'; i++) {
      const p = scene.player;
      // One frame with nothing held at a good clip, then right and run again, on into the gap.
      const blink = !blinked && toPx(p.centerX) >= 135;
      if (blink) {
        blinked = true;
        fast = Math.abs(p.body.vx) / 4096;
      }
      h.step(blink ? [] : ['right', 'attack']);
    }
    expect(blinked).toBe(true);
    // Fast enough that, without the guard, its projected glide alone would pass.
    expect((fast * fast) / (2 * (LUIGI.movement.releaseDecel / 4096))).toBeGreaterThan(LUIGI_SLIDE_PX);
    expect(scene.tracker.maxRunGlide).toBeLessThan(LUIGI_SLIDE_PX);
    expect(scene.phase).toBe('lesson');
  });

  it('letting go at walking speed, or not before the gap, does not count', () => {
    expect(attempt('keys', 100).passed).toBe(false);
    expect(attempt('keys', 200).passed).toBe(false);
  });

  it('the root cause: most of those attempts never finish a LUIGI_COAST_PX glide in the room', () => {
    const finished = [120, 130, 140, 150, 160].filter((x) => {
      const { h, scene } = lesson2();
      let off = false;
      // While the lesson is up (its chapter's next card comes up once it is done).
      for (let i = 0; i < 240 && scene.phase === 'lesson'; i++) {
        if (toPx(scene.player.centerX) >= x) off = true;
        h.step(off ? [] : ['right', 'attack']);
      }
      return scene.tracker.maxRunCoast >= LUIGI_COAST_PX;
    });
    expect(finished.length).toBeLessThanOrEqual(1);
  });
});

describe('a projected glide of LUIGI_SLIDE_PX still means "further than Mario"', () => {
  /** On 1-1's long first floor: run right for `frames`, let go, and measure the stop. */
  const glide = (c: CharacterDef, frames: number) => {
    const stats = new MoveStats(practiceRoom().geometry);
    runSim({
      level: getLevel('1-1'),
      character: c,
      maxFrames: frames + 200,
      script: {
        steps: [
          { frame: 0, hold: ['right', 'attack'] },
          { frame: frames, hold: [] },
        ],
      },
      until: (w, f) => {
        stats.observe(w.player, w);
        return f > frames && w.player.body.vx === 0;
      },
    });
    return stats;
  };

  it("Mario's stop from full speed never projects that far; Luigi's does", () => {
    const mario = glide(MARIO, 70);
    const luigi = glide(LUIGI, 70);
    expect(mario.maxRunGlide).toBeLessThan(LUIGI_SLIDE_PX);
    expect(luigi.maxRunGlide).toBeGreaterThanOrEqual(LUIGI_SLIDE_PX);
    // On open floor the projection is what really happens (within a few px).
    expect(Math.abs(luigi.maxRunGlide - luigi.maxRunCoast)).toBeLessThan(6);
  });
});

describe('the run lesson on touch', () => {
  it('says to push the d-pad far to the side (the RUN button too); keys keep the usual words', () => {
    const { h, scene } = lesson2();
    const keys = scene.promptWrapped().join(' ');
    expect(keys).toBe('HOLD RIGHT AND RUN (X), LET GO BEFORE THE GAP AND WATCH LUIGI SLIDE!');
    expect(keys).not.toContain('D-PAD');
    const settings = h.game.deps.settings;
    if (settings) settings.input.touch = 'on';
    const touch = scene.promptWrapped().join(' ');
    expect(touch).toBe('PUSH THE D-PAD FAR RIGHT OR HOLD RUN TO RUN. LET GO BEFORE THE GAP!');
    expect(scene.promptWrapped().length).toBeLessThanOrEqual(3);
  });
});
