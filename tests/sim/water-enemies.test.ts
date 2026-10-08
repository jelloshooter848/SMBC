import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { LINK } from '@game/characters/link';
import { SIMON } from '@game/characters/simon';
import { Cheep } from '@game/entities/enemies/cheep';
import { Blooper } from '@game/entities/enemies/blooper';
import { Corpse } from '@game/entities/effects/effects';
import { Rng } from '@engine/rng';
import { SCREEN_W } from '@engine/viewport';
import { px, toPx, vel } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import { freshSeed, World } from '@game/world/world';
import type { EntitySpawn } from '@game/level/schema';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { LevelScene } from '@game/scenes/level';
import { makeGame } from './heroes-harness';

const map = (dir: string, id: string): LevelData =>
  parseTextMap(
    readFileSync(join(import.meta.dirname, '../../src/content/levels', dir, `${id}.map`), 'utf8'),
    id,
  );
const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

// Bug reports 2026-10-05-water-seabed-walk-speed and -water-swim-stroke-and-sinking:
// MarioBase.as JUMP_PWR_WATER = 200, water gravity 350, walksSlowUnderWater; Character.as
// vyMaxPsvWater = 250, vxMaxGroundWater = 90 (Flash px/s at 32 px tiles).
describe('Swimming (MarioBase water stats)', () => {
  /** Settle on the 2-2 sea floor, then run `ctl` for `frames` more frames. */
  const onFloor = (
    def: typeof MARIO,
    frames: number,
    ctl: (w: World, f: number) => Action[],
    watch: (w: World) => void,
  ): void => {
    let settled = -1;
    runSim({
      level: map('world2', '2-2'),
      character: def,
      script: none,
      maxFrames: 2000,
      assist: { invulnerable: true },
      controller: (w, f) => {
        if (settled < 0 && f > 10 && w.player.body.onGround) settled = f;
        if (settled < 0) return [];
        watch(w);
        return ctl(w, f - settled);
      },
      until: (_w, f) => settled >= 0 && f - settled >= frames,
    });
  };

  it.each([MARIO, LUIGI])('$id walks on the sea floor at 90 Flash px/s (0.75 px/f), half the walk', (def) => {
    let maxFloor = 0;
    onFloor(
      def,
      60,
      () => ['right'],
      (w) => {
        if (w.player.body.onGround) maxFloor = Math.max(maxFloor, Math.abs(w.player.body.vx));
      },
    );
    expect(maxFloor).toBe(vel(0.75));
  });

  it('swimming off the floor keeps the normal walking cap', () => {
    let maxSwim = 0;
    onFloor(
      MARIO,
      120,
      (_w, f) => (f % 20 === 0 ? ['right', 'jump'] : ['right']),
      (w) => {
        if (!w.player.body.onGround) maxSwim = Math.max(maxSwim, Math.abs(w.player.body.vx));
      },
    );
    expect(maxSwim).toBe(MARIO.movement.maxWalk);
  });

  it('heroes that are not MarioBase do not walk slowly on the floor', () => {
    let maxFloor = 0;
    onFloor(
      LINK,
      60,
      () => ['right'],
      (w) => {
        if (w.player.body.onGround) maxFloor = Math.max(maxFloor, Math.abs(w.player.body.vx));
      },
    );
    expect(maxFloor).toBeGreaterThan(vel(0.75));
  });

  it('one stroke from the floor lifts Mario about 28 px', () => {
    let floorFeet = 0;
    let minFeet = Infinity;
    onFloor(
      MARIO,
      90,
      (_w, f) => (f < 2 ? ['jump'] : []),
      (w) => {
        const feet = toPx(w.player.body.y + w.player.body.h);
        floorFeet ||= feet;
        minFeet = Math.min(minFeet, feet);
      },
    );
    const rise = floorFeet - minFeet;
    expect(rise).toBeGreaterThanOrEqual(26);
    expect(rise).toBeLessThanOrEqual(30);
  });

  // 0.4.25: each hero's sink is tuned apart (characters/<hero> `swim`); Simon keeps the original's.
  it.each([MARIO, SIMON])(
    '$id sinks at up to 250 Flash px/s (2.08 px/f), faster than he swims across',
    (def) => {
      let maxVy = 0;
      runSim({
        level: map('world2', '2-2'),
        character: def,
        script: none,
        maxFrames: 400,
        controller: (w) => {
          if (w.player.inWater) maxVy = Math.max(maxVy, w.player.body.vy);
          return [];
        },
        until: (w, f) => f > 10 && w.player.body.onGround,
      });
      expect(maxVy).toBe(0x02155);
      expect(maxVy).toBeGreaterThan(MARIO.movement.maxWalk);
    },
  );
});

// Bug report 2026-10-05-water-swimming-cheep-setup-and-motion (CheepFast.as setStats,
// calcMovement, calcPosition, updateStats; Level.as lines 953-958).
describe('Swimming Cheep Cheeps', () => {
  const fakeWorld = { frame: 0 } as unknown as World;
  const fish = (n: number, tx = 40, ty = 12): Cheep[] => {
    const rng = new Rng(1234);
    return Array.from({ length: n }, () => Cheep.swimmer(px(tx * 16), px(ty * 16), rng));
  };

  it('picks colour (and speed) 50/50 regardless of the map, 0.417 / 0.833 px/f', () => {
    const all = fish(200);
    const red = all.filter((c) => c.color === 'red');
    expect(red.length).toBeGreaterThan(70);
    expect(red.length).toBeLessThan(130);
    for (const c of all) expect(c.body.vx).toBe(c.color === 'red' ? -0x00d55 : -0x006ab);
  });

  it('starts within two tiles of its map spot, with its bottom in rows 3-11', () => {
    const rng = new Rng(1234);
    const xs = new Set<number>();
    for (const ty of [12, 2])
      for (let i = 0; i < 100; i++) {
        const s = Cheep.placeSwimmer({ type: 'cheep-grey', x: 40, y: ty }, rng);
        xs.add(s.x - 40);
        expect(Math.abs(s.x - 40)).toBeLessThanOrEqual(2);
        expect(s.y).toBeGreaterThanOrEqual(3);
        expect(s.y).toBeLessThanOrEqual(11);
      }
    expect(xs.size).toBe(5);
    const other = { type: 'goomba', x: 40, y: 12 };
    expect(Cheep.placeSwimmer(other, rng)).toBe(other);
  });

  // Bug report 2026-10-06-2-2-swimming-cheeps-same-every-visit: the world RNG was seeded from the
  // length of the level id, so every visit (and 7-2) got the same school.
  describe('a new school on every visit', () => {
    const ctx = () => ({
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: DEFAULT_ASSIST,
      reduceFlashing: true,
    });
    /** The swimmers' colours and start spots as the world placed them at load. */
    const school = (w: World): string =>
      (w as unknown as { spawns: EntitySpawn[] }).spawns
        .filter((s) => s.type.startsWith('cheep'))
        .map((s) => `${s.type}@${s.x},${s.y}`)
        .join(' ');
    // A visit in play: LevelScene gives every world a fresh seed.
    const visit = (id: string) =>
      new World(map(id === '2-2' ? 'world2' : 'world7', id), ctx(), newGameState(MARIO), {
        seed: freshSeed(),
      });

    it('two visits to 2-2 differ, and 2-2 and 7-2 do not share a seed', () => {
      const a = school(visit('2-2'));
      expect(a.length).toBeGreaterThan(0);
      expect(school(visit('2-2'))).not.toBe(a);
      expect(visit('2-2').rng.next()).not.toBe(visit('7-2').rng.next());
    });

    it('headless runs stay repeatable, and runSim can pass its own seed', () => {
      const run = (seed?: number) =>
        school(
          runSim({
            level: map('world2', '2-2'),
            character: MARIO,
            script: none,
            maxFrames: 1,
            ...(seed === undefined ? {} : { seed }),
          }).world,
        );
      expect(run()).toBe(run());
      expect(run(5)).toBe(run(5));
      expect(run(5)).not.toBe(run(6));
    });

    // A sim played through Game (heroes-harness makeGame) got a Math.random seed for every level,
    // so bill-camp's "7-3 bridge → camp → falls" run lost Mario to a leaping Cheep Cheep about one
    // run in fifty. Only main.ts asks for fresh seeds; a Game in a test keeps each level's own.
    it('a Game keeps the fixed seed unless it asks for fresh ones, and main.ts does', () => {
      const visit = (freshSeeds: boolean) => {
        const h = makeGame({ freshSeeds });
        h.game.devStart('2-2', MARIO, 'small');
        h.until(() => h.top() instanceof LevelScene);
        return school((h.top() as LevelScene).world);
      };
      const headless = school(
        runSim({ level: map('world2', '2-2'), character: MARIO, script: none, maxFrames: 1 }).world,
      );
      expect(visit(false)).toBe(headless);
      expect(visit(false)).toBe(headless);
      expect(visit(true)).not.toBe(visit(true));
      const main = readFileSync(join(import.meta.dirname, '../../src/main.ts'), 'utf8');
      expect(main).toMatch(/^\s*freshSeeds: true,$/m);
    });
  });

  it('in 7-2 no swimming fish is ever spawned inside the visible screen', () => {
    const seen = new Set<Cheep>();
    const inView: number[] = [];
    runSim({
      level: map('world7', '7-2'),
      character: MARIO,
      script: none,
      maxFrames: 3000,
      assist: { invulnerable: true },
      controller: (w, f) => {
        for (const e of w.entities)
          if (e instanceof Cheep && !e.flying && !seen.has(e)) {
            seen.add(e);
            // Spawned during the previous update, with the camera where it is now.
            if (f > 1 && e.body.x < w.camera.x + px(SCREEN_W)) inView.push(toPx(e.body.x - w.camera.x));
          }
        // Carry the player along the top of the water at swimming speed, past any wall.
        w.player.body.x = px(32) + (f * MARIO.movement.maxWalk) / 16;
        w.player.body.y = px(48);
        w.player.body.vy = 0;
        return [];
      },
    });
    expect(seen.size).toBeGreaterThan(10);
    expect(inView).toEqual([]);
  });

  it('half swim level, the rest wave a tile up and down at 0.167 px/f', () => {
    const all = fish(60);
    const wave = all.filter((c) => c.wave);
    expect(wave.length).toBeGreaterThan(15);
    expect(wave.length).toBeLessThan(45);
    for (const c of all) {
      const y0 = c.body.y;
      let lo = y0;
      let hi = y0;
      for (let i = 0; i < 400; i++) {
        c.update(fakeWorld);
        lo = Math.min(lo, c.body.y);
        hi = Math.max(hi, c.body.y);
      }
      if (c.wave) {
        expect(y0 - lo).toBe(px(16));
        expect(hi - y0).toBe(px(16));
        // 16 px up at 0.167 px/f takes about 96 frames.
      } else expect(hi - lo).toBe(0);
    }
  });
});

// Bug reports 2026-10-05-2-3-flying-cheep-leap-too-low and -direction-speed (CheepFast.as
// calcFlyingStats, FLYING_JUMP_PWR, FLYING_GRAVITY; FlyingCheepSpawner.as).
describe('Leaping Cheep Cheeps', () => {
  const fakeWorld = { frame: 0 } as unknown as World;
  const lead = (vx: number, centerX = px(128), marioWalk: number | null = MARIO.movement.maxWalk) => ({
    centerX,
    vx,
    marioWalk,
  });

  it('peaks about 2 tiles below the top of the screen and stays up about 3 s', () => {
    const c = Cheep.leaper(new Rng(7), 0, 240, lead(0), true);
    let top = Infinity;
    let frames = 0;
    while (c.alive && frames < 600) {
      c.update(fakeWorld);
      top = Math.min(top, toPx(c.body.y) - 2);
      frames++;
    }
    expect(top).toBeGreaterThanOrEqual(26);
    expect(top).toBeLessThanOrEqual(38);
    expect(frames).toBeGreaterThan(170);
  });

  it('flies the way a walking player moves, at 0.42-2.08 px/f, never from the middle of the screen', () => {
    const rng = new Rng(99);
    for (let i = 0; i < 200; i++) {
      const c = Cheep.leaper(rng, px(1000), 240, lead(MARIO.movement.maxWalk), false);
      expect(c.body.vx).toBeGreaterThanOrEqual(0x006ab);
      expect(c.body.vx).toBeLessThanOrEqual(0x02155);
      const sx = toPx(c.body.x + px(6) - px(1000));
      expect(sx <= 68 || sx >= 187).toBe(true);
      const l = Cheep.leaper(rng, px(1000), 240, lead(-MARIO.movement.maxWalk), true);
      expect(l.body.vx).toBeLessThan(0);
    }
  });

  it('keeps pace with a running Mario at the full 250 Flash px/s', () => {
    const c = Cheep.leaper(new Rng(5), 0, 240, lead(MARIO.movement.maxRun), true);
    expect(c.body.vx).toBe(0x02155);
  });

  it('heads toward a standing player, but only right until he has not moved right for 2 s', () => {
    const rng = new Rng(3);
    for (let i = 0; i < 50; i++) {
      const c = Cheep.leaper(rng, 0, 240, lead(0), true);
      const cx = c.body.x + px(6);
      expect(Math.sign(c.body.vx)).toBe(cx > px(128) ? -1 : 1);
      expect(Cheep.leaper(rng, 0, 240, lead(0), false).body.vx).toBeGreaterThan(0);
    }
  });

  it('on the 2-3 bridges: at most 3 out, spawned 36-63 frames apart, all flying right while Mario walks and 2 s after', () => {
    const spawned: number[] = [];
    const seen = new Set<Cheep>();
    let most = 0;
    let anyLeft = false;
    runSim({
      level: map('world2', '2-3'),
      character: MARIO,
      script: none,
      maxFrames: 600,
      start: { x: 20, y: 9, mode: 'stand' },
      assist: { invulnerable: true },
      controller: (w, f) => {
        const fl = w.entities.filter((e): e is Cheep => e instanceof Cheep && e.flying && e.alive);
        most = Math.max(most, fl.length);
        for (const c of fl)
          if (!seen.has(c)) {
            seen.add(c);
            spawned.push(f);
            if (c.body.vx < 0 && f < 300 + 120) anyLeft = true;
          }
        return f < 300 ? ['right'] : [];
      },
    });
    expect(spawned.length).toBeGreaterThan(3);
    expect(most).toBeLessThanOrEqual(3);
    expect(spawned[0]).toBeGreaterThanOrEqual(36);
    expect(anyLeft).toBe(false);
  });
});

// Bug reports 2026-10-05-blooper-sink-speed-and-rise-rule and -blooper-out-of-water-not-stompable
// (Bloopa.as setStats, updateStats, stomp; MAX_BOTTOM_Y).
describe('Bloopers', () => {
  const oneBlooper = (x: number, y: number): LevelData => {
    const l = map('world7', '7-2');
    l.entities = [{ type: 'blooper', x, y }];
    l.start = { x: 20, y: 12 };
    l.startMode = 'stand';
    return l;
  };

  it('sinks at 0.667 px/f and keeps sinking above Mario down to MAX_BOTTOM_Y (y 184)', () => {
    let bl: Blooper | undefined;
    const bottoms: number[] = [];
    runSim({
      level: oneBlooper(22, 3),
      character: MARIO,
      script: none,
      maxFrames: 540,
      assist: { invulnerable: true },
      controller: (w) => {
        bl ??= w.entities.find((e): e is Blooper => e instanceof Blooper);
        if (bl?.alive) bottoms.push(bl.body.y + bl.body.h);
        return [];
      },
    });
    expect(bl).toBeDefined();
    // Sinking: 0x00aab per frame (2730/16 sub, floored) for the first frames.
    expect((bottoms[5] as number) - (bottoms[4] as number)).toBe(px(2730 / 4096) | 0);
    const lowest = Math.max(...bottoms.map(toPx));
    expect(lowest).toBeGreaterThanOrEqual(184);
    expect(lowest).toBeLessThanOrEqual(186);
    // It got there in about 3 s, never rising on the way.
    const first = bottoms.findIndex((b) => toPx(b) >= 184);
    expect(first).toBeLessThan(200);
    for (let i = 1; i < first; i++)
      expect(bottoms[i] as number).toBeGreaterThanOrEqual(bottoms[i - 1] as number);
  });

  it('rises in a quick burst of about 33-40 px up and sideways that friction stops', () => {
    let bl: Blooper | undefined;
    let start: { x: number; y: number } | null = null;
    let top = Infinity;
    let side = 0;
    runSim({
      level: oneBlooper(22, 9),
      character: MARIO,
      script: none,
      maxFrames: 400,
      assist: { invulnerable: true },
      controller: (w) => {
        bl ??= w.entities.find((e): e is Blooper => e instanceof Blooper);
        if (bl?.alive) {
          if (!start && bl.body.vy < 0) start = { x: bl.body.x, y: bl.body.y };
          if (start && bl.body.vy < 0) {
            top = Math.min(top, bl.body.y);
            side = Math.max(side, Math.abs(bl.body.x - start.x));
          }
        }
        return [];
      },
    });
    expect(start).not.toBeNull();
    const s = start as unknown as { y: number };
    const rise = toPx(s.y - top);
    expect(rise).toBeGreaterThanOrEqual(30);
    expect(rise).toBeLessThanOrEqual(45);
    expect(toPx(side)).toBeGreaterThanOrEqual(30);
  });

  /** A flat overworld (not a water level) with one Blooper at (10, 8). */
  const dry = (): LevelData => {
    const rows = Array.from({ length: 13 }, () => '.'.repeat(32));
    return parseTextMap(
      [
        'id: t',
        'time: 300',
        'start: 10,3',
        '',
        '[tiles]',
        ...rows,
        '#'.repeat(32),
        '#'.repeat(32),
        '',
        '[entities]',
        'blooper 10 8',
      ].join('\n'),
    );
  };

  it('out of water a Blooper can be stomped for 1000 points', () => {
    let bl: Blooper | undefined;
    const r = runSim({
      level: dry(),
      character: MARIO,
      script: none,
      maxFrames: 120,
      controller: (w) => {
        bl ??= w.entities.find((e): e is Blooper => e instanceof Blooper);
        return [];
      },
      until: () => bl !== undefined && !bl.alive,
    });
    expect(r.outcome).toBe('stopped');
    expect(r.world.player.dead).toBe(false);
    expect(r.world.player.powerState).toBe('small');
    expect(r.score).toBe(1000);
  });

  // Bug report 2026-10-06-blooper-out-of-water-stomp-drifts: Bloopa.stomp() calls die() and then
  // sets vx = 0, vy = 0, so it drops straight down without the knock-out hop.
  it('a stomped Blooper drops straight down from where it was stomped', () => {
    let bl: Blooper | undefined;
    let corpse: Corpse | undefined;
    const ys: number[] = [];
    const xs: number[] = [];
    runSim({
      level: dry(),
      character: MARIO,
      script: none,
      maxFrames: 200,
      controller: (w) => {
        bl ??= w.entities.find((e): e is Blooper => e instanceof Blooper);
        corpse ??= w.entities.find((e): e is Corpse => e instanceof Corpse);
        if (corpse?.alive) {
          ys.push(corpse.body.y);
          xs.push(corpse.body.x);
        }
        return [];
      },
    });
    expect(corpse).toBeDefined();
    expect(ys.length).toBeGreaterThan(5);
    // No sideways drift, and no hop: it only ever falls.
    for (const x of xs) expect(x).toBe(xs[0]);
    for (let i = 1; i < ys.length; i++) expect(ys[i] as number).toBeGreaterThanOrEqual(ys[i - 1] as number);
    expect(corpse?.upsideDown).toBe(true);
  });

  it('in water it still cannot be stomped', () => {
    const r = runSim({
      level: oneBlooper(22, 6),
      character: MARIO,
      script: none,
      maxFrames: 2,
    });
    const bl = r.world.entities.find((e): e is Blooper => e instanceof Blooper);
    expect(bl?.stompable).toBe(false);
    expect(bl?.vulnerability.stomp).toBe('hurtAttacker');
  });
});
