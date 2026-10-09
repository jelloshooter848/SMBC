import { describe, expect, it } from 'vitest';
import { getLevel } from '@content/levels';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { px, toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { parseTextMap } from '../../level/textmap';
import { heroVariant } from '../../level/variants';
import { ScriptedInput } from '../../sim/headless';
import { World } from '../../world/world';
import { DEFAULT_ASSIST, newGameState } from '../../context';
import type { MARIO } from '../../characters/mario';
import type { Entity } from '../entity';
import { MEGAMAN } from '../../characters/megaman';
import { T } from '../../level/tiles';
import { Pickup } from '../objects/pickup';
import { Projectile } from '../projectiles/projectile';
import { CANNON_HP, CANNON_POINTS, Cannon, Cannonball } from './cannon';
import { BulletBill } from './bullet-bill';
import {
  LARRY_HP,
  LARRY_MM_FLASH,
  LARRY_MM_HEAVY,
  LARRY_MM_HP,
  LARRY_MM_SHOT,
  LARRY_MM_STOMP,
  Larry,
  WAND_BLAST_POINTS,
  WandBlast,
} from './larry';
import {
  Gull,
  JOE_GUARD,
  JOE_HP,
  ShieldJoe,
  SkyBomb,
  Telly,
  TELLY_MAX_OUT,
  TELLY_PERIOD,
  TellyPort,
  Yoku,
  YOKU_ON,
  YOKU_PERIOD,
} from './wily-sky';

// Mega Man's airship, the "Wily-sky remix" (0.4.39): on a level laid with his `[variant megaman]`
// section (World.megamanShip) he shoots things down rather than stomping them: cannonballs and
// Bullet Bills for points, cannons wrecked by four buster hits (a charge shot counts three), a
// charge shot through a line of them; his own enemies (Telly hatches, robot gulls and their bombs,
// shielded Joes) and appearing blocks; every drop where it can be collected; in Larry's room a
// hit-point bar and wand blasts that can be shot down.

const W = 48;
type Opts = { mm?: boolean; helmet?: boolean; invulnerable?: boolean; character?: typeof MARIO };

/** A flat deck (rows 13-14) with `entities`, Mega Man at column 2; `mm` tags it as his airship. */
function deck(entities: string[], opts: Opts = {}, rows?: string[]) {
  const level = parseTextMap(
    [
      'id: t',
      'theme: airship-deck',
      'time: 400',
      'start: 2,12',
      '',
      '[tiles]',
      ...(rows ?? [...Array.from({ length: 13 }, () => '.'.repeat(W)), '#'.repeat(W), '#'.repeat(W)]),
      '',
      '[entities]',
      ...entities,
    ].join('\n'),
  );
  if (opts.mm !== false) level.heroVariants = ['megaman'];
  return run(level, opts);
}

function run(level: Parameters<typeof heroVariant>[0], opts: Opts = {}) {
  const sfx: string[] = [];
  const c = opts.character ?? MEGAMAN;
  const state = { ...newGameState(c), powerState: 'big' };
  if (c === MEGAMAN) state.kit = { helmet: opts.helmet === false ? 0 : 1 };
  const world = new World(
    level,
    {
      assets: new AssetRegistry({ default: {} }),
      audio: { ...NULL_AUDIO, sfx: (id: string) => void sfx.push(id) },
      assist: { ...DEFAULT_ASSIST, invulnerable: opts.invulnerable ?? true },
      reduceFlashing: true,
    },
    state,
    { mode: 'stand', seed: 7 },
  );
  const input = new ScriptedInput({ steps: [] });
  const step = (n = 1, hold: Action[] = []) => {
    for (let i = 0; i < n; i++) {
      input.setHeld(hold);
      input.next();
      world.update([input]);
    }
  };
  /** One buster shot (a press and a release). */
  const shoot = () => {
    step(1, ['attack']);
    step(1);
  };
  /** A full charge shot (hold, then let go). */
  const charge = () => {
    step(45, ['attack']);
    step(1);
  };
  return { world, step, shoot, charge, sfx, state };
}

const of = <T extends Entity>(w: World, k: abstract new (...a: never[]) => T): T[] =>
  w.entities.filter((e): e is T => e instanceof k && e.alive);

describe("shoot it, don't stomp it (Mega Man's airship)", () => {
  it('a cannonball is shot down by the buster, for points', () => {
    const { world, step, shoot } = deck([]);
    step(2);
    const p = world.player;
    const ball = new Cannonball(p.body.x + px(80), p.body.y + px(11), -0x00400, 0);
    world.spawn(ball);
    const before = world.state.score;
    p.facing = 1;
    shoot();
    for (let f = 0; f < 60 && ball.alive; f++) step();
    expect(ball.alive).toBe(false);
    expect(world.state.score - before).toBeGreaterThanOrEqual(100);
  });

  it('so is a Bullet Bill', () => {
    const { world, step, shoot } = deck([]);
    step(2);
    const p = world.player;
    const bill = new BulletBill(p.body.x + px(90), p.body.y + px(6), -1);
    world.spawn(bill);
    const before = world.state.score;
    p.facing = 1;
    shoot();
    for (let f = 0; f < 60 && bill.alive; f++) step();
    expect(bill.alive).toBe(false);
    expect(world.state.score - before).toBeGreaterThanOrEqual(200);
  });

  it('a cannon takes four buster hits and is wrecked, for points; its cell opens again', () => {
    const { world, step, shoot, sfx } = deck(['cannon 9 12 dir=l period=400 delay=390']);
    step(2);
    const cannon = of(world, Cannon)[0] as Cannon;
    expect(world.map.isSolid(9, 12)).toBe(true);
    world.player.facing = 1;
    for (let i = 1; i < CANNON_HP; i++) {
      shoot();
      step(30);
      expect(cannon.hp).toBe(CANNON_HP - i);
      expect(cannon.alive).toBe(true);
    }
    const before = world.state.score;
    shoot();
    step(30);
    expect(cannon.alive).toBe(false);
    expect(world.map.isSolid(9, 12)).toBe(false);
    expect(world.state.score - before).toBe(CANNON_POINTS);
    expect(sfx).toContain('bomb-blast');
  });

  it('a charge shot counts three (with the shot its press fires, it wrecks a cannon)', () => {
    const { world, step, charge } = deck(['cannon 9 12 dir=l period=400 delay=390']);
    step(2);
    const cannon = of(world, Cannon)[0] as Cannon;
    world.player.facing = 1;
    step(1, ['attack']);
    step(30, ['attack']);
    expect(cannon.hp).toBe(CANNON_HP - 1);
    charge();
    step(30);
    expect(cannon.alive).toBe(false);
  });

  it('a charge shot clears a wave: on through a line of cannonballs', () => {
    const { world, step, charge } = deck([]);
    step(2);
    const p = world.player;
    const balls = [60, 84, 108].map((dx) => new Cannonball(p.body.x + px(dx), p.body.y + px(11), 0, 0));
    for (const b of balls) world.spawn(b);
    p.facing = 1;
    charge();
    for (let f = 0; f < 90; f++) step();
    expect(balls.every((b) => !b.alive)).toBe(true);
  });

  it('elsewhere (not his airship) a cannon shrugs shots off as before', () => {
    const { world, step, shoot } = deck(['cannon 9 12 dir=l period=400 delay=390'], { mm: false });
    step(2);
    const cannon = of(world, Cannon)[0] as Cannon;
    world.player.facing = 1;
    for (let i = 0; i < 6; i++) {
      shoot();
      step(30);
    }
    expect(cannon.alive).toBe(true);
    expect(cannon.hp).toBe(CANNON_HP);
  });
});

describe('the Wily-sky remix enemies', () => {
  it('a Telly hatch lets out Tellys that drift toward him, at most two at a time', () => {
    const { world, step } = deck(['telly-port 14 12']);
    step(2);
    const port = of(world, TellyPort)[0] as TellyPort;
    expect(port).toBeDefined();
    for (let f = 0; f < TELLY_PERIOD && !of(world, Telly).length; f++) step();
    // Drifting toward the hero (to his left), slowly.
    const t = of(world, Telly)[0] as Telly;
    expect(t).toBeDefined();
    const x0 = t.body.x;
    step(60);
    expect(t.body.x).toBeLessThan(x0);
    expect(Math.abs(t.body.x - x0)).toBeLessThanOrEqual(px(30));
    // Never more than two of the hatch's own out.
    for (let f = 0; f < TELLY_PERIOD * 6; f++) {
      step();
      expect(port.out.filter((o) => o.alive).length).toBeLessThanOrEqual(TELLY_MAX_OUT);
    }
  });

  it('a Telly falls to one buster shot, and drops are always on a deck on screen', () => {
    const { world, step, shoot } = deck([]);
    step(2);
    const p = world.player;
    const t = new Telly(p.body.x + px(48), p.body.y + px(11));
    world.spawn(t);
    p.facing = 1;
    shoot();
    for (let f = 0; f < 40 && t.alive; f++) step();
    expect(t.alive).toBe(false);
  });

  it('a drop over open air moves to the nearest deck on screen (Mega Man’s airship only)', () => {
    // A deck with a 6-wide gap at 10-15: a drop made over it lands beside it.
    const rows = [
      ...Array.from({ length: 13 }, () => '.'.repeat(W)),
      '#'.repeat(10) + '.'.repeat(6) + '#'.repeat(W - 16),
      '#'.repeat(10) + '.'.repeat(6) + '#'.repeat(W - 16),
    ];
    const { world, step } = deck([], {}, rows);
    step(2);
    const drop = new Pickup(px(12 * 16 + 8), px(6 * 16), 'health-large');
    world.placeDrop(drop);
    const col = toPx(drop.body.x + (drop.body.w >> 1)) >> 4;
    expect(col < 10 || col > 15).toBe(true);
    // One inside a wall comes out on top of it.
    const inside = new Pickup(px(4 * 16 + 8), px(14 * 16 + 8), 'health-small');
    world.placeDrop(inside);
    expect(toPx(inside.body.y + inside.body.h)).toBeLessThanOrEqual(13 * 16);
  });

  it('a gull sweeps in and drops one bomb over him; the bomb is shot down for points or bursts on the deck', () => {
    const { world, step, shoot } = deck(['gull 14 6']);
    step(2);
    const g = of(world, Gull)[0] as Gull;
    expect(g).toBeDefined();
    let bomb: SkyBomb | undefined;
    for (let f = 0; f < 400 && !bomb; f++) {
      step();
      bomb = of(world, SkyBomb)[0];
    }
    expect(bomb).toBeDefined();
    expect(Math.abs(toPx(bomb!.body.x) - toPx(world.player.centerX))).toBeLessThan(32);
    // It bursts on the deck (hurting whoever stands in it).
    for (let f = 0; f < 200 && bomb!.alive; f++) step();
    expect(bomb!.alive).toBe(false);
    // Shot down instead: a bomb in his line of fire.
    const p = world.player;
    const b2 = new SkyBomb(p.body.x + px(70), p.body.y + px(8));
    b2.body.vy = -0x01000;
    world.spawn(b2);
    const before = world.state.score;
    p.facing = 1;
    shoot();
    for (let f = 0; f < 40 && b2.alive; f++) step();
    expect(b2.alive).toBe(false);
    expect(world.state.score - before).toBeGreaterThanOrEqual(100);
  });

  it('a bomb bursting on the deck hurts him', () => {
    const { world, step } = deck([], { invulnerable: false });
    step(2);
    const p = world.player;
    const hp = p.hp;
    world.spawn(new SkyBomb(p.centerX, p.body.y - px(30)));
    step(60);
    expect(p.hp).toBeLessThan(hp);
  });

  it('a shielded Joe turns shots from the front away, takes them when his shield is down or from behind', () => {
    const { world, step, shoot, sfx } = deck(['shield-joe 10 12']);
    step(2);
    const joe = of(world, ShieldJoe)[0] as ShieldJoe;
    const p = world.player;
    p.facing = 1;
    expect(joe.state).toBe('guard');
    expect(joe.facing).toBe(-1);
    shoot();
    step(30);
    expect(joe.blocked).toBe(1);
    expect(joe.hp).toBe(JOE_HP);
    expect(sfx).toContain('dink');
    // Shield down: it lands.
    for (let f = 0; f < JOE_GUARD + 5 && joe.state !== 'open'; f++) step();
    expect(joe.state).toBe('open');
    shoot();
    step(40);
    expect(joe.hp).toBe(JOE_HP - 1);
    // From behind, even with the shield up.
    for (let f = 0; f < 200 && joe.state !== 'guard'; f++) step();
    p.body.x = joe.body.x + px(48);
    step(2);
    expect(joe.facing).toBe(1);
    p.body.x = joe.body.x - px(40);
    p.facing = 1;
    // He turns to face the hero again at once, so shoot from behind before he turns: hit directly.
    expect(joe.hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, world)).toBe('hp');
  });

  it('a Joe with the shield down fires pellets that hurt', () => {
    const { world, step } = deck(['shield-joe 8 12'], { invulnerable: false });
    step(2);
    const p = world.player;
    const hp = p.hp;
    step(JOE_GUARD + 60);
    expect(world.entities.some((e) => e instanceof Projectile && e.kind === 'joe-pellet') || p.hp < hp).toBe(
      true,
    );
    step(60);
    expect(p.hp).toBeLessThan(hp);
  });

  it('a charge shot beats a Joe whose shield is down in two', () => {
    const { world, step, charge, shoot } = deck(['shield-joe 10 12']);
    step(2);
    const joe = of(world, ShieldJoe)[0] as ShieldJoe;
    world.player.facing = 1;
    // Charge while he guards (the press's own shot dinks off the shield), let go once it is down.
    step(JOE_GUARD - 45);
    charge();
    shoot();
    step(40);
    expect(joe.blocked).toBe(1);
    expect(joe.alive).toBe(false);
  });
});

describe('appearing (yoku) blocks', () => {
  it('show solid for their time in every cycle, in turn, and never on top of anyone', () => {
    const { world, step } = deck(['yoku 10 10 at=0', 'yoku 12 9 at=45']);
    step(2);
    const [a, b] = of(world, Yoku) as Yoku[];
    let both = 0;
    let shownA = 0;
    for (let f = 0; f < YOKU_PERIOD; f++) {
      step();
      if (a!.shown) shownA++;
      expect(world.map.isSolid(10, 10)).toBe(a!.shown);
      if (a!.shown && b!.shown) both++;
    }
    expect(Math.abs(shownA - YOKU_ON)).toBeLessThanOrEqual(1);
    // Each shows a while together with the next (time to hop across).
    expect(both).toBeGreaterThan(40);
    // A block never closes on a player standing in its cell.
    const p = world.player;
    for (let f = 0; f < YOKU_PERIOD && a!.shown; f++) step();
    p.body.x = px(10 * 16 + 2);
    p.body.y = px(10 * 16 + 2);
    for (let f = 0; f < YOKU_PERIOD; f++) {
      p.body.x = px(10 * 16 + 2);
      p.body.y = px(10 * 16 + 2);
      p.body.vy = 0;
      step();
      expect(world.map.get(10, 10)).not.toBe(T.BUMPING);
    }
  });
});

describe("Larry's room on Mega Man's airship", () => {
  function room(mm: boolean) {
    const base = getLevel('4-2-larry');
    const level = mm ? heroVariant(base, ['megaman'], true) : base;
    const r = run(level);
    r.step(2);
    const larry = of(r.world, Larry)[0] as Larry;
    return { ...r, larry };
  }

  it('Larry has a hit-point bar: buster 2, a charge shot 7, a stomp a third, a short flash', () => {
    const { world, larry } = room(true);
    expect(larry.hpMode).toBe(true);
    expect(larry.hp).toBe(LARRY_MM_HP);
    const buster = { kind: 'buster' as const, amount: 1, owner: null, dirX: 1 as const };
    expect(larry.hit(buster, world)).toBe('hp');
    expect(larry.hp).toBe(LARRY_MM_HP - LARRY_MM_SHOT);
    expect(larry.invuln).toBe(LARRY_MM_FLASH);
    larry.invuln = 0;
    larry.hit({ ...buster, amount: 3 }, world);
    expect(larry.hp).toBe(LARRY_MM_HP - LARRY_MM_SHOT - LARRY_MM_HEAVY);
    // Three stomps still win, from full.
    const fresh = room(true);
    for (let i = 0; i < 3; i++) {
      fresh.larry.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, fresh.world);
      expect(LARRY_MM_STOMP * 3).toBeGreaterThanOrEqual(LARRY_MM_HP);
      for (let f = 0; f < 200 && fresh.larry.inShell; f++) fresh.step();
    }
    expect(fresh.larry.defeated).toBe(true);
  });

  it('beaten with the buster alone: fourteen hits', () => {
    const { world, step, larry } = room(true);
    let hits = 0;
    for (let i = 0; i < 40 && !larry.defeated; i++) {
      larry.invuln = 0;
      larry.hit({ kind: 'buster', amount: 1, owner: null, dirX: 1 }, world);
      hits++;
    }
    expect(hits).toBe(LARRY_MM_HP / LARRY_MM_SHOT);
    step(60);
    expect(larry.defeated).toBe(true);
  });

  it('his wand blasts can be shot down, for points', () => {
    const { world, step, shoot } = room(true);
    const p = world.player;
    const blast = new WandBlast(
      p.centerX + px(70),
      p.body.y + px(11),
      p.centerX,
      p.body.y + px(11),
      of(world, Larry)[0] as Larry,
    );
    world.spawn(blast);
    const before = world.state.score;
    p.facing = 1;
    shoot();
    for (let f = 0; f < 40 && blast.alive; f++) step();
    expect(blast.alive).toBe(false);
    expect(world.state.score - before).toBe(WAND_BLAST_POINTS);
  });

  it('for every other hero the room is as it was: no bar, blasts not shot down', () => {
    const { world, larry } = room(false);
    expect(larry.hpMode).toBe(false);
    expect(larry.hp).toBe(LARRY_HP);
    expect(world.megamanShip).toBe(false);
  });
});
