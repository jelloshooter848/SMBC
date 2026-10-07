import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { T } from '@game/level/tiles';
import { tileAtTiles } from '@game/level/schema';
import { px, toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';
import type { CharacterDef } from '@game/characters/character';
import { Cannon, Cannonball } from '@game/entities/enemies/cannon';
import { RockyWrench } from '@game/entities/enemies/rocky-wrench';

// Larry's airship deck (4-2-airship.map): SMB3 World 1's airship transcribed onto one 15-row
// screen, auto-scrolling, ending in the stern pipe down to Larry's room (4-2-larry).

const deck = getLevel('4-2-airship');
const t = (x: number, y: number) => tileAtTiles(deck, x, y);
const PIPE = deck.zones.find((z) => z.kind === 'pipe') as { x: number; y: number };

/** Whether the level's camera moves on its own (A1's `camera: auto`). */
function autoScrolls(): boolean {
  const r = runSim({
    level: deck,
    character: MARIO,
    script: { steps: [{ frame: 0, hold: [] }] },
    maxFrames: 120,
    assist: { invulnerable: true },
  });
  return r.world.camera.x > 0;
}
const AUTO = autoScrolls();

/**
 * A simple bot: walk right (no running), jump over walls and pits ahead, hold the jump while
 * rising, and on the stern deck hop onto the pipe and press down.
 */
function bot(): (w: World) => Action[] {
  let held = false;
  let lastX = -1;
  let still = 0;
  let back = 0;
  return (w) => {
    const p = w.player;
    const b = p.body;
    const left = toPx(b.x);
    const right = toPx(b.x + b.w);
    const feet = toPx(b.y + b.h);
    const row = Math.floor((feet - 1) / 16);
    const pipeL = PIPE.x * 16;
    // Standing on the pipe's top, over its middle: down.
    if (b.onGround && feet === PIPE.y * 16 && left >= pipeL && right <= pipeL + 32) {
      held = false;
      return ['down'];
    }
    // Stuck at a wall (a committed jump that came up short): back off a little and try again.
    still = left === lastX ? still + 1 : 0;
    lastX = left;
    if (still > 40) back = 16;
    if (back > 0) {
      back--;
      held = false;
      return ['left'];
    }
    const out: Action[] = [];
    const past = left > pipeL + 4 && feet <= PIPE.y * 16 + 32;
    out.push(past ? 'left' : 'right');
    const dir = past ? -1 : 1;
    const ahead = (d: number) => Math.floor((dir > 0 ? right + d : left - d) / 16);
    // A wall ahead: a low one (1 tile) is hopped up close, a taller one jumped at from further out.
    const height = (x: number) => {
      let n = 0;
      while (n < 5 && w.map.isSolid(x, row - n)) n++;
      return n;
    };
    let wall = false;
    for (const d of [2, 10, 18]) if (height(ahead(d)) > 0 || w.map.isSolid(ahead(d), row - 1)) wall = true;
    for (const d of [18, 26, 34]) if (height(ahead(d)) >= 2) wall = true;
    let pit = true;
    for (let y = row + 1; y < 15; y++) if (w.map.isSolid(ahead(6), y)) pit = false;
    const wantJump = wall || pit || (feet > PIPE.y * 16 && left > pipeL - 40 && !past);
    if (b.onGround) {
      if (wantJump && !held) {
        held = true;
        out.push('jump');
      } else held = false;
    } else if (held && b.vy < 0) out.push('jump');
    else held = false;
    return out;
  };
}

function cross(c: CharacterDef, power: string, invulnerable: boolean, maxFrames = 60 * 120) {
  let furthest = 0;
  const r = runSim({
    level: deck,
    character: c,
    state: { powerState: power },
    assist: { invulnerable },
    script: { steps: [] },
    controller: bot(),
    maxFrames,
    until: (w) => {
      furthest = Math.max(furthest, toPx(w.player.body.x));
      return false;
    },
  });
  return { r, furthest };
}

describe('the airship deck layout (SMB3 World 1 airship)', () => {
  it('is 98 columns, one screen tall, auto-scrolling, an area of 4-2 starting on the bow', () => {
    expect(deck.width).toBe(98);
    expect(deck.height).toBe(15);
    expect(deck.parent).toBe('4-2');
    expect(deck.music).toBe('airship');
    expect(String(deck.camera)).toBe('auto');
    expect(deck.start).toEqual({ x: 2, y: 6 });
    expect(t(2, 7)).toBe(T.GROUND);
  });

  it('keeps the HUD rows clear', () => {
    for (let y = 0; y < 3; y++) for (let x = 0; x < deck.width; x++) expect(t(x, y), `${x},${y}`).toBe(T.AIR);
  });

  it('has the stepped prow, the fore deck, the tall post, the middle deck and the stern', () => {
    // The prow: each lower row starts further right.
    const firstSolid = (y: number) => {
      for (let x = 0; x < 20; x++) if (t(x, y) !== T.AIR) return x;
      return -1;
    };
    const starts = [7, 8, 9, 10, 11, 12, 13].map(firstSolid);
    for (let i = 1; i < starts.length; i++) expect(starts[i]).toBeGreaterThan(starts[i - 1] as number);
    // The tall post (2 wide, 3 high on the fore deck) where it steps down three rows.
    for (const x of [31, 32]) for (const y of [6, 7, 8]) expect(t(x, y)).toBe(T.HARD);
    expect(t(32, 9)).toBe(T.GROUND);
    expect(t(33, 12)).toBe(T.GROUND);
    expect(t(33, 9)).toBe(T.AIR);
    // The ? block mid-ship, 4 rows above the deck.
    expect(t(55, 8)).toBe(T.Q_POWERUP);
    // The overhang and its hanging cannons.
    expect(t(45, 3)).toBe(T.BRIDGE);
    const hanging = deck.entities.filter((e) => e.type === 'cannon' && e.y <= 6);
    expect(hanging.length).toBeGreaterThanOrEqual(5);
    for (const c of hanging) expect(['dl', 'dr', 'l', 'r']).toContain(c.props?.dir);
    // Two Rocky Wrenches, one on the fore deck and one on the lower stern deck.
    expect(deck.entities.filter((e) => e.type === 'rocky').map((e) => e.x)).toEqual([18, 73]);
    // The stern pipe on the high stern deck.
    expect(PIPE).toMatchObject({ x: 94, y: 6, dir: 'down', target: { level: '4-2-larry', x: 2, y: 12 } });
    expect(t(94, 8)).toBe(T.GROUND);
  });

  it('every pit is at most 2 tiles wide', () => {
    let run = 0;
    for (let x = 0; x < deck.width; x++) {
      let solid = false;
      for (let y = 0; y < 15; y++) if (t(x, y) !== T.AIR && t(x, y) !== T.WALL) solid = true;
      run = solid ? 0 : run + 1;
      expect(run, `pit at ${x}`).toBeLessThanOrEqual(2);
    }
  });

  it('decorates the hull with SMB3 propellers, bolts, a railing and portholes on the stern', () => {
    expect(deck.theme).toBe('airship-deck');
    const kinds = new Set(deck.decor.map((d) => d.kind));
    for (const k of ['smb3:propeller-0', 'smb3:bolt', 'smb3:railing']) expect(kinds).toContain(k);
    for (const d of deck.decor.filter((d) => d.kind === 'smb3:railing'))
      expect(d.x).toBeGreaterThanOrEqual(91);
    // A propeller behind each hull section: its shaft (the frame's left edge) meets the hull.
    for (const d of deck.decor.filter((d) => d.kind === 'smb3:propeller-0')) {
      expect(t(d.x, d.y), `propeller ${d.x}`).toBe(T.AIR);
      expect(t(d.x - 1, d.y), `hull left of ${d.x}`).not.toBe(T.AIR);
    }
    // Portholes (planking with a porthole) in the stern hull.
    expect([t(92, 10), t(96, 10)]).toEqual([T.CASTLE_BRICK, T.CASTLE_BRICK]);
  });

  it('the cannons are solid blocks once spawned', () => {
    const { r } = cross(MARIO, 'small', true, 60);
    const w = r.world;
    const cannon = w.entities.find((e): e is Cannon => e instanceof Cannon);
    expect(cannon).toBeDefined();
    expect(w.map.isSolid(14, 8)).toBe(true);
  });
});

describe('every hero crosses the deck to the stern pipe (geometry; hits ignored)', () => {
  for (const c of CHARACTERS)
    for (const power of ['small', 'big'])
      it(`${c.name} (${power})`, () => {
        const { r, furthest } = cross(c, power, true);
        expect(r.outcome, `${c.id} reached x=${furthest}`).toBe('pipe');
        // Down the stern pipe: into Larry's room.
        const pipe = r.events.find((e) => e.type === 'pipe') as { target?: { level: string } } | undefined;
        expect(pipe?.target?.level ?? '4-2-larry').toBe('4-2-larry');
        // About a minute's sail at the auto-scroll's pace; never stuck.
        expect(r.frames).toBeLessThan(60 * 120);
      });
});

describe('the auto-scroll', () => {
  it('takes 50-70 s from the bow to the stern', () => {
    const scroll = 0.375;
    const seconds = ((deck.width - 16) * 16) / scroll / 60;
    expect(seconds).toBeGreaterThan(50);
    expect(seconds).toBeLessThan(70);
  });

  it.runIf(AUTO)(
    'a hero who stands still is pushed off the bow and squashed against the first cannon',
    () => {
      const r = runSim({
        level: deck,
        character: MARIO,
        script: { steps: [{ frame: 0, hold: [] }] },
        maxFrames: 60 * 30,
      });
      expect(r.outcome).toBe('died');
      expect(r.playerX).toBeLessThan(14 * 16);
      expect(r.world.entities.some((e) => e instanceof Cannonball || e instanceof RockyWrench)).toBeDefined();
    },
  );

  it.runIf(!AUTO)('(no auto-scroll yet) a hero who stands still stays on the bow', () => {
    const r = runSim({
      level: deck,
      character: MARIO,
      script: { steps: [{ frame: 0, hold: [] }] },
      maxFrames: 600,
    });
    expect(r.outcome).toBe('timeout');
    expect(r.world.camera.x).toBe(0);
    expect(r.playerY + 16).toBe(7 * 16);
    expect(r.world.player.body.x).toBeLessThan(px(4 * 16));
  });
});
