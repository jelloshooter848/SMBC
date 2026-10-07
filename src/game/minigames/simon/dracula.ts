import type { Renderer } from '@engine/gfx/renderer';
import { px, tileToSub, toPx, velToSub } from '@engine/math/units';
import { Rng } from '@engine/rng';
import { Entity, type View } from '../../entities/entity';
import { Enemy } from '../../entities/enemies/enemy';
import { moveX, moveY } from '../../entities/body';
import type { Player } from '../../entities/player';
import type { DamageSource, Reaction } from '../../rules/damage';
import type { World } from '../../world/world';
import { CV_SOUNDS, drawCrypt, hasCryptFrame, type Fallback } from './art';
import { Burst, CvShot, type CvShotSpec } from './creatures';

/*
 * Dracula, two phases on one life bar (docs/HEROES.md, Simon's mini game).
 *
 * Phase 1, the Count (NES style): he is gone, appears at one of four spots in the throne room
 * (never right on Simon), opens his cape and throws a spread of three fireballs at Simon, lingers,
 * and vanishes. Only his HEAD can be hurt (a separate 16×16 hit box on top of his 20×42 body;
 * the body shrugs every hit off with a clink), and only while he stands there.
 *
 * Phase 2, the beast: his phase-1 hit points gone, he rises as a giant winged beast (48×48,
 * hurt anywhere on its 36×40 body) and cycles walk → fire spit (three aimed fireballs) → walk →
 * spit → walk → crouch and leap at Simon → a landing stomp that sends a shock wave along the
 * floor both ways.
 */

/** Hit points: the whole bar, the part phase 1 takes, the rest is the beast's. */
export const BOSS_HP = 14;
export const DRACULA_HP = 6;
export const BEAST_HP = BOSS_HP - DRACULA_HP;
/** Frames he can't be hurt again after a hit (and flashes, not with reduce flashing). */
export const BOSS_IFRAMES = 24;

/* ---------- Phase 1 ---------- */

/** Phase 1's cycle (frames). */
export const GONE_FRAMES = 44;
export const APPEAR_FRAMES = 36;
/** The appear frame from which he is there: he can touch Simon, and he is drawn solid. */
export const PRESENT_AT = 12;
export const CAST_FRAMES = 40;
/** The cast frame on which the fireballs fly. */
export const CAST_FIRE_AT = 28;
export const LINGER_FRAMES = 130;
export const VANISH_FRAMES = 18;
/** The spread: three fireballs this many radians apart, at this speed (velocity units). */
export const SPREAD = 0.5;
export const FIREBALL_SPEED = 0x01400;
/** Teleport spots: px from the room's left edge to his centre. */
export const SPOTS = [48, 96, 160, 208] as const;
/** He never appears with his centre this close to Simon's (px), and prefers spots within SPOT_NEAR. */
export const SPOT_CLEAR = 48;
export const SPOT_NEAR = 100;

export type DraculaState = 'gone' | 'appear' | 'cast' | 'linger' | 'vanish' | 'down';

export const FIREBALL: CvShotSpec = {
  kind: 'fireball',
  w: 8,
  h: 8,
  damage: 2,
  gravity: 0,
  hitsTiles: true,
  frames: ['dracula-fireball-0', 'dracula-fireball-1'],
  fallback: ['#f83800', '#fca044'],
};

/** The bar both phases drain. */
export class BossLife {
  hp = BOSS_HP;
  iframes = 0;
}

/**
 * Dracula's head: the part of him that can be hurt (his body is `Dracula`). It has no update of
 * its own; Dracula moves it.
 */
export class DraculaHead extends Enemy {
  readonly kind = 'dracula-head';
  constructor(readonly owner: Dracula) {
    super(owner.body.x, owner.body.y, 16, 16);
    this.body.vx = 0;
    this.stompable = false;
    this.despawnMargin = null;
  }

  override hit(src: DamageSource, world: World): Reaction {
    return this.owner.headHit(src, world);
  }

  update(): void {
    this.contactHurts = this.owner.present;
  }

  override render(): void {}
}

/**
 * Dracula in phase 1: his body (the head is `head`). `onDown` runs once when phase 1's hit
 * points are gone (the scene plays the transformation).
 */
export class Dracula extends Enemy {
  readonly kind = 'dracula';
  state: DraculaState = 'gone';
  t = 0;
  /** Spot index he stands on (or last stood on). */
  spot = -1;
  /** Spots used, in order (tests). */
  readonly visits: number[] = [];
  readonly head: DraculaHead;
  private readonly rng: Rng;
  private flash = 0;

  constructor(
    readonly roomX: number,
    readonly floorY: number,
    readonly life: BossLife,
    private readonly onDown: () => void,
    seed = 1,
  ) {
    super(tileToSub(roomX) + px(SPOTS[0]), px(floorY - 42), 20, 42);
    this.body.vx = 0;
    this.stompable = false;
    this.contactHurts = false;
    this.vulnerability = {};
    this.despawnMargin = null;
    this.rng = new Rng(seed);
    this.head = new DraculaHead(this);
    this.placeHead();
  }

  /** Standing in the room (can be touched; his head can be hit while he is fully there). */
  get present(): boolean {
    return (
      this.state === 'cast' || this.state === 'linger' || (this.state === 'appear' && this.t >= PRESENT_AT)
    );
  }

  get hurtable(): boolean {
    return this.state === 'cast' || this.state === 'linger';
  }

  /** The body shrugs everything off. */
  override hit(_src: DamageSource, world: World): Reaction {
    if (this.present) world.audio.sfx('bump');
    return 'immune';
  }

  /** A hit on his head: one hit point a blow while he stands there, then a short grace. */
  headHit(src: DamageSource, world: World): Reaction {
    if (!this.hurtable || this.life.iframes > 0 || src.amount <= 0) return 'immune';
    this.life.hp = Math.max(BEAST_HP, this.life.hp - src.amount);
    this.life.iframes = BOSS_IFRAMES;
    this.flash = BOSS_IFRAMES;
    world.audio.sfx('hurt-enemy');
    if (this.life.hp <= BEAST_HP) {
      this.state = 'down';
      this.t = 0;
      for (const e of world.entities) if (e instanceof CvShot) e.destroy();
      this.onDown();
    }
    return 'hp';
  }

  private placeHead(): void {
    const b = this.body;
    // The art's head box: x 8-23, y 0-15 of the 32x48 cape frames drawn at (-6, -6) of the body
    // (the box is symmetric, so it holds whichever way he faces).
    this.head.body.x = b.x + px(2);
    this.head.body.y = b.y - px(6);
  }

  /**
   * Picks the next spot: not the last one, not within SPOT_CLEAR px of Simon, and within
   * SPOT_NEAR of him when one is.
   */
  private pickSpot(p: Player): number {
    const left = tileToSub(this.roomX);
    const dist = (i: number) => Math.abs(left + px(SPOTS[i] as number) - p.centerX);
    const all = SPOTS.map((_, i) => i).filter((i) => i !== this.spot);
    const ok = all.filter((i) => dist(i) >= px(SPOT_CLEAR));
    const near = ok.filter((i) => dist(i) <= px(SPOT_NEAR));
    const pool = near.length ? near : ok.length ? ok : all;
    return pool[this.rng.int(pool.length)] as number;
  }

  update(world: World): void {
    if (this.life.iframes > 0) this.life.iframes--;
    if (this.flash > 0) this.flash--;
    const p = world.nearestPlayer(this.body.x);
    const b = this.body;
    this.t++;
    switch (this.state) {
      case 'gone':
        if (this.t >= GONE_FRAMES) {
          this.spot = this.pickSpot(p);
          this.visits.push(this.spot);
          b.x = tileToSub(this.roomX) + px(SPOTS[this.spot] as number) - (b.w >> 1);
          this.facing = p.centerX < b.x + (b.w >> 1) ? -1 : 1;
          this.go('appear');
          world.audio.sfx(CV_SOUNDS.teleport);
        }
        break;
      case 'appear':
        if (this.t >= APPEAR_FRAMES) this.go('cast');
        break;
      case 'cast':
        if (this.t === CAST_FIRE_AT) this.fire(world);
        if (this.t >= CAST_FRAMES) this.go('linger');
        break;
      case 'linger':
        if (this.t >= LINGER_FRAMES) this.go('vanish');
        break;
      case 'vanish':
        if (this.t >= VANISH_FRAMES) this.go('gone');
        break;
      case 'down':
        break;
    }
    this.contactHurts = this.present;
    this.placeHead();
    this.head.contactHurts = this.present;
    this.currentFrame = this.state === 'cast' ? 'dracula-cape-1' : 'dracula-cape-0';
  }

  private go(s: DraculaState): void {
    this.state = s;
    this.t = 0;
  }

  /**
   * The spread: three fireballs from his low hand, the way he faces: one level at the height of
   * Simon's lash, one rising over him, one dropping to the floor (gone where it lands).
   */
  private fire(world: World): void {
    const b = this.body;
    const cx = b.x + (b.w >> 1) + this.facing * px(10);
    const cy = b.y + b.h - px(16);
    const a = this.facing > 0 ? 0 : Math.PI;
    for (const k of [-1, 0, 1]) {
      const ang = a + k * this.facing * SPREAD;
      world.spawn(
        new CvShot(
          cx - px(4),
          cy - px(4),
          Math.round(Math.cos(ang) * FIREBALL_SPEED),
          Math.round(Math.sin(ang) * FIREBALL_SPEED),
          FIREBALL,
          this,
        ),
      );
    }
    world.audio.sfx(CV_SOUNDS.fire);
  }

  override render(r: Renderer, view: View): void {
    if (this.state === 'gone') return;
    // Fading in: flickers until he is there (reduce flashing: hidden till then), then solid from
    // the frame he can touch Simon. Fading out: flickers (reduce flashing: gone at half way).
    if (this.state === 'appear' && !this.present) {
      if (view.reduceFlashing || (this.t & 2) === 0) return;
    }
    if (this.state === 'vanish') {
      if (view.reduceFlashing ? this.t >= VANISH_FRAMES / 2 : (this.t & 2) === 0) return;
    }
    const flash = this.flash > 0 && !view.reduceFlashing && (this.flash & 4) !== 0;
    const x = toPx(this.body.x) - view.camX - 6;
    const y = toPx(this.body.y) - 6;
    const fb: Fallback = ['#202020', '#5c3c9c'];
    drawCrypt(r, view.assets, this.currentFrame, x, y, 32, 48, fb, this.facing > 0);
    // The head is part of the cape frames; struck, it alone flashes (`dracula-head` over the
    // same box in `crypt-flash`). Without the art it is a box of its own.
    if (flash || !hasCryptFrame(view.assets, this.currentFrame))
      drawCrypt(
        r,
        view.assets,
        'dracula-head',
        x + 8,
        y,
        16,
        16,
        ['#fcfcfc', '#f8b8f8'],
        this.facing > 0,
        flash,
      );
  }
}

/* ---------- Phase 2: the beast ---------- */

export type BeastState = 'rise' | 'walk' | 'spit-wind' | 'spit' | 'crouch' | 'leap' | 'land' | 'down';

/** The beast's beats (frames). */
export const RISE_FRAMES = 60;
export const WALK_FRAMES = 70;
export const SPIT_WIND = 26;
export const SPIT_EVERY = 14;
export const SPIT_COUNT = 3;
export const CROUCH_FRAMES = 22;
export const LAND_FRAMES = 40;
export const BEAST_DOWN_FRAMES = 90;
/** Walk speed, the leap's rise and gravity (velocity units). */
export const BEAST_WALK = 0x00800;
export const LEAP_VY = 0x05000;
export const LEAP_GRAVITY = 0x00300;
const LEAP_MAX_VX = 0x02800;
/** Spit fireballs' speed and the shock wave's (velocity units). */
export const SPIT_SPEED = 0x01400;
export const WAVE_SPEED = 0x02000;

export const BEAST_FIRE: CvShotSpec = {
  kind: 'beast-fire',
  w: 12,
  h: 12,
  damage: 2,
  gravity: 0,
  hitsTiles: true,
  frames: ['beast-fire-0', 'beast-fire-1'],
  fallback: ['#f83800', '#fcfc00'],
};

/** The landing's shock wave: runs along the floor until a wall. */
export class ShockWave extends Entity {
  readonly kind = 'shock-wave';
  age = 0;
  constructor(x: number, floorY: number, dir: -1 | 1) {
    super(x, floorY - px(10), 10, 10);
    this.body.vx = dir * WAVE_SPEED;
    this.facing = dir;
    this.layer = 'front';
    this.despawnMargin = 16;
  }

  update(world: World): void {
    this.age++;
    const b = this.body;
    moveX(b, world.map, velToSub(b.vx));
    if (b.hitWall !== 0 || this.age > 180) return this.destroy();
    for (const p of world.activePlayers()) {
      const o =
        b.x < p.body.x + p.body.w &&
        p.body.x < b.x + b.w &&
        b.y < p.body.y + p.body.h &&
        p.body.y < b.y + b.h;
      if (!o) continue;
      if (p.dead || p.invulnerable || world.assist.invulnerable) continue;
      world.hurtPlayer(p, b.vx > 0 ? 1 : -1);
    }
  }

  render(r: Renderer, view: View): void {
    const x = toPx(this.body.x) - view.camX - 3;
    const f = `beast-fire-${(this.age >> 2) & 1}`;
    drawCrypt(r, view.assets, f, x, toPx(this.body.y) - 6, 16, 16, ['#f83800', '#fca044']);
  }
}

/**
 * Dracula's beast form: rises where he fell, then walk → spit → walk → leap (a stomp and its shock
 * waves on landing) over and over. Hurt anywhere while not rising; `onDown` runs once when the
 * bar is empty.
 */
export class Beast extends Enemy {
  readonly kind = 'beast';
  state: BeastState = 'rise';
  t = 0;
  /** Moves done (walk/spit/walk/leap ...). */
  step = 0;
  spat = 0;
  private flash = 0;
  /** The order of its attacks (tests). */
  readonly attacks: ('spit' | 'leap')[] = [];

  constructor(
    cx: number,
    readonly floorY: number,
    readonly roomX: number,
    readonly life: BossLife,
    private readonly onDown: () => void,
  ) {
    super(cx - px(18), px(floorY - 40), 36, 40);
    this.body.vx = 0;
    this.stompable = false;
    this.despawnMargin = null;
    this.vulnerability = {};
    this.body.onGround = true;
  }

  get hurtable(): boolean {
    return this.state !== 'rise' && this.state !== 'down';
  }

  override hit(src: DamageSource, world: World): Reaction {
    if (!this.hurtable || this.life.iframes > 0 || src.amount <= 0) return 'immune';
    this.life.hp = Math.max(0, this.life.hp - src.amount);
    this.life.iframes = BOSS_IFRAMES;
    this.flash = BOSS_IFRAMES;
    world.audio.sfx('hurt-enemy');
    if (this.life.hp <= 0) {
      this.go('down');
      this.body.vx = 0;
      for (const e of world.entities) if (e instanceof CvShot || e instanceof ShockWave) e.destroy();
      this.onDown();
    }
    return 'hp';
  }

  private go(s: BeastState): void {
    this.state = s;
    this.t = 0;
  }

  update(world: World): void {
    if (this.life.iframes > 0) this.life.iframes--;
    if (this.flash > 0) this.flash--;
    const p = world.nearestPlayer(this.body.x);
    const b = this.body;
    const cx = b.x + (b.w >> 1);
    this.t++;
    this.contactHurts = this.state !== 'rise' && this.state !== 'down';
    if (this.state !== 'leap' && this.state !== 'down') this.facing = p.centerX < cx ? -1 : 1;
    switch (this.state) {
      case 'rise':
        if (this.t >= RISE_FRAMES) this.go('walk');
        break;
      case 'walk':
        b.vx = this.facing * BEAST_WALK;
        moveX(b, world.map, velToSub(b.vx));
        if (this.t >= WALK_FRAMES) {
          b.vx = 0;
          this.step++;
          const leap = this.step % 3 === 0;
          this.attacks.push(leap ? 'leap' : 'spit');
          this.go(leap ? 'crouch' : 'spit-wind');
          if (!leap) world.audio.sfx(CV_SOUNDS.roar);
        }
        break;
      case 'spit-wind':
        if (this.t >= SPIT_WIND) {
          this.spat = 0;
          this.go('spit');
        }
        break;
      case 'spit':
        if ((this.t - 1) % SPIT_EVERY === 0 && this.spat < SPIT_COUNT) {
          this.spit(world, p);
          this.spat++;
        }
        if (this.t >= SPIT_EVERY * SPIT_COUNT + 10) this.go('walk');
        break;
      case 'crouch':
        if (this.t >= CROUCH_FRAMES) {
          const air = (2 * LEAP_VY) / LEAP_GRAVITY;
          const left = tileToSub(this.roomX + 1) + (b.w >> 1);
          const right = tileToSub(this.roomX + 15) - (b.w >> 1);
          const goal = Math.max(left, Math.min(right, p.centerX));
          b.vx = Math.max(-LEAP_MAX_VX, Math.min(LEAP_MAX_VX, Math.round((goal - cx) / air) << 4));
          b.vy = -LEAP_VY;
          b.onGround = false;
          this.go('leap');
        }
        break;
      case 'leap':
        moveX(b, world.map, velToSub(b.vx));
        b.vy += LEAP_GRAVITY;
        moveY(b, world.map, velToSub(b.vy));
        if (b.onGround) {
          b.vx = 0;
          b.vy = 0;
          this.go('land');
          this.stomp(world);
        }
        break;
      case 'land':
        if (this.t >= LAND_FRAMES) this.go('walk');
        break;
      case 'down':
        if (this.t % 12 === 1 && this.t < BEAST_DOWN_FRAMES)
          world.spawn(new Burst(b.x + px((this.t * 7) % 36), b.y + px((this.t * 13) % 40)));
        break;
    }
    this.currentFrame =
      this.state === 'leap'
        ? 'dracula-beast-1'
        : this.state === 'spit' || this.state === 'spit-wind'
          ? 'dracula-beast-2'
          : 'dracula-beast-0';
  }

  private spit(world: World, p: Player): void {
    const b = this.body;
    // From its mouth: the art's fire edge (rows 22-34 of the 48x48 frame drawn at (-6, -8)).
    const mx = this.facing < 0 ? b.x : b.x + b.w;
    const my = b.y + px(20);
    const dx = p.centerX - mx;
    const dy = p.body.y + (p.body.h >> 1) - my;
    const len = Math.max(1, Math.hypot(dx, dy));
    world.spawn(
      new CvShot(
        mx - px(6),
        my - px(6),
        Math.round((dx / len) * SPIT_SPEED),
        Math.round((dy / len) * SPIT_SPEED),
        BEAST_FIRE,
        this,
      ),
    );
    world.audio.sfx(CV_SOUNDS.fire);
  }

  /** Landing: the floor shakes (not with reduce flashing) and a shock wave runs each way. */
  private stomp(world: World): void {
    const b = this.body;
    if (!world.ctx.reduceFlashing) world.shake(12);
    world.audio.sfx(CV_SOUNDS.stomp);
    world.spawn(new ShockWave(b.x - px(10), b.y + b.h, -1));
    world.spawn(new ShockWave(b.x + b.w, b.y + b.h, 1));
  }

  override render(r: Renderer, view: View): void {
    const b = this.body;
    const x = toPx(b.x) - view.camX - 6;
    // Crouching to leap: it sinks 2 px (the crouched idle frame, lower) as a warning.
    const y = toPx(b.y) - 8 + (this.state === 'crouch' ? 2 : 0);
    // Rising: it flickers in (reduce flashing: shown from halfway); beaten: it flickers out.
    if (this.state === 'rise') {
      const half = this.t >= RISE_FRAMES / 2;
      if (view.reduceFlashing ? !half : !half && (this.t & 2) === 0) return;
    }
    if (this.state === 'down') {
      if (this.t >= BEAST_DOWN_FRAMES) return;
      const late = this.t >= BEAST_DOWN_FRAMES / 2;
      if (late && (view.reduceFlashing || (this.t & 2) === 0)) return;
    }
    const flash = this.flash > 0 && !view.reduceFlashing && (this.flash & 4) !== 0;
    const fb: Fallback = ['#202020', '#7c0800'];
    drawCrypt(r, view.assets, this.currentFrame, x, y, 48, 48, fb, this.facing > 0, flash);
  }
}
