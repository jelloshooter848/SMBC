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

  private wasOnGround = true;
  private wasClinging = false;
  private airborne: { jumped: boolean; feet: number; top: number; x: number } | null = null;
  private coast = 0;
  private coastFast = false;
  private lastTool: number | undefined;
  private lastAttack = 0;
  private lastEntity = 0;

  constructor(readonly room: RoomGeometry) {}

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
        if (vx === 0 && vy < 0) this.shotsUp++;
      } else if (e instanceof Bomb && e.owner === p) {
        this.bombs++;
        this.shotKinds.add('bomb');
      } else if (e instanceof RushCoil && e.owner === p) this.shotKinds.add('rush');
    }
    this.lastEntity = last;
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

const MEGAMAN_SPECIALS = [...WEAPONS.map((w) => w.spec.kind), 'rush'];
const SIMON_SUBS = SUB_WEAPONS.map((w) => w.id);
const RYU_ARTS = NINPO_ARTS.flatMap((a) => (a.spec ? [a.spec.kind] : []));
const any = (set: ReadonlySet<string>, kinds: readonly string[]) => kinds.some((k) => set.has(k));

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

/** Each hero's lessons: the 3-5 things that make them different from Mario. */
export const LESSONS: Readonly<Record<string, readonly TrainingLesson[]>> = {
  luigi: [
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
    {
      id: 'fireball',
      prompt: 'FIRE POWER! [FIRE:attack] THROWS A FIREBALL. HIT THE DUMMY WITH ONE.',
      setup(room) {
        const p = room.player;
        if (p.powerState === 'fire') return;
        p.powerState = 'fire';
        p.startTransition('grow');
        room.world.audio.sfx('powerup');
      },
      done: (t) => t.dummyHits.has('fireball'),
    },
  ],
  link: [
    {
      id: 'sword',
      prompt: 'SWING YOUR [SWORD:attack] AT THE DUMMY.',
      done: (t) => t.dummyHits.has('sword'),
    },
    {
      id: 'down-thrust',
      prompt: '[JUMP:jump] OVER THE DUMMY AND HOLD DOWN FOR A DOWN-THRUST.',
      done: (t) => t.dummyHits.has('down-thrust'),
    },
    {
      id: 'up-thrust',
      prompt: '[JUMP:jump] UNDER THE BRICKS AND HOLD UP FOR AN UP-THRUST.',
      done: (t) => t.seen.has('upThrust'),
    },
    {
      id: 'shield',
      prompt: 'STAND STILL A FEW STEPS FROM THE DUMMY, FACING IT: YOUR SHIELD BLOCKS.',
      setup(room) {
        room.dummyShoots = true;
      },
      done: (t) => t.blocked > 0,
    },
    {
      id: 'boomerang',
      prompt: '[USE TOOL:special] THROWS THE BOOMERANG. [TOOLS:select] PICKS ANOTHER TOOL.',
      done: (t) => t.shotKinds.has('boomerang'),
    },
  ],
  megaman: [
    {
      id: 'shoot',
      prompt: '[SHOOT:attack] THE DUMMY WITH YOUR BUSTER.',
      done: (t) => t.dummyHits.has('buster'),
    },
    {
      id: 'slide',
      prompt: 'HOLD DOWN AND PRESS [JUMP:jump] TO SLIDE.',
      done: (t) => t.slid,
    },
    {
      id: 'charge',
      prompt: 'HOLD [SHOOT:attack] TO CHARGE UP, THEN LET GO FOR A CHARGE SHOT.',
      done: (t) => t.shotKinds.has('buster-charged'),
    },
    {
      id: 'weapon',
      prompt: '[WEAPON:select] PICKS A SPECIAL WEAPON. FIRE IT WITH [USE WEAPON:special].',
      done: (t) => any(t.shotKinds, MEGAMAN_SPECIALS),
    },
  ],
  samus: [
    {
      id: 'shoot',
      prompt: '[SHOOT:attack] THE DUMMY WITH YOUR BEAM.',
      done: (t) => t.dummyHits.has('beam'),
    },
    {
      id: 'aim-up',
      prompt: 'HOLD UP TO AIM STRAIGHT UP, AND [SHOOT:attack].',
      done: (t) => t.shotsUp > 0,
    },
    {
      id: 'morph-ball',
      prompt: 'PRESS DOWN TO ROLL INTO THE MORPH BALL.',
      done: (t) => t.seen.has('ball'),
    },
    {
      id: 'bomb',
      prompt: 'IN THE MORPH BALL, [BOMB:attack] DROPS A BOMB.',
      done: (t) => t.bombs > 0,
    },
    {
      id: 'missile',
      prompt: 'UP STANDS YOU UP. [MISSILE:special] FIRES A MISSILE.',
      done: (t) => t.shotKinds.has('missile'),
    },
  ],
  simon: [
    {
      id: 'whip',
      prompt: 'CRACK THE [WHIP:attack] AT THE DUMMY. IT WINDS UP, SO SWING EARLY!',
      done: (t) => t.dummyHits.has('melee'),
    },
    {
      id: 'crouch-whip',
      prompt: 'HOLD DOWN TO CROUCH, AND [WHIP:attack] LOW.',
      done: (t) => t.crouchAttacks > 0,
    },
    {
      id: 'sub-weapon',
      prompt: '[THROW:special] HURLS YOUR SUB-WEAPON. IT COSTS HEARTS.',
      done: (t) => any(t.shotKinds, SIMON_SUBS),
    },
    {
      id: 'committed-jump',
      prompt: "SIMON'S [JUMP:jump] IS COMMITTED: NO STEERING IN THE AIR. JUMP THE GAP!",
      done: (t) => t.gapCrossings > 0,
    },
  ],
  ryu: [
    {
      id: 'slash',
      prompt: '[SLASH:attack] THE DUMMY WITH YOUR SWORD.',
      done: (t) => t.dummyHits.has('melee'),
    },
    {
      id: 'cling',
      prompt: '[JUMP:jump] AT THE TALL WALL AND HOLD TOWARD IT TO CLING.',
      done: (t) => t.clung,
    },
    {
      id: 'wall-jump',
      prompt: 'WHILE CLINGING, [JUMP:jump] TO KICK OFF THE WALL.',
      done: (t) => t.wallJumps > 0,
    },
    {
      id: 'ninpo',
      prompt: '[CAST:special] USES A NINPO ART. IT COSTS NINPO.',
      done: (t) => any(t.shotKinds, RYU_ARTS) || t.seen.has('spin'),
    },
  ],
  bill: [
    {
      id: 'shoot',
      prompt: '[SHOOT:attack] THE DUMMY. YOUR BULLETS NEVER RUN OUT.',
      done: (t) => t.dummyHits.has('shot'),
    },
    {
      id: 'aim',
      prompt: 'AIM IN 8 WAYS: HOLD UP, OR UP AND A DIRECTION. [SHOOT:attack] 3 WAYS.',
      done: (t) => t.shotDirs.size >= 3 && t.aimedDirs >= 2,
    },
    {
      id: 'prone',
      prompt: 'HOLD DOWN TO GO PRONE.',
      done: (t) => t.crouched,
    },
    {
      id: 'jump-shoot',
      prompt: '[JUMP:jump] AND [SHOOT:attack] IN THE AIR.',
      done: (t) => t.airShots > 0,
    },
  ],
  sophia: [
    {
      id: 'cannon',
      prompt: "[SHOOT:attack] THE DUMMY WITH SOPHIA'S CANNON. JUMP IS A SQUAT, THEN A HOP.",
      done: (t) => t.dummyHits.has('sophia-cannon'),
    },
    {
      id: 'hover',
      prompt: 'HYPER POWER! [JUMP:jump], THEN PRESS AND HOLD JUMP AGAIN IN THE AIR TO HOVER.',
      setup(room) {
        const p = room.player;
        if (p.powerState !== 'small') return;
        p.powerState = 'big';
        p.startTransition('grow');
        room.world.audio.sfx('powerup');
      },
      done: (t) => t.seen.has('_hover'),
    },
    {
      id: 'missile',
      prompt: '[MISSILE:special] FIRES THREE MISSILES. THEY FLY THROUGH WALLS.',
      done: (t) => t.shotKinds.has('sophia-missile'),
    },
    {
      id: 'wall-climb',
      prompt: 'CRUSHER POWER! HOLD UP AND DRIVE INTO THE TALL WALL TO CLIMB IT.',
      setup(room) {
        const p = room.player;
        if (p.powerState === 'fire') return;
        p.powerState = 'fire';
        p.startTransition('grow');
        room.world.audio.sfx('powerup');
      },
      done: (t) => t.seen.has('_wall'),
    },
    {
      id: 'jason',
      prompt: '[EXIT:select] AND JASON HOPS OUT ON FOOT. UP BY THE TANK GETS HIM BACK IN.',
      done: (t) => t.seen.has('_jason'),
    },
  ],
};

/** A hero's lessons; empty for Mario (his tutorial is stage 1-0) and heroes without a room. */
export function lessonsFor(heroId: string): readonly TrainingLesson[] {
  return LESSONS[heroId] ?? [];
}
