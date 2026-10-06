import type { Renderer } from '@engine/gfx/renderer';
import { TILE, centre, type Box, type Dir } from '../../topdown/geometry';
import { Poof, TdEnemy } from '../../topdown/entity';
import { Projectile } from '../../topdown/enemies';
import type { TdView } from '../../topdown/view';
import type { TopDownWorld } from '../../topdown/world';

export const KEEPER_HP = 8;
/** Frames between spells (and while badly hurt), and how long it glows before casting. */
export const CAST_EVERY = 110;
export const CAST_EVERY_ANGRY = 76;
export const GLOW_FRAMES = 32;
/** Frames it can't be hurt after a hit. */
export const KEEPER_INVULN = 30;
export const SPELL_SPEED = 1.5;
/** The fan: three spells, this far apart (radians). */
export const SPELL_SPREAD = 0.4;
/** It drifts between these x (room px). */
export const DRIFT_MIN = 2 * TILE;
export const DRIFT_MAX = 12 * TILE;
/** A boomerang only makes it falter for half a second. */
export const KEEPER_STUN = 30;

const BOB = [0, 1, 2, 2, 1, 0, -1, -1] as const;

/**
 * The keeper's spell: a slow orb fired at an angle. Step aside, or (with the magic shield from
 * the shrine) face it: the shield stops it from the front like a rock (by its main axis).
 */
export class Spell extends Projectile {
  constructor(x: number, y: number, angle: number) {
    super(x, y, Math.cos(angle) * SPELL_SPEED, Math.sin(angle) * SPELL_SPEED, null);
    this.frames = ['spell-0', 'spell-1'];
    this.color = '#d800cc';
  }
}

/**
 * The keeper of the spell: a hooded shadow (32×32) that drifts from side to side across the top
 * of its room with a slow bob. Every couple of seconds it stops and glows, then casts three
 * spells fanned out at Link. Eight sword hits (a bomb counts two); it glows faster once it is down
 * to half. A boomerang only stops it for half a second. It stays still until Link has stepped
 * into the room (the shutters close behind him); its spells vanish when it falls.
 */
export class Keeper extends TdEnemy {
  readonly kind = 'keeper';
  hp = KEEPER_HP;
  override w = 32;
  override h = 32;
  override contact = 2;
  override knockable = false;
  override dropChance = 0;
  override mover = 'fly' as const;
  /** Frames until the next glow. */
  castT = CAST_EVERY;
  /** Frames into the glow (0 = drifting). */
  glowT = 0;
  vx: 1 | -1 = 1;
  private readonly baseY: number;
  private t = 0;
  awake = false;

  constructor(x: number, y: number) {
    super(x, y);
    this.baseY = y;
  }

  override hurtbox(): Box {
    return { x: this.x + 4, y: this.y + 4, w: 24, h: 26 };
  }

  get angry(): boolean {
    return this.hp <= KEEPER_HP / 2;
  }

  protected think(world: TopDownWorld): void {
    if (!this.awake) {
      if (!world.sealed) return;
      this.awake = true;
      world.emit({ type: 'keeper-wakes' });
    }
    this.t++;
    if (this.glowT > 0) {
      if (++this.glowT >= GLOW_FRAMES) {
        this.cast(world);
        this.glowT = 0;
        this.castT = this.angry ? CAST_EVERY_ANGRY : CAST_EVERY;
      }
      return;
    }
    // Drift: a pixel a frame (a little faster when angry), turning at the ends.
    const step = this.angry && (this.t & 1) === 0 ? 2 : 1;
    this.x += this.vx * step;
    if (this.x <= DRIFT_MIN) {
      this.x = DRIFT_MIN;
      this.vx = 1;
    } else if (this.x >= DRIFT_MAX - this.w) {
      this.x = DRIFT_MAX - this.w;
      this.vx = -1;
    }
    this.y = this.baseY + (BOB[(this.t >> 3) & 7] ?? 0);
    if (--this.castT <= 0) this.glowT = 1;
  }

  private cast(world: TopDownWorld): void {
    const me = centre(this.hurtbox());
    const link = centre(world.hero.hurtbox());
    const aim = Math.atan2(link.y - me.y, link.x - me.x);
    for (const k of [-1, 0, 1]) world.add(new Spell(me.x - 4, me.y - 4, aim + k * SPELL_SPREAD));
    world.emit({ type: 'cast' });
  }

  override hurt(world: TopDownWorld, damage: number, dir: Dir): boolean {
    if (!this.awake) return false;
    const hit = super.hurt(world, damage, dir);
    if (hit && !this.dead) this.invuln = KEEPER_INVULN;
    return hit;
  }

  override stunFor(_frames: number): number {
    return this.awake ? KEEPER_STUN : 0;
  }

  override die(world: TopDownWorld): void {
    super.die(world);
    // Its spells die with it.
    for (const e of world.entities) if (e instanceof Spell) e.dead = true;
    for (const [dx, dy] of [
      [-10, -8],
      [10, -8],
      [-10, 8],
      [10, 8],
    ] as const)
      world.add(new Poof(this.x + 8 + dx, this.y + 8 + dy));
  }

  render(r: Renderer, view: TdView, ox: number, oy: number): void {
    const sheet = view.sheet(view.sheets.enemies);
    const f = this.invuln > 0 ? 'keeper-hit' : this.glowT > 0 ? 'keeper-1' : 'keeper-0';
    if (sheet?.frames.has(f)) r.sprite(sheet, f, ox + this.x, oy + this.y);
    else {
      r.rect(
        ox + this.x + 2,
        oy + this.y + 2,
        28,
        28,
        this.invuln > 0 ? '#fcfcfc' : this.glowT > 0 ? '#d800cc' : '#281048',
      );
      r.rect(ox + this.x + 9, oy + this.y + 10, 4, 4, '#f8b800');
      r.rect(ox + this.x + 19, oy + this.y + 10, 4, 4, '#f8b800');
    }
  }
}
