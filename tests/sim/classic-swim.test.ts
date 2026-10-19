import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import { runSim } from '@game/sim/headless';
import type { Action } from '@engine/input/actions';
import { px, toPx } from '@engine/math/units';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { LINK } from '@game/characters/link';
import { SAMUS } from '@game/characters/samus';
import { SIMON } from '@game/characters/simon';
import { MEGAMAN } from '@game/characters/megaman';
import { BILL } from '@game/characters/bill';
import { RYU } from '@game/characters/ryu';
import type { CharacterDef } from '@game/characters/character';
import { classicStandIn } from '@game/characters/classic/test-def';
import { CLASSIC_SWIM } from '@game/rules/classic-swim';
import { applyClassicLevelEdits, FLOOR_JUMPER_EDITS } from '@game/rules/classic-water';
import { Goomba } from '@game/entities/enemies/goomba';
import type { World } from '@game/world/world';
import { TileMap } from '@game/world/tilemap';

// Classic SMBC swimming (2026-10-07-classic-swimming.md, SW-C1..SW-C12; TG-27, TG-45), driven
// with stand-in Classic defs (characters/classic/test-def.ts) until the hero slices land.

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

/**
 * A deep water room: waves on row 2 (the surface line at y = 32), the floor at row `floor`, so a
 * full floor jump never reaches the line and the arc is the water arc alone.
 */
function deepWater(floor = 28, extra: Record<number, string> = {}) {
  const height = Math.max(15, floor + 2);
  const rows = Array.from({ length: height }, (_, y) =>
    y >= floor ? '#'.repeat(48) : (y === 2 ? 'w'.repeat(48) : (extra[y] ?? '')).padEnd(48, '.'),
  );
  return parseTextMap(
    [
      'id: deep',
      'theme: water',
      'swim: true',
      'time: 300',
      `start: 4,${floor - 1}`,
      ...(height > 15 ? [`height: ${height}`, 'camera: free'] : []),
      '',
      '[tiles]',
      ...rows,
    ].join('\n'),
  );
}

interface Arc {
  takeoffVy: number;
  gravity: number;
  apexPx: number;
  maxSink: number;
  vys: number[];
}

/**
 * Settles `def` on the floor, then holds jump (pressed once) and records the arc: the take-off
 * speed, the per-frame gravity on the way up, the apex above the floor and the fastest fall.
 */
function floorJump(def: CharacterDef, level = deepWater(), frames = 200): Arc {
  let settled = -1;
  let floorY = 0;
  let top = Infinity;
  const vys: number[] = [];
  runSim({
    level,
    character: def,
    rules: 'classic',
    script: none,
    maxFrames: 2000,
    assist: { invulnerable: true },
    controller: (w, f) => {
      const b = w.player.body;
      if (settled < 0 && f > 5 && b.onGround) {
        settled = f;
        floorY = b.y + b.h;
      }
      if (settled < 0) return [];
      return ['jump'];
    },
    until: (w, f) => {
      if (settled < 0 || f < settled) return false;
      const b = w.player.body;
      vys.push(b.vy);
      top = Math.min(top, b.y + b.h);
      return f - settled >= frames;
    },
  });
  const takeoffVy = vys[0] as number;
  return {
    takeoffVy,
    gravity: (vys[2] as number) - (vys[1] as number),
    apexPx: toPx(floorY - top),
    maxSink: Math.max(...vys),
    vys,
  };
}

describe('floor jumpers (SW-C2, SW-C3)', () => {
  const heroes: [CharacterDef, number][] = [
    [LINK, 123],
    [SAMUS, 154],
    [SIMON, 104],
    [MEGAMAN, 154],
    [BILL, 149],
    [RYU, 78],
  ];
  for (const [base, apex] of heroes) {
    it(`${base.id}: take-off, water gravity, apex ≈ ${apex} px, sink cap`, () => {
      const sw = CLASSIC_SWIM[base.id];
      expect(sw?.floorJumpOnly).toBe(true);
      const arc = floorJump(classicStandIn(base));
      // The first recorded speed is after the take-off frame's gravity (moves first, then gravity).
      expect(arc.takeoffVy).toBe(-(sw?.stroke ?? 0) + (sw?.gravity ?? 0));
      expect(arc.gravity).toBe(sw?.gravity);
      expect(Math.abs(arc.apexPx - apex)).toBeLessThanOrEqual(3);
      expect(arc.maxSink).toBeLessThanOrEqual(0x02155);
    });
  }

  it('Link: presses in mid-water do nothing (no stroke)', () => {
    const def = classicStandIn(LINK);
    let settled = -1;
    let jumps = 0;
    let wasUp = false;
    runSim({
      level: deepWater(),
      character: def,
      rules: 'classic',
      script: none,
      maxFrames: 400,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (settled < 0 && f > 5 && w.player.body.onGround) settled = f;
        if (settled < 0) return [];
        // A tap every 6 frames, on the floor and in mid-water alike.
        return (f - settled) % 6 < 2 ? ['jump'] : [];
      },
      until: (w) => {
        const up = w.player.body.vy < -0x03000;
        if (up && !wasUp) jumps++;
        wasUp = up;
        return false;
      },
    });
    // One floor jump, then nothing until he is back on the floor (about 120 frames later).
    expect(jumps).toBeGreaterThanOrEqual(1);
    expect(jumps).toBeLessThanOrEqual(3);
  });

  it('Simon: one air jump under water, a third press does nothing', () => {
    const def = classicStandIn(SIMON);
    let settled = -1;
    let takeoffs = 0;
    let prev = 0;
    runSim({
      level: deepWater(),
      character: def,
      rules: 'classic',
      script: none,
      maxFrames: 300,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (settled < 0 && f > 5 && w.player.body.onGround) settled = f;
        if (settled < 0) return [];
        const t = f - settled;
        return t < 2 || (t >= 20 && t < 22) || (t >= 40 && t < 42) ? ['jump'] : [];
      },
      until: (w, f) => {
        const vy = w.player.body.vy;
        // A take-off: the speed jumps up by more than gravity could.
        if (vy < prev - 0x01000) takeoffs++;
        prev = vy;
        return settled >= 0 && f - settled > 60;
      },
    });
    expect(takeoffs).toBe(2);
  });

  it('Mega Man slides under water as on land', () => {
    const slide = (level: ReturnType<typeof deepWater>) => {
      let settled = -1;
      let x0 = 0;
      let x1 = 0;
      let sliding = 0;
      runSim({
        level,
        character: classicStandIn(MEGAMAN),
        rules: 'classic',
        script: none,
        maxFrames: 300,
        assist: { invulnerable: true },
        controller: (w, f) => {
          const p = w.player;
          if (settled < 0 && f > 5 && p.body.onGround) {
            settled = f;
            x0 = p.body.x;
          }
          if (settled < 0) return [];
          return f - settled < 3 ? ['down', 'jump'] : [];
        },
        until: (w, f) => {
          if (w.player.sliding > 0) sliding++;
          x1 = w.player.body.x;
          return settled >= 0 && f - settled > 60;
        },
      });
      return { dist: toPx(x1 - x0), sliding };
    };
    const water = slide(deepWater());
    const land = slide(
      parseTextMap(
        ['id: dry', 'time: 300', 'start: 4,12', '', '[tiles]', ...Array(13).fill('.'.repeat(48)), '#'.repeat(48), '#'.repeat(48)].join('\n'),
      ),
    );
    expect(water.sliding).toBeGreaterThan(20);
    expect(water.dist).toBe(land.dist);
  });
});

describe('Mario and Luigi stroke; the surface line (SW-C1, SW-C9, SW-C10)', () => {
  it('Classic Mario strokes at 1.6667 px/f anywhere below the line', () => {
    const def = classicStandIn(MARIO);
    const vys: number[] = [];
    runSim({
      level: deepWater(),
      character: def,
      rules: 'classic',
      script: none,
      maxFrames: 120,
      assist: { invulnerable: true },
      // Taps in mid-water as he sinks (never on the floor yet).
      controller: (_w, f) => (f % 10 === 5 ? ['jump'] : []),
      until: (w, f) => {
        if (f % 10 === 5) vys.push(w.player.body.vy);
        return false;
      },
    });
    // After the stroke frame's move, one frame of water gravity has been added.
    for (const vy of vys.slice(1)) expect(vy).toBe(-0x01aab + 0x000c7);
  });

  it('above the line strokes do nothing and gravity is 0.09722 px/f² (Luigi)', () => {
    const vys: number[] = [];
    let pressedAbove = 0;
    runSim({
      level: deepWater(6),
      character: classicStandIn(LUIGI),
      rules: 'classic',
      script: none,
      maxFrames: 300,
      assist: { invulnerable: true },
      controller: (w, f) => {
        const press = f % 4 === 0;
        if (press && w.player.aboveWater) pressedAbove++;
        return press ? ['jump'] : [];
      },
      until: (w) => {
        if (w.player.aboveWater && !w.player.body.onGround) vys.push(w.player.body.vy);
        else if (vys.length) vys.length = vys.length >= 4 ? vys.length : 0;
        return vys.length >= 4;
      },
    });
    expect(pressedAbove).toBeGreaterThan(0);
    for (let i = 1; i < 4; i++) expect((vys[i] as number) - (vys[i - 1] as number)).toBe(0x0018e);
  });

  it('the line is the hitbox top at y = 32: the same for small and big Mario', () => {
    for (const power of ['small', 'big'] as const) {
      let prevY: number | null = null;
      let outs = 0;
      let ins = 0;
      runSim({
        level: deepWater(6),
        character: classicStandIn(MARIO),
        rules: 'classic',
        state: { powerState: power },
        script: none,
        maxFrames: 400,
        assist: { invulnerable: true },
        controller: (_w, f) => (f % 4 === 0 ? ['jump'] : []),
        until: (w) => {
          const p = w.player;
          // inWater is set from where the body was when the frame began.
          if (prevY !== null) {
            expect(p.inWater, `${power} top ${toPx(prevY)}`).toBe(prevY > px(32));
            if (p.inWater) ins++;
            else outs++;
          }
          prevY = p.body.y;
          return false;
        },
      });
      expect(outs).toBeGreaterThan(0);
      expect(ins).toBeGreaterThan(0);
    }
  });

  it('above the line Link falls with his land gravity, capped at 4.1667 px/f (SW-C10)', () => {
    const def = classicStandIn(LINK);
    const vys: number[] = [];
    runSim({
      level: deepWater(),
      character: def,
      rules: 'classic',
      // Dropped in above the line.
      start: { x: 4, y: 0, mode: 'stand' },
      script: none,
      maxFrames: 40,
      assist: { invulnerable: true },
      until: (w) => {
        if (w.player.aboveWater) vys.push(w.player.body.vy);
        return false;
      },
    });
    if (vys.length >= 3) expect((vys[2] as number) - (vys[1] as number)).toBe(0x002e4);
    for (const v of vys) expect(v).toBeLessThanOrEqual(0x042ab);
  });
});

describe('no stomp under water (SW-C7)', () => {
  /** Big Mario drops onto a Goomba on the floor of a water room. */
  const dropOn = (def: CharacterDef, rules: 'classic' | 'current') => {
    let goomba: Goomba | null = null;
    const r = runSim({
      level: deepWater(12),
      character: def,
      rules,
      state: { powerState: 'big' },
      script: none,
      maxFrames: 200,
      controller: (w, f) => {
        if (f === 1) {
          goomba = new Goomba(px(8 * 16 + 2), px(12 * 16 - 14));
          w.spawn(goomba);
          w.player.body.y = px(100);
          w.player.body.vy = 0;
        }
        const g = goomba as Goomba | null;
        if (g?.alive) {
          g.body.vx = 0;
          w.player.body.x = g.body.x;
        }
        return [];
      },
      until: () => false,
    });
    return { power: r.world.player.powerState, goombaAlive: (goomba as Goomba | null)?.alive ?? true };
  };

  it('Classic Mario landing on a Goomba under water is hurt and the Goomba lives', () => {
    const r = dropOn(classicStandIn(MARIO), 'classic');
    expect(r.power).toBe('small');
    expect(r.goombaAlive).toBe(true);
  });

  it('Current Mario still stomps under water', () => {
    const r = dropOn(MARIO, 'current');
    expect(r.power).toBe('big');
    expect(r.goombaAlive).toBe(false);
  });
});

describe('Current swimming is unchanged (TG-27)', () => {
  it('Current Link still strokes in mid-water with his own swim numbers', () => {
    const vys: number[] = [];
    runSim({
      level: deepWater(),
      character: LINK,
      script: none,
      maxFrames: 60,
      assist: { invulnerable: true },
      controller: (_w, f) => (f === 30 ? ['jump'] : []),
      until: (w, f) => {
        if (f === 30) vys.push(w.player.body.vy);
        return false;
      },
    });
    const sw = LINK.movement.swim;
    expect(vys[0]).toBe(-(sw?.stroke ?? 0) + (sw?.gravity ?? 0));
  });

  it('no Current def sets a Classic swim field', () => {
    for (const d of [MARIO, LUIGI, LINK, SAMUS, SIMON, MEGAMAN, BILL, RYU]) {
      const sw = d.movement.swim;
      expect(sw?.floorJumpOnly, d.id).toBeUndefined();
      expect(sw?.noStomp, d.id).toBeUndefined();
      expect(sw?.surfaceTest, d.id).toBeUndefined();
      expect(sw?.surface, d.id).toBeUndefined();
    }
  });
});

describe('stepping stones for floor jumpers (SW-C12, TG-45)', () => {
  const at = (w: World, x: number, y: number) => w.map.get(x, y);
  const world = (def: CharacterDef, rules: 'classic' | 'current', id = '2-2') =>
    runSim({ level: getLevel(id), character: def, rules, script: none, maxFrames: 1 }).world;

  it('Classic Link in 2-2 has the coral at (134, 13) and the coins moved up', () => {
    const w = world(classicStandIn(LINK), 'classic');
    for (const [x, y] of FLOOR_JUMPER_EDITS['2-2']?.blocks ?? []) expect(at(w, x, y)).toBe(T.HARD);
    for (const x of [159, 160, 161]) {
      expect(at(w, x, 11)).toBe(T.COIN);
      expect(at(w, x, 12)).not.toBe(T.COIN);
    }
  });

  it('Classic Link in 7-2 has its nine cells', () => {
    const w = world(classicStandIn(LINK), 'classic', '7-2');
    for (const [x, y] of FLOOR_JUMPER_EDITS['7-2']?.blocks ?? []) expect(at(w, x, y)).toBe(T.HARD);
    expect(at(w, 68, 13)).toBe(T.HARD);
  });

  it('Classic Mario, Current Link and Current Mario get the map as it is', () => {
    const plain = new TileMap(getLevel('2-2'));
    for (const w of [world(classicStandIn(MARIO), 'classic'), world(LINK, 'current'), world(MARIO, 'current')]) {
      expect(at(w, 134, 13)).toBe(plain.get(134, 13));
      expect(at(w, 134, 13)).not.toBe(T.HARD);
      expect(at(w, 160, 12)).toBe(T.COIN);
    }
  });

  it('Link under Classic rules with no Classic def yet (a Current def) gets no stones', () => {
    // heroFor returns the Current def while Link has no classic.ts (TG-20): not a floor jumper.
    expect(at(world(LINK, 'classic'), 134, 13)).not.toBe(T.HARD);
  });

  it('applies only to the listed levels', () => {
    const m = new TileMap(getLevel('1-1'));
    const before = Array.from(m.tiles);
    expect(applyClassicLevelEdits(m, '1-1', [classicStandIn(LINK)])).toBe(false);
    expect(Array.from(m.tiles)).toEqual(before);
  });

  it('Classic Link crosses the 2-2 gap at columns 131-139 by floor jumps', () => {
    const r = runSim({
      level: getLevel('2-2'),
      character: classicStandIn(LINK),
      rules: 'classic',
      script: none,
      maxFrames: 900,
      assist: { invulnerable: true },
      start: { x: 126, y: 12, mode: 'stand' },
      controller: (w, f) => (w.player.body.onGround && f % 4 < 2 ? ['right', 'jump'] : ['right']),
      until: (w) => toPx(w.player.body.x) > 141 * 16 || w.player.dead,
    });
    expect(r.world.player.dead).toBe(false);
    expect(r.playerX).toBeGreaterThan(141 * 16);
  });
});
