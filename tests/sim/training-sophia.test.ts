import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { CardScene } from '@game/scenes/message';
import type { HeroStageScene } from '@game/tutorial/hero-stage';
import { SOPHIA_LESSONS, SOPHIA_STAGE } from '@game/tutorial/heroes/sophia';
import { onTop } from '@game/tutorial/heroes/common';
import { useStorage } from './heroes-harness';
import { sophiaBot } from './bots/sophia';
import { choose, controls, heroCol, playStage, skipGreeting, startAtLabels, startStage } from './stage-bot';

// Sophia III's training stage (0.4.38, design section 10): Normal, with the cannon, the nose-first
// drop and Jason on foot, then the Power Capsule and each item from a block in her order. The
// hover crosses a ditch no jump does; a hit takes her hull and climbs, and the put-back gives them.

useStorage();

const S = SOPHIA_STAGE;
const lessonId = (s: HeroStageScene) => s.director.lesson?.id;

describe("Sophia III's stage", () => {
  it('a bot plays it to the TRAINING CLEAR card in about two minutes, the box always clear', () => {
    const { h, stage } = startStage('sophia');
    const s = stage();
    expect(s.world.player.powerState).toBe('small');
    skipGreeting(h);
    const log = playStage(h, s, sophiaBot(), () => s.cleared, 7200);
    expect(s.director.done).toEqual(SOPHIA_LESSONS.map((l) => l.id));
    expect(log.cards).toEqual([]);
    expect(log.frames).toBeLessThan(7200);
    expect(h.top()).toBeInstanceOf(CardScene);
  });

  it('START AT lists her items in order', () => {
    const { h } = startStage('sophia', { replay: true });
    expect(startAtLabels(h)).toEqual([
      'Beginning',
      'Power Capsule',
      'Crusher',
      'Triple Missile',
      'Wall Climb',
      'Ceiling Climb',
      'Homing Missile',
    ]);
  });

  it('the hover crosses the wide ditch; her best jump falls short of the far bank', () => {
    const { h, stage } = startStage('sophia', { replay: true });
    choose(h, 'Crusher');
    const s = stage();
    // Back to the hover's lesson's spot: Hyper, at the ditch, jumping without the hover.
    s.director.startAt(SOPHIA_LESSONS.findIndex((l) => l.id === 'hover'));
    expect(s.world.player.powerState).toBe('big');
    playStage(
      h,
      s,
      (st) => {
        const pl = st.world.player.body;
        const out: Action[] = ['right'];
        if (pl.onGround ? toPx(pl.x + pl.w) >= S.ditch.from * 16 - 2 : pl.vy < 0) out.push('jump');
        return out;
      },
      () => !s.world.player.body.onGround && toPx(s.world.player.body.y) > 200,
      400,
    );
    expect(onTop(s.world, S.farBank.top, S.farBank.from, S.farBank.to)).toBe(false);
    expect(lessonId(s)).toBe('hover');
    // From the ditch's floor (the screen keeps her from going back), the hover takes her up the
    // far bank, which no jump climbs.
    playStage(h, s, sophiaBot(), () => lessonId(s) !== 'hover', 900);
    expect(lessonId(s)).toBe('crusher');
  });

  it("missiles all spent missing the target: Toad's put-back gives them again", () => {
    const { h, stage } = startStage('sophia', { replay: true });
    choose(h, 'Triple Missile');
    const s = stage();
    playStage(h, s, sophiaBot(), () => !!s.world.player.scratch.hasTriple, 900);
    expect(lessonId(s)).toBe('triple-missile');
    s.world.player.scratch.triple = 0;
    playStage(
      h,
      s,
      (st) => {
        const out: Action[] = [];
        controls(st, out).goTo(S.missileGate - 1);
        return out;
      },
      () => h.top() instanceof CardScene,
      900,
    );
    for (let i = 0; i < 40 && h.top() instanceof CardScene; i++) h.step(i % 8 === 7 ? ['jump'] : []);
    expect(lessonId(s)).toBe('triple-missile');
    expect(s.world.player.scratch.triple).toBe(9);
    playStage(h, s, sophiaBot(), () => lessonId(s) !== 'triple-missile', 900);
    expect(lessonId(s)).toBe('wall-climb');
  });

  it("a hit takes her hull and climbs; Toad's put-back gives them back", () => {
    const { h, stage } = startStage('sophia', { replay: true });
    choose(h, 'Homing Missile');
    const s = stage();
    const p = () => s.world.player;
    expect([p().powerState, p().scratch['has-wall-climb'], p().scratch['has-ceiling-climb']]).toEqual([
      'fire',
      1,
      1,
    ]);
    s.world.hurtPlayer(p());
    expect([p().powerState, p().scratch['has-wall-climb']]).toEqual(['small', undefined]);
    playStage(
      h,
      s,
      (st) => {
        const out: Action[] = [];
        controls(st, out).goTo(S.homingGate - 1);
        return out;
      },
      () => h.top() instanceof CardScene,
      900,
    );
    expect(heroCol(s)).toBe(S.homingGate - 1);
    h.idle(40);
    h.tap('jump');
    expect([p().powerState, p().scratch['has-wall-climb'], p().scratch['has-ceiling-climb']]).toEqual([
      'fire',
      1,
      1,
    ]);
    expect(lessonId(s)).toBe('homing-missile');
  });
  it('Wall Climb needs UP held, as the tip says: driving into the wall alone stops her (RQ38)', () => {
    const wall = SOPHIA_LESSONS.find((l) => l.id === 'wall-climb');
    expect(wall?.text).toMatch(/^HOLD UP AND DRIVE INTO THE TALL WALL/);
    const { h, stage } = startStage('sophia', { replay: true });
    choose(h, 'Wall Climb');
    const s = stage();
    playStage(h, s, sophiaBot(), () => !!s.world.player.scratch['has-wall-climb'], 900);
    const up = () => onTop(s.world, S.wall.top, S.wall.from, S.wall.to);
    // Right alone, for three seconds: she drives into the wall's foot and stays there.
    playStage(h, s, () => ['right'], up, 180);
    expect(up()).toBe(false);
    expect(heroCol(s)).toBeLessThan(S.wall.from);
    // UP as well: up the wall and onto its top.
    playStage(h, s, () => ['right', 'up'], up, 600);
    expect(up()).toBe(true);
  });
});
