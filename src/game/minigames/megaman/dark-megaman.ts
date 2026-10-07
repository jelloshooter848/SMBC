import type { Renderer } from '@engine/gfx/renderer';
import { px, tileToSub, toPx, velToSub } from '@engine/math/units';
import { Rng } from '@engine/rng';
import type { View } from '../../entities/entity';
import { Enemy } from '../../entities/enemies/enemy';
import { moveX, moveY } from '../../entities/body';
import { Projectile } from '../../entities/projectiles/projectile';
import type { Player } from '../../entities/player';
import type { DamageSource, Reaction } from '../../rules/damage';
import type { World } from '../../world/world';
import { MAX_HP, MEGAMAN_PROFILE } from '../../characters/megaman';
import { darkSheet } from './art';
import { EnemyShot, OrbBurst, SHOT_DAMAGE, type ShotSpec } from './robots';

/*
 * Dark Mega Man, the brainwashing's copy of Mega Man and the station's boss: Mega Man's body,
 * moves and sprites in a dark palette, 28 hit points. His pattern is seeded (BOSS_SEED) and reads
 * only the fight, so the same inputs always play the same fight.
 */

export const BOSS_HP = MAX_HP;
export const BOSS_SEED = 0x0d4a;
/** Frames he cannot be hurt after a hit (he flickers unless reduce flashing is on). */
export const BOSS_IFRAMES = 20;
/** Hit points each of Mega Man's shots takes (by projectile kind); the Saw Disc is his weakness. */
export const BOSS_DAMAGE: Readonly<Record<string, number>> = {
  buster: 2,
  'buster-charged': 4,
  saw: 3,
};
/** His touch (World.hurtPlayer: Mega Man's fixed 4), buster shots and charge shot. */
export const CONTACT_DAMAGE = 4;
export const CHARGE_DAMAGE = 6;

/** Mega Man's own movement (characters/megaman MEGAMAN_PROFILE). */
const WALK = MEGAMAN_PROFILE.maxWalk;
const JUMP_VY = (MEGAMAN_PROFILE.jump[0] as { initial: number }).initial;
const GRAVITY = (MEGAMAN_PROFILE.jump[0] as { fallGravity: number }).fallGravity;
const MAX_FALL = MEGAMAN_PROFILE.maxFall;
const SLIDE = MEGAMAN_PROFILE.slide as { speed: number; frames: number; hitboxH: number };
/** His buster: Mega Man's speed (4 px a frame). */
const SHOT_SPEED = 0x04000;
/** Frames between the three shots of a volley, and the charge before a charge shot. */
export const VOLLEY_GAP = 12;
export const CHARGE_TIME = 48;
/** Within this (px) of a buster shot coming at him he may jump it; a jump from Mega Man this near, slide. */
const DODGE_RANGE = 64;
/** Frames after a dodge before he dodges again (so a stream of shots gets some in). */
export const DODGE_COOLDOWN = 70;
/** Chances he jumps a buster shot or a charge shot (the Saw Disc, his weakness, he never sees coming). */
export const DODGE_CHANCE = 0.3;
export const DODGE_CHARGED = 0.6;
const SLIDE_RANGE = 96;
/** Farther than this (px) he charges up. */
const FAR = 104;
/** Closer than this (px) he backs off. */
const NEAR = 40;

export const DARK_BUSTER: ShotSpec = {
  kind: 'dark-buster',
  w: 8,
  h: 6,
  damage: SHOT_DAMAGE,
  frame: null,
  colors: ['#6844fc', '#f83800'],
};
export const DARK_CHARGE: ShotSpec = {
  kind: 'dark-charge',
  w: 14,
  h: 12,
  damage: CHARGE_DAMAGE,
  frame: null,
  colors: ['#6844fc', '#f878f8'],
};

export type BossState =
  | 'asleep' // before the fight (beam-in, the bar filling)
  | 'stand'
  | 'run'
  | 'jump'
  | 'volley'
  | 'charge'
  | 'slide'
  | 'dead';

/** One step of his pattern, recorded for tests and the sim (frame, state, x px). */
export interface BossStep {
  state: BossState;
  x: number;
  y: number;
}

export class DarkMegaMan extends Enemy {
  readonly kind = 'dark-megaman';
  state: BossState = 'asleep';
  /** Frames left in the current state. */
  timer = 0;
  iframes = 0;
  /** Shots left in a volley, and frames to the next. */
  private shots = 0;
  private shotT = 0;
  private runDir: -1 | 1 = 1;
  private shootPose = 0;
  private readonly rng = new Rng(BOSS_SEED);
  /** Player shots and jumps already weighed (each is judged once). */
  private readonly seenShots = new Set<number>();
  private playerWasUp = false;
  private dodgeCool = 0;
  /** Every state he took, in order (the pattern; tests compare runs by it). */
  readonly log: BossStep[] = [];
  private age = 0;

  constructor(
    x: number,
    y: number,
    private readonly onDefeated: (boss: DarkMegaMan, world: World) => void,
  ) {
    super(x, y, 12, 22);
    this.hp = BOSS_HP;
    this.body.vx = 0;
    this.vulnerability = { buster: 'hp', weapon: 'hp' };
    this.stompable = false;
    this.contactHurts = false;
    this.despawnMargin = null;
    this.facing = -1;
    this.activated = true;
  }

  /** The fight starts: he moves and hurts from now on. */
  wake(): void {
    if (this.state !== 'asleep') return;
    this.contactHurts = true;
    this.enter('stand', 20);
  }

  get awake(): boolean {
    return this.state !== 'asleep' && this.state !== 'dead';
  }

  override hit(src: DamageSource, world: World): Reaction {
    if (!this.awake || this.iframes > 0) return 'immune';
    const reaction = this.vulnerability[src.kind] ?? 'immune';
    if (reaction !== 'hp') return 'immune';
    const kind = src.owner instanceof Projectile ? src.owner.kind : src.kind;
    this.hp = Math.max(0, this.hp - (BOSS_DAMAGE[kind] ?? src.amount));
    if (this.hp <= 0) {
      this.defeat(world);
      return 'hp';
    }
    this.iframes = BOSS_IFRAMES;
    return 'hp';
  }

  private defeat(world: World): void {
    this.state = 'dead';
    this.contactHurts = false;
    const b = this.body;
    world.spawn(new OrbBurst(b.x + (b.w >> 1), b.y + (b.h >> 1), true));
    world.audio.sfx('explosion');
    // His shots vanish with him.
    for (const e of world.entities) if (e instanceof EnemyShot && e.owner === this) e.destroy();
    this.destroy();
    this.onDefeated(this, world);
  }

  private enter(state: BossState, frames: number): void {
    this.state = state;
    this.timer = frames;
    this.log.push({ state, x: toPx(this.body.x), y: toPx(this.body.y) });
  }

  private hero(world: World): Player {
    return world.nearestPlayer(this.body.x + (this.body.w >> 1));
  }

  /** Signed px from his centre to Mega Man's. */
  private dx(p: Player): number {
    return toPx(p.centerX - (this.body.x + (this.body.w >> 1)));
  }

  private faceHero(p: Player): void {
    this.facing = this.dx(p) < 0 ? -1 : 1;
  }

  update(world: World): void {
    this.age++;
    if (this.iframes > 0) this.iframes--;
    if (this.shootPose > 0) this.shootPose--;
    if (this.dodgeCool > 0 && this.state !== 'jump') this.dodgeCool--;
    const b = this.body;
    if (this.state === 'asleep' || this.state === 'dead') {
      this.physics(world);
      return;
    }
    const p = this.hero(world);
    if (b.onGround && this.state !== 'slide' && this.state !== 'jump') this.react(world, p);
    this.timer--;
    switch (this.state) {
      case 'stand':
        b.vx = 0;
        this.faceHero(p);
        if (this.timer <= 0) this.choose(p);
        break;
      case 'run':
        b.vx = this.runDir * WALK;
        this.facing = this.runDir;
        if (this.timer <= 0 || b.hitWall !== 0) this.rest(p);
        break;
      case 'jump':
        if (b.onGround && this.timer < 40) this.rest(p);
        else if (this.timer === 22 && this.rng.chance(0.5)) {
          this.faceHero(p);
          this.shoot(world, DARK_BUSTER);
        }
        break;
      case 'volley':
        b.vx = 0;
        if (--this.shotT <= 0 && this.shots > 0) {
          this.faceHero(p);
          this.shoot(world, DARK_BUSTER);
          this.shots--;
          this.shotT = VOLLEY_GAP;
        }
        if (this.shots === 0 && this.shotT <= 0) this.rest(p);
        break;
      case 'charge':
        b.vx = 0;
        this.faceHero(p);
        if (this.timer <= 0) {
          this.shoot(world, DARK_CHARGE);
          this.rest(p);
        }
        break;
      case 'slide':
        b.vx = this.facing * SLIDE.speed;
        if (this.timer <= 0 || b.hitWall !== 0) {
          this.unslide(world);
          this.rest(p);
        }
        break;
    }
    this.physics(world);
  }

  /**
   * His reflexes (on the ground, between moves): a shot coming at him may be jumped (each shot is
   * judged once, so a steady stream gets some hits in), and Mega Man jumping close may be slid
   * under.
   */
  private react(world: World, p: Player): void {
    if (this.state === 'charge' || this.state === 'volley') return;
    const b = this.body;
    for (const e of world.entities) {
      if (!(e instanceof Projectile) || !e.alive || e.owner !== p || this.seenShots.has(e.id)) continue;
      if (e.kind !== 'buster' && e.kind !== 'buster-charged') continue;
      const toward = Math.sign(e.body.vx) === Math.sign(b.x - e.body.x);
      const ahead = Math.abs(toPx(e.body.x - b.x));
      const level = e.body.y + e.body.h > b.y && e.body.y < b.y + b.h;
      if (!toward || !level || ahead > DODGE_RANGE) continue;
      this.seenShots.add(e.id);
      if (this.dodgeCool > 0) continue;
      const chance = e.kind === 'buster-charged' ? DODGE_CHARGED : DODGE_CHANCE;
      if (this.rng.chance(chance)) {
        this.dodgeCool = DODGE_COOLDOWN;
        return this.jump(p, this.rng.chance(0.5) ? 0 : this.facing);
      }
    }
    const up = !p.body.onGround && p.body.vy < 0;
    if (up && !this.playerWasUp && Math.abs(this.dx(p)) < SLIDE_RANGE) {
      this.playerWasUp = true;
      if (this.rng.chance(0.5)) return this.slide(p);
    }
    if (p.body.onGround) this.playerWasUp = false;
  }

  /** Picks his next move from where Mega Man is. */
  private choose(p: Player): void {
    const d = Math.abs(this.dx(p));
    this.faceHero(p);
    const roll = this.rng.int(100);
    if (d > FAR) {
      if (roll < 45) return this.enter('charge', CHARGE_TIME);
      if (roll < 75) return this.volley();
      return this.run(this.facing, 40);
    }
    if (d < NEAR) {
      if (roll < 45) return this.run(-this.facing as -1 | 1, 28);
      if (roll < 75) return this.jump(p, this.facing);
      return this.volley();
    }
    if (roll < 40) return this.volley();
    if (roll < 62) return this.run(this.facing, 24 + this.rng.int(24));
    if (roll < 77) return this.run(-this.facing as -1 | 1, 24);
    if (roll < 90) return this.jump(p, this.rng.chance(0.5) ? this.facing : 0);
    return this.enter('charge', CHARGE_TIME);
  }

  /** A short stand between moves: his tell. */
  private rest(p: Player): void {
    this.body.vx = 0;
    this.faceHero(p);
    this.enter('stand', 20 + this.rng.int(16));
  }

  private run(dir: -1 | 1, frames: number): void {
    this.runDir = dir;
    this.enter('run', frames);
  }

  private volley(): void {
    this.shots = 3;
    this.shotT = 6;
    this.enter('volley', 60);
  }

  private jump(p: Player, dir: -1 | 0 | 1): void {
    const b = this.body;
    if (dir !== 0) this.facing = dir;
    else this.faceHero(p);
    b.vx = dir * WALK;
    b.vy = -JUMP_VY;
    b.onGround = false;
    this.enter('jump', 60);
  }

  private slide(p: Player): void {
    this.faceHero(p);
    const b = this.body;
    const bottom = b.y + b.h;
    b.h = px(SLIDE.hitboxH);
    b.y = bottom - b.h;
    this.enter('slide', SLIDE.frames);
  }

  private unslide(world: World): void {
    const b = this.body;
    const bottom = b.y + b.h;
    b.h = px(22);
    b.y = bottom - b.h;
    // Never stand up into a ceiling.
    if (world.map.isSolid(b.x >> 12, b.y >> 12)) b.y = tileToSub((b.y >> 12) + 1);
  }

  private shoot(world: World, spec: ShotSpec): void {
    const b = this.body;
    const x = this.facing > 0 ? b.x + b.w : b.x - px(spec.w);
    const y = spec === DARK_CHARGE ? b.y + px(5) : b.y + px(8);
    world.spawn(new EnemyShot(x, y, this.facing * SHOT_SPEED, 0, spec, this));
    world.audio.sfx('buster');
    this.shootPose = 16;
  }

  private physics(world: World): void {
    const b = this.body;
    moveX(b, world.map, velToSub(b.vx));
    b.vy = Math.min(b.vy + GRAVITY, MAX_FALL);
    moveY(b, world.map, b.onGround ? Math.max(velToSub(b.vy), 1) : velToSub(b.vy));
    if (b.onGround) {
      b.vy = 0;
      if (this.state === 'jump') b.vx = 0;
    }
  }

  /** The Mega Man frame for his state (the same sheet as Mega Man's). */
  frame(): string {
    const shooting = this.shootPose > 0;
    switch (this.state) {
      case 'slide':
        return 'slide';
      case 'jump':
        return shooting ? 'jump-shoot' : 'jump';
      case 'run':
        return `${shooting ? 'walk-shoot' : 'walk'}-${(this.age >> 3) % 3}`;
      case 'charge':
        return 'charge-0';
      default:
        if (!this.body.onGround) return 'jump';
        return shooting || this.state === 'volley' ? 'shoot' : 'idle';
    }
  }

  override render(r: Renderer, view: View): void {
    if (this.iframes > 0 && !view.reduceFlashing && (view.frame & 2) === 0) return;
    const sheet = darkSheet(view.assets);
    const b = this.body;
    const sliding = this.state === 'slide';
    const x = toPx(b.x) - view.camX - 2;
    const y = toPx(b.y) - (sliding ? 20 : 10);
    if (sheet) {
      // A charge glows: Mega Man's charge palettes over the dark armour every few frames.
      r.sprite(sheet, this.frame(), x, y, this.facing < 0);
      if (this.state === 'charge' && !view.reduceFlashing && (view.frame & 4) === 0)
        r.rect(toPx(b.x) - view.camX + (this.facing > 0 ? 12 : -4), toPx(b.y) + 8, 4, 4, '#f878f8');
      return;
    }
    // No sheet at all (headless or a stub): a dark box with red eyes.
    r.rect(toPx(b.x) - view.camX, toPx(b.y), toPx(b.w), toPx(b.h), '#24188c');
    r.rect(toPx(b.x) - view.camX + (this.facing > 0 ? 7 : 2), toPx(b.y) + 4, 3, 2, '#f83800');
  }
}
