import { describe, expect, it } from 'vitest';
import { parseTextMap } from '@game/level/textmap';
import { runSim } from '@game/sim/headless';
import { MARIO } from '@game/characters/mario';
import { Koopa, PARA_HOP } from '@game/entities/enemies/koopa';
import { SUB } from '@engine/math/units';
import type { LevelData } from '@game/level/schema';
import type { Action } from '@engine/input/actions';
import type { World } from '@game/world/world';

// Paratroopa flight, KoopaGreen.as (Flash px on 32 px tiles; ours are 16 px, at 60 frames a second):
// - FT_VERT (red): ny = centerY + sin(waveAngle) * 85, waveAngle += 1.5 * dt
// - FT_HORZ (sideways green): the same wave on x, plus a ±TILE_SIZE/2 drift at 25 px/s, starting up
// - FT_JUMP (hopping green): vy = -400 on landing, gravity enemyGravDef 1300, walk 65 px/s

const none = { steps: [{ frame: 0, hold: [] as Action[] }] };

const flat = (entity: string): LevelData =>
  parseTextMap(
    [
      'id: t',
      'time: 300',
      'start: 2,12',
      '',
      '[tiles]',
      ...Array.from({ length: 13 }, () => '.'.repeat(64)),
      '#'.repeat(64),
      '#'.repeat(64),
      '',
      '[entities]',
      entity,
    ].join('\n'),
  );

/** Sample the paratroopa's position (px, float) every frame while it still has its wings. */
function track(entity: string, frames: number): { x: number[]; y: number[]; ground: boolean[] } {
  const x: number[] = [];
  const y: number[] = [];
  const ground: boolean[] = [];
  let k: Koopa | undefined;
  runSim({
    level: flat(entity),
    character: MARIO,
    script: none,
    maxFrames: frames,
    controller: (w: World) => {
      const p = w.player.body;
      p.x = 2 * 16 * SUB; // keep the player far away and out of reach
      k ??= w.entities.find((e): e is Koopa => e instanceof Koopa);
      if (k?.alive && k.wings) {
        x.push(k.body.x / SUB);
        y.push(k.body.y / SUB);
        ground.push(k.body.vy === -PARA_HOP); // just landed and took off again
      }
      return [];
    },
  });
  return { x, y, ground };
}

const maxStep = (a: number[]): number =>
  Math.max(...a.slice(1).map((v, i) => Math.abs(v - (a[i] as number))));
/** Frames between the first two local maxima of a smooth wave. */
const period = (a: number[]): number => {
  const peaks: number[] = [];
  for (let i = 1; i < a.length - 1; i++)
    if ((a[i] as number) > (a[i - 1] as number) && (a[i] as number) >= (a[i + 1] as number)) peaks.push(i);
  return (peaks[1] as number) - (peaks[0] as number);
};

describe('paratroopa flight', () => {
  it('red ones bob ±42.5 px, one cycle every 251 frames, at most 1.06 px a frame', () => {
    const { y } = track('koopa-para-red 12 6', 600);
    expect(Math.max(...y) - Math.min(...y)).toBeCloseTo(85, 0);
    expect(period(y)).toBeGreaterThanOrEqual(250);
    expect(period(y)).toBeLessThanOrEqual(253);
    expect(maxStep(y)).toBeLessThanOrEqual(1.07);
    expect(y[1] as number).toBeGreaterThan(y[0] as number); // sin starts at 0 and grows: down first
  });

  it('sideways ones sway ±42.5 px starting right, and drift ±8 px starting up at 0.21 px a frame', () => {
    const { x, y } = track('koopa-para-green-h 12 6', 600);
    expect(Math.max(...x) - Math.min(...x)).toBeCloseTo(85, 0);
    expect(period(x)).toBeGreaterThanOrEqual(250);
    expect(period(x)).toBeLessThanOrEqual(253);
    expect(x[1] as number).toBeGreaterThan(x[0] as number);
    expect(y[1] as number).toBeLessThan(y[0] as number);
    const range = Math.max(...y) - Math.min(...y);
    expect(range).toBeGreaterThanOrEqual(15.5);
    expect(range).toBeLessThanOrEqual(16.5);
    expect(maxStep(y)).toBeLessThanOrEqual(0.22);
    expect(maxStep(y)).toBeGreaterThanOrEqual(0.2);
  });

  it('hopping green ones rise about 31 px, 37 frames a hop, about 18 px forward', () => {
    const { x, y, ground } = track('koopa-para-green 14 12', 200);
    // Landings: it takes off again on the frame it lands.
    const landings: number[] = [];
    ground.forEach((g, i) => {
      if (g) landings.push(i);
    });
    // Skip the first (the drop from its spawn spot); measure two whole hops after it.
    const [a, b, c] = landings.slice(-3) as [number, number, number];
    expect(b - a).toBeGreaterThanOrEqual(36);
    expect(b - a).toBeLessThanOrEqual(38);
    expect(c - b).toBe(b - a);
    const hop = y.slice(a, b + 1);
    const height = (y[a] as number) - Math.min(...hop);
    expect(height).toBeGreaterThanOrEqual(29);
    expect(height).toBeLessThanOrEqual(32);
    const forward = Math.abs((x[b] as number) - (x[a] as number));
    expect(forward).toBeGreaterThanOrEqual(17);
    expect(forward).toBeLessThanOrEqual(20);
  });
});
