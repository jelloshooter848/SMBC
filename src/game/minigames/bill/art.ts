import type { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { sfx as SFX_LIBRARY } from '@content/sfx/sfx';
import { decorPalette } from '../../entities/objects/decoration';
import { SKY } from '../../world/tile-render';

/*
 * Jungle Assault's art and sounds, in one place: the `contra` sheet (B3's NES Contra-style
 * pieces), the `contra-jungle` and `alien-lair` tile themes, and the Contra-style songs and
 * sounds. Until a sheet, frame, palette, theme or sound exists the pieces draw as plain boxes in
 * their colours, the tiles fall back to the overworld and castle themes, and an unknown sound
 * falls back to a stock one, so nothing here ever throws.
 */

/** The songs: the stage card sting, the stage, the defense wall, Red Falcon's lair, the win. */
export const CONTRA_MUSIC = {
  card: 'contra-card',
  stage: 'contra-stage',
  boss: 'contra-boss',
  lair: 'contra-lair',
  victory: 'castle-clear',
} as const;

/** The sounds, each with the stock sound it falls back to until B3's arrive. */
const SOUNDS = {
  jump: ['jump-small', 'jump-small'],
  shot: ['buster', 'buster'],
  spread: ['spread', 'buster'],
  laser: ['laser', 'beam'],
  fire: ['fireball', 'fireball'],
  boom: ['bridge-boom', 'explosion'],
  falcon: ['falcon', 'powerup'],
  death: ['contra-death', 'hit'],
  konami: ['konami', '1up'],
  hit: ['hurt-enemy', 'hurt-enemy'],
  splash: ['swim', 'swim'],
  enemyShot: ['cannon', 'cannon'],
  barrier: ['powerup-appear', 'powerup-appear'],
  open: ['door-open', 'door-open'],
} as const satisfies Record<string, readonly [string, string]>;
export type ContraSound = keyof typeof SOUNDS;

const KNOWN_SFX: ReadonlySet<string> = new Set(SFX_LIBRARY.map((s) => s.id));

/** The sound id to play for `s`: B3's once it is in the library, else the stock fallback. */
export function soundId(s: ContraSound, known: ReadonlySet<string> = KNOWN_SFX): string {
  const [id, fallback] = SOUNDS[s];
  return known.has(id) ? id : fallback;
}

/** The sheet, its explosion/hit palette and the alien lair's palette. */
export const CONTRA_SHEET = 'contra';
export const CONTRA_FLASH = 'contra-flash';
export const ALIEN_PALETTE = 'alien';
/** The tile themes: the jungle (stage and the defense wall) and Red Falcon's lair. */
export const JUNGLE_THEME = 'contra-jungle';
export const LAIR_THEME = 'alien-lair';
/** What each theme draws as until it is registered. */
const THEME_FALLBACK: Record<string, string> = { [JUNGLE_THEME]: 'overworld', [LAIR_THEME]: 'castle' };

/** The jungle's backdrop colour (B3's SKY entry once registered: a deep jungle night). */
export function jungleSky(): string {
  return SKY[JUNGLE_THEME] ?? '#081c10';
}
export function lairSky(): string {
  return SKY[LAIR_THEME] ?? '#200810';
}

/** A box drawn in place of a frame not drawn yet: outer colour, inner colour. */
export type Fallback = readonly [string, string];

function safeSheet(assets: AssetRegistry, id: string, palette?: string): SpriteSheet | null {
  try {
    if (!assets.has(id)) return null;
    return assets.sheet(id, palette);
  } catch {
    try {
      return palette ? assets.sheet(id) : null;
    } catch {
      return null;
    }
  }
}

/** Whether the contra sheet has `frame`. */
export function hasContraFrame(assets: AssetRegistry, frame: string): boolean {
  return safeSheet(assets, CONTRA_SHEET)?.frames.has(frame) ?? false;
}

/**
 * Draws `frame` of the contra sheet with its top-left at (x, y), or a `w`×`h` box in `fallback`'s
 * colours while the frame does not exist. `palette`: the flash or alien palette.
 */
export function drawContra(
  r: Renderer,
  assets: AssetRegistry,
  frame: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fallback: Fallback,
  flip = false,
  palette?: string,
): void {
  const sheet = safeSheet(assets, CONTRA_SHEET, palette);
  if (sheet?.frames.has(frame)) {
    r.sprite(sheet, frame, Math.round(x), Math.round(y), flip);
    return;
  }
  box(r, x, y, w, h, fallback);
}

/** A plain two-colour box (the fallback look). */
export function box(r: Renderer, x: number, y: number, w: number, h: number, c: Fallback): void {
  const X = Math.round(x);
  const Y = Math.round(y);
  r.rect(X, Y, w, h, c[0]);
  if (w > 2 && h > 2) r.rect(X + 1, Y + 1, w - 2, h - 2, c[1]);
}

/**
 * Bill's own sheet (his Contra form uses his art): `frame` with its top-left at (x, y); false if
 * the sheet or frame is missing (the caller draws a box).
 */
export function drawBill(
  r: Renderer,
  assets: AssetRegistry,
  frame: string,
  x: number,
  y: number,
  flip: boolean,
  flipY = false,
): boolean {
  const sheet = safeSheet(assets, 'bill', 'bill');
  if (!sheet?.frames.has(frame)) return false;
  r.sprite(sheet, frame, Math.round(x), Math.round(y), flip, flipY);
  return true;
}

/** The tiles sheet for `theme`, or its fallback theme's while it is not registered. */
export function tileSheet(
  assets: AssetRegistry,
  theme: string,
): { sheet: SpriteSheet | null; theme: string } {
  const own = safeSheetStrict(assets, 'tiles', `tiles-${theme}`);
  if (own) return { sheet: own, theme };
  const fb = THEME_FALLBACK[theme] ?? 'overworld';
  return { sheet: safeSheetStrict(assets, 'tiles', `tiles-${fb}`) ?? safeSheet(assets, 'tiles'), theme: fb };
}

/** Like safeSheet, but null (not the default colours) when the palette is missing. */
function safeSheetStrict(assets: AssetRegistry, id: string, palette: string): SpriteSheet | null {
  try {
    if (!assets.has(id)) return null;
    return assets.sheet(id, palette);
  } catch {
    return null;
  }
}

/** The decor sheet for the jungle (palms, canopy, mountains), or null until it is there. */
export function decorSheet(assets: AssetRegistry): SpriteSheet | null {
  let palette = 'decor-overworld';
  try {
    palette = decorPalette(JUNGLE_THEME);
  } catch {
    // keep the overworld's
  }
  return safeSheetStrict(assets, 'decor', palette);
}

/** The colours of the boxes drawn while the sheet lacks a frame. */
export const LOOK = {
  soldier: ['#5c2c00', '#c84c0c'],
  rifleman: ['#203c00', '#58a028'],
  bush: ['#003800', '#2c8c2c'],
  gun: ['#3c3c3c', '#a0a0a0'],
  gunOpen: ['#7c0000', '#f83800'],
  cannon: ['#5c1c1c', '#c86c4c'],
  pillbox: ['#3c3c3c', '#787878'],
  pillboxOpen: ['#7c0000', '#fc7460'],
  capsule: ['#3c3c3c', '#bcbcbc'],
  falcon: ['#7c4c00', '#fcd800'],
  bullet: ['#fcfcfc', '#fcfcfc'],
  spread: ['#f83800', '#fcbcb0'],
  laser: ['#3cbcfc', '#a8e4fc'],
  fire: ['#f83800', '#fca044'],
  enemyBullet: ['#fcfcfc', '#f8b800'],
  boom: ['#f83800', '#fcd800'],
  wall: ['#3c3c3c', '#787878'],
  wallTrim: ['#202020', '#5c5c5c'],
  core: ['#7c0000', '#f83800'],
  coreLit: ['#a80020', '#fc7460'],
  heart: ['#5c0020', '#d82800'],
  heartLit: ['#880020', '#fc5c5c'],
  pod: ['#3c1050', '#9c4cbc'],
  larva: ['#305000', '#88d800'],
  medal: ['#7c4c00', '#fcd800'],
  bill: ['#002060', '#3c74e4'],
  bridge: ['#3c3c3c', '#a0a0a0'],
  bridgeLight: ['#a80000', '#fc3c3c'],
} as const satisfies Record<string, Fallback>;
