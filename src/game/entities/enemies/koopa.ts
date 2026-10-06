import { SUB, px, toPx, velToSub } from '@engine/math/units';
import { Enemy } from './enemy';
import type { View } from '../entity';
import type { World } from '../../world/world';
import type { DamageSource, Reaction } from '../../rules/damage';
import { moveX } from '../body';
import { ENEMY_SCORES, KICK_SHELL } from '../../rules/score';

export const SHELL_SPEED = 0x03000; // 3 px/f
// Shell timers from the original's KoopaGreen.as, at 60 frames a second: SHELL_TMR_1 (3800 ms)
// until the legs start to show, SHELL_TMR_2 (900 ms) with the legs out, then SHELL_TMR_3 (250 ms)
// right before it walks again.
const SHELL_IDLE_FRAMES = 228;
const SHELL_LAST_FRAMES = 15;
const SHELL_WIGGLE_FRAMES = 54 + SHELL_LAST_FRAMES;
/**
 * KoopaGreen.NO_HIT_SHELL_TMR (250 ms = 15 frames), started by every kickShell: while it runs no
 * player is hurt by the shell or bounces off it (Character.hitEnemy skips it) and nobody can stomp
 * it (KoopaGreen.stomp returns early).
 */
export const SHELL_NO_HIT_FRAMES = 15;
/**
 * Flying paratroopas (KoopaGreen.checkState, FT_VERT for red, FT_HORZ for the sideways green):
 * `centre + sin(waveAngle) * waveRange` with `waveRange = 85` Flash px and `waveAngle += waveSpeed
 * * dt`, `waveSpeed = 1.5` rad/s. Flash tiles are 32 px and ours 16, at 60 frames a second:
 * ±42.5 px, 0.025 rad a frame (one cycle every 251 frames).
 */
export const PARA_WAVE_RANGE = 42.5; // px
export const PARA_WAVE_STEP = 1.5 / 60; // rad per frame
/**
 * The sideways flyer also drifts between `y - TILE_SIZE/2` and `y + TILE_SIZE/2` at
 * HORZ_FLY_VERT_MOVEMENT_SPEED = 25 Flash px/s (0.208 px/f), starting upwards (KoopaGreen.setStats).
 */
export const GLIDE_BOB_RANGE = px(8);
export const GLIDE_BOB_SPEED = 0x00355; // 25 / 2 / 60 px/f
/**
 * Hopping green paratroopas (FT_JUMP): `vy = -ySpeed` on every landing with `ySpeed = 400`, falling
 * under `gravity = enemyGravDef` (1300 px/s², Enemy.as) capped at `enemyVYMaxPsvDef` (800 px/s):
 * 3.33 px/f, 0.181 px/f² and 6.67 px/f here, so a hop rises 31 px and lasts 37 frames.
 */
export const PARA_HOP = 0x03555;
export const PARA_HOP_GRAVITY = 0x002e4;
const PARA_HOP_MAX_FALL = 0x06aab;

export type KoopaState = 'walk' | 'shell' | 'shell-moving' | 'wiggle';

/**
 * Koopa Troopa: green ones walk off ledges, red ones turn at them; stomping makes a kickable
 * shell. With wings it is a Paratroopa: red ones fly up and down around their spawn point,
 * green ones hop forward, and a stomp only clips the wings. A Buzzy Beetle is the same shell
 * enemy, short and fireproof.
 */
export class Koopa extends Enemy {
  readonly kind = 'koopa';
  state: KoopaState = 'walk';
  wings: boolean;
  /** Gliding paratroopa: sways side to side at a fixed height instead of hopping. */
  readonly glide: boolean;
  private readonly homeX: number;
  private readonly homeY: number;
  /** KoopaGreen.waveAngle (radians) for the red and sideways flyers. */
  private waveAngle = 0;
  /** Vertical drift of the sideways flyer (VEL units; negative is up). */
  private glideVy = -GLIDE_BOB_SPEED;
  private shellTimer = 0;
  /** Frames left of the post-kick no-hit window (KoopaGreen.NO_HIT_SHELL_TMR). */
  noHitTimer = 0;
  /** Kills by a moving shell chain for combo scoring. */
  shellCombo = 0;
  readonly color: 'green' | 'red' | 'buzzy';
  /** Standing height in px (koopas 22, buzzy beetles 14). */
  private readonly walkH: number;

  constructor(
    x: number,
    y: number,
    color: 'green' | 'red' | 'buzzy' = 'green',
    wings = false,
    glide = false,
  ) {
    super(x, y, 12, color === 'buzzy' ? 14 : 22);
    this.color = color;
    this.walkH = color === 'buzzy' ? 14 : 22;
    this.wings = wings;
    this.glide = wings && glide;
    this.homeX = x;
    this.homeY = y;
    if (wings && (color === 'red' || this.glide)) this.body.vx = 0;
    this.fallsOffLedges = color !== 'red';
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.currentFrame = `${this.prefix}-0`;
    this.vulnerability = { ...this.vulnerability, stomp: 'shell', bump: 'bounce' };
    // Buzzy Beetles shrug off fireballs.
    if (color === 'buzzy') this.vulnerability.fireball = 'immune';
    // KoopaGreen.overwriteInitialStats runs once at spawn, so a paratroopa keeps the flying values
    // after losing its wings. Buzzy Beetles score as Koopas: Beetle.overwriteInitialStats sets the
    // BEETLE_* values and then calls super, which overwrites them with KOOPA_* unconditionally.
    this.scores = wings ? ENEMY_SCORES.KOOPA_FLYING : ENEMY_SCORES.KOOPA;
    // KoopaGreen.setStats (Beetle extends it): gravity = enemyGravDef, 1300 Flash px/s².
    this.corpseGravity = PARA_HOP_GRAVITY;
  }

  /** Frame name prefix for walking frames. */
  private get prefix(): string {
    return this.color === 'buzzy' ? 'buzzy' : 'koopa';
  }

  private get shellFrame(): string {
    return this.color === 'buzzy' ? 'buzzy-shell' : 'shell';
  }

  override palette(view: View): string {
    if (this.color === 'buzzy') return super.palette(view);
    return this.color === 'red' ? 'koopa-red' : 'koopa-green';
  }

  get isMovingShell(): boolean {
    return this.state === 'shell-moving';
  }

  /** A shell lying still (legs out or not): touching or landing on it kicks it. */
  get isStillShell(): boolean {
    return this.state === 'shell' || this.state === 'wiggle';
  }

  /**
   * Points for kicking this still shell, as KoopaGreen.kickShell picks them: 1000 in the last
   * moments before it walks (SHELL_TMR_3), 500 while the legs are out (SHELL_TMR_2), 500 when the
   * kicker hasn't landed since a stomp (numContStomps > 0), otherwise 400.
   */
  kickScore(afterStomp: boolean): number {
    if (this.state === 'wiggle' && this.shellTimer <= SHELL_LAST_FRAMES) return KICK_SHELL.RIGHT_BEFORE_WALK;
    if (this.state === 'wiggle') return KICK_SHELL.WHILE_LEGS_ARE_OUT;
    return afterStomp ? KICK_SHELL.AFTER_STOMP : KICK_SHELL.NORMAL;
  }

  /** A boomerang only stuns a walking koopa; shells just deflect it. */
  override hit(src: DamageSource, world: World): Reaction {
    if ((src.kind === 'boomerang' || src.kind === 'ice') && this.state !== 'walk') return 'immune';
    return super.hit(src, world);
  }

  private becomeShell(): void {
    const b = this.body;
    const bottom = b.y + b.h;
    b.h = px(14);
    b.y = bottom - b.h;
    b.vx = 0;
    this.state = 'shell';
    this.shellTimer = SHELL_IDLE_FRAMES;
    this.contactHurts = false;
    this.spriteOffsetY = 2;
    this.currentFrame = this.shellFrame;
  }

  private standUp(): void {
    const b = this.body;
    const bottom = b.y + b.h;
    b.h = px(this.walkH);
    b.y = bottom - b.h;
    this.state = 'walk';
    this.contactHurts = true;
    this.fallsOffLedges = this.color !== 'red';
    b.vx = -this.walkSpeed;
    this.spriteOffsetY = 2;
  }

  /** Kick the shell away from the kicker. */
  kick(dirX: -1 | 1, world: World): void {
    this.state = 'shell-moving';
    this.body.vx = dirX * SHELL_SPEED;
    this.contactHurts = true;
    this.shellCombo = 0;
    this.fallsOffLedges = true;
    this.noHitTimer = SHELL_NO_HIT_FRAMES; // KoopaGreen.kickShell: NO_HIT_SHELL_TMR.start()
    // Nudge out of the kicker so the first frame doesn't re-collide.
    this.body.x += dirX * px(4);
    world.audio.sfx('kick');
  }

  stopShell(): void {
    this.state = 'shell';
    this.body.vx = 0;
    this.contactHurts = false;
    this.shellTimer = SHELL_IDLE_FRAMES;
  }

  protected override onShell(_src: DamageSource, world: World): void {
    if (this.wings) {
      this.wings = false;
      this.body.vy = 0;
      this.body.vx = -this.walkSpeed;
      world.audio.sfx('stomp');
      return;
    }
    if (this.state === 'walk') {
      this.becomeShell();
      world.audio.sfx('stomp');
    } else if (this.state === 'shell-moving') {
      this.stopShell();
      world.audio.sfx('stomp');
    } else {
      // A still shell is kicked, not stomped (the world does that before stomping); kept for safety.
      const pl = world.nearestPlayer(this.body.x).body;
      const dir: -1 | 1 = pl.x + pl.w / 2 < this.body.x + this.body.w / 2 ? 1 : -1;
      this.kick(dir, world);
    }
  }

  /**
   * A block bumped under it (KoopaGreen.gBounceHit; KoopaRed and Beetle extend KoopaGreen): it pops
   * up into its shell, unhurt and unscored (Enemy.gBounceHit's BELOW score is not called), heading
   * away from the block's middle at walking speed (`vx = defaultWalkSpeed`, negated when
   * `nx < g.hMidX`). `bounced` makes enterShell keep that speed and start the shell timers; from
   * ST_FLY it also loses its wings. Red and gliding paratroopas fly (defyGrav) and never stand on a
   * block, so the bump doesn't reach them (Brick.BOUNCE_HIT_DCT only holds things standing on it).
   */
  protected override onBounce(src: DamageSource, _world: World): void {
    if (this.wings && (this.color === 'red' || this.glide)) return;
    this.wings = false;
    this.becomeShell();
    const mid = this.body.x + this.body.w / 2;
    this.body.vx = (mid < (src.fromX ?? mid) ? -1 : 1) * this.walkSpeed;
    this.bumpPop();
  }

  /**
   * A still shell only moves while popped into the air by a bump: KoopaGreen.updateStats sets
   * `vx = 0` for ST_SHELL on the ground, and Enemy.groundOnSide turns it at walls.
   */
  private shellDrift(world: World): void {
    const b = this.body;
    if (b.onGround) b.vx = 0;
    else if (b.vx !== 0) {
      moveX(b, world.map, velToSub(b.vx));
      if (b.hitWall !== 0) b.vx = -b.hitWall * this.walkSpeed;
    }
  }

  update(world: World): void {
    if (this.noHitTimer > 0) this.noHitTimer--;
    switch (this.state) {
      case 'walk':
        if (this.wings) this.fly(world);
        else this.patrol(world);
        this.currentFrame = `${this.wings ? 'koopa-fly' : this.prefix}-${(world.frame >> 3) & 1}`;
        break;
      case 'shell':
        this.shellDrift(world);
        this.fall(world);
        if (--this.shellTimer <= 0) {
          this.state = 'wiggle';
          this.shellTimer = SHELL_WIGGLE_FRAMES;
        }
        this.currentFrame = this.shellFrame;
        break;
      case 'wiggle':
        this.shellDrift(world);
        this.fall(world);
        this.currentFrame =
          (world.frame >> 2) & 1 && this.color !== 'buzzy' ? 'shell-wiggle' : this.shellFrame;
        if (--this.shellTimer <= 0) this.standUp();
        break;
      case 'shell-moving': {
        const b = this.body;
        moveX(b, world.map, velToSub(b.vx));
        if (b.hitWall !== 0) {
          b.vx = -b.hitWall * SHELL_SPEED;
          world.audio.sfx('bump');
        }
        this.fall(world);
        this.currentFrame = this.shellFrame;
        this.facing = b.vx > 0 ? 1 : -1;
        break;
      }
    }
    if (this.isBelowLevel()) this.destroy();
  }

  private fly(world: World): void {
    const b = this.body;
    if (this.glide) {
      // FT_HORZ: sway side to side through the air, ignoring tiles, facing the way it is going,
      // while drifting up and down half a tile either side of its spawn height.
      const prevX = b.x;
      b.x = this.homeX + Math.round(Math.sin(this.waveAngle) * PARA_WAVE_RANGE * SUB);
      this.waveAngle += PARA_WAVE_STEP;
      if (b.x !== prevX) this.facing = b.x > prevX ? 1 : -1;
      if (b.y <= this.homeY - GLIDE_BOB_RANGE) this.glideVy = GLIDE_BOB_SPEED;
      else if (b.y >= this.homeY + GLIDE_BOB_RANGE) this.glideVy = -GLIDE_BOB_SPEED;
      b.y += velToSub(this.glideVy);
      b.vy = 0;
      return;
    }
    if (this.color === 'red') {
      // FT_VERT: bob vertically through the air, ignoring tiles, facing the nearest player.
      b.y = this.homeY + Math.round(Math.sin(this.waveAngle) * PARA_WAVE_RANGE * SUB);
      this.waveAngle += PARA_WAVE_STEP;
      b.vy = 0;
      const pl = world.nearestPlayer(b.x).body;
      this.facing = pl.x + pl.w / 2 < b.x + b.w / 2 ? -1 : 1;
      return;
    }
    // Green: patrol, and hop again as soon as it lands.
    this.patrol(world);
    if (b.onGround) {
      b.vy = -PARA_HOP;
      b.onGround = false;
    }
  }

  /** A hopping paratroopa falls under the original's enemy gravity (see PARA_HOP). */
  protected override fall(world: World, gravity?: number, maxFall?: number): void {
    if (this.wings && this.state === 'walk' && !this.glide && this.color !== 'red')
      super.fall(world, PARA_HOP_GRAVITY, PARA_HOP_MAX_FALL);
    else super.fall(world, gravity, maxFall);
  }

  /** A moving shell hitting another enemy. */
  shellDamage(): DamageSource {
    return { kind: 'shell', amount: 1, owner: this, dirX: this.body.vx > 0 ? 1 : -1 };
  }

  get bottomRow(): number {
    return toPx(this.body.y + this.body.h) >> 4;
  }
}
