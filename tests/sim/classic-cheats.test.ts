import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { px, toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { CLASSIC_CHEAT_IDS, type ClassicCheatId } from '@engine/save/settings';
import { DEFAULT_ASSIST, NO_CHEATS, newGameState, type CheatFlags, type Rules } from '@game/context';
import { heroFor } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import { hasAmmo, spendAmmo } from '@game/characters/classic/power';
import type { CharacterDef } from '@game/characters/character';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { HammerBro } from '@game/entities/enemies/hammer-bro';
import { BulletLauncher } from '@game/entities/enemies/bullet-bill';
import { T } from '@game/level/tiles';
import { parseTextMap } from '@game/level/textmap';
import type { EntitySpawn, LevelData } from '@game/level/schema';
import { ScriptedInput } from '@game/sim/headless';
import { levelSeed, World } from '@game/world/world';
import { LOCKED_CHECKPOINTS, allHammerBros, groundToBricks } from '@game/rules/classic-cheats';
import { classicHit } from '@game/rules/classic-enemies';
import { TileMap } from '@game/world/tilemap';

// Classic mode's cheats in the World (FU-7e; src/game/cheats.ts, rules/classic-cheats.ts): each
// rule and level-edit cheat does what the original's does when on, and changes nothing when off
// (a guard per cheat: off plays exactly as a World with no cheats at all). Current Worlds never
// read them.

type Flags = Partial<Record<ClassicCheatId, boolean>>;

/** A World for `level` whose context has `cheats` (null: no classicCheats at all, as today). */
function cheatWorld(
  level: LevelData,
  cheats: Flags | null,
  def: CharacterDef = MARIO,
  rules: Rules = 'classic',
): World {
  const ctx = {
    assets: new AssetRegistry({ default: {} }),
    audio: NULL_AUDIO,
    assist: { ...DEFAULT_ASSIST },
    reduceFlashing: true,
    rules,
    ...(cheats ? { classicCheats: { ...NO_CHEATS, ...cheats } as CheatFlags } : {}),
  };
  return new World(level, ctx, newGameState(def, null, rules), { seed: levelSeed(level) });
}

/** Runs `n` frames holding `hold(frame)`. */
function run(w: World, n: number, hold: (f: number) => Action[] = () => []): void {
  const input = new ScriptedInput({ steps: [] });
  for (let f = 0; f < n; f++) {
    input.setHeld(hold(f));
    input.next();
    w.update([input]);
  }
}

/** A 48-column flat level: ground rows 13-14, `start` and extra map lines. */
function flat(opts: { start?: string; tiles?: Record<number, string>; extra?: string[] } = {}): LevelData {
  const lines: string[] = [];
  for (let y = 0; y < 13; y++) lines.push((opts.tiles?.[y] ?? '').padEnd(48, '.').slice(0, 48));
  lines.push('#'.repeat(48), '#'.repeat(48));
  return parseTextMap(
    [
      'id: t',
      'time: 300',
      `start: ${opts.start ?? '2,12'}`,
      '',
      '[tiles]',
      ...lines,
      ...(opts.extra ?? []),
    ].join('\n'),
  );
}

/** The run's trace: where the player was each 10 frames, and every event (a hashable record). */
function trace(level: LevelData, cheats: Flags | null, def: CharacterDef = MARIO, rules: Rules = 'classic') {
  const w = cheatWorld(level, cheats, def, rules);
  const out: string[] = [];
  const input = new ScriptedInput({ steps: [] });
  for (let f = 0; f < 900; f++) {
    // Right, with a jump every 40 frames.
    input.setHeld(f % 40 < 12 ? ['right', 'jump'] : ['right']);
    input.next();
    w.update([input]);
    if (f % 10 === 0) out.push(`${f}:${w.player.body.x},${w.player.body.y},${w.time},${w.player.powerState}`);
    for (const e of w.events.splice(0)) out.push(`${f}:${JSON.stringify(e)}`);
  }
  out.push(`map:${[...w.map.tiles].join('')}`);
  out.push(`spawns:${JSON.stringify(spawnsOf(w).map((s) => s.type))}`);
  return out.join('\n');
}

/** The World's spawn list (private: read for the checks only). */
const spawnsOf = (w: World): EntitySpawn[] => (w as unknown as { spawns: EntitySpawn[] }).spawns;

const ALL_ON = Object.fromEntries(CLASSIC_CHEAT_IDS.map((id) => [id, true])) as Flags;

describe('cheats off change nothing (guards)', () => {
  it('a Classic World with every cheat off plays exactly as one with no cheats', () => {
    for (const id of ['1-1', '1-2', '2-2', '5-3', '8-4']) {
      const base = trace(getLevel(id), null);
      expect(trace(getLevel(id), {}), id).toBe(base);
    }
  });

  // One guard per cheat: the cheat off (the rest on or off makes no difference to it) plays as
  // no cheats, in a level where that cheat, on, changes the run.
  const SCENES: Record<ClassicCheatId, string> = {
    allGroundIsBricks: '1-1',
    allHammerBros: '1-1',
    allWeaponsPierce: '5-3',
    alwaysBreakBricks: '1-1',
    bouncyPits: '1-1',
    classicSamus: '1-1',
    classicScreenScroll: '1-1',
    classicSimon: '1-1',
    everyoneCanStomp: '1-1',
    evilHammerBros: '8-3',
    extraCheckpoints: '1-4',
    infiniteAmmo: '1-1',
    infiniteLives: '1-1',
    infiniteTime: '1-1',
    invincible: '1-1',
    waterMode: '1-1',
  };
  for (const id of CLASSIC_CHEAT_IDS)
    it(`${id}: off plays as no cheats`, () => {
      const level = getLevel(SCENES[id]);
      expect(trace(level, { [id]: false })).toBe(trace(level, null));
    });

  it('a Current World never reads a cheat, even with every one on in the context', () => {
    for (const id of ['1-1', '8-3']) {
      const w = cheatWorld(getLevel(id), ALL_ON, MARIO, 'current');
      expect(w.cheats).toBe(NO_CHEATS);
      expect(trace(getLevel(id), ALL_ON, MARIO, 'current')).toBe(trace(getLevel(id), null, MARIO, 'current'));
    }
  });

  it('a Classic World with no cheats in its context has none (the campaign, Current rules)', () => {
    expect(cheatWorld(getLevel('1-1'), null).cheats).toBe(NO_CHEATS);
    expect(cheatWorld(getLevel('1-1'), null).assist.infiniteLives).toBe(false);
  });
});

describe('rule cheats', () => {
  it('Everyone Can Stomp: a hero that cannot stomp lands on a Goomba and squashes it', () => {
    const level = flat({ start: '6,8', extra: ['[entities]', 'goomba 6 12'] });
    const link = heroFor(LINK, 'classic');
    expect(link.stomps).toBe(false);
    for (const on of [false, true]) {
      const w = cheatWorld(level, { everyoneCanStomp: on }, LINK);
      run(w, 1);
      // Held under the falling hero.
      const g = w.entities.find((e) => e instanceof Goomba) as Goomba;
      g.walkSpeed = 0;
      g.body.vx = 0;
      g.body.x = w.player.body.x;
      run(w, 120);
      expect(w.feats.stomps, String(on)).toBe(on ? 1 : 0);
      expect(w.entities.some((e) => e instanceof Goomba && e.alive && e.contactHurts)).toBe(!on);
    }
  });

  it('All Weapons Pierce: armour never stops a hit', () => {
    for (const on of [false, true]) {
      const w = cheatWorld(flat(), { allWeaponsPierce: on });
      const buzzy = new Koopa(px(200), px(200), 'buzzy');
      w.spawn(buzzy);
      const r = classicHit(buzzy, { kind: 'fireball', amount: 1000, owner: w.player, dirX: 1 }, w);
      expect(r, String(on)).toBe(on ? 'kill' : 'blocked');
    }
  });

  it('Always Break Bricks: a small hero breaks a plain brick with a head bump', () => {
    for (const on of [false, true]) {
      const w = cheatWorld(flat({ tiles: { 9: '..=' } }), { alwaysBreakBricks: on });
      expect(w.player.powerState).toBe('small');
      run(w, 60, (f) => (f > 5 && f < 25 ? ['jump'] : []));
      expect(w.map.get(2, 9) === T.AIR, String(on)).toBe(on);
    }
  });

  it('Infinite Ammo: weapons spend nothing (the World marks its players each frame)', () => {
    for (const on of [false, true]) {
      const w = cheatWorld(flat(), { infiniteAmmo: on });
      run(w, 1);
      const p = w.player;
      p.scratch.hearts = 0;
      expect(hasAmmo(p, 'hearts', 1)).toBe(on);
      p.scratch.hearts = 3;
      expect(spendAmmo(p, 'hearts', 1)).toBe(true);
      expect(p.scratch.hearts).toBe(on ? 3 : 2);
    }
  });

  it('Bouncy Pits: a hero falling out of the bottom is thrown back up, an enemy too', () => {
    const level = flat({ tiles: {}, start: '2,12' });
    // A pit at columns 6-9.
    const pit = (w: World) => {
      for (let x = 6; x < 10; x++) for (const y of [13, 14]) w.map.set(x, y, T.AIR);
    };
    for (const on of [false, true]) {
      const w = cheatWorld(level, { bouncyPits: on });
      pit(w);
      const g = new Goomba(px(8 * 16 + 2), px(10 * 16));
      w.spawn(g);
      const died: boolean[] = [];
      let rose = false;
      const input = new ScriptedInput({ steps: [] });
      for (let f = 0; f < 240; f++) {
        input.setHeld(f < 40 ? ['right'] : []);
        input.next();
        w.update([input]);
        for (const e of w.events.splice(0)) if (e.type === 'died') died.push(true);
        if (w.player.dead) died.push(true);
        if (on && w.player.body.vy < 0 && toPx(w.player.body.y) > 200) rose = true;
      }
      expect(died.length > 0, String(on)).toBe(!on);
      if (on) {
        expect(rose).toBe(true);
        expect(g.alive).toBe(true);
      }
    }
  });

  it('Infinite Time, Infinite Lives, Invincible: the assists, read live', () => {
    const w = cheatWorld(getLevel('1-1'), {});
    const t0 = w.time;
    run(w, 100);
    expect(w.time).toBeLessThan(t0 as number);
    expect(w.assist.infiniteLives).toBe(false);
    expect(w.assist.invulnerable).toBe(false);
    const on = cheatWorld(getLevel('1-1'), { infiniteTime: true, infiniteLives: true, invincible: true });
    const t1 = on.time;
    run(on, 100);
    expect(on.time).toBe(t1);
    expect(on.assist.infiniteLives).toBe(true);
    expect(on.assist.invulnerable).toBe(true);
    // The assist itself still works under it (dev mode's).
    expect(on.assist.safetyFloor).toBe(false);
  });

  it('Classic Scroll: the screen no longer scrolls back left', () => {
    expect(cheatWorld(getLevel('1-1'), {}).camera.scrollBack).toBe(true);
    expect(cheatWorld(getLevel('1-1'), { classicScreenScroll: true }).camera.scrollBack).toBe(false);
  });

  it('Evil Hammer Bros: a Hammer Bro walks at a player on its right', () => {
    for (const on of [false, true]) {
      const w = cheatWorld(flat({ start: '12,12', extra: ['[entities]', 'hammer-bro 5 12'] }), {
        evilHammerBros: on,
      });
      run(w, 3);
      const hb = w.entities.find((e) => e instanceof HammerBro) as HammerBro;
      expect(hb).toBeDefined();
      const x0 = hb.body.x;
      run(w, 60);
      expect(hb.body.x - x0 > px(16), String(on)).toBe(on);
    }
  });
});

describe('All Hammer Bros', () => {
  it("every map enemy but Bowser is a Hammer Bro (a plant's on its pipe)", () => {
    const spawns = [
      { type: 'goomba', x: 10, y: 12, props: { dx: 8 } },
      { type: 'piranha', x: 20, y: 10 },
      { type: 'bowser', x: 30, y: 9 },
      { type: 'firebar', x: 40, y: 8 },
      { type: 'koopa-para-red', x: 50, y: 6 },
    ];
    expect(allHammerBros(spawns)).toBe(3);
    expect(spawns).toEqual([
      { type: 'hammer-bro', x: 10, y: 12, props: { dx: 8 } },
      { type: 'hammer-bro', x: 20, y: 9, props: { dx: 8 } },
      { type: 'bowser', x: 30, y: 9 },
      { type: 'firebar', x: 40, y: 8 },
      { type: 'hammer-bro', x: 50, y: 6 },
    ]);
  });

  it('in 1-1, every Goomba and Koopa spawns as a Hammer Bro; off, none does', () => {
    const off = cheatWorld(getLevel('1-1'), {});
    const on = cheatWorld(getLevel('1-1'), { allHammerBros: true });
    expect(spawnsOf(off).some((s) => s.type === 'hammer-bro')).toBe(false);
    expect(spawnsOf(on).filter((s) => s.type === 'hammer-bro').length).toBe(
      spawnsOf(off).filter((s) => s.type === 'goomba' || s.type.startsWith('koopa')).length,
    );
    expect(spawnsOf(on).some((s) => s.type === 'goomba')).toBe(false);
  });

  it('a Bullet Bill blaster fires a Hammer Bro instead (Canon.as), counted as its own', () => {
    const level = flat({ tiles: { 11: '...............^', 12: '...............|' } });
    const w = cheatWorld(level, { allHammerBros: true });
    run(w, 600);
    expect(w.entities.some((e) => e instanceof BulletLauncher)).toBe(true);
    const hbs = w.entities.filter((e) => e instanceof HammerBro && e.spawner === 'blaster');
    expect(hbs.length).toBeGreaterThan(0);
    expect(hbs.length).toBeLessThanOrEqual(3);
  });
});

describe('level-edit cheats', () => {
  it('All Ground Is Bricks: ground and blocks before the flag are bricks; pipes and the goal stay', () => {
    const off = cheatWorld(getLevel('1-1'), {});
    const on = cheatWorld(getLevel('1-1'), { allGroundIsBricks: true });
    expect(off.map.get(0, 13)).toBe(T.GROUND);
    expect(on.map.get(0, 13)).toBe(T.BRICK);
    // The stairs before the flag are bricks; the flag's block and the ground past it are not.
    expect(on.map.get(134, 12)).toBe(off.map.get(134, 12) === T.HARD ? T.BRICK : off.map.get(134, 12));
    const flagX = [...Array(on.map.width).keys()].find((x) => on.map.get(x, 3) === T.FLAG_SHAFT) as number;
    expect(flagX).toBeGreaterThan(0);
    expect(on.map.get(flagX, 12)).toBe(off.map.get(flagX, 12));
    expect(on.map.get(flagX + 2, 13)).toBe(T.GROUND);
    // Pipes keep their tiles.
    for (let x = 0; x < flagX; x++)
      for (let y = 0; y < 15; y++)
        if ([T.PIPE_TL, T.PIPE_TR, T.PIPE_BL, T.PIPE_BR].includes(off.map.get(x, y)))
          expect(on.map.get(x, y)).toBe(off.map.get(x, y));
  });

  it("All Ground Is Bricks stops a tile before Bowser's axe", () => {
    const level = getLevel('1-4');
    const axe = level.entities.find((e) => e.type === 'axe');
    expect(axe).toBeDefined();
    const map = new TileMap(level);
    groundToBricks(map, level.entities);
    const x = (axe?.x ?? 0) - 1;
    for (let y = 0; y < 15; y++) expect(map.get(x, y)).toBe(new TileMap(level).get(x, y));
  });

  it('Water Mode: every row swims, and the pause can flood or drain the area at once', () => {
    const off = cheatWorld(getLevel('1-1'), {});
    expect(off.waterTop).toBe(Infinity);
    const on = cheatWorld(getLevel('1-1'), { waterMode: true });
    run(on, 2);
    expect(on.player.inWater).toBe(true);
    on.setWaterMode(false);
    run(on, 2);
    expect(on.player.inWater).toBe(false);
    off.setWaterMode(true);
    run(off, 2);
    expect(off.player.inWater).toBe(true);
    // A water level keeps its own water line once drained.
    const water = cheatWorld(getLevel('2-2'), {});
    const top = water.waterTop;
    water.setWaterMode(true);
    water.setWaterMode(false);
    expect(water.waterTop).toBe(top);
  });

  it("Extra Checkpoints: a castle's halfway point (the original's) is a checkpoint", () => {
    expect(cheatWorld(getLevel('1-4'), {}).cheatCheckpoints).toEqual([]);
    const w = cheatWorld(getLevel('1-4'), { extraCheckpoints: true });
    expect(w.cheatCheckpoints).toEqual([{ x: 97, y: 9 }]);
    w.player.body.x = px(98 * 16);
    run(w, 1);
    expect(w.events).toContainEqual({ type: 'checkpoint', x: 97, y: 9 });
    // The table names real areas, and none of them has a checkpoint of its own.
    for (const [id, cp] of Object.entries(LOCKED_CHECKPOINTS)) {
      const l = getLevel(id);
      expect(
        l.zones.some((z) => z.kind === 'checkpoint'),
        id,
      ).toBe(false);
      expect(cp.x, id).toBeLessThan(l.width);
    }
  });
});
