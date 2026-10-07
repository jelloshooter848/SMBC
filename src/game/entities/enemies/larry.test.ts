import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { px, toPx } from '@engine/math/units';
import { ScriptedInput } from '../../sim/headless';
import { World } from '../../world/world';
import { DEFAULT_ASSIST, newGameState } from '../../context';
import { MARIO } from '../../characters/mario';
import type { DamageSource } from '../../rules/damage';
import { CrystalBall } from '../objects/crystal-ball';
import { LARRY_HP, Larry, STOMP_DAMAGE, WandBlast } from './larry';

// Larry Koopa in 4-2's airship cabin (docs/HEROES.md "Larry Koopa and the crystal ball"): hops at
// the hero, now and then a high jump, wand blasts flying straight at where the hero was; three
// stomps win (fireballs and the other heroes' attacks count too); in his shell he is immune.

function cabin(invulnerable = true, power = 'big') {
  const state = { ...newGameState(MARIO), powerState: power };
  const world = new World(
    getLevel('4-2-airship'),
    {
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST, invulnerable },
      reduceFlashing: true,
    },
    state,
    { mode: 'stand', seed: 1234 },
  );
  const input = new ScriptedInput({ steps: [] });
  const step = (n = 1, hold: Parameters<ScriptedInput['setHeld']>[0] = []) => {
    for (let i = 0; i < n; i++) {
      input.setHeld(hold);
      input.next();
      world.update([input]);
    }
  };
  step(2);
  const larry = world.entities.find((e): e is Larry => e instanceof Larry) as Larry;
  return { world, step, larry, state };
}

const src = (kind: DamageSource['kind'], amount = 1): DamageSource => ({
  kind,
  amount,
  owner: null,
  dirX: 1,
});

/** Run frames until `pred` holds (at most `max`). */
function until(step: (n?: number) => void, pred: () => boolean, max = 600): void {
  for (let i = 0; i < max && !pred(); i++) step();
  expect(pred()).toBe(true);
}

describe('Larry Koopa', () => {
  it('waits on the cabin floor at the right, facing the hero', () => {
    const { larry, step } = cabin();
    expect(larry).toBeInstanceOf(Larry);
    step(20);
    expect(toPx(larry.body.y + larry.body.h)).toBe(14 * 16);
    expect(toPx(larry.body.x)).toBeGreaterThan(10 * 16);
    expect(larry.facing).toBe(-1);
    expect(larry.hp).toBe(LARRY_HP);
  });

  it('hops toward the hero, high-jumps now and then and fires wand blasts at where he was', () => {
    const { world, step, larry } = cabin();
    const p = world.player;
    let hops = 0;
    let highJumps = 0;
    let wasGround = true;
    let top = Infinity;
    const blasts = new Map<WandBlast, { vx: number; vy: number; aimX: number; aimY: number }>();
    for (let f = 0; f < 1800; f++) {
      // The hero stays put at the left (invulnerable).
      p.body.x = px(3 * 16);
      step();
      const b = larry.body;
      if (wasGround && !b.onGround) top = b.y;
      if (!b.onGround) top = Math.min(top, b.y);
      if (!wasGround && b.onGround) {
        const rise = toPx(b.y - top);
        if (rise > 40) highJumps++;
        else if (rise > 4) hops++;
      }
      wasGround = b.onGround;
      for (const e of world.entities)
        if (e instanceof WandBlast && e.alive && !blasts.has(e))
          blasts.set(e, {
            vx: e.body.vx,
            vy: e.body.vy,
            aimX: p.centerX - (e.body.x + (e.body.w >> 1)),
            aimY: p.body.y + (p.body.h >> 1) - (e.body.y + (e.body.h >> 1)),
          });
    }
    expect(hops).toBeGreaterThanOrEqual(4);
    expect(highJumps).toBeGreaterThanOrEqual(1);
    expect(blasts.size).toBeGreaterThanOrEqual(3);
    // Each ring flies in a straight line toward where the hero was when it was fired.
    for (const { vx, vy, aimX, aimY } of blasts.values()) {
      expect(Math.sign(vx)).toBe(Math.sign(aimX));
      const want = Math.atan2(aimY, aimX);
      const got = Math.atan2(vy, vx);
      expect(Math.abs(want - got)).toBeLessThan(0.15);
    }
    // He worked his way over toward the hero.
    expect(toPx(larry.body.x)).toBeLessThan(11 * 16);
  });

  it('a wand blast hurts the hero', () => {
    const { world, step, state } = cabin(false, 'big');
    const p = world.player;
    until(step, () => world.entities.some((e) => e instanceof WandBlast && e.alive), 900);
    const blast = world.entities.find((e): e is WandBlast => e instanceof WandBlast && e.alive) as WandBlast;
    p.body.x = blast.body.x;
    p.body.y = blast.body.y - px(4);
    step(2);
    expect(state.powerState === 'small' || p.powerState === 'small').toBe(true);
  });

  it('three stomps win; in his shell stomps only bounce off and other attacks do nothing', () => {
    const { world, step, larry } = cabin();
    for (let n = 1; n <= 3; n++) {
      until(step, () => !larry.inShell && larry.body.onGround && !larry.defeated);
      expect(larry.hit(src('stomp'), world)).toBe('hp');
      expect(larry.hp).toBe(LARRY_HP - n * STOMP_DAMAGE);
      if (n === 3) break;
      expect(larry.inShell).toBe(true);
      // Immune in the shell: a stomp bounces the hero off, fire and swords do nothing.
      expect(larry.hit(src('stomp'), world)).toBe('bounce');
      expect(larry.hit(src('fireball'), world)).toBe('immune');
      expect(larry.hit(src('sword'), world)).toBe('immune');
      expect(larry.hp).toBe(LARRY_HP - n * STOMP_DAMAGE);
      // He spins, then slides, then comes out.
      step(30);
      expect(larry.inShell).toBe(true);
      expect(larry.body.vx).not.toBe(0);
    }
    expect(larry.defeated).toBe(true);
    expect(larry.hit(src('fireball'), world)).toBe('immune');
  });

  it('a real stomp from above: he goes into his shell and the hero bounces', () => {
    const { world, step, larry } = cabin();
    const p = world.player;
    until(step, () => larry.body.onGround && !larry.inShell);
    p.body.x = larry.body.x;
    p.body.y = larry.body.y - p.body.h - px(6);
    p.body.vy = 0x03000;
    p.body.onGround = false;
    p.body.prevBottom = p.body.y + p.body.h;
    step(2);
    expect(larry.inShell).toBe(true);
    expect(larry.hp).toBe(LARRY_HP - STOMP_DAMAGE);
    expect(p.body.vy).toBeLessThan(0);
  });

  it('fireballs count half a stomp each (six win), with a short flash between hits', () => {
    const { world, step, larry } = cabin();
    for (let n = 1; n <= 6; n++) {
      until(step, () => larry.invuln === 0 && !larry.inShell);
      expect(larry.hit(src('fireball'), world)).toBe('hp');
      expect(larry.hp).toBe(LARRY_HP - n);
      if (n < 6) {
        expect(larry.inShell).toBe(false);
        expect(larry.hit(src('fireball'), world)).toBe('immune'); // still flashing
      }
    }
    expect(larry.defeated).toBe(true);
  });

  it("other heroes' attacks count too: a charged shot like a stomp, a sword or buster like a fireball", () => {
    const { world, step, larry } = cabin();
    expect(larry.hit(src('buster', 3), world)).toBe('hp');
    expect(larry.hp).toBe(LARRY_HP - 2);
    until(step, () => larry.invuln === 0);
    expect(larry.hit(src('sword'), world)).toBe('hp');
    until(step, () => larry.invuln === 0);
    expect(larry.hit(src('buster'), world)).toBe('hp');
    expect(larry.hp).toBe(LARRY_HP - 4);
    until(step, () => larry.invuln === 0);
    expect(larry.hit(src('boomerang'), world)).toBe('immune');
    expect(larry.hit(src('bump'), world)).toBe('immune');
  });

  it('beaten, he says BWAH!, leaves, and drops the crystal ball; touching it raises crystal-ball', () => {
    const { world, step, larry } = cabin();
    for (let n = 0; n < 3; n++) {
      until(step, () => !larry.inShell && !larry.defeated);
      larry.hit(src('stomp'), world);
    }
    expect(larry.defeated).toBe(true);
    expect(world.entities.some((e) => 'text' in e && (e as { text: string }).text === 'BWAH!')).toBe(true);
    until(step, () => world.entities.some((e) => e instanceof CrystalBall), 120);
    until(step, () => !larry.alive, 300);
    const ball = world.entities.find((e): e is CrystalBall => e instanceof CrystalBall) as CrystalBall;
    until(step, () => ball.body.onGround, 200);
    expect(toPx(ball.body.y + ball.body.h)).toBe(14 * 16);
    world.events.splice(0);
    const p = world.player;
    p.body.x = ball.body.x;
    p.body.y = ball.body.y + ball.body.h - p.body.h;
    step();
    expect(world.events).toContainEqual({ type: 'crystal-ball', player: 0, next: '4-3' });
    step(5);
    expect(world.events.filter((e) => e.type === 'crystal-ball')).toHaveLength(1);
  });
});
