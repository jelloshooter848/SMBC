import { describe, expect, it } from 'vitest';
import { px, toPx } from '@engine/math/units';
import { SCREEN_W } from '@engine/viewport';
import { getLevel } from '@content/levels';
import { MARIO } from '@game/characters/mario';
import { Goomba } from '@game/entities/enemies/goomba';
import { parseTextMap } from '@game/level/textmap';
import { runSim, ScriptedInput, type InputScript } from '@game/sim/headless';
import type { Action } from '@engine/input/actions';
import { Camera, SCROLL_BACK_CENTER } from '@game/world/camera';
import type { World, WorldStart } from '@game/world/world';

// Classic SMBC's camera scrolls back left (SMBC 3.1.21's default: Level.scrollScreen with
// screenScrollsLeft, i.e. the Classic Screen Scroll cheat off). Current keeps SMB1's right-only
// camera, and the Scroll back assist is its own thing.

function world(rules: 'classic' | 'current', level = getLevel('1-1'), start?: WorldStart): World {
  if (!level) throw new Error('no level');
  return runSim({
    level,
    character: MARIO,
    script: { steps: [] },
    maxFrames: 0,
    rules,
    ...(start ? { start } : {}),
  }).world;
}

/** Holds `keys` for `n` frames. */
function hold(w: World, keys: Action[], n: number): void {
  const script: InputScript = { steps: [{ frame: 0, hold: keys }] };
  const input = new ScriptedInput(script);
  for (let i = 0; i < n; i++) {
    input.next();
    w.update([input]);
  }
}

/** A flat 96-column map with a Goomba caged on a ledge over the path (it cannot reach the player). */
function cageLevel(camera = 'scroll'): ReturnType<typeof parseTextMap> {
  const lines: string[] = [];
  for (let y = 0; y < 13; y++) {
    let row = '.'.repeat(96);
    if (y === 7 || y === 10) row = row.slice(0, 19) + '#####' + row.slice(24);
    if (y === 8 || y === 9) row = row.slice(0, 19) + '#...#' + row.slice(24);
    lines.push(row);
  }
  lines.push('#'.repeat(96), '#'.repeat(96));
  return parseTextMap(
    [
      `id: t`,
      'time: 300',
      'start: 2,12',
      `camera: ${camera}`,
      '',
      '[tiles]',
      ...lines,
      '',
      '[entities]',
      'goomba 21 9',
    ].join('\n'),
  );
}

describe('Classic camera scrolls back left (SMBC 3.1.21 default)', () => {
  it('Classic 1-1: the camera follows Mario back left to the area start, keeping him centred', () => {
    // From between the ? blocks and the first pipe: the camera opens centred on him
    // (forceShiftScreenToFollowPlayer) and walks back with him to the area's left end.
    const w = world('classic', getLevel('1-1'), { x: 15, y: 12, mode: 'stand' });
    expect(w.camera.scrollBack).toBe(true);
    const at = w.camera.x;
    expect(Math.abs(w.player.centerX - w.camera.x - SCROLL_BACK_CENTER)).toBeLessThanOrEqual(px(8));
    hold(w, ['left'], 60);
    expect(w.camera.x).toBeLessThan(at - px(20));
    expect(Math.abs(w.player.centerX - w.camera.x - SCROLL_BACK_CENTER)).toBeLessThanOrEqual(px(4));
    hold(w, ['left', 'run'], 300);
    expect(w.camera.x).toBe(0);
    expect(toPx(w.player.body.x)).toBeLessThan(4);
  });

  it('Classic: right then back left on a flat map, centred both ways, never past the left end', () => {
    const w = world('classic', cageLevel());
    hold(w, ['right', 'run'], 200);
    const far = w.camera.x;
    expect(far).toBeGreaterThan(px(300));
    // Centred going right too (DEFAULT_RIGHT_SCROLL_POS = half the screen).
    expect(Math.abs(w.player.centerX - w.camera.x - SCROLL_BACK_CENTER)).toBeLessThanOrEqual(px(4));
    hold(w, ['left'], 120);
    expect(w.camera.x).toBeLessThan(far - px(100));
    hold(w, ['left', 'run'], 600);
    expect(w.camera.x).toBe(0);
  });

  it('Current is unchanged: the camera never goes back left', () => {
    const w = world('current', cageLevel());
    expect(w.camera.scrollBack).toBe(false);
    hold(w, ['right', 'run'], 200);
    hold(w, [], 40);
    const far = w.camera.x;
    expect(far).toBeGreaterThan(0);
    // SMB1's push point, not the centre.
    expect(toPx(w.player.body.x - w.camera.x)).toBeLessThanOrEqual(81);
    hold(w, ['left'], 200);
    expect(w.camera.x).toBe(far);
  });

  it('Classic: an enemy left behind is parked, not despawned, and comes back as it was', () => {
    const w = world('classic', cageLevel());
    hold(w, ['right'], 120);
    const g = w.entities.find((e): e is Goomba => e instanceof Goomba);
    expect(g).toBeDefined();
    // Walk on until the cage is far off the left of the screen.
    hold(w, ['right', 'run'], 260);
    expect(w.camera.x).toBeGreaterThan(g!.body.x + px(64 + 16));
    expect(w.entities.includes(g!)).toBe(false);
    expect(g!.alive).toBe(true);
    const x = g!.body.x;
    // Back left: it is on the stage again, where it was left.
    hold(w, ['left', 'run'], 260);
    expect(w.entities.includes(g!)).toBe(true);
    expect(g!.alive).toBe(true);
    expect(Math.abs(g!.body.x - x)).toBeLessThanOrEqual(px(32));
    // Spawned once only: no second Goomba from the spawn list.
    expect(w.entities.filter((e) => e instanceof Goomba)).toHaveLength(1);
  });

  it('Current: the same enemy despawns for good', () => {
    const w = world('current', cageLevel());
    hold(w, ['right'], 120);
    const g = w.entities.find((e): e is Goomba => e instanceof Goomba)!;
    hold(w, ['right', 'run'], 260);
    expect(g.alive).toBe(false);
  });

  it('Locked, free and auto-scroll cameras keep their own rules under Classic', () => {
    for (const cam of ['locked', 'free', 'auto']) {
      const w = world('classic', cageLevel(cam));
      expect(w.camera.scrollBack, cam).toBe(false);
    }
    const ship = getLevel('4-2-airship');
    if (ship?.camera === 'auto') expect(world('classic', ship).camera.scrollBack).toBe(false);
  });

  it('Bowser on screen: the camera pans toward the bridge at 1.25 px a frame, then eases back', () => {
    const c = new Camera(64, null);
    c.scrollBack = true;
    c.x = px(100);
    const cx = c.x + SCROLL_BACK_CENTER;
    c.followBack(cx, true);
    expect(c.x).toBe(px(100) + px(1.25));
    for (let i = 0; i < 200; i++) c.followBack(cx, true);
    // It stops with the lead a tenth of the screen in (leftScrollPos = SCREEN_WIDTH * .1).
    expect(toPx(cx - c.x)).toBeLessThanOrEqual(Math.ceil(SCREEN_W * 0.1));
    const panned = c.x;
    // Bowser gone: the left limit eases back toward the centre, 1.25 px a frame, not in one jump.
    c.followBack(cx, false);
    expect(c.x).toBeLessThan(panned);
    expect(panned - c.x).toBeLessThanOrEqual(px(2));
    for (let i = 0; i < 300; i++) c.followBack(cx, false);
    expect(c.x).toBe(cx - SCROLL_BACK_CENTER);
  });

  it('Bowser fight: the max scroll stays the scroll stop (the axe end)', () => {
    const c = new Camera(64, 40);
    c.scrollBack = true;
    for (let i = 0; i < 1000; i++) c.followBack(px(63 * 16), true);
    expect(c.x).toBe(px(40 * 16 - SCREEN_W));
  });

  it("follows a hero's eased camera anchor (CharacterDef.cameraX: Classic Sophia III's turns)", () => {
    const lagged = {
      ...MARIO,
      rules: 'classic' as const,
      cameraX: (p: World['player']) => p.body.x - px(40),
    };
    const level = cageLevel();
    const w = runSim({
      level,
      character: lagged,
      script: { steps: [] },
      maxFrames: 0,
      rules: 'classic',
    }).world;
    hold(w, ['right'], 200);
    const p = w.player;
    expect(w.camera.scrollBack).toBe(true);
    expect(w.camera.x).toBe(p.body.x - px(40) + px(8) - SCROLL_BACK_CENTER);
  });
});
