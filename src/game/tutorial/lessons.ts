import { toPx } from '@engine/math/units';
import type { Action } from '@engine/input/actions';
import type { Player } from '../entities/player';
import type { World } from '../world/world';
import { Projectile } from '../entities/projectiles/projectile';
import { Bomb } from '../entities/objects/bomb';
import { RushCoil } from '../entities/objects/rush-coil';
import { WEAPONS } from '../characters/megaman/weapons';
import { SUB_WEAPONS } from '../characters/simon/weapons';
import { NINPO_ARTS } from '../characters/ryu/weapons';
import { GUNS } from '../characters/bill/weapons';
import { activeTool } from '../characters/toolbelt';

/*
 * Hero training (docs/HEROES.md): the lessons each hero's practice room teaches, and the tracker
 * that watches the player to tick them off. Prompts name abilities the way the hero's guide and
 * touch buttons do (JUMP, SWORD, SHOOT, TOOLS...), never button letters, and wrap to the room's
 * prompt box (28 columns, at most 3 lines).
 */

/** `[LABEL:action]`: a button's ability in a prompt. */
const TOKEN = /\[([^:\]]+):(\w+)\]/g;

/**
 * A prompt's text: each `[LABEL:action]` through `hint` (the room passes `abilityHint`), or the
 * bare label without one.
 */
export function promptText(prompt: string, hint?: (label: string, action: Action) => string): string {
  return prompt.replace(TOKEN, (_m, label: string, action: string) =>
    hint ? hint(label, action as Action) : label,
  );
}

/** The actions named by a prompt's `[LABEL:action]` tokens. */
export function promptActions(prompt: string): string[] {
  return [...prompt.matchAll(TOKEN)].map((m) => m[2] as string);
}

/** Where things are in the practice room (px), so lessons can ask "on the ledge", "over the gap". */
export interface RoomGeometry {
  /** Top of the floor. */
  floorTop: number;
  /** Top of the high ledge. */
  ledgeTop: number;
  /** The gap in the floor: its left and right edges. */
  gap: { x0: number; x1: number };
  /**
   * The one-tile tunnel along the floor (the gear room's low wall): its left and right edges;
   * none (x1 <= x0) in the other rooms.
   */
  tunnel: { x0: number; x1: number };
}

/** What a lesson's setup can change in the room. */
export interface PracticeRoom {
  readonly player: Player;
  readonly world: World;
  /** The dummy fires slow, harmless shots at the hero (Link's shield lesson). */
  dummyShoots: boolean;
}

export interface TrainingLesson {
  id: string;
  /**
   * Shown in the prompt box and announced: ability names, never button letters. A button's
   * ability is written `[LABEL:action]` ('[SHOOT:attack]'): the room shows it through
   * `abilityHint` ("SHOOT (X)" with keys, "SHOOT" on touch); `promptText` gives the bare label.
   */
  prompt: string;
  /**
   * The prompt on touch, when the touch controls do it differently (running: push the d-pad
   * far to the side); absent: `prompt`.
   */
  touchPrompt?: string;
  /** True once the player has done it (since the lesson came up: the tracker is reset). */
  done(t: MoveStats): boolean;
  /** Runs when the lesson comes up (gives the room's kit, e.g. Luigi's fire flower). */
  setup?(room: PracticeRoom): void;
  /**
   * Whether the run has this lesson's kit (a power-up, a weapon); absent: always. Kit the run has
   * not got still has its lesson, marked (PREVIEW), with the kit lent in the room.
   */
  unlocked?(run: RunKit): boolean;
}

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

/** Luigi's standing jump with JUMP held all the way clears this; a tap or Mario's does not. */
export const LUIGI_HIGH_JUMP_PX = 72;
/** Luigi glides at least this far after letting go from a run (Mario stops well short). */
export const LUIGI_COAST_PX = 48;
/**
 * A stop from a run that would carry Luigi this far on open floor also counts: further than
 * Mario's longest (about 64 px from full speed), so it still means "Luigi slides further". The
 * room is short: from a real run Luigi glides 100+ px, so a glide the gap cuts short counts by
 * where it was going (MoveStats.maxRunGlide).
 */
export const LUIGI_SLIDE_PX = 72;
/** A glide counts toward `maxRunGlide` once it has carried this far (px): the slide is seen. */
export const GLIDE_SEEN_PX = 6;
/** Mega Man's jump off the seabed clears this (his jump on land does not). */
export const SEABED_JUMP_PX = 112;
/** A hit on the dummy from this far (px, the hero's front edge to the dummy) is a long-range hit. */
export const FAR_HIT_PX = 96;
/** Swimming up until the feet are this high (px from the top) reaches the surface. */
export const SURFACE_PX = 80;

/** The run's kit for one hero: what the training player has unlocked outside the room. */
export interface RunKit {
  kit: Readonly<Record<string, number>>;
  /** The carried power state ('small', 'big', 'fire', 'full'...). */
  power: string;
}

/** The rooms a chapter can use (src/content/levels/practice*.map). */
export type RoomId = 'practice' | 'gear' | 'water';

/** A short run of lessons in one room: skippable on its own from the room's menu. */
export interface TrainingChapter {
  id: string;
  /** Shown on the chapter's card and in the heading: a word or two. */
  title: string;
  room: RoomId;
  lessons: readonly TrainingLesson[];
}

/** A lesson for kit the run has not unlocked yet: it still runs (the room lends the kit). */
export function isPreview(lesson: TrainingLesson, run?: RunKit): boolean {
  return !!run && !!lesson.unlocked && !lesson.unlocked(run);
}

/** The prompt's mark on a preview lesson. */
export const PREVIEW = '(PREVIEW) ';

const k = (run: RunKit, key: string) => run.kit[key] ?? 0;

/** Turn the hero into `power` for a lesson (Luigi's fire, Sophia III's Hyper and Crusher). */
function givePower(room: PracticeRoom, power: string, unless: readonly string[] = [power]): void {
  const p = room.player;
  if (unless.includes(p.powerState)) return;
  p.powerState = power;
  p.startTransition('grow');
  room.world.audio.sfx('powerup');
}

/** Set scratch keys for the lesson (a beam level, a whip, a heart count). */
const setKit =
  (kit: Record<string, number>) =>
  (room: PracticeRoom): void => {
    Object.assign(room.player.scratch, kit);
  };

/** A lesson built from its parts (the tool-belt lessons share their shape). */
function lesson(
  id: string,
  prompt: string,
  done: (t: MoveStats) => boolean,
  unlocked?: (run: RunKit) => boolean,
  setup?: (room: PracticeRoom) => void,
): TrainingLesson {
  return { id, prompt, done, ...(unlocked ? { unlocked } : {}), ...(setup ? { setup } : {}) };
}

const MEGAMAN_WEAPON_PROMPTS: Record<string, string> = {
  saw: '[WEAPON:select] TO THE SAW DISC. [USE WEAPON:special] FIRES IT: AIM IT 8 WAYS.',
  leaf: '[WEAPON:select] TO THE LEAF GUARD. [USE WEAPON:special] TWICE TO THROW IT.',
  flame: '[WEAPON:select] TO THE FLAME WAVE. [USE WEAPON:special]: IT RUNS ALONG THE FLOOR.',
  knuckle: '[WEAPON:select] TO THE KNUCKLE. [USE WEAPON:special]: IT SEEKS THE DUMMY.',
  bolt: '[WEAPON:select] TO THE BOLT. [USE WEAPON:special]: A BEAM ACROSS THE SCREEN.',
};

const SIMON_SUB_PROMPTS: Record<string, string> = {
  dagger: '[THROW:special] HURLS A SUB-WEAPON: THE DAGGER FLIES FAST AND STRAIGHT.',
  'hand-axe': '[TOOLS:select] TO THE AXE. [THROW:special] LOBS IT HIGH OVER WALLS.',
  'holy-water': '[TOOLS:select] TO THE HOLY WATER. [THROW:special]: IT BURNS ON THE FLOOR.',
  cross: '[TOOLS:select] TO THE CROSS. [THROW:special]: IT SPINS OUT AND COMES BACK.',
  stopwatch: '[TOOLS:select] TO THE STOPWATCH. [THROW:special] FREEZES THE DUMMY: 5 HEARTS.',
};

const RYU_ART_PROMPTS: Record<string, string> = {
  'throwing-star': '[NINPO:select] PICKS AN ART. [CAST:special] THE THROWING STAR. IT COSTS NINPO.',
  windmill: '[NINPO:select] TO THE WINDMILL. [CAST:special]: IT CUTS THROUGH AND RETURNS.',
  'fire-wheel': '[NINPO:select] TO THE FIRE WHEEL. [CAST:special]: FLAMES CIRCLE YOU.',
  slash: '[NINPO:select] TO JUMP AND SLASH. [CAST:special]: A SOMERSAULT THAT CUTS.',
};

const BILL_GUN_PROMPTS: Record<string, string> = {
  mg: '[WEAPON:select] TO THE MACHINE GUN. HOLD [SHOOT:attack] TO KEEP FIRING.',
  spread: '[WEAPON:select] TO THE SPREAD. [SHOOT:attack]: FIVE SHOTS IN A FAN.',
  laser: '[WEAPON:select] TO THE LASER. [SHOOT:attack]: ONE BEAM THAT PIERCES.',
  'flame-gun': '[WEAPON:select] TO THE FLAME THROWER. [SHOOT:attack]: A HEAVY FIREBALL.',
};

/**
 * Each hero's training (owner note 24): chapters of lessons covering the whole kit, in the order
 * the room plays them. A lesson with `unlocked` is marked (PREVIEW) while the run lacks that kit;
 * the room lends it either way (`devKit`, or the lesson's setup).
 */
export const CHAPTERS: Readonly<Record<string, readonly TrainingChapter[]>> = {
  luigi: [
    {
      id: 'moves',
      title: 'MOVES',
      room: 'practice',
      lessons: [
        {
          id: 'high-jump',
          prompt: "HOLD [JUMP:jump] FOR LUIGI'S HIGH JUMP. REACH THE HIGH LEDGE FROM THE STEP!",
          done: (t) => t.maxJumpHeight >= LUIGI_HIGH_JUMP_PX || t.highestStand <= t.room.ledgeTop,
        },
        {
          id: 'slippery-stop',
          prompt: 'HOLD RIGHT AND [RUN:attack], LET GO BEFORE THE GAP AND WATCH LUIGI SLIDE!',
          touchPrompt: 'PUSH THE D-PAD FAR RIGHT OR HOLD [RUN:attack] TO RUN. LET GO BEFORE THE GAP!',
          done: (t) => t.maxRunCoast >= LUIGI_COAST_PX || t.maxRunGlide >= LUIGI_SLIDE_PX,
        },
      ],
    },
    {
      id: 'fire',
      title: 'FIRE',
      room: 'practice',
      lessons: [
        {
          id: 'fireball',
          prompt: 'FIRE POWER! [FIRE:attack] THROWS A FIREBALL. HIT THE DUMMY WITH ONE.',
          unlocked: (run) => run.power === 'fire',
          setup: (room) => givePower(room, 'fire'),
          done: (t) => t.dummyHits.has('fireball'),
        },
      ],
    },
  ],
  link: [
    {
      id: 'sword',
      title: 'SWORD',
      room: 'practice',
      lessons: [
        lesson('sword', 'SWING YOUR [SWORD:attack] AT THE DUMMY.', (t) => t.dummyHits.has('sword')),
        lesson('down-thrust', '[JUMP:jump] OVER THE DUMMY AND HOLD DOWN FOR A DOWN-THRUST.', (t) =>
          t.dummyHits.has('down-thrust'),
        ),
        lesson('up-thrust', '[JUMP:jump] UNDER THE BRICKS AND HOLD UP FOR AN UP-THRUST.', (t) =>
          t.seen.has('upThrust'),
        ),
        lesson(
          'shield',
          'STAND STILL A FEW STEPS FROM THE DUMMY, FACING IT: YOUR SHIELD BLOCKS.',
          (t) => t.blocked > 0,
          undefined,
          (room) => {
            room.dummyShoots = true;
          },
        ),
      ],
    },
    {
      id: 'tools',
      title: 'TOOLS',
      room: 'gear',
      lessons: [
        lesson('boomerang', '[USE TOOL:special] THROWS THE BOOMERANG. [TOOLS:select] PICKS ANOTHER TOOL.', (t) =>
          t.shotKinds.has('boomerang'),
        ),
        lesson(
          'bomb',
          '[TOOLS:select] TO THE BOMB. [USE TOOL:special] SETS IT DOWN BY THE DUMMY. STEP BACK!',
          (t) => t.bombs > 0 && t.dummyHits.has('bomb'),
        ),
      ],
    },
    {
      id: 'magic',
      title: 'MAGIC',
      room: 'practice',
      lessons: [
        lesson(
          'jump-spell',
          '[TOOLS:select] TO THE JUMP SPELL. [USE TOOL:special], THEN JUMP TO THE HIGH LEDGE!',
          (t) => t.toolUses.has('jump') && t.highestStand <= t.room.ledgeTop,
        ),
        lesson('shield-spell', '[TOOLS:select] TO THE SHIELD SPELL. [USE TOOL:special]: HALF DAMAGE FOR A WHILE.', (t) =>
          t.toolUses.has('shield'),
        ),
        lesson(
          'fire-spell',
          '[TOOLS:select] TO THE FIRE SPELL. [USE TOOL:special]: YOUR NEXT [SWORD:attack] FIRES A BEAM!',
          (t) => t.toolUses.has('fire') && t.dummyHits.has('sword-beam'),
          undefined,
          // Without the red tunic's beam: only the spell makes one.
          setKit({ beam: 0 }),
        ),
      ],
    },
    {
      id: 'water',
      title: 'WATER',
      room: 'water',
      lessons: [lesson('swim', 'IN WATER [SWIM:jump] STROKES UP. SWIM UP TO THE SURFACE!', (t) => t.topReached <= SURFACE_PX)],
    },
  ],
  megaman: [
    {
      id: 'buster',
      title: 'BUSTER',
      room: 'practice',
      lessons: [
        lesson('shoot', '[SHOOT:attack] THE DUMMY WITH YOUR BUSTER.', (t) => t.dummyHits.has('buster')),
        lesson(
          'charge',
          'THE HELMET: HOLD [SHOOT:attack] TO CHARGE, LET GO FOR A CHARGE SHOT.',
          (t) => t.shotKinds.has('buster-charged'),
          (run) => k(run, 'helmet') > 0,
        ),
      ],
    },
    {
      id: 'moves',
      title: 'MOVES',
      room: 'gear',
      lessons: [
        lesson('slide', 'HOLD DOWN AND PRESS [JUMP:jump] TO SLIDE. SLIDE UNDER THE LOW WALL!', (t) => t.slid && t.tunnel),
        lesson(
          'rush',
          '[WEAPON:select] TO RUSH. [USE WEAPON:special], THEN LAND ON THE COIL TO FLY UP!',
          (t) => t.seen.has('rush-bounce'),
          (run) => k(run, 'helmet') > 0,
        ),
      ],
    },
    {
      id: 'weapons',
      title: 'WEAPONS',
      room: 'practice',
      lessons: [
        lesson(
          'weapon',
          '[WEAPON:select] PICKS A WEAPON. THE BAR BY YOUR HEALTH IS ITS ENERGY.',
          (t) => t.toolCycles > 0,
          (run) => k(run, 'helmet') > 0 || k(run, 'weapons') > 0,
        ),
        ...WEAPONS.map((w, i) =>
          lesson(
            w.id,
            MEGAMAN_WEAPON_PROMPTS[w.id] ?? '',
            (t) => t.shotKinds.has(w.spec.kind),
            (run) => k(run, 'weapons') > i,
          ),
        ),
      ],
    },
    {
      id: 'water',
      title: 'WATER',
      room: 'water',
      lessons: [
        lesson(
          'seabed-jump',
          'UNDER WATER YOU WALK THE SEABED. [JUMP:jump] OFF IT: YOU GO MUCH HIGHER!',
          (t) => t.maxJumpHeight >= SEABED_JUMP_PX,
        ),
      ],
    },
  ],
  samus: [
    {
      id: 'beams',
      title: 'BEAMS',
      room: 'practice',
      lessons: [
        lesson('shoot', '[SHOOT:attack] THE DUMMY WITH YOUR BEAM.', (t) => t.dummyHits.has('beam'), undefined, setKit({ beam: 0 })),
        lesson('aim-up', 'HOLD UP TO AIM STRAIGHT UP, AND [SHOOT:attack].', (t) => t.shotsUp > 0),
        lesson(
          'long-beam',
          'LONG BEAM: FULL RANGE. GO TO THE LEFT WALL AND [SHOOT:attack] THE DUMMY.',
          (t) => t.dummyHits.has('far'),
          (run) => k(run, 'beam') >= 1,
          setKit({ beam: 1 }),
        ),
        lesson(
          'ice-beam',
          'ICE BEAM: IT FREEZES WHAT IT HITS. [SHOOT:attack] THE DUMMY.',
          (t) => t.dummyHits.has('ice'),
          (run) => k(run, 'beam') >= 2,
          setKit({ beam: 2 }),
        ),
        lesson(
          'wave-beam',
          'WAVE BEAM: IT GOES THROUGH WALLS. [SHOOT:attack] THE DUMMY.',
          (t) => t.dummyHits.has('wave'),
          (run) => k(run, 'beam') >= 3,
          setKit({ beam: 3 }),
        ),
      ],
    },
    {
      id: 'missiles',
      title: 'MISSILES',
      room: 'practice',
      lessons: [
        lesson('missile', '[MISSILE:special] FIRES A MISSILE: THREE DAMAGE, AND IT OPENS BRICKS.', (t) =>
          t.shotKinds.has('missile'),
        ),
        lesson(
          'missile-switch',
          '[WEAPON:select] SWITCHES THE CANNON TO MISSILES. THEN [SHOOT:attack].',
          (t) => t.shotTools.has('missile') && t.shotKinds.has('missile'),
        ),
      ],
    },
    {
      id: 'ball',
      title: 'MORPH BALL',
      room: 'gear',
      lessons: [
        lesson(
          'morph-ball',
          'PRESS DOWN TO ROLL INTO THE MORPH BALL. ROLL UNDER THE LOW WALL!',
          (t) => t.seen.has('ball') && t.tunnel,
        ),
        lesson('bomb', 'IN THE MORPH BALL, [BOMB:attack] DROPS A BOMB.', (t) => t.bombs > 0),
        lesson(
          'bomb-jump',
          'SIT ON A BOMB: ITS BLAST BOUNCES THE BALL UP. [BOMB:attack] FOR A BOMB JUMP!',
          (t) => t.ballJumps > 0,
        ),
      ],
    },
  ],
  simon: [
    {
      id: 'whip',
      title: 'WHIP',
      room: 'practice',
      lessons: [
        lesson(
          'whip',
          'CRACK THE [WHIP:attack] AT THE DUMMY. IT WINDS UP, SO SWING EARLY!',
          (t) => t.dummyHits.has('melee'),
          undefined,
          setKit({ whip: 0 }),
        ),
        lesson('crouch-whip', 'HOLD DOWN TO CROUCH, AND [WHIP:attack] LOW.', (t) => t.crouchAttacks > 0),
        lesson(
          'committed-jump',
          "SIMON'S [JUMP:jump] IS COMMITTED: NO STEERING IN THE AIR. JUMP THE GAP!",
          (t) => t.gapCrossings > 0,
        ),
      ],
    },
    {
      id: 'subs',
      title: 'SUB-WEAPONS',
      room: 'practice',
      lessons: [
        ...SUB_WEAPONS.map((w, i) =>
          lesson(
            w.id,
            SIMON_SUB_PROMPTS[w.id] ?? '',
            w.spec ? (t) => t.shotKinds.has(w.id) : (t) => t.toolUses.has(w.id),
            (run) => k(run, 'subs') > i,
          ),
        ),
        lesson(
          'hearts',
          'SUB-WEAPONS COST HEARTS. YOU HAVE 3: [THROW:special] UNTIL THEY RUN OUT.',
          (t) => t.now.hearts === 0,
          (run) => k(run, 'subs') > 0,
          setKit({ hearts: 3, tool: 0 }),
        ),
      ],
    },
    {
      id: 'upgrades',
      title: 'UPGRADES',
      room: 'practice',
      lessons: [
        lesson(
          'chain-whip',
          'THE CHAIN WHIP REACHES FURTHER. [WHIP:attack] THE DUMMY WITH IT.',
          (t) => t.dummyHits.has('melee'),
          (run) => k(run, 'whip') >= 1,
          setKit({ whip: 1 }),
        ),
        lesson(
          'morning-star',
          'THE MORNING STAR REACHES FURTHEST. [WHIP:attack] THE DUMMY WITH IT.',
          (t) => t.dummyHits.has('melee'),
          (run) => k(run, 'whip') >= 2,
          setKit({ whip: 2 }),
        ),
        lesson(
          'double-shot',
          'DOUBLE SHOT: TWO SUB-WEAPONS AT ONCE. [THROW:special] TWICE, QUICKLY!',
          (t) => t.maxShotsOut >= 2,
          (run) => k(run, 'multi') >= 2,
          setKit({ multi: 2, tool: 0 }),
        ),
      ],
    },
  ],
  ryu: [
    {
      id: 'sword',
      title: 'SWORD',
      room: 'practice',
      lessons: [
        lesson('slash', '[SLASH:attack] THE DUMMY WITH YOUR SWORD.', (t) => t.dummyHits.has('melee')),
        lesson('cling', '[JUMP:jump] AT THE TALL WALL AND HOLD TOWARD IT TO CLING.', (t) => t.clung),
        lesson('wall-jump', 'WHILE CLINGING, [JUMP:jump] TO KICK OFF THE WALL.', (t) => t.wallJumps > 0),
      ],
    },
    {
      id: 'ninpo',
      title: 'NINPO',
      room: 'practice',
      lessons: NINPO_ARTS.map((a, i) => {
        const kind = a.spec?.kind;
        return lesson(
          a.id === 'slash' ? 'jump-slash' : a.id,
          RYU_ART_PROMPTS[a.id] ?? '',
          kind ? (t) => t.shotKinds.has(kind) : (t) => t.seen.has('spin'),
          (run) => k(run, 'arts') > i,
        );
      }),
    },
  ],
  bill: [
    {
      id: 'aim',
      title: 'AIM',
      room: 'practice',
      lessons: [
        lesson('shoot', '[SHOOT:attack] THE DUMMY. YOUR BULLETS NEVER RUN OUT.', (t) => t.dummyHits.has('shot')),
        lesson(
          'aim',
          'AIM IN 8 WAYS: HOLD UP, OR UP AND A DIRECTION. [SHOOT:attack] 3 WAYS.',
          (t) => t.shotDirs.size >= 3 && t.aimedDirs >= 2,
        ),
        lesson('prone', 'HOLD DOWN TO GO PRONE.', (t) => t.crouched),
        lesson('jump-shoot', '[JUMP:jump] AND [SHOOT:attack] IN THE AIR.', (t) => t.airShots > 0),
      ],
    },
    {
      id: 'guns',
      title: 'GUNS',
      room: 'practice',
      lessons: GUNS.slice(1).map((g, i) =>
        lesson(
          g.id,
          BILL_GUN_PROMPTS[g.id] ?? '',
          (t) => t.shotKinds.has(g.spec.kind),
          (run) => k(run, 'guns') > i,
        ),
      ),
    },
    {
      id: 'water',
      title: 'WATER',
      room: 'water',
      lessons: [
        lesson(
          'swim-shoot',
          '[SWIM:jump] STROKES UP. [SHOOT:attack] WHILE YOU SWIM!',
          (t) => t.swimShots > 0,
        ),
      ],
    },
  ],
  sophia: [
    {
      id: 'drive',
      title: 'DRIVE',
      room: 'practice',
      lessons: [
        lesson(
          'drive-jump',
          'DRIVE RIGHT AND [JUMP:jump] THE GAP. HOLD JUMP TO GO HIGHER.',
          (t) => t.gapCrossings > 0,
        ),
        lesson('cannon', "[SHOOT:attack] THE DUMMY WITH SOPHIA'S CANNON.", (t) => t.dummyHits.has('sophia-cannon')),
        lesson('cannon-up', 'HOLD UP AND [SHOOT:attack]: THE CANNON FIRES STRAIGHT UP.', (t) => t.shotsUp > 0),
      ],
    },
    {
      id: 'power',
      title: 'POWER-UPS',
      room: 'practice',
      lessons: [
        lesson(
          'hover',
          'HYPER! [JUMP:jump], THEN HOLD JUMP AGAIN IN THE AIR TO HOVER.',
          (t) => t.seen.has('_hover'),
          (run) => run.power !== 'small',
          (room) => givePower(room, 'big', ['big', 'fire']),
        ),
        lesson(
          'missile',
          '[MISSILE:special] FIRES THREE MISSILES. THEY FLY THROUGH WALLS.',
          (t) => t.shotKinds.has('sophia-missile'),
          (run) => k(run, 'hasTriple') > 0,
        ),
        lesson(
          'homing',
          'HOLD DOWN AND [MISSILE:special] TO SWITCH TO HOMING. THEN FIRE ONE!',
          (t) => t.shotKinds.has('sophia-homing'),
          (run) => k(run, 'hasHoming') > 0,
        ),
        lesson(
          'wall-climb',
          'CRUSHER! HOLD UP AND DRIVE INTO THE TALL WALL TO CLIMB IT.',
          (t) => t.seen.has('_wall'),
          (run) => run.power === 'fire',
          (room) => givePower(room, 'fire'),
        ),
      ],
    },
    {
      id: 'jason',
      title: 'JASON',
      room: 'practice',
      lessons: [
        lesson('jason', '[EXIT:select] AND JASON HOPS OUT ON FOOT. UP BY THE TANK GETS HIM BACK IN.', (t) =>
          t.seen.has('_jason'),
        ),
      ],
    },
  ],
};

/** A hero's chapters; empty for Mario (his tutorial is stage 1-0) and heroes without a room. */
export function chaptersFor(heroId: string): readonly TrainingChapter[] {
  return CHAPTERS[heroId] ?? [];
}

/** Each hero's lessons in order: every chapter's, one after another. */
export const LESSONS: Readonly<Record<string, readonly TrainingLesson[]>> = Object.fromEntries(
  Object.entries(CHAPTERS).map(([id, chapters]) => [id, chapters.flatMap((c) => c.lessons)]),
);

/** A hero's lessons in order; empty for Mario (his tutorial is stage 1-0) and heroes without a room. */
export function lessonsFor(heroId: string): readonly TrainingLesson[] {
  return LESSONS[heroId] ?? [];
}

