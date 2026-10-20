import { describe, expect, it } from 'vitest';
import { getLevel, specialLevelIds } from '@content/levels';
import { px, toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import type { CharacterDef } from '@game/characters/character';
import { testLevel } from './classic-harness';
import { LINK } from '@game/characters/link';
import { layeredLevel, layerFlags } from '@game/level/layers';
import { isSwimLevel, type LevelData, type Zone } from '@game/level/schema';
import { heroFor } from '@game/characters/registry';
import { TileMap } from '@game/world/tilemap';
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

/** A map difficulty and a hero, as Classic play builds the level for them (layers). */
interface Profile {
  difficulty: 'easy' | 'normal' | 'hard';
  def: CharacterDef;
}
const BASE: Profile = { difficulty: 'normal', def: MARIO };

/** Area `id` as Classic play builds it for `profile` (its layers laid). */
const built = (id: string, profile: Profile): LevelData =>
  layeredLevel(getLevel(id), {
    difficulty: profile.difficulty,
    flags: layerFlags([heroFor(profile.def, 'classic')]),
  });

/** Every way into another Special area, for `profile`: its zone and where it lands. */
function entries(profile: Profile = BASE): { from: string; zone: Zone; level: string; start: WorldStart }[] {
  const out: { from: string; zone: Zone; level: string; start: WorldStart }[] = [];
  for (const id of SPECIAL()) {
    for (const z of built(id, profile).zones) {
      if (z.kind !== 'pipe' && z.kind !== 'vine') continue;
      const t = z.target as { level: string; x: number; y: number; exitDir?: string };
      const target = getLevel(t.level);
      const dir = t.exitDir ?? (z.kind === 'vine' ? 'climb' : 'none');
      const mode = dir === 'up' ? 'pipe-exit' : dir === 'fall' || dir === 'climb' ? dir : target.startMode;
      out.push({ from: id, zone: z, level: t.level, start: { x: t.x, y: t.y, mode } as WorldStart });
    }
  }
  return out;
}

/** How many px up `def`'s feet rise in a running jump (measured on a flat floor, Classic). */
function jumpPx(def: CharacterDef): number {
  let top = Infinity;
  let floor = 0;
  runSim({
    level: testLevel(),
    character: def,
    rules: 'classic',
    script: { steps: [] },
    maxFrames: 120,
    controller: (_w, f) => (f < 40 ? ['right', 'run'] : ['right', 'run', 'jump']),
    until: (w, f) => {
      const b = w.player.body;
      if (f === 39) floor = b.y + b.h;
      if (f >= 40) top = Math.min(top, b.y + b.h);
      return false;
    },
  });
  return toPx(floor - top);
}

/**
 * Whether a hero `h` tiles tall whose feet rise `jump` px in a jump can get from standing on cell
 * (x, y) (his feet's row) to a cell from which he takes one of the room's ways out: standing
 * cells linked by walks, drops and jumps up to `jump` px up and four tiles across, each through
 * open air above both ends. Looser than the game (nothing checks the arc), but a ledge too high for
 * his jump is never in reach.
 */
function canLeave(map: TileMap, x: number, y: number, h: number, jump: number, outs: Zone[]): boolean {
  const air = (cx: number, cy: number) => cy < 0 || (cx >= 0 && cx < map.width && !map.isSolid(cx, cy));
  const floor = (cx: number, cy: number) =>
    cy + 1 >= map.height || map.isSolid(cx, cy + 1) || map.collisionAt(cx, cy + 1) === 'top';
  const stand = (cx: number, cy: number) => {
    for (let k = 0; k < h; k++) if (!air(cx, cy - k)) return false;
    return floor(cx, cy);
  };
  const clear = (cx: number, from: number, to: number) => {
    for (let cy = Math.min(from, to) - h + 1; cy <= Math.max(from, to); cy++) if (!air(cx, cy)) return false;
    return true;
  };
  const goal = (cx: number, cy: number) =>
    outs.some((z) => {
      if (z.kind === 'pit') return cy >= map.height - 2;
      if (z.kind !== 'pipe') return false;
      if (z.dir === 'down') return (cx === z.x || cx === z.x + 1) && cy === z.y - 1;
      if (z.dir === 'right') return cx === z.x - 1 && Math.abs(cy - z.y) <= 1;
      if (z.dir === 'left') return cx === z.x + 1 && Math.abs(cy - z.y) <= 1;
      return Math.abs(cx - z.x) <= 1 && Math.abs(cy - z.y) <= 1;
    });
  const seen = new Set<string>();
  const todo: [number, number][] = [[x, y]];
  while (todo.length) {
    const [cx, cy] = todo.pop() as [number, number];
    const k = `${cx},${cy}`;
    if (seen.has(k)) continue;
    seen.add(k);
    if (goal(cx, cy)) return true;
    for (let dx = -4; dx <= 4; dx++)
      for (let ty = Math.max(0, cy - Math.floor(jump / 16)); ty < map.height; ty++) {
        const tx = cx + dx;
        if (!stand(tx, ty) || seen.has(`${tx},${ty}`)) continue;
        // Up: open air over the take-off and the landing up to the higher one; down: walk off.
        const top = Math.min(cy, ty);
        if (!clear(cx, cy, top) || !clear(tx, ty, top)) continue;
        todo.push([tx, ty]);
      }
  }
  return false;
}

/**
 * Arrivals the original's own Hard rooms make deadly: 6-2's bonus room on Hard has a two-tile pit
 * (its floor's columns 1-2 are HideOnDifficulties=hard) right under its playerStart, so the hero
 * who comes down the pipe drops into it (levelDataSpecial.xml 6-2 area b).
 */
const ARRIVAL_ALLOWED = new Set(['hard sp-6-2-bonus']);

describe('G-020: every way into a Special bonus room puts the hero inside it, with a way out', () => {
  it('finds the bonus rooms, pipes and the 4-3 vine', () => {
    const bonus = entries().filter((e) => /-bonus\d?$/.test(e.level));
    const ids = new Set(bonus.map((e) => e.level));
    for (const id of ['sp-3-3-bonus', 'sp-4-3-bonus', 'sp-6-3-bonus', 'sp-7-1-bonus'])
      expect(ids).toContain(id);
    expect(bonus.some((e) => e.zone.kind === 'vine' && e.level === 'sp-4-3-bonus')).toBe(true);
  });

  it('on Normal and Hard, for Mario and Link (his reach and vert pieces): inside, on the floor, the exit in jump reach', () => {
    const bad: string[] = [];
    for (const def of [MARIO, LINK]) {
      const jump = jumpPx(heroFor(def, 'classic'));
      expect(jump, def.id).toBeGreaterThanOrEqual(48);
      for (const difficulty of ['normal', 'hard'] as const)
        for (const e of entries({ difficulty, def }).filter((x) => /-bonus\d?$/.test(x.level))) {
          const r = runSim({
            level: getLevel(e.level),
            character: def,
            rules: 'classic',
            mapDifficulty: difficulty,
            script: { steps: [] },
            start: { ...e.start, time: 300 },
            maxFrames: 400,
            assist: { invulnerable: true },
            until: (w) => w.player.body.onGround && !w.player.frozen && w.frame > 30,
          });
          const w = r.world;
          const b = w.player.body;
          const where = `${difficulty} ${e.from} ${e.zone.kind} ${e.zone.x} -> ${e.level} ${def.id}`;
          if (ARRIVAL_ALLOWED.has(`${difficulty} ${e.level}`)) continue;
          const tx = toPx(b.x + (b.w >> 1)) >> 4;
          const ty = (toPx(b.y + b.h) - 1) >> 4;
          if (!b.onGround) bad.push(`${where}: never landed (y=${toPx(b.y)})`);
          // Inside the room, not on its roof: his feet below the room's ceiling row (its highest
          // solid row; an SMB1-style room's drop gap in it is open above his column).
          let ceiling = w.map.height;
          for (let x = 0; x < w.map.width; x++)
            for (let y = 0; y < ceiling; y++) if (w.map.isSolid(x, y)) ceiling = y;
          if (ty <= ceiling) bad.push(`${where}: on the roof at ${tx},${ty}`);
          const outs = w.level.zones.filter((z) => z.kind === 'pipe' || z.kind === 'pit');
          const h = Math.ceil(toPx(b.h) / 16);
          if (!canLeave(w.map, tx, ty, h, jump, outs))
            bad.push(`${where}: no way out in jump reach from ${tx},${ty}`);
        }
    }
    expect(bad).toEqual([]);
  });

  it("the check sees a trap: from the floor of 4-3's room (5,12), the exit is out of Link's jump", () => {
    // The old arrival (playerStart, before the numbered vine): the room as Normal builds it for a
    // hero without the vert pieces, whose exit pipe top (16,8) is 80 px over the floor. Link's
    // feet rise 66 px; Mario's 83 (a full running jump).
    const level = getLevel('sp-4-3-bonus');
    const map = new TileMap(level);
    const outs = level.zones.filter((z) => z.kind === 'pipe');
    expect(canLeave(map, 5, 12, 2, jumpPx(heroFor(LINK, 'classic')), outs)).toBe(false);
    expect(canLeave(map, 5, 12, 1, jumpPx(heroFor(MARIO, 'classic')), outs)).toBe(true);
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
 * Safety floor drops whose way out is not beside the pit: from the rim floor the hero gets out
 * only by walking right on to the flagpole (the drop test wants real ground beside the pit, not
 * the goal). sp-4-1's pit at 223 is the gap before the flag; sp-3-3's (138) and sp-6-3's (189)
 * lead across wide lift gaps to the flag stretch. Checked by hand (QA, 0.5.0 batch 4).
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
