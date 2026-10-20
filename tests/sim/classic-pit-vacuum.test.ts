import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import type { Action } from '@engine/input/actions';
import { px, toPx } from '@engine/math/units';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import type { CharacterDef } from '@game/characters/character';
import { heroFor } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { LINK } from '@game/characters/link';
import { classicStandIn } from '@game/characters/classic/test-def';
import { CLASSIC_SWIM } from '@game/rules/classic-swim';
import { pitVacuumColumns, type World } from '@game/world/world';
import { TileMap } from '@game/world/tilemap';

// G-013: Classic SMBC's PitVacuum (enemies/PitVacuum.as; Level.as 762-777, setUpPitVacs). In an
// area that starts under water every empty bottom-row tile pulls Mario and Luigi (MarioBase only)
// down at 600 and toward the pit's middle at 400 px/s², lifting the sink cap to the water level's
// fall cap (MarioBase vyMaxPsv 400). Current rules and the other heroes are never pulled.

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

/** A water room 48 wide: floor rows 13-14 with a pit at columns 20-24 (its middle 22). */
function pitRoom(theme = 'water', swim = true) {
  const rows = Array.from({ length: 15 }, (_, y) => {
    if (y === 2 && swim) return 'w'.repeat(48);
    if (y >= 13) return `${'#'.repeat(20)}.....${'#'.repeat(23)}`;
    return '.'.repeat(48);
  });
  return parseTextMap(
    [
      'id: pit-room',
      `theme: ${theme}`,
      ...(swim ? ['swim: true'] : []),
      'time: 300',
      'start: 20,6',
      '',
      '[tiles]',
      ...rows,
    ].join('\n'),
  );
}

/** Sinks `def` from above column `col` for `frames` frames; the body's vx and vy each frame. */
function sink(def: CharacterDef, rules: 'classic' | 'current', col = 20, frames = 40, level = pitRoom()) {
  const vx: number[] = [];
  const vy: number[] = [];
  let world: World | null = null;
  runSim({
    level,
    character: def,
    rules,
    script: none,
    maxFrames: frames + 2,
    assist: { invulnerable: true },
    controller: (w, f) => {
      if (f === 0) {
        world = w;
        w.player.body.x = px(col * 16 + 2);
        w.player.body.y = px(5 * 16);
        w.player.body.vx = 0;
        w.player.body.vy = 0;
      }
      return [];
    },
    until: (w, f) => {
      vx.push(w.player.body.vx);
      vy.push(w.player.body.vy);
      return f >= frames;
    },
  });
  return { vx, vy, world: world as World | null };
}

describe('G-013: PitVacuum columns (setUpPitVacs)', () => {
  it('a pit pulls toward its middle: left half right, middle down, right half left', () => {
    const map = new TileMap(pitRoom());
    const v = pitVacuumColumns(map);
    expect([...v.slice(19, 26)]).toEqual([0, 1, 1, 2, 3, 3, 0]);
    const even = parseTextMap(
      [
        'id: even',
        'theme: water',
        '',
        '[tiles]',
        ...Array.from({ length: 15 }, (_, y) => (y >= 13 ? '##....##' : '........')),
      ].join('\n'),
    );
    expect([...pitVacuumColumns(new TileMap(even))]).toEqual([0, 0, 1, 1, 3, 3, 0, 0]);
  });

  it("2-2's bottom row has pits with vacuums", () => {
    const v = pitVacuumColumns(new TileMap(getLevel('2-2')));
    expect(v.some((x) => x === 2 || x === 1)).toBe(true);
  });
});

describe('G-013: the pull', () => {
  const plumber = CLASSIC_SWIM.mario?.pitPull;

  it('Classic Mario and Luigi carry the numbers (600 down, 400 sideways, 400 fall cap)', () => {
    expect(plumber).toEqual({ down: 0x002ab, side: 0x001c7, fallMax: 0x03555 });
    expect(CLASSIC_SWIM.luigi?.pitPull).toEqual(plumber);
    for (const id of ['link', 'samus', 'simon', 'megaman', 'bill', 'ryu', 'peach'])
      expect(CLASSIC_SWIM[id]?.pitPull, id).toBeUndefined();
    // The registered Classic plumbers (when built) use those profiles.
    expect(heroFor(MARIO, 'classic').movement.swim?.pitPull ?? plumber).toEqual(plumber);
    expect(heroFor(LUIGI, 'classic').movement.swim?.pitPull ?? plumber).toEqual(plumber);
  });

  it('pulls Classic Mario toward the middle and down past the sink cap', () => {
    const sw = CLASSIC_SWIM.mario;
    const r = sink(classicStandIn(MARIO), 'classic');
    // Sideways: right (the pit's left half), capped at the walk speed.
    expect(Math.max(...r.vx)).toBeGreaterThan(0);
    // Down: faster than the plain sink cap, up to the fall cap.
    expect(Math.max(...r.vy)).toBeGreaterThan(sw?.sinkMax ?? 0);
    expect(Math.max(...r.vy)).toBeLessThanOrEqual(plumber?.fallMax ?? 0);
  });

  it('over the middle tile only down; over the right half left', () => {
    const mid = sink(classicStandIn(MARIO), 'classic', 22, 20);
    expect(mid.vx.every((x) => x === 0)).toBe(true);
    const right = sink(classicStandIn(MARIO), 'classic', 24, 20);
    expect(Math.min(...right.vx)).toBeLessThan(0);
  });

  it('no pull away from the pits, for the other heroes, under Current rules, or out of water', () => {
    const sw = CLASSIC_SWIM.mario;
    const away = sink(classicStandIn(MARIO), 'classic', 6);
    expect(away.vx.every((x) => x === 0)).toBe(true);
    expect(Math.max(...away.vy)).toBeLessThanOrEqual(sw?.sinkMax ?? 0);
    const link = sink(classicStandIn(LINK), 'classic', 20);
    expect(link.vx.every((x) => x === 0)).toBe(true);
    const current = sink(MARIO, 'current', 20);
    expect(current.vx.every((x) => x === 0)).toBe(true);
    // A dry level with the same pit: no vacuums (Level._initialWaterLevel).
    const dry = sink(classicStandIn(MARIO), 'classic', 20, 10, pitRoom('overworld', false));
    expect(dry.world?.player.pitPull ?? null).toBeNull();
  });

  it('a pulled hero ends in the pit', () => {
    const r = sink(classicStandIn(MARIO), 'classic', 21, 200);
    const w = r.world;
    expect(w).not.toBeNull();
    // Fell through the bottom (the pit), or is dying there.
    const b = w?.player.body;
    expect(b && toPx(b.y)).toBeGreaterThan(13 * 16 - 32);
  });
});
