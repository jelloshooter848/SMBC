import { draw, hash, type Rows } from './look-art';

/**
 * Tourian's fixtures and guards for ZEBES ESCAPE, drawn into the `zebes` sheet (zebes.ts, its
 * index roles): the brain in its glass tank, the barriers that feed it, the ceiling cannons, the
 * ring-shaped Rinkas and the door frame left when a bubble door opens. Original art, our own
 * design in the spirit of the NES Metroid's last area; nothing traced.
 *
 * - `brain-0/1` (32x32): a lobed brain, lit up-left, its folds dark red; frame 1 swells a pixel
 *   (the pulse). No face, no eye.
 * - `tank`, `tank-cracked`, `tank-broken` (48x64): the glass case on its base, the brain shows
 *   through (transparent glass with streaks); cracked after half the hits; broken is glass and
 *   metal scattered low on the floor (nothing to stand on or walk into).
 * - `zebetite-0..3` (16x48): the barrier column of stacked pods, thinner and darker with each
 *   stage of damage.
 * - `cannon-0/1/2` (16x16): a ceiling mount whose barrel points down-left, down, down-right.
 * - `rinka-0/1` (16x16): the ring, its glint going round.
 * - `bubble-door-open` (16x48): the door's frame with the bubble gone.
 */

/* ---------- the brain ---------- */

/** A 32x32 brain: two lobes, sulci as dark wavy lines, a stem at the bottom middle. */
const brain = (swell: number): string[] =>
  draw(32, 32, (x, y) => {
    const cx = 15.5;
    const cy = 15;
    const rx = 13 + swell;
    const ry = 11 + swell;
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    const d = dx * dx + dy * dy;
    // The stem.
    if (y >= 25 && y <= 30 && Math.abs(x - cx) <= 3) {
      if (Math.abs(x - cx) > 2) return '0';
      return y === 30 ? '0' : '9';
    }
    if (d > 1) return '.';
    if (d > 0.82) return '0';
    // The split between the lobes.
    if (Math.abs(x - cx) < 0.6 && y < cy + 4) return '9';
    // Folds: wavy lines across each lobe.
    const fold = Math.sin(y * 0.9 + Math.sin(x * 0.6) * 1.8 + (x > cx ? 1.3 : 0));
    if (fold > 0.82) return '9';
    // Light from the top left; pale glints.
    if (dx + dy < -0.9) return hash(x, y, 7) < 0.3 ? 'd' : 'b';
    if (dx + dy > 0.7) return 'a';
    return 'b';
  });

/* ---------- the tank ---------- */

/** The glass case: a metal cap (rows 0-5), glass (6-55), a base (56-63). */
const tankAt = (x: number, y: number, crack: boolean): string => {
  if (y < 6) {
    if (y === 0 || x === 0 || x === 47) return '0';
    if (y === 5) return '0';
    if (y === 1) return '3';
    return x % 8 === 3 ? '1' : '2';
  }
  if (y >= 56) {
    if (y === 63 || x === 0 || x === 47 || y === 56) return '0';
    if (y === 57) return '3';
    return (x + 2) % 10 < 2 ? '1' : '2';
  }
  // The glass: rims, two streaks of light, else clear.
  if (x === 0 || x === 47) return '0';
  if (x === 1 || x === 46) return '7';
  if ((x === 6 || x === 7) && y > 9 && y < 50) return '8';
  if (x === 40 && y > 12 && y < 40) return '8';
  if (crack) {
    // Cracks: two jagged lines across the glass.
    const c1 = Math.round(10 + (y - 6) * 0.55 + Math.sin(y) * 1.5);
    const c2 = Math.round(44 - (y - 20) * 0.7 + Math.cos(y * 1.3) * 1.5);
    if (y > 8 && y < 46 && x === c1) return '4';
    if (y > 20 && y < 52 && x === c2) return '4';
  }
  return '.';
};
const tank = draw(48, 64, (x, y) => tankAt(x, y, false));
const tankCracked = draw(48, 64, (x, y) => tankAt(x, y, true));
/** Broken: nothing stands; glass and bits of the cap lie scattered on the floor (rows 59-63). */
const tankBroken = draw(48, 64, (x, y) => {
  if (y < 59) return '.';
  const h = hash(x, y, 5);
  const pile = 63 - Math.round(Math.abs(Math.sin(x * 0.45)) * 4);
  if (y < pile) return '.';
  if (y === 63) return h < 0.5 ? '1' : '2';
  if (h < 0.25) return '8';
  if (h < 0.5) return '7';
  if (h < 0.7) return '2';
  return '.';
});

/* ---------- the barriers ---------- */

/** A barrier column (16x48) at damage stage `k` (0 whole .. 3 nearly gone): stacked pods. */
const zebetite = (k: number): string[] =>
  draw(16, 48, (x, y) => {
    const half = 7 - k * 1.25;
    const pod = y % 12;
    const bulge = Math.sin((pod / 12) * Math.PI) * 1.2;
    const w = half + bulge - 1;
    const dx = Math.abs(x - 7.5);
    if (dx > w + 1) return '.';
    if (dx > w || pod === 0) return '0';
    const lit = x < 7.5 && pod > 1 && pod < 6;
    if (k >= 2) return lit ? 'e' : 'f';
    if (lit) return k === 0 && dx < w - 2 ? 'i' : 'e';
    return pod > 9 || dx > w - 1.5 ? 'f' : 'e';
  });

/* ---------- the cannons ---------- */

/** A ceiling cannon (16x16): the mount on rows 0-6, a barrel toward (dir, down). */
const cannon = (dir: -1 | 0 | 1): string[] =>
  draw(16, 16, (x, y) => {
    // The barrel: a 4-px wide line from the dome's centre (7.5, 7) toward the aim.
    const len = Math.hypot(dir, 1);
    const ux = dir / len;
    const uy = 1 / len;
    const rx = x - 7.5;
    const ry = y - 7;
    const along = rx * ux + ry * uy;
    const across = Math.abs(rx * uy - ry * ux);
    if (along > 0 && along < 9 && across < 2.5)
      return across > 1.5 || along > 8 ? '0' : along > 7 ? '1' : '3';
    // The mount: a plate on top, a dome under it.
    if (y <= 2) return y === 2 ? '0' : y === 0 ? '3' : '2';
    const d = Math.hypot(x - 7.5, (y - 3) * 1.3);
    if (y > 2 && d <= 6) return d > 5 ? '0' : x < 7 && y < 6 ? '3' : '2';
    return '.';
  });

/* ---------- the Rinka ---------- */

/** A ring (16x16): orange, rimmed black, its glint at angle `a`. */
const rinka = (a: number): string[] =>
  draw(16, 16, (x, y) => {
    const dx = x - 7.5;
    const dy = y - 7.5;
    const d = Math.hypot(dx, dy);
    if (d > 7 || d < 2.5) return '.';
    if (d > 6 || d < 3.5) return '0';
    const ang = Math.atan2(dy, dx);
    const off = Math.abs(((ang - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    if (off < 0.5) return 'd';
    return off < 1.2 ? 'c' : 'b';
  });

/* ---------- the door frame ---------- */

/** The bubble door's frame with the bubble gone (`door` the closed frame's rows). */
export const openDoor = (door: Rows): string[] =>
  door.map((r, y) => (y < 3 || y >= door.length - 3 ? r : `1${'.'.repeat(r.length - 2)}1`));

export const tourianFrames: Record<string, Rows> = {
  'brain-0': brain(0),
  'brain-1': brain(0.6),
  tank,
  'tank-cracked': tankCracked,
  'tank-broken': tankBroken,
  'zebetite-0': zebetite(0),
  'zebetite-1': zebetite(1),
  'zebetite-2': zebetite(2),
  'zebetite-3': zebetite(3),
  'cannon-0': cannon(-1),
  'cannon-1': cannon(0),
  'cannon-2': cannon(1),
  'rinka-0': rinka(-Math.PI * 0.75),
  'rinka-1': rinka(Math.PI * 0.25),
};
