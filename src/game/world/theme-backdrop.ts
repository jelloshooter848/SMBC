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
 * - World 5 as Simon's world, Transylvania (0.4.28), each under the moon (MOON_X, MOON_Y, fixed
 *   on the screen) but the storm:
 *   - `cv-gate` (5-1): Dracula's castle far off at a quarter of the camera's speed, peeking over
 *     the courtyard's crenellated wall and barred gates at half its speed (standing on GATE_BOTTOM).
 *   - `cv-town` (5-2): the town's rooftops, chimneys and church spire at half the camera's speed.
 *   - `cv-storm` (5-2-sky): the castle far off at a quarter of the camera's speed, and now and then
 *     a bolt of lightning (LIGHTNING_PERIOD; never with reduce flashing).
 *   - `cv-clock` (5-3): the clock tower's dim clock faces every CLOCK_PERIOD px and gears between,
 *     at half the camera's speed.
 * - World 6 as Ryu's world (0.4.29):
 *   - `ng-field` (6-1): the full moon (NG_MOON_X, NG_MOON_Y, fixed on the screen), far peaks at a
 *     quarter of the camera's speed and a bamboo grove at half its speed, standing on GATE_BOTTOM.
 *   - `ng-pass` (6-3): the moon over snowy peaks at a quarter of the camera's speed.
 *   - `ng-temple` (6-4, the demon temple): a carved wall from below the HUD's band down, scrolling
 *     with the level, a demon-headed pillar every TEMPLE_PILLAR_PERIOD px.
 * - World 7 as Bill's world (0.4.30); nothing in these blinks or pulses:
 *   - `contra-snow` (7-1): far snowy peaks at a quarter of the camera's speed, the enemy base's wall
 *     at half its speed, standing on GATE_BOTTOM.
 *   - `contra-base` (7-1-bonus): the corridor wall from below the HUD's band down, with the level.
 *   - `contra-shore` (7-2's way in and out): the jungle's palms and ferns at half the camera's speed.
 *   - `contra-lair` (7-4, Red Falcon's lair): the ribbed organic wall from below the HUD's band down,
 *     with the level, the great heart every LAIR_HEART_PERIOD px.
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

/** World 5's moon, fixed on the screen. */
export const MOON_X = 184;
export const MOON_Y = 36;
/** 5-1's courtyard wall and 5-2's rooftops stand on the ground's top (row 13). */
export const GATE_BOTTOM = 13 * 16;
/** The storm's lightning strikes for LIGHTNING_FLASH frames of every LIGHTNING_PERIOD. */
export const LIGHTNING_PERIOD = 240;
export const LIGHTNING_FLASH = 8;
/** 5-3's clock faces repeat every this many px (at half the camera's speed). */
export const CLOCK_PERIOD = 256;

/** A strip of `frame` tiled along the screen at `camX >> shift`, its bottom on `bottom`. */
function strip(r: Renderer, view: View, palette: string, frame: string, shift: number, bottom: number): void {
  const sheet = view.assets.sheet('decor', palette);
  const f = sheet.frames.get(frame);
  if (!f) return;
  for (let x = -wrap(view.camX >> shift, f.w); x < SCREEN_W; x += f.w)
    r.sprite(sheet, frame, x, bottom - f.h);
}

function moonOver(r: Renderer, view: View, palette: string): void {
  const sheet = view.assets.sheet('decor', palette);
  if (sheet.frames.has('cv-moon')) r.sprite(sheet, 'cv-moon', MOON_X, MOON_Y);
}

function cvGate(r: Renderer, view: View): void {
  moonOver(r, view, 'decor-cv-gate');
  strip(r, view, 'decor-cv-gate', 'cvg-castle', 2, GATE_BOTTOM - 24);
  strip(r, view, 'decor-cv-gate', 'cvg-wall', 1, GATE_BOTTOM);
}

function cvTown(r: Renderer, view: View): void {
  moonOver(r, view, 'decor-cv-town');
  strip(r, view, 'decor-cv-town', 'cvt-roofs', 1, GATE_BOTTOM);
}

function cvStorm(r: Renderer, view: View): void {
  strip(r, view, 'decor-cv-storm', 'cvs-castle', 2, SCREEN_H);
  if (view.reduceFlashing || view.frame % LIGHTNING_PERIOD >= LIGHTNING_FLASH) return;
  const strike = Math.floor(view.frame / LIGHTNING_PERIOD);
  r.sprite(view.assets.sheet('decor', 'decor-cv-storm'), 'cvs-bolt', 32 + ((strike * 97) % 192), HALL_TOP);
}

function cvClock(r: Renderer, view: View): void {
  moonOver(r, view, 'decor-cv-clock');
  const sheet = view.assets.sheet('decor', 'decor-cv-clock');
  if (!sheet.frames.has('cvc-clock')) return;
  const cam = view.camX >> 1;
  const first = Math.floor((cam - 128) / CLOCK_PERIOD) * CLOCK_PERIOD;
  for (let base = first; base < cam + SCREEN_W + 64; base += CLOCK_PERIOD) {
    r.sprite(sheet, 'cvc-clock', base - cam, HALL_TOP + 24);
    r.sprite(sheet, 'cvc-gear', base + 96 - cam, HALL_TOP + 72);
    r.sprite(sheet, 'cvc-gear', base + 120 - cam, HALL_TOP + 96);
  }
}

/** World 6's full moon, fixed on the screen (over the field and the pass). */
export const NG_MOON_X = 40;
export const NG_MOON_Y = 40;
/** 6-4's demon pillars repeat every this many px of the level. */
export const TEMPLE_PILLAR_PERIOD = 224;

function ngMoon(r: Renderer, view: View, palette: string): void {
  const sheet = view.assets.sheet('decor', palette);
  if (sheet.frames.has('ng-moon')) r.sprite(sheet, 'ng-moon', NG_MOON_X, NG_MOON_Y);
}

function ngField(r: Renderer, view: View): void {
  ngMoon(r, view, 'decor-ng-field');
  strip(r, view, 'decor-ng-field', 'ngf-peaks', 2, GATE_BOTTOM - 32);
  strip(r, view, 'decor-ng-field', 'ngf-bamboo', 1, GATE_BOTTOM);
}

function ngPass(r: Renderer, view: View): void {
  ngMoon(r, view, 'decor-ng-pass');
  strip(r, view, 'decor-ng-pass', 'ngp-peaks', 2, SCREEN_H);
}

function ngTemple(r: Renderer, view: View): void {
  const sheet = view.assets.sheet('decor', 'decor-ng-temple');
  if (!sheet.frames.has('ngt-wall')) return;
  const cam = view.camX;
  for (let x = -wrap(cam, 64); x < SCREEN_W; x += 64)
    for (let y = HALL_TOP; y < SCREEN_H; y += 64) r.sprite(sheet, 'ngt-wall', x, y);
  const first = Math.floor((cam - 64) / TEMPLE_PILLAR_PERIOD) * TEMPLE_PILLAR_PERIOD;
  for (let base = first; base < cam + SCREEN_W + 64; base += TEMPLE_PILLAR_PERIOD)
    r.sprite(sheet, 'ngt-pillar', base + 16 - cam, HALL_TOP + 16);
}

function contraSnow(r: Renderer, view: View): void {
  strip(r, view, 'decor-contra-snow', 'cs-peaks', 2, GATE_BOTTOM - 24);
  strip(r, view, 'decor-contra-snow', 'cs-base', 1, GATE_BOTTOM);
}

/** Tile a 64 px wall frame from below the HUD's band down, scrolling with the level. */
function wall64(r: Renderer, view: View, palette: string, frame: string): boolean {
  const sheet = view.assets.sheet('decor', palette);
  if (!sheet.frames.has(frame)) return false;
  for (let x = -wrap(view.camX, 64); x < SCREEN_W; x += 64)
    for (let y = HALL_TOP; y < SCREEN_H; y += 64) r.sprite(sheet, frame, x, y);
  return true;
}

function contraBase(r: Renderer, view: View): void {
  wall64(r, view, 'decor-contra-base', 'cb-wall');
}

function contraShore(r: Renderer, view: View): void {
  strip(r, view, 'decor-contra-shore', 'csh-jungle', 1, GATE_BOTTOM);
}

/** 7-4's heart repeats every this many px of the level. */
export const LAIR_HEART_PERIOD = 320;

function contraLair(r: Renderer, view: View): void {
  if (!wall64(r, view, 'decor-contra-lair', 'cl-wall')) return;
  const sheet = view.assets.sheet('decor', 'decor-contra-lair');
  const cam = view.camX;
  const first = Math.floor((cam - 64) / LAIR_HEART_PERIOD) * LAIR_HEART_PERIOD;
  for (let base = first; base < cam + SCREEN_W + 64; base += LAIR_HEART_PERIOD)
    r.sprite(sheet, 'cl-heart', base + 96 - cam, HALL_TOP + 40);
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
  // World 5 as Simon's world, Transylvania (0.4.28).
  'cv-gate': cvGate,
  'cv-town': cvTown,
  'cv-storm': cvStorm,
  'cv-clock': cvClock,
  // World 6 as Ryu's world (0.4.29).
  'ng-field': ngField,
  'ng-pass': ngPass,
  'ng-temple': ngTemple,
  // World 7 as Bill's world (0.4.30).
  'contra-snow': contraSnow,
  'contra-base': contraBase,
  'contra-shore': contraShore,
  'contra-lair': contraLair,
};

/** Whether a theme paints a backdrop. */
export const hasThemeBackdrop = (theme: string): boolean => Object.hasOwn(BACKDROPS, theme);

/** Paint the view's theme backdrop (nothing for a theme without one). */
export function drawThemeBackdrop(r: Renderer, view: View): void {
  const paint = hasThemeBackdrop(view.theme) ? BACKDROPS[view.theme] : undefined;
  if (paint && view.assets.has('decor')) paint(r, view);
}
