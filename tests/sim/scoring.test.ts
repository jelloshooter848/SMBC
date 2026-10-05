import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { px } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { World } from '@game/world/world';
import { DEFAULT_ASSIST, newGameState, type GameState } from '@game/context';
import { MARIO } from '@game/characters/mario';
import { ScriptedInput } from '@game/sim/headless';
import type { Enemy } from '@game/entities/enemies/enemy';
import { Goomba } from '@game/entities/enemies/goomba';
import { Koopa } from '@game/entities/enemies/koopa';
import { HammerBro } from '@game/entities/enemies/hammer-bro';
import { BulletBill } from '@game/entities/enemies/bullet-bill';
import { Bowser } from '@game/entities/enemies/bowser';
import { ScorePopup } from '@game/entities/effects/effects';
import type { Renderer } from '@engine/gfx/renderer';
import type { View } from '@game/entities/entity';

/** Records the bitmap text drawn. */
class TextSpy implements Renderer {
  drawn: { str: string; x: number; y: number }[] = [];
  clear(): void {}
  rect(): void {}
  sprite(): void {}
  debugText(): void {}
  line(): void {}
  text(...[, str, x, y]: Parameters<Renderer['text']>): void {
    this.drawn.push({ str, x, y });
  }
}

/** A view whose sprite sheets are stand-ins (only the draw calls are checked). */
const VIEW: View = {
  camX: 0,
  frame: 0,
  assets: { sheet: () => ({}) } as unknown as AssetRegistry,
  theme: 'overworld',
  reduceFlashing: true,
};

const GROUND = 208; // px: top of the floor (row 13)

/** A flat 48-column field; `rows` replaces tile rows 0-12. Mario starts at column 2. */
function setup(state: Partial<GameState> = {}, rows: Record<number, string> = {}) {
  const base = Array.from({ length: 13 }, () => '.'.repeat(48));
  for (const [y, row] of Object.entries(rows)) base[Number(y)] = row;
  const level = parseTextMap(
    ['id: t', 'time: 300', 'start: 2,12', '', '[tiles]', ...base, '#'.repeat(48), '#'.repeat(48)].join('\n'),
  );
  const gs = { ...newGameState(MARIO), ...state };
  const world = new World(
    level,
    {
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: true,
    },
    gs,
  );
  return { world, state: gs };
}

const at = (col: number, ch: string) => '.'.repeat(col) + ch + '.'.repeat(48 - col - ch.length);

function run(world: World, frames: number, held: (f: number) => Action[] = () => []): void {
  const input = new ScriptedInput({ steps: [] });
  for (let f = 0; f < frames; f++) {
    input.setHeld(held(f));
    input.next();
    world.update([input]);
  }
}

/** Run until `until` holds (or `max` frames pass); returns the frames run. */
function runUntil(
  world: World,
  until: () => boolean,
  max: number,
  held: (f: number) => Action[] = () => [],
): number {
  const input = new ScriptedInput({ steps: [] });
  for (let f = 0; f < max; f++) {
    if (until()) return f;
    input.setHeld(held(f));
    input.next();
    world.update([input]);
  }
  return max;
}

/** Popups spawned so far (alive ones), in spawn order. */
const popups = (w: World) =>
  w.entities.filter((e): e is ScorePopup => e instanceof ScorePopup && e.alive).map((e) => e.text);

/** Put an enemy standing on the floor with its left edge at `xPx`. */
function onFloor<E extends Enemy>(world: World, e: E, xPx: number): E {
  e.body.x = px(xPx);
  e.body.y = px(GROUND) - e.body.h;
  e.activated = true;
  world.spawn(e);
  return e;
}

/** Hold the player in the air just above `e`, falling onto it. */
function dropOnto(world: World, e: Enemy): void {
  const b = world.player.body;
  b.x = e.body.x + (e.body.w >> 1) - (b.w >> 1);
  b.y = e.body.y - b.h - px(1);
  b.vy = 0x02000;
  b.onGround = false;
}

describe('kill scores by kill kind (ScoreValue.as)', () => {
  it('a fireball kills a Koopa for 200 (KOOPA_ATTACK)', () => {
    const { world, state } = setup({ powerState: 'fire' });
    onFloor(world, new Koopa(0, 0, 'green'), 100);
    run(world, 60, (f) => (f === 2 ? ['attack'] : []));
    expect(world.entities.some((e) => e instanceof Koopa && e.alive)).toBe(false);
    expect(state.score).toBe(200);
  });

  it('star power scores the STAR value (Koopa 200, Goomba 100, Hammer Bro 1000)', () => {
    for (const [make, points] of [
      [() => new Koopa(0, 0, 'green'), 200],
      [() => new Goomba(0, 0), 100],
      [() => new HammerBro(0, 0), 1000],
    ] as const) {
      const { world, state } = setup();
      world.player.star = 300;
      onFloor(world, make(), 32);
      run(world, 3);
      expect(state.score).toBe(points);
    }
  });

  it('a block bumped under an enemy scores the BELOW value (Koopa 100, Bullet Bill 200)', () => {
    for (const [make, points] of [
      [() => new Koopa(0, 0, 'green'), 100],
      [() => new BulletBill(0, 0, -1), 200],
    ] as const) {
      const { world, state } = setup({}, { 9: at(10, '=') });
      const e = make();
      e.body.x = px(160);
      e.body.y = px(144) - e.body.h;
      world.spawn(e);
      world.strikeBlock(10, 9, world.player, false);
      expect(state.score).toBe(points);
    }
  });

  it('Bowser killed by hit points scores BOWSER_ATTACK (5000)', () => {
    const { world, state } = setup();
    const bowser = new Bowser(20, 12);
    world.spawn(bowser);
    world.explode(bowser.body.x + px(14), bowser.body.y + px(15), 24, null, {
      hurtsPlayers: false,
      amount: 9,
    });
    expect(bowser.alive).toBe(false);
    expect(state.score).toBe(5000);
  });

  it('a first stomp on a Paratroopa scores KOOPA_FLYING_STOMP (400), a Hammer Bro 1000', () => {
    for (const [make, points] of [
      [() => new Koopa(0, 0, 'green', true), 400],
      [() => new HammerBro(0, 0), 1000],
    ] as const) {
      const { world, state } = setup();
      const e = onFloor(world, make(), 120);
      dropOnto(world, e);
      run(world, 2);
      expect(state.score).toBe(points);
    }
  });

  it('a Bullet Bill stomp does not count towards the stomp sequence', () => {
    const { world, state } = setup();
    const bill = new BulletBill(px(120), px(150), -1);
    bill.body.vx = 0;
    world.spawn(bill);
    dropOnto(world, bill);
    run(world, 2);
    expect(state.score).toBe(200);
    expect(world.player.combo).toBe(0);
  });

  it('two Goombas stomped in the same frame: 100, then at least DOUBLE_STOMP (400)', () => {
    const { world, state } = setup();
    const a = onFloor(world, new Goomba(0, 0), 120);
    onFloor(world, new Goomba(0, 0), 122);
    dropOnto(world, a);
    run(world, 2);
    expect(popups(world)).toEqual(['100', '400']);
    expect(state.score).toBe(500);
  });
});

describe('shell kicks (KoopaGreen.kickShell, KICK_SHELL_*)', () => {
  it('stomping a Koopa and landing back on the still shell kicks it for 500 (AFTER_STOMP)', () => {
    const { world, state } = setup();
    const k = onFloor(world, new Koopa(0, 0, 'green'), 120);
    dropOnto(world, k);
    runUntil(world, () => k.isMovingShell, 120);
    expect(k.isMovingShell).toBe(true);
    expect(popups(world)).toEqual(['100', '500']);
    expect(state.score).toBe(600);
    expect(world.player.combo).toBe(1); // the kick is not a stomp
  });

  it('landing on a still shell from a plain jump kicks it for 400 (NORMAL) without a stomp', () => {
    const { world, state } = setup();
    const k = onFloor(world, new Koopa(0, 0, 'green'), 120);
    k.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, world); // now a still shell
    dropOnto(world, k);
    run(world, 2);
    expect(k.isMovingShell).toBe(true);
    expect(state.score).toBe(400);
    expect(world.player.combo).toBe(0);
  });

  it('walking into a still shell kicks it for 400 (NORMAL)', () => {
    const { world, state } = setup();
    const k = onFloor(world, new Koopa(0, 0, 'green'), 60);
    k.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, world);
    runUntil(
      world,
      () => k.isMovingShell,
      120,
      () => ['right'],
    );
    expect(state.score).toBe(400);
  });

  it('kicking while the legs are out scores 500, and in the last 250 ms before walking 1000', () => {
    // Shell timers (KoopaGreen.as): legs show after SHELL_TMR_1 (3800 ms = 228 frames), the bonus
    // runs for SHELL_TMR_2 (900 ms = 54 frames), then SHELL_TMR_3 (250 ms = 15 frames) to walking.
    const kickAfter = (frames: number) => {
      const { world, state } = setup();
      const k = onFloor(world, new Koopa(0, 0, 'green'), 200);
      k.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, world);
      run(world, frames);
      const before = state.score;
      world.player.body.x = k.body.x - world.player.body.w + px(1);
      world.player.body.y = px(GROUND) - world.player.body.h;
      run(world, 1);
      return { state: k.state, points: state.score - before };
    };
    expect(kickAfter(220)).toEqual({ state: 'shell-moving', points: 400 });
    expect(kickAfter(230)).toEqual({ state: 'shell-moving', points: 500 });
    expect(kickAfter(228 + 54 - 2)).toEqual({ state: 'shell-moving', points: 500 });
    expect(kickAfter(228 + 54 + 1)).toEqual({ state: 'shell-moving', points: 1000 });
    expect(kickAfter(228 + 54 + 12)).toEqual({ state: 'shell-moving', points: 1000 });
  });

  it('a still shell walks again after 4950 ms (297 frames)', () => {
    const { world } = setup();
    const k = onFloor(world, new Koopa(0, 0, 'green'), 400);
    k.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, world);
    run(world, 296);
    expect(k.state).toBe('wiggle');
    run(world, 1);
    expect(k.state).toBe('walk');
  });

  it('a kicked shell knocks out enemies for 500, 800, 1000 (SHELL_KICK_SEQ)', () => {
    const { world, state } = setup();
    const k = onFloor(world, new Koopa(0, 0, 'green'), 60);
    k.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, world);
    for (const x of [140, 180, 220]) onFloor(world, new Goomba(0, 0), x).body.vx = 0;
    runUntil(
      world,
      () => k.isMovingShell,
      120,
      () => ['right'],
    );
    run(world, 90);
    expect(world.entities.some((e) => e instanceof Goomba && e.alive)).toBe(false);
    expect(state.score).toBe(400 + 500 + 800 + 1000);
  });
});

describe('flagpole (FlagPole.as)', () => {
  // Pole at column 20: ball row 2, shaft rows 3-11, base block row 12 (top at y = 192).
  const poleRows = (): Record<number, string> => {
    const rows: Record<number, string> = { 2: at(20, 'o'), 12: at(20, '#') };
    for (let y = 3; y <= 11; y++) rows[y] = at(20, '!');
    return rows;
  };

  /** Hang the player beside the pole with its middle (or, with `byHead`, its top) at `y` px. */
  function grab(y: number, powerState = 'small', byHead = false) {
    const { world, state } = setup({ powerState }, poleRows());
    const b = world.player.body;
    b.x = px(20 * 16 + 8) - b.w;
    b.y = byHead ? px(y) : px(y) - (b.h >> 1);
    b.vy = 0;
    b.onGround = false;
    run(world, 1);
    return { world, state };
  }

  it('scores by the vertical middle against the pole height from the bottom', () => {
    // Bands start at 192 - 148.8 * 90% / 65% / 40% / 20% (y = 58.08, 95.28, 132.48, 162.24).
    expect(grab(132).state.score).toBe(800); // mid-pole from a ground jump (was 400)
    expect(grab(150).state.score).toBe(400);
    expect(grab(170).state.score).toBe(100);
    expect(grab(90).state.score).toBe(2000);
    // Head at y = 48, the top of the shaft just under the ball: small Mario's middle is at 56,
    // inside the 90% band (5000); big Mario's is at 64, so with the 9.3-tile pole he gets 2000.
    expect(grab(48, 'small', true).state.score).toBe(5000);
    expect(grab(48, 'big', true).state.score).toBe(2000);
  });

  it('the grab score text rises as the flag drops and stays by the top of the pole', () => {
    const { world } = grab(150);
    const drawnY = () => {
      const r = new TextSpy();
      for (const e of world.entities) if (e.alive) e.render(r, VIEW);
      return r.drawn.find((t) => t.str === '400')?.y;
    };
    const ys: (number | undefined)[] = [];
    for (let i = 0; i < 80; i++) {
      run(world, 1);
      ys.push(drawnY());
    }
    expect(ys[0]).toBeGreaterThan(150); // starts by the flag's resting place
    for (let i = 1; i < ys.length; i++) expect(ys[i]).toBeLessThanOrEqual(ys[i - 1] as number);
    expect(ys[ys.length - 1]).toBe(48); // ends where the flag started
    run(world, 200);
    expect(drawnY()).toBe(48);
  });

  it('other score popups keep floating up and expire during the clear', () => {
    const { world } = grab(150);
    world.addScore(100, px(300), px(100));
    const popup = world.entities.find((e) => e instanceof ScorePopup) as ScorePopup;
    const y0 = popup.body.y;
    run(world, 10);
    expect(popup.body.y).toBeLessThan(y0);
    run(world, 40);
    expect(popup.alive).toBe(false);
    expect(world.player.frozen).toBe(true); // still in the clear sequence
  });
});
