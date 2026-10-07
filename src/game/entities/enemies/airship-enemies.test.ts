import { describe, expect, it } from 'vitest';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { NullRenderer } from '@engine/gfx/renderer';
import { px, toPx, velToSub } from '@engine/math/units';
import { PALETTES, SPRITES } from '@content/sprites';
import { parseTextMap } from '../../level/textmap';
import { ScriptedInput } from '../../sim/headless';
import { World } from '../../world/world';
import { DEFAULT_ASSIST, newGameState } from '../../context';
import { MARIO } from '../../characters/mario';
import { CHARACTERS } from '../../characters/registry';
import type { DamageSource, Reaction } from '../../rules/damage';
import { BUSTER, CHARGED_BUSTER, FIREBALL, type ProjectileSpec } from '../projectiles/projectile';
import { BEAMS, BEAM_NAMES } from '../../characters/samus/weapons';
import { GUNS } from '../../characters/bill/weapons';
import {
  BALL_DIAG_SPEED,
  BALL_SPEED,
  CANNON_DIRS,
  CANNON_PERIOD,
  Cannon,
  Cannonball,
  type CannonDir,
} from './cannon';
import { ROCKY_HIDE, RockyWrench, Wrench } from './rocky-wrench';

// SMB3 airship enemies for Larry's airship deck (4-2-airship.map): cannons and their
// cannonballs, and Rocky Wrench in his manhole.

const W = 48;
/** A flat deck (rows 13-14), the hero at column 2, with `entities` lines. */
function deck(
  entities: string[],
  opts: { invulnerable?: boolean; power?: string; character?: typeof MARIO } = {},
) {
  const level = parseTextMap(
    [
      'id: t',
      'theme: airship-deck',
      'time: 400',
      'start: 2,12',
      '',
      '[tiles]',
      ...Array.from({ length: 13 }, () => '.'.repeat(W)),
      '#'.repeat(W),
      '#'.repeat(W),
      '',
      '[entities]',
      ...entities,
    ].join('\n'),
  );
  const sfx: string[] = [];
  const state = { ...newGameState(opts.character ?? MARIO), powerState: opts.power ?? 'big' };
  const world = new World(
    level,
    {
      assets: new AssetRegistry({ default: {} }),
      audio: { ...NULL_AUDIO, sfx: (id: string) => void sfx.push(id) },
      assist: { ...DEFAULT_ASSIST, invulnerable: opts.invulnerable ?? true },
      reduceFlashing: true,
    },
    state,
    { mode: 'stand', seed: 99 },
  );
  const input = new ScriptedInput({ steps: [] });
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      input.setHeld([]);
      input.next();
      world.update([input]);
    }
  };
  /** Keep the hero parked at column `col` (on the deck) while stepping. */
  const park = (col: number, n = 1) => {
    for (let i = 0; i < n; i++) {
      world.player.body.x = px(col * 16 + 2);
      step();
    }
  };
  return { world, step, park, state, sfx };
}

const src = (kind: DamageSource['kind'], amount = 1): DamageSource => ({
  kind,
  amount,
  owner: null,
  dirX: 1,
});
const balls = (w: World) => w.entities.filter((e): e is Cannonball => e instanceof Cannonball && e.alive);

describe('cannon', () => {
  it('is a solid block that fires a cannonball every period while on screen, with the cannon sfx', () => {
    const { world, park, sfx } = deck(['cannon 12 12 dir=l period=60 delay=10']);
    park(2, 2);
    const cannon = world.entities.find((e): e is Cannon => e instanceof Cannon) as Cannon;
    expect(cannon).toBeInstanceOf(Cannon);
    expect(world.map.isSolid(12, 12)).toBe(true);
    park(2, 10);
    expect(cannon.shots).toBe(1);
    expect(sfx).toContain('cannon');
    park(2, 120);
    expect(cannon.shots).toBe(3);
  });

  it('holds fire while it is off screen', () => {
    const { world, park } = deck(['cannon 30 12 dir=l period=40 delay=5']);
    park(2, 200);
    // Spawned (it is within the spawn margin) but never on screen: no shots.
    const cannon = world.entities.find((e): e is Cannon => e instanceof Cannon);
    expect(cannon?.shots ?? 0).toBe(0);
    expect(balls(world)).toHaveLength(0);
  });

  it('a bad period= or delay= falls back to the defaults instead of firing every frame', () => {
    const { world, park } = deck(['cannon 12 12 dir=l period=fast delay=soon']);
    park(2, 2);
    const cannon = world.entities.find((e): e is Cannon => e instanceof Cannon) as Cannon;
    expect(cannon.period).toBe(CANNON_PERIOD);
    expect(Number.isFinite(cannon.timer)).toBe(true);
    park(2, CANNON_PERIOD * 2 + 30);
    expect(cannon.shots).toBeLessThanOrEqual(3);
    expect(cannon.shots).toBeGreaterThanOrEqual(1);
    const odd = new Cannon(3, 4, 'r', Number.NaN, Number.NaN);
    expect(odd.period).toBe(CANNON_PERIOD);
    expect(Number.isFinite(odd.timer)).toBe(true);
  });

  it('staggers cannons without a delay by their position', () => {
    const a = new Cannon(10, 4, 'dl');
    const b = new Cannon(11, 4, 'dr');
    expect(a.timer).not.toBe(b.timer);
  });

  it.each(CANNON_DIRS.map((d) => [d]))(
    'a %s cannon fires straight out of its barrel, through tiles',
    (dir) => {
      const { world, park } = deck([`cannon 8 9 dir=${dir} period=200 delay=5`]);
      park(2, 6);
      const [ball] = balls(world);
      expect(ball).toBeDefined();
      const want: Record<CannonDir, [number, number]> = {
        r: [BALL_SPEED, 0],
        l: [-BALL_SPEED, 0],
        ul: [-BALL_DIAG_SPEED, -BALL_DIAG_SPEED],
        ur: [BALL_DIAG_SPEED, -BALL_DIAG_SPEED],
        dl: [-BALL_DIAG_SPEED, BALL_DIAG_SPEED],
        dr: [BALL_DIAG_SPEED, BALL_DIAG_SPEED],
      };
      expect([ball?.body.vx, ball?.body.vy]).toEqual(want[dir as CannonDir]);
      // It starts outside the cannon's cell and flies on in a straight line, deck or no deck.
      const b = (ball as Cannonball).body;
      const x0 = b.x;
      const y0 = b.y;
      park(2, 40);
      expect(b.x - x0).toBe(40 * velToSub(want[dir as CannonDir][0]));
      expect(b.y - y0).toBe(40 * velToSub(want[dir as CannonDir][1]));
    },
  );

  it('holds a point-blank shot while the hero stands at its muzzle', () => {
    const { world, park } = deck(['cannon 4 12 dir=l period=60 delay=5']);
    park(3, 100);
    const cannon = world.entities.find((e): e is Cannon => e instanceof Cannon) as Cannon;
    expect(cannon.shots).toBe(0);
  });

  it('draws rects without the art and never throws', () => {
    const { world, park } = deck(['cannon 8 12 dir=ul delay=3', 'rocky 12 12']);
    park(2, 30);
    const view = {
      camX: 0,
      frame: 1,
      assets: new AssetRegistry({ default: {} }),
      theme: 'airship-deck' as const,
      reduceFlashing: true,
    };
    const r = new NullRenderer();
    for (const e of world.entities) expect(() => e.render(r, view)).not.toThrow();
    const real = new AssetRegistry(PALETTES);
    real.defineAll(SPRITES);
    for (const e of world.entities) expect(() => e.render(r, { ...view, assets: real })).not.toThrow();
  });
});

describe('cannonball', () => {
  it('hurts on contact', () => {
    const { world, step, state } = deck([], { invulnerable: false });
    const p = world.player;
    world.spawn(new Cannonball(p.centerX + px(10), p.body.y + px(12), -BALL_SPEED, 0));
    step(12);
    expect(state.powerState === 'small' || p.powerState === 'small').toBe(true);
  });

  it('a stomp drops it (100 points) and bounces the hero; fireballs bounce off it', () => {
    const { world, step, state } = deck([], { invulnerable: false });
    const p = world.player;
    const ball = new Cannonball(p.centerX, p.body.y - px(20), -0x00100, 0);
    expect(ball.hit(src('fireball'), world)).toBe('immune');
    world.spawn(ball);
    p.body.y = ball.body.y - p.body.h - px(4);
    p.body.vy = 0x03000;
    p.body.onGround = false;
    p.body.prevBottom = p.body.y + p.body.h;
    const score = state.score;
    step(2);
    expect(ball.alive).toBe(false);
    expect(p.body.vy).toBeLessThan(0);
    expect(state.score - score).toBeGreaterThanOrEqual(100);
    expect(p.powerState).toBe('big');
  });
});

describe('Rocky Wrench', () => {
  const rocky = (w: World) =>
    w.entities.find((e): e is RockyWrench => e instanceof RockyWrench) as RockyWrench;

  it('hides in its manhole (harmless, unhittable) until the hero comes near', () => {
    const { world, park } = deck(['rocky 15 12']);
    park(2, 5);
    const r = rocky(world);
    // Far away: stays down.
    park(2, 200);
    expect(r.state).toBe('hide');
    expect(r.exposed).toBe(false);
    expect(r.contactHurts).toBe(false);
    expect(r.stompable).toBe(false);
    expect(r.hit(src('stomp'), world)).toBe('immune');
    expect(r.hit(src('sword'), world)).toBe('immune');
    expect(toPx(r.body.y)).toBe(13 * 16);
  });

  it('pops up, faces the hero, throws a wrench straight at them, ducks and repeats', () => {
    const { world, park } = deck(['rocky 12 12']);
    park(5, 5);
    const r = rocky(world);
    let wrench: Wrench | undefined;
    for (let f = 0; f < 200 && !wrench; f++) {
      park(5);
      wrench = world.entities.find((e): e is Wrench => e instanceof Wrench && e.alive);
    }
    expect(wrench).toBeDefined();
    expect(r.facing).toBe(-1);
    expect(r.exposed).toBe(true);
    expect((wrench as Wrench).body.vx).toBeLessThan(0);
    expect((wrench as Wrench).body.vy).toBe(0);
    // At the height of its hand, i.e. of a hero standing on the same deck.
    const p = world.player;
    expect(wrench!.body.y).toBeGreaterThan(p.body.y - px(4));
    expect(wrench!.body.y).toBeLessThan(p.body.y + p.body.h);
    for (let f = 0; f < 100 && r.state !== 'hide'; f++) park(5);
    expect(r.state).toBe('hide');
    for (let f = 0; f < ROCKY_HIDE + 60 && r.thrown < 2; f++) park(5);
    expect(r.thrown).toBe(2);
  });

  it('turns to throw at a hero on its right', () => {
    const { world, park } = deck(['rocky 6 12']);
    park(10, 5);
    const r = rocky(world);
    for (let f = 0; f < 200 && r.thrown === 0; f++) park(10);
    expect(r.facing).toBe(1);
    const w = world.entities.find((e): e is Wrench => e instanceof Wrench);
    expect(w?.body.vx).toBeGreaterThan(0);
  });

  it('never pops up under a hero standing on its lid', () => {
    const { world, park } = deck(['rocky 6 12']);
    park(6, 300);
    expect(rocky(world).state).toBe('hide');
    expect(rocky(world).thrown).toBe(0);
  });

  it('never pops up under a hero jumping in place over its lid, however high', () => {
    const { world, park, state } = deck(['rocky 6 12'], { invulnerable: false });
    const p = world.player;
    let top = Infinity;
    for (let f = 0; f < 600; f++) {
      // A high jump each time the hero lands (over 3 tiles up).
      if (p.body.onGround) {
        p.body.vy = -0x07000;
        p.body.onGround = false;
      }
      park(6);
      top = Math.min(top, toPx(p.body.y + p.body.h));
      expect(rocky(world).state, `frame ${f}`).toBe('hide');
    }
    expect(13 * 16 - top).toBeGreaterThan(40); // well above the old 40 px bound
    expect(rocky(world).thrown).toBe(0);
    expect(state.powerState === 'big' && p.powerState === 'big').toBe(true);
  });

  it('a wrench hurts the hero', () => {
    const { world, step, state } = deck(['rocky 8 12'], { invulnerable: false });
    for (let f = 0; f < 300 && state.powerState === 'big' && world.player.powerState === 'big'; f++) {
      world.player.body.x = px(4 * 16 + 2);
      step();
    }
    expect(world.player.powerState).toBe('small');
  });

  it('up, a stomp knocks it out for 100 points', () => {
    const { world, park, state } = deck(['rocky 12 12']);
    park(6, 5);
    const r = rocky(world);
    for (let f = 0; f < 200 && r.state !== 'aim'; f++) park(6);
    const score = state.score;
    expect(r.hit(src('stomp'), world)).toBe('kill');
    expect(r.alive).toBe(false);
    expect(r.scoreFor('stomp')).toBe(100);
    expect(r.scoreFor('fireball')).toBe(100);
    expect(state.score).toBeGreaterThanOrEqual(score);
  });
});

describe('every hero can deal with the airship enemies (or at least avoid them)', () => {
  const MELEE = 'melee';
  /** Each hero's main attack: its primary shots (each power level), or its melee. */
  const MAIN: Record<string, readonly (ProjectileSpec | typeof MELEE)[]> = {
    mario: [FIREBALL],
    luigi: [FIREBALL],
    link: [MELEE],
    megaman: [BUSTER, CHARGED_BUSTER],
    samus: BEAMS,
    simon: [MELEE],
    ryu: [MELEE],
    bill: GUNS.map((g) => g.spec),
  };
  const KILLS: readonly Reaction[] = ['kill', 'flip', 'hp', 'stun'];

  it('covers the whole roster', () => {
    expect(Object.keys(MAIN).sort()).toEqual(CHARACTERS.map((c) => c.id).sort());
  });

  /**
   * Cannonballs, like Bullet Bills, shrug off fire, boomerangs and ice: Mario and Luigi stomp
   * them, everyone else cuts or shoots them down, and Samus's Ice Beam (the one beam that only
   * freezes) leaves her to jump them. Rocky Wrench, once up, falls to anything.
   */
  const AVOID_ONLY: Record<string, string[]> = { samus: ['Ice Beam'] };

  for (const c of CHARACTERS)
    it(c.name, () => {
      const { world } = deck([]);
      (MAIN[c.id] ?? []).forEach((a, i) => {
        const hit: DamageSource =
          a === MELEE ? src('sword') : { kind: a.damage, amount: a.amount, owner: null, dirX: 1 };
        const what = a === MELEE ? 'melee' : c.id === 'samus' ? (BEAM_NAMES[i] as string) : a.kind;
        // Cannonball: stomped, or shot / cut down.
        const ball = new Cannonball(0, 0, -BALL_SPEED, 0);
        const r = ball.hit(hit, world);
        const ok = c.stomps || KILLS.includes(r) || (AVOID_ONLY[c.id] ?? []).includes(what);
        expect(ok, `${c.id} ${what} vs cannonball: ${r}`).toBe(true);
        if (!c.stomps && !(AVOID_ONLY[c.id] ?? []).includes(what))
          expect(r, `${c.id} ${what}`).not.toBe('immune');
        // Rocky Wrench, up out of his hole: every main attack lands.
        const rocky = new RockyWrench(5, 12);
        (rocky as unknown as { setOut(n: number): void }).setOut(16);
        expect(KILLS, `${c.id} ${what} vs Rocky Wrench`).toContain(rocky.hit(hit, world));
      });
    });
});
