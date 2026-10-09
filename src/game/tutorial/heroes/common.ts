import { tileToSub } from '@engine/math/units';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import { lessonUpFrame } from '../stage-prompts';
import { lessonTargets, stageWatch, type StageHit } from '../targets';

/*
 * What the hero stages' lessons share (0.4.37): where the hero stands, and what the stage's watch
 * saw since the lesson came up (targets.ts).
 */

export const alive = (p: Player): boolean => !p.dead && !p.out;

/** A player is at column `col` or past it. */
export const past = (w: World, col: number): boolean =>
  w.players.some((p) => alive(p) && p.body.x >= tileToSub(col));

/** A player stands on the ground at column `col` or past it. */
export const landedPast = (w: World, col: number): boolean =>
  w.players.some((p) => alive(p) && p.body.onGround && p.body.x >= tileToSub(col));

/** A player stands on a ledge whose top is row `row`, over columns `from` to `to` (any part of him). */
export const onTop = (w: World, row: number, from: number, to: number): boolean =>
  w.players.some(
    (p) =>
      alive(p) &&
      p.body.onGround &&
      p.body.y + p.body.h <= tileToSub(row) &&
      p.body.x + p.body.w > tileToSub(from) &&
      p.body.x < tileToSub(to + 1),
  );

/** The hits on targets and enemies since the current lesson came up that `pred` accepts. */
export function hitsSince(w: World, pred: (h: StageHit) => boolean): StageHit[] {
  return stageWatch(w).since(lessonUpFrame(w), pred);
}

/** The hits the hero took since the current lesson came up. */
export function hurtsSince(w: World): { cost: number; frame: number }[] {
  const from = lessonUpFrame(w);
  return stageWatch(w).hurts.filter((h) => h.frame >= from);
}

/** Shields' blocks and leaves' swats of shooter shots since the current lesson came up. */
export function blocksSince(w: World): { blocks: number; swats: number } {
  const watch = stageWatch(w);
  const from = lessonUpFrame(w);
  return {
    blocks: watch.blockFrames.filter((f) => f >= from).length,
    swats: watch.swatFrames.filter((f) => f >= from).length,
  };
}

/** Lesson `id`'s targets still up (it pops them once done). */
export { lessonTargets };
