import type { Renderer } from '@engine/gfx/renderer';
import type { Player } from '../../entities/player';
import { MAX_HP } from '../../characters/megaman';

/*
 * Station Escape's HUD, as Mega Man 2's: bars only, no names, score or lives. Top left, side by
 * side: the selected weapon's energy (while a weapon or Rush is in hand),
 * Mega Man's life, and the boss's life once he appears. Each is 28 segments of 2 px (a light line
 * over a coloured one), on black. Positions are from memory of the NES screens (weapon bar at
 * x 16, life at x 24, boss at x 40, the bars' tops at y 24).
 */

export const BAR_SEGMENTS = 28;
export const WEAPON_BAR_X = 16;
export const LIFE_BAR_X = 24;
export const BOSS_BAR_X = 40;
export const BAR_Y = 24;
/** The bars' bottom edge (px): banners go below it. */
export const BAR_BOTTOM = BAR_Y + BAR_SEGMENTS * 2;

export const LIFE_COLOUR = '#f8d878';
export const BOSS_COLOUR = '#f83800';

/** One vertical bar at x: `value` of `max` lit from the bottom, in `colour`. */
export function drawBar(r: Renderer, x: number, value: number, max: number, colour: string): void {
  const segs = BAR_SEGMENTS;
  const lit = Math.round((Math.max(0, Math.min(value, max)) / max) * segs);
  r.rect(x - 1, BAR_Y - 1, 8, segs * 2 + 2, '#000');
  for (let i = 0; i < segs; i++) {
    const on = i < lit;
    const y = BAR_Y + (segs - 1 - i) * 2;
    r.rect(x, y, 6, 1, on ? '#fcfcfc' : '#404040');
    r.rect(x, y + 1, 6, 1, on ? colour : '#202020');
  }
}

/** Mega Man's bars: life, and the weapon's energy while a weapon is selected. */
export function drawStationHud(r: Renderer, p: Player | undefined): void {
  if (!p) return;
  drawBar(r, LIFE_BAR_X, p.hp, MAX_HP, LIFE_COLOUR);
  const m = p.def.meter?.(p);
  if (m) drawBar(r, WEAPON_BAR_X, m.value, m.max, m.colour);
}

/** The boss's bar (his 28 hit points, or as far as it has filled). */
export function drawBossBar(r: Renderer, value: number, max = BAR_SEGMENTS): void {
  drawBar(r, BOSS_BAR_X, value, max, BOSS_COLOUR);
}
