import { describe, expect, it } from 'vitest';
import { getLevel, levelIds } from '@content/levels';
import { runSim } from '@game/sim/headless';
import { CHARACTERS } from '@game/characters/registry';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { SIMON } from '@game/characters/simon';
import { MEGAMAN } from '@game/characters/megaman';
import { Firebar } from '@game/entities/enemies/firebar';
import { carryTime, LevelScene } from '@game/scenes/level';
import { WorldMapScene } from '@game/scenes/world-map';
import { campaignLevel } from '@game/level/campaign';
import { parseTextMap, serializeTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import { px, toPx } from '@engine/math/units';
import type { World } from '@game/world/world';
import type { Action } from '@engine/input/actions';
import type { Zone } from '@game/level/schema';
import { Lift } from '@game/entities/objects/lift';
import { Koopa } from '@game/entities/enemies/koopa';
import { Candle, RESPAWN_FRAMES, Respawner } from '@game/entities/objects/crypt';
import { captiveDialogue, CARD_COLS } from '@game/scenes/free-hero';
import { fontText } from '@game/hud/text';
import { hiddenHeroes, hiddenHeroesAt } from '@game/map/captives';
import type { MiniGameDef } from '@game/minigames';
import { captives, file, makeGame, useStorage, type H } from './heroes-harness';

// Simon's dungeon and crypt under 5-4 (owner design, 0.4.7 batch B): in campaign play, riding
// 5-4's down lift on past the bottom of the shaft carries the player down into a dungeon room
// (5-4-dungeon) with a cracked wall; behind it, steps down into Simon's crypt (5-4-crypt), whose
// doorway leads back up into 5-4 past the lift section, the clock running on throughout.

useStorage();

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };
const dungeon = () => getLevel('5-4-dungeon');
const crypt = () => getLevel('5-4-crypt');
const INTO_DUNGEON = { level: '5-4-dungeon', x: 13, y: 0, exitDir: 'fall' };
const INTO_CRYPT = { level: '5-4-crypt', x: 1, y: 0, exitDir: 'fall' };
const BACK_TO_5_4 = { level: '5-4', x: 99, y: 0, exitDir: 'fall' };
/** The cracked wall: column 5, rows 8-10. */
const WALL = { x: 5, rows: [8, 9, 10] };
const SIMON_AT = { x: 11, y: 11 };

const tile = (l: { tiles: Uint16Array; width: number }, x: number, y: number) => l.tiles[y * l.width + x];
const wallStands = (w: World) => WALL.rows.every((y) => w.map.get(WALL.x, y) === T.CRACKED);
const wallDown = (w: World) => WALL.rows.every((y) => w.map.get(WALL.x, y) === T.AIR);
const koopa = (w: World) => w.entities.find((e): e is Koopa => e instanceof Koopa && e.alive);
const descents = (zones: Zone[]) =>
  zones.filter((z): z is Zone & { kind: 'descent' } => z.kind === 'descent');

/**
 * Stand on the descent lift's left side, clear of the fire bar at (92, 10) sweeping its right end.
 * Edged over at no more than half a pixel a frame, so a hero that rolls on after letting go
 * (Sophia III's tank) stops on the lift too.
 */
function rideLeft(w: World): Action[] {
  const b = w.player.body;
  const lift = w.entities.find(
    (e) => e instanceof Lift && e.kind === 'lift-down' && Math.abs(e.body.y - (b.y + b.h)) < px(4),
  );
  if (!lift || !b.onGround) return [];
  return b.x + b.w > lift.body.x + px(10) && b.vx > -0x00800 ? ['left'] : [];
}

describe('the areas', () => {
  it('5-4 has a sleeping descent zone over its lift shaft (columns 84-91); the campaign wakes it', () => {
    const raw = getLevel('5-4');
    expect(descents(raw.zones)).toEqual([
      { kind: 'descent', x: 84, w: 8, target: { level: '5-4-dungeon', x: 13, y: 0 }, campaign: true },
    ]);
    // The down lifts run in column 89, inside the zone.
    expect(raw.entities.filter((e) => e.type === 'lift-down').map((e) => e.x)).toEqual([89, 89]);
    const camp = campaignLevel(raw, () => true);
    expect(descents(camp.zones)).toEqual([
      { kind: 'descent', x: 84, w: 8, target: { level: '5-4-dungeon', x: 13, y: 0 } },
    ]);
    // Nothing else of 5-4 changes.
    expect(camp.tiles).toEqual(raw.tiles);
    expect(camp.entities).toEqual(raw.entities);
  });

  it('the descent zone parses and writes back the same', () => {
    const src = [
      'id: t',
      'name: T',
      'world: 1',
      'stage: 1',
      'theme: castle',
      'time: 300',
      'start: 1,1',
      '[tiles]',
      ...Array.from({ length: 15 }, () => '................'),
      '[zones]',
      'descent 4 3 -> t-down 2 0 campaign',
      'descent 8 2 -> t-down 2 0',
    ].join('\n');
    const l = parseTextMap(src);
    expect(descents(l.zones)).toEqual([
      { kind: 'descent', x: 4, w: 3, target: { level: 't-down', x: 2, y: 0 }, campaign: true },
      { kind: 'descent', x: 8, w: 2, target: { level: 't-down', x: 2, y: 0 } },
    ]);
    expect(descents(parseTextMap(serializeTextMap(l)).zones)).toEqual(descents(l.zones));
  });

  it('the dungeon and the crypt are areas of 5-4 that keep the clock, dropping in from above', () => {
    for (const l of [dungeon(), crypt()]) {
      expect(l.parent).toBe('5-4');
      expect(l.time).toBeNull();
      expect([l.world, l.stage]).toEqual([5, 4]);
      expect(l.startMode).toBe('fall');
      expect(l.camera).toBe('locked');
    }
    expect(dungeon().start).toEqual({ x: 13, y: 0 });
    expect(crypt().start).toEqual({ x: 1, y: 0 });
    const main = getLevel('5-4');
    expect(carryTime(main, dungeon(), 250)).toBe(250);
    expect(carryTime(dungeon(), crypt(), 240)).toBe(240);
    expect(carryTime(crypt(), main, 230)).toBe(230);
  });

  it('the dungeon: the cracked wall, the single block, the Koopa that comes back, the hole to the crypt', () => {
    const l = dungeon();
    for (const y of WALL.rows) expect(tile(l, WALL.x, y)).toBe(T.CRACKED);
    expect(tile(l, WALL.x, 7)).toBe(T.CASTLE_BRICK); // the wall runs up to the ceiling
    expect(tile(l, 11, 10)).toBe(T.HARD);
    expect(tile(l, 11, 9)).toBe(T.AIR);
    expect(l.entities).toContainEqual({ type: 'koopa-green', x: 8, y: 10, props: { respawn: true } });
    // Steps down behind the wall to a hole (columns 0-1) that drops into the crypt.
    expect([4, 3, 2].map((x) => [11, 12, 13].findIndex((y) => tile(l, x, y) !== T.AIR))).toEqual([0, 1, 2]);
    for (const x of [0, 1]) for (let y = 8; y < 15; y++) expect(tile(l, x, y)).toBe(T.AIR);
    expect(l.zones).toEqual([{ kind: 'pit', x: 0, target: { level: '5-4-crypt', x: 1, y: 0 } }]);
    // The arrival shaft (columns 11-14) is open to the top, wide enough to drop in straight.
    for (const x of [11, 12, 13, 14])
      for (let y = 0; y < 11; y++) expect(tile(l, x, y)).toBe(x === 11 && y === 10 ? T.HARD : T.AIR);
  });

  it('the crypt: Simon on the floor under the stained glass, candles, the doorway back to 5-4 at 99', () => {
    const l = crypt();
    expect(l.entities).toContainEqual({
      type: 'captive',
      x: SIMON_AT.x,
      y: SIMON_AT.y,
      props: { hero: 'simon' },
    });
    expect(l.entities.filter((e) => e.type === 'candle')).toHaveLength(3);
    expect(l.decor).toContainEqual({ kind: 'crypt:stained-glass', x: 10, y: 7 });
    expect(tile(l, SIMON_AT.x, 12)).toBe(T.CASTLE_BRICK);
    expect(l.zones).toEqual([{ kind: 'pipe', x: 16, y: 10, dir: 'right', target: BACK_TO_5_4 }]);
    // 5-4 at 99: open from the top down to the floor in row 13, past the shaft (84-91).
    const main = getLevel('5-4');
    for (let y = 0; y < 13; y++) expect(tile(main, 99, y), `5-4 99,${y}`).not.toBe(T.CASTLE_BRICK);
    expect(tile(main, 99, 13)).toBe(T.CASTLE_BRICK);
  });
});

describe('the HUD rows', () => {
  it.each(['5-4-dungeon', '5-4-crypt', '4-2-cavern', '4-2-larry', '3-1-station', '2-1-sky2'])(
    '%s keeps rows 0-1 clear under the HUD: no tiles',
    (id) => {
      const l = getLevel(id);
      for (let y = 0; y < 2; y++)
        for (let x = 0; x < l.width; x++) expect(tile(l, x, y), `${id} ${x},${y}`).toBe(T.AIR);
    },
  );

  it('the dungeon and the crypt stay closed: a solid ceiling on row 2 but for the arrival shaft', () => {
    const open = (l: ReturnType<typeof getLevel>) =>
      Array.from({ length: l.width }, (_, x) => x).filter((x) => tile(l, x, 2) === T.AIR);
    expect(open(dungeon())).toEqual([11, 12, 13, 14]);
    expect(open(crypt())).toEqual([0, 1, 2]);
  });
});

describe('the down lift into the dungeon (campaign)', () => {
  it.each(CHARACTERS.map((c) => [c.name, c] as const))(
    '%s rides the down lift on past the bottom of the shaft and drops into the dungeon',
    (_n, c) => {
      const r = runSim({
        level: campaignLevel(getLevel('5-4')),
        character: c,
        script: none,
        start: { x: 89, y: 2, mode: 'stand', time: 250 },
        maxFrames: 600,
        controller: rideLeft,
      });
      expect(r.outcome, c.name).toBe('pipe');
      expect(r.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: INTO_DUNGEON });
      // Carried down: the rider sank out of sight below the screen on the lift.
      expect(toPx(r.world.player.body.y)).toBeGreaterThan(240);
      expect(r.world.player.dead).toBe(false);
    },
  );

  it('co-op: two riders on the down lift both go down into the dungeon, nobody hurt', () => {
    let lift: Lift | undefined;
    const r = runSim({
      level: campaignLevel(getLevel('5-4')),
      character: MARIO,
      state: { character2: LUIGI, powerState2: 'small', hp2: 0 },
      script: none,
      start: { x: 89, y: 2, mode: 'stand', time: 250 },
      maxFrames: 600,
      controller: (w, f) => {
        if (f === 1) {
          // Both on the lift's left side (clear of the fire bar), side by side.
          lift = w.entities.find(
            (e): e is Lift => e instanceof Lift && e.kind === 'lift-down' && toPx(e.body.y) < 100,
          );
          const l = lift as Lift;
          w.players.forEach((p, i) => {
            p.body.x = l.body.x - px(4) + px(i * 8);
            p.body.y = l.body.y - p.body.h;
            p.body.vy = 0;
          });
        }
        return [];
      },
    });
    expect(r.world.players).toHaveLength(2);
    expect(r.outcome).toBe('pipe');
    expect(r.events.find((e) => e.type === 'pipe')).toEqual({ type: 'pipe', target: INTO_DUNGEON });
    expect(r.events.some((e) => e.type === 'died')).toBe(false);
    for (const p of r.world.players) {
      expect(p.dead).toBe(false);
      expect(p.powerState).toBe('small');
      expect(toPx(p.body.y)).toBeGreaterThan(240);
    }
  });

  it('the fire bar at (92, 10) is three balls short in the campaign, so its tip clears any rider on the lift; other bars and plain 5-4 keep theirs', () => {
    const bars = (level: ReturnType<typeof getLevel>) =>
      runSim({ level, character: MARIO, script: none, start: { x: 89, y: 2, mode: 'stand' }, maxFrames: 2 })
        .world.entities.filter((e): e is Firebar => e instanceof Firebar)
        .map((b) => [toPx(b.body.x) >> 4, toPx(b.body.y) >> 4, b.len]);
    const plain = bars(getLevel('5-4'));
    const camp = bars(campaignLevel(getLevel('5-4')));
    expect(plain).toContainEqual([92, 10, 6]);
    expect(camp).toContainEqual([92, 10, 3]);
    expect(camp.filter(([x]) => x !== 92)).toEqual(plain.filter(([x]) => x !== 92));
  });

  it('no hero is wider than a tile (the bar clears a tile of overhang past the lift)', () => {
    for (const c of CHARACTERS)
      for (const power of ['small', 'big', 'fire'] as const) {
        const r = runSim({
          level: getLevel('5-4'),
          character: c,
          script: none,
          state: { powerState: power },
          maxFrames: 1,
        });
        // The one exception is Sophia III's tank (19 px, SO-3): the bar is still clear of her
        // wherever she stands on the lift (the next test sweeps her whole overhang).
        expect(toPx(r.world.player.body.w), `${c.name} ${power}`).toBeLessThanOrEqual(
          c.id === 'sophia' ? 19 : 16,
        );
      }
  });

  it.each(CHARACTERS.map((c) => [c.name, c] as const))(
    '%s anywhere on the lift, hanging off either end, is never hit, whatever the bar phase (16 phases)',
    (_n, c) => {
      const TURN = 65536;
      // Lift: 24 px wide; the rider's body (12 px) overlaps it by 1 px at either extreme (the
      // tank's 19 px from -18).
      const offs = [-11, -8, -4, 0, 4, 8, 12, 16, 20, 23];
      if (c.id === 'sophia') offs.unshift(-18, -15);
      for (const off of offs)
        for (let k = 0; k < 16; k++) {
          let hurt = false;
          let power = '';
          const r = runSim({
            level: campaignLevel(getLevel('5-4')),
            character: c,
            state: { powerState: 'big' },
            script: none,
            start: { x: 89, y: 2, mode: 'stand', time: 250 },
            maxFrames: 600,
            controller: (w, f) => {
              if (f === 0)
                for (const e of w.entities)
                  if (e instanceof Firebar && toPx(e.body.x) >> 4 === 92) e.angle = (k * TURN) / 16;
              const p = w.player;
              if (f === 1) {
                const lift = w.entities.find(
                  (e): e is Lift => e instanceof Lift && e.kind === 'lift-down' && toPx(e.body.y) < 100,
                ) as Lift;
                p.body.x = lift.body.x + px(off);
                p.body.y = lift.body.y - p.body.h;
                p.body.vx = 0;
                p.body.vy = 0;
                power = p.powerState;
              }
              if (power && (p.invuln > 0 || p.dead || p.powerState !== power)) hurt = true;
              return [];
            },
          });
          expect(r.outcome, `${c.name} offset ${off} phase ${k}`).toBe('pipe');
          expect(hurt, `${c.name} offset ${off} phase ${k}`).toBe(false);
        }
    },
  );

  it.each(CHARACTERS.map((c) => [c.name, c] as const))(
    '%s standing in the middle of the lift is never hit, whatever the bar phase (16 phases)',
    (_n, c) => {
      const TURN = 65536;
      for (let k = 0; k < 16; k++) {
        let hurt = false;
        const r = runSim({
          level: campaignLevel(getLevel('5-4')),
          character: c,
          script: none,
          start: { x: 89, y: 2, mode: 'stand', time: 250 },
          maxFrames: 600,
          controller: (w, f) => {
            if (f === 0)
              for (const e of w.entities)
                if (e instanceof Firebar && toPx(e.body.x) >> 4 === 92) e.angle = (k * TURN) / 16;
            const p = w.player;
            if (p.invuln > 0 || p.dead) hurt = true;
            return [];
          },
        });
        const p = r.world.player;
        // Centred: the rider's middle is the lift's middle (column 89's, the lift drawn 4 px left).
        expect(toPx(p.centerX), `${c.name} phase ${k}`).toBe(89 * 16 + 8);
        expect(r.outcome, `${c.name} phase ${k}`).toBe('pipe');
        expect(hurt, `${c.name} phase ${k}`).toBe(false);
      }
    },
  );

  it('the campaign lift bears the skull mark; outside the campaign it is a plain lift that wraps', () => {
    const lifts = (w: World) =>
      w.entities.filter((e): e is Lift => e instanceof Lift && e.kind === 'lift-down');
    const camp = runSim({
      level: campaignLevel(getLevel('5-4')),
      character: MARIO,
      script: none,
      start: { x: 89, y: 2, mode: 'stand' },
      maxFrames: 2,
    });
    expect(lifts(camp.world).map((l) => l.descent)).toEqual([
      { level: '5-4-dungeon', x: 13, y: 0 },
      { level: '5-4-dungeon', x: 13, y: 0 },
    ]);
    const plain = runSim({
      level: getLevel('5-4'),
      character: MARIO,
      script: none,
      start: { x: 89, y: 2, mode: 'stand', time: 250 },
      maxFrames: 600,
      controller: rideLeft,
    });
    expect(lifts(plain.world).every((l) => l.descent === null)).toBe(true);
    expect(plain.events.some((e) => e.type === 'pipe')).toBe(false);
  });

  it('falling into the shaft without the lift still kills', () => {
    for (const c of [MARIO, SIMON]) {
      const r = runSim({
        level: campaignLevel(getLevel('5-4')),
        character: c,
        script: none,
        start: { x: 84, y: 11, mode: 'stand', time: 250 },
        maxFrames: 400,
      });
      expect(r.outcome, c.name).toBe('died');
      expect(r.events.some((e) => e.type === 'pipe')).toBe(false);
    }
  });

  it('jumping off the lift low in the shaft still kills', () => {
    const r = runSim({
      level: campaignLevel(getLevel('5-4')),
      character: MARIO,
      script: none,
      start: { x: 89, y: 2, mode: 'stand', time: 250 },
      maxFrames: 600,
      controller: (w) => {
        const b = w.player.body;
        // Ride down to the shaft's floor level, then hop off to the left into the open shaft.
        if (toPx(b.y) > 200) return ['left', 'jump'];
        return b.onGround ? rideLeft(w) : ['left'];
      },
    });
    expect(r.outcome).toBe('died');
  });
});

/** Attack toward the wall from beside it (column 6, facing left). */
const attackWall = (_w: World, f: number): Action[] => (f < 4 ? ['left'] : f % 8 < 4 ? ['attack'] : []);

describe('the cracked wall', () => {
  it.each(CHARACTERS.filter((c) => c !== MARIO && c !== LUIGI).map((c) => [c.name, c] as const))(
    "%s's attack breaks it: the whole three-tile doorway crumbles",
    (_n, c) => {
      const r = runSim({
        level: dungeon(),
        character: c,
        script: none,
        start: { x: 6, y: 10, mode: 'stand', time: 250 },
        maxFrames: 120,
        controller: attackWall,
        until: (w) => !wallStands(w),
      });
      expect(r.outcome, c.name).toBe('stopped');
      expect(wallDown(r.world), c.name).toBe(true);
      expect(r.world.player.dead).toBe(false);
      expect(r.world.crackedWalls()).toBe(false);
    },
  );

  /** Small Mario or Luigi stomps the Koopa (dropped on it from above), then walks into the shell. */
  function shellRun(c: typeof MARIO, kick: 'left' | 'right') {
    let phase: 'stomp' | 'kick' | 'clear' = 'stomp';
    return runSim({
      level: dungeon(),
      character: c,
      script: none,
      start: { x: 13, y: 10, mode: 'stand', time: 250 },
      maxFrames: 900,
      controller: (w, f) => {
        const p = w.player.body;
        const k = koopa(w);
        if (!k || f < 2) return [];
        if (phase === 'stomp') {
          if (k.state === 'walk') {
            // Drop onto it from just above.
            p.x = k.body.x;
            p.y = k.body.y - p.h - px(4);
            p.vy = 0x02000;
            p.vx = 0;
            phase = 'kick';
          }
          return [];
        }
        if (phase === 'kick') {
          if (!p.onGround || !k.isStillShell) return [];
          // Step to the kicking side, then walk into the shell.
          if (kick === 'left' && p.x < k.body.x + px(18)) p.x = k.body.x + px(18);
          if (kick === 'right' && p.x > k.body.x - p.w - px(2)) p.x = k.body.x - p.w - px(2);
          phase = 'clear';
          return [kick];
        }
        // Kicked: get out of its way, up onto the single block.
        if (k.isMovingShell && kick === 'right' && p.onGround) {
          p.x = px(11 * 16 + 2);
          p.y = px(10 * 16) - p.h;
        }
        return k.isStillShell ? [kick] : [];
      },
      until: (w) => !wallStands(w),
    });
  }

  it.each([MARIO, LUIGI].map((c) => [c.name, c] as const))(
    'small %s breaks it with the Koopa: stomped, its shell kicked into the wall plows on through',
    (_n, c) => {
      const r = shellRun(c, 'left');
      expect(r.outcome, c.name).toBe('stopped');
      expect(wallDown(r.world)).toBe(true);
      expect(r.world.player.powerState).toBe('small');
      expect(r.world.player.dead).toBe(false);
      // The shell keeps going left, through the opening and down the steps.
      const k = koopa(r.world) as Koopa;
      expect(k.isMovingShell).toBe(true);
      expect(k.body.vx).toBeLessThan(0);
    },
  );

  it.each([MARIO, LUIGI].map((c) => [c.name, c] as const))(
    'small %s kicks the shell the wrong way: it bounces off the single block and back into the wall',
    (_n, c) => {
      const r = shellRun(c, 'right');
      expect(r.outcome, c.name).toBe('stopped');
      expect(wallDown(r.world)).toBe(true);
      expect(r.world.player.dead).toBe(false);
    },
  );

  it("a small hero's head bump only jolts it; a big one's, or a blast, breaks it", () => {
    const at = (power: string) =>
      runSim({
        level: dungeon(),
        character: MARIO,
        state: { powerState: power },
        script: none,
        start: { x: 13, y: 10, mode: 'stand' },
        maxFrames: 2,
      }).world;
    const small = at('small');
    small.strikeBlock(WALL.x, 8, small.player, MARIO.canBreakBricks(small.player));
    expect(wallStands(small)).toBe(true);
    const big = at('big');
    big.strikeBlock(WALL.x, 10, big.player, MARIO.canBreakBricks(big.player));
    expect(wallDown(big)).toBe(true);
    const blast = at('small');
    blast.explode(px(WALL.x * 16 + 8), px(9 * 16), 12, null, { hurtsPlayers: false });
    expect(wallDown(blast)).toBe(true);
  });
});

describe('the Koopa comes back while the wall stands', () => {
  it('a lost Koopa walks back in at its spot; once the wall is down it stays gone', () => {
    const r = runSim({
      level: dungeon(),
      character: MARIO,
      script: none,
      start: { x: 13, y: 10, mode: 'stand' },
      maxFrames: 3,
    });
    const w = r.world;
    expect(w.entities.filter((e) => e instanceof Respawner)).toHaveLength(1);
    const first = koopa(w) as Koopa;
    expect(first).toBeDefined();
    first.destroy(); // killed, or fallen out
    const step = (n: number) => {
      for (let i = 0; i < n; i++) w.update([]);
    };
    step(RESPAWN_FRAMES - 5);
    expect(koopa(w)).toBeUndefined();
    step(10);
    const second = koopa(w) as Koopa;
    expect(second).toBeDefined();
    expect(second).not.toBe(first);
    expect(Math.round(toPx(second.body.x) / 16)).toBe(8);
    w.shatterWall(WALL.x, 9);
    expect(wallDown(w)).toBe(true);
    second.destroy();
    step(RESPAWN_FRAMES * 3);
    expect(koopa(w)).toBeUndefined();
  });
});

describe('candles give coins', () => {
  it('an attack, or a hero jumping into one, snuffs it for a coin', () => {
    const r = runSim({
      level: crypt(),
      character: SIMON,
      script: none,
      start: { x: 13, y: 11, mode: 'stand' },
      maxFrames: 2,
    });
    const w = r.world;
    const candles = () => w.entities.filter((e): e is Candle => e instanceof Candle && e.alive);
    expect(candles()).toHaveLength(3);
    const coins = w.state.coins;
    const p = w.player;
    // Touch the one at (14, 8).
    const c = candles().find((x) => toPx(x.body.x) >> 4 === 14) as Candle;
    p.body.x = c.body.x;
    p.body.y = c.body.y;
    w.update([]);
    expect(c.alive).toBe(false);
    expect(w.state.coins).toBe(coins + 1);
  });

  it.each([SIMON, MEGAMAN].map((c) => [c.name, c] as const))(
    "%s's attack from the crypt's landing snuffs the candle at (3, 5) without touching it",
    (_n, c) => {
      const r = runSim({
        level: crypt(),
        character: c,
        script: none,
        start: { x: 2, y: 5, mode: 'stand' },
        maxFrames: 120,
        controller: (_w, f) => (f < 20 ? [] : f % 8 < 4 ? ['attack'] : []),
        until: (w) => !w.entities.some((e) => e instanceof Candle && e.alive && toPx(e.body.x) >> 4 === 3),
      });
      expect(r.outcome, c.name).toBe('stopped');
      const p = r.world.player.body;
      // Still on the landing, well short of the candle: the whip or the shot did it.
      expect(toPx(p.x + p.w)).toBeLessThan(3 * 16 + 4);
      expect(r.world.state.coins).toBe(1);
    },
  );
});

/**
 * From the dungeon's landing: straight down the arrival shaft (Ryu would cling to its wall), back
 * off for a run-up, a jump over the single block, then on left.
 */
function leftOverBlock(w: World, mem: { run: boolean }): Action[] {
  const b = w.player.body;
  if (toPx(b.y + b.h) < 8 * 16) return [];
  const col = toPx(b.x) / 16;
  // Over the hole: let go (Ryu would cling to the room's edge).
  if (col < 2 && !b.onGround) return [];
  if (col < 11) return ['left'];
  if (!b.onGround) return ['left', 'jump'];
  if (!mem.run) {
    if (col < 13.3) return ['right'];
    mem.run = true;
    return [];
  }
  return w.frame % 4 < 2 ? ['left', 'jump'] : ['left'];
}

describe('every hero gets to Simon and back to 5-4', () => {
  it.each(CHARACTERS.map((c) => [c.name, c] as const))(
    '%s: down the steps behind the broken wall into the crypt, past Simon, out of the doorway into 5-4',
    (_n, c) => {
      // The dungeon, wall already down: walk left down the steps and drop through the hole.
      const mem = { run: false };
      const d = runSim({
        level: dungeon(),
        character: c,
        script: none,
        start: { time: 250 },
        maxFrames: 900,
        controller: (w, f) => {
          if (f === 1) {
            w.shatterWall(WALL.x, 9);
            koopa(w)?.destroy(); // out of the way (it stays gone with the wall down)
          }
          return leftOverBlock(w, mem);
        },
      });
      expect(d.outcome, c.name).toBe('pipe');
      expect(d.events.find((e) => e.type === 'pipe')).toMatchObject({ target: INTO_CRYPT });
      // The crypt: drop in, down the stair, up to Simon (talk range: 24 px), then on to the doorway.
      let reached = false;
      const r = runSim({
        level: crypt(),
        character: c,
        script: none,
        start: { time: 240 },
        maxFrames: 900,
        controller: (w) => {
          const b = w.player.body;
          if (
            b.onGround &&
            toPx(b.y + b.h) === 12 * 16 &&
            Math.abs(toPx(w.player.centerX) - (SIMON_AT.x * 16 + 8)) < 20
          )
            reached = true;
          return b.onGround ? ['right'] : []; // walking only (Ryu would cling to a step's side)
        },
      });
      expect(reached, `${c.name} stood beside Simon`).toBe(true);
      expect(r.outcome, c.name).toBe('pipe');
      expect(r.events.find((e) => e.type === 'pipe')).toMatchObject({ target: BACK_TO_5_4 });
      expect(r.world.time).toBeLessThanOrEqual(240);
      // Back in 5-4: dropped in at 99, past the lift shaft, landing on the floor safely.
      const back = runSim({
        level: getLevel('5-4'),
        character: c,
        script: none,
        start: { x: 99, y: 0, mode: 'fall', time: 200, clearEnemies: 'keep-piranhas' },
        maxFrames: 200,
      });
      expect(back.outcome, c.name).toBe('timeout');
      expect(back.world.player.body.onGround).toBe(true);
      expect(toPx(back.world.player.body.y + back.world.player.body.h)).toBe(13 * 16);
      expect(toPx(back.world.player.body.x) >> 4).toBeGreaterThanOrEqual(92);
    },
  );
});

describe('co-op arrivals', () => {
  /** Whether `p`'s body overlaps a solid tile of `w`. */
  const inWall = (w: World, b: { x: number; y: number; w: number; h: number }) => {
    for (let ty = toPx(b.y) >> 4; ty <= (toPx(b.y + b.h) - 1) >> 4; ty++)
      for (let tx = toPx(b.x) >> 4; tx <= (toPx(b.x + b.w) - 1) >> 4; tx++)
        if (w.map.isSolid(tx, ty)) return true;
    return false;
  };

  it.each([
    ['the dungeon', dungeon, 11],
    ['the crypt', crypt, 6],
  ] as const)('dropping into %s, both players land inside the room, on screen', (_n, level, floor) => {
    for (const c of CHARACTERS) {
      const r = runSim({
        level: level(),
        character: MARIO,
        state: { character2: c, powerState2: 'small', hp2: 0 },
        script: none,
        start: { time: 250 },
        maxFrames: 120,
      });
      expect(r.world.players, c.name).toHaveLength(2);
      for (const p of r.world.players) {
        const b = p.body;
        expect(p.dead, c.name).toBe(false);
        expect(b.onGround, `${c.name} P${p.index + 1} on the ground`).toBe(true);
        expect(toPx(b.y + b.h), `${c.name} P${p.index + 1} on the floor`).toBe(floor * 16);
        expect(toPx(b.x), c.name).toBeGreaterThanOrEqual(0);
        expect(toPx(b.x + b.w), c.name).toBeLessThanOrEqual(256);
        expect(inWall(r.world, b), `${c.name} P${p.index + 1} in a wall`).toBe(false);
      }
    }
  });

  it.each(CHARACTERS.map((c) => [c.name, c] as const))(
    'back from the crypt into 5-4 at 99 (campaign): player 2 (%s) lands clear of the fire bar at (103, 11)',
    (_n, c) => {
      for (const power of ['small', 'big'] as const)
        for (let k = 0; k < 4; k++) {
          let hurt = false;
          const r = runSim({
            level: campaignLevel(getLevel('5-4')),
            character: LUIGI,
            state: { powerState: power, character2: c, powerState2: power, hp2: 0 },
            script: none,
            start: { x: 99, y: 0, mode: 'fall', time: 200, clearEnemies: 'keep-piranhas' },
            maxFrames: 240,
            controller: (w, f) => {
              if (f === 0)
                for (const e of w.entities)
                  if (e instanceof Firebar && toPx(e.body.x) >> 4 === 103) e.angle = (k * 65536) / 4;
              if (w.players.some((p) => p.invuln > 0 || p.dead)) hurt = true;
              return [];
            },
          });
          expect(r.world.players).toHaveLength(2);
          expect(hurt, `${c.name} ${power} phase ${k}`).toBe(false);
          expect(r.events.some((e) => e.type === 'died')).toBe(false);
          for (const p of r.world.players) {
            expect(p.body.onGround).toBe(true);
            expect(toPx(p.body.y + p.body.h)).toBe(13 * 16);
            expect(toPx(p.body.x) >> 4).toBeGreaterThanOrEqual(92);
            expect(inWall(r.world, p.body)).toBe(false);
          }
        }
    },
  );

  it('every fall arrival of every level puts player 2 in the open, not inside or on top of a wall', () => {
    const bad: string[] = [];
    // Each level's own fall start, and every pit, descent and fall-exit transfer into a level.
    const arrivals = new Map<string, { level: string; x?: number; y?: number }>();
    for (const id of levelIds()) {
      const l = getLevel(id);
      if (l.startMode === 'fall') arrivals.set(id, { level: id });
      for (const z of l.zones) {
        if (!('target' in z) || !z.target) continue;
        const t = z.target as { level: string; x: number; y: number; exitDir?: string };
        if (z.kind === 'pit' || z.kind === 'descent' || t.exitDir === 'fall')
          arrivals.set(`${t.level} ${t.x},${t.y}`, { level: t.level, x: t.x, y: t.y });
      }
    }
    expect(arrivals.size).toBeGreaterThan(3);
    for (const [name, a] of arrivals) {
      const level = campaignLevel(getLevel(a.level));
      const r = runSim({
        level,
        character: MARIO,
        state: { character2: LUIGI, powerState2: 'small', hp2: 0 },
        script: none,
        start: {
          ...(a.x === undefined ? {} : { x: a.x, y: a.y }),
          mode: 'fall',
          clearEnemies: 'keep-piranhas',
        },
        maxFrames: 150,
      });
      const [p1, p2] = r.world.players;
      if (!p1 || !p2) continue;
      if (inWall(r.world, p2.body) || toPx(p2.body.y) < 0) bad.push(`${name} P2`);
    }
    expect(bad).toEqual([]);
  });
});

/** File 1 open on World 5, then 5-4 from the map's flow (campaign variant), on the down lift. */
function onTheLift(h: H): LevelScene {
  file({ cleared: ['1-0', '5-3'], pages: ['smb-1', 'smb-5'], position: { page: 'smb-5', node: '5-4' } });
  h.game.openFile(1);
  expect(h.top()).toBeInstanceOf(WorldMapScene);
  h.game.startLevel(getLevel('5-4'), { x: 89, y: 2, mode: 'stand', time: 250 });
  h.step();
  return h.top() as LevelScene;
}

const levelId = (h: H) => (h.top() as LevelScene).level?.id;

describe('the whole way in campaign play', () => {
  it('5-4 lift → dungeon → crypt → 5-4: the clock carries over, no secret and no clear recorded', () => {
    const h = makeGame();
    const l = onTheLift(h);
    expect(descents(l.level.zones)[0]?.campaign).toBeUndefined();
    for (let f = 0; f < 600 && levelId(h) === '5-4'; f++) h.step(rideLeft((h.top() as LevelScene).world));
    expect(levelId(h)).toBe('5-4-dungeon');
    const inDungeon = (h.top() as LevelScene).world;
    const arrived = inDungeon.time as number;
    expect(arrived).toBeLessThanOrEqual(250);
    expect(arrived).toBeGreaterThan(240);
    expect(h.game.mapProgress.secrets).toEqual([]);
    expect(h.game.mapProgress.cleared).not.toContain('5-4');
    h.idle(2);
    inDungeon.shatterWall(WALL.x, 9);
    koopa(inDungeon)?.destroy();
    const mem = { run: false };
    for (let f = 0; f < 900 && levelId(h) === '5-4-dungeon'; f++) h.step(leftOverBlock(inDungeon, mem));
    expect(levelId(h)).toBe('5-4-crypt');
    const c = (h.top() as LevelScene).world;
    h.idle(2);
    expect(captives(h.top() as LevelScene).map((x) => x.hero.id)).toEqual(['simon']);
    for (let f = 0; f < 900 && levelId(h) === '5-4-crypt'; f++) h.step(['right']);
    expect(levelId(h)).toBe('5-4');
    const main = (h.top() as LevelScene).world;
    expect(main.time).toBeLessThanOrEqual(c.time as number);
    expect(main.time).toBeGreaterThan(arrived - 60);
    expect(toPx(main.player.body.x) >> 4).toBe(99);
    expect(h.game.mapProgress.secrets).toEqual([]);
    expect(h.game.mapProgress.cleared).not.toContain('5-4');
  });
});

describe('captive Simon', () => {
  const intoCrypt = (h: H) => {
    h.game.openFile(1);
    h.game.startLevel(crypt(), { mode: 'fall', x: 1, y: 0, time: 250 });
    h.step();
    return h.top() as LevelScene;
  };

  it('kneels in the crypt only in campaign play, and only until freed', () => {
    const h = makeGame();
    file();
    const l = intoCrypt(h);
    h.idle(30);
    expect(captives(l).map((c) => c.hero.id)).toEqual(['simon']);
    const h1 = makeGame();
    file({ freed: ['mario', 'simon'] });
    const l1 = intoCrypt(h1);
    h1.idle(30);
    expect(captives(l1)).toHaveLength(0);
    const h2 = makeGame();
    h2.game.devStart('5-4-crypt', MARIO, 'small');
    h2.until(() => h2.top() instanceof LevelScene);
    h2.idle(30);
    expect(captives(h2.top() as LevelScene)).toHaveLength(0);
  });

  it('the map hints at node 5-4 on World 5', () => {
    expect(hiddenHeroes()).toContainEqual({
      hero: 'simon',
      level: '5-4-crypt',
      main: '5-4',
      page: 'smb-5',
      node: '5-4',
    });
    expect(hiddenHeroesAt('smb-5', '5-4').map((x) => x.hero)).toEqual(['simon']);
    expect(hiddenHeroesAt('smb-5', '5-3')).toEqual([]);
  });

  it("his words: Larry's wand woke Dracula's curse in him, he is Dracula's thrall; every line fits", () => {
    const def: MiniGameDef = {
      hero: 'simon',
      title: 'DRACULA',
      rules: [],
      create: () => ({ update() {}, render() {} }),
    };
    const simon = CHARACTERS.find((c) => c.id === 'simon')!;
    for (const talker of CHARACTERS) {
      const pages = captiveDialogue(simon, def, talker);
      for (const page of pages)
        for (const line of page) expect(line.length, `${talker.id}: ${line}`).toBeLessThanOrEqual(CARD_COLS);
      const own = (pages[1] ?? []).join(' ');
      expect(own).toContain("LARRY'S WAND");
      expect(own).toContain('DRACULA');
      expect(own).toContain('THRALL');
      expect(own).toContain(`${fontText(talker.name)}...`);
      expect(own).not.toContain('NO ONE PASSES HERE.');
    }
  });
});
