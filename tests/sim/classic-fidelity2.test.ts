import { describe, expect, it } from 'vitest';
import type { Action } from '@engine/input/actions';
import { px } from '@engine/math/units';
import { PALETTES, SPRITES } from '@content/sprites';
import type { CharacterDef, SpriteSpec } from '@game/characters/character';
import { BILL_CLASSIC } from '@game/characters/bill/classic';
import { LINK_CLASSIC } from '@game/characters/link/classic';
import { MARIO_CLASSIC } from '@game/characters/mario/classic';
import { FIREBALL_CLASSIC } from '@game/characters/mario/classic-weapons';
import { MEGAMAN_CLASSIC } from '@game/characters/megaman/classic';
import { MEGAMAN } from '@game/characters/megaman';
import { RYU_CLASSIC } from '@game/characters/ryu/classic';
import { SAMUS_CLASSIC } from '@game/characters/samus/classic';
import {
  ICE_BEAM_CLASSIC,
  LONG_BEAM_CLASSIC,
  MISSILE_CLASSIC,
  MISSILE_UP_CLASSIC,
  SHORT_BEAM_CLASSIC,
  WAVE_BEAM_CLASSIC,
} from '@game/characters/samus/classic-weapons';
import { SIMON_CLASSIC } from '@game/characters/simon/classic';
import { CLASSIC_HURT, CLASSIC_WALK_ANIM } from '@game/characters/classic/anim';
import { Rig, flatLevel } from './classic-plumber-harness';
import { useStorage } from './heroes-harness';
import { PIT_CLASSIC } from '@game/characters/pit/classic';
import { Projectile } from '@game/entities/projectiles/projectile';

// F2 fidelity (the original 3.1.21's numbers, measured from its SWF and source): walk timing per
// hero, the air states and their conditions, hurt boxes (HRect) and shot sizes. Classic only;
// the Current defs keep today's paths.

useStorage();

/** A ledge: solid tiles on row 10 from column 0 to 9 (top at y 160 px), the floor below. */
const LEDGE = flatLevel({ 10: '#'.repeat(10) });

function rig(def: CharacterDef, power = 'small', level = flatLevel()): Rig {
  const r = new Rig(def, level, 'classic', power);
  r.settle();
  return r;
}
/** On the ledge, 2 columns from its right end. */
function onLedge(def: CharacterDef, power = 'small'): Rig {
  const r = new Rig(def, LEDGE, 'classic', power);
  const b = r.p.body;
  b.x = px(7 * 16);
  b.y = px(160) - b.h;
  r.settle();
  expect(b.onGround).toBe(true);
  return r;
}
const look = (r: Rig): SpriteSpec => r.p.def.sprite(r.p, r.frame, false);
const pose = (r: Rig): string => `${look(r).sheet}:${look(r).frame}`;
/** Step `n` frames holding `hold`, recording the pose after each. */
function record(r: Rig, n: number, hold: Action[] = []): string[] {
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    r.step(hold);
    out.push(pose(r));
  }
  return out;
}

describe('walk cycles (CharacterDef.walkAnim)', () => {
  const cases: [CharacterDef, { frames: number; ticks: number }][] = [
    [LINK_CLASSIC, { frames: 4, ticks: 6 }], // 100 ms
    [SIMON_CLASSIC, { frames: 4, ticks: 6.9 }], // 115 ms
    [MEGAMAN_CLASSIC, { frames: 4, ticks: 6 }], // 100 ms
    [RYU_CLASSIC, { frames: 5, ticks: 4.5 }], // 75 ms
    [BILL_CLASSIC, { frames: 4, ticks: 6.9 }], // 115 ms
    [SAMUS_CLASSIC, { frames: 3, ticks: 3 }], // 50 ms
  ];
  for (const [def, want] of cases)
    it(`${def.id}: ${want.frames} poses, one every ${want.ticks} frames`, () => {
      expect(def.walkAnim).toEqual(want);
      const r = rig(def);
      r.step(['right']);
      r.step(['right']);
      let changes = 0;
      let last = r.p.walkFrame;
      const seen = new Set<number>([last]);
      const N = 138; // a whole number of 6.9 and 4.5 frame poses, near enough for 6 and 3
      for (let i = 0; i < N; i++) {
        r.step(['right']);
        if (r.p.walkFrame !== last) {
          changes++;
          last = r.p.walkFrame;
          seen.add(last);
        }
        expect(look(r).frame, look(r).frame).toMatch(/^(walk|step)/);
      }
      expect(Math.abs(changes - N / want.ticks)).toBeLessThanOrEqual(1);
      expect([...seen].sort()).toEqual([...Array(want.frames).keys()]);
    });

  it('Current defs keep the shared 3-frame cycle (no walkAnim)', () => {
    expect(MEGAMAN.walkAnim).toBeUndefined();
    expect(CLASSIC_WALK_ANIM.link.ticks).toBe(6);
  });
});

describe('air states', () => {
  it('Link somersaults the whole jump: 3 rolled poses and the upright one twice, 140 ms each', () => {
    const r = rig(LINK_CLASSIC);
    const seen = record(r, 34, ['jump']);
    // Frame 1 is the take-off; each pose holds 8.4 frames.
    expect(seen.slice(0, 8).every((s) => s === 'link-classic:roll-0')).toBe(true);
    expect(seen[9]).toBe('link-classic:roll-1');
    expect(seen[17]).toBe('link-classic:roll-2');
    expect(seen[26]).toBe('link:jump');
    expect(seen[33]).toBe('link:jump');
    // It loops while airborne.
    const more = record(r, 10, ['jump']);
    if (!r.p.body.onGround) expect(more.some((s) => s.startsWith('link-classic:roll'))).toBe(true);
  });

  it('Link rolls off a ledge too; after an air stab he stays upright to the landing', () => {
    const r = onLedge(LINK_CLASSIC);
    r.until(() => !r.p.body.onGround, ['right'], 120);
    r.step(['right']);
    expect(pose(r)).toBe('link-classic:roll-0');
    const j = rig(LINK_CLASSIC);
    j.step(['jump']);
    j.step(['jump', 'attack']);
    for (let i = 0; i < 16; i++) j.step(['jump']);
    const rest: string[] = [];
    while (!j.p.body.onGround && rest.length < 120) {
      j.step();
      rest.push(pose(j));
    }
    expect(rest.length).toBeGreaterThan(0);
    expect(new Set(rest.slice(0, -1))).toEqual(new Set(['link:jump']));
  });

  it('Simon tucks while rising and stands while falling, and after an air whip', () => {
    const r = rig(SIMON_CLASSIC);
    r.step(['jump']);
    expect(r.p.body.vy).toBeLessThan(0);
    expect(pose(r)).toBe('simon-classic:jump-tuck');
    r.until(() => r.p.body.vy > 0, ['jump'], 120);
    r.step();
    expect(pose(r)).toBe('simon:idle');
    const w = rig(SIMON_CLASSIC);
    w.step(['jump']);
    w.step(['jump', 'attack']);
    w.until(() => !w.p.scratch._act, ['jump'], 60);
    if (w.p.body.vy < 0) expect(pose(w)).toBe('simon:idle');
    expect(w.p.scratch._airAtk).toBe(1);
  });

  it('Mega Man holds the arms-up jump rising and falling; shots in the air and walking keep their pose', () => {
    const r = rig(MEGAMAN_CLASSIC);
    r.step(['jump']);
    expect(pose(r)).toBe('megaman-classic:jump');
    r.until(() => r.p.body.vy > 0, ['jump'], 120);
    r.step();
    expect(pose(r)).toBe('megaman-classic:jump');
    r.step(['attack']);
    expect(r.p.attackTimer).toBeGreaterThan(0);
    expect(pose(r)).toBe('megaman-classic:jump-shoot');
    // Walking and shooting: the walk cycle goes on under the shot pose.
    const w = rig(MEGAMAN_CLASSIC);
    for (let i = 0; i < 12; i++) w.step(['right']);
    w.step(['right', 'attack']);
    const f0 = w.p.walkFrame;
    const shots: string[] = [];
    for (let i = 0; i < 8; i++) {
      w.step(['right']);
      shots.push(look(w).frame);
    }
    expect(shots.every((s) => s.startsWith('walk-shoot-'))).toBe(true);
    expect(w.p.walkFrame).not.toBe(f0);
  });

  it('Ryu flips 400 ms (5 frames at 33 ms) on a jump, then falls upright; a walk off a ledge does not flip', () => {
    const r = rig(RYU_CLASSIC);
    const seen = record(r, 30, ['jump']);
    expect(seen.slice(0, 10)).toEqual([
      // R1: all on his Classic sheet
      'ryu-classic:jump',
      'ryu-classic:jump',
      'ryu-classic:spin-1',
      'ryu-classic:spin-1',
      'ryu-classic:spin-2',
      'ryu-classic:spin-2',
      'ryu-classic:spin-3',
      'ryu-classic:spin-3',
      'ryu-classic:spin-0',
      'ryu-classic:spin-0',
    ]);
    expect(seen[23]).not.toBe('ryu-classic:fall');
    expect(seen[24]).toBe('ryu-classic:fall');
    const l = onLedge(RYU_CLASSIC);
    l.until(() => !l.p.body.onGround, ['right'], 120);
    l.step(['right']);
    expect(pose(l)).toBe('ryu-classic:fall');
  });

  it('Bill falls upright off a ledge and somersaults on a jump', () => {
    const l = onLedge(BILL_CLASSIC);
    l.until(() => !l.p.body.onGround, ['right'], 120);
    l.step(['right']);
    expect(pose(l)).toBe('bill-classic:fall');
    const r = rig(BILL_CLASSIC);
    r.step(['jump']);
    r.step(['jump']);
    expect(pose(r)).toMatch(/^bill:spin-/);
  });

  it('Samus: knees-up jump, air shot, air aim-up, walk aiming up, and a 33 ms somersault', () => {
    const r = rig(SAMUS_CLASSIC);
    r.step(['jump']);
    r.step();
    expect(pose(r)).toBe('samus-classic:air');
    r.step(['attack']);
    expect(pose(r)).toBe('samus-classic:air-shoot');
    r.step(['up']);
    expect(pose(r)).toBe('samus-classic:up-air');
    const w = rig(SAMUS_CLASSIC);
    w.step(['up']);
    const walk = record(w, 12, ['up', 'right']);
    expect(walk.at(-1)).toMatch(/^samus-classic:up-walk-[012]$/);
    expect(new Set(walk.filter((s) => s.includes('up-walk'))).size).toBeGreaterThan(1);
    const f = rig(SAMUS_CLASSIC);
    f.until(() => !!f.p.scratch._flip, ['right', 'jump'], 60);
    const spins = record(f, 8, ['right', 'jump']).filter((s) => s.includes('spin'));
    expect(spins.length).toBeGreaterThanOrEqual(4);
    // Two frames a pose.
    for (let i = 0; i + 2 < spins.length; i += 2) expect(spins[i]).not.toBe(spins[i + 2]);
  });
});

describe('hurt boxes (CharacterDef.hurtbox: the original HRect)', () => {
  const box = (r: Rig) => {
    const h = r.p.hurtBody();
    return { w: h.w / 256, h: h.h / 256, feet: h.y + h.h, cx: h.x * 2 + h.w };
  };
  const body = (r: Rig) => ({ feet: r.p.body.y + r.p.body.h, cx: r.p.body.x * 2 + r.p.body.w });

  it('standing sizes, centred on the body and on its feet', () => {
    const want: [CharacterDef, string, number, number][] = [
      [LINK_CLASSIC, 'small', 13.5, 15],
      [SAMUS_CLASSIC, 'small', 13.5, 31],
      [SIMON_CLASSIC, 'small', 13.5, 30],
      [MEGAMAN_CLASSIC, 'small', 13.5, 24],
      [RYU_CLASSIC, 'small', 13.5, 27],
      [BILL_CLASSIC, 'small', 13.5, 31.5],
      [MARIO_CLASSIC, 'small', 13, 15],
      [MARIO_CLASSIC, 'big', 13, 28],
    ];
    for (const [def, power, w, h] of want) {
      const r = rig(def, power);
      const b = box(r);
      expect([b.w, b.h], `${def.id} ${power}`).toEqual([w, h]);
      expect(b.feet).toBe(body(r).feet);
      expect(Math.abs(b.cx - body(r).cx)).toBeLessThanOrEqual(1);
    }
  });

  it('air and crouch sizes', () => {
    const air = (def: CharacterDef) => {
      const r = rig(def);
      r.step(['jump']);
      r.step(['jump']);
      return box(r).h;
    };
    expect(air(SIMON_CLASSIC)).toBe(CLASSIC_HURT.simon.jump);
    expect(air(RYU_CLASSIC)).toBe(25);
    expect(air(MEGAMAN_CLASSIC)).toBe(27.5);
    expect(air(SAMUS_CLASSIC)).toBe(25);
    expect(air(BILL_CLASSIC)).toBe(16.25);
    const c = rig(SIMON_CLASSIC);
    c.step(['down']);
    c.step(['down']);
    expect(box(c).h).toBe(15.75);
  });

  it('a Current def is hit on its body (no hurtbox)', () => {
    const r = new Rig(MEGAMAN, flatLevel(), 'current');
    r.settle();
    expect(MEGAMAN.hurtbox).toBeUndefined();
    expect(r.p.hurtBody()).toBe(r.p.body);
  });
});

describe('shots: the original sizes and colours', () => {
  /** The drawn pixels' width and height of `frame` on `sheet`. */
  function drawn(sheet: string, frame: string): [number, number] {
    const rows = SPRITES[sheet]?.frames[frame];
    if (!rows) throw new Error(`${sheet}:${frame}`);
    const ys = rows.map((r, y) => (/[^.]/.test(r) ? y : -1)).filter((y) => y >= 0);
    const xs = rows.flatMap((r) => [...r].flatMap((c, x) => (c === '.' ? [] : [x])));
    return [Math.max(...xs) - Math.min(...xs) + 1, Math.max(...ys) - Math.min(...ys) + 1];
  }

  it("Samus's beam is a 4 x 5 bolt with a 7 x 8 burst, centred on its body", () => {
    for (const s of [LONG_BEAM_CLASSIC, SHORT_BEAM_CLASSIC]) {
      expect([s.w, s.h]).toEqual([4, 5]);
      for (const f of s.frames) expect(drawn(s.sheet, f)).toEqual([4, 5]);
      expect(drawn(s.sheet, s.burstFrame as string)).toEqual([7, 8]);
      expect(s.drawOffset).toEqual({ x: -2, y: -1 });
    }
  });

  it('the Wave Beam is 8 x 8 with a black outline in Varia colours; a missile 11 x 8', () => {
    expect([WAVE_BEAM_CLASSIC.w, WAVE_BEAM_CLASSIC.h]).toEqual([8, 8]);
    for (const f of WAVE_BEAM_CLASSIC.frames) {
      expect(drawn(WAVE_BEAM_CLASSIC.sheet, f)).toEqual([8, 8]);
      const rows = SPRITES[WAVE_BEAM_CLASSIC.sheet]?.frames[f] as readonly string[];
      expect(rows[0]).toMatch(/^\.\.0000\.\.$/);
      expect(rows.join('')).toContain('5'); // Varia's pink
    }
    expect([MISSILE_CLASSIC.w, MISSILE_CLASSIC.h]).toEqual([10, 8]);
    expect(drawn(MISSILE_CLASSIC.sheet, 'missile')).toEqual([11, 8]);
    expect([MISSILE_UP_CLASSIC.w, MISSILE_UP_CLASSIC.h]).toEqual([8, 10]);
    // One Wave Beam frame (no strobe), and the Ice Beam is the plain beam's 4 x 5 bolt.
    expect(WAVE_BEAM_CLASSIC.frames).toHaveLength(1);
    expect([ICE_BEAM_CLASSIC.w, ICE_BEAM_CLASSIC.h]).toEqual([4, 5]);
    for (const f of ICE_BEAM_CLASSIC.frames) expect(drawn(ICE_BEAM_CLASSIC.sheet, f)).toEqual([4, 5]);
  });

  it('the palette is the original red rim, orange, green core, Varia pink and missile cyan', () => {
    expect(PALETTES.default['smbc-shots']).toEqual([
      '#000000',
      '#fcfcfc',
      '#d82800',
      '#009400',
      '#000000',
      '#fcc4d8',
      '#00e8d8',
      '#fc9838',
    ]);
  });

  it("Pit's arrows keep their own 8 x 8 cell, drawn at the body (Pit is not in the original)", () => {
    const r = new Rig(PIT_CLASSIC, flatLevel(), 'classic', 'big');
    r.settle();
    r.step(['attack']);
    const shot = r.world.entities.find((e): e is Projectile => e instanceof Projectile && e.owner === r.p);
    expect(shot?.spec.sheet).toBe('pit-shots');
    expect([shot?.spec.w, shot?.spec.h]).toEqual([8, 8]);
    expect(shot?.spec.drawOffset).toBeUndefined();
  });

  it("Mario's Fire Flower ball fills its 8 x 8 and bursts 16 x 16", () => {
    expect([FIREBALL_CLASSIC.w, FIREBALL_CLASSIC.h]).toEqual([8, 8]);
    for (const f of FIREBALL_CLASSIC.frames) expect(drawn(FIREBALL_CLASSIC.sheet, f)).toEqual([8, 8]);
    expect(drawn(FIREBALL_CLASSIC.sheet, FIREBALL_CLASSIC.burstFrame as string)).toEqual([16, 16]);
  });

  it('every new frame each Classic def can ask for exists on its sheet', () => {
    const want: [string, string[]][] = [
      ['link-classic', ['roll-0', 'roll-1', 'roll-2']],
      ['simon-classic', ['jump-tuck']],
      ['megaman-classic', ['jump', 'jump-shoot']],
      ['ryu-classic', ['fall']],
      ['bill-classic', ['fall']],
      ['samus-classic', ['air', 'air-shoot', 'up-air', 'up-walk-0', 'up-walk-1', 'up-walk-2']],
    ];
    for (const [sheet, frames] of want)
      for (const f of frames) expect(SPRITES[sheet]?.frames[f], `${sheet}:${f}`).toBeDefined();
  });
});
