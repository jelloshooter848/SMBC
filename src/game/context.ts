import type { AssetRegistry } from '@engine/assets/registry';
import type { AudioSink } from '@engine/audio/audio-manager';
import { startHp, type CharacterDef } from './characters/character';

/** Per-game assist/accessibility options that affect simulation. */
export interface AssistOptions {
  allowLeftScroll: boolean;
  infiniteLives: boolean;
  invulnerable: boolean;
  infiniteTime: boolean;
  coyoteFrames: number;
  /** When hurt as Fire Mario, drop to Big instead of Small. */
  fireRevertsToBig: boolean;
  /**
   * Safety floor: an invisible one-way floor at the rim of every deadly pit, and lava solid from
   * above (world/safety-floor.ts). Falls that lead somewhere still fall.
   */
  safetyFloor: boolean;
}

export const DEFAULT_ASSIST: AssistOptions = {
  allowLeftScroll: false,
  infiniteLives: false,
  invulnerable: false,
  infiniteTime: false,
  coyoteFrames: 0,
  fireRevertsToBig: false,
  safetyFloor: false,
};

/** Shared services every scene and the world can reach. */
export interface GameContext {
  assets: AssetRegistry;
  audio: AudioSink;
  assist: AssistOptions;
  /** Reduced-flashing accessibility option (star palette cycling, etc.). */
  reduceFlashing: boolean;
}

/** Progress carried between levels. */
export interface GameState {
  character: CharacterDef;
  /** Second player's character when playing co-op. */
  character2: CharacterDef | null;
  score: number;
  coins: number;
  lives: number;
  world: number;
  stage: number;
  /** Character power state persisted between levels ('small' | 'big' | 'fire' or hp number). */
  powerState: string;
  hp: number;
  /** Timer carried into bonus rooms. */
  time: number | null;
  /** Checkpoint reached in the current level (x tile), if any. */
  /** `y`: the midpoint's row (12 when left out). */
  checkpoint: { level: string; x: number; y?: number } | null;
  /** Player 2's carried power state / hp. */
  powerState2: string;
  hp2: number;
  /** Character-specific carried state (heart containers, ammo, magic, selected tool...). */
  kit: Record<string, number>;
  kit2: Record<string, number>;
  /** A warp pipe was used this run (The Lost Levels only opens World 9 to warpless runs). */
  warped: boolean;
}

export function playerCount(s: GameState): number {
  return s.character2 ? 2 : 1;
}

export function newGameState(character: CharacterDef, character2: CharacterDef | null = null): GameState {
  return {
    character,
    character2,
    powerState2: character2?.damage.kind === 'powerup' ? 'small' : 'full',
    hp2: character2 ? startHp(character2) : 0,
    score: 0,
    coins: 0,
    lives: character2 ? 5 : 3,
    world: 1,
    stage: 1,
    powerState: character.damage.kind === 'powerup' ? 'small' : 'full',
    hp: startHp(character),
    time: null,
    checkpoint: null,
    kit: {},
    kit2: {},
    warped: false,
  };
}
