import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { CardScene } from '@game/scenes/message';
import { draw } from './heroes-harness';
import type { HeroStageScene } from '@game/tutorial/hero-stage';
import { SAMUS_LESSONS, SAMUS_STAGE } from '@game/tutorial/heroes/samus';
import { stageWatch } from '@game/tutorial/targets';
import { useStorage } from './heroes-harness';
import { samusBot } from './bots/samus';
import { choose, controls, playStage, skipGreeting, startAtLabels, startStage } from './stage-bot';

// Samus's training stage (0.4.37, design section 6): the short beam, aiming up, the morph ball and
// a bomb jump, then the Energy Tank, the Long Beam, Missiles, the Ice Beam, the Varia Suit (a hit
// costs 4, not 8) and the Wave Beam, each from a block in her order.

useStorage();

const S = SAMUS_STAGE;
const lessonId = (s: HeroStageScene) => s.director.lesson?.id;

describe("Samus's stage", () => {
  it('a bot plays it to the TRAINING CLEAR card in under two minutes, the box always clear', () => {
    const { h, stage } = startStage('samus');
    const s = stage();
    expect(s.world.player.scratch.tanks).toBeUndefined();
    skipGreeting(h);
    const log = playStage(h, s, samusBot(), () => s.cleared, 7200);
    expect(s.director.done).toEqual(SAMUS_LESSONS.map((l) => l.id));
    expect(log.cards).toEqual([]);
    // Her pickups on the way, each explained once (0.4.46).
    expect(log.explained).toEqual(['samus:energy-small', 'samus:missile-pack', 'samus:energy-large']);
    expect(log.frames).toBeLessThan(7200);
    expect(h.top()).toBeInstanceOf(CardScene);
  });

  it('a Varia hit costs 4 energy, and the box says so beside what it was', () => {
    const { h, stage } = startStage('samus', { replay: true });
    expect(startAtLabels(h)).toEqual([
      'Beginning',
      'Energy Tank',
      'Long Beam',
      'Missiles',
      'Ice Beam',
      'Varia Suit',
      'Wave Beam',
    ]);
    choose(h, 'Varia Suit');
    const s = stage();
    const bot = samusBot();
    let note: string[] = [];
    playStage(
      h,
      s,
      (st) => {
        const texts = draw(st).texts.map((t) => t.str);
        if (texts.some((t) => t.includes('EN (WAS'))) note = texts;
        return bot(st);
      },
      () => lessonId(s) !== 'varia-suit',
      1500,
    );
    const costs = stageWatch(s.world).hurts.map((x) => x.cost);
    expect(costs.length).toBeGreaterThan(0);
    expect(costs.every((c) => c === 4)).toBe(true);
    expect(note).toContain('-4 EN (WAS -8)');
  });

  it('the wave beam goes through the closed wall; the plain beam does not', () => {
    const { h, stage } = startStage('samus', { replay: true });
    choose(h, 'Wave Beam');
    const s = stage();
    const bot = samusBot();
    // The plain beam at the wall: no hit on the target inside.
    playStage(
      h,
      s,
      (st) => {
        const out: Action[] = [];
        const c = controls(st, out);
        if (c.standAt(S.box.from - 3)) c.press('attack', 15);
        return out;
      },
      () => false,
      300,
    );
    expect(lessonId(s)).toBe('wave-beam');
    playStage(h, s, bot, () => lessonId(s) !== 'wave-beam', 900);
    expect(s.director.done).toContain('wave-beam');
  });
});
