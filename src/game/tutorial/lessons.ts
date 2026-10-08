import { toPx } from '@engine/math/units';
import type { Player } from '../entities/player';
import type { World } from '../world/world';
import { Projectile } from '../entities/projectiles/projectile';
import { Bomb } from '../entities/objects/bomb';
import { RushCoil } from '../entities/objects/rush-coil';
import { activeTool } from '../characters/toolbelt';
import type { HeroTraining, ItemId, RoomGeometry, TrainingChapter, TrainingLesson } from './lessons/common';
import { LUIGI_TRAINING } from './lessons/luigi';
import { LINK_TRAINING } from './lessons/link';
import { MEGAMAN_TRAINING } from './lessons/megaman';
import { SAMUS_TRAINING } from './lessons/samus';
import { SIMON_TRAINING } from './lessons/simon';
import { RYU_TRAINING } from './lessons/ryu';
import { BILL_TRAINING } from './lessons/bill';
import { SOPHIA_TRAINING } from './lessons/sophia';

/*
 * Hero training (docs/HEROES.md): every hero's lessons (lessons/<hero>.ts, sharing
 * lessons/common.ts, re-exported here), and the tracker that watches the player to tick them off.
 */

export * from './lessons/common';
export { LUIGI_HIGH_JUMP_PX, LUIGI_COAST_PX, LUIGI_SLIDE_PX } from './lessons/luigi';
export { SEABED_JUMP_PX } from './lessons/megaman';

/**
 * Watches the room's player and world each frame (`observe`, after the world's update) and
 * counts what the hero did. The room resets it whenever a new lesson comes up, so a lesson is
 * done only by doing it while its prompt shows.
 */
export class MoveStats {
  jumps = 0;
  /** Highest jump since the reset: takeoff feet minus the highest feet (px). */
  maxJumpHeight = 0;
  /** Highest floor stood on (smallest feet y, px). */
  highestStand = Infinity;
  /** Fastest ground speed (velocity units). */
  maxSpeed = 0;
  /** Longest glide on the ground with no direction held (px). */
  maxCoast = 0;
  /** Longest such glide that began faster than walking speed: a stop from a run (px). */
  maxRunCoast = 0;
  /**
   * Longest stop from a run as it would carry on open floor (px): the glide so far plus what its
   * speed still carries. Counted once it has glided GLIDE_SEEN_PX, so a glide the gap or a wall
   * cuts short still shows how far it was going.
   */
  maxRunGlide = 0;
  /** Attacks started (melee swings, shots, throws). */
  attacks = 0;
  crouched = false;
  /** Frames of an attack while crouching (crouch slash, low whip). */
  crouchAttacks = 0;
  slid = false;
  /** Times the tool belt's selection changed. */
  toolCycles = 0;
  clung = false;
  wallJumps = 0;
  /** Projectiles the player launched, by kind; also 'bomb' and 'rush' for placed things. */
  readonly shotKinds = new Set<string>();
  /**
   * Directions the hero fired in, once per firing frame, as 'x,y' signs ('1,0' ahead to the
   * right, '0,-1' straight up): the hero's aim (Bill's scratch aimX/aimY) when it has one, else
   * the first shot's flight. A fan of shots counts once.
   */
  readonly shotDirs = new Set<string>();
  shots = 0;
  /** Shots fired in the air. */
  airShots = 0;
  /** Shots fired straight up. */
  shotsUp = 0;
  bombs = 0;
  /** Character scratch keys seen above zero (ball, spin, upThrust, downThrust, aimUp...). */
  readonly seen = new Set<string>();
  /**
   * How the dummy was hit: the damage kind, and 'shot' plus the projectile's kind, or 'melee'
   * plus the move ('down-thrust', 'up-thrust', 'crouch'), or 'stomp'.
   */
  readonly dummyHits = new Set<string>();
  /** The dummy's shots stopped by the hero's shield. */
  blocked = 0;
  /** Jumps that took off on one side of the gap and landed on the other. */
  gapCrossings = 0;
  /** The hero was in the one-tile tunnel (under its roof). */
  tunnel = false;
  /** Takeoffs upward while curled in Samus's morph ball: bomb jumps. */
  ballJumps = 0;
  /** Belt tools used up ammo or magic (their ids: Link's spells, Simon's stopwatch...). */
  readonly toolUses = new Set<string>();
  /** The belt tool selected when each shot was fired (Samus's 'missile' with it switched in). */
  readonly shotTools = new Set<string>();
  /** The most of the hero's projectiles in flight at once. */
  maxShotsOut = 0;
  /** Highest the feet have been (smallest y, px). */
  topReached = Infinity;
  /** Shots fired while swimming (in water, off the floor). */
  swimShots = 0;
  /** The hero's scratch as of the last frame (hearts, magic...). */
  now: Readonly<Record<string, number>> = {};
  /** Power-ups grabbed in the room (PracticeRoom.placeItem); the grab starts the counting afresh. */
  readonly taken = new Set<ItemId>();

  private wasOnGround = true;
  private wasClinging = false;
  private airborne: { jumped: boolean; feet: number; top: number; x: number } | null = null;
  private coast = 0;
  private coastFast = false;
  private lastTool: number | undefined;
  private lastAttack = 0;
  private lastEntity = 0;
  private lastAmmo: Record<string, number> = {};

  /** `room`: the current room's geometry (the room swaps it when a chapter changes rooms). */
  constructor(public room: RoomGeometry) {}

  /** Start counting afresh (a new lesson). What the player is doing right now carries on. */
  reset(): void {
    this.jumps = 0;
    this.maxJumpHeight = 0;
    this.highestStand = Infinity;
    this.maxSpeed = 0;
    this.maxCoast = 0;
    this.maxRunCoast = 0;
    this.maxRunGlide = 0;
    this.attacks = 0;
    this.crouched = false;
    this.crouchAttacks = 0;
    this.slid = false;
    this.toolCycles = 0;
    this.clung = false;
    this.wallJumps = 0;
    this.shotKinds.clear();
    this.shotDirs.clear();
    this.shots = 0;
    this.airShots = 0;
    this.shotsUp = 0;
    this.bombs = 0;
    this.seen.clear();
    this.dummyHits.clear();
    this.blocked = 0;
    this.gapCrossings = 0;
    this.tunnel = false;
    this.ballJumps = 0;
    this.toolUses.clear();
    this.shotTools.clear();
    this.maxShotsOut = 0;
    this.topReached = Infinity;
    this.swimShots = 0;
    this.taken.clear();
    this.coast = 0;
  }

  /** The hero was put back at the start (fell in the gap): the jump in progress doesn't count. */
  teleported(): void {
    this.airborne = null;
    this.coast = 0;
    this.wasOnGround = false;
  }

  hitDummy(tags: readonly string[]): void {
    for (const t of tags) this.dummyHits.add(t);
  }

  shieldBlock(): void {
    this.blocked++;
  }

  /** Power-up `id` was grabbed: counting starts afresh from here, with the grab noted. */
  grabbed(id: ItemId): void {
    this.reset();
    this.taken.add(id);
  }

  /** One frame of play, after the world's update. */
  observe(p: Player, world: World): void {
    const b = p.body;
    const feet = toPx(b.y + b.h);
    const cx = toPx(b.x + (b.w >> 1));
    // Jumps: a takeoff with upward speed, measured to the landing.
    if (this.wasOnGround && !b.onGround) {
      const jumped = b.vy < 0;
      if (jumped) this.jumps++;
      if (jumped && (p.scratch.ball ?? 0) > 0) this.ballJumps++;
      this.airborne = { jumped, feet, top: feet, x: cx };
    } else if (!b.onGround && this.airborne) {
      this.airborne.top = Math.min(this.airborne.top, feet);
    }
    if (b.onGround) {
      const a = this.airborne;
      if (a?.jumped) {
        this.maxJumpHeight = Math.max(this.maxJumpHeight, a.feet - a.top);
        const { x0, x1 } = this.room.gap;
        if ((a.x < x0 && cx > x1) || (a.x > x1 && cx < x0)) this.gapCrossings++;
      }
      this.airborne = null;
      this.highestStand = Math.min(this.highestStand, feet);
      this.maxSpeed = Math.max(this.maxSpeed, Math.abs(b.vx));
      // Gliding with nothing held: how far it carries.
      if (p.heldDirX === 0 && b.vx !== 0) {
        if (this.coast === 0) this.coastFast = Math.abs(b.vx) > p.profile.maxWalk;
        this.coast += Math.abs(b.vx) / 4096;
        this.maxCoast = Math.max(this.maxCoast, this.coast);
        if (this.coastFast) {
          this.maxRunCoast = Math.max(this.maxRunCoast, this.coast);
          // Where it would stop on open floor: covered so far plus v² / 2·decel still to come.
          const v = Math.abs(b.vx) / 4096;
          const decel = p.profile.releaseDecel / 4096;
          if (this.coast >= GLIDE_SEEN_PX && decel > 0)
            this.maxRunGlide = Math.max(this.maxRunGlide, this.coast + (v * v) / (2 * decel));
        }
      } else this.coast = 0;
    } else this.coast = 0;
    this.wasOnGround = b.onGround;
    this.topReached = Math.min(this.topReached, feet);
    const { x0, x1 } = this.room.tunnel;
    if (x1 > x0 && cx >= x0 && cx <= x1 && toPx(b.y) >= this.room.floorTop - 16) this.tunnel = true;
    // Wall cling and the kick off it.
    if (p.clinging) this.clung = true;
    if (this.wasClinging && !p.clinging && b.vy < 0 && p.clingLock > 0) this.wallJumps++;
    this.wasClinging = p.clinging;
    if (p.crouching) this.crouched = true;
    if (p.sliding > 0) this.slid = true;
    if (p.attackTimer > this.lastAttack) this.attacks++;
    this.lastAttack = p.attackTimer;
    if (p.crouching && p.attackTimer > 0) this.crouchAttacks++;
    for (const [k, v] of Object.entries(p.scratch)) if (v > 0 && !k.startsWith('hit')) this.seen.add(k);
    const tool = p.scratch.tool;
    if (this.lastTool !== undefined && tool !== this.lastTool) this.toolCycles++;
    this.lastTool = tool;
    const belt = p.def.tools?.(p);
    const selected = belt ? activeTool(p, belt)?.id : undefined;
    // Ammo or magic spent: the selected tool was used.
    for (const key of AMMO_KEYS) {
      const v = p.scratch[key];
      const was = this.lastAmmo[key];
      if (v !== undefined && was !== undefined && v < was && selected) this.toolUses.add(selected);
      if (v !== undefined) this.lastAmmo[key] = v;
    }
    this.now = { ...p.scratch };
    // What the hero launched or placed this frame (entity ids only grow).
    let last = this.lastEntity;
    let fired: string | null = null;
    for (const e of world.entities) {
      if (e.id <= this.lastEntity) continue;
      last = Math.max(last, e.id);
      if (e instanceof Projectile && ownedBy(e, p)) {
        this.shots++;
        this.shotKinds.add(e.kind);
        const vx = Math.sign(e.body.vx);
        const vy = Math.sign(e.body.vy);
        fired ??= `${vx},${vy}`;
        if (!b.onGround) this.airShots++;
        if (!b.onGround && p.inWater) this.swimShots++;
        if (selected) this.shotTools.add(selected);
        if (vx === 0 && vy < 0) this.shotsUp++;
      } else if (e instanceof Bomb && e.owner === p) {
        this.bombs++;
        this.shotKinds.add('bomb');
      } else if (e instanceof RushCoil && e.owner === p) this.shotKinds.add('rush');
    }
    this.lastEntity = last;
    let out = 0;
    for (const e of world.entities) {
      if (e instanceof Projectile && e.alive && ownedBy(e, p)) out++;
      else if (e instanceof RushCoil && e.owner === p && e.springing) this.seen.add('rush-bounce');
    }
    this.maxShotsOut = Math.max(this.maxShotsOut, out);
    if (fired !== null) {
      const ax = p.scratch.aimX;
      const ay = p.scratch.aimY;
      this.shotDirs.add(ax !== undefined && ay !== undefined ? `${ax},${ay}` : fired);
    }
  }

  /** Directions fired in that were aimed up or down (not straight ahead). */
  get aimedDirs(): number {
    return [...this.shotDirs].filter((d) => !d.endsWith(',0')).length;
  }
}

/** A projectile the player launched, or one left by it (holy water's flame). */
function ownedBy(e: Projectile, p: Player): boolean {
  const o = e.owner;
  return o === p || (o instanceof Projectile && o.owner === p);
}

/** Scratch keys that count down as ammo or magic is spent (MoveStats.toolUses). */
export const AMMO_KEYS = ['magic', 'bombs', 'hearts', 'ninpo', 'missiles', 'triple', 'homing'] as const;

/** A glide counts toward `maxRunGlide` once it has carried this far (px): the slide is seen. */
export const GLIDE_SEEN_PX = 6;

/** Each hero's training (Mario has none: his tutorial is stage 1-0). */
export const TRAINING: Readonly<Record<string, HeroTraining>> = {
  luigi: LUIGI_TRAINING,
  link: LINK_TRAINING,
  megaman: MEGAMAN_TRAINING,
  samus: SAMUS_TRAINING,
  simon: SIMON_TRAINING,
  ryu: RYU_TRAINING,
  bill: BILL_TRAINING,
  sophia: SOPHIA_TRAINING,
};

/** A hero's training, or null for Mario (his tutorial is stage 1-0) and heroes without a room. */
export function trainingFor(heroId: string): HeroTraining | null {
  return TRAINING[heroId] ?? null;
}

/**
 * Each hero's training (owner note 24): chapters of lessons covering the whole kit, in the order
 * the room plays them, starting from the basic kit and growing it item by item.
 */
export const CHAPTERS: Readonly<Record<string, readonly TrainingChapter[]>> = Object.fromEntries(
  Object.entries(TRAINING).map(([id, t]) => [id, t.chapters]),
);

/** A hero's chapters; empty for Mario (his tutorial is stage 1-0) and heroes without a room. */
export function chaptersFor(heroId: string): readonly TrainingChapter[] {
  return TRAINING[heroId]?.chapters ?? [];
}

/** Each hero's lessons in order: every chapter's, one after another. */
export const LESSONS: Readonly<Record<string, readonly TrainingLesson[]>> = Object.fromEntries(
  Object.entries(CHAPTERS).map(([id, chapters]) => [id, chapters.flatMap((c) => c.lessons)]),
);

/** A hero's lessons in order; empty for Mario (his tutorial is stage 1-0) and heroes without a room. */
export function lessonsFor(heroId: string): readonly TrainingLesson[] {
  return chaptersFor(heroId).flatMap((c) => c.lessons);
}
