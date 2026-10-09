import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { CardScene } from '@game/scenes/message';
import { Goomba } from '@game/entities/enemies/goomba';
import { draw } from './heroes-harness';
import type { HeroStageScene } from '@game/tutorial/hero-stage';
import { SAMUS_LESSONS, SAMUS_STAGE } from '@game/tutorial/heroes/samus';
import { stageWatch } from '@game/tutorial/targets';
import { useStorage } from './heroes-harness';
import { choose, controls, playStage, skipGreeting, startAtLabels, startStage } from './stage-bot';

// Samus's training stage (0.4.37, design section 6): the short beam, aiming up, the morph ball and
// a bomb jump, then the Energy Tank, the Long Beam, Missiles, the Ice Beam, the Varia Suit (a hit
// costs 4, not 8) and the Wave Beam, each from a block in her order.

useStorage();

const S = SAMUS_STAGE;
const lessonId = (s: HeroStageScene) => s.director.lesson?.id;

/** Samus's bot: reads the current lesson and plays it as a player would. */
export function samusBot(): (s: HeroStageScene) => Action[] {
  return (s) => {
    const out: Action[] = [];
    const c = controls(s, out);
    const { w, p, b, cx } = c;
    const ball = !!p.scratch.ball;
    const has = (id: string) => !!p.scratch[`has-${id}`];
    /** Out of the ball first (UP stands her up where there is room). */
    const stand = (): boolean => {
      if (!ball) return true;
      if ((w.frame & 3) === 0) out.push('up');
      else out.push('right');
      return false;
    };
    /** An enemy ahead within `range` px, this side of the next gate. */
    const enemyAhead = (range: number): boolean => {
      const gate = Math.min(...s.director.closedGates.map((g) => g * 16), Infinity);
      return w.entities.some(
        (e) =>
          e instanceof Goomba &&
          e.alive &&
          toPx(e.body.x) > cx &&
          toPx(e.body.x) - cx < range &&
          toPx(e.body.x) < gate,
      );
    };
    switch (lessonId(s)) {
      case 'beam':
        if (c.standAt(4) && enemyAhead(70)) c.press('attack', 8);
        break;
      case 'aim-up':
        if (c.goTo(S.hanging, 3)) {
          out.push('up');
          c.press('attack', 8);
        }
        break;
      case 'morph-ball':
        if (!ball) {
          if (c.goTo(S.tunnel.from - 2, 4)) c.press('down', 6);
          break;
        }
        out.push('right');
        break;
      case 'bomb-jump':
        if (!ball) {
          if (c.goTo(S.tunnel.from - 2, 4)) c.press('down', 6);
          break;
        }
        out.push('right');
        // Against the step: a bomb under the ball.
        if (b.onGround && toPx(b.x + b.w) >= S.step.from * 16 - 1 && Math.abs(b.vx) < 0x100)
          c.press('attack', 50);
        break;
      case 'energy-tank':
        if (!stand()) break;
        c.takeFrom(S.tankBlock);
        break;
      case 'long-beam':
        if (!stand()) break;
        if (!has('long-beam')) {
          c.takeFrom(S.longBlock);
          break;
        }
        if (c.standAt(S.ditch.from - 1)) c.press('attack', 10);
        break;
      case 'missiles':
        if (!has('missiles')) {
          if (stand()) c.takeFrom(S.missileBlock);
          break;
        }
        if (w.map.isSolid(S.wall.x, S.wall.brick)) {
          if (stand() && c.standAt(S.wall.x - 2)) c.press('special', 20);
          break;
        }
        // The brick is open: roll through.
        if (!ball) {
          if (c.goTo(S.wall.x - 1, 3)) c.press('down', 6);
          break;
        }
        out.push('right');
        break;
      case 'ice-beam':
        if (!stand()) break;
        if (!has('ice-beam')) {
          c.takeFrom(S.iceBlock);
          break;
        }
        if (!c.pick('ice')) break;
        // The enemy got past: on to the gate, where Toad puts her back with a fresh one.
        if (!enemyAhead(200)) {
          out.push('right');
          break;
        }
        if (c.standAt(76) && enemyAhead(150)) c.press('attack', 12);
        break;
      case 'varia-suit':
        if (!stand()) break;
        if (!p.scratch.varia) {
          c.takeFrom(S.variaBlock);
          break;
        }
        // Stand and let the enemy walk into her.
        c.standAt(S.variaBlock.x + 2);
        break;
      case 'wave-beam':
        if (!stand()) break;
        if (!has('wave-beam')) {
          c.takeFrom(S.waveBlock);
          break;
        }
        if (c.pick('wave') && c.standAt(S.box.from - 3)) c.press('attack', 15);
        break;
      default:
        if (!stand()) break;
        // Over the closed wall (a hop), then a jump at the flagpole.
        if (b.onGround && cx >= (S.flag - 3) * 16) out.push('right', 'jump');
        else if (!b.onGround) out.push('right', ...(b.vy < 0 ? (['jump'] as const) : []));
        else c.goTo(S.flag + 2);
    }
    return out;
  };
}

describe("Samus's stage", () => {
  it('a bot plays it to the TRAINING CLEAR card in under two minutes, the box always clear', () => {
    const { h, stage } = startStage('samus');
    const s = stage();
    expect(s.world.player.scratch.tanks).toBeUndefined();
    skipGreeting(h);
    const log = playStage(h, s, samusBot(), () => s.cleared, 7200);
    expect(s.director.done).toEqual(SAMUS_LESSONS.map((l) => l.id));
    expect(log.cards).toEqual([]);
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
