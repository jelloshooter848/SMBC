import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';

/**
 * PLACEHOLDER art for Sophia III and Jason (SO-53: simple shapes), registered as the `sophia`
 * sheet until the real sheet (agent S3, `src/content/sprites/sophia.ts`) replaces it. Frame
 * names and sizes are the contract the character code draws from (src/game/characters/sophia):
 *
 * - Tank frames are 26×26, facing right, **centred on the tank's middle** (rotation-ready: the
 *   game turns them a quarter turn for walls and flips them for a ceiling around the frame's
 *   centre, which sits on the hitbox's centre). The hull and wheels fill rows 5-20, so the wheels'
 *   bottom is the hitbox's bottom when upright; rows 0-4 are for the raised cannon, rows 21-25
 *   for hover flames. Frames: `idle`, `drive-0..3`, `jump`, `hover-0/1`, `open`, `aim-diag`,
 *   `aim-up`, `swim-0/1`.
 * - Jason (side view) is 16×16 over his 8×16 body: `jason-stand`, `jason-walk-0..2`,
 *   `jason-jump`, `jason-climb-0/1`, `jason-hurt`, `jason-die`; his shot `jason-shot` (4×4).
 * - Shots: `cannon-0..2` (Normal, Hyper, Crusher), `missile` (10×4, nose right), `homing-0/1`
 *   (8×8); explosions `boom-0..3` (16×16); HUD icons (8×8) `icon-cannon`, `icon-triple`,
 *   `icon-homing`, `icon-exit`; `hover-cell` (4×4).
 *
 * Palette roles (every palette the same layout, so recolours are plain index swaps):
 *   0 outline   1 hull (the power state's colour)   2 wheels, barrel (dark grey)
 *   3 white (cockpit frame, Jason's helmet)   4 glass (light blue)   5 flame (orange)
 *   6 flame core, shots (yellow)   7 Jason's suit (blue)   8 skin
 */
const PAL = (hull: string): string[] => [
  NES.black,
  hull,
  NES.darkGray,
  NES.white,
  NES.blueLight,
  NES.orange,
  NES.yellow,
  NES.blueMid,
  NES.skin,
];

export const sophiaPlaceholderPalettes: Record<string, string[]> = {
  sophia: PAL('#e44a85'),
  'sophia-hyper': PAL(NES.red),
  'sophia-crusher': PAL('#b10000'),
  'sophia-star-0': PAL(NES.yellow),
  'sophia-star-1': PAL(NES.cyan),
  'sophia-star-2': PAL(NES.greenLight),
  'sophia-star-3': PAL(NES.white),
  // Hit flashes (SO-23): the hull cycles through three colours every 2 frames.
  'sophia-hurt-0': PAL('#f87858'),
  'sophia-hurt-1': PAL(NES.gray),
  'sophia-hurt-2': PAL('#00a844'),
};

type Grid = string[][];
const grid = (w: number, h: number): Grid => Array.from({ length: h }, () => Array<string>(w).fill('.'));
const rect = (g: Grid, x: number, y: number, w: number, h: number, c: string): void => {
  for (let j = y; j < y + h; j++) for (let i = x; i < x + w; i++) if (g[j]?.[i] !== undefined) g[j]![i] = c;
};
const dot = (g: Grid, x: number, y: number, c: string): void => rect(g, x, y, 1, 1, c);
/** A 1-px black outline round everything drawn (4-neighbours). */
function outline(g: Grid): Grid {
  const out = g.map((r) => [...r]);
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < (g[0]?.length ?? 0); x++) {
      if (g[y]![x] !== '.') continue;
      const n = [g[y - 1]?.[x], g[y + 1]?.[x], g[y]![x - 1], g[y]![x + 1]];
      if (n.some((c) => c !== undefined && c !== '.' && c !== '0')) out[y]![x] = '0';
    }
  return out;
}
const rows = (g: Grid): string[] => g.map((r) => r.join(''));

/** A wheel (6×6) at (x, y) with its hub mark turned `spin` steps. */
function wheel(g: Grid, x: number, y: number, spin: number): void {
  rect(g, x + 1, y, 4, 6, '2');
  rect(g, x, y + 1, 6, 4, '2');
  const marks = [
    [2, 1],
    [4, 2],
    [3, 4],
    [1, 3],
  ][spin & 3] as [number, number];
  dot(g, x + marks[0], y + marks[1], '3');
}

type Barrel = 'ahead' | 'diag' | 'up';
function tank(opts: {
  spin?: number;
  drop?: number;
  barrel?: Barrel;
  flame?: 0 | 1 | 2;
  open?: boolean;
  prop?: number;
}): string[] {
  const g = grid(26, 26);
  const drop = opts.drop ?? 0;
  // Hull (rows 11-15) and the cockpit dome on it (rows 7-10).
  rect(g, 2, 11, 22, 4, '1');
  rect(g, 4, 15, 18, 1, '1');
  rect(g, 8, 7, 9, 4, '1');
  rect(g, 9, 8, 7, 2, '3');
  rect(g, 12, 8, 3, 2, '4');
  if (opts.open) {
    rect(g, 9, 5, 7, 1, '3');
    rect(g, 9, 8, 7, 2, '2');
  }
  const barrel = opts.barrel ?? 'ahead';
  if (barrel === 'ahead') rect(g, 17, 8, 8, 2, '2');
  else if (barrel === 'diag') for (let i = 0; i < 6; i++) rect(g, 16 + i, 7 - i, 2, 2, '2');
  else rect(g, 12, 0, 2, 7, '2');
  // Wheels (rows 15-20), dropped in a jump.
  wheel(g, 3, 15 + drop, opts.spin ?? 0);
  if (opts.prop !== undefined) {
    // The back wheel turned propeller (under water).
    rect(g, 3, 17 + drop, 6, 2, '3');
    rect(g, 5 + (opts.prop & 1), 15 + drop, 2, 6, '3');
  } else wheel(g, 17, 15 + drop, opts.spin ?? 0);
  if (opts.flame) {
    const h = opts.flame === 1 ? 4 : 2;
    for (const x of [4, 18]) {
      rect(g, x, 21, 4, h, '5');
      rect(g, x + 1, 21, 2, h - 1, '6');
    }
  }
  return rows(outline(g));
}

/** Jason: 16×16 over his 8×16 body (columns 4-11), facing right. */
function jason(
  pose: 'stand' | 'walk0' | 'walk1' | 'walk2' | 'jump' | 'climb0' | 'climb1' | 'hurt',
): string[] {
  const g = grid(16, 16);
  // Helmet with a visor, the suit, boots.
  rect(g, 5, 0, 6, 5, '3');
  rect(g, 8, 2, 3, 2, '4');
  rect(g, 5, 5, 6, 6, '7');
  const legs: Record<string, [number, number]> = {
    stand: [5, 8],
    walk0: [4, 9],
    walk1: [5, 8],
    walk2: [6, 7],
    jump: [4, 9],
    climb0: [5, 8],
    climb1: [5, 8],
    hurt: [4, 9],
  };
  const [l, r] = legs[pose] as [number, number];
  rect(g, l, 11, 2, 3, '7');
  rect(g, r, 11, 2, 3, '7');
  rect(g, l, 14, 3, 2, '2');
  rect(g, r, 14, 3, 2, '2');
  if (pose === 'climb0' || pose === 'climb1') {
    const up = pose === 'climb0' ? 0 : 1;
    rect(g, 4, 1 + up, 2, 5, '8');
    rect(g, 10, 2 - up, 2, 5, '8');
  } else {
    // Arm and gun forward.
    rect(g, 9, 6, 3, 2, '8');
    rect(g, 11, 6, 3, 1, '2');
  }
  if (pose === 'hurt') rect(g, 5, 0, 6, 1, '6');
  return rows(outline(g));
}

function jasonDie(): string[] {
  const g = grid(16, 16);
  rect(g, 1, 11, 4, 4, '3');
  rect(g, 5, 11, 7, 4, '7');
  rect(g, 12, 12, 3, 3, '2');
  return rows(outline(g));
}

function boom(r: number): string[] {
  const g = grid(16, 16);
  for (let y = 0; y < 16; y++)
    for (let x = 0; x < 16; x++) {
      const d = Math.hypot(x - 7.5, y - 7.5);
      if (d <= r) dot(g, x, y, d < r - 2 ? '6' : '5');
    }
  return rows(g);
}

function shot(w: number, h: number): string[] {
  const g = grid(w, h);
  rect(g, 1, 1, w - 2, h - 2, '6');
  rect(g, 0, 1, 1, h - 2, '5');
  return rows(outline(g));
}

function icon(kind: 'cannon' | 'triple' | 'homing' | 'exit'): string[] {
  const g = grid(8, 8);
  if (kind === 'cannon') {
    rect(g, 1, 4, 5, 3, '1');
    rect(g, 4, 2, 4, 2, '2');
  } else if (kind === 'triple') {
    for (const y of [1, 4, 7]) rect(g, 1, y - 1, 6, 1, '6');
  } else if (kind === 'homing') {
    rect(g, 2, 2, 4, 4, '6');
    rect(g, 3, 3, 2, 2, '5');
  } else {
    rect(g, 2, 0, 4, 3, '3');
    rect(g, 2, 3, 4, 4, '7');
  }
  return rows(g);
}

export const sophiaPlaceholderDef: SpriteDef = {
  palette: 'sophia',
  frames: {
    idle: tank({}),
    'drive-0': tank({ spin: 0 }),
    'drive-1': tank({ spin: 1 }),
    'drive-2': tank({ spin: 2 }),
    'drive-3': tank({ spin: 3 }),
    jump: tank({ drop: 1 }),
    'hover-0': tank({ drop: 1, flame: 1 }),
    'hover-1': tank({ drop: 1, flame: 2 }),
    open: tank({ open: true }),
    'aim-diag': tank({ barrel: 'diag' }),
    'aim-up': tank({ barrel: 'up' }),
    'swim-0': tank({ prop: 0 }),
    'swim-1': tank({ prop: 1 }),
    'jason-stand': jason('stand'),
    'jason-walk-0': jason('walk0'),
    'jason-walk-1': jason('walk1'),
    'jason-walk-2': jason('walk2'),
    'jason-jump': jason('jump'),
    'jason-climb-0': jason('climb0'),
    'jason-climb-1': jason('climb1'),
    'jason-hurt': jason('hurt'),
    'jason-die': jasonDie(),
    'jason-shot': ['.66.', '6666', '6666', '.66.'],
    'cannon-0': shot(6, 4),
    'cannon-1': shot(8, 6),
    'cannon-2': shot(10, 6),
    missile: shot(10, 4),
    'homing-0': shot(8, 8),
    'homing-1': shot(8, 8).map((r) => r.replace(/6/g, '5')),
    'boom-0': boom(3),
    'boom-1': boom(5),
    'boom-2': boom(7),
    'boom-3': boom(8).map((r) => r.replace(/6/g, '.')),
    'icon-cannon': icon('cannon'),
    'icon-triple': icon('triple'),
    'icon-homing': icon('homing'),
    'icon-exit': icon('exit'),
    'hover-cell': ['5555', '5665', '5665', '5555'],
  },
};
