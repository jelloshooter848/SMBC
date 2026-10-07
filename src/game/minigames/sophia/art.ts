import type { AssetRegistry } from '@engine/assets/registry';
import type { Renderer } from '@engine/gfx/renderer';
import type { SpriteSheet } from '@engine/gfx/spritesheet';
import { sfx as SFX_LIBRARY } from '@content/sfx/sfx';

/*
 * Underworld's art and sounds, in one place: the `sophia` sheet (S3's NES Blaster Master-style
 * pieces: Jason overhead, Fred, the mutants, the Plutonium Boss, the cutscene), the `bm-dungeon`
 * overhead tiles and the `underworld` side-view theme, and the Blaster Master-style songs and
 * sounds. Until a sheet, frame, palette, theme or sound exists the pieces draw as plain boxes in
 * their colours, the dungeon falls back to the Shadow Keep's tiles (its dark palette), and an
 * unknown sound falls back to a stock one, so nothing here ever throws.
 */

/** The songs: the cutscene, the stage march (the tank), the dungeon, the boss, the win jingle. */
export const BM_MUSIC = {
  cutscene: 'bm-cutscene',
  area: 'bm-area',
  dungeon: 'bm-dungeon',
  boss: 'bm-boss',
  victory: 'castle-clear',
} as const;

/** The sounds, each with the stock sound it falls back to until S3's arrive. */
const SOUNDS = {
  shot: ['jason-shot', 'buster'],
  grenade: ['grenade', 'bomb-blast'],
  toss: ['grenade-toss', 'kick'],
  die: ['mutant-die', 'kick'],
  frog: ['frog', 'jump-small'],
  open: ['sophia-open', 'pipe'],
  hurt: ['jason-hurt', 'hit'],
  hit: ['hurt-enemy', 'hurt-enemy'],
  clang: ['clang', 'bump'],
  capsule: ['capsule', 'pickup'],
  gunUp: ['gun-up', 'powerup'],
  pow: ['powerup', 'powerup'],
  enemyShot: ['boss-shot', 'beam'],
  bossBoom: ['explosion', 'explosion'],
  door: ['door-open', 'door-open'],
  secret: ['secret', 'secret'],
} as const satisfies Record<string, readonly [string, string]>;
export type BmSound = keyof typeof SOUNDS;

const KNOWN_SFX: ReadonlySet<string> = new Set(SFX_LIBRARY.map((s) => s.id));

/** The sound id to play for `s`: S3's once it is in the library, else the stock fallback. */
export function soundId(s: BmSound, known: ReadonlySet<string> = KNOWN_SFX): string {
  const [id, fallback] = SOUNDS[s];
  return known.has(id) ? id : fallback;
}

/** The sheet every Underworld piece is drawn from (shared with Sophia's own art). */
export const SOPHIA_SHEET = 'sophia';
/** The overhead dungeon's tile sheet, and what it falls back to (the Shadow Keep's, its dark palette). */
export const DUNGEON_TILES = 'bm-dungeon';
export const FALLBACK_TILES = 'dungeon';
export const FALLBACK_TILES_PALETTE = 'dungeon-dark';
/** The side-view theme of the cavern (and what it falls back to until registered). */
export const AREA_THEME = 'underworld';
export const AREA_THEME_FALLBACK = 'underground';

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

const NO_FONT: SpriteSheet = { id: 'missing-font', image: null, frames: new Map() };

/** The bitmap font, or an empty stand-in (headless tests), so text calls still happen. */
export function fontSheet(assets: AssetRegistry): SpriteSheet {
  return safeSheet(assets, 'font') ?? NO_FONT;
}

/** The `sophia` sheet, or null while it is not registered. */
export function sophiaSheet(assets: AssetRegistry): SpriteSheet | null {
  return safeSheet(assets, SOPHIA_SHEET);
}

/** Whether the sophia sheet has `frame`. */
export function hasFrame(assets: AssetRegistry, frame: string): boolean {
  return sophiaSheet(assets)?.frames.has(frame) ?? false;
}

/** A plain two-colour box (the fallback look). */
export function box(r: Renderer, x: number, y: number, w: number, h: number, c: Fallback): void {
  const X = Math.round(x);
  const Y = Math.round(y);
  r.rect(X, Y, w, h, c[0]);
  if (w > 2 && h > 2) r.rect(X + 1, Y + 1, w - 2, h - 2, c[1]);
}

/**
 * Draws `frame` of a sheet (null: missing) with its top-left at (x, y), or a `w`×`h` box in
 * `fallback`'s colours while the sheet or frame does not exist.
 */
export function drawPiece(
  r: Renderer,
  sheet: SpriteSheet | null,
  frame: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fallback: Fallback,
  flip = false,
): void {
  if (sheet?.frames.has(frame)) {
    r.sprite(sheet, frame, Math.round(x), Math.round(y), flip);
    return;
  }
  box(r, x, y, w, h, fallback);
}

/** Drawn with the sophia sheet from the registry (the cutscene, the HUD). */
export function drawSophia(
  r: Renderer,
  assets: AssetRegistry,
  frame: string,
  x: number,
  y: number,
  w: number,
  h: number,
  fallback: Fallback,
  flip = false,
): void {
  drawPiece(r, sophiaSheet(assets), frame, x, y, w, h, fallback, flip);
}

/** The fallback colours (NES-ish), by piece. */
export const LOOK = {
  jason: ['#0058f8', '#fcfcfc'],
  jasonHelmet: ['#fcfcfc', '#f83800'],
  shot: ['#fca044', '#fcfcfc'],
  wave: ['#3cbcfc', '#fcfcfc'],
  grenade: ['#005800', '#00a800'],
  boom: ['#f83800', '#fca044'],
  gun: ['#0058f8', '#3cbcfc'],
  pow: ['#a80020', '#f83800'],
  blob: ['#005800', '#58d854'],
  eye: ['#6844fc', '#fcfcfc'],
  turret: ['#545454', '#a4a4a4'],
  orb: ['#58f898', '#d8f878'],
  bossShell: ['#1c3c1c', '#3c7c3c'],
  bossCore: ['#58f898', '#d8f878'],
  bossCoreShut: ['#3c3c3c', '#787878'],
  fred: ['#00a800', '#b8f818'],
  fredBig: ['#005800', '#58d854'],
  chest: ['#7c4c00', '#58f898'],
  hole: ['#000000', '#200808'],
  cutJason: ['#0058f8', '#fcfcfc'],
} as const satisfies Record<string, Fallback>;
