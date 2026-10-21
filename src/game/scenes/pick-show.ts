/**
 * Classic mode's pick performances (G-055; CharacterSelect.as 55, 189 and each hero's
 * chooseCharacter): a picked hero acts out a move, and the select waits its CHAR_SEL_END_DUR
 * before the game goes on. As in the original, whose select is a level (9-1a) with the hero
 * standing on its ground, the whole hero acts it out on the ground under the name box, never
 * clipped by a cell (RC-007), with its own frames where it has them. A fresh OK or BACK press
 * skips the wait (every scene is skippable). Reduce flashing holds the flashing ones steady.
 *
 * The moves, as the original's heroes act them: Mario hops up and hits a block over his head,
 * Luigi jumps high, Link raises his arms, Samus sinks on a platform, Simon cracks his whip, Mega
 * Man teleports away, Bass dash-jumps, Bill flashes, Ryu jumps to a wall and clings to it, and
 * Jason hops out of Sophia.
 */
export type PickMove =
  | 'hop'
  | 'block'
  | 'high'
  | 'raise'
  | 'sink'
  | 'whip'
  | 'teleport'
  | 'dashjump'
  | 'flash'
  | 'cling'
  | 'jason';

/** Each slot hero's move and wait (CHAR_SEL_END_DUR, ms), by select-slot hero id. */
export const PICK_SHOWS: Readonly<Record<string, { move: PickMove; ms: number }>> = {
  mario: { move: 'block', ms: 1700 },
  luigi: { move: 'high', ms: 2000 },
  link: { move: 'raise', ms: 1700 },
  samus: { move: 'sink', ms: 2000 },
  simon: { move: 'whip', ms: 2000 },
  megaman: { move: 'teleport', ms: 1700 },
  bass: { move: 'dashjump', ms: 1700 },
  bill: { move: 'flash', ms: 1950 },
  ryu: { move: 'cling', ms: 1900 },
  sophia: { move: 'jason', ms: 2000 },
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
 * A frame of the hero's own sheet the move shows (resolved against the hero's standing frame:
 * `jump` is `small-jump` for small Mario), when the sheet has it; else the standing art.
 */
export type PickFrame = 'jump' | 'whip-0' | 'whip-1' | 'whip' | 'cling' | 'teleport' | 'open';

/** Mario's block over his head: how far it is bumped up (px) and whether it is used. */
export const BLOCK_HOP = 8;
/** Frame of Mario's hop at which his head hits the block (its peak). */
export const BLOCK_HIT = 12;

/** Ryu's wall: how far right of his start it stands (px from the hero's centre to its left edge). */
export const CLING_WALL_DX = 14;

/** Jason's feet start 8 px into the open hatch and land this far lower, on the ground (a 32 px tank). */
export const JASON_LAND = 24;

export interface PickPose {
  /** Where the hero's art is drawn (px from where it stands). */
  dx: number;
  dy: number;
  shown: boolean;
  /** `raise`: Link's raised arms (a frame of his where he has one). */
  pose?: 'raise';
  frame?: PickFrame;
  /** Mario: the block over his head, bumped `dy` px up, used once hit. */
  block?: { dy: number; used: boolean };
  /** Ryu: the wall he clings to. */
  wall?: true;
  /** Sophia: Jason's feet, `dx`/`dy` px from 8 px under the tank's top, airborne or standing. */
  jason?: { dx: number; dy: number; air: boolean };
  /** Samus: only what is above the ground shows (the platform sinks). */
  clip?: true;
}

/** Where and how the picked hero is drawn at frame `t` of move `m`. */
export function pickPose(m: PickMove, t: number, reduceFlashing: boolean): PickPose {
  switch (m) {
    case 'hop':
    case 'block': {
      const dy = hop(t, BLOCK_HOP, 24);
      const pose: PickPose = { dx: 0, dy, shown: true, ...(dy < 0 ? { frame: 'jump' as const } : {}) };
      if (m === 'block')
        pose.block = {
          dy: t >= BLOCK_HIT && t < BLOCK_HIT + 6 ? -Math.min(3, t - BLOCK_HIT + 1) : 0,
          used: t >= BLOCK_HIT,
        };
      return pose;
    }
    case 'high': {
      const dy = hop(t, 14, 36);
      return { dx: 0, dy, shown: true, ...(dy < 0 ? { frame: 'jump' as const } : {}) };
    }
    case 'raise':
      return { dx: 0, dy: 0, shown: true, ...(t >= 6 ? { pose: 'raise' as const } : {}) };
    case 'sink':
      return { dx: 0, dy: Math.min(10, Math.floor(t / 8)), shown: true, clip: true };
    case 'whip': {
      // Wind-up, swing, then the lash held out; again every 40 frames.
      const k = t % 40;
      const frame: PickFrame | undefined = k < 6 ? 'whip-0' : k < 10 ? 'whip-1' : k < 26 ? 'whip' : undefined;
      return { dx: 0, dy: 0, shown: true, ...(frame ? { frame } : {}) };
    }
    case 'teleport': {
      // He stands a moment, then beams straight up and away.
      const up = Math.max(0, t - 30) * 4;
      return {
        dx: 0,
        dy: up === 0 ? 0 : -up,
        shown: up < 64,
        ...(up > 0 ? { frame: 'teleport' as const } : {}),
      };
    }
    case 'dashjump':
      return { dx: Math.min(8, Math.floor(t / 3)), dy: hop(t, 10, 30), shown: true };
    case 'flash':
      return { dx: 0, dy: 0, shown: reduceFlashing || ((t >> 2) & 1) === 0 };
    case 'cling': {
      // A jump up and right to the wall, then he clings to it.
      const k = Math.min(1, t / 18);
      const at = t >= 18;
      return {
        dx: Math.round(6 * k),
        dy: -Math.round(14 * k),
        shown: true,
        frame: at ? 'cling' : 'jump',
        wall: true,
      };
    }
    case 'jason': {
      // The hatch opens, and Jason hops out of it and lands beside the tank.
      const out = t - 10;
      if (out < 0) return { dx: 0, dy: 0, shown: true, ...(t >= 4 ? { frame: 'open' as const } : {}) };
      const d = 30;
      const k = Math.min(1, out / d);
      return {
        dx: 0,
        dy: 0,
        shown: true,
        frame: 'open',
        jason: {
          dx: Math.round(26 * k),
          dy: out < d ? hop(out, 16, d) + Math.round(JASON_LAND * k) : JASON_LAND,
          air: out < d,
        },
      };
    }
  }
}
