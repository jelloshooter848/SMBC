import { describe, expect, it, vi } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { AssetRegistry } from '@engine/assets/registry';
import { NULL_AUDIO } from '@engine/audio/audio-manager';
import { px } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import { World } from '@game/world/world';
import { DEFAULT_ASSIST, newGameState } from '@game/context';
import { MARIO } from '@game/characters/mario';
import { LUIGI } from '@game/characters/luigi';
import { ScriptedInput } from '@game/sim/headless';
import { Koopa, SHELL_NO_HIT_FRAMES } from '@game/entities/enemies/koopa';
import type { Player } from '@game/entities/player';

// The original's KoopaGreen.kickShell starts NO_HIT_SHELL_TMR (250 ms = 15 frames) on every kick.
// While it runs, Character.hitEnemy does nothing for that shell (no damage, no bounce) for every
// character, and KoopaGreen.stomp returns early, so nobody can stomp it.

const GROUND = 208; // px: top of the floor (row 13)

function setup(coop = false) {
  const rows = Array.from({ length: 13 }, () => '.'.repeat(48));
  const level = parseTextMap(
    ['id: t', 'time: 300', 'start: 2,12', '', '[tiles]', ...rows, '#'.repeat(48), '#'.repeat(48)].join('\n'),
  );
  const state = newGameState(MARIO, coop ? LUIGI : null);
  const world = new World(
    level,
    {
      assets: new AssetRegistry({ default: {} }),
      audio: NULL_AUDIO,
      assist: { ...DEFAULT_ASSIST },
      reduceFlashing: true,
    },
    state,
  );
  const hurt: Player[] = [];
  const real = world.hurtPlayer.bind(world);
  vi.spyOn(world, 'hurtPlayer').mockImplementation((p, dir) => {
    if (!p.invulnerable) hurt.push(p);
    real(p, dir);
  });
  return { world, state, hurt };
}

function run(
  world: World,
  frames: number,
  p1: (f: number) => Action[] = () => [],
  each?: (f: number) => void,
) {
  const a = new ScriptedInput({ steps: [] });
  const b = new ScriptedInput({ steps: [] });
  for (let f = 0; f < frames; f++) {
    a.setHeld(p1(f));
    a.next();
    b.next();
    world.update([a, b]);
    each?.(f);
  }
}

/** A still shell on the floor with its left edge at `xPx`. */
function stillShell(world: World, xPx: number): Koopa {
  const k = new Koopa(0, 0, 'green');
  k.body.x = px(xPx);
  k.body.y = px(GROUND) - k.body.h;
  k.activated = true;
  world.spawn(k);
  k.hit({ kind: 'stomp', amount: 1, owner: null, dirX: 1 }, world);
  expect(k.isStillShell).toBe(true);
  return k;
}

/** Stand `p` on the floor with its left edge at `xPx`. */
function standAt(p: Player, xPx: number): void {
  p.body.x = px(xPx);
  p.body.y = px(GROUND) - p.body.h;
  p.body.vx = 0;
  p.body.vy = 0;
  p.body.onGround = true;
}

/** Put `p` just above `k`, falling onto it. */
function dropOnto(p: Player, k: Koopa): void {
  const b = p.body;
  b.x = k.body.x + (k.body.w >> 1) - (b.w >> 1);
  b.y = k.body.y - b.h - px(1);
  b.vy = 0x02000;
  b.onGround = false;
}

describe('shell no-hit window after a kick (KoopaGreen.NO_HIT_SHELL_TMR)', () => {
  it('lasts 250 ms = 15 frames', () => {
    expect(SHELL_NO_HIT_FRAMES).toBe(15);
  });

  it('landing on a still shell kicks it without bouncing; the player falls on and lands unhurt', () => {
    const { world, state, hurt } = setup();
    const k = stillShell(world, 120);
    const p = world.player;
    dropOnto(p, k);
    let rose = false;
    run(world, 40, undefined, () => {
      if (p.body.vy < 0) rose = true;
    });
    expect(k.isMovingShell).toBe(true);
    expect(state.score).toBe(400); // KICK_SHELL_NORMAL, no stomp
    expect(p.combo).toBe(0);
    expect(rose).toBe(false); // Character.hitEnemy leaves the vertical speed alone: no bounce()
    expect(p.body.onGround).toBe(true);
    expect(p.dead).toBe(false);
    expect(hurt).toEqual([]);
  });

  it('walking into a still shell kicks it and the kicker is not hurt during the window', () => {
    const { world, hurt } = setup();
    const k = stillShell(world, 60);
    const p = world.player;
    standAt(p, 60 - 14);
    run(world, 30, () => ['right']);
    expect(k.isMovingShell).toBe(true);
    expect(p.dead).toBe(false);
    expect(hurt).toEqual([]);
  });

  it('protects the other player too: P2 touching the shell is not hurt by P1 kicking it into them', () => {
    const { world, hurt } = setup(true);
    const [p1, p2] = world.players as [Player, Player];
    const k = stillShell(world, 120);
    standAt(p1, 120 - p1.body.w / 256 + 2); // overlapping the shell's left side
    standAt(p2, 120 + 10); // overlapping its right side, in the kick's path
    run(world, 1);
    expect(k.isMovingShell).toBe(true);
    expect(k.body.vx).toBeGreaterThan(0); // kicked away from P1, through P2
    run(world, SHELL_NO_HIT_FRAMES + 20);
    expect(hurt).toEqual([]);
    expect(p2.dead).toBe(false);
  });

  it("P2 falling onto the shell as P1 kicks it neither stomps it nor bounces, and isn't hurt", () => {
    const { world, state, hurt } = setup(true);
    const [p1, p2] = world.players as [Player, Player];
    const k = stillShell(world, 120);
    standAt(p1, 120 - p1.body.w / 256 + 2);
    dropOnto(p2, k);
    let rose = false;
    run(world, 40, undefined, () => {
      if (p2.body.vy < 0) rose = true;
    });
    expect(k.isMovingShell).toBe(true); // not stopped by a stomp
    expect(state.score).toBe(400); // just P1's kick
    expect(p2.combo).toBe(0);
    expect(rose).toBe(false);
    expect(p2.body.onGround).toBe(true);
    expect(hurt).toEqual([]);
  });

  it('after the window the moving shell hurts the other player as before', () => {
    const { world, hurt } = setup(true);
    const [p1, p2] = world.players as [Player, Player];
    const k = stillShell(world, 120);
    standAt(p1, 120 - p1.body.w / 256 + 2);
    standAt(p2, 200); // the shell reaches P2 well after 15 frames
    run(world, 1);
    expect(k.isMovingShell).toBe(true);
    run(world, 60);
    expect(hurt).toContain(p2);
    expect(hurt).not.toContain(p1);
  });
});
