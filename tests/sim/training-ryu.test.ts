import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { CardScene } from '@game/scenes/message';
import { Goomba } from '@game/entities/enemies/goomba';
import { Projectile } from '@game/entities/projectiles/projectile';
import type { HeroStageScene } from '@game/tutorial/hero-stage';
import { RYU_LESSONS, RYU_SCROLL_NINPO, RYU_STAGE } from '@game/tutorial/heroes/ryu';
import { ninpoMax } from '@game/characters/ryu';
import { useStorage } from './heroes-harness';
import { choose, controls, playStage, skipGreeting, stageMenu, startAtLabels, startStage } from './stage-bot';

// Ryu's training stage (0.4.38, design section 8): the Dragon Sword, wall cling and a 10-point
// bar, then the Medicine and each art and the Ninpo Scroll from a block in his order. Only wall
// jumps get him out of the shaft.

useStorage();

const S = RYU_STAGE;
const lessonId = (s: HeroStageScene) => s.director.lesson?.id;

/** Ryu's bot: reads the current lesson and plays it as a player would. */
export function ryuBot(): (s: HeroStageScene) => Action[] {
  let jumped = false;
  let drop = 0;
  return (s) => {
    const out: Action[] = [];
    const c = controls(s, out);
    const { w, p, b, cx } = c;
    const has = (id: string) => !!p.scratch[`has-${id}`];
    /** Up the shaft: jump at the right wall, then kick from wall to wall onto the roof. */
    const climb = (): void => {
      const feet = toPx(b.y + b.h);
      if (p.clinging) {
        // Holding on for the cling's lesson; then a fresh press kicks off (JUMP let go for a frame).
        if (!jumped && lessonId(s) === 'wall-jump') out.push('jump');
        out.push(p.facing > 0 ? 'right' : 'left');
      } else if (!b.onGround) {
        if (b.vy < 0) out.push('jump');
        // Over the roof: onto it; else on to the far wall.
        out.push(
          feet <= S.roof.top * 16 + 2 || cx > S.roof.from * 16 ? 'right' : p.facing > 0 ? 'right' : 'left',
        );
      } else if (cx < S.shaft.from * 16) out.push('right');
      else {
        out.push('right');
        if (!jumped) out.push('jump');
      }
    };
    // Holding into a block's side in a jump clings to it: let go to drop.
    const id = lessonId(s);
    if (p.clinging && id !== 'cling' && id !== 'wall-jump') drop = 16;
    if (drop > 0 && !b.onGround) {
      drop--;
      jumped = false;
      return [];
    }
    drop = 0;
    switch (id) {
      case 'slash':
        if (c.standAt(4)) c.press('attack', 8);
        break;
      case 'cling':
      case 'wall-jump':
        climb();
        break;
      case 'medicine':
        c.takeFrom(S.medicineBlock);
        break;
      case 'throwing-star':
        if (!has('throwing-star')) c.takeFrom(S.starBlock);
        else if (c.standAt(S.starTarget - 3)) c.press('special', 20);
        break;
      case 'ninpo-scroll':
        c.takeFrom(S.scrollBlock);
        break;
      case 'windmill':
        if (!has('windmill')) c.takeFrom(S.windmillBlock);
        else if (c.pick('windmill') && c.standAt(S.windmillTargets[0] - 3)) c.press('special', 60);
        break;
      case 'fire-wheel': {
        if (!has('fire-wheel')) {
          c.takeFrom(S.wheelBlock);
          break;
        }
        if (!c.pick('fire-wheel')) break;
        const flames = w.entities.some((e) => e instanceof Projectile && e.alive && e.kind === 'fire-wheel');
        if (!flames) {
          if (c.standAt(S.wheelBlock.x + 2)) c.press('special', 10);
        } else if (cx < (S.shooter - 2) * 16) out.push('right');
        break;
      }
      case 'jump-slash': {
        if (!has('jump-slash')) {
          c.takeFrom(S.spinBlock);
          break;
        }
        if (!c.pick('slash')) break;
        const g = w.entities.find(
          (e): e is Goomba => e instanceof Goomba && e.alive && toPx(e.body.x) > cx - 8,
        );
        if (!b.onGround) {
          // Spinning down onto it: cast on the way down, steering at it.
          if (b.vy > 0 && !p.scratch.spin) out.push('special');
          if (g) out.push(toPx(g.body.x) + 8 > cx ? 'right' : 'left');
          break;
        }
        if (!c.standAt(S.pipe - 5)) break;
        // A jump as it comes near.
        if (g && toPx(g.body.x) - cx < 48) out.push('jump');
        break;
      }
      default:
        // On to the flagpole: over the pipe with a jump before it (pressed into its side in the air,
        // he would cling to it), and at the pole from close by.
        if (cx < (S.flag - 3) * 16) {
          out.push('right');
          const soon = Math.floor((toPx(b.x + b.w) + 14) / 16);
          if ((b.onGround && w.map.isSolid(soon, 11)) || (!b.onGround && b.vy < 0)) out.push('jump');
        } else {
          out.push('right');
          if (b.onGround || b.vy < 0) out.push('jump');
        }
    }
    jumped = out.includes('jump');
    return out;
  };
}

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
