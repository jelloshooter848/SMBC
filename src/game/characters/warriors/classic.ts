import type { InputFrame } from '@engine/input/input-manager';
import { px } from '@engine/math/units';
import type { CharacterDef, SpriteSpec } from '../character';
import { CLASSIC_POWER_STATES } from '../character';
import type { MovementProfile, SwimProfile } from '../profile';
import type { Player } from '../../entities/player';
import type { World } from '../../world/world';
import type { DamageSource } from '../../rules/damage';
import { ScorePopup, Flash } from '../../entities/effects/effects';
import {
  CLASSIC_FREEZE_FRAMES,
  CLASSIC_PUSH_INVULN,
  CLASSIC_STAR_MUSIC_LEFT,
  classicBlockPowerUp,
  classicBusy,
  classicLook,
  classicOnHurt,
  classicOnPowerUp,
  classicRespawn,
  classicStarPaletteStep,
  type ClassicHitResponse,
  type ClassicPowerKit,
} from '../classic/power';
import { WARRIOR_JOB_LOOKS } from '@content/sprites/warriors';
import { WARRIORS_GUIDE } from './classic-guide';
import { castSpell, type WarriorSpellId } from './classic-weapons';

/**
 * The Warriors of Light, a Classic-only hero (bug-reports/2026-10-07-warriors-of-light-build-classic-character.md,
 * WL-1..WL-24; docs/classic/WARRIORS_OF_LIGHT.md with the owner's recommended answers to every
 * WL-M item; TG-41). The cut Final Fantasy prototype of SMBC 3.1.21, built from what its code
 * would do: one body, four jobs (Fighter, Thief, Black Mage, White Mage) in `p.scratch.job`,
 * switched with Special and a direction. Instant walk, one fixed jump, no stomp, no head bump.
 * Every action (a swing, a spell's wind-up and cast) starts only while idle and roots the hero on
 * the ground; a ground jump cancels it.
 */

/* ---------- jobs ---------- */

export const JOB = { fighter: 0, thief: 1, bmage: 2, wmage: 3 } as const;
export type Job = (typeof JOB)[keyof typeof JOB];
/** HUD and pop-up names (WL-M13). */
export const JOB_LABELS = ['FIGHTER', 'THIEF', 'B.MAGE', 'W.MAGE'] as const;
/** The names the screen reader says. */
const JOB_SPOKEN = ['Fighter', 'Thief', 'Black Mage', 'White Mage'] as const;
/** What each job's abilities are, read out on a switch (ability names, never buttons). */
const JOB_SAID = [
  'ATTACK: sword.',
  'ATTACK: dagger.',
  'ATTACK: Fire. UP and ATTACK: Bolt. DOWN and ATTACK: Ice.',
  'ATTACK: staff. DOWN and ATTACK: Cure.',
] as const;
/** The class switch's directions (WL-M3, WarriorOfLight.as:467-476). */
const SWITCH_DIR: readonly ['up' | 'right' | 'down' | 'left', Job][] = [
  ['up', JOB.fighter],
  ['right', JOB.bmage],
  ['down', JOB.thief],
  ['left', JOB.wmage],
];

/** Scratch keys. `job` and `cureAt` are carried (no `_`); the rest are per World. */
const K = {
  job: 'job',
  /** The stage (world * 100 + stage) whose Cure charge is spent (WL-M2). */
  cureAt: 'cureAt',
  act: '_act',
  actT: '_actT',
  spell: '_spell',
  wasGround: '_g',
  flash: '_flash',
  walk: '_walk',
  /** The stage being played (stageKey), set each frame. */
  stage: '_stage',
  /** What the HUD's Cure text showed last frame (0 none, 1 ready, 2 used), for the announcements. */
  cureShown: '_cure',
} as const;

export function jobOf(p: Player): Job {
  const j = p.scratch[K.job] ?? 0;
  return (j >= 0 && j <= 3 ? Math.floor(j) : 0) as Job;
}

/* ---------- movement (WL-6, WL-8) ---------- */

/** MOVEMENT_SPEED 200 px/s: 1.6667 px/f. */
export const WL_WALK = 0x01aab;
/** GRAVITY 1400 px/s²: 0.1944 px/f², rising and falling. */
export const WL_GRAVITY = 0x0031c;
/** JUMP_PWR 630 px/s (5.25 px/f) less one frame of gravity, for our move-then-gravity order. */
export const WL_JUMP = 0x050e4;

/** Under water (WL-8): gravity 750 (0.1042 px/f²), the same launch less one frame of it; no stroke. */
export const WL_SWIM: SwimProfile = {
  stroke: 0x05255,
  gravity: 0x001ab,
  sinkMax: 0x02155,
  floorJumpOnly: true,
  surfaceTest: 'top',
};

export const WARRIORS_PROFILE: MovementProfile = {
  minWalk: WL_WALK,
  walkAccel: WL_WALK,
  runAccel: WL_WALK,
  releaseDecel: WL_WALK,
  skidDecel: WL_WALK,
  maxWalk: WL_WALK,
  maxRun: WL_WALK,
  skidTurnaround: WL_WALK,
  jump: [{ maxVx: Infinity, initial: WL_JUMP, holdGravity: WL_GRAVITY, fallGravity: WL_GRAVITY }],
  // No fall cap in the original; 10 px/f as a collision safety cap (WL-M6).
  maxFall: 0x0a000,
  fallReset: 0x0a000,
  runTimerFrames: 0,
  airControl: 'full',
  airStop: true,
  canRun: false,
  variableJump: false,
  instantAccel: true,
  coyoteFrames: 0,
  jumpBuffer: false,
  swim: WL_SWIM,
};

/* ---------- actions (WL-5, WL-12, WL-13, WL-M1) ---------- */

const ACT = { idle: 0, swing: 1, windup: 2, cast: 3 } as const;
/** The swing: 5 steps of 100 ms (WL-12). */
export const SWING_FRAMES = 30;
/** A spell's wind-up (500 ms) and cast pose (300 ms) (WL-13). */
export const WINDUP_FRAMES = 30;
export const CAST_FRAMES = 18;
/** Swing damage by job (DamageValue.as:88-89; the White Mage's staff WL-M1). */
export const SWING_DAMAGE: Readonly<Record<Job, number>> = { 0: 300, 1: 50, 2: 0, 3: 100 };
/** Frames of the switch's palette flash (WL-M3). */
const FLASH_FRAMES = 8;

/** What Attack does now for `job` with this input, or null (WL controls table). */
type Move = 'swing' | WarriorSpellId | 'cure';
function moveFor(p: Player, input: InputFrame): Move | null {
  const up = input.held('up');
  const down = input.held('down');
  if (up && down) return null;
  switch (jobOf(p)) {
    case JOB.fighter:
    case JOB.thief:
      return up || down ? null : 'swing';
    case JOB.bmage:
      return up ? 'bolt' : down ? 'ice' : 'fire';
    case JOB.wmage:
      if (up) return null;
      if (down) return p.powerState === 'small' && cureReady(p) ? 'cure' : null;
      return 'swing';
  }
}

const stageKey = (world: World): number => world.level.world * 100 + world.level.stage;
/**
 * One Cure charge a stage (WL-M2): spent, `cureAt` holds the stage; it is back after a death (the
 * kit is wiped) and at the next stage, but not through a pipe or vine inside the stage.
 */
export function cureReady(p: Player): boolean {
  return p.scratch[K.cureAt] === undefined || p.scratch[K.cureAt] !== p.scratch[K.stage];
}

/** The action that will run this frame (Player.update reads it, through rooted, before update). */
function acting(p: Player): boolean {
  const t = p.scratch[K.actT] ?? 0;
  switch (p.scratch[K.act] ?? 0) {
    case ACT.swing:
      return t < SWING_FRAMES;
    case ACT.windup:
      return true;
    case ACT.cast:
      return t < CAST_FRAMES;
    default:
      return false;
  }
}

/** An action ends: idle again, nothing hit any more, a wind-up casts nothing (WL-M8). */
function endAction(p: Player): void {
  p.scratch[K.act] = ACT.idle;
  p.scratch[K.actT] = 0;
  p.activeMelee = null;
  p.attackTimer = 0;
}

/** The swing's box: 15 x 25 px, 7.5 to 22.5 px ahead of the body's centre, 1 to 26 px above the feet. */
function swingBox(p: Player): { x: number; y: number; w: number; h: number } {
  const b = p.body;
  const cx = b.x + (b.w >> 1);
  const feet = b.y + b.h;
  return {
    x: p.facing > 0 ? cx + px(7.5) : cx - px(22.5),
    y: feet - px(26),
    w: px(15),
    h: px(25),
  };
}

function start(p: Player, world: World, move: Move): void {
  p.scratch[K.actT] = 1;
  if (move === 'swing') {
    p.scratch[K.act] = ACT.swing;
    p.activeMelee = swingBox(p);
    world.audio.sfx('sword');
    return;
  }
  p.scratch[K.act] = ACT.windup;
  p.scratch[K.spell] = move === 'fire' ? 0 : move === 'ice' ? 1 : move === 'bolt' ? 2 : 3;
  world.audio.sfx('charge');
}

/**
 * The White Mage's Cure charge on the HUD (WL-M2): "CURE 1" / "CURE 0", only while small (when Cure
 * can do something); null otherwise.
 */
export function cureText(p: Player): string | null {
  if (jobOf(p) !== JOB.wmage || p.powerState !== 'small') return null;
  return `CURE ${cureReady(p) ? 1 : 0}`;
}

/** The HUD's Cure text changed (shown, or ready / used): the screen reader says so. */
function announceCure(p: Player, world: World): void {
  const now = cureText(p);
  const code = now === null ? 0 : now.endsWith('1') ? 1 : 2;
  const was = p.scratch[K.cureShown];
  p.scratch[K.cureShown] = code;
  if (was === undefined || was === code || code === 0) return;
  world.events.push({ type: 'say', text: code === 1 ? 'Cure ready.' : 'Cure used.' });
}

/** The wind-up ends: the spell, or Cure (a small hero gains the Mushroom, WL-M1). */
function release(p: Player, world: World): void {
  const s = p.scratch[K.spell] ?? 0;
  if (s < 3) {
    castSpell(p, world, (['fire', 'ice', 'bolt'] as const)[s] as WarriorSpellId);
    return;
  }
  if (p.powerState !== 'small' || !cureReady(p)) return;
  p.scratch[K.cureAt] = stageKey(world);
  world.events.push({ type: 'say', text: 'Cure used.' });
  p.powerState = 'big';
  p.crouching = false;
  // The shared grow flash: the 60-frame power-up freeze (PS-C4), no points.
  p.startTransition('freeze', CLASSIC_FREEZE_FRAMES + 1);
  world.audio.sfx('powerup');
  const b = p.body;
  for (const [dx, dy, f] of [
    [-6, -4, 'cure-0'],
    [6, 6, 'cure-1'],
  ] as const)
    world.spawn(new Flash(b.x + px(dx), b.y + px(dy), 'warriors-fx', f, CLASSIC_FREEZE_FRAMES + 12));
}

/** Special + exactly one direction, while idle: the class switch (WL-M3). */
function trySwitch(p: Player, world: World, input: InputFrame): void {
  if (!input.pressed('special')) return;
  const held = SWITCH_DIR.filter(([d]) => input.held(d));
  if (held.length !== 1) return;
  const job = (held[0] as (typeof SWITCH_DIR)[number])[1];
  if (job === jobOf(p)) return;
  p.scratch[K.job] = job;
  p.scratch[K.flash] = FLASH_FRAMES;
  world.audio.sfx('select');
  const b = p.body;
  world.spawn(
    new ScorePopup(b.x + (b.w >> 1) - px(JOB_LABELS[job].length * 4), b.y - px(10), JOB_LABELS[job]),
  );
  world.events.push({ type: 'say', text: `${JOB_SPOKEN[job]}. ${JOB_SAID[job]}` });
}

/* ---------- power (WL-9, WL-10) ---------- */

/**
 * The generic response (WL-9): no push. A 15-frame hurt pose with the controls off, then the
 * original's 1250 ms of invulnerability at 65 % opacity (Character.noDamageTmrDur, TD_ALPHA).
 */
export const WARRIORS_HIT: ClassicHitResponse = {
  kind: 'push',
  vx: 0,
  from: 'source',
  lock: { frames: 15 },
  invuln: CLASSIC_PUSH_INVULN,
  look: { alpha: true },
};
const KIT: ClassicPowerKit = { response: WARRIORS_HIT };

/* ---------- look (WL-26) ---------- */

/** The job's base palette, or its Fire Flower outfit's (WL-9). */
function outfit(job: Job, power: string): string {
  const look = WARRIOR_JOB_LOOKS[job];
  return power === 'fire' ? look.flower : look.palette;
}

function poseOf(p: Player, frame: number): string {
  if (p.dead) return 'die';
  if (p.anim === 'hurt') return 'hurt';
  if (p.anim === 'climb') return 'jump';
  if (p.crouching) return 'crouch';
  const t = p.scratch[K.actT] ?? 0;
  switch (p.scratch[K.act] ?? 0) {
    case ACT.swing:
      return `swing-${t <= 6 ? 0 : t <= 18 ? 1 : 2}`;
    case ACT.windup:
      return `windup-${(frame >> 3) & 1}`;
    case ACT.cast:
      return 'cast';
  }
  // The guide page's demo poses (no World there): attackTimer and the shared walk cycle.
  if (p.anim === 'attack') return 'swing-1';
  if (!p.body.onGround) return p.jumping ? 'jump' : 'fall';
  if (p.anim === 'walk' || p.anim === 'skid') {
    const w = p.scratch[K.walk];
    return `walk-${w === undefined ? p.walkFrame : Math.floor(w / 6) & 3}`;
  }
  return 'stand';
}

function sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec {
  const job = jobOf(p);
  let palette = outfit(job, p.powerState);
  const star = classicStarPaletteStep(p, frame, reduceFlashing);
  const flash = p.scratch[K.flash] ?? 0;
  if (star !== null) palette = `${palette}-star-${star}`;
  else if (flash > 0 && !reduceFlashing) palette = `${palette}-star-${(flash >> 1) & 3}`;
  const pose = poseOf(p, frame);
  return {
    sheet: 'warriors',
    palette,
    frame: `${WARRIOR_JOB_LOOKS[job].job}-${pose}`,
    flip: p.facing < 0,
    offsetX: 1,
    offsetY: p.crouching ? 17 : 6,
  };
}

/* ---------- the def ---------- */

export const WARRIORS_CLASSIC: CharacterDef = {
  // The original's level flags (G-010): not in 3.1.21: helped like Link. level/layers.ts lays its pieces by them.
  levelFlags: { horz: true },
  id: 'warriors',
  name: 'Warriors of Light',
  hudName: 'WARRIOR',
  thanksName: 'WARRIOR',
  rules: 'classic',
  notInOriginal: true,
  movement: WARRIORS_PROFILE,
  damage: { kind: 'powerup', states: CLASSIC_POWER_STATES },
  stomps: false,
  crouches: true,
  canBreakBricks: () => false,
  // BRICK_NONE (WL-20): blocks are plain ceilings from below, hidden ones aren't there at all.
  headBumps: () => false,
  passesHiddenBlocks: true,
  // Swings break plain bricks and bump ? blocks (WL-12, BR-C6).
  meleeStrikesBlocks: true,
  // WL-3, WL-M14: 14 px wide, the same in every state and job.
  hitbox: (p) => (p.crouching ? { w: 14, h: 15 } : { w: 14, h: 26 }),
  sprite,
  blockPowerUp: classicBlockPowerUp,
  jumpSfx: () => 'jump-small',
  portrait: { sheet: 'warriors', palette: 'war-fighter', frame: 'fighter-stand' },
  // The select screen shows the class remembered from the last life (WL-M3).
  portraitFor: (kit) => {
    const job = (kit[K.job] ?? 0) as Job;
    const look = WARRIOR_JOB_LOOKS[job] ?? WARRIOR_JOB_LOOKS[0];
    return { sheet: 'warriors', palette: look.palette, frame: `${look.job}-stand` };
  },
  // The class survives a death (StatManager.currentWarriorType, WL-M3).
  keepOnDeath: [K.job],
  powerIcon: true,
  // `&kit=full` (TG-8, TG-44): nothing to unlock (every attack comes with a class, WL-19), so an
  // empty kit; it starts the hero at the top power state.
  devKit: () => ({}),
  drawLook: (p, _frame, reduce) => classicLook(p, reduce, WARRIORS_HIT.look),
  starMusicLeft: CLASSIC_STAR_MUSIC_LEFT,
  // WL-2, WL-M2: the job on the HUD's third row; the White Mage's Cure charge while it matters.
  hudExtra: (p) => {
    const cure = cureText(p);
    return cure ? `${JOB_LABELS[jobOf(p)]} ${cure}` : JOB_LABELS[jobOf(p)];
  },
  guide: WARRIORS_GUIDE,
  touchLabels(p) {
    const job = jobOf(p);
    return {
      attack: (['SWORD', 'DAGGER', 'SPELL', 'STAFF'] as const)[job],
      special: 'CLASS',
      select: null,
    };
  },
  behaviour: {
    // An action roots the hero on the ground; a ground jump still cancels it (WL-5): 'canJump'.
    // CLASS held (the switch gesture) roots it too, so Special + Left/Right never walks.
    rooted: (p, input) =>
      acting(p) ||
      input.held('special') ||
      ((p.scratch[K.act] ?? 0) === ACT.idle && input.pressed('attack') && !!moveFor(p, input))
        ? 'canJump'
        : false,
    update(p, input, world) {
      const b = p.body;
      p.scratch[K.stage] = stageKey(world);
      announceCure(p, world);
      if ((p.scratch[K.flash] ?? 0) > 0) p.scratch[K.flash] = (p.scratch[K.flash] ?? 0) - 1;
      if (p.anim === 'walk' || p.anim === 'skid') p.scratch[K.walk] = (p.scratch[K.walk] ?? 0) + 1;
      else p.scratch[K.walk] = 0;
      const wasGround = p.scratch[K.wasGround] === 1;
      p.scratch[K.wasGround] = b.onGround ? 1 : 0;
      if (classicBusy(p)) return;
      const act = p.scratch[K.act] ?? 0;
      if (act !== ACT.idle) {
        // A ground jump cancels the action at once (WL-5, WarriorOfLight.as:363-365).
        if (wasGround && !b.onGround && p.jumping && b.vy < 0) {
          endAction(p);
          return;
        }
        const t = (p.scratch[K.actT] ?? 0) + 1;
        p.scratch[K.actT] = t;
        if (act === ACT.swing) {
          if (t > SWING_FRAMES) endAction(p);
          else p.activeMelee = swingBox(p);
        } else if (act === ACT.windup) {
          if (t > WINDUP_FRAMES) {
            p.scratch[K.act] = ACT.cast;
            p.scratch[K.actT] = 1;
            release(p, world);
          }
        } else if (t > CAST_FRAMES) endAction(p);
        return;
      }
      trySwitch(p, world, input);
      if (input.pressed('attack')) {
        const move = moveFor(p, input);
        if (move) start(p, world, move);
      }
    },
    onPowerUp: (p, kind, world) => classicOnPowerUp(p, kind, world, KIT),
    contactDamage: () => null,
    meleeDamage: (p): DamageSource => ({
      kind: 'sword',
      amount: SWING_DAMAGE[jobOf(p)],
      owner: p,
      dirX: p.facing,
      by: p,
    }),
    onHurt: (p, world, fromDir) => {
      endAction(p);
      return classicOnHurt(p, world, fromDir, KIT);
    },
    onGrabVine: (p) => endAction(p),
    onLevelClear: (p) => endAction(p),
    // A co-op drop-in comes back small with its class (WL-23).
    onRespawn: (p) => {
      const job = p.scratch[K.job];
      classicRespawn(p, {});
      if (job !== undefined) p.scratch[K.job] = job;
    },
  },
};
