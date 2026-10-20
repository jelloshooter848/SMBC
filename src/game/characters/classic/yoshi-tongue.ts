import { px, tileAt, toPx } from '@engine/math/units';
import { overlaps, type AABB } from '@engine/math/aabb';
import type { Renderer } from '@engine/gfx/renderer';
import { Entity, type View } from '../../entities/entity';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import type { Enemy } from '../../entities/enemies/enemy';
import { Goomba } from '../../entities/enemies/goomba';
import { Koopa } from '../../entities/enemies/koopa';
import { Spiny } from '../../entities/enemies/spiny';
import { Cheep } from '../../entities/enemies/cheep';
import { Blooper } from '../../entities/enemies/blooper';
import { Lakitu } from '../../entities/enemies/lakitu';
import { PowerUp } from '../../entities/objects/powerup';
import { Pickup } from '../../entities/objects/pickup';
import { T, tileDef } from '../../level/tiles';

/**
 * Yoshi's tongue and mouth, shared by the playable Classic Yoshi (characters/yoshi/classic.ts) and
 * the Classic mount (characters/classic/yoshi-mount.ts): bug-reports/2026-10-19-yoshi-build-
 * classic-character.md YO-15, YO-16, YO-18, YM-14, YM-15.
 *
 * The tongue is state on the player (`p.scratch._tongue*`) run by `tongueTick` from the hero's
 * own update; `YoshiFx` only draws it (and the egg aim cursor). Catching is an instant kill with
 * no score: the score comes when the catch is swallowed or spat (YO-16).
 */

/** Out 40 px in 10 frames, held 2, back in 10 (YO-15). */
export const TONGUE_REACH = 40;
export const TONGUE_STEP = 4;
export const TONGUE_HOLD = 2;
/** The tip's box (px), and how far below the tongue's line it reaches. */
const TIP = 8;
const TIP_REACH_DOWN = 8;
/** The mouth: px ahead of the hitbox's centre and up from the feet (YO-15's cell point, 10 px under the cell top). */
export const MOUTH_AHEAD = 13;
export const MOUTH_UP = 22;

/** What a catch does (YO-16's table). */
export type Edible = 'mouth' | 'swallow' | 'shell' | null;

/**
 * The edible table (YO-16): the playable hero keeps any catch in his mouth (no Spinies: spiked);
 * the mount swallows Goombas, Spinies, Cheep Cheeps and Lakitu at once and holds Koopas and
 * Buzzy Beetles as shells. Everything else (Hammer Bros, Piranhas, Bullet Bills, Podoboos,
 * Bowser, fire bars) is inedible.
 */
export function edible(e: Enemy, form: 'hero' | 'mount'): Edible {
  if (e instanceof Koopa) return form === 'hero' ? 'mouth' : 'shell';
  if (e instanceof Spiny) return form === 'hero' ? null : 'swallow';
  if (e instanceof Blooper) return form === 'hero' ? 'mouth' : null;
  if (e instanceof Goomba || e instanceof Cheep || e instanceof Lakitu)
    return form === 'hero' ? 'mouth' : 'swallow';
  return null;
}

/** What is in the mouth: the catch's look (for the spit), its stomp score and its shell colour. */
export interface MouthFill {
  sheet: string;
  frame: string;
  palette: string;
  score: number;
  /** A Koopa or Buzzy Beetle (the mount spits it as a kicked shell, YM-15). */
  shell: 'green' | 'red' | 'buzzy' | null;
  /** World frame of the catch (the mount swallows a shell after 600 frames). */
  at: number;
}

const MOUTHS = new WeakMap<Player, MouthFill>();

export function mouthOf(p: Player): MouthFill | null {
  return MOUTHS.get(p) ?? null;
}
export function clearMouth(p: Player): void {
  MOUTHS.delete(p);
}
export function fillMouth(p: Player, fill: MouthFill): void {
  MOUTHS.set(p, fill);
}

/** The mouth point (subpixels). */
export function mouthPoint(p: Player): { x: number; y: number } {
  return { x: p.centerX + p.facing * px(MOUTH_AHEAD), y: p.feetY - px(MOUTH_UP) };
}

/**
 * Where eggs leave from and the aim cursor sweeps around: the throwing hand (the `throw` frame's
 * front arm), px ahead of the hitbox's centre and up from the feet. Level throws then hit enemies
 * on the ground, as the mouth's height would not.
 */
export const HAND_AHEAD = 9;
export const HAND_UP = 13;
export function handPoint(p: Player): { x: number; y: number } {
  return { x: p.centerX + p.facing * px(HAND_AHEAD), y: p.feetY - px(HAND_UP) };
}

/** True while the tongue is out (or coming back). */
export function tongueOut(p: Player): boolean {
  return (p.scratch._tongue ?? 0) > 0;
}

/** Shoots the tongue (YO-15): forward, or up-forward at 45 degrees with Up held. */
export function startTongue(p: Player, up: boolean, world: World): void {
  p.scratch._tongue = 1; // 1 out, 2 held, 3 back
  p.scratch._tongueLen = 0;
  p.scratch._tongueHold = 0;
  p.scratch._tongueUp = up ? 1 : 0;
  world.audio.sfx('yoshi-tongue');
  ensureFx(p, world);
}

export function endTongue(p: Player): void {
  delete p.scratch._tongue;
  delete p.scratch._tongueLen;
  delete p.scratch._tongueHold;
  delete p.scratch._tongueUp;
}

/** The tongue tip's box now (subpixels). */
export function tipBox(p: Player): AABB {
  const m = mouthPoint(p);
  const len = p.scratch._tongueLen ?? 0;
  const up = (p.scratch._tongueUp ?? 0) > 0;
  const across = up ? Math.round(len * 0.7) : len;
  const rise = up ? Math.round(len * 0.7) : 0;
  const cx = m.x + p.facing * px(across);
  const cy = m.y - px(rise);
  // The tip is 8 px wide; its box reaches 12 px below the tongue's line (tuning), so the tongue at
  // Yoshi's mouth height still catches a Goomba on the ground.
  return { x: cx - px(TIP >> 1), y: cy - px(TIP >> 1), w: px(TIP), h: px(TIP + TIP_REACH_DOWN) };
}

/** Starts the tongue back from where it is. */
function retract(p: Player): void {
  p.scratch._tongue = 3;
}

/**
 * One frame of the tongue (YO-15, YM-14): out, held, back. Going out, the tip stops at a solid
 * tile, takes a coin, an item or a drop, and catches the first enemy it touches by `form`'s
 * edible table (an inedible one stops it with the armour sound).
 */
export function tongueTick(p: Player, world: World, form: 'hero' | 'mount'): void {
  const phase = p.scratch._tongue ?? 0;
  if (phase === 0) return;
  let len = p.scratch._tongueLen ?? 0;
  if (phase === 1) {
    len = Math.min(TONGUE_REACH, len + TONGUE_STEP);
    if (len >= TONGUE_REACH) p.scratch._tongue = 2;
  } else if (phase === 2) {
    if ((p.scratch._tongueHold = (p.scratch._tongueHold ?? 0) + 1) >= TONGUE_HOLD) p.scratch._tongue = 3;
  } else {
    len -= TONGUE_STEP;
    if (len <= 0) return endTongue(p);
  }
  p.scratch._tongueLen = len;
  if (phase === 3) return;
  const tip = tipBox(p);
  // The first solid tile stops it (no block strike).
  const tcx = tip.x + (tip.w >> 1);
  const tcy = tip.y + (tip.h >> 1);
  if (world.map.isSolid(tileAt(tcx), tileAt(tcy))) return retract(p);
  // Coins in the grid, power-ups and drops (YO-D5).
  const coin = tileDef(world.map.get(tileAt(tcx), tileAt(tcy)));
  if (coin.pickup === 'coin') {
    world.map.set(tileAt(tcx), tileAt(tcy), T.AIR);
    world.addCoin();
    world.addScore(200);
  }
  for (const e of world.entities) {
    if (!e.alive || !overlaps(tip, e.body)) continue;
    if (e instanceof PowerUp) {
      if (e.item === 'poison' || e.item === 'clock') continue;
      e.destroy();
      world.powerUp(p, e.item);
      return retract(p);
    }
    if (e instanceof Pickup) {
      world.collectPickup(p, e);
      return retract(p);
    }
  }
  for (const e of world.enemies) {
    if (!e.alive || !overlaps(tip, e.body)) continue;
    const what = edible(e, form);
    if (what === null || mouthOf(p)) {
      world.audio.sfx('armour');
      return retract(p);
    }
    catchEnemy(p, e, world, what);
    return retract(p);
  }
}

/** A catch (YO-16): gone at once, scored when swallowed or spat. */
function catchEnemy(p: Player, e: Enemy, world: World, what: Exclude<Edible, null>): void {
  const score = e.scoreFor('stomp');
  const shell = e instanceof Koopa ? e.color : null;
  e.destroy();
  if (what === 'swallow') {
    world.addScore(score, e.body.x, e.body.y);
    world.audio.sfx('yoshi-swallow');
    return;
  }
  fillMouth(p, {
    sheet: e.sheet,
    frame: e.currentFrame || 'goomba-0',
    palette: e.palette({ theme: world.level.theme } as View),
    score,
    shell,
    at: world.frame,
  });
}

/**
 * Draws a player's tongue and egg aim cursor (YO-15, YO-21) over the level. One per player per
 * World, made on first use; gone with the World.
 */
export class YoshiFx extends Entity {
  readonly kind = 'yoshi-fx';
  constructor(readonly owner: Player) {
    super(owner.body.x, owner.body.y, 1, 1);
    this.layer = 'front';
    this.despawnMargin = null;
  }
  update(world: World): void {
    if (!world.players.includes(this.owner)) this.destroy();
    this.body.x = this.owner.body.x;
    this.body.y = this.owner.body.y;
  }
  render(r: Renderer, view: View): void {
    const p = this.owner;
    if (p.dead || p.hidden) return;
    const sheet = view.assets.sheet('yoshi');
    if (tongueOut(p)) {
      const m = mouthPoint(p);
      const tip = tipBox(p);
      const up = (p.scratch._tongueUp ?? 0) > 0;
      const len = p.scratch._tongueLen ?? 0;
      // The middle in 4 px links from the mouth to the tip, then the tip.
      for (let d = 0; d < len - 2; d += 4) {
        const ax = up ? Math.round(d * 0.7) : d;
        const ay = up ? Math.round(d * 0.7) : 0;
        const x = toPx(m.x) + p.facing * ax - (p.facing > 0 ? 0 : 4) - view.camX;
        r.sprite(sheet, 'tongue-mid', x, toPx(m.y) - ay - 1);
      }
      r.sprite(sheet, 'tongue-tip', toPx(tip.x) + 1 - view.camX, toPx(tip.y) + 1);
    }
    const aim = aimAngle(p);
    if (aim !== null) {
      const m = handPoint(p);
      const rad = (aim * Math.PI) / 180;
      const x = toPx(m.x) + p.facing * Math.round(Math.cos(rad) * AIM_RADIUS) - 3 - view.camX;
      const y = toPx(m.y) - Math.round(Math.sin(rad) * AIM_RADIUS) - 3;
      r.sprite(sheet, 'aim-cursor', x, y);
    }
  }
}

/** The cursor's distance from the mouth (px, YO-21). */
export const AIM_RADIUS = 56;
/** The sweep: -10 to +75 degrees and back, 64 frames each way, starting at 0 going up (YO-21). */
export const AIM_LOW = -10;
export const AIM_HIGH = 75;
export const AIM_FRAMES = 64;

/** The aim cursor's angle (degrees above level) `t` frames into a sweep. */
export function sweepAngle(t: number): number {
  const span = AIM_HIGH - AIM_LOW;
  const s = (-AIM_LOW + (t * span) / AIM_FRAMES) % (2 * span);
  return s <= span ? s + AIM_LOW : AIM_HIGH - (s - span);
}

/** The cursor's angle while aiming (p.scratch._aim counts the frames), else null. */
export function aimAngle(p: Player): number | null {
  const t = p.scratch._aim;
  return t === undefined ? null : sweepAngle(t - 1);
}

const FX = new WeakMap<Player, YoshiFx>();

/** The player's drawing entity in this World (made on first use). */
export function ensureFx(p: Player, world: World): void {
  const fx = FX.get(p);
  if (fx && fx.alive && world.entities.includes(fx)) return;
  const n = new YoshiFx(p);
  FX.set(p, n);
  world.spawn(n);
}
