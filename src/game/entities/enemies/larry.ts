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

/** The SMB3 art's sheet (content/sprites/smb3.ts). */
const SMB3 = 'smb3';

/** Hit points in half-stomps: three stomps (or six fireballs). */
export const LARRY_HP = 6;
/** What a stomp takes; every other hit takes 1 (2 for a heavy one, amount >= 3). */
export const STOMP_DAMAGE = 2;
/** Frames he flashes, untouchable by attacks, after a non-stomp hit. */
export const LARRY_FLASH_FRAMES = 40;
/**
 * Mega Man's airship (0.4.39, World.megamanShip): Larry's hit-point mode. A Mega Man 2 style bar
 * of 28; a stomp still takes a third of it (three stomps win), a buster shot 4, a charge shot (or
 * any heavy hit, amount 3 or more) 10, with a short flash between hits.
 */
export const LARRY_MM_HP = 28;
export const LARRY_MM_STOMP = 10;
export const LARRY_MM_SHOT = 4;
export const LARRY_MM_HEAVY = 10;
export const LARRY_MM_FLASH = 20;
/** Points for a wand blast shot down on Mega Man's airship (World.projectile). */
export const WAND_BLAST_POINTS = 100;

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
/** The first frames of the spin show him flinching from the stomp (`larry-hurt`). */
const STOMP_FLINCH_FRAMES = 10;
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
  sheet: SMB3,
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

  /** The 16×16 ring centred on its 10×10 body. */
  override render(r: Renderer, view: View): void {
    const frame = WAND_BLAST.frames[Math.floor(this.age / WAND_BLAST.frameRate) & 1] as string;
    r.sprite(view.assets.sheet(SMB3), frame, toPx(this.body.x) - view.camX - 3, toPx(this.body.y) - 3);
  }
}

export type LarryState = 'wait' | 'hop' | 'jump' | 'aim' | 'spin' | 'slide' | 'out' | 'beaten' | 'fly';

const STAND_H = 22;
/** How far over his top "BWAH!" starts: clear of the beating stomp's points (8 px over him). */
const BWAH_RISE = 24;
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
  /** His hit points when full: LARRY_HP, or LARRY_MM_HP in the hit-point mode. */
  readonly maxHp: number;

  constructor(
    tx: number,
    ty: number,
    next: string | null = null,
    /** Mega Man's airship: the hit-point mode (LARRY_MM_HP, a bar over the cabin). */
    readonly hpMode = false,
  ) {
    // `tx ty`: the tile his feet stand in.
    super(px(tx * 16 + 1), px((ty + 1) * 16 - STAND_H), 14, STAND_H);
    this.maxHp = hpMode ? LARRY_MM_HP : LARRY_HP;
    this.hp = this.maxHp;
    this.scores = LARRY_SCORES;
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
   * take 1 (2 when heavy), and so does Samus's Ice Beam (it can't freeze him), then he flashes for
   * LARRY_FLASH_FRAMES. Boomerangs, bumps and the like do nothing.
   */
  override hit(src: DamageSource, world: World): Reaction {
    if (this.defeated) return 'immune';
    if (this.inShell) return src.kind === 'stomp' ? 'bounce' : 'immune';
    if (src.kind === 'stomp') {
      world.audio.sfx('stomp');
      this.damage(this.hpMode ? LARRY_MM_STOMP : STOMP_DAMAGE, world, true);
      return 'hp';
    }
    let n = larryDamage(src);
    if (n === 0 || this.invuln > 0) return 'immune';
    if (this.hpMode) n = n >= 2 ? LARRY_MM_HEAVY : LARRY_MM_SHOT;
    this.damage(n, world, false);
    return 'hp';
  }

  private damage(n: number, world: World, stomp: boolean): void {
    this.hp = Math.max(0, this.hp - n);
    if (this.hp === 0) return this.beaten(world);
    if (stomp) this.enter('spin');
    else this.invuln = this.hpMode ? LARRY_MM_FLASH : LARRY_FLASH_FRAMES;
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
    // A row above where the stomp's points rise (World.scoreStomp puts them 8 px over him), so the
    // two never overlap as they float up together.
    world.spawn(new ScorePopup(this.body.x - px(4), this.body.y - px(BWAH_RISE), 'BWAH!'));
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

  /**
   * The smb3 sheet's frames (they face left and are bottom-anchored): `larry-0` standing (and
   * aiming), `larry-1` in the air (feet tucked up, wand raised), `larry-hurt` flinching with the
   * wand knocked away (the first moments after a stomp, and beaten), `larry-shell-0..3` spinning.
   */
  private frameName(frame: number): string {
    switch (this.state) {
      case 'spin':
        return this.t <= STOMP_FLINCH_FRAMES ? 'larry-hurt' : `larry-shell-${(frame >> 2) & 3}`;
      case 'slide':
        return `larry-shell-${(frame >> 2) & 3}`;
      case 'beaten':
        return 'larry-hurt';
      case 'aim':
        return 'larry-0';
      default:
        return this.body.onGround ? 'larry-0' : 'larry-1';
    }
  }

  /**
   * Drawn bottom-centred on his body. After a hit he flashes in `smb3-flash` (every few frames;
   * with reduce flashing he stays blanched, without blinking, until the flash time is over).
   */
  override render(r: Renderer, view: View): void {
    const frame = this.state === 'fly' ? `larry-shell-${(view.frame >> 1) & 3}` : this.currentFrame;
    const flash = this.invuln > 0 && (view.reduceFlashing || (view.frame & 4) !== 0);
    const sheet = view.assets.sheet(SMB3, flash ? 'smb3-flash' : undefined);
    const f = sheet.frames.get(frame);
    const w = f?.w ?? 16;
    const h = f?.h ?? 24;
    const b = this.body;
    const x = toPx(b.x + (b.w >> 1)) - view.camX - (w >> 1);
    r.sprite(sheet, frame, x, toPx(b.y + b.h) - h, this.facing > 0);
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
    // Samus's Ice Beam: it cannot freeze him, but it hurts like a fireball.
    case 'ice':
      return 1;
    default:
      return 0;
  }
}
