import type { Action } from '@engine/input/actions';
import { px, tileAt, toPx } from '@engine/math/units';
import { Rng } from '@engine/rng';
import { Enemy } from '../../entities/enemies/enemy';
import type { World } from '../../world/world';
import { DarkMegaMan } from './dark-megaman';
import { EnemyShot, Turret, WeaponCapsule } from './robots';
import type { StationScene } from './scene';

/*
 * A player for Station Escape, for tests and difficulty tuning (docs/HEROES.md): it walks the
 * stage right, jumps pits and walls, shoots what is ahead, takes the capsule, and in the boss room
 * keeps its distance, jumps his shots and fires (the Saw Disc while it has energy). With
 * `CautiousOptions` it plays like a careful first-timer: it sees the robots and shots `reaction`
 * frames late, misjudges where they are by up to `error` px, now and then stops for a moment, and
 * jumps a little early or late.
 */

export interface CautiousOptions {
  /** Frames between something happening and the bot seeing it. */
  reaction: number;
  /** Most px by which it misjudges a robot's or shot's position. */
  error: number;
  /** Chance a frame starts a pause (it lets go of everything for 10-30 frames). */
  pause: number;
  seed: number;
}

/** A sharp player: sees everything at once, judges exactly, never pauses. */
export const SHARP: CautiousOptions = { reaction: 0, error: 0, pause: 0, seed: 1 };
/** A careful first-timer (the human sim). */
export const CAUTIOUS: CautiousOptions = { reaction: 15, error: 6, pause: 0.004, seed: 1 };

interface Seen {
  id: number;
  kind: string;
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  /** Turrets: open (can be hurt). Boss: his state. */
  open: boolean;
  state: string;
}

export class StationBot {
  private readonly opts: CautiousOptions;
  private readonly rng: Rng;
  private readonly history: Seen[][] = [];
  private readonly offsets = new Map<number, { x: number; y: number }>();
  private jumpHold = 0;
  private jumpRest = 0;
  private attackHeld = false;
  private pauseLeft = 0;
  private selectHeld = false;
  private frame = 0;
  private lastShot = 0;

  constructor(opts: Partial<CautiousOptions> = {}) {
    this.opts = { ...SHARP, ...opts };
    this.rng = new Rng(this.opts.seed * 2654435761 + 7);
  }

  /** How this bot misjudges entity `id` (px, fixed per entity). */
  private offset(id: number): { x: number; y: number } {
    let o = this.offsets.get(id);
    if (!o) {
      const e = this.opts.error;
      o = { x: Math.round((this.rng.float() * 2 - 1) * e), y: Math.round((this.rng.float() * 2 - 1) * e) };
      this.offsets.set(id, o);
    }
    return o;
  }

  /** What is around, as the bot judges it now (`reaction` frames late). */
  private look(world: World): Seen[] {
    const now: Seen[] = [];
    for (const e of world.entities) {
      if (!e.alive) continue;
      const enemy = e instanceof Enemy;
      const shot = e instanceof EnemyShot;
      if (!enemy && !shot && !(e instanceof WeaponCapsule)) continue;
      const o = this.offset(e.id);
      now.push({
        id: e.id,
        kind: e.kind,
        x: toPx(e.body.x) + o.x,
        y: toPx(e.body.y) + o.y,
        w: toPx(e.body.w),
        h: toPx(e.body.h),
        vx: e.body.vx,
        open: e instanceof Turret ? e.open : true,
        state: e instanceof DarkMegaMan ? e.state : '',
      });
    }
    this.history.push(now);
    if (this.history.length > this.opts.reaction + 1) this.history.shift();
    return this.history[0] ?? now;
  }

  next(scene: StationScene): Action[] {
    this.frame++;
    const world = scene.world;
    const seen = this.look(world);
    const held: Action[] = [];
    const p = scene.player;
    if (p.dead || (scene.phase !== 'stage' && scene.phase !== 'fight')) {
      this.attackHeld = false;
      this.jumpHold = 0;
      return held;
    }
    if (this.pauseLeft > 0) {
      this.pauseLeft--;
      return held;
    }
    if (this.opts.pause > 0 && p.body.onGround && this.rng.chance(this.opts.pause)) {
      this.pauseLeft = 10 + this.rng.int(21);
      return held;
    }
    const b = p.body;
    const me = { x: toPx(b.x), y: toPx(b.y), w: toPx(b.w), h: toPx(b.h), cx: toPx(p.centerX) };
    let dir: -1 | 0 | 1;
    let wantJump: boolean;
    let shoot: boolean;
    let useWeapon = false;
    let select = false;
    let charge = false;

    if (scene.phase === 'fight') {
      const boss = seen.find((s) => s.kind === 'dark-megaman');
      const shots = seen.filter((s) => s.kind === 'dark-buster' || s.kind === 'dark-charge');
      const r = this.fight(scene, me, boss, shots);
      dir = r.dir;
      wantJump = r.jump;
      shoot = r.shoot;
      useWeapon = r.weapon;
      select = r.select;
      charge = r.charge;
    } else {
      const r = this.walk(world, me, seen, b.onGround);
      dir = r.dir;
      wantJump = r.jump;
      shoot = r.shoot;
    }

    if (dir < 0) held.push('left');
    if (dir > 0) held.push('right');
    // Jumps: press, hold for a full jump, then let go for a frame before the next.
    if (this.jumpHold > 0) {
      this.jumpHold--;
      held.push('jump');
      if (this.jumpHold === 0) this.jumpRest = 2;
    } else if (this.jumpRest > 0) this.jumpRest--;
    else if (wantJump && b.onGround) {
      const late = this.opts.error > 0 ? this.rng.int(3) : 0;
      this.jumpHold = 22 - late;
      held.push('jump');
    }
    if (select) {
      if (!this.selectHeld) held.push('select');
      this.selectHeld = !this.selectHeld;
    } else this.selectHeld = false;
    // The saw: a tap every 10 frames. The buster: taps, three shots out at most (its own limit).
    if (useWeapon && this.frame - this.lastShot >= 10) {
      held.push('special');
      this.lastShot = this.frame;
    }
    if (charge && !useWeapon) {
      // Hold to charge; let go once charged and lined up.
      const t = p.scratch.chargeT ?? 0;
      if (t < 44 || !shoot) {
        held.push('attack');
        this.attackHeld = true;
      } else this.attackHeld = false;
    } else if (shoot && !useWeapon) {
      if (!this.attackHeld && this.frame - this.lastShot >= 6) {
        held.push('attack');
        this.attackHeld = true;
        this.lastShot = this.frame;
      } else this.attackHeld = false;
    } else this.attackHeld = false;
    return held;
  }

  /** The stage: right, over pits and walls, shooting what stands ahead at buster height. */
  private walk(
    world: World,
    me: { x: number; y: number; w: number; h: number; cx: number },
    seen: Seen[],
    onGround: boolean,
  ): { dir: -1 | 0 | 1; jump: boolean; shoot: boolean } {
    let dir: -1 | 0 | 1 = 1;
    let jump = false;
    let shoot = false;
    const feet = me.y + me.h;
    const map = world.map;
    // A pit ahead: no floor under the next few px.
    const aheadX = me.x + me.w + 6;
    const floorRow = tileAt(px(feet) + px(1));
    const floorAhead = map.isSolid(aheadX >> 4, floorRow);
    if (onGround && !floorAhead) {
      // Is it a pit (nothing below) or a step down?
      let solid = false;
      for (let ty = floorRow; ty < 15; ty++) if (map.isSolid(aheadX >> 4, ty)) solid = true;
      if (!solid) jump = true;
    }
    // A wall ahead.
    const wallX = (me.x + me.w + 3) >> 4;
    for (let y = me.y; y < feet; y += 8) if (map.isSolid(wallX, y >> 4)) jump = true;
    // Robots ahead at buster height: stop and shoot, unless it is right on top of us.
    const lineY = me.y + 8;
    for (const s of seen) {
      if (s.kind === 'pellet') {
        const dx = s.x - (me.x + me.w);
        const coming = dx > -8 && dx < 40 && s.vx < 0;
        const level = s.y + s.h > me.y && s.y < feet;
        if (coming && level) jump = true;
        continue;
      }
      if (s.kind === 'capsule' || s.kind === 'dark-megaman') continue;
      const dx = s.x - me.cx;
      const inLine = s.y < lineY + 6 && s.y + s.h > lineY - 2;
      if (dx > -4 && dx < 150 && inLine) {
        shoot = true;
        if (s.kind === 'turret' && !s.open && dx < 120) dir = 0;
        if (s.kind === 'hopper' && dx < 90) dir = 0;
      }
      // Something diving at us: keep moving.
      if (s.kind === 'drone' && Math.abs(dx) < 24 && s.y > me.y - 60) dir = 1;
    }
    return { dir, jump, shoot };
  }

  /** The boss: keep 70-130 px away, face him, jump his shots, fire (the saw while it lasts). */
  private fight(
    scene: StationScene,
    me: { x: number; y: number; w: number; h: number; cx: number },
    boss: Seen | undefined,
    shots: Seen[],
  ): { dir: -1 | 0 | 1; jump: boolean; shoot: boolean; weapon: boolean; select: boolean; charge: boolean } {
    const p = scene.player;
    let dir: -1 | 0 | 1 = 0;
    let jump = false;
    if (!boss) return { dir, jump, shoot: false, weapon: false, select: false, charge: false };
    const bcx = boss.x + boss.w / 2;
    const dx = bcx - me.cx;
    const toward: -1 | 1 = dx < 0 ? -1 : 1;
    const dist = Math.abs(dx);
    const roomL = scene.layout.roomX * 16 + 16;
    const roomR = roomL + 14 * 16 - 16;
    if (dist < 64) {
      const away = -toward as -1 | 1;
      const blocked = away < 0 ? me.x < roomL + 8 : me.x + me.w > roomR - 8;
      if (blocked) {
        dir = toward;
        jump = true; // over him
      } else dir = away;
    } else if (dist > 140) dir = toward;
    // Face him to shoot.
    if (dir === 0 && p.facing !== toward) dir = toward;
    for (const s of shots) {
      const sdx = s.x + s.w / 2 - me.cx;
      const coming = Math.sign(s.vx) === -Math.sign(sdx) && Math.abs(sdx) < 56;
      if (coming && s.y + s.h > me.y && s.y < me.y + me.h) jump = true;
    }
    if (boss.state === 'slide' && dist < 72) jump = true;
    const facing = (dir === 0 ? p.facing : dir) === toward;
    const saw = (p.scratch.weapons ?? 0) >= 1 && (p.scratch.wsaw ?? 28) >= 2;
    const level = boss.y + boss.h > me.y + 4 && boss.y < me.y + me.h - 4;
    const tool = p.scratch.tool ?? 0;
    // Switch to the saw (WEAPON) once it is ours, and fire it straight ahead.
    const select = saw && tool !== 1;
    const weapon = saw && tool === 1 && facing && level;
    // Without the saw: a charge shot from afar (hold SHOOT, let go when lined up), taps up close.
    const charge = !saw && dist > 88;
    return { dir, jump, shoot: facing && level && !saw, weapon, select, charge };
  }
}
