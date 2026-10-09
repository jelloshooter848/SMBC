import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { CardScene } from '@game/scenes/message';
import type { HeroStageScene } from '@game/tutorial/hero-stage';
import { RYU_LESSONS, RYU_SCROLL_NINPO, RYU_STAGE } from '@game/tutorial/heroes/ryu';
import { ninpoMax } from '@game/characters/ryu';
import { useStorage } from './heroes-harness';
import { ryuBot } from './bots/ryu';
import { choose, controls, playStage, skipGreeting, stageMenu, startAtLabels, startStage } from './stage-bot';

// Ryu's training stage (0.4.38, design section 8): the Dragon Sword, wall cling and a 10-point
// bar, then the Medicine and each art and the Ninpo Scroll from a block in his order. Only wall
// jumps get him out of the shaft.

useStorage();

const S = RYU_STAGE;
const lessonId = (s: HeroStageScene) => s.director.lesson?.id;

describe("Ryu's stage", () => {
  it('a bot plays it to the TRAINING CLEAR card in under two minutes, the box always clear of his bars', () => {
    const { h, stage } = startStage('ryu');
    const s = stage();
    expect([s.world.player.hp, s.world.player.scratch.maxHp]).toEqual([10, 10]);
    skipGreeting(h);
    const log = playStage(h, s, ryuBot(), () => s.cleared, 7200);
    expect(s.director.done).toEqual(RYU_LESSONS.map((l) => l.id));
    expect(log.cards).toEqual([]);
    expect(log.frames).toBeLessThan(7200);
    expect(h.top()).toBeInstanceOf(CardScene);
  });

  it('START AT lists his items in order', () => {
    const { h } = startStage('ryu', { replay: true });
    expect(startAtLabels(h)).toEqual([
      'Beginning',
      'Medicine',
      'Throwing Star',
      'Ninpo Scroll',
      'Windmill Star',
      'Fire Wheel',
      'Jump and Slash',
    ]);
  });

  it('only wall jumps leave the shaft: jumps from its floor never reach the roof', () => {
    const { h, stage } = startStage('ryu');
    const s = stage();
    skipGreeting(h);
    stageMenu(h, 'Skip this lesson');
    expect(lessonId(s)).toBe('cling');
    let best = 999;
    playStage(
      h,
      s,
      (st) => {
        const pl = st.world.player;
        best = Math.min(best, toPx(pl.body.y + pl.body.h));
        // Into the shaft, then jumping straight up and at the walls without holding on.
        const x = toPx(pl.centerX);
        if (x < S.shaft.from * 16 + 4) return ['right'];
        return st.world.frame % 40 < 20
          ? ['jump']
          : st.world.frame % 80 < 40
            ? ['jump', 'right']
            : ['jump', 'left'];
      },
      () => false,
      600,
    );
    expect(lessonId(s)).toBe('cling');
    expect(best).toBeGreaterThan(S.roof.top * 16 + 24);
    // Kicking off the walls gets him there.
    playStage(h, s, ryuBot(), () => lessonId(s) === 'medicine', 900);
    expect(lessonId(s)).toBe('medicine');
  });

  it('the Ninpo Scroll lengthens the bar to 60 once; a put-back gives it again, not another', () => {
    const { h, stage } = startStage('ryu', { replay: true });
    choose(h, 'Windmill Star');
    const s = stage();
    expect(ninpoMax(s.world.player)).toBe(RYU_SCROLL_NINPO);
    expect(s.world.player.scratch.scrolls).toBe(1);
    // At the gate with the lesson not done: Toad's card, then the put-back.
    playStage(
      h,
      s,
      (st) => {
        const out: Action[] = [];
        controls(st, out).goTo(S.windmillGate - 1);
        return out;
      },
      () => h.top() instanceof CardScene,
      1500,
    );
    for (let i = 0; i < 40 && h.top() instanceof CardScene; i++) h.step(i % 8 === 7 ? ['jump'] : []);
    expect(lessonId(s)).toBe('windmill');
    expect(s.world.player.scratch.scrolls).toBe(1);
    expect(ninpoMax(s.world.player)).toBe(RYU_SCROLL_NINPO);
    // The box asks for the windmill's block: the scroll counts as taken.
    expect(s.director.lines().join(' ')).toBe('ANOTHER ? BLOCK!');
  });
});
