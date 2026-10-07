import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx } from '@engine/math/units';
import { Enemy } from './enemy';
import { ENEMY_SCORES } from '../../rules/score';
import { BASIC_VULNERABILITY, type Vulnerability } from '../../rules/damage';
import type { View } from '../entity';
import { Projectile, type ProjectileSpec } from '../projectiles/projectile';
import type { World } from '../../world/world';

/*
 * SMB3's Rocky Wrench (Larry's airship deck, 4-2-airship.map): `rocky x y` hides in a manhole in
 * the deck under cell (x, y). When a player comes near it pops up, faces them, throws a wrench
 * that flies straight at the height of its hand, and ducks back down; then it waits and repeats.
 * Only while it is up (at least half out of the hole on the way up, until it starts ducking back
 * down) can it hurt, be stomped or be hit.
 */

const SMB3 = 'smb3';

/** A wrench flies flat at 1.25 px/f through everything; only players mind it. */
export const WRENCH: ProjectileSpec = {
  kind: 'wrench',
  damage: 'contact',
  amount: 1,
  speed: 0x01400,
  gravity: 0,
  bounceVy: null,
  hitsTiles: false,
  hitsEnemies: false,
  hitsPlayer: true,
  lifetime: 300,
  w: 8,
  h: 8,
  sheet: SMB3,
  frames: ['wrench-0', 'wrench-1'],
  frameRate: 4,
};

export class Wrench extends Projectile {
  override render(r: Renderer, view: View): void {
    if (view.assets.has(SMB3) && view.assets.sheet(SMB3).frames.has('wrench-0')) return super.render(r, view);
    const x = toPx(this.body.x) - view.camX;
    const y = toPx(this.body.y);
    const spin = Math.floor(this.age / 4) & 1;
    if (spin) r.rect(x, y + 3, 8, 2, '#c0c0c0');
    else r.rect(x + 3, y, 2, 8, '#c0c0c0');
  }
}

export type RockyState = 'hide' | 'rise' | 'aim' | 'throw' | 'wait' | 'duck';

/** Frames it takes to come out of the hole (and go back in): 1 px a frame. */
const RISE = 16;
/** Out far enough to be touched (half way). */
const HALF = 8;
const AIM = 24;
const THROW = 16;
const WAIT = 20;
/** Down in the hole between rounds. */
export const ROCKY_HIDE = 100;
/** Pops up only for a player within this many px sideways... */
const NEAR = px(128);
/**
 * ...and never right under or beside a player near its manhole (no rising into them, no
 * point-blank wrench): it waits until they are this far away sideways.
 */
const TOO_CLOSE = px(32);

const HIDDEN: Vulnerability = {};

export class RockyWrench extends Enemy {
  readonly kind = 'rocky-wrench';
  state: RockyState = 'hide';
  private t = 0;
  private hideFor = 40;
  /** The deck surface (subpixels): the bottom of the map cell. */
  private readonly deck: number;
  /** How far out of the hole (px, 0..16). */
  out = 0;
  thrown = 0;

  constructor(tx: number, ty: number) {
    super(px(tx * 16 + 1), px((ty + 1) * 16), 14, 16);
    this.deck = px((ty + 1) * 16);
    this.spriteOffsetX = 1;
    this.scores = ENEMY_SCORES.ROCKY_WRENCH;
    this.layer = 'back'; // drawn before the tiles: the deck hides what is still in the hole
    this.despawnMargin = 32;
    this.fallsOffLedges = false;
    this.body.vx = 0;
    this.sheet = SMB3;
    this.currentFrame = 'rocky-1'; // the knocked-out corpse
    this.setOut(0);
  }

  override palette(): string {
    return SMB3;
  }

  protected override corpsePalette(): string {
    return SMB3;
  }

  /** Up far enough to be hit, stomped or to hurt. */
  get exposed(): boolean {
    return this.out >= HALF && this.state !== 'duck';
  }

  private setOut(n: number): void {
    this.out = Math.max(0, Math.min(RISE, n));
    this.body.y = this.deck - px(this.out);
    const exposed = this.exposed;
    this.contactHurts = exposed;
    this.stompable = exposed;
    this.vulnerability = exposed ? { ...BASIC_VULNERABILITY } : HIDDEN;
  }

  private enter(s: RockyState): void {
    this.state = s;
    this.t = 0;
  }

  update(world: World): void {
    const b = this.body;
    const cam = world.camera;
    this.t++;
    const cx = b.x + (b.w >> 1);
    const pl = world.nearestPlayer(cx);
    switch (this.state) {
      case 'hide': {
        if (this.t < this.hideFor) return;
        if (b.x + b.w < cam.x || b.x > cam.right) return;
        const dx = Math.abs(pl.centerX - cx);
        const tooClose = world
          .activePlayers()
          .some(
            (p) =>
              Math.abs(p.centerX - cx) < TOO_CLOSE &&
              p.body.y + p.body.h <= this.deck + px(2) &&
              p.body.y + p.body.h > this.deck - px(40),
          );
        if (pl.dead || pl.out || dx > NEAR || tooClose) return;
        this.enter('rise');
        return;
      }
      case 'rise':
        this.setOut(this.out + 1);
        if (this.out >= RISE) this.enter('aim');
        break;
      case 'aim':
        this.facing = pl.centerX < cx ? -1 : 1;
        if (this.t >= AIM) this.enter('throw');
        break;
      case 'throw':
        // A hero who came right up to it while it aimed gets no point-blank wrench.
        if (this.t === 1 && Math.abs(pl.centerX - cx) >= TOO_CLOSE) {
          const dir = this.facing;
          const x = dir < 0 ? b.x - px(6) : b.x + b.w - px(2);
          world.spawn(new Wrench(x, b.y + px(3), dir, WRENCH, this));
          world.audio.sfx('kick');
          this.thrown++;
        }
        if (this.t >= THROW) this.enter('wait');
        break;
      case 'wait':
        if (this.t >= WAIT) {
          this.enter('duck');
          this.setOut(this.out);
        }
        break;
      case 'duck':
        this.setOut(this.out - 1);
        if (this.out <= 0) {
          this.hideFor = ROCKY_HIDE;
          this.enter('hide');
        }
        break;
    }
  }

  /** Stomped: it drops out of the deck and off the screen (SMB3). */
  protected override squash(world: World): void {
    world.audio.sfx('stomp');
    this.flipOut({ kind: 'stomp', amount: 1, owner: null, dirX: this.facing }, world, false);
  }

  /**
   * The smb3 frames stand on the deck (their bottom row is the deck top) and face left: the
   * closed lid while hidden, peeking (`rocky-0`) on the way up and down, risen with the wrench
   * (`rocky-1`) once (nearly) fully out.
   */
  override render(r: Renderer, view: View): void {
    const x = toPx(this.body.x) - view.camX - this.spriteOffsetX;
    const deckY = toPx(this.deck);
    const frame = this.out === 0 ? 'rocky-hide' : this.out >= 12 ? 'rocky-1' : 'rocky-0';
    const art = view.assets.has(SMB3) ? view.assets.sheet(SMB3) : null;
    if (art?.frames.has(frame)) {
      if (this.stunned > 0 && !view.reduceFlashing && (view.frame & 3) === 0) return;
      r.sprite(art, frame, x, deckY - 16, this.facing > 0);
      return;
    }
    // Without the art: a lid, or a brown mole with a lighter face (cut off by the deck).
    if (this.out === 0) {
      r.rect(x + 2, deckY - 3, 12, 3, '#606060');
      return;
    }
    const y = toPx(this.body.y);
    const h = Math.min(16, deckY - y);
    r.rect(x + 2, y, 12, h, '#8b4513');
    r.rect(x + (this.facing > 0 ? 8 : 3), y + 3, 5, Math.min(5, h - 3), '#e0b080');
  }
}
