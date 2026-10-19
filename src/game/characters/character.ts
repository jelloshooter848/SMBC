import type { InputFrame } from '@engine/input/input-manager';
import type { MovementProfile } from './profile';
import type { Player } from '../entities/player';
import type { World } from '../world/world';
import type { DamageSource } from '../rules/damage';
import type { PowerUpKind } from '../entities/objects/powerup';
import type { PickupKind } from '../entities/objects/pickup';
import type { Enemy } from '../entities/enemies/enemy';
import type { Projectile } from '../entities/projectiles/projectile';
import type { Rng } from '@engine/rng';
import type { ToolInfo } from './toolbelt';
import type { TouchLabels } from '@engine/input/touch';
import type { TileMap } from '../world/tilemap';
import type { AudioSink } from '@engine/audio/audio-manager';
import type { VineArt } from '../entities/objects/vine';

export type DamageModel =
  | { kind: 'powerup'; states: readonly string[] }
  | {
      kind: 'hp';
      max: number;
      hudStyle: 'hearts' | 'bar' | 'number';
      invulnFrames: number;
      knockback: { vx: number; vy: number } | null;
    };

export interface SpriteSpec {
  sheet: string;
  palette: string;
  frame: string;
  flip: boolean;
  /** Draw offset from the hitbox top-left (sprites are usually larger than hitboxes). */
  offsetX: number;
  offsetY: number;
  /** Also flipped top to bottom (Sophia III upside down on a ceiling). */
  flipY?: boolean;
  /**
   * A quarter turn clockwise, after the flips (Sophia III on a wall: 90 has her wheels on the
   * left). A turned sprite is drawn centred on the hitbox; `offsetX` / `offsetY` are ignored.
   */
  rotate?: 0 | 90 | 180 | 270;
}

export type HurtResult = 'dead' | 'hurt' | 'ignored';

/** Per-character hooks. The shared Player handles movement; these add attacks, power-ups and damage. */
export interface CharacterBehaviour {
  /** Runs after movement each frame. Attacks, slides, weapon logic. */
  update(p: Player, input: InputFrame, world: World): void;
  /** A helpful item was collected (a poison mushroom is handled by the world, never here). */
  onPowerUp(p: Player, kind: Exclude<PowerUpKind, 'poison' | 'clock'>, world: World): void;
  /** The player ran into an enemy without stomping. Return damage to deal instead of getting hurt, or null. */
  contactDamage(p: Player, enemy: Enemy, world: World): DamageSource | null;
  /**
   * Apply a hit to the player (already past invulnerability/star checks). `fromDir` is the way
   * the hit pushes (+1: the source is on the left), as World.hurtPlayer was given it.
   */
  onHurt(p: Player, world: World, fromDir?: -1 | 1): HurtResult;
  /** The published melee hitbox connected with an enemy. */
  onMeleeHit?(p: Player, enemy: Enemy, world: World): void;
  /**
   * The damage the published melee hitbox deals to `enemy` (TG-24; Classic defs: the original's
   * units, pierce, hit-stun, blocked sound; `owner: p`). Without it a melee hit is
   * `{ kind: 'sword', amount: 1 }`, as for every Current def.
   */
  meleeDamage?(p: Player, enemy: Enemy): DamageSource;
  /** Touched a dropped pickup. Return false to leave it lying there (already full). */
  onPickup?(p: Player, kind: PickupKind, world: World): boolean;
  /** An enemy projectile is about to hit the player; return true to block it (shields). */
  blocks?(p: Player, projectile: Projectile): boolean;
  /**
   * The hero is rooted to the spot this frame (Classic SMBC only; absent: never). Read by
   * Player.update (tier path) before the walk step, with this frame's input, and only on the
   * ground, next to Player.root (a stop counted in frames): Left/Right neither move nor turn him.
   * `true` also forbids jumping (Classic Link's ground stab and throw, LK-C6); `'canJump'` lets
   * him jump out of it (Classic Simon's whip and throws SI-C4, Samus crouched or holding Down
   * SA-C4, Pit aiming up PI-9). `false`: free.
   */
  rooted?(p: Player, input: InputFrame): boolean | 'canJump';
  /** False while the character cannot jump at all (morph ball). */
  canJump?(p: Player): boolean;
  /**
   * False while Down + Jump must not start a slide (Classic Mega Man carrying a Super Arm brick,
   * MM-C6). Absent: a profile with a slide always may.
   */
  canSlide?(p: Player): boolean;
  /** The player just got on a vine (Character.getOnVine → setState("vine") ends other states). */
  onGrabVine?(p: Player): void;
  /** The player just got on Castlevania stairs (Player.getOnStairs): end states stairs can't hold. */
  onGrabStairs?(p: Player): void;
  /** Runs instead of `update` each frame on a vine (no attacks there): timers that keep running. */
  vineTick?(p: Player): void;
  /**
   * The hero's own movement code (Sophia III's driving): runs in Player.update in place of the
   * shared walking, jumping and swimming (after the vine and stairs checks). Returns false to
   * fall back to the shared code this frame (Jason on foot).
   */
  drive?(
    p: Player,
    input: InputFrame,
    map: TileMap,
    audio: AudioSink,
    onHeadBump?: (tx: number, ty: number) => void,
  ): boolean;
  /** False to leave this vine (or ladder, chain) alone: a tank never grabs a ladder. */
  canGrabVine?(p: Player, art: VineArt, world: World): boolean;
  /**
   * The player touched the flagpole or the castle axe: end states the clear sequence can't hold
   * (Sophia III turns upright off a wall).
   */
  onLevelClear?(p: Player): void;
  /** A co-op player dropped back in (World.respawn): reset states the respawn doesn't know. */
  onRespawn?(p: Player, world: World): void;
  /**
   * A body wider than a tile falling in (start mode `fall`) where the drop is a one-tile gap
   * (World.wideFall found no clear column): fit it through, centred on column `tx`, the gap's
   * narrow part ending at row `lip` (Sophia III goes nose first).
   */
  narrowFall?(p: Player, tx: number, lip: number): void;
}

/** How a hero plays, shown on the "How to play" pages. Text is wrapped and upper-cased. */
export interface CharacterGuide {
  /** One line under the name. */
  tagline: string;
  /**
   * Actions in the order to list them; combined inputs are written as 'up+attack'. `touch` is
   * the ability's name for attack, special and select rows: the caption the touch button shows
   * (as `touchLabels` does, e.g. RUN, SWORD, TOOLS), or for the tool button, whose caption is
   * the selected tool's name, what it does ("USE TOOL", "THROW"). The guide names every row by
   * its ability, never by a button letter. `touchDoes` replaces `does` on touch where the touch
   * controls differ (the d-pad edge runs).
   */
  controls: { action: GuideAction; does: string; touch?: string; touchDoes?: string }[];
  powerups: { item: 'mushroom' | 'flower' | 'star' | 'drops'; does: string }[];
  /** Tool belt entries (Select cycles, C uses); `sheet` holds the icon (default `items`). */
  belt?: { name: string; icon: string; sheet?: string; cost?: string; does: string }[];
  tips?: string[];
  /** Poses the live demo cycles through on the page. */
  demo: DemoPose[];
}
export type GuideAction =
  | 'left/right'
  | 'jump'
  | 'attack'
  | 'special'
  | 'select'
  | 'up'
  | 'down'
  | 'up+attack'
  | 'down+attack'
  | 'down+jump'
  | 'down+special'
  | 'attack (hold)';
export type DemoPose = 'idle' | 'walk' | 'jump' | 'attack' | 'crouch' | 'special';

export interface MeterInfo {
  value: number;
  max: number;
  /** CSS colour of the filled part. */
  colour: string;
  /** One-letter HUD label. */
  label: string;
  /**
   * A dark box behind the label and bar, so they read over castle ceilings (Classic Mega Man's
   * weapon energy). Absent: drawn straight over the level (Current meters).
   */
  backing?: boolean;
}

/**
 * A hero definition. Optional-field policy (TG-23): what Classic SMBC adds goes in OPTIONAL fields
 * here, on MovementProfile/SwimProfile (profile.ts) and on projectile specs, set only by Classic
 * defs (`characters/<id>/classic.ts`, `characters/classic/`). Absent, today's code path runs
 * unchanged; no Current def sets one. A shared system that must differ beyond that branches on
 * `world.rules` in exactly one place (Enemy.hit, World.strikeBlock, ...).
 */
export interface CharacterDef {
  id: string;
  name: string;
  /** Short upper-case HUD label. */
  hudName: string;
  movement: MovementProfile;
  damage: DamageModel;
  /** Landing on an enemy kills it (Mario) or hurts the player (Link, Mega Man). */
  stomps: boolean;
  /** Can duck with down (Mario when big, Link). */
  crouches: boolean;
  canBreakBricks(p: Player): boolean;
  hitbox(p: Player): { w: number; h: number };
  sprite(p: Player, frame: number, reduceFlashing: boolean): SpriteSpec;
  /** Which item a "powerup" block yields for this character right now. */
  blockPowerUp(p: Player): PowerUpKind;
  jumpSfx(p: Player): string;
  behaviour: CharacterBehaviour;
  /** Optional music override for the overworld theme. */
  music?: string;
  /** Frame used on the character select / intro card. */
  portrait: { sheet: string; palette: string; frame: string };
  /**
   * A Classic-only extra drawn on its own sheet (Pit's, Proto Man's) whose `portrait` still names
   * the hero it is built on: the frame the character select and the intro card show instead.
   * Absent: `portrait` (shownPortrait).
   */
  portraitArt?: { sheet: string; palette: string; frame: string };
  /** What (if anything) a killed enemy drops for this character (`killer`: the player who got it). */
  drop?(rng: Rng, enemy: Enemy, killer?: Player): PickupKind | null;
  /**
   * Classic rules (BR-C6): the published melee hitbox also strikes the blocks it overlaps, each
   * once per swing (a plain brick breaks, an item block bumps). Only Classic defs set it.
   */
  meleeStrikesBlocks?: boolean;
  /**
   * False while the head touches blocks as plain ground: no bump, no break (Classic BR-C3's
   * BRICK_NONE: Samus in the morph ball, Ryu clinging to a wall). Absent: the head bumps.
   */
  headBumps?(p: Player): boolean;
  /**
   * No blinking while invulnerable after a hit (Player.visible): the hero shows it its own way
   * (Sophia III's hull flashes through palettes).
   */
  noHurtBlink?: boolean;
  /** Tool belt entries (Select cycles, C uses). */
  tools?(p: Player): ToolInfo[];
  /** Secondary HUD meter (magic, weapon energy). */
  meter?(p: Player): MeterInfo | null;
  /** Fully stocked kit for the developer level select. */
  devKit?(): Record<string, number>;
  /** The kit the How to play page's live demo uses (Classic Vic Viper: none). Absent: `devKit`. */
  guideKit?(): Record<string, number>;
  /**
   * Reserve energy tanks drawn as small boxes above the EN number (Samus, NES Metroid style):
   * `full` of `total` hold energy, `bar` is the number shown. Null with no tanks.
   */
  energyTanks?(p: Player): { full: number; total: number; bar: number } | null;
  /** Short extra HUD text under the name (stored E-tanks...). */
  hudExtra?(p: Player): string | null;
  /** A stored item usable from the pause menu (E-tanks). `label` is null when there is none. */
  reserve?: { label(p: Player): string | null; use(p: Player, world: World): boolean };
  /** Starting hit points when lower than `damage.max` (Samus's energy grows with tanks). */
  startHp?: number;
  /** "How to play" page content. */
  guide: CharacterGuide;
  /**
   * What the touch buttons say for this hero right now (short upper-case words; null hides a
   * button that does nothing in this state). Merged over the level's defaults: A "JUMP",
   * Start "MENU", B and C hidden, Select "TOOLS" with two or more tools (touch-labels.ts).
   */
  touchLabels?(p: Player, world: World): TouchLabels;
  /**
   * How the hero looks this frame (Classic SMBC's hit looks, PS-C13: 65 % opacity, a flicker).
   * Absent: Player.visible's blink while invulnerable. `alpha` 1 draws as usual.
   */
  drawLook?(p: Player, frame: number, reduceFlashing: boolean): { visible: boolean; alpha: number };
  /**
   * What a broken brick or a coin out of a block drops for this hero (Classic SMBC, PS-C15),
   * rolled once per brick or coin by World.strikeBlock. Absent: nothing.
   */
  blockDrop?(rng: Rng, p: Player, source: 'brick' | 'coin'): PickupKind | null;
  /**
   * Star frames left when the level music comes back (Classic SMBC, PS-C19: 78). Absent: 1, the
   * Star's last frame.
   */
  starMusicLeft?: number;
  /**
   * One ammo counter in the tool slot (Classic SMBC, PS-C27: icon, then ×NN), for a hero with no
   * tool belt. Null hides it. Absent: nothing (a belt is drawn from `tools`).
   */
  hudAmmo?(p: Player): { icon: string; sheet?: string; count: number } | null;
  /**
   * The HUD shows a Mushroom or Fire Flower icon for this hero's power (Classic SMBC, PS-C26).
   * Absent: no icon (Current heroes).
   */
  powerIcon?: boolean;
  /**
   * 'classic' on a Classic SMBC def (TG-18): registry.ts's CLASSIC_CHARACTERS and CLASSIC_EXTRAS.
   * Never set on a CHARACTERS entry (TG-39). Classic defs use `damage: { kind: 'powerup', states:
   * ['small', 'big', 'fire'] }` (TG-21: Mushroom tier stored as 'big', Flower as 'fire') and leave
   * out tools, meter, hudExtra, reserve, startHp and drop unless their report asks (TG-22).
   */
  rules?: 'classic';
  /**
   * Classic SMBC's death (ML-C18): `freeze` frames still, then a hop at -`vy` with `gravity`
   * (velocity units, gravity added before the move) capped at `maxFall`; the death ends at frame
   * `frames`, or `pitFrames` for a fall off the screen (no hop). Absent: today's hop.
   */
  deathHop?: {
    freeze: number;
    vy: number;
    gravity: number;
    maxFall: number;
    frames: number;
    pitFrames: number;
  };
  /**
   * Classic SMBC's walk to Toad after the castle axe (ML-C26): `speed` (velocity units) a frame,
   * then a slide to a stop, vx *= `stop` (16.16) a frame until below `snap`. Absent: 1 px a frame,
   * stopping dead.
   */
  axeWalk?: { speed: number; stop: number; snap: number };
  /**
   * A Blooper cannot hurt this hero standing on the sea floor two tiles above the stage bottom
   * (Classic SMBC ML-C25, MarioBase.hitEnemy's BLOOPA_NO_HURT_Y).
   */
  seaFloorSafe?: boolean;
  /**
   * The sound the character select plays when this hero is picked (Classic Proto Man's whistle,
   * PM-18). Absent: the select's usual sound. Only Classic-only extras set it.
   */
  pickSfx?: string;
  /**
   * The screen scrolls right by itself while this hero is in the level (Classic Vic Viper, VV-9..
   * VV-12): `speed` (velocity units) a frame, the camera ignoring the players, and each player
   * with this field carried along by the same amount. It stops at the camera's end; it holds
   * whenever the world stands still (pipes, clears, freezes). Absent: the camera follows.
   */
  autoScroll?: {
    speed: number;
    /**
     * Pushed into a wall by the screen's left edge: 'eject' moves the hero to the nearest free
     * place (up or down by up to two tiles, else just past the wall) and only squashes it when there
     * is none. Absent: squashed, as on an auto-scroll map.
     */
    pinned?: 'eject';
  };
  /**
   * Flies with no gravity (Vic Viper, VV-5): dropped in from the top of an area, it is steered at
   * once instead of after the fall-in (it never lands). Absent: today's fall-in.
   */
  flies?: boolean;
  /** Enters pipes in mid-air too (Vic Viper's canEnterPipesUngrounded, VV-27). Absent: on the ground only. */
  pipesAirborne?: boolean;
  /**
   * A Gradius-style power bar on the HUD's third row (Vic Viper, VV-20): the slots' short labels
   * (blank when maxed: `available` false), the lit one (1-based; 0 for none) and its full name.
   * Null hides it. Absent: nothing.
   */
  powerBar?(
    p: Player,
  ): { slots: { label: string; available: boolean }[]; selected: number; name: string } | null;
  /**
   * How a power-up of `kind` struck from a block by this hero is drawn (Vic Viper's Fire Flower is
   * a power capsule, VV-M3). Null or absent: the item's own art.
   */
  powerUpArt?(kind: PowerUpKind): { sheet: string; frames: readonly string[] } | null;
  /**
   * The name Toad thanks after the castle axe ("THANK YOU <name>!"), when not `name` (Classic
   * Warriors of Light: WARRIOR, WL-M13). Absent: `name`.
   */
  thanksName?: string;
  /**
   * Hidden blocks are not there for this hero: the head passes through them and never reveals
   * them (Classic Warriors of Light, BRICK_NONE: WL-20, Character.as:1464-1466). Absent: a hidden
   * block stops a head moving up, as today.
   */
  passesHiddenBlocks?: boolean;
  /**
   * The select screen's portrait for this hero with carried kit `kit` (Classic Warriors of Light:
   * the class remembered from the last life, WL-M3). Absent: `portrait`.
   */
  portraitFor?(kit: Readonly<Record<string, number>>): { sheet: string; palette: string; frame: string };
  /**
   * Kit keys a death (and picking the same hero again on the select screen) keeps outside the
   * campaign (Classic Warriors of Light's class, WL-M3). Absent: a death wipes the whole kit.
   */
  keepOnDeath?: readonly string[];
  /**
   * Down crouches only with no left/right and no up held (Classic SMBC Bill, BI-C3/BI-C8: Down plus a
   * direction walks with the gun aimed down, and Up wins over Down). Absent: Down crouches whatever
   * else is held, as today.
   */
  crouchNeedsNoDirection?: boolean;
  /**
   * A death that throws the body (Classic SMBC Bill, BI-C15): vx = `vx` in direction `dir(p)`,
   * vy = -`vy`, then each frame gravity (added before the move, as the original does) capped at
   * `maxFall`; the body lands on the ground and lies there. The death ends `afterLand` frames
   * after landing, or at `maxFrames` if he never lands. A fall off the bottom of the screen keeps
   * the shared pit death. Velocity units. Absent: today's hop.
   */
  deathThrow?: {
    vx: number;
    vy: number;
    gravity: number;
    maxFall: number;
    afterLand: number;
    maxFrames: number;
    dir(p: Player): -1 | 1;
  };
  /**
   * The original's per-hero level flags (Classic SMBC, Sophia III's SO-5): `usesHorzObjs`,
   * `usesVertObjs`, `isWideCharacter`, `isGoodSwimmer`, `poorBowserFighter`. The Classic level
   * load reads `wide` (rules/classic-level-variants.ts). No Current def sets it.
   */
  levelFlags?: {
    horz?: boolean;
    vert?: boolean;
    wide?: boolean;
    goodSwimmer?: boolean;
    poorBowser?: boolean;
  };
}

/**
 * The power states every Classic def uses (TG-21): small, the Mushroom tier stored as 'big' and
 * the Flower tier as 'fire', the ids the dev select, saves, the co-op drop-in and the HUD know.
 */
export type ClassicPowerState = 'small' | 'big' | 'fire';
export const CLASSIC_POWER_STATES: readonly ClassicPowerState[] = ['small', 'big', 'fire'];

/** Hit points a fresh run of this character starts with (0 for power-up characters). */
export function startHp(def: CharacterDef): number {
  return def.damage.kind === 'hp' ? (def.startHp ?? def.damage.max) : 0;
}

/** The frame the character select and the intro card draw for this hero (`portraitArt`, else `portrait`). */
export function shownPortrait(def: CharacterDef): CharacterDef['portrait'] {
  return def.portraitArt ?? def.portrait;
}
