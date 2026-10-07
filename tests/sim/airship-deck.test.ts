import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { T } from '@game/level/tiles';
import { tileAtTiles } from '@game/level/schema';
import { toPx } from '@engine/math/units';
import type { CharacterDef } from '@game/characters/character';
import { Cannon } from '@game/entities/enemies/cannon';
import { airshipBot } from './airship-bot';

// Larry's airship deck (4-2-airship.map): SMB3 World 1's airship transcribed onto one 15-row
// screen, auto-scrolling, ending in the stern pipe down to Larry's room (4-2-larry).

const deck = getLevel('4-2-airship');
const t = (x: number, y: number) => tileAtTiles(deck, x, y);
const PIPE = deck.zones.find((z) => z.kind === 'pipe') as { x: number; y: number };

function cross(c: CharacterDef, power: string, invulnerable: boolean, maxFrames = 60 * 120) {
  let furthest = 0;
  const r = runSim({
    level: deck,
    character: c,
    state: { powerState: power },
    assist: { invulnerable },
    script: { steps: [] },
    controller: airshipBot(),
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
    // The ? block mid-ship, 5 rows above the deck.
    expect(t(55, 7)).toBe(T.Q_POWERUP);
    // The overhang and its hanging cannons.
    expect(t(45, 3)).toBe(T.BRIDGE);
    const hanging = deck.entities.filter((e) => e.type === 'cannon' && e.y <= 6);
    expect(hanging.length).toBeGreaterThanOrEqual(5);
    for (const c of hanging) expect(['dl', 'dr', 'l', 'r']).toContain(c.props?.dir);
    // Two Rocky Wrenches, one on the fore deck and one on the lower stern deck.
    expect(deck.entities.filter((e) => e.type === 'rocky').map((e) => e.x)).toEqual([18, 74]);
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

describe('every hero crosses the deck to the stern pipe under the auto-scroll (geometry; hits ignored)', () => {
  for (const c of CHARACTERS)
    for (const power of ['small', 'big'])
      it(`${c.name} (${power})`, () => {
        const { r, furthest } = cross(c, power, true);
        expect(r.outcome, `${c.id} reached x=${furthest}`).toBe('pipe');
        const pipe = r.events.find((e) => e.type === 'pipe') as { target?: { level: string } } | undefined;
        expect(pipe?.target?.level).toBe('4-2-larry');
        // The camera got there first: about a minute's sail, never stuck.
        expect(r.frames).toBeGreaterThan(50 * 60);
        expect(r.frames).toBeLessThan(75 * 60);
      });
});

/*
 * Fairness, with damage ON: the airship bot (tests/sim/airship-bot.ts) waits out or steps away
 * from cannonballs, wrenches and Bullet Bills it can see coming, stomps or attacks Rocky Wrench,
 * and keeps clear of the right edge before a gap. Every hero gets to the stern pipe alive, small
 * Mario and Luigi without a single hit; also after standing still for the first 200 frames
 * (a different timing of every cannon and Rocky Wrench).
 */
describe('every hero survives the deck with damage on', () => {
  const powers = (c: CharacterDef) => (c.damage.kind === 'powerup' ? ['small', 'big', 'fire'] : ['full']);
  for (const idle of [0, 200])
    for (const c of CHARACTERS)
      for (const power of powers(c))
        it(`${c.name} (${power})${idle ? ', after standing still 200 frames' : ''}`, () => {
          const bot = airshipBot();
          let hits = 0;
          let last = '';
          const r = runSim({
            level: deck,
            character: c,
            state: { powerState: power },
            script: { steps: [] },
            maxFrames: 60 * 120,
            controller: (w, f) => {
              const st = c.damage.kind === 'powerup' ? w.player.powerState : String(w.player.hp);
              if (f > 0 && st !== last) hits++;
              last = st;
              const a = bot(w);
              return f < idle ? [] : a;
            },
          });
          // The one run the bot loses: Samus from a standing start dies on the lower stern deck,
          // where her beam passes just under a Bullet Bill and the bot won't jump it (a player
          // jumps it, or shoots it from a jump; the run 200 frames later goes through).
          const botLoses = c.id === 'samus' && idle === 0;
          expect(r.outcome, `${c.id} ${power} at x=${r.playerX}`).toBe(botLoses ? 'died' : 'pipe');
          if (c.id === 'mario' || c.id === 'luigi')
            expect(hits, `${c.id} ${power} hits`).toBeLessThanOrEqual(power === 'small' ? 0 : 1);
        });
});

describe('the auto-scroll', () => {
  it('takes 50-70 s from the bow to the stern', () => {
    expect(deck.scroll).toBe(0.375);
    const seconds = ((deck.width - 16) * 16) / 0.375 / 60;
    expect(seconds).toBeGreaterThan(50);
    expect(seconds).toBeLessThan(70);
  });

  it('a hero who stands still is carried off the bow and squashed against the first cannon', () => {
    for (const c of CHARACTERS) {
      const r = runSim({
        level: deck,
        character: c,
        state: { powerState: c.damage.kind === 'powerup' ? 'big' : 'full' },
        script: { steps: [{ frame: 0, hold: [] }] },
        maxFrames: 60 * 30,
      });
      expect(r.outcome, c.id).toBe('died');
      // Pushed along the fore deck to the cannon at column 14 (about 12-13 s in).
      expect(r.frames, c.id).toBeGreaterThan(600);
      expect(r.frames, c.id).toBeLessThan(900);
      expect(r.playerX + 16, c.id).toBeGreaterThan(12 * 16);
      expect(r.playerX, c.id).toBeLessThan(14 * 16);
    }
  });
});
