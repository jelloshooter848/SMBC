import type { Renderer } from '@engine/gfx/renderer';
import { px, tileAt, tileToSub, toPx, velToSub } from '@engine/math/units';
import type { View } from '../entities/entity';
import type { Player } from '../entities/player';
import type { TileMap } from './tilemap';

/*
 * How a hero dies in a World (WorldStart.deathStyle). `hop` is Mario's: the `death` jingle, a
 * pause, then the hop off the bottom of the screen (World.updateDeath keeps that code as it was).
 * The others are the mini games' own NES deaths, each with its own sound in place of the jingle
 * (the music stops):
 *
 * - `orbs` (Mega Man): a short freeze in the hurt pose, then two rings of eight orbs fly out from
 *   him (the inner ring at half speed) and he is gone. A pit death shows no orbs.
 * - `explode` (Samus): she flashes in place (steady with reduce flashing), then breaks into
 *   pieces of her suit that fly apart and fall. A pit death shows nothing.
 * - `collapse` (Simon): no hop; he drops to the floor under gravity (sliding out what is left of
 *   a knockback) and lies there in his `die` frame.
 * - `ninja` (Ryu): thrown up and back in an arc away from where he faces, then he lands and lies
 *   in his `die` frame.
 *
 * For `collapse` and `ninja` the hero's own sprite draws him (its `die` frame while `p.dead`);
 * `p.scratch.deathT` (frames since the death) and `p.body.onGround` let a sprite stage it, e.g. a
 * kneel before he lies flat.
 */

export type DeathStyle = 'hop' | 'orbs' | 'explode' | 'collapse' | 'ninja';

export const DEATH_STYLES: readonly DeathStyle[] = ['hop', 'orbs', 'explode', 'collapse', 'ninja'];

/** Frames from the death to the World's `died` event (hop: the original's 200). */
export const DEATH_FRAMES: Readonly<Record<DeathStyle, number>> = {
  hop: 200,
  orbs: 180,
  explode: 170,
  collapse: 200,
  ninja: 180,
};

/** The sound each style makes in place of the `death` jingle (`hop` keeps the jingle). */
export const DEATH_SFX: Readonly<Record<Exclude<DeathStyle, 'hop'>, string>> = {
  orbs: 'mm-death',
  explode: 'samus-death',
  collapse: 'cv-death',
  ninja: 'ng-death',
};

/** `orbs`: frames he holds still in the hurt pose before the burst. */
export const ORB_HOLD = 10;
/** `orbs`: the two rings' speeds (px a frame) and the orbs in each. */
export const ORB_SPEEDS = [2, 1] as const;
export const ORBS_PER_RING = 8;
/** `explode`: frames she flashes before breaking apart. */
export const EXPLODE_FLASH = 48;
/** `explode`: the suit's pieces (px a frame out from her centre: x, y) and their colours. */
const PIECES: readonly (readonly [number, number])[] = [
  [-2, -3],
  [2, -3],
  [-1, -4],
  [1, -4],
  [-3, -1],
  [3, -1],
  [-2, 0],
  [2, 0],
  [0, -2],
  [-1, -2],
];
const PIECE_COLOURS = ['#d82800', '#fc9838', '#fcfcfc', '#80d010'] as const;
/** `explode`: the pieces' gravity (px a frame, each frame). */
const PIECE_GRAVITY = 0.1;
/** `explode`: the pieces' speed (a share of PIECES' px a frame) and size (px). */
const PIECE_SPEED = 0.6;
export const PIECE_SIZE = 5;
/** `ninja`: the throw (vel units: up, back) and gravity for the arc. */
export const NINJA_THROW_VY = 0x03000;
export const NINJA_THROW_VX = 0x01000;
/** Gravity while a `collapse` or `ninja` body falls (vel units a frame), and its cap. */
export const DEATH_GRAVITY = 0x00300;
const DEATH_MAX_FALL = 0x04000;

/** The death starts (World.kill): the style's first frame of motion. */
export function startDeath(style: DeathStyle, p: Player): void {
  p.scratch.deathT = 0;
  p.invuln = 0;
  const b = p.body;
  if (style === 'ninja') {
    b.vy = -NINJA_THROW_VY;
    b.vx = -p.facing * NINJA_THROW_VX;
    b.onGround = false;
  } else if (style === 'collapse') {
    // Whatever upward push a hit gave is gone: he drops.
    b.vy = Math.max(0, b.vy);
  } else {
    // Mega Man and Samus freeze where they were.
    b.vx = 0;
    b.vy = 0;
  }
}

/** Whether the hero fell out of the bottom of the map (a pit): nothing is drawn then. */
export function fellOut(p: Player, heightPx: number): boolean {
  return toPx(p.body.y) > heightPx;
}

/** One frame (t = frames since the death, from 1) of a non-hop death's motion. */
export function stepDeath(style: DeathStyle, p: Player, t: number, map: TileMap, heightPx: number): void {
  p.scratch.deathT = t;
  if (style !== 'collapse' && style !== 'ninja') return;
  const b = p.body;
  if (fellOut(p, heightPx)) {
    // Down the pit: just keep falling.
    b.vy = Math.min(b.vy + DEATH_GRAVITY, DEATH_MAX_FALL);
    b.y += velToSub(b.vy);
    return;
  }
  if (b.onGround && b.vy >= 0) {
    // On the floor: what is left of the slide dies away.
    b.vx = style === 'collapse' ? Math.trunc(b.vx / 2) : 0;
  }
  // Sideways, stopping at a wall.
  if (b.vx !== 0) {
    const nx = b.x + velToSub(b.vx);
    const edge = b.vx > 0 ? nx + b.w - 1 : nx;
    if (!solidColumn(map, edge, b.y, b.h)) b.x = nx;
    else b.vx = 0;
  }
  // Up and down, landing on the first solid tile under the feet.
  b.vy = Math.min(b.vy + DEATH_GRAVITY, DEATH_MAX_FALL);
  const ny = b.y + velToSub(b.vy);
  if (b.vy > 0) {
    const feetRow = tileAt(ny + b.h - 1);
    if (feetRow >= 0 && solidRow(map, b.x, b.w, feetRow)) {
      b.y = tileToSub(feetRow) - b.h;
      b.vy = 0;
      b.onGround = true;
      return;
    }
  } else if (b.vy < 0) {
    const headRow = tileAt(ny);
    if (headRow >= 0 && solidRow(map, b.x, b.w, headRow)) {
      b.vy = 0;
      return;
    }
  }
  b.y = ny;
  b.onGround = false;
}

function solidRow(map: TileMap, x: number, w: number, row: number): boolean {
  for (let c = tileAt(x); c <= tileAt(x + w - 1); c++) if (map.isSolid(c, row)) return true;
  return false;
}

function solidColumn(map: TileMap, x: number, y: number, h: number): boolean {
  const col = tileAt(x);
  // Only the rows the body spans: a body resting on the floor still slides.
  for (let r = Math.max(0, tileAt(y)); r <= tileAt(y + h - px(1)); r++) if (map.isSolid(col, r)) return true;
  return false;
}

/** The orbs' centres (px, world) at frame t of an `orbs` death, empty before the burst. */
export function orbPositions(p: Player, t: number): { x: number; y: number }[] {
  const age = t - ORB_HOLD;
  if (age <= 0) return [];
  const b = p.body;
  const cx = toPx(b.x + (b.w >> 1));
  const cy = toPx(b.y + (b.h >> 1));
  const out: { x: number; y: number }[] = [];
  for (const speed of ORB_SPEEDS)
    for (let i = 0; i < ORBS_PER_RING; i++) {
      const a = (i * 2 * Math.PI) / ORBS_PER_RING;
      out.push({
        x: cx + Math.round(Math.cos(a) * speed * age),
        y: cy + Math.round(Math.sin(a) * speed * age),
      });
    }
  return out;
}

/** The suit pieces' top-left corners (px, world) at frame t of an `explode` death, empty before. */
export function piecePositions(p: Player, t: number): { x: number; y: number; colour: string }[] {
  const age = t - EXPLODE_FLASH;
  if (age <= 0) return [];
  const b = p.body;
  const cx = toPx(b.x + (b.w >> 1));
  const cy = toPx(b.y + (b.h >> 1));
  return PIECES.map(([vx, vy], i) => ({
    x: cx - (PIECE_SIZE >> 1) + Math.round(vx * PIECE_SPEED * age),
    y: cy - (PIECE_SIZE >> 1) + Math.round(vy * PIECE_SPEED * age + (PIECE_GRAVITY * age * age) / 2),
    colour: PIECE_COLOURS[i % PIECE_COLOURS.length] as string,
  }));
}

/**
 * Draws a non-hop death at frame t (on the World's renderer, which already moves a free camera's
 * map up). True when it drew the hero (or nothing at all, as after the burst); false leaves him to
 * the normal sprite (`collapse`, `ninja`: his `die` frame).
 */
export function renderDeath(
  style: DeathStyle,
  r: Renderer,
  view: View,
  p: Player,
  t: number,
  heightPx: number,
  drawHero: () => void,
): boolean {
  if (style === 'collapse' || style === 'ninja' || style === 'hop') return false;
  if (fellOut(p, heightPx)) return true;
  if (style === 'orbs') {
    if (t <= ORB_HOLD) {
      drawHero();
      return true;
    }
    const s = p.def.sprite(p, view.frame, view.reduceFlashing);
    const sheet = view.assets.sheet(s.sheet, s.palette);
    const orb = sheet.frames.has('death-orb');
    for (const o of orbPositions(p, t)) {
      const x = o.x - view.camX;
      const y = o.y;
      if (orb) r.sprite(sheet, 'death-orb', x - 4, y - 4);
      else {
        r.rect(x - 3, y - 2, 6, 4, '#fcfcfc');
        r.rect(x - 2, y - 3, 4, 6, '#fcfcfc');
      }
    }
    return true;
  }
  // explode
  if (t <= EXPLODE_FLASH) {
    if (view.reduceFlashing || ((t >> 1) & 1) === 0) drawHero();
    return true;
  }
  for (const piece of piecePositions(p, t))
    r.rect(piece.x - view.camX, piece.y, PIECE_SIZE, PIECE_SIZE, piece.colour);
  return true;
}
