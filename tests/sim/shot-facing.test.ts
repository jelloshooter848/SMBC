import { describe, expect, it } from 'vitest';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { NullRenderer, type Renderer } from '@engine/gfx/renderer';
import { px } from '@engine/math/units';
import { SPRITES } from '@content/sprites';
import type { View } from '@game/entities/entity';
import type { Player } from '@game/entities/player';
import { FIREBALL, Projectile, SWORD_BEAM, type ProjectileSpec } from '@game/entities/projectiles/projectile';
import { Flash } from '@game/entities/effects/effects';
import type { World } from '@game/world/world';
import { SAMUS } from '@game/characters/samus';
import { SAMUS_CLASSIC } from '@game/characters/samus/classic';
import { ICE_BEAM, LONG_BEAM, MISSILE, POWER_BEAM } from '@game/characters/samus/weapons';
import {
  ICE_BEAM_CLASSIC,
  LONG_BEAM_CLASSIC,
  MISSILE_CLASSIC,
  SHORT_BEAM_CLASSIC,
} from '@game/characters/samus/classic-weapons';
import { FLAME_SHOT, MG_SHOT } from '@game/characters/bill/weapons';
import { DAGGER } from '@game/characters/simon/weapons';
import { DAGGER_CLASSIC } from '@game/characters/simon/classic-weapons';
import { HOMING_KNUCKLE } from '@game/characters/megaman/weapons';
import { HARD_KNUCKLE } from '@game/characters/megaman/classic-weapons';
import { LINK_BEAM, LinkShot } from '@game/characters/link/classic-weapons';
import { Rig, flatLevel } from './classic-plumber-harness';
import { useStorage } from './heroes-harness';

// Shots fly head first (0.4.57). Projectile.render mirrors a shot flying right, so every frame it
// draws is stored pointing LEFT; these were drawn pointing right and so flew tail first both ways
// (Samus's missile showed its red nose at the back). Each shot is drawn fired right and fired left
// and its head colour must sit on the leading side of its tail colour.

useStorage();

/** The rows a shot draws this frame, mirrored as the renderer mirrors them. */
function drawn(shot: Projectile | Flash): { frame: string; rows: string[]; flip: boolean } {
  const calls: { f: string; flip: boolean }[] = [];
  const rr: Renderer = Object.assign(new NullRenderer(), {
    sprite(_s: SpriteSheet, f: string, _x: number, _y: number, flip?: boolean) {
      calls.push({ f, flip: !!flip });
    },
  });
  shot.render(rr, { camX: 0, frame: 0, assets: { sheet: () => ({ frames: new Map() }) } } as unknown as View);
  const c = calls.at(-1);
  if (!c) throw new Error(`${shot.kind} drew nothing`);
  const sheet = shot instanceof Flash ? shot.sheet : shot.spec.sheet;
  const rows = SPRITES[sheet]?.frames[c.f] as string[] | undefined;
  if (!rows) throw new Error(`${sheet}:${c.f} is not a frame`);
  return { frame: c.f, flip: c.flip, rows: rows.map((r) => (c.flip ? [...r].reverse().join('') : r)) };
}

/** The Flash a shot fired `dir` leaves when it bursts (Projectile.burst, no held burst). */
function burstFlash(spec: ProjectileSpec, dir: -1 | 1): Flash {
  const spawned: unknown[] = [];
  const shot = new Projectile(px(64), px(64), dir, spec, null);
  shot.burst({ spawn: (e: unknown) => spawned.push(e) } as unknown as World);
  const f = spawned.find((e): e is Flash => e instanceof Flash);
  if (!f) throw new Error(`${spec.kind} left no flash`);
  return f;
}

/** Mean x (or y) of the pixels in `chars`, as a fraction across the frame. */
function at(rows: readonly string[], chars: string, axis: 'x' | 'y' = 'x'): number {
  const hits: number[] = [];
  rows.forEach((row, y) =>
    [...row].forEach((ch, x) => chars.includes(ch) && hits.push(axis === 'x' ? x : y)),
  );
  if (hits.length === 0) throw new Error(`no ${chars} pixels`);
  const size = axis === 'x' ? (rows[0]?.length ?? 1) : rows.length;
  return hits.reduce((a, b) => a + b, 0) / hits.length / (size - 1);
}

/** Head and tail colours (palette roles) of each fixed shot. */
const FIXED: { name: string; spec: ProjectileSpec; head: string; tail: string }[] = [
  { name: "Samus's missile", spec: MISSILE, head: '2', tail: '7' },
  { name: "Classic Samus's missile", spec: MISSILE_CLASSIC, head: '2', tail: '7' },
  { name: 'Power Beam', spec: POWER_BEAM, head: '1', tail: '5' },
  { name: 'Long Beam', spec: LONG_BEAM, head: '1', tail: '5' },
  { name: 'Ice Beam', spec: ICE_BEAM, head: '1', tail: 'a' },
  { name: 'Classic Long Beam', spec: LONG_BEAM_CLASSIC, head: '1', tail: '5' },
  { name: 'Classic short beam', spec: SHORT_BEAM_CLASSIC, head: '1', tail: '5' },
  { name: 'Classic Ice Beam', spec: ICE_BEAM_CLASSIC, head: '1', tail: 'a' },
  { name: "Bill's machine gun", spec: MG_SHOT, head: '1', tail: '7' },
  { name: "Bill's flame thrower", spec: FLAME_SHOT, head: '1', tail: '7' },
  { name: "Simon's dagger", spec: DAGGER, head: 'b', tail: '9' },
  { name: "Classic Simon's dagger", spec: DAGGER_CLASSIC, head: 'b', tail: '9' },
  { name: 'Homing Knuckle', spec: HOMING_KNUCKLE, head: 'd', tail: 'c' },
  { name: 'Classic Hard Knuckle', spec: HARD_KNUCKLE, head: 'd', tail: 'c' },
  { name: "Link's sword beam", spec: SWORD_BEAM, head: '1', tail: 'a' },
];

describe('shots fly head first', () => {
  it.each(FIXED)('$name: the head leads fired right and fired left', ({ spec, head, tail }) => {
    for (const dir of [1, -1] as const) {
      // Every frame of its animation.
      for (let age = 0; age < spec.frames.length * spec.frameRate; age++) {
        const shot = new Projectile(px(64), px(64), dir, spec, null);
        shot.age = age;
        const { frame, rows } = drawn(shot);
        const lead = at(rows, head) - at(rows, tail);
        if (dir > 0) expect(lead, `${frame} fired right`).toBeGreaterThan(0);
        else expect(lead, `${frame} fired left`).toBeLessThan(0);
      }
    }
  });

  it("Classic Link's beam still leads with its spark: LinkShot mirrors the right-pointing frame itself", () => {
    for (const dir of [1, -1] as const) {
      const shot = new LinkShot(px(64), px(64), dir, LINK_BEAM, null as unknown as Player, 'forward');
      const { rows } = drawn(shot);
      const lead = at(rows, '1') - at(rows, 'a');
      if (dir > 0) expect(lead).toBeGreaterThan(0);
      else expect(lead).toBeLessThan(0);
    }
  });
});

describe('burst flashes', () => {
  it.each([
    { name: 'Power Beam', spec: POWER_BEAM, tail: '5' },
    { name: 'Long Beam', spec: LONG_BEAM, tail: '5' },
    { name: 'Ice Beam', spec: ICE_BEAM, tail: 'a' },
  ])("$name: the impact flash points the shot's way, fired right and fired left", ({ spec, tail }) => {
    for (const dir of [1, -1] as const) {
      const { frame, rows } = drawn(burstFlash(spec, dir));
      expect(frame).toBe(spec.burstFrame);
      const lead = at(rows, '1') - at(rows, tail);
      if (dir > 0) expect(lead, 'fired right').toBeGreaterThan(0);
      else expect(lead, 'fired left').toBeLessThan(0);
    }
  });

  it("every other shot's burst flash is drawn as stored, as before (the missile's explosion, the fireball)", () => {
    for (const spec of [MISSILE, FIREBALL])
      for (const dir of [1, -1] as const) expect(drawn(burstFlash(spec, dir)).flip, spec.kind).toBe(false);
  });
});

describe("Samus's missile fired in play", () => {
  /** Her newest shot. */
  function newest(r: Rig): Projectile {
    const shot = r.world.entities
      .filter((e): e is Projectile => e instanceof Projectile && e.owner === r.p)
      .at(-1);
    if (!shot) throw new Error('no shot');
    return shot;
  }
  /** The newest missile's nose (red, role 2) less its flame (role 7), across its frame. */
  const lead = (r: Rig): number => {
    const { rows } = drawn(newest(r));
    return at(rows, '2') - at(rows, '7');
  };

  it('campaign rules: nose first fired right and fired left', () => {
    const r = new Rig(SAMUS, flatLevel(), 'current');
    r.p.scratch.missiles = 9;
    r.settle();
    r.step(['special']);
    expect(newest(r).kind).toBe('missile');
    expect(lead(r), 'right').toBeGreaterThan(0);
    for (let i = 0; i < 20; i++) r.step(['left']);
    r.step(['left', 'special']);
    expect(newest(r).body.vx).toBeLessThan(0);
    expect(lead(r), 'left').toBeLessThan(0);
  });

  it('Classic: nose first fired right and fired left; fired up it points up', () => {
    const r = new Rig(SAMUS_CLASSIC, flatLevel(), 'classic', 'big');
    Object.assign(r.p.scratch, { missileUp: 1, missiles: 9 });
    r.settle();
    r.step(['special']);
    expect(newest(r).spec.frames).toEqual(['missile']);
    expect(lead(r), 'right').toBeGreaterThan(0);
    for (let i = 0; i < 30; i++) r.step(['left']);
    r.step(['left', 'special']);
    expect(newest(r).body.vx).toBeLessThan(0);
    expect(lead(r), 'left').toBeLessThan(0);
    for (let i = 0; i < 30; i++) r.step(['up']);
    r.step(['up', 'special']);
    const up = drawn(newest(r));
    expect(up.frame).toBe('missile-up');
    expect(at(up.rows, '2', 'y')).toBeLessThan(at(up.rows, '7', 'y'));
  });
});
