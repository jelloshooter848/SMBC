import type { InputFrame } from '@engine/input/input-manager';
import type { MovementProfile } from './profile';
import type { Player } from '../entities/player';
import type { World } from '../world/world';
import type { DamageSource } from '../rules/damage';
import type { PowerUpKind } from '../entities/objects/powerup';
import type { Enemy } from '../entities/enemies/enemy';

export type DamageModel =
  | { kind: 'powerup'; states: readonly string[] }
  | {
      kind: 'hp';
      max: number;
      hudStyle: 'hearts' | 'bar';
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
  onPowerUp(p: Player, kind: PowerUpKind, world: World): void;
  /** The player ran into an enemy without stomping. Return damage to deal instead of getting hurt, or null. */
  contactDamage(p: Player, enemy: Enemy, world: World): DamageSource | null;
  /** Apply a hit to the player (already past invulnerability/star checks). */
  onHurt(p: Player, world: World): HurtResult;
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
}
