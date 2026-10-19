import { describe, expect, it } from 'vitest';
import { px, toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { parseTextMap } from '@game/level/textmap';
import { T } from '@game/level/tiles';
import { runSim, ScriptedInput } from '@game/sim/headless';
import { CHARACTERS, CLASSIC_CHARACTERS, heroFor } from '@game/characters/registry';
import { MEGAMAN, MEGAMAN_PROFILE } from '@game/characters/megaman';
import {
  MEGAMAN_CLASSIC,
  MEGAMAN_CLASSIC_PROFILE,
  classicMegaMan,
  energyKey,
} from '@game/characters/megaman/classic';
import {
  CLASSIC_FLOWER_WEAPON,
  MM_WEAPONS,
  WEAPON_UNITS,
  WaterDrop,
} from '@game/characters/megaman/classic-weapons';
import { ClassicRush } from '@game/characters/megaman/classic-rush';
import { CLASSIC_SWIM } from '@game/rules/classic-swim';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { Projectile } from '@game/entities/projectiles/projectile';
import { PowerUp } from '@game/entities/objects/powerup';
import type { World } from '@game/world/world';
import type { GameState } from '@game/context';
import { fontText } from '@game/hud/text';
import { SPRITES } from '@content/sprites';
import { testLevel, tile } from './classic-harness';

// Classic SMBC Mega Man (bug-reports/2026-10-07-megaman-classic-smbc-rules.md, MM-C1..MM-C36): the
// report's acceptance checks that the engine can measure, played through runSim with
// rules: 'classic' (TG-37), and TG-38's "Current is unchanged".

type Hold = Action[];

/** A Classic Mega Man world on `level` (no frames run), invulnerable unless `hurt`. */
function mmWorld(
  level = testLevel(),
  state: Partial<GameState> = {},
  opts: { hurt?: boolean; rules?: 'classic' | 'current' } = {},
): World {
  return runSim({
    level,
    character: MEGAMAN,
    rules: opts.rules ?? 'classic',
    script: { steps: [] },
    maxFrames: 0,
    state,
    assist: { invulnerable: !opts.hurt },
  }).world;
}

/** Steps `world` `n` frames holding `hold(i)` on frame i (and runs `each` after each frame). */
function drive(world: World, n: number, hold: (i: number) => Hold = () => [], each?: (i: number) => void) {
  const input = new ScriptedInput({ steps: [] });
  for (let i = 0; i < n; i++) {
    input.setHeld(hold(i));
    input.next();
    world.update([input]);
    each?.(i);
  }
}

/** Settles him on the ground (the level starts him there). */
function settle(world: World): void {
  drive(world, 4);
}

const shots = (w: World, kind: string) =>
  w.entities.filter((e): e is Projectile => e instanceof Projectile && e.alive && e.kind === kind);
const feet = (w: World) => w.player.body.y + w.player.body.h;

/** A flat level with `rows` laid over the air and the player at (col, row). */
function level(
  rows: Record<number, string>,
  start = '2,12',
  ground: string[] = [],
): ReturnType<typeof parseTextMap> {
  const lines: string[] = [];
  for (let y = 0; y < 13; y++) lines.push((rows[y] ?? '').padEnd(48, '.').slice(0, 48));
  lines.push(...(ground.length ? ground : ['#'.repeat(48), '#'.repeat(48)]));
  return parseTextMap(['id: t', 'time: 300', `start: ${start}`, '', '[tiles]', ...lines].join('\n'));
}

describe('Classic Mega Man resolves under Classic only (TG-17, TG-18, TG-38)', () => {
  it('is registered and keeps the roster identity', () => {
    expect(CLASSIC_CHARACTERS.megaman).toBe(MEGAMAN_CLASSIC);
    expect(heroFor(MEGAMAN, 'classic')).toBe(MEGAMAN_CLASSIC);
    expect(heroFor(MEGAMAN, 'current')).toBe(MEGAMAN);
    expect(CHARACTERS.every((c) => c.rules === undefined)).toBe(true);
    for (const k of ['id', 'name', 'hudName', 'portrait'] as const)
      expect(MEGAMAN_CLASSIC[k]).toEqual(MEGAMAN[k]);
    expect(MEGAMAN_CLASSIC.rules).toBe('classic');
    expect(MEGAMAN_CLASSIC.damage).toEqual({ kind: 'powerup', states: ['small', 'big', 'fire'] });
    // TG-22: no HP extras.
    expect(MEGAMAN_CLASSIC.reserve).toBeUndefined();
    expect(MEGAMAN_CLASSIC.hudExtra).toBeUndefined();
    expect(MEGAMAN_CLASSIC.startHp).toBeUndefined();
  });

  it('a Classic world plays it; a Current world plays Current Mega Man, unchanged', () => {
    const w = mmWorld();
    expect(w.player.def).toBe(MEGAMAN_CLASSIC);
    expect(w.state.character).toBe(MEGAMAN);
    const c = mmWorld(testLevel(), {}, { rules: 'current' });
    expect(c.player.def).toBe(MEGAMAN);
    // The Current profile sets none of the Classic optional fields (TG-23).
    const p = MEGAMAN_PROFILE;
    expect(p.softCut).toBeUndefined();
    expect(p.airStop).toBeUndefined();
    expect(p.step).toBeUndefined();
    expect(p.slide?.distance).toBeUndefined();
    expect(p.slide?.jumpOut).toBeUndefined();
    expect(p.slide?.crossGaps).toBeUndefined();
    expect(MEGAMAN.damage.kind).toBe('hp');
  });

  it('Current Mega Man still cuts his jump at once on release (no soft cut)', () => {
    const w = mmWorld(testLevel(), {}, { rules: 'current' });
    settle(w);
    let vy = 0;
    drive(
      w,
      3,
      (i) => (i === 0 ? ['jump'] : []),
      (i) => {
        if (i === 1) vy = w.player.body.vy;
      },
    );
    // Released on the first airborne frame: vy 0 then gravity.
    expect(vy).toBe(MEGAMAN_PROFILE.jump[0]?.fallGravity);
  });
});

describe('movement (MM-C2, MM-C4, MM-C10, MM-C11)', () => {
  it('a full jump peaks 67-73 px; a hop released on the first airborne frame 12-18 px', () => {
    const apex = (frames: number) => {
      const w = mmWorld();
      settle(w);
      const y0 = feet(w);
      let top = y0;
      drive(
        w,
        90,
        (i) => (i < frames ? ['jump'] : []),
        () => (top = Math.min(top, feet(w))),
      );
      return toPx(y0 - top);
    };
    const full = apex(90);
    expect(full).toBeGreaterThanOrEqual(67);
    expect(full).toBeLessThanOrEqual(73);
    const hop = apex(1);
    expect(hop).toBeGreaterThanOrEqual(12);
    expect(hop).toBeLessThanOrEqual(18);
  });

  it('falling, vy never passes 0x05D55 (and reaches it)', () => {
    const w = mmWorld(level({}, '2,0'));
    let max = 0;
    drive(
      w,
      60,
      () => [],
      () => (max = Math.max(max, w.player.body.vy)),
    );
    expect(max).toBe(0x05d55);
  });

  it('a one-frame tap of right from standing steps 2 px, then vx 0 for 6 frames', () => {
    const w = mmWorld();
    settle(w);
    const x0 = w.player.body.x;
    const vxs: number[] = [];
    drive(
      w,
      8,
      (i) => (i === 0 ? ['right'] : []),
      () => vxs.push(w.player.body.vx),
    );
    expect(w.player.body.x - x0).toBe(px(2));
    expect(vxs.slice(1, 7)).toEqual([0, 0, 0, 0, 0, 0]);
  });

  it('holding right after the step walks at 1.375 px/f; in the air, nothing held stops him', () => {
    const w = mmWorld();
    settle(w);
    drive(w, 12, () => ['right']);
    expect(w.player.body.vx).toBe(0x01600);
    drive(w, 3, (i) => (i === 0 ? ['right', 'jump'] : ['jump']));
    expect(w.player.body.onGround).toBe(false);
    drive(w, 1, () => ['jump']);
    expect(w.player.body.vx).toBe(0);
  });
});

describe('the slide (MM-C5..MM-C9)', () => {
  /** Slides from standing; the distance covered when it ends (px) and the frames it lasted. */
  function slide(lv = testLevel(), hold: (i: number) => Hold = (i) => (i === 0 ? ['down', 'jump'] : [])) {
    const w = mmWorld(lv);
    settle(w);
    const x0 = w.player.body.x;
    let frames = 0;
    drive(w, 200, hold, () => {
      if (w.player.sliding > 0) frames++;
    });
    return { w, dist: toPx(w.player.body.x - x0), frames };
  }

  it('covers 62.5 ± 2.5 px on flat ground with a 12x15 body', () => {
    const w = mmWorld();
    settle(w);
    drive(w, 2, (i) => (i === 0 ? ['down', 'jump'] : []));
    expect(w.player.sliding).toBeGreaterThan(0);
    expect(toPx(w.player.body.h)).toBe(15);
    const r = slide();
    expect(Math.abs(r.dist - 62.5)).toBeLessThanOrEqual(2.5);
    expect(r.frames).toBeGreaterThanOrEqual(24);
    expect(r.frames).toBeLessThanOrEqual(27);
    expect(toPx(r.w.player.body.h)).toBe(22);
  });

  it('under a one-tile-high ceiling it goes on to the end of the ceiling', () => {
    const r = slide(level({ 11: '....#########' }));
    expect(r.w.player.sliding).toBe(0);
    expect(r.w.player.body.x).toBeGreaterThanOrEqual(tile(13));
    expect(r.dist).toBeGreaterThan(150);
  });

  it('jump on slide frame 10 with Down up jumps out; with Down held it does nothing', () => {
    const out = mmWorld();
    settle(out);
    drive(out, 10, (i) => (i === 0 ? ['down', 'jump'] : []));
    expect(out.player.sliding).toBeGreaterThan(0);
    const y0 = out.player.body.y;
    drive(out, 1, () => ['jump']);
    expect(out.player.sliding).toBe(0);
    expect(out.player.body.onGround).toBe(false);
    // Standing up adds 7 px of height; the take-off frame rises 0x05355 (the original's 0x056AB
    // less one frame of gravity), then gravity makes vy -0x05000.
    expect(Math.abs(y0 - px(7) - out.player.body.y - (0x05355 >> 4))).toBeLessThanOrEqual(1);
    expect(out.player.body.vy).toBe(-0x05000);

    const held = mmWorld();
    settle(held);
    drive(held, 10, (i) => (i === 0 ? ['down', 'jump'] : ['down']));
    drive(held, 1, () => ['down', 'jump']);
    expect(held.player.sliding).toBeGreaterThan(0);
    expect(held.player.body.onGround).toBe(true);
  });

  it('crosses a one-tile gap; walking drops in', () => {
    const gap = ['#####.' + '#'.repeat(42), '#####.' + '#'.repeat(42)];
    const lv = level({}, '2,12', gap);
    const s = slide(lv);
    expect(toPx(feet(s.w))).toBe(208);
    expect(s.w.player.body.x).toBeGreaterThan(tile(6));
    const w = mmWorld(lv);
    settle(w);
    drive(w, 60, () => ['right']);
    expect(toPx(feet(w))).toBeGreaterThan(208);
  });

  it('the other direction ends it where he is', () => {
    const r = slide(testLevel(), (i) => (i === 0 ? ['down', 'jump'] : i === 5 ? ['left'] : []));
    expect(r.dist).toBeLessThan(20);
    expect(r.frames).toBeLessThanOrEqual(6);
  });
});

describe('the Mega Buster (MM-C19)', () => {
  /** Shoots right once per shot until `done`, each shot gone before the next; the shot count. */
  function shootUntil(w: World, done: () => boolean, max = 20): number {
    let n = 0;
    while (!done() && n < max) {
      drive(w, 1, () => ['attack']);
      n++;
      for (let i = 0; i < 120 && shots(w, 'mm-buster').length > 0; i++) drive(w, 1);
    }
    return n;
  }

  it('a Goomba dies on the 3rd shot, a Koopa on the 6th', () => {
    const w = mmWorld();
    settle(w);
    const g = new Goomba(tile(8), tile(12) + px(2));
    w.spawn(g);
    expect(shootUntil(w, () => !g.alive)).toBe(3);
    const k = new Koopa(tile(9), tile(12) - px(8), 'green');
    w.spawn(k);
    expect(shootUntil(w, () => !k.alive)).toBe(6);
  });

  it('a brick breaks on the 2nd shot', () => {
    const w = mmWorld(level({ 12: '........=' }));
    settle(w);
    drive(w, 1, () => ['attack']);
    drive(w, 40);
    expect(w.map.get(8, 12)).toBe(T.BRICK);
    expect(w.brickHp.get('8,12')).toBe(25);
    drive(w, 1, () => ['attack']);
    drive(w, 40);
    expect(w.map.get(8, 12)).toBe(T.AIR);
  });

  it('a shot at a pipe comes out the other side', () => {
    const w = mmWorld(level({ 11: '......[]', 12: '......{}' }));
    settle(w);
    drive(w, 1, () => ['attack']);
    drive(w, 30);
    const s = shots(w, 'mm-buster');
    expect(s.length).toBe(1);
    expect(s[0]?.body.x).toBeGreaterThan(tile(8));
  });

  it('a side shot at a ? block releases its item', () => {
    const w = mmWorld(level({ 12: '........M' }));
    settle(w);
    drive(w, 1, () => ['attack']);
    drive(w, 40);
    expect(w.entities.some((e) => e instanceof PowerUp)).toBe(true);
    expect(shots(w, 'mm-buster').length).toBe(0);
  });

  it('a 4th shot does not fire with 3 out', () => {
    const w = mmWorld();
    settle(w);
    drive(w, 8, (i) => (i % 2 === 0 ? ['attack'] : []));
    expect(shots(w, 'mm-buster').length).toBe(3);
  });

  it('MM-C26: armour bounces it back, harmless', () => {
    const w = mmWorld();
    settle(w);
    const b = new Koopa(tile(6), tile(12) - px(8), 'buzzy');
    w.spawn(b);
    drive(w, 1, () => ['attack']);
    let deflected: Projectile | undefined;
    drive(
      w,
      30,
      () => [],
      () => (deflected ??= shots(w, 'mm-buster').find((s) => s.deflected)),
    );
    expect(deflected).toBeDefined();
    expect(deflected?.body.vx).toBeLessThan(0);
    expect(b.alive).toBe(true);
  });
});

describe('the Charge Shot (MM-C20)', () => {
  /** Holds attack `n` frames from standing (state `power`), then lets go; the world. */
  function charge(n: number, power = 'big', place?: (w: World) => void) {
    const w = mmWorld(testLevel(), { powerState: power });
    settle(w);
    drive(w, n, () => ['attack']);
    place?.(w);
    drive(w, 1);
    return w;
  }

  it('47 frames: no charge shot; 48: a weak one (a Goomba survives at 50 HP)', () => {
    expect(shots(charge(47), 'mm-charge').length).toBe(0);
    let g: Goomba | null = null;
    const w = charge(48, 'big', (wd) => {
      g = new Goomba(tile(5), tile(12) + px(2));
      wd.spawn(g);
    });
    expect(shots(w, 'mm-charge').length).toBe(1);
    drive(w, 20);
    const goomba = g as unknown as Goomba;
    expect(goomba.alive).toBe(true);
    expect(goomba.classicHp).toBe(50);
  });

  it('87 frames: a full shot that kills a Goomba and goes on to a second', () => {
    const gs: Goomba[] = [];
    const w = charge(87, 'big', (wd) => {
      for (const c of [5, 7]) {
        const g = new Goomba(tile(c), tile(12) + px(2));
        gs.push(g);
        wd.spawn(g);
      }
    });
    expect(shots(w, 'mm-charge-full').length).toBe(1);
    drive(w, 30);
    expect(gs.every((g) => !g.alive)).toBe(true);
  });

  it('without the Mushroom, holding 100 frames fires nothing extra', () => {
    const w = charge(100, 'small');
    expect(shots(w, 'mm-charge').length + shots(w, 'mm-charge-full').length).toBe(0);
  });

  it('letting go during a slide fires nothing', () => {
    const w = mmWorld(testLevel(), { powerState: 'big' });
    settle(w);
    drive(w, 90, () => ['attack']);
    drive(w, 2, (i) => (i === 0 ? ['attack', 'down', 'jump'] : ['attack']));
    expect(w.player.sliding).toBeGreaterThan(0);
    drive(w, 1);
    expect(shots(w, 'mm-charge-full').length).toBe(0);
  });
});

describe('Metal Blade on the Flower (MM-C15, MM-C17, MM-C18, MM-C21..MM-C24)', () => {
  it('the Flower weapon is Metal Blade; Up + Right fires a diagonal', () => {
    expect(CLASSIC_FLOWER_WEAPON).toBe('metal-blade');
    const w = mmWorld(testLevel(), { powerState: 'fire' });
    settle(w);
    drive(w, 1, () => ['up', 'right', 'special']);
    const b = shots(w, 'metal-blade');
    expect(b.length).toBe(1);
    expect(b[0]?.body.vx).toBe(0x02d00);
    expect(b[0]?.body.vy).toBe(-0x02d00);
    expect(w.player.scratch[energyKey('metal-blade')]).toBe(WEAPON_UNITS - 2);
  });

  it('with 2 buster shots out only 1 blade fires; a blade roots him 12 frames', () => {
    const w = mmWorld(testLevel(), { powerState: 'fire' });
    settle(w);
    drive(w, 3, (i) => (i === 0 || i === 2 ? ['attack'] : []));
    expect(shots(w, 'mm-buster').length).toBe(2);
    drive(w, 3, (i) => (i === 0 || i === 2 ? ['special'] : []));
    expect(shots(w, 'metal-blade').length).toBe(1);
    expect(w.player.root).toBeGreaterThan(0);
  });

  it('56 blades empty a full bar', () => {
    const w = mmWorld(testLevel(), { powerState: 'fire' });
    settle(w);
    let fired = 0;
    for (let n = 0; n < 70; n++) {
      const before = shots(w, 'metal-blade').length;
      drive(w, 1, () => ['up', 'special']);
      if (shots(w, 'metal-blade').length > before) fired++;
      drive(w, 70);
    }
    expect(fired).toBe(56);
    expect(w.player.scratch[energyKey('metal-blade')]).toBe(0);
  });

  it('a small pellet adds 8 units with a 6-frame freeze', () => {
    const w = mmWorld(testLevel(), { powerState: 'fire' });
    settle(w);
    const p = w.player;
    p.scratch[energyKey('metal-blade')] = 100;
    p.def.behaviour.onPickup?.(p, 'weapon-small', w);
    expect(p.scratch[energyKey('metal-blade')]).toBe(108);
    let frozen = 0;
    const f0 = w.frame;
    for (let i = 0; i < 10; i++) {
      const fr = p.frame;
      drive(w, 1);
      if (p.frame === fr) frozen++;
    }
    expect(w.frame - f0).toBe(10);
    expect(frozen).toBe(6);
    // Small with no Flower weapon: collected, no effect.
    const s = mmWorld();
    settle(s);
    expect(s.player.def.behaviour.onPickup?.(s.player, 'weapon-small', s)).toBe(true);
    expect(s.player.transition).toBeNull();
  });
});

describe('power states (MM-C14..MM-C16)', () => {
  it('small + 1 hit = death', () => {
    const w = mmWorld(testLevel(), {}, { hurt: true });
    settle(w);
    w.hurtPlayer(w.player, 1);
    expect(w.player.dead).toBe(true);
  });

  it('Flower + 1 hit = small (no blade, no charge, pushed back 0.6667 px/f, no pop); a 2nd hit kills', () => {
    const w = mmWorld(testLevel(), { powerState: 'fire' }, { hurt: true });
    settle(w);
    drive(w, 1, () => ['special']);
    drive(w, 40, () => ['attack']);
    expect(shots(w, 'metal-blade').length).toBe(1);
    const p = w.player;
    w.hurtPlayer(p, 1);
    expect(p.powerState).toBe('small');
    expect(p.dead).toBe(false);
    expect(p.body.vx).toBe(-0x00aab); // backwards from his facing (right)
    expect(p.body.vy).toBe(0);
    expect(shots(w, 'metal-blade').length).toBe(0);
    expect(p.scratch._chargeT ?? 0).toBe(0);
    drive(w, 120);
    drive(w, 1, () => ['special']);
    expect(shots(w, 'metal-blade').length).toBe(0);
    w.hurtPlayer(p, 1);
    expect(p.dead).toBe(true);
  });

  it('a ? block gives the Mushroom when small and the Flower after', () => {
    const w = mmWorld();
    expect(MEGAMAN_CLASSIC.blockPowerUp(w.player)).toBe('mushroom');
    w.player.powerState = 'big';
    expect(MEGAMAN_CLASSIC.blockPowerUp(w.player)).toBe('flower');
    w.player.powerState = 'fire';
    expect(MEGAMAN_CLASSIC.blockPowerUp(w.player)).toBe('flower');
    expect(MEGAMAN_CLASSIC.canBreakBricks(w.player)).toBe(false);
  });
});

describe('Rush Coil (MM-C28..MM-C31) and the button swap (MM-C3)', () => {
  const rushOf = (w: World) => w.entities.find((e): e is ClassicRush => e instanceof ClassicRush && e.alive);

  it('a Select tap drops Rush from the screen top onto 20 px ahead', () => {
    const w = mmWorld();
    settle(w);
    drive(w, 6, (i) => (i < 5 ? ['select'] : []));
    const r = rushOf(w);
    expect(r).toBeDefined();
    expect(toPx((r as ClassicRush).body.y)).toBeLessThan(40);
    drive(w, 60);
    const b = (r as ClassicRush).body;
    const pb = w.player.body;
    expect(r?.waiting).toBe(true);
    expect(b.x + (b.w >> 1) - (pb.x + (pb.w >> 1))).toBe(px(20));
    expect(b.y + b.h).toBe(pb.y + pb.h);
  });

  it('holding Select 21 frames with the Flower swaps the buttons, no Rush', () => {
    const w = mmWorld(testLevel(), { powerState: 'fire' });
    settle(w);
    drive(w, 22, () => ['select']);
    drive(w, 1);
    expect(rushOf(w)).toBeUndefined();
    expect(w.player.scratch.mmSwap).toBe(1);
    expect(MEGAMAN_CLASSIC.touchLabels?.(w.player, w).attack).toBe('BLADE');
    drive(w, 1, () => ['attack']);
    expect(shots(w, 'metal-blade').length).toBe(1);
    expect(shots(w, 'mm-buster').length).toBe(0);
    drive(w, 1, () => ['special']);
    expect(shots(w, 'mm-buster').length).toBe(1);
  });

  it('the bounce peaks 103-111 px; unused he leaves 240 frames after landing', () => {
    const w = mmWorld();
    settle(w);
    drive(w, 2, (i) => (i === 0 ? ['select'] : []));
    const r = rushOf(w) as ClassicRush;
    let landEnd = -1;
    let exitAt = -1;
    let f = 0;
    drive(
      w,
      400,
      () => [],
      () => {
        f++;
        if (r.phase === 'wait' && landEnd < 0) landEnd = f;
        if (r.phase === 'exit' && exitAt < 0) exitAt = f;
      },
    );
    expect(exitAt - landEnd).toBe(240);

    const w2 = mmWorld();
    settle(w2);
    drive(w2, 2, (i) => (i === 0 ? ['select'] : []));
    drive(w2, 50);
    const r2 = rushOf(w2) as ClassicRush;
    expect(r2.waiting).toBe(true);
    const p = w2.player;
    const top = r2.body.y;
    p.body.x = r2.body.x + (r2.body.w >> 1) - (p.body.w >> 1);
    p.body.y = top - p.body.h - px(30);
    p.body.onGround = false;
    let apex = Infinity;
    drive(
      w2,
      80,
      () => [],
      () => (apex = Math.min(apex, feet(w2))),
    );
    const h = toPx(top - apex);
    expect(h).toBeGreaterThanOrEqual(103);
    expect(h).toBeLessThanOrEqual(111);
    expect(r2.phase === 'spring' || r2.phase === 'exit' || r2.phase === 'fly' || !r2.alive).toBe(true);
  });

  it('a tap while Rush waits sends him away', () => {
    const w = mmWorld();
    settle(w);
    drive(w, 2, (i) => (i === 0 ? ['select'] : []));
    drive(w, 60);
    const r = rushOf(w) as ClassicRush;
    expect(r.waiting).toBe(true);
    drive(w, 2, (i) => (i === 0 ? ['select'] : []));
    expect(r.phase).toBe('exit');
  });
});

describe('the dev full kit (MM-C21, TG-8, TG-44)', () => {
  it('grants all 9 weapons full and Rush; a Select tap cycles; Special fires the selected one', () => {
    const kit = MEGAMAN_CLASSIC.devKit?.() ?? {};
    for (const wp of MM_WEAPONS) expect(kit[energyKey(wp.id)]).toBe(WEAPON_UNITS);
    const w = mmWorld(testLevel(), { powerState: 'fire', kit });
    settle(w);
    const p = w.player;
    const tools = MEGAMAN_CLASSIC.tools?.(p) ?? [];
    expect(tools.map((t) => t.id)).toEqual([...MM_WEAPONS.map((x) => x.id), 'rush']);
    for (const t of tools) expect(SPRITES.items?.frames[t.icon], t.icon).toBeDefined();
    // Water Shield is 8th: seven taps.
    for (let i = 0; i < 7; i++) drive(w, 2, (k) => (k === 0 ? ['select'] : []));
    drive(w, 1, () => ['special']);
    const drops = w.entities.filter((e) => e instanceof WaterDrop && e.alive);
    expect(drops.length).toBe(8);
    expect(p.scratch[energyKey('water-shield')]).toBe(WEAPON_UNITS - 16);
  });

  it('without it there is no belt', () => {
    const w = mmWorld(testLevel(), { powerState: 'fire' });
    expect(MEGAMAN_CLASSIC.tools?.(w.player) ?? []).toEqual([]);
  });

  it('every weapon fires from the full kit without throwing', () => {
    const kit = MEGAMAN_CLASSIC.devKit?.() ?? {};
    const w = mmWorld(level({ 12: '...=' }), { powerState: 'fire', kit });
    settle(w);
    for (let i = 0; i < MM_WEAPONS.length + 1; i++) {
      drive(w, 30, (k) => (k === 0 || k === 20 ? ['special'] : k < 20 ? ['special'] : []));
      drive(w, 60);
      drive(w, 2, (k) => (k === 0 ? ['select'] : []));
    }
    expect(w.player.dead).toBe(false);
  });
});

describe('water (MM-C13) and the guide (MM-C27, TG-22, TG-40)', () => {
  it('uses the shared floor-jump numbers', () => {
    expect(MEGAMAN_CLASSIC_PROFILE.swim).toBe(CLASSIC_SWIM.megaman);
    expect(MEGAMAN_CLASSIC_PROFILE.swim?.floorJumpOnly).toBe(true);
  });

  it('has its own short guide in the bitmap font, with no button letters', () => {
    const g = MEGAMAN_CLASSIC.guide;
    expect(g).not.toBe(MEGAMAN.guide);
    expect(g.tagline.length).toBeLessThanOrEqual(30);
    const texts = [
      g.tagline,
      ...g.controls.flatMap((x) => [x.does, x.touchDoes ?? '', x.touch ?? '']),
      ...g.powerups.map((x) => x.does),
      ...(g.belt ?? []).map((x) => x.does),
      ...(g.tips ?? []),
    ];
    for (const t of texts) {
      expect(fontText(t).length, t).toBe(t.length);
      expect(t, t).not.toMatch(/\b(button|press|push|tap|hold)\s+[abc]\b|\([abc]\)|\b[abc]\s*:/i);
    }
    for (const b of g.belt ?? []) expect(SPRITES.items?.frames[b.icon], b.icon).toBeDefined();
    const w = mmWorld(testLevel(), { powerState: 'fire' });
    const labels = MEGAMAN_CLASSIC.touchLabels?.(w.player, w) ?? {};
    for (const v of Object.values(labels)) if (v) expect(v).not.toMatch(/\b(BUTTON )?[ABC]\b/);
    expect(labels).toMatchObject({ attack: 'SHOOT', special: 'BLADE', select: 'RUSH' });
  });

  it('a variant can be built without Rush, charge or Flower weapon', () => {
    const v = classicMegaMan({ base: MEGAMAN, rush: false, charge: null, flowerWeapon: null });
    const w = runSim({
      level: testLevel(),
      character: v,
      script: { steps: [] },
      maxFrames: 0,
      state: { powerState: 'fire' },
    }).world;
    expect(v.touchLabels?.(w.player, w)).toMatchObject({ special: null, select: null });
  });
});
