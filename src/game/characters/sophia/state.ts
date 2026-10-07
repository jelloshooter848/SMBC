import { sfx as SFX_LIB } from '@content/sfx/sfx';
import type { Player } from '../../entities/player';
import { HOVER_CELLS } from './profile';

/**
 * Which surface Sophia III drives on. FLOOR also covers the air (upright); LEFT is a wall on her
 * left (its face at her box's left edge), RIGHT a wall on her right, CEIL a ceiling over her.
 */
export const FLOOR = 0;
export const LEFT = 1;
export const RIGHT = 2;
export const CEIL = 3;
export type Surface = typeof FLOOR | typeof LEFT | typeof RIGHT | typeof CEIL;

/** A corner turn in progress: she does not move and inputs are locked (SO-8, SO-36). */
export interface Turn {
  t: number;
  frames: number;
  to: Surface;
  /** Her box centre at the start and at the end (subpixels). */
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Heading along the new surface (+1: right or down) and the speed she leaves the turn at. */
  dir: -1 | 1;
  speed: number;
  /** Turning back upright onto the floor (the box swaps at the midpoint). */
}

/**
 * A push off a surface at a constant speed with gravity off: the jump's rise from the floor (and
 * in water), the wall jump's push away from a wall, the ceiling jump's push down (SO-13, SO-36).
 */
export interface Push {
  dx: -1 | 0 | 1;
  dy: -1 | 0 | 1;
  /** Where along the push axis it started (subpixels: the box's x or y). */
  from: number;
  limit: number;
}

/** Everything about one Sophia III player that does not travel to the next area. */
export interface SophiaState {
  surface: Surface;
  /** On a wall or ceiling: attached (false during a wall jump's push, still in the wall pose). */
  attached: boolean;
  /** Heading along the surface: +1 right (floor, ceiling) or down (walls). */
  dir: -1 | 1;
  turn: Turn | null;
  /** Frames of the take-off squat left (0: none). */
  squat: number;
  push: Push | null;
  /** Jump let go since the take-off (the coast damps harder). */
  released: boolean;
  /** Coasting up after a jump's rise. */
  coasting: boolean;
  /** Hover engaged since the take-off (no head bumps, no ceiling grip until she lands). */
  engaged: boolean;
  /** Thrusting this frame. */
  hovering: boolean;
  cells: number;
  drainT: number;
  fillT: number;
  /** Frames "up" (away from the surface) has been held: the cannon is up at CANNON_RAISE_FRAMES. */
  raise: number;
  /** The world's water line (World.waterTop), kept from the last behaviour update. */
  waterTop: number;
  /** The frame (view) her death explosion started, for the sprite. */
  boomFrom: number;
  /**
   * On a vine (or getting on one): she is turned nose up there, so her box is the wall pose's
   * 15.5 × 19, which fits the one-tile holes vines and chains climb through.
   */
  vineBox: boolean;
  /** Frames the drive animation has run (wheels). */
  roll: number;
  /** Jason on foot: the parked tank (jason.ts). */
  jason: JasonOut | null;
}

/** Jason out of the tank. `tank` is the ParkedTank entity left behind. */
export interface JasonOut {
  tank: { alive: boolean; body: { x: number; y: number; w: number; h: number }; destroy(): void };
  /** The highest his feet got since he last stood (subpixels): the fall-damage check. */
  peak: number;
  /** Was on the ground last frame (landing check). */
  grounded: boolean;
  /** Frames before he can climb back in (the hop out). */
  lock: number;
}

const STATES = new WeakMap<Player, SophiaState>();

export function sophiaState(p: Player): SophiaState {
  let s = STATES.get(p);
  if (!s) {
    s = {
      surface: FLOOR,
      attached: false,
      dir: p.facing,
      turn: null,
      squat: 0,
      push: null,
      released: false,
      coasting: false,
      engaged: false,
      hovering: false,
      cells: HOVER_CELLS,
      drainT: 0,
      fillT: 0,
      raise: 0,
      waterTop: Infinity,
      boomFrom: -1,
      roll: 0,
      vineBox: false,
      jason: null,
    };
    STATES.set(p, s);
  }
  return s;
}

const hasSfx = (id: string): boolean => SFX_LIB.some((x) => x.id === id);
/** A Sophia sound (S3's), or the stand-in the spec names (SO-54) until it exists. */
const sound = (id: string, fallback: string): string => (hasSfx(id) ? id : fallback);

export const SOUNDS = {
  jump: sound('sophia-jump', 'jump-big'),
  land: sound('sophia-land', 'bump'),
  shoot: [
    sound('sophia-shoot-normal', sound('sophia-cannon', 'fireball')),
    sound('sophia-shoot-hyper', sound('sophia-cannon', 'fireball')),
    sound('sophia-shoot-crusher', sound('sophia-cannon', 'fireball')),
  ],
  missile: sound('sophia-missile', 'missile'),
  explode: sound('sophia-explode', 'bump'),
  kill: sound('sophia-kill', sound('mutant-die', 'stomp')),
  hover: sound('sophia-hover', 'swim'),
  hurt: sound('sophia-hurt', 'pipe'),
  select: sound('sophia-select', 'select'),
  pickup: sound('sophia-pickup', 'coin'),
  open: sound('sophia-open', 'pipe'),
  jasonShot: sound('jason-shot', 'buster'),
  jasonJump: sound('jason-jump', 'jump-small'),
} as const;
