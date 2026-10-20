import type { Renderer } from '@engine/gfx/renderer';
import { px, velToSub } from '@engine/math/units';
import { Entity, type View } from '../entity';
import { moveX } from '../body';
import { BUMP_POP_GRAVITY, BUMP_POP_VY } from '../enemies/enemy';
import type { World } from '../../world/world';

/**
 * `poison` (Lost Levels) slides like a mushroom but hurts on touch; `clock` (Lost Levels) stays
 * on its block like a flower and adds time; `bee` (the Hudson Bee, Classic Hard layers, G-023)
 * stays on its block and is worth 8000 points; `atom`, `hammer` and `wing` (Super Mario Bros.
 * Special, G-022; world/special-items.ts) stay on theirs too (all handled in World.collisions).
 */
export type PowerUpKind =
  | 'mushroom'
  | '1up'
  | 'flower'
  | 'star'
  | 'poison'
  | 'clock'
  | 'bee'
  | 'atom'
  | 'hammer'
  | 'wing'
  /** Special's one full power-up (the original's ExplodingRabbitPowerup: fullyPowerup). */
  | 'rabbit';

/** Items the World takes itself: never a hero's own power-up (CharacterBehaviour.onPowerUp). */
export type WorldItem = 'poison' | 'clock' | 'bee' | 'atom' | 'hammer' | 'wing' | 'rabbit';
/** A power-up a hero takes as its own. */
export type HeroPowerUp = Exclude<PowerUpKind, WorldItem>;
const WORLD_ITEMS: ReadonlySet<PowerUpKind> = new Set<WorldItem>([
  'poison',
  'clock',
  'bee',
  'atom',
  'hammer',
  'wing',
  'rabbit',
]);
export function isWorldItem(kind: PowerUpKind): kind is WorldItem {
  return WORLD_ITEMS.has(kind);
}

/** Items that stay on their block once out (plain Pickups in the original: defyGrav, vy = 0). */
const STAYS: ReadonlySet<PowerUpKind> = new Set(['flower', 'clock', 'bee', 'atom', 'hammer', 'wing', 'rabbit']);

/** The kinds that are the original's Mushroom (red, ST_GREEN and ST_POISON), with its gBounceHit. */
const MUSHROOMS: ReadonlySet<PowerUpKind> = new Set(['mushroom', '1up', 'poison']);

/** A hatched item's hop (PowerUp.hopOut), as a bumped mushroom's pop. */
const HOP_VY = BUMP_POP_VY;

/** An item rising out of a block, then behaving per kind. */
export class PowerUp extends Entity {
  readonly kind = 'powerup';
  private emerging = 32;
  /** Popped up by a bumped block: falls with the bounce gravity until it lands. */
  private bounced = false;
  private readonly targetY: number;
  /**
   * Drawn with this art instead of the item's own (CharacterDef.powerUpArt: Vic Viper's capsule).
   * Null for every Current hero.
   */
  art: { sheet: string; frames: readonly string[] } | null = null;

  constructor(
    tx: number,
    ty: number,
    readonly item: PowerUpKind,
  ) {
    super(px(tx * 16 + 2), px(ty * 16), 12, 16);
    this.targetY = px((ty - 1) * 16);
    this.layer = 'back';
    this.spriteOffsetX = 2;
    this.body.vx = 0;
  }

  /**
   * An item already out (no rise from a block) hopping up from feet at (`cx`, `feet`) (subpixels,
   * its body centred on `cx`), then behaving per kind: the 1-up hatched from a Yoshi egg
   * (objects/yoshi-egg.ts) hops out and runs off to the right like any mushroom.
   */
  static hopOut(cx: number, feet: number, item: PowerUpKind): PowerUp {
    const p = new PowerUp(0, 0, item);
    p.emerging = 0;
    p.layer = 'main';
    p.body.x = cx - (p.body.w >> 1);
    p.body.y = feet - p.body.h;
    p.body.vx = STAYS.has(item) ? 0 : 0x01000;
    p.body.vy = -HOP_VY;
    p.bounced = true;
    return p;
  }

  /** Out of its block (not still rising): it can be touched and taken. */
  get out(): boolean {
    return this.emerging === 0;
  }

  /**
   * The block under it was bumped (Brick.hitObjectsAbove, on a bounce or a break). Mushroom.gBounceHit
   * pops it up with the same BOUNCE_AMT (350 px/s = 2.92 px/f) and BOUNCE_GRAVITY (1500 px/s² =
   * 0.208 px/f²) as KoopaGreen's, that gravity lasting until it lands (Mushroom.groundBelow puts
   * its fall gravity back), and turns it round when its middle is left of the block's
   * (`if (nx < g.hMidX) vx = -vx`). Star, FireFlower and the Clock (a plain Pickup) have no
   * gBounceHit, so they ignore the bump.
   */
  bounceHit(blockMidX: number): void {
    if (this.emerging > 0 || !MUSHROOMS.has(this.item)) return;
    const b = this.body;
    b.vy = -BUMP_POP_VY;
    b.onGround = false;
    this.bounced = true;
    if (b.x + (b.w >> 1) < blockMidX) b.vx = -b.vx;
  }

  update(world: World): void {
    const b = this.body;
    if (this.emerging > 0) {
      this.emerging--;
      b.y -= px(16) / 32;
      if (this.emerging === 0) {
        b.y = this.targetY;
        this.layer = 'main';
        if (!STAYS.has(this.item)) b.vx = 0x01000;
        if (this.item === 'star') b.vy = -0x04000;
      }
      return;
    }
    // The original's Clock (pickups/Clock.as) is a plain Pickup: it rises out of the block and
    // stays there (defyGrav, vy = 0 in Pickup.exitBrickEnd), like the flower.
    // The Hudson Bee likewise (pickups/HudsonBee.as).
    if (STAYS.has(this.item)) return;
    moveX(b, world.map, velToSub(b.vx));
    if (b.hitWall !== 0) b.vx = -b.hitWall * 0x01000;
    this.fall(world, this.item === 'star' ? 0x00300 : this.bounced ? BUMP_POP_GRAVITY : undefined);
    if (b.onGround) this.bounced = false;
    if (this.item === 'star' && b.onGround) b.vy = -0x04000;
    if (this.isBelowLevel()) this.destroy();
  }

  render(r: Renderer, view: View): void {
    if (this.art) {
      const frames = this.art.frames;
      const f = frames[(view.frame >> 3) % frames.length] as string;
      r.sprite(view.assets.sheet(this.art.sheet), f, this.screenX(view), this.screenY());
      return;
    }
    const sheet = view.assets.sheet('items');
    let frame: string = this.item;
    if (this.item === 'flower') frame = `flower-${(view.frame >> 3) & 1}`;
    if (this.item === 'star') frame = `star-${(view.frame >> 2) & 3}`;
    if (this.item === 'poison') frame = 'poison-mushroom';
    if (this.item === 'bee') frame = `bee-${(view.frame >> 3) & 1}`;
    // Atom and Wing animate on ANIM_MODERATE_TMR (75 ms: about 4 frames); Reduce flashing holds
    // them on their first frame.
    const moderate = view.reduceFlashing ? 0 : Math.floor(view.frame / 4) & 1;
    if (this.item === 'atom') frame = `atom-${moderate}`;
    // The full power-up: drawn as the Fire Flower (the original's art is its maker's logo).
    if (this.item === 'rabbit') frame = `flower-${view.reduceFlashing ? 0 : (view.frame >> 3) & 1}`;
    if (this.item === 'wing') frame = `wing-${moderate}`;
    r.sprite(sheet, frame, this.screenX(view), this.screenY());
  }
}
