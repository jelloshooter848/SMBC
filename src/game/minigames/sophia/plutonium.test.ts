import { beforeEach, describe, expect, it } from 'vitest';
import { px, toPx } from '@engine/math/units';
import type { World } from '../../world/world';
import {
  BREAK_FRAMES,
  CORE_HP,
  CYCLE,
  GLOW,
  LOB_FRAMES,
  MASS_HP,
  PlutoShot,
  type PlutoniumBoss,
  SHUT,
  WAKE_AFTER,
} from './plutonium';
import { BOSS_FLOOR, bossStage, TANK_KIT, TANK_POWER } from './area';
import { LIVES, WIN_FRAMES, WIN_JINGLE } from './scene';
import { underworldHarness } from './harness';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** The Plutonium Boss's chamber, in the tank. */
function chamber(safe = true, seed?: number) {
  const h = underworldHarness({ keep: true, startInBoss: true, ...(seed !== undefined ? { seed } : {}) });
  h.game.ctx.assist.invulnerable = safe;
  const world = () => h.scene.area as World;
  const boss = () => h.scene.plutonium as PlutoniumBoss;
  const shot = (amount = 1) => boss().hit({ kind: 'buster', amount, owner: null, dirX: 1 }, world());
  return { h, world, boss, shot };
}

describe('Underworld: the Plutonium Boss (side view, in the tank)', () => {
  it('a one-screen chamber in the underworld look; it wakes a moment after the tank arrives, named and announced', () => {
    expect(bossStage().theme).toBe('underworld');
    expect(bossStage().camera).toBe('locked');
    const { h, boss } = chamber();
    expect(h.scene.phase).toBe('boss');
    expect(h.scene.area?.player.def.id).toBe('sophia');
    expect(boss().phase).toBe('asleep');
    h.step([], WAKE_AFTER + 1);
    expect(boss().phase).toBe('mass');
    expect(h.scene.banner?.lines).toEqual(['PLUTONIUM BOSS']);
    expect(h.log.music.at(-1)).toBe('bm-boss');
    expect(h.said.at(-1)).toMatch(/Plutonium Boss.*jump it.*SHOOT/);
  });

  it('phase 1: shut, shots do nothing; it glows, opens and rolls a ball along the floor; open, it is hurt', () => {
    const { h, boss, shot } = chamber();
    h.step([], WAKE_AFTER + 1);
    expect(boss().open).toBe(false);
    expect(shot(3)).toBe('immune');
    expect(boss().hp).toBe(MASS_HP);
    boss().t = SHUT + 2;
    expect(boss().glowing).toBe(true);
    boss().t = SHUT + GLOW - 1;
    h.step();
    expect(boss().open).toBe(true);
    const ball = h.scene.area!.entities.find((e) => e instanceof PlutoShot && e.shot === 'ball') as PlutoShot;
    expect(ball).toBeDefined();
    expect(toPx(ball.body.y + ball.body.h)).toBe(BOSS_FLOOR);
    const x = ball.body.x;
    h.step([], 10);
    expect(ball.body.x).toBeLessThan(x);
    expect(shot(3)).toBe('hp');
    expect(boss().hp).toBe(MASS_HP - 3);
  });

  it('its globs land where the tank stood', () => {
    const { h, boss } = chamber();
    h.step([], WAKE_AFTER);
    const p = h.scene.area!.player;
    const at = toPx(p.body.x + (p.body.w >> 1));
    boss().t = 19;
    h.step();
    const glob = h.scene.area!.entities.find((e) => e instanceof PlutoShot && e.shot === 'glob') as PlutoShot;
    expect(glob).toBeDefined();
    // Its arc comes down on the floor at the tank's middle (unless a ledge stops it first).
    const lands = toPx(glob.body.x) + glob.vx * (LOB_FRAMES - 1) + 5;
    expect(Math.abs(lands - at)).toBeLessThan(4);
  });

  it('phase 2: the mass bursts (nothing hurts, shots gone), the core rises and loops over the chamber, always open', () => {
    const { h, boss, shot } = chamber();
    h.step([], WAKE_AFTER + 1);
    boss().t = SHUT + GLOW + 1;
    boss().hp = 1;
    shot(2);
    expect(boss().phase).toBe('break');
    expect(boss().hp).toBe(CORE_HP);
    expect(h.scene.area!.entities.some((e) => e instanceof PlutoShot && e.alive)).toBe(false);
    expect(shot(2)).toBe('immune');
    h.step([], BREAK_FRAMES + 1);
    expect(boss().phase).toBe('core');
    const ys: number[] = [];
    const xs: number[] = [];
    h.step([], 100); // risen to its loop
    for (let i = 0; i < 400; i++) {
      h.step();
      ys.push(toPx(boss().body.y));
      xs.push(toPx(boss().body.x));
    }
    expect(Math.max(...ys)).toBeLessThan(BOSS_FLOOR - 64);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(100);
    boss().invuln = 0;
    expect(shot(1)).toBe('hp');
  });

  it('beaten: its banner (no spell words in a round for fun), the jingle, then pass', () => {
    for (const fun of [false, true]) {
      const { h, boss, shot } = chamber();
      h.game.inRound = fun;
      h.step([], WAKE_AFTER + 1);
      boss().phase = 'core';
      boss().hp = 1;
      shot(2);
      expect(h.scene.phase).toBe('won');
      h.step([], WIN_JINGLE + 1);
      expect(h.log.jingles).toContain('castle-clear');
      expect(h.scene.banner?.lines[0]).toBe('THE PLUTONIUM BOSS FALLS!');
      expect(h.scene.banner?.lines.length).toBe(fun ? 1 : 2);
      h.step([], WIN_FRAMES);
      expect(h.results).toEqual(['pass']);
    }
  });

  it('a life lost in the chamber starts it again with the boss whole; out of lives, GAME OVER', () => {
    const { h, boss, world } = chamber(false);
    h.step([], WAKE_AFTER + 1);
    const first = boss();
    first.hp = 3;
    world().kill(world().player);
    for (let i = 0; i < 400 && h.scene.plutonium === first; i++) h.step();
    expect(h.scene.lives).toBe(LIVES - 1);
    expect(boss()).not.toBe(first);
    expect(boss().hp).toBe(MASS_HP);
    expect(h.scene.phase).toBe('boss');
  });

  it('keeps to its own fight clock: fights in worlds of different seeds play the same', () => {
    const run = (seed: number) => {
      const { h, boss } = chamber(true, seed);
      const out: string[] = [];
      for (let i = 0; i < CYCLE * 2; i++) {
        h.step();
        out.push(
          `${boss().body.x},${boss().body.y},${h.scene.area!.entities.filter((e) => e instanceof PlutoShot).length}`,
        );
      }
      return out;
    };
    expect(run(1)).toEqual(run(0x5eed));
  });

  it('a life lost in the chamber starts the next with the round’s kit: Hyper and 8 homing missiles', () => {
    const { h, world } = chamber(false);
    h.step([], WAKE_AFTER + 1);
    const p = world().player;
    expect(p.powerState).toBe(TANK_POWER);
    // Spend missiles, take a hit (Hyper to Normal), then lose the life.
    for (let i = 0; i < 3; i++) {
      h.tap('special');
      h.step([], 30);
    }
    expect(p.scratch.homing).toBeLessThan(TANK_KIT.homing as number);
    world().hurtPlayer(p, 1);
    expect(p.powerState).toBe('small');
    p.invuln = 0;
    world().hurtPlayer(p, 1);
    expect(p.dead).toBe(true);
    const old = world();
    for (let i = 0; i < 400 && h.scene.area === old; i++) h.step();
    const q = world().player;
    expect(q).not.toBe(p);
    expect(q.powerState).toBe(TANK_POWER);
    expect(q.scratch.hasHoming).toBe(1);
    expect(q.scratch.homing).toBe(TANK_KIT.homing);
  });

  it('the cannon, fired level from the floor, hits the open mass', () => {
    const { h, boss } = chamber();
    h.step([], WAKE_AFTER + 1);
    boss().t = SHUT + GLOW; // open
    const hp = boss().hp;
    h.step(['right']); // facing it
    for (let i = 0; i < 60; i++) h.step(i % 8 === 0 ? ['attack'] : []);
    expect(boss().hp).toBeLessThan(hp);
  });

  it('the raised cannon hits the core over the tank', () => {
    const { h, boss, world } = chamber();
    h.step([], WAKE_AFTER + 1);
    const b = boss();
    b.phase = 'core';
    b.hp = CORE_HP;
    b.body.w = px(32);
    b.body.h = px(32);
    // Held over the tank (its own loop stopped for the test).
    Object.assign(b, { update: () => undefined });
    const p = world().player;
    b.body.x = p.body.x + (p.body.w >> 1) - px(16);
    b.body.y = px(96);
    const reactions: string[] = [];
    const hit = b.hit.bind(b);
    b.hit = (src, w) => {
      const r = hit(src, w);
      reactions.push(r);
      return r;
    };
    h.step(['up'], 12); // the cannon rises
    for (let i = 0; i < 60; i++) h.step(i % 8 === 0 ? ['up', 'attack'] : ['up']);
    expect(reactions).toContain('hp');
    expect(b.hp).toBeLessThan(CORE_HP);
  });
});
