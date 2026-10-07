import { beforeEach, describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { ScriptedInput } from '@game/sim/headless';
import type { MenuItem } from '@game/scenes/menu';
import { ROUND_GIVE_UP_HINT } from '@game/minigames/menu';
import { TILE } from '../../topdown/geometry';
import { SOPHIA_MINIGAME } from '.';
import { soundId } from './art';
import { CUTSCENE_FRAMES, fredPose, jasonPose, LEAP_AT, TOUCH_AT } from './cutscene';
import { newUnderworld, UNDERWORLD_ROOMS } from './dungeon';
import {
  CAPSULE_LIFE,
  Capsule,
  GRENADE_RADIUS,
  GUN_LEVELS,
  GUN_START,
  GUN_TABLE,
  Grenade,
  JasonShot,
  POW_CAPSULE,
  POW_MAX,
  gunLevel,
  type UnderworldWorld,
} from './jason';
import { Blob, EYE_EVERY, EYE_GLARE, Eye, Orb, TURRET_AIM, TURRET_TURN, Turret } from './mutants';
import { BREAK_FRAMES, CORE_HP, CYCLE, GLOW, Guardian, SHELL_HP, SHUT } from './guardian';
import {
  GAME_OVER_FRAMES,
  LIVES,
  RESPAWN_DELAY,
  RETURN_FRAMES,
  UnderworldMenuScene,
  WIN_FRAMES,
  WIN_JINGLE,
} from './scene';
import { JasonBot, UNDERWORLD_PLAN } from './bot';
import { botRun, underworldHarness } from './harness';
import { SHARP } from './bot';

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** A dungeon world on its own with a stepper. */
function world() {
  const w = newUnderworld({ seed: 7 });
  w.events.length = 0;
  const input = new ScriptedInput({ steps: [] });
  const step = (held: Action[] = [], n = 1) => {
    const out: { type: string; [k: string]: unknown }[] = [];
    for (let i = 0; i < n; i++) {
      input.setHeld(held);
      input.next();
      w.update(input);
      out.push(...w.events.splice(0));
    }
    return out;
  };
  return { w, step, jason: w.jason };
}

/** Clears the room of mutants (and their shots) so a test sees only what it sets up. */
function empty(w: UnderworldWorld): void {
  for (const e of w.entities) if (e.enemy || e instanceof Orb) e.dead = true;
  w.entities = w.entities.filter((e) => !e.dead);
}

describe('Underworld: the mini game', () => {
  it('frees Sophia: a title, and rules naming abilities (no button letters), each within 26 columns', () => {
    expect(SOPHIA_MINIGAME.hero).toBe('sophia');
    expect(SOPHIA_MINIGAME.title).toBe('UNDERWORLD');
    for (const l of SOPHIA_MINIGAME.rules) expect(l.length, l).toBeLessThanOrEqual(26);
    expect(SOPHIA_MINIGAME.rules.join(' ')).toMatch(/SHOOT/);
    expect(SOPHIA_MINIGAME.rules.join(' ')).not.toMatch(/\b[ABXYZ] BUTTON\b|\(Z\)|\(X\)/);
  });
});

describe('Underworld: Jason overhead', () => {
  it('walks eight ways: holding two directions moves him on both axes, facing the one pressed last', () => {
    const { w, step, jason } = world();
    empty(w);
    jason.x = 3 * TILE;
    jason.y = 4 * TILE;
    const x = jason.x;
    const y = jason.y;
    step(['up']);
    step(['up', 'right'], 8);
    expect(jason.x).toBeGreaterThan(x);
    expect(jason.y).toBeLessThan(y - 8);
    expect(jason.facing).toBe('right');
  });

  it('has the original’s GUN meter: 8 levels, each one longer, wider or stronger; the top goes through walls', () => {
    // (the wave at 5 is one shot again, swinging wider than the double shot's pair)
    expect(GUN_TABLE).toHaveLength(GUN_LEVELS);
    expect(GUN_LEVELS).toBe(8);
    const power = (l: number) => {
      const g = gunLevel(l);
      return [g.range, g.pellets, g.wave, g.damage, g.size, g.through ? 1 : 0];
    };
    for (let l = 2; l <= 8; l++) {
      const [a, b] = [power(l - 1), power(l)];
      expect(
        b.some((v, i) => v > (a[i] as number)),
        `level ${l} adds something`,
      ).toBe(true);
      expect(b[0] as number, `level ${l} reaches as far`).toBeGreaterThanOrEqual(a[0] as number);
      expect(b[3] as number, `level ${l} hits as hard`).toBeGreaterThanOrEqual(a[3] as number);
    }
    expect(gunLevel(3).pellets).toBe(2); // the double shot
    expect(gunLevel(5).wave).toBeGreaterThan(0); // the wave
    expect(gunLevel(8).through).toBe(true);
    expect(gunLevel(0)).toBe(gunLevel(1));
    expect(gunLevel(99)).toBe(gunLevel(8));
  });

  it('SHOOT fires along his facing: a low gun is short, the top one flies through a block', () => {
    const { w, step, jason } = world();
    w.warpTo('hall', 3 * TILE, 5 * TILE);
    empty(w);
    jason.facing = 'right';
    jason.gun = 1;
    step(['attack']);
    const short = w.entities.find((e): e is JasonShot => e instanceof JasonShot);
    expect(short).toBeDefined();
    step([], 30);
    expect(short?.dead).toBe(true);
    expect(short?.flown).toBeLessThanOrEqual(gunLevel(1).range + 4);
    // From under the hall's blocks, up: the level-8 wave goes through, a level-4 shot stops.
    jason.x = 5 * TILE;
    jason.y = 5 * TILE;
    jason.facing = 'up';
    jason.gun = 4;
    step([], 12);
    step(['attack']);
    const stopped = w.entities.filter((e): e is JasonShot => e instanceof JasonShot);
    step([], 10);
    expect(stopped.every((s) => s.dead && s.flown < 3 * TILE)).toBe(true);
    jason.gun = 8;
    step([], 12);
    step(['attack']);
    const through = w.entities.filter((e): e is JasonShot => e instanceof JasonShot);
    step([], 14);
    expect(through.some((s) => s.flown >= 3 * TILE)).toBe(true);
  });

  it('every hit he takes drops the GUN a level (never below 1) and costs POW; the no-damage assist keeps both', () => {
    let safe = false;
    const w = newUnderworld({ seed: 3, noDamage: () => safe });
    const j = w.jason;
    expect(j.gun).toBe(GUN_START);
    expect([j.hp, j.maxHp]).toEqual([POW_MAX, POW_MAX]);
    j.gun = 5;
    expect(j.hurt(w, 1, 'down')).toBe(true);
    expect([j.gun, j.hp]).toEqual([4, POW_MAX - 1]);
    j.invuln = 0;
    j.gun = 1;
    j.hurt(w, 2, 'down');
    expect([j.gun, j.hp]).toEqual([1, POW_MAX - 3]);
    safe = true;
    j.invuln = 0;
    j.gun = 6;
    j.hurt(w, 2, 'down');
    expect([j.gun, j.hp]).toEqual([6, POW_MAX - 3]);
  });

  it('G capsules raise the GUN (up to 8), P capsules give POW back; dropped ones do not last', () => {
    const { w, step, jason } = world();
    empty(w);
    jason.gun = 7;
    w.grant('gun');
    w.grant('gun');
    expect(jason.gun).toBe(8);
    jason.hp = 2;
    w.grant('pow');
    expect(jason.hp).toBe(2 + POW_CAPSULE);
    const c = new Capsule(2 * TILE, 2 * TILE, 'gun', CAPSULE_LIFE);
    w.add(c);
    step([], CAPSULE_LIFE + 1);
    expect(c.dead).toBe(true);
    // Placed ones (the gateway room's G) stay until taken.
    expect(w.entities.some((e) => e instanceof Capsule && e.kind === 'gun')).toBe(true);
  });

  it('grenades: SPECIAL throws one along his facing, as many as he likes; it blasts mutants, never him', () => {
    const { w, step, jason } = world();
    empty(w);
    jason.x = 3 * TILE;
    jason.y = 5 * TILE;
    jason.facing = 'right';
    const blob = new Blob(5 * TILE, 5 * TILE);
    Object.assign(blob, { think: () => undefined });
    w.add(blob);
    const hp = jason.hp;
    for (let i = 0; i < 6; i++) {
      step(['special']);
      expect(w.entities.some((e) => e instanceof Grenade) || i > 0).toBe(true);
      step([], 40);
    }
    expect(blob.dead).toBe(true);
    expect(jason.hp).toBe(hp);
    expect(jason.invuln).toBe(0);
    expect(GRENADE_RADIUS).toBeGreaterThan(TILE);
  });

  it('a grenade breaks the crossing’s cracked wall, opening the cache', () => {
    const { w, step, jason } = world();
    w.warpTo('crossing', TILE, 5 * TILE);
    empty(w);
    expect(w.doorOpen('w')).toBe(false);
    jason.facing = 'left';
    const ev = step(['special']);
    ev.push(...step([], 30));
    expect(ev.some((e) => e.type === 'secret')).toBe(true);
    expect(w.doorOpen('w')).toBe(true);
  });
});

describe('Underworld: the mutants', () => {
  it('an eye glares (stands still) for EYE_GLARE frames, then spits an orb at Jason', () => {
    const { w, step } = world();
    empty(w);
    const eye = new Eye(8 * TILE, 2 * TILE, 0);
    w.add(eye);
    step([], EYE_EVERY - EYE_GLARE - 1);
    expect(eye.glaring).toBe(false);
    step();
    expect(eye.glaring).toBe(true);
    const at = { x: eye.x, y: eye.y };
    step([], EYE_GLARE - 2);
    expect({ x: eye.x, y: eye.y }).toEqual(at);
    expect(w.entities.some((e) => e instanceof Orb)).toBe(false);
    const ev = step([], 2);
    expect(ev.some((e) => e.type === 'spit')).toBe(true);
    expect(w.entities.some((e) => e instanceof Orb)).toBe(true);
  });

  it('a turret fires only when its barrel comes round to Jason, after aiming', () => {
    const { w, step, jason } = world();
    empty(w);
    jason.x = 2 * TILE;
    jason.y = 5 * TILE;
    const t = new Turret(10 * TILE, 5 * TILE, 0); // pointing up; Jason is to its left
    w.add(t);
    let fired = 0;
    for (let i = 0; i < 4 * TURRET_TURN + TURRET_AIM; i++) {
      const before = w.entities.filter((e) => e instanceof Orb).length;
      step();
      if (w.entities.filter((e) => e instanceof Orb).length > before) {
        fired++;
        expect(t.pointing).toBe('left');
      }
    }
    expect(fired).toBe(1);
  });

  it('a blob creeps at Jason in bursts', () => {
    const { w, step, jason } = world();
    empty(w);
    jason.x = 2 * TILE;
    jason.y = 5 * TILE;
    const b = new Blob(10 * TILE, 5 * TILE, 0);
    w.add(b);
    step([], 60);
    expect(b.x).toBeLessThan(10 * TILE - 16);
    const x = b.x;
    step([], 10); // resting
    expect(b.x).toBe(x);
  });
});

describe('Underworld: the dungeon', () => {
  it('eight rooms from the gateway to the way out; the cache is behind a cracked wall; only the guardian’s room seals', () => {
    const w = newUnderworld();
    expect(w.dungeon.rooms.size).toBe(UNDERWORLD_ROOMS.length);
    expect(w.room.id).toBe('gate');
    expect(w.dungeon.rooms.get('crossing')?.doors.w).toBe('cracked');
    const shutters = [...w.dungeon.rooms.values()].filter((r) => Object.values(r.doors).includes('shutter'));
    expect(shutters.map((r) => r.id)).toEqual(['guardian']);
    expect(w.dungeon.rooms.get('guardian')?.spawns.some((s) => s.kind === 'guardian')).toBe(true);
    expect(w.inv.current?.id).toBe('grenade');
  });
});

describe('Underworld: the dungeon’s guardian', () => {
  function boss() {
    const { w, step, jason } = world();
    w.warpTo('guardian', TILE, 5 * TILE);
    const b = w.entities.find((e): e is Guardian => e instanceof Guardian) as Guardian;
    return { w, step, jason, b };
  }

  it('sleeps until Jason steps in; the shutter closes behind him', () => {
    const { w, step, b } = boss();
    expect(b.phase).toBe('asleep');
    expect(b.hurt(w, 5, 'up')).toBe(false);
    const ev = step(['right'], 20);
    expect(ev.some((e) => e.type === 'boss-wakes')).toBe(true);
    expect(w.shuttersShut()).toBe(true);
    expect(b.phase).toBe('shell');
  });

  it('phase 1: shut, shots clang off; it glows, opens with a ring of orbs, and only then can be hurt', () => {
    const { w, step, b } = boss();
    step(['right'], 20);
    b.t = 10;
    const ev: { type: string }[] = [];
    expect(b.open).toBe(false);
    expect(b.hurt(w, 3, 'up')).toBe(false);
    expect(b.hp).toBe(SHELL_HP);
    b.invuln = 0;
    b.t = SHUT + 1;
    expect(b.glowing).toBe(true);
    b.t = SHUT + GLOW - 1;
    ev.push(...step());
    expect(b.cycle).toBe(SHUT + GLOW);
    expect(ev.some((e) => e.type === 'boss-open')).toBe(true);
    expect(w.entities.filter((e) => e instanceof Orb).length).toBeGreaterThanOrEqual(8);
    expect(b.open).toBe(true);
    expect(b.hurt(w, 3, 'up')).toBe(true);
    expect(b.hp).toBe(SHELL_HP - 3);
  });

  it('phase 2: the shell cracks (orbs gone, nothing hurts for a while), then the core bounces and can be beaten', () => {
    const { w, step, b } = boss();
    step(['right'], 20);
    b.t = SHUT + GLOW + 1;
    b.hp = 2;
    b.hurt(w, 3, 'up');
    expect(b.phase).toBe('break');
    expect(b.hp).toBe(CORE_HP);
    expect(w.entities.some((e) => e instanceof Orb && !e.dead)).toBe(false);
    expect(b.hurt(w, 3, 'up')).toBe(false);
    step([], BREAK_FRAMES + 1);
    expect(b.phase).toBe('core');
    const at = { x: b.x, y: b.y };
    step([], 20);
    expect(b.x).not.toBe(at.x);
    expect(b.y).not.toBe(at.y);
    b.invuln = 0;
    b.hp = 1;
    const ev = [] as { type: string; kind?: unknown }[];
    b.hurt(w, 1, 'up');
    ev.push(...w.events.splice(0));
    expect(b.dead).toBe(true);
    expect(ev.some((e) => e.type === 'kill' && e.kind === 'guardian')).toBe(true);
  });

  it('keeps to its own fight clock: two fights with different dice play the same', () => {
    const run = (seed: number) => {
      const w = newUnderworld({ seed });
      w.warpTo('guardian', TILE, 5 * TILE);
      const input = new ScriptedInput({ steps: [] });
      const trace: string[] = [];
      for (let i = 0; i < CYCLE * 2; i++) {
        input.setHeld(i < 20 ? ['right'] : []);
        input.next();
        w.update(input);
        const b = w.entities.find((e) => e instanceof Guardian) as Guardian;
        w.hero.invuln = 99;
        trace.push(`${b.x},${b.y},${w.entities.filter((e) => e instanceof Orb).length}`);
      }
      return trace;
    };
    expect(run(1)).toEqual(run(99));
  });
});

/** Every string the scene draws in one frame. */
function drawn(h: ReturnType<typeof underworldHarness>): string[] {
  const out: string[] = [];
  const r: Renderer = Object.assign(new NullRenderer(), {
    text: (...args: Parameters<Renderer['text']>) => void out.push(args[1]),
  });
  h.game.scenes.render(r);
  return out;
}

describe('Underworld: the round', () => {
  it('opens on the cutscene (skippable with JUMP or SHOOT, announced with how to skip), then the dungeon', () => {
    const h = underworldHarness({ keep: true });
    expect(h.scene.phase).toBe('cutscene');
    expect(h.said[0]).toMatch(/Fred.*chest.*hole/);
    expect(h.said[0]).toMatch(/JUMP.*skips/);
    expect(h.log.music).toContain('bm-cutscene');
    expect(h.scene.touchLabels()).toMatchObject({ jump: 'SKIP', start: 'MENU' });
    h.step([], 10);
    expect(drawn(h)).toEqual(expect.arrayContaining([expect.stringMatching(/^SKIP/)]));
    h.tap('attack');
    expect(h.scene.phase).toBe('dungeon');
    expect(h.log.music.at(-1)).toBe('bm-dungeon');
    expect(h.said.at(-1)).toMatch(/SHOOT.*gun.*GRENADE/);
    expect(h.scene.touchLabels()).toMatchObject({
      attack: 'SHOOT',
      special: 'GRENADE',
      start: 'MENU',
      jump: null,
    });
    // Untouched, the cutscene ends by itself.
    const h2 = underworldHarness({ keep: true });
    h2.step([], CUTSCENE_FRAMES);
    expect(h2.scene.phase).toBe('dungeon');
  });

  it('the cutscene: Fred hops to the chest, swells, leaps down the hole; Jason runs after him', () => {
    expect(fredPose(0)).not.toBeNull();
    expect(fredPose(TOUCH_AT + 40)?.frame).toBe('fred-big');
    expect(fredPose(LEAP_AT + 10)).not.toBeNull();
    expect(fredPose(CUTSCENE_FRAMES - 1)).toBeNull();
    expect(jasonPose(0)).toBeNull();
    expect(jasonPose(240)).not.toBeNull();
    expect(jasonPose(CUTSCENE_FRAMES - 1)).toBeNull();
  });

  it('the menu: Continue, or Give up ends the round as quit, once', () => {
    const h = underworldHarness({ keep: true, skipCutscene: true });
    h.tap('start');
    const menu = h.game.scenes.top as UnderworldMenuScene;
    expect(menu).toBeInstanceOf(UnderworldMenuScene);
    const items = (menu as unknown as { items: MenuItem[] }).items;
    expect(items.map((i) => i.label)).toEqual(['Continue', 'Give up']);
    expect(items[1]?.hint).toMatch(/Sophia stays under the spell/);
    items[1]?.select?.();
    expect(h.results).toEqual(['quit']);
    h.step([], 5);
    expect(h.results).toEqual(['quit']);
    // In a round for fun, Give up only ends the round.
    const h2 = underworldHarness({ keep: true, skipCutscene: true });
    h2.game.inRound = true;
    h2.tap('start');
    const items2 = (h2.game.scenes.top as unknown as { items: MenuItem[] }).items;
    expect(items2[1]?.hint).toBe(ROUND_GIVE_UP_HINT);
  });

  it('three lives: Jason comes back at the doorway he came in by; out of lives, GAME OVER, then fail', () => {
    const h = underworldHarness({ keep: true, skipCutscene: true });
    const td = h.td;
    expect(h.scene.lives).toBe(LIVES);
    td.warpTo('hall', 0, 5 * TILE);
    h.step();
    h.step(['right'], 30);
    const kill = () => {
      td.hero.invuln = 0;
      td.hero.hurt(td, 99, 'down');
      for (let i = 0; i < 400 && (td.hero.dying || td.hero.dead); i++) h.step();
    };
    kill();
    expect(h.scene.lives).toBe(LIVES - 1);
    expect(td.room.id).toBe('hall');
    expect([td.hero.x, td.hero.y]).toEqual([0, 5 * TILE]);
    expect(td.hero.hp).toBe(td.hero.maxHp);
    expect(h.said.at(-1)).toMatch(/1 life left|lives left/);
    kill();
    expect(h.said.at(-1)).toMatch(/Last life/);
    td.hero.invuln = 0;
    td.hero.hurt(td, 99, 'down');
    h.step([], 200 + RESPAWN_DELAY);
    expect(h.scene.phase).toBe('lost');
    expect(drawn(h)).toContain('GAME OVER');
    h.step([], GAME_OVER_FRAMES);
    expect(h.results).toEqual(['fail']);
  });

  it('with the Infinite lives assist a fall costs no life', () => {
    const h = underworldHarness({ keep: true, skipCutscene: true });
    h.game.ctx.assist.infiniteLives = true;
    h.td.hero.hurt(h.td, 99, 'down');
    h.step([], 200 + RESPAWN_DELAY);
    expect(h.scene.lives).toBe(LIVES);
    expect(h.scene.phase).toBe('dungeon');
  });

  it('the guardian falls: its banner, the doors open, and the way out east leads Jason back to the tank', () => {
    const h = underworldHarness({ keep: true, skipCutscene: true, tankHero: null });
    h.td.warpTo('guardian', TILE, 5 * TILE);
    h.step(['right'], 20);
    expect(h.log.music.at(-1)).toBe('bm-boss');
    expect(drawn(h)).toContain('THE GUARDIAN');
    expect(h.said.at(-1)).toMatch(/guardian/);
    expect(h.td.doorOpen('e')).toBe(false);
    const g = h.scene.guardian as Guardian;
    g.phase = 'core';
    g.hp = 1;
    g.hurt(h.td, 5, 'up');
    h.step([], 5);
    expect(drawn(h)).toContain('THE GUARDIAN FALLS!');
    expect(h.said.join(' ')).toMatch(/way back to Sophia is open/);
    expect(h.log.music.at(-1)).toBe('bm-dungeon');
    expect(h.td.doorOpen('e')).toBe(true);
    expect(h.scene.phase).toBe('dungeon');
    // The corridor up to the way out.
    h.td.warpTo('exit', 7.5 * TILE, 2 * TILE);
    h.step(['up'], 40);
    expect(h.scene.phase).toBe('return');
    expect(drawn(h)).toEqual(expect.arrayContaining(['JASON RUNS BACK']));
    expect(h.scene.touchLabels().attack ?? null).toBeNull();
  });

  it('without the tank (no Sophia def yet) the round passes once Jason is back with Sophia (no spell words for fun)', () => {
    for (const fun of [false, true]) {
      const h = underworldHarness({ keep: true, skipCutscene: true, tankHero: null });
      h.game.inRound = fun;
      h.td.warpTo('exit', 7.5 * TILE, 2 * TILE);
      h.step(['up'], 40);
      h.step([], RETURN_FRAMES + WIN_JINGLE + 1);
      expect(h.scene.phase).toBe('won');
      expect(h.log.jingles).toContain('castle-clear');
      const lines = drawn(h);
      expect(lines).toContain('JASON IS BACK WITH SOPHIA!');
      expect(lines.includes('THE SPELL ON SOPHIA BREAKS!')).toBe(!fun);
      h.step([], WIN_FRAMES);
      expect(h.results).toEqual(['pass']);
    }
  });

  it('sounds: S3’s where they exist, stock ones otherwise (never unknown)', () => {
    expect(soundId('shot')).toBe('jason-shot');
    expect(soundId('grenade')).toBe('grenade');
    expect(soundId('die')).toBe('mutant-die');
    expect(soundId('shot', new Set())).toBe('buster');
  });

  it('draws without its art (boxes) and with reduce flashing, without throwing', () => {
    const h = underworldHarness({ keep: true });
    for (let i = 0; i < CUTSCENE_FRAMES; i += 37) {
      h.step([], 37);
      expect(() => drawn(h)).not.toThrow();
    }
    h.tap('jump');
    h.td.warpTo('guardian', TILE, 5 * TILE);
    h.step(['right'], 60);
    expect(() => drawn(h)).not.toThrow();
  });
});

describe('Underworld: the bot', () => {
  it('a sharp player gets through the dungeon and beats the boss without dying', () => {
    const r = botRun(SHARP);
    expect(r.result).toBe('pass');
    expect(r.deaths).toEqual([]);
    expect(r.rooms).toEqual(
      expect.arrayContaining(['gate', 'hall', 'turrets', 'crossing', 'cache', 'ante', 'guardian']),
    );
  }, 60_000);

  it('plays through the same inputs a player has (a JasonBot alone works on the world it sees)', () => {
    const bot = new JasonBot(UNDERWORLD_PLAN);
    const w = newUnderworld();
    const out = bot.next(w);
    for (const a of out) expect(['up', 'down', 'left', 'right', 'attack', 'special']).toContain(a);
  });
});
