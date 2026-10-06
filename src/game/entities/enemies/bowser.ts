import { px, toPx, velToSub } from '@engine/math/units';
import { Enemy } from './enemy';
import { ENEMY_SCORES } from '../../rules/score';
import type { World } from '../../world/world';
import type { DamageSource } from '../../rules/damage';
import { Projectile, BOWSER_FLAME, HAMMER, type ProjectileSpec } from '../projectiles/projectile';
import { Corpse } from '../effects/effects';
import { moveX } from '../body';
import { T } from '../../level/tiles';

export type BowserAttack = 'fire' | 'hammer' | 'both';

/*
 * Numbers from the original's com/smbc/enemies/Bowser.as (px/s and ms at 32 px tiles; ours is
 * 16 px tiles at 60 frames a second, so v px/s = v / 120 px/f = v * 4096 / 120 velocity units).
 */
/** WALK_SPEED = 30 px/s: 0.25 px/f. */
const WALK_SPEED = 0x00400;
/** RUN_SPEED = 62 px/s: 0.52 px/f. */
const RUN_SPEED = 0x00844;
/** jumpPwr = 280 px/s (Bowser.initiate): 2.33 px/f. */
const JUMP_VY = 0x02555;
/** AnimatedObject.gravity = 500 px/s² (Bowser keeps the default): 0.069 px/f². */
const GRAVITY = 0x0011c;
/** MAX_FIREBALLS_ON_SCREEN and MAX_HAMMERS_ON_SCREEN. */
const MAX_FLAMES = 2;
const MAX_HAMMERS = 6;
/** BowserFake.WALK_DISTANCE = TILE_SIZE * 5. */
const FAKE_WALK = px(5 * 16);
/** Milliseconds to frames. */
const ms = (n: number): number => Math.max(1, Math.round((n * 60) / 1000));
/** FB_DEL_TMR (450 ms) and AFTER_FB_TMR (300 ms). */
const FB_DELAY = ms(450);
const AFTER_FB = ms(300);

/** BowserFireBall.as: SPEED = 160 px/s (1.33 px/f), always to the left. */
const FLAME_SPEED = 0x01555;
/**
 * BowserFireBall.updateStats: ny moves 3 px a frame toward its height at the original's 30 fps
 * (90 px/s: 0.75 px per frame of ours), snapping within 5 px (2.5 of ours).
 */
const FLAME_DRIFT = px(0.75);
const FLAME_SNAP = px(2.5);

/** Hammer.as: xSpeed 120 px/s (1 px/f), jumpPwr 200 px/s (1.67 px/f), gravity 500 px/s². */
const BOWSER_HAMMER: ProjectileSpec = { ...HAMMER, gravity: GRAVITY };
const HAMMER_VX = 0x01000;
const HAMMER_VY = 0x01aab;

/** Bowser's own flame: flies left and drifts up or down to its chosen height (BowserFireBall.as). */
class BowserFlame extends Projectile {
  constructor(
    x: number,
    y: number,
    private readonly targetY: number,
    owner: Bowser,
  ) {
    super(x, y, -1, BOWSER_FLAME, owner, { vx: -FLAME_SPEED });
  }

  override update(world: World): void {
    super.update(world);
    const b = this.body;
    if (b.y < this.targetY - FLAME_SNAP) b.y += FLAME_DRIFT;
    else if (b.y > this.targetY + FLAME_SNAP) b.y -= FLAME_DRIFT;
    else b.y = this.targetY;
  }
}

/**
 * The castle boss (Bowser.as). In his normal state he faces left and paces slowly inside his
 * window, hops on a 0.4-3 s timer, stops for 450 ms before each flame and sets off left or right
 * after it; hammer Bowsers throw single hammers every 40-199 ms. Once the player is behind him he
 * turns and runs at him (no fire, hammers or jumps), stopping at the end of the bridge. Five hits
 * from fire/buster/sword; the axe drops him through the bridge.
 */
export class Bowser extends Enemy {
  readonly kind = 'bowser';
  private mouthOpen = 0;
  private dead = false;
  private started = false;
  private chasing = false;
  /** Hit-box window (Bowser.xMin/xMax, subpixels): the bridge's, or ±5 tiles for a fake. */
  private xMin = 0;
  private xMax = 0;
  /** Feet at spawn: the flames' three heights hang off this (Bowser.initiate fbLev1-3). */
  private readonly feetY: number;
  /** Timers in frames; 0 = not running. */
  private jumpTmr = 0;
  private fbTmr = 0;
  private fbDelTmr = 0;
  private afterFbTmr = 0;
  private hammerTmr = 0;
  private firstFb = true;

  constructor(
    tx: number,
    ty: number,
    readonly attack: BowserAttack = 'fire',
    /** The Lost Levels' fake Bowser: a plain fight, not the bridge boss the axe drops. */
    readonly fake = false,
  ) {
    super(px(tx * 16 + 2), px((ty + 1) * 16 - 30), 28, 30);
    this.feetY = this.body.y + this.body.h;
    this.hp = 5;
    this.scores = ENEMY_SCORES.BOWSER;
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.walkSpeed = WALK_SPEED;
    this.vulnerability = {
      fireball: 'hp',
      buster: 'hp',
      sword: 'hp',
      stomp: 'hurtAttacker',
      star: 'immune',
      shell: 'immune',
      bump: 'immune',
      axe: 'kill',
      bomb: 'hp',
      weapon: 'hp',
      boomerang: 'immune',
      ice: 'immune',
    };
    // Bowser.initiate: vx = -WALK_SPEED.
    this.body.vx = -WALK_SPEED;
    this.currentFrame = 'bowser-0';
  }

  private get shootsFire(): boolean {
    return this.attack !== 'hammer';
  }
  private get throwsHammers(): boolean {
    return this.attack !== 'fire';
  }

  protected override onHpHit(_src: DamageSource, _world: World): void {
    this.mouthOpen = 10;
  }

  /**
   * Bowser.die: Enemy.die turns him upside down and pops him up, then he shows the world's
   * `die_N` frame (FL_DIE + level.worldNum) and drops straight down (vx = 0). Worlds 1-7 show
   * the true form; world 8 (and the Lost Levels' later worlds, which have no frame of their own)
   * the king himself. The true form sits at his head end, so it keeps the way he was facing; in a
   * castle it takes the grey-outlined `bowser-true-form` palette so it shows on the black.
   */
  protected override flipOut(_src: DamageSource, world: World): void {
    const n = Math.min(8, Math.max(1, world.state.world | 0));
    const palette = this.corpsePalette(world.level.theme);
    const corpse = new Corpse(
      this.body.x,
      this.body.y,
      toPx(this.body.w),
      toPx(this.body.h),
      this.sheet,
      n < 8 && palette === 'enemies-castle' ? 'bowser-true-form' : palette,
      `bowser-die-${n}`,
      0, // drops straight down
      false,
      this.spriteOffsetX,
      this.spriteOffsetY,
      true,
    );
    corpse.facing = this.facing;
    world.spawn(corpse);
    world.audio.sfx('bowser-fall');
    this.destroy();
  }

  fallDead(): void {
    this.dead = true;
    this.contactHurts = false;
    this.stompable = false;
    this.body.vx = 0;
  }

  /** First update: the jump timer (started in the constructor in the original) and the window. */
  private start(world: World): void {
    this.started = true;
    this.jumpTmr = this.jumpDelay(world);
    if (this.fake) return this.fakeWindow();
    // BowserAxe.setUpBridge -> getXMaxMin(bridgeEnd, bridgeStart): xMin = leftmost piece + 3
    // tiles, xMax = rightmost piece + 1 tile (pieces sit on their tile's left edge).
    const row = this.feetY >> 12;
    let col = (this.body.x + (this.body.w >> 1)) >> 12;
    if (world.map.get(col, row) !== T.BRIDGE) return this.fakeWindow();
    let left = col;
    while (world.map.get(left - 1, row) === T.BRIDGE) left--;
    while (world.map.get(col + 1, row) === T.BRIDGE) col++;
    this.xMin = px((left + 3) * 16);
    this.xMax = px((col + 1) * 16);
  }

  /** BowserFake.setXMinMax: five tiles either side of his centre. */
  private fakeWindow(): void {
    const c = this.body.x + (this.body.w >> 1);
    this.xMin = c - FAKE_WALK;
    this.xMax = c + FAKE_WALK;
  }

  /** JUMP_TMR_DUR_MIN/MAX: 400-3000 ms. */
  private jumpDelay(world: World): number {
    return ms(400 + world.rng.int(2600));
  }

  private onScreen(world: World): boolean {
    const b = this.body;
    return b.x + b.w > world.camera.x && b.x < world.camera.right;
  }

  private count(world: World, kind: string): number {
    let n = 0;
    for (const e of world.entities)
      if (e instanceof Projectile && e.owner === this && e.alive && e.kind === kind) n++;
    return n;
  }

  update(world: World): void {
    const b = this.body;
    if (this.dead) {
      b.vy += 0x00400;
      b.y += velToSub(b.vy);
      if (this.isBelowLevel()) this.destroy();
      return;
    }
    if (world.bossClear) return;
    if (!this.started) this.start(world);

    // Timers (Bowser.as jumpTmrLsr, fbTmrLsr, fbDelTmrLsr, throwHammerTmrHandler).
    if (this.jumpTmr > 0 && --this.jumpTmr === 0 && b.onGround && !this.chasing) {
      b.vy = -JUMP_VY;
      b.onGround = false;
    }
    if (this.fbTmr > 0 && --this.fbTmr === 0) this.fireTimerDone(world);
    if (this.fbDelTmr > 0 && --this.fbDelTmr === 0) this.breathe(world);
    if (this.hammerTmr > 0 && --this.hammerTmr === 0) this.throwHammer(world);
    if (this.afterFbTmr > 0) this.afterFbTmr--;

    // Bowser.updateStats.
    if (b.onGround && this.jumpTmr === 0) this.jumpTmr = this.jumpDelay(world);
    const p = world.nearestPlayer(b.x).body;
    if (b.onGround && p.x + (p.w >> 1) > b.x + (b.w >> 1)) {
      b.vx = RUN_SPEED;
      this.facing = 1;
      this.chasing = true;
    } else {
      // returnToNormalStateFromChase: a fake Bowser re-centres its window where it stopped.
      if (this.chasing && this.fake) this.fakeWindow();
      this.chasing = false;
      this.facing = -1;
      if (b.vx < -WALK_SPEED) b.vx = -WALK_SPEED;
      else if (b.vx > WALK_SPEED) b.vx = WALK_SPEED;
      if (this.throwsHammers) {
        if (b.vx === 0 && !this.shootsFire) b.vx = -WALK_SPEED;
        if (this.hammerTmr === 0) this.hammerTmr = ms(40 + world.rng.int(160));
      }
      if (this.shootsFire && this.fbTmr === 0 && this.count(world, BOWSER_FLAME.kind) < MAX_FLAMES)
        this.startFireTimer(world);
    }

    moveX(b, world.map, velToSub(b.vx));
    if (b.hitWall !== 0 && !this.chasing) b.vx = -b.hitWall * WALK_SPEED;
    this.fall(world, GRAVITY);

    // The window: turn at xMin; at xMax turn in the normal state or stop while chasing
    // (pastXMax; a fake one only turns, and runs on past it while chasing).
    if (b.x <= this.xMin) {
      if (b.vx < 0) b.vx = -b.vx;
      b.x = this.xMin;
    } else if (b.x + b.w >= this.xMax) {
      if (b.vx > 0) {
        if (!this.chasing) b.vx = -b.vx;
        else if (!this.fake) b.vx = 0;
      }
      if (!this.fake) b.x = this.xMax - b.w;
    }

    if (this.mouthOpen > 0) this.mouthOpen--;
    const walk = b.vx !== 0 ? (world.frame >> 4) & 1 : 0;
    this.currentFrame = this.mouthOpen > 0 || this.afterFbTmr > 0 ? `bowser-${2 + walk}` : `bowser-${walk}`;
  }

  /** startFbTmr: the very first time the wind-up starts at once; then 1.5-3.5 s. */
  private startFireTimer(world: World): void {
    if (this.firstFb) this.fireTimerDone(world);
    this.firstFb = false;
    this.fbTmr = ms(1500 + world.rng.int(2000));
  }

  /** fbTmrLsr: stop and hold the wind-up for 450 ms. */
  private fireTimerDone(world: World): void {
    if (!this.onScreen(world)) {
      this.fbDelTmr = FB_DELAY;
      return;
    }
    if (!this.chasing && this.shootsFire) {
      this.fbDelTmr = FB_DELAY;
      this.body.vx = 0;
    }
  }

  /**
   * fbDelTmrLsr: breathe the flame (normal state, fewer than two of his on screen), then walk off
   * left (40%) or right (60%). Off screen nothing: his long-range flames are `BowserFire`'s.
   */
  private breathe(world: World): void {
    if (!this.onScreen(world)) return;
    const b = this.body;
    if (!this.chasing && this.shootsFire && this.count(world, BOWSER_FLAME.kind) < MAX_FLAMES) {
      // fbLev1-3: half a tile, one and a half and two and a half tiles above his feet (flame
      // centre; the flame is 8 px tall).
      const lev = [8, 24, 40][world.rng.int(3)] as number;
      const targetY = this.feetY - px(lev) - px(4);
      // From his left side (x = nx - width/2 - flame width/2), centred on the top of his hit
      // box (y = ny - hHeight).
      world.spawn(new BowserFlame(b.x - px(BOWSER_FLAME.w), b.y - px(4), targetY, this));
      world.audio.sfx('bowser-flame');
      this.afterFbTmr = AFTER_FB;
    }
    if (!this.chasing) b.vx = world.rng.chance(0.4) ? -WALK_SPEED : WALK_SPEED;
  }

  /** throwHammerTmrHandler: one hammer, only in the normal state and while fewer than six fly. */
  private throwHammer(world: World): void {
    if (this.chasing || this.count(world, BOWSER_HAMMER.kind) >= MAX_HAMMERS) return;
    const b = this.body;
    // Hammer.setDir: x = nx - hWidth * 0.75, y = ny - height * 1.2 (his normal state faces left).
    const cx = b.x + (b.w >> 1) - Math.round(b.w * 0.75);
    const y = b.y + b.h - px(36);
    world.spawn(
      new Projectile(cx - px(BOWSER_HAMMER.w >> 1), y - px(BOWSER_HAMMER.h >> 1), -1, BOWSER_HAMMER, this, {
        vx: -HAMMER_VX,
        vy: -HAMMER_VY,
      }),
    );
  }

  get hpPx(): number {
    return toPx(this.body.x);
  }
}
