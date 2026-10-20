import type { AssetRegistry } from '@engine/assets/registry';
import type { AudioSink } from '@engine/audio/audio-manager';
import { startHp, type CharacterDef } from './characters/character';
import { heroFor } from './characters/registry';
import { CLASSIC_CHEAT_IDS, type ClassicCheatId } from '@engine/save/settings';

/**
 * Which rules the heroes play by (TG-9): 'current' is this game as it has always played;
 * 'classic' is SMBC 3.1.21's rules (Classic mode and dev Classic starts only, never a campaign
 * file: Game.liveRules decides). Absent anywhere means 'current'.
 */
export type Rules = 'current' | 'classic';

/** The rules a context (or a state) names: 'current' unless it says 'classic'. */
export function rulesOf(ctx: { rules?: Rules | undefined }): Rules {
  return ctx.rules ?? 'current';
}

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

/**
 * Classic mode's cheats that are on (settings.classicCheats.on). Only a Classic run under Classic
 * rules has them (GameContext.classicCheats); everywhere else every one reads false (NO_CHEATS).
 */
export type CheatFlags = Readonly<Record<ClassicCheatId, boolean>>;

export const NO_CHEATS: CheatFlags = Object.freeze(
  Object.fromEntries(CLASSIC_CHEAT_IDS.map((id) => [id, false])) as Record<ClassicCheatId, boolean>,
);

/**
 * The assists with the original's three assist-like cheats folded in (Infinite Lives, Infinite
 * Time, Invincible: FU-7e maps them onto the assists' own code paths). A live view: each read
 * asks `cheats()` and `base` again, so a toggle from the pause menu takes effect at once.
 */
export function cheatAssist(base: AssistOptions, cheats: () => CheatFlags): AssistOptions {
  return {
    get allowLeftScroll() {
      return base.allowLeftScroll;
    },
    get infiniteLives() {
      return base.infiniteLives || cheats().infiniteLives;
    },
    get invulnerable() {
      return base.invulnerable || cheats().invincible;
    },
    get infiniteTime() {
      return base.infiniteTime || cheats().infiniteTime;
    },
    get coyoteFrames() {
      return base.coyoteFrames;
    },
    get fireRevertsToBig() {
      return base.fireRevertsToBig;
    },
    get safetyFloor() {
      return base.safetyFloor;
    },
  };
}

/** Shared services every scene and the world can reach. */
export interface GameContext {
  assets: AssetRegistry;
  audio: AudioSink;
  assist: AssistOptions;
  /** Reduced-flashing accessibility option (star palette cycling, etc.). */
  reduceFlashing: boolean;
  /**
   * The live rules (TG-9). Optional: absent is 'current', so every hand-built context (the sims,
   * the test harnesses) plays Current. Game makes it a live view of Game.liveRules; a World reads
   * it once, in its constructor (World.rules).
   */
  rules?: Rules;
  /**
   * Classic mode's cheats (scenes/cheats-menu.ts). Optional: absent everywhere but a Classic run
   * under Classic rules, where Game makes it a live view of settings.classicCheats.on; a World
   * playing Current never reads it (World.cheats).
   */
  classicCheats?: CheatFlags;
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
  /**
   * The campaign file has the Wallet (0.4.42, items/wallet.ts): coins add up to 999 with no
   * automatic 1-up. Never in classic play.
   */
  wallet: boolean;
  /**
   * The level being played shows its campaign label (map/campaign-order.ts: internal 4-2 as
   * WORLD 4-1) on the HUD, its intro card and in the announcer: a campaign file playing an SMB
   * level (Game.goToLevel). Never in classic play or the Lost Levels.
   */
  campaignOrder?: boolean;
  /**
   * The rules `powerState`, `hp`, `kit` and their player-2 copies were earned under (TG-15).
   * Written only as 'classic' (absent: 'current'), so every Current state is exactly as before.
   * Never written into a campaign save (campaign files always play Current). A level start under
   * other rules resets the carried power (rules/reconcile.ts).
   */
  rules?: Rules;
}

export function playerCount(s: GameState): number {
  return s.character2 ? 2 : 1;
}

/** A hero's power at the start of a run (and after a death): small, or full hit points. */
export function defaultPower(def: CharacterDef): string {
  return def.damage.kind === 'powerup' ? 'small' : 'full';
}

/**
 * A fresh run. `character`/`character2` are the roster (Current) defs; the default power and HP
 * come from the defs the World will play (heroFor under `rules`). `rules` is written only when
 * 'classic' (TG-15).
 */
export function newGameState(
  character: CharacterDef,
  character2: CharacterDef | null = null,
  rules: Rules = 'current',
): GameState {
  const h1 = heroFor(character, rules);
  const h2 = character2 ? heroFor(character2, rules) : null;
  const s: GameState = {
    character,
    character2,
    powerState2: h2 ? defaultPower(h2) : 'full',
    hp2: h2 ? startHp(h2) : 0,
    score: 0,
    coins: 0,
    lives: character2 ? 5 : 3,
    world: 1,
    stage: 1,
    powerState: defaultPower(h1),
    hp: startHp(h1),
    time: null,
    checkpoint: null,
    kit: {},
    kit2: {},
    warped: false,
    wallet: false,
  };
  if (rules === 'classic') s.rules = 'classic';
  return s;
}
