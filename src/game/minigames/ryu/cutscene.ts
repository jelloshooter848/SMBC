import type { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { drawNinja, hasNinjaFrame } from './art';

/*
 * The opening cutscene, Tecmo style: letterboxed, a huge moon over a field of tall grass, two
 * ninja run at each other, leap, and clash in mid-air in front of the moon; they land past each
 * other, and the lines come up under the picture. JUMP or OK skips it (the scene). With reduce
 * flashing there is no white flash at the clash: the spark is simply drawn.
 */

/** The letterbox bars (px) and the picture between them. */
export const BAR_H = 40;
export const PIC_Y = BAR_H;
export const PIC_H = SCREEN_H - 2 * BAR_H;

/** The beats (frames). */
export const RUN_AT = 50;
export const LEAP_AT = 100;
export const CLASH_AT = 140;
export const CLASH_FRAMES = 18;
export const LAND_AT = 190;
/** Frames the whole cutscene lasts before READY. */
export const CUTSCENE_FRAMES = 470;
/** Frames of the white flash at the clash (none with reduce flashing). */
export const FLASH_FRAMES = 3;

/** The lines under the picture, by the frame each beat's lines come up. */
export const CUT_BEATS: readonly { at: number; lines: readonly string[] }[] = [
  { at: 0, lines: ['A MOONLIT FIELD.'] },
  { at: LAND_AT, lines: ['TWO NINJA. ONE STROKE.'] },
  { at: 280, lines: ['THE MASKED NINJA WAITS', 'ON THE ROOFTOPS...'] },
];

/** The lines showing at frame `t`: the latest beat's. */
export function cutLines(t: number): readonly string[] {
  let lines = CUT_BEATS[0]?.lines ?? [];
  for (const b of CUT_BEATS) if (t >= b.at) lines = b.lines;
  return lines;
}

/** The words the announcer reads for each beat. */
export const CUT_SAY = 'A moonlit field. Two ninja leap at each other and clash under the moon.';

const lerp = (a: number, b: number, k: number) => Math.round(a + (b - a) * Math.max(0, Math.min(1, k)));

export interface Pose {
  x: number;
  y: number;
  frame: 0 | 1;
}

function pose(out: Pose, x: number, y: number, frame: 0 | 1): Pose {
  out.x = x;
  out.y = y;
  out.frame = frame;
  return out;
}

/**
 * Where each ninja is at frame `t` (screen px, their top-left), and which frame they show,
 * written into `out`.
 */
export function ninjaPose(t: number, side: -1 | 1, out: Pose = { x: 0, y: 0, frame: 0 }): Pose {
  const ground = PIC_Y + PIC_H - 40;
  const mid = SCREEN_W >> 1;
  const start = side < 0 ? 8 : SCREEN_W - 40;
  const leapFrom = side < 0 ? mid - 72 : mid + 40;
  const meet = side < 0 ? mid - 30 : mid - 2;
  const end = side < 0 ? SCREEN_W - 72 : 40;
  // (frame 0 is the leap pose, 1 the strike: they strike from the clash until they land)
  if (t < RUN_AT) return pose(out, start, ground, 0);
  if (t < LEAP_AT) return pose(out, lerp(start, leapFrom, (t - RUN_AT) / (LEAP_AT - RUN_AT)), ground, 0);
  if (t < CLASH_AT) {
    const k = (t - LEAP_AT) / (CLASH_AT - LEAP_AT);
    const y = ground - Math.round(Math.sin((k * Math.PI) / 2) * 64);
    return pose(out, lerp(leapFrom, meet, k), y, 0);
  }
  if (t < CLASH_AT + CLASH_FRAMES) return pose(out, meet, ground - 64, 1);
  const k = (t - CLASH_AT - CLASH_FRAMES) / (LAND_AT - CLASH_AT - CLASH_FRAMES);
  if (k < 1)
    return pose(out, lerp(meet, end, k), ground - 64 + Math.round(Math.sin(k * Math.PI * 0.5) * 64), 1);
  return pose(out, end, ground, 0);
}

const RYU_POSE: Pose = { x: 0, y: 0, frame: 0 };
const FOE_POSE: Pose = { x: 0, y: 0, frame: 0 };
const RYU_FRAMES = ['cut-ryu-0', 'cut-ryu-1'] as const;
const FOE_FRAMES = ['cut-masked-0', 'cut-masked-1'] as const;

/** Draws the cutscene at frame `t`. */
export function drawCutscene(r: Renderer, assets: AssetRegistry, t: number, reduceFlashing: boolean): void {
  const font = assets.sheet('font');
  r.rect(0, 0, SCREEN_W, SCREEN_H, '#000');
  // The night sky, the moon, the field.
  r.rect(0, PIC_Y, SCREEN_W, PIC_H, '#000c3c');
  const mx = (SCREEN_W >> 1) - 32;
  const my = PIC_Y + 12;
  if (hasNinjaFrame(assets, 'cut-moon'))
    drawNinja(r, assets, 'cut-moon', mx, my, 64, 64, ['#fce0a8', '#fce0a8']);
  else {
    // A round moon of stacked rows.
    for (let i = 0; i < 64; i += 4) {
      const d = Math.round(Math.sqrt(32 * 32 - (i + 2 - 32) ** 2));
      r.rect(mx + 32 - d, my + i, d * 2, 4, '#fce0a8');
    }
  }
  const fy = PIC_Y + PIC_H - 48;
  if (hasNinjaFrame(assets, 'cut-field'))
    for (let x = 0; x < SCREEN_W; x += 256)
      drawNinja(r, assets, 'cut-field', x, fy, 256, 48, ['#000', '#000']);
  else {
    r.rect(0, fy + 24, SCREEN_W, 24, '#001400');
    for (let x = 0; x < SCREEN_W; x += 6) r.rect(x, fy + 14 + ((x * 7) % 11), 2, 24, '#001400');
  }
  // The two ninja (silhouettes).
  const ryu = ninjaPose(t, -1, RYU_POSE);
  const foe = ninjaPose(t, 1, FOE_POSE);
  // Ryu faces right, the Masked Ninja left, throughout: they land back to back.
  drawNinja(r, assets, RYU_FRAMES[ryu.frame], ryu.x, ryu.y, 32, 32, ['#000', '#101020']);
  drawNinja(r, assets, FOE_FRAMES[foe.frame], foe.x, foe.y, 32, 32, ['#000', '#200810']);
  // The clash: a spark between them (and, without reduce flashing, a brief white flash).
  if (t >= CLASH_AT && t < CLASH_AT + CLASH_FRAMES) {
    if (!reduceFlashing && t < CLASH_AT + FLASH_FRAMES) r.rect(0, PIC_Y, SCREEN_W, PIC_H, '#fcfcfc');
    drawNinja(r, assets, 'cut-clash', (SCREEN_W >> 1) - 16, PIC_Y + PIC_H - 40 - 64, 32, 32, [
      '#fcfcfc',
      '#fca044',
    ]);
  }
  // The letterbox and the lines.
  r.rect(0, 0, SCREEN_W, BAR_H, '#000');
  r.rect(0, SCREEN_H - BAR_H, SCREEN_W, BAR_H, '#000');
  const lines = cutLines(t);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] as string;
    r.text(font, l, (SCREEN_W - l.length * 8) >> 1, SCREEN_H - BAR_H + 8 + i * 12);
  }
}
