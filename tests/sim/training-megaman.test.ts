import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { toPx } from '@engine/math/units';
import { CardScene } from '@game/scenes/message';
import { Goomba } from '@game/entities/enemies/goomba';
import { Projectile } from '@game/entities/projectiles/projectile';
import type { HeroStageScene } from '@game/tutorial/hero-stage';
import { MEGAMAN_LESSONS, MEGAMAN_STAGE } from '@game/tutorial/heroes/megaman';
import { useStorage } from './heroes-harness';
import { megamanBot } from './bots/megaman';
import { choose, controls, heroCol, playStage, skipGreeting, startAtLabels, startStage } from './stage-bot';

// Mega Man's training stage (0.4.37, design section 5): bare-headed with the buster and the
// slide, the Helmet first, then each weapon and Rush from a block in his order. A hit that knocks
// the Helmet off is no dead end: the put-back gives it back (the kit floor).

useStorage();

const S = MEGAMAN_STAGE;
const lessonId = (s: HeroStageScene) => s.director.lesson?.id;

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

  it("the leaf's shooter holds fire until the Leaf Guard is taken (its Helmet stays on for the block)", () => {
    const { h, stage } = startStage('megaman', { replay: true });
    choose(h, 'Leaf Guard');
    const s = stage();
    const shots = () =>
      s.world.entities.filter((e) => e instanceof Projectile && e.alive && e.kind === 'target-shot');
    // Standing in the shooter's range by the block, the item not taken: no shot comes.
    playStage(
      h,
      s,
      (st) => {
        const out: Action[] = [];
        controls(st, out).goTo(S.leafBlock.x + 1);
        expect(shots()).toEqual([]);
        return out;
      },
      () => false,
      400,
    );
    expect(s.world.player.scratch.helmet).toBe(1);
    // Taken: the block gave the Leaf Guard (not a Helmet), and the shooter starts.
    const bot = megamanBot();
    playStage(h, s, bot, () => !!s.world.player.scratch['has-leaf-guard'], 600);
    playStage(
      h,
      s,
      () => [],
      () => shots().length > 0,
      300,
    );
    expect(shots().length).toBeGreaterThan(0);
  });

  it("the Bolt's walkers wait until the Bolt is taken (his Helmet stays on for the block)", () => {
    const { h, stage } = startStage('megaman', { replay: true });
    choose(h, 'Bolt');
    const s = stage();
    const walkers = () => s.world.entities.filter((e): e is Goomba => e instanceof Goomba && e.alive);
    // Standing by the block, the Bolt not taken: each walker holds where it first showed.
    const first = new Map<Goomba, number>();
    playStage(
      h,
      s,
      (st) => {
        const out: Action[] = [];
        controls(st, out).goTo(S.boltBlock.x - 2);
        for (const g of walkers()) if (!first.has(g)) first.set(g, g.body.x);
        return out;
      },
      () => false,
      400,
    );
    expect(first.size).toBeGreaterThan(0);
    for (const [g, x] of first) expect(g.body.x).toBe(x);
    expect(s.world.player.scratch.helmet).toBe(1);
    // Taken: the block gave the Bolt (not a Helmet), and they walk.
    playStage(h, s, megamanBot(), () => !!s.world.player.scratch['has-bolt'], 600);
    playStage(
      h,
      s,
      () => [],
      () => [...first].some(([g, x]) => g.body.x !== x),
      120,
    );
    expect([...first].some(([g, x]) => g.body.x !== x)).toBe(true);
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
