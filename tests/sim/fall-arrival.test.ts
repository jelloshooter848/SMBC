import { describe, expect, it } from 'vitest';
import { RESTYLES_SEEN } from './story-seen';
import { getLevel, levelIds } from '@content/levels';
import { px, toPx } from '@engine/math/units';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { campaignLevel } from '@game/level/campaign';
import { MAP_EXIT } from '@game/level/schema';
import type { LevelScene } from '@game/scenes/level';
import { FALL_IN_STEER_Y } from '@game/world/world';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';
import { file, makeGame, useStorage } from './heroes-harness';

// A fall arrival (a bonus room's pipe, a pit, a descent, a teleport's `exit=fall`) drops each
// hero straight down his start column: steering does nothing until his head is below the room's
// ceiling row (FALL_IN_STEER_Y) or he lands. QA 0.4.8: walking back left onto 6-2's pipe at 19
// and going down with left still held drifted Link over the bonus room's left wall, and he landed
// on its top (column 0, row 2), above the room in the HUD band.

useStorage();

const hero = (id: string) => CHARACTERS.find((c) => c.id === id) as (typeof CHARACTERS)[number];
/** The px x a hero of width `w` starts a fall arrival at in column `tx` (centred in the tile). */
const startX = (tx: number, w: number) => tx * 16 + ((16 - w) >> 1);
/** Whether the body overlaps a solid tile. */
const inWall = (w: World) => {
  const b = w.player.body;
  for (let ty = Math.max(0, toPx(b.y) >> 4); ty <= (toPx(b.y + b.h) - 1) >> 4; ty++)
    for (let tx = toPx(b.x) >> 4; tx <= (toPx(b.x + b.w) - 1) >> 4; tx++)
      if (w.map.isSolid(tx, ty)) return true;
  return false;
};

describe('6-2: down the pipe at 19 after stepping back left onto it', () => {
  for (const id of ['mario', 'link', 'samus', 'ryu']) {
    it(`${id} lands in the bonus room at column 1, on its floor, not on the left wall`, () => {
      const h = makeGame();
      file({
        story: [...RESTYLES_SEEN],
        cleared: ['1-0', '6-1'],
        pages: ['smb-1', 'smb-6'],
        position: { page: 'smb-6', node: '6-2' },
        freed: CHARACTERS.map((c) => c.id),
      });
      h.game.openFile(1);
      h.game.state.character = hero(id);
      h.game.startLevel(getLevel('6-2'), { mode: 'stand' });
      h.step();
      const w = (h.top() as LevelScene).world;
      const p = w.player;
      w.assist.invulnerable = true;
      // QA's route: back left onto the pipe (from its right edge, walking left), DOWN; left is
      // pressed again while he sinks (the walk back) and is still held as the room loads.
      p.body.x = px(21 * 16 - 6);
      p.body.y = px(9 * 16) - p.body.h;
      p.body.vx = -px(1);
      p.body.vy = 0;
      p.facing = -1;
      let phase: 'back' | 'down' | 'sink' = 'back';
      let held = 0;
      for (let f = 0; f < 600; f++) {
        const l = h.top() as LevelScene;
        if (l.level.id !== '6-2') {
          if (held++ < 12) h.step(['left']);
          else break;
          continue;
        }
        const x = toPx(p.body.x);
        if (phase === 'back' && p.body.onGround && x >= 19 * 16 && x + toPx(p.body.w) <= 21 * 16)
          phase = 'down';
        if (phase === 'down' && w.inPipe) phase = 'sink';
        h.step(phase === 'back' ? ['left'] : phase === 'down' ? ['down'] : ['left']);
      }
      const l = h.top() as LevelScene;
      expect(l.level.id).toBe('6-2-bonus');
      const q = l.world.player;
      // He drops straight down the start column, so nothing he holds over the transfer moves him.
      expect(toPx(q.body.x)).toBe(startX(1, toPx(q.body.w)));
      h.until(() => q.body.onGround, 200);
      expect(toPx(q.body.y + q.body.h)).toBe(13 * 16); // the room's floor
      expect(toPx(q.body.x)).toBe(startX(1, toPx(q.body.w)));
      expect(Math.floor(toPx(q.centerX) / 16)).toBe(1);
    });
  }
});

/** Every fall arrival in the game: a level's own fall start and every zone that drops into one. */
function fallArrivals(): { level: string; x: number; y: number }[] {
  const out = new Map<string, { level: string; x: number; y: number }>();
  for (const id of levelIds()) {
    const l = getLevel(id);
    if (l.startMode === 'fall') out.set(`${id} ${l.start.x},${l.start.y}`, { level: id, ...l.start });
    for (const z of campaignLevel(l, () => true).zones) {
      if (!('target' in z) || !z.target) continue;
      const t = z.target as { level: string; x: number; y: number; exitDir?: string };
      // The Top Secret Area's pipe leads back to the map, into no level.
      if (t.level === MAP_EXIT) continue;
      const fall =
        z.kind === 'pit' || z.kind === 'descent'
          ? true
          : z.kind === 'pipe' || z.kind === 'teleport'
            ? t.exitDir === 'fall' || (!t.exitDir && getLevel(t.level).startMode === 'fall')
            : false;
      if (fall) out.set(`${t.level} ${t.x},${t.y}`, { level: t.level, x: t.x, y: t.y });
    }
  }
  return [...out.values()];
}

describe('every fall arrival', () => {
  const arrivals = fallArrivals();

  it('covers the bonus rooms, pits and descents', () => {
    const ids = arrivals.map((a) => a.level);
    for (const id of ['1-1-bonus', '6-2-bonus', '4-2-cavern', '5-4-dungeon', 'll-1-1-bonus'])
      expect(ids).toContain(id);
  });

  it('no hero, steering either way all through the drop, lands above the room (on a wall or ceiling top)', () => {
    const bad: string[] = [];
    for (const a of arrivals) {
      const level = campaignLevel(getLevel(a.level), () => true);
      for (const c of CHARACTERS)
        for (const hold of [[], ['left'], ['right'], ['left', 'jump']] as Action[][]) {
          const r = runSim({
            level,
            character: c,
            script: { steps: [{ frame: 0, hold }] },
            start: { x: a.x, y: a.y, mode: 'fall', time: 300 },
            maxFrames: 400,
            assist: { invulnerable: true },
            until: (w) => w.player.body.onGround || w.player.body.y >= px(FALL_IN_STEER_Y),
          });
          const w = r.world;
          const b = w.player.body;
          const where = `${a.level} ${a.x},${a.y} ${c.id} [${hold.join('+')}]`;
          // His head reaches the room below the ceiling row: he never stood or clung up there.
          if (toPx(b.y) < FALL_IN_STEER_Y) bad.push(`${where}: stopped at y=${toPx(b.y)}`);
          if (inWall(w)) bad.push(`${where}: in a wall`);
          // Until then he dropped straight down his start column.
          if (toPx(b.x) !== startX(a.x, toPx(b.w))) bad.push(`${where}: drifted to x=${toPx(b.x)}`);
        }
    }
    expect(bad).toEqual([]);
  });
});
