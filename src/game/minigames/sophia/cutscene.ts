import type { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import { drawSophia, fontSheet, hasFrame, LOOK } from './art';

/*
 * The opening, Blaster Master's in brief: letterboxed, a night yard; Fred, Jason's pet frog, hops
 * in and touches a glowing chest, swells up and leaps down a hole; Jason runs after him and jumps
 * in. The lines come up under the picture. JUMP or SHOOT skips it (the scene). With reduce
 * flashing the chest glows steadily instead of pulsing.
 */

/** The letterbox bars (px) and the picture between them. */
export const BAR_H = 40;
export const PIC_Y = BAR_H;
export const PIC_H = SCREEN_H - 2 * BAR_H;
/** The yard's ground line (screen y) and where the chest and the hole are (screen x). */
export const GROUND_Y = PIC_Y + PIC_H - 36;
export const CHEST_X = 104;
export const HOLE_X = 184;

/** The beats (frames). */
export const TOUCH_AT = 70;
export const SWELL_AT = 100;
export const LEAP_AT = 140;
export const DOWN_AT = 190;
export const JASON_AT = 210;
export const JASON_JUMP_AT = 280;
export const JASON_GONE_AT = 320;
/** Frames the whole cutscene lasts. */
export const CUTSCENE_FRAMES = 480;

/** The lines under the picture, by the frame each beat's lines come up. */
export const CUT_BEATS: readonly { at: number; lines: readonly string[] }[] = [
  { at: 0, lines: ["FRED, JASON'S PET FROG,", 'HOPPED OUT INTO THE YARD.'] },
  { at: TOUCH_AT, lines: ['HE TOUCHED A STRANGE,', 'GLOWING CHEST...'] },
  { at: LEAP_AT, lines: ['...AND LEAPT DOWN A HOLE', 'INTO THE UNDERWORLD!'] },
  { at: JASON_AT, lines: ['JASON WENT AFTER HIM.'] },
  { at: JASON_GONE_AT + 20, lines: ['DOWN THERE, THE RADIATION', "CARRIED BOWSER'S SPELL..."] },
];

/** The lines showing at frame `t`: the latest beat's. */
export function cutLines(t: number): readonly string[] {
  let lines = CUT_BEATS[0]?.lines ?? [];
  for (const b of CUT_BEATS) if (t >= b.at) lines = b.lines;
  return lines;
}

/** What the announcer reads as the cutscene starts. */
export const CUT_SAY =
  "Fred, Jason's pet frog, touches a glowing chest and leaps down a hole into the Underworld. Jason goes after him.";

const lerp = (a: number, b: number, k: number) => Math.round(a + (b - a) * Math.max(0, Math.min(1, k)));

/** Fred at frame `t`: where (screen px, top-left), which frame, and how big; null once he is gone. */
export function fredPose(t: number): { x: number; y: number; frame: string; size: number } | null {
  const ground = GROUND_Y - 16;
  if (t < TOUCH_AT) {
    // Hops in: a little arc every 16 frames.
    const x = lerp(-16, CHEST_X - 18, t / TOUCH_AT);
    const hop = Math.round(Math.sin(((t % 16) / 16) * Math.PI) * 6);
    return { x, y: ground - hop, frame: hop > 1 ? 'fred-1' : 'fred-0', size: 16 };
  }
  if (t < SWELL_AT) return { x: CHEST_X - 18, y: ground, frame: 'fred-0', size: 16 };
  if (t < LEAP_AT) return { x: CHEST_X - 34, y: GROUND_Y - 32, frame: 'fred-big', size: 32 };
  if (t < DOWN_AT) {
    // A big leap, then head first into the hole.
    const k = (t - LEAP_AT) / (DOWN_AT - LEAP_AT);
    const x = lerp(CHEST_X - 26, HOLE_X + 16, k);
    const y = GROUND_Y - 24 - Math.round(Math.sin(k * Math.PI) * 48) + Math.round(k * k * 20);
    if (y + 16 > GROUND_Y + 6) return null; // gone down the hole
    return { x, y, frame: k < 0.5 ? 'fred-1' : 'cut-fred-jump', size: 16 };
  }
  return null;
}

/** Jason at frame `t`, or null before he comes and once he is down the hole. */
export function jasonPose(t: number): { x: number; y: number } | null {
  if (t < JASON_AT || t >= JASON_GONE_AT) return null;
  const ground = GROUND_Y - 24;
  if (t < JASON_JUMP_AT)
    return { x: lerp(-16, HOLE_X - 28, (t - JASON_AT) / (JASON_JUMP_AT - JASON_AT)), y: ground };
  const k = (t - JASON_JUMP_AT) / (JASON_GONE_AT - JASON_JUMP_AT);
  const y = ground - Math.round(Math.sin(k * Math.PI) * 24) + Math.round(k * k * 28);
  if (y + 24 > GROUND_Y + 6) return null; // gone down the hole
  return { x: lerp(HOLE_X - 28, HOLE_X + 16, k), y };
}

/** Draws the cutscene at frame `t`. */
export function drawCutscene(r: Renderer, assets: AssetRegistry, t: number, reduceFlashing: boolean): void {
  const font = fontSheet(assets);
  r.rect(0, 0, SCREEN_W, SCREEN_H, '#000');
  // The night sky over the yard, a few fixed stars, the ground.
  r.rect(0, PIC_Y, SCREEN_W, PIC_H, '#00083c');
  for (let i = 0; i < 18; i++) r.rect((i * 59 + 13) % SCREEN_W, PIC_Y + 6 + ((i * 37) % 70), 1, 1, '#bcbcbc');
  r.rect(0, GROUND_Y, SCREEN_W, PIC_Y + PIC_H - GROUND_Y, '#503000');
  r.rect(0, GROUND_Y, SCREEN_W, 3, '#007800');
  // The hole (its mouth in the ground).
  if (hasFrame(assets, 'cut-hole'))
    drawSophia(r, assets, 'cut-hole', HOLE_X, GROUND_Y - 6, 48, 16, LOOK.hole);
  else {
    r.rect(HOLE_X, GROUND_Y, 48, 6, '#000000');
    r.rect(HOLE_X + 6, GROUND_Y + 6, 36, 4, '#000000');
  }
  // The chest: glowing once Fred has touched it (pulsing; steady with reduce flashing).
  const lit = t >= TOUCH_AT;
  if (lit) {
    const pulse = reduceFlashing ? 1 : ((t >> 3) & 1) + 1;
    r.rect(
      CHEST_X - 4 * pulse,
      GROUND_Y - 24 - 4 * pulse,
      32 + 8 * pulse,
      24 + 4 * pulse,
      'rgba(88,248,152,0.25)',
    );
  }
  drawSophia(r, assets, 'cut-chest', CHEST_X, GROUND_Y - 24, 32, 24, LOOK.chest);
  // Fred, then Jason.
  const fred = fredPose(t);
  if (fred) {
    const look = fred.size > 16 ? LOOK.fredBig : LOOK.fred;
    drawSophia(r, assets, fred.frame, fred.x, fred.y, fred.size, fred.size, look);
  }
  const jason = jasonPose(t);
  if (jason) drawSophia(r, assets, 'cut-jason', jason.x, jason.y, 16, 24, LOOK.cutJason);
  // The letterbox and the lines.
  r.rect(0, 0, SCREEN_W, BAR_H, '#000');
  r.rect(0, SCREEN_H - BAR_H, SCREEN_W, BAR_H, '#000');
  const lines = cutLines(t);
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i] as string;
    r.text(font, l, (SCREEN_W - l.length * 8) >> 1, SCREEN_H - BAR_H + 8 + i * 12);
  }
}
