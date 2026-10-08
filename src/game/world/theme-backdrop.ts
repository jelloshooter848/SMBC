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
 * - `megaman-wood` (3-2 as a Wood Man-style forest, 0.4.26): a dark forest at half the camera's
 *   speed: a trunk every FOREST_TRUNK_PERIOD px under a ragged leaf canopy.
 * - `megaman-fortress` (3-4 as Wily's fortress, 0.4.26): a wall of dim machinery from below the
 *   HUD's band down, scrolling with the level, a skull plate every FORTRESS_SKULL_PERIOD px.
 * - `crateria` (Zebes's surface, 4-1 and 4-2's overworld areas, 0.4.27): far rock spires along
 *   the horizon at half the camera's speed, standing on SPIRES_BOTTOM.
 * - `tourian-lair` (4-4 as Mother Brain's lair, 0.4.27): a wall of dim machinery from below the
 *   HUD's band down, scrolling with the level, a glass tube every TOURIAN_TUBE_PERIOD px.
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

/** 3-2's far trunks stand this many px apart (at half the camera's speed). */
export const FOREST_TRUNK_PERIOD = 80;

function woodForest(r: Renderer, view: View): void {
  const sheet = view.assets.sheet('decor', 'decor-megaman-wood');
  if (!sheet.frames.has('mmw-trunk')) return;
  const cam = view.camX >> 1;
  for (let x = -wrap(cam, FOREST_TRUNK_PERIOD); x < SCREEN_W; x += FOREST_TRUNK_PERIOD)
    for (let y = HALL_TOP + 8; y < SCREEN_H; y += 32) r.sprite(sheet, 'mmw-trunk', x + 24, y);
  for (let x = -wrap(cam, 64); x < SCREEN_W; x += 64) r.sprite(sheet, 'mmw-canopy', x, HALL_TOP - 8);
}

/** 3-4's skull plates repeat every this many px of the level. */
export const FORTRESS_SKULL_PERIOD = 256;

function wilyFortress(r: Renderer, view: View): void {
  const sheet = view.assets.sheet('decor', 'decor-megaman-fortress');
  if (!sheet.frames.has('mmf-wall')) return;
  const cam = view.camX;
  for (let x = -wrap(cam, 32); x < SCREEN_W; x += 32)
    for (let y = HALL_TOP; y < SCREEN_H; y += 32) r.sprite(sheet, 'mmf-wall', x, y);
  const first = Math.floor((cam - 64) / FORTRESS_SKULL_PERIOD) * FORTRESS_SKULL_PERIOD;
  for (let base = first; base < cam + SCREEN_W + 64; base += FORTRESS_SKULL_PERIOD)
    r.sprite(sheet, 'mmf-skull', base + 112 - cam, HALL_TOP + 64);
}

/** Zebes's far spires stand on the ground's top (4-1's floor, row 13). */
export const SPIRES_BOTTOM = 13 * 16;

function zebesSpires(r: Renderer, view: View): void {
  const sheet = view.assets.sheet('decor', 'decor-crateria');
  const f = sheet.frames.get('zc-spires');
  if (!f) return;
  const top = SPIRES_BOTTOM - f.h;
  for (let x = -wrap(view.camX >> 1, f.w); x < SCREEN_W; x += f.w) r.sprite(sheet, 'zc-spires', x, top);
}

/** 4-4's glass tubes repeat every this many px of the level. */
export const TOURIAN_TUBE_PERIOD = 192;

function tourianLair(r: Renderer, view: View): void {
  const sheet = view.assets.sheet('decor', 'decor-tourian-lair');
  if (!sheet.frames.has('zt-wall')) return;
  const cam = view.camX;
  for (let x = -wrap(cam, 32); x < SCREEN_W; x += 32)
    for (let y = HALL_TOP; y < SCREEN_H; y += 32) r.sprite(sheet, 'zt-wall', x, y);
  const first = Math.floor((cam - 64) / TOURIAN_TUBE_PERIOD) * TOURIAN_TUBE_PERIOD;
  for (let base = first; base < cam + SCREEN_W + 64; base += TOURIAN_TUBE_PERIOD)
    r.sprite(sheet, 'zt-tube', base + 80 - cam, HALL_TOP + 48);
}

const BACKDROPS: Readonly<Record<string, (r: Renderer, view: View) => void>> = {
  castlevania: castleHall,
  'ninja-city': citySkyline,
  'zelda2-palace': palaceHall,
  // World 3 as Mega Man's world (0.4.26).
  'megaman-wood': woodForest,
  'megaman-fortress': wilyFortress,
  // World 4 as Samus's world, Zebes (0.4.27).
  crateria: zebesSpires,
  'tourian-lair': tourianLair,
};

/** Whether a theme paints a backdrop. */
export const hasThemeBackdrop = (theme: string): boolean => Object.hasOwn(BACKDROPS, theme);

/** Paint the view's theme backdrop (nothing for a theme without one). */
export function drawThemeBackdrop(r: Renderer, view: View): void {
  const paint = hasThemeBackdrop(view.theme) ? BACKDROPS[view.theme] : undefined;
  if (paint && view.assets.has('decor')) paint(r, view);
}
