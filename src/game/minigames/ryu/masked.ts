import type { Renderer } from '@engine/gfx/renderer';
import { overlaps } from '@engine/math/aabb';
import { px, tileToSub, toPx, velToSub } from '@engine/math/units';
import { Entity, type View } from '../../entities/entity';
import { Enemy } from '../../entities/enemies/enemy';
import type { Player } from '../../entities/player';
import type { DamageSource, Reaction } from '../../rules/damage';
import type { World } from '../../world/world';
import { drawNinja, NG_SOUNDS, type Fallback } from './art';
import { bladeReaches, Burst, hurtRyu, NgShot, type NgShotSpec } from './creatures';

/*
 * The Masked Ninja (docs/HEROES.md, Ryu's mini game): a cursed rival in a demon mask, fought in
 * the rooftop arena (16 columns between two tall stone towers). Not a copy of Ryu: he never slashes or casts as Ryu
 * does. His round:
 *
 *   stand (he can be hurt) -> crouch (the telegraph: a dash is coming; he can be hurt)
 *   -> DASH along the floor at Ryu and on to the wall behind him (jump him; blades clang off)
 *   -> turn at that wall (he can be hurt) -> RUN UP the wall (blades clang off)
 *   -> on the wall: throws three ninja stars, each aimed at Ryu (he can be hurt: a jumping slash
 *      or a ninpo art reaches him) -> aim (a glint: the telegraph) -> DIVE in a straight line at
 *      where Ryu stood (blades clang off) -> recover, kneeling where he landed (he can be hurt)
 *   -> stand ...
 *
 * Under half his hit points he is quicker (a faster dash and dive, shorter rests) and his
 * AFTERIMAGE follows each dash and dive AFTERIMAGE_LAG frames behind him on the same path: a
 * jump over the dash has to clear both, and a dodge of the dive must hold until both are down.
 */

/** Hit points (the ENEMY bar) and the frames he can't be hurt again after a hit. */
export const MASKED_HP = 10;
export const MASKED_IFRAMES = 20;
/** From this many hit points down he fights in his second manner (quicker, the afterimage). */
export const PHASE_TWO_HP = 5;

/** Frames of each state (phase 1; phase 2 rests are shorter). */
export const INTRO_FRAMES = 50;
export const STAND_FRAMES = 40;
export const CROUCH_FRAMES = 30;
export const TURN_FRAMES = 18;
export const WALL_FRAMES = 64;
/** The wall frames on which a star flies. */
export const STAR_AT = [10, 24, 38] as const;
export const AIM_FRAMES = 20;
export const RECOVER_FRAMES = 72;
/** Speeds (velocity units: 0x1000 is 1 px a frame): the dash, the run up the wall, the dive, a star. */
export const DASH_SPEED = 0x03800;
export const DASH_SPEED_2 = 0x04800;
export const CLIMB_SPEED = 0x03000;
export const DIVE_SPEED = 0x04000;
export const DIVE_SPEED_2 = 0x04c00;
export const STAR_SPEED = 0x03000;
/** How high on the wall he stops (px from the floor to his feet). */
export const WALL_HEIGHT = 72;
/** The afterimage's lag behind him (frames). */
export const AFTERIMAGE_LAG = 14;
/** Touching him (or his afterimage), whatever he is doing, costs this many hit points. */
export const TOUCH_DAMAGE = 2;
/** How many of his moves `moves` keeps (the first ones; tests). */
export const MOVES_KEPT = 32;

export type MaskedState =
  'intro' | 'stand' | 'crouch' | 'dash' | 'turn' | 'climb' | 'wall' | 'aim' | 'dive' | 'recover' | 'down';

/** The states in which a blade or an art hurts him (the rest clang off). */
const HURTABLE: ReadonlySet<MaskedState> = new Set(['stand', 'crouch', 'turn', 'wall', 'aim', 'recover']);

export const NINJA_STAR: NgShotSpec = {
  kind: 'ninja-star',
  w: 8,
  h: 8,
  damage: 2,
  frames: ['ninja-star', 'ninja-star-1'],
  fallback: ['#7c7c7c', '#fcfcfc'],
};

/** The ENEMY bar. */
export class BossLife {
  hp = MASKED_HP;
  iframes = 0;
}

const TRAIL = 32;

/**
 * The Masked Ninja. `roomX` is the arena's left tower column (16 columns, a tower on each end),
 * `floorY` the floor's top (px). `onDown` runs once when his hit points are gone.
 */
export class MaskedNinja extends Enemy {
  readonly kind = 'masked-ninja';
  state: MaskedState = 'intro';
  t = 0;
  /** His first MOVES_KEPT moves, in order (tests). */
  readonly moves: MaskedState[] = [];
  /** Where the dive is headed (subpixels: the centre x on the floor). */
  diveX = 0;
  private vx = 0;
  private vy = 0;
  private flash = 0;
  /** His last TRAIL positions (subpixels), for the afterimage. */
  private readonly trailX = new Int32Array(TRAIL);
  private readonly trailY = new Int32Array(TRAIL);
  private trailN = 0;
  private readonly trailPos = { x: 0, y: 0 };
  /** Frames the afterimage still has to run (it follows a dash or a dive in phase 2). */
  ghostLeft = 0;
  readonly afterimage: Afterimage;

  constructor(
    cx: number,
    readonly roomX: number,
    readonly floorY: number,
    readonly life: BossLife,
    private readonly onDown: () => void,
  ) {
    super(cx - px(7), px(floorY - 30), 14, 30);
    this.body.vx = 0;
    this.stompable = false;
    this.contactHurts = false;
    this.vulnerability = {};
    this.despawnMargin = null;
    this.activated = true;
    this.spriteOffsetX = 1;
    this.spriteOffsetY = 2;
    this.afterimage = new Afterimage(this);
    this.trailX.fill(this.body.x);
    this.trailY.fill(this.body.y);
  }

  /** The arena's inner faces (subpixels): the left tower's right face, the right tower's left face. */
  get left(): number {
    return tileToSub(this.roomX + 1);
  }
  get right(): number {
    return tileToSub(this.roomX + 15);
  }

  get phaseTwo(): boolean {
    return this.life.hp <= PHASE_TWO_HP;
  }

  get hurtable(): boolean {
    return HURTABLE.has(this.state);
  }

  get centerX(): number {
    return this.body.x + (this.body.w >> 1);
  }

  /** Where he was `lag` frames ago (subpixels). */
  trailAt(lag: number): { x: number; y: number } {
    const i = (this.trailN - 1 - Math.min(lag, TRAIL - 1) + TRAIL * 2) % TRAIL;
    this.trailPos.x = this.trailX[i] ?? this.body.x;
    this.trailPos.y = this.trailY[i] ?? this.body.y;
    return this.trailPos;
  }

  private set(s: MaskedState): void {
    this.state = s;
    this.t = 0;
    if (s !== 'intro' && s !== 'down' && this.moves.length < MOVES_KEPT) this.moves.push(s);
  }

  override hit(src: DamageSource, world: World): Reaction {
    if (this.state === 'down' || src.kind === 'stomp') return 'immune';
    if (!this.hurtable) {
      world.audio.sfx(NG_SOUNDS.clang);
      return 'immune';
    }
    if (this.life.iframes > 0) return 'immune';
    const before = this.phaseTwo;
    this.life.hp = Math.max(0, this.life.hp - Math.max(1, src.amount));
    this.life.iframes = MASKED_IFRAMES;
    this.flash = MASKED_IFRAMES;
    world.audio.sfx('hit');
    if (this.life.hp <= 0) {
      this.set('down');
      const b = this.body;
      world.spawn(new Burst(b.x + (b.w >> 1), b.y + (b.h >> 1)));
      this.ghostLeft = 0;
      this.onDown();
      return 'hp';
    }
    if (!before && this.phaseTwo) world.audio.sfx(NG_SOUNDS.hawk);
    return 'hp';
  }

  update(world: World): void {
    if (this.life.iframes > 0) this.life.iframes--;
    if (this.flash > 0) this.flash--;
    this.t++;
    const b = this.body;
    const p = world.player;
    const two = this.phaseTwo;
    switch (this.state) {
      case 'intro':
        this.faceRyu(p);
        if (this.t >= INTRO_FRAMES) this.set('stand');
        break;
      case 'stand':
        this.faceRyu(p);
        if (this.t >= (two ? STAND_FRAMES - 12 : STAND_FRAMES)) this.set('crouch');
        break;
      case 'crouch':
        this.faceRyu(p);
        if (this.t === 1) world.audio.sfx(NG_SOUNDS.slash);
        if (this.t >= CROUCH_FRAMES) {
          this.set('dash');
          this.vx = this.facing * (two ? DASH_SPEED_2 : DASH_SPEED);
          if (two) this.ghostLeft = AFTERIMAGE_LAG + 1;
        }
        break;
      case 'dash':
        b.x += velToSub(this.vx);
        if (b.x <= this.left || b.x + b.w >= this.right) {
          b.x = Math.max(this.left, Math.min(this.right - b.w, b.x));
          this.set('turn');
          this.facing = b.x <= this.left ? 1 : -1;
        }
        break;
      case 'turn':
        this.facing = b.x <= this.left ? 1 : -1;
        if (this.t >= (two ? TURN_FRAMES - 6 : TURN_FRAMES)) this.set('climb');
        break;
      case 'climb':
        b.y -= velToSub(CLIMB_SPEED);
        if (b.y + b.h <= px(this.floorY - WALL_HEIGHT)) {
          b.y = px(this.floorY - WALL_HEIGHT) - b.h;
          this.set('wall');
        }
        break;
      case 'wall':
        if ((STAR_AT as readonly number[]).includes(this.t)) this.throwStar(world, p);
        if (this.t >= WALL_FRAMES) this.set('aim');
        break;
      case 'aim':
        if (this.t >= AIM_FRAMES) this.startDive(p, two);
        break;
      case 'dive':
        b.x += velToSub(this.vx);
        b.y += velToSub(this.vy);
        b.x = Math.max(this.left, Math.min(this.right - b.w, b.x));
        if (b.y + b.h >= px(this.floorY)) {
          b.y = px(this.floorY) - b.h;
          this.set('recover');
          world.audio.sfx('stomp');
        }
        break;
      case 'recover':
        if (this.t >= (two ? RECOVER_FRAMES - 16 : RECOVER_FRAMES)) this.set('stand');
        break;
      case 'down':
        return;
    }
    // His trail, for the afterimage.
    this.trailX[this.trailN % TRAIL] = b.x;
    this.trailY[this.trailN % TRAIL] = b.y;
    this.trailN++;
    if (this.ghostLeft > 0 && this.state !== 'dash' && this.state !== 'dive') this.ghostLeft--;
    this.currentFrame = this.frameName();
    this.touch(world, p);
  }

  private faceRyu(p: Player): void {
    this.facing = p.centerX < this.centerX ? -1 : 1;
  }

  private startDive(p: Player, two: boolean): void {
    const b = this.body;
    this.diveX = p.centerX;
    const dx = this.diveX - this.centerX;
    const dy = px(this.floorY) - (b.y + b.h);
    const len = Math.max(1, Math.hypot(dx, dy));
    const speed = two ? DIVE_SPEED_2 : DIVE_SPEED;
    this.vx = Math.round((dx / len) * speed);
    this.vy = Math.round((dy / len) * speed);
    this.facing = dx < 0 ? -1 : 1;
    if (two) this.ghostLeft = AFTERIMAGE_LAG + 1;
    this.set('dive');
  }

  private throwStar(world: World, p: Player): void {
    const b = this.body;
    const sx = this.centerX - px(4);
    const sy = b.y + px(8);
    const dx = p.centerX - (sx + px(4));
    const dy = p.body.y + px(12) - (sy + px(4));
    const len = Math.max(1, Math.hypot(dx, dy));
    world.spawn(
      new NgShot(
        sx,
        sy,
        Math.round((dx / len) * STAR_SPEED),
        Math.round((dy / len) * STAR_SPEED),
        NINJA_STAR,
      ),
    );
    world.audio.sfx(NG_SOUNDS.star);
  }

  private touch(world: World, p: Player): void {
    const b = this.body;
    if (p.dead || p.out || !overlaps(b, p.body)) return;
    // His blade-on-blade: a slash that meets him while he can be hurt does not hurt Ryu back.
    if (this.hurtable && bladeReaches(p, b)) return;
    hurtRyu(world, p, TOUCH_DAMAGE, b.x + (b.w >> 1) < p.centerX ? 1 : -1);
  }

  private frameName(): string {
    switch (this.state) {
      case 'dash':
        return 'masked-ninja-1';
      case 'climb':
      case 'wall':
      case 'aim':
      case 'dive':
        return 'masked-ninja-2';
      case 'crouch':
      case 'recover':
        return 'masked-ninja-3';
      default:
        return 'masked-ninja-0';
    }
  }

  /** The aim's glint (a small star at his mask) is shown from this frame on. */
  get glint(): boolean {
    return this.state === 'aim';
  }

  override render(r: Renderer, view: View): void {
    if (this.state === 'down') return;
    const hurt = this.flash > 0;
    const look = hurt && !view.reduceFlashing ? 'flash' : 'plain';
    const frame = hurt ? 'masked-ninja-hurt' : this.currentFrame;
    const x = this.screenX(view);
    const y = this.screenY();
    drawNinja(r, view.assets, frame, x, y, 16, 32, MASKED_LOOK, this.facing > 0, look);
    if (this.glint) {
      // A steady glint at the mask (no blinking, so it is the same with reduce flashing).
      const gx = x + (this.facing > 0 ? 10 : 2);
      r.rect(gx, y + 4, 4, 1, '#fcfcfc');
      r.rect(gx + 1, y + 3, 2, 3, '#fcfcfc');
    }
  }
}

export const MASKED_LOOK: Fallback = ['#3c1c7c', '#d82800'];

/**
 * His afterimage (phase 2): runs his dash and dive AFTERIMAGE_LAG frames behind him on his own
 * path, and hurts like him. It can't be hurt (a blade passes through), and is only there while
 * it has a dash or a dive to run.
 */
export class Afterimage extends Entity {
  readonly kind = 'afterimage';
  constructor(readonly owner: MaskedNinja) {
    super(owner.body.x, owner.body.y, 14, 30);
    this.despawnMargin = null;
  }

  /** Running (drawn, and it hurts). */
  get active(): boolean {
    return this.owner.ghostLeft > 0 && this.owner.state !== 'down';
  }

  update(world: World): void {
    if (!this.active) return;
    const at = this.owner.trailAt(AFTERIMAGE_LAG);
    this.body.x = at.x;
    this.body.y = at.y;
    const p = world.player;
    const b = this.body;
    if (p.dead || p.out || !overlaps(b, p.body)) return;
    hurtRyu(world, p, TOUCH_DAMAGE, b.x + (b.w >> 1) < p.centerX ? 1 : -1);
  }

  render(r: Renderer, view: View): void {
    if (!this.active) return;
    const x = toPx(this.body.x) - view.camX - 1;
    const y = toPx(this.body.y) - 2;
    const frame =
      this.owner.state === 'dash' || this.owner.state === 'turn' ? 'afterimage' : 'masked-ninja-2';
    drawNinja(r, view.assets, frame, x, y, 16, 32, MASKED_LOOK, this.owner.facing > 0, 'ghost');
  }
}
