import type { InputFrame } from '@engine/input/input-manager';
import { Rng } from '@engine/rng';
import type { ContraSound } from './art';
import {
  BREACH_BOOMS,
  BREACH_FRAMES,
  DefenseWall,
  Heart,
  Pod,
  WallCannon,
  WallCore,
  WallSniper,
  WIN_BOOM_FRAMES,
  WIN_BOOMS,
} from './boss';
import { BARRIER_FRAMES, Commando, type Shot } from './commando';
import {
  BlastBridge,
  Boom,
  BULLET_SPEED,
  Cannon,
  Capsule,
  overlaps,
  Pillbox,
  Rifleman,
  Soldier,
  type Thing,
  WallGun,
} from './foes';
import {
  BASE_Y,
  C,
  COLS,
  jungleStage,
  LAIR_CAM,
  ROWS,
  START,
  TILE,
  WALL_CAM,
  WALL_X,
  WATER_Y,
  type JungleStage,
  type SoldierZone,
  type WeaponId,
} from './stage';

/** A box in stage px. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Where the round is: the stage, the defense wall fight (the camera locked), its breach, the
 * walk on through the broken wall, Red Falcon's lair (the camera locked again), won (the
 * explosion chain), or lost (no lives left).
 */
export type JunglePhase = 'stage' | 'wall' | 'breach' | 'walk' | 'lair' | 'won' | 'lost';

export type JungleEvent =
  | { type: 'sound'; sound: ContraSound }
  | { type: 'phase'; phase: JunglePhase }
  | { type: 'weapon'; weapon: WeaponId }
  /** Bill was hit; `rest`: lives in reserve before this one is spent. */
  | { type: 'died'; rest: number }
  | { type: 'respawn' };

/** An enemy bullet, or a wall cannon's shell (it falls). */
export interface FoeShot {
  kind: 'bullet' | 'shell';
  x: number;
  y: number;
  vx: number;
  vy: number;
  g: number;
  alive: boolean;
}
/** An enemy bullet's half size (px). */
export const FOE_SHOT_R = 2;

export interface JungleOptions {
  seed?: number;
  /** Lives (3, or 30 with the Konami code). */
  lives?: number;
  /** The No damage assist (read each frame). */
  noDamage?: () => boolean;
  /** The Infinite lives assist (read each frame). */
  infiniteLives?: () => boolean;
}

/** The lair's back wall, before Red Falcon's heart (px): Bill goes no further. */
export const LAIR_BACK = LAIR_CAM + 166;
/** The camera's speed (px/f) into the lair once Bill is through the broken wall. */
export const LAIR_SCROLL = 2;

/** How far past the screen's right edge (px) a fixed foe is placed in. */
export const SPAWN_AHEAD = 40;

/** Most soldiers running at once. */
export const MAX_SOLDIERS = 3;
/** The camera follows Bill once he is this far into the screen (px). */
export const SCROLL_AT = 120;

/**
 * Jungle Assault's simulation (no drawing, no audio: it reports events for the scene): the
 * stage's cells (bridges blow up), Bill, his shots, the foes and theirs, the right-only camera,
 * the soldier spawns, the boss and the lives. Deterministic for a seed.
 */
export class Jungle {
  readonly stage: JungleStage = jungleStage();
  readonly cells: Uint8Array;
  readonly rng: Rng;
  readonly bill: Commando;
  things: Thing[] = [];
  shots: Shot[] = [];
  foeShots: FoeShot[] = [];
  events: JungleEvent[] = [];
  camX = 0;
  camMax = WALL_CAM;
  /** Frames of play, and in the current phase. */
  t = 0;
  phase: JunglePhase = 'stage';
  phaseT = 0;
  /** Lives in reserve (Contra's REST: the medals). */
  rest: number;
  /** What last hit Bill (tests and tuning). */
  lastHit = '';
  readonly wall = new DefenseWall();
  readonly core = new WallCore();
  readonly cannons = [new WallCannon(0), new WallCannon(1)] as const;
  readonly sniper = new WallSniper();
  readonly heart = new Heart();
  readonly pods = [new Pod(LAIR_CAM + 40, 0), new Pod(LAIR_CAM + 96, 1)] as const;
  /** Where running soldiers come in (the stage's zones; tests may clear it). */
  readonly zones: SoldierZone[];
  private nextFoe = 0;
  private nextCapsule = 0;
  private readonly zoneT: number[];
  private soldiersSent = 0;
  private readonly noDamage: () => boolean;
  private readonly infiniteLives: () => boolean;

  constructor(opts: JungleOptions = {}) {
    this.cells = new Uint8Array(this.stage.cells);
    this.rng = new Rng((opts.seed ?? 1) * 7919 + 13);
    this.rest = Math.max(0, (opts.lives ?? 3) - 1);
    this.noDamage = opts.noDamage ?? (() => false);
    this.infiniteLives = opts.infiniteLives ?? (() => false);
    // Bill drops in from the top of the screen, as at the start of a Contra stage.
    this.bill = new Commando(START.x, -4);
    this.zones = [...this.stage.zones];
    this.zoneT = this.zones.map((z) => 60 + this.rng.int(z.every >> 1));
    for (const b of this.stage.bridges) this.things.push(new BlastBridge(b.col, b.len, b.row));
    this.things.push(this.wall, this.core, ...this.cannons, this.sniper, this.heart, ...this.pods);
  }

  /* ---------- The map ---------- */

  cell(col: number, row: number): number {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return C.AIR;
    return this.cells[row * COLS + col] as number;
  }
  setCell(col: number, row: number, c: number): void {
    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) this.cells[row * COLS + col] = c;
  }
  static isFloor(c: number): boolean {
    return c === C.LEDGE || c === C.BRIDGE || c === C.BASE || c === C.LAIR_FLOOR;
  }
  /** The kind of floor whose top is exactly at `y` under x (px), or null. */
  floorKindAt(x: number, y: number): number | null {
    if (y % TILE !== 0) return null;
    const c = this.cell(Math.floor(x / TILE), y / TILE);
    return Jungle.isFloor(c) ? c : null;
  }
  /** The first floor top (px) under x with `from` <= top <= `to`, skipping `skip`; or null. */
  floorBetween(x: number, from: number, to: number, skip: number | null): number | null {
    const col = Math.floor(x / TILE);
    const r0 = Math.max(0, Math.ceil(from / TILE));
    const r1 = Math.min(ROWS - 1, Math.floor(to / TILE));
    for (let r = r0; r <= r1; r++) {
      const top = r * TILE;
      if (top === skip) continue;
      if (Jungle.isFloor(this.cell(col, r))) return top;
    }
    return null;
  }
  /** Something to land on under (x, y): a floor or the river (dropping through is safe). */
  floorBelow(x: number, y: number): number | null {
    const f = this.floorBetween(x, y + 1, ROWS * TILE, null);
    if (f !== null) return f;
    return this.waterAt(x) && y < WATER_Y ? WATER_Y : null;
  }
  /** The river runs under x (px). */
  waterAt(x: number): boolean {
    return this.cell(Math.floor(x / TILE), WATER_Y / TILE) === C.WATER;
  }
  /** Floor tops (px) in a column, top down (soldiers' spawn spots, the bot). */
  floorsAt(x: number): number[] {
    const col = Math.floor(x / TILE);
    const out: number[] = [];
    for (let r = 0; r < ROWS; r++) if (Jungle.isFloor(this.cell(col, r))) out.push(r * TILE);
    return out;
  }
  /** How far right Bill may go: the defense wall's face while it stands, then the lair's back wall. */
  rightWall(): number {
    return this.wall.broken ? LAIR_BACK : WALL_X - 8;
  }

  /* ---------- Hooks for the pieces ---------- */

  sound(s: ContraSound): void {
    this.events.push({ type: 'sound', sound: s });
  }
  spawn(t: Thing): void {
    this.things.push(t);
  }
  boom(x: number, y: number, big: boolean): void {
    this.things.push(new Boom(x, y, big));
    this.sound('boom');
  }
  count(kind: string): number {
    let n = 0;
    for (const t of this.things) if (t.alive && t.kind === kind) n++;
    return n;
  }
  foeShot(x: number, y: number, vx: number, vy: number, g = 0, kind: FoeShot['kind'] = 'bullet'): void {
    this.foeShots.push({ kind, x, y, vx, vy, g, alive: true });
  }
  /**
   * A bullet from (x, y) at Bill's middle, its direction rounded to one of `dirs` (8: Contra's
   * riflemen; 0: exact).
   */
  aimedShot(x: number, y: number, dirs: number): void {
    const b = this.bill;
    const ty = b.state === 'water' ? WATER_Y - 4 : b.y - (b.prone ? 4 : b.spin ? 11 : 14);
    let a = Math.atan2(ty - y, b.x - x);
    if (dirs > 0) {
      const step = (2 * Math.PI) / dirs;
      a = Math.round(a / step) * step;
    }
    this.foeShot(x, y, Math.cos(a) * BULLET_SPEED, Math.sin(a) * BULLET_SPEED);
  }
  /** A falcon taken: M S L F replace the gun; R speeds it up; B is the barrier. */
  giveWeapon(w: WeaponId): void {
    const b = this.bill;
    if (w === 'R') b.rapid = true;
    else if (w === 'B') b.barrier = BARRIER_FRAMES;
    else b.gun = w;
    this.sound(w === 'B' ? 'barrier' : 'falcon');
    this.events.push({ type: 'weapon', weapon: w });
  }
  /** The core is destroyed: the wall blows apart. */
  breach(): void {
    // (a long shot can reach the core before the camera has locked on the wall)
    if (this.phase !== 'wall' && this.phase !== 'stage') return;
    this.setPhase('breach');
    this.foeShots = [];
    for (const t of this.things) if (t.kind === 'soldier') t.alive = false;
  }
  /** Red Falcon's heart bursts. */
  heartDown(): void {
    if (this.phase !== 'lair') return;
    this.setPhase('won');
    for (const t of this.things) if (t instanceof Pod || t.kind === 'larva') t.alive = false;
    this.foeShots = [];
  }

  private setPhase(p: JunglePhase): void {
    this.phase = p;
    this.phaseT = 0;
    this.events.push({ type: 'phase', phase: p });
  }

  /* ---------- A frame ---------- */

  update(input: InputFrame): void {
    if (this.phase === 'lost') return;
    this.t++;
    this.phaseT++;
    const bill = this.bill;
    if (this.phase !== 'won') bill.update(input, this);
    if (bill.state === 'gone') this.nextLife();
    this.scroll();
    this.spawnPlaced();
    this.spawnSoldiers();
    for (const t of this.things) if (t.alive) t.update(this);
    this.moveShots();
    this.moveFoeShots();
    this.harm();
    this.advance();
    this.things = this.things.filter((t) => t.alive && (t.pinned || t.x > this.camX - 48));
    this.shots = this.shots.filter((s) => s.alive);
    this.foeShots = this.foeShots.filter((s) => s.alive);
  }

  /** After the death flip: the next life drops in, or the round is lost. */
  private nextLife(): void {
    if (this.infiniteLives()) {
      this.bill.respawn(this);
      this.events.push({ type: 'respawn' });
    } else if (this.rest > 0) {
      this.rest--;
      this.bill.respawn(this);
      this.events.push({ type: 'respawn' });
    } else if (this.phase !== 'won') this.setPhase('lost');
  }

  /** The camera scrolls right only, following Bill, up to the lock of the current part. */
  private scroll(): void {
    const b = this.bill;
    if (this.phase === 'walk' && b.x > WALL_X + 40) this.camX = Math.min(LAIR_CAM, this.camX + LAIR_SCROLL);
    if (!b.alive) return;
    const want = Math.min(this.camMax, b.x - SCROLL_AT);
    if (want > this.camX) this.camX = want;
  }

  /**
   * Fixed foes come in just past the screen's right edge as it scrolls to them; capsules have a
   * queue of their own (each flies in from the left once Bill passes its x), so one waiting for
   * Bill never holds up the foes behind it.
   */
  private spawnPlaced(): void {
    const foes = this.stage.placed.filter((p) => p.type !== 'capsule');
    while (this.nextFoe < foes.length) {
      const p = foes[this.nextFoe] as (typeof foes)[number];
      if (p.x > this.camX + 256 + SPAWN_AHEAD) break;
      if (p.type === 'rifleman') this.spawn(new Rifleman(p.x, p.y, !!p.bush));
      else if (p.type === 'wall-gun') this.spawn(new WallGun(p.x, p.y));
      else if (p.type === 'cannon') this.spawn(new Cannon(p.x, p.y));
      else if (p.type === 'pillbox') this.spawn(new Pillbox(p.x, p.y, p.weapon));
      this.nextFoe++;
    }
    const caps = this.stage.placed.filter((p) => p.type === 'capsule');
    while (this.nextCapsule < caps.length) {
      const p = caps[this.nextCapsule] as (typeof caps)[number];
      if (this.bill.x < p.x || !this.bill.alive || p.type !== 'capsule') break;
      this.spawn(new Capsule(this.camX - 12, p.y, p.weapon));
      this.nextCapsule++;
    }
  }

  /** Running soldiers come in from the screen's edge (mostly the right) while Bill is in a zone. */
  private spawnSoldiers(): void {
    if (this.phase !== 'stage' || !this.bill.alive) return;
    const col = Math.floor(this.bill.x / TILE);
    this.zones.forEach((z, i) => {
      if (col < z.x0 || col >= z.x1) return;
      const left = (this.zoneT[i] as number) - 1;
      this.zoneT[i] = left;
      if (left > 0) return;
      this.zoneT[i] = Math.round(z.every * (0.75 + this.rng.float() * 0.5));
      if (this.count('soldier') >= MAX_SOLDIERS) return;
      this.soldiersSent++;
      const fromLeft = z.left > 0 && this.soldiersSent % z.left === 0;
      const x = fromLeft ? this.camX - 8 : this.camX + 264;
      const floors = this.floorsAt(x).filter(
        (y) => y < WATER_Y || this.cell(Math.floor(x / TILE), y / TILE) !== C.WATER,
      );
      if (!floors.length) return;
      // On the tier nearest Bill's (a coin toss between two as near).
      floors.sort((a, b) => Math.abs(a - this.bill.y) - Math.abs(b - this.bill.y));
      let y = floors[0] as number;
      const second = floors[1];
      if (
        second !== undefined &&
        Math.abs(second - this.bill.y) === Math.abs(y - this.bill.y) &&
        this.rng.chance(0.5)
      )
        y = second;
      this.spawn(new Soldier(x, y, fromLeft ? 1 : -1));
    });
  }

  private moveShots(): void {
    for (const s of this.shots) {
      if (!s.alive) continue;
      s.t++;
      if (s.gun === 'F') {
        // The fire gun's corkscrew: it loops round the line it travels along.
        s.bx += s.vx;
        s.by += s.vy;
        const ang = s.t * 0.35;
        s.x = s.bx + Math.cos(ang) * 7 - 7 * Math.sign(s.vx || 1);
        s.y = s.by + Math.sin(ang) * 7;
      } else {
        s.x += s.vx;
        s.y += s.vy;
      }
      if (s.x < this.camX - 12 || s.x > this.camX + 268 || s.y < -16 || s.y > 256) {
        s.alive = false;
        continue;
      }
      const sb: Box = { x: s.x - s.r, y: s.y - s.r, w: s.r * 2, h: s.r * 2 };
      let hitIt = false;
      for (const pass of [false, true]) {
        for (const t of this.things) {
          if (!t.alive || t.shield !== pass) continue;
          const hb = t.hurtBox();
          if (!hb || !overlaps(sb, hb)) continue;
          t.hit(s.damage, this);
          s.alive = false;
          hitIt = true;
          break;
        }
        if (hitIt) break;
      }
    }
  }

  private moveFoeShots(): void {
    for (const s of this.foeShots) {
      s.vy += s.g;
      s.x += s.vx;
      s.y += s.vy;
      if (s.kind === 'shell' && s.y >= BASE_Y - 2) {
        s.alive = false;
        this.things.push(new Boom(s.x, BASE_Y - 6, false));
      }
      if (s.x < this.camX - 8 || s.x > this.camX + 264 || s.y < -8 || s.y > 248) s.alive = false;
    }
  }

  /** Bullets and foes that touch Bill kill him (unless he can't be touched); the barrier kills the frail. */
  private harm(): void {
    const b = this.bill;
    const box = b.hitBox();
    if (!box) return;
    if (b.barrier > 0)
      for (const t of this.things) {
        const hb = t.alive && t.frail ? t.harmBox() : null;
        if (hb && overlaps(box, hb)) t.hit(99, this);
      }
    if (b.untouchable || this.noDamage()) return;
    for (const s of this.foeShots) {
      const r = s.kind === 'shell' ? 3 : FOE_SHOT_R;
      if (s.alive && overlaps(box, { x: s.x - r, y: s.y - r, w: r * 2, h: r * 2 })) {
        s.alive = false;
        return this.hitBill(s.kind);
      }
    }
    for (const t of this.things) {
      const hb = t.alive ? t.harmBox() : null;
      if (hb && overlaps(box, hb)) return this.hitBill(t.kind);
    }
  }

  private hitBill(what: string): void {
    this.lastHit = what;
    this.events.push({ type: 'died', rest: this.rest });
    this.bill.kill(this);
  }

  /** The boss's phases. */
  private advance(): void {
    switch (this.phase) {
      case 'stage':
        if (this.camX >= WALL_CAM) {
          this.setPhase('wall');
          for (const t of this.things) if (t.kind === 'soldier') t.alive = false;
        }
        return;
      case 'breach': {
        const bm = BREACH_BOOMS.find(([f]) => f === this.phaseT - 1);
        if (bm) this.boom(WALL_X + bm[1], bm[2], true);
        // The cannons and the sniper go down with the wall.
        if (this.phaseT === 1) for (const c of [...this.cannons, this.sniper]) c.alive = false;
        if (this.phaseT >= BREACH_FRAMES) {
          this.wall.broken = true;
          this.camMax = LAIR_CAM;
          this.setPhase('walk');
        }
        return;
      }
      case 'walk':
        if (this.camX >= LAIR_CAM && this.bill.alive) this.setPhase('lair');
        return;
      case 'won': {
        const bm = WIN_BOOMS.find(([f]) => f === this.phaseT - 1);
        if (bm) this.boom(LAIR_CAM + bm[1], bm[2], true);
        return;
      }
    }
  }

  /** The win's explosion chain has run its course. */
  get chainDone(): boolean {
    return this.phase === 'won' && this.phaseT >= WIN_BOOM_FRAMES;
  }
}
