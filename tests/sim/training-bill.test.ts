import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { CardScene } from '@game/scenes/message';
import type { HeroStageScene } from '@game/tutorial/hero-stage';
import { BILL_LESSONS, BILL_STAGE, heldShots } from '@game/tutorial/heroes/bill';
import { lessonTargets } from '@game/tutorial/heroes/common';
import { stageWatch } from '@game/tutorial/targets';
import { useStorage } from './heroes-harness';
import { choose, controls, playStage, skipGreeting, startAtLabels, startStage } from './stage-bot';

// Bill's training stage (0.4.38, design section 9): the rifle, 8-way aim, prone and 3 hits, then
// a Medal and each falcon gun from a block in his order. The Laser's one beam pierces two targets.

useStorage();

const S = BILL_STAGE;
const lessonId = (s: HeroStageScene) => s.director.lesson?.id;

/** Bill's bot: reads the current lesson and plays it as a player would. */
export function billBot(): (s: HeroStageScene) => Action[] {
  return (s) => {
    const out: Action[] = [];
    const c = controls(s, out);
    const { p, b, cx } = c;
    const has = (id: string) => !!p.scratch[`has-${id}`];
    switch (lessonId(s)) {
      case 'rifle':
        if (c.standAt(4)) c.press('attack', 10);
        break;
      case 'aim': {
        const [up] = lessonTargets(s.world, 'aim');
        // Under the high target, aiming straight up; then up and ahead, walking on under the ledge.
        if (up && up.taken === 0) {
          if (c.goTo(S.upTarget, 2)) {
            out.push('up');
            c.press('attack', 8);
          }
        } else if (cx < S.upTarget * 16 + 60) {
          out.push('right', 'up');
          c.press('attack', 8);
        } else c.goTo(S.upTarget + 1);
        break;
      }
      case 'prone':
        if (c.standAt(S.turret - 4)) out.push('down');
        break;
      case 'shoot-down':
        if (!b.onGround) {
          out.push('right', 'down');
          c.press('attack', 4);
        } else if (cx < (S.ditch.from - 1) * 16) c.goTo(S.ditch.from - 1);
        else out.push('right', 'jump');
        break;
      case 'medal':
        c.takeFrom(S.medalBlock);
        break;
      case 'machine-gun':
        if (!has('machine-gun')) c.takeFrom(S.gunBlock);
        else if (c.standAt(S.gunBlock.x + 2)) out.push('attack');
        break;
      case 'laser':
        if (!has('laser')) c.takeFrom(S.laserBlock);
        else if (c.standAt(S.laserTargets[0] - 3)) c.press('attack', 20);
        break;
      case 'flame-gun':
        if (!has('flame-gun')) c.takeFrom(S.flameBlock);
        else if (c.standAt(S.toughTarget - 3)) c.press('attack', 15);
        break;
      case 'spread-gun':
        if (!has('spread-gun')) c.takeFrom(S.spreadBlock);
        else if (c.standAt(S.spreadTargets[0] - 8)) c.press('attack', 20);
        break;
      default:
        if (cx < (S.flag - 3) * 16) c.goTo(S.flag);
        else {
          out.push('right');
          if (b.onGround || b.vy < 0) out.push('jump');
        }
    }
    return out;
  };
}

describe("Bill's stage", () => {
  it('a bot plays it to the TRAINING CLEAR card in under two minutes, the box always clear of his bar', () => {
    const { h, stage } = startStage('bill');
    const s = stage();
    expect(s.world.player.hp).toBe(3);
    skipGreeting(h);
    const log = playStage(h, s, billBot(), () => s.cleared, 7200);
    expect(s.director.done).toEqual(BILL_LESSONS.map((l) => l.id));
    expect(log.cards).toEqual([]);
    expect(log.frames).toBeLessThan(7200);
    expect(h.top()).toBeInstanceOf(CardScene);
  });

  it('START AT lists his items in order', () => {
    const { h } = startStage('bill', { replay: true });
    expect(startAtLabels(h)).toEqual([
      'Beginning',
      'Medal',
      'Machine Gun',
      'Laser',
      'Flame Gun',
      'Spread Gun',
    ]);
  });

  it("the Laser's one beam hits both targets in a row; the rifle's shot stops at the first", () => {
    const { h, stage } = startStage('bill', { replay: true });
    choose(h, 'Laser');
    const s = stage();
    const shotAt = (st: HeroStageScene, out: Action[]) => {
      if (controls(st, out).standAt(S.laserTargets[0] - 3)) controls(st, out).press('attack', 20);
      return out;
    };
    // The rifle (before the block): the near target only.
    playStage(
      h,
      s,
      (st) => shotAt(st, []),
      () => false,
      240,
    );
    const hits = () => stageWatch(s.world).hits.filter((x) => x.shotKind !== null);
    expect(new Set(hits().map((x) => x.target)).size).toBe(1);
    expect(lessonId(s)).toBe('laser');
    // The Laser: one beam, both targets.
    playStage(h, s, billBot(), () => lessonId(s) !== 'laser', 900);
    const beams = new Map<unknown, Set<unknown>>();
    for (const x of hits().filter((y) => y.shotKind === 'laser')) {
      if (!beams.has(x.shot)) beams.set(x.shot, new Set());
      beams.get(x.shot)?.add(x.target);
    }
    expect([...beams.values()].some((t) => t.size === 2)).toBe(true);
  });

  it("the Machine Gun's bar fills over one hold; taps don't fill it", () => {
    const { h, stage } = startStage('bill', { replay: true });
    choose(h, 'Machine Gun');
    const s = stage();
    playStage(h, s, billBot(), () => !!s.world.player.scratch['has-machine-gun'], 900);
    // Taps, well apart: one shot each.
    playStage(
      h,
      s,
      (st) => {
        const out: Action[] = [];
        if (controls(st, out).standAt(S.gunBlock.x + 2)) controls(st, out).press('attack', 30);
        return out;
      },
      () => false,
      300,
    );
    expect(heldShots(s.world)).toBeLessThan(3);
    expect(lessonId(s)).toBe('machine-gun');
    // Held: the bar fills.
    playStage(
      h,
      s,
      () => ['attack'],
      () => lessonId(s) !== 'machine-gun',
      300,
    );
    expect(s.director.done).toContain('machine-gun');
  });

  it('standing at the turret, its shots hit him; prone, they fly over', () => {
    const { h, stage } = startStage('bill');
    const s = stage();
    skipGreeting(h);
    for (let i = 0; i < 2; i++) {
      h.idle(2);
      h.tap('start');
      choose(h, 'Skip this lesson');
    }
    expect(lessonId(s)).toBe('prone');
    const hp = s.world.player.hp;
    playStage(
      h,
      s,
      (st) => {
        const out: Action[] = [];
        controls(st, out).standAt(S.turret - 4);
        return out;
      },
      () => s.world.player.hp < hp,
      400,
    );
    expect(s.world.player.hp).toBeLessThan(hp);
    playStage(h, s, billBot(), () => lessonId(s) !== 'prone', 900);
    expect(lessonId(s)).toBe('shoot-down');
    expect(toPx(s.world.player.centerX)).toBeLessThan(S.turret * 16);
  });
});
