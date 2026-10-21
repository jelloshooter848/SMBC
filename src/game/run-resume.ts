import { hasKey, loadJson, removeKey, saveJson } from '@engine/save/storage';
import { MAP_SET_IDS, type MapSetId } from '@engine/save/progress';
import { CLASSIC_GAME_MODES, type ClassicGameMode } from '@engine/save/original-options';
import type { MapDifficulty } from '@engine/save/settings';
import type { GameState, Rules } from './context';

/**
 * Classic mode's resume slots (G-008; per-set saves, O-07): the original saves a run from Pause > Load / Save and
 * loads it from the title (PauseMenu.as 28, MenuBox.as 279-318, StatManager.as 610-640, 884-959).
 * Ours stands in with one slot per map set (SMB1, Special, The Lost Levels), written each time a
 * Classic mode run of that set shows a level's WORLD card (so it always holds the start of the
 * level being played, with its checkpoint), and offered as CONTINUE when the set is picked on the
 * CLASSIC menu (original-saves.ts). A game over, or the run's end at the credits, clears it. It keeps what the
 * original's file keeps for the hero playing: the level, lives, score, coins, power and kit;
 * Survival's fallen heroes; the rules the run plays; and, as the original's file keeps them with
 * the run (GameSettings.as 407-414), its Map Difficulty and Game mode (RC-002). Developer runs and
 * link runs (`?level=`, RC-004) never write it. Its own keys, never a campaign
 * save.
 */
/** The single slot of 0.4.x, moved into its set's slot on the first read (migrateClassicResume). */
export const CLASSIC_RESUME_KEY = 'smbc-classic-resume';

/** Map set `set`'s slot. */
export function classicResumeKey(set: MapSetId): string {
  return `${CLASSIC_RESUME_KEY}-${set}`;
}

/**
 * The map set a level id belongs to: `sp-` Special, `ll-` The Lost Levels, anything else SMB1
 * (as original-game.ts mapSetOf reads it; a test keeps the two agreeing).
 */
export function resumeSetOf(levelId: string): MapSetId {
  if (levelId.startsWith('sp-')) return 'special';
  if (levelId.startsWith('ll-')) return 'lost';
  return 'smb';
}

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
  /** When it was written (Date.now()): which set's run is the latest. Older slots have none. */
  savedAt?: number;
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

/** Writes `r` into the slot of its level's map set. */
export function saveClassicResume(r: ClassicResume): void {
  saveJson(classicResumeKey(resumeSetOf(r.levelId)), { ...r, savedAt: Date.now() });
}

/** Clears map set `set`'s slot. */
export function clearClassicResume(set: MapSetId): void {
  migrateClassicResume();
  removeKey(classicResumeKey(set));
}

/**
 * Per-set saves: the single slot of 0.4.x (CLASSIC_RESUME_KEY) moves into the slot of its
 * level's map set, then the old key goes. The old key is gone once read, so one that is there is
 * the newer run (an older build wrote it since) and takes the set's slot. A broken old slot is
 * just dropped. Safe to call at every read.
 */
export function migrateClassicResume(): void {
  if (!hasKey(CLASSIC_RESUME_KEY)) return;
  const old = readSlot(CLASSIC_RESUME_KEY);
  if (old) saveJson(classicResumeKey(resumeSetOf(old.levelId)), loadJson(CLASSIC_RESUME_KEY));
  removeKey(CLASSIC_RESUME_KEY);
}

const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/**
 * Map set `set`'s slot, or null when there is none or it does not read as one (a broken one).
 * Without `set`: the latest written of the sets' slots (the old single slot read the same way).
 */
export function loadClassicResume(set?: MapSetId): ClassicResume | null {
  migrateClassicResume();
  if (set) return readSlot(classicResumeKey(set));
  let best: ClassicResume | null = null;
  for (const id of MAP_SET_IDS) {
    const r = readSlot(classicResumeKey(id));
    if (r && (!best || (r.savedAt ?? 0) > (best.savedAt ?? 0))) best = r;
  }
  return best;
}

/** The slot stored under `key`, checked field by field. */
function readSlot(key: string): ClassicResume | null {
  const r = loadJson<Partial<ClassicResume>>(key);
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
  const { survival: sv, difficulty: d, gameMode: gm, savedAt, ...rest } = r as ClassicResume;
  return {
    ...rest,
    // An older slot, or a value this version does not know: none (the caller falls back).
    ...(d === 'easy' || d === 'normal' || d === 'hard' ? { difficulty: d } : {}),
    ...((CLASSIC_GAME_MODES as readonly string[]).includes(gm as string) ? { gameMode: gm } : {}),
    ...(num(savedAt) ? { savedAt } : {}),
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
