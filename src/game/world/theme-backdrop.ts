import type { Renderer } from '@engine/gfx/renderer';
import { SCREEN_H, SCREEN_W } from '@engine/viewport';
import type { View } from '../entities/entity';

/*
 * Backdrops painted behind a theme's level, in screen space before the decor and the tiles (World
 * draws them over the sky): the 0.4.12 restyles' halls and skylines, so a level in that look needs
 * no decor of its own for it. Each is made of decor-sheet frames in the theme's decor palette.
 *
 * - `castlevania` (5-4 as Simon's castle hall): the hall's grey brick wall from below the HUD's
 *   band down, scrolling with the level, a dim stone column every 256 px (in the wall's own dark greys, so it never reads as
 *   solid stone) and two tall arched windows
 *   between each pair.
 * - `ninja-city` (6-2 as Ryu's city street): the far city's towers along the street, at half the
 *   camera's speed, under the black night.
 * - `zelda2-palace` (2-4 as Link's palace, 0.4.24): the hall's dim brick wall from below the HUD's
 *   band down, scrolling with the level, a red curtain every PALACE_CURTAIN_PERIOD px hanging from
 *   the wall's top (behind the ceiling where it is thick); the knight statues are the level's own
 *   decor.
 */

/** The black band left at the top for the HUD (a vampire-hunting stage keeps its HUD on black). */
export const HALL_TOP = 32;
/** Columns and windows repeat every this many px of the level. */
export const HALL_PERIOD = 256;
/** The arched windows' left edges within each period. */
export const HALL_WINDOWS: readonly number[] = [80, 176];
/** The column's left edge within each period. */
export const HALL_PILLAR = 16;
/** The far city stands on the street's top (6-2's ground, row 13). */
export const SKYLINE_BOTTOM = 13 * 16;

const wrap = (n: number, m: number): number => ((n % m) + m) % m;

function castleHall(r: Renderer, view: View): void {
  const sheet = view.assets.sheet('decor', 'decor-castlevania');
  if (!sheet.frames.has('cv-wall')) return;
  const cam = view.camX;
  for (let x = -wrap(cam, 32); x < SCREEN_W; x += 32)
    for (let y = HALL_TOP; y < SCREEN_H; y += 32) r.sprite(sheet, 'cv-wall', x, y);
  const first = Math.floor((cam - 64) / HALL_PERIOD) * HALL_PERIOD;
  for (let base = first; base < cam + SCREEN_W + 64; base += HALL_PERIOD) {
    for (const wx of HALL_WINDOWS) r.sprite(sheet, 'cv-window', base + wx - cam, HALL_TOP + 56);
    const px = base + HALL_PILLAR - cam;
    for (let y = HALL_TOP + 16; y < SCREEN_H; y += 32) r.sprite(sheet, 'cv-pillar', px, y);
    r.sprite(sheet, 'cv-pillar-cap', px, HALL_TOP);
  }
}

function citySkyline(r: Renderer, view: View): void {
  const sheet = view.assets.sheet('decor', 'decor-ninja-city');
  const f = sheet.frames.get('ng-skyline');
  if (!f) return;
  const top = SKYLINE_BOTTOM - f.h;
  for (let x = -wrap(view.camX >> 1, f.w); x < SCREEN_W; x += f.w) r.sprite(sheet, 'ng-skyline', x, top);
}

/** 2-4's palace curtains repeat every this many px of the level. */
export const PALACE_CURTAIN_PERIOD = 192;

function palaceHall(r: Renderer, view: View): void {
  const sheet = view.assets.sheet('decor', 'decor-zelda2-palace');
  if (!sheet.frames.has('z2-palace-wall')) return;
  const cam = view.camX;
  for (let x = -wrap(cam, 32); x < SCREEN_W; x += 32)
    for (let y = HALL_TOP; y < SCREEN_H; y += 32) r.sprite(sheet, 'z2-palace-wall', x, y);
  const first = Math.floor((cam - 64) / PALACE_CURTAIN_PERIOD) * PALACE_CURTAIN_PERIOD;
  for (let base = first; base < cam + SCREEN_W + 64; base += PALACE_CURTAIN_PERIOD)
    r.sprite(sheet, 'z2-curtain', base + 80 - cam, HALL_TOP);
}

const BACKDROPS: Readonly<Record<string, (r: Renderer, view: View) => void>> = {
  castlevania: castleHall,
  'ninja-city': citySkyline,
  'zelda2-palace': palaceHall,
};

/** Whether a theme paints a backdrop. */
export const hasThemeBackdrop = (theme: string): boolean => Object.hasOwn(BACKDROPS, theme);

/** Paint the view's theme backdrop (nothing for a theme without one). */
export function drawThemeBackdrop(r: Renderer, view: View): void {
  const paint = hasThemeBackdrop(view.theme) ? BACKDROPS[view.theme] : undefined;
  if (paint && view.assets.has('decor')) paint(r, view);
}
