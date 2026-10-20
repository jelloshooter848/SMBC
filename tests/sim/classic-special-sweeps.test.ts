import { describe, expect, it } from 'vitest';
import { getLevel, specialLevelIds } from '@content/levels';
import { px, toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { layeredLevel, layerFlags } from '@game/level/layers';
import { isSwimLevel, type LevelData, type Zone } from '@game/level/schema';
import { heroFor } from '@game/characters/registry';
import type { TileMap } from '@game/world/tilemap';
import { FALL_IN_STEER_Y } from '@game/world/world';
import type { WorldStart } from '@game/world/world';
import { drops, dropSim } from './safety-floor-bot';
import { waterBot } from './water-bot';

// G-020: the campaign's sweeps (fall-arrival, safety-floor-sweep, water-routes) read the
// campaign's level ids only; these are the same sweeps over Super Mario Bros. Special's areas
// (specialLevelIds), played under Classic rules as Classic mode plays them. Findings that are the
// original's own level design are listed with the reason. QA (0.5.0 batch 4): Special's bonus
// rooms are closed above, so a fall from row 0 (SMB1's rooms have a ceiling gap) landed the hero
// on the ceiling: a pipe in now comes out of the room's matching pipe end, a vine arrival lands at
// the room's playerStart (convert-smbc.mjs).

const SPECIAL = () => specialLevelIds();

/** Every way into another Special area: its zone and where it lands. */
function entries(): { from: string; zone: Zone; level: string; start: WorldStart }[] {
  const out: { from: string; zone: Zone; level: string; start: WorldStart }[] = [];
  for (const id of SPECIAL()) {
    for (const z of getLevel(id).zones) {
      if (z.kind !== 'pipe' && z.kind !== 'vine') continue;
      const t = z.target as { level: string; x: number; y: number; exitDir?: string };
      const target = getLevel(t.level);
      const dir = t.exitDir ?? (z.kind === 'vine' ? 'climb' : 'none');
      const mode =
        dir === 'up'
          ? 'pipe-exit'
          : dir === 'fall' || dir === 'climb' || dir === 'stand'
            ? dir
            : target.startMode;
      out.push({ from: id, zone: z, level: t.level, start: { x: t.x, y: t.y, mode } as WorldStart });
    }
  }
  return out;
}

/** Air cells reachable from `(x, y)` (4-way, through anything not solid). */
function reach(map: TileMap, x: number, y: number): Set<string> {
  const seen = new Set<string>();
  const todo = [[x, y]];
  while (todo.length) {
    const [cx, cy] = todo.pop() as [number, number];
    const k = `${cx},${cy}`;
    if (seen.has(k) || cx < 0 || cy < 0 || cx >= map.width || cy >= map.height) continue;
    if (map.isSolid(cx, cy)) continue;
    seen.add(k);
    todo.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return seen;
}

describe('G-020: every way into a Special bonus room puts the hero inside it', () => {
  const bonus = entries().filter((e) => /-bonus\d?$/.test(e.level));

  it('finds the bonus rooms, pipes and the 4-3 vine', () => {
    const ids = new Set(bonus.map((e) => e.level));
    for (const id of ['sp-3-3-bonus', 'sp-4-3-bonus', 'sp-6-3-bonus', 'sp-7-1-bonus'])
      expect(ids).toContain(id);
    expect(bonus.some((e) => e.zone.kind === 'vine' && e.level === 'sp-4-3-bonus')).toBe(true);
  });

  it('lands under the room ceiling, on its floor, and can reach the way out', () => {
    const bad: string[] = [];
    for (const e of bonus)
      for (const def of [MARIO, LINK]) {
        const level = getLevel(e.level);
        const r = runSim({
          level,
          character: def,
          rules: 'classic',
          script: { steps: [] },
          start: { ...e.start, time: 300 },
          maxFrames: 400,
          assist: { invulnerable: true },
          until: (w) => w.player.body.onGround && !w.player.frozen && w.frame > 30,
        });
        const w = r.world;
        const b = w.player.body;
        const where = `${e.from} ${e.zone.kind} ${e.zone.x} -> ${e.level} ${def.id}`;
        const tx = toPx(b.x + (b.w >> 1)) >> 4;
        const ty = (toPx(b.y + b.h) - 1) >> 4;
        if (!b.onGround) bad.push(`${where}: never landed (y=${toPx(b.y)})`);
        // Inside the room, not on its roof: a ceiling above him, or down on the floor rows (an
        // SMB1-style room's drop gap in the ceiling is open above its column).
        let roofed = false;
        for (let y = ty - 1; y >= 0 && !roofed; y--) roofed = w.map.isSolid(tx, y);
        if (!roofed && ty < 11) bad.push(`${where}: on the roof at ${tx},${ty}`);
        // The room's way out (a pipe zone in it) is in reach of the air he stands in.
        const air = reach(w.map, tx, ty);
        const outs = level.zones.filter((z) => z.kind === 'pipe' || z.kind === 'pit');
        const near = (z: Zone) =>
          z.kind === 'pit' ||
          ('y' in z &&
            [-1, 0, 1, 2].some((dx) =>
              [-1, 0, 1].some((dy) => air.has(`${z.x + dx},${(z as { y: number }).y + dy}`)),
            ));
        if (!outs.some(near)) bad.push(`${where}: no way out in reach`);
      }
    expect(bad).toEqual([]);
  });
});

/** Every fall arrival into a Special area (a fall start or a zone that drops into one). */
function fallArrivals(): { level: string; x: number; y: number }[] {
  const out = new Map<string, { level: string; x: number; y: number }>();
  for (const id of SPECIAL()) {
    const l = getLevel(id);
    if (l.startMode === 'fall') out.set(`${id} ${l.start.x},${l.start.y}`, { level: id, ...l.start });
  }
  for (const e of entries())
    if (e.start.mode === 'fall')
      out.set(`${e.level} ${e.start.x},${e.start.y}`, {
        level: e.level,
        x: e.start.x ?? 0,
        y: e.start.y ?? 0,
      });
  for (const id of SPECIAL())
    for (const z of getLevel(id).zones)
      if (z.kind === 'pit') out.set(`${z.target.level} ${z.target.x},${z.target.y}`, { ...z.target });
  return [...out.values()];
}

describe('G-020: every Special fall arrival (Classic rules)', () => {
  it('no hero, steering either way, lands above the room or in a wall', () => {
    const bad: string[] = [];
    for (const a of fallArrivals())
      for (const c of CHARACTERS)
        for (const hold of [[], ['left'], ['right']] as Action[][]) {
          const r = runSim({
            level: getLevel(a.level),
            character: c,
            rules: 'classic',
            script: { steps: [{ frame: 0, hold }] },
            start: { x: a.x, y: a.y, mode: 'fall', time: 300 },
            maxFrames: 400,
            assist: { invulnerable: true },
            until: (w) => w.player.body.onGround || w.player.body.y >= px(FALL_IN_STEER_Y),
          });
          const b = r.world.player.body;
          const where = `${a.level} ${a.x},${a.y} ${c.id} [${hold.join('+')}]`;
          if (toPx(b.y) < FALL_IN_STEER_Y && a.y * 16 >= FALL_IN_STEER_Y)
            bad.push(`${where}: stopped at y=${toPx(b.y)}`);
          let wall = false;
          const w = r.world;
          for (let ty = Math.max(0, toPx(b.y) >> 4); ty <= (toPx(b.y + b.h) - 1) >> 4; ty++)
            for (let tx = toPx(b.x) >> 4; tx <= (toPx(b.x + b.w) - 1) >> 4; tx++)
              if (w.map.isSolid(tx, ty)) wall = true;
          if (wall) bad.push(`${where}: in a wall`);
        }
    expect(bad).toEqual([]);
  });
});

/**
 * Safety floor drops the original's own Special level design leaves without a way out on foot:
 * pits whose only way across is a lift wider than the rim (the hero walks out on neither side).
 */
const SAFETY_ALLOWED = new Set(['sp-3-3 pit@138', 'sp-4-1 pit@223', 'sp-6-3 pit@189']);

describe('G-020: Safety floor over every Special area (Mario)', () => {
  it('caught at every rim and on every lava pool, then out onto the ground', () => {
    const failures: string[] = [];
    let n = 0;
    for (const id of SPECIAL()) {
      const level = getLevel(id);
      for (const d of drops(level)) {
        n++;
        if (SAFETY_ALLOWED.has(`${id} ${d.kind}@${d.x}`)) continue;
        let res = dropSim(level, MARIO, d, { safety: true, walkOut: true, dir: d.dirs[0] });
        if (res.died) {
          failures.push(`${id} ${d.kind}@${d.x}: died`);
          continue;
        }
        if (!res.out) res = dropSim(level, MARIO, d, { safety: true, walkOut: true, dir: d.dirs[1] });
        if (res.died || !res.out) failures.push(`${id} ${d.kind}@${d.x}: stuck`);
      }
    }
    expect(n).toBeGreaterThan(50);
    expect(failures).toEqual([]);
  });
});

/**
 * Swimming Special areas the water bot cannot finish with every hero: in sp-8-2-water the bot's
 * Mario stalls under the pillar at column 12 (its simple route search; Link gets through the same
 * water, and the way on, the side pipe at 46, is open). The original's layout, not a dead end.
 */
const WATER_ALLOWED = new Set<string>(['sp-8-2-water mario']);

describe('G-020: Special water areas, Mario and Link (the water bot)', () => {
  const swim = SPECIAL().filter((id) => isSwimLevel(getLevel(id)));

  it('finds them', () => {
    expect(swim.length).toBeGreaterThan(3);
  });

  it('the water bot gets through every one', () => {
    const failures: string[] = [];
    for (const id of swim) {
      for (const [def, power] of [
        [MARIO, 'big'],
        [LINK, 'full'],
      ] as const) {
        const r = runSim({
          level: getLevel(id),
          character: def,
          // The water bot is tuned to the shared swim (as tests/sim/water-routes.test.ts plays it).
          rules: 'current',
          state: { powerState: power },
          script: { steps: [] },
          maxFrames: 6000,
          assist: { invulnerable: true },
          controller: waterBot(),
        });
        if (WATER_ALLOWED.has(`${id} ${def.id}`)) continue;
        if (r.outcome !== 'pipe' && r.outcome !== 'cleared')
          failures.push(
            `${id} ${def.id}: ${r.outcome} at ${toPx(r.world.player.body.x) >> 4},${toPx(r.world.player.body.y) >> 4}`,
          );
      }
    }
    expect(failures).toEqual([]);
  });
});

describe('G-006 / G-010: every Special layer lays cleanly', () => {
  it('every difficulty and every Classic hero gives a level of the same size, its spawns on the map', () => {
    const flags = [
      ...new Set(
        CHARACTERS.map((c) =>
          layerFlags([heroFor(c, 'classic')])
            .sort()
            .join(','),
        ),
      ),
    ].map((s) => (s ? s.split(',') : []));
    for (const id of SPECIAL()) {
      const base: LevelData = getLevel(id);
      for (const difficulty of ['easy', 'normal', 'hard'] as const)
        for (const f of flags) {
          const l = layeredLevel(base, { difficulty, flags: f as never });
          expect(l.width, id).toBe(base.width);
          expect(l.tiles.length, id).toBe(base.tiles.length);
          // (Castle decor may start left of the map: the start castle behind the hero.)
          for (const e of l.entities)
            expect(e.x >= -8 && e.x < l.width && e.y >= -2 && e.y < 16, `${id} ${e.type} ${e.x},${e.y}`).toBe(
              true,
            );
        }
    }
  });
});
