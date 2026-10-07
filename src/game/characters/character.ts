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
  /** Apply a hit to the player (already past invulnerability/star checks). */
  onHurt(p: Player, world: World): HurtResult;
  /** The published melee hitbox connected with an enemy. */
  onMeleeHit?(p: Player, enemy: Enemy, world: World): void;
  /** Touched a dropped pickup. Return false to leave it lying there (already full). */
  onPickup?(p: Player, kind: PickupKind, world: World): boolean;
  /** An enemy projectile is about to hit the player; return true to block it (shields). */
  blocks?(p: Player, projectile: Projectile): boolean;
  /** False while the character cannot jump at all (morph ball). */
  canJump?(p: Player): boolean;
  /** The player just got on a vine (Character.getOnVine → setState("vine") ends other states). */
  onGrabVine?(p: Player): void;
  /** The player just got on Castlevania stairs (Player.getOnStairs): end states stairs can't hold. */
  onGrabStairs?(p: Player): void;
  /** Runs instead of `update` each frame on a vine (no attacks there): timers that keep running. */
  vineTick?(p: Player): void;
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
  /** Tool belt entries (Select cycles, C uses). */
  belt?: { name: string; icon: string; cost?: string; does: string }[];
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
  | 'attack (hold)';
export type DemoPose = 'idle' | 'walk' | 'jump' | 'attack' | 'crouch' | 'special';

export interface MeterInfo {
  value: number;
  max: number;
  /** CSS colour of the filled part. */
  colour: string;
  /** One-letter HUD label. */
  label: string;
}

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
  /** What (if anything) a killed enemy drops for this character. */
  drop?(rng: Rng, enemy: Enemy): PickupKind | null;
  /** Tool belt entries (Select cycles, C uses). */
  tools?(p: Player): ToolInfo[];
  /** Secondary HUD meter (magic, weapon energy). */
  meter?(p: Player): MeterInfo | null;
  /** Fully stocked kit for the developer level select. */
  devKit?(): Record<string, number>;
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
}

/** Hit points a fresh run of this character starts with (0 for power-up characters). */
export function startHp(def: CharacterDef): number {
  return def.damage.kind === 'hp' ? (def.startHp ?? def.damage.max) : 0;
}
