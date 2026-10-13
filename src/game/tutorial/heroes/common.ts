import { tileToSub } from '@engine/math/units';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import { lessonUpFrame } from '../stage-prompts';
import { lessonTargets, lessonThorns, stageWatch, TrainingThorns, type StageHit } from '../targets';
import type { Lesson } from '../stage-prompts';
import { HIT_RULES, HIT_TASK } from '../hit-rules';

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

/** Where a stage's WHAT A HIT TAKES lesson is played (hitLessons). */
export interface HitPlace {
  /** The column the lessons start at (a respawn stands here), and the row the hero stands in. */
  at: number;
  row: number;
  /** The thorns' column. */
  thorns: number;
  /** A power-up hero must be big for it (Luigi, Sophia III): a small one is made big first. */
  big?: boolean;
}

/**
 * WHAT A HIT TAKES (0.4.46, roadmap #21): a thorn bush that can't beat the hero (TrainingThorns),
 * the hero walks into it and takes a hit, then a tip says what the hit took (hit-rules.ts: the
 * hero's real rule). That tip keeps the hero as the hit left them (no kit floor, no health back)
 * while it is read; the next lesson gives it all back. A Star still on is put out first.
 */
export function hitLessons(hero: string, place: HitPlace): Lesson[] {
  const { at, row, thorns } = place;
  return [
    {
      id: 'hit',
      at,
      row,
      text: HIT_TASK,
      retry: "WALK INTO THE THORNS: THEY CAN'T BEAT YOU. SEE WHAT A HIT TAKES!",
      ...(place.big ? { big: true } : {}),
      enter: (w) => {
        for (const p of w.players) if (p.star > 1) p.star = 1;
        if (!lessonThorns(w, 'hit').length) w.spawn(new TrainingThorns(thorns, row, 'hit'));
      },
      done: (w) => lessonThorns(w, 'hit').some((t) => t.struck),
    },
    {
      id: 'hit-note',
      at,
      row,
      note: true,
      keepKit: true,
      text: HIT_RULES[hero]?.tip ?? '',
      enter: (w) => {
        for (const t of lessonThorns(w)) t.pop(w);
      },
      done: (w) => past(w, thorns + 1),
    },
  ];
}
