import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { campaignLevel } from '@game/level/campaign';
import { autoPlayer, newBot } from '@game/sim/bot';
import type { Action } from '@engine/input/actions';
import { byLink, settledByLink, toLink, walker } from './sky-palace-way';

// 0.4.24: Link's sky palace (2-1-sky2). Up the vine from the coin heaven, across the sky stair of
// palace blocks, through the gate into the hall, over the gap in its floor, up the altar to Link
// (column 52, standing on the altar's top in row 9), down the far steps and out over the
// balcony's edge, which drops into 2-1 at column 162. Every hero, small and big, makes the trip.

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const BACK = { level: '2-1', x: 162, y: 0, exitDir: 'fall' };
const level = () => campaignLevel(getLevel('2-1-sky2'));

describe('the sky palace: every hero reaches Link and gets back to 2-1', () => {
  it.each(
    CHARACTERS.flatMap((c) => (['small', 'big'] as const).map((p) => [`${c.name} (${p})`, c, p] as const)),
  )('%s climbs in by the vine, stops by Link on the altar, then goes on and drops into 2-1', (_n, c, power) => {
    const way = { hold: 0 };
    let metAt = -1;
    let waited = 0;
    const r = runSim({
      level: level(),
      character: c,
      state: { powerState: power },
      script: none,
      start: { time: 300 },
      maxFrames: 4000,
      controller: (w, f) => {
        const p = w.player;
        if (p.vine || p.frozen) return [];
        if (metAt < 0) {
          if (settledByLink(p.body)) metAt = f;
          else return toLink(p.body, w.map, way);
        }
        // Stand there a moment (where TALK would start his round), then on to the drop.
        if (waited < 30) {
          if (++waited === 30) expect(byLink(p.body), `${c.name} stands by Link`).toBe(true);
          return p.body.vx > 0 ? ['left'] : [];
        }
        return walker(p.body, w.map, way);
      },
    });
    expect(metAt, `${c.name} (${power}) reached Link`).toBeGreaterThan(0);
    expect(r.world.player.dead).toBe(false);
    expect(r.outcome, `${c.name} (${power}) got back`).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({ target: BACK });
    expect(r.playerX).toBeGreaterThan(69 * 16); // off the balcony's end, not through the hall's gap
  });

  it.each(CHARACTERS.map((c) => [c.name, c] as const))(
    '%s starting beside Link (as after his round): the run-right bot takes him on to the drop',
    (_n, c) => {
      const bot = newBot();
      const r = runSim({
        level: level(),
        character: c,
        script: none,
        start: { x: 51, y: 8, mode: 'stand', time: 200 },
        maxFrames: 1500,
        controller: (w) => autoPlayer(w, bot),
      });
      expect(r.outcome).toBe('pipe');
      expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({ target: BACK });
      expect(r.playerX).toBeGreaterThan(69 * 16);
      expect(r.world.time).toBeGreaterThan(150);
    },
  );
});
