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
 * Dracula, two forms, each with a full ENEMY bar, as in NES Castlevania (docs/HEROES.md, Simon's
 * mini game).
 *
 * Form 1, the Count: he is gone, appears at one of four spots in the throne room (never right on
 * Simon), opens his cape and throws a spread of three fireballs at Simon, lingers, and vanishes.
 * Only his HEAD can be hurt (a separate 16×16 hit box on top of his 20×42 body; the body shrugs
 * every hit off with a clink), and only while he stands there. When his bar is empty his head
 * flies off (`FlyingHead`) and the headless body bursts (the scene plays it).
 *
 * Form 2, the beast: it drops into the room as the bar fills again, then leaps about the room
 * (middling hops that land short of Simon; a high leap, which Simon can run under, when he is
 * cornered or crouching) and now and then stops to spit a fan of three fireballs at him. Only
 * its HEAD can be hurt by the whip and the dagger (`BeastHead`, at the front of the 36×40 body,
 * over Simon's standing lash: jump and lash it); holy water burns it anywhere.
 */

/** Hit points of each form: the whip takes one a lash, the bar shows each as two segments. */
export const DRACULA_HP = 8;
export const BEAST_HP = 8;
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

/** The ENEMY bar: the current form's hit points out of `max` (the beast's refill raises `hp`). */
export class BossLife {
  hp = DRACULA_HP;
  max = DRACULA_HP;
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
    this.life.hp = Math.max(0, this.life.hp - src.amount);
    this.life.iframes = BOSS_IFRAMES;
    this.flash = BOSS_IFRAMES;
    world.audio.sfx('hurt-enemy');
    if (this.life.hp <= 0) {
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
    if (this.state === 'down') {
      // His head is gone (it flies off): the body stands headless until it bursts.
      const x = toPx(this.body.x) - view.camX - 6;
      const y = toPx(this.body.y) - 6;
      const frame = 'dracula-headless';
      const fb: Fallback = ['#202020', '#5c3c9c'];
      // (without the art: the body's box under where the head was)
      if (hasCryptFrame(view.assets, frame))
        drawCrypt(r, view.assets, frame, x, y, 32, 48, fb, this.facing > 0);
      else drawCrypt(r, view.assets, frame, x, y + 16, 32, 32, fb, this.facing > 0);
      return;
    }
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

/* ---------- Between the forms: the head flies off ---------- */

/** Frames the flying head is drawn turned one way before it flips. */
const HEAD_SPIN = 6;

/** Dracula's head, flown off his shoulders when his first bar is empty: up and off the screen. */
export class FlyingHead extends Entity {
  readonly kind = 'dracula-flying-head';
  age = 0;
  constructor(x: number, y: number, dir: -1 | 1) {
    super(x, y, 16, 16);
    this.body.vx = dir * 0x00c00;
    this.body.vy = -0x03800;
    this.facing = dir;
    this.layer = 'front';
    this.despawnMargin = null;
  }

  update(): void {
    this.age++;
    const b = this.body;
    b.vy += 0x00080;
    b.x += velToSub(b.vx);
    b.y += velToSub(b.vy);
    if (b.y + b.h < px(-16) || this.age > 240) this.destroy();
  }

  render(r: Renderer, view: View): void {
    const flip = Math.floor(this.age / HEAD_SPIN) % 2 === 0;
    const x = toPx(this.body.x) - view.camX;
    drawCrypt(r, view.assets, 'dracula-head', x, toPx(this.body.y), 16, 16, ['#fcfcfc', '#f8b8f8'], flip);
  }
}

/* ---------- Form 2: the beast ---------- */

export type BeastState = 'drop' | 'land' | 'stand' | 'spit-wind' | 'spit' | 'crouch' | 'leap' | 'down';
export type BeastMove = 'spit' | 'leap' | 'high-leap';

/** The beast's beats (frames). */
export const LAND_FRAMES = 16;
export const STAND_FRAMES = 60;
export const SPIT_WIND = 40;
export const SPIT_HOLD = 30;
export const CROUCH_FRAMES = 20;
export const BEAST_DOWN_FRAMES = 90;
/** Middling hops between fans of fire. */
export const LEAPS_PER_SPIT = 2;
/** Gravity in its leaps and its drop, and the two leaps' take-off speeds (velocity units). */
export const LEAP_GRAVITY = 0x00300;
/** About 2 tiles up: too low to run under. */
export const LEAP_MID_VY = 0x03800;
/** About 6 tiles up: Simon can run under it. */
export const LEAP_HIGH_VY = 0x06000;
export const LEAP_MAX_VX = 0x03000;
/** A middling hop lands this far (px, centre to centre) short of Simon; too close, it hops back this far. */
export const MID_GAP = 56;
export const RETREAT_GAP = 104;
/** Simon within this many px of a wall is cornered: the beast leaps high at him. */
export const CORNER = 24;
/** The fan: three fireballs this many radians apart, aimed at Simon, at this speed. */
export const FAN = 0.35;
export const SPIT_SPEED = 0x01400;
/** The beast's body (px) and its head's box in it, facing left (mirrored facing right). */
export const BEAST_W = 36;
export const BEAST_H = 40;
export const BEAST_HEAD = { x: 0, y: 2, w: 16, h: 16 } as const;

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

/** The art's head sits higher in the leap frame and lower in the spit frame (px). */
const HEAD_DY: Record<string, number> = { 'dracula-beast-1': -3, 'dracula-beast-2': 4 };

/** The beast's head: the part the whip and the dagger can hurt. The beast moves it. */
export class BeastHead extends Enemy {
  readonly kind = 'beast-head';
  constructor(readonly owner: Beast) {
    super(owner.body.x, owner.body.y, BEAST_HEAD.w, BEAST_HEAD.h);
    this.body.vx = 0;
    this.stompable = false;
    this.despawnMargin = null;
    this.contactHurts = false;
  }

  override hit(src: DamageSource, world: World): Reaction {
    return this.owner.headHit(src, world);
  }

  update(): void {
    this.contactHurts = this.owner.solid;
  }

  override render(): void {}
}

/** Holy water burns the beast anywhere (as in Castlevania); everything else only on the head. */
const burnsAnywhere = (src: DamageSource): boolean =>
  src.owner instanceof Entity && src.owner.kind === 'holy-water';

/**
 * Dracula's beast form: drops in, then leaps about the room and stops now and then to spit a fan
 * of fire (see the file's header). `onDown` runs once when its bar is empty.
 */
export class Beast extends Enemy {
  readonly kind = 'beast';
  state: BeastState = 'drop';
  t = 0;
  /** Hops since the last fan (it spits first, once it has landed). */
  hops = LEAPS_PER_SPIT;
  /** Its moves in order (tests). */
  readonly attacks: BeastMove[] = [];
  /** Where the current leap lands (sub-px, its centre). */
  goal = 0;
  readonly head: BeastHead;
  private flash = 0;

  constructor(
    cx: number,
    /** The top of its body when it starts to drop (sub-px). */
    top: number,
    readonly floorY: number,
    readonly roomX: number,
    readonly life: BossLife,
    private readonly onDown: () => void,
  ) {
    super(cx - px(BEAST_W >> 1), top, BEAST_W, BEAST_H);
    this.body.vx = 0;
    this.body.vy = 0;
    this.stompable = false;
    this.despawnMargin = null;
    this.vulnerability = {};
    this.contactHurts = false;
    this.head = new BeastHead(this);
    this.placeHead();
  }

  /** It touches Simon (not while dropping in or going down). */
  get solid(): boolean {
    return this.state !== 'drop' && this.state !== 'down';
  }

  get hurtable(): boolean {
    return this.solid;
  }

  get centerX(): number {
    return this.body.x + (this.body.w >> 1);
  }

  /** The body: holy water burns it; a lash or a dagger only clinks off. */
  override hit(src: DamageSource, world: World): Reaction {
    if (burnsAnywhere(src)) return this.hurt(src, world);
    if (this.hurtable) world.audio.sfx('bump');
    return 'immune';
  }

  headHit(src: DamageSource, world: World): Reaction {
    return this.hurt(src, world);
  }

  private hurt(src: DamageSource, world: World): Reaction {
    if (!this.hurtable || this.life.iframes > 0 || src.amount <= 0) return 'immune';
    this.life.hp = Math.max(0, this.life.hp - src.amount);
    this.life.iframes = BOSS_IFRAMES;
    this.flash = BOSS_IFRAMES;
    world.audio.sfx('hurt-enemy');
    if (this.life.hp <= 0) {
      this.go('down');
      this.body.vx = 0;
      this.body.vy = 0;
      for (const e of world.entities) if (e instanceof CvShot) e.destroy();
      this.onDown();
    }
    return 'hp';
  }

  private go(s: BeastState): void {
    this.state = s;
    this.t = 0;
  }

  /** The room's floor span its centre may land on (sub-px). */
  private span(): [number, number] {
    const half = this.body.w >> 1;
    return [tileToSub(this.roomX + 1) + half, tileToSub(this.roomX + 15) - half];
  }

  private placeHead(): void {
    const b = this.body;
    const dy = HEAD_DY[this.currentFrame] ?? 0;
    const x = this.facing < 0 ? BEAST_HEAD.x : BEAST_W - BEAST_HEAD.x - BEAST_HEAD.w;
    this.head.body.x = b.x + px(x);
    this.head.body.y = b.y + px(BEAST_HEAD.y + dy);
  }

  update(world: World): void {
    if (this.life.iframes > 0) this.life.iframes--;
    if (this.flash > 0) this.flash--;
    const p = world.nearestPlayer(this.body.x);
    const b = this.body;
    this.t++;
    const grounded = this.state !== 'drop' && this.state !== 'leap' && this.state !== 'down';
    if (grounded) this.facing = p.centerX < this.centerX ? -1 : 1;
    switch (this.state) {
      case 'drop':
      case 'leap':
        moveX(b, world.map, velToSub(b.vx));
        b.vy += LEAP_GRAVITY;
        moveY(b, world.map, velToSub(b.vy));
        if (b.onGround && b.vy >= 0) {
          b.vx = 0;
          b.vy = 0;
          this.go('land');
          this.thud(world);
        }
        break;
      case 'land':
        if (this.t >= LAND_FRAMES) this.go('stand');
        break;
      case 'stand':
        if (this.t >= STAND_FRAMES) {
          if (this.hops >= LEAPS_PER_SPIT) {
            this.hops = 0;
            this.attacks.push('spit');
            this.go('spit-wind');
            world.audio.sfx(CV_SOUNDS.roar);
          } else this.go('crouch');
        }
        break;
      case 'spit-wind':
        if (this.t >= SPIT_WIND) {
          this.spit(world, p);
          this.go('spit');
        }
        break;
      case 'spit':
        if (this.t >= SPIT_HOLD) this.go('stand');
        break;
      case 'crouch':
        if (this.t >= CROUCH_FRAMES) this.leap(p);
        break;
      case 'down':
        if (this.t % 12 === 1 && this.t < BEAST_DOWN_FRAMES)
          world.spawn(new Burst(b.x + px((this.t * 7) % 36), b.y + px((this.t * 13) % 40)));
        break;
    }
    this.contactHurts = this.solid;
    this.currentFrame =
      this.state === 'leap' || this.state === 'drop'
        ? 'dracula-beast-1'
        : this.state === 'spit' || this.state === 'spit-wind'
          ? 'dracula-beast-2'
          : 'dracula-beast-0';
    this.placeHead();
  }

  /**
   * Takes off. Simon cornered (or crouching): a high leap that lands on him, high enough to run
   * under. Otherwise a middling hop that lands MID_GAP short of him, or back to RETREAT_GAP when it
   * is there already (over him, high, when its back is to the wall).
   */
  private leap(p: Player): void {
    const b = this.body;
    const [lo, hi] = this.span();
    const pcx = p.centerX;
    const wallL = tileToSub(this.roomX + 1);
    const wallR = tileToSub(this.roomX + 15);
    const cornered = pcx - wallL < px(CORNER) || wallR - pcx < px(CORNER);
    const clamp = (x: number) => Math.max(lo, Math.min(hi, x));
    const dir = pcx < this.centerX ? -1 : 1;
    let high = cornered || p.crouching;
    let goal: number;
    if (high) goal = clamp(pcx);
    else {
      goal = clamp(pcx - dir * px(MID_GAP));
      if (Math.abs(goal - this.centerX) < px(24)) {
        goal = clamp(pcx - dir * px(RETREAT_GAP));
        if (Math.abs(goal - this.centerX) < px(24)) {
          high = true;
          goal = clamp(pcx + dir * px(MID_GAP));
        }
      }
    }
    const vy = high ? LEAP_HIGH_VY : LEAP_MID_VY;
    const air = (2 * vy) / LEAP_GRAVITY;
    this.goal = goal;
    // (sub-px a frame to velocity units: × 16)
    const vx = Math.round(((goal - this.centerX) / air) * 16);
    b.vx = Math.max(-LEAP_MAX_VX, Math.min(LEAP_MAX_VX, vx));
    b.vy = -vy;
    b.onGround = false;
    if (goal !== this.centerX) this.facing = goal < this.centerX ? -1 : 1;
    this.hops++;
    this.attacks.push(high ? 'high-leap' : 'leap');
    this.go('leap');
  }

  /** The fan: three fireballs from its maw, the middle one at Simon. */
  private spit(world: World, p: Player): void {
    const b = this.body;
    const mx = this.facing < 0 ? b.x + px(2) : b.x + b.w - px(2);
    const my = b.y + px(22);
    const a = Math.atan2(p.body.y + (p.body.h >> 1) - my, p.centerX - mx);
    for (const k of [-1, 0, 1]) {
      const ang = a + k * FAN;
      world.spawn(
        new CvShot(
          mx - px(6),
          my - px(6),
          Math.round(Math.cos(ang) * SPIT_SPEED),
          Math.round(Math.sin(ang) * SPIT_SPEED),
          BEAST_FIRE,
          this,
        ),
      );
    }
    world.audio.sfx(CV_SOUNDS.fire);
  }

  /** Landing: a thud, and the floor shakes (not with reduce flashing). */
  private thud(world: World): void {
    if (!world.ctx.reduceFlashing) world.shake(8);
    world.audio.sfx(CV_SOUNDS.stomp);
  }

  override destroy(): void {
    super.destroy();
    this.head.destroy();
  }

  override render(r: Renderer, view: View): void {
    const b = this.body;
    const x = toPx(b.x) - view.camX - 6;
    // Crouching to leap: it sinks 2 px as a warning.
    const y = toPx(b.y) - 8 + (this.state === 'crouch' ? 2 : 0);
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
