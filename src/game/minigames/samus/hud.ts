import type { Renderer } from '@engine/gfx/renderer';
import type { AssetRegistry } from '@engine/assets/registry';
import { SCREEN_W } from '@engine/viewport';
import { fxPalette } from '@content/sprites/palette-fx';
import { TANK_ENERGY } from '../../characters/samus';
import type { Player } from '../../entities/player';

/*
 * Zebes Escape's HUD, as Metroid's: no name, place or score. Top left, the energy tanks as small
 * boxes (filled while full, an outline once spent) over `EN..nn`, the energy in the tank in use,
 * and under it the missile icon with a three-digit count. At the top middle, the escape clock:
 * `TIME` and three digits, from 999 down (TIME_MAX), mapped onto the real countdown.
 */

/** The HUD's left edge and rows (px). */
export const HUD_X = 24;
export const TANKS_Y = 14;
export const EN_Y = 24;
export const MISSILE_Y = 34;
/** A tank box's size (px) and the step between boxes. */
export const TANK_BOX = 6;
export const TANK_STEP = 8;
/** The escape clock: its top (px) and the value it starts from. */
export const TIME_Y = 16;
export const TIME_MAX = 999;

/**
 * Metroid's energy readout: the tanks that are full, and the energy shown after EN (what is in
 * the tank in use, 1..TANK_ENERGY; our tanks hold TANK_ENERGY each, as the base does).
 */
export function energyReadout(hp: number, tanks: number): { full: number; shown: number } {
  if (hp <= 0) return { full: 0, shown: 0 };
  const full = Math.min(tanks, Math.ceil(hp / TANK_ENERGY) - 1);
  return { full, shown: hp - full * TANK_ENERGY };
}

/** The clock's value: `left` of `total` frames mapped onto TIME_MAX..0 (rounded up). */
export function timeShown(left: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(TIME_MAX, Math.ceil((left / total) * TIME_MAX)));
}

/**
 * Whether a sprite of the world reaches a screen box (World.spriteIn): HUD text over one gets a
 * 1-px dark outline so it still reads (as the shared HUD's HudOptions.covered).
 */
export type Covered = (x: number, y: number, w: number, h: number) => boolean;

/** Samus's energy tanks, EN and missiles. */
export function drawEscapeHud(
  r: Renderer,
  assets: AssetRegistry,
  p: Player | undefined,
  covered?: Covered,
): void {
  if (!p) return;
  const tanks = p.scratch.tanks ?? 0;
  const { full, shown } = energyReadout(p.hp, tanks);
  for (let i = 0; i < tanks; i++) {
    const x = HUD_X + 16 + i * TANK_STEP;
    if (i < full) r.rect(x, TANKS_Y, TANK_BOX, TANK_BOX, '#fcfcfc');
    else {
      r.rect(x, TANKS_Y, TANK_BOX, 1, '#fcfcfc');
      r.rect(x, TANKS_Y + TANK_BOX - 1, TANK_BOX, 1, '#fcfcfc');
      r.rect(x, TANKS_Y, 1, TANK_BOX, '#fcfcfc');
      r.rect(x + TANK_BOX - 1, TANKS_Y, 1, TANK_BOX, '#fcfcfc');
    }
  }
  hudText(r, assets, `EN..${String(shown).padStart(2, '0')}`, HUD_X, EN_Y, covered);
  r.sprite(assets.sheet('items'), 'icon-missile', HUD_X, MISSILE_Y - 1);
  const missiles = String(Math.max(0, p.scratch.missiles ?? 0)).padStart(3, '0');
  hudText(r, assets, missiles, HUD_X + 16, MISSILE_Y, covered);
}

/** How the clock reads: plain, red in the last ten seconds, or grey while it holds. */
export type TimeTint = 'plain' | 'final' | 'held';
/** The font palettes (content/sprites/font.ts fontTints) for the clock's tints. */
export const TIME_PALETTES = {
  red: 'font-red',
  dark: 'font-red-dark',
  held: 'font-grey',
} as const;

/**
 * The font palette the clock is drawn in at frame t: none when plain; red in the final stretch
 * (pulsing to a dark red, steady with reduce flashing); grey while Infinite time holds it.
 */
export function timePalette(tint: TimeTint, t: number, reduceFlashing: boolean): string | undefined {
  if (tint === 'held') return TIME_PALETTES.held;
  if (tint === 'final')
    return reduceFlashing || ((t >> 3) & 1) === 0 ? TIME_PALETTES.red : TIME_PALETTES.dark;
  return undefined;
}

/** The escape clock: TIME and its three digits, at the top middle, in `palette` (timePalette). */
export function drawTimeCounter(
  r: Renderer,
  assets: AssetRegistry,
  value: number,
  covered?: Covered,
  palette?: string,
): void {
  const text = `TIME ${String(value).padStart(3, '0')}`;
  hudText(r, assets, text, (SCREEN_W - text.length * 8) >> 1, TIME_Y, covered, palette);
}

/** The dark outline's offsets: the text's silhouette once each way, under it. */
const OUTLINE: readonly (readonly [number, number])[] = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

/** HUD text in the bitmap font; outlined in black when a sprite is under it. */
function hudText(
  r: Renderer,
  assets: AssetRegistry,
  text: string,
  x: number,
  y: number,
  covered?: Covered,
  palette?: string,
): void {
  if (covered?.(x, y, text.length * 8, 8)) {
    const dark = assets.sheet('font', fxPalette('font', 'silhouette'));
    for (const [dx, dy] of OUTLINE) r.text(dark, text, x + dx, y + dy);
  }
  r.text(palette ? assets.sheet('font', palette) : assets.sheet('font'), text, x, y);
}
