import type { Renderer } from '@engine/gfx/renderer';
import { overlaps, type AABB } from '@engine/math/aabb';
import { px, tileAt, tileToSub, toPx, velToSub } from '@engine/math/units';
import { Entity, type View } from '../../entities/entity';
import { Enemy } from '../../entities/enemies/enemy';
import { Pickup } from '../../entities/objects/pickup';
import type { Player } from '../../entities/player';
import type { DamageSource, Reaction, Vulnerability } from '../../rules/damage';
import { ENEMY_SCORES } from '../../rules/score';
import type { World } from '../../world/world';
import { drawNinja, NG_SOUNDS, type Fallback } from './art';

/*
 * Shadow Duel's creatures and props (docs/HEROES.md, Ryu's mini game): paper lanterns, the ninpo
 * art they can hold, knife throwers and their knives, attack dogs and hawks. They are the mini
 * game's own entity types (World's `extraEntities`, stage.ts). Ryu is the only player.
 */

/**
 * Hurts Ryu by `amount` hit points through World.hurtPlayer (which takes his usual 2: a smaller
 * hit gives the difference back first, a bigger one takes the rest first, leaving at least 1 so
 * the usual hit decides life or death). Nothing while he blinks or under the No damage assist.
 * Returns whether it hurt.
 */
export function hurtRyu(world: World, p: Player, amount: number, fromDir: -1 | 1): boolean {
  if (p.dead || p.out || p.invulnerable || world.assist.invulnerable) return false;
  if (amount < 2) p.hp += 2 - amount;
  if (amount > 2) p.hp = Math.max(1, p.hp - (amount - 2));
  world.hurtPlayer(p, fromDir);
  return true;
}

/** Hit points a stage creature (knife, dog, hawk, a thrower's touch) takes from Ryu. */
export const CREATURE_DAMAGE = 2;

/** What the stage's creatures take hits from: the sword, the ninpo arts (and a star). */
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

/** Does Ryu's blade (his slash, or his jump-and-slash spin) reach `box`, give or take `slack` px? */
export function bladeReaches(p: Player, box: AABB, slack = 0): boolean {
  const l = p.activeMelee;
  if (!l) return false;
  const m = px(slack);
  return l.x < box.x + box.w + m && box.x - m < l.x + l.w && l.y < box.y + box.h + m && box.y - m < l.y + l.h;
}

/** Is there a pit (a column with no floor) within `range` px of x (subpixels)? */
export function pitNear(pits: readonly number[], x: number, range: number): boolean {
  const lo = tileAt(x - px(range));
  const hi = tileAt(x + px(range));
  for (const c of pits) if (c >= lo && c <= hi) return true;
  return false;
}

/** A small burst where a creature or lantern was struck down. */
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
    const s = this.age < 8 ? 12 : 8;
    const x = this.screenX(view) + ((16 - s) >> 1);
    const y = this.screenY() + ((16 - s) >> 1);
    drawNinja(r, view.assets, `burst-${this.age >> 3}`, x, y, s, s, ['#f83800', '#fca044']);
  }
}

/**
 * A stage creature: hit points, the sword and the ninpo arts hurt it, it can't be stomped, and it
 * goes up in a small burst (Ryu's own drop table: now and then ninpo or health).
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
    // Touching one costs CREATURE_DAMAGE (each checks itself), not World's usual contact hit.
    this.contactHurts = false;
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

  /** Touching Ryu hurts him (unless his blade is on it). Returns whether it struck. */
  protected touch(world: World): boolean {
    const p = world.player;
    const b = this.body;
    if (p.dead || p.out || !overlaps(b, p.body) || bladeReaches(p, b)) return false;
    return hurtRyu(world, p, CREATURE_DAMAGE, b.x + (b.w >> 1) < p.centerX ? 1 : -1);
  }

  /** The sprite box (px) relative to the body, and its fallback colours. */
  protected abstract readonly look: { w: number; h: number; fallback: Fallback };

  override render(r: Renderer, view: View): void {
    drawNinja(
      r,
      view.assets,
      this.currentFrame,
      this.screenX(view),
      this.screenY(),
      this.look.w,
      this.look.h,
      this.look.fallback,
      this.facing > 0,
      this.flash > 0 && !view.reduceFlashing ? 'flash' : 'plain',
    );
  }
}

/* ---------- Lanterns and the ninpo art ---------- */

/**
 * `ninpo` (+5 spirit points), `big` (+10), `life` (+4 hit points), `heal` (two of those: +8),
 * `art` (the next ninpo art).
 */
export type LanternDrop = 'ninpo' | 'big' | 'life' | 'heal' | 'art';

/**
 * A hanging paper lantern (16×16 in its tile; a 12×14 body): harmless, the sword or a ninpo art
 * breaks it and it leaves its drop: spirit points, health, or the next ninpo art.
 */
export class Lantern extends Enemy {
  readonly kind = 'lantern';
  constructor(
    tx: number,
    ty: number,
    readonly drop: LanternDrop,
    private readonly onArt: (p: Player) => void,
  ) {
    super(tileToSub(tx) + px(2), tileToSub(ty) + px(2), 12, 14);
    this.body.vx = 0;
    this.contactHurts = false;
    this.stompable = false;
    this.vulnerability = { sword: 'kill', weapon: 'kill', fireball: 'kill', bomb: 'kill', buster: 'kill' };
    this.scores = { stomp: 0, attack: 100, star: 0, below: 0 };
    this.currentFrame = 'lantern-0';
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.despawnMargin = 32;
  }

  update(world: World): void {
    this.currentFrame = world.ctx.reduceFlashing ? 'lantern-0' : `lantern-${(world.frame >> 4) & 1}`;
  }

  protected override flipOut(_src: DamageSource, world: World): void {
    const b = this.body;
    world.spawn(new Burst(b.x + (b.w >> 1), b.y + (b.h >> 1)));
    world.audio.sfx(NG_SOUNDS.lantern);
    this.destroy();
  }

  protected override onKilled(_src: DamageSource, world: World): void {
    const b = this.body;
    const cx = b.x + (b.w >> 1);
    if (this.drop === 'art') world.spawn(new ArtScroll(cx, b.y + b.h, this.onArt));
    else if (this.drop === 'heal') {
      world.spawn(new Pickup(cx - px(5), b.y + b.h, 'health-small'));
      world.spawn(new Pickup(cx + px(5), b.y + b.h, 'health-small'));
    } else
      world.spawn(
        new Pickup(
          cx,
          b.y + b.h,
          this.drop === 'big' ? 'ninpo-large' : this.drop === 'life' ? 'health-small' : 'ninpo-small',
        ),
      );
  }

  override render(r: Renderer, view: View): void {
    drawNinja(r, view.assets, this.currentFrame, this.screenX(view), this.screenY(), 16, 16, [
      '#d82800',
      '#fca044',
    ]);
  }
}

/** The ninpo art a lantern holds (a scroll): falls to the floor; touching it takes it. */
export class ArtScroll extends Entity {
  readonly kind = 'art-scroll';
  constructor(
    cx: number,
    bottom: number,
    private readonly onTake: (p: Player) => void,
  ) {
    super(cx - px(4), bottom - px(8), 8, 8);
    this.despawnMargin = null;
    this.body.vy = -0x02000;
  }

  update(world: World): void {
    this.fall(world);
    const p = world.player;
    if (p.dead || p.out || !overlaps(this.body, p.body)) return;
    this.destroy();
    this.onTake(p);
  }

  render(r: Renderer, view: View): void {
    const items = view.assets.sheet('items');
    if (items.frames.has('icon-windmill'))
      r.sprite(items, 'icon-windmill', this.screenX(view), this.screenY());
    else r.rect(this.screenX(view), this.screenY(), 8, 8, '#3cbcfc');
  }
}

/* ---------- Shots ---------- */

export interface NgShotSpec {
  kind: string;
  w: number;
  h: number;
  /** Hit points it takes from Ryu. */
  damage: number;
  /** Frames (the ninja sheet's, cycled every 4 frames) and the fallback box. */
  frames: readonly string[];
  fallback: Fallback;
}

/** px of slack by which Ryu's blade knocks a shot away (a little forgiving). */
export const SHOT_SLACK = 8;

/** A thrower's knife: flat, at a standing Ryu's chest (a crouch ducks under it). */
export const KNIFE: NgShotSpec = {
  kind: 'knife',
  w: 8,
  h: 4,
  damage: CREATURE_DAMAGE,
  frames: ['knife'],
  fallback: ['#bcbcbc', '#fcfcfc'],
};

/**
 * A creature's or the Masked Ninja's shot: flies straight, stopped by walls, hurts Ryu by its
 * damage, and his blade (with a few px of slack) knocks it out of the air with a clang.
 */
export class NgShot extends Entity {
  readonly kind: string;
  age = 0;
  constructor(
    x: number,
    y: number,
    vx: number,
    vy: number,
    readonly spec: NgShotSpec,
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
    b.x += velToSub(b.vx);
    b.y += velToSub(b.vy);
    const solid = world.map.isSolid(tileAt(b.x + (b.w >> 1)), tileAt(b.y + (b.h >> 1)));
    const off = b.x + b.w < world.camera.x - px(8) || b.x > world.camera.right + px(8);
    if (off || b.y > px(world.heightPx) || b.y + b.h < px(-16) || (solid && this.age > 2))
      return this.destroy();
    const p = world.player;
    if (p.dead || p.out) return;
    if (bladeReaches(p, b, SHOT_SLACK)) {
      world.spawn(new Burst(b.x + (b.w >> 1), b.y + (b.h >> 1)));
      world.audio.sfx(NG_SOUNDS.clang);
      return this.destroy();
    }
    if (!overlaps(b, p.body)) return;
    hurtRyu(world, p, this.spec.damage, b.vx > 0 ? 1 : -1);
    this.destroy();
  }

  render(r: Renderer, view: View): void {
    const f = this.spec.frames[(this.age >> 2) % this.spec.frames.length] as string;
    const x = toPx(this.body.x) - view.camX;
    drawNinja(
      r,
      view.assets,
      f,
      x,
      toPx(this.body.y),
      this.spec.w,
      this.spec.h,
      this.spec.fallback,
      this.facing > 0,
    );
  }
}

/* ---------- Knife thrower ---------- */

/** Frames between knives, the wind-up before one flies, the reach (px) and the knife's speed. */
export const THROWER_EVERY = 120;
export const THROWER_WIND = 20;
export const THROWER_RANGE = 168;
export const KNIFE_SPEED = 0x02400;
export const THROWER_HP = 2;
/** The knife flies this many px above his feet (a standing Ryu's chest; over a crouch). */
export const KNIFE_HEIGHT = 22;
const THROWER_PACE = 16;
const THROWER_WALK = 0x00600;

/**
 * A knife thrower: paces by his post facing Ryu, and every THROWER_EVERY frames (Ryu in range,
 * both on screen) winds up for THROWER_WIND frames (the telegraph) and throws a knife flat at
 * chest height: crouch under it, jump it, or slash it away. Two hits.
 */
export class KnifeThrower extends Creature {
  readonly kind = 'thrower';
  protected readonly look = { w: 16, h: 32, fallback: ['#503000', '#ac7c00'] as Fallback };
  private readonly post: number;
  t = THROWER_EVERY - 50;
  wind = 0;
  private dir: -1 | 1 = -1;
  constructor(x: number, y: number) {
    super(x, y, 14, 28, THROWER_HP);
    this.spriteOffsetX = 1;
    this.spriteOffsetY = 4;
    this.post = x;
    this.currentFrame = 'knife-thrower-0';
  }

  update(world: World): void {
    this.tick();
    const b = this.body;
    if (!this.activated) {
      if (!onScreen(world, this, -8)) return this.fall(world);
      this.activated = true;
    }
    const p = world.player;
    const dx = p.centerX - (b.x + (b.w >> 1));
    this.facing = dx < 0 ? -1 : 1;
    if (this.wind > 0) {
      b.vx = 0;
      if (--this.wind === 0) this.throwKnife(world);
    } else {
      if (b.x <= this.post - px(THROWER_PACE)) this.dir = 1;
      else if (b.x >= this.post + px(THROWER_PACE)) this.dir = -1;
      b.vx = this.dir * THROWER_WALK;
      this.walkSpeed = THROWER_WALK;
      const before = b.x;
      this.patrol(world);
      if (b.x === before) this.dir = -this.dir as -1 | 1;
      this.facing = dx < 0 ? -1 : 1;
      const seen = Math.abs(dx) <= px(THROWER_RANGE) && onScreen(world, this, -4) && !p.dead;
      if (++this.t >= THROWER_EVERY && seen) {
        this.t = 0;
        this.wind = THROWER_WIND;
      }
    }
    this.fall(world);
    this.currentFrame =
      this.wind > 0 ? 'knife-thrower-2' : `knife-thrower-${b.vx !== 0 ? (world.frame >> 4) & 1 : 0}`;
    this.touch(world);
    if (this.isBelowLevel()) this.destroy();
  }

  private throwKnife(world: World): void {
    const b = this.body;
    const x = this.facing > 0 ? b.x + b.w : b.x - px(KNIFE.w);
    const y = b.y + b.h - px(KNIFE_HEIGHT);
    world.spawn(new NgShot(x, y, this.facing * KNIFE_SPEED, 0, KNIFE));
    world.audio.sfx(NG_SOUNDS.knife);
  }
}

/* ---------- Attack dog ---------- */

/** px within which a waiting dog notices Ryu, the bark (telegraph, frames) and its run speed. */
export const DOG_WAKE = 136;
export const DOG_BARK = 18;
export const DOG_SPEED = 0x02000;

export type DogState = 'wait' | 'bark' | 'run';

/**
 * An attack dog (a low 14×10 body: a standing slash goes over it, a crouching one meets it):
 * waits until Ryu comes within DOG_WAKE px, barks (DOG_BARK frames), then runs straight at
 * where he was and on off the screen. One hit; jump it or crouch and slash.
 */
export class Dog extends Creature {
  readonly kind = 'dog';
  protected readonly look = { w: 16, h: 16, fallback: ['#7c0800', '#c84c0c'] as Fallback };
  state: DogState = 'wait';
  t = 0;
  constructor(x: number, y: number) {
    super(x, y, 14, 10, 1);
    this.spriteOffsetX = 1;
    this.spriteOffsetY = 6;
    this.currentFrame = 'dog-0';
    this.fallsOffLedges = true;
  }

  update(world: World): void {
    this.tick();
    const b = this.body;
    const p = world.player;
    this.t++;
    if (this.state === 'wait') {
      this.fall(world);
      if (!onScreen(world, this, -8) || p.dead) return;
      const dx = p.centerX - (b.x + (b.w >> 1));
      // (only for Ryu on its own level: not one up on a roof or a wall)
      if (Math.abs(dx) > px(DOG_WAKE) || Math.abs(p.body.y + p.body.h - (b.y + b.h)) > px(24)) return;
      this.state = 'bark';
      this.t = 0;
      this.facing = dx < 0 ? -1 : 1;
      world.audio.sfx(NG_SOUNDS.bark);
    }
    if (this.state === 'bark') {
      this.fall(world);
      if (this.t >= DOG_BARK) {
        this.state = 'run';
        this.t = 0;
      }
    } else {
      b.vx = this.facing * DOG_SPEED;
      this.walkSpeed = DOG_SPEED;
      this.patrol(world);
      this.fall(world);
      if (b.hitWall !== 0 || this.isBelowLevel() || !onScreen(world, this, 32)) return this.destroy();
    }
    this.currentFrame = this.state === 'run' ? `dog-${(this.t >> 2) & 1}` : 'dog-0';
    this.touch(world);
  }
}

/* ---------- Hawk ---------- */

/** px across within which a circling hawk turns on Ryu. */
export const HAWK_WAKE = 112;
/** The cry before it swoops (its telegraph) and the rest between attacks (frames). */
export const HAWK_CRY = 20;
export const HAWK_REST = 90;
/** Its speed across (velocity units: 2 px a frame) and the swoop down to Ryu's chest (frames). */
export const HAWK_SPEED = 0x02000;
export const HAWK_SWOOP = 28;
/** How far past Ryu (px) its level glide carries it before it climbs away. */
export const HAWK_GLIDE_PAST = 56;
/**
 * Fair play over pits: a hawk never turns on Ryu within HAWK_PIT_WAKE px of a pit, and pulls out
 * of a cry, a swoop or a glide once he is within HAWK_PIT_CLEAR px of one, so its knock can never
 * carry him into a pit (a knock carries him about 21 px).
 */
export const HAWK_PIT_WAKE = 80;
export const HAWK_PIT_CLEAR = 48;
const HAWK_CIRCLE_R = 20;
const HAWK_CIRCLE_PERIOD = 96;

export type HawkState = 'circle' | 'cry' | 'swoop' | 'glide' | 'rise';

/**
 * A hawk: circles high until Ryu comes within HAWK_WAKE px, cries and hovers (HAWK_CRY frames,
 * the telegraph), then swoops down to his chest height as it comes (HAWK_SWOOP frames) and glides
 * on level through where he stood (a standing slash meets it), climbs away and circles where it
 * is, to come again after HAWK_REST frames. It crumbles when it strikes (one hit, never a chain),
 * and never near a pit (HAWK_PIT_WAKE, HAWK_PIT_CLEAR). One hit kills it.
 */
export class Hawk extends Creature {
  readonly kind = 'hawk';
  protected readonly look = { w: 16, h: 16, fallback: ['#503000', '#fca044'] as Fallback };
  state: HawkState = 'circle';
  t = 0;
  rest = 0;
  private homeX: number;
  private readonly homeY: number;
  private fromY = 0;
  /** The line it glides along (Ryu's chest when it swooped) and where it turns away (subpixels). */
  lineY = 0;
  private passX = 0;
  constructor(
    x: number,
    y: number,
    private readonly pits: readonly number[],
  ) {
    super(x, y, 12, 10, 1);
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 3;
    this.homeX = x;
    this.homeY = y;
    this.currentFrame = 'hawk-0';
    this.despawnMargin = 96;
  }

  /** Swooping or gliding: the part of its flight that can strike. */
  get attacking(): boolean {
    return this.state === 'swoop' || this.state === 'glide';
  }

  update(world: World): void {
    this.tick();
    this.t++;
    const b = this.body;
    const p = world.player;
    const cx = b.x + (b.w >> 1);
    const nearPit = pitNear(this.pits, p.centerX, HAWK_PIT_CLEAR);
    switch (this.state) {
      case 'circle': {
        const a = (this.t * 2 * Math.PI) / HAWK_CIRCLE_PERIOD;
        b.x = this.homeX + Math.round(Math.cos(a) * px(HAWK_CIRCLE_R));
        b.y = this.homeY + Math.round(Math.sin(a) * px(HAWK_CIRCLE_R >> 2));
        this.facing = Math.sin(a) < 0 ? 1 : -1;
        if (this.rest > 0) this.rest--;
        if (
          this.rest === 0 &&
          !p.dead &&
          onScreen(world, this, -8) &&
          Math.abs(p.centerX - cx) <= px(HAWK_WAKE) &&
          !pitNear(this.pits, p.centerX, HAWK_PIT_WAKE)
        ) {
          this.state = 'cry';
          this.t = 0;
          this.facing = p.centerX < cx ? -1 : 1;
          world.audio.sfx(NG_SOUNDS.hawk);
        }
        break;
      }
      case 'cry':
        this.facing = p.centerX < cx ? -1 : 1;
        if (nearPit) this.pullUp();
        else if (this.t >= HAWK_CRY) {
          this.state = 'swoop';
          this.t = 0;
          this.fromY = b.y;
          this.lineY = p.body.y + px(4);
        }
        break;
      case 'swoop': {
        b.x += velToSub(this.facing * HAWK_SPEED);
        const k = Math.min(1, this.t / HAWK_SWOOP);
        b.y = Math.round(this.fromY + (this.lineY - this.fromY) * Math.sin((k * Math.PI) / 2));
        if (nearPit) this.pullUp();
        else if (this.t >= HAWK_SWOOP) {
          this.state = 'glide';
          this.t = 0;
          this.passX = p.centerX + this.facing * px(HAWK_GLIDE_PAST);
        }
        break;
      }
      case 'glide':
        b.x += velToSub(this.facing * HAWK_SPEED);
        if (nearPit || (this.facing > 0 ? cx >= this.passX : cx <= this.passX)) this.pullUp();
        break;
      case 'rise':
        b.x += velToSub(this.facing * 0x01000);
        b.y -= px(1);
        if (b.y <= this.homeY) {
          b.y = this.homeY;
          this.homeX = b.x - px(HAWK_CIRCLE_R);
          this.state = 'circle';
          this.t = 0;
          this.rest = HAWK_REST;
        }
        break;
    }
    this.currentFrame = this.attacking ? 'hawk-1' : `hawk-${(this.t >> 3) & 1}`;
    if (this.attacking && this.strike(world)) return;
    // Gone once it has been seen and left the screen far behind.
    if (onScreen(world, this, -8)) this.activated = true;
    else if (this.activated && !onScreen(world, this, 96)) this.destroy();
  }

  private pullUp(): void {
    this.state = 'rise';
    this.t = 0;
  }

  /** Strikes Ryu once and crumbles (Castlevania's bats do the same). */
  private strike(world: World): boolean {
    const p = world.player;
    const b = this.body;
    if (p.dead || p.out || p.invulnerable || world.assist.invulnerable) return false;
    if (!overlaps(b, p.body) || bladeReaches(p, b)) return false;
    hurtRyu(world, p, CREATURE_DAMAGE, b.x + (b.w >> 1) < p.centerX ? 1 : -1);
    world.spawn(new Burst(b.x + (b.w >> 1), b.y + (b.h >> 1)));
    this.destroy();
    return true;
  }
}
