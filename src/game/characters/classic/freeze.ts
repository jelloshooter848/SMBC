import type { World } from '../../world/world';
import { Projectile } from '../../entities/projectiles/projectile';

/**
 * The Stopwatch's level-wide freeze (Classic Simon SI-C25, SI-C31; Classic Peach's sixth turnip in
 * a row, PE-14), shared: every enemy and enemy projectile in the level stops for a number of
 * frames; Lakitu resists. One freeze per world at a time, kept as the frame it ends.
 */
const watchEnds = new WeakMap<World, number>();

/** A Stopwatch freeze is running in `world` now. */
export function stopwatchRunning(world: World): boolean {
  return (watchEnds.get(world) ?? -1) > world.frame;
}

/** Starts a Stopwatch freeze of `frames` frames (the caller has checked stopwatchRunning). */
export function startStopwatch(world: World, frames: number): void {
  watchEnds.set(world, world.frame + frames);
  for (const e of world.enemies) if (e.kind !== 'lakitu') e.stopFrames = Math.max(e.stopFrames, frames);
  for (const e of world.entities)
    if (e instanceof Projectile && e.alive && e.spec.hitsPlayer) e.stopFrames = frames;
  world.audio.sfx('magic');
}
