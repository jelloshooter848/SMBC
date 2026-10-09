import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { CardScene } from '@game/scenes/message';
import { Goomba } from '@game/entities/enemies/goomba';
import { RushCoil } from '@game/entities/objects/rush-coil';
import { Projectile } from '@game/entities/projectiles/projectile';
import type { HeroStageScene } from '@game/tutorial/hero-stage';
import { MEGAMAN_LESSONS, MEGAMAN_STAGE } from '@game/tutorial/heroes/megaman';
import { useStorage } from './heroes-harness';
import { choose, controls, heroCol, playStage, skipGreeting, startAtLabels, startStage } from './stage-bot';

// Mega Man's training stage (0.4.37, design section 5): bare-headed with the buster and the
// slide, the Helmet first, then each weapon and Rush from a block in his order. A hit that knocks
// the Helmet off is no dead end: the put-back gives it back (the kit floor).

useStorage();

const S = MEGAMAN_STAGE;
const lessonId = (s: HeroStageScene) => s.director.lesson?.id;

/** Mega Man's bot: reads the current lesson and plays it as a player would. */
export function megamanBot(): (s: HeroStageScene) => Action[] {
  let charge = 0;
  let sawAt = -1;
  return (s) => {
    const out: Action[] = [];
    const c = controls(s, out);
    const { w, p, b, cx } = c;
    const has = (id: string) => !!p.scratch[`has-${id}`];
    switch (lessonId(s)) {
      case 'shoot':
        if (c.standAt(4)) c.press('attack', 10);
        break;
      case 'slide':
        if (cx < S.tunnel.from * 16 - 40) out.push('right');
        else if (b.onGround && p.sliding === 0) {
          out.push('down');
          if (p.facing < 0) out.push('right');
          else c.press('jump', 4);
        } else out.push('right');
        break;
      case 'helmet':
        c.takeFrom(S.helmetBlock);
        break;
      case 'charge':
        if (!c.standAt(33)) break;
        charge++;
        if (charge % 70 < 55) out.push('attack');
        break;
      case 'bricks': {
        const brick = w.map.isSolid(43, S.roof.top);
        if (!b.onGround) {
          // Through the hole, then onto the roof.
          if (toPx(b.y + b.h) < S.roof.top * 16 - 2) out.push('right');
          if (b.vy < 0) out.push('jump');
          break;
        }
        if (toPx(b.y + b.h) <= S.roof.top * 16) break;
        if (c.goTo(43, 2)) c.press('jump', brick ? 6 : 4);
        break;
      }
      case 'saw':
        if (!has('saw-disc')) {
          c.takeFrom(S.sawBlock);
          break;
        }
        if (!c.standAt(53)) break;
        if (sawAt < 0 || w.frame - sawAt > 60) {
          out.push('up', 'right', 'special');
          sawAt = w.frame;
        }
        break;
      case 'leaf': {
        if (!has('leaf-guard')) {
          c.takeFrom(S.leafBlock);
          break;
        }
        if (!c.pick('leaf')) break;
        const orbiting = w.entities.some((e) => e instanceof Projectile && e.alive && e.kind === 'leaf');
        if (!orbiting) {
          if (b.onGround) c.press('special', 10);
          break;
        }
        if (cx < (S.shooter - 3) * 16) out.push('right');
        break;
      }
      case 'rush': {
        if (!has('rush-coil')) {
          c.takeFrom(S.rushBlock);
          break;
        }
        const coil = w.entities.find((e): e is RushCoil => e instanceof RushCoil && e.alive);
        if (!b.onGround) {
          if (b.vy < 0) out.push('jump');
          // Launched: over the wall's top, then onto it.
          if (toPx(b.y + b.h) < S.wall.top * 16 - 2) out.push('right');
          else if (coil && !coil.springing) {
            const dx = toPx(coil.body.x + (coil.body.w >> 1)) - cx;
            if (Math.abs(dx) > 2) out.push(dx > 0 ? 'right' : 'left');
          }
          break;
        }
        if (!c.pick('rush')) break;
        if (!coil) {
          if (c.standAt(79)) c.press('special', 10);
          break;
        }
        // Hop up onto him.
        c.press('jump', 6);
        break;
      }
      case 'flame':
        if (!has('flame-wave')) {
          c.takeFrom(S.flameBlock);
          break;
        }
        if (c.pick('flame') && c.standAt(S.trench.from - 1)) c.press('special', 40);
        break;
      case 'knuckle':
        if (!has('homing-knuckle')) {
          c.takeFrom(S.knuckleBlock);
          break;
        }
        if (c.pick('knuckle') && c.standAt(106)) c.press('special', 50);
        break;
      case 'bolt': {
        if (!has('bolt')) {
          c.takeFrom(S.boltBlock);
          break;
        }
        if (!c.pick('bolt') || !c.standAt(119)) break;
        // Fire once two enemies are close together ahead.
        const near = w.entities.filter(
          (e) => e instanceof Goomba && e.alive && toPx(e.body.x) - cx < 150 && toPx(e.body.x) > cx,
        );
        if (near.length >= 2) c.press('special', 20);
        break;
      }
      default:
        out.push('right');
        if (b.onGround && cx >= (S.flag - 3) * 16) out.push('jump');
        else if (!b.onGround && b.vy < 0) out.push('jump');
    }
    return out;
  };
}

describe("Mega Man's stage", () => {
  it('a bot plays it to the TRAINING CLEAR card in under two minutes, the box always clear of his bars', () => {
    const { h, stage } = startStage('megaman');
    const s = stage();
    expect(s.world.player.scratch.helmet).toBeUndefined();
    skipGreeting(h);
    const log = playStage(h, s, megamanBot(), () => s.cleared, 7200);
    expect(s.director.done).toEqual(MEGAMAN_LESSONS.map((l) => l.id));
    expect(log.cards).toEqual([]);
    expect(log.frames).toBeLessThan(7200);
    expect(h.top()).toBeInstanceOf(CardScene);
  });

  it('START AT lists his items in order; the Helmet comes back at a put-back after a hit took it', () => {
    const { h, stage } = startStage('megaman', { replay: true });
    expect(startAtLabels(h)).toEqual([
      'Beginning',
      'Helmet',
      'Saw Disc',
      'Leaf Guard',
      'Rush Coil',
      'Flame Wave',
      'Homing Knuckle',
      'Bolt',
    ]);
    choose(h, 'Saw Disc');
    const s = stage();
    expect(s.world.player.scratch.helmet).toBe(1);
    // A hit knocks it off...
    s.world.hurtPlayer(s.world.player);
    expect(s.world.player.scratch.helmet).toBe(0);
    // ...and at the gate Toad's card puts him back with it on.
    playStage(
      h,
      s,
      () => ['right'],
      () => h.top() instanceof CardScene,
      900,
    );
    expect(heroCol(s)).toBe(S.sawGate - 1);
    h.idle(40);
    h.tap('jump');
    expect(s.world.player.scratch.helmet).toBe(1);
    expect(lessonId(s)).toBe('saw');
  });

  it('only the slide gets under the low wall, and only Rush gets up the tall one', () => {
    const { h, stage } = startStage('megaman', { replay: true });
    choose(h, 'Rush Coil');
    const s = stage();
    // Jumping at the tall wall never gets him up.
    playStage(
      h,
      s,
      (st) => (heroCol(st) < S.wall.from - 1 ? ['right'] : ['right', 'jump']),
      () => false,
      300,
    );
    expect(lessonId(s)).toBe('rush');
    expect(toPx(s.world.player.body.y + s.world.player.body.h)).toBeGreaterThan(S.wall.top * 16);
  });
});
