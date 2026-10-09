import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { Vine } from '@game/entities/objects/vine';
import { T } from '@game/level/tiles';
import { carryTime } from '@game/scenes/level';
import { autoPlayer, newBot } from '@game/sim/bot';
import { px, toPx } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { World } from '@game/world/world';
import type { Action } from '@engine/input/actions';
import { LINK, walker } from './sky-palace-way';

// The 2-1 coin heaven's way up (owner design): past the end of the clouds (no coin
// arrow since 0.4.35) three small cloud platforms, and a hidden vine block over the middle one (71,7) whose vine
// climbs to Link's sky palace (2-1-sky2), where a drop off its balcony lands in 2-1 at column 162.

const level = (id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels/world2', `${id}.map`), 'utf8'),
    id,
  );
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

/** Platform B: cloud blocks on row 11, columns 70-72; the hidden vine block at (71, 7). */
const B = { x0: 70, x1: 72, top: 11 };
const BLOCK = { tx: 71, ty: 7 };

const feetRow = (w: World) => toPx(w.player.body.y + w.player.body.h) / 16;
const onB = (w: World) => {
  const b = w.player.body;
  const cx = toPx(b.x + (b.w >> 1)) / 16;
  return b.onGround && feetRow(w) === B.top && cx >= B.x0 && cx < B.x1 + 1;
};

/**
 * Walk right off the end of the clouds and hop from platform to platform: jump at the edge of
 * what we stand on (the floor ends at 992 px, platform A at 1088), then steer in the air toward
 * the middle of the next platform (heroes with a committed arc ignore it). Stops on platform B.
 */
function hopToB(w: World, f: number, s: { hold: number; mid: number }): Action[] {
  const b = w.player.body;
  const right = toPx(b.x + b.w);
  const cx = toPx(b.x + (b.w >> 1));
  const out: Action[] = [];
  if (b.onGround) {
    s.hold = 0;
    out.push('right');
    const onFloor = feetRow(w) === 13;
    const edge = onFloor ? 62 * 16 : 68 * 16;
    if (right >= edge - 2 && f > 2) {
      s.hold = 24;
      s.mid = onFloor ? 66.5 * 16 : (B.x0 + 1.5) * 16;
      out.push('jump');
    }
    return out;
  }
  if (s.hold > 0) {
    s.hold--;
    out.push('jump');
  }
  if (cx < s.mid - 4) out.push('right');
  else if (cx > s.mid + 4) out.push('left');
  return out;
}

describe('2-1 sky: the hidden vine block over the second to last cloud platform', () => {
  it('small Mario bumps the hidden block from the platform: it appears and a vine grows up to the sky', () => {
    const l = level('2-1-sky');
    let vine: Vine | undefined;
    const r = runSim({
      level: l,
      character: MARIO,
      script: none,
      start: { x: BLOCK.tx, y: B.top - 1, mode: 'stand' },
      maxFrames: 120,
      controller: (w, f) => {
        vine ??= w.entities.find((e): e is Vine => e instanceof Vine && e.fromBlock !== null);
        return f > 2 && f < 20 ? ['jump'] : [];
      },
      until: () => !!vine && (vine as Vine).grown,
    });
    expect(r.outcome).toBe('stopped');
    expect(r.world.map.get(BLOCK.tx, BLOCK.ty)).toBe(T.USED);
    expect((vine as Vine).fromBlock).toEqual(BLOCK);
    expect((vine as Vine).topPx).toBeLessThan(0); // up past the top of the screen
  });

  it('jumping beside the block onto the vine and climbing off the top leads to the sky ruins', () => {
    const l = level('2-1-sky');
    let vine: Vine | undefined;
    const r = runSim({
      level: l,
      character: MARIO,
      script: none,
      start: { x: BLOCK.tx, y: B.top - 1, mode: 'stand' },
      maxFrames: 900,
      controller: (w, f) => {
        if (!vine) {
          vine = w.entities.find((e): e is Vine => e instanceof Vine && e.fromBlock !== null);
          if (vine) w.player.body.x = px(B.x0 * 16 + 4); // step beside the block
          return f > 2 && f < 20 ? ['jump'] : [];
        }
        if (w.player.vine) return ['up'];
        return w.player.body.onGround ? (f % 2 ? ['jump', 'up'] : ['up']) : ['jump', 'up'];
      },
    });
    expect(vine).toBeDefined();
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
      target: { level: '2-1-sky2', x: 4, y: 14, exitDir: 'climb' },
    });
  });

  it('off the end of the clouds without a hop onto the platforms still drops back into 2-1 at 162', () => {
    const r = runSim({
      level: level('2-1-sky'),
      character: MARIO,
      script: none,
      start: { x: 59, y: 12, mode: 'stand' },
      maxFrames: 400,
      controller: () => ['right'],
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
      target: { level: '2-1', x: 162, y: 0, exitDir: 'fall' },
    });
  });

  it.each(CHARACTERS.map((c) => [c.name, c] as const))(
    '%s hops from the end of the clouds to the platform, bumps the block and gets on the vine',
    (_name, c) => {
      const l = level('2-1-sky');
      const s = { hold: 0, mid: 0 };
      const reach = runSim({
        level: l,
        character: c,
        script: none,
        start: { x: 58, y: 12, mode: 'stand' },
        maxFrames: 600,
        controller: (w, f) => hopToB(w, f, s),
        until: (w, f) => f > 5 && onB(w),
      });
      expect(reach.outcome, `${c.name} reached B`).toBe('stopped');

      // From the platform: under the block, jump; then beside it, jump onto the vine.
      let vine: Vine | undefined;
      let phase = 0;
      const climb = runSim({
        level: l,
        character: c,
        script: none,
        start: { x: BLOCK.tx, y: B.top - 1, mode: 'stand' },
        maxFrames: 1200,
        controller: (w, f) => {
          const p = w.player;
          if (!vine) {
            vine = w.entities.find((e): e is Vine => e instanceof Vine && e.fromBlock !== null);
            return f > 2 && f % 50 < 22 ? ['jump'] : [];
          }
          if (p.vine) return ['up'];
          if (p.body.w > px(16)) {
            // Sophia III's tank is too wide to jump up past the block's side: from beside it she
            // jumps up onto the used block and gets on the vine from its top.
            const feet = p.body.y + p.body.h;
            if (phase === 0 && p.body.onGround) {
              phase = 1;
              p.body.x = px(B.x0 * 16 - 4);
              return [];
            }
            if (p.body.onGround) return feet <= px(BLOCK.ty * 16) ? ['up'] : f % 2 ? ['jump'] : [];
            return feet < px(BLOCK.ty * 16) ? ['jump', 'right'] : ['jump'];
          }
          if (phase === 0 && p.body.onGround) {
            phase = 1;
            p.body.x = px(B.x0 * 16 + 4); // beside the block (now a used block)
            return [];
          }
          return p.body.onGround ? (f % 2 ? ['jump', 'up'] : ['up']) : ['jump', 'up'];
        },
      });
      expect(vine, `${c.name} revealed the vine`).toBeDefined();
      expect(climb.world.map.get(BLOCK.tx, BLOCK.ty)).toBe(T.USED);
      expect(climb.outcome, `${c.name} climbed to the ruins`).toBe('pipe');
      expect(climb.events.find((e) => e.type === 'pipe')).toMatchObject({
        target: { level: '2-1-sky2', x: 4, y: 14, exitDir: 'climb' },
      });
    },
  );
});

describe('2-1 sky palace (2-1-sky2)', () => {
  it('arrives climbing the vine, steps off onto the clouds, and going right drops into 2-1 at 162', () => {
    const bot = newBot();
    const r = runSim({
      level: level('2-1-sky2'),
      character: MARIO,
      script: none,
      start: { time: 321 },
      maxFrames: 3000,
      controller: (w) => (w.player.vine || w.player.frozen ? [] : autoPlayer(w, bot)),
    });
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
      target: { level: '2-1', x: 162, y: 0, exitDir: 'fall' },
    });
    // Crossed the whole palace first: the drop is past the balcony's end, beyond the hall.
    expect(r.playerX).toBeGreaterThan(69 * 16);
    expect(r.world.time).toBeLessThanOrEqual(321);
    expect(r.world.time).toBeGreaterThan(250);
  });

  it('the run-right bot lands from the arrival vine and crosses the whole palace to the drop', () => {
    // Outside the campaign (plain ruins, the same tiles). Not Ryu or Simon with this bot: it jumps
    // the altar's one-tile steps from right beside them, and Ryu clings to a wall he jumps into, so
    // he hangs on a step's side for good; and it takes off for the hall's two-tile gap a tile early,
    // which Simon's fixed arc does not carry. The walker below (a player's timing) takes both across.
    for (const c of CHARACTERS.filter((h) => h.id !== 'ryu' && h.id !== 'simon')) {
      const bot = newBot();
      const r = runSim({
        level: level('2-1-sky2'),
        character: c,
        script: none,
        maxFrames: 3000,
        controller: (w) => (w.player.vine || w.player.frozen ? [] : autoPlayer(w, bot)),
      });
      expect(r.playerX, c.name).toBeGreaterThan(69 * 16);
      expect(r.outcome, c.name).toBe('pipe');
      expect(
        r.events.find((e) => e.type === 'pipe'),
        c.name,
      ).toMatchObject({
        target: { level: '2-1', x: 162, y: 0, exitDir: 'fall' },
      });
    }
  });

  it.each(
    CHARACTERS.flatMap((c) => (['small', 'big'] as const).map((p) => [`${c.name} (${p})`, c, p] as const)),
  )(
    'outside the campaign, %s walks from the vine over the altar and off the balcony into 2-1',
    (_n, c, power) => {
      const way = { hold: 0 };
      let onAltar = false;
      const r = runSim({
        level: level('2-1-sky2'),
        character: c,
        state: { powerState: power },
        script: none,
        maxFrames: 3000,
        controller: (w) => {
          const p = w.player;
          if (p.vine || p.frozen) return [];
          if (p.body.onGround && toPx(p.body.y + p.body.h) === LINK.feet) onAltar = true;
          return walker(p.body, w.map, way);
        },
      });
      expect(onAltar, `${c.name} over the altar's top`).toBe(true);
      expect(r.playerX, c.name).toBeGreaterThan(69 * 16);
      expect(r.outcome, c.name).toBe('pipe');
      expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({
        target: { level: '2-1', x: 162, y: 0, exitDir: 'fall' },
      });
    },
  );

  it('the running clock carries over: coin heaven → ruins → back into 2-1', () => {
    const sky = level('2-1-sky');
    const ruins = level('2-1-sky2');
    const main = level('2-1');
    expect(carryTime(main, sky, 300)).toBe(300);
    expect(carryTime(sky, ruins, 280)).toBe(280);
    expect(carryTime(ruins, main, 260)).toBe(260);
  });
});
