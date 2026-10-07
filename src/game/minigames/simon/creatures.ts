import type { Renderer } from '@engine/gfx/renderer';
import { overlaps } from '@engine/math/aabb';
import { px, tileAt, tileToSub, toPx, velToSub } from '@engine/math/units';
import { Entity, type View } from '../../entities/entity';
import { Enemy } from '../../entities/enemies/enemy';
import { Pickup } from '../../entities/objects/pickup';
import type { Player } from '../../entities/player';
import type { DamageSource, Reaction, Vulnerability } from '../../rules/damage';
import { ENEMY_SCORES } from '../../rules/score';
import type { World } from '../../world/world';
import { CV_SOUNDS, drawCrypt, type Fallback } from './art';

/*
 * Dracula's Castle's creatures and props (docs/HEROES.md, Simon's mini game): wall candles, the
 * sub-weapon, bats, Medusa heads, bone-throwing skeletons, their shots and the throne room's
 * door. They are the mini game's own entity types (World's `extraEntities`, stage.ts).
 */

/**
 * Hurts Simon by `amount` hit points through World.hurtPlayer (which takes his usual 2: a
 * smaller hit gives the difference back first, a bigger one takes the rest first, leaving at
 * least 1 so the usual hit decides life or death). Nothing while he blinks or under the No damage
 * assist. Returns whether it hurt.
 */
export function hurtSimon(world: World, p: Player, amount: number, fromDir: -1 | 1): boolean {
  if (p.dead || p.out || p.invulnerable || world.assist.invulnerable) return false;
  if (amount < 2) p.hp += 2 - amount;
  if (amount > 2) p.hp = Math.max(1, p.hp - (amount - 2));
  world.hurtPlayer(p, fromDir);
  return true;
}

/** Hit points a castle creature (bat, Medusa head, bone, skeleton) takes from Simon: one bar. */
export const CREATURE_DAMAGE = 1;

/** What the castle's creatures take hits from: the whip, the sub-weapons (and a star). */
export const CREATURE_VULNERABILITY: Vulnerability = {
  sword: 'hp',
  weapon: 'hp',
  fireball: 'hp',
  bomb: 'hp',
  buster: 'hp',
  star: 'kill',
};

/** Is a body on screen (with a margin, px)? */
export function onScreen(world: World, e: Entity, margin = 0): boolean {
  const b = e.body;
  return b.x + b.w > world.camera.x - px(margin) && b.x < world.camera.right + px(margin);
}

/** A small flame where a creature or candle was struck down. */
export class Burst extends Entity {
  readonly kind = 'burst';
  age = 0;
  constructor(cx: number, cy: number) {
    super(cx - px(8), cy - px(8), 16, 16);
    this.layer = 'front';
  }
  update(): void {
    if (++this.age >= 16) this.destroy();
  }
  render(r: Renderer, view: View): void {
    const f = `burst-${Math.min(1, this.age >> 3)}`;
    drawCrypt(r, view.assets, f, this.screenX(view), this.screenY(), 16, 16, ['#f83800', '#fca044']);
  }
}

/**
 * A castle creature: hit points, the whip and the sub-weapons hurt it, it can't be stomped, and it
 * goes up in a small flame (Simon's own drop table: now and then a heart).
 */
export abstract class Creature extends Enemy {
  /** Frames of the hit flash (not with reduce flashing). */
  protected flash = 0;
  constructor(x: number, y: number, w: number, h: number, hp: number) {
    super(x, y, w, h);
    this.hp = hp;
    this.body.vx = 0;
    this.vulnerability = { ...CREATURE_VULNERABILITY };
    this.stompable = false;
    this.fallsOffLedges = false;
    this.scores = ENEMY_SCORES.DEFAULT;
  }

  override hit(src: DamageSource, world: World): Reaction {
    const r = super.hit(src, world);
    if (r === 'hp' && this.alive) this.flash = 8;
    return r;
  }

  protected override flipOut(_src: DamageSource, world: World): void {
    const b = this.body;
    world.spawn(new Burst(b.x + (b.w >> 1), b.y + (b.h >> 1)));
    world.audio.sfx('kick');
    this.destroy();
  }

  protected tick(): void {
    if (this.flash > 0) this.flash--;
  }

  /**
   * Flyers (bats, Medusa heads) crumble once they strike Simon, as Castlevania's bats do: one
   * hit each, never a chain of hits as it drifts along with him. Returns whether it struck.
   */
  protected strikeOnce(world: World): boolean {
    for (const p of world.activePlayers()) {
      if (!overlaps(this.body, p.body) || p.invulnerable || world.assist.invulnerable) continue;
      if (p.activeMelee && overlaps(p.activeMelee, this.body)) continue;
      hurtSimon(world, p, CREATURE_DAMAGE, this.body.x + (this.body.w >> 1) < p.centerX ? 1 : -1);
      const b = this.body;
      world.spawn(new Burst(b.x + (b.w >> 1), b.y + (b.h >> 1)));
      this.destroy();
      return true;
    }
    return false;
  }

  protected target(world: World): Player {
    return world.nearestPlayer(this.body.x + (this.body.w >> 1));
  }

  /** The sprite box (px) relative to the body, and its fallback colours. */
  protected abstract readonly look: { w: number; h: number; fallback: Fallback };

  override render(r: Renderer, view: View): void {
    drawCrypt(
      r,
      view.assets,
      this.currentFrame,
      this.screenX(view),
      this.screenY(),
      this.look.w,
      this.look.h,
      this.look.fallback,
      this.facing > 0,
      this.flash > 0 && !view.reduceFlashing,
    );
  }
}

/* ---------- Candles and the sub-weapon ---------- */

export type CandleDrop = 'heart' | 'big' | 'dagger' | 'meat';

/**
 * A wall candle (8×16, centred in its tile, 4 px down so a standing lash reaches it): harmless, snuffed by the whip or a sub-weapon, it
 * leaves its drop: a small heart (1), a big heart (5), the sub-weapon or a wall roast (hit points).
 */
export class Candle extends Enemy {
  readonly kind = 'candle';
  constructor(
    tx: number,
    ty: number,
    readonly drop: CandleDrop,
    private readonly onDagger: (p: Player) => void,
  ) {
    super(tileToSub(tx) + px(4), tileToSub(ty) + px(4), 8, 16);
    this.body.vx = 0;
    this.contactHurts = false;
    this.stompable = false;
    this.vulnerability = { sword: 'kill', weapon: 'kill', fireball: 'kill', bomb: 'kill', buster: 'kill' };
    this.scores = { stomp: 0, attack: 100, star: 0, below: 0 };
    this.currentFrame = 'candle-0';
    this.despawnMargin = 32;
  }

  update(world: World): void {
    this.currentFrame = world.ctx.reduceFlashing ? 'candle-0' : `candle-${(world.frame >> 3) & 1}`;
  }

  protected override flipOut(_src: DamageSource, world: World): void {
    const b = this.body;
    world.spawn(new Burst(b.x + (b.w >> 1), b.y + (b.h >> 1)));
    world.audio.sfx(CV_SOUNDS.candle);
    this.destroy();
  }

  protected override onKilled(_src: DamageSource, world: World): void {
    const b = this.body;
    const cx = b.x + (b.w >> 1);
    if (this.drop === 'dagger') world.spawn(new SubWeaponItem(cx, b.y + b.h, this.onDagger));
    else if (this.drop === 'meat') world.spawn(new Roast(cx, b.y + b.h));
    else world.spawn(new Pickup(cx, b.y + b.h, this.drop === 'big' ? 'heart-large' : 'heart-small'));
  }

  override render(r: Renderer, view: View): void {
    drawCrypt(r, view.assets, this.currentFrame, this.screenX(view), this.screenY(), 8, 16, [
      '#fca044',
      '#fcfcfc',
    ]);
  }
}

/** The sub-weapon a candle drops (the dagger): falls to the floor; touching it takes it. */
export class SubWeaponItem extends Entity {
  readonly kind = 'sub-weapon';
  constructor(
    cx: number,
    bottom: number,
    private readonly onTake: (p: Player) => void,
  ) {
    super(cx - px(8), bottom - px(8), 16, 8);
    this.despawnMargin = null;
    this.body.vy = -0x02000;
  }

  update(world: World): void {
    this.fall(world);
    for (const p of world.activePlayers()) {
      if (!overlaps(this.body, p.body)) continue;
      this.destroy();
      this.onTake(p);
      return;
    }
  }

  render(r: Renderer, view: View): void {
    r.sprite(view.assets.sheet('items'), 'dagger', this.screenX(view), this.screenY());
  }
}

/** Hit points a wall roast gives back. */
export const ROAST_HP = 8;

/** A wall roast (a candle's drop): falls to the floor; touching it restores ROAST_HP hit points. */
export class Roast extends Entity {
  readonly kind = 'roast';
  constructor(cx: number, bottom: number) {
    super(cx - px(8), bottom - px(12), 16, 12);
    this.despawnMargin = null;
    this.body.vy = -0x02000;
  }

  update(world: World): void {
    this.fall(world);
    for (const p of world.activePlayers()) {
      if (!overlaps(this.body, p.body)) continue;
      p.hp = Math.min(p.def.damage.kind === 'hp' ? p.def.damage.max : p.hp, p.hp + ROAST_HP);
      world.audio.sfx('powerup');
      this.destroy();
      return;
    }
  }

  render(r: Renderer, view: View): void {
    drawCrypt(r, view.assets, 'meat', this.screenX(view), this.screenY() - 4, 16, 16, ['#7c0800', '#d82800']);
  }
}

/* ---------- Bat ---------- */

/** px across within which a roosting bat wakes. */
export const BAT_WAKE = 96;
/** Flight speed (velocity units: 1 px a frame), the bob (px) and its period (frames). */
export const BAT_SPEED = 0x01000;
const BAT_BOB = 8;
const BAT_PERIOD = 40;
/** Frames the swoop from the roost down to the flight line takes. */
export const BAT_SWOOP = 24;

export type BatState = 'roost' | 'swoop' | 'fly';

/**
 * A bat: hangs asleep until Simon comes within BAT_WAKE px, swoops down to his head height, then
 * flies straight on toward where he was, bobbing, never turning; crumbles once it strikes him.
 * One hit.
 */
export class Bat extends Creature {
  readonly kind = 'bat';
  protected readonly look = { w: 16, h: 16, fallback: ['#5c3c9c', '#9c7cdc'] as Fallback };
  state: BatState = 'roost';
  private t = 0;
  private fromY = 0;
  private lineY = 0;
  constructor(x: number, y: number) {
    super(x, y, 12, 10, 1);
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 3;
    this.currentFrame = 'bat-0';
    this.contactHurts = false;
  }

  update(world: World): void {
    this.tick();
    const b = this.body;
    if (this.state === 'roost') {
      const p = this.target(world);
      if (!onScreen(world, this, -8) || p.dead) return;
      if (Math.abs(p.centerX - (b.x + (b.w >> 1))) > px(BAT_WAKE)) return;
      this.state = 'swoop';
      this.t = 0;
      this.facing = p.centerX < b.x ? -1 : 1;
      this.fromY = b.y;
      // His head height (a little above his middle).
      this.lineY = p.body.y + px(4) - (b.h >> 1);
    }
    this.t++;
    b.x += velToSub(this.facing * BAT_SPEED);
    if (this.state === 'swoop') {
      const k = Math.min(1, this.t / BAT_SWOOP);
      b.y = Math.round(this.fromY + (this.lineY - this.fromY) * Math.sin((k * Math.PI) / 2));
      if (this.t >= BAT_SWOOP) {
        this.state = 'fly';
        this.t = 0;
      }
    } else {
      b.y = this.lineY + Math.round(Math.sin((this.t * 2 * Math.PI) / BAT_PERIOD) * px(BAT_BOB));
    }
    this.currentFrame = `bat-${1 + ((this.t >> 3) & 1)}`;
    if (this.strikeOnce(world)) return;
    if (!onScreen(world, this, 48)) this.destroy();
  }
}

/* ---------- Medusa heads ---------- */

/** Frames between heads, the first one's wait, and the most on screen at once. */
export const MEDUSA_EVERY = 220;
export const MEDUSA_FIRST = 90;
export const MEDUSA_MAX = 1;
/** Flight speed (velocity units: 0.625 px a frame), the wave (px) and its period (frames). */
export const MEDUSA_SPEED = 0x00a00;
export const MEDUSA_WAVE = 16;
export const MEDUSA_PERIOD = 72;

/** A flying stone head: crosses the screen in a sine wave; crumbles once it strikes. One hit. */
export class MedusaHead extends Creature {
  readonly kind = 'medusa';
  protected readonly look = { w: 16, h: 16, fallback: ['#00a800', '#b8f818'] as Fallback };
  age = 0;
  constructor(
    x: number,
    readonly baseY: number,
    dir: -1 | 1,
  ) {
    super(x, baseY, 12, 12, 1);
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.facing = dir;
    this.currentFrame = 'medusa-0';
    this.despawnMargin = 16;
    this.contactHurts = false;
  }

  update(world: World): void {
    this.tick();
    this.age++;
    const b = this.body;
    b.x += velToSub(this.facing * MEDUSA_SPEED);
    b.y = this.baseY + Math.round(Math.sin((this.age * 2 * Math.PI) / MEDUSA_PERIOD) * px(MEDUSA_WAVE));
    this.currentFrame = `medusa-${(this.age >> 3) & 1}`;
    if (this.strikeOnce(world)) return;
    if (this.age > 20 && !onScreen(world, this, 16)) this.destroy();
  }
}

/**
 * Where Medusa heads come from (`medusa x y len=N`): while Simon is in columns x..x+N-1 and on
 * the floor or stairs, a head enters every MEDUSA_EVERY frames from the screen edge he faces,
 * its wave centred on row y. At most MEDUSA_MAX at once.
 */
export class MedusaSpawner extends Entity {
  readonly kind = 'medusa-spawner';
  private wait = MEDUSA_FIRST;
  private readonly heads: MedusaHead[] = [];
  constructor(
    readonly tx: number,
    readonly ty: number,
    readonly len: number,
  ) {
    super(tileToSub(tx), tileToSub(ty), len * 16, 16);
    this.despawnMargin = null;
  }

  update(world: World): void {
    const p = world.nearestPlayer(this.body.x + (this.body.w >> 1));
    const col = tileAt(p.centerX);
    if (p.dead || col < this.tx || col >= this.tx + this.len) {
      this.wait = Math.max(this.wait, MEDUSA_FIRST);
      return;
    }
    if (--this.wait > 0) return;
    this.wait = MEDUSA_EVERY;
    const live = this.heads.filter((h) => h.alive);
    this.heads.length = 0;
    this.heads.push(...live);
    if (live.length >= MEDUSA_MAX) return;
    const dir: -1 | 1 = p.facing > 0 ? -1 : 1;
    const x = dir < 0 ? world.camera.right : world.camera.x - px(12);
    const head = new MedusaHead(x, tileToSub(this.ty) + px(2), dir);
    this.heads.push(head);
    world.spawn(head);
  }

  render(): void {}
}

/* ---------- Skeleton ---------- */

/** Frames between bones, how long the throw pose holds, and the reach at which he throws (px). */
export const SKELETON_EVERY = 110;
export const SKELETON_POSE = 16;
export const SKELETON_RANGE = 144;
export const SKELETON_HP = 2;
/** How far he paces from his post (px) and at what speed. */
const SKELETON_PACE = 24;
const SKELETON_WALK = 0x00800;
/** A bone's throw: up at 3.5 px/f under BONE_GRAVITY, timed to come down where Simon stood. */
export const BONE_VY = 0x03800;
export const BONE_GRAVITY = 0x00180;
const BONE_MAX_VX = 0x01c00;

/**
 * A skeleton: paces back and forth by his post facing Simon, and every SKELETON_EVERY frames
 * (with Simon in range) stops, rears back and lobs a bone that comes down where Simon stood.
 * Two hits.
 */
export class Skeleton extends Creature {
  readonly kind = 'skeleton';
  protected readonly look = { w: 16, h: 32, fallback: ['#bcbcbc', '#fcfcfc'] as Fallback };
  private readonly post: number;
  t = 0;
  pose = 0;
  private dir: -1 | 1 = -1;
  constructor(x: number, y: number) {
    super(x, y, 14, 30, SKELETON_HP);
    this.spriteOffsetX = 1;
    this.spriteOffsetY = 2;
    this.post = x;
    this.currentFrame = 'skeleton-0';
    this.t = SKELETON_EVERY - 40;
    // Touching him costs one bar (his own check below), not the usual two.
    this.contactHurts = false;
  }

  update(world: World): void {
    this.tick();
    const b = this.body;
    if (!this.activated) {
      if (!onScreen(world, this, -8)) return this.fall(world);
      this.activated = true;
    }
    const p = this.target(world);
    const dx = p.centerX - (b.x + (b.w >> 1));
    this.facing = dx < 0 ? -1 : 1;
    if (this.pose > 0) {
      this.pose--;
      b.vx = 0;
      if (this.pose === SKELETON_POSE >> 1) this.throwBone(world, p);
    } else {
      // Pace: turn at either end of his beat (and at walls and ledges).
      if (b.x <= this.post - px(SKELETON_PACE)) this.dir = 1;
      else if (b.x >= this.post + px(SKELETON_PACE)) this.dir = -1;
      b.vx = this.dir * SKELETON_WALK;
      this.walkSpeed = SKELETON_WALK;
      const before = b.x;
      this.patrol(world);
      if (b.x === before) this.dir = -this.dir as -1 | 1;
      this.facing = dx < 0 ? -1 : 1;
      if (++this.t >= SKELETON_EVERY && Math.abs(dx) <= px(SKELETON_RANGE) && !p.dead) {
        this.t = 0;
        this.pose = SKELETON_POSE;
      }
    }
    this.fall(world);
    this.currentFrame = this.pose > 0 ? 'skeleton-2' : `skeleton-${(world.frame >> 4) & 1}`;
    for (const q of world.activePlayers())
      if (overlaps(b, q.body) && !(q.activeMelee && overlaps(q.activeMelee, b)))
        hurtSimon(world, q, CREATURE_DAMAGE, b.x + (b.w >> 1) < q.centerX ? 1 : -1);
    if (this.isBelowLevel()) this.destroy();
  }

  private throwBone(world: World, p: Player): void {
    const b = this.body;
    const cx = b.x + (b.w >> 1);
    const air = (2 * BONE_VY) / BONE_GRAVITY;
    const vx = Math.max(-BONE_MAX_VX, Math.min(BONE_MAX_VX, Math.round((p.centerX - cx) / air) << 4));
    world.spawn(new CvShot(cx - px(4), b.y, vx, -BONE_VY, BONE, this));
    world.audio.sfx(CV_SOUNDS.bone);
  }
}

/* ---------- Shots ---------- */

export interface CvShotSpec {
  kind: string;
  w: number;
  h: number;
  /** Hit points it takes from Simon. */
  damage: number;
  /** Gravity (velocity units a frame). */
  gravity: number;
  /** Stopped by walls and floors. */
  hitsTiles: boolean;
  /** Frames (the crypt sheet's, cycled every 4 frames) and the fallback box. */
  frames: readonly string[];
  fallback: Fallback;
}

export const BONE: CvShotSpec = {
  kind: 'bone',
  w: 8,
  h: 8,
  damage: CREATURE_DAMAGE,
  gravity: BONE_GRAVITY,
  hitsTiles: false,
  frames: ['bone'],
  fallback: ['#bcbcbc', '#fcfcfc'],
};

/**
 * A creature's or Dracula's shot: flies (a bone arcs), hurts Simon by its damage, and a lash of
 * the whip knocks it out of the air.
 */
export class CvShot extends Entity {
  readonly kind: string;
  age = 0;
  constructor(
    x: number,
    y: number,
    vx: number,
    vy: number,
    readonly spec: CvShotSpec,
    readonly owner: Entity | null,
  ) {
    super(x, y, spec.w, spec.h);
    this.kind = spec.kind;
    this.body.vx = vx;
    this.body.vy = vy;
    this.facing = vx < 0 ? -1 : 1;
    this.layer = 'front';
    this.despawnMargin = 16;
  }

  update(world: World): void {
    const b = this.body;
    this.age++;
    b.vy += this.spec.gravity;
    b.x += velToSub(b.vx);
    b.y += velToSub(b.vy);
    const solid = world.map.isSolid(tileAt(b.x + (b.w >> 1)), tileAt(b.y + (b.h >> 1)));
    const off = b.x + b.w < world.camera.x - px(8) || b.x > world.camera.right + px(8);
    if (
      off ||
      b.y > px(world.heightPx) ||
      b.y + b.h < px(-64) ||
      (this.spec.hitsTiles && solid && this.age > 2)
    )
      return this.destroy();
    // A lash knocks it away when it comes within 3 px of the whip (a little forgiving).
    const m = px(3);
    for (const p of world.activePlayers()) {
      const l = p.activeMelee;
      if (l && l.x < b.x + b.w + m && b.x - m < l.x + l.w && l.y < b.y + b.h + m && b.y - m < l.y + l.h) {
        world.spawn(new Burst(b.x + (b.w >> 1), b.y + (b.h >> 1)));
        world.audio.sfx('bump');
        return this.destroy();
      }
      if (!overlaps(b, p.body)) continue;
      hurtSimon(world, p, this.spec.damage, b.vx > 0 ? 1 : -1);
      return this.destroy();
    }
  }

  render(r: Renderer, view: View): void {
    const f = this.spec.frames[(this.age >> 2) % this.spec.frames.length] as string;
    const x = toPx(this.body.x) - view.camX;
    drawCrypt(r, view.assets, f, x, toPx(this.body.y), this.spec.w, this.spec.h, this.spec.fallback);
  }
}

/* ---------- The throne room's door ---------- */

/** Frames the door takes to open or shut. */
export const DOOR_FRAMES = 16;
export type DoorState = 'shut' | 'opening' | 'open' | 'closing';

/**
 * The throne room's door, two tiles high in the wall (solid in the map): opening clears the
 * tiles, shutting makes them solid again behind Simon.
 */
export class CastleDoor extends Entity {
  readonly kind = 'castle-door';
  state: DoorState = 'shut';
  private t = 0;
  constructor(
    readonly tx: number,
    readonly ty: number,
    private readonly solid: number,
    private readonly air: number,
  ) {
    super(tileToSub(tx), tileToSub(ty), 16, 32);
    this.despawnMargin = null;
  }

  open(world: World): void {
    if (this.state !== 'shut') return;
    this.state = 'opening';
    this.t = 0;
    world.audio.sfx(CV_SOUNDS.door);
  }

  close(world: World): void {
    if (this.state !== 'open') return;
    this.state = 'closing';
    this.t = 0;
    for (let i = 0; i < 2; i++) world.map.set(this.tx, this.ty + i, this.solid);
    world.audio.sfx(CV_SOUNDS.door);
  }

  update(world: World): void {
    if (this.state === 'opening' && ++this.t >= DOOR_FRAMES) {
      this.state = 'open';
      for (let i = 0; i < 2; i++) world.map.set(this.tx, this.ty + i, this.air);
    } else if (this.state === 'closing' && ++this.t >= DOOR_FRAMES) this.state = 'shut';
  }

  /** How far open (0 shut .. 1 open). */
  get openness(): number {
    if (this.state === 'shut') return 0;
    if (this.state === 'open') return 1;
    const k = this.t / DOOR_FRAMES;
    return this.state === 'opening' ? k : 1 - k;
  }

  render(r: Renderer, view: View): void {
    const x = this.screenX(view);
    const y = this.screenY();
    r.rect(x, y, 16, 32, '#000');
    const w = Math.round(16 * (1 - this.openness));
    if (w > 0) drawCrypt(r, view.assets, 'door', x, y, w, 32, ['#503000', '#ac7c00']);
  }
}
