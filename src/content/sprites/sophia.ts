import { NES } from '@engine/gfx/palette';
import type { SpriteDef } from '@engine/gfx/pixelart';
import { Canvas, LETTERS, draw, flipX, hash, recolour, rotate, turnCw, type Rows } from './sophia-draw';

/**
 * Sophia III's sheet: the tank, Jason (side view and overhead), Fred the frog, the Underworld's
 * mutants (side view and overhead), the Plutonium Boss in two phases, the opening cutscene's
 * pieces, shots, blasts, icons and the hover meter. Original 8-bit art in the spirit of an NES
 * tank-and-dungeon game; most frames are built from shapes (sophia-draw.ts) so they stay exact,
 * the small ones are drawn by hand. Nothing is traced.
 *
 * Conventions the game relies on:
 * - **The tank** (`idle`, `drive-0..3`, `jump`, `hover-0/1`, `open`, `aim-diag`, `aim-up`,
 *   `turn-0..2`, `tilt-up`, `tilt-down`, `die-0..3`) is 32x32 and faces RIGHT (flip for left).
 *   The frame's centre (16, 16) is the centre of her 19x15.5 box: upright, the box spans
 *   x 6.5-25.5 and y 8.25-23.75 of the frame, and the wheels stand on row 23 (the box's bottom).
 *   Draw the frame at (box centre - 16) and it lines up; the hull is 26 px wide (x 3-28).
 * - **Walls and ceilings: rotate the upright frame about its centre, clockwise by `rotate`**
 *   (canvas `rotate`, the box centre staying put):
 *     0   floor, wheels down;
 *     90  wheels on the LEFT (a wall on her left), the nose pointing DOWN when she faced right;
 *     180 ceiling, wheels up (she reads upside down; 180 = flipX + flipY);
 *     270 wheels on the RIGHT (a wall on her right), the nose pointing UP when she faced right.
 *   A flip for facing left is applied before the rotation. `tilt-up` (nose 45 degrees up) and
 *   `tilt-down` (nose 45 degrees down) are the corner frames; rotated by the same steps they
 *   cover every one of the eight turns (floor to wall, wall to ceiling, and back, inside or
 *   outside corners). One corner frame per turn, then snap (SO-51, SO-M2).
 * - `drive-0..3` roll the wheels (the back wheel a step behind) and bob the hull 1 px on 1 and 3;
 *   `idle` is `drive-0`. `jump` drops the wheels 4 px on their struts; `hover-0/1` add the jets
 *   under the wheels (big, small). The jets' yellow, orange and red are not hull colours, so
 *   they keep their colour in every hull palette.
 * - `aim-diag` raises the cannon 45 degrees; `aim-up` lifts the hull 4 px, tucks the wheels in
 *   and points the barrel straight up (the raised-shot spawn is the muzzle, top of the frame).
 * - `turn-0` is three-quarter, `turn-1` head-on, `turn-2` three-quarter the other way: play
 *   0, 1, 2 to turn from right to left, then draw `idle` flipped.
 * - `open` is the hatch thrown back with Jason's helmet showing (he hops in and out).
 * - `wheel-0..3` (8x8) are the wheels alone, for anyone composing the parts.
 * - Shots face RIGHT and are centred: `cannon-0..2` (Normal, Hyper, Crusher), `missile-0/1`
 *   (`missile` is `missile-0`; its jet flickers), `homing-0/1` (round, so any heading reads),
 *   `jason-shot`, `gun-shot-0..2` (Jason's overhead gun: low, mid, the top-level ring),
 *   `grenade-0/1`, `boss-shot-0/1`, `boss-shot-big`.
 * - `boom-0..3` (24x24) a shot's or a mutant's blast, centred: flash, ball, burst, smoke.
 *   `die-0..3` (32x32) the tank blowing up, centred on the tank's frame.
 * - **Jason, side view** (16x16, faces RIGHT, feet on row 15, about 10 px wide, his 8x16 box at
 *   x 4-11): `jason-stand`, `jason-walk-0..2`, `jason-jump`, `jason-climb-0/1` (his back, hands
 *   up in turn), `jason-hurt`, `jason-die` (flat on the floor).
 * - **Jason, overhead** (16x16): `jason-o-{down,up,left,right}-0/1` (two steps) and
 *   `jason-o-shoot-{down,up,left,right}`, gun out.
 * - **Fred** (16x16, faces RIGHT, sits on row 15): `fred-0` sitting, `fred-1` leaping, `fred-2`
 *   swimming (legs kicking back). `fred-big` (32x32) is the mutated frog of the opening.
 * - **Mutants, side view** (16x16, face LEFT, stand on row 15): `crawler-0/1`, `hopper-0`
 *   crouched / `-1` leaping, `flyer-0/1` wings up / down (it flies, so any row).
 * - **Mutants, overhead** (16x16): `blob-0/1` (squash and stretch), `eye-0/1` (open, half shut),
 *   `turret-o-0..3` aiming down, left, up, right (k quarter turns clockwise from down).
 * - **The Plutonium Boss** (64x64, overhead, facing DOWN at the player): phase one
 *   `boss-a-0/1`, armoured shell, its vents shut / glowing open (it fires from the vents);
 *   phase two `boss-b-0/1`, the shell cracked away and its glowing core beating (small / big).
 * - **The opening**: `cut-chest` (32x24) the glowing chest, `cut-hole` (48x16) the hole in the
 *   ground, `cut-fred-jump` (16x16) Fred diving head first, `cut-jason` (16x24) Jason in his
 *   jacket, running right.
 * - Pickups and HUD: `gun-capsule` and `pow-capsule` (16x16), `ammo-triple` and `ammo-homing`
 *   (16x16 drops), `icon-cannon`, `icon-triple`, `icon-homing`, `icon-exit` (16x16),
 *   `hover-cell` / `hover-cell-empty` (8x4, one of the hover meter's 8 cells, stacked upward).
 * - `ladder` / `ladder-top` (16x16): the Underworld's ladders. A climbable vine in a level
 *   themed `underworld` is drawn with them (vine.ts).
 */

/**
 * `sophia` index roles (the same in every palette below):
 *   0 outline          1 hull           2 hull shade       3 hull light       4 white
 *   5 steel light      6 steel          7 steel dark       8 glass light      9 glass
 *   a jet yellow       b jet orange     c jet red          d suit             e suit shade
 *   f skin             g frog           h frog light       i frog dark        j mutant
 *   k mutant light     l mutant dark    m eye gold         n plutonium glow   o glow mid
 *   p glow dark        q rust           r brown dark       s bone             t blood red
 *   u crimson dark
 * Only 1-3 (the hull) change between the power states and the hit flashes; the stars also
 * recolour Jason's suit.
 */
const HULL: Record<string, readonly [string, string, string]> = {
  // Normal, Hyper and Crusher (SO-22): pink, magenta, red.
  sophia: ['#e44a85', '#a8105c', '#f8a4c0'],
  'sophia-hyper': ['#e40058', '#880030', '#f878a8'],
  'sophia-crusher': ['#b10000', '#600000', NES.redBright],
  // The hit flashes cycle every 2 frames (SO-23): orange, grey, green. Black stays black.
  'sophia-flash-0': ['#f87858', '#f87858', '#f8b7a6'],
  'sophia-flash-1': [NES.gray, NES.gray, NES.white],
  'sophia-flash-2': ['#00a844', '#00a844', '#b8f8d8'],
};

const sophiaBase = ([hull, shade, light]: readonly [string, string, string]): string[] => [
  NES.black,
  hull,
  shade,
  light,
  NES.white,
  NES.lightGray,
  NES.gray,
  NES.darkGray,
  NES.blueLight,
  '#0058f8',
  NES.yellowLight,
  NES.orange,
  NES.redBright,
  '#0078f8',
  NES.blueDark,
  NES.skin,
  NES.green,
  NES.greenLight,
  NES.greenDark,
  '#8c3cc8',
  '#c884f8',
  '#480c78',
  NES.yellow,
  NES.greenLight,
  NES.greenMid,
  NES.greenDark,
  NES.brown,
  NES.brownDark,
  NES.tan,
  NES.red,
  NES.redDark,
];

/** The star cycle: hull, shade, light, suit, suit shade. */
const STAR: readonly (readonly [string, string, string, string, string])[] = [
  [NES.yellow, NES.orange, NES.yellowLight, NES.redBright, NES.redDark],
  [NES.cyan, NES.blueLight, NES.white, NES.pink, NES.magenta],
  [NES.greenLight, NES.green, NES.white, NES.purple, NES.blueUnderground],
  [NES.white, NES.lightGray, NES.white, NES.yellow, NES.brown],
];

/** A mutant struck: every colour but the outline blanches (skipped with reduce flashing). */
const blanch = (p: readonly string[]): string[] =>
  p.map((c, i) => (i === 0 ? c : i % 2 ? NES.white : NES.lightGray));

/** The Plutonium Boss enraged (phase two's beat, or hurt): its glow runs hot red and gold. */
const hot = (p: readonly string[]): string[] =>
  p.map((c, i) => ({ 23: NES.yellowLight, 24: NES.redBright, 25: NES.redDark })[i] ?? c);

export const sophiaPalettes: Record<string, string[]> = {
  ...Object.fromEntries(Object.entries(HULL).map(([name, hull]) => [name, sophiaBase(hull)])),
  ...Object.fromEntries(
    STAR.map(([a, b, c, d, e], k) => {
      const p = sophiaBase([a, b, c]);
      p[13] = d;
      p[14] = e;
      return [`sophia-star-${k}`, p];
    }),
  ),
  'sophia-hit': blanch(sophiaBase(HULL.sophia as readonly [string, string, string])),
  'plutonium-hot': hot(sophiaBase(HULL.sophia as readonly [string, string, string])),
};

/* ---------- the tank ---------- */

/** One wheel (8x8): a dark tyre with treads that turn a step per phase, a light hub. */
const wheel = (phase: number): string[] =>
  draw(8, 8, (x, y) => {
    const dx = x + 0.5 - 4;
    const dy = y + 0.5 - 4;
    const d = Math.hypot(dx, dy);
    if (d > 4.05) return '.';
    if (d > 3.2) return '0';
    if (d > 2.0) {
      const a = Math.atan2(dy, dx) / (2 * Math.PI) + 0.5;
      return Math.floor(a * 8 + phase / 2) % 2 ? '6' : '7';
    }
    if (d > 1.1) return '5';
    return '7';
  });

interface TankPose {
  /** Wheel phase 0-3 (the back wheel runs one behind). */
  phase?: number;
  /** Hull drop in px (the suspension bob). */
  bob?: number;
  /** Wheels hang this far below their rest (4 in a jump or hover). */
  drop?: number;
  /** The jets under the wheels: 0 none, 1 big, 2 small. */
  jet?: 0 | 1 | 2;
  aim?: 'horz' | 'diag' | 'up';
  hatch?: boolean;
}

/** The hull, deck, cab and cannon (outlined), lifted `lift` px. */
function hull(aim: 'horz' | 'diag' | 'up', hatch: boolean, lift: number): Canvas {
  const c = new Canvas(32, 32);
  const y = (n: number) => n - lift;
  // The chassis: a long low wedge, nose sloping down to the bumper, a lit top edge and a dark keel.
  c.poly(
    [
      [5, y(13)],
      [25, y(13)],
      [28, y(15)],
      [28, y(17)],
      [26.5, y(19.5)],
      [5.5, y(19.5)],
      [4, y(17.5)],
      [4, y(14.5)],
    ],
    '1',
  );
  c.hline(5, 25, y(13), '3');
  c.hline(5, 26, y(18), '2').hline(6, 25, y(19), '2');
  // A panel seam and three vents along the flank.
  c.hline(6, 24, y(16), '2');
  for (const vx of [9, 11, 13]) c.set(vx, y(15), '7');
  // Head and tail lamps.
  c.set(27, y(15), 'a').set(4, y(16), 'c');
  // The deck behind the cab, and the cab's glass dome (or the thrown-back hatch).
  c.rect(6, y(10), 16, 3, '1').hline(6, 21, y(10), '3');
  if (hatch) {
    // The lid stands up from its hinge at the back; Jason's helmet shows in the open cab.
    c.line(9, y(9), 7, y(4), '9', 2);
    c.set(7, y(4), '8').set(8, y(5), '8');
    c.disc(13.5, y(8.5), 2.6, '4');
    c.hline(14, 15, y(8), '8').set(15, y(9), '9');
  } else {
    c.ellipse(13, y(10.5), 5, 4.5, (_px, py) => (py <= y(10) ? '9' : '1'));
    c.set(11, y(7), '8').set(12, y(7), '8').set(10, y(8), '8').set(11, y(8), '4');
  }
  // The antenna at the tail, its tip lamp lit.
  c.vline(5, y(5), y(9), '6').set(5, y(4), 'c');
  // The turret and its cannon.
  c.rect(17, y(9), 5, 4, '6').hline(17, 21, y(9), '5');
  if (aim === 'horz') {
    c.rect(22, y(10), 5, 1, '5').rect(22, y(11), 5, 1, '6');
    c.rect(27, y(9), 1, 4, '7');
  } else if (aim === 'diag') {
    c.line(21, y(9), 25, y(5), '6', 2);
    c.line(21, y(8), 25, y(4), '5', 1);
    c.rect(25, y(3), 2, 2, '7');
  } else {
    c.rect(19, y(2), 1, 7, '5').rect(20, y(2), 1, 7, '6');
    c.rect(18, y(1), 4, 1, '7');
  }
  return c.outline();
}

function tank({ phase = 0, bob = 0, drop = 0, jet = 0, aim = 'horz', hatch = false }: TankPose): string[] {
  const lift = aim === 'up' ? 4 : aim === 'diag' ? 1 : 0;
  const c = hull(aim, hatch, lift - bob);
  const spread = aim === 'up' ? 5 : 8;
  const wheels: [number, number][] = [
    [16 - spread, (phase + 3) % 4],
    [16 + spread, phase],
  ];
  for (const [cx, ph] of wheels) {
    const top = 16 + drop;
    // A strut down to a hanging wheel.
    if (drop > 0) c.rect(cx - 1, 19 - lift + bob, 2, top - 19 + lift - bob + 2, '7');
    if (jet) {
      // The jet fires from under the hub: a long flame (1) or a short one (2), drawn behind it.
      const flame =
        jet === 1
          ? ['.aaaa.', 'aaaaaa', 'baaaab', 'bbaabb', '.bbbb.', '.cbbc.', '..cc..', '..c...']
          : ['.aaaa.', 'baaaab', '.bbbb.', '..cc..', '...c..'];
      c.paste(flame, cx - 3, top + 5);
    }
    c.paste(wheel(ph), cx - 4, top);
  }
  return c.rows();
}

/** Head-on: the wheels edge-on at the sides, lamps either side of the muzzle, the dome above. */
function tankFront(): string[] {
  const c = new Canvas(32, 32);
  c.rect(10, 12, 12, 8, '1').hline(10, 21, 12, '3').hline(10, 21, 19, '2').hline(11, 20, 18, '2');
  c.set(11, 14, 'a').set(20, 14, 'a');
  c.ellipse(16, 11, 4.5, 4, (_x, y) => (y <= 10 ? '9' : '1'));
  c.set(14, 8, '8').set(15, 8, '8').set(14, 9, '4');
  c.disc(16, 15, 2.2, '5').set(15, 14, '7').set(16, 14, '7').set(15, 15, '0').set(16, 15, '0');
  c.vline(21, 6, 11, '6').set(21, 5, 'c');
  c.outline();
  for (const x of [7, 22]) {
    const w = new Canvas(3, 9);
    w.rect(0, 0, 3, 9, '7');
    for (let yy = 1; yy < 9; yy += 2) w.hline(0, 2, yy, '6');
    c.paste(w.rows(), x, 15);
  }
  return c.outline().rows();
}

/** Three-quarter: the hull foreshortened, the near wheel round, the far one an oval. */
function tankThreeQuarter(): string[] {
  const c = new Canvas(32, 32);
  c.poly(
    [
      [6, 13],
      [22, 13],
      [26, 15],
      [26, 19.5],
      [7, 19.5],
      [5, 17.5],
      [5, 14.5],
    ],
    '1',
  );
  c.hline(7, 22, 13, '3').hline(6, 25, 18, '2').hline(7, 25, 19, '2');
  c.rect(22, 14, 4, 4, '2').set(24, 15, 'a');
  c.rect(8, 10, 12, 3, '1').hline(8, 19, 10, '3');
  c.ellipse(14, 10.5, 4.5, 4.5, (_x, y) => (y <= 10 ? '9' : '1'));
  c.set(12, 7, '8').set(13, 7, '8').set(12, 8, '4');
  c.vline(7, 5, 9, '6').set(7, 4, 'c');
  c.rect(17, 9, 4, 4, '6').hline(17, 20, 9, '5');
  c.rect(21, 10, 2, 2, '5').rect(23, 9, 2, 4, '7');
  c.outline();
  c.paste(wheel(1), 6, 16);
  const far = new Canvas(8, 8);
  far.ellipse(4, 4, 2.6, 4, (x) => (x === 4 ? '6' : '7'));
  c.paste(far.outline().rows(), 18, 16);
  return c.rows();
}

const idle = tank({});
const tankFrames: Record<string, Rows> = {
  idle,
  'drive-0': idle,
  'drive-1': tank({ phase: 1, bob: 1 }),
  'drive-2': tank({ phase: 2 }),
  'drive-3': tank({ phase: 3, bob: 1 }),
  jump: tank({ drop: 4 }),
  'hover-0': tank({ drop: 2, jet: 1 }),
  'hover-1': tank({ drop: 2, jet: 2 }),
  open: tank({ hatch: true }),
  'aim-diag': tank({ aim: 'diag' }),
  'aim-up': tank({ aim: 'up' }),
  'turn-0': tankThreeQuarter(),
  'turn-1': tankFront(),
  'turn-2': flipX(tankThreeQuarter()),
  'tilt-up': rotate(idle, -45),
  'tilt-down': rotate(idle, 45),
  ...Object.fromEntries([0, 1, 2, 3].map((k) => [`wheel-${k}`, wheel(k)])),
};

/** `rows` turned k quarter turns clockwise. */
const turnCwN = (rows: Rows, k: number): string[] => {
  let out = [...rows];
  for (let i = 0; i < k; i++) out = turnCw(out);
  return out;
};

/* ---------- explosions ---------- */

const PUFFS = [
  [-0.35, -0.2, 0.42],
  [0.3, -0.3, 0.38],
  [0.05, 0.3, 0.45],
  [-0.3, 0.35, 0.3],
] as const;

/**
 * A blast `size` px square, centred: `stage` 0 a white flash, 1 a fireball, 2 a ragged burst
 * thinning out, 3 grey smoke. `seed` varies the rag; `debris` throws bits of the tank out.
 */
function blast(size: number, stage: 0 | 1 | 2 | 3, seed: number, debris = false): string[] {
  const c = new Canvas(size, size);
  const m = size / 2;
  const r = (size / 2) * ([0.4, 0.7, 0.92, 0.9][stage] as number);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - m;
      const dy = y + 0.5 - m;
      const a = Math.atan2(dy, dx);
      // A ragged edge: the radius wobbles with the angle.
      const rag = r * (0.82 + 0.18 * Math.sin(a * 5 + seed) + 0.1 * Math.sin(a * 9 + seed * 3));
      const d = Math.hypot(dx, dy) / rag;
      if (d > 1) continue;
      const n = hash(x, y, seed + stage);
      if (stage === 0) c.set(x, y, d < 0.45 ? '4' : d < 0.8 ? 'a' : 'b');
      else if (stage === 1) c.set(x, y, d < 0.35 ? '4' : d < 0.6 ? 'a' : d < 0.85 ? 'b' : 'c');
      else if (stage === 2) {
        if (d > 0.45 && n < 0.25 + d * 0.3) continue;
        c.set(x, y, d < 0.3 ? 'a' : d < 0.6 ? 'b' : d < 0.85 ? 'c' : 'u');
      } else {
        // Puffs of smoke, lit on top.
        let hit = -1;
        for (const [px, py, pr] of PUFFS) {
          const q = Math.hypot(dx / m - px, dy / m - py) / pr;
          if (q < 1) hit = Math.max(hit, q < 0.5 && dy / m < py ? 2 : 1);
        }
        if (hit < 0 || n < 0.12) continue;
        c.set(x, y, hit === 2 ? '5' : d > 0.8 ? '7' : '6');
      }
    }
  if (stage === 0) {
    // The flash's four spikes.
    c.line(m - 0.5, m - r * 1.6, m - 0.5, m + r * 1.6, '4');
    c.line(m - r * 1.6, m - 0.5, m + r * 1.6, m - 0.5, '4');
  }
  if (debris && stage >= 1) {
    // Bits of the tank flying out: hull plates and a wheel.
    const out = [0.55, 0.75, 0.95][stage - 1] as number;
    for (const [k, ch] of [
      [0.3, '1'],
      [2.1, '2'],
      [3.6, '1'],
      [5.0, '7'],
    ] as const) {
      const px = Math.round(m + Math.cos(k + seed) * m * out);
      const py = Math.round(m + Math.sin(k + seed) * m * out);
      c.rect(px - 1, py - 1, 3, 2, ch);
    }
    c.paste(wheel(stage), Math.round(m + m * out * 0.6) - 4, Math.round(m - m * out) + 1);
  }
  return c.rows();
}

/* ---------- shots ---------- */

/** An oval shot in an `fw` x `fh` frame, centred: `rings` from the rim in to the core. */
function bolt(fw: number, fh: number, rx: number, ry: number, rings: string): string[] {
  const c = new Canvas(fw, fh);
  [...rings].forEach((ch, k) => {
    const t = 1 - k / rings.length;
    c.ellipse(fw / 2, fh / 2, rx * t, ry * Math.max(t, 0.5), ch);
  });
  return c.rows();
}

function missile(flame: 0 | 1): string[] {
  const c = new Canvas(16, 8);
  c.rect(5, 3, 8, 1, '5').rect(5, 4, 8, 1, '6');
  c.rect(13, 3, 1, 2, 't').set(14, 3, 't').set(14, 4, 'u');
  c.rect(5, 1, 2, 2, '7').rect(5, 5, 2, 2, '7');
  c.outline();
  c.paste(flame ? ['..a', '.ba', '..a'] : ['.cba', 'cbba', '.cba'], flame ? 1 : 0, 2);
  return c.rows();
}

function homing(k: 0 | 1): string[] {
  const c = new Canvas(8, 8);
  c.disc(4.5, 4, 2.6, '9').set(4, 2, '8').set(3, 3, '8').set(4, 3, '4');
  c.outline();
  c.set(0, 3, k ? 'a' : 'b')
    .set(0, 4, k ? 'b' : 'c')
    .set(1, 3, 'a');
  return c.rows();
}

const grenade = (spark: string): string[] =>
  new Canvas(8, 8)
    .disc(4, 4.5, 3, '7')
    .disc(3.5, 4, 1.4, '6')
    .set(3, 3, '5')
    .outline()
    .set(5, 0, spark)
    .rows();

/* ---------- Jason ---------- */

// Side view, facing right: a big round white helmet with a blue visor, a blue suit, dark boots,
// a little blaster held forward. Rows 0-11 are the head and gun arm (shared), the legs vary.
const jasonTop = [
  '....000000......',
  '...04444440.....',
  '..0444444440....',
  '..0444488880....',
  '..0444489990....',
  '..0444444440....',
  '...04444440.....',
  '....000000......',
  '...0dddd00000...',
  '...0edd0566650..',
  '...0eddd000000..',
  '....0dddd0......',
];
const jasonLegs = {
  stand: ['....0de0dd0.....', '....0de0dd0.....', '...07700770.....', '...0000.0000....'],
  stride: ['...0ed00dd0.....', '..0ed0..0dd0....', '.0770....0770...', '.0000....0000...'],
  pass: ['....0ed0d0......', '....0e0dd0......', '...0770770......', '...0000000......'],
  stride2: ['...0dd00ed0.....', '..0dd0..0ed0....', '.0770....0770...', '.0000....0000...'],
};
const jason = (legs: Rows): string[] => [...jasonTop, ...legs];

const jasonJump = [
  ...jasonTop.slice(0, 11),
  '...0dddddd0.....',
  '..0ee00ddd0.....',
  '..0770.0dd0.....',
  '..000..0770.....',
  '.......0000.....',
];

// From behind, on a ladder: the helmet's back, a pack, one hand up then the other.
const jasonClimb = (k: 0 | 1): string[] => {
  const c = new Canvas(16, 16);
  c.disc(8, 4.5, 4.2, '4');
  c.vline(8, 1, 7, '5');
  c.rect(5, 8, 6, 4, 'd').rect(6, 9, 4, 3, '6').hline(6, 9, 9, '5');
  const up = k ? 4 : 11;
  const down = k ? 11 : 4;
  c.rect(up, 5, 1, 4, 'e').set(up, 4, 'f');
  c.rect(down, 9, 1, 3, 'e').set(down, 12, 'f');
  c.rect(5, 12, 2, 2, 'e').rect(9, 12, 2, 2, 'd');
  c.rect(5, k ? 13 : 14, 2, 1, '7').rect(9, k ? 14 : 13, 2, 1, '7');
  return c.outline().rows();
};

const jasonHurt = [
  '.....000000.....',
  '....04444440....',
  '...0444444440...',
  '...0444488880...',
  '...0444489990...',
  '...0444444440...',
  '....04444440....',
  '.....000000.....',
  '.00..0dddd0..00.',
  '0dd00ddddd000dd0',
  '.00.0edddd0..00.',
  '....0edddd0.....',
  '...0dd00dd0.....',
  '..0dd0..0dd0....',
  '.0770....0770...',
  '.0000....0000...',
];

const jasonDie = [
  ...Array.from({ length: 9 }, () => '................'),
  '..000000........',
  '.04444440.......',
  '0444444440000000',
  '04888444ddddd770',
  '04999444edede770',
  '.044444000000000',
  '..000000........',
];

type Dir = 'down' | 'up' | 'left' | 'right';

/** Overhead Jason (16x16). `dir` faces; `step` swaps the feet; `shoot` puts the gun out. */
function jasonO(dir: Dir, step: 0 | 1, shoot = false): string[] {
  const c = new Canvas(16, 16);
  const side = dir === 'left' || dir === 'right';
  // Feet first, under the body.
  if (side) c.rect(5 + step * 2, 13, 3, 2, '7').rect(9 - step * 2, 13, 3, 2, '7');
  else c.rect(4, 12 + step, 3, 2, '7').rect(9, 13 - step, 3, 2, '7');
  c.ellipse(8, 10.5, side ? 4 : 5.2, 3.2, (_x, y) => (y >= 12 ? 'e' : 'd'));
  if (dir === 'up') c.rect(6, 8, 4, 4, '6').hline(6, 9, 8, '5');
  c.disc(8, 5.5, 4.4, '4');
  if (dir === 'down') c.ellipse(8, 7, 3.2, 1.8, '9').hline(6, 8, 6, '8');
  else if (dir === 'up') c.vline(8, 2, 8, '5');
  else c.ellipse(dir === 'right' ? 11 : 5, 6, 1.6, 1.8, '9').set(dir === 'right' ? 11 : 4, 5, '8');
  // The gun: in his right hand (the viewer's left facing down), pushed out when shooting.
  const reach = shoot ? 3 : 1;
  if (dir === 'down') c.rect(3, 10, 2, 2 + reach, '6').set(3, 11 + reach, '7');
  if (dir === 'up') c.rect(11, 7 - reach, 2, 2 + reach, '6').set(11, 7 - reach, '7');
  if (dir === 'right') c.rect(11, 10, 2 + reach, 2, '6').set(12 + reach, 10, '7');
  if (dir === 'left') c.rect(3 - reach, 10, 2 + reach, 2, '6').set(3 - reach, 10, '7');
  c.outline();
  if (shoot) {
    const flash: Record<Dir, readonly [number, number, number, number]> = {
      down: [3, 15, 4, 15],
      up: [11, 1, 12, 1],
      right: [15, 10, 15, 11],
      left: [0, 10, 0, 11],
    };
    const [x0, y0, x1, y1] = flash[dir];
    c.set(x0, y0, 'a').set(x1, y1, 'a');
  }
  return c.rows();
}

const jasonOFrames: Record<string, Rows> = {};
for (const dir of ['down', 'up', 'left', 'right'] as const) {
  jasonOFrames[`jason-o-${dir}-0`] = jasonO(dir, 0);
  jasonOFrames[`jason-o-${dir}-1`] = jasonO(dir, 1);
  jasonOFrames[`jason-o-shoot-${dir}`] = jasonO(dir, 0, true);
}

/** Jason in his jacket (the opening, before the suit): brown hair, red jacket, jeans, running. */
const cutJason = [
  '.....00000......',
  '....0rrrrr0.....',
  '...0rrrrrrr0....',
  '...0rrrrffr0....',
  '...0rrfff0f0....',
  '....0fffffff0...',
  '....0ffff000....',
  '.....0fff0......',
  '....0ttttt0.....',
  '...0tttuttt0....',
  '..0ttu0tuttt0...',
  '..0tu00tutftf0..',
  '..0ff0tttt00f0..',
  '...00.0tttt00...',
  '......0eeee0....',
  '.....0eeeeee0...',
  '....0ee00eeee0..',
  '...0ee0..0eee0..',
  '..0ee0....0ee0..',
  '.0ee0.....0ee0..',
  '.0770.....0770..',
  '07770....07770..',
  '00000....00000..',
  '................',
];

/* ---------- Fred ---------- */

function fredSit(): string[] {
  const c = new Canvas(16, 16);
  c.ellipse(5, 12.5, 3.6, 3, 'i');
  c.ellipse(8.5, 11.5, 5.8, 4, 'g');
  c.ellipse(10, 13, 3.6, 2.2, 'h');
  c.disc(11, 7.8, 2.4, 'g');
  c.rect(11, 14, 3, 1, 'g').rect(2, 15, 5, 1, 'i');
  c.disc(11.2, 7, 1.6, '4').set(11, 7, '0');
  c.outline();
  c.hline(12, 14, 10, '0');
  return c.rows();
}

function fredLeap(): string[] {
  const c = new Canvas(16, 16);
  c.line(5, 9, 1, 14, 'i', 2);
  c.line(4, 10, 1, 12, 'g', 1);
  c.ellipse(9, 7.5, 5, 3.2, 'g');
  c.ellipse(9.5, 9, 3.6, 1.6, 'h');
  c.line(12, 10, 14, 13, 'g', 1);
  c.disc(12, 5, 2, 'g');
  c.disc(12.2, 4.5, 1.4, '4').set(12, 4, '0');
  c.outline();
  c.hline(13, 15, 7, '0');
  return c.rows();
}

function fredSwim(): string[] {
  const c = new Canvas(16, 16);
  c.line(5, 9, 1, 6, 'i', 2);
  c.line(5, 10, 1, 13, 'i', 2);
  c.ellipse(9.5, 9.5, 5.4, 2.8, 'g');
  c.ellipse(10, 10.8, 3.6, 1.3, 'h');
  c.disc(12, 7.6, 1.5, '4').set(12, 7, '0');
  c.outline();
  return c.rows();
}

/** Fred after the chest: a frog the size of a car, warts aglow, fangs and gold eyes. */
function fredBig(): string[] {
  const c = new Canvas(32, 32);
  c.ellipse(10, 24, 8, 6.5, 'i');
  c.ellipse(17, 21, 12.5, 9.5, 'g');
  c.ellipse(19, 25, 8.5, 4.5, 'h');
  c.ellipse(23, 12, 6.5, 5.5, 'g');
  c.rect(22, 28, 7, 3, 'g').rect(3, 29, 12, 2, 'i');
  for (const [x, y] of [
    [12, 16],
    [16, 13],
    [9, 21],
    [14, 19],
    [19, 15],
    [7, 25],
  ] as const)
    c.rect(x, y, 2, 2, 'n').set(x, y, 'a');
  c.disc(23.5, 9, 3.2, 'm').rect(23, 8, 2, 3, '0');
  c.outline();
  c.hline(25, 30, 16, '0');
  c.set(26, 17, 's').set(28, 17, 's').set(30, 17, 's');
  return c.rows();
}

/* ---------- mutants ---------- */

function crawler(k: 0 | 1): string[] {
  const c = new Canvas(16, 16);
  const hump = k;
  c.disc(12, 12 - hump, 3.2, 'l');
  c.disc(8.5, 11.5 - hump * 2, 3.6, 'j');
  c.disc(4.5, 12, 3.4, 'j');
  c.set(8, 9 - hump * 2, 'k')
    .set(9, 9 - hump * 2, 'k')
    .set(4, 10, 'k');
  for (const x of [3, 6, 9, 12]) c.set(x + k, 15, 'l');
  c.outline();
  c.set(3, 11, 'm').set(1, 13, 's').set(1, 14, 's');
  return c.rows();
}

function hopper(k: 0 | 1): string[] {
  const c = new Canvas(16, 16);
  if (k === 0) {
    c.line(3, 12, 2, 15, 'l', 2).line(12, 12, 13, 15, 'l', 2);
    c.ellipse(8, 10.5, 6, 4, 'j');
  } else {
    c.line(4, 10, 3, 15, 'l', 1).line(11, 10, 12, 15, 'l', 1);
    c.ellipse(8, 6.5, 5, 5, 'j');
  }
  const cy = k ? 6 : 10;
  c.ellipse(8, cy - 1.5, 3, 1.5, 'k');
  c.outline();
  c.disc(5, cy, 1.6, '4').set(4, cy, 't');
  c.hline(4, 9, cy + 2, '0');
  return c.rows();
}

function flyer(k: 0 | 1): string[] {
  const c = new Canvas(16, 16);
  if (k === 0) c.ellipse(9, 4, 4, 3, 'k').ellipse(12, 3.5, 3, 2.5, 'k');
  else c.ellipse(9, 12, 4, 2.4, 'k').ellipse(12, 12.5, 3, 2, 'k');
  c.ellipse(8, 8.5, 5.5, 2.8, 'j');
  c.ellipse(13, 8.5, 2.5, 2, 'l');
  c.outline();
  c.disc(4, 8, 1.6, 't').set(3, 8, 'm');
  c.set(1, 9, 's');
  return c.rows();
}

function blob(k: 0 | 1): string[] {
  const c = new Canvas(16, 16);
  const [rx, ry] = k ? [6.5, 4.6] : [5.4, 5.8];
  c.ellipse(8, 9, rx, ry, (x, y) => (hash(x, y, 7) < 0.1 ? 'k' : 'j'));
  c.ellipse(8, 9 + ry * 0.4, rx * 0.8, ry * 0.4, 'l');
  c.ellipse(7, 9 - ry * 0.5, 2, 1, 'k');
  c.outline();
  c.set(6, 9, 'm').set(10, 9, 'm');
  return c.rows();
}

function eye(k: 0 | 1): string[] {
  const c = new Canvas(16, 16);
  c.disc(8, 8, 6.5, 'j');
  c.disc(8, 8, 5.2, '4');
  for (const [x0, y0, x1, y1] of [
    [3, 6, 5, 7],
    [12, 11, 10, 9],
    [4, 11, 6, 9],
  ] as const)
    c.line(x0, y0, x1, y1, 't');
  c.disc(8.5, 8.5, 2.6, 'm').disc(8.5, 8.5, 1.2, '0');
  c.set(7, 7, '4');
  if (k) c.rect(2, 2, 12, 5, 'j').hline(3, 12, 6, 'l');
  return c.outline().rows();
}

function turretDown(): string[] {
  const c = new Canvas(16, 16);
  c.rect(1, 1, 14, 12, '7').rect(2, 2, 12, 10, '6').hline(2, 13, 2, '5');
  for (const [x, y] of [
    [2, 2],
    [13, 2],
    [2, 11],
    [13, 11],
  ] as const)
    c.set(x, y, '0');
  c.disc(8, 7, 3.8, 'j').disc(7.5, 6, 1.6, 'k');
  c.rect(7, 10, 2, 5, '5').rect(8, 10, 1, 5, '6').hline(7, 8, 14, 'a');
  return c.outline().rows();
}

/* ---------- the Plutonium Boss ---------- */

function bossLimbs(c: Canvas): void {
  // Four stubby legs a side and a great claw at each front corner.
  for (const k of [0, 1, 2, 3]) {
    const y = 18 + k * 7;
    c.line(12, y, 3, y + 4, 'l', 3);
    c.line(52, y, 61, y + 4, 'l', 3);
  }
  for (const s of [-1, 1]) {
    const x = 32 + s * 22;
    c.ellipse(x, 50, 7, 6, 'j');
    c.ellipse(x - s * 2, 49, 3, 2.5, 'k');
    c.poly(
      [
        [x - 6, 54],
        [x - 3, 63],
        [x - 1, 55],
      ],
      'k',
    );
    c.poly(
      [
        [x + 6, 54],
        [x + 3, 63],
        [x + 1, 55],
      ],
      'k',
    );
  }
}

function bossFace(c: Canvas, angry: boolean): void {
  // The head at the bottom of the shell, facing down: two gold eyes, a jaw of teeth.
  c.ellipse(32, 49, 11, 7, 'l');
  c.ellipse(32, 47, 9, 4, 'j');
  c.disc(27, 47, 2.2, angry ? 't' : 'm').disc(37, 47, 2.2, angry ? 't' : 'm');
  c.set(27, 47, '0').set(37, 47, '0');
  c.rect(26, 52, 13, 3, '0');
  for (let x = 26; x <= 38; x += 2) c.set(x, 52, 's').set(x + 1, 54, 's');
}

const VENTS = [0.2, 1.25, 2.3, 3.35, 4.4, 5.45];

function bossArmoured(open: boolean): string[] {
  const c = new Canvas(64, 64);
  bossLimbs(c);
  c.ellipse(32, 28, 24, 22, 'l');
  c.ellipse(32, 26, 22, 19, 'j');
  // Plates: seams radiating from the lit crown.
  c.ellipse(32, 18, 12, 8, 'k');
  for (const a of [0.5, 1.4, 2.3, 3.2, 4.1, 5.0])
    c.line(32 + Math.cos(a) * 13, 26 + Math.sin(a) * 11, 32 + Math.cos(a) * 21, 26 + Math.sin(a) * 18, 'l');
  // Six vents round the shell: dark when shut, glowing when open.
  for (const a of VENTS) {
    const x = Math.round(32 + Math.cos(a) * 16);
    const y = Math.round(27 + Math.sin(a) * 13);
    c.ellipse(x, y, 2.8, 2.2, open ? 'n' : 'p');
    if (open) c.set(x - 1, y - 1, 'a').set(x, y - 1, 'a');
    else c.hline(x - 1, x + 1, y, '0');
  }
  bossFace(c, false);
  return c.outline().rows();
}

function bossCore(big: boolean): string[] {
  const c = new Canvas(64, 64);
  bossLimbs(c);
  // What is left of the shell: a jagged rim round raw flesh.
  c.ellipse(32, 28, 24, 22, 'l');
  c.ellipse(32, 28, 19, 17, (x, y) => (hash(x, y, 3) < 0.35 ? 'j' : 'u'));
  c.map((ch, x, y) => {
    const a = Math.atan2(y - 28, x - 32);
    const d = Math.hypot((x - 32) / 24, (y - 28) / 22);
    return ch === 'l' && d > 0.85 && Math.sin(a * 7) > 0.55 ? '.' : undefined;
  });
  // The core: a beating ball of plutonium in rings, veins running out to the rim.
  const r = big ? 13 : 10;
  for (const a of [0.3, 1.1, 1.9, 2.8, 3.7, 4.5, 5.4])
    c.line(32, 27, 32 + Math.cos(a) * 19, 27 + Math.sin(a) * 17, 'p', 2);
  c.disc(32, 27, r, 'p');
  c.disc(32, 27, r - 2, 'o');
  c.disc(32, 27, r - 5, 'n');
  c.disc(31, 25, big ? 3 : 2, 'a');
  bossFace(c, true);
  return c.outline().rows();
}

const bossShot = (k: 0 | 1): string[] =>
  new Canvas(8, 8)
    .disc(4, 4, 3.2, k ? 'o' : 'n')
    .disc(4, 4, 1.8, k ? 'n' : 'a')
    .outline()
    .rows();

const bossShotBig = (): string[] =>
  new Canvas(16, 16)
    .disc(8, 8, 6.5, 'p')
    .disc(8, 8, 5, 'o')
    .disc(8, 8, 3.2, 'n')
    .disc(7, 7, 1.6, 'a')
    .outline()
    .rows();

/* ---------- the opening ---------- */

function cutChest(): string[] {
  const c = new Canvas(32, 24);
  // The glow escaping the lid, then the chest: dark wood, iron bands, a warning plate.
  c.ellipse(16, 6, 13, 5, (x, y) => (hash(x, y, 9) < 0.5 ? 'n' : '.'));
  c.rect(3, 9, 26, 13, 'q').rect(3, 19, 26, 3, 'r');
  c.rect(2, 6, 28, 4, 'r').hline(2, 29, 6, 'q');
  c.vline(7, 6, 21, '6').vline(24, 6, 21, '6');
  c.hline(3, 28, 10, 'n');
  c.rect(13, 12, 6, 6, 'm');
  c.disc(16, 15, 1.2, '0');
  c.set(14, 13, '0').set(17, 13, '0').set(15, 17, '0').set(16, 17, '0');
  return c.outline().rows();
}

function cutHole(): string[] {
  const c = new Canvas(48, 16);
  c.ellipse(24, 8, 23, 7.5, (x, y) => (hash(x, y, 5) < 0.3 ? 'q' : 'r'));
  c.ellipse(24, 9, 18, 5.2, '0');
  c.ellipse(24, 7.5, 18, 3, (_x, y) => (y < 7 ? 'r' : '0'));
  c.ellipse(24, 9.5, 14, 3.5, '0');
  return c.rows();
}

/* ---------- pickups, icons, meter, ladder ---------- */

function capsule(fill: string, letter: string): string[] {
  const c = new Canvas(16, 16);
  c.ellipse(8, 8, 7, 5.2, '6');
  c.ellipse(8, 8, 5.8, 4, fill);
  c.hline(4, 11, 4, '4');
  c.paste(recolour(LETTERS[letter] as Rows, { 1: '4' }), 7, 6);
  return c.outline().rows();
}

function iconCannon(): string[] {
  const c = new Canvas(16, 16);
  c.rect(1, 8, 6, 5, '1').hline(1, 6, 8, '3').rect(6, 9, 4, 2, '6').hline(6, 9, 9, '5');
  c.disc(3, 13, 2, '7');
  c.outline();
  c.paste(bolt(6, 6, 2.6, 2, '84'), 10, 7);
  return c.rows();
}

function iconTriple(): string[] {
  const c = new Canvas(16, 16);
  for (const [dx, dy] of [
    [0, 1],
    [2, 6],
    [0, 11],
  ] as const)
    c.paste(missile(0), dx, dy - 3);
  return c.rows();
}

function iconHoming(): string[] {
  const c = new Canvas(16, 16);
  for (const [x, y] of [
    [1, 13],
    [3, 11],
    [5, 10],
    [7, 10],
  ] as const)
    c.set(x, y, '8');
  c.paste(homing(0), 8, 3);
  return c.rows();
}

function iconExit(): string[] {
  const c = new Canvas(16, 16);
  // The cab's open hatch at the bottom and Jason leaping up out of it, an arrow above him.
  c.rect(1, 12, 14, 3, '1').hline(1, 14, 12, '3');
  c.ellipse(8, 12, 4, 1.4, '0');
  c.disc(8, 7, 2.6, '4').hline(8, 9, 7, '9');
  c.rect(7, 9, 3, 2, 'd');
  c.outline();
  c.paste(['..a..', '.aaa.', 'aaaaa'], 6, 0);
  return c.rows();
}

function ammo(kind: 'triple' | 'homing'): string[] {
  const c = new Canvas(16, 16);
  c.rect(1, 3, 14, 11, '7').rect(2, 4, 12, 9, 'q').hline(2, 13, 4, 's');
  c.outline();
  if (kind === 'triple') for (const y of [5, 8, 11]) c.hline(4, 10, y, '5').set(11, y, 't');
  else {
    c.disc(6, 8.5, 2.4, '9').set(5, 7, '8');
    c.paste(recolour(LETTERS.H as Rows, { 1: '4' }), 10, 6);
  }
  return c.rows();
}

function ladder(top: boolean): string[] {
  const c = new Canvas(16, 16);
  c.rect(2, 0, 2, 16, '6').vline(2, 0, 15, '5');
  c.rect(12, 0, 2, 16, '6').vline(12, 0, 15, '5');
  for (const y of [2, 6, 10, 14]) c.hline(4, 11, y, '5').hline(4, 11, y + 1, '7');
  if (top) c.rect(2, 0, 2, 1, '.').rect(12, 0, 2, 1, '.');
  // The rails run on into the next rung above and below: outline only their sides.
  return c
    .outline()
    .rows()
    .map((r, y) => (y === 0 && !top ? r.replace(/0/g, '.') : r));
}

const ring = (): string[] =>
  new Canvas(8, 8).disc(4, 4, 4, '8').disc(4, 4, 2.6, '4').disc(4, 4, 1.4, '.').rows();

export const sophiaDef: SpriteDef = {
  palette: 'sophia',
  frames: {
    ...tankFrames,
    // Shots.
    'cannon-0': bolt(8, 8, 3.2, 2.2, '984'),
    'cannon-1': bolt(12, 8, 5, 3, '9884'),
    'cannon-2': bolt(16, 8, 7, 3.6, 'cba4'),
    missile: missile(0),
    'missile-0': missile(0),
    'missile-1': missile(1),
    'homing-0': homing(0),
    'homing-1': homing(1),
    'jason-shot': ['.88.', '8448', '8448', '.88.'],
    'gun-shot-0': bolt(8, 8, 2, 2, '84'),
    'gun-shot-1': bolt(8, 8, 3.2, 3.2, '9884'),
    'gun-shot-2': ring(),
    'grenade-0': grenade('c'),
    'grenade-1': grenade('a'),
    // Blasts.
    ...Object.fromEntries(([0, 1, 2, 3] as const).map((k) => [`boom-${k}`, blast(24, k, 11)])),
    ...Object.fromEntries(([0, 1, 2, 3] as const).map((k) => [`die-${k}`, blast(32, k, 4, true)])),
    // Jason, side view.
    'jason-stand': jason(jasonLegs.stand),
    'jason-walk-0': jason(jasonLegs.stride),
    'jason-walk-1': jason(jasonLegs.pass),
    'jason-walk-2': jason(jasonLegs.stride2),
    'jason-jump': jasonJump,
    'jason-climb-0': jasonClimb(0),
    'jason-climb-1': jasonClimb(1),
    'jason-hurt': jasonHurt,
    'jason-die': jasonDie,
    // Jason, overhead.
    ...jasonOFrames,
    'gun-capsule': capsule('b', 'G'),
    'pow-capsule': capsule('t', 'P'),
    // Fred.
    'fred-0': fredSit(),
    'fred-1': fredLeap(),
    'fred-2': fredSwim(),
    'fred-big': fredBig(),
    // Mutants.
    'crawler-0': crawler(0),
    'crawler-1': crawler(1),
    'hopper-0': hopper(0),
    'hopper-1': hopper(1),
    'flyer-0': flyer(0),
    'flyer-1': flyer(1),
    'blob-0': blob(0),
    'blob-1': blob(1),
    'eye-0': eye(0),
    'eye-1': eye(1),
    ...Object.fromEntries([0, 1, 2, 3].map((k) => [`turret-o-${k}`, turnCwN(turretDown(), k)])),
    // The Plutonium Boss.
    'boss-a-0': bossArmoured(false),
    'boss-a-1': bossArmoured(true),
    'boss-b-0': bossCore(false),
    'boss-b-1': bossCore(true),
    'boss-shot-0': bossShot(0),
    'boss-shot-1': bossShot(1),
    'boss-shot-big': bossShotBig(),
    // The opening.
    'cut-chest': cutChest(),
    'cut-hole': cutHole(),
    'cut-fred-jump': rotate(fredLeap(), 70),
    'cut-jason': cutJason,
    // Pickups, icons, the hover meter, the ladder.
    'ammo-triple': ammo('triple'),
    'ammo-homing': ammo('homing'),
    'icon-cannon': iconCannon(),
    'icon-triple': iconTriple(),
    'icon-homing': iconHoming(),
    'icon-exit': iconExit(),
    'hover-cell': ['00000000', '0tttttt0', '0ttttuu0', '00000000'],
    'hover-cell-empty': ['00000000', '07777770', '07777770', '00000000'],
    ladder: ladder(false),
    'ladder-top': ladder(true),
  },
};
