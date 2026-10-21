import { describe, expect, it } from 'vitest';
import { getLevel, levelIds } from '@content/levels';
import { px, toPx } from '@engine/math/units';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import {
  CLASSIC_CHARACTERS,
  CLASSIC_EXTRAS,
  CLASSIC_SKINS,
  CLASSIC_SLOTS,
  heroFor,
} from '@game/characters/registry';
import type { CharacterDef } from '@game/characters/character';
import { layeredLevel, layerFlags } from '@game/level/layers';
import type { LevelData, Zone } from '@game/level/schema';
import type { TileMap } from '@game/world/tilemap';
import type { World, WorldStart } from '@game/world/world';
import type { Action } from '@engine/input/actions';
import { T, tileDef } from '@game/level/tiles';
import { testLevel } from './classic-harness';

// RC-001 (0.5.0 RC audit): on Hard, the Lost Levels' (and SMB1's) bonus rooms are closed above
// (their Hard pieces lay a ceiling and an entry pipe), so the old SMB1-style drop from row 0 left
// the hero on the roof (3-1, 5-3, 7-1, 8-2: trapped until TIME UP; 12-1, 13-2). A pipe in now
// arrives as Special's do: at the room's matching pipe end or its playerStart
// (tools/levelgen/convert-smbc.mjs dropsIn). This is classic-special-sweeps' bonus-room sweep over
// SMB1's and The Lost Levels' areas, on every difficulty and for every look. RC-022 (Hard 1-2 and
// 4-2) is re-checked by the same sweep.

interface Profile {
  difficulty: 'easy' | 'normal' | 'hard';
  def: CharacterDef;
}

const built = (id: string, profile: Profile): LevelData =>
  layeredLevel(getLevel(id), {
    difficulty: profile.difficulty,
    flags: layerFlags([heroFor(profile.def, 'classic')]),
  });

/** SMB1's and The Lost Levels' area ids (levelIds: the non-Special maps). */
const IDS = levelIds().filter((id) => /^(ll-)?\d+-\d+/.test(id));

/** Every pipe or vine into a bonus room, for `profile`: its zone and where it lands. */
function entries(profile: Profile): { from: string; zone: Zone; level: string; start: WorldStart }[] {
  const out: { from: string; zone: Zone; level: string; start: WorldStart }[] = [];
  for (const id of IDS) {
    for (const z of built(id, profile).zones) {
      if (z.kind !== 'pipe' && z.kind !== 'vine') continue;
      const t = z.target as { level: string; x: number; y: number; exitDir?: string };
      if (!/-bonus\d?$/.test(t.level)) continue;
      const target = getLevel(t.level);
      const dir = t.exitDir ?? (z.kind === 'vine' ? 'climb' : 'none');
      // As the level scene turns a pipe's exitDir into a start (scenes/level.ts).
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

/** How many px up `def`'s feet rise in a running jump (with an air jump near its top, if any). */
function jumpPx(def: CharacterDef): number {
  const rise = (second: boolean) => {
    let top = Infinity;
    let floor = 0;
    runSim({
      level: testLevel(),
      character: def,
      rules: 'classic',
      script: { steps: [] },
      maxFrames: 140,
      controller: (_w, f) =>
        f < 40 || (second && f >= 66 && f < 68) ? ['right', 'run'] : ['right', 'run', 'jump'],
      until: (w, f) => {
        const b = w.player.body;
        if (f === 39) floor = px(13 * 16);
        if (f >= 40) top = Math.min(top, b.y + b.h);
        return false;
      },
    });
    return toPx(floor - top);
  };
  return (def.movement.airJumps ?? 0) > 0 ? Math.max(rise(false), rise(true)) : rise(false);
}

/** Rush Coil's launch (classic-rush.ts: about 103 px), a little under. */
const RUSH_RISE = 100;

function reachOf(def: CharacterDef): { jump: number; climbs: boolean } {
  const hero = heroFor(def, 'classic');
  const w = runSim({
    level: testLevel(),
    character: hero,
    rules: 'classic',
    script: { steps: [] },
    maxFrames: 0,
  }).world;
  const rush = hero.touchLabels?.(w.player, w).select === 'RUSH';
  return { jump: Math.max(jumpPx(hero), rush ? RUSH_RISE : 0), climbs: !!hero.movement.wallClimb };
}

/**
 * Whether a hero `h` tiles tall whose feet rise `jump` px can get from standing on (x, y) to a cell
 * from which he takes one of the room's ways out (walks, drops and jumps up to `jump` px up and
 * four tiles across, through open air; a wall climber also grabs a wall face in his jump's reach
 * and climbs it). classic-special-sweeps' check, with the jump-to-grab added (RC-022).
 */
function canLeave(
  map: TileMap,
  x: number,
  y: number,
  h: number,
  jump: number,
  outs: Zone[],
  climbs: boolean,
): boolean {
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
        const top = Math.min(cy, ty);
        if (!clear(cx, cy, top) || !clear(tx, ty, top)) continue;
        todo.push([tx, ty]);
      }
    // A wall climber (Ryu, Haggle Man: MovementProfile.wallClimb; Ryu.as climbs any wall) grabs
    // a wall face within his jump: beside him, or up to four tiles across, reached through open
    // air at the height he grabs it (RC-022: Hard 4-2's block at 12,5 from the block at 10,9).
    if (climbs)
      for (let dx = -4; dx <= 4; dx++) {
        if (dx === 0) continue;
        const tx = cx + dx;
        const face = dx > 0 ? tx - 1 : tx + 1;
        const across = (wy: number) => {
          for (let c = Math.min(cx, face); c <= Math.max(cx, face); c++)
            for (let k = 0; k < h; k++) if (!air(c, wy - k)) return false;
          return true;
        };
        let wall = -1;
        for (let wy = cy; wy >= Math.max(0, cy - Math.floor(jump / 16)) && wall < 0; wy--)
          if (!air(tx, wy) && clear(cx, cy, wy) && across(wy)) wall = wy;
        if (wall < 0) continue;
        let topRow = wall;
        while (topRow > 0 && !air(tx, topRow - 1)) topRow--;
        if (topRow > 0 && stand(tx, topRow - 1) && !seen.has(`${tx},${topRow - 1}`))
          todo.push([tx, topRow - 1]);
      }
  }
  return false;
}

/** The ten select heroes and every look their slots wear (CLASSIC_SKINS), as the World plays them. */
const SELECT_HEROES: CharacterDef[] = [
  ...(Object.values(CLASSIC_CHARACTERS) as CharacterDef[]),
  ...CLASSIC_EXTRAS.filter((d) => d.id === 'bass'),
];
const ALL_LOOKS: CharacterDef[] = [
  ...new Set(
    CLASSIC_SLOTS.flatMap((id) => {
      const host = SELECT_HEROES.find((d) => d.id === id) as CharacterDef;
      return (CLASSIC_SKINS[id] ?? [host]).map((d) => heroFor(d, 'classic'));
    }),
  ),
];

/**
 * RC-022: Hard 1-2's room (the original's own design, levelDataLostLevels.xml 1-2 f on Hard) is
 * left by way of its hidden coin blocks at 26,8 and 25,5 over the pit, which this sweep's map does
 * not see until they are hit. In that room it counts a hidden block as the solid block it becomes.
 * Not a bug: the original's design; the sweep's model.
 */
const HIDDEN_ROUTE = new Set(['hard ll-1-2-bonus']);

/** `map` with each hidden block shown (its hit turns it into a solid used block). */
function revealed(map: TileMap): TileMap {
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++)
      if (tileDef(map.get(x, y)).block?.kind === 'hidden') map.set(x, y, T.USED);
  return map;
}

describe('RC-001: every way into an SMB1 or Lost Levels bonus room puts the hero inside it', () => {
  it('the Hard rooms arrive at the playerStart or the pipe end; Easy and Normal still drop in', () => {
    const hard = entries({ difficulty: 'hard', def: MARIO });
    const normal = entries({ difficulty: 'normal', def: MARIO });
    const into = (list: typeof hard, level: string) => list.filter((e) => e.level === level);
    // 3-1's first room: playerStart (1,3) under its Hard entry pipe (levelDataLostLevels.xml 3-1 b).
    expect(into(hard, 'll-3-1-bonus').map((e) => [e.start.x, e.start.y, e.start.mode])).toEqual([
      [1, 3, 'stand'],
    ]);
    expect(into(normal, 'll-3-1-bonus').map((e) => [e.start.x, e.start.y])).toEqual([[1, 0]]);
    expect(built('ll-3-1-bonus', { difficulty: 'hard', def: MARIO }).start).toEqual({ x: 1, y: 3 });
    expect(built('ll-3-1-bonus', { difficulty: 'normal', def: MARIO }).start).toEqual({ x: 1, y: 0 });
    for (const id of ['ll-5-3-bonus', 'll-7-1-bonus', 'll-8-2-bonus', 'll-12-1-bonus', 'll-13-2-bonus'])
      expect(into(hard, id).length, id).toBeGreaterThan(0);
  });

  it('on every difficulty, for every Classic look: inside, on the floor, a way out in reach', () => {
    const bad: string[] = [];
    expect(ALL_LOOKS.length).toBeGreaterThan(20);
    for (const def of ALL_LOOKS) {
      const { jump, climbs } = reachOf(def);
      for (const difficulty of ['easy', 'normal', 'hard'] as const)
        for (const e of entries({ difficulty, def })) {
          const where = `${difficulty} ${e.from} ${e.zone.kind} ${e.zone.x} -> ${e.level} ${def.id}`;
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
          const tx = toPx(b.x + (b.w >> 1)) >> 4;
          const ty = (toPx(b.y + b.h) - 1) >> 4;
          if (!b.onGround) bad.push(`${where}: never landed (y=${toPx(b.y)})`);
          // Below the room's ceiling row (its highest solid row; a drop gap is open over his column).
          let ceiling = w.map.height;
          for (let x = 0; x < w.map.width; x++)
            for (let y = 0; y < ceiling; y++) if (w.map.isSolid(x, y)) ceiling = y;
          if (ty <= ceiling) bad.push(`${where}: on the roof at ${tx},${ty}`);
          const outs = w.level.zones.filter((z) => z.kind === 'pipe' || z.kind === 'pit');
          const h = Math.ceil(toPx(b.h) / 16);
          const map = HIDDEN_ROUTE.has(`${difficulty} ${e.level}`) ? revealed(w.map) : w.map;
          if (!canLeave(map, tx, ty, h, jump, outs, climbs))
            bad.push(`${where}: no way out in jump reach from ${tx},${ty}`);
        }
    }
    expect(bad).toEqual([]);
  }, 600_000);
});

/**
 * RC-022, Hard 4-2's room: not a bug (the original's design; the sweep's model). Its exit ledge
 * (the block at 12,5) is 64 px over the block at 10,9, above Ryu's and Haggle Man's plain jumps,
 * but they jump at its left face, grab it, climb and hop on, as Ryu.as climbs any wall. A bot plays
 * it from the arrival with real inputs: block to block, then the grab, the climb and the pipe.
 */
function hopBot(steps: { x: number; feet: number }[]): (w: World, f: number) => Action[] {
  let i = 0;
  let still = 0;
  let lastY = 0;
  let ground = 0;
  return (w) => {
    const p = w.player;
    const b = p.body;
    const mid = toPx(b.x + (b.w >> 1));
    const cx = mid >> 4;
    const feet = (toPx(b.y + b.h) - 1) >> 4;
    still = b.y === lastY ? still + 1 : 0;
    lastY = b.y;
    const step = steps[i];
    if (step && b.onGround && cx === step.x && feet === step.feet) i++;
    if (p.wall) return still > 2 ? ['jump', 'right'] : ['up'];
    const goal = steps[i];
    // The last step done: walk right, into the exit pipe.
    if (!goal) return ['right'];
    const target = goal.x * 16 + 8;
    const steer: Action[] = mid < target - 2 ? ['right', 'run'] : mid > target + 2 ? ['left'] : [];
    // On the ground: a run-up to the platform's edge, then a fresh press (jump let go for a few
    // frames first); in the air, jump held and steered at the next block.
    ground = b.onGround ? ground + 1 : 0;
    if (b.onGround) {
      const front = (toPx(b.x + b.w) + 2) >> 4;
      if (w.map.isSolid(front, feet + 1)) return ['right', 'run'];
      return ground < 4 ? [] : [...steer, 'jump'];
    }
    return [...steer, 'jump'];
  };
}

describe('RC-022: Hard 4-2’s room, the wall climbers (real moves)', () => {
  for (const id of ['ryu', 'haggleman'])
    it(`${id} gets from the arrival to the exit pipe by grabbing the block at 12,5`, () => {
      const def = ALL_LOOKS.find((d) => d.id === id) as CharacterDef;
      expect(def.movement.wallClimb, id).toBeTruthy();
      const e = entries({ difficulty: 'hard', def }).find((x) => x.level === 'll-4-2-bonus');
      expect(e).toBeDefined();
      const r = runSim({
        level: getLevel('ll-4-2-bonus'),
        character: def,
        rules: 'classic',
        mapDifficulty: 'hard',
        script: { steps: [] },
        start: { ...(e as { start: WorldStart }).start, time: 300 },
        maxFrames: 1500,
        assist: { invulnerable: true },
        // The pipe (1,12), the blocks at 6,11 and 10,9, the block at 12,5 (its face grabbed).
        controller: hopBot([
          { x: 1, feet: 12 },
          { x: 6, feet: 10 },
          { x: 10, feet: 8 },
          { x: 12, feet: 4 },
        ]),
      });
      const b = r.world.player.body;
      expect(r.outcome, `${toPx(b.x)},${toPx(b.y)}`).toBe('pipe');
    });
});
