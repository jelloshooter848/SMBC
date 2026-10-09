import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { CardScene } from '@game/scenes/message';
import { Firebar } from '@game/entities/enemies/firebar';
import { T } from '@game/level/tiles';
import type { HeroStageScene } from '@game/tutorial/hero-stage';
import { SIMON_HEARTS, SIMON_LESSONS, SIMON_STAGE } from '@game/tutorial/heroes/simon';
import { LessonCandle } from '@game/tutorial/targets';
import { useStorage } from './heroes-harness';
import { simonBot } from './bots/simon';
import {
  choose,
  controls,
  heroCol,
  playStage,
  skipGreeting,
  stageMenu,
  startAtLabels,
  startStage,
} from './stage-bot';

// Simon's training stage (0.4.38, design section 7): the leather whip, 5 hearts and a 10-point
// bar, then each item from a ? block in his order, the Double and Triple Shot folded into one
// lesson. His whips are taught on wall candles just past the last whip's reach from a low wall;
// the Stopwatch freezes the fire bar he walks past.

useStorage();

const S = SIMON_STAGE;
const lessonId = (s: HeroStageScene) => s.director.lesson?.id;

describe("Simon's stage", () => {
  it('a bot plays it to the TRAINING CLEAR card in under 2:15, the box always clear of his bar', () => {
    const { h, stage } = startStage('simon');
    const s = stage();
    // The basic kit: a 10-point bar, the leather whip, no sub-weapon.
    expect([s.world.player.hp, s.world.player.scratch.maxHp]).toEqual([10, 10]);
    skipGreeting(h);
    const log = playStage(h, s, simonBot(), () => s.cleared, 8100);
    expect(s.director.done).toEqual(SIMON_LESSONS.map((l) => l.id));
    expect(log.cards).toEqual([]);
    expect(log.frames).toBeLessThan(8100);
    expect(h.top()).toBeInstanceOf(CardScene);
  });

  it('START AT lists his items in order, the Double and Triple Shot as one lesson', () => {
    const { h } = startStage('simon', { replay: true });
    expect(startAtLabels(h)).toEqual([
      'Beginning',
      'Pot Roast',
      'Chain Whip',
      'Dagger',
      'Holy Water',
      'Axe',
      'Morning Star',
      'Cross',
      'Double + Triple Shot',
      'Stopwatch',
    ]);
  });

  it('the leather whip falls short of the chain candle from the low wall; the Chain Whip reaches it', () => {
    const { h, stage } = startStage('simon', { replay: true });
    choose(h, 'Chain Whip');
    const s = stage();
    const candle = () =>
      s.world.entities.find((e): e is LessonCandle => e instanceof LessonCandle && e.lesson === 'chain-whip');
    // At the low wall with the leather whip: the candle stays lit.
    playStage(
      h,
      s,
      (st) => {
        const out: Action[] = [];
        if (controls(st, out).standAt(S.chainWall - 1)) controls(st, out).press('attack', 24);
        return out;
      },
      () => false,
      240,
    );
    expect(candle()?.alive).toBe(true);
    expect(lessonId(s)).toBe('chain-whip');
    // The block's Chain Whip, then the same crack from the same spot.
    playStage(h, s, simonBot(), () => lessonId(s) !== 'chain-whip', 900);
    expect(lessonId(s)).toBe('dagger');
    expect(heroCol(s)).toBe(S.chainWall - 1);
  });

  it('the Stopwatch stops the fire bar, and he walks past it', () => {
    const { h, stage } = startStage('simon', { replay: true });
    choose(h, 'Stopwatch');
    const s = stage();
    const bar = () => s.world.entities.find((e): e is Firebar => e instanceof Firebar && e.alive) as Firebar;
    playStage(h, s, simonBot(), () => (bar()?.stunned ?? 0) > 0, 900);
    const angle = bar().angle;
    h.idle(30);
    expect(bar().angle).toBe(angle);
    playStage(h, s, simonBot(), () => lessonId(s) !== 'stopwatch', 600);
    expect(lessonId(s)).toBe('flag');
    expect(s.world.player.hp).toBe(16);
  });

  it("walking past the fire bar unfrozen: the gate holds, and Toad's card puts him back", () => {
    const { h, stage } = startStage('simon', { replay: true });
    choose(h, 'Stopwatch');
    const s = stage();
    playStage(
      h,
      s,
      (st) => {
        const out: Action[] = [];
        controls(st, out).goTo(S.watchGate - 1);
        return out;
      },
      () => h.top() instanceof CardScene,
      1500,
    );
    expect(h.top()).toBeInstanceOf(CardScene);
    for (let i = 0; i < 40 && h.top() instanceof CardScene; i++) h.step(i % 8 === 7 ? ['jump'] : []);
    expect(lessonId(s)).toBe('stopwatch');
    expect(heroCol(s)).toBe(SIMON_LESSONS.find((l) => l.id === 'stopwatch')?.at);
  });

  it('hearts: the Dagger lesson starts at 10 and counts down; later lessons keep them at 10 or more', () => {
    const { h, stage } = startStage('simon', { replay: true });
    choose(h, 'Dagger');
    const s = stage();
    const hearts = () => s.world.player.scratch.hearts ?? 5;
    expect(hearts()).toBe(SIMON_HEARTS);
    playStage(h, s, simonBot(), () => lessonId(s) !== 'dagger', 1200);
    expect(hearts()).toBeLessThan(SIMON_HEARTS);
    // The Holy Water's lesson tops them up again.
    h.idle(2);
    expect(hearts()).toBeGreaterThanOrEqual(SIMON_HEARTS);
  });

  it('Skip this lesson gives the folded lesson both its items and opens the gate', () => {
    const { h, stage } = startStage('simon', { replay: true });
    choose(h, 'Double + Triple Shot');
    const s = stage();
    expect(lessonId(s)).toBe('shots');
    stageMenu(h, 'Skip this lesson');
    const p = s.world.player;
    expect([p.scratch['has-double-shot'], p.scratch['has-triple-shot']]).toEqual([1, 1]);
    expect(lessonId(s)).toBe('stopwatch');
    expect(s.director.closedGates).not.toContain(S.shotsGate);
    expect(s.world.map.get(S.tripleBlock.x, S.tripleBlock.y)).toBe(T.USED);
  });
});
