import type { InputFrame } from '@engine/input/input-manager';
import type { Box, Jungle } from './jungle';
import { C, WATER_Y } from './stage';

/*
 * Bill in Contra form: a mini-game-only variant of his kit (src/game/characters/bill is not
 * touched; the main game keeps his eight-way rifle, prone, flowers and hit points). Checked
 * against NES Contra:
 *
 * - He walks at 1 px a frame. The jump is a fixed somersault (no hold-to-go-higher) with a
 *   small, round hit box; in the air he steers at walking pace (no momentum), as in Contra.
 * - Aim: standing, left/right, straight up (UP) and the up-diagonals (UP with a direction, which
 *   also runs); running with DOWN held aims at the down-diagonals; DOWN alone lies prone and
 *   shoots low along the floor; in the air all eight directions.
 * - Every grass ledge and bridge is a one-way floor: he jumps up through it, and DOWN + JUMP
 *   drops through it (not through the bank or the base floor).
 * - In the river he wades with only his head and gun above water: no jumping; he shoots ahead,
 *   up and up-diagonally; DOWN ducks under the surface, where no bullet reaches him (and he
 *   cannot shoot). Walking into a bank climbs out.
 * - One hit kills him: the Contra death flip (thrown up and back, spinning, then flat on his
 *   back), then he drops in from the top of the screen at the current scroll with about two
 *   seconds of blinking invulnerability, back to the default gun.
 */

/** Walking speed and air steering (px/f). */
export const WALK = 1;
/** Somersault takeoff speed (px/f) and gravity (px/f²): a 40-px apex, 40 frames in the air. */
export const JUMP_V = 4;
export const GRAVITY = 0.2;
export const MAX_FALL = 4;
/** How far under the surface his feet are while he wades (px). */
export const WADE_DEPTH = 14;
/** Frames climbing out onto a bank. */
export const CLIMB_FRAMES = 10;
/** The death flip: the knock (px/f), frames until the next life drops in. */
export const DEATH_VY = 3.5;
export const DEATH_FRAMES = 110;
/** Blinking invulnerability after dropping in (frames): about two seconds. */
export const RESPAWN_INVULN = 128;
/** The drop-in's x from the screen's left edge (px), as Contra's. */
export const RESPAWN_X = 48;
/** The barrier's (B) frames. */
export const BARRIER_FRAMES = 960;

export type GunId = 'default' | 'M' | 'S' | 'L' | 'F';

export interface Gun {
  id: GunId;
  /** Spoken name. */
  name: string;
  /** The FIRE button's caption with this gun. */
  label: string;
  /** Shot speed (px/f), before the rapid (R) upgrade. */
  speed: number;
  /** Shots on screen at once. */
  maxOut: number;
  /** Holding FIRE keeps firing every `auto` frames (0: one shot a press). */
  auto: number;
  /** Least frames between presses that fire. */
  gap: number;
  damage: number;
}

export const GUNS: Readonly<Record<GunId, Gun>> = {
  default: {
    id: 'default',
    name: 'default gun',
    label: 'FIRE',
    speed: 3,
    maxOut: 4,
    auto: 0,
    gap: 8,
    damage: 1,
  },
  M: { id: 'M', name: 'machine gun', label: 'M-GUN', speed: 3.5, maxOut: 6, auto: 8, gap: 8, damage: 1 },
  S: { id: 'S', name: 'spread gun', label: 'SPREAD', speed: 3, maxOut: 10, auto: 0, gap: 10, damage: 1 },
  L: { id: 'L', name: 'laser', label: 'LASER', speed: 6, maxOut: 1, auto: 0, gap: 10, damage: 3 },
  F: { id: 'F', name: 'fire gun', label: 'FIREBALL', speed: 2.5, maxOut: 4, auto: 0, gap: 10, damage: 2 },
};
/** The rapid (R) upgrade: shots this much faster, auto fire and presses a little quicker. */
export const RAPID_SPEED = 1.5;
export const RAPID_GAP = 2;
/** The spread gun's five shots, in degrees off the aim. */
export const SPREAD_DEG = [0, -15, 15, -30, 30] as const;

export type BillState = 'ground' | 'air' | 'water' | 'climb' | 'dead' | 'gone';

/** One of Bill's shots. */
export interface Shot {
  gun: GunId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  /** Half its size (px). */
  r: number;
  t: number;
  alive: boolean;
  /** The fire gun's corkscrew: the line it travels along. */
  bx: number;
  by: number;
}

/** A unit aim direction. */
export interface Aim {
  x: -1 | 0 | 1;
  y: -1 | 0 | 1;
}

export class Commando {
  x: number;
  /** Feet (px). */
  y: number;
  vx = 0;
  vy = 0;
  facing: -1 | 1 = 1;
  state: BillState = 'air';
  /** Somersaulting (a jump), not just falling. */
  spin = false;
  prone = false;
  /** Under the surface (DOWN in the river). */
  dive = false;
  /** Running (on the ground, moving). */
  running = false;
  /** The floor top (px) he is dropping through, ignored until he is below it. */
  dropFrom: number | null = null;
  gun: GunId = 'default';
  rapid = false;
  barrier = 0;
  invuln = 0;
  aim: Aim = { x: 1, y: 0 };
  /** Frames since the last shot (the press gap), and the auto-fire countdown. */
  sinceShot = 99;
  autoT = 0;
  /** Frames left showing the shooting pose. */
  shootPose = 0;
  deathT = 0;
  climbT = 0;
  /** Frames alive in this life (sprite timing). */
  t = 0;
  /** Deaths this round. */
  deaths = 0;
  /** The walk cycle. */
  walkT = 0;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  get alive(): boolean {
    return this.state !== 'dead' && this.state !== 'gone';
  }

  /** Bullets and foes can't touch him: dead, diving, blinking after a drop-in, or the barrier. */
  get untouchable(): boolean {
    return !this.alive || this.dive || this.invuln > 0 || this.barrier > 0;
  }

  /** Where he can be hit (px), or null (dead or under water). */
  hitBox(): Box | null {
    const x = this.x;
    const y = this.y;
    switch (this.state) {
      case 'dead':
      case 'gone':
        return null;
      case 'water':
        return this.dive ? null : { x: x - 5, y: WATER_Y - 9, w: 10, h: 9 };
      case 'air':
        // The somersault's small round box (Contra's jump dodges what a stand would take).
        return this.spin ? { x: x - 6, y: y - 18, w: 12, h: 14 } : { x: x - 5, y: y - 24, w: 10, h: 24 };
      default:
        return this.prone ? { x: x - 11, y: y - 8, w: 22, h: 8 } : { x: x - 5, y: y - 24, w: 10, h: 24 };
    }
  }

  /** What touches pickups (any of him above water). */
  touchBox(): Box | null {
    if (!this.alive || this.dive) return null;
    return this.hitBox() ?? null;
  }

  update(input: InputFrame, j: Jungle): void {
    this.t++;
    if (this.invuln > 0) this.invuln--;
    if (this.barrier > 0) this.barrier--;
    if (this.shootPose > 0) this.shootPose--;
    this.sinceShot++;
    if (this.autoT > 0) this.autoT--;
    if (this.state === 'dead') return this.deathFlip(j);
    if (this.state === 'gone') return;
    const dir = input.dirX;
    const up = input.held('up');
    const down = input.held('down');
    if (dir !== 0) this.facing = dir;
    this.running = false;
    switch (this.state) {
      case 'ground':
        this.groundMove(input, j, dir, up, down);
        break;
      case 'air':
        this.airMove(j, dir);
        break;
      case 'water':
        this.wade(j, dir, down);
        break;
      case 'climb':
        if (--this.climbT <= 0) {
          this.state = 'ground';
          this.y = WATER_Y;
        }
        break;
    }
    this.clampToScreen(j);
    if (this.alive) {
      this.aim = this.aimFor(dir, up, down);
      this.trigger(input, j);
    }
  }

  /** Contra's aim rules for the state he is in (see the file comment). */
  aimFor(dir: -1 | 0 | 1, up: boolean, down: boolean): Aim {
    const f = this.facing;
    switch (this.state) {
      case 'air':
        if (dir === 0 && !up && !down) return { x: f, y: 0 };
        return { x: dir, y: up ? -1 : down ? 1 : 0 };
      case 'water':
        if (up) return { x: dir, y: -1 };
        return { x: f, y: 0 };
      default:
        if (this.prone) return { x: f, y: 0 };
        if (up) return { x: dir, y: -1 };
        if (down && dir !== 0) return { x: dir, y: 1 };
        return { x: f, y: 0 };
    }
  }

  private groundMove(input: InputFrame, j: Jungle, dir: -1 | 0 | 1, up: boolean, down: boolean): void {
    this.prone = down && dir === 0 && !up;
    if (input.pressed('jump')) {
      input.consumeJumpBuffer();
      const kind = j.floorKindAt(this.x, this.y);
      if (down && (kind === C.LEDGE || kind === C.BRIDGE) && j.floorBelow(this.x, this.y) !== null) {
        // Drop through the ledge.
        this.dropFrom = this.y;
        this.prone = false;
        this.state = 'air';
        this.spin = false;
        this.vy = 1;
        this.y += 1;
        return;
      }
      this.prone = false;
      this.state = 'air';
      this.spin = true;
      this.vy = -JUMP_V;
      this.dropFrom = null;
      j.sound('jump');
      this.airMove(j, dir);
      return;
    }
    this.vx = this.prone ? 0 : dir * WALK;
    this.x += this.vx;
    if (this.vx !== 0) {
      this.running = true;
      this.walkT++;
    } else this.walkT = 0;
    if (j.floorKindAt(this.x, this.y) === null) {
      // Walked off the edge: he falls straight on (no somersault).
      this.prone = false;
      this.state = 'air';
      this.spin = false;
      this.vy = 0;
    }
  }

  private airMove(j: Jungle, dir: -1 | 0 | 1): void {
    this.vx = dir * WALK;
    this.x += this.vx;
    const prev = this.y;
    this.vy = Math.min(MAX_FALL, this.vy + GRAVITY);
    this.y += this.vy;
    if (this.vy <= 0) return;
    if (this.dropFrom !== null && prev > this.dropFrom + 2) this.dropFrom = null;
    const floor = j.floorBetween(this.x, prev, this.y, this.dropFrom);
    if (floor !== null) {
      this.y = floor;
      this.vy = 0;
      this.state = 'ground';
      this.spin = false;
      this.dropFrom = null;
      return;
    }
    if (this.y >= WATER_Y && prev <= WATER_Y + WADE_DEPTH && j.waterAt(this.x)) {
      this.state = 'water';
      this.spin = false;
      this.dropFrom = null;
      this.y = WATER_Y + WADE_DEPTH;
      this.vy = 0;
      j.sound('splash');
    }
  }

  private wade(j: Jungle, dir: -1 | 0 | 1, down: boolean): void {
    this.dive = down;
    this.prone = false;
    if (this.dive || dir === 0) return;
    const ahead = this.x + dir * 6;
    if (!j.waterAt(ahead)) {
      // A bank: climb out if its top is within reach of the surface, else it stops him.
      const top =
        j.floorKindAt(ahead, WATER_Y) !== null
          ? WATER_Y
          : j.floorKindAt(ahead, WATER_Y - 16) !== null
            ? WATER_Y - 16
            : null;
      if (top === null) return;
      this.state = 'climb';
      this.climbT = CLIMB_FRAMES;
      this.x = ahead + dir * 2;
      this.y = top;
      if (top !== WATER_Y) this.climbT = CLIMB_FRAMES + 4;
      return;
    }
    this.x += dir * WALK;
    this.running = true;
    this.walkT++;
  }

  private clampToScreen(j: Jungle): void {
    const lo = j.camX + 6;
    const hi = Math.min(j.camX + 250, j.rightWall());
    if (this.x < lo) this.x = lo;
    if (this.x > hi) this.x = hi;
  }

  /** FIRE: a press fires (after the press gap); the machine gun keeps firing while it is held. */
  private trigger(input: InputFrame, j: Jungle): void {
    if (this.state === 'climb' || this.dive) return;
    const gun = GUNS[this.gun];
    const gap = this.rapid ? gun.gap - RAPID_GAP : gun.gap;
    let fire = input.pressed('attack') && this.sinceShot >= gap;
    if (!fire && gun.auto > 0 && input.held('attack') && this.autoT === 0) fire = true;
    if (!fire) return;
    if (this.fire(j)) {
      this.sinceShot = 0;
      if (gun.auto > 0) this.autoT = this.rapid ? gun.auto - 3 : gun.auto;
    }
  }

  /** Where the muzzle would be for `aim` (px; the bot's judgement), or for the current aim. */
  muzzle(aim: Aim = this.aim, prone = this.prone): { x: number; y: number } {
    const a = aim;
    if (prone && this.state === 'ground') return { x: this.x + (a.x || this.facing) * 14, y: this.y - 5 };
    const x = this.x;
    const y = this.y;
    if (this.state === 'water') {
      if (a.y < 0 && a.x === 0) return { x: x + this.facing * 2, y: WATER_Y - 22 };
      if (a.y < 0) return { x: x + a.x * 9, y: WATER_Y - 16 };
      return { x: x + a.x * 11, y: WATER_Y - 5 };
    }
    if (this.state === 'air') {
      const cy = this.spin ? y - 11 : y - 16;
      return { x: x + a.x * 8, y: cy + a.y * 8 };
    }
    if (a.y < 0 && a.x === 0) return { x: x + this.facing * 3, y: y - 34 };
    if (a.y < 0) return { x: x + a.x * 10, y: y - 28 };
    if (a.y > 0) return { x: x + a.x * 10, y: y - 10 };
    return { x: x + a.x * 11, y: y - 18 };
  }

  /** Fires the gun along the aim; false when too many shots are out. */
  fire(j: Jungle): boolean {
    const gun = GUNS[this.gun];
    const out = j.shots.filter((s) => s.alive).length;
    if (this.gun === 'L') {
      // The laser: a new beam replaces the one out (Contra's).
      for (const s of j.shots) s.alive = false;
    } else if (out + (this.gun === 'S' ? SPREAD_DEG.length : 1) > gun.maxOut) return false;
    const m = this.muzzle();
    const a = this.aim;
    const base = Math.atan2(a.y, a.x);
    const speed = gun.speed * (this.rapid ? RAPID_SPEED : 1);
    const angles = this.gun === 'S' ? SPREAD_DEG.map((d) => base + (d * Math.PI) / 180) : [base];
    for (const ang of angles) {
      const vx = Math.cos(ang) * speed;
      const vy = Math.sin(ang) * speed;
      const r = this.gun === 'S' ? 3 : this.gun === 'F' ? 4 : this.gun === 'L' ? 4 : 2;
      j.shots.push({
        gun: this.gun,
        x: m.x,
        y: m.y,
        vx,
        vy,
        damage: gun.damage,
        r,
        t: 0,
        alive: true,
        bx: m.x,
        by: m.y,
      });
    }
    j.sound(this.gun === 'S' ? 'spread' : this.gun === 'L' ? 'laser' : this.gun === 'F' ? 'fire' : 'shot');
    this.shootPose = 10;
    return true;
  }

  /** A hit: the death flip starts, and the weapon is lost (back to the default gun). */
  kill(j: Jungle): void {
    if (!this.alive) return;
    this.state = 'dead';
    this.deathT = 0;
    this.deaths++;
    this.vy = -DEATH_VY;
    this.vx = -this.facing * 1;
    this.prone = false;
    this.dive = false;
    this.spin = false;
    this.dropFrom = null;
    this.gun = 'default';
    this.rapid = false;
    this.barrier = 0;
    this.invuln = 0;
    if (this.y > WATER_Y) this.y = WATER_Y;
    j.sound('death');
  }

  /** Thrown up and back, spinning, then flat on his back until the next life. */
  private deathFlip(j: Jungle): void {
    this.deathT++;
    if (this.vy !== 0 || this.deathT < 4) {
      const prev = this.y;
      this.x += this.vx;
      if (this.x < j.camX + 4) this.x = j.camX + 4;
      this.vy = Math.min(MAX_FALL, this.vy + GRAVITY);
      this.y += this.vy;
      if (this.vy > 0) {
        const floor = j.floorBetween(this.x, prev, this.y, null);
        if (floor !== null || this.y >= WATER_Y) {
          this.y = floor ?? WATER_Y;
          this.vy = 0;
          this.vx = 0;
        }
      }
    }
    if (this.deathT >= DEATH_FRAMES) this.state = 'gone';
  }

  /** The next life drops in from the top of the screen at the current scroll. */
  respawn(j: Jungle): void {
    this.state = 'air';
    this.spin = false;
    this.x = j.camX + RESPAWN_X;
    this.y = -4;
    this.vx = 0;
    this.vy = 0;
    this.facing = 1;
    this.invuln = RESPAWN_INVULN;
    this.t = 0;
    this.dropFrom = null;
  }

  /** Landed on his back (the last frame of the flip). */
  get flat(): boolean {
    return this.state === 'dead' && this.vy === 0 && this.deathT >= 4;
  }
}
