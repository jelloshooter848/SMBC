import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx, velToSub } from '@engine/math/units';
import { Enemy } from './enemy';
import { ENEMY_SCORES } from '../../rules/score';
import { Entity, type View } from '../entity';
import { T } from '../../level/tiles';
import type { World } from '../../world/world';

/*
 * SMB3 airship cannons (Larry's airship deck, 4-2-airship.map): a cannon is a solid block that
 * fires a cannonball every `period` frames while it is on screen. The ball flies in a straight
 * line through everything; a stomp drops it (SMB3), fireballs bounce off it.
 */

const SMB3 = 'smb3';

export type CannonDir = 'r' | 'l' | 'ul' | 'ur' | 'dl' | 'dr';
export const CANNON_DIRS: readonly CannonDir[] = ['r', 'l', 'ul', 'ur', 'dl', 'dr'];
export const isCannonDir = (s: unknown): s is CannonDir => CANNON_DIRS.includes(s as CannonDir);

/** Unit steps of each barrel direction (screen y grows downward). */
const STEP: Record<CannonDir, readonly [-1 | 0 | 1, -1 | 0 | 1]> = {
  r: [1, 0],
  l: [-1, 0],
  ul: [-1, -1],
  ur: [1, -1],
  dl: [-1, 1],
  dr: [1, 1],
};

/** A straight shot flies 1 px/f; a diagonal one 0.75 px/f on each axis (1.06 px/f along it). */
export const BALL_SPEED = 0x01000;
export const BALL_DIAG_SPEED = 0x00c00;
/** Frames between shots when the map gives no `period=` (SMB3's deck cannons: about 2.5 s). */
export const CANNON_PERIOD = 150;
/** No point-blank shots: the cannon holds fire while a player's centre is this close to the muzzle. */
const HOLD_DIST = px(20);
/** After a held shot, try again this soon. */
const RETRY = 20;

/** A cannon's ball: a 12×12 body inside its 16×16 frame. */
export class Cannonball extends Enemy {
  readonly kind = 'cannonball';

  constructor(cx: number, cy: number, vx: number, vy: number) {
    super(cx - px(6), cy - px(6), 12, 12);
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.currentFrame = 'cannonball';
    this.sheet = SMB3;
    this.scores = ENEMY_SCORES.CANNONBALL;
    this.layer = 'front';
    this.activated = true;
    this.despawnMargin = 32;
    this.body.vx = vx;
    this.body.vy = vy;
    this.facing = vx < 0 ? -1 : 1;
    // Like a Bullet Bill: fire, boomerangs and ice bounce off; a stomp or a hard hit drops it.
    this.vulnerability = { ...this.vulnerability, fireball: 'immune', boomerang: 'immune', ice: 'immune' };
  }

  override palette(): string {
    return SMB3;
  }

  protected override corpsePalette(): string {
    return SMB3;
  }

  update(world: World): void {
    const b = this.body;
    b.x += velToSub(b.vx);
    b.y += velToSub(b.vy);
    const cam = world.camera;
    if (b.x > cam.right + px(32) || b.x + b.w < cam.x - px(32) || b.y > px(this.levelHeightPx + 16) || b.y + b.h < -px(32))
      this.destroy();
  }

  /** Stomped: it drops straight down (SMB3), no score sequence trickery. */
  protected override squash(world: World): void {
    world.audio.sfx('stomp');
    this.flipOut({ kind: 'stomp', amount: 1, owner: null, dirX: this.facing }, world, false);
  }

  override render(r: Renderer, view: View): void {
    if (view.assets.has(SMB3) && view.assets.sheet(SMB3).frames.has('cannonball')) return super.render(r, view);
    // Until the art lands: a dark ball.
    const x = this.screenX(view);
    const y = this.screenY();
    r.rect(x + 3, y + 1, 10, 14, '#202020');
    r.rect(x + 1, y + 3, 14, 10, '#202020');
    r.rect(x + 4, y + 4, 3, 3, '#808080');
  }
}

/**
 * `cannon x y dir=r|l|ul|ur|dl|dr [period=frames] [delay=frames]`: a solid block (its cell is made
 * solid when it spawns) that fires a Cannonball out of its barrel every `period` frames while it
 * is on screen. The first shot comes `delay` frames after it scrolls into view (by default a
 * stagger taken from its position, so a row of cannons does not fire as one).
 */
export class Cannon extends Entity {
  readonly kind = 'cannon';
  readonly dir: CannonDir;
  readonly period: number;
  /** Frames (on screen) to the next shot. */
  timer: number;
  shots = 0;

  constructor(
    readonly tx: number,
    readonly ty: number,
    dir: CannonDir = 'l',
    period = CANNON_PERIOD,
    delay?: number,
  ) {
    super(px(tx * 16), px(ty * 16), 16, 16);
    this.dir = dir;
    this.period = Math.max(30, Math.round(period));
    this.timer = delay ?? 30 + ((tx * 37 + ty * 53) % this.period);
    this.layer = 'back';
    this.despawnMargin = null;
    this.body.vx = 0;
  }

  /** The cell is a block: make it solid if the map left it open (it stays invisible; we draw it). */
  private placed = false;

  /** Where a new ball's centre starts: just out of the barrel. */
  muzzle(): { x: number; y: number } {
    const [sx, sy] = STEP[this.dir];
    return { x: this.body.x + px(8 + sx * 12), y: this.body.y + px(8 + sy * 12) };
  }

  velocity(): { vx: number; vy: number } {
    const [sx, sy] = STEP[this.dir];
    const s = sx !== 0 && sy !== 0 ? BALL_DIAG_SPEED : BALL_SPEED;
    return { vx: sx * s, vy: sy * s };
  }

  update(world: World): void {
    if (!this.placed) {
      this.placed = true;
      if (!world.map.isSolid(this.tx, this.ty)) world.map.set(this.tx, this.ty, T.BUMPING);
    }
    const cam = world.camera;
    const b = this.body;
    if (b.x + b.w <= cam.x || b.x >= cam.right) return;
    if (--this.timer > 0) return;
    const m = this.muzzle();
    for (const p of world.activePlayers()) {
      const py = p.body.y + (p.body.h >> 1);
      if (Math.abs(p.centerX - m.x) < HOLD_DIST && Math.abs(py - m.y) < HOLD_DIST) {
        this.timer = RETRY;
        return;
      }
    }
    this.timer = this.period;
    const v = this.velocity();
    world.spawn(new Cannonball(m.x, m.y, v.vx, v.vy));
    world.audio.sfx('cannon');
    this.shots++;
  }

  render(r: Renderer, view: View): void {
    const x = toPx(this.body.x) - view.camX;
    const y = toPx(this.body.y);
    const frame = `cannon-${this.dir}`;
    if (view.assets.has(SMB3)) {
      const sheet = view.assets.sheet(SMB3);
      if (sheet.frames.has(frame)) return r.sprite(sheet, frame, x, y);
    }
    // Until the art lands: a grey block with its barrel's mouth marked.
    const [sx, sy] = STEP[this.dir];
    r.rect(x, y, 16, 16, '#505050');
    r.rect(x + 1, y + 1, 14, 14, '#303030');
    r.rect(x + 6 + sx * 5, y + 6 + sy * 5, 4, 4, '#000000');
  }
}
