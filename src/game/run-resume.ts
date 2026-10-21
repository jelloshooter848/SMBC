import { loadJson, removeKey, saveJson } from '@engine/save/storage';
import { CLASSIC_GAME_MODES, type ClassicGameMode } from '@engine/save/original-options';
import type { MapDifficulty } from '@engine/save/settings';
import type { GameState, Rules } from './context';

/**
 * Classic mode's resume slot (G-008): the original saves a run from Pause > Load / Save and
 * loads it from the title (PauseMenu.as 28, MenuBox.as 279-318, StatManager.as 610-640, 884-959).
 * Ours stands in with one slot, written each time a Classic mode run shows a level's WORLD card
 * (so it always holds the start of the level being played, with its checkpoint), and offered as
 * CLASSIC > Continue. A game over, or the run's end at the credits, clears it. It keeps what the
 * original's file keeps for the hero playing: the level, lives, score, coins, power and kit;
 * Survival's fallen heroes; the rules the run plays; and, as the original's file keeps them with
 * the run (GameSettings.as 407-414), its Map Difficulty and Game mode (RC-002). Developer runs and
 * link runs (`?level=`, RC-004) never write it. Its own key, never a campaign save.
 */
export const CLASSIC_RESUME_KEY = 'smbc-classic-resume';

export interface ClassicResume {
  v: 1;
  /** The level (its first area, or the area its checkpoint is in) the run goes back to. */
  levelId: string;
  rules: Rules;
  /** The hero playing (the roster def's id, a look's own id for a look). */
  hero: string;
  score: number;
  coins: number;
  lives: number;
  world: number;
  stage: number;
  powerState: string;
  hp: number;
  kit: Record<string, number>;
  warped: boolean;
  checkpoint: GameState['checkpoint'];
  /** Survival: the fallen heroes and whether revival is allowed. */
  survival?: { fallen: string[]; reviveAllowed: boolean };
  /** The run's Map Difficulty (RC-002; a slot from before 0.4.68 has none). */
  difficulty?: MapDifficulty;
  /** The run's Game mode (RC-002; a slot from before 0.4.68 has none). */
  gameMode?: ClassicGameMode;
}

/** The slot for `state` at the WORLD card of `levelId`. */
export function resumeOf(
  levelId: string,
  state: GameState,
  rules: Rules,
  survival?: ClassicResume['survival'],
  run?: { difficulty: MapDifficulty; gameMode: ClassicGameMode },
): ClassicResume {
  return {
    v: 1,
    levelId,
    rules,
    hero: state.character.id,
    score: state.score,
    coins: state.coins,
    lives: state.lives,
    world: state.world,
    stage: state.stage,
    powerState: state.powerState,
    hp: state.hp,
    kit: { ...state.kit },
    warped: state.warped,
    checkpoint: state.checkpoint ? { ...state.checkpoint } : null,
    ...(survival
      ? { survival: { fallen: [...survival.fallen], reviveAllowed: survival.reviveAllowed } }
      : {}),
    ...(run ? { difficulty: run.difficulty, gameMode: run.gameMode } : {}),
  };
}

export function saveClassicResume(r: ClassicResume): void {
  saveJson(CLASSIC_RESUME_KEY, r);
}

export function clearClassicResume(): void {
  removeKey(CLASSIC_RESUME_KEY);
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** The stored slot, or null when there is none or it does not read as one (an older or broken one). */
export function loadClassicResume(): ClassicResume | null {
  const r = loadJson<Partial<ClassicResume>>(CLASSIC_RESUME_KEY);
  if (!r || typeof r !== 'object' || r.v !== 1) return null;
  if (typeof r.levelId !== 'string' || typeof r.hero !== 'string') return null;
  if (r.rules !== 'classic' && r.rules !== 'current') return null;
  if (![r.score, r.coins, r.lives, r.world, r.stage, r.hp].every(num) || (r.lives ?? 0) < 1) return null;
  if (typeof r.powerState !== 'string') return null;
  const kit: Record<string, number> = {};
  if (r.kit && typeof r.kit === 'object') for (const [k, v] of Object.entries(r.kit)) if (num(v)) kit[k] = v;
  const cp = r.checkpoint;
  const checkpoint =
    cp && typeof cp === 'object' && typeof cp.level === 'string' && num(cp.x)
      ? { level: cp.level, x: cp.x, ...(num(cp.y) ? { y: cp.y } : {}) }
      : null;
  const { survival: sv, difficulty: d, gameMode: gm, ...rest } = r as ClassicResume;
  return {
    ...rest,
    // An older slot, or a value this version does not know: none (the caller falls back).
    ...(d === 'easy' || d === 'normal' || d === 'hard' ? { difficulty: d } : {}),
    ...((CLASSIC_GAME_MODES as readonly string[]).includes(gm as string) ? { gameMode: gm } : {}),
    kit,
    warped: r.warped === true,
    checkpoint,
    ...(sv && Array.isArray(sv.fallen)
      ? {
          survival: {
            fallen: sv.fallen.filter((id): id is string => typeof id === 'string'),
            reviveAllowed: sv.reviveAllowed !== false,
          },
        }
      : {}),
  };
}
