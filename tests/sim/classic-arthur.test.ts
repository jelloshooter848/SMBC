import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { px } from '@engine/math/units';
import { Rng } from '@engine/rng';
import { defaultSettings } from '@engine/save/settings';
import { parseTextMap } from '@game/level/textmap';
import type { LevelData } from '@game/level/schema';
import { T } from '@game/level/tiles';
import { CHARACTERS, CLASSIC_EXTRAS, heroFor } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import {
  ARTHUR_CLASSIC,
  ARTHUR_CLASSIC_PROFILE,
  ARTHUR_JUMP,
  ARTHUR_WALK,
  POT_RATE,
  THROW_ROOT,
  arthurPotDrop,
  weaponOf,
} from '@game/characters/arthur/classic';
import {
  ARTHUR_WEAPONS,
  ArthurBolt,
  AXE,
  BOLT_AHEAD,
  FIRE_FRAMES,
  FIRE_REHIT,
  LANCE,
  MAGIC_WINDUP,
  TorchFire,
  WEAPONS,
} from '@game/characters/arthur/classic-weapons';
import { CLASSIC_HIT_RESPONSES } from '@game/characters/classic/power';
import { CLASSIC_SWIM } from '@game/rules/classic-swim';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import type { Enemy } from '@game/entities/enemies/enemy';
import { Projectile } from '@game/entities/projectiles/projectile';
import { Pickup } from '@game/entities/objects/pickup';
import { Spring } from '@game/entities/objects/spring';
import { BrickPiece } from '@game/entities/effects/effects';
import type { CharacterSelectScene } from '@game/scenes/character-select';
import { fontText } from '@game/hud/text';
import { PALETTES, SPRITES } from '@content/sprites';
import { Rig, flatLevel, measureJump } from './classic-plumber-harness';
import { makeGame, useStorage } from './heroes-harness';
import { isolateClassicRegistry } from './classic-registry';

// Sir Arthur, a Classic-only hero (bug-reports/2026-10-19-arthur-build-classic-character.md,
// AR-1..AR-31, owner-approved with every recommended D-AR answer): the report's acceptance checks
// with rules 'classic', his roster rules (TG-41), the guide (TG-40) and Campaign unchanged (TG-38).

useStorage();
isolateClassicRegistry();

const A = ARTHUR_CLASSIC;
const SUB = 256;

function rig(power = 'small', kit: Record<string, number> = {}, level: LevelData = flatLevel()): Rig {
  const r = new Rig(A, level, 'classic', power);
  Object.assign(r.p.scratch, kit);
  r.settle();
  return r;
}
const shots = (r: Rig, kind?: string) =>
  r.world.entities.filter(
    (e): e is Projectile => e instanceof Projectile && e.alive && (!kind || e.kind === kind),
  );
const dead = (e: Enemy) => (e.classicHp ?? 1) <= 0 || !e.alive;
/** An enemy held still with its left edge `ahead` px in front of his centre, on the floor. */
function place<E extends Enemy>(r: Rig, e: E, ahead: number): E {
  e.body.x = r.p.centerX + px(ahead);
  e.body.y = r.p.feetY - e.body.h;
  e.stopFrames = 10000;
  r.world.spawn(e);
  return e;
}
/** Presses `action` (with `hold`) once, then `after` frames holding `hold`. */
function tap(r: Rig, action: Action, after = 0, hold: Action[] = []): void {
  r.step([...hold, action]);
  for (let i = 0; i < after; i++) r.step(hold);
}

describe('definition and roster (AR-1..AR-3, TG-41)', () => {
  it('a Classic-only def, never a Campaign hero; not in SMBC 3.1.21', () => {
    expect(A.id).toBe('arthur');
    expect(A.name).toBe('Arthur');
    expect(A.hudName).toBe('ARTHUR');
    expect(A.rules).toBe('classic');
    expect(A.notInOriginal).toBe(true);
    expect(A.stomps).toBe(false);
    expect(A.crouches).toBe(true);
    expect(A.powerIcon).toBe(true);
    expect(A.music).toBeUndefined();
    expect(A.tools).toBeUndefined();
    expect(A.meter).toBeUndefined();
    expect(A.blockDrop).toBeUndefined();
    expect(CLASSIC_EXTRAS).toContain(A);
    expect(CLASSIC_EXTRAS.indexOf(A)).toBeGreaterThan(CLASSIC_EXTRAS.findIndex((c) => c.id === 'warriors'));
    expect(CHARACTERS).not.toContain(A);
    expect(CHARACTERS.some((c) => c.id === 'arthur')).toBe(false);
    expect(heroFor(A, 'classic')).toBe(A);
    expect(fontText(A.hudName)).toBe(A.hudName);
    for (const w of ARTHUR_WEAPONS) {
      const label = A.hudExtra?.({ scratch: { weapon: ARTHUR_WEAPONS.indexOf(w) } } as never) ?? '';
      expect(fontText(label)).toBe(label);
    }
  });

  it('in Classic runs only: never under Campaign or in a campaign', () => {
    const h = makeGame({ dev: true });
    expect(h.game.rosterFor('campaign')).not.toContain(A);
    expect(h.game.rosterFor('classic')).toContain(A);
    expect(h.game.roster).not.toContain(A);
  });

  it('an expansion hero: on the Classic select only with Options > Expansion heroes on', () => {
    // O-12: the Expansion heroes row is developer mode's until a hero is released.
    // 0.4.72 (owner): the release build's select leaves Arthur out; dev mode's select shows every
    // hero Toggle heroes does not set Off, released or not.
    const off = { ...defaultSettings(), classicRules: 'classic' as const, dev: false };
    const h0 = makeGame({ deps: { settings: off, applySettings: () => {} } });
    h0.game.classicSelect('1-1', () => h0.game.showClassicMenu());
    expect((h0.top() as CharacterSelectScene).chars).not.toContain(A);
    const settings = { ...defaultSettings(), classicRules: 'classic' as const, dev: true };
    const h = makeGame({ deps: { settings, applySettings: () => {} } });
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    expect((h.top() as CharacterSelectScene).chars).toContain(A);
    settings.classic.expansion = 'on';
    // O-06: in dev mode an unreleased Expansion hero shows only with Dev > Classic heroes' On.
    settings.classicDev.heroesOn = ['arthur'];
    h.game.classicSelect('1-1', () => h.game.showClassicMenu());
    const sel = h.top() as CharacterSelectScene;
    // After the original's eleven heroes.
    expect(sel.chars.indexOf(A)).toBeGreaterThanOrEqual(10);
  });

  it('hitbox 12 x 24, crouched 12 x 16, the same in every state (AR-3)', () => {
    for (const power of ['small', 'big', 'fire']) {
      const r = rig(power);
      expect([r.p.body.w / SUB, r.p.body.h / SUB]).toEqual([12, 24]);
      r.step(['down']);
      expect([r.p.body.w / SUB, r.p.body.h / SUB]).toEqual([12, 16]);
    }
  });

  it('Campaign heroes are unchanged: none sets notInOriginal (TG-23, TG-38)', () => {
    for (const c of CHARACTERS) {
      expect(c.notInOriginal, c.id).toBeUndefined();
      expect(heroFor(c, 'campaign')).toBe(c);
    }
    expect(CLASSIC_HIT_RESPONSES.arthur).toBeDefined();
    expect(CLASSIC_SWIM.arthur).toBeDefined();
  });
});

describe('movement and the committed jump (AR-5..AR-7)', () => {
  it('walks 1.25 px/f at once, no run', () => {
    const r = rig();
    r.step(['right']);
    expect(r.p.body.vx).toBe(ARTHUR_WALK);
    r.step(['right', 'attack']);
    r.step(['right']);
    expect(ARTHUR_CLASSIC_PROFILE.canRun).toBe(false);
  });

  it('standing jump: apex 67-69 px, lands on frame 52 ± 1; a tap jumps as high (fixed arc)', () => {
    const held = measureJump(A, 0, Infinity);
    expect(held.apex).toBeGreaterThanOrEqual(67);
    expect(held.apex).toBeLessThanOrEqual(69);
    expect(Math.abs(held.airtime - 52)).toBeLessThanOrEqual(1);
    const tap2 = measureJump(A, 0, 2);
    expect(tap2.apex).toBe(held.apex);
    expect(tap2.airtime).toBe(held.airtime);
  });

  it('committed: a jump to the right holding Left all the way keeps vx and facing', () => {
    const r = rig();
    r.step(['right']);
    r.step(['right', 'jump']);
    expect(r.p.body.onGround).toBe(false);
    for (let i = 0; i < 80 && !r.p.body.onGround; i++) {
      r.step(['left']);
      if (r.p.body.onGround) break;
      expect(r.p.body.vx).toBe(ARTHUR_WALK);
      expect(r.p.facing).toBe(1);
    }
    // A standing jump goes straight up and down.
    const s = rig();
    s.step(['jump']);
    for (let i = 0; i < 60 && !s.p.body.onGround; i++) {
      expect(s.p.body.vx).toBe(0);
      s.step(['right']);
    }
  });

  it('second jump at the apex with Left held: full take-off, vx -1.25 px/f, facing left; a third press does nothing', () => {
    const r = rig();
    r.step(['right']);
    r.step(['right', 'jump']);
    r.until(() => r.p.body.vy >= 0, [], 60);
    r.step(['left', 'jump']);
    // The take-off moves the body, then gravity is added (the shared order).
    expect(r.p.body.vy).toBe(-ARTHUR_JUMP + ARTHUR_CLASSIC_PROFILE.jump[0]!.holdGravity);
    expect(r.p.body.vx).toBe(-ARTHUR_WALK);
    expect(r.p.facing).toBe(-1);
    r.step(['left']);
    const vy = r.p.body.vy;
    r.step(['right', 'jump']);
    expect(r.p.body.vy).toBe(vy + ARTHUR_CLASSIC_PROFILE.jump[0]!.holdGravity);
    expect(r.p.body.vx).toBe(-ARTHUR_WALK);
    expect(r.p.facing).toBe(-1);
  });
});

describe('springs (AR-7, AR-9)', () => {
  it('no second jump on the way up of a spring launch; it is back from the apex', () => {
    const r = rig();
    const sp = new Spring(8, 12);
    r.world.spawn(sp);
    const p = r.p;
    p.body.x = sp.body.x + (sp.body.w >> 1) - (p.body.w >> 1);
    p.body.y = sp.body.y - p.body.h - px(20);
    p.body.onGround = false;
    p.body.vy = 0;
    r.until(() => p.launched, [], 60);
    expect(p.launched).toBe(true);
    r.step([]);
    const vy = p.body.vy;
    r.step(['jump']);
    expect(p.body.vy).toBeGreaterThan(vy);
    r.until(() => !p.launched, [], 200);
    r.step([]);
    r.step(['jump']);
    expect(p.body.vy).toBe(-ARTHUR_JUMP + ARTHUR_CLASSIC_PROFILE.jump[0]!.holdGravity);
  });
});

describe('throws (AR-8..AR-14)', () => {
  it('a ground throw roots him for 12 frames (AR-8)', () => {
    const r = rig();
    const x0 = r.p.body.x;
    r.step(['right', 'attack']);
    for (let i = 1; i < THROW_ROOT; i++) r.step(['right']);
    expect(r.p.body.x).toBe(x0);
    r.step(['right']);
    expect(r.p.body.x).toBeGreaterThan(x0);
  });

  it('he starts with the lance; two on screen, a third press does nothing (AR-10, AR-11, AR-13)', () => {
    const r = rig();
    expect(weaponOf(r.p)).toBe('lance');
    tap(r, 'attack', 12);
    tap(r, 'attack', 12);
    expect(shots(r, LANCE.kind)).toHaveLength(2);
    tap(r, 'attack');
    expect(shots(r, LANCE.kind)).toHaveLength(2);
    // Too soon after a throw: lost, not buffered.
    const q = rig();
    tap(q, 'attack', 3);
    tap(q, 'attack', 20);
    expect(shots(q, LANCE.kind)).toHaveLength(1);
  });

  it('a lance kills a Goomba in one (standing or crouched), a Koopa in two', () => {
    for (const hold of [[], ['down']] as Action[][]) {
      const r = rig();
      const g = place(r, new Goomba(0, 0), 30);
      r.step(hold);
      tap(r, 'attack', 20, hold);
      expect(dead(g)).toBe(true);
    }
    const k = rig();
    const koopa = place(k, new Koopa(0, 0, 'green'), 30);
    tap(k, 'attack', 20);
    expect(dead(koopa)).toBe(false);
    tap(k, 'attack', 20);
    expect(dead(koopa)).toBe(true);
  });

  it('a Buzzy Beetle blocks a steel lance; a pipe ends it; a plain brick breaks', () => {
    const r = rig();
    const buzzy = place(r, new Koopa(0, 0, 'buzzy'), 30);
    tap(r, 'attack', 20);
    expect(buzzy.classicHp ?? 600).toBe(600);
    expect(shots(r, LANCE.kind)).toHaveLength(0);
    // A pipe at throw height (the floor top is row 13: rows 11-12 above it).
    const p = rig('small', {}, flatLevel({ 11: '..........[]', 12: '..........{}' }));
    tap(p, 'attack', 60);
    expect(shots(p, LANCE.kind)).toHaveLength(0);
    expect(p.world.map.get(10, 11)).not.toBe(T.AIR);
    const b = rig('small', {}, flatLevel({ 12: '.........=' }));
    tap(b, 'attack', 40);
    expect(b.world.map.get(9, 12)).toBe(T.AIR);
  });

  it('the axe passes a pipe and kills two Goombas in a line (AR-11)', () => {
    // Where the axe flies over 40 frames, from a dry run.
    const dry = rig('small', {}, flatLevel({ 11: '..........[]', 12: '..........{}' }, 200));
    dry.p.scratch.weapon = ARTHUR_WEAPONS.indexOf('axe');
    tap(dry, 'attack');
    const axe = shots(dry, AXE.kind)[0] as Projectile;
    const path: { x: number; y: number }[] = [];
    for (let i = 0; i < 60; i++) {
      dry.step([]);
      path.push({ x: axe.body.x, y: axe.body.y });
    }
    expect(axe.body.x).toBeGreaterThan(px(12 * 16));
    const r = rig('small', {}, flatLevel({ 11: '..........[]', 12: '..........{}' }, 200));
    r.p.scratch.weapon = ARTHUR_WEAPONS.indexOf('axe');
    const goombas = [path[40]!, path[50]!].map((at) => {
      const g = new Goomba(at.x, at.y);
      g.stopFrames = 10000;
      r.world.spawn(g);
      return g;
    });
    tap(r, 'attack', 60);
    for (const g of goombas) expect(dead(g)).toBe(true);
  });

  it('the torch lands and burns 73 f; 150 a touch every 24 f through a Buzzy armour, 4 touches (AR-12)', () => {
    const dry = rig();
    dry.p.scratch.weapon = ARTHUR_WEAPONS.indexOf('torch');
    tap(dry, 'attack');
    dry.until(() => dry.world.entities.some((e) => e instanceof TorchFire), [], 120);
    const fire = dry.world.entities.find((e): e is TorchFire => e instanceof TorchFire) as TorchFire;
    expect(fire).toBeDefined();
    let life = 0;
    while (fire.alive && life < 200) {
      dry.step([]);
      life++;
    }
    expect(Math.abs(life - FIRE_FRAMES)).toBeLessThanOrEqual(1);

    const r = rig();
    r.p.scratch.weapon = ARTHUR_WEAPONS.indexOf('torch');
    const buzzy = new Koopa(fire.body.x, r.p.feetY - px(14), 'buzzy');
    buzzy.stopFrames = 10000;
    r.world.spawn(buzzy);
    const hp: number[] = [];
    tap(r, 'attack');
    for (let i = 0; i < 120; i++) {
      r.step([]);
      const now = buzzy.classicHp ?? 600;
      if (now !== (hp.at(-1) ?? 600)) hp.push(now);
    }
    // The torch itself is blocked by the armour (steel, pierce 0); the fire pierces: four
    // touches in its 73 frames (0, 24, 48, 72) finish the Buzzy Beetle (600).
    expect(hp.slice(0, 3)).toEqual([450, 300, 150]);
    expect(dead(buzzy)).toBe(true);
    expect(FIRE_REHIT).toBe(24);
    expect(FIRE_FRAMES).toBeGreaterThanOrEqual(73);
  });

  it('Down + Attack in the air throws straight down (AR-14)', () => {
    const r = rig();
    r.step(['jump']);
    for (let i = 0; i < 10; i++) r.step([]);
    tap(r, 'attack', 0, ['down']);
    const lance = shots(r, LANCE.kind)[0] as Projectile;
    expect(lance.body.vx).toBe(0);
    expect(lance.body.vy).toBe(LANCE.speed);
    expect(lance.body.h).toBe(px(16));
  });

  it('an air throw does not change the arc', () => {
    const a = rig();
    const b = rig();
    a.step(['right']);
    b.step(['right']);
    a.step(['right', 'jump']);
    b.step(['right', 'jump']);
    for (let i = 0; i < 10; i++) {
      a.step([]);
      b.step(i === 3 ? ['attack'] : []);
    }
    expect(b.p.body.x).toBe(a.p.body.x);
    expect(b.p.body.y).toBe(a.p.body.y);
    expect(shots(b, LANCE.kind)).toHaveLength(1);
  });
});

describe('power states (AR-15..AR-19)', () => {
  it('boxers + hit: dead, a heap of bones', () => {
    const r = rig();
    r.world.hurtPlayer(r.p, 1);
    expect(r.p.dead).toBe(true);
    expect(A.sprite(r.p, 0, true).frame).toBe('bones');
  });

  it('Steel + hit: boxers with the push, the armour bursts, the weapon stays', () => {
    const r = rig('big', { weapon: ARTHUR_WEAPONS.indexOf('dagger') });
    expect(A.sprite(r.p, 0, true).frame).toBe('stand');
    r.world.hurtPlayer(r.p, 1);
    expect(r.p.dead).toBe(false);
    expect(r.p.powerState).toBe('small');
    expect(r.p.hurtLock).not.toBeNull();
    expect(r.p.body.vy).toBeLessThan(0);
    expect(weaponOf(r.p)).toBe('dagger');
    expect(r.world.entities.filter((e) => e instanceof BrickPiece)).toHaveLength(4);
    expect(A.sprite(r.p, 0, true).frame).toBe('boxers-hurt');
    r.until(() => !r.p.hurtLock, [], 120);
    expect(A.sprite(r.p, 0, true).frame).toBe('boxers-stand');
  });

  it('Gold + hit: straight to boxers (Lose Everything)', () => {
    const r = rig('fire');
    r.world.hurtPlayer(r.p, 1);
    expect(r.p.powerState).toBe('small');
  });

  it('Gold: the lance passes a Buzzy armour and deals 400', () => {
    const r = rig('fire');
    const buzzy = place(r, new Koopa(0, 0, 'buzzy'), 30);
    tap(r, 'attack', 20);
    expect(buzzy.classicHp).toBe(200);
    expect(WEAPONS.lance.gold.amount).toBe(400);
  });

  it('Gold: Lightning after a 40-frame wind-up kills a Goomba 56 px behind him; 90 f cooldown', () => {
    const r = rig('fire');
    const g = place(r, new Goomba(0, 0), -BOLT_AHEAD - 6);
    const x0 = r.p.body.x;
    tap(r, 'special');
    for (let i = 1; i < MAGIC_WINDUP; i++) {
      r.step(['right']);
      expect(r.world.entities.some((e) => e instanceof ArthurBolt)).toBe(false);
    }
    expect(r.p.body.x).toBe(x0);
    r.step([]);
    expect(r.world.entities.filter((e) => e instanceof ArthurBolt)).toHaveLength(2);
    r.step([]);
    expect(dead(g)).toBe(true);
    // Too soon: nothing.
    for (let i = 0; i < 30; i++) r.step([]);
    tap(r, 'special', MAGIC_WINDUP + 2);
    expect(r.world.entities.filter((e) => e instanceof ArthurBolt)).toHaveLength(0);
  });

  it('no Lightning in Steel armour, nor in the air', () => {
    const s = rig('big');
    tap(s, 'special', MAGIC_WINDUP + 2);
    expect(s.world.entities.some((e) => e instanceof ArthurBolt)).toBe(false);
    const a = rig('fire');
    a.step(['jump']);
    tap(a, 'special', MAGIC_WINDUP + 2);
    expect(a.world.entities.some((e) => e instanceof ArthurBolt)).toBe(false);
  });

  it('a hit during the wind-up cancels it', () => {
    const r = rig('fire');
    tap(r, 'special', 10);
    r.world.hurtPlayer(r.p, 1);
    for (let i = 0; i < 60; i++) r.step([]);
    expect(r.world.entities.some((e) => e instanceof ArthurBolt)).toBe(false);
  });
});

describe('weapon pots (AR-21, AR-22)', () => {
  it('one kill in 8 drops a pot, never of the held weapon', () => {
    const r = rig();
    const rng = new Rng(7);
    let pots = 0;
    const N = 4000;
    for (let i = 0; i < N; i++) {
      const k = arthurPotDrop(rng, r.p);
      if (!k) continue;
      pots++;
      expect(k).toMatch(/^pot-/);
      expect(k).not.toBe('pot-lance');
    }
    expect(Math.abs(pots / N - POT_RATE)).toBeLessThan(0.02);
  });

  it('touching a pot swaps the weapon and says so', () => {
    const r = rig();
    r.world.spawn(new Pickup(r.p.centerX, r.p.feetY, 'pot-axe'));
    for (let i = 0; i < 30; i++) r.step([]);
    expect(weaponOf(r.p)).toBe('axe');
    expect(r.events.some(({ e }) => e.type === 'say' && e.text === 'Axe')).toBe(true);
  });

  it('the dev full kit: Select cycles the four weapons (TG-44)', () => {
    const r = rig('fire', A.devKit?.() ?? {});
    const seen: string[] = [weaponOf(r.p)];
    for (let i = 0; i < 4; i++) {
      tap(r, 'select', 1);
      seen.push(weaponOf(r.p));
    }
    expect(seen).toEqual(['lance', 'dagger', 'torch', 'axe', 'lance']);
    expect(A.touchLabels?.(r.p, r.world).select).toBe('WEAPON');
  });
});

describe('water (AR-24)', () => {
  it('a floor jump at -0x0418E; no stroke mid-water after the second jump', () => {
    const level = parseTextMap(
      [
        'id: deep',
        'theme: water',
        'swim: true',
        'time: 300',
        'start: 4,27',
        'height: 30',
        'camera: free',
        '',
        '[tiles]',
        ...Array.from({ length: 30 }, (_, y) =>
          y >= 28 ? '#'.repeat(48) : y === 2 ? 'w'.repeat(48) : '.'.repeat(48),
        ),
      ].join('\n'),
    );
    const r = new Rig(A, level);
    for (let i = 0; i < 120; i++) r.step();
    expect(r.p.inWater).toBe(true);
    r.step(['jump']);
    const sw = CLASSIC_SWIM.arthur!;
    expect(r.p.body.vy).toBe(-0x0418e + sw.gravity);
    for (let i = 0; i < 20; i++) r.step([]);
    r.step(['jump']);
    expect(r.p.body.vy).toBe(-0x0418e + sw.gravity);
    for (let i = 0; i < 5; i++) r.step([]);
    const vy = r.p.body.vy;
    r.step(['jump']);
    expect(r.p.body.vy).toBe(vy + sw.gravity);
  });
});

describe('art, HUD, guide and touch (AR-27..AR-29, TG-22, TG-40)', () => {
  it('every frame his sprite names exists, in every state, with its palettes', () => {
    const frames = SPRITES.arthur?.frames ?? {};
    const scripts: Action[][] = [
      ...Array.from({ length: 20 }, (): Action[] => ['right']),
      ['attack'],
      ...Array.from({ length: 14 }, (): Action[] => []),
      ['jump'],
      ...Array.from({ length: 6 }, (): Action[] => []),
      ['down', 'attack'],
      ...Array.from({ length: 50 }, (): Action[] => []),
      ...Array.from({ length: 6 }, (): Action[] => ['down']),
      ['down', 'attack'],
      ...Array.from({ length: 14 }, (): Action[] => ['down']),
      ['special'],
      ...Array.from({ length: 50 }, (): Action[] => []),
    ];
    for (const power of ['small', 'big', 'fire']) {
      const r = rig(power);
      for (const hold of scripts) {
        r.step(hold);
        for (const reduce of [false, true]) {
          const s = A.sprite(r.p, r.frame, reduce);
          expect(frames[s.frame], `${power} ${s.frame}`).toBeDefined();
          expect(PALETTES.default?.[s.palette], s.palette).toBeDefined();
        }
      }
    }
    for (const pose of ['climb-0', 'climb-1', 'magic', 'throw-down', 'crouch-throw', 'walk-2'])
      for (const pre of ['', 'boxers-']) expect(frames[`${pre}${pose}`], `${pre}${pose}`).toBeDefined();
    for (const k of ['arthur', 'arthur-gold', 'arthur-fx', 'arthur-gold-fx', 'arthur-fx-alt'])
      expect(PALETTES.default?.[k], k).toBeDefined();
    for (let i = 0; i < 4; i++) expect(PALETTES.default?.[`arthur-star-${i}`]).toBeDefined();
    const fx = SPRITES['arthur-fx']?.frames ?? {};
    for (const w of Object.values(WEAPONS))
      for (const s of [w.steel, w.steelDown, w.gold, w.goldDown])
        for (const f of s.frames) expect(SPRITES[s.sheet]?.frames[f], `${s.sheet} ${f}`).toBeDefined();
    for (const f of [
      'pot-lance',
      'pot-dagger',
      'pot-torch',
      'pot-axe',
      'bolt',
      'spark',
      'piece-0',
      'gold-piece-1',
    ])
      expect(fx[f], f).toBeDefined();
    expect(A.portrait).toEqual({ sheet: 'arthur', palette: 'arthur', frame: 'stand' });
  });

  it('has his own short guide in the bitmap font, with no button letters', () => {
    const g = A.guide;
    expect(g.tagline.length).toBeLessThanOrEqual(30);
    const texts = [
      g.tagline,
      ...g.controls.flatMap((x) => [x.does, x.touchDoes ?? '', x.touch ?? '']),
      ...g.powerups.map((x) => x.does),
      ...(g.tips ?? []),
    ];
    for (const t of texts) {
      expect(fontText(t).length, t).toBe(t.length);
      expect(t, t).not.toMatch(/\b(button|press|push|tap|hold)\s+[abc]\b|\([abc]\)|\b[abc]\s*:/i);
    }
  });

  it('touch labels: THROW; MAGIC only in Gold armour; WEAPON only with the full kit', () => {
    const s = rig();
    expect(A.touchLabels?.(s.p, s.world)).toEqual({ attack: 'THROW', special: null, select: null });
    const f = rig('fire');
    expect(A.touchLabels?.(f.p, f.world)).toEqual({ attack: 'THROW', special: 'MAGIC', select: null });
  });

  it('the HUD names the weapon', () => {
    const r = rig();
    expect(A.hudExtra?.(r.p)).toBe('LANCE');
  });

  it('a dev Classic start plays him; a Campaign one never offers him (MARIO stays Mario)', () => {
    const h = makeGame({ dev: true });
    h.game.devStart('1-1', A, 'small', false, 1, { rules: 'classic' });
    expect(h.game.liveRules).toBe('classic');
    expect(heroFor(MARIO, 'campaign')).toBe(MARIO);
  });
});
