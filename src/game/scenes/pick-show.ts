/**
 * Classic mode's pick performances (G-055; CharacterSelect.as 55, 189 and each hero's
 * chooseCharacter): a picked hero acts out a move in its select cell, and the select waits its
 * CHAR_SEL_END_DUR before the game goes on. Ours are drawn with the hero's own standing art; a
 * fresh OK or BACK press skips the wait (every scene is skippable). Reduce flashing holds the
 * flashing ones steady.
 *
 * The moves, as the original's heroes act them: Mario hits a hidden block (a hop), Luigi jumps a
 * brick column (a high hop), Link raises his arms, Samus sinks on a platform, Simon whips (a
 * lunge), Mega Man teleports away, Bass dash-jumps, Bill flashes, Ryu clings to a wall, and
 * Jason hops out of Sophia (a hop).
 */
export type PickMove =
  'hop' | 'high' | 'raise' | 'sink' | 'lunge' | 'teleport' | 'dashjump' | 'flash' | 'cling';

/** Each slot hero's move and wait (CHAR_SEL_END_DUR, ms), by select-slot hero id. */
export const PICK_SHOWS: Readonly<Record<string, { move: PickMove; ms: number }>> = {
  mario: { move: 'hop', ms: 1700 },
  luigi: { move: 'high', ms: 2000 },
  link: { move: 'raise', ms: 1700 },
  samus: { move: 'sink', ms: 2000 },
  simon: { move: 'lunge', ms: 2000 },
  megaman: { move: 'teleport', ms: 1700 },
  bass: { move: 'dashjump', ms: 1700 },
  bill: { move: 'flash', ms: 1950 },
  ryu: { move: 'cling', ms: 1900 },
  sophia: { move: 'hop', ms: 2000 },
};

/** Any other hero (the Expansion heroes, a stand-in): a hop, 1700 ms (the original's most common). */
export const DEFAULT_PICK_SHOW = { move: 'hop', ms: 1700 } as const satisfies { move: PickMove; ms: number };

/** Frames a fresh press is ignored for at the start, so the pick's own press never skips it. */
export const PICK_SHOW_GUARD = 8;

export function pickShowOf(slotId: string): { move: PickMove; ms: number } {
  return PICK_SHOWS[slotId] ?? DEFAULT_PICK_SHOW;
}

/** The wait in 60 fps frames. */
export function pickShowFrames(slotId: string): number {
  return Math.round((pickShowOf(slotId).ms * 60) / 1000);
}

/** A hop of `h` px over `d` frames, from t (frames), then still. */
function hop(t: number, h: number, d: number): number {
  if (t >= d) return 0;
  return -Math.round((4 * h * t * (d - t)) / (d * d));
}

/**
 * Where the hero's art is drawn at frame `t` of move `m` (px from its place in the cell), whether
 * it shows, and the pose it takes where the move has one (`raise`: Link's raised arms).
 */
export function pickPose(
  m: PickMove,
  t: number,
  reduceFlashing: boolean,
): { dx: number; dy: number; shown: boolean; pose?: 'raise' } {
  switch (m) {
    case 'hop':
      return { dx: 0, dy: hop(t, 8, 24), shown: true };
    case 'high':
      return { dx: 0, dy: hop(t, 14, 36), shown: true };
    case 'raise':
      return { dx: 0, dy: 0, shown: true, ...(t >= 6 ? { pose: 'raise' as const } : {}) };
    case 'sink':
      return { dx: 0, dy: Math.min(10, Math.floor(t / 8)), shown: true };
    case 'lunge':
      return { dx: t % 30 < 10 ? 2 : 0, dy: 0, shown: true };
    case 'teleport': {
      // He stands a moment, then beams straight up out of the cell.
      const up = Math.max(0, t - 30) * 4;
      return { dx: 0, dy: up === 0 ? 0 : -up, shown: up < 48 };
    }
    case 'dashjump':
      return { dx: Math.min(8, Math.floor(t / 3)), dy: hop(t, 10, 30), shown: true };
    case 'flash':
      return { dx: 0, dy: 0, shown: reduceFlashing || ((t >> 2) & 1) === 0 };
    case 'cling':
      return { dx: Math.min(6, Math.floor(t / 2)), dy: -Math.min(10, Math.floor(t / 3)), shown: true };
  }
}
