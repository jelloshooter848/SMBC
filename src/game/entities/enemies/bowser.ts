import { px, toPx, velToSub } from '@engine/math/units';
import type { Renderer } from '@engine/gfx/renderer';
import { fxPalette } from '@content/sprites/palette-fx';
import { TRUE_FORM_HEIGHT } from '@content/sprites/enemies';
import type { Theme } from '../../level/schema';
import { Enemy } from './enemy';
import type { View } from '../entity';
import { drawSparkle, WandPoof, WAND_SPARKLE } from '../effects/wand-poof';
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

/**
 * The campaign's tell (docs/STORY.md 2.3a): every TELL_PERIOD frames (4 s) a fake's disguise
 * flickers for the last TELL_FRAMES of them, its true form showing every other two frames. With
 * reduce flashing on there is no flicker: the true form's bright outline is held over him for the
 * whole window instead.
 */
const TELL_PERIOD = 240;
const TELL_FRAMES = 12;

/**
 * The fake king's true form in world `world` (1..7: `bowser-die-N`), or 0 for the king himself
 * (world 8, and the Lost Levels' later worlds, whose die frame is the king).
 */
export function trueFormOf(world: number): number {
  const n = Math.min(8, Math.max(1, world | 0));
  return n < 8 ? n : 0;
}

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
  /**
   * Campaign only: the true form under the disguise (1..7, see trueFormOf), 0 for the real king
   * or outside the story. Set each update from the world.
   */
  private disguise = 0;
  /** Frames since he first moved (the tell's clock). */
  private age = 0;
  /** The axe dropped a fake whose disguise burst: its true form (N of `bowser-die-N`) falls. */
  private unmasked = 0;
  /**
   * The disguise burst before the bridge fell (0.4.23, the campaign's castle unmask scene,
   * world/unmask.ts): the true form (N) stands on the bridge, harmless, until the axe drops it.
   */
  standing = 0;
  /** The true form standing was beaten with weapons: dazed, little stars over its head. */
  dazed = false;

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
   * the king himself. Every die frame keeps the way he was facing (Enemy.die flips only scaleY,
   * so the clip's scaleX carries over), the 8-4 king included; the true forms sit at his head
   * end, so they need it. In a castle the true forms take the grey-outlined `bowser-true-form`
   * palette so they show on the black. In the campaign a fake's disguise bursts first (unmask).
   */
  protected override flipOut(_src: DamageSource, world: World): void {
    // The campaign's castles 1-4 to 7-4: the disguise bursts and the creature drops onto the
    // bridge, dazed, while the hero jumps over it to the axe (world/unmask.ts).
    if (world.unmaskOnKill(this)) return;
    const n = Math.min(8, Math.max(1, world.state.world | 0));
    this.unmask(world);
    const corpse = new Corpse(
      this.body.x,
      this.body.y,
      toPx(this.body.w),
      toPx(this.body.h),
      this.sheet,
      n < 8 ? this.formPalette(world.level.theme) : this.corpsePalette(world.level.theme),
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

  /**
   * The axe drops him through the bridge. In the campaign (given the `world`) a fake's disguise
   * bursts as he drops, and his true form falls into the lava, head down like a fireball kill.
   */
  fallDead(world?: World): void {
    this.dead = true;
    this.contactHurts = false;
    this.stompable = false;
    this.body.vx = 0;
    if (!world) return;
    // Already unmasked (the castle's unmask scene): no second puff.
    const n = this.standing || this.unmask(world);
    this.standing = 0;
    if (!n) return;
    this.unmasked = n;
    this.currentFrame = `bowser-die-${n}`;
  }

  /** The true form's palette: the grey-outlined `bowser-true-form` in a castle (see flipOut). */
  private formPalette(theme: Theme): string {
    const palette = this.corpsePalette(theme);
    return palette === 'enemies-castle' ? 'bowser-true-form' : palette;
  }

  /**
   * Campaign: a fake's disguise bursts in a puff of wand sparkles with a "poof" (docs/STORY.md
   * 2.3a), however he was beaten. Returns his true form (0: the real king, or classic play, where
   * nothing happens).
   */
  private unmask(world: World): number {
    const n = world.storyMode ? trueFormOf(world.state.world) : 0;
    if (!n) return 0;
    const b = this.body;
    world.spawn(new WandPoof(b.x + (b.w >> 1), b.y + (b.h >> 1)));
    world.audio.sfx('poof');
    return n;
  }

  /**
   * The campaign's castle unmask scene (world/unmask.ts): the disguise bursts now, in its puff, and
   * the true form stands where he stood, harmless (`dazed` after a weapon kill). Returns the true
   * form (0: none, nothing happens).
   */
  burst(world: World, dazed: boolean): number {
    const n = this.unmask(world);
    if (!n) return 0;
    this.standing = n;
    this.dazed = dazed;
    this.contactHurts = false;
    this.stompable = false;
    this.body.vx = 0;
    for (const k of Object.keys(this.vulnerability) as (keyof typeof this.vulnerability)[])
      this.vulnerability[k] = 'immune';
    return n;
  }

  /** The true form's height in px (its rows sit at the bottom of his 32-px frame). */
  get standingHeight(): number {
    return TRUE_FORM_HEIGHT[this.standing] ?? 24;
  }

  /** Whether the tell is on (its last TELL_FRAMES of every TELL_PERIOD; campaign fakes only). */
  get tellWindow(): boolean {
    if (!this.disguise || this.dead) return false;
    return this.age % TELL_PERIOD >= TELL_PERIOD - TELL_FRAMES;
  }

  /** Whether the tell's flicker shows the true form this frame (campaign fakes only). */
  get tellShowing(): boolean {
    return this.tellWindow && ((this.age >> 1) & 1) === 0;
  }

  override render(r: Renderer, view: View): void {
    const assets = view.assets;
    const x = this.screenX(view);
    const y = this.screenY();
    const flip = this.facing > 0;
    if (this.unmasked) {
      const sheet = assets.sheet(this.sheet, this.formPalette(view.theme));
      r.sprite(sheet, `bowser-die-${this.unmasked}`, x, y, flip, true);
      return;
    }
    if (this.standing) {
      // The true form on its feet (its rows start 8 px down his box), dazed stars over its head.
      const n = this.standing;
      const fy = y + 24 - (TRUE_FORM_HEIGHT[n] ?? 24);
      r.sprite(assets.sheet(this.sheet, this.formPalette(view.theme)), `bowser-die-${n}`, x, fy, flip);
      if (this.dazed) {
        const cx = x + (flip ? 22 : 10);
        for (let i = 0; i < 3; i++) {
          const a = (view.frame / 10 + (i * Math.PI * 2) / 3) % (Math.PI * 2);
          drawSparkle(
            r,
            Math.round(cx + Math.cos(a) * 7),
            Math.round(fy - 3 + Math.sin(a) * 2),
            1,
            '#fce4a0',
          );
        }
      }
      return;
    }
    const n = this.disguise;
    if (!n) return super.render(r, view);
    // The true form stands on his feet: its rows start 8 px down his 32-px box.
    const fy = y + 24 - (TRUE_FORM_HEIGHT[n] ?? 24);
    if (this.tellShowing && !view.reduceFlashing) {
      // The disguise flickers: the true creature's silhouette, rimmed so it reads on black, and a
      // soft wand sparkle over it.
      const pal = this.palette(view);
      const rim = assets.sheet(this.sheet, fxPalette(pal, 'rim'));
      const dark = assets.sheet(this.sheet, fxPalette(pal, 'silhouette'));
      const frame = `bowser-die-${n}`;
      for (const [dx, dy] of [
        [-1, 0],
        [1, 0],
        [0, -1],
        [0, 1],
      ] as const)
        r.sprite(rim, frame, x + dx, fy + dy, flip);
      r.sprite(dark, frame, x, fy, flip);
      const cx = x + (flip ? 22 : 10);
      const phase = this.age % TELL_PERIOD;
      drawSparkle(r, cx + 6, fy + 10, 1, WAND_SPARKLE[0]);
      drawSparkle(r, cx - 7, fy + 16, phase & 4 ? 1 : 0, WAND_SPARKLE[1]);
      drawSparkle(r, cx + 1, fy + 4, 0, WAND_SPARKLE[2]);
      return;
    }
    super.render(r, view);
    // Reduce flashing: no flicker; the true form's bright outline held over him for the window.
    if (view.reduceFlashing && this.tellWindow)
      r.sprite(
        assets.sheet(this.sheet, fxPalette(this.palette(view), 'tell')),
        `bowser-ghost-${n}`,
        x,
        fy,
        flip,
      );
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
    this.disguise = world.storyMode ? trueFormOf(world.state.world) : 0;
    if (this.dead) {
      b.vy += 0x00400;
      b.y += velToSub(b.vy);
      if (this.isBelowLevel()) this.destroy();
      return;
    }
    // Unmasked on the bridge: it only drops onto it, and waits for the axe.
    if (this.standing) {
      b.vx = 0;
      this.fall(world, GRAVITY);
      return;
    }
    if (world.bossClear) return;
    this.age++;
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
