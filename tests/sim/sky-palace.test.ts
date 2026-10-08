import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { px, toPx } from '@engine/math/units';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { campaignLevel } from '@game/level/campaign';
import { TALK_REACH_PX } from '@game/entities/objects/captive';
import { autoPlayer, newBot } from '@game/sim/bot';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';

// 0.4.24: Link's sky palace (2-1-sky2). Up the vine from the coin heaven, across the sky stair of
// palace blocks, through the gate into the hall, up the altar to Link (column 52, standing on the
// altar's top in row 9), down the far steps and out over the balcony's edge, which drops into 2-1
// at column 162. Every hero, small and big, makes the whole trip.

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const LINK = { x: 52, feet: 9 * 16 };
const BACK = { level: '2-1', x: 162, y: 0, exitDir: 'fall' };

/** Where Captive.inReach would show TALK: on the ground on the altar's top, within reach of Link. */
const inReach = (w: World): boolean => {
  const b = w.player.body;
  const cx = b.x + (b.w >> 1);
  return (
    b.onGround &&
    Math.abs(toPx(b.y + b.h) - LINK.feet) <= 8 &&
    Math.abs(cx - px(LINK.x * 16 + 8)) <= px(TALK_REACH_PX)
  );
};

describe("the sky palace: every hero reaches Link and gets back to 2-1", () => {
  it.each(
    CHARACTERS.flatMap((c) => (['small', 'big'] as const).map((p) => [`${c.name} (${p})`, c, p] as const)),
  )('%s climbs in by the vine, stops by Link on the altar, then goes on and drops into 2-1', (_n, c, power) => {
    const bot = newBot();
    let metAt = -1;
    let waited = 0;
    const r = runSim({
      level: campaignLevel(getLevel('2-1-sky2')),
      character: c,
      state: { powerState: power },
      script: none,
      start: { time: 300 },
      maxFrames: 4000,
      controller: (w, f) => {
        const p = w.player;
        if (p.vine || p.frozen) return [];
        if (metAt < 0) {
          if (inReach(w)) metAt = f;
          // Up to Link: the bot, letting go of right once it stands in reach.
          else return autoPlayer(w, bot);
        }
        // A moment in reach (where TALK would start his round), then on to the drop.
        if (waited < 30) {
          waited++;
          expect(inReach(w), `${c.name} stays by Link`).toBe(true);
          return [];
        }
        return autoPlayer(w, bot);
      },
    });
    expect(metAt, `${c.name} (${power}) reached Link`).toBeGreaterThan(0);
    expect(r.world.player.dead).toBe(false);
    expect(r.outcome, `${c.name} (${power}) got back`).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({ target: BACK });
    expect(r.playerX).toBeGreaterThan(69 * 16); // off the balcony's end, not through the hall's gap
  });

  it.each(CHARACTERS.map((c) => [c.name, c] as const))(
    '%s starting beside Link (as after his round) walks on to the drop',
    (_n, c) => {
      const bot = newBot();
      const r = runSim({
        level: campaignLevel(getLevel('2-1-sky2')),
        character: c,
        script: none,
        start: { x: 51, y: 8, mode: 'stand', time: 200 },
        maxFrames: 1500,
        controller: (w) => autoPlayer(w, bot),
      });
      expect(r.outcome).toBe('pipe');
      expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({ target: BACK });
      expect(r.world.time).toBeGreaterThan(150);
    },
  );
});
