import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx, velToSub } from '@engine/math/units';
import { ENTITY_GRAVITY, ENTITY_MAX_FALL, Entity, type View } from '../entity';
import { moveX } from '../body';
import type { World } from '../../world/world';
import {
  BASIC_VULNERABILITY,
  STUN_FRAMES,
  type DamageKind,
  type DamageSource,
  type Reaction,
  type Vulnerability,
} from '../../rules/damage';
import { ENEMY_SCORES, killScore, type KillScores } from '../../rules/score';
import { CORPSE_GRAVITY_DEFAULT, Corpse } from '../effects/effects';
import { isSwimLevel, type Theme } from '../../level/schema';

/**
 * A block bumped under a koopa or spiny pops it up (KoopaGreen.gBounceHit / Spiney.gBounceHit):
 * `vy = -BOUNCE_AMT` (350 px/s) and `gravity = BOUNCE_GRAVITY` (1500 px/s²), at the original's
 * SCALE 2 and 60 frames a second: 2.92 px/f and 0.208 px/f².
 */
export const BUMP_POP_VY = 0x02eab;
export const BUMP_POP_GRAVITY = 0x00355;

export function enemyPalette(theme: Theme): string {
  switch (theme) {
    case 'underground':
    case 'cavern':
    case 'underworld':
    case 'brinstar':
      return 'enemies-underground';
    case 'castle':
    case 'castle-water':
    case 'station':
    case 'airship':
    case 'crypt':
    case 'dojo':
    case 'alien-lair':
    case 'bm-dungeon':
    case 'castlevania': // 5-4's castle hall is a castle still (Podoboos; Bowser's true form)
      return 'enemies-castle';
    case 'water':
      return 'enemies-water';
    default:
      return 'enemies-overworld';
  }
}

export abstract class Enemy extends Entity {
  hp = 1;
  vulnerability: Vulnerability = { ...BASIC_VULNERABILITY };
  /** Touching this enemy (other than a stomp) hurts the player. */
  contactHurts = true;
  /** Can the player stomp this (false for things that are "not standing on anything" like fire bars). */
  stompable = true;
  /** Points by how it dies (the original's ScoreValue.as `<NAME>_STOMP/_ATTACK/_STAR/_BELOW`). */
  scores: KillScores = ENEMY_SCORES.DEFAULT;
  walkSpeed = 0x00800; // 0.5 px/f
  fallsOffLedges = true;
  /** Sprite frame drawn this frame (also used for the corpse). */
  currentFrame = '';
  sheet = 'enemies';
  /** Set once the enemy has been on screen (SMB1 enemies don't activate until seen). */
  activated = false;
  /** Frames of being dead-but-visible (squash). */
  protected dying = 0;
  /** Frames left frozen by a stun (boomerang); the world skips update() while > 0. */
  stunned = 0;
  /** Draw the knocked-out corpse flipped vertically (things that hang upside down). */
  protected corpseFlipY = false;
  /**
   * Gravity the knocked-out corpse falls with: the enemy's own `gravity` in the original
   * (AnimatedObject's default 500 Flash px/s² unless its setStats changes it).
   */
  protected corpseGravity = CORPSE_GRAVITY_DEFAULT;
  /** Popped up by a bumped block: falls with BUMP_POP_GRAVITY until it lands. */
  protected bumpPopped = false;

  constructor(x: number, y: number, wPx: number, hPx: number) {
    super(x, y, wPx, hPx);
    this.body.vx = -this.walkSpeed;
  }

  palette(view: View): string {
    return enemyPalette(view.theme);
  }

  /** Palette the knocked-out corpse is drawn with. */
  protected corpsePalette(theme: Theme): string {
    return enemyPalette(theme);
  }

  /** Apply a damage source. Returns the reaction so the world can score it / hurt the attacker. */
  hit(src: DamageSource, world: World): Reaction {
    const reaction = this.vulnerability[src.kind] ?? 'immune';
    switch (reaction) {
      case 'kill':
        if (src.kind === 'stomp') this.squash(world);
        else this.flipOut(src, world);
        this.onKilled(src, world);
        break;
      case 'flip':
        this.flipOut(src, world);
        this.onKilled(src, world);
        break;
      case 'hp':
        this.hp -= src.amount;
        if (this.hp <= 0) {
          this.flipOut(src, world);
          this.onKilled(src, world);
        } else this.onHpHit(src, world);
        break;
      case 'shell':
        this.onShell(src, world);
        break;
      case 'bounce':
        this.onBounce(src, world);
        break;
      case 'stun':
        if (this.stunned > 0) {
          // Already frozen: a second freezing hit shatters it.
          this.flipOut(src, world);
          this.onKilled(src, world);
          return 'kill';
        }
        this.stunned = STUN_FRAMES;
        break;
      case 'immune':
      case 'hurtAttacker':
        break;
    }
    return reaction;
  }

  /** Points for a kill by `kind` (a stomp's value is the floor under the stomp sequence). */
  scoreFor(kind: DamageKind): number {
    return killScore(this.scores, kind);
  }

  /** Called once when a hit kills this enemy (drops, character hooks). */
  protected onKilled(src: DamageSource, world: World): void {
    this.stunned = 0;
    world.enemyKilled(this, src);
  }

  protected onHpHit(_src: DamageSource, _world: World): void {}
  protected onShell(_src: DamageSource, _world: World): void {}
  protected onBounce(_src: DamageSource, _world: World): void {}

  /** Pop up off a bumped block (the shared start of KoopaGreen/Spiney.gBounceHit). */
  protected bumpPop(): void {
    this.body.vy = -BUMP_POP_VY;
    this.body.onGround = false;
    this.bumpPopped = true;
  }

  protected override fall(world: World, gravity = ENTITY_GRAVITY, maxFall = ENTITY_MAX_FALL): void {
    super.fall(world, this.bumpPopped ? BUMP_POP_GRAVITY : gravity, maxFall);
    if (this.body.onGround) this.bumpPopped = false;
  }

  /** Stomped: default is to vanish immediately; walkers override to show a squash frame. */
  protected squash(_world: World): void {
    this.destroy();
  }

  /**
   * Knocked off the screen upside down (Enemy.die; no sideways boost in a water level). With
   * `hop` false it just drops from where it is, as after a `vx = 0; vy = 0` (Bloopa.stomp).
   */
  protected flipOut(src: DamageSource, world: World, hop = true): void {
    // A shot with its own kill effect (Sophia III's explosion) shows that instead of the corpse.
    const o = src.owner as { killEffect?: (world: World, e: Entity) => boolean } | null;
    if (o && typeof o.killEffect === 'function' && o.killEffect(world, this)) {
      this.destroy();
      return;
    }
    const dir = !hop || isSwimLevel(world.level) ? 0 : src.dirX;
    const corpse = new Corpse(
      this.body.x,
      this.body.y,
      toPx(this.body.w),
      toPx(this.body.h),
      this.sheet,
      this.corpsePalette(world.level.theme),
      this.currentFrame,
      dir,
      true,
      this.spriteOffsetX,
      this.spriteOffsetY,
      this.corpseFlipY,
      this.corpseGravity,
    );
    if (!hop) corpse.body.vy = 0;
    world.spawn(corpse);
    this.destroy();
  }

  /** Walk, reverse at walls, optionally turn at ledges, and fall. */
  protected patrol(world: World): void {
    const b = this.body;
    if (!this.fallsOffLedges && b.onGround) {
      const aheadX = b.vx < 0 ? b.x - px(1) : b.x + b.w + px(1);
      const tx = aheadX >> 12;
      const ty = (b.y + b.h + px(1)) >> 12;
      if (!world.map.isSolid(tx, ty) && world.map.collisionAt(tx, ty) !== 'top') b.vx = -b.vx;
    }
    moveX(b, world.map, velToSub(b.vx));
    if (b.hitWall !== 0) b.vx = -b.hitWall * this.walkSpeed;
    this.fall(world);
    this.facing = b.vx > 0 ? 1 : -1;
  }

  /** Enemies turn around when they bump into each other. */
  bounceOff(other: Enemy): void {
    const a = this.body;
    const b = other.body;
    const aLeft = a.x + a.w / 2 < b.x + b.w / 2;
    a.vx = (aLeft ? -1 : 1) * Math.abs(a.vx || this.walkSpeed);
  }

  render(r: Renderer, view: View): void {
    if (!this.currentFrame) return;
    // A stunned enemy flickers (skipped every fourth frame) unless reduced flashing is on.
    if (this.stunned > 0 && !view.reduceFlashing && (view.frame & 3) === 0) return;
    const sheet = view.assets.sheet(this.sheet, this.palette(view));
    r.sprite(sheet, this.currentFrame, this.screenX(view), this.screenY(), this.facing > 0);
  }
}
