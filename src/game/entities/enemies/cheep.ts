import type { Renderer } from '@engine/gfx/renderer';
import { px, toPx, velToSub } from '@engine/math/units';
import type { Rng } from '@engine/rng';
import type { EntitySpawn } from '../../level/schema';
import { Enemy } from './enemy';
import { ENEMY_SCORES } from '../../rules/score';
import type { View } from '../entity';
import type { World } from '../../world/world';

// CheepFast.as, Flash px/s at 32 px tiles: /2/60 for px/f, /2/3600 for px/f².
/** setStats(): grey `xSpeed = 50`, red `xSpeed = 100`. */
const SWIM_SPEED = { red: 0x00d55, grey: 0x006ab } as const; // 0.833 / 0.417 px/f
/** setStats(): a "wave" fish moves at `ySpeed = 20` up and down (defyGrav: no gravity). */
const WAVE_SPEED = 0x002ab; // 0.167 px/f
/** calcPosition(): a wave turns one tile above and below its start (yWaveTop / yWaveBot). */
const WAVE_RANGE = px(16);
/** calcPosition(): the start tile's bottom is pulled into GLOB_STG_TOP + 4 tiles .. GLOB_STG_BOT - 3 tiles. */
const SWIM_ROW_MIN = 3;
const SWIM_ROW_MAX = 11;
/** FLYING_GRAVITY = 375. */
const FLY_GRAVITY = 0x000d5; // 0.052 px/f²
/** FLYING_JUMP_PWR = 555: from below the screen the fish peaks about 205 px up. */
const FLY_JUMP = 0x04a00; // 4.625 px/f
/** MIN_HORZ_FLY_SPEED = 50, MAX_HORZ_FLY_SPEED = 250. */
const FLY_SPEED_MIN = 0x006ab; // 0.417 px/f
const FLY_SPEED_MAX = 0x02155; // 2.083 px/f
/** calcFlyingStats(): the screen x is re-rolled while within 120 Flash px of the centre. */
const FLY_X_PAD = 60;

/** What a leaping fish needs to know about the lead player when it is launched. */
export interface LeapTarget {
  /** Lead player's centre x (subpixels). */
  centerX: number;
  vx: number;
  /** For a Mario-type hero (MarioBase), his walking speed cap; null for other heroes. */
  marioWalk: number | null;
}

/**
 * Cheep Cheep. Underwater it swims left through anything, level or in a slow wave (not
 * stompable: a swimmer landing on it gets hurt). Leaping ones (bridge levels) arc up from below the screen
 * and can be stomped.
 */
export class Cheep extends Enemy {
  readonly kind = 'cheep';
  private readonly homeY: number;
  /** Swimming: true for a "wave" fish (CheepFast.calcMovement), false for one that swims level. */
  wave = false;

  /**
   * CheepFast.calcPosition, rolled when the level is loaded (as the original does) so the fish
   * still spawns off screen: a swimming fish's map entry moves -2..+2 tiles each way, then a tile
   * at a time until its bottom is in rows 3-11 (GLOB_STG_TOP + 4 tiles .. GLOB_STG_BOT - 3 tiles).
   * Other entries are returned unchanged.
   */
  static placeSwimmer(s: EntitySpawn, rng: Rng): EntitySpawn {
    if (s.type !== 'cheep-red' && s.type !== 'cheep-grey') return s;
    const x = Math.max(0, s.x + rng.int(5) - 2);
    let y = s.y + rng.int(5) - 2;
    while (y > SWIM_ROW_MAX) y--;
    while (y < SWIM_ROW_MIN) y++;
    return { ...s, x, y };
  }

  /**
   * A swimming fish from a (placed) map entry, set up like the original: Level.as (lines 953-958)
   * ignores the map's colour and picks red (fast) or grey (slow) 50/50; CheepFast.calcMovement
   * picks "wave" or "straight" 50/50. `tileX`, `tileY`: the tile's top-left (subpixels).
   */
  static swimmer(tileX: number, tileY: number, rng: Rng): Cheep {
    const color = rng.float() > 0.5 ? 'red' : 'grey';
    const wave = rng.float() > 0.5;
    const c = new Cheep(tileX + px(2), tileY + px(2), color);
    c.wave = wave;
    if (wave) c.body.vy = -WAVE_SPEED;
    return c;
  }

  /**
   * A leaping fish (CheepFast.calcFlyingStats). It starts just below the screen at a random
   * screen x away from the middle, with a random sideways speed in the player's walking direction
   * (full speed when a Mario-type hero is faster than his walk), or toward a standing player.
   * Until the player has not moved right for 2 s (`canReverse`, FlyingCheepSpawner
   * CAN_REVERSE_DIRECTION_DELAY), a fish that would fly left flies right instead.
   */
  static leaper(rng: Rng, cameraX: number, screenH: number, lead: LeapTarget, canReverse: boolean): Cheep {
    // GLOB_STG_RHT = 512 Flash px wide, re-rolled while within 120 of the centre (256).
    let sx = rng.float() * 256;
    while (sx > 128 - FLY_X_PAD && sx < 128 + FLY_X_PAD) sx = rng.float() * 256;
    const centerX = cameraX + Math.floor(sx * 256);
    const c = new Cheep(centerX - px(6), px(screenH), 'red', true);
    let speed = FLY_SPEED_MIN + Math.floor(rng.float() * (FLY_SPEED_MAX - FLY_SPEED_MIN));
    let dir: -1 | 1;
    if (lead.vx !== 0) {
      dir = lead.vx > 0 ? 1 : -1;
      if (lead.marioWalk !== null && Math.abs(lead.vx) > lead.marioWalk) speed = FLY_SPEED_MAX;
    } else dir = centerX > lead.centerX ? -1 : 1;
    if (!canReverse && dir < 0) dir = 1;
    c.body.vx = dir * speed;
    c.body.vy = -FLY_JUMP;
    c.facing = dir;
    return c;
  }

  constructor(
    x: number,
    y: number,
    readonly color: 'red' | 'grey',
    readonly flying = false,
  ) {
    super(x, y, 12, 12);
    this.homeY = y;
    this.spriteOffsetX = 2;
    this.spriteOffsetY = 2;
    this.currentFrame = 'cheep-0';
    this.scores = ENEMY_SCORES.CHEEP;
    this.despawnMargin = flying ? null : 64;
    if (flying) {
      this.activated = true;
    } else {
      this.body.vx = -SWIM_SPEED[color];
      this.stompable = false;
      this.vulnerability = { ...this.vulnerability, stomp: 'hurtAttacker' };
    }
  }

  override palette(view: View): string {
    return this.color === 'grey' ? 'cheep-grey' : super.palette(view);
  }

  update(world: World): void {
    const b = this.body;
    if (this.flying) {
      b.x += velToSub(b.vx);
      b.vy += FLY_GRAVITY;
      b.y += velToSub(b.vy);
      this.facing = b.vx > 0 ? 1 : -1;
      this.currentFrame = `cheep-${(world.frame >> 3) & 1}`;
      if (b.vy > 0 && toPx(b.y) > 240 + 16) this.destroy();
      return;
    }
    // Water: no tiles, no gravity. A wave fish bounces between a tile above and below its start
    // (CheepFast.updateStats); a straight one keeps its height.
    b.x += velToSub(b.vx);
    if (this.wave) {
      b.y += velToSub(b.vy);
      if (b.y < this.homeY - WAVE_RANGE) {
        b.y = this.homeY - WAVE_RANGE;
        b.vy = -b.vy;
      } else if (b.y > this.homeY + WAVE_RANGE) {
        b.y = this.homeY + WAVE_RANGE;
        b.vy = -b.vy;
      }
    }
    this.facing = b.vx > 0 ? 1 : -1;
    this.currentFrame = `cheep-${(world.frame >> 4) & 1}`;
  }

  override render(r: Renderer, view: View): void {
    // Leaping fish on the way down flip tail-up like the original.
    if (this.flying && this.body.vy > 0) {
      const sheet = view.assets.sheet(this.sheet, this.palette(view));
      r.sprite(sheet, this.currentFrame, this.screenX(view), this.screenY(), this.facing > 0, true);
      return;
    }
    super.render(r, view);
  }
}
