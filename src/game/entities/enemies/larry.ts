import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx, velToSub } from '@engine/math/units';
import { moveX } from '../body';
import type { View } from '../entity';
import { Enemy } from './enemy';
import type { World } from '../../world/world';
import type { DamageSource, Reaction } from '../../rules/damage';
import type { KillScores } from '../../rules/score';
import { Projectile, type ProjectileSpec } from '../projectiles/projectile';
import { ScorePopup } from '../effects/effects';
import { FreedPuff } from '../objects/captive';
import { CrystalBall } from '../objects/crystal-ball';
import { SMB3_SHEET, sheetWith } from '../../art';

/*
 * Larry Koopa, the Koopaling of 4-2's airship cabin (SMB3 style, owner decision for 0.5.0; his
 * stolen magic wand brainwashed the heroes). docs/HEROES.md "Larry Koopa and the crystal ball".
 *
 * He waits a moment, then hops at the hero (short hops, now and then a high jump) and after every
 * two moves stops, raises his wand and fires a ring (a wand blast) that flies in a straight line at
 * where the hero was. A stomp sends him into his shell: he spins on the spot, slides at the hero
 * bouncing off the walls, and comes out; in the shell nothing hurts him (a stomp just bounces the
 * hero off) and the shell hurts to touch. Three stomps win. Fireballs and the other heroes'
 * attacks count too: each hit is half a stomp (a heavy hit, amount 3 or more, a whole one), with a
 * short flash between hits. Beaten, he cries "BWAH!", vanishes in a puff and flies off, and the
 * crystal ball drops where he stood (objects/crystal-ball.ts).
 */

/** Hit points in half-stomps: three stomps (or six fireballs). */
export const LARRY_HP = 6;
/** What a stomp takes; every other hit takes 1 (2 for a heavy one, amount >= 3). */
export const STOMP_DAMAGE = 2;
/** Frames he flashes, untouchable by attacks, after a non-stomp hit. */
export const LARRY_FLASH_FRAMES = 40;

/** Gravity 0.25 px/f² (ENTITY_GRAVITY). Hop: 2.5 px/f up (12 px high), 0.75 px/f across. */
const HOP_VY = 0x02800;
const HOP_VX = 0x00c00;
/** High jump: 5.5 px/f up (about 60 px, almost four tiles), 1 px/f across. */
const JUMP_VY = 0x05800;
const JUMP_VX = 0x01000;
/** Standing between moves: 20-44 frames (the first wait is a full second). */
const WAIT_MIN = 20;
const WAIT_SPREAD = 25;
const FIRST_WAIT = 60;
/** Wand raised: the ring leaves at AIM_FIRE, he lowers it at AIM_FRAMES. */
const AIM_FIRE = 24;
const AIM_FRAMES = 36;
/** Shell: spin on the spot, slide at 2 px/f, then stand up again. */
const SPIN_FRAMES = 24;
const SLIDE_FRAMES = 80;
const SLIDE_VX = 0x02000;
const OUT_FRAMES = 20;
/** Beaten: the hurt pose, then the puff and the flight up and away at 3 px/f. */
const BEATEN_FRAMES = 30;
const FLY_VY = 0x03000;
/** At most this many of his rings fly at once. */
const MAX_BLASTS = 2;
/** Closer than this (px, centres) he jumps over the hero rather than shooting. */
const CLOSE_PX = 24;
const BEATEN_POINTS = 5000;
/** A stomp scores at least 1000 (the stomp sequence may give more). */
const LARRY_SCORES: KillScores = { stomp: 1000, attack: 1000, star: 1000, below: 1000 };

/** The wand's ring: flies straight at a point, through walls, hurting only the hero. */
export const WAND_BLAST: ProjectileSpec = {
  kind: 'wand-blast',
  damage: 'contact',
  amount: 1,
  speed: 0x01800, // 1.5 px/f along its line
  gravity: 0,
  bounceVy: null,
  hitsTiles: false,
  hitsEnemies: false,
  hitsPlayer: true,
  lifetime: 360,
  w: 10,
  h: 10,
  sheet: SMB3_SHEET,
  frames: ['wand-blast-0', 'wand-blast-1'],
  frameRate: 6,
};

/** A ring from Larry's wand, aimed at (tx, ty) (subpixels, a centre) when fired. */
export class WandBlast extends Projectile {
  constructor(cx: number, cy: number, tx: number, ty: number, owner: Larry) {
    const dx = tx - cx;
    const dy = ty - cy;
    const len = Math.max(1, Math.hypot(dx, dy));
    const vx = Math.round((dx / len) * WAND_BLAST.speed);
    const vy = Math.round((dy / len) * WAND_BLAST.speed);
    super(cx - px(WAND_BLAST.w >> 1), cy - px(WAND_BLAST.h >> 1), vx < 0 ? -1 : 1, WAND_BLAST, owner, {
      vx,
      vy,
    });
  }

  override update(world: World): void {
    super.update(world);
    if (this.body.y + this.body.h < -px(16)) this.destroy();
  }

  override render(r: Renderer, view: View): void {
    const frame = WAND_BLAST.frames[Math.floor(this.age / WAND_BLAST.frameRate) & 1] as string;
    const x = toPx(this.body.x) - view.camX;
    const y = toPx(this.body.y);
    const sheet = sheetWith(view.assets, SMB3_SHEET, frame);
    if (sheet) {
      r.sprite(sheet, frame, x - 3, y - 3);
      return;
    }
    // Until the SMB3 art lands: a two-tone ring, its colours trading places (not with reduce flashing).
    const swap = !view.reduceFlashing && (Math.floor(this.age / WAND_BLAST.frameRate) & 1) === 1;
    const a = swap ? '#3cbcfc' : '#fcfcfc';
    const b = swap ? '#fcfcfc' : '#3cbcfc';
    r.rect(x + 3, y, 4, 1, a);
    r.rect(x + 3, y + 9, 4, 1, a);
    r.rect(x, y + 3, 1, 4, a);
    r.rect(x + 9, y + 3, 1, 4, a);
    r.rect(x + 1, y + 1, 2, 2, b);
    r.rect(x + 7, y + 1, 2, 2, b);
    r.rect(x + 1, y + 7, 2, 2, b);
    r.rect(x + 7, y + 7, 2, 2, b);
  }
}

export type LarryState = 'wait' | 'hop' | 'jump' | 'aim' | 'spin' | 'slide' | 'out' | 'beaten' | 'fly';

const STAND_H = 22;
const SHELL_H = 14;

export class Larry extends Enemy {
  readonly kind = 'larry';
  state: LarryState = 'wait';
  /** Frames in the current state. */
  private t = 0;
  private waitFor = FIRST_WAIT;
  /** Moves since his last shot. */
  private moves = 0;
  /** Sideways speed of the hop or jump under way. */
  private airVx = 0;
  /** Flashing after a hit: attacks do nothing (a stomp still counts). */
  invuln = 0;
  /** Where the crystal ball leads outside the campaign (the map's `next=`). */
  private readonly next: string | null;

  constructor(tx: number, ty: number, next: string | null = null) {
    // `tx ty`: the tile his feet stand in.
    super(px(tx * 16 + 1), px((ty + 1) * 16 - STAND_H), 14, STAND_H);
    this.hp = LARRY_HP;
    this.scores = LARRY_SCORES;
    this.spriteOffsetX = 1;
    this.spriteOffsetY = 2;
    this.despawnMargin = null;
    this.body.vx = 0;
    this.next = next;
    this.currentFrame = 'larry-0';
  }

  get inShell(): boolean {
    return this.state === 'spin' || this.state === 'slide';
  }

  get defeated(): boolean {
    return this.state === 'beaten' || this.state === 'fly';
  }

  /**
   * Stomps take STOMP_DAMAGE and send him into his shell; in the shell a stomp only bounces the
   * hero off ('bounce') and everything else is 'immune'. Fire, swords, shots, weapons and bombs
   * take 1 (2 when heavy), then he flashes for LARRY_FLASH_FRAMES. Boomerangs, ice, bumps and the
   * like do nothing.
   */
  override hit(src: DamageSource, world: World): Reaction {
    if (this.defeated) return 'immune';
    if (this.inShell) return src.kind === 'stomp' ? 'bounce' : 'immune';
    if (src.kind === 'stomp') {
      world.audio.sfx('stomp');
      this.damage(STOMP_DAMAGE, world, true);
      return 'hp';
    }
    const n = larryDamage(src);
    if (n === 0 || this.invuln > 0) return 'immune';
    this.damage(n, world, false);
    return 'hp';
  }

  private damage(n: number, world: World, stomp: boolean): void {
    this.hp = Math.max(0, this.hp - n);
    if (this.hp === 0) return this.beaten(world);
    if (stomp) this.enter('spin');
    else this.invuln = LARRY_FLASH_FRAMES;
  }

  /** Down: the hurt pose, his rings gone, "BWAH!", then the puff and the flight (update). */
  private beaten(world: World): void {
    this.enter('beaten');
    this.invuln = 0;
    this.contactHurts = false;
    this.stompable = false;
    this.body.vx = 0;
    this.setHeight(STAND_H);
    for (const e of world.entities) if (e instanceof WandBlast && e.owner === this) e.destroy();
    world.audio.stopMusic();
    world.audio.sfx('bowser-fall');
    world.addScore(BEATEN_POINTS);
    world.spawn(new ScorePopup(this.body.x - px(4), this.body.y - px(10), 'BWAH!'));
  }

  private enter(s: LarryState): void {
    this.state = s;
    this.t = 0;
    const b = this.body;
    switch (s) {
      case 'spin':
        this.setHeight(SHELL_H);
        b.vx = 0;
        break;
      case 'out':
        b.vx = 0;
        this.setHeight(STAND_H);
        break;
      case 'wait':
        b.vx = 0;
        break;
    }
  }

  /** Change the body's height keeping the feet where they are. */
  private setHeight(h: number): void {
    const b = this.body;
    const feet = b.y + b.h;
    b.h = px(h);
    b.y = feet - b.h;
  }

  update(world: World): void {
    const b = this.body;
    this.t++;
    if (this.invuln > 0) this.invuln--;
    if (this.state === 'fly') {
      b.y -= velToSub(FLY_VY);
      if (b.y + b.h < -px(32)) this.destroy();
      return;
    }
    const p = world.nearestPlayer(b.x + (b.w >> 1));
    const dx = p.centerX - (b.x + (b.w >> 1));
    switch (this.state) {
      case 'beaten':
        if (this.t >= BEATEN_FRAMES) {
          const cx = b.x + (b.w >> 1);
          world.spawn(new FreedPuff(cx, b.y + (b.h >> 1)));
          world.spawn(new CrystalBall(cx, b.y + b.h, this.next));
          this.state = 'fly';
          this.t = 0;
          return;
        }
        break;
      case 'wait':
        if (b.onGround) this.face(dx);
        if (this.t >= this.waitFor && b.onGround) this.nextMove(world, dx);
        break;
      case 'aim':
        this.face(dx);
        if (this.t === AIM_FIRE) this.fire(world);
        if (this.t >= AIM_FRAMES) this.rest(world);
        break;
      case 'hop':
      case 'jump':
        if (b.onGround && this.t > 2) this.rest(world);
        break;
      case 'spin':
        if (this.t >= SPIN_FRAMES) {
          this.state = 'slide';
          this.t = 0;
          b.vx = (dx < 0 ? -1 : 1) * SLIDE_VX;
        }
        break;
      case 'slide':
        if (this.t >= SLIDE_FRAMES) this.enter('out');
        break;
      case 'out':
        if (this.t >= OUT_FRAMES) {
          this.enter('wait');
          this.waitFor = WAIT_MIN;
        }
        break;
    }
    // A hop or jump keeps pushing against a wall (up and over a pipe, say): moveX stops it.
    if (this.state === 'hop' || this.state === 'jump') b.vx = this.airVx;
    moveX(b, world.map, velToSub(b.vx));
    // The sliding shell bounces off walls.
    if (b.hitWall !== 0 && this.state === 'slide') b.vx = -b.hitWall * SLIDE_VX;
    if (this.state === 'slide' && b.vx !== 0) this.facing = b.vx > 0 ? 1 : -1;
    this.fall(world);
    this.currentFrame = this.frameName(world.frame);
  }

  private face(dx: number): void {
    if (dx !== 0) this.facing = dx < 0 ? -1 : 1;
  }

  /** Back to standing after a move: a short wait, then the next one. */
  private rest(world: World): void {
    this.enter('wait');
    this.waitFor = WAIT_MIN + world.rng.int(WAIT_SPREAD);
  }

  /** After two moves a shot (a jump over the hero when he is too close), else a hop or a high jump. */
  private nextMove(world: World, dx: number): void {
    const b = this.body;
    const close = Math.abs(dx) < px(CLOSE_PX);
    let blasts = 0;
    for (const e of world.entities) if (e instanceof WandBlast && e.alive && e.owner === this) blasts++;
    if (this.moves >= 2 && !close && blasts < MAX_BLASTS) {
      this.moves = 0;
      this.enter('aim');
      return;
    }
    this.moves++;
    const high = close || world.rng.chance(0.3);
    this.state = high ? 'jump' : 'hop';
    this.t = 0;
    b.vy = -(high ? JUMP_VY : HOP_VY);
    this.airVx = this.facing * (high ? JUMP_VX : HOP_VX);
    b.vx = this.airVx;
    b.onGround = false;
  }

  /** The ring leaves the wand's tip, aimed at the hero's middle where he is now. */
  private fire(world: World): void {
    const b = this.body;
    const p = world.nearestPlayer(b.x + (b.w >> 1));
    const cx = b.x + (b.w >> 1) + this.facing * px(10);
    const cy = b.y + px(4);
    world.spawn(new WandBlast(cx, cy, p.centerX, p.body.y + (p.body.h >> 1), this));
    world.audio.sfx('fireball');
  }

  private frameName(frame: number): string {
    switch (this.state) {
      case 'spin':
      case 'slide':
        return `larry-shell-${(frame >> 2) & 3}`;
      case 'beaten':
        return 'larry-hurt';
      case 'aim':
        return 'larry-1';
      default:
        if (this.invuln > 0) return 'larry-hurt';
        return this.body.onGround ? 'larry-0' : 'larry-1';
    }
  }

  override render(r: Renderer, view: View): void {
    // Flashing after a hit (with reduce flashing he shows the hurt pose instead).
    if (this.invuln > 0 && !view.reduceFlashing && (view.frame & 4) !== 0) return;
    const frame = this.state === 'fly' ? `larry-shell-${(view.frame >> 1) & 3}` : this.currentFrame;
    const shell = frame.startsWith('larry-shell');
    const x = this.screenX(view);
    const y = this.screenY();
    const flip = this.facing > 0;
    const art = sheetWith(view.assets, SMB3_SHEET, frame);
    if (art) {
      r.sprite(art, frame, x, y, flip);
      return;
    }
    this.renderFallback(r, view, frame, shell, x, y, flip);
  }

  /** Until the SMB3 art lands: a green turtle with a shock of blue hair and a wand. */
  private renderFallback(
    r: Renderer,
    view: View,
    frame: string,
    shell: boolean,
    x: number,
    y: number,
    flip: boolean,
  ): void {
    if (!view.assets.has('enemies')) return;
    const sheet = view.assets.sheet('enemies', 'koopa-green');
    if (shell) {
      r.sprite(sheet, (view.frame >> 2) & 1 ? 'shell-wiggle' : 'shell', x, y, flip);
      return;
    }
    r.sprite(sheet, frame === 'larry-0' ? 'koopa-0' : 'koopa-1', x, y, flip);
    // Hair: a blue tuft on the head.
    const hx = flip ? x + 9 : x + 3;
    r.rect(hx, y - 1, 4, 3, '#3cbcfc');
    // The wand: held forward, raised over his head while aiming.
    const front = flip ? x + 15 : x;
    if (this.state === 'aim') {
      r.rect(front, y - 6, 1, 9, '#fcfcfc');
      r.rect(front - 1, y - 9, 3, 3, '#f8d878');
    } else {
      r.rect(flip ? front : front - 6, y + 12, 7, 1, '#fcfcfc');
      r.rect(flip ? front + 6 : front - 8, y + 11, 3, 3, '#f8d878');
    }
  }
}

/** What a non-stomp hit takes off Larry: 0 for things that don't hurt him. */
export function larryDamage(src: DamageSource): number {
  switch (src.kind) {
    case 'fireball':
    case 'sword':
    case 'buster':
    case 'weapon':
    case 'bomb':
    case 'shell':
      return src.amount >= 3 ? 2 : 1;
    default:
      return 0;
  }
}
