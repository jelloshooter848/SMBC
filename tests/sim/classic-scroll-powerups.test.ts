import { describe, expect, it } from 'vitest';
import { px } from '@engine/math/units';
import { getLevel } from '@content/levels';
import { MARIO } from '@game/characters/mario';
import { LINK } from '@game/characters/link';
import type { CharacterDef } from '@game/characters/character';
import { PowerUp } from '@game/entities/objects/powerup';
import { runSim, ScriptedInput, type InputScript } from '@game/sim/headless';
import type { Action } from '@engine/input/actions';
import type { LevelData } from '@game/level/schema';
import type { World } from '@game/world/world';
import { T } from '@game/level/tiles';
import { flatLevel } from './classic-plumber-harness';

/*
 * v0.4.74 item 77 (owner-approved, Classic only): with the Classic scroll-back camera a power-up
 * left behind is never destroyed. Within one screen (256 px) past the camera's left edge it keeps
 * moving; further back it is parked, still, like the map's entities, and comes back when the
 * camera does. (A deliberate change from AnimatedObject.checkStgPos's 2 tiles: a player who
 * outruns one and waits ahead for it would otherwise wait forever.) A power-up that falls into a
 * pit is still lost; Current (the campaign) still despawns it 64 px past the edge.
 */

function world(level: LevelData, rules: 'classic' | 'current' = 'classic', def: CharacterDef = MARIO): World {
  return runSim({ level, character: def, script: { steps: [] }, maxFrames: 0, rules }).world;
}

/** Holds `keys` for `n` frames (`each` runs after every frame; true stops). */
function hold(w: World, keys: Action[], n: number, each?: (f: number) => boolean | void): number {
  const script: InputScript = { steps: [{ frame: 0, hold: keys }] };
  const input = new ScriptedInput(script);
  for (let i = 0; i < n; i++) {
    input.next();
    w.update([input]);
    if (each?.(i)) return i;
  }
  return n;
}

/** Puts the hero standing at column `tx`, feet on row `feetRow`'s top, the camera settled there. */
function standAt(w: World, tx: number, feetRow: number, settle = 90): void {
  const b = w.player.body;
  b.x = px(tx * 16);
  b.y = px(feetRow * 16) - b.h;
  b.vx = 0;
  b.vy = 0;
  w.player.invuln = 100000;
  hold(w, [], settle);
}

const powerUps = (w: World) => w.entities.filter((e): e is PowerUp => e instanceof PowerUp && e.alive);

/** 8-2's brick 1-up (column 44, row 5), struck from below; returns the 1-up once it is out. */
function oneUp(w: World): PowerUp {
  standAt(w, 40, 13);
  w.strikeBlock(44, 5, w.player, false);
  hold(w, [], 34);
  const u = powerUps(w).find((e) => e.item === '1up');
  expect(u).toBeDefined();
  expect(u?.out).toBe(true);
  return u as PowerUp;
}

describe('item 77: a power-up left behind under Classic scroll-back', () => {
  it("8-2's brick 1-up keeps walking along the bricks behind the screen; waiting ahead, Mario gets it", () => {
    const w = world(getLevel('8-2'));
    const u = oneUp(w);
    w.state.lives = 3;
    // Ahead on the bricks: the 1-up is 6 to 8 tiles behind the screen's left edge.
    standAt(w, 66, 5);
    const behind = (w.camera.x - (u.body.x + u.body.w)) / px(16);
    expect(behind).toBeGreaterThan(4);
    expect(behind).toBeLessThan(16);
    const x0 = u.body.x;
    hold(w, [], 30);
    expect(u.alive).toBe(true);
    expect(w.entities).toContain(u);
    expect(u.body.x).toBeGreaterThan(x0);
    const got = hold(w, [], 600, () => w.state.lives === 4);
    expect(got).toBeLessThan(600);
    expect(w.state.lives).toBe(4);
  });

  it('more than a screen behind it is parked where it was, still; walking back brings it back to be taken', () => {
    const w = world(getLevel('8-2'));
    const u = oneUp(w);
    w.state.lives = 3;
    standAt(w, 100, 13, 300);
    expect(w.camera.x - (u.body.x + u.body.w)).toBeGreaterThan(px(256));
    const at = { x: u.body.x, y: u.body.y };
    hold(w, [], 300);
    expect(u.alive).toBe(true);
    expect(w.entities).not.toContain(u);
    expect({ x: u.body.x, y: u.body.y }).toEqual(at);
    // Walk back (the camera follows), then up on the bricks ahead of it: it is back on the
    // stage, walking, and taken.
    // (jumping the pipes on the way.)
    for (let i = 0; i < 40 && w.player.body.x >= px(62 * 16); i++) {
      hold(w, ['left', 'jump'], 20, () => w.player.body.x < px(62 * 16));
      hold(w, ['left'], 10, () => w.player.body.x < px(62 * 16));
    }
    expect(w.player.body.x).toBeLessThan(px(62 * 16));
    w.player.body.y = px(5 * 16) - w.player.body.h;
    w.player.body.vx = 0;
    hold(w, [], 30);
    expect(w.entities).toContain(u);
    const got = hold(w, [], 600, () => w.state.lives === 4);
    expect(got).toBeLessThan(600);
  });

  for (const def of [MARIO, LINK])
    it(`${def.id}: at 0.25 to 20 tiles behind the edge it is never deleted (moving within 16, parked beyond)`, () => {
      for (const d of [0.25, 1, 2, 3, 4, 8, 16, 20]) {
        // A long flat floor with a wall far left: the mushroom walks right, toward the screen.
        const w = world(flatLevel({}, 200), 'classic', def);
        standAt(w, 120, 13);
        const cam = w.camera.x;
        const u = PowerUp.hopOut(cam - px(d * 16) - px(6), px(13 * 16), 'mushroom');
        u.body.vx = -0x01000;
        w.spawn(u);
        const x0 = u.body.x;
        let moved = false;
        hold(w, [], 120, () => {
          if (u.body.x !== x0) moved = true;
        });
        expect(u.alive, `${d} tiles`).toBe(true);
        if (d <= 16) expect(moved, `${d} tiles`).toBe(true);
        else expect(w.entities, `${d} tiles`).not.toContain(u);
      }
    });

  it('ahead of the screen (a block struck at the start of 1-1, or the camera gone back) it moves within a screen, parks beyond', () => {
    for (const [d, moving] of [
      [4, true],
      [15, true],
      [20, false],
    ] as const) {
      const w = world(flatLevel({}, 200));
      standAt(w, 40, 13);
      const u = PowerUp.hopOut(w.camera.right + px(d * 16), px(13 * 16), 'mushroom');
      w.spawn(u);
      hold(w, [], 10);
      expect(u.alive, `${d} tiles`).toBe(true);
      expect(w.entities.includes(u), `${d} tiles`).toBe(moving);
    }
  });

  it('a power-up off the screen that walks into a pit is still lost', () => {
    const lv = flatLevel({}, 200);
    for (const y of [13, 14]) for (const x of [80, 81]) lv.tiles[y * lv.width + x] = T.AIR;
    const w = world(lv);
    standAt(w, 95, 13);
    // Beside the pit, 4 to 16 tiles behind the screen: it walks right and falls in.
    const u = PowerUp.hopOut(px(79 * 16), px(13 * 16), 'mushroom');
    expect(w.camera.x - (u.body.x + u.body.w)).toBeGreaterThan(px(64));
    expect(w.camera.x - (u.body.x + u.body.w)).toBeLessThan(px(256));
    w.spawn(u);
    hold(w, [], 200);
    expect(u.alive).toBe(false);
  });

  it('Current (the campaign): the same 1-up still despawns 64 px past the edge', () => {
    const w = world(getLevel('8-2'), 'current');
    const u = oneUp(w);
    standAt(w, 60, 5);
    expect(u.alive).toBe(false);
    expect(w.entities).not.toContain(u);
  });
});
