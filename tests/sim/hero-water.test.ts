import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { SPRITES } from '@content/sprites';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { MARIO } from '@game/characters/mario';
import { Projectile } from '@game/entities/projectiles/projectile';
import { levelTouchLabels } from '@game/touch-labels';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';
import { toPx } from '@engine/math/units';

// 0.4.25 (owner note 25): every hero meets water the way their own game does. Mega Man and Samus
// walk the seabed with floaty high jumps and no stroke (Bubble Man's stage, Metroid's liquids);
// Bill, Link, Simon and Ryu swim with a stroke of their own.

const hero = (id: string) => CHARACTERS.find((c) => c.id === id) as CharacterDef;
const SEABED = ['megaman', 'samus'];
const SWIMMERS = ['link', 'simon', 'ryu', 'bill'];
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

/** Settle on the 2-2 sea floor, then run `ctl` for `frames` more frames. */
function onFloor(
  def: CharacterDef,
  frames: number,
  ctl: (w: World, f: number) => Action[],
  watch: (w: World, f: number) => void = () => {},
): World {
  let settled = -1;
  const r = runSim({
    level: getLevel('2-2'),
    character: def,
    script: none,
    maxFrames: 2000,
    assist: { invulnerable: true },
    controller: (w, f) => {
      if (settled < 0 && f > 10 && w.player.body.onGround) settled = f;
      if (settled < 0) return [];
      watch(w, f - settled);
      return ctl(w, f - settled);
    },
    until: (_w, f) => settled >= 0 && f - settled >= frames,
  });
  return r.world;
}

const frameExists = (w: World): boolean => {
  const s = w.player.def.sprite(w.player, w.player.frame, false);
  return SPRITES[s.sheet]?.frames[s.frame] !== undefined;
};

describe('Mega Man and Samus walk the seabed (no stroke)', () => {
  it.each(SEABED)('%s: a jump off the sea floor rises much higher than on land', (id) => {
    const def = hero(id);
    let floor = 0;
    let top = Infinity;
    onFloor(
      def,
      200,
      (_w, f) => (f < 120 ? ['jump'] : []),
      (w) => {
        const feet = toPx(w.player.body.y + w.player.body.h);
        floor ||= feet;
        if (w.player.inWater) top = Math.min(top, feet);
      },
    );
    // Land jumps clear about 4.5 tiles; under water at least 6.
    expect(floor - top).toBeGreaterThanOrEqual(6 * 16);
  });

  it.each(SEABED)('%s: tapping jump in mid-water does not stroke, and the sink is slow', (id) => {
    const def = hero(id);
    let strokes = 0;
    let maxVy = 0;
    let prevVy = 0;
    let prevGround = true;
    onFloor(
      def,
      240,
      (_w, f) => (f < 30 ? ['jump'] : f % 8 < 2 ? ['jump'] : []),
      (w, f) => {
        const b = w.player.body;
        // A new upward push away from the floor (a jump off the floor is allowed).
        if (f > 40 && !prevGround && !b.onGround && b.vy < prevVy - 0x800) strokes++;
        prevVy = b.vy;
        prevGround = b.onGround;
        if (w.player.inWater) maxVy = Math.max(maxVy, b.vy);
        if (f > 0) expect(w.player.anim).not.toBe('swim');
      },
    );
    expect(strokes).toBe(0);
    expect(def.movement.swim?.mode).toBe('seabed');
    expect(maxVy).toBeLessThan(MARIO.movement.swim!.sinkMax);
  });

  it.each(SEABED)('%s: walks the floor at full speed and shoots under water', (id) => {
    const def = hero(id);
    let maxVx = 0;
    let shots = 0;
    onFloor(
      def,
      60,
      (_w, f) => (f % 10 === 0 ? ['right', 'attack'] : ['right']),
      (w) => {
        if (w.player.body.onGround) maxVx = Math.max(maxVx, Math.abs(w.player.body.vx));
        shots = Math.max(shots, w.entities.filter((e) => e instanceof Projectile && e.owner === w.player).length);
      },
    );
    expect(maxVx).toBe(def.movement.maxWalk);
    expect(shots).toBeGreaterThan(0);
  });

  it.each(SEABED)('%s: the touch jump button still says JUMP under water', (id) => {
    const w = onFloor(hero(id), 2, () => []);
    expect(w.player.inWater).toBe(true);
    expect(levelTouchLabels(w.player, w).jump).toBe('JUMP');
  });
});

describe('Bill, Link, Simon and Ryu swim with a stroke of their own', () => {
  it.each(SWIMMERS)('%s: has his own swim tuning', (id) => {
    const sw = hero(id).movement.swim;
    expect(sw).toBeDefined();
    expect(sw?.mode ?? 'stroke').toBe('stroke');
  });

  it('every swimmer is tuned apart', () => {
    const keys = SWIMMERS.map((id) => JSON.stringify(hero(id).movement.swim));
    expect(new Set(keys).size).toBe(SWIMMERS.length);
  });

  it.each(SWIMMERS)('%s: jump strokes upward in mid-water, in a swim pose of his own', (id) => {
    const def = hero(id);
    let strokes = 0;
    let prevVy = 0;
    let swimFrame = '';
    onFloor(
      def,
      160,
      (_w, f) => (f % 16 < 2 ? ['jump', 'right'] : ['right']),
      (w, f) => {
        const b = w.player.body;
        if (f > 20 && !b.onGround && b.vy < prevVy - 0x800) strokes++;
        prevVy = b.vy;
        if (!b.onGround && w.player.anim === 'swim' && w.player.attackTimer === 0) {
          swimFrame = def.sprite(w.player, w.player.frame, false).frame;
          expect(frameExists(w)).toBe(true);
        }
      },
    );
    expect(strokes).toBeGreaterThan(3);
    expect(swimFrame).toMatch(/^swim/);
  });

  it.each(SWIMMERS)('%s: steers while swimming', (id) => {
    let x0 = 0;
    let x1 = 0;
    onFloor(
      hero(id),
      90,
      (_w, f) => (f < 30 ? (f % 10 < 2 ? ['jump'] : []) : f % 10 < 2 ? ['jump', 'right'] : ['right']),
      (w, f) => {
        if (f === 30) x0 = toPx(w.player.body.x);
        if (f === 89) x1 = toPx(w.player.body.x);
      },
    );
    expect(x1 - x0).toBeGreaterThan(30);
  });

  it('Bill fires while swimming, forward and up but never down', () => {
    const vys: number[] = [];
    const seen = new Set<Projectile>();
    onFloor(
      hero('bill'),
      120,
      (_w, f) => {
        const stroke: Action[] = f % 14 < 2 ? ['jump'] : [];
        if (f < 20) return stroke;
        const aimKeys: Action[][] = [['down'], ['up'], ['up', 'right'], ['right'], ['down', 'right']];
        const keys = aimKeys[Math.floor(f / 20) % aimKeys.length] as Action[];
        return [...stroke, ...keys, ...(f % 20 === 10 ? (['attack'] as Action[]) : [])];
      },
      (w) => {
        for (const e of w.entities)
          if (e instanceof Projectile && e.owner === w.player && !seen.has(e)) {
            seen.add(e);
            if (!w.player.body.onGround) vys.push(e.body.vy);
          }
      },
    );
    expect(vys.length).toBeGreaterThanOrEqual(4);
    expect(vys.every((vy) => vy <= 0)).toBe(true);
    expect(vys.some((vy) => vy < 0)).toBe(true);
  });

  it("Link's shield still blocks while he swims", () => {
    const w = onFloor(hero('link'), 12, (_w, f) => (f < 2 ? ['jump'] : []));
    const p = w.player;
    expect(p.inWater && !p.body.onGround).toBe(true);
    const toward = { body: { vx: -p.facing * 0x01000 } } as unknown as Projectile;
    expect(p.def.behaviour.blocks?.(p, toward)).toBe(true);
  });

  it.each(SWIMMERS)('%s: the touch jump button says SWIM', (id) => {
    const w = onFloor(hero(id), 2, () => []);
    expect(levelTouchLabels(w.player, w).jump).toBe('SWIM');
  });
});
