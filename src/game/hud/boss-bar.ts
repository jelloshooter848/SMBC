import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import { BOSS_BAR_LOST, type BossBar } from '../world/boss-bar';

/*
 * The Bowser bar on screen (0.4.47, roadmap #30; world/boss-bar.ts holds its state): an SMB-style
 * row, the HUD's own white letters BOWSER and a notch for each of his hit points, on a black strip
 * centred under the HUD's rows. Clear of every hero's stats: the health and weapon bars at the left
 * edge (x 7-23), Samus's EN and tanks and the meters under the name (to x 66), the tool belt under
 * the coins (y 24-32), player two's name, hearts or EN under WORLD (to y 40) and bar at the right
 * edge (x 241-248). In an SMB3 piece (its status bar along the bottom) it goes at the top of the
 * play, where no HUD row is.
 */

const NAME = 'BOWSER';
/** A notch: its width and the gap after it (px). */
const NOTCH_W = 6;
const NOTCH_GAP = 2;
const NOTCH_H = 6;
/** The strip's top under the SMB1 HUD (its rows end at y 40), and over an SMB3 piece. */
export const BOSS_BAR_Y = 42;
export const BOSS_BAR_Y_SMB3 = 6;

const WHITE = '#fcfcfc';
/** A notch he still has: the castle fire's orange; one gone: dark; one a hit just took: lit. */
const FULL = '#fc9838';
const EMPTY = '#202020';
const LOST = '#f83800';

/** The strip's box (screen px) for a bar of `max` notches whose top is `y`. */
export function bossBarBox(max: number, y = BOSS_BAR_Y): { x: number; y: number; w: number; h: number } {
  const w = NAME.length * 8 + 4 + max * (NOTCH_W + NOTCH_GAP) - NOTCH_GAP + 4;
  return { x: (256 - w) >> 1, y, w, h: 12 };
}

/**
 * Draws `bar` (when shown): BOWSER, then its notches, full from the left. The notches the last hit
 * took glow for BOSS_BAR_LOST frames, blinking with `frame`, held steady with reduce flashing.
 */
export function drawBowserBar(
  r: Renderer,
  assets: AssetRegistry,
  bar: BossBar,
  frame: number,
  reduceFlashing: boolean,
  y = BOSS_BAR_Y,
): void {
  if (!bar.shown || bar.max <= 0) return;
  const box = bossBarBox(bar.max, y);
  r.rect(box.x, box.y, box.w, box.h, '#000');
  r.text(assets.sheet('font'), NAME, box.x + 2, box.y + 2);
  const x0 = box.x + 2 + NAME.length * 8 + 4;
  const glow = bar.hitAge < BOSS_BAR_LOST && (reduceFlashing || ((frame >> 2) & 1) === 0);
  for (let i = 0; i < bar.max; i++) {
    const x = x0 + i * (NOTCH_W + NOTCH_GAP);
    const top = box.y + 3;
    const lost = i >= bar.hp && i < bar.lostFrom;
    // A white frame, then the notch inside it.
    r.rect(x, top, NOTCH_W, NOTCH_H, WHITE);
    r.rect(x + 1, top + 1, NOTCH_W - 2, NOTCH_H - 2, i < bar.hp ? FULL : lost && glow ? LOST : EMPTY);
  }
}
