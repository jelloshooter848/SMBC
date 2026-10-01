import type { AssetRegistry } from '@engine/assets/registry';
import type { AudioSink } from '@engine/audio/audio-manager';
import type { CharacterDef } from './characters/character';

/** Per-game assist/accessibility options that affect simulation. */
export interface AssistOptions {
  allowLeftScroll: boolean;
  infiniteLives: boolean;
  invulnerable: boolean;
  infiniteTime: boolean;
  coyoteFrames: number;
  /** When hurt as Fire Mario, drop to Big instead of Small. */
  fireRevertsToBig: boolean;
}

export const DEFAULT_ASSIST: AssistOptions = {
  allowLeftScroll: false,
  infiniteLives: false,
  invulnerable: false,
  infiniteTime: false,
  coyoteFrames: 0,
  fireRevertsToBig: false,
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
  checkpoint: { level: string; x: number } | null;
}

export function newGameState(character: CharacterDef): GameState {
  return {
    character,
    score: 0,
    coins: 0,
    lives: 3,
    world: 1,
    stage: 1,
    powerState: character.damage.kind === 'powerup' ? 'small' : 'full',
    hp: character.damage.kind === 'hp' ? character.damage.max : 0,
    time: null,
    checkpoint: null,
  };
}
