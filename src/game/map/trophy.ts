/*
 * A freed hero's trophy beside its node on the world map (captives.ts heroHint 'trophy') is
 * glad to be free: every few seconds it does a happy hop in its jump pose, with a small sparkle
 * at the top (none with reduce flashing), and the first time it shows after being freed it
 * hops TROPHY_BURST_HOPS times in a row. Pure timing here; world-map.ts draws it.
 *
 * It reads as a statue, not a second player marker (owner note 13, 0.4.22): the hero at half
 * size (TROPHY_SCALE) on a small stone pedestal (PEDESTAL_*), with a smaller hop and sparkle.
 */

/** Frames between the starts of two idle hops (3 s). */
export const TROPHY_HOP_EVERY = 180;
/** Frames one hop lasts. */
export const TROPHY_HOP_FRAMES = 24;
/** How high a hop lifts the statue (px). */
export const TROPHY_HOP_PX = 4;
/** The statue is the hero's portrait at this size (nearest neighbour). */
export const TROPHY_SCALE = 0.5;
/** The pedestal (px): a cap TROPHY_PEDESTAL_W wide over a narrower shaft, PEDESTAL_H tall. */
export const PEDESTAL_W = 12;
export const PEDESTAL_H = 5;
/** The pedestal's stone (light cap, its shadow, the shaft's face), outlined in PEDESTAL_EDGE. */
export const PEDESTAL_STONE: readonly string[] = ['#d8d8d8', '#8c8c8c', '#b0b0b0'];
export const PEDESTAL_EDGE = '#202020';
/** Hops in the burst the first time a trophy shows after its hero is freed. */
export const TROPHY_BURST_HOPS = 3;

/** One frame of a trophy: how far up it is, whether it is in the air, and its sparkle (or none). */
export interface TrophyPose {
  /** Pixels above its feet's rest row. */
  lift: number;
  /** In the air: drawn in the hero's jump frame. */
  airborne: boolean;
  /** The sparkle's size (1: a small twinkle on the statue), 0 for none. */
  sparkle: number;
}

/** Lift at frame `k` of a hop (0 ≤ k < TROPHY_HOP_FRAMES): a parabola up to TROPHY_HOP_PX. */
export function hopLift(k: number): number {
  if (k <= 0 || k >= TROPHY_HOP_FRAMES) return 0;
  const u = k / TROPHY_HOP_FRAMES;
  return Math.round(TROPHY_HOP_PX * 4 * u * (1 - u));
}

/**
 * The trophy at map frame `t`. `phase` staggers heroes so they never hop together; `burstFrom`
 * is the frame its freed burst began (null: none).
 */
export function trophyPose(
  t: number,
  phase: number,
  burstFrom: number | null,
  reduceFlashing: boolean,
): TrophyPose {
  let k: number;
  if (burstFrom !== null && t >= burstFrom && t - burstFrom < TROPHY_BURST_HOPS * TROPHY_HOP_FRAMES)
    k = (t - burstFrom) % TROPHY_HOP_FRAMES;
  else k = (((t + phase) % TROPHY_HOP_EVERY) + TROPHY_HOP_EVERY) % TROPHY_HOP_EVERY;
  const lift = hopLift(k);
  const airborne = k > 0 && k < TROPHY_HOP_FRAMES;
  // Around the top of the hop a sparkle twinkles over the hero's head.
  const top = Math.abs(k - TROPHY_HOP_FRAMES / 2);
  const sparkle = !airborne || reduceFlashing || top > TROPHY_HOP_FRAMES / 4 ? 0 : 1;
  return { lift, airborne, sparkle };
}
