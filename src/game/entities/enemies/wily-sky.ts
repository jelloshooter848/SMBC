import type { Renderer } from '@engine/gfx/renderer';
import { overlaps } from '@engine/math/aabb';
import { px, tileAt, tileToSub, toPx, velToSub } from '@engine/math/units';
import { Entity, type View } from '../entity';
import { Enemy } from './enemy';
import { Explosion } from '../effects/effects';
import { Projectile, type ProjectileSpec } from '../projectiles/projectile';
import { T } from '../../level/tiles';
import type { DamageSource, Reaction, Vulnerability } from '../../rules/damage';
import type { KillScores } from '../../rules/score';
import type { World } from '../../world/world';

/*
 * The "Wily-sky remix" of Larry's airship deck (0.4.39, owner's v0.4.34 play-test notes): Mega
 * Man's own enemies, in Mega Man 2's style, laid by the deck's `[variant megaman]` section
 * (content/levels/world4/4-2-airship.map; level/variants.ts). Original art on the station sheet
 * (content/sprites/station.ts, Mega Man's mini game's robots), nothing traced.
 *
 * - `telly-port x y`: a hatch on the deck that lets out a Telly now and then while it is on
 *   screen (at most two of its own at a time, never with the hero right on top of it).
 * - Telly: a little flying can with one eye that drifts slowly toward the nearest hero, through
 *   everything. One hit.
 * - `gull x y`: a robot gull that sweeps in from the right at its height, a gentle bob, and drops
 *   one bomb as it passes over the hero. One hit. Its bomb falls, can be shot down for points, and
 *   bursts on the deck (a small blast that hurts whoever stands in it).
 * - `shield-joe x y`: a shielded soldier in the spirit of Sniper Joe. Shield up, he turns every
 *   shot from the front away (a dink); then he lowers it to fire three pellets at the hero's
 *   height, and a hit lands only then, or from behind. Four buster hits (a charge shot is three).
 * - `yoku x y at=<frames> [period=<frames>] [on=<frames>]`: an appearing block. On the shared
 *   clock it shows (solid) for `on` frames of every `period`, starting `at` frames in; the last
 *   frames before it goes it shows darker (a warning that is no flash). It never appears on top of
 *   anyone: it waits until the cell is clear.
 *
 * Mega Man's buster, his charge shot and his weapons hurt them (so do co-op partners' attacks and
 * stomps); each gives Mega Man's drops through World.enemyKilled, which on his airship keeps every
 * drop where it can be collected (World.placeDrop).
 */

const SHEET = 'station';
const FLASH = 'station-flash';

/** What hurts the remix's robots: shots, weapons and partners' attacks take hit points. */
const SKY_VULNERABILITY: Vulnerability = {
  stomp: 'kill',
  buster: 'hp',
  weapon: 'hp',
  fireball: 'hp',
  sword: 'hp',
  bomb: 'hp',
  shell: 'kill',
  star: 'kill',
  ice: 'hp',
};

/** A robot of the remix: hit points, a pale flash when hit, a small explosion when beaten. */
abstract class SkyBot extends Enemy {
  protected flash = 0;
  constructor(x: number, y: number, w: number, h: number, hp: number, scores: KillScores) {
    super(x, y, w, h);
    this.hp = hp;
    this.scores = scores;
    this.vulnerability = { ...SKY_VULNERABILITY };
    this.body.vx = 0;
    this.sheet = SHEET;
  }

  override hit(src: DamageSource, world: World): Reaction {
    const r = super.hit(src, world);
    if (r === 'hp' && this.alive) this.flash = 6;
    return r;
  }

  protected override flipOut(_src: DamageSource, world: World): void {
    const b = this.body;
    world.spawn(new Explosion(b.x + (b.w >> 1), b.y + (b.h >> 1), true));
    world.audio.sfx('kick');
    this.destroy();
  }

  protected override squash(world: World): void {
    this.flipOut({ kind: 'stomp', amount: 1, owner: null, dirX: this.facing }, world);
  }

  protected tick(): void {
    if (this.flash > 0) this.flash--;
  }

  override palette(): string {
    return SHEET;
  }

  /** Faces left; flipped facing right; pale for a moment after a hit (not with reduce flashing). */
  override render(r: Renderer, view: View): void {
    if (!this.currentFrame) return;
    const sheet = view.assets.sheet(SHEET, this.flash > 0 && !view.reduceFlashing ? FLASH : undefined);
    r.sprite(sheet, this.currentFrame, this.screenX(view), this.screenY(), this.facing > 0);
  }
}

/* ---------------------------------------------------------------------------------- Telly */

export const TELLY_SCORES: KillScores = { stomp: 200, attack: 200, star: 200, below: 200 };
/** Drift toward the hero: up to 0.5 px a frame, turning by a little each frame. */
const TELLY_MAX = 0x00800;
const TELLY_TURN = 0x00020;

export class Telly extends SkyBot {
  readonly kind = 'telly';
  private age = 0;
  constructor(cx: number, cy: number) {
    super(cx - px(7), cy - px(7), 14, 14, 1, TELLY_SCORES);
    this.spriteOffsetX = 1;
    this.spriteOffsetY = 1;
    this.activated = true;
    this.despawnMargin = 48;
    this.layer = 'front';
    this.currentFrame = 'telly-0';
  }

  update(world: World): void {
    this.tick();
    this.age++;
    const b = this.body;
    const p = world.nearestPlayer(b.x + (b.w >> 1));
    const dx = p.centerX - (b.x + (b.w >> 1));
    const dy = p.body.y + (p.body.h >> 1) - (b.y + (b.h >> 1));
    const len = Math.max(1, Math.hypot(dx, dy));
    const wantX = Math.round((dx / len) * TELLY_MAX);
    const wantY = Math.round((dy / len) * TELLY_MAX);
    b.vx += Math.max(-TELLY_TURN, Math.min(TELLY_TURN, wantX - b.vx));
    b.vy += Math.max(-TELLY_TURN, Math.min(TELLY_TURN, wantY - b.vy));
    b.x += velToSub(b.vx);
    b.y += velToSub(b.vy);
    if (dx !== 0) this.facing = dx < 0 ? -1 : 1;
    this.currentFrame = `telly-${(this.age >> 3) & 1}`;
    if (b.x + b.w < world.camera.x - px(48) || b.y > px(this.levelHeightPx + 16)) this.destroy();
  }
}

/** Frames between Tellys, how many of its own a hatch keeps out, and the clear space it needs. */
export const TELLY_PERIOD = 150;
export const TELLY_MAX_OUT = 2;
const TELLY_CLEAR = 32;

/** `telly-port x y`: a hatch standing on the tile below (x, y), letting Tellys out. */
export class TellyPort extends Entity {
  readonly kind = 'telly-port';
  private timer = 60;
  private open = 0;
  readonly out: Telly[] = [];
  constructor(
    readonly tx: number,
    readonly ty: number,
  ) {
    super(tileToSub(tx), tileToSub(ty), 16, 16);
    this.layer = 'back';
    this.despawnMargin = null;
  }

  update(world: World): void {
    if (this.open > 0) this.open--;
    const b = this.body;
    const cam = world.camera;
    if (b.x + b.w <= cam.x || b.x >= cam.right) return;
    if (--this.timer > 0) return;
    this.timer = TELLY_PERIOD;
    for (let i = this.out.length - 1; i >= 0; i--) if (!this.out[i]?.alive) this.out.splice(i, 1);
    if (this.out.length >= TELLY_MAX_OUT) return;
    const cx = b.x + px(8);
    if (world.activePlayers().some((p) => Math.abs(p.centerX - cx) < px(TELLY_CLEAR))) {
      this.timer = 30;
      return;
    }
    const t = new Telly(cx, b.y + px(2));
    this.out.push(t);
    world.spawn(t);
    world.audio.sfx('door-open');
    this.open = 20;
  }

  render(r: Renderer, view: View): void {
    const x = toPx(this.body.x) - view.camX;
    r.sprite(view.assets.sheet(SHEET), `telly-port-${this.open > 0 ? 1 : 0}`, x, toPx(this.body.y));
  }
}

/* ----------------------------------------------------------------------------- Gull, bomb */

export const GULL_SCORES: KillScores = { stomp: 300, attack: 300, star: 300, below: 300 };
const GULL_SPEED = 0x01000;
const GULL_BOB = 6;
/** How close (px, centres) over the hero it lets its bomb go. */
const GULL_DROP_DX = 20;

export class Gull extends SkyBot {
  readonly kind = 'gull';
  private age = 0;
  private dropped = false;
  private readonly baseY: number;
  constructor(x: number, y: number) {
    super(x, y + px(2), 16, 12, 1, GULL_SCORES);
    this.spriteOffsetY = 2;
    this.baseY = this.body.y;
    this.despawnMargin = 48;
    this.currentFrame = 'gull-0';
  }

  update(world: World): void {
    this.tick();
    const b = this.body;
    if (!this.activated) {
      if (b.x >= world.camera.right || b.x + b.w <= world.camera.x) return;
      this.activated = true;
    }
    this.age++;
    b.x -= velToSub(GULL_SPEED);
    b.y = this.baseY + Math.round(Math.sin(this.age / 10) * px(GULL_BOB));
    this.facing = -1;
    if (!this.dropped) {
      const p = world.nearestPlayer(b.x + (b.w >> 1));
      const dx = p.centerX - (b.x + (b.w >> 1));
      if (Math.abs(dx) < px(GULL_DROP_DX) && p.body.y > b.y && !p.dead) {
        this.dropped = true;
        world.spawn(new SkyBomb(b.x + (b.w >> 1), b.y + b.h));
        world.audio.sfx('kick');
      }
    }
    this.currentFrame = `gull-${(this.age >> 3) & 1}`;
    if (b.x + b.w < world.camera.x - px(32)) this.destroy();
  }
}

export const BOMB_SCORES: KillScores = { stomp: 100, attack: 100, star: 100, below: 100 };
const BOMB_GRAVITY = 0x00200;
const BOMB_MAX = 0x02800;
/** The blast's reach (px from the bomb's centre) when it bursts on the deck. */
export const BOMB_BLAST = 18;

/** The gull's bomb: falls, bursts on the first solid tile it meets. A shot (or a stomp) pops it. */
export class SkyBomb extends Enemy {
  readonly kind = 'sky-bomb';
  constructor(cx: number, top: number) {
    super(cx - px(4), top, 8, 8);
    this.sheet = SHEET;
    this.scores = BOMB_SCORES;
    this.layer = 'front';
    this.activated = true;
    this.despawnMargin = 32;
    this.body.vx = 0;
    this.currentFrame = 'sky-bomb';
    this.vulnerability = { ...SKY_VULNERABILITY, stomp: 'kill', ice: 'kill' };
  }

  override palette(): string {
    return SHEET;
  }

  update(world: World): void {
    const b = this.body;
    b.vy = Math.min(BOMB_MAX, b.vy + BOMB_GRAVITY);
    b.y += velToSub(b.vy);
    const cx = tileAt(b.x + (b.w >> 1));
    const cy = tileAt(b.y + b.h);
    if (world.map.isSolid(cx, cy)) return this.burst(world);
    if (b.y > px(this.levelHeightPx + 16)) this.destroy();
  }

  /** It bursts on the deck: a small blast that hurts whoever stands in it. */
  burst(world: World): void {
    const b = this.body;
    const cx = b.x + (b.w >> 1);
    const cy = b.y + (b.h >> 1);
    world.spawn(new Explosion(cx, cy, true));
    world.audio.sfx('bomb-blast');
    const reach = px(BOMB_BLAST);
    const area = { x: cx - reach, y: cy - reach, w: reach * 2, h: reach * 2 };
    for (const p of world.activePlayers())
      if (overlaps(area, p.body)) world.hurtPlayer(p, p.centerX < cx ? -1 : 1);
    this.destroy();
  }

  protected override flipOut(_src: DamageSource, world: World): void {
    const b = this.body;
    world.spawn(new Explosion(b.x + (b.w >> 1), b.y + (b.h >> 1), true));
    world.audio.sfx('kick');
    this.destroy();
  }

  protected override squash(world: World): void {
    this.flipOut({ kind: 'stomp', amount: 1, owner: null, dirX: this.facing }, world);
  }

  override render(r: Renderer, view: View): void {
    r.sprite(view.assets.sheet(SHEET), 'sky-bomb', this.screenX(view), this.screenY());
  }
}

/* ------------------------------------------------------------------------------ Shield Joe */

export const JOE_HP = 4;
export const JOE_SCORES: KillScores = { stomp: 500, attack: 500, star: 500, below: 500 };
/** Shield up, then down to fire (three pellets JOE_GAP apart, from JOE_FIRST in), then up again. */
export const JOE_GUARD = 96;
export const JOE_OPEN = 54;
const JOE_FIRST = 10;
const JOE_GAP = 14;
const JOE_SHOTS = 3;
/** He only fights with a hero on screen and within this reach (px). */
const JOE_RANGE = 160;

/** A Joe's pellet: a straight shot, through everything; only the heroes mind it. */
export const JOE_PELLET: ProjectileSpec = {
  kind: 'joe-pellet',
  damage: 'contact',
  amount: 1,
  speed: 0x01800,
  gravity: 0,
  bounceVy: null,
  hitsTiles: false,
  hitsEnemies: false,
  hitsPlayer: true,
  lifetime: 240,
  w: 6,
  h: 6,
  sheet: SHEET,
  frames: ['pellet'],
  frameRate: 1,
};

export type JoeState = 'guard' | 'open';

export class ShieldJoe extends SkyBot {
  readonly kind = 'shield-joe';
  state: JoeState = 'guard';
  private t = 0;
  /** Shots turned away by the shield (tests). */
  blocked = 0;
  constructor(x: number, y: number) {
    // `x y`: the tile his feet stand in; 12 wide, 22 tall.
    super(x + px(2), y + px(16 - 22), 12, 22, JOE_HP, JOE_SCORES);
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.fallsOffLedges = false;
    this.currentFrame = 'joe-guard';
  }

  /** Shield up: anything from in front of him is turned away. */
  override hit(src: DamageSource, world: World): Reaction {
    const fromFront = src.dirX === -this.facing;
    if (this.state === 'guard' && fromFront && src.kind !== 'star' && src.kind !== 'stomp') {
      this.blocked++;
      world.audio.sfx('dink');
      return 'immune';
    }
    return super.hit(src, world);
  }

  update(world: World): void {
    this.tick();
    this.fall(world);
    const b = this.body;
    const p = world.nearestPlayer(b.x + (b.w >> 1));
    const dx = p.centerX - (b.x + (b.w >> 1));
    const onScreen = b.x + b.w > world.camera.x && b.x < world.camera.right;
    if (this.state === 'guard') this.facing = dx < 0 ? -1 : 1;
    if (!onScreen || Math.abs(dx) > px(JOE_RANGE)) {
      this.state = 'guard';
      this.t = 0;
    } else {
      this.t++;
      if (this.state === 'guard' && this.t >= JOE_GUARD) {
        this.state = 'open';
        this.t = 0;
      } else if (this.state === 'open') {
        const k = this.t - JOE_FIRST;
        if (k >= 0 && k % JOE_GAP === 0 && k / JOE_GAP < JOE_SHOTS) this.fire(world);
        if (this.t >= JOE_OPEN) {
          this.state = 'guard';
          this.t = 0;
        }
      }
    }
    this.currentFrame = this.state === 'guard' ? 'joe-guard' : 'joe-shoot';
    if (this.isBelowLevel()) this.destroy();
  }

  /** A pellet straight ahead from his gun, at its height. */
  private fire(world: World): void {
    const b = this.body;
    const x = this.facing < 0 ? b.x - px(6) : b.x + b.w;
    world.spawn(new Projectile(x, b.y + px(8), this.facing, JOE_PELLET, this));
    world.audio.sfx('fireball');
  }
}

/* --------------------------------------------------------------------------- Yoku blocks */

/** The shared rhythm of the appearing blocks (frames): a cycle, and how long each one shows. */
export const YOKU_PERIOD = 180;
export const YOKU_ON = 110;
/** The last frames before it goes, drawn darker as a warning. */
export const YOKU_WARN = 30;

/** `yoku x y at=N [period=N] [on=N]`: an appearing block on cell (x, y). */
export class Yoku extends Entity {
  readonly kind = 'yoku';
  shown = false;
  private readonly period: number;
  private readonly on: number;
  private readonly at: number;
  constructor(
    readonly tx: number,
    readonly ty: number,
    props: Record<string, string | number | boolean> = {},
  ) {
    super(tileToSub(tx), tileToSub(ty), 16, 16);
    this.layer = 'back';
    this.despawnMargin = null;
    const n = (k: string, d: number) => {
      const v = Number(props[k]);
      return Number.isFinite(v) && props[k] !== undefined ? v : d;
    };
    this.period = Math.max(30, n('period', YOKU_PERIOD));
    this.on = Math.max(10, Math.min(this.period, n('on', YOKU_ON)));
    this.at = n('at', 0);
  }

  /** Frames into its own cycle at world frame `frame`. */
  phase(frame: number): number {
    return (((frame - this.at) % this.period) + this.period) % this.period;
  }

  update(world: World): void {
    const want = this.phase(world.frame) < this.on;
    if (want === this.shown) return;
    if (want) {
      // Never on top of anyone: it waits for the cell to be clear.
      const cell = { x: this.body.x, y: this.body.y, w: this.body.w, h: this.body.h };
      if (world.players.some((p) => !p.dead && !p.out && overlaps(cell, p.body))) return;
      if (world.map.get(this.tx, this.ty) !== T.AIR) return;
      world.map.set(this.tx, this.ty, T.BUMPING);
      this.shown = true;
      const cam = world.camera;
      if (this.body.x + this.body.w > cam.x && this.body.x < cam.right) world.audio.sfx('yoku');
    } else {
      if (world.map.get(this.tx, this.ty) === T.BUMPING) world.map.set(this.tx, this.ty, T.AIR);
      this.shown = false;
    }
  }

  render(r: Renderer, view: View): void {
    if (!this.shown) return;
    const x = toPx(this.body.x) - view.camX;
    if (x < -16 || x > 272) return;
    const p = this.phase(view.frame);
    // Building in for its first frames, darker for its last (a warning, not a flash).
    const frame = p < 6 ? 'yoku-in' : p >= this.on - YOKU_WARN ? 'yoku-fade' : 'yoku';
    r.sprite(view.assets.sheet(SHEET), frame, x, toPx(this.body.y));
  }
}
